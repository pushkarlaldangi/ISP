import { Skeleton } from '@/components/ui/skeleton';

export default function PortfolioDashboardLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b pb-0">
        {['Holdings', 'Allocation', 'Transactions'].map((t) => (
          <Skeleton key={t} className="h-8 w-24 rounded-none" />
        ))}
      </div>

      {/* Holdings table skeleton */}
      <div className="overflow-hidden rounded-xl border">
        <div className="bg-muted/50 grid grid-cols-7 gap-4 px-4 py-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-4 border-t px-4 py-3">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
