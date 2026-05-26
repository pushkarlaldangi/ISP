/**
 * Daily NAV sync, triggered by Vercel Cron at ~8:30 PM IST (configured in
 * vercel.json). Also reachable for manual testing with:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/sync-nav
 *
 * Long-running so we run on the Node.js runtime, not Edge.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { syncNavFromAmfi } from '@isp/jobs';

import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds — AMFI sync + upserts fit comfortably under 5 min

export async function GET(req: NextRequest) {
  const env = getServerEnv();
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!env.CRON_SECRET || provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncNavFromAmfi();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[cron/sync-nav] failed:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
