/**
 * Manual sync-NAV runner — convenience CLI for one-off / local runs.
 * Production cron hits the /api/cron/sync-nav route instead.
 */

import { syncNavFromAmfi } from './syncNav';

async function main() {
  // eslint-disable-next-line no-console
  console.log('[run-sync-nav] starting...');
  const result = await syncNavFromAmfi();
  // eslint-disable-next-line no-console
  console.log('[run-sync-nav] result:', result);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[run-sync-nav] failed:', err);
  process.exit(1);
});
