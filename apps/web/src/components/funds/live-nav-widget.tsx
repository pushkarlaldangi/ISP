'use client';

import * as React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInr, formatPct, signedColor } from '@/lib/utils';

interface LiveNavPayload {
  schemeCode: string;
  market: { isOpen: boolean };
  holdingsAsOf: string | null;
  nav: {
    estimatedNav: number;
    officialNav: number;
    officialNavDate: string; // ISO
    delta: number;
    deltaPct: number;
    equityCoveragePct: number;
    quotesAsOf: string | null; // ISO
    confidence: 'high' | 'medium' | 'low';
    isFallback: boolean;
  };
}

const REFRESH_OPEN = 30_000;
const REFRESH_CLOSED = 5 * 60_000;

export function LiveNavWidget({ schemeCode }: { schemeCode: string }) {
  // First fetch decides market state; subsequent intervals adjust.
  const [marketOpen, setMarketOpen] = React.useState<boolean | null>(null);

  const query = useQuery<LiveNavPayload>({
    queryKey: ['nav', schemeCode],
    queryFn: async () => {
      const res = await fetch(`/api/nav/${schemeCode}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as LiveNavPayload;
      setMarketOpen(json.market.isOpen);
      return json;
    },
    refetchInterval: marketOpen === false ? REFRESH_CLOSED : REFRESH_OPEN,
    refetchOnWindowFocus: marketOpen === true,
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState />;

  const { nav, market } = query.data;
  const color = signedColor(nav.delta);
  const TrendIcon = nav.delta > 0 ? TrendingUp : nav.delta < 0 ? TrendingDown : null;

  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Live NAV</p>
          <LiveBadge marketOpen={market.isOpen} fetchedAt={query.dataUpdatedAt} />
        </div>

        <div className="flex items-baseline gap-3">
          <NumberTicker
            value={nav.estimatedNav}
            prefix="₹"
            decimals={4}
            className={`text-2xl font-semibold ${
              color === 'gain' ? 'text-gain' : color === 'loss' ? 'text-loss' : ''
            }`}
            aria-label={`Live NAV: ₹${nav.estimatedNav.toFixed(4)}`}
          />
          {TrendIcon && (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${
                color === 'gain' ? 'text-gain' : 'text-loss'
              }`}
            >
              <TrendIcon className="h-3 w-3" aria-hidden />
              {formatPct(nav.deltaPct)}
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-xs">
          Official: <span className="tabular-nums">{formatInr(nav.officialNav)}</span> on{' '}
          {new Date(nav.officialNavDate).toISOString().slice(0, 10)}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ConfidenceBadge confidence={nav.confidence} coverage={nav.equityCoveragePct} />
          {nav.isFallback && (
            <Badge variant="outline" className="text-xs font-normal">
              Estimate unavailable — showing official
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LiveBadge({ marketOpen, fetchedAt }: { marketOpen: boolean; fetchedAt: number }) {
  if (!marketOpen) {
    return (
      <Badge variant="outline" className="font-normal">
        Markets closed
      </Badge>
    );
  }
  const ageS = Math.max(0, Math.round((Date.now() - fetchedAt) / 1000));
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <span
        className="animate-pulse-live bg-gain inline-block h-1.5 w-1.5 rounded-full"
        aria-hidden
      />
      Live · {ageS}s ago
    </Badge>
  );
}

function ConfidenceBadge({
  confidence,
  coverage,
}: {
  confidence: 'high' | 'medium' | 'low';
  coverage: number;
}) {
  const variant: 'gain' | 'secondary' | 'loss' =
    confidence === 'high' ? 'gain' : confidence === 'medium' ? 'secondary' : 'loss';
  return (
    <Badge variant={variant} className="gap-1">
      <Info className="h-3 w-3" aria-hidden />
      {labelFor(confidence)} confidence · {coverage.toFixed(0)}% equity covered
    </Badge>
  );
}

function labelFor(c: 'high' | 'medium' | 'low') {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-5 w-40" />
      </CardContent>
    </Card>
  );
}

function ErrorState() {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">Live NAV</p>
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t reach the live engine. Showing the latest official NAV above is still valid.
        </p>
      </CardContent>
    </Card>
  );
}
