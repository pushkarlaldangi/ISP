/**
 * First-login user bootstrap.
 *
 * Supabase Auth has its own auth.users table. We mirror authenticated
 * users into our public.users table so:
 *   - RLS policies on portfolio tables can reference a stable FK
 *   - PII (email, display name) is encrypted at rest with our app-layer key
 *   - We can soft-delete (DPDP grace period) without touching auth.users
 *
 * Called from server components / route handlers after a successful
 * sign-in. Idempotent — safe to call on every authenticated request,
 * though in practice we call it once per session.
 */

import { eq } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';

import { encryptPii, hashEmailForLookup } from './pii';

export interface BootstrappedUser {
  id: string; // our users.id (uuid)
  authProviderId: string; // Supabase auth.uid()
  emailHash: string;
  displayName: string | null;
  disclaimerAcceptedAt: Date | null;
  mfaEnabled: boolean;
}

export interface BootstrapInput {
  authProviderId: string;
  email: string;
  displayName?: string | null;
}

/**
 * Find or create the users row for a given Supabase Auth user.
 *
 * Returns the row from our DB. If the row already exists, returns it as-is
 * (does NOT refresh email/display name — those are updated through the
 * settings page so we have an audit trail).
 */
export async function bootstrapUser(input: BootstrapInput): Promise<BootstrappedUser> {
  const db = getDb();
  const emailHash = hashEmailForLookup(input.email);

  const existing = await db
    .select({
      id: schema.users.id,
      authProviderId: schema.users.authProviderId,
      emailHash: schema.users.emailHash,
      displayName: schema.users.displayName,
      disclaimerAcceptedAt: schema.users.disclaimerAcceptedAt,
      mfaEnabled: schema.users.mfaEnabled,
    })
    .from(schema.users)
    .where(eq(schema.users.authProviderId, input.authProviderId))
    .limit(1);

  if (existing[0]) return existing[0];

  const emailEncrypted = encryptPii(input.email);
  const [inserted] = await db
    .insert(schema.users)
    .values({
      authProviderId: input.authProviderId,
      emailEncrypted,
      emailHash,
      displayName: input.displayName ?? null,
    })
    .returning({
      id: schema.users.id,
      authProviderId: schema.users.authProviderId,
      emailHash: schema.users.emailHash,
      displayName: schema.users.displayName,
      disclaimerAcceptedAt: schema.users.disclaimerAcceptedAt,
      mfaEnabled: schema.users.mfaEnabled,
    });
  if (!inserted) throw new Error('failed to insert users row');
  return inserted;
}
