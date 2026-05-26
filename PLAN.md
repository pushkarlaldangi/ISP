# Mutual Fund Tracker with Live NAV — Production Implementation Plan

## Context

Build a **production-grade** web application that catalogs all Indian mutual funds, displays their portfolio holdings, computes a **live intraday estimated NAV** by combining each fund's last-disclosed equity holdings with live stock prices, and lets users build and track real portfolios with units, P&L, XIRR, and intraday valuation.

The official NAV is only published once per day (end-of-day) by AMCs/AMFI — this app gives users a real-time directional estimate during market hours, which is something most retail platforms don't offer. Users can then track their portfolio against that live estimate, getting day-to-day P&L instead of waiting until 9 PM.

**Target users:** Retail mutual fund investors managing real portfolios, financial advisors / RIAs tracking client books, and DIY investors who want better intraday visibility than what AMC websites and existing tracker apps provide.

**Scope:** All fund types (equity, debt, hybrid, ETFs). Live-estimate is meaningful for equity-heavy funds; debt/hybrid funds clearly indicate lower confidence with the official NAV always shown alongside.

**Production posture (non-negotiable, but achieved on free tiers):**
- Hosted on **Vercel Hobby** + **Supabase free tier** + free data APIs (AMFI, MFAPI.in, Yahoo Finance, NSE public endpoints). Design the abstractions so paid feeds can be swapped in later without touching business logic.
- Real auth, encrypted PII at app layer, audited access via `audit_log` table
- Best-effort uptime with free monitoring (Better Stack free tier / UptimeRobot); honest status page
- Full test coverage (unit + integration + e2e) on free-tier GitHub Actions
- CI/CD via GitHub Actions + Vercel preview deploys + atomic rollback
- WCAG 2.1 AA accessibility
- DPDP Act compliant (data export + delete, consent log, encryption at rest)
- Clear legal positioning: portfolio **tracking** tool (not investment advice) — explicit SEBI Investment Advisor disclaimer; no buy/sell execution, no recommendations
- Code quality and review rigor identical to a funded product — only the infra bill is zero

**Working dir:** `c:\Users\PDangi\OneDrive - IDEX Corporation\Desktop\ISP` (currently empty — greenfield).

---

## Architecture

```
                       ┌─────────────────────┐
                       │   Next.js (Vercel)  │
                       │   App Router + RSC  │
                       │   - Public pages    │
                       │   - Supabase Auth   │
                       │   - API routes      │
                       │   - Vercel Cron     │
                       └─────┬────────┬──────┘
                             │        │
        ┌────────────────────┘        └─────────────────────┐
        │                                                   │
┌───────▼──────────┐                         ┌──────────────▼────────────┐
│  Upstash Redis   │                         │  Service layer (packages/)│
│  (free tier)     │                         │  - providers/funds (AMFI) │
│  - quote cache   │                         │  - providers/holdings     │
│  - rate limit    │                         │  - providers/quotes       │
│  - request coal. │                         │    (NSE + Yahoo)          │
└──────────────────┘                         │  - navCalculator (pure)   │
                                             │  - portfolioCalc (pure)   │
                                             │  - casParser              │
                                             └────────┬──────────────────┘
                                                      │
                       ┌──────────────────────────────▼─────────────┐
                       │   Supabase (free tier)                     │
                       │   • Postgres (DB + RLS)                    │
                       │   • Auth (magic link, Google)              │
                       │   • Storage (uploaded CAS PDFs)            │
                       │   • Edge Functions (long-running jobs)     │
                       │   funds | holdings | nav_history           │
                       │   users | portfolios | transactions        │
                       │   watchlist | goals | alerts | audit_log   │
                       └──────────────────────────────▲─────────────┘
                                                      │
                       ┌──────────────────────────────┴─────────────┐
                       │  Vercel Cron + Supabase Edge Functions     │
                       │  - daily NAV sync (AMFI NAVAll.txt)        │
                       │  - weekly holdings refresh                 │
                       │  - intraday quote warm-up (top funds)      │
                       │  - daily portfolio snapshot                │
                       │  - CAS-import async processing             │
                       │  - alert dispatcher                        │
                       └──────────────────┬─────────────────────────┘
                                          │
                       ┌──────────────────▼─────────────────────────┐
                       │  Free External Providers                   │
                       │  • AMFI (NAVAll.txt)                       │
                       │  • MFAPI.in (historical NAV)               │
                       │  • NSE public API (live quotes)            │
                       │  • Yahoo Finance (quote fallback)          │
                       │  • AMC sites (holdings, where stable)      │
                       └────────────────────────────────────────────┘

  Observability (free tiers): Sentry + UptimeRobot + Better Stack + PostHog
  Email: Resend free  |  Search: Postgres FTS + pg_trgm  |  Secrets: Vercel env vars
```

---

## Tech Stack

### Application
- **Framework:** Next.js 14 (App Router) + TypeScript (strict mode)
- **Styling:** Tailwind CSS + **shadcn/ui** (Radix UI primitives, fully accessible)
- **Icons:** `lucide-react`
- **Charts:** **Recharts** (donut, treemap, sparklines) + **ApexCharts** (zoomable NAV history, portfolio value)
- **Animations:** `framer-motion`
- **Data fetching (client):** TanStack Query with persistent cache + optimistic updates
- **Forms / validation:** `react-hook-form` + `zod` (shared schemas between client + server)
- **Theme:** Light + dark + system, via `next-themes`
- **Fonts:** Inter (UI) + Geist Mono (tabular numerals for prices/NAV)
- **i18n-ready:** `next-intl` (English at launch, structure ready for Hindi)

### Backend & Data
- **DB:** PostgreSQL — **Supabase free tier** (500MB, ample for an MVP). Region: closest to India available on free tier.
- **ORM:** Drizzle ORM (type-safe, migration-managed)
- **Cache:** **Upstash Redis free tier** (10K commands/day) for hot quote cache + rate limiting; fall back to in-memory `lru-cache` per Vercel function if Upstash quota hit
- **Background jobs / cron:** **Vercel Cron** (free Hobby: limited but enough for daily NAV sync + weekly holdings) + **Supabase Edge Functions** for longer-running jobs (free 500K invocations/month)
- **Search:** **Postgres full-text search** with `pg_trgm` extension for typo tolerance — no separate search service needed for free tier
- **Auth:** **Supabase Auth** (free) with email magic link + Google OAuth. MFA optional via TOTP.
- **Email (transactional):** **Resend free tier** (3K emails/month) with React Email templates

### Data Providers (all free)

