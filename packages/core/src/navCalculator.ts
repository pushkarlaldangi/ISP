/**
 * Live (intraday) NAV estimation.
 *
 * The official NAV is published once per day after market close. During
 * market hours we estimate today's NAV by applying the weighted return of
 * the fund's last-disclosed equity holdings to yesterday's official NAV.
 * Non-equity portions (debt, cash) are assumed flat intraday — this is
 * surfaced to the user via a confidence badge so they understand the
 * limitation.
 *
 *   estimated_NAV = official_NAV × (1 + Σ weight_i × stock_return_i)
 *
 * Pure function — no I/O. The caller supplies pre-fetched holdings and
 * quotes; this module never touches the network or DB.
 */

import type { Holding, LiveNavInputs, LiveNavResult } from './types';

const MIN_EQUITY_COVERAGE_FOR_ESTIMATE = 5; // % — below this, fallback to official
const HIGH_CONFIDENCE_THRESHOLD = 80;
const MEDIUM_CONFIDENCE_THRESHOLD = 40;

export function computeLiveNav({
  officialNav,
  officialNavDate,
  holdings,
  quotes,
}: LiveNavInputs): LiveNavResult {
  if (officialNav <= 0) {
    throw new Error('officialNav must be positive');
  }

  const equityHoldings = holdings.filter(
    (h): h is Holding & { ticker: string } => h.assetType === 'EQUITY' && h.ticker !== null,
  );

  let weightedReturn = 0;
  let equityWeightCovered = 0;
  let stalestQuoteTs: Date | null = null;

  for (const h of equityHoldings) {
    const q = quotes[h.ticker];
    if (!q || !Number.isFinite(q.price) || !Number.isFinite(q.prevClose) || q.prevClose <= 0) {
      continue;
    }
    const stockReturn = (q.price - q.prevClose) / q.prevClose;
    weightedReturn += (h.weightPct / 100) * stockReturn;
    equityWeightCovered += h.weightPct;
    if (stalestQuoteTs === null || q.ts < stalestQuoteTs) {
      stalestQuoteTs = q.ts;
    }
  }

  const isFallback = equityWeightCovered < MIN_EQUITY_COVERAGE_FOR_ESTIMATE;
  const estimatedNav = isFallback ? officialNav : officialNav * (1 + weightedReturn);
  const delta = estimatedNav - officialNav;
  const deltaPct = (delta / officialNav) * 100;

  const confidence: LiveNavResult['confidence'] =
    equityWeightCovered >= HIGH_CONFIDENCE_THRESHOLD
      ? 'high'
      : equityWeightCovered >= MEDIUM_CONFIDENCE_THRESHOLD
        ? 'medium'
        : 'low';

  return {
    estimatedNav,
    officialNav,
    officialNavDate,
    delta,
    deltaPct,
    equityCoveragePct: equityWeightCovered,
    quotesAsOf: stalestQuoteTs,
    confidence,
    isFallback,
  };
}
