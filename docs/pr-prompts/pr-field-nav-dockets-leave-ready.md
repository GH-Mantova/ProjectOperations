---
premise: '! grep -q "/field/dockets" apps/web/src/layouts/FieldLayout.tsx'
premise_means: The field mobile nav still omits /field/dockets and /field/leave, so two field-worker features are reachable only by typed URL.
scope:
  - apps/web/src/layouts/FieldLayout.tsx
  - tests/e2e/pr-acceptance/batch7-field.spec.ts
done_when: pnpm lint && grep -q "/field/dockets" apps/web/src/layouts/FieldLayout.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIELD nav: add Dockets and Leave (EXPLICIT Marco opt-in 2026-08-03)

The standing "FIELD nav is untouched" rule is LIFTED for exactly this change — Marco
explicitly approved adding these two entries on 2026-08-03. Nothing else in FieldLayout
changes.

## What to build

1. `FieldLayout.tsx`: add `/field/dockets` ("Dockets") and `/field/leave` ("Leave") to
   NAV_ITEMS and PAGE_TITLES, following the existing item shape. Check the bottom bar still
   fits at 390px (the existing batch7 spec asserts item count/size — see below); if 8 items
   overflow the 44px touch-target rule, use the layout's existing overflow pattern if one
   exists; if none exists, keep the bar to the most-used items and put the two new entries
   wherever the layout's design accommodates them honestly — state the choice in the PR body.
2. `batch7-field.spec.ts`: the "bottom nav with 5 items" style assertions must be updated to
   the new reality; keep the touch-target assertions.

## Do NOT
- Do NOT change any field page, the bell, or desktop nav.
- Do NOT fix the docket form entity bug here (already shipped separately).

## VERIFY
- `pnpm build && pnpm lint`; updated batch7 assertions consistent with the rendered nav.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
