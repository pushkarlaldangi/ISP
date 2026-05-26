# ISP — Indian Mutual Fund Tracker with Live NAV

A production-grade web app that catalogs Indian mutual funds, surfaces their portfolio holdings, and computes a **live intraday estimated NAV** by combining each fund's last-disclosed equity holdings with live stock prices. Users can build and track real portfolios with units, P&L, XIRR, and intraday valuation.

See [`PLAN.md`](./PLAN.md) for the full implementation plan, phase breakdown, risk register, and operational checklist.

## Quick start

Prerequisites:

- **Node 20+** (see `.nvmrc`)
- **pnpm 10+**
- A free [Supabase](https://supabase.com) project (region closest to India)
- A free [Vercel](https://vercel.com) account for deploy

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env vars and fill in real values
cp .env.example .env.local
# Then edit .env.local with your Supabase + Upstash + Resend keys

# 3. Run database migrations
pnpm --filter @isp/db db:generate
pnpm --filter @isp/db db:migrate

# 4. Start the dev server
pnpm dev
# → http://localhost:3000
```

## Monorepo layout

```
apps/
  web/                Next.js 15 app (App Router, RSC, TypeScript strict)

packages/
  config/             Shared tsconfig, ESLint preset, Tailwind preset
  core/               PURE financial logic — NAV calc, portfolio calc, XIRR (no I/O)
  db/                 Drizzle schema, client, migrations
  providers/          Data-provider adapters (AMFI, MFAPI, Yahoo, NSE)
  ui/                 Shared design-system components (shadcn/ui-based)
  auth/               Supabase Auth wrappers, session helpers, PII encryption
  jobs/               Vercel Cron handlers + Supabase Edge Functions
  cas-parser/         CAMS / KFinTech CAS PDF parser
  reports/            @react-pdf/renderer report templates
  emails/             React Email transactional templates
  observability/      Sentry + structured logger
```

The `packages/core` rule is non-negotiable: **no I/O lives there**. Every business rule is a pure function consumed by the API layer, jobs, and (later) mobile apps.

## Common commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Next.js dev server (`apps/web`) on :3000 |
| `pnpm build` | Build every package (Turborepo orchestrates the order) |
| `pnpm typecheck` | `tsc --noEmit` across the monorepo |
| `pnpm lint` | ESLint across every package |
| `pnpm test` | Run all Vitest unit + integration tests |
| `pnpm --filter @isp/web test:e2e` | Run Playwright e2e suite |
| `pnpm --filter @isp/db db:studio` | Open Drizzle Studio |
| `pnpm --filter @isp/db db:generate` | Generate a new migration from schema diffs |
| `pnpm format` | Format every file with Prettier |

## Phase status

- ✅ **Phase 0** — Foundation: monorepo, schema, core logic, providers, CI, env scaffolding
- ⏭️ **Phase 1** — Data pipeline: daily AMFI sync, MFAPI historical NAV backfill
- ⏭️ **Phase 2** — Catalog UI: `/funds` browse + `/funds/[code]` detail
- ⏭️ **Phase 3** — Live NAV engine: quote cache, batching, backtest
- ⏭️ **Phase 4** — Auth, accounts, privacy
- ⏭️ **Phase 5** — Portfolio + CAS import
- ⏭️ **Phase 6** — UX polish, performance, accessibility
- ⏭️ **Phase 7** — Hardening + soft launch
- ⏭️ **Phase 8** — Public launch + iterate

## Disclaimers

This is a portfolio **tracking** tool only. It does not execute trades and does not provide investment advice. It is **not** a SEBI-Registered Investment Advisor.

Data sources used at launch are free / public (AMFI, MFAPI.in, NSE public endpoints, Yahoo Finance). The data-provider abstraction is designed to swap in paid feeds (Kite Connect, Morningstar, etc.) without business-logic changes when budget allows.

## License

UNLICENSED — private project. Will revisit before any public release.
