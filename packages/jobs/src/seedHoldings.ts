/**
 * Seed manually-curated holdings into the `holdings` table.
 *
 * Reads from src/seed/holdings.seed.json, which is intentionally small +
 * representative. Real holdings ingestion (AMC factsheet parsing) lands in
 * Phase 3.
 *
 * Idempotent: existing rows for the same (scheme, as_of, instrument) are
 * left alone via ON CONFLICT DO NOTHING.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getDb, schema } from '@isp/db';

interface SeedFile {
  _meta: { note: string; asOfDate: string };
  holdings: {
    schemeCode: string;
    schemeNameHint?: string;
    items: {
      instrument: string;
      ticker: string | null;
      isin: string | null;
      assetType: 'EQUITY' | 'DEBT' | 'CASH' | 'OTHER';
      weightPct: number;
    }[];
  }[];
}

async function main() {
  const seedUrl = new URL('./seed/holdings.seed.json', import.meta.url);
  const raw = await readFile(fileURLToPath(seedUrl), 'utf8');
  const seed = JSON.parse(raw) as SeedFile;

  const db = getDb();
  let total = 0;
  for (const fund of seed.holdings) {
    const rows = fund.items.map((item) => ({
      schemeCode: fund.schemeCode,
      asOfDate: seed._meta.asOfDate,
      instrument: item.instrument,
      ticker: item.ticker,
      isin: item.isin,
      assetType: item.assetType,
      weightPct: item.weightPct.toFixed(4),
      marketValue: null,
      quantity: null,
    }));
    const r = await db
      .insert(schema.holdings)
      .values(rows)
      .onConflictDoNothing({
        target: [schema.holdings.schemeCode, schema.holdings.asOfDate, schema.holdings.instrument],
      });
    total += r.count ?? 0;
    // eslint-disable-next-line no-console
    console.log(
      `[seed-holdings] scheme=${fund.schemeCode} inserted ${r.count ?? 0}/${rows.length}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed-holdings] done: ${total} new rows`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed-holdings] failed:', err);
  process.exit(1);
});
