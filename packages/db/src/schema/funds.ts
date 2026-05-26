import {
  bigserial,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Master fund catalog. Synced daily from AMFI NAVAll.txt with paid feeds
 * swappable in via the provider adapter layer.
 */
export const funds = pgTable(
  'funds',
  {
    schemeCode: text('scheme_code').primaryKey(),
    schemeName: text('scheme_name').notNull(),
    amcName: text('amc_name'),
    category: varchar('category', { length: 32 }).notNull().default('OTHER'),
    subCategory: varchar('sub_category', { length: 64 }),
    isinGrowth: varchar('isin_growth', { length: 12 }),
    isinDiv: varchar('isin_div', { length: 12 }),
    latestNav: numeric('latest_nav', { precision: 12, scale: 4 }),
    latestNavDate: date('latest_nav_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('funds_scheme_name_idx').on(t.schemeName),
    index('funds_category_idx').on(t.category),
    index('funds_amc_idx').on(t.amcName),
  ],
);

/**
 * Historical NAV — one row per (scheme, date). Used for NAV charts and
 * NAV-on-date lookups when users enter backdated transactions.
 */
export const navHistory = pgTable(
  'nav_history',
  {
    schemeCode: text('scheme_code')
      .notNull()
      .references(() => funds.schemeCode, { onDelete: 'cascade' }),
    navDate: date('nav_date').notNull(),
    nav: numeric('nav', { precision: 12, scale: 4 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.schemeCode, t.navDate] }),
    index('nav_history_date_idx').on(t.navDate),
  ],
);

/**
 * Portfolio holdings published monthly by AMCs.
 * One row per (scheme, as_of_date, instrument).
 */
export const holdings = pgTable(
  'holdings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    schemeCode: text('scheme_code')
      .notNull()
      .references(() => funds.schemeCode, { onDelete: 'cascade' }),
    asOfDate: date('as_of_date').notNull(),
    instrument: text('instrument').notNull(),
    ticker: varchar('ticker', { length: 32 }),
    isin: varchar('isin', { length: 12 }),
    assetType: varchar('asset_type', { length: 16 }).notNull().default('OTHER'),
    weightPct: numeric('weight_pct', { precision: 7, scale: 4 }),
    marketValue: numeric('market_value', { precision: 18, scale: 2 }),
    quantity: numeric('quantity', { precision: 18, scale: 4 }),
  },
  (t) => [
    index('holdings_scheme_date_idx').on(t.schemeCode, t.asOfDate),
    index('holdings_ticker_idx').on(t.ticker),
    unique('holdings_scheme_date_instrument_uniq').on(t.schemeCode, t.asOfDate, t.instrument),
  ],
);

/**
 * Short-lived cache of live equity quotes. We also cache in Upstash Redis
 * for hot reads; this table is a durable fallback and audit trail.
 */
export const stockPriceCache = pgTable('stock_price_cache', {
  ticker: varchar('ticker', { length: 32 }).primaryKey(),
  price: numeric('price', { precision: 12, scale: 4 }).notNull(),
  prevClose: numeric('prev_close', { precision: 12, scale: 4 }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  source: varchar('source', { length: 32 }).notNull(),
});

/**
 * Manual ticker overrides — when fuzzy mapping fails we curate by hand here.
 */
export const tickerOverrides = pgTable('ticker_overrides', {
  instrumentName: text('instrument_name').primaryKey(),
  ticker: varchar('ticker', { length: 32 }).notNull(),
  isin: varchar('isin', { length: 12 }),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
