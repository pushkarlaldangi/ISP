/**
 * Daily AMFI NAV sync.
 *
 * Fetches the full mutual-fund master + today's NAV from AMFI's NAVAll.txt
 * and upserts ~10,000 funds into `funds` plus one row per scheme into
 * `nav_history`.
 *
 * Idempotent: re-running on the same trading day is a no-op for the
 * nav_history table (ON CONFLICT DO NOTHING) and refreshes the latest_nav
 * column on `funds`. Safe to retry.
 */

import { sql } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';
import { getFundsProvider } from '@isp/providers';
import type { FundMasterRecord } from '@isp/providers';

const BATCH_SIZE = 500;

export interface SyncNavResult {
  fetchedAt: Date;
  recordsFetched: number;
  fundsUpserted: number;
  navRowsInserted: number;
  durationMs: number;
}

export async function syncNavFromAmfi(): Promise<SyncNavResult> {
  const started = Date.now();
  const provider = getFundsProvider();

  let records: FundMasterRecord[];
  try {
    records = await provider.fetchMaster();
  } catch (err) {
    await recordHealth(provider.name, 'fetchMaster', false, null, err);
    throw err;
  }
  const fetchLatency = Date.now() - started;
  await recordHealth(provider.name, 'fetchMaster', true, fetchLatency, null);

  if (records.length === 0) {
    throw new Error(`[syncNav] ${provider.name} returned zero records — refusing to sync`);
  }

  const db = getDb();
  let fundsUpserted = 0;
  let navRowsInserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const fundRows = batch.map((r) => ({
      schemeCode: r.schemeCode,
      schemeName: r.schemeName,
      amcName: r.amcName,
      category: r.category,
      subCategory: r.subCategory,
      isinGrowth: r.isinGrowth,
      isinDiv: r.isinDiv,
      latestNav: r.nav.toFixed(4),
      latestNavDate: toIsoDate(r.navDate),
      updatedAt: new Date(),
    }));

    const fundResult = await db
      .insert(schema.funds)
      .values(fundRows)
      .onConflictDoUpdate({
        target: schema.funds.schemeCode,
        set: {
          schemeName: sql`excluded.scheme_name`,
          category: sql`excluded.category`,
          subCategory: sql`excluded.sub_category`,
          isinGrowth: sql`excluded.isin_growth`,
          isinDiv: sql`excluded.isin_div`,
          latestNav: sql`excluded.latest_nav`,
          latestNavDate: sql`excluded.latest_nav_date`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    fundsUpserted += fundResult.count ?? batch.length;

    const navRows = batch.map((r) => ({
      schemeCode: r.schemeCode,
      navDate: toIsoDate(r.navDate),
      nav: r.nav.toFixed(4),
    }));

    const navResult = await db
      .insert(schema.navHistory)
      .values(navRows)
      .onConflictDoNothing({
        target: [schema.navHistory.schemeCode, schema.navHistory.navDate],
      });
    navRowsInserted += navResult.count ?? 0;
  }

  return {
    fetchedAt: new Date(started),
    recordsFetched: records.length,
    fundsUpserted,
    navRowsInserted,
    durationMs: Date.now() - started,
  };
}

function toIsoDate(d: Date): string {
  // Drizzle's date column wants YYYY-MM-DD strings.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function recordHealth(
  provider: string,
  operation: string,
  success: boolean,
  latencyMs: number | null,
  err: unknown,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(schema.providerHealth).values({
      provider,
      operation,
      success: success ? 'true' : 'false',
      latencyMs: latencyMs === null ? null : String(latencyMs),
      error: success ? null : err instanceof Error ? err.message : String(err),
    });
  } catch {
    // Health logging is best-effort. Don't let it mask the underlying error.
  }
}
