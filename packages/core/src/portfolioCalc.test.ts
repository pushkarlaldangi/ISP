import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  aggregateTransactions,
  computePortfolioXirr,
  summarizePortfolio,
  valuePositions,
} from './portfolioCalc';
import type { LiveNavResult, Transaction } from './types';

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: randomUUID(),
  portfolioId: 'p1',
  schemeCode: 'F1',
  txnType: 'BUY',
  txnDate: new Date('2025-01-01'),
  units: 0,
  navAtTxn: 0,
  amount: 0,
  ...overrides,
});

const navResult = (overrides: Partial<LiveNavResult>): LiveNavResult => ({
  estimatedNav: 110,
  officialNav: 100,
  officialNavDate: new Date('2026-05-25'),
  delta: 10,
  deltaPct: 10,
  equityCoveragePct: 95,
  quotesAsOf: new Date(),
  confidence: 'high',
  isFallback: false,
  ...overrides,
});

describe('aggregateTransactions', () => {
  it('returns empty for no transactions', () => {
    expect(aggregateTransactions([])).toEqual([]);
  });

  it('aggregates two BUYs into a single position with weighted avg cost', () => {
    const ps = aggregateTransactions([
      txn({ units: 100, navAtTxn: 10, amount: 1000, txnDate: new Date('2025-01-01') }),
      txn({ units: 100, navAtTxn: 20, amount: 2000, txnDate: new Date('2025-02-01') }),
    ]);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.totalUnits).toBe(200);
    expect(ps[0]!.totalInvested).toBe(3000);
    expect(ps[0]!.avgCostNav).toBe(15);
    expect(ps[0]!.realizedPnl).toBe(0);
  });

  it('handles SIP as acquisition', () => {
    const ps = aggregateTransactions([
      txn({ txnType: 'SIP', units: 50, navAtTxn: 20, amount: 1000 }),
    ]);
    expect(ps[0]!.totalUnits).toBe(50);
    expect(ps[0]!.totalInvested).toBe(1000);
  });

  it('realizes FIFO gain on partial sell', () => {
    const ps = aggregateTransactions([
      txn({ units: 100, navAtTxn: 10, amount: 1000, txnDate: new Date('2025-01-01') }),
      txn({ units: 100, navAtTxn: 20, amount: 2000, txnDate: new Date('2025-02-01') }),
      txn({
        txnType: 'SELL',
        units: 50,
        navAtTxn: 30,
        amount: 1500,
        txnDate: new Date('2025-03-01'),
      }),
    ]);
    // FIFO: sells 50 units from the ₹10 lot at ₹30 → realized = 50 * (30-10) = 1000
    expect(ps[0]!.realizedPnl).toBe(1000);
    // Remaining: 50 units @ ₹10 + 100 units @ ₹20 → 150 units, invested ₹2500
    expect(ps[0]!.totalUnits).toBe(150);
    expect(ps[0]!.totalInvested).toBe(2500);
    expect(ps[0]!.avgCostNav).toBeCloseTo(2500 / 150, 6);
  });

  it('groups transactions by scheme code', () => {
    const ps = aggregateTransactions([
      txn({ schemeCode: 'F1', units: 10, navAtTxn: 100, amount: 1000 }),
      txn({ schemeCode: 'F2', units: 20, navAtTxn: 50, amount: 1000 }),
    ]);
    expect(ps).toHaveLength(2);
  });

  it('treats DIVIDEND as realized P&L with no unit change', () => {
    const ps = aggregateTransactions([
      txn({ units: 100, navAtTxn: 10, amount: 1000 }),
      txn({ txnType: 'DIVIDEND', units: 0, navAtTxn: 0, amount: 50 }),
    ]);
    expect(ps[0]!.totalUnits).toBe(100);
    expect(ps[0]!.realizedPnl).toBe(50);
  });
});

describe('valuePositions', () => {
  it('computes current value, unrealized P&L, and day change', () => {
    const positions = aggregateTransactions([txn({ units: 100, navAtTxn: 50, amount: 5000 })]);
    const vals = valuePositions(positions, { F1: navResult({}) });
    expect(vals).toHaveLength(1);
    expect(vals[0]!.currentValue).toBe(100 * 110);
    expect(vals[0]!.unrealizedPnl).toBe(11000 - 5000);
    expect(vals[0]!.pnlPct).toBeCloseTo(120, 6);
    expect(vals[0]!.dayChangeAbs).toBe(100 * 10);
  });

  it('skips positions with no NAV data', () => {
    const positions = aggregateTransactions([
      txn({ schemeCode: 'F1', units: 100, navAtTxn: 50, amount: 5000 }),
      txn({ schemeCode: 'F2', units: 50, navAtTxn: 20, amount: 1000 }),
    ]);
    const vals = valuePositions(positions, { F1: navResult({}) });
    expect(vals).toHaveLength(1);
    expect(vals[0]!.schemeCode).toBe('F1');
  });
});

describe('computePortfolioXirr', () => {
  it('returns null when there are not enough flows', () => {
    expect(computePortfolioXirr([], 0, new Date())).toBeNull();
  });

  it('returns null when all flows are the same sign', () => {
    const txns = [txn({ units: 100, navAtTxn: 50, amount: 5000 })];
    // No positive flow because current value is 0
    expect(computePortfolioXirr(txns, 0, new Date())).toBeNull();
  });

  it('approximates 10% annualized for a ₹100k buy a year ago now worth ₹110k', () => {
    const buyDate = new Date('2025-05-26');
    const valuationDate = new Date('2026-05-26');
    const txns = [
      txn({
        units: 1000,
        navAtTxn: 100,
        amount: 100000,
        txnDate: buyDate,
      }),
    ];
    const xirr = computePortfolioXirr(txns, 110000, valuationDate);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeCloseTo(0.1, 2);
  });
});

describe('summarizePortfolio', () => {
  it('rolls up totals across positions', () => {
    const txns = [
      txn({ schemeCode: 'F1', units: 100, navAtTxn: 50, amount: 5000 }),
      txn({ schemeCode: 'F2', units: 200, navAtTxn: 25, amount: 5000 }),
    ];
    const navs: Record<string, LiveNavResult> = {
      F1: navResult({ estimatedNav: 60, officialNav: 55 }),
      F2: navResult({ estimatedNav: 30, officialNav: 28 }),
    };
    const sum = summarizePortfolio(txns, navs, new Date());
    expect(sum.totalInvested).toBe(10000);
    expect(sum.totalValue).toBe(100 * 60 + 200 * 30); // 6000 + 6000
    expect(sum.totalPnlAbs).toBe(2000);
    expect(sum.totalPnlPct).toBeCloseTo(20, 6);
    expect(sum.positions).toHaveLength(2);
  });
});
