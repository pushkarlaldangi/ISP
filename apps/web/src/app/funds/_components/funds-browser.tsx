'use client';

import * as React from 'react';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Virtuoso } from 'react-virtuoso';

import { FundCategoryBadge } from '@/components/funds/fund-category-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInr } from '@/lib/utils';

interface FundRow {
  schemeCode: string;
  schemeName: string;
  amcName: string | null;
  category: string;
  subCategory: string | null;
  latestNav: string | null;
  latestNavDate: string | null;
}

interface FundsResponse {
  items: FundRow[];
  pagination: { limit: number; offset: number; total: number };
}

const CATEGORIES = ['', 'EQUITY', 'DEBT', 'HYBRID', 'ETF', 'SOLUTION', 'OTHER'] as const;

function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function FundsBrowser({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(initialQuery);
  const [category, setCategory] = React.useState(initialCategory);
  const debouncedQ = useDebounce(q);

  // Sync filters → URL so browse state is shareable + back/forward friendly.
  React.useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (debouncedQ) next.set('q', debouncedQ);
    else next.delete('q');
    if (category) next.set('category', category);
    else next.delete('category');
    const qs = next.toString();
    router.replace(qs ? `/funds?${qs}` : '/funds', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, category]);

  const query = useQuery<FundsResponse>({
    queryKey: ['funds', { q: debouncedQ, category }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (debouncedQ) params.set('q', debouncedQ);
      if (category) params.set('category', category);
      const res = await fetch(`/api/funds?${params.toString()}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return (await res.json()) as FundsResponse;
    },
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.pagination.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search
            className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search funds…"
            className="pl-9"
            aria-label="Search funds"
          />
          {q && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQ('')}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === '' ? 'All categories' : titleCase(c)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <p className="text-muted-foreground text-xs" aria-live="polite">
        {query.isLoading
          ? 'Loading…'
          : `${total.toLocaleString('en-IN')} funds${debouncedQ || category ? ' match' : ''}`}
      </p>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <SkeletonRows />
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <Virtuoso
              data={items}
              style={{ height: 'min(70vh, 720px)' }}
              itemContent={(_, fund) => <FundRowItem key={fund.schemeCode} fund={fund} />}
            />
          )}
        </CardContent>
      </Card>

      {total > items.length && (
        <p className="text-muted-foreground text-center text-xs">
          Showing first {items.length.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}.
          Refine the search to narrow results.
        </p>
      )}
    </div>
  );
}

function FundRowItem({ fund }: { fund: FundRow }) {
  const nav = fund.latestNav ? Number(fund.latestNav) : null;
  return (
    <Link
      href={`/funds/${fund.schemeCode}`}
      className="hover:bg-accent/40 focus-visible:bg-accent flex items-center justify-between gap-4 border-b px-4 py-3 transition-colors last:border-b-0 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{fund.schemeName}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <FundCategoryBadge category={fund.category} />
          {fund.subCategory && <span className="truncate">{fund.subCategory}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-sm font-semibold tabular-nums">
          {nav !== null ? formatInr(nav) : '—'}
        </p>
        {fund.latestNavDate && (
          <p className="text-muted-foreground text-xs">{fund.latestNavDate}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="text-sm font-medium">No funds match those filters.</p>
      <p className="text-muted-foreground text-xs">
        Try a different search term or clear the category filter.
      </p>
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
