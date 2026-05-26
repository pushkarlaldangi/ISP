/**
 * Drizzle schema — single source of truth for the database.
 *
 * Tables are split across files by domain for readability; all are re-exported
 * here so `import { funds } from '@isp/db/schema'` works uniformly.
 *
 * RLS policies are applied via raw SQL in migrations under `drizzle/`; Drizzle
 * does not yet have first-class policy DSL.
 */

export * from './funds.js';
export * from './users.js';
export * from './portfolios.js';
export * from './ops.js';
