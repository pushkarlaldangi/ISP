import { boolean, customType, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * App-layer encrypted PII. The `bytea` raw column is opaque to readers
 * without the encryption key; serialization/deserialization is handled
 * in the auth layer (`packages/auth`).
 */
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Supabase Auth user id (auth.users.id). We mirror to our own table so
    // RLS policies can reference a stable FK and so we can soft-delete.
    authProviderId: text('auth_provider_id').notNull().unique(),
    emailEncrypted: bytea('email_encrypted').notNull(),
    // Deterministic hash used for lookup; salted with PII_LOOKUP_SALT.
    emailHash: text('email_hash').notNull().unique(),
    displayName: text('display_name'),
    disclaimerAcceptedAt: timestamp('disclaimer_accepted_at', { withTimezone: true }),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('users_auth_provider_idx').on(t.authProviderId)],
);
