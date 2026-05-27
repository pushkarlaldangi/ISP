/**
 * GET /api/holdings/[code]
 *
 * Returns the latest portfolio holdings for a fund, enriched with live
 * stock prices and 1-day change %.
 *
 * Resolution order:
 *   1. DB holdings (seeded via admin/seed-holdings or previously fetched)
 *   2. AMFI PortfolioHoldingsdata live fetch (if Vercel can reach it)
 *   3. Curated fallback (hardcoded data for the ~15 most popular funds)
 *   4. Empty — returns { holdings: [], source: 'none' }
 *
 * After resolving holdings, equity tickers get live Yahoo Finance quotes
 * (60s Redis cache + in-process LRU fallback).
 *
 * Cache: s-maxage=60, stale-while-revalidate=120
 */

import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { getDb, schema } from '@isp/db';
import { getCuratedHoldings } from '@/lib/curated-holdings';
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
  'Bajaj Holdings': 'BAJAJHLDNG',
  'Coal India': 'COALINDIA',
  Zomato: 'ZOMATO',
  'Jio Financial': 'JIOFIN',
  'Finolex Cables': 'FINEOTEX',
  'Blue Star': 'BLUESTARCO',
  'Praj Industries': 'PRAJIND',
  'Havells India': 'HAVELLS',
  'Pidilite Industries': 'PIDILITIND',
};

function resolveTicker(instrument: string, existingTicker: string | null): string | null {
  if (existingTicker) return existingTicker;
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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US;q=0.9',
        Referer: 'https://www.amfiindia.com/',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 200) return null;

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

  let source = 'db';

  // 2. If DB is empty, try sources in order: AMFI live → curated fallback
  if (dbHoldings.length === 0) {
    // 2a. Try AMFI live fetch
    const fetched = await fetchAmfiHoldings(code);

    if (fetched && fetched.length > 0) {
      // Persist to DB for fast future reads
      const asOfDate = new Date().toISOString().slice(0, 7) + '-01';
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
        dbHoldings = await db
          .select()
          .from(schema.holdings)
          .where(eq(schema.holdings.schemeCode, code))
          .orderBy(desc(schema.holdings.weightPct));
        source = 'amfi-live';
      } catch {
        // Persist failed — return in-memory results directly
        return buildResponse(
          fetched.map((h, idx) => ({
            id: idx,
            instrument: h.instrument,
            ticker: resolveTicker(h.instrument, null),
            isin: h.isin,
            assetType: h.assetType,
            weightPct: h.weightPct,
            marketValue: h.marketValue,
          })),
          null,
          'amfi-live',
        );
      }
    } else {
      // 2b. Curated fallback (hardcoded data for top funds)
      const curated = getCuratedHoldings(code);
      if (curated.length > 0) {
        const asOfDate = '2026-04-30'; // last known disclosure date for curated data
        const rows = curated.map((h) => ({
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
          dbHoldings = await db
            .select()
            .from(schema.holdings)
            .where(eq(schema.holdings.schemeCode, code))
            .orderBy(desc(schema.holdings.weightPct));
          source = 'curated';
        } catch {
          return buildResponse(
            curated.map((h, idx) => ({
              id: idx,
              instrument: h.instrument,
              ticker: resolveTicker(h.instrument, null),
              isin: h.isin,
              assetType: h.assetType,
              weightPct: h.weightPct,
              marketValue: h.marketValue,
            })),
            '2026-04-30',
            'curated',
          );
        }
      }
    }
  }

  if (dbHoldings.length === 0) {
    return NextResponse.json({ holdings: [], asOf: null, source: 'none' });
  }

  // 3. Collect equity tickers for live quote fetch
  const tickersNeeded = dbHoldings
    .filter((h) => h.assetType === 'EQUITY')
    .map((h) => resolveTicker(h.instrument, h.ticker))
    .filter((t): t is string => t !== null);

  // 4. Fetch live quotes (batched, cached 60s)
  let quotes: Record<string, { price: number; prevClose: number; ts: Date }> = {};
  if (tickersNeeded.length > 0) {
    try {
      quotes = await getLiveQuotes(tickersNeeded);
    } catch {
      // quotes remain empty — holdings still returned without live prices
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
    { holdings, asOf, source },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function buildResponse(
  rows: Array<{
    id: number;
    instrument: string;
    ticker: string | null;
    isin: string | null;
    assetType: string;
    weightPct: number | null;
    marketValue: number | null;
  }>,
  asOf: string | null,
  source: string,
) {
  const equityTickers = rows
    .filter((r) => r.assetType === 'EQUITY')
    .map((r) => r.ticker)
    .filter((t): t is string => t !== null);

  let quotes: Record<string, { price: number; prevClose: number; ts: Date }> = {};
  if (equityTickers.length > 0) {
    try {
      quotes = await getLiveQuotes(equityTickers);
    } catch {
      /* ignore */
    }
  }

  const holdings = rows.map((h) => {
    const q = h.ticker ? quotes[h.ticker] : undefined;
    const changePct = q && q.prevClose !== 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : null;
    return { ...h, livePrice: q?.price ?? null, prevClose: q?.prevClose ?? null, changePct };
  });

  return NextResponse.json(
    { holdings, asOf, source },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}
