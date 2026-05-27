import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

import { getCurrentUser } from '@isp/auth';
import { summarizePortfolio } from '@isp/core/portfolio';
import type { Transaction } from '@isp/core/types';
import { getDb, schema } from '@isp/db';

import { getLiveNavForFunds } from '@/lib/portfolio-nav';
import { PortfolioDashboard } from './_components/portfolio-dashboard';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function PortfolioPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) redirect('/sign-in?from=/portfolio');

  const db = getDb();

  const [portfolio] = await db
    .select()
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!portfolio) notFound();

  const txnRows = await db
    .select()
    .from(schema.portfolioTransactions)
    .where(eq(schema.portfolioTransactions.portfolioId, id))
    .orderBy(schema.portfolioTransactions.txnDate);

  const txns: Transaction[] = txnRows.map((r) => ({
    id: r.id,
    portfolioId: r.portfolioId,
    schemeCode: r.schemeCode,
    txnType: r.txnType as Transaction['txnType'],
    txnDate: new Date(r.txnDate),
    units: Number(r.units),
    navAtTxn: Number(r.navAtTxn),
    amount: Number(r.amount),
    note: r.note ?? undefined,
  }));

  const schemeCodes = [...new Set(txns.map((t) => t.schemeCode))];
  const navByScheme = await getLiveNavForFunds(schemeCodes);
  const summary = summarizePortfolio(txns, navByScheme, new Date());

  // Fetch fund metadata for display
  const fundsData =
    schemeCodes.length > 0
      ? await db.query.funds.findMany({
          where: (f, { inArray }) => inArray(f.schemeCode, schemeCodes),
          columns: { schemeCode: true, schemeName: true, amcName: true, category: true },
        })
      : [];

  const fundMap = Object.fromEntries(fundsData.map((f) => [f.schemeCode, f]));

  const enrichedPositions = summary.positions.map((p) => ({
    ...p,
    schemeName: fundMap[p.schemeCode]?.schemeName ?? p.schemeCode,
    amcName: fundMap[p.schemeCode]?.amcName ?? null,
    category: fundMap[p.schemeCode]?.category ?? null,
  }));

  return (
    <PortfolioDashboard
      portfolio={portfolio}
      summary={{ ...summary, positions: enrichedPositions }}
      transactions={txns}
    />
  );
}
