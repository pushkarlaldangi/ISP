/**
 * GET /api/funds/[code]
 *
 * Returns: fund metadata + latest NAV + latest disclosed holdings (if any) +
 * 1 year of NAV history.
 */

import { desc, eq, lte, and } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_DAYS = 365;

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!code || code.length > 32) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const db = getDb();

  // ?date=YYYY-MM-DD — look up NAV for a specific date (for transaction auto-fill)
  const dateParam = req.nextUrl.searchParams.get('date');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [navRow] = await db
      .select({ nav: schema.navHistory.nav, navDate: schema.navHistory.navDate })
      .from(schema.navHistory)
      .where(and(eq(schema.navHistory.schemeCode, code), lte(schema.navHistory.navDate, dateParam)))
      .orderBy(desc(schema.navHistory.navDate))
      .limit(1);

    const [fund] = await db
      .select({ latestNav: schema.funds.latestNav })
      .from(schema.funds)
      .where(eq(schema.funds.schemeCode, code))
      .limit(1);

    return NextResponse.json({
      navOnDate: navRow ? Number(navRow.nav) : null,
      navDate: navRow?.navDate ?? null,
      latestNav: fund ? Number(fund.latestNav) : null,
    });
  }
  const [fund] = await db
    .select()
    .from(schema.funds)
    .where(eq(schema.funds.schemeCode, code))
    .limit(1);

  if (!fund) {
    return NextResponse.json({ error: 'fund_not_found' }, { status: 404 });
  }

  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  // Latest holdings disclosure date for this scheme.
  const [latestHoldingDate] = await db
    .select({ asOfDate: schema.holdings.asOfDate })
    .from(schema.holdings)
    .where(eq(schema.holdings.schemeCode, code))
    .orderBy(desc(schema.holdings.asOfDate))
    .limit(1);

  const [history, holdings] = await Promise.all([
    db
      .select({ navDate: schema.navHistory.navDate, nav: schema.navHistory.nav })
      .from(schema.navHistory)
      .where(eq(schema.navHistory.schemeCode, code))
      .orderBy(desc(schema.navHistory.navDate))
      .limit(HISTORY_DAYS),
    latestHoldingDate
      ? db
          .select()
          .from(schema.holdings)
          .where(eq(schema.holdings.schemeCode, code))
          .orderBy(desc(schema.holdings.weightPct))
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    fund,
    history: history
      .filter((h) => h.navDate >= sinceIso)
      .reverse() // ascending for charts
      .map((h) => ({ date: h.navDate, nav: Number(h.nav) })),
    holdings: holdings.map((h) => ({
      ...h,
      weightPct: h.weightPct === null ? null : Number(h.weightPct),
      marketValue: h.marketValue === null ? null : Number(h.marketValue),
      quantity: h.quantity === null ? null : Number(h.quantity),
    })),
    holdingsAsOf: latestHoldingDate?.asOfDate ?? null,
  });
}
