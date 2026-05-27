/**
 * GET /api/holdings/[code]
 *
 * Returns the latest portfolio holdings for a fund, enriched with live
 * stock prices and 1-day change %.
 *
 * Flow:
 *   1. Check DB for existing holdings for this scheme code.
 *   2. If none found, try fetching from AMFI PortfolioHoldingsdata and
 *      persist them so the next request is fast.
 *   3. Fetch live quotes (Yahoo Finance) for all equity tickers found.
 *   4. Return holdings enriched with { livePrice, prevClose, changePct }.
 *
 * Cache: s-maxage=60, stale-while-revalidate=120 (quotes change slowly).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';
import { getLiveQuotes } from '@/lib/quotes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Ticker map for name → NSE symbol resolution ─────────────────────────────
const TICKER_MAP: Record<string, string> = {
  'HDFC Bank': 'HDFCBANK',
  'ICICI Bank': 'ICICIBANK',
  'Reliance Industries': 'RELIANCE',
  Infosys: 'INFY',
  'Tata Consultancy Services': 'TCS',
  'Larsen & Toubro': 'LT',
  'Bharti Airtel': 'BHARTIARTL',
  ITC: 'ITC',
  'Axis Bank': 'AXISBANK',
  'State Bank of India': 'SBIN',
  'Kotak Mahindra Bank': 'KOTAKBANK',
  'Sun Pharmaceutical': 'SUNPHARMA',
  'Hindustan Unilever': 'HINDUNILVR',
  'Maruti Suzuki': 'MARUTI',
  'Mahindra & Mahindra': 'M&M',
  'Bajaj Finance': 'BAJFINANCE',
  'Asian Paints': 'ASIANPAINT',
  'HCL Technologies': 'HCLTECH',
  'Titan Company': 'TITAN',
  'UltraTech Cement': 'ULTRACEMCO',
  'Power Grid Corporation': 'POWERGRID',
  NTPC: 'NTPC',
  'Oil & Natural Gas Corporation': 'ONGC',
  ONGC: 'ONGC',
  Wipro: 'WIPRO',
  'Tech Mahindra': 'TECHM',
  'Tata Motors': 'TATAMOTORS',
  'Tata Steel': 'TATASTEEL',
  'JSW Steel': 'JSWSTEEL',
  'Adani Ports': 'ADANIPORTS',
  'Adani Enterprises': 'ADANIENT',
  'Bajaj Finserv': 'BAJAJFINSV',
  'Nestle India': 'NESTLEIND',
  "Dr. Reddy's Laboratories": 'DRREDDY',
  'Dr. Reddys Laboratories': 'DRREDDY',
  Cipla: 'CIPLA',
  'Divis Laboratories': 'DIVISLAB',
  'Grasim Industries': 'GRASIM',
  'Shree Cement': 'SHREECEM',
  'Eicher Motors': 'EICHERMOT',
  'Britannia Industries': 'BRITANNIA',
  'Cholamandalam Investment': 'CHOLAFIN',
  'Persistent Systems': 'PERSISTENT',
  'Tube Investments': 'TIINDIA',
  'Cummins India': 'CUMMINSIND',
  'Supreme Industries': 'SUPREMEIND',
  Coforge: 'COFORGE',
  'Max Healthcare': 'MAXHEALTH',
  Trent: 'TRENT',
  'Indian Hotels': 'INDHOTEL',
  'Brigade Enterprises': 'BRIGADE',
  'Muthoot Finance': 'MUTHOOTFIN',
  'Torrent Pharmaceuticals': 'TORNTPHARM',
  'Godrej Consumer Products': 'GODREJCP',
  'Pidilite Industries': 'PIDILITIND',
  'Havells India': 'HAVELLS',
  "Divi's Laboratories": 'DIVISLAB',
  'Berger Paints': 'BERGEPAINT',
  'Page Industries': 'PAGEIND',
  'Abbott India': 'ABBOTINDIA',
};

/** Resolve a ticker for a holding instrument name. */
function resolveTicker(instrument: string, existingTicker: string | null): string | null {
  if (existingTicker) return existingTicker;
  // Try prefix match against our map
  for (const [name, ticker] of Object.entries(TICKER_MAP)) {
    if (instrument.toLowerCase().includes(name.toLowerCase())) return ticker;
  }
  return null;
}

// ─── AMFI live fetch ──────────────────────────────────────────────────────────
interface ParsedHolding {
  instrument: string;
  isin: string | null;
  weightPct: number;
  marketValue: number | null;
  assetType: 'EQUITY' | 'DEBT' | 'CASH' | 'OTHER';
}

