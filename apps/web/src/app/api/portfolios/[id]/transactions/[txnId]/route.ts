/**
 * PATCH  /api/portfolios/[id]/transactions/[txnId]  — edit a transaction
 * DELETE /api/portfolios/[id]/transactions/[txnId]  — delete a transaction
 */

import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; txnId: string }> };

async function verifyOwnership(portfolioId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: schema.portfolios.id })
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, portfolioId), eq(schema.portfolios.userId, userId)))
    .limit(1);
  return row ?? null;
}

const patchSchema = z.object({
  txnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  units: z.number().positive().optional(),
  navAtTxn: z.number().positive().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, txnId } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await verifyOwnership(id, me.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

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
    .from(schema.portfolioTransactions)
    .where(
      and(
        eq(schema.portfolioTransactions.id, txnId),
        eq(schema.portfolioTransactions.portfolioId, id),
      ),
    )
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const updates: Partial<typeof schema.portfolioTransactions.$inferInsert> = {};
  if (parsed.data.txnDate !== undefined) updates.txnDate = parsed.data.txnDate;
  if (parsed.data.units !== undefined) updates.units = String(parsed.data.units);
  if (parsed.data.navAtTxn !== undefined) updates.navAtTxn = String(parsed.data.navAtTxn);
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;

  // Recompute amount if units or nav changed
  const newUnits = parsed.data.units ?? Number(existing.units);
  const newNav = parsed.data.navAtTxn ?? Number(existing.navAtTxn);
  if (parsed.data.units !== undefined || parsed.data.navAtTxn !== undefined) {
    updates.amount = String(newUnits * newNav);
  }

  const [updated] = await db
    .update(schema.portfolioTransactions)
    .set(updates)
    .where(eq(schema.portfolioTransactions.id, txnId))
    .returning();

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.txn.update',
    entityType: 'portfolio_transaction',
    entityId: txnId,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    before: { units: existing.units, navAtTxn: existing.navAtTxn },
    after: { units: updated!.units, navAtTxn: updated!.navAtTxn },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, txnId } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!(await verifyOwnership(id, me.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const db = getDb();
  const hdr = await headers();

  const [existing] = await db
    .select()
    .from(schema.portfolioTransactions)
    .where(
      and(
        eq(schema.portfolioTransactions.id, txnId),
        eq(schema.portfolioTransactions.portfolioId, id),
      ),
    )
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await db.delete(schema.portfolioTransactions).where(eq(schema.portfolioTransactions.id, txnId));

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.txn.delete',
    entityType: 'portfolio_transaction',
    entityId: txnId,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    before: {
      schemeCode: existing.schemeCode,
      txnType: existing.txnType,
      units: existing.units,
      txnDate: existing.txnDate,
    },
  });

  return new NextResponse(null, { status: 204 });
}
