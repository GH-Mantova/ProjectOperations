---
premise: '! grep -q "vitest" .github/workflows/ci.yml'
premise_means: CI still never runs the web vitest suite, so ShellLayout.nav.test.ts (and friends) cannot fail a PR — the blind spot that let a contradictory nav test sit on main.
scope:
  - apps/web/package.json
  - .github/workflows/ci.yml
done_when: pnpm lint && grep -q "vitest" .github/workflows/ci.yml
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Settings restructure SLICE 2 — wire vitest into CI (the nav-test blind spot)

Per docs/plans/settings-restructure-plan.md §3 SLICE 2 and risk §5.2. Verified:
`.github/workflows/ci.yml:115` runs `pnpm test:web:logic`, which maps to a Tendering smoke
only (`apps/web/package.json:13`); the real `test` script (`vitest run`,
`apps/web/package.json:12`) never runs in CI.

## What to build

1. Make the web CI job run the vitest suite as well: either chain it into `test:web:logic`
   (keep the Tendering smoke, add vitest) or add a discrete CI step
   `pnpm --filter @project-ops/web test`. Prefer whichever keeps job output readable.
2. FIRST fix any currently-failing vitest tests this uncovers — run the suite locally in the
   worktree before wiring CI; the nav test may still assert pre-restructure structure. Fix
   test expectations to CURRENT main reality (do not change app code to satisfy stale tests).
3. Prove the gate bites: in the PR body, cite the local vitest run output (pass count).

## Do NOT
- Do NOT restructure nav/settings here — this slice only closes the CI hole.
- Do NOT remove or weaken the Tendering smoke.

## VERIFY
- `pnpm lint`; `grep -q "vitest" .github/workflows/ci.yml`; local vitest run green, output in PR body.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
