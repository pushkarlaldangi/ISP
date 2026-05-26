/**
 * Yahoo Finance quotes via the public /v8/finance/chart endpoint.
 *
 * Why not the `yahoo-finance2` package? Its batch quote endpoint requires
 * a crumb + cookie auth flow that's heavily rate-limited from server IPs,
 * and it doesn't URL-encode `&` in symbols like `M&M.NS`. The /v8/chart
 * endpoint is keyless, per-ticker (we parallelize ourselves), works
 * reliably from server environments, and returns both the latest price
 * and the previous close in one call.
 *
 * Trade-off: one HTTP request per ticker instead of one for the batch.
 * Mitigated by our 60s cache + request coalescing in lib/quotes.ts, so
 * even with many holdings we only hit upstream once per ticker per minute.
 */

import type { Quote } from '@isp/core/types';

import type { QuotesProvider } from '../types';
import { TransientProviderError } from '../types';

const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const CONCURRENCY = 6;
const TIMEOUT_MS = 8000;

export class YahooQuotesProvider implements QuotesProvider {
  readonly name = 'yahoo';

  async fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
    if (tickers.length === 0) return {};
    const symbols = tickers.map((t) => (t.includes('.') ? t : `${t}.NS`));

    const results: Record<string, Quote> = {};
    let firstError: unknown;

    const queue = [...symbols];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const symbol = queue.shift();
        if (!symbol) break;
        try {
          const q = await fetchOne(symbol);
          if (q) {
            const ticker = symbol.replace(/\.(NS|BO)$/, '');
            results[ticker] = q;
          }
        } catch (e) {
          if (!firstError) firstError = e;
        }
      }
    });
    await Promise.all(workers);

    if (Object.keys(results).length === 0 && firstError) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      throw new TransientProviderError(
        'yahoo',
        `failed to fetch any Yahoo quotes for [${tickers.join(',')}]: ${msg}`,
        firstError,
      );
    }
    return results;
  }
}

async function fetchOne(symbol: string): Promise<Quote | null> {
  const url = `${CHART_URL}${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo blocks empty UAs; this one passes their server-side checks.
        'User-Agent': 'Mozilla/5.0 (compatible; isp-mutual-fund-tracker/0.0.1; +contact@local)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    if (!result?.meta) return null;
    const meta = result.meta;
    const price = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    const prevClose = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : null;
    if (price === null || prevClose === null) return null;
    const ts =
      typeof meta.regularMarketTime === 'number'
        ? new Date(meta.regularMarketTime * 1000)
        : new Date();
    const ticker = (meta.symbol ?? symbol).replace(/\.(NS|BO)$/, '');
    return { ticker, price, prevClose, ts };
  } finally {
    clearTimeout(t);
  }
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}
