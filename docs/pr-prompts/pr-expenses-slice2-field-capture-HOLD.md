---
premise: '! grep -rqi "expense" apps/web/src/pages/field 2>/dev/null'
premise_means: There is no field/PWA expense capture yet.
scope:
  - apps/web/src/pages/field/**
  - apps/api/src/modules/expenses/**
done_when: pnpm build && pnpm lint && grep -rqi "expense" apps/web/src/pages/field
size: 5
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-expenses-slice1 MERGED (Expense model exists) -->
# HOLD — Expenses slice 2: field / PWA capture

STATUS: DRAFTED, STAGED, DO NOT ARM YET. Tier 1 of the D365-parity program. **ARM ONLY** after
`pr-expenses-slice1` merged (`grep -q "model Expense" apps/api/prisma/schema.prisma` on main).

## What to build
Branch: `feat/expenses-field-capture`. Reviewer: `GH-Mantova`. No migration.
Add expense capture to the field PWA (`apps/web/src/pages/field/`, FieldLayout): a worker snaps/records
an expense on-site — amount, category, project/job, photo of receipt (reuse the existing offline
photo/attachment pattern) — submitted through the existing `expenses` API (`submit`). Must work with
the offline outbox (queue + sync) like the other field surfaces. Add a nav/action entry in FieldLayout.

## Do NOT
- Do NOT change the Expense schema or the approval flow (slice 1 owns those). Do NOT add OCR (slice 3).
- Do NOT build a new offline mechanism — reuse the existing IndexedDB outbox. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If Expense model not on main, STOP `NO-OP: predecessor not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — leave the PR for Marco.
