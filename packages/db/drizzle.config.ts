import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // drizzle-kit reads this lazily — only error at command time, not import time.
  // eslint-disable-next-line no-console
  console.warn('[drizzle] DATABASE_URL is not set. Migration commands will fail.');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl ?? 'postgres://placeholder',
  },
  strict: true,
  verbose: true,
});
