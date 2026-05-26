/**
 * Migration runner.
 *
 * Runs in two phases:
 *   1. Drizzle's auto-generated migrations from packages/db/drizzle/
 *   2. Hand-written post-migration SQL from packages/db/sql/ (RLS, functions,
 *      triggers — things Drizzle doesn't model)
 *
 * Phase 2 is idempotent (uses CREATE OR REPLACE / IF NOT EXISTS) so it's
 * safe to re-run.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL (or DATABASE_URL_DIRECT) is required. Use the direct/session-pooler ' +
        'connection string for migrations, not the transaction pooler.',
    );
  }

  // eslint-disable-next-line no-console
  console.log('[migrate] connecting...');
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    const drizzleDir = join(PACKAGE_DIR, 'drizzle');
    // eslint-disable-next-line no-console
    console.log(`[migrate] applying Drizzle migrations from ${drizzleDir}`);
    await migrate(db, { migrationsFolder: drizzleDir });

    const sqlDir = join(PACKAGE_DIR, 'sql');
    const files = (await readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      // eslint-disable-next-line no-console
      console.log(`[migrate] applying post-migration SQL: ${file}`);
      const sql = await readFile(join(sqlDir, file), 'utf8');
      // Drizzle uses --> statement-breakpoint to split; we honor that for parity.
      const chunks = sql
        .split(/-->\s*statement-breakpoint/g)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const chunk of chunks) {
        await client.unsafe(chunk);
      }
    }
    // eslint-disable-next-line no-console
    console.log('[migrate] done.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
