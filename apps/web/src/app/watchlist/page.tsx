import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@isp/auth';
import { getDb, schema } from '@isp/db';

import { getLiveNavForFunds } from '@/lib/portfolio-nav';
import { WatchlistClient } from './_components/watchlist-client';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) redirect('/sign-in?from=/watchlist');

  const db = getDb();
  const rows = await db
    .select({
      id: schema.watchlist.id,
      schemeCode: schema.watchlist.schemeCode,
      addedAt: schema.watchlist.addedAt,
      schemeName: schema.funds.schemeName,
      amcName: schema.funds.amcName,
      category: schema.funds.category,
      latestNav: schema.funds.latestNav,
      latestNavDate: schema.funds.latestNavDate,
    })
    .from(schema.watchlist)
    .innerJoin(schema.funds, eq(schema.watchlist.schemeCode, schema.funds.schemeCode))
    .where(eq(schema.watchlist.userId, me.id))
    .orderBy(schema.watchlist.addedAt);

  const schemeCodes = rows.map((r) => r.schemeCode);
  const navByScheme = await getLiveNavForFunds(schemeCodes);

  const enriched = rows.map((r) => ({
    ...r,
    latestNav: r.latestNav !== null ? Number(r.latestNav) : null,
    liveNav: navByScheme[r.schemeCode] ?? null,
  }));

  return <WatchlistClient items={enriched} />;
}
