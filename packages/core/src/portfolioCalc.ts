/**
 * Portfolio aggregation, P&L, and XIRR.
 *
 * Inputs are pre-fetched (transactions + per-fund live NAVs + previous-day
 * official NAVs). All math is pure and synchronous so it can run on the
 * server or in a worker, and is trivially unit-testable.
 */

import xirrLib from 'xirr';

import type {
  LiveNavResult,
  PortfolioSummary,
  Position,
  PositionValuation,
  Transaction,
} from './types';

/**
 * Aggregate a flat list of transactions into per-fund positions.
 *
 * Sell semantics: realized P&L is recognized FIFO. We don't currently
 * track tax-lot detail in this aggregator (taxCalc handles that); here
 * we only need realized totals to keep the average-cost basis correct
 * for the remaining open units.
 */
export function aggregateTransactions(txns: Transaction[]): Position[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = groups.get(t.schemeCode);
    if (list) {
      list.push(t);
    } else {
      groups.set(t.schemeCode, [t]);
    }
  }

  const positions: Position[] = [];
  for (const [schemeCode, scheme] of groups) {
    // FIFO queue of acquisitions remaining open.
    const lots: { units: number; navAtTxn: number }[] = [];
    let realized = 0;
    const sorted = [...scheme].sort((a, b) => a.txnDate.getTime() - b.txnDate.getTime());

    for (const t of sorted) {
      if (isAcquisition(t.txnType)) {
        lots.push({ units: t.units, navAtTxn: t.navAtTxn });
      } else if (isDisposal(t.txnType)) {
        let unitsToSell = t.units;
        while (unitsToSell > 0 && lots.length > 0) {
          const lot = lots[0]!;
          const consumed = Math.min(lot.units, unitsToSell);
          realized += consumed * (t.navAtTxn - lot.navAtTxn);
          lot.units -= consumed;
          unitsToSell -= consumed;
          if (lot.units <= 1e-9) {
            lots.shift();
          }
        }
        // If unitsToSell > 0 here, the user oversold — we still account for
        // the realized P&L at zero basis (matches no acquired lot). In
        // practice the input layer should validate against oversell.
        if (unitsToSell > 1e-9) {
          realized += unitsToSell * t.navAtTxn;
        }
      }
      // DIVIDEND: treat payout as realized gain, no unit change.
      if (t.txnType === 'DIVIDEND') {
        realized += t.amount;
      }
    }

    const totalUnits = lots.reduce((acc, l) => acc + l.units, 0);
    const totalInvested = lots.reduce((acc, l) => acc + l.units * l.navAtTxn, 0);
    const avgCostNav = totalUnits > 0 ? totalInvested / totalUnits : 0;

    if (totalUnits > 1e-9 || realized !== 0) {
      positions.push({
        schemeCode,
        totalUnits,
        totalInvested,
        realizedPnl: realized,
        avgCostNav,
      });
    }
  }
  return positions;
}

function isAcquisition(t: Transaction['txnType']): boolean {
  return t === 'BUY' || t === 'SIP' || t === 'SWITCH_IN';
}

function isDisposal(t: Transaction['txnType']): boolean {
  return t === 'SELL' || t === 'SWITCH_OUT';
}

/**
 * Apply current live NAVs and yesterday's official NAVs to a list of
 * positions to derive current value, unrealized P&L, and day-change.
 */
export function valuePositions(
  positions: Position[],
  navByScheme: Record<string, LiveNavResult>,
): PositionValuation[] {
  const out: PositionValuation[] = [];
  for (const p of positions) {
    if (p.totalUnits <= 1e-9) continue;
    const nav = navByScheme[p.schemeCode];
    if (!nav) {
      // No live NAV → skip; UI will show "valuation unavailable" for this row.
      continue;
    }
    const currentValue = p.totalUnits * nav.estimatedNav;
    const unrealizedPnl = currentValue - p.totalInvested;
    const pnlPct = p.totalInvested > 0 ? (unrealizedPnl / p.totalInvested) * 100 : 0;
    const dayChangeAbs = p.totalUnits * (nav.estimatedNav - nav.officialNav);
    const dayChangeBase = p.totalUnits * nav.officialNav;
    const dayChangePct = dayChangeBase > 0 ? (dayChangeAbs / dayChangeBase) * 100 : 0;

    out.push({
      ...p,
      liveNav: nav.estimatedNav,
      officialNav: nav.officialNav,
      currentValue,
      unrealizedPnl,
      pnlPct,
      dayChangeAbs,
      dayChangePct,
      confidence: nav.confidence,
    });
  }
  return out;
}

/**
 * Compute portfolio-level XIRR.
 *
 * Cash-flow convention (xirr library):
 *   - acquisitions are NEGATIVE (money out)
 *   - disposals + current value are POSITIVE (money in)
 * Returns the annualized rate as a decimal (0.12 = 12%).
 *
 * Returns null when XIRR cannot converge (e.g. all flows same sign, all on
 * the same date, etc.). The UI falls back to a simple absolute-return %
 * display in those cases.
 */
export function computePortfolioXirr(
  txns: Transaction[],
  currentValue: number,
  valuationDate: Date,
): number | null {
  const flows: { amount: number; when: Date }[] = [];
  for (const t of txns) {
    if (isAcquisition(t.txnType)) {
      flows.push({ amount: -t.amount, when: t.txnDate });
    } else if (isDisposal(t.txnType)) {
      flows.push({ amount: t.amount, when: t.txnDate });
    } else if (t.txnType === 'DIVIDEND') {
      flows.push({ amount: t.amount, when: t.txnDate });
    }
  }
  if (currentValue > 0) {
    flows.push({ amount: currentValue, when: valuationDate });
  }
  if (flows.length < 2) return null;
  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  try {
    return xirrLib(flows);
  } catch {
    return null;
  }
}

/** Build the full portfolio summary (KPIs + positions). */
export function summarizePortfolio(
  txns: Transaction[],
  navByScheme: Record<string, LiveNavResult>,
  valuationDate: Date,
): PortfolioSummary {
  const positions = aggregateTransactions(txns);
  const valuations = valuePositions(positions, navByScheme);

  const totalInvested = positions.reduce((acc, p) => acc + p.totalInvested, 0);
  const totalValue = valuations.reduce((acc, v) => acc + v.currentValue, 0);
  const totalPnlAbs = totalValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnlAbs / totalInvested) * 100 : 0;
  const dayChangeAbs = valuations.reduce((acc, v) => acc + v.dayChangeAbs, 0);
  const prevValue = totalValue - dayChangeAbs;
  const dayChangePct = prevValue > 0 ? (dayChangeAbs / prevValue) * 100 : 0;
  const xirr = computePortfolioXirr(txns, totalValue, valuationDate);

  return {
    totalInvested,
    totalValue,
    totalPnlAbs,
    totalPnlPct,
    dayChangeAbs,
    dayChangePct,
    xirr,
    positions: valuations,
  };
}
