# Runbook: Data Export Request (DPDP Act)

## Symptom
- User submits a data export request via Settings → Export My Data
- `GET /api/me/export` is called

## Severity
**P3** — routine compliance request; no urgency unless volume is unusual

## What the endpoint returns
`GET /api/me/export` returns a JSON file with:
- User profile (decrypted display name, disclaimer acceptance date)
- All portfolios and transactions
- Watchlist
- Goals and alerts
- Audit log entries for this user

The endpoint is implemented in `apps/web/src/app/api/me/route.ts` (GET handler).

## Response time
DPDP Act: fulfill within **30 days**. Our endpoint is instant (no queue needed at current scale).

## Steps
1. No manual action required — export is self-serve via the UI
2. If a user emails asking for their data (not via the UI):
   a. Verify their identity (ask them to log in and use the in-app export button)
   b. If they can't access their account, escalate to manual export via Supabase SQL Editor:
      ```sql
      -- Replace with actual user ID
      SELECT row_to_json(u) FROM users u WHERE id = '<uuid>';
      SELECT row_to_json(t) FROM portfolio_transactions t
        JOIN portfolios p ON p.id = t.portfolio_id
        WHERE p.user_id = '<uuid>';
      ```
3. Log the manual export in `audit_log` (actor_type = ADMIN)

## Post-mortem
Not required unless export volume is >100/day (indicates automated abuse).
