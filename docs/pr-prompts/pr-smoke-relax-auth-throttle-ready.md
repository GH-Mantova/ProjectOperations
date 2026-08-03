---
premise: '! grep -q "AUTH_THROTTLE_LIMIT" scripts/pipeline/smoke-pr.ps1'
premise_means: The smoke harness does not yet relax the API login throttle for its isolated smoke DB, so the acceptance suite 429s under parallel workers (CI already relaxes it; local smoke does not).
scope:
  - scripts/pipeline/smoke-pr.ps1
done_when: grep -q "AUTH_THROTTLE_LIMIT" scripts/pipeline/smoke-pr.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Smoke harness: relax the API login throttle for the isolated smoke DB (parity with CI)

## Problem (root cause, confirmed 2026-08-03)

`scripts/pipeline/smoke-pr.ps1` runs the pr-acceptance Playwright suite with 4 parallel workers.
The API enforces a per-IP login throttle of **5 logins / 60s** (`apps/api/src/modules/auth/auth-throttle.config.ts`,
env-configurable via `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_REFRESH_LIMIT` / `AUTH_THROTTLE_TTL`).
The test token caches (`tests/e2e/pr-acceptance/api-helpers.ts`, `tests/e2e/pr-acceptance/helpers.ts`,
`tests/e2e/auth.setup.ts`) are per-worker-process, so 4 workers each cold-log-in as admin + field
worker, all from `127.0.0.1`. That bursts past 5/60s and every later login gets
`POST /auth/login -> 429`, failing multiple unrelated specs. It jams the smoke-before-merge gate for
EVERY UI PR.

**This is a local-harness-only gap, and the fix is already blessed:** CI's `.github/workflows/playwright.yml`
(lines 43-44) sets `AUTH_THROTTLE_LIMIT: 1000` and `AUTH_THROTTLE_REFRESH_LIMIT: 1000` for its e2e
run — which is exactly why CI is green (8/8) while `smoke-pr.ps1` 429s. `.env.example` (line 30)
documents the same test-context guidance (both at 1000). This change brings the local smoke env into
parity with CI; it does NOT invent a new value.

## The fix (one change, smoke env only)

In `scripts/pipeline/smoke-pr.ps1`, AFTER the block that repoints `DATABASE_URL` to `$SmokeDb`
(the `Set-Content ... -Encoding ASCII` loop over `$DstRoot,$DstApi`) and BEFORE the `pnpm install`
step, append the CI throttle limits to the SAME provisioned smoke env files. The smoke DB and its
env are disposable and owned by this run — nothing else reads them, and production is untouched.

```powershell
# CI's playwright.yml (lines 43-44) relaxes BOTH auth throttles for e2e; that is why CI is green
# while this local smoke 429s under 4 workers. Bring the smoke env into parity (prod stays 5/60s).
foreach ($envFile in @($DstRoot, $DstApi)) {
    if (Test-Path $envFile) {
        Add-Content -Path $envFile -Value "AUTH_THROTTLE_LIMIT=1000" -Encoding ASCII
        Add-Content -Path $envFile -Value "AUTH_THROTTLE_REFRESH_LIMIT=1000" -Encoding ASCII
    }
}
Step "relaxed AUTH_THROTTLE_LIMIT/REFRESH_LIMIT for smoke env (parity with CI; prod untouched)"
```

Set BOTH limits (login + refresh), matching CI — the `.env.example` note pairs them, and a flow that
refreshes a token would still trip the refresh limiter if only the login limit were raised. Use the
large-limit approach, NOT `AUTH_THROTTLE_TTL=1` — a 1-second window can still be tripped by 4 workers
logging in inside the same second.

## Do NOT
- Do NOT change the API code or `auth-throttle.config.ts` defaults. Production stays at 5/60s.
- Do NOT touch `.env.example`, `playwright.yml`, or any committed env/workflow file — only the
  run-time provisioned smoke env inside `smoke-pr.ps1`.
- Do NOT touch any test spec or `tests/e2e/**` (that is the separate durable follow-up prompt,
  `pr-smoke-share-worker-tokens`).
- Do NOT change the DB-repoint logic; only ADD the throttle lines after it.

## Verify before opening the PR
- `grep -q "AUTH_THROTTLE_LIMIT" scripts/pipeline/smoke-pr.ps1` returns true.
- The added lines sit AFTER the `$SmokeDb` repoint and BEFORE `pnpm install`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already applied.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- This is a PowerShell harness change; there is no `pnpm` unit test for it. Do not run the full
  smoke as verification (it needs Docker + a browser) -- the grep checks above are sufficient.
