/**
 * DELETE /api/me  (also POST with _method=DELETE from the HTML form)
 *
 * Soft-deletes the user. PII is cleared immediately (email_encrypted, display
 * name); the row itself is kept with deleted_at set so we retain the audit-log
 * FK target for the legal retention window. Owned data (portfolios, txns,
 * watchlist, goals, alerts) is hard-deleted via the ON DELETE CASCADE on
 * users.id — except we don't actually drop the users row, so we explicitly
 * delete each user-scoped table here too.
 *
 * Sessions are revoked so the user is logged out everywhere.
 */

import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import {
  createServerClient,
  createServiceClient,
  encryptPii,
  getCurrentUser,
  hashEmailForLookup,
  writeAudit,
} from '@isp/auth';
import { getDb, schema } from '@isp/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleDelete(req: NextRequest, confirmFromForm: string | null) {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Confirmation: header (API) or hidden form field (HTML form).
  const confirmHeader = req.headers.get('x-confirm');
  const confirm = confirmFromForm ?? confirmHeader;
  if (confirm !== 'DELETE') {
    return NextResponse.json(
      {
        error: 'confirmation_required',
        hint: 'send DELETE either as a form field or X-Confirm header',
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const hdr = await headers();

  // Wipe user-owned rows. We do these explicitly rather than rely solely on
  // cascade because we want to *keep* the users row (soft delete) for audit
  // FK integrity.
  await db.delete(schema.alerts).where(eq(schema.alerts.userId, me.id));
  await db.delete(schema.goals).where(eq(schema.goals.userId, me.id));
  await db.delete(schema.watchlist).where(eq(schema.watchlist.userId, me.id));
  await db.delete(schema.portfolios).where(eq(schema.portfolios.userId, me.id));
  // portfolio_transactions, portfolio_snapshots, import_jobs cascade via portfolios.id.

  // Soft-delete + scrub PII so we no longer hold an identifiable record.
  const scrubbedEmail = `deleted+${me.id}@isp.local`;
  await db
    .update(schema.users)
    .set({
      deletedAt: new Date(),
      emailEncrypted: encryptPii(scrubbedEmail),
      emailHash: hashEmailForLookup(scrubbedEmail),
      displayName: null,
    })
    .where(eq(schema.users.id, me.id));

  await writeAudit({
    userId: me.id,
    actorType: 'USER',
    action: 'user.delete',
    entityType: 'user',
    entityId: me.id,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
  });

  // Revoke the auth.users row so re-using the same email creates a fresh
  // account. Service role required.
  try {
    const admin = createServiceClient();
    await admin.auth.admin.deleteUser(me.authProviderId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[me.delete] auth.users delete failed:', err);
  }

  // Sign out the local session as well.
  const supabase = createServerClient(cookieStore);
  await supabase.auth.signOut();

  const target = new URL('/?deleted=1', process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin);
  return NextResponse.redirect(target, { status: 303 });
}

export async function DELETE(req: NextRequest) {
  return handleDelete(req, null);
}

export async function POST(req: NextRequest) {
  // Browsers can't issue DELETE from forms; we accept POST with method override.
  const form = await req.formData();
  const method = form.get('_method');
  if (method !== 'DELETE') {
    return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
  }
  const confirm = form.get('confirm');
  return handleDelete(req, typeof confirm === 'string' ? confirm : null);
}