| Data | Source | Notes |
|---|---|---|
| Master fund list + daily NAV | **AMFI NAVAll.txt** (`https://www.amfiindia.com/spages/NAVAll.txt`) | Authoritative, free, refreshed daily ~9 PM IST |
| Historical NAV | **MFAPI.in** (free, `https://api.mfapi.in/mf/{schemeCode}`) | No auth, generous rate limits |
| Fund holdings | **AMC official disclosures** (monthly PDF/XLSX from AMC sites — programmatic fetch where format is stable) + **AMFI portfolio disclosure aggregations** where available | Where unavailable, holdings tab shows "Holdings not yet imported for this fund" rather than scraping aggregators in production |
| Live stock quotes (NSE) | **NSE public API** (`https://www.nseindia.com/api/quote-equity?symbol=...`) with proper headers + cookie handling; **Yahoo Finance** (`yahoo-finance2` npm) as fallback | NSE endpoints unofficial but widely used; throttle and cache aggressively |
| Indices (NIFTY, SENSEX) | NSE public API + Yahoo Finance | Same approach |

**Provider abstraction is non-negotiable:** every data source sits behind a typed adapter (`packages/providers/*`). If/when budget allows, swap in Kite Connect, Morningstar, etc. with no business-logic changes.

**Holdings honesty:** if a fund's holdings can't be reliably obtained free, the fund detail page shows the official NAV and clearly indicates live estimate isn't available. Better to show less than to show wrong data.

### Hosting & Infrastructure
- **App:** **Vercel Hobby (free)** — Next.js native, edge network, preview deploys per PR, atomic rollback
- **DB:** **Supabase free tier** (PostgreSQL + Auth + Storage + Realtime + Edge Functions, all included)
- **Object storage:** **Supabase Storage** (free 1GB) for user-uploaded statements
- **Secrets:** Vercel Environment Variables (per-environment: preview / production); no `.env.production` in repo

### Observability & Operations (free tiers)
- **Errors:** **Sentry free tier** (5K errors/month, frontend + backend, source maps, release tracking)
- **Logs:** **Vercel built-in logs** + **Better Stack free tier** (3GB log ingestion / 3-day retention)
- **Uptime:** **UptimeRobot free** (50 monitors, 5-min interval) + public status page
- **Analytics:** **PostHog free tier** (1M events/month, session replay, feature flags)
- **Tracing:** Optional — defer until paid tier needed; rely on Sentry performance + Vercel analytics initially

### Security & Compliance
- **DDoS / bot protection:** Vercel's built-in attack mitigation (free)
- **Rate limiting:** Upstash Ratelimit (free tier) per-IP + per-user
- **Secrets scanning:** GitHub secret scanning (free for public repos; or paid GitHub Advanced Security for private) + `gitleaks` pre-commit (free)
- **Dependency scanning:** Dependabot (free) + `npm audit` in CI
- **SAST:** GitHub CodeQL (free for public repos)
- **Data encryption:** TLS 1.3 in transit (free, automatic); app-layer encryption for PII (email, display name) via `crypto` + key in Vercel env (Supabase free tier doesn't support column-level pgcrypto on all plans — verify; otherwise application-layer encrypt-decrypt at write/read boundary)
- **Audit log:** `audit_log` table — every portfolio mutation, login event, data export, deletion request
- **Pentest:** Self-run with OWASP ZAP + manual checklist before launch; defer paid pentest until revenue exists

### Testing
- **Unit:** Vitest
- **Component:** Testing Library + Storybook
- **Integration / API:** Vitest + supertest on isolated test DB
- **E2E:** Playwright (Chromium / Webkit / Firefox, mobile viewports), runs on every PR
- **Visual regression:** Chromatic on Storybook
- **Load testing:** k6 (target: 500 RPS sustained on `/api/portfolios/[id]` endpoint)
- **Accessibility:** axe-core in CI + manual screen reader QA

### CI/CD
- **GitHub Actions:** lint → typecheck → unit → integration → build → e2e → deploy
- **Environments:** local → preview (per-PR) → staging → production
- **Deploy strategy:** Vercel atomic deploys with instant rollback; DB migrations via Drizzle with `safe` mode (no destructive changes without review)
- **Conventional commits + Changesets** for versioning + auto-changelog

---

## UI / UX Design Principles

### Design philosophy
- **Mobile-first, fully responsive.** Every page must work cleanly on 360px width phones up to 4K desktops. Use Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) consistently.
- **Data-dense but breathable.** This is a finance app — users want lots of numbers visible at once, but with clear hierarchy. Use **tabular-nums** for all monetary values so digits align.
- **Calm, trustworthy palette.** Neutral grays + a single accent (e.g., indigo/teal). Use semantic color only for gains (green) / losses (red) — never decorative.
- **Live = obvious.** A pulsing dot + "LIVE" badge during market hours. Greyed-out badge when market is closed with next-open countdown.
- **Accessibility:** WCAG AA contrast, full keyboard navigation (shadcn/Radix gives this for free), screen-reader labels on all charts.

### Responsive layout strategy

| Breakpoint | Layout |
|---|---|
| **Mobile (<768px)** | Single column. Bottom tab nav (Home / Browse / Watchlist / Search). Holdings table → card list. Charts full-width, swipeable carousels for KPIs. |
| **Tablet (768–1024px)** | 2-column grid for fund detail (chart + holdings side-by-side). Top nav with hamburger. |
| **Desktop (>1024px)** | 3-column layout: left sidebar (filters/categories), center (main content), right (live NAV widget, sticky). Persistent top nav with search. |

### Key screens & UX details

**1. Landing (`/`)**
- Hero: large search bar (autocomplete fund names with fuzzy match), "Search by fund, AMC, or category"
- Below: 3 horizontal scrollable rails — "Top Equity Funds", "Trending Today" (biggest movers), "Recently Updated"
- Sticky "Markets" status bar at top: NIFTY 50, SENSEX live tickers
- CTA: "Compare funds" button

**2. Browse (`/funds`)**
- Filter sidebar (desktop) / bottom-sheet (mobile): Category, Sub-category, AMC, AUM range, 1Y return slider
- Sortable virtualized table (use `@tanstack/react-table` + `react-virtuoso` for 10k rows smoothness)
- Columns: Fund name, Category, NAV, 1D %, 1Y %, 3Y CAGR, AUM
- Mobile: card layout instead of table, with sort dropdown
- URL state for filters (shareable links)

**3. Fund Detail (`/funds/[schemeCode]`)** — the centerpiece
- **Hero section:** Fund name, AMC logo, category chip, official NAV (large), `LiveEstimatedNAV` widget (animated number ticker with green/red flash on update)
- **Tab bar:** Overview / Holdings / Performance / Risk / Documents
- **Overview tab:** Mini sparkline (30-day NAV), key stats (Expense Ratio, AUM, Min SIP, Exit Load) in a clean stat grid
- **Holdings tab:**
  - Donut chart (sector allocation) — clickable wedges drill into sector holdings
  - Treemap (top 50 holdings by weight) — visually shows concentration
  - Sortable holdings table with: stock name, sector, weight %, market value, **live price**, **1D change** (live, color-coded)
  - "As of [date]" badge with tooltip explaining monthly disclosure cadence
