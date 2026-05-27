'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import type { PortfolioSummary, Transaction } from '@isp/core/types';

import { cn, formatInr, formatPct, signedColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddTransactionDialog } from './add-transaction-dialog';

interface EnrichedPosition {
  schemeCode: string;
  totalUnits: number;
  totalInvested: number;
  realizedPnl: number;
  avgCostNav: number;
  liveNav: number;
  officialNav: number;
  currentValue: number;
  unrealizedPnl: number;
  pnlPct: number;
  dayChangeAbs: number;
  dayChangePct: number;
  confidence: 'high' | 'medium' | 'low';
  schemeName: string;
  amcName: string | null;
  category: string | null;
}

interface EnrichedSummary extends Omit<PortfolioSummary, 'positions'> {
  positions: EnrichedPosition[];
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date | string;
}

interface Props {
  portfolio: Portfolio;
  summary: EnrichedSummary;
  transactions: Transaction[];
}

const CHART_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#64748b',
];

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-red-600 dark:text-red-400',
};

export function PortfolioDashboard({ portfolio, summary, transactions }: Props) {
  const [activeTab, setActiveTab] = useState<'holdings' | 'allocation' | 'transactions'>(
    'holdings',
  );
  const router = useRouter();

  const isEmpty = summary.positions.length === 0 && transactions.length === 0;

  // Build allocation chart data by category
  const categoryMap = new Map<string, number>();
  for (const p of summary.positions) {
    const cat = p.category ?? 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + p.currentValue);
  }
  const allocationData = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const xirrPct = summary.xirr !== null ? summary.xirr * 100 : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="text-muted-foreground mb-1 text-sm">
            <Link href="/portfolio" className="hover:text-foreground">
              Portfolios
            </Link>
            <span className="mx-1">/</span>
            <span className="text-foreground font-medium">{portfolio.name}</span>
          </nav>
          <h1 className="text-2xl font-bold">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{portfolio.description}</p>
          )}
        </div>
        <AddTransactionDialog portfolioId={portfolio.id} onSuccess={() => router.refresh()} />
      </div>

      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Invested" value={formatInr(summary.totalInvested)} />
        <KpiCard label="Current Value" value={formatInr(summary.totalValue)} />
        <KpiCard
          label="Total P&L"
          value={formatInr(summary.totalPnlAbs)}
          sub={formatPct(summary.totalPnlPct)}
          color={signedColor(summary.totalPnlAbs)}
        />
        <KpiCard
          label="Day's Change"
          value={formatInr(summary.dayChangeAbs)}
          sub={formatPct(summary.dayChangePct)}
          color={signedColor(summary.dayChangeAbs)}
        />
        <KpiCard
          label="XIRR"
          value={xirrPct !== null ? `${xirrPct.toFixed(2)}%` : '—'}
          color={xirrPct !== null ? signedColor(xirrPct) : 'neutral'}
        />
      </div>

      {isEmpty ? (
        <EmptyState portfolioId={portfolio.id} onSuccess={() => router.refresh()} />
      ) : (
        <>
          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b">
            {(['holdings', 'allocation', 'transactions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'border-primary text-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'holdings' && <HoldingsTab positions={summary.positions} />}
          {activeTab === 'allocation' && (
            <AllocationTab positions={summary.positions} allocationData={allocationData} />
          )}
          {activeTab === 'transactions' && (
            <TransactionsTab
              transactions={transactions}
              portfolioId={portfolio.id}
              onMutate={() => router.refresh()}
            />
          )}
        </>
      )}

      {/* SEBI Disclaimer */}
      <p className="text-muted-foreground mt-8 text-center text-xs">
        ISP is a portfolio tracking tool only. Not SEBI-registered investment advice. Live NAV
        estimates are based on disclosed holdings and may vary from actual NAV.
      </p>
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'gain' | 'loss' | 'neutral';
}) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-lg font-semibold tabular-nums',
          color === 'gain' && 'text-gain',
          color === 'loss' && 'text-loss',
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            'text-xs tabular-nums',
            color === 'gain' && 'text-gain',
            color === 'loss' && 'text-loss',
            color === 'neutral' && 'text-muted-foreground',
          )}
        >
          {sub}
        </p>
      )}
    </Card>
  );
}

