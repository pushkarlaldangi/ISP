/**
 * @isp/auth — Supabase Auth helpers + PII encryption + audit log.
 *
 * Consumers should import from this entry point (or the typed subpaths
 * listed in package.json) so that route handlers and pages don't reach
 * into supabase-js directly.
 */

import type { CookieJar, createSupabaseRouteClient as RouteClientFactory } from './supabase';

import { bootstrapUser, type BootstrappedUser } from './bootstrap';
import { createSupabaseRouteClient, createSupabaseServiceClient } from './supabase';

export type { BootstrappedUser } from './bootstrap';
export type { ActorType, AuditEntry } from './audit';
export type { CookieJar } from './supabase';

export { bootstrapUser } from './bootstrap';
export { writeAudit } from './audit';
export { encryptPii, decryptPii, hashEmailForLookup } from './pii';
export { createSupabaseRouteClient, createSupabaseServiceClient } from './supabase';

/**
 * Resolve the current authenticated user for a route handler / server
 * component. Returns null when the visitor is signed out; bootstraps a
 * users row on first sign-in. The caller passes the `cookies()` jar from
 * `next/headers`.
 */
export async function getCurrentUser(cookies: CookieJar): Promise<BootstrappedUser | null> {
  const supabase = createSupabaseRouteClient(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return bootstrapUser({
    authProviderId: user.id,
    email: user.email,
    displayName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });
}

// Re-export factory type so callers can spell it without reaching into ./supabase.
export type SupabaseRouteClientFactory = typeof RouteClientFactory;
export { createSupabaseRouteClient as createServerClient };
export { createSupabaseServiceClient as createServiceClient };
