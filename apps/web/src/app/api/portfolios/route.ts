/**
 * GET  /api/portfolios   — list authenticated user's portfolios
 * POST /api/portfolios   — create a new portfolio
 */

import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, me.id))
    .orderBy(schema.portfolios.createdAt);

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDb();
  const hdr = await headers();

  // If this is the first portfolio, make it default
  const existing = await db
    .select({ id: schema.portfolios.id })
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, me.id))
    .limit(1);

  const isDefault = parsed.data.isDefault ?? existing.length === 0;

  // If setting as default, unset other defaults first
  if (isDefault) {
    await db
      .update(schema.portfolios)
      .set({ isDefault: false })
      .where(eq(schema.portfolios.userId, me.id));
  }

  const [portfolio] = await db
    .insert(schema.portfolios)
    .values({
      userId: me.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isDefault,
    })
    .returning();

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'portfolio.create',
    entityType: 'portfolio',
    entityId: portfolio!.id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
    after: { name: portfolio!.name },
  });

  return NextResponse.json(portfolio, { status: 201 });
}