function HoldingsTab({ positions }: { positions: EnrichedPosition[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No positions with live NAV data yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-left">
            <th className="px-4 py-3 font-medium">Fund</th>
            <th className="px-4 py-3 text-right font-medium">Units</th>
            <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
            <th className="px-4 py-3 text-right font-medium">Live NAV</th>
            <th className="px-4 py-3 text-right font-medium">Value</th>
            <th className="px-4 py-3 text-right font-medium">P&L</th>
            <th className="px-4 py-3 text-right font-medium">Day</th>
            <th className="px-4 py-3 text-center font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.schemeCode} className="hover:bg-muted/20 border-b last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/funds/${p.schemeCode}`}
                  className="hover:text-primary font-medium hover:underline"
                >
                  {p.schemeName.length > 45 ? `${p.schemeName.slice(0, 45)}…` : p.schemeName}
                </Link>
                {p.category && (
                  <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                    {p.category}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {p.totalUnits.toFixed(3)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                ₹{p.avgCostNav.toFixed(4)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                ₹{p.liveNav.toFixed(4)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                {formatInr(p.currentValue)}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={cn('font-mono tabular-nums', `text-${signedColor(p.unrealizedPnl)}`)}
                >
                  {formatInr(p.unrealizedPnl)}
                </span>
                <br />
                <span className={cn('text-xs tabular-nums', `text-${signedColor(p.pnlPct)}`)}>
                  {formatPct(p.pnlPct)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    `text-${signedColor(p.dayChangeAbs)}`,
                  )}
                >
                  {formatInr(p.dayChangeAbs)}
                  <br />
                  {formatPct(p.dayChangePct)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={cn('text-xs font-medium', CONFIDENCE_COLOR[p.confidence])}>
                  {CONFIDENCE_LABEL[p.confidence]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllocationTab({
  positions,
  allocationData,
}: {
  positions: EnrichedPosition[];
  allocationData: { name: string; value: number }[];
}) {
  const totalValue = positions.reduce((acc, p) => acc + p.currentValue, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Donut Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Allocation by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allocationData.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatInr(value), 'Value']}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Allocation Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Fund Weights</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-b-xl">
            {positions.map((p) => {
              const pct = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
              return (
                <div
                  key={p.schemeCode}
                  className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.schemeName.length > 40 ? `${p.schemeName.slice(0, 40)}…` : p.schemeName}
                    </p>
                    <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums">{pct.toFixed(1)}%</p>
                    <p className="text-muted-foreground font-mono text-xs tabular-nums">
                      {formatInr(p.currentValue, true)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTab({
  transactions,
  portfolioId,
  onMutate,
}: {
  transactions: Transaction[];
  portfolioId: string;
  onMutate: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(txnId: string) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    setDeletingId(txnId);
    try {
      await fetch(`/api/portfolios/${portfolioId}/transactions/${txnId}`, {
        method: 'DELETE',
      });
      onMutate();
    } finally {
      setDeletingId(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No transactions yet. Add your first transaction above.
      </p>
    );
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.txnDate).getTime() - new Date(a.txnDate).getTime(),
  );

  const TXN_COLOR: Record<string, string> = {
    BUY: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    SELL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    SIP: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    DIVIDEND: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    SWITCH_IN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    SWITCH_OUT: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  };

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-left">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Fund</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 text-right font-medium">Units</th>
            <th className="px-4 py-3 text-right font-medium">NAV</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Note</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="hover:bg-muted/20 border-b last:border-0">
              <td className="px-4 py-3 font-mono tabular-nums">
                {new Date(t.txnDate).toLocaleDateString('en-IN')}
              </td>
              <td className="max-w-[180px] px-4 py-3">
                <Link
                  href={`/funds/${t.schemeCode}`}
                  className="hover:text-primary hover:underline"
                >
                  {t.schemeCode}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    TXN_COLOR[t.txnType] ?? '',
                  )}
                >
                  {t.txnType}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{t.units.toFixed(3)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                ₹{t.navAtTxn.toFixed(4)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                {formatInr(t.amount)}
              </td>
              <td className="text-muted-foreground px-4 py-3 text-xs">{t.note ?? '—'}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => void handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="text-muted-foreground hover:text-destructive rounded p-1 disabled:opacity-50"
                  aria-label="Delete transaction"
                >
                  {deletingId === t.id ? '…' : '✕'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ portfolioId, onSuccess }: { portfolioId: string; onSuccess: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
      <div className="text-5xl">💼</div>
      <h2 className="text-lg font-semibold">No transactions yet</h2>
      <p className="text-muted-foreground max-w-xs text-sm">
        Add your first transaction to start tracking this portfolio.
      </p>
      <AddTransactionDialog
        portfolioId={portfolioId}
        onSuccess={onSuccess}
        label="Add First Transaction"
      />
    </div>
  );
}
