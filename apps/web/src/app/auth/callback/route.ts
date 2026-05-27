/**
 * GET /auth/callback
 *
 * Landing URL for magic-link / OAuth redirects from Supabase. Supabase
 * sends the user here with a `?code=…` query — we exchange it for a
 * session (cookies are written by the SSR client), bootstrap our public
 * users row, write an audit entry, then forward to `?next`.
 *
 * IMPORTANT: We construct the Supabase client directly here (not via the
 * shared helper) so we can write session cookies onto the NextResponse
 * object. The shared helper silently swallows cookie writes in server
 * components — that causes "PKCE code verifier not found" if the verifier
 * cookie was never persisted from the signInWithOtp call.
 */

import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { bootstrapUser, writeAudit } from '@isp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const next = sanitizeNext(url.searchParams.get('next'));
  const errorDesc = url.searchParams.get('error_description');

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(errorDesc)}`, origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent('Missing sign-in code.')}`, origin),
    );
  }

  // Build a response we can mutate — Supabase needs to write session cookies
  // onto the actual HTTP response, not just into next/headers.
  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
        ) {
          // Write onto both the request (so subsequent getAll() see them)
          // and the response (so the browser receives them).
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set(name, value);
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2],
            );
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user || !data.user.email) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(
          error?.message ?? 'Could not complete sign-in. Please request a new link.',
        )}`,
        origin,
      ),
    );
  }

  // Mirror into our users table (idempotent).
  let userId: string | null = null;
  try {
    const row = await bootstrapUser({
      authProviderId: data.user.id,
      email: data.user.email,
      displayName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    });
    userId = row.id;
  } catch (err) {
    // Don't block sign-in on a bootstrap failure — the session cookie is
    // already set; the user can still browse and the row will be retried.
    console.warn('[auth/callback] bootstrap failed:', err);
  }

  const hdr = await headers();
  await writeAudit({
    userId,
    actorType: 'USER',
    action: 'auth.sign_in',
    entityType: 'user',
    entityId: userId,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
  });

  return response;
}

/** Only allow internal relative paths as the post-login destination. */
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
