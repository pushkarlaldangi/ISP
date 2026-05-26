# ISP — Project Notes for Claude

## Project at a glance
Production-grade Indian mutual fund tracker with live intraday estimated NAV. Free-tier infra (Vercel Hobby + Supabase free + free data APIs). See [`PLAN.md`](./PLAN.md) for the authoritative plan.

## Architecture rules (must-follow)
1. **`packages/core` is PURE.** No DB, no fetch, no fs, no `Date.now()` at module scope. All side effects belong in adapter layers (`packages/providers/*`, API routes, jobs).
2. **Provider adapters are interface-typed.** Adding a new data source means adding a class implementing `FundsProvider` / `QuotesProvider` and updating the facade. Never call upstream APIs directly from business logic.
3. **Encrypted PII.** User email / display name are encrypted at the application layer via `PII_ENCRYPTION_KEY` before they hit the DB. Lookup uses a salted hash column.
4. **Audit log on every mutation.** Every write to portfolio data writes a row to `audit_log`. Don't add a mutation API route without the audit middleware.
5. **Free-tier discipline.** Cache everything cacheable. Batch upstream calls. Respect rate limits with polite UA + reasonable QPS.
6. **No scraping.** Production code does NOT scrape Moneycontrol / ValueResearch. Only public APIs (AMFI, MFAPI, Yahoo, NSE public endpoints) or licensed feeds.
7. **No SEBI advisory language.** This is a tracking tool. No "buy this fund" / "recommended" / "good fund" copy anywhere.

## Conventions
- TypeScript strict, `noUncheckedIndexedAccess: true` everywhere
- `pnpm` for installs; `pnpm --filter @isp/<pkg>` for scoped commands
- Drizzle for schema; never write a migration by hand without first updating the schema files
- `zod` schemas shared between client + server; never call a route handler without input validation
- Tabular numerals for all monetary values (`tabular-nums` font-feature) — see [packages/config/tailwind-preset.cjs](packages/config/tailwind-preset.cjs)
- Semantic colors: `gain` / `loss` ONLY for P&L direction; never decorative

## Commands
- `pnpm dev` — Next.js dev server on :3000
- `pnpm test` — Vitest across all packages
- `pnpm --filter @isp/db db:studio` — Drizzle Studio
- `pnpm --filter @isp/db db:generate` — generate migrations from schema diff

## Where to look
- Plan & roadmap → [`PLAN.md`](./PLAN.md)
- Pure financial logic → [`packages/core/src/`](packages/core/src/)
- DB schema → [`packages/db/src/schema/`](packages/db/src/schema/)
- Data adapters → [`packages/providers/src/`](packages/providers/src/)
- Web app → [`apps/web/src/`](apps/web/src/)
- Runbooks → [`runbooks/`](runbooks/)
