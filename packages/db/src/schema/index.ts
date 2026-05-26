/**
 * Drizzle schema — single source of truth for the database.
 *
 * NOTE on extensions: drizzle-kit loads schema files via require() and chokes
 * on .js extensions on TS source, while our runtime ESM resolution NEEDS them.
 * We use no-extension imports here; the tsconfig has `moduleResolution: Bundler`
 * which permits it, and our runtime consumers (`packages/db/src/client.ts`)
 * re-export from this barrel rather than importing individual files directly.
 */

export * from './funds';
export * from './users';
export * from './portfolios';
export * from './ops';
