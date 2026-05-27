# Runbook: Account Takeover Suspected

## Symptom
- User reports they didn't initiate a login / magic link they didn't request
- Unusual `audit_log` entries for a user (bulk data export, mass transaction deletes)
- Multiple sign-in attempts from different IPs in short window
- Sentry alert: high rate of auth errors from single IP

## Severity
**P0** — user data at risk

## First response (read-only)
1. Check `audit_log` for the affected user:
   ```sql
   SELECT action, ip, user_agent, created_at
   FROM audit_log
   WHERE user_id = '<user_uuid>'
   ORDER BY created_at DESC
   LIMIT 50;
   ```
2. Check Supabase Auth → Users → find user → Auth history (logins, token refreshes)
3. Note all IPs and user-agents involved

## Mitigation (immediate — takes <5 min)
1. **Revoke all sessions** for the user in Supabase Auth:
   - Dashboard → Auth → Users → find user → Revoke all tokens
   - Or via service-role API: `POST /auth/v1/admin/users/{uid}/logout` with `scope: global`
2. **Notify the user** via their registered email (if accessible) that their account was secured
3. If data was exported or deleted — note what was taken for the post-mortem

## Resolution
1. Enable or enforce MFA (TOTP) for all users — currently optional, consider mandatory after this
2. Add IP-based rate limiting on `/api/auth/**` routes via Upstash Ratelimit
3. Review `audit_log` for what the attacker accessed; if PII was exported, this is a DPDP Act breach notification event (72-hour window to notify users)
4. Check if magic link was phished (link forwarded) vs. email compromise

## DPDP Act obligation
If personal data was accessed without authorization, document:
- Date/time of breach
- Data categories affected
- Number of users affected
- Actions taken

File in `runbooks/incidents/YYYY-MM-DD-ato.md`.

## Post-mortem
Required for every P0. Use template in `runbooks/post-mortems/template.md`.
