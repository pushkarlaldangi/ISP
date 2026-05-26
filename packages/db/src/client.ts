/**
 * Postgres client + Drizzle instance.
 *
 * Two connection modes:
 *  - "transaction" pooler (default for serverless/Vercel) — short-lived, can't
 *    use prepared statements, but cheap and concurrent-safe.
 *  - direct (for migrations, long jobs) — set DATABASE_URL_DIRECT.
 *
 * Supabase exposes both; we use the right one in the right place.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

let cachedClient: ReturnType<typeof postgres> | null = null;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  cachedClient = postgres(url, {
    max: 1, // serverless: single connection per invocation
    prepare: false, // required for Supabase transaction pooler
    idle_timeout: 20,
    connect_timeout: 10,
  });
  cachedDb = drizzle(cachedClient, { schema, logger: process.env.DRIZZLE_LOG === '1' });
  return cachedDb;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
