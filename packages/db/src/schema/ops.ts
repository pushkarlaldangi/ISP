import {
  bigserial,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { portfolios } from './portfolios.js';
import { users } from './users.js';

/**
 * Immutable audit log of every mutation to user-owned data. Used for
 * DPDP / security investigations and to satisfy "who changed this?" in
 * the UI.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id'),
    actorType: varchar('actor_type', { length: 16 }).notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('audit_log_user_idx').on(t.userId),
    actionIdx: index('audit_log_action_idx').on(t.action),
    createdIdx: index('audit_log_created_idx').on(t.createdAt),
  }),
);

/**
 * Long-running data-import jobs (CAS PDFs, broker CSVs). The actual file
 * is stored in Supabase Storage; this row tracks state for the UI.
 */
export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  portfolioId: uuid('portfolio_id').references(() => portfolios.id, { onDelete: 'cascade' }),
  source: varchar('source', { length: 32 }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  rawFilePath: text('raw_file_path'),
  parsedPayload: jsonb('parsed_payload'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Provider quota usage and degradation events. Surfaced on an internal
 * data-quality dashboard so we know when a free tier is about to break.
 */
export const providerHealth = pgTable(
  'provider_health',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    operation: varchar('operation', { length: 64 }).notNull(),
    success: text('success').notNull(),
    latencyMs: text('latency_ms'),
    error: text('error'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerIdx: index('provider_health_provider_idx').on(t.provider, t.occurredAt),
  }),
);
