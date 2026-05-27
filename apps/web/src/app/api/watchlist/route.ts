/**
 * GET    /api/watchlist   — list watchlist with live NAVs
 * POST   /api/watchlist   — add fund to watchlist
 */

import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

import { getLiveNavForFunds } from '@/lib/portfolio-nav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({
      id: schema.watchlist.id,
      schemeCode: schema.watchlist.schemeCode,
      addedAt: schema.watchlist.addedAt,
      schemeName: schema.funds.schemeName,
      amcName: schema.funds.amcName,
      category: schema.funds.category,
      latestNav: schema.funds.latestNav,
      latestNavDate: schema.funds.latestNavDate,
    })
    .from(schema.watchlist)
    .innerJoin(schema.funds, eq(schema.watchlist.schemeCode, schema.funds.schemeCode))
    .where(eq(schema.watchlist.userId, me.id))
    .orderBy(schema.watchlist.addedAt);

  const schemeCodes = rows.map((r) => r.schemeCode);
  const navByScheme = await getLiveNavForFunds(schemeCodes);

  const enriched = rows.map((r) => ({
    ...r,
    liveNav: navByScheme[r.schemeCode] ?? null,
  }));

  return NextResponse.json(enriched);
}

const addSchema = z.object({
  schemeCode: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const hdr = await headers();

  // Verify fund exists
  const [fund] = await db
    .select({ schemeCode: schema.funds.schemeCode })
    .from(schema.funds)
    .where(eq(schema.funds.schemeCode, parsed.data.schemeCode))
    .limit(1);

  if (!fund) return NextResponse.json({ error: 'fund_not_found' }, { status: 422 });

  const [row] = await db
    .insert(schema.watchlist)
    .values({ userId: me.id, schemeCode: parsed.data.schemeCode })
    .onConflictDoNothing()
    .returning();

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'watchlist.add',
    entityType: 'watchlist',
    entityId: row?.id ?? parsed.data.schemeCode,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    after: { schemeCode: parsed.data.schemeCode },
  });

  return NextResponse.json(row ?? { schemeCode: parsed.data.schemeCode }, { status: 201 });
}