async function fetchAmfiHoldings(schemeCode: string): Promise<ParsedHolding[] | null> {
  try {
    const url = `https://www.amfiindia.com/modules/PortfolioHoldingsdata?SchemeCode=${schemeCode}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; isp-tracker/1.0)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 100) return null;

    const holdings: ParsedHolding[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1] ?? '';
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
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
      if (cells.length < 4) continue;
      const lastCell = cells[cells.length - 1] ?? '';
      const pctRaw = parseFloat(lastCell);
      if (!isFinite(pctRaw) || pctRaw <= 0 || pctRaw > 100) continue;
      const instrument = cells[0] ?? '';
      if (!instrument || instrument.length < 2) continue;
      if (/name of instrument|instrument|scrip/i.test(instrument)) continue;

      const isin = cells.find((c) => /^INE[A-Z0-9]{9}$/.test(c)) ?? null;
      const mvRaw = cells.length >= 2 ? parseFloat(cells[cells.length - 2] ?? '') : NaN;
      const marketValue = isFinite(mvRaw) ? mvRaw : null;

      let assetType: ParsedHolding['assetType'] = 'OTHER';
      const nl = instrument.toLowerCase();
      if (
        nl.includes('treps') ||
        nl.includes('tri-party') ||
        nl.includes('repo') ||
        nl.includes('reverse repo') ||
        nl.includes('net current asset') ||
        nl.includes('cash') ||
        nl.includes('liquid bees')
      ) {
        assetType = 'CASH';
      } else if (
        isin?.startsWith('INE') ||
        nl.includes('ltd') ||
        nl.includes('limited') ||
        nl.includes('corp') ||
        nl.includes('industries') ||
        nl.includes('bank')
      ) {
        assetType = 'EQUITY';
      } else if (
        nl.includes('bond') ||
        nl.includes('debenture') ||
        nl.includes('ncd') ||
        nl.includes('t-bill') ||
        nl.includes('treasury') ||
        nl.includes('commercial paper') ||
        nl.includes('certificate of deposit')
      ) {
        assetType = 'DEBT';
      }

      holdings.push({ instrument, isin, weightPct: pctRaw, marketValue, assetType });
    }
    return holdings.length > 0 ? holdings : null;
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();

  // 1. Load holdings from DB
  let dbHoldings = await db
    .select()
    .from(schema.holdings)
    .where(eq(schema.holdings.schemeCode, code))
    .orderBy(desc(schema.holdings.weightPct));

  // 2. If empty, try fetching from AMFI and persisting
  if (dbHoldings.length === 0) {
    const fetched = await fetchAmfiHoldings(code);
    if (fetched && fetched.length > 0) {
      const asOfDate = new Date().toISOString().slice(0, 7) + '-01'; // first of current month
      const rows = fetched.map((h) => ({
        schemeCode: code,
        asOfDate,
        instrument: h.instrument,
        ticker: resolveTicker(h.instrument, null),
        isin: h.isin,
        assetType: h.assetType,
        weightPct: h.weightPct.toFixed(4),
        marketValue: h.marketValue?.toFixed(2) ?? null,
        quantity: null,
      }));

      try {
        await db
          .insert(schema.holdings)
          .values(rows)
          .onConflictDoNothing({
            target: [
              schema.holdings.schemeCode,
              schema.holdings.asOfDate,
              schema.holdings.instrument,
            ],
          });

        // Re-fetch what we just inserted
        dbHoldings = await db
          .select()
          .from(schema.holdings)
          .where(eq(schema.holdings.schemeCode, code))
          .orderBy(desc(schema.holdings.weightPct));
      } catch {
        // If persist fails, still return what we fetched in-memory
        const resp = fetched.map((h, idx) => ({
          id: idx,
          instrument: h.instrument,
          ticker: resolveTicker(h.instrument, null),
          isin: h.isin,
          assetType: h.assetType,
          weightPct: h.weightPct,
          marketValue: h.marketValue,
          livePrice: null,
          prevClose: null,
          changePct: null,
        }));
        return NextResponse.json(
          { holdings: resp, asOf: null, source: 'amfi-live' },
          {
            headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
          },
        );
      }
    }
  }

  if (dbHoldings.length === 0) {
    return NextResponse.json({ holdings: [], asOf: null, source: 'none' });
  }

  // 3. Collect equity tickers for live quote fetch
  const equityHoldings = dbHoldings.filter((h) => h.assetType === 'EQUITY');
  const tickersNeeded = equityHoldings
    .map((h) => {
      const ticker = resolveTicker(h.instrument, h.ticker);
      return ticker;
    })
    .filter((t): t is string => t !== null);

  // 4. Fetch live quotes (batched, cached 60s)
  let quotes: Record<string, { price: number; prevClose: number; ts: Date }> = {};
  if (tickersNeeded.length > 0) {
    try {
      quotes = await getLiveQuotes(tickersNeeded);
    } catch {
      // quotes remain empty — we'll still return holdings without live prices
    }
  }

  // 5. Build enriched response
  const asOf = dbHoldings[0]?.asOfDate ?? null;
  const holdings = dbHoldings.map((h) => {
    const ticker = resolveTicker(h.instrument, h.ticker);
    const q = ticker ? quotes[ticker] : undefined;
    const changePct = q && q.prevClose !== 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : null;

    return {
      id: h.id,
      instrument: h.instrument,
      ticker,
      isin: h.isin,
      assetType: h.assetType,
      weightPct: h.weightPct === null ? null : Number(h.weightPct),
      marketValue: h.marketValue === null ? null : Number(h.marketValue),
      livePrice: q?.price ?? null,
      prevClose: q?.prevClose ?? null,
      changePct,
    };
  });

  return NextResponse.json(
    { holdings, asOf, source: 'db' },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}
