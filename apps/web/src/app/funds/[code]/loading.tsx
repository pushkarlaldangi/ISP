import { Skeleton } from '@/components/ui/skeleton';

export default function FundDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Back button */}
      <Skeleton className="h-8 w-24 rounded-md" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex gap-1 border-b">
          {['Overview', 'Holdings', 'Performance'].map((t) => (
            <Skeleton key={t} className="h-8 w-24 rounded-none" />
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-5 w-36" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
