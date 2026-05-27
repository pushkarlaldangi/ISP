'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface HoldingRow {
  id: number;
  instrument: string;
  ticker: string | null;
  assetType: string;
  weightPct: number | null;
  /** Live market price (₹) — null for non-equity / quote unavailable */
  livePrice: number | null;
  /** Previous close (₹) — null when quote unavailable */
  prevClose: number | null;
  /** 1-day change % — null when quote unavailable */
  changePct: number | null;
}

const assetTypeLabel: Record<string, string> = {
  EQUITY: 'Equity',
  DEBT: 'Debt',
  CASH: 'Cash',
  OTHER: 'Other',
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  // Determine if any equity row has a live price so we can show/hide columns
  const hasLivePrices = rows.some((r) => r.livePrice !== null);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div
          className={cn(
            'bg-muted/40 text-muted-foreground items-center gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide',
            hasLivePrices
              ? 'grid grid-cols-[1fr_5rem_5rem_6rem_5.5rem]'
              : 'grid grid-cols-[1fr_5rem_5rem]',
          )}
        >
          <span>Instrument</span>
          <span className="text-right">Type</span>
          <span className="text-right">Weight</span>
          {hasLivePrices && (
            <>
              <span className="text-right">Live Price</span>
              <span className="text-right">1D Change</span>
            </>
          )}
        </div>

        {/* Rows */}
        <ul className="divide-y">
          {rows.map((h) => (
            <li
              key={h.id}
              className={cn(
                'items-center gap-3 px-4 py-2.5 text-sm',
                hasLivePrices
                  ? 'grid grid-cols-[1fr_5rem_5rem_6rem_5.5rem]'
                  : 'grid grid-cols-[1fr_5rem_5rem]',
              )}
            >
              {/* Instrument name + ticker */}
              <div className="min-w-0">
                <p className="truncate font-medium">{h.instrument}</p>
                {h.ticker && <p className="text-muted-foreground font-mono text-xs">{h.ticker}</p>}
              </div>

              {/* Asset type */}
              <span className="text-muted-foreground text-right text-xs">
                {assetTypeLabel[h.assetType] ?? h.assetType}
              </span>

              {/* Weight % */}
              <span className="num text-right font-medium tabular-nums">
                {h.weightPct === null ? '—' : `${h.weightPct.toFixed(2)}%`}
              </span>

              {/* Live price — only rendered when any row has prices */}
              {hasLivePrices && (
                <span className="num text-right tabular-nums">
                  {h.livePrice !== null ? (
                    <span>₹{fmt(h.livePrice)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
              )}

              {/* 1D change % */}
              {hasLivePrices && (
                <span
                  className={cn(
                    'num text-right font-medium tabular-nums',
                    h.changePct === null
                      ? 'text-muted-foreground'
                      : h.changePct >= 0
                        ? 'text-gain'
                        : 'text-loss',
                  )}
                >
                  {h.changePct === null
                    ? '—'
                    : `${h.changePct >= 0 ? '+' : ''}${h.changePct.toFixed(2)}%`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
