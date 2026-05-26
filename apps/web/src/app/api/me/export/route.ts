/**
 * GET /api/me/export
 *
 * DPDP / GDPR data export. Returns a JSON blob containing everything we
 * have about the requesting user, decrypted where applicable. Streamed
 * inline so the browser downloads it as a file.
 */

import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { decryptPii, getCurrentUser, writeAudit } from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  const [userRow] = await db.select().from(schema.users).where(eq(schema.users.id, me.id)).limit(1);

  const [portfolios, transactions, watchlist, goals, alerts, snapshots] = await Promise.all([
    db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, me.id)),
    db
      .select()
      .from(schema.portfolioTransactions)
      .leftJoin(
        schema.portfolios,
        eq(schema.portfolioTransactions.portfolioId, schema.portfolios.id),
      )
      .where(eq(schema.portfolios.userId, me.id)),
    db.select().from(schema.watchlist).where(eq(schema.watchlist.userId, me.id)),
    db.select().from(schema.goals).where(eq(schema.goals.userId, me.id)),
    db.select().from(schema.alerts).where(eq(schema.alerts.userId, me.id)),
    db
      .select()
      .from(schema.portfolioSnapshots)
      .leftJoin(schema.portfolios, eq(schema.portfolioSnapshots.portfolioId, schema.portfolios.id))
      .where(eq(schema.portfolios.userId, me.id)),
  ]);

  const hdr = await headers();
  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'user.data_export',
    entityType: 'user',
    entityId: me.id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    user: userRow
      ? {
          id: userRow.id,
          email: userRow.emailEncrypted ? decryptPii(userRow.emailEncrypted) : null,
          displayName: userRow.displayName,
          mfaEnabled: userRow.mfaEnabled,
          createdAt: userRow.createdAt,
          disclaimerAcceptedAt: userRow.disclaimerAcceptedAt,
        }
      : null,
    portfolios,
    transactions: transactions.map((t) => t.portfolio_transactions),
    watchlist,
    goals,
    alerts,
    snapshots: snapshots.map((s) => s.portfolio_snapshots),
  };

  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="isp-data-export-${me.id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
