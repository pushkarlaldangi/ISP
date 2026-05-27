'use client';

export default function PortfolioDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-20 text-center">
      <div className="mb-4 text-5xl">📉</div>
      <h2 className="mb-2 text-xl font-semibold">Could not load portfolio</h2>
      <p className="text-muted-foreground mx-auto mb-6 max-w-sm text-sm">
        {error.message ??
          'An unexpected error occurred. Live NAV data or your holdings could not be fetched.'}
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
      >
        Retry
      </button>
    </main>
  );
}
