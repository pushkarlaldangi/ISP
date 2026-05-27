# Runbook: P0 Production Error

## Symptom
- Sentry fires a new error type with high volume (>10 occurrences in 5 min)
- UptimeRobot reports the app down (HTTP non-200 on health check)
- Multiple users report the app is broken

## Severity
**P0** — immediate response required

## Severity definitions
| Level | Definition | Response time |
|---|---|---|
| P0 | App down or data corruption | 15 min |
| P1 | Major feature broken (e.g., NAV sync failed, portfolio 500) | 1 hour |
| P2 | Minor feature degraded (e.g., live quotes stale) | 4 hours |
| P3 | Cosmetic or low-impact bug | Next sprint |

## First response checklist (first 15 min)
- [ ] Check Vercel → Deployments — did a recent deploy cause this? If yes → **instant rollback** (Vercel → Deployments → previous → Promote to Production)
- [ ] Check Sentry → Issues → newest errors — get the stack trace
- [ ] Check Supabase status: `https://status.supabase.com`
- [ ] Check Vercel status: `https://www.vercel-status.com`
- [ ] Post in status page / Telegram: "We're aware of an issue and investigating"

## Rollback (30 seconds)
1. Vercel → your project → Deployments
2. Find the last known-good deployment
3. Click ⋯ → **Promote to Production**
4. Verify UptimeRobot goes green

## Common P0 causes
| Cause | Signal | Fix |
|---|---|---|
| Bad deploy | Error started exactly at deploy time | Rollback |
| DB migration ran destructively | `column does not exist` errors | Rollback migration; restore from Supabase backup |
| Supabase down | All DB queries fail | Wait; post status note |
| Env var deleted | `cannot read property of undefined` in env parsing | Re-add in Vercel env vars → redeploy |
| `CRON_SECRET` rotated without updating cron | Cron returns 401 | Update env var → redeploy |

## DB restore from backup (last resort)
1. Supabase Dashboard → Settings → Backups
2. Select the most recent backup before the incident
3. Restore to a new project to verify data integrity
4. Point `DATABASE_URL` at the restored project

## Post-mortem (required for P0)
File within 48 hours in `runbooks/post-mortems/YYYY-MM-DD-<slug>.md`:
- Timeline of events
- Root cause
- Impact (users affected, duration)
- Fix applied
- Prevention: what changes to process/code/monitoring prevent recurrence