- **Performance tab:**
  - Interactive NAV history line chart (ApexCharts) — time-range selector: 1M / 3M / 6M / 1Y / 3Y / 5Y / Max, with brush/zoom
  - Returns table: 1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, Since Inception — vs category avg, vs benchmark
  - Rolling returns chart (advanced view, collapsible)
- **Risk tab:** Standard deviation, Sharpe, Sortino, Beta, Max Drawdown — with plain-English tooltips

**4. Live NAV Widget (sticky / floating)**
- Shows official NAV (small, grey) on top
- Estimated live NAV (large, prominent) with delta vs official (+₹X.XX / -X.XX%)
- Color-flash green/red on each refresh tick
- "Last updated: 2s ago" — auto-refresh 30s during market hours
- Confidence badge (High/Med/Low based on equity coverage)
- Tappable → opens explainer modal: "How is this calculated?"

**5. Compare Funds (`/compare`)** — stretch
- Side-by-side up to 4 funds: NAV chart overlay, holdings overlap heatmap, returns table

### Charts (specific choices)

| Chart | Library | Use |
|---|---|---|
| NAV history (long range, zoomable) | **ApexCharts** | Performance tab — has built-in brush, annotations, time-range UI |
| Sparklines (inline mini-charts in lists) | **Recharts** | Browse table, hero card |
| Holdings donut (sector allocation) | **Recharts** PieChart | Clickable, animated |
| Holdings treemap | **Recharts** Treemap | Visualizes weight concentration |
| Returns bar chart (1D/1W/1M…) | **Recharts** BarChart | Performance tab |
| Live NAV ticker animation | `framer-motion` `useMotionValue` | Smooth number interpolation |

All charts must: be responsive (use `ResponsiveContainer`), support dark mode, have accessible labels, gracefully handle empty/loading states.

### Component inventory (shadcn/ui base + custom)

`Button`, `Input`, `Command` (cmd-k search), `Dialog`, `Sheet` (mobile filters), `Tabs`, `Table`, `Badge`, `Tooltip`, `Skeleton`, `Toast`, `DropdownMenu`, `ScrollArea`, `Avatar` (AMC logos), `Separator`, `Card`, `Toggle` (theme switcher)

Custom on top: `FundCard`, `LiveNavWidget`, `HoldingsTreemap`, `SectorDonut`, `NumberTicker`, `MarketStatusBadge`, `ReturnsBadge` (auto-colors +/-)

### Loading & empty states
- **Skeleton screens** matching exact layout (not generic spinners) — shadcn `Skeleton`
- **Empty states** with illustration + helpful copy (e.g., "Holdings not yet disclosed for this fund — AMCs disclose monthly")
- **Error boundaries** with retry button, no raw stack traces

### Micro-interactions
- Number tickers animate when live NAV updates (count-up effect, ~400ms)
- Subtle row highlight on holdings table when a stock's live price moves
- Skeleton → content cross-fade (no jarring pops)
- Tab switches use `framer-motion` `AnimatePresence` for slide

