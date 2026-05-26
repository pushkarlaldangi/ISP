import { describe, expect, it } from 'vitest';

import { computeLiveNav } from './navCalculator.js';
import type { Holding, Quote } from './types.js';

const yesterday = new Date('2026-05-25T15:30:00+05:30');
const now = new Date('2026-05-26T13:00:00+05:30');

const holding = (overrides: Partial<Holding>): Holding => ({
  schemeCode: '123456',
  asOfDate: new Date('2026-04-30'),
  instrument: 'Test Co',
  ticker: 'TEST',
  isin: null,
  assetType: 'EQUITY',
  weightPct: 0,
  marketValue: null,
  quantity: null,
  ...overrides,
});

const quote = (ticker: string, price: number, prevClose: number): Quote => ({
  ticker,
  price,
  prevClose,
  ts: now,
});

describe('computeLiveNav', () => {
  it('returns officialNav when no equity holdings provided', () => {
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings: [],
      quotes: {},
    });
    expect(r.estimatedNav).toBe(100);
    expect(r.isFallback).toBe(true);
    expect(r.confidence).toBe('low');
    expect(r.equityCoveragePct).toBe(0);
    expect(r.quotesAsOf).toBeNull();
  });

  it('applies weighted equity return to official NAV', () => {
    const holdings = [
      holding({ ticker: 'A', weightPct: 60 }), // +2%
      holding({ ticker: 'B', weightPct: 40 }), // -1%
    ];
    const quotes = {
      A: quote('A', 102, 100), // +2%
      B: quote('B', 99, 100), // -1%
    };
    const r = computeLiveNav({
      officialNav: 50,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    // 0.6 * 0.02 + 0.4 * -0.01 = 0.012 - 0.004 = 0.008
    expect(r.estimatedNav).toBeCloseTo(50 * 1.008, 6);
    expect(r.delta).toBeCloseTo(0.4, 6);
    expect(r.deltaPct).toBeCloseTo(0.8, 6);
    expect(r.equityCoveragePct).toBe(100);
    expect(r.confidence).toBe('high');
    expect(r.isFallback).toBe(false);
  });

  it('treats missing quotes as zero contribution (does not include weight in coverage)', () => {
    const holdings = [
      holding({ ticker: 'A', weightPct: 50 }),
      holding({ ticker: 'B', weightPct: 50 }),
    ];
    const quotes = { A: quote('A', 110, 100) }; // B missing
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    // Only A contributes: 0.5 * 10% = 5%
    expect(r.estimatedNav).toBeCloseTo(105, 6);
    expect(r.equityCoveragePct).toBe(50);
    expect(r.confidence).toBe('medium');
  });

  it('ignores non-equity holdings (assumes flat intraday)', () => {
    const holdings = [
      holding({ ticker: 'A', weightPct: 30 }), // equity
      holding({ ticker: null, assetType: 'DEBT', weightPct: 60 }),
      holding({ ticker: null, assetType: 'CASH', weightPct: 10 }),
    ];
    const quotes = { A: quote('A', 110, 100) };
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    // Only A's +10% × 30% weight = +3%
    expect(r.estimatedNav).toBeCloseTo(103, 6);
    expect(r.equityCoveragePct).toBe(30);
    expect(r.confidence).toBe('low');
  });

  it('falls back to official NAV when equity coverage is below threshold', () => {
    const holdings = [holding({ ticker: 'A', weightPct: 2 })];
    const quotes = { A: quote('A', 200, 100) }; // +100% would be huge
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    expect(r.isFallback).toBe(true);
    expect(r.estimatedNav).toBe(100);
  });

  it('reports stalest quote timestamp', () => {
    const tA = new Date('2026-05-26T12:55:00+05:30');
    const tB = new Date('2026-05-26T12:50:00+05:30'); // older
    const holdings = [
      holding({ ticker: 'A', weightPct: 50 }),
      holding({ ticker: 'B', weightPct: 50 }),
    ];
    const quotes = {
      A: { ticker: 'A', price: 100, prevClose: 100, ts: tA },
      B: { ticker: 'B', price: 100, prevClose: 100, ts: tB },
    };
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    expect(r.quotesAsOf).toEqual(tB);
  });

  it('skips quotes with zero or negative prevClose', () => {
    const holdings = [holding({ ticker: 'A', weightPct: 90 })];
    const quotes = { A: quote('A', 50, 0) };
    const r = computeLiveNav({
      officialNav: 100,
      officialNavDate: yesterday,
      holdings,
      quotes,
    });
    expect(r.estimatedNav).toBe(100); // skipped → fallback
    expect(r.equityCoveragePct).toBe(0);
    expect(r.isFallback).toBe(true);
  });

  it('throws on non-positive officialNav', () => {
    expect(() =>
      computeLiveNav({
        officialNav: 0,
        officialNavDate: yesterday,
        holdings: [],
        quotes: {},
      }),
    ).toThrow();
    expect(() =>
      computeLiveNav({
        officialNav: -1,
        officialNavDate: yesterday,
        holdings: [],
        quotes: {},
      }),
    ).toThrow();
  });
});
