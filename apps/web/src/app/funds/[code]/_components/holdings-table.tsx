'use client';

import { Card, CardContent } from '@/components/ui/card';

interface HoldingRow {
  id: number;
  instrument: string;
  ticker: string | null;
  assetType: string;
  weightPct: number | null;
}

const assetTypeLabel: Record<string, string> = {
  EQUITY: 'Equity',
  DEBT: 'Debt',
  CASH: 'Cash',
  OTHER: 'Other',
};

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_5rem_5rem] items-center gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide">
          <span>Instrument</span>
          <span className="text-right">Type</span>
          <span className="text-right">Weight</span>
        </div>
        <ul className="divide-y">
          {rows.map((h) => (
            <li
              key={h.id}
              className="grid grid-cols-[1fr_5rem_5rem] items-center gap-3 px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{h.instrument}</p>
                {h.ticker && <p className="text-muted-foreground font-mono text-xs">{h.ticker}</p>}
              </div>
              <span className="text-muted-foreground text-right text-xs">
                {assetTypeLabel[h.assetType] ?? h.assetType}
              </span>
              <span className="num text-right font-medium tabular-nums">
                {h.weightPct === null ? '—' : `${h.weightPct.toFixed(2)}%`}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
