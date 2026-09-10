# PR #538 — Gate markers missing

**Verdict:** FIX-FORWARD (code ready, gate declaration missing)

The substantive work is complete and correct (shared-computer login + gated Entra + request-access flow). All code tests passed (API, web, compliance:smoke). However, the PR gates script requires two markers in the PR body at column 0 to declare legitimate changes:

```
GATE-ALLOW: migrations
GATE-ALLOW: env-vars
```

These markers tell the CI that the new migration (`20260710120000_access_requests/migration.sql`) and new env var (`ACCESS_REQUEST_NOTIFY_EMAIL`) are intentional and expected. Without them, CP-11 and CP-12 gates fail.

**Action:** Edit the PR body to add the two GATE-ALLOW lines at column 0, then the gates will pass and the PR is ready to merge. No code changes needed.
