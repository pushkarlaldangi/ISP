'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { LiveNavResult } from '@isp/core/types';

import { cn, signedColor } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WatchlistItem {
  id: string;
  schemeCode: string;
  addedAt: Date | string;
  schemeName: string;
  amcName: string | null;
  category: string | null;
  latestNav: number | null;
  liveNav: LiveNavResult | null;
}

export function WatchlistClient({ items }: { items: WatchlistItem[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(schemeCode: string) {
    setRemoving(schemeCode);
    try {
      await fetch(`/api/watchlist/${schemeCode}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track funds without holding them — live estimated NAV updated every 30s
          </p>
        </div>
        <Link
          href="/funds"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        >
          Browse Funds
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <div className="text-4xl">👀</div>
          <h2 className="text-lg font-semibold">Your watchlist is empty</h2>
          <p className="text-muted-foreground max-w-xs text-sm">
            Browse funds and click &ldquo;Add to Watchlist&rdquo; to track them here.
          </p>
          <Link
            href="/funds"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          >
            Browse Funds
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const nav = item.liveNav;
            const delta = nav?.delta ?? null;
            const deltaPct = nav?.deltaPct ?? null;
            const estimatedNav = nav?.estimatedNav ?? item.latestNav;

            return (
              <Card key={item.schemeCode} className="relative overflow-hidden">
                <button
                  onClick={() => void handleRemove(item.schemeCode)}
                  disabled={removing === item.schemeCode}
                  className="text-muted-foreground hover:text-destructive absolute right-2 top-2 rounded p-1 disabled:opacity-50"
                  aria-label="Remove from watchlist"
                >
                  {removing === item.schemeCode ? '…' : '✕'}
                </button>
                <CardContent className="p-4">
                  <Link href={`/funds/${item.schemeCode}`}>
                    <p className="hover:text-primary pr-6 text-sm font-medium hover:underline">
                      {item.schemeName.length > 50
                        ? `${item.schemeName.slice(0, 50)}…`
                        : item.schemeName}
                    </p>
                  </Link>
                  {item.category && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {item.category}
                    </Badge>
                  )}

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs">Est. NAV</p>
                      <p className="font-mono text-xl font-bold tabular-nums">
                        {estimatedNav !== null ? `₹${estimatedNav.toFixed(4)}` : '—'}
                      </p>
                    </div>
                    {delta !== null && deltaPct !== null && (
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-mono text-sm font-medium tabular-nums',
                            `text-${signedColor(delta)}`,
                          )}
                        >
                          {delta >= 0 ? '+' : ''}
                          {delta.toFixed(4)}
                        </p>
                        <p
                          className={cn(
                            'font-mono text-xs tabular-nums',
                            `text-${signedColor(deltaPct)}`,
                          )}
                        >
                          {deltaPct >= 0 ? '+' : ''}
                          {deltaPct.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>

                  {nav && (
                    <div className="mt-2 flex items-center gap-1">
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-xs font-medium',
                          nav.confidence === 'high'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : nav.confidence === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                        )}
                      >
                        {nav.confidence} confidence
                      </span>
                      <span className="text-muted-foreground text-xs">
                        · {nav.equityCoveragePct.toFixed(0)}% equity covered
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
