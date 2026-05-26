/**
 * AMFI NAVAll.txt — authoritative free source for the Indian mutual fund
 * daily NAV snapshot.
 *
 * Format is pipe-delimited with section headers. Example:
 *
 *   Open Ended Schemes(Equity Scheme - Large Cap Fund)
 *
 *   Aditya Birla Sun Life AMC Limited
 *   Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
 *   119551;INF209K01ZL3;INF209K01ZM1;Aditya Birla...;391.7234;26-May-2026
 *
 * Header lines (no semicolons) demarcate category + AMC sections.
 */

import { parse } from 'date-fns';

import type { Fund } from '@isp/core/types';

import type { FundMasterRecord, FundsProvider } from '../types.js';
import { PermanentProviderError, TransientProviderError } from '../types.js';

const NAV_ALL_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
const HEADER_PREFIX = 'Scheme Code';

/** Map AMFI category section headers to our normalized FundCategory. */
function categorize(sectionHeader: string): Fund['category'] {
  const h = sectionHeader.toLowerCase();
  if (h.includes('equity')) return 'EQUITY';
  if (h.includes('debt') || h.includes('income') || h.includes('liquid') || h.includes('gilt'))
    return 'DEBT';
  if (h.includes('hybrid') || h.includes('balanced')) return 'HYBRID';
  if (h.includes('etf') || h.includes('exchange traded')) return 'ETF';
  if (h.includes('solution')) return 'SOLUTION';
  return 'OTHER';
}

export class AmfiFundsProvider implements FundsProvider {
  readonly name = 'amfi';

  async fetchMaster(): Promise<FundMasterRecord[]> {
    let text: string;
    try {
      const res = await fetch(NAV_ALL_URL, {
        headers: { 'User-Agent': 'isp-mutual-fund-tracker/0.0.1 (+contact)' },
      });
      if (!res.ok) {
        throw new TransientProviderError(
          this.name,
          `AMFI returned ${res.status} ${res.statusText}`,
        );
      }
      text = await res.text();
    } catch (e) {
      if (e instanceof TransientProviderError) throw e;
      throw new TransientProviderError(this.name, 'failed to fetch NAVAll.txt', e);
    }

    return parseNavAll(text);
  }

  async fetchHistory(_schemeCode: string): Promise<{ date: Date; nav: number }[]> {
    // AMFI doesn't expose history via NAVAll. Use MFAPI for history instead.
    throw new PermanentProviderError(
      this.name,
      'AMFI provider does not implement fetchHistory; use MFAPI',
    );
  }
}

/** Parse the AMFI NAVAll.txt content. Exported for unit testing. */
export function parseNavAll(text: string): FundMasterRecord[] {
  const out: FundMasterRecord[] = [];
  let currentCategory: Fund['category'] = 'OTHER';

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(HEADER_PREFIX)) continue;
    if (!line.includes(';')) {
      // Either a category header like "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
      // or an AMC name. Categories contain "Scheme"; AMC names don't.
      if (line.includes('Scheme')) {
        currentCategory = categorize(line);
      }
      continue;
    }

    const parts = line.split(';');
    if (parts.length < 6) continue;
    const [schemeCode, isinGrowth, isinDiv, schemeName, navStr, dateStr] = parts;
    if (!schemeCode || !schemeName || !navStr || !dateStr) continue;
    const nav = Number.parseFloat(navStr);
    if (!Number.isFinite(nav)) continue;
    const navDate = parse(dateStr.trim(), 'dd-MMM-yyyy', new Date());
    if (Number.isNaN(navDate.getTime())) continue;

    out.push({
      schemeCode: schemeCode.trim(),
      schemeName: schemeName.trim(),
      amcName: null,
      category: currentCategory,
      subCategory: null,
      isinGrowth: emptyToNull(isinGrowth),
      isinDiv: emptyToNull(isinDiv),
      nav,
      navDate,
    });
  }
  return out;
}

function emptyToNull(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t === '' || t === '-' ? null : t;
}
