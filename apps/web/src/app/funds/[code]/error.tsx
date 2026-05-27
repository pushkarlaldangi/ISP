'use client';

import Link from 'next/link';

export default function FundDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-20 text-center">
      <div className="mb-4 text-5xl">🔍</div>
      <h2 className="mb-2 text-xl font-semibold">Fund not found or unavailable</h2>
      <p className="text-muted-foreground mx-auto mb-6 max-w-sm text-sm">
        {error.message ??
          'This fund could not be loaded. It may not exist or there was a network error.'}
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        >
          Retry
        </button>
        <Link
          href="/funds"
          className="hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
        >
          Back to funds
        </Link>
      </div>
    </main>
  );
}
