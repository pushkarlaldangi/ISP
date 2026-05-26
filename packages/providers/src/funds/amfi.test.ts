import { describe, expect, it } from 'vitest';

import { parseNavAll } from './amfi.js';

const SAMPLE = `
Open Ended Schemes(Equity Scheme - Large Cap Fund)

Aditya Birla Sun Life Mutual Fund

Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
119551;INF209K01ZL3;INF209K01ZM1;Aditya Birla Sun Life Frontline Equity Fund - Growth;391.7234;26-May-2026
119552;-;INF209K01ZN9;Aditya Birla Sun Life Frontline Equity Fund - IDCW;120.5500;26-May-2026

Open Ended Schemes(Debt Scheme - Liquid Fund)

HDFC Mutual Fund

Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
118989;INF179K01YV8;-;HDFC Liquid Fund - Growth;4567.8900;26-May-2026
`;

describe('parseNavAll', () => {
  it('extracts scheme rows', () => {
    const out = parseNavAll(SAMPLE);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      schemeCode: '119551',
      schemeName: 'Aditya Birla Sun Life Frontline Equity Fund - Growth',
      isinGrowth: 'INF209K01ZL3',
      isinDiv: 'INF209K01ZM1',
      nav: 391.7234,
      category: 'EQUITY',
    });
  });

  it('categorizes debt schemes', () => {
    const out = parseNavAll(SAMPLE);
    const hdfc = out.find((f) => f.schemeCode === '118989');
    expect(hdfc?.category).toBe('DEBT');
  });

  it('normalizes empty ISIN values to null', () => {
    const out = parseNavAll(SAMPLE);
    expect(out[1]!.isinGrowth).toBeNull(); // was "-"
    expect(out[2]!.isinDiv).toBeNull();
  });

  it('skips rows with invalid NAV', () => {
    const bad = `
Open Ended Schemes(Equity)
Some AMC
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
12345;ISIN1;ISIN2;Good Fund;100.50;26-May-2026
67890;ISIN3;ISIN4;Bad Fund;N/A;26-May-2026
`;
    const out = parseNavAll(bad);
    expect(out).toHaveLength(1);
    expect(out[0]!.schemeCode).toBe('12345');
  });
});