### Performance budgets
- Lighthouse score: ≥90 Performance, ≥95 Accessibility on fund detail page
- Initial JS bundle <200KB gzipped
- Use Next.js `dynamic()` for ApexCharts (it's heavy — code-split)
- Image optimization via `next/image` for AMC logos

---

## Data Source Strategy

See Tech Stack → Data Providers above. Summary:

- **AMFI NAVAll.txt** (free, authoritative) for the daily fund list + NAV
- **MFAPI.in** (free) for historical NAV per scheme
- **AMC official disclosures** for holdings (where programmatically obtainable); otherwise "Holdings not available" rather than scraping
- **NSE public API** + **Yahoo Finance** (`yahoo-finance2`) for live stock quotes — used with respectful rate limiting (request coalescing in Redis, 60-second TTL, batched fetches)
- Provider adapter pattern (`packages/providers/*`) so paid feeds can drop in later without business-logic changes

**Free-tier discipline:**
- Cache everything cacheable; never round-trip an unchanged value
- Coalesce concurrent requests for the same ticker into one upstream call
- Respect upstream sites — UA string, reasonable QPS, no parallel firehose
- Quota dashboards (Supabase usage, Upstash commands, Sentry events, Resend emails) checked weekly; alert at 80% of free-tier limit
- If a free source breaks (e.g., NSE changes endpoint), gracefully degrade to the fallback, surface a banner to users, and ship a fix — don't silently show wrong numbers

**Legal:** No production scraping of paywalled or ToS-protected aggregators (Moneycontrol, ValueResearch). AMFI/MFAPI/NSE/Yahoo public endpoints are used as published.

---

## Database Schema

```sql
-- Master fund catalog (synced daily from AMFI)
funds (
  scheme_code     TEXT PRIMARY KEY,         -- AMFI scheme code
  scheme_name     TEXT NOT NULL,
  amc_name        TEXT,
  category        TEXT,                     -- Equity / Debt / Hybrid / ETF
  sub_category    TEXT,                     -- Large Cap, Mid Cap, etc.
  isin_growth     TEXT,
  isin_div        TEXT,
  latest_nav      NUMERIC(12, 4),
  latest_nav_date DATE,
  updated_at      TIMESTAMPTZ DEFAULT now()
)

-- Portfolio holdings (refreshed weekly/monthly)
holdings (
  id             BIGSERIAL PRIMARY KEY,
  scheme_code    TEXT REFERENCES funds(scheme_code),
  as_of_date     DATE NOT NULL,             -- portfolio disclosure date
  instrument     TEXT NOT NULL,             -- stock name as published
  ticker         TEXT,                      -- normalized NSE/BSE symbol (nullable for debt/cash)
  isin           TEXT,
  asset_type     TEXT,                      -- EQUITY / DEBT / CASH / OTHER
  weight_pct     NUMERIC(7, 4),             -- % of portfolio
  market_value   NUMERIC(18, 2),            -- INR
  quantity       NUMERIC(18, 4),
  UNIQUE (scheme_code, as_of_date, instrument)
)

-- NAV history (for charts + base value for live calc)
nav_history (
  scheme_code TEXT REFERENCES funds(scheme_code),
  nav_date    DATE NOT NULL,
  nav         NUMERIC(12, 4) NOT NULL,
  PRIMARY KEY (scheme_code, nav_date)
)

-- Short-lived cache of stock quotes (avoid hammering Yahoo)
stock_price_cache (
  ticker      TEXT PRIMARY KEY,
  price       NUMERIC(12, 4) NOT NULL,
  prev_close  NUMERIC(12, 4),
  fetched_at  TIMESTAMPTZ NOT NULL
)

-- ============ PORTFOLIO + USER TABLES ============

users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider_id TEXT UNIQUE NOT NULL, -- Supabase Auth user id
  email_encrypted BYTEA NOT NULL,         -- pgcrypto column-level encryption
  email_hash      TEXT UNIQUE NOT NULL,   -- for lookup
  display_name    TEXT,
  disclaimer_accepted_at TIMESTAMPTZ,
  mfa_enabled     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ             -- soft delete for DPDP grace period
)

portfolios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,            -- e.g., "My Demo Portfolio", "Aggressive", "Retirement"
  description TEXT,
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- Each row = one transaction (buy / sell / SIP installment)
portfolio_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  scheme_code   TEXT REFERENCES funds(scheme_code),
  txn_type      TEXT NOT NULL,          -- BUY / SELL / SIP
  txn_date      DATE NOT NULL,
  units         NUMERIC(18, 6) NOT NULL,
  nav_at_txn    NUMERIC(12, 4) NOT NULL,
  amount        NUMERIC(18, 2) NOT NULL,  -- units * nav_at_txn (derived; stored for convenience)
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Optional: watchlist (track funds without owning them)
watchlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  scheme_code  TEXT REFERENCES funds(scheme_code),
  added_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, scheme_code)
)

-- Daily snapshot of portfolio value (for historical chart of portfolio P&L)
portfolio_snapshots (
  portfolio_id  UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_invested NUMERIC(18, 2) NOT NULL,
  total_value    NUMERIC(18, 2) NOT NULL,
  PRIMARY KEY (portfolio_id, snapshot_date)
)

goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_amount NUMERIC(18, 2) NOT NULL,
  target_date   DATE NOT NULL,
  portfolio_id  UUID REFERENCES portfolios(id),
  created_at    TIMESTAMPTZ DEFAULT now()
)

alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- NAV_THRESHOLD / PNL_THRESHOLD / REBALANCE_DRIFT / NAV_PUBLISHED
  config      JSONB NOT NULL,   -- type-specific params
  channels    TEXT[] NOT NULL,  -- IN_APP / EMAIL / PUSH / TELEGRAM
  is_active   BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ
)

audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  actor_type  TEXT,             -- USER / SYSTEM / ADMIN
  action      TEXT NOT NULL,    -- e.g. 'portfolio.txn.create'
  entity_type TEXT,
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
)

import_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,   -- CAS / GROWW_CSV / ZERODHA_CSV / KUVERA_CSV
  status       TEXT NOT NULL,   -- QUEUED / PARSING / READY_FOR_REVIEW / COMMITTED / FAILED
  raw_file_url TEXT,            -- R2 with short-lived signed access
  parsed_payload JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
)
```

**Auth:** Required from first transaction. Public pages (fund browse / detail) are viewable without sign-in; portfolios require an authenticated session. Email magic link + Google OAuth via **Supabase Auth** (free). Row-level security policies on every table scoped to `auth.uid()`. No anonymous portfolios in production.

---

## Portfolio Feature

> **Positioning:** This is a portfolio **tracking** tool. Users enter the transactions they have already made via their broker / AMC. The app does not execute trades, does not give investment advice, and is not a SEBI Registered Investment Advisor. A clear disclaimer is shown on first login and accepted as part of Terms of Service.

### What users can do
1. **Create** multiple named portfolios ("Retirement", "Children's Education", "Aggressive")
2. **Add transactions:** Pick a fund, enter units (or amount + NAV-on-date), mark as BUY / SELL / SIP / DIVIDEND / SWITCH. Backdated entries supported.
3. **CAS Import:** Upload a CAMS / KFinTech **Consolidated Account Statement (CAS) PDF** — parse it (password-protected by PAN) and bulk-import every transaction. This is the killer feature for production users — gets them from zero to a full portfolio in 30 seconds.
4. **Broker statement import:** CSV templates for Groww / Zerodha Coin / Kuvera / ET Money exports
5. **SIP tracking:** Mark existing SIPs; system auto-pulls historical NAV and computes installments
6. **Tax view:** Realized gains / losses for the financial year, separated by STCG vs LTCG (equity vs debt holding-period rules), grandfathered NAV for pre-Feb-2018 equity holdings
7. **Track live:** Portfolio dashboard shows total invested, current value (live estimated NAV), absolute P&L, % return, day's change in ₹ and %, XIRR
8. **Goal tracking:** Set a goal (target amount + date), assign portfolios to it, see progress with projected end-value (Monte-Carlo simulation using historical fund returns)
9. **Rebalancing alerts:** Define target allocation (e.g., 70/30 equity/debt); get notified when drift exceeds threshold
10. **Per-fund breakdown:** Table with units, avg buy NAV, current NAV, value, unrealized P&L, allocation %, day-change
11. **Asset allocation:** Donut by category, sector, market-cap, geography (where disclosed)
12. **Watchlist:** Track funds without holding — same live NAV view
13. **Alerts:** Price/NAV alerts, portfolio P&L threshold alerts, NAV-published alerts — via in-app, email, push (web push API), optional Telegram
14. **Reports:** Generate PDF reports (monthly/quarterly/annual) for self-review or sharing with an advisor / CA
15. **Export:** CSV, JSON, Excel — all user data exportable per DPDP Act

### Key calculations

```
Per-fund metrics (aggregated across all transactions for that fund in the portfolio):
  total_units        = Σ BUY.units + Σ SIP.units − Σ SELL.units
  total_invested     = Σ BUY.amount + Σ SIP.amount − Σ SELL.amount
  avg_cost_nav       = total_invested / total_units
  current_value      = total_units × live_estimated_NAV
  unrealized_pnl     = current_value − total_invested
  pnl_pct            = unrealized_pnl / total_invested × 100
  day_change         = total_units × (live_NAV − official_NAV_yesterday)

Portfolio-level:
  total_invested  = Σ per-fund total_invested
  total_value     = Σ per-fund current_value
  total_pnl       = total_value − total_invested
  XIRR            = computed via Newton-Raphson over cash-flow list
                    cash flows = [(-amount, txn_date) for buys/SIPs, (+current_value, today)]
```

Use the `xirr` npm package — battle-tested, handles edge cases.

### Pages & components for portfolio

- **`/portfolio`** — list of user's portfolios (or single-portfolio dashboard if only one)
- **`/portfolio/[id]`** — main dashboard:
  - Top KPI strip: Invested / Current Value / Total P&L (₹ + %) / Day's Change / XIRR — each a `Card` with `NumberTicker`
  - Value-over-time area chart (ApexCharts) with toggle: portfolio value vs invested (filled gap = gains)
  - Asset allocation donut (by category) + sector exposure bar chart (drilled through holdings) + market-cap split
  - Holdings table: fund | units | avg cost | current NAV (live) | value | P&L | % | day change | actions
  - Tax view tab: realized STCG / LTCG by FY, grandfathered NAV for pre-Feb-2018
  - Goals tab: progress vs goal, projected end-value (Monte-Carlo)
  - "Add transaction" floating action button (mobile) / button (desktop)
- **`/portfolio/[id]/add`** — transaction entry: fund autocomplete → units or amount → date picker → NAV auto-filled from `nav_history` for that date (editable with audit-logged override) → preview → save
- **`/portfolio/[id]/import`** — CAS PDF upload + broker CSV importers; preview parsed transactions, deduplicate, confirm import
- **`/portfolio/[id]/sip`** — track and project existing SIPs
- **`/portfolio/[id]/report`** — generate PDF report (monthly / quarterly / annual / custom range)
- **`/watchlist`** — grid of cards, one per watched fund, with live estimated NAV + 1D %
- **`/alerts`** — manage NAV / portfolio / rebalancing alerts
- **`/settings`** — profile, security, sessions, notifications, data export, account deletion
- **Onboarding:** Multi-step wizard after sign-up:
  1. Welcome + SEBI non-advisory disclaimer (must accept)
  2. "How would you like to start?" → Import CAS PDF / Import broker CSV / Enter manually
  3. Verify imported holdings
  4. Optional: set first goal, enable alerts

### Components

`PortfolioKpiStrip`, `PortfolioValueChart`, `HoldingsBreakdownTable`, `AddTransactionDialog`, `CasImportDialog`, `BrokerCsvImportDialog`, `SipTrackerCard`, `AllocationDonut`, `MarketCapSplitChart`, `XirrBadge`, `TaxViewTable`, `GoalProgressCard`, `MonteCarloChart`, `RebalanceAlertCard`, `WatchlistGrid`, `AlertManager`, `OnboardingWizard`, `PdfReportPreview`

### API routes (additions)

```
POST   /api/portfolios                          create portfolio
GET    /api/portfolios                          list user's portfolios
GET    /api/portfolios/[id]                     full dashboard payload (positions + KPIs, batched live NAV)
PATCH  /api/portfolios/[id]                     rename / settings
DELETE /api/portfolios/[id]

POST   /api/portfolios/[id]/transactions        add txn (zod-validated, audit-logged)
PATCH  /api/portfolios/[id]/transactions/[txnId]
DELETE /api/portfolios/[id]/transactions/[txnId]

POST   /api/portfolios/[id]/import/cas          upload CAS PDF — kicks off Supabase Edge Function
POST   /api/portfolios/[id]/import/csv          broker CSV import
GET    /api/portfolios/[id]/import/[jobId]      poll import job status

GET    /api/portfolios/[id]/value-history       chart data
GET    /api/portfolios/[id]/tax                 STCG/LTCG by FY
GET    /api/portfolios/[id]/report.pdf          server-rendered PDF
POST   /api/portfolios/[id]/goals               create goal
GET    /api/portfolios/[id]/goals/[goalId]/projection   Monte-Carlo result

POST   /api/watchlist
DELETE /api/watchlist/[schemeCode]
GET    /api/watchlist                           with live NAV for each

POST   /api/alerts                              create alert
GET    /api/alerts
DELETE /api/alerts/[id]

GET    /api/me/export                           full data export (DPDP)
DELETE /api/me                                  account deletion (DPDP)
```

All write endpoints: zod validation, rate-limited, audit-logged. All reads scoped to authenticated user via row-level security (Supabase RLS) as defense-in-depth.

`GET /api/portfolios/[id]` is the hot endpoint — must batch-fetch live NAVs for all held funds in one go (loop `navCalculator` but share the underlying ticker quote batch).

---

## Live NAV Calculation Logic

The "estimated live NAV" formula:

```
estimated_NAV = official_NAV_prev_day × (1 + portfolio_return_today)

portfolio_return_today = Σ (weight_i × stock_return_i)  for each equity holding
                      where stock_return_i = (live_price_i − prev_close_i) / prev_close_i
```

**Key file:** `lib/navCalculator.ts` — pure, fully unit-tested, no external I/O (receives holdings + quotes as inputs).

```typescript
type LiveNavInputs = {
  officialNav: number;
  officialNavDate: Date;
  holdings: Holding[];        // pre-fetched by caller
  quotes: Record<string, { price: number; prevClose: number; ts: Date }>;
};

export function computeLiveNav({ officialNav, officialNavDate, holdings, quotes }: LiveNavInputs): LiveNavResult {
  const equityHoldings = holdings.filter(h => h.assetType === 'EQUITY' && h.ticker);

  let equityReturn = 0;
  let equityWeightCovered = 0;
  let stalestQuoteTs: Date | null = null;

  for (const h of equityHoldings) {
    const q = quotes[h.ticker!];
    if (!q || !q.prevClose) continue;
    const r = (q.price - q.prevClose) / q.prevClose;
    equityReturn += (h.weightPct / 100) * r;
    equityWeightCovered += h.weightPct;
    if (!stalestQuoteTs || q.ts < stalestQuoteTs) stalestQuoteTs = q.ts;
  }

  const estimatedNav = officialNav * (1 + equityReturn);
  const confidence: 'high' | 'medium' | 'low' =
    equityWeightCovered > 80 ? 'high' : equityWeightCovered > 40 ? 'medium' : 'low';

  return {
    estimatedNav,
    officialNav,
    officialNavDate,
    delta: estimatedNav - officialNav,
    deltaPct: ((estimatedNav - officialNav) / officialNav) * 100,
    equityCoveragePct: equityWeightCovered,
    quotesAsOf: stalestQuoteTs,
    confidence,
  };
}
```

The orchestrator (`app/api/nav/[code]/route.ts`) handles I/O: Redis cache lookup → DB fetch → batched quote fetch with provider failover → call `computeLiveNav` → set cache headers (`s-maxage=30, stale-while-revalidate=60`).

Critical caveats surfaced in the UI:
- Holdings 1–4 weeks stale (monthly disclosure cadence) — exact `as_of` date shown
- Non-equity portion assumed flat intraday — less reliable for hybrid/debt funds (confidence badge)
- Quote feed may have brief gaps — `quotesAsOf` shown, "live" badge dims if >2 min old

---

## File Structure

Monorepo (Turborepo) — keeps marketing site, web app, mobile, shared libs in lock-step:

```
ISP/
├── apps/
│   ├── web/                              # Next.js app (this plan's main scope)
│   │   ├── app/
│   │   │   ├── (marketing)/              # public landing, pricing, about
│   │   │   ├── (app)/                    # authed area, shared layout
│   │   │   │   ├── funds/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [schemeCode]/page.tsx
│   │   │   │   ├── portfolio/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       ├── add/page.tsx
│   │   │   │   │       ├── import/page.tsx
│   │   │   │   │       ├── sip/page.tsx
│   │   │   │   │       └── report/page.tsx
│   │   │   │   ├── watchlist/page.tsx
│   │   │   │   ├── alerts/page.tsx
│   │   │   │   └── settings/
│   │   │   ├── api/
│   │   │   │   ├── funds/
│   │   │   │   ├── nav/[code]/route.ts
│   │   │   │   ├── quotes/route.ts
│   │   │   │   ├── portfolios/
│   │   │   │   ├── watchlist/
│   │   │   │   ├── alerts/
│   │   │   │   ├── me/                   # /export, DELETE /me
│   │   │   │   └── webhooks/             # provider callbacks, Stripe (if monetized)
│   │   │   └── layout.tsx
│   │   ├── components/                   # app-specific composites
│   │   └── e2e/                          # Playwright specs
│   ├── docs/                             # help center (Nextra or Mintlify)
│   └── status/                           # status page (optional self-hosted)
├── packages/
│   ├── ui/                               # shadcn-based design system
│   │   ├── components/
│   │   └── stories/
│   ├── db/                               # Drizzle schema + migrations + RLS policies
│   ├── core/                             # business logic — pure, no I/O
│   │   ├── navCalculator.ts
│   │   ├── portfolioCalc.ts              # positions, P&L, XIRR
│   │   ├── taxCalc.ts                    # STCG/LTCG, grandfathered NAV
│   │   ├── sipScheduler.ts
│   │   ├── monteCarlo.ts                 # goal projection
│   │   └── tickerMap.ts
│   ├── providers/                        # data-provider adapters (interface + impls)
│   │   ├── funds/{kite,mfapi,amfi}.ts
│   │   ├── holdings/{morningstar,refinitiv}.ts
│   │   ├── quotes/{kite,truedata}.ts
│   │   └── index.ts                      # facade with failover
│   ├── jobs/                             # Vercel Cron handlers + Supabase Edge Functions
│   │   ├── syncNavDaily.ts
│   │   ├── syncHoldingsWeekly.ts
│   │   ├── warmQuoteCache.ts
│   │   ├── portfolioSnapshotDaily.ts
│   │   ├── processCasImport.ts
│   │   └── dispatchAlerts.ts
│   ├── cas-parser/                       # CAS PDF parser, isolated, heavily tested
│   ├── reports/                          # @react-pdf/renderer templates
│   ├── auth/                             # Supabase Auth wrappers, session helpers, RLS test utils
│   ├── emails/                           # React Email templates
│   ├── observability/                    # otel init, logger, sentry helpers
│   └── config/                           # shared tsconfig, eslint, tailwind preset
├── infra/                                # IaC if/when we move beyond Vercel
│   └── terraform/
├── runbooks/                             # on-call docs
├── .github/workflows/                    # CI/CD
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

**Key principle:** `packages/core` is pure TypeScript with no I/O. All side effects (DB, network, provider calls) live in adapter layers. This makes the financial logic trivially unit-testable and portable to future mobile apps.

---

## Build Phases (~3 months solo, ~6 weeks with two engineers)

> Realistic timeline on free-tier infra. Each phase has explicit exit criteria. Order matters: data correctness comes before UI polish, auth before any user-data feature.

### Phase 0: Foundation (Week 1)
1. Monorepo (Turborepo + pnpm), TypeScript strict, ESLint + Prettier + Husky pre-commit, conventional commits
2. CI pipeline (GitHub Actions free): lint, typecheck, unit tests, build, Playwright e2e on Chromium
3. Two environments: local (Docker Compose: Postgres only; Supabase locally via `supabase start`) + Vercel (preview-per-PR + production)
4. Drizzle ORM + initial migrations, seed scripts
5. **Sentry free**, **PostHog free**, **UptimeRobot** wired before any business code
6. Vercel env vars set up; `.env.example` checked in, real `.env*` ignored
7. Storybook scaffolded with design tokens; Tailwind preset shared in `packages/config`
8. Legal text drafted (ToS, Privacy, SEBI disclaimer) — template-based; lawyer review optional pre-launch

**Exit:** A trivial Next.js page deploys via PR merge; a deliberate error shows up in Sentry; PostHog records a pageview.

### Phase 1: Data Pipeline (Week 2–3)
9. Provider adapters under typed interfaces: `providers/funds/amfi.ts`, `providers/funds/mfapi.ts`, `providers/quotes/nse.ts`, `providers/quotes/yahoo.ts`
10. Vercel Cron job: daily NAV sync from AMFI NAVAll.txt (8:30 PM IST) — upsert into `funds` + `nav_history`
11. Backfill script: pull 5+ years of historical NAV from MFAPI.in for popular funds (run once, chunked to respect rate limits)
12. Ticker-mapping module: instrument name → ISIN → NSE symbol, with manual override JSON seeded from NIFTY 500
13. Holdings ingestion: start with manual / scripted parsing of top 50 funds' monthly factsheets from AMC sites; clearly scoped, not aggregator scraping

**Exit:** ~10,000 funds present, NAV history populated for top 500 funds, holdings for top 50. Daily cron observed running on Vercel for one week without errors.

### Phase 2: Catalog & Fund Detail (Week 4–5)
14. Fund browse with Postgres FTS + `pg_trgm` for autocomplete (no separate search service)
15. `/funds` browse: server-rendered list, faceted filters, URL state, virtualized rows via `react-virtuoso`
16. `/funds/[schemeCode]` detail page: Overview / Holdings / Performance / Risk tabs
17. NAV history chart (ApexCharts, code-split via `next/dynamic`), holdings donut + treemap, returns table
18. Storybook stories for every new component

**Exit:** Lighthouse ≥90 on fund detail page (mobile 4G throttle), axe-core finds zero violations, Playwright covers happy paths.

### Phase 3: Live NAV Engine (Week 6)
19. `packages/core/navCalculator.ts` (pure function shown above)
20. Quote-fetch orchestrator with **Upstash Redis** cache (60s TTL, batched, request coalescing); local in-memory `lru-cache` fallback if Upstash quota hit
21. NSE quote adapter with cookie/UA handling + Yahoo fallback chain
22. `LiveNavWidget` with TanStack Query (30s refetch), market-hours guard, confidence badge, "how is this calculated?" modal
23. Backtest harness: replay 30 days of intraday quotes for top 20 funds, measure estimated vs actual EOD NAV; target <0.5% MAE on >90% equity funds
24. UptimeRobot monitor on `/api/nav/[code]`

**Exit:** Backtest meets accuracy bar; runbook for "live NAV broken" written; market-closed state shown correctly.

### Phase 4: Auth, Accounts, Privacy (Week 7)
25. Supabase Auth: email magic link + Google OAuth
26. Email verification, session management
27. Row-level security policies on every user-scoped table
28. Account settings: profile, sessions, MFA (TOTP), danger zone (delete account)
29. DPDP compliance: `GET /api/me/export`, `DELETE /api/me` with 7-day grace, consent log on signup
30. App-layer PII encryption (email, display name) using `crypto` + Vercel-env-stored key
31. Audit-log middleware: every mutation writes to `audit_log`

**Exit:** Self-run OWASP ZAP scan against staging shows no high findings; manual account-deletion test removes all rows.

### Phase 5: Portfolio Feature (Week 8–11)
32. Schema migrations for portfolio tables (already designed above)
33. `packages/core/portfolioCalc.ts`: positions, P&L, XIRR (with bisection fallback), day-change — 100% unit-test coverage
34. CRUD APIs with `zod` validation, RLS, audit-log writes
35. Portfolio dashboard: KPI strip, value-over-time chart, holdings table with live NAV, allocations
36. Add-transaction dialog with NAV auto-fill from history
37. **CAS PDF import** — multi-week sub-project. Use `pdfjs-dist` + `pdf-parse`; build against a corpus of 30+ real CAS PDFs. This is high-value; budget time accordingly.
38. Broker CSV importers (Groww, Zerodha Coin, Kuvera, ET Money) — separate parser per source, shared validation
39. SIP tracking with historical-NAV lookup
40. Tax view: STCG/LTCG by FY, grandfathered NAV for pre-Feb-2018 equity
41. Goal tracking with simple Monte-Carlo (1000 paths) projection
42. Rebalancing alerts engine
43. Alerts: in-app + email (Resend free) + web push (free, browser-native); Telegram nice-to-have
44. PDF reports (server-rendered `@react-pdf/renderer`)
45. Data export: CSV / JSON

**Exit:** Beta cohort (10–20 friends/users) onboarded via CAS import; one week of feedback gathered; no P0 bugs.

### Phase 6: UX Polish, Performance, Accessibility (Week 12)
46. Full mobile pass with bottom tab nav, bottom-sheet filters, swipe gestures
47. Skeleton loaders matching exact layouts, branded empty states, error boundaries with retry
48. Micro-interactions: number tickers, row flashes on price tick, page transitions
49. Self-driven accessibility audit (axe-core, manual screen reader, keyboard nav)
50. Performance budgets enforced in CI: bundle size, LCP, INP
51. i18n scaffolding (English shipped; Hindi keys structured)

**Exit:** Lighthouse ≥95 across all key pages on throttled 4G; axe-core clean; PostHog session replays show no obvious UX dead-ends.

### Phase 7: Hardening & Launch (Week 13)
52. Self-run OWASP ZAP + manual security checklist (OWASP ASVS Level 1)
53. Soak test: lightweight load via `autocannon` or k6 free against staging (50 RPS sustained for 30 min) — sufficient for free-tier launch scale
54. Chaos: simulate NSE endpoint failure, verify Yahoo fallback engages
55. DR drill: restore from Supabase point-in-time backup, time the RTO
56. Final legal review of ToS / Privacy / SEBI disclaimer; cookie consent banner; disclaimer-accept modal on first portfolio creation
57. Status page (Better Stack free or simple Next.js page), help center articles (~10 to start)
58. Soft launch to waitlist (~100 users) for 1–2 weeks; monitor Sentry + PostHog closely

**Exit:** Zero open P0/P1 bugs; KPIs and dashboards live; quota usage well under free-tier limits at launch traffic.

### Phase 8: Public Launch + Iterate (Week 14+)
59. Public launch (organic / ProductHunt / Twitter / Reddit r/IndiaInvestments)
60. Solo or rotating on-call via Sentry alerts → email/Telegram
61. Weekly product reviews using PostHog funnels
62. Roadmap: comparison tool, advisor dashboard, React Native mobile app, Hindi localization, additional importers
63. Plan paid-tier migration thresholds (e.g., when DAU > 500 → upgrade Supabase / Upstash)

---

## Critical Files / Modules

| Module | Purpose |
|---|---|
| `packages/providers/` | Adapter interfaces + impls + failover facade — the boundary against the data world |
| `packages/core/navCalculator.ts` | Pure live-NAV math; 100% unit-test coverage required |
| `packages/core/portfolioCalc.ts` | Positions, P&L, XIRR; 100% unit-test coverage required |
| `packages/core/taxCalc.ts` | STCG/LTCG with grandfathered NAV — must be reviewed by a CA before launch |
| `packages/core/tickerMap.ts` | Name/ISIN → exchange-symbol resolver with corporate-action history |
| `packages/cas-parser/` | CAS PDF → transactions; tested against a corpus of 50+ real statements |
| `packages/jobs/` | Vercel Cron handlers + Supabase Edge Functions; idempotent, structured-logged |
| `packages/db/` | Schema, migrations, RLS policies |
| `apps/web/app/api/nav/[code]/route.ts` | Hot endpoint — Redis-cached, p95 <200ms |
| `apps/web/app/api/portfolios/[id]/route.ts` | Aggregated dashboard payload — batched quote fetch |
| `runbooks/` | On-call docs for every alert |

---

## Reusable Libraries (don't reinvent)

- **`drizzle-orm`** + `drizzle-kit` — type-safe SQL, migrations
- **`@supabase/supabase-js`** + **`@supabase/ssr`** — auth + DB + storage client
- **`@upstash/redis`** + **`@upstash/ratelimit`** — free-tier cache + rate limiting
- **`yahoo-finance2`** — Yahoo quote fallback (no key)
- **`shadcn/ui`** + **`@radix-ui/*`** — accessible component primitives
- **`recharts`** + **`apexcharts`** — charts
- **`xirr`** — XIRR with Newton-Raphson
- **`date-fns`** + **`date-fns-tz`** — date math, IST-aware
- **`zod`** — runtime validation, shared client/server schemas
- **`@tanstack/react-query`** + **`@tanstack/react-table`** + **`react-virtuoso`** — data fetching, tables, virtualization
- **`react-hook-form`** + **`@hookform/resolvers/zod`** — forms
- **`framer-motion`** — animations
- **`@react-pdf/renderer`** — PDF reports
- **`@sentry/nextjs`** — error tracking (free tier)
- **`pdfjs-dist`** + **`pdf-parse`** — CAS PDF extraction (with custom parsers on top)
- **`fuse.js`** — fuzzy string matching for ticker mapping
- **`resend`** + **`react-email`** — transactional email (free tier)
- **`posthog-js`** — product analytics, feature flags (free tier)
- **`lru-cache`** — in-memory fallback when Upstash quota exhausted
- **`vitest`**, **`@testing-library/react`**, **`@playwright/test`**, **`storybook`** — testing stack (all free)

---

## Verification Plan

### Automated (every PR)
- **Unit tests:** Vitest, ≥80% coverage on `lib/`, 100% on `portfolioCalc.ts` and `navCalculator.ts`
- **Component tests:** Testing Library, story-driven
- **Visual regression:** Chromatic blocks PRs with unexpected pixel diffs
- **Integration tests:** API routes hit a real Postgres in CI Docker
- **E2E:** Playwright on Chromium / WebKit / mobile viewports — onboarding, fund detail, add transaction, CAS import, sign-up, password reset, data export, account deletion
- **Accessibility:** axe-core in CI; build fails on any violation
- **Performance budgets:** bundle size, LCP, INP — fail PR on regression
- **Type safety:** `tsc --strict --noEmit` must pass

### Staging (every merge)
- Full e2e suite against staging Postgres seeded with sanitized production-like data
- Load test (k6) nightly: 500 RPS sustained for 10 min on `/api/nav/[code]` and `/api/portfolios/[id]`
- Live NAV accuracy job: compute estimated NAV at 3:25 PM, compare to actual EOD NAV at 9 PM, alert if MAE >0.5% on >90% equity funds
- Synthetic monitors (Better Stack): sign-in, view fund, add transaction every 5 minutes

### Manual QA (every release)
- Cross-device matrix: iPhone 12+ (Safari), Pixel 6+ (Chrome), iPad, MacBook (Safari/Chrome/Firefox), Windows (Chrome/Edge), low-end Android
- Network throttling: Slow 3G, offline mode (PWA caching for viewed funds)
- Dark mode visual sweep
- Screen reader smoke test (VoiceOver + NVDA)
- Real CAS PDFs from 5 different volunteers imported successfully

### Production readiness sign-offs (before launch)
- Security team: pentest report findings remediated
- Legal: ToS / Privacy / SEBI disclaimer approved
- Compliance: DPDP register complete, sub-processor DPAs signed
- Finance: monthly run-rate cost approved
- Support: help center + SLAs published

### Key acceptance metrics (free-tier realistic)
| Metric | Target |
|---|---|
| Live NAV accuracy (equity-heavy funds, MAE) | <0.5% |
| `/api/nav/[code]` p95 latency (cache hit) | <300ms |
| `/api/nav/[code]` p95 latency (cache miss, batch upstream) | <1.5s |
| `/api/portfolios/[id]` p95 latency | <800ms |
| Fund detail page LCP (mobile 4G) | <2.5s |
| Uptime | ≥99% |
| Lighthouse Performance | ≥90 |
| Lighthouse Accessibility | ≥95 |
| axe-core violations | 0 |
| Coverage (statements) | ≥80% overall, 100% on `packages/core` (financial calc) |
| Supabase free-tier usage at launch | <50% |
| Upstash free-tier usage at launch | <50% |

---

## Risk Register (Production)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Free data source breaks (NSE endpoint change, AMFI URL move, Yahoo block) | High | High | Each data type has at least one fallback; staleness monitor with alert; user-facing banner if degraded; provider adapter pattern so a fix is localized |
| 2 | Ticker mapping errors → wrong live NAV | Med | High | Mandatory two-source verification (ISIN + name fuzzy match), manual review queue for new mappings, daily diff against EOD NAV |
| 3 | CAS PDF parser breaks on a new statement format | High | Med | Versioned parser per format year, test corpus of 50+ real PDFs in CI, "report a problem" button in UI, fallback to manual entry |
| 4 | Quote provider rate limits / blocks | High | High | Request coalescing in Redis, batched quote calls, 60s TTL, polite UA + delays, in-memory fallback cache; if blocked, switch to fallback adapter automatically |
| 5 | DB hot-spot on `/api/portfolios/[id]` | Med | High | Materialized portfolio snapshot updated on txn write; live calc only updates day-change deltas; read-replica for analytics |
| 6 | XIRR convergence failures | Low | Low | Newton-Raphson with bisection fallback; absolute-return % displayed when XIRR can't converge |
| 7 | SEBI Investment Advisor compliance | Low | Critical | Lawyer-reviewed disclaimers, no recommendations, no buy/sell execution, audit log of disclaimer acceptance |
| 8 | DPDP Act / GDPR violation | Low | Critical | Encryption at rest for PII, data-export + delete endpoints, DPA with every sub-processor, annual privacy review |
| 9 | Account takeover | Low | High | MFA available, breached-password check, session anomaly detection, audit log |
| 10 | Free-tier quota exhaustion (Supabase / Upstash / Sentry / Resend) | Med | High | Weekly quota review; alerting at 80%; in-memory `lru-cache` fallback on Upstash; defer non-critical writes if Supabase row count nears free-tier limits; clearly budgeted upgrade thresholds documented |
| 11 | Live NAV accuracy <0.5% MAE not achieved | Med | High | Holdings refresh weekly (not monthly) for top 200 funds via direct AMC feeds where available; non-equity portion treated transparently with "low confidence" label |
| 12 | Backdated transactions with no NAV record | Low | Low | NAV history extended to 10+ years via paid feed; manual NAV entry as fallback with audit log |
| 13 | Bus factor / on-call burnout | Med | High | Runbooks for every alert, two-person on-call rotation from day one, post-mortems for every P0/P1 |
| 14 | Cost overrun (data feeds, infra) | Med | Med | Monthly cost dashboard, alerting at 80% of budget, regular FinOps review |

---

## Operational Readiness Checklist (free-tier launch)

Before public launch, every item below must be checked:

- [ ] Runbooks in `/runbooks` for: NAV sync failed, quote provider down, Supabase quota near limit, account-takeover suspected, data-export request, account-deletion request, P0 production error
- [ ] Sentry alerts wired to email/Telegram for new error types
- [ ] Backups: Supabase free tier daily backup retention (7 days) confirmed; **restore drill passed** to a fresh local DB
- [ ] SLOs documented (informal): live NAV p95 <500ms, fund detail LCP <2.5s on 4G, uptime ≥99%
- [ ] Status page live (Better Stack free or simple Next.js page) with UptimeRobot monitors auto-updating
- [ ] Help center seeded with ~10 articles: getting started, how live NAV works, CAS import, FAQ, security, data deletion
- [ ] Legal: Terms of Service, Privacy Policy, Cookie Policy, SEBI non-advisory disclaimer published; first-portfolio disclaimer-accept modal logs consent
- [ ] DPDP register maintained; data-processing agreements (Supabase, Vercel, Sentry, PostHog, Upstash, Resend) reviewed
- [ ] Security: OWASP ZAP scan clean of high/medium findings, CSP enforced, security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), rate-limit policy active
- [ ] Quota dashboards bookmarked: Supabase, Upstash, Sentry, Resend, PostHog. Weekly review cadence.
- [ ] Cost ceiling alert: if any service is about to leave free tier unexpectedly, notify owner before it auto-bills
- [ ] Observability: PostHog product dashboards (signups, portfolios created, CAS imports succeeded), Sentry "issues" zero P0 in last 7 days of staging
