/**
 * GET /auth/callback
 *
 * Landing URL for magic-link / OAuth redirects from Supabase. Supabase
 * sends the user here with a `?code=…` query — we exchange it for a
 * session (cookies are written by the SSR client), bootstrap our public
 * users row, write an audit entry, then forward to `?next`.
 */

import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { bootstrapUser, createServerClient, writeAudit } from '@isp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const next = sanitizeNext(url.searchParams.get('next'));
  const errorDesc = url.searchParams.get('error_description');

  if (errorDesc) {
    return redirectTo(url, '/sign-in', `?error=${encodeURIComponent(errorDesc)}`);
  }
  if (!code) {
    return redirectTo(url, '/sign-in', `?error=${encodeURIComponent('Missing sign-in code.')}`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user || !data.user.email) {
    return redirectTo(
      url,
      '/sign-in',
      `?error=${encodeURIComponent(error?.message ?? 'Could not complete sign-in. Please request a new link.')}`,
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
    // Don't block sign-in on a bootstrap failure — surface it but let the
    // session cookie persist; the next authed request will retry the row
    // creation. The user can still browse.
    // eslint-disable-next-line no-console
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

  return redirectTo(url, next, '');
}

/** Only allow internal relative paths as the post-login destination. */
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function redirectTo(req: URL, path: string, qs: string): NextResponse {
  const target = new URL(path + qs, req);
  return NextResponse.redirect(target);
}
