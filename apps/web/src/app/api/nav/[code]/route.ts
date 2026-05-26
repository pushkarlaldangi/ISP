/**
 * GET /api/nav/[code]
 *
 * The hot endpoint of the app. For each request:
 *   1. Load the fund's official NAV and last-disclosed holdings from Postgres
 *   2. Resolve equity tickers, batch-fetch live quotes (with 60s cache)
 *   3. Call the pure `computeLiveNav` to produce the estimate
 *   4. Stamp market-open state and return
 *
 * Cache headers: s-maxage=30, stale-while-revalidate=60 so Vercel's edge
 * cache serves repeat reads instantly while a background revalidation runs.
 */

import { desc, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

import { computeLiveNav } from '@isp/core/nav';
import type { Holding } from '@isp/core/types';
import { getDb, schema } from '@isp/db';

import { getLiveQuotes } from '@/lib/quotes';
import { getMarketStatus } from '@/lib/market-hours';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!code || code.length > 32) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const db = getDb();

  const [fund] = await db
    .select({
      schemeCode: schema.funds.schemeCode,
      schemeName: schema.funds.schemeName,
      latestNav: schema.funds.latestNav,
      latestNavDate: schema.funds.latestNavDate,
      category: schema.funds.category,
    })
    .from(schema.funds)
    .where(eq(schema.funds.schemeCode, code))
    .limit(1);

  if (!fund) {
    return NextResponse.json({ error: 'fund_not_found' }, { status: 404 });
  }
  if (fund.latestNav === null || fund.latestNavDate === null) {
    return NextResponse.json({ error: 'no_nav_yet' }, { status: 409 });
  }

  // Pick the most recent holdings disclosure for this fund.
  const [latest] = await db
    .select({ asOfDate: schema.holdings.asOfDate })
    .from(schema.holdings)
    .where(eq(schema.holdings.schemeCode, code))
    .orderBy(desc(schema.holdings.asOfDate))
    .limit(1);

  const holdingsRows = latest
    ? await db.select().from(schema.holdings).where(eq(schema.holdings.schemeCode, code))
    : [];

  const holdings: Holding[] = holdingsRows
    .filter((h) => h.asOfDate === latest?.asOfDate)
    .map((h) => ({
      schemeCode: h.schemeCode,
      asOfDate: new Date(h.asOfDate),
      instrument: h.instrument,
      ticker: h.ticker,
      isin: h.isin,
      assetType: normalizeAssetType(h.assetType),
      weightPct: h.weightPct === null ? 0 : Number(h.weightPct),
      marketValue: h.marketValue === null ? null : Number(h.marketValue),
      quantity: h.quantity === null ? null : Number(h.quantity),
    }));

  // Equity tickers needed for the live calc.
  const tickers = holdings
    .filter((h) => h.assetType === 'EQUITY' && h.ticker)
    .map((h) => h.ticker!) // safe — filtered for non-null
    .filter((t, i, arr) => arr.indexOf(t) === i);

  const quotes = tickers.length > 0 ? await getLiveQuotes(tickers) : {};

  const result = computeLiveNav({
    officialNav: Number(fund.latestNav),
    officialNavDate: new Date(fund.latestNavDate),
    holdings,
    quotes,
  });

  const market = getMarketStatus();
  const response = NextResponse.json({
    schemeCode: fund.schemeCode,
    schemeName: fund.schemeName,
    category: fund.category,
    market: { isOpen: market.isOpen },
    holdingsAsOf: latest?.asOfDate ?? null,
    nav: result,
  });
  // Edge-cache friendly: cheap for hot funds, still <60s stale.
  response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return response;
}

function normalizeAssetType(s: string): Holding['assetType'] {
  switch (s) {
    case 'EQUITY':
    case 'DEBT':
    case 'CASH':
      return s;
    default:
      return 'OTHER';
  }
}
