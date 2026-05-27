# Runbook: NAV Sync Failed

## Symptom
- Vercel cron `/api/cron/sync-nav` returned non-2xx or timed out
- Funds page shows stale NAV dates (yesterday or older)
- Alert fires from UptimeRobot or Sentry

## Severity
**P1** — users see stale data but app remains functional

## First response (read-only triage)
1. Check Vercel → Functions → `api/cron/sync-nav` logs for the last run
2. Verify AMFI is reachable: open `https://www.amfiindia.com/spages/NAVAll.txt` in a browser
3. Check Supabase dashboard → Database → Table editor → `funds` — what is the latest `updated_at`?

## Diagnosis
| Symptom | Likely cause |
|---|---|
| `ECONNREFUSED` / `ETIMEDOUT` on AMFI URL | AMFI server down or blocking Vercel IPs |
| `DATABASE_URL` error | Supabase pooler down or env var missing |
| Function timeout (>300s) | AMFI file too large / network slow — retry usually fixes |
| `unauthorized` in logs | `CRON_SECRET` env var missing from Vercel |

## Mitigation
1. **Trigger a manual sync** (doesn't need curl — use browser):
   ```
   https://isp-web-green.vercel.app/api/admin/seed?secret=<CRON_SECRET>
   ```
2. If AMFI is down, no action needed — the previous NAV is still valid. Post a status-page note: "NAV data delayed — AMFI source unavailable."
3. If DB connection failed, check Supabase status at `https://status.supabase.com`

## Resolution
- If AMFI URL changed: update `AMFI_NAV_URL` constant in `packages/jobs/src/syncNav.ts` and redeploy
- If Vercel cron schedule missed: verify `vercel.json` crons block and re-deploy
- If env var missing: add `CRON_SECRET` in Vercel → Settings → Environment Variables → Redeploy

## Post-mortem
Required for P0 only. File in `runbooks/post-mortems/YYYY-MM-DD-nav-sync.md`.
