import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { getDb, schema } from '@isp/db';

import { FundDetail } from './_components/fund-detail';

interface PageProps {
  params: Promise<{ code: string }>;
}

const HISTORY_DAYS = 365;

async function loadFund(code: string) {
  const db = getDb();
  const [fund] = await db
    .select()
    .from(schema.funds)
    .where(eq(schema.funds.schemeCode, code))
    .limit(1);
  if (!fund) return null;

  const [history, holdings, latestAsOf] = await Promise.all([
    db
      .select({ navDate: schema.navHistory.navDate, nav: schema.navHistory.nav })
      .from(schema.navHistory)
      .where(eq(schema.navHistory.schemeCode, code))
      .orderBy(desc(schema.navHistory.navDate))
      .limit(HISTORY_DAYS),
    db
      .select()
      .from(schema.holdings)
      .where(eq(schema.holdings.schemeCode, code))
      .orderBy(desc(schema.holdings.weightPct)),
    db
      .select({ asOfDate: schema.holdings.asOfDate })
      .from(schema.holdings)
      .where(eq(schema.holdings.schemeCode, code))
      .orderBy(desc(schema.holdings.asOfDate))
      .limit(1),
  ]);

  return {
    fund,
    history: history.reverse().map((h) => ({ date: h.navDate, nav: Number(h.nav) })),
    holdings: holdings.map((h) => ({
      ...h,
      weightPct: h.weightPct === null ? null : Number(h.weightPct),
      marketValue: h.marketValue === null ? null : Number(h.marketValue),
      quantity: h.quantity === null ? null : Number(h.quantity),
    })),
    holdingsAsOf: latestAsOf[0]?.asOfDate ?? null,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const data = await loadFund(code);
  if (!data) return { title: 'Fund not found' };
  return {
    title: data.fund.schemeName,
    description: `Live NAV, holdings, and history for ${data.fund.schemeName}.`,
  };
}

export default async function FundDetailPage({ params }: PageProps) {
  const { code } = await params;
  const data = await loadFund(code);
  if (!data) notFound();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <FundDetail
        fund={{
          ...data.fund,
          latestNav: data.fund.latestNav === null ? null : Number(data.fund.latestNav),
        }}
        history={data.history}
        holdings={data.holdings}
        holdingsAsOf={data.holdingsAsOf}
      />
    </main>
  );
}
