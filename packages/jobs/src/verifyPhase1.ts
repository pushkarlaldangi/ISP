/**
 * Phase 1 end-to-end verification.
 * Counts rows + spot-checks a couple of known funds to confirm the sync
 * landed the data and the read shape matches expectations.
 */

import { count, desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';

async function main() {
  const db = getDb();

  const [funds] = await db.select({ n: count() }).from(schema.funds);
  const [nav] = await db.select({ n: count() }).from(schema.navHistory);
  const [holdings] = await db.select({ n: count() }).from(schema.holdings);
  const [providerHealth] = await db.select({ n: count() }).from(schema.providerHealth);

  // eslint-disable-next-line no-console
  console.log('== row counts ==');
  // eslint-disable-next-line no-console
  console.log({
    funds: funds?.n,
    nav_history: nav?.n,
    holdings: holdings?.n,
    provider_health: providerHealth?.n,
  });

  // Spot-check a fund we seeded holdings for.
  const SCHEME = '119551';
  const [fund] = await db.select().from(schema.funds).where(eq(schema.funds.schemeCode, SCHEME));
  const fundHoldings = await db
    .select()
    .from(schema.holdings)
    .where(eq(schema.holdings.schemeCode, SCHEME))
    .orderBy(desc(schema.holdings.weightPct));

  // eslint-disable-next-line no-console
  console.log(`== fund ${SCHEME} ==`);
  // eslint-disable-next-line no-console
  console.log({
    name: fund?.schemeName,
    amc: fund?.amcName,
    category: fund?.category,
    latestNav: fund?.latestNav,
    latestNavDate: fund?.latestNavDate,
    holdingsCount: fundHoldings.length,
    topHolding: fundHoldings[0]
      ? { instrument: fundHoldings[0].instrument, weightPct: fundHoldings[0].weightPct }
      : null,
  });

  // Search sanity check.
  const sample = await db
    .select({
      schemeCode: schema.funds.schemeCode,
      schemeName: schema.funds.schemeName,
      category: schema.funds.category,
      latestNav: schema.funds.latestNav,
    })
    .from(schema.funds)
    .where(eq(schema.funds.category, 'EQUITY'))
    .limit(3);

  // eslint-disable-next-line no-console
  console.log('== sample equity funds ==');
  // eslint-disable-next-line no-console
  console.log(sample);

  process.exit(0);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('verify failed:', err);
  process.exit(1);
});
