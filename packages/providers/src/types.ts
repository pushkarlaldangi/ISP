/**
 * Provider interface boundaries.
 *
 * Each data source (AMFI, MFAPI, NSE, Yahoo) implements one of these
 * interfaces. The facade picks the primary and falls back on failure or
 * staleness. Business logic depends only on these interfaces, not on
 * any specific source.
 */

import type { Fund, Quote } from '@isp/core/types';

export interface FundMasterRecord {
  schemeCode: string;
  schemeName: string;
  amcName: string | null;
  category: Fund['category'];
  subCategory: string | null;
  isinGrowth: string | null;
  isinDiv: string | null;
  nav: number;
  navDate: Date;
}

export interface FundsProvider {
  readonly name: string;
  /** Fetch the full fund master list with today's NAV. */
  fetchMaster(): Promise<FundMasterRecord[]>;
  /** Fetch historical NAV for a single scheme. */
  fetchHistory(schemeCode: string): Promise<{ date: Date; nav: number }[]>;
}

export interface QuotesProvider {
  readonly name: string;
  /** Fetch live quotes for a batch of NSE tickers (without .NS suffix). */
  fetchQuotes(tickers: string[]): Promise<Record<string, Quote>>;
}

export interface ProviderError extends Error {
  provider: string;
  retryable: boolean;
}

export class TransientProviderError extends Error implements ProviderError {
  override name = 'TransientProviderError';
  retryable = true as const;
  constructor(
    public provider: string,
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
  }
}

export class PermanentProviderError extends Error implements ProviderError {
  override name = 'PermanentProviderError';
  retryable = false as const;
  constructor(
    public provider: string,
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
  }
}
