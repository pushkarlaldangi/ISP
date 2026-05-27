/**
 * GET /auth/callback
 *
 * Handles the server-side leg of the auth flow.
 *
 * Magic links with implicit flow: Supabase redirects to this URL with
 * `#access_token=...` in the fragment. Fragments are never sent to the
 * server, so we serve a tiny HTML page that lets the Supabase JS client
 * (loaded inline) exchange the fragment for a session cookie, then
 * redirects to `?next`.
 *
 * PKCE flow (OAuth, future): arrives with `?code=...` — handled directly
 * in this route handler.
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

  // ── Implicit flow ────────────────────────────────────────────────────────
  // No `code` param means the token arrives in the URL hash (e.g.
  // #access_token=...&refresh_token=...). Hashes are never sent to the
  // server, so we serve a small client-side page that calls
  // supabase.auth.getSession() — which reads the hash, sets the cookies,
  // then redirects to `next`.
  if (!code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const nextPath = encodeURIComponent(next);

    // Inline script — tiny, no external deps other than Supabase CDN
    const html = `<!DOCTYPE html>
<html>
<head><title>Signing in…</title></head>
<body>
<p style="font-family:sans-serif;padding:2rem">Completing sign-in…</p>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script>
(async () => {
  const { createClient } = supabase;
  const client = createClient(
    ${JSON.stringify(supabaseUrl)},
    ${JSON.stringify(supabaseAnonKey)},
    { auth: { flowType: 'implicit' } }
  );
  // getSession() reads #access_token from the hash and sets cookies
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    window.location.href = '/sign-in?error=' + encodeURIComponent(
      (error && error.message) || 'Sign-in failed. Please request a new link.'
    );
    return;
  }
  window.location.href = decodeURIComponent(${JSON.stringify(nextPath)}) || '/';
})();
</script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // ── PKCE flow (OAuth / future use) ───────────────────────────────────────
  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient<Record<string, unknown>>(
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

  let userId: string | null = null;
  try {
    const row = await bootstrapUser({
      authProviderId: data.user.id,
      email: data.user.email,
      displayName: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    });
    userId = row.id;
  } catch (err) {
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

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}
