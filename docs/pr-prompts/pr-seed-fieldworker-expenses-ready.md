---
premise: '! grep -A30 "Field Worker" apps/api/prisma/seed-initial-services.ts | grep -q "expenses.view"'
premise_means: The seeded Field Worker role still lacks expenses permissions, so the field Expenses tab 403s for every field worker.
scope:
  - apps/api/prisma/seed-initial-services.ts
done_when: pnpm lint && grep -A30 "Field Worker" apps/api/prisma/seed-initial-services.ts | grep -q "expenses.view"
size: 1
gate_allow: none
seed_only: true
escalates: false
---

# Seed: grant Field Worker role expenses.view + expenses.manage (Marco-authorised 2026-08-03)

Marco explicitly authorised this grant on 2026-08-03 (authorization grants are his call —
this one is made). The field app ships an Expenses tab to every field worker
(`FieldLayout.tsx` nav) whose API requires `expenses.view`/`expenses.manage`
(`expenses.controller.ts:50,73`), which the seeded role lacks — raw 403 on every tap.

## What to build

1. Add `expenses.view` and `expenses.manage` to the Field Worker role's permission list in
   `seed-initial-services.ts` (locate the role block; ground the exact permission-code
   strings against the expenses controller decorators first).
2. Do NOT add `expenses.approve` — approval stays with managers.
3. PR body must carry this note verbatim for Marco: "PROD STEP (yours): add expenses.view +
   expenses.manage to the Field Worker role via Settings -> Roles in production — seeds only
   cover fresh/dev databases."

## Do NOT
- Do NOT touch any other role, the expenses API, or the field UI.
- Do NOT write to any production database.

## VERIFY
- `pnpm lint`; the two codes appear in the Field Worker block; seed runs clean if a local
  harness exists (state if not runnable).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
