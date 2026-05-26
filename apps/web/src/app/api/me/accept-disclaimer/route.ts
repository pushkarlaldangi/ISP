/**
 * POST /api/me/accept-disclaimer
 *
 * Records that the current user has accepted the SEBI non-advisory
 * disclaimer. Idempotent — keeps the earliest timestamp on repeat calls
 * so the audit trail reflects the actual first acceptance.
 *
 * This endpoint is called by the Phase 5 portfolio-create flow; surfaced
 * here so the schema-level contract is established with auth.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (me.disclaimerAcceptedAt) {
    return NextResponse.json({ ok: true, alreadyAccepted: true, at: me.disclaimerAcceptedAt });
  }

  const db = getDb();
  const acceptedAt = new Date();
  await db
    .update(schema.users)
    .set({ disclaimerAcceptedAt: acceptedAt })
    .where(and(eq(schema.users.id, me.id), isNull(schema.users.disclaimerAcceptedAt)));

  const hdr = await headers();
  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'user.disclaimer_accept',
    entityType: 'user',
    entityId: me.id,
    after: { disclaimerAcceptedAt: acceptedAt.toISOString() },
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
  });

  return NextResponse.json({ ok: true, at: acceptedAt });
}
