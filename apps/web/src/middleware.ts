import { type NextRequest, NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';

/**
 * Edge middleware — runs on every request before page/API handler.
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session (keeps cookie fresh)
 * 2. Redirect unauthenticated users away from protected routes
 * 3. Add Content-Security-Policy header
 *
 * NOTE: /auth/* is intentionally excluded from this middleware via the
 * matcher so we never interfere with the PKCE callback exchange.
 */

const PROTECTED_PREFIXES = ['/portfolio', '/watchlist', '/settings', '/alerts'];
const AUTH_ROUTES = ['/sign-in'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2],
            ),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (isProtected && !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/sign-in';
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));
    if (isAuthRoute && user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/portfolio';
      redirectUrl.searchParams.delete('next');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Content-Security-Policy
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.posthog.com https://*.sentry.io`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ''} https://app.posthog.com https://*.sentry.io https://www.amfiindia.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ]
    .filter(Boolean)
    .join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Exclude:
     * - _next/static, _next/image  (Next.js internals)
     * - favicon.ico, robots.txt, sitemap.xml
     * - /auth/*  ← CRITICAL: never run middleware on the PKCE callback
     *             route — it would call getUser() and corrupt the
     *             code_verifier cookie before the route handler reads it
     * - /api/*   (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|auth/|api/).*)',
  ],
};
