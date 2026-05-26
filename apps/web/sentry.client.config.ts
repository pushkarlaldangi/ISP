// Sentry browser SDK init. Only runs when NEXT_PUBLIC_SENTRY_DSN is set,
// which means Sentry is a no-op during local dev unless you opt in.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [],
    sendDefaultPii: false,
  });
}
