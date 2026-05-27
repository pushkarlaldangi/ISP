/**
 * GET  /api/portfolios/[id]/transactions   — list all transactions
 * POST /api/portfolios/[id]/transactions   — add a transaction
 */

import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const txnSchema = z.object({
  schemeCode: z.string().min(1),
  txnType: z.enum(['BUY', 'SELL', 'SIP', 'DIVIDEND', 'SWITCH_IN', 'SWITCH_OUT']),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  units: z.number().positive(),
  navAtTxn: z.number().positive(),
  note: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify ownership
  const [portfolio] = await db
    .select({ id: schema.portfolios.id })
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!portfolio) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const txns = await db
    .select()
    .from(schema.portfolioTransactions)
    .where(eq(schema.portfolioTransactions.portfolioId, id))
    .orderBy(schema.portfolioTransactions.txnDate);

  return NextResponse.json(txns);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = txnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const hdr = await headers();

  // Verify ownership
  const [portfolio] = await db
    .select({ id: schema.portfolios.id })
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.id, id), eq(schema.portfolios.userId, me.id)))
    .limit(1);

  if (!portfolio) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Verify the fund exists
  const [fund] = await db
    .select({ schemeCode: schema.funds.schemeCode })
    .from(schema.funds)
    .where(eq(schema.funds.schemeCode, parsed.data.schemeCode))
    .limit(1);

  if (!fund) {
    return NextResponse.json(
      { error: 'fund_not_found', schemeCode: parsed.data.schemeCode },
      { status: 422 },
    );
  }

  const amount = parsed.data.units * parsed.data.navAtTxn;

  const [txn] = await db
    .insert(schema.portfolioTransactions)
    .values({
      portfolioId: id,
      schemeCode: parsed.data.schemeCode,
      txnType: parsed.data.txnType,
      txnDate: parsed.data.txnDate,
      units: String(parsed.data.units),
      navAtTxn: String(parsed.data.navAtTxn),
      amount: String(amount),
      note: parsed.data.note ?? null,
    })
    .returning();

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.txn.create',
    entityType: 'portfolio_transaction',
    entityId: txn!.id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    after: {
      portfolioId: id,
      schemeCode: parsed.data.schemeCode,
      txnType: parsed.data.txnType,
      units: parsed.data.units,
      navAtTxn: parsed.data.navAtTxn,
    },
  });

  return NextResponse.json(txn, { status: 201 });
}
