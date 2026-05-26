'use client';

import * as React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Per-request QueryClient. Created lazily in state so that each browser
 * navigation gets a fresh isolated instance during dev with React strict
 * mode + Next.js fast refresh.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s — matches the live NAV refresh cadence
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
