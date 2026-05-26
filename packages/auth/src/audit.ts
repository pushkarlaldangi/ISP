/**
 * Append-only audit log writer.
 *
 * Every mutation to user-owned data writes one row here so we have a
 * tamper-evident trail for DPDP/security investigations. Callers pass
 * before/after JSON snapshots; "before" is null on creates, "after" is
 * null on deletes.
 *
 * Writes are best-effort: if the audit insert itself fails (e.g. DB
 * blip), we log and continue — losing the request because we couldn't
 * audit it is worse than losing one audit row.
 */

import { getDb, schema } from '@isp/db';

export type ActorType = 'USER' | 'SYSTEM' | 'ADMIN';

export interface AuditEntry {
  userId: string | null;
  actorType: ActorType;
  action: string; // e.g. 'portfolio.txn.create'
  entityType?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      userId: entry.userId,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      before: entry.before == null ? null : (entry.before as object),
      after: entry.after == null ? null : (entry.after as object),
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] insert failed:', err instanceof Error ? err.message : err);
  }
}
