/**
 * GET /api/admin/seed-nav-history?secret=<CRON_SECRET>&limit=100
 *
 * Backfills 1 year of NAV history from MFAPI.in for the top N funds
 * (ordered by latest_nav_date DESC — i.e. funds that have been recently synced).
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 * Takes 2–5 minutes for 100 funds. Set limit lower if it times out.
 *
 * Remove after initial backfill.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';

import { MfApiClient } from '@isp/providers';
import { getDb, schema } from '@isp/db';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const env = getServerEnv();
  const secret = req.nextUrl.searchParams.get('secret');
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!env.CRON_SECRET || (secret !== env.CRON_SECRET && headerSecret !== env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam ?? '50', 10), 200);

  const db = getDb();
  const mfapi = new MfApiClient();

  // Pick funds that have a recent NAV date (active funds), skip ones already backfilled
  const fundsWithoutHistory = await db
    .select({ schemeCode: schema.funds.schemeCode })
    .from(schema.funds)
    .where(
      sql`${schema.funds.schemeCode} NOT IN (
        SELECT DISTINCT scheme_code FROM nav_history
      )`,
    )
    .orderBy(sql`${schema.funds.latestNavDate} DESC NULLS LAST`)
    .limit(limit);

  const codes = fundsWithoutHistory.map((r) => r.schemeCode);

  let totalInserted = 0;
  let processed = 0;
  const errors: string[] = [];

  for (const code of codes) {
    try {
      const history = await mfapi.fetchHistory(code);
      if (history.length === 0) continue;

      // Keep last 365 days only to stay within free-tier DB limits
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const recent = history.filter((h) => h.date >= cutoff);

      if (recent.length === 0) continue;

      const rows = recent.map((h) => ({
        schemeCode: code,
        navDate: h.date.toISOString().slice(0, 10),
        nav: h.nav.toFixed(4),
      }));

      // Batch insert in chunks of 200 to avoid query size limits
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const result = await db.insert(schema.navHistory).values(chunk).onConflictDoNothing();
        totalInserted += (result as unknown as { rowCount?: number }).rowCount ?? chunk.length;
      }

      processed++;

      // Polite delay — MFAPI is free, don't hammer it
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      errors.push(`${code}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    totalInserted,
    errors: errors.slice(0, 10), // cap error list
    remaining: codes.length - processed,
  });
}
