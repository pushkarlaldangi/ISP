/**
 * Yahoo Finance quotes via the unofficial yahoo-finance2 npm package.
 * - NSE tickers use the ".NS" suffix
 * - BSE tickers use ".BO"
 */

import yahooFinance from 'yahoo-finance2';

import type { Quote } from '@isp/core/types';

import type { QuotesProvider } from '../types.js';
import { TransientProviderError } from '../types.js';

export class YahooQuotesProvider implements QuotesProvider {
  readonly name = 'yahoo';

  async fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
    if (tickers.length === 0) return {};
    const symbols = tickers.map((t) => (t.includes('.') ? t : `${t}.NS`));
    let results;
    try {
      // yahoo-finance2 supports a batch quote call.
      results = await yahooFinance.quote(symbols, {}, { validateResult: false });
    } catch (e) {
      throw new TransientProviderError(this.name, 'failed to fetch Yahoo quotes', e);
    }
    const list = Array.isArray(results) ? results : [results];

    const out: Record<string, Quote> = {};
    for (const r of list) {
      if (!r) continue;
      const symbol = r.symbol;
      if (typeof symbol !== 'string') continue;
      const ticker = symbol.replace(/\.(NS|BO)$/, '');
      const price = typeof r.regularMarketPrice === 'number' ? r.regularMarketPrice : Number.NaN;
      const prevClose =
        typeof r.regularMarketPreviousClose === 'number'
          ? r.regularMarketPreviousClose
          : Number.NaN;
      if (!Number.isFinite(price) || !Number.isFinite(prevClose)) continue;
      const ts =
        typeof r.regularMarketTime === 'object' && r.regularMarketTime instanceof Date
          ? r.regularMarketTime
          : new Date();
      out[ticker] = { ticker, price, prevClose, ts };
    }
    return out;
  }
}
