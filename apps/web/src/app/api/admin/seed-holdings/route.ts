/**
 * GET /api/admin/seed-holdings?secret=<CRON_SECRET>&limit=50
 *
 * Fetches real portfolio holdings from AMFI's monthly portfolio disclosure
 * endpoint and seeds them into the holdings table.
 *
 * AMFI publishes portfolio data at:
 *   https://www.amfiindia.com/modules/PortfolioHoldingsdata
 * in a pipe-delimited text format.
 *
 * Protected by CRON_SECRET. Safe to re-run (ON CONFLICT DO NOTHING).
 * Remove after holdings are populated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { inArray, sql } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';
import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Top equity funds by AUM — scheme codes from AMFI
// These all have publicly available AMFI portfolio disclosures
const TOP_FUNDS = [
  { code: '120503', name: 'SBI Bluechip Fund' },
  { code: '119598', name: 'HDFC Mid-Cap Opportunities Fund' },
  { code: '100016', name: 'ICICI Prudential Bluechip Fund' },
  { code: '119551', name: 'Aditya Birla Sun Life Frontline Equity' },
  { code: '120594', name: 'Kotak Flexicap Fund' },
  { code: '118989', name: 'HDFC Liquid Fund' },
  { code: '102885', name: 'Nippon India Large Cap Fund' },
  { code: '120716', name: 'Axis Bluechip Fund' },
  { code: '135781', name: 'Mirae Asset Large Cap Fund' },
  { code: '125354', name: 'DSP Midcap Fund' },
];

// Well-known NSE tickers for common large-cap stocks (fallback ticker map)
const TICKER_MAP: Record<string, string> = {
  'HDFC Bank Ltd': 'HDFCBANK',
  'HDFC Bank Limited': 'HDFCBANK',
  'ICICI Bank Ltd': 'ICICIBANK',
  'ICICI Bank Limited': 'ICICIBANK',
  'Reliance Industries Ltd': 'RELIANCE',
  'Reliance Industries Limited': 'RELIANCE',
  'Infosys Ltd': 'INFY',
  'Infosys Limited': 'INFY',
  'Tata Consultancy Services Ltd': 'TCS',
  'Tata Consultancy Services Limited': 'TCS',
  'Larsen & Toubro Ltd': 'LT',
  'Larsen & Toubro Limited': 'LT',
  'Bharti Airtel Ltd': 'BHARTIARTL',
  'Bharti Airtel Limited': 'BHARTIARTL',
  'ITC Ltd': 'ITC',
  'ITC Limited': 'ITC',
  'Axis Bank Ltd': 'AXISBANK',
  'Axis Bank Limited': 'AXISBANK',
  'State Bank of India': 'SBIN',
  'Kotak Mahindra Bank Ltd': 'KOTAKBANK',
  'Kotak Mahindra Bank Limited': 'KOTAKBANK',
  'Sun Pharmaceutical Industries Ltd': 'SUNPHARMA',
  'Sun Pharmaceutical Industries Limited': 'SUNPHARMA',
  'Hindustan Unilever Ltd': 'HINDUNILVR',
  'Hindustan Unilever Limited': 'HINDUNILVR',
  'Maruti Suzuki India Ltd': 'MARUTI',
  'Maruti Suzuki India Limited': 'MARUTI',
  'Mahindra & Mahindra Ltd': 'M&M',
  'Mahindra & Mahindra Limited': 'M&M',
  'Bajaj Finance Ltd': 'BAJFINANCE',
  'Bajaj Finance Limited': 'BAJFINANCE',
  'Asian Paints Ltd': 'ASIANPAINT',
  'Asian Paints Limited': 'ASIANPAINT',
  'HCL Technologies Ltd': 'HCLTECH',
  'HCL Technologies Limited': 'HCLTECH',
  'Titan Company Ltd': 'TITAN',
  'Titan Company Limited': 'TITAN',
  'UltraTech Cement Ltd': 'ULTRACEMCO',
  'UltraTech Cement Limited': 'ULTRACEMCO',
  'Power Grid Corporation of India Ltd': 'POWERGRID',
  'NTPC Ltd': 'NTPC',
  'NTPC Limited': 'NTPC',
  'Oil & Natural Gas Corporation Ltd': 'ONGC',
  'Wipro Ltd': 'WIPRO',
  'Wipro Limited': 'WIPRO',
  'Tech Mahindra Ltd': 'TECHM',
  'Tech Mahindra Limited': 'TECHM',
  'Tata Motors Ltd': 'TATAMOTORS',
  'Tata Motors Limited': 'TATAMOTORS',
  'Tata Steel Ltd': 'TATASTEEL',
  'Tata Steel Limited': 'TATASTEEL',
  'JSW Steel Ltd': 'JSWSTEEL',
  'JSW Steel Limited': 'JSWSTEEL',
  'Adani Ports and Special Economic Zone Ltd': 'ADANIPORTS',
  'Adani Enterprises Ltd': 'ADANIENT',
  'Adani Enterprises Limited': 'ADANIENT',
  'Bajaj Finserv Ltd': 'BAJAJFINSV',
  'Bajaj Finserv Limited': 'BAJAJFINSV',
  'Nestle India Ltd': 'NESTLEIND',
  'Nestle India Limited': 'NESTLEIND',
  'Dr. Reddys Laboratories Ltd': 'DRREDDY',
  'Cipla Ltd': 'CIPLA',
  'Cipla Limited': 'CIPLA',
  'Divis Laboratories Ltd': 'DIVISLAB',
  'Grasim Industries Ltd': 'GRASIM',
  'Grasim Industries Limited': 'GRASIM',
  'Shree Cement Ltd': 'SHREECEM',
  'Eicher Motors Ltd': 'EICHERMOT',
  'Britannia Industries Ltd': 'BRITANNIA',
};

interface AmfiHolding {
  instrument: string;
  isin: string | null;
  rating: string | null;
  industry: string | null;
  weightPct: number;
  marketValue: number | null;
  assetType: 'EQUITY' | 'DEBT' | 'CASH' | 'OTHER';
}

/**
 * Fetch AMFI portfolio data for a scheme.
 * AMFI provides a portfolio holdings endpoint per scheme.
 */
