# Runbook: Quote Provider Down

## Symptom
- Live NAV widget shows "—" or last-known value with stale timestamp
- `confidence: "low"` on all funds
- Sentry error: `TransientProviderError` from `YahooQuotesProvider` or NSE adapter
- Market status bar shows "Live" but prices aren't updating

## Severity
**P2** — live NAV estimate unavailable; official NAV still shown; app functional

## First response (read-only triage)
1. Check Vercel function logs for `/api/nav/[code]` — look for provider errors
2. Manually test Yahoo: `https://query1.finance.yahoo.com/v8/finance/chart/HDFCBANK.NS?interval=1d&range=1d`
3. Check NSE: `https://www.nseindia.com/api/quote-equity?symbol=HDFCBANK` (may need cookies)
4. Check `stock_price_cache` table in Supabase — look at `fetched_at` for recent rows

## Diagnosis
| Symptom | Likely cause |
|---|---|
| Yahoo 429 / connection refused | Rate limited — back off, use in-memory cache |
| NSE returns HTML (login page) | NSE changed auth / added bot detection |
| Both Yahoo and NSE fail | Vercel outbound IP blocked or network issue |
| `fetched_at` > 5 min ago | Cache serving stale but quote fetch failing silently |

## Mitigation
1. The app automatically falls back: NSE → Yahoo → last cached value. No immediate action needed.
2. If both providers are down for >30 min during market hours:
   - Post status note: "Live price estimates temporarily unavailable. Official NAV shown."
   - The `confidence` badge already turns "Low" automatically

## Resolution
- **Yahoo blocked**: adjust `User-Agent` or add a retry with exponential backoff in `packages/providers/src/quotes/yahoo.ts`
- **NSE changed endpoint**: update URL in `packages/providers/src/quotes/nse.ts`; NSE public APIs change without notice — check GitHub issues for `yahoo-finance2` or NSE community forums
- **Rate limit**: increase Redis TTL from 60s to 120s in `apps/web/src/lib/quotes.ts`

## Post-mortem
Required for P0 only (both providers down >2 hours during market hours).
