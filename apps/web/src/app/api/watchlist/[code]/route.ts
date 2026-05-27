/**
 * DELETE /api/watchlist/[code]  — remove fund from watchlist
 */

import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { code } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const hdr = await headers();

  await db
    .delete(schema.watchlist)
    .where(and(eq(schema.watchlist.userId, me.id), eq(schema.watchlist.schemeCode, code)));

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'watchlist.remove',
    entityType: 'watchlist',
    entityId: code,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    before: { schemeCode: code },
  });

  return new NextResponse(null, { status: 204 });
}
