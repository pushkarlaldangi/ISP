import { eq } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';

async function main() {
  const db = getDb();
  for (const code of ['119551', '118989']) {
    const rows = await db
      .select()
      .from(schema.holdings)
      .where(eq(schema.holdings.schemeCode, code));
    // eslint-disable-next-line no-console
    console.log(`\n== scheme ${code} (${rows.length} rows) ==`);
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(
        `  ${r.assetType.padEnd(7)} | ${(r.ticker ?? '—').padEnd(12)} | ${r.weightPct ?? '—'}%`.padEnd(
          45,
        ),
        '|',
        r.instrument,
      );
    }
  }
  process.exit(0);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
