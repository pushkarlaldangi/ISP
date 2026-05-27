# Runbook: Account Deletion Request (DPDP Act)

## Symptom
- User clicks "Delete Account" in Settings → Danger Zone
- `DELETE /api/me` is called

## Severity
**P3** — routine compliance; 7-day grace period before hard delete

## What happens on `DELETE /api/me`
1. User row is soft-deleted: `deleted_at = now()` set on `users` table
2. Supabase Auth account is disabled (user can't log in)
3. A deletion confirmation email is sent via Resend
4. A background job (or manual step) hard-deletes all rows after 7 days

## Grace period hard delete (manual at current scale)
After 7 days, run in Supabase SQL Editor:
```sql
-- Hard delete users whose grace period has passed
-- This cascades to all related tables (portfolios, transactions, watchlist, etc.)
DELETE FROM users
WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - interval '7 days';

-- Also delete from Supabase Auth (requires service role)
-- Do this via Supabase Dashboard → Auth → Users → Delete
```

Or automate via a weekly Supabase Edge Function (future work).

## If user wants to cancel deletion (within 7 days)
```sql
UPDATE users SET deleted_at = NULL WHERE id = '<uuid>';
-- Re-enable auth account via Supabase Dashboard → Auth → Users
```

## Data categories deleted (cascade)
- `users` row (PII: encrypted email, display name)
- `portfolios` + `portfolio_transactions` + `portfolio_snapshots`
- `watchlist`, `goals`, `alerts`, `import_jobs`
- `audit_log` rows for this user (after deletion — we keep for 7 days for dispute resolution)

## Supabase Storage
Any uploaded CAS PDFs are stored under `cas-imports/<user_id>/`. Delete manually:
- Supabase Dashboard → Storage → cas-imports → filter by user_id folder → delete

## DPDP Act obligation
Deletion must be confirmed within **30 days** of request. Our 7-day grace period is well within this.
Log deletion in internal records.

## Post-mortem
Not required unless a user reports data not deleted after 30 days.
