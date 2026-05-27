/**
 * GET    /api/portfolios/[id]   — full dashboard payload
 * PATCH  /api/portfolios/[id]   — rename / update settings
 * DELETE /api/portfolios/[id]   — delete portfolio
 */

import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { summarizePortfolio } from '@isp/core/portfolio';
import type { Transaction } from '@isp/core/types';
import { getDb, schema } from '@isp/db';

import { getLiveNavForFunds } from '@/lib/portfolio-nav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  const [portfolio] = await db
    .select()
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!portfolio) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const txnRows = await db
    .select()
    .from(schema.portfolioTransactions)
    .where(eq(schema.portfolioTransactions.portfolioId, id))
    .orderBy(schema.portfolioTransactions.txnDate);

  const txns: Transaction[] = txnRows.map((r) => ({
    id: r.id,
    portfolioId: r.portfolioId,
    schemeCode: r.schemeCode,
    txnType: r.txnType as Transaction['txnType'],
    txnDate: new Date(r.txnDate),
    units: Number(r.units),
    navAtTxn: Number(r.navAtTxn),
    amount: Number(r.amount),
    note: r.note ?? undefined,
  }));

  // Unique scheme codes for live NAV batch
  const schemeCodes = [...new Set(txns.map((t) => t.schemeCode))];
  const navByScheme = await getLiveNavForFunds(schemeCodes);

  const summary = summarizePortfolio(txns, navByScheme, new Date());

  // Enrich positions with fund names
  const allFundsRows =
    schemeCodes.length > 0
      ? await db.query.funds.findMany({
          where: (f, { inArray }) => inArray(f.schemeCode, schemeCodes),
          columns: { schemeCode: true, schemeName: true, amcName: true, category: true },
        })
      : [];

  const fundMap = new Map(allFundsRows.map((f) => [f.schemeCode, f]));

  const enrichedPositions = summary.positions.map((p) => ({
    ...p,
    schemeName: fundMap.get(p.schemeCode)?.schemeName ?? p.schemeCode,
    amcName: fundMap.get(p.schemeCode)?.amcName ?? null,
    category: fundMap.get(p.schemeCode)?.category ?? null,
  }));

  return NextResponse.json({
    portfolio,
    summary: {
      ...summary,
      positions: enrichedPositions,
    },
    transactions: txns,
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const hdr = await headers();

  const [existing] = await db
    .select()
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (parsed.data.isDefault) {
    await db
      .update(schema.portfolios)
      .set({ isDefault: false })
      .where(eq(schema.portfolios.userId, me.id));
  }

  const updates: Partial<typeof schema.portfolios.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isDefault !== undefined) updates.isDefault = parsed.data.isDefault;

  const [updated] = await db
    .update(schema.portfolios)
    .set(updates)
    .where(eq(schema.portfolios.id, id))
    .returning();

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.update',
    entityType: 'portfolio',
    entityId: id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    before: { name: existing.name },
    after: { name: updated!.name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const hdr = await headers();

  const [existing] = await db
    .select()
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await db.delete(schema.portfolios).where(eq(schema.portfolios.id, id));

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.delete',
    entityType: 'portfolio',
    entityId: id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    before: { name: existing.name },
  });

  return new NextResponse(null, { status: 204 });
}
