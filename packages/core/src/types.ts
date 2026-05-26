/**
 * Shared domain types for the ISP mutual-fund tracker.
 *
 * These types are PURE — they describe data shapes only and have no I/O.
 * Provider adapters, API routes, and UI components all consume these types
 * so that swapping a data source never reaches the business logic.
 */

export type AssetType = 'EQUITY' | 'DEBT' | 'CASH' | 'OTHER';

export type FundCategory = 'EQUITY' | 'DEBT' | 'HYBRID' | 'ETF' | 'SOLUTION' | 'OTHER';

export type TxnType = 'BUY' | 'SELL' | 'SIP' | 'DIVIDEND' | 'SWITCH_IN' | 'SWITCH_OUT';

export type AlertChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'TELEGRAM';

export interface Fund {
  schemeCode: string;
  schemeName: string;
  amcName: string | null;
  category: FundCategory;
  subCategory: string | null;
  isinGrowth: string | null;
  isinDiv: string | null;
  latestNav: number;
  latestNavDate: Date;
}

export interface Holding {
  schemeCode: string;
  asOfDate: Date;
  instrument: string;
  ticker: string | null; // null for non-equity instruments
  isin: string | null;
  assetType: AssetType;
  weightPct: number; // 0-100
  marketValue: number | null;
  quantity: number | null;
}

export interface Quote {
  ticker: string;
  price: number;
  prevClose: number;
  ts: Date;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  schemeCode: string;
  txnType: TxnType;
  txnDate: Date;
  units: number;
  navAtTxn: number;
  amount: number;
  note?: string;
}

export interface LiveNavInputs {
  officialNav: number;
  officialNavDate: Date;
  holdings: Holding[];
  quotes: Record<string, Quote>;
}

export interface LiveNavResult {
  estimatedNav: number;
  officialNav: number;
  officialNavDate: Date;
  delta: number;
  deltaPct: number;
  equityCoveragePct: number;
  quotesAsOf: Date | null;
  confidence: 'high' | 'medium' | 'low';
  // When equity coverage is below a threshold the estimate falls back to official.
  isFallback: boolean;
}

export interface Position {
  schemeCode: string;
  totalUnits: number;
  totalInvested: number;
  realizedPnl: number;
  avgCostNav: number;
}

export interface PositionValuation extends Position {
  liveNav: number;
  officialNav: number;
  currentValue: number;
  unrealizedPnl: number;
  pnlPct: number;
  dayChangeAbs: number;
  dayChangePct: number;
  confidence: LiveNavResult['confidence'];
}

export interface PortfolioSummary {
  totalInvested: number;
  totalValue: number;
  totalPnlAbs: number;
  totalPnlPct: number;
  dayChangeAbs: number;
  dayChangePct: number;
  xirr: number | null;
  positions: PositionValuation[];
}
