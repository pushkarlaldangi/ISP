/**
 * Batch live NAV computation for a set of scheme codes.
 *
 * Used by the portfolio dashboard API to value all positions in one pass
 * while sharing the underlying quote batch. Calls getLiveQuotes once for
 * all tickers across all funds in the portfolio.
 */

import { computeLiveNav } from '@isp/core/nav';
import type { LiveNavResult } from '@isp/core/types';
import { getDb } from '@isp/db';

import { getLiveQuotes } from './quotes';

export async function getLiveNavForFunds(
  schemeCodes: string[],
): Promise<Record<string, LiveNavResult>> {
  if (schemeCodes.length === 0) return {};

  const db = getDb();

  // 1. Load latest official NAV + holdings for all funds in one query each
  const funds = await db.query.funds.findMany({
    where: (f, { inArray }) => inArray(f.schemeCode, schemeCodes),
    columns: {
      schemeCode: true,
      latestNav: true,
      latestNavDate: true,
    },
  });

  if (funds.length === 0) return {};

  const holdingsRows = await db.query.holdings.findMany({
    where: (h, { inArray }) => inArray(h.schemeCode, schemeCodes),
    columns: {
      schemeCode: true,
      ticker: true,
      assetType: true,
      weightPct: true,
      asOfDate: true,
      instrument: true,
      isin: true,
      marketValue: true,
      quantity: true,
    },
  });

  // 2. Collect all unique equity tickers across all funds
  const allTickers = [
    ...new Set(
      holdingsRows.filter((h) => h.assetType === 'EQUITY' && h.ticker).map((h) => h.ticker!),
    ),
  ];

  // 3. Single batch quote fetch for all tickers
  const quotes = allTickers.length > 0 ? await getLiveQuotes(allTickers) : {};

  // 4. Compute live NAV per fund
  const result: Record<string, LiveNavResult> = {};
  for (const fund of funds) {
    const holdings = holdingsRows
      .filter((h) => h.schemeCode === fund.schemeCode)
      .map((h) => ({
        schemeCode: h.schemeCode,
        asOfDate: new Date(h.asOfDate),
        instrument: h.instrument,
        ticker: h.ticker,
        isin: h.isin,
        assetType: h.assetType as 'EQUITY' | 'DEBT' | 'CASH' | 'OTHER',
        weightPct: Number(h.weightPct ?? 0),
        marketValue: h.marketValue !== null ? Number(h.marketValue) : null,
        quantity: h.quantity !== null ? Number(h.quantity) : null,
      }));

    const officialNav = Number(fund.latestNav);
    const officialNavDate = new Date(fund.latestNavDate ?? new Date());

    result[fund.schemeCode] = computeLiveNav({
      officialNav,
      officialNavDate,
      holdings,
      quotes,
    });
  }

  return result;
}
