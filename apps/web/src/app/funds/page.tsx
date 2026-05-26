import type { Metadata } from 'next';

import { FundsBrowser } from './_components/funds-browser';

export const metadata: Metadata = {
  title: 'Browse funds',
  description: 'Search Indian mutual funds by name, AMC, and category.',
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
  }>;
}

export default async function FundsIndexPage({ searchParams }: PageProps) {
  const initial = await searchParams;
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Browse funds</h1>
        <p className="text-muted-foreground text-sm">
          14,000+ Indian mutual funds, refreshed daily from AMFI.
        </p>
      </header>

      <FundsBrowser initialQuery={initial.q ?? ''} initialCategory={initial.category ?? ''} />
    </main>
  );
}
