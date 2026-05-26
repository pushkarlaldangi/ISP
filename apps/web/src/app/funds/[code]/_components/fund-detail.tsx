'use client';

import * as React from 'react';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { FundCategoryBadge } from '@/components/funds/fund-category-badge';
import { LiveNavWidget } from '@/components/funds/live-nav-widget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatInr, formatPct, signedColor } from '@/lib/utils';

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

interface HoldingRow {
  id: number;
  instrument: string;
  ticker: string | null;
  isin: string | null;
  assetType: string;
  weightPct: number | null;
  marketValue: number | null;
  quantity: number | null;
}

export function FundDetail({
  fund,
  history,
  holdings,
  holdingsAsOf,
}: {
  fund: FundRow;
  history: { date: string; nav: number }[];
  holdings: HoldingRow[];
  holdingsAsOf: string | null;
}) {
  // Day return: latest two NAV points.
  const last = history[history.length - 1]?.nav ?? fund.latestNav ?? null;
  const prev = history[history.length - 2]?.nav ?? null;
  const dayDeltaPct =
    last !== null && prev !== null && prev !== 0 ? ((last - prev) / prev) * 100 : null;
  const dayColor = dayDeltaPct === null ? 'neutral' : signedColor(dayDeltaPct);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/funds">
            <ArrowLeft className="mr-1 h-4 w-4" /> All funds
          </Link>
        </Button>
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
          <TabsTrigger value="holdings">Holdings ({holdings.length})</TabsTrigger>
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
                {holdingsAsOf
                  ? `As of ${holdingsAsOf}. AMCs disclose holdings monthly — this may be 2–4 weeks behind today's portfolio.`
                  : 'Holdings have not been imported for this fund yet.'}
              </p>
            </div>
          </div>
          {holdings.length === 0 ? <EmptyHoldings /> : <HoldingsTable rows={holdings} />}
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
