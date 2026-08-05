---
premise: ! test -f docs/plans/reporting-dashboard-layout-conventions.md
premise_means: SLICE 1 of the reporting-dashboard plan (the Option-A decision + widget-type naming convention doc) is not written yet.
scope:
  - docs/plans/**
done_when: pnpm lint && test -f docs/plans/reporting-dashboard-layout-conventions.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# docs: reporting-dashboard conventions (SLICE 1)

Implement **SLICE 1** of `docs/plans/reporting-dashboard-layout-plan.md` (merged): create
`docs/plans/reporting-dashboard-layout-conventions.md` capturing (1) **Option A is Marco-confirmed
(2026-08-06)** — reports become composable widgets, no schema change; Option B / SLICE 8 (a
`layoutKind` schema field) stays DEFERRED until Marco asks; (2) the widget-type naming convention
`report:table:<reportKey>` and `report:chart:<reportKey>` (kebab reportKey, colon delimiter — no
collision with existing `WIDGET_BY_TYPE` types). Follow the plan's SLICE 1 exactly.

## Do NOT
- Do NOT write code or touch `/sot/` — this is a single docs/plans file.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm lint` passes before opening the PR. Never ask for approval.
