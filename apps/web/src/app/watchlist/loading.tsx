import { Skeleton } from '@/components/ui/skeleton';

export default function WatchlistLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-16 rounded-full" />
            <div className="mt-3 flex items-end justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-7 w-28" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
