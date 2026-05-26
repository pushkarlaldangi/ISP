# Runbooks

On-call docs for production incidents. Each runbook is a markdown file with this structure:

1. **Symptom** — what alert fired or what the user sees
2. **Severity** — P0 / P1 / P2 / P3
3. **First response** — fast triage steps (read-only)
4. **Diagnosis** — how to identify root cause
5. **Mitigation** — how to stop the bleeding
6. **Resolution** — fix the root cause
7. **Post-mortem template link** — for P0/P1

Runbooks land here as we wire up real alerts in later phases. Initial set planned for Phase 7:

- `nav-sync-failed.md`
- `quote-provider-down.md`
- `supabase-quota-near-limit.md`
- `account-takeover-suspected.md`
- `data-export-request.md`
- `account-deletion-request.md`
- `p0-production-error.md`
