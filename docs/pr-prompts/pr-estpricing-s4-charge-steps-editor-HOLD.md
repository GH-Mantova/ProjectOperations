---
premise: '! grep -q "ChargeStepsEditor" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
premise_means: The Reference Data screen has no way to see or edit how a rate table turns into money.
scope:
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
  - apps/api/src/modules/rates/rate-tables.controller.ts
  - apps/api/src/modules/rates/rate-tables.service.ts
done_when: pnpm build && pnpm lint && grep -q "ChargeStepsEditor" apps/web/src/pages/admin/RatesListsAdminPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: true
cluster: estimating-pricing
cluster_order: 5
requires_on_main: 'apps/api/prisma/schema.prisma :: chargeSteps'
---

# The step-list editor on Reference Data

## What it is

A card on `RatesListsAdminPage`, between Columns and Rows, showing how the selected table turns a
rate into money — as a numbered list of plain sentences, not a formula. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Each row is `[step number] [operation] [field or number] [optional condition] [running total]`.
The running total is shown beside every step and is computed against a scenario the admin picks at
the top of the card — real rows, real numbers. **It stays a plain measurement until a price enters
it**, so a depth of 18 mm reads `18 mm`, not `$18.00`.

Steps reorder with up/down controls; order is the only structure. A step whose condition is not met
renders greyed with "not applied" beside it, so a rule that did not fire is as visible as one that
did.

Below the list, a collapsed "Show this as a formula" disclosure renders the same calculation as an
expression, read-only, so nothing is hidden from someone who does know spreadsheets.

## What to build

1. **`ChargeStepsEditor.tsx`** — the card. Reads and writes `chargeSteps` on the selected table.
   Fields offered come from the table's own columns plus the line inputs; a text field is offered
   only inside a condition, never as an arithmetic operand.
2. **`RatesListsAdminPage.tsx`** — mount it between the Columns and Rows cards. A table whose
   VALUE columns are quantities rather than prices (`isReference`) shows an explanation instead of
   an editor.
3. **API** — a PATCH on the rate-tables controller accepting a step list, validated server-side
   against the evaluator's own step schema. Reject an unknown operation, a step naming a field that
   is not on the table, and a list of steps whose first entry is not `start`.
4. **Impact line** — the card states how many open tenders price against this table and that a
   change applies to new lines only, tenders with locked rates keeping their snapshot.
5. **Test** for the editor covering add, remove, reorder, condition add/remove, and that an invalid
   list cannot be saved.

## Do NOT

- Do not switch any pricing path over to the step list in this slice.
- Do not touch `RATES_CANONICAL_SOURCE` or the legacy/hub switch.
- Do not alter the Columns or Rows cards beyond mounting the new one.
- Do not use `eval` anywhere. The client renders steps; the server validates them.
- Do not touch `/sot/`.

## VERIFY

- `pnpm --filter @project-ops/web test` green.
- Brand tokens only — sot/01 SECTION 5 is permanent. No hardcoded colour values.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
