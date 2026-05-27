# Runbook: Supabase Free-Tier Quota Near Limit

## Symptom
- Weekly quota review shows Supabase usage >80% of free-tier limits
- DB queries start failing with connection errors (pooler saturated)
- Supabase dashboard shows warning banner

## Severity
**P2** (warning) / **P1** (if connections failing)

## Free-tier limits to watch
| Resource | Free limit | Alert at |
|---|---|---|
| DB size | 500 MB | 400 MB |
| Rows (soft) | None hard, but large tables slow queries | >5M rows in `nav_history` |
| Auth MAU | 50,000 | 40,000 |
| Storage | 1 GB | 800 MB |
| Edge Function invocations | 500K / month | 400K |
| Pooler connections | 60 concurrent | Monitor p95 |

## First response
1. Go to Supabase Dashboard → Settings → Usage → check all meters
2. Check `nav_history` row count: `SELECT COUNT(*) FROM nav_history;`
3. Check DB size: `SELECT pg_size_pretty(pg_database_size(current_database()));`

## Mitigation
### DB size approaching 400 MB
1. Check largest tables:
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables
   ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
   ```
2. Trim `nav_history` to 3 years (keep latest 1095 rows per fund):
   ```sql
   DELETE FROM nav_history
   WHERE (scheme_code, nav_date) NOT IN (
     SELECT scheme_code, nav_date FROM nav_history
     ORDER BY scheme_code, nav_date DESC
     LIMIT 1095
   );
   VACUUM ANALYZE nav_history;
   ```
3. Trim `audit_log` rows older than 1 year:
   ```sql
   DELETE FROM audit_log WHERE created_at < now() - interval '1 year';
   VACUUM ANALYZE audit_log;
   ```

### Auth MAU approaching 40K
- Enable email OTP rate limiting in Supabase Auth settings
- Review sign-up funnel for bot traffic in PostHog

## Resolution
- If free tier genuinely exhausted: upgrade Supabase to Pro ($25/month)
- Document the upgrade decision and new limits in this runbook

## Post-mortem
Required if DB goes read-only due to quota exhaustion.
