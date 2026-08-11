---
premise: ! test -f apps/web/src/pages/handover/autoFieldSafeguards.ts
premise_means: B-HW-8 (auto-field safeguards — edited badge, reset-to-source, re-sync, derived variance) is not built.
scope:
  - apps/web/src/pages/handover/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/handover/autoFieldSafeguards.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/web/src/pages/handover/HandoverWizardPage.tsx
---

# feat(web): auto-field safeguards + derived variance (B-HW-8)

Implement **B-HW-8** of `docs/plans/contract-handover-wizard-plan.md`. On the wizard's auto-fields:
show an "edited — differs from source" badge when `isOverridden`, with a one-click **reset to
source** (restores `sourceValue`); before finalise, if the awarded quote changed since prefill,
show a "quote updated — re-sync?" prompt. Render the **quoted-vs-contracted variance** as a derived,
read-only figure (awarded quote total vs `Contract.contractValue`). Derived fields and completion %
stay non-editable.

## Do NOT
- Do NOT build compliance derivation, subbies, or finalise. Do NOT add a migration. Do NOT touch `/sot/`.

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
