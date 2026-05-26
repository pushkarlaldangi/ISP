/**
 * Batched live-quote fetcher.
 *
 * For each requested ticker:
 *   - Cache hit within 60s          → return cached value
 *   - In-flight upstream call       → await the existing promise (coalesce)
 *   - Otherwise                     → batch with other misses into one upstream call
 *
 * Result: even if 100 callers ask for the same ticker concurrently, we make
 * at most one upstream request per ticker per 60-second window.
 */

import type { Quote } from '@isp/core/types';
import { getQuotesProvider } from '@isp/providers';

import { cacheGet, cacheSet } from './cache';

const TTL_SECONDS = 60;
const cacheKey = (ticker: string) => `quote:${ticker}`;

interface CachedQuote {
  ticker: string;
  price: number;
  prevClose: number;
  ts: string; // ISO string — Date doesn't survive JSON round-trip without revival
}

function toCacheShape(q: Quote): CachedQuote {
  return { ticker: q.ticker, price: q.price, prevClose: q.prevClose, ts: q.ts.toISOString() };
}
function fromCacheShape(c: CachedQuote): Quote {
  return { ticker: c.ticker, price: c.price, prevClose: c.prevClose, ts: new Date(c.ts) };
}

// In-flight coalescing: ticker -> pending promise.
const inflight = new Map<string, Promise<Quote | null>>();

export async function getLiveQuotes(tickers: readonly string[]): Promise<Record<string, Quote>> {
  if (tickers.length === 0) return {};
  const unique = Array.from(new Set(tickers));

  const result: Record<string, Quote> = {};
  const need: string[] = [];
  const joining: Promise<void>[] = [];

  for (const t of unique) {
    const cached = await cacheGet<CachedQuote>(cacheKey(t));
    if (cached) {
      result[t] = fromCacheShape(cached.value);
      continue;
    }
    const pending = inflight.get(t);
    if (pending) {
      joining.push(
        pending.then((q) => {
          if (q) result[t] = q;
        }),
      );
      continue;
    }
    need.push(t);
  }

  if (need.length > 0) {
    const batch = fetchAndCache(need);
    // Register coalescing entries pointing at the same batch promise.
    for (const t of need) {
      inflight.set(
        t,
        batch.then((m) => m[t] ?? null).finally(() => inflight.delete(t)),
      );
    }
    const batched = await batch;
    for (const t of need) {
      const q = batched[t];
      if (q) result[t] = q;
    }
  }

  if (joining.length > 0) await Promise.all(joining);
  return result;
}

async function fetchAndCache(tickers: string[]): Promise<Record<string, Quote>> {
  const provider = getQuotesProvider();
  let quotes: Record<string, Quote> = {};
  try {
    quotes = await provider.fetchQuotes(tickers);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[quotes] upstream fetch failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    return {};
  }
  // Write each quote into the cache.
  await Promise.all(
    Object.values(quotes).map((q) => cacheSet(cacheKey(q.ticker), toCacheShape(q), TTL_SECONDS)),
  );
  return quotes;
}