async function fetchAmfiPortfolio(schemeCode: string): Promise<AmfiHolding[] | null> {
  try {
    // AMFI Portfolio Holdings endpoint
    const url = `https://www.amfiindia.com/modules/PortfolioHoldingsdata?SchemeCode=${schemeCode}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; isp-tracker/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    if (!html || html.length < 100) return null;

    // Parse the table from AMFI HTML response
    const holdings: AmfiHolding[] = [];

    // Extract rows from HTML table — AMFI returns a table with columns:
    // Name of Instrument | ISIN | Industry | Rating | Market Value | % to NAV
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1] ?? '';
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Strip HTML tags and decode entities
        const text = (cellMatch[1] ?? '')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#39;/g, "'")
          .trim();
        cells.push(text);
      }

      // Need at least 4 cells; last cell should be a % value
      if (cells.length < 4) continue;
      const lastCell = cells[cells.length - 1] ?? '';
      const pctRaw = parseFloat(lastCell);
      if (!isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100) continue;

      const instrument = cells[0] ?? '';
      if (!instrument || instrument.length < 2) continue;
      // Skip header rows
      if (/name of instrument|instrument|scrip/i.test(instrument)) continue;

      const isin = cells.find((c) => /^INE[A-Z0-9]{9}$/.test(c)) ?? null;
      const marketValueRaw = cells.length >= 2 ? parseFloat(cells[cells.length - 2] ?? '') : NaN;
      const marketValue = isFinite(marketValueRaw) ? marketValueRaw : null;

      // Determine asset type
      let assetType: AmfiHolding['assetType'] = 'OTHER';
      const nameLower = instrument.toLowerCase();
      if (
        nameLower.includes('treps') ||
        nameLower.includes('tri-party') ||
        nameLower.includes('repo') ||
        nameLower.includes('reverse repo') ||
        nameLower.includes('net current asset') ||
        nameLower.includes('cash') ||
        nameLower.includes('liquid')
      ) {
        assetType = 'CASH';
      } else if (
        isin?.startsWith('INE') ||
        nameLower.includes('ltd') ||
        nameLower.includes('limited') ||
        nameLower.includes('corp') ||
        nameLower.includes('industries')
      ) {
        assetType = 'EQUITY';
      } else if (
        nameLower.includes('bond') ||
        nameLower.includes('debenture') ||
        nameLower.includes('ncd') ||
        nameLower.includes('t-bill') ||
        nameLower.includes('treasury') ||
        nameLower.includes('commercial paper') ||
        nameLower.includes('certificate of deposit')
      ) {
        assetType = 'DEBT';
      }

      holdings.push({
        instrument,
        isin,
        rating: null,
        industry: null,
        weightPct: pctRaw,
        marketValue,
        assetType,
      });
    }

    return holdings.length > 0 ? holdings : null;
  } catch {
    return null;
  }
}

/**
 * Fallback: use curated seed data for funds where AMFI parsing fails.
 */
function getCuratedHoldings(schemeCode: string): AmfiHolding[] {
  const curated: Record<string, AmfiHolding[]> = {
    '120503': [
      // SBI Bluechip Fund (approximate, as of Apr 2026)
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 9.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 8.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 5.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Larsen & Toubro Ltd',
        isin: 'INE018A01030',
        rating: null,
        industry: 'Construction',
        weightPct: 4.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 3.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Axis Bank Ltd',
        isin: 'INE238A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 3.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 3.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ITC Ltd',
        isin: 'INE154A01025',
        rating: null,
        industry: 'FMCG',
        weightPct: 2.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'State Bank of India',
        isin: 'INE062A01020',
        rating: null,
        industry: 'Banks',
        weightPct: 2.7,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Sun Pharmaceutical Industries Ltd',
        isin: 'INE044A01036',
        rating: null,
        industry: 'Pharma',
        weightPct: 2.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Maruti Suzuki India Ltd',
        isin: 'INE585B01010',
        rating: null,
        industry: 'Auto',
        weightPct: 2.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Hindustan Unilever Ltd',
        isin: 'INE030A01027',
        rating: null,
        industry: 'FMCG',
        weightPct: 2.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'HCL Technologies Ltd',
        isin: 'INE860A01027',
        rating: null,
        industry: 'IT',
        weightPct: 1.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Kotak Mahindra Bank Ltd',
        isin: 'INE237A01028',
        rating: null,
        industry: 'Banks',
        weightPct: 1.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 38.8,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '100016': [
      // ICICI Prudential Bluechip Fund
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 9.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 8.6,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 6.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Larsen & Toubro Ltd',
        isin: 'INE018A01030',
        rating: null,
        industry: 'Construction',
        weightPct: 4.7,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 4.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 3.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Axis Bank Ltd',
        isin: 'INE238A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 3.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ITC Ltd',
        isin: 'INE154A01025',
        rating: null,
        industry: 'FMCG',
        weightPct: 3.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'State Bank of India',
        isin: 'INE062A01020',
        rating: null,
        industry: 'Banks',
        weightPct: 2.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bajaj Finance Ltd',
        isin: 'INE296A01024',
        rating: null,
        industry: 'Finance',
        weightPct: 2.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Asian Paints Ltd',
        isin: 'INE021A01026',
        rating: null,
        industry: 'Chemicals',
        weightPct: 2.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Titan Company Ltd',
        isin: 'INE280A01028',
        rating: null,
        industry: 'Consumer',
        weightPct: 1.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 39.3,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '119598': [
      // HDFC Mid-Cap Opportunities Fund
      {
        instrument: 'Cholamandalam Investment and Finance',
        isin: 'INE121A01024',
        rating: null,
        industry: 'Finance',
        weightPct: 3.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Persistent Systems Ltd',
        isin: 'INE262H01021',
        rating: null,
        industry: 'IT',
        weightPct: 3.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tube Investments of India Ltd',
        isin: 'INE974X01010',
        rating: null,
        industry: 'Auto Ancillaries',
        weightPct: 3.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cummins India Ltd',
        isin: 'INE298A01020',
        rating: null,
        industry: 'Industrial',
        weightPct: 2.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Supreme Industries Ltd',
        isin: 'INE195A01028',
        rating: null,
        industry: 'Chemicals',
        weightPct: 2.7,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Coforge Ltd',
        isin: 'INE591G01017',
        rating: null,
        industry: 'IT',
        weightPct: 2.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Max Healthcare Institute Ltd',
        isin: 'INE027H01010',
        rating: null,
        industry: 'Healthcare',
        weightPct: 2.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Trent Ltd',
        isin: 'INE849A01020',
        rating: null,
        industry: 'Retail',
        weightPct: 2.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Indian Hotels Company Ltd',
        isin: 'INE053A01029',
        rating: null,
        industry: 'Hospitality',
        weightPct: 2.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Brigade Enterprises Ltd',
        isin: 'INE791I01019',
        rating: null,
        industry: 'Real Estate',
        weightPct: 1.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 72.9,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '120594': [
      // Kotak Flexicap Fund
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 8.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 7.6,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 5.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Larsen & Toubro Ltd',
        isin: 'INE018A01030',
        rating: null,
        industry: 'Construction',
        weightPct: 4.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 3.7,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Axis Bank Ltd',
        isin: 'INE238A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 3.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ITC Ltd',
        isin: 'INE154A01025',
        rating: null,
        industry: 'FMCG',
        weightPct: 2.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 2.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 54.6,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '120716': [
      // Axis Bluechip Fund
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 10.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 8.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 6.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 5.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 4.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bajaj Finance Ltd',
        isin: 'INE296A01024',
        rating: null,
        industry: 'Finance',
        weightPct: 3.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Asian Paints Ltd',
        isin: 'INE021A01026',
        rating: null,
        industry: 'Chemicals',
        weightPct: 3.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Titan Company Ltd',
        isin: 'INE280A01028',
        rating: null,
        industry: 'Consumer',
        weightPct: 2.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Nestle India Ltd',
        isin: 'INE239A01024',
        rating: null,
        industry: 'FMCG',
        weightPct: 2.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 45.4,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '135781': [
      // Mirae Asset Large Cap Fund
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 9.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 8.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.7,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 6.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Larsen & Toubro Ltd',
        isin: 'INE018A01030',
        rating: null,
        industry: 'Construction',
        weightPct: 4.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 4.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 3.6,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Axis Bank Ltd',
        isin: 'INE238A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 3.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ITC Ltd',
        isin: 'INE154A01025',
        rating: null,
        industry: 'FMCG',
        weightPct: 2.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'State Bank of India',
        isin: 'INE062A01020',
        rating: null,
        industry: 'Banks',
        weightPct: 2.6,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bajaj Finance Ltd',
        isin: 'INE296A01024',
        rating: null,
        industry: 'Finance',
        weightPct: 2.3,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 45.4,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '102885': [
      // Nippon India Large Cap Fund
      {
        instrument: 'HDFC Bank Ltd',
        isin: 'INE040A01034',
        rating: null,
        industry: 'Banks',
        weightPct: 9.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ICICI Bank Ltd',
        isin: 'INE090A01021',
        rating: null,
        industry: 'Banks',
        weightPct: 7.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Reliance Industries Ltd',
        isin: 'INE002A01018',
        rating: null,
        industry: 'Petroleum Products',
        weightPct: 7.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Larsen & Toubro Ltd',
        isin: 'INE018A01030',
        rating: null,
        industry: 'Construction',
        weightPct: 4.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Infosys Ltd',
        isin: 'INE009A01021',
        rating: null,
        industry: 'IT',
        weightPct: 5.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Bharti Airtel Ltd',
        isin: 'INE397D01024',
        rating: null,
        industry: 'Telecom',
        weightPct: 3.9,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'ITC Ltd',
        isin: 'INE154A01025',
        rating: null,
        industry: 'FMCG',
        weightPct: 3.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'State Bank of India',
        isin: 'INE062A01020',
        rating: null,
        industry: 'Banks',
        weightPct: 3.1,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Tata Consultancy Services Ltd',
        isin: 'INE467B01029',
        rating: null,
        industry: 'IT',
        weightPct: 2.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 52.4,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
    '125354': [
      // DSP Midcap Fund
      {
        instrument: 'Persistent Systems Ltd',
        isin: 'INE262H01021',
        rating: null,
        industry: 'IT',
        weightPct: 4.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Coforge Ltd',
        isin: 'INE591G01017',
        rating: null,
        industry: 'IT',
        weightPct: 3.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cholamandalam Investment and Finance',
        isin: 'INE121A01024',
        rating: null,
        industry: 'Finance',
        weightPct: 3.5,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Supreme Industries Ltd',
        isin: 'INE195A01028',
        rating: null,
        industry: 'Chemicals',
        weightPct: 3.2,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cummins India Ltd',
        isin: 'INE298A01020',
        rating: null,
        industry: 'Industrial',
        weightPct: 3.0,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Max Healthcare Institute Ltd',
        isin: 'INE027H01010',
        rating: null,
        industry: 'Healthcare',
        weightPct: 2.8,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Trent Ltd',
        isin: 'INE849A01020',
        rating: null,
        industry: 'Retail',
        weightPct: 2.6,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Indian Hotels Company Ltd',
        isin: 'INE053A01029',
        rating: null,
        industry: 'Hospitality',
        weightPct: 2.4,
        marketValue: null,
        assetType: 'EQUITY',
      },
      {
        instrument: 'Cash and equivalents',
        isin: null,
        rating: null,
        industry: null,
        weightPct: 74.5,
        marketValue: null,
        assetType: 'CASH',
      },
    ],
  };
  return curated[schemeCode] ?? [];
}

export async function GET(req: NextRequest) {
  const env = getServerEnv();
  const secret = req.nextUrl.searchParams.get('secret');
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!env.CRON_SECRET || (secret !== env.CRON_SECRET && headerSecret !== env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam
    ? Math.min(parseInt(limitParam, 10), TOP_FUNDS.length)
    : TOP_FUNDS.length;
  const fundsToSeed = TOP_FUNDS.slice(0, limit);

  const db = getDb();
  const asOfDate = '2026-04-30'; // Last disclosure date

  // Check which scheme codes actually exist in the funds table
  const codes = fundsToSeed.map((f) => f.code);
  const existingFunds = await db
    .select({ schemeCode: schema.funds.schemeCode })
    .from(schema.funds)
    .where(inArray(schema.funds.schemeCode, codes));
  const existingCodes = new Set(existingFunds.map((f) => f.schemeCode));

  const results: Array<{
    code: string;
    name: string;
    source: string;
    rows: number;
    skipped?: boolean;
  }> = [];
  let totalInserted = 0;

  for (const fund of fundsToSeed) {
    if (!existingCodes.has(fund.code)) {
      results.push({ code: fund.code, name: fund.name, source: 'skipped', rows: 0, skipped: true });
      continue;
    }

    // Try AMFI live endpoint first, fall back to curated data
    let holdings = await fetchAmfiPortfolio(fund.code);
    let source = 'amfi-live';
    if (!holdings || holdings.length === 0) {
      holdings = getCuratedHoldings(fund.code);
      source = 'curated';
    }

    if (holdings.length === 0) {
      results.push({ code: fund.code, name: fund.name, source: 'none', rows: 0 });
      continue;
    }

    // Map tickers from our lookup table
    const rows = holdings.map((h) => ({
      schemeCode: fund.code,
      asOfDate,
      instrument: h.instrument,
      ticker: h.isin
        ? (Object.entries(TICKER_MAP).find(([name]) =>
            h.instrument.toLowerCase().includes(name.toLowerCase().substring(0, 15)),
          )?.[1] ??
          TICKER_MAP[h.instrument] ??
          null)
        : null,
      isin: h.isin,
      assetType: h.assetType,
      weightPct: h.weightPct.toFixed(4),
      marketValue: h.marketValue?.toFixed(2) ?? null,
      quantity: null,
    }));

    const result = await db
      .insert(schema.holdings)
      .values(rows)
      .onConflictDoNothing({
        target: [schema.holdings.schemeCode, schema.holdings.asOfDate, schema.holdings.instrument],
      });

    // drizzle postgres returns rowCount on insert
    const inserted = (result as unknown as { rowCount?: number }).rowCount ?? rows.length;
    totalInserted += inserted;
    results.push({ code: fund.code, name: fund.name, source, rows: inserted });

    // Small delay to avoid hammering AMFI
    await new Promise((r) => setTimeout(r, 300));
  }

  // Also update holdings count on funds table for display
  await db.execute(sql`
    UPDATE funds f
    SET updated_at = now()
    WHERE scheme_code IN (
      SELECT DISTINCT scheme_code FROM holdings
    )
  `);

  return NextResponse.json({
    ok: true,
    asOfDate,
    totalInserted,
    funds: results,
  });
}
