import type { QuotesProvider } from '../types.js';

import { YahooQuotesProvider } from './yahoo.js';

export { YahooQuotesProvider } from './yahoo.js';

/**
 * Default quotes facade. Phase 3 will add an NSE adapter and chain
 * primary→fallback here; for Phase 0/1 we keep Yahoo only.
 */
export function getQuotesProvider(): QuotesProvider {
  return new YahooQuotesProvider();
}
