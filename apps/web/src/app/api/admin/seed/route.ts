/**
 * GET /api/admin/seed
 *
 * One-time endpoint to trigger AMFI NAV sync from any browser/tool that
 * can't set custom headers (e.g. Vercel dashboard "Invoke" or browser address bar).
 *
 * Protected by CRON_SECRET as a query param: ?secret=<CRON_SECRET>
 * Remove or disable this route after first successful seed.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { syncNavFromAmfi } from '@isp/jobs';

import { getServerEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const env = getServerEnv();
  const secret = req.nextUrl.searchParams.get('secret');

  // Accept secret as query param OR Authorization header
  const headerSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!env.CRON_SECRET || (secret !== env.CRON_SECRET && headerSecret !== env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncNavFromAmfi();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/seed] failed:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
