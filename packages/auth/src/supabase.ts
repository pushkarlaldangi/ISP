/**
 * Supabase Auth server-side clients.
 *
 * Three flavors because Next.js exposes cookies differently in each context:
 *   - Route handlers / server components → next/headers cookies() (read+write)
 *   - Middleware                          → NextRequest / NextResponse cookies
 *   - Privileged background jobs          → service-role, no cookies
 *
 * Consumers should import the variant matching their context and never
 * touch supabase-js directly so the cookie plumbing stays in one place.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * For App Router route handlers + server components. Pass `cookies()` from
 * `next/headers`; the helper reads/writes session cookies through it.
 */
export function createSupabaseRouteClient(cookieStore: CookieJar): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookies) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies — the middleware refreshes
          // tokens, so silently ignoring here is correct.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use only from privileged contexts:
 * cron jobs, admin endpoints, the user-bootstrap row insert. Never expose
 * this client to user input directly.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Shape compatible with the subset of next/headers cookies() that we use.
 * Kept narrow so the type works both with the ReadonlyRequestCookies the
 * route handler exposes and the writable variant in middleware.
 */
export interface CookieJar {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}
