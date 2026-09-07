---
premise: '! grep -q "api-tokens" tests/e2e/pr-acceptance/api-helpers.ts'
premise_means: The pr-acceptance harness still logs in per-worker-process; API tokens are not yet minted once and shared across Playwright workers.
scope:
  - tests/e2e/**
done_when: grep -rq "api-tokens" tests/e2e/pr-acceptance/api-helpers.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Smoke harness: mint API tokens ONCE and share them across Playwright workers (durable fix)

**FOLLOW-UP to `pr-smoke-relax-auth-throttle`. Arm this only AFTER that prompt's PR has merged**
(i.e. `grep -q "AUTH_THROTTLE_LIMIT" scripts/pipeline/smoke-pr.ps1` is true on main). It is the
structural fix; the throttle-relax is the immediate unjam. They touch disjoint files and do not
conflict, but running both PRs' smokes concurrently while the harness is still jammed is pointless.

## Why (root cause)

The pr-acceptance suite runs with 4 Playwright workers = 4 separate Node processes. The token caches
in `tests/e2e/pr-acceptance/api-helpers.ts`, `tests/e2e/pr-acceptance/helpers.ts` and
`tests/e2e/auth.setup.ts` are per-process in-memory `Map`s, so each worker cold-logs-in as admin +
field worker. That is N× the logins and is what trips the API's per-IP login throttle. Relaxing the
throttle (the sibling prompt) is the tourniquet; sharing ONE token set is the structural cure and
keeps the real throttle exercised instead of switched off.

## What to build

1. In `tests/e2e/auth.setup.ts` (runs ONCE, before the workers): after it authenticates, mint the
   API access tokens for admin + field worker (+ viewer if used) via `POST /auth/login` and write
   them to a single JSON file, e.g. `tests/e2e/.auth/api-tokens.json` (`{ [email]: accessToken }`).
   Do this once, in the setup project — not per worker.
2. In `tests/e2e/pr-acceptance/api-helpers.ts` (and `helpers.ts` if it has its own login path):
   `cachedLoginToken` should read that JSON file FIRST and return the stored token; only fall back
   to a live `POST /auth/login` if the file/token is missing. Keep the existing in-process cache as
   a second layer.
3. Ensure the token file path is git-ignored (mirror how `.auth/` storage-state files are handled)
   and is regenerated each run by setup.

Result: 2-3 logins for the WHOLE run regardless of worker count — well under 5/60s — so the harness
passes even at the production throttle.

## Do NOT
- Do NOT modify `scripts/pipeline/smoke-pr.ps1` (that is the sibling prompt's file — no two-actor
  collision on one file).
- Do NOT change any product/API code or `auth-throttle.config.ts`.
- Do NOT weaken assertions in the acceptance specs; only change how tokens are obtained.

## Verify before opening the PR
- `grep -rq "api-tokens" tests/e2e/pr-acceptance/api-helpers.ts` and `tests/e2e/auth.setup.ts`.
- `pnpm build` passes (the harness TS still type-checks).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already done.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` must pass.
