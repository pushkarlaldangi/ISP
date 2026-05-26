/**
 * One-shot historical NAV backfill from MFAPI.in.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @isp/jobs backfill -- --top 500
 *   DATABASE_URL=... pnpm --filter @isp/jobs backfill -- --schemes 119551,118989
 *
 * Strategy:
 *   - If --schemes is provided, backfill exactly those.
 *   - Otherwise pick the top N funds by latest_nav_date DESC, schemeCode ASC
 *     (i.e. the funds we know are currently active) and backfill each.
 *
 * Pacing: serialized requests with a small jitter so we don't hammer MFAPI.
 * Idempotent: nav_history has a (scheme_code, nav_date) PK and inserts use
 * ON CONFLICT DO NOTHING.
 */

import { desc } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';
import { MfApiClient } from '@isp/providers';

const DEFAULT_TOP = 500;
const MIN_DELAY_MS = 150;
const MAX_DELAY_MS = 350;
const INSERT_BATCH = 1000;

interface CliArgs {
  top: number;
  schemes: string[] | null;
}

function parseArgs(argv: string[]): CliArgs {
  let top = DEFAULT_TOP;
  let schemes: string[] | null = null;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--top') {
      const next = argv[i + 1];
      if (!next) throw new Error('--top requires a number');
      top = Number.parseInt(next, 10);
      if (!Number.isFinite(top) || top <= 0) throw new Error(`invalid --top: ${next}`);
      i++;
    } else if (flag === '--schemes') {
      const next = argv[i + 1];
      if (!next) throw new Error('--schemes requires a comma-separated list');
      schemes = next
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
    }
  }
  return { top, schemes };
}

async function pickSchemes(top: number): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ schemeCode: schema.funds.schemeCode })
    .from(schema.funds)
    .orderBy(desc(schema.funds.latestNavDate), schema.funds.schemeCode)
    .limit(top);
  return rows.map((r) => r.schemeCode);
}

async function backfillOne(schemeCode: string, client: MfApiClient): Promise<number> {
  const points = await client.fetchHistory(schemeCode);
  if (points.length === 0) return 0;
  const db = getDb();
  let inserted = 0;
  for (let i = 0; i < points.length; i += INSERT_BATCH) {
    const batch = points.slice(i, i + INSERT_BATCH).map((p) => ({
      schemeCode,
      navDate: toIsoDate(p.date),
      nav: p.nav.toFixed(4),
    }));
    const r = await db
      .insert(schema.navHistory)
      .values(batch)
      .onConflictDoNothing({ target: [schema.navHistory.schemeCode, schema.navHistory.navDate] });
    inserted += r.count ?? 0;
  }
  return inserted;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function jitter(): Promise<void> {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schemes = args.schemes ?? (await pickSchemes(args.top));

  // eslint-disable-next-line no-console
  console.log(`[backfill] processing ${schemes.length} schemes`);
  const client = new MfApiClient();

  let totalInserted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const [idx, code] of schemes.entries()) {
    try {
      const n = await backfillOne(code, client);
      totalInserted += n;
      succeeded++;
      if (idx % 25 === 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[backfill] ${idx + 1}/${schemes.length} scheme=${code} +${n} rows (total +${totalInserted})`,
        );
      }
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.warn(`[backfill] scheme=${code} failed: ${err instanceof Error ? err.message : err}`);
    }
    await jitter();
  }

  // eslint-disable-next-line no-console
  console.log(
    `[backfill] done: ${succeeded} ok, ${failed} failed, +${totalInserted} nav_history rows inserted`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
