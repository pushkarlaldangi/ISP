'use client';

import * as React from 'react';

import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { FundCategoryBadge } from '@/components/funds/fund-category-badge';
import { LiveNavWidget } from '@/components/funds/live-nav-widget';
import { WatchlistButton } from '@/components/funds/watchlist-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatInr, formatPct, signedColor } from '@/lib/utils';

import type { HoldingRow } from './holdings-table';
import { HoldingsTable } from './holdings-table';
import { NavHistoryChart } from './nav-history-chart';

interface FundRow {
  schemeCode: string;
  schemeName: string;
  amcName: string | null;
  category: string;
  subCategory: string | null;
  latestNav: number | null;
  latestNavDate: string | null;
}

// ─── Holdings fetch hook ──────────────────────────────────────────────────────
interface HoldingsState {
  holdings: HoldingRow[];
  asOf: string | null;
  loading: boolean;
  error: string | null;
}

function useHoldings(schemeCode: string) {
  const [state, setState] = React.useState<HoldingsState>({
    holdings: [],
    asOf: null,
    loading: true,
    error: null,
  });

  const fetchHoldings = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/holdings/${encodeURIComponent(schemeCode)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { holdings: HoldingRow[]; asOf: string | null };
      setState({ holdings: data.holdings, asOf: data.asOf, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load holdings',
      }));
    }
  }, [schemeCode]);

  // Fetch on mount
  React.useEffect(() => {
    void fetchHoldings();
  }, [fetchHoldings]);

  return { ...state, refresh: fetchHoldings };
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FundDetail({
  fund,
  history,
  signedIn = false,
  isWatched = false,
}: {
  fund: FundRow;
  history: { date: string; nav: number }[];
  signedIn?: boolean;
  isWatched?: boolean;
}) {
  // Day return: latest two NAV points.
  const last = history[history.length - 1]?.nav ?? fund.latestNav ?? null;
  const prev = history[history.length - 2]?.nav ?? null;
  const dayDeltaPct =
    last !== null && prev !== null && prev !== 0 ? ((last - prev) / prev) * 100 : null;
  const dayColor = dayDeltaPct === null ? 'neutral' : signedColor(dayDeltaPct);

  const { holdings, asOf, loading, error, refresh } = useHoldings(fund.schemeCode);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/funds">
            <ArrowLeft className="mr-1 h-4 w-4" /> All funds
          </Link>
        </Button>
        <WatchlistButton
          schemeCode={fund.schemeCode}
          initialWatched={isWatched}
          signedIn={signedIn}
        />
      </div>

      <header className="space-y-3">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <FundCategoryBadge category={fund.category} />
          {fund.subCategory && <span>{fund.subCategory}</span>}
          {fund.amcName && (
            <>
              <span aria-hidden>·</span>
              <span>{fund.amcName}</span>
            </>
          )}
        </div>
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          {fund.schemeName}
        </h1>
        <p className="text-muted-foreground text-xs">Scheme code {fund.schemeCode}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Latest NAV"
          value={fund.latestNav !== null ? formatInr(fund.latestNav) : '—'}
          sublabel={fund.latestNavDate ?? undefined}
        />
        <KpiCard
          label="1-day change"
          value={dayDeltaPct === null ? '—' : formatPct(dayDeltaPct)}
          valueClass={
            dayColor === 'gain' ? 'text-gain' : dayColor === 'loss' ? 'text-loss' : undefined
          }
          sublabel="vs previous NAV"
        />
        <LiveNavWidget schemeCode={fund.schemeCode} />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holdings">
            Holdings {!loading && holdings.length > 0 ? `(${holdings.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NAV — last 12 months</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length < 2 ? <EmptyChart /> : <NavHistoryChart data={history} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Portfolio holdings</h2>
              <p className="text-muted-foreground text-xs">
                {asOf
                  ? `As of ${asOf}. AMCs disclose holdings monthly — data may be 2–4 weeks behind.`
                  : loading
                    ? 'Loading holdings…'
                    : 'Holdings not yet available for this fund.'}
              </p>
            </div>
            {!loading && !error && holdings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh prices
              </Button>
            )}
          </div>

          {loading ? (
            <HoldingsSkeleton />
          ) : error ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                Could not load holdings: {error}.{' '}
                <button
                  onClick={() => void refresh()}
                  className="text-primary underline underline-offset-2"
                >
                  Retry
                </button>
              </CardContent>
            </Card>
          ) : holdings.length === 0 ? (
            <EmptyHoldings />
          ) : (
            <HoldingsTable rows={holdings} />
          )}
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              Returns table (1D / 1W / 1M / 3M / 6M / 1Y / 3Y CAGR) lands in a later phase.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sublabel,
  valueClass,
}: {
  label: string;
  value: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums ${valueClass ?? ''}`}>{value}</p>
        {sublabel && <p className="text-muted-foreground text-xs">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
      Not enough NAV history yet. Run the MFAPI backfill to populate.
    </div>
  );
}

function EmptyHoldings() {
  return (
    <Card>
      <CardContent className="text-muted-foreground p-6 text-sm">
        Holdings have not been imported for this fund yet. Live NAV estimation requires holdings;
        without them we&apos;ll fall back to the official NAV.
      </CardContent>
    </Card>
  );
}

function HoldingsSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-muted/40 h-9 border-b" />
        <ul className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
