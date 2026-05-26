import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { funds } from './funds';
import { users } from './users';

export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('portfolios_user_idx').on(t.userId)],
);

export const portfolioTransactions = pgTable(
  'portfolio_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    schemeCode: text('scheme_code')
      .notNull()
      .references(() => funds.schemeCode),
    txnType: varchar('txn_type', { length: 16 }).notNull(),
    txnDate: date('txn_date').notNull(),
    units: numeric('units', { precision: 18, scale: 6 }).notNull(),
    navAtTxn: numeric('nav_at_txn', { precision: 12, scale: 4 }).notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('portfolio_txn_portfolio_idx').on(t.portfolioId),
    index('portfolio_txn_scheme_idx').on(t.schemeCode),
    index('portfolio_txn_date_idx').on(t.txnDate),
  ],
);

export const watchlist = pgTable(
  'watchlist',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    schemeCode: text('scheme_code')
      .notNull()
      .references(() => funds.schemeCode),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('watchlist_user_scheme_uniq').on(t.userId, t.schemeCode)],
);

export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  {
    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    totalInvested: numeric('total_invested', { precision: 18, scale: 2 }).notNull(),
    totalValue: numeric('total_value', { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.portfolioId, t.snapshotDate] })],
);

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull(),
  targetDate: date('target_date').notNull(),
  portfolioId: uuid('portfolio_id').references(() => portfolios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(),
  config: jsonb('config').notNull(),
  channels: text('channels').array().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
});
