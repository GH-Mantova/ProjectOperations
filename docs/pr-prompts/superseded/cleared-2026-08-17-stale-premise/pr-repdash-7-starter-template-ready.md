---
premise: ! test -f apps/web/src/dashboards/reportingTemplate.ts
premise_means: SLICE 7 of the reporting-dashboard plan (the "Reporting dashboard" starter template in NewDashboardModal) is not built.
scope:
  - apps/web/src/dashboards/**
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/dashboards/reportingTemplate.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/web/src/dashboards/widgets/reportChartWidget.tsx
---

# feat(web): "Reporting dashboard" starter template (SLICE 7)

Implement **SLICE 7** of `docs/plans/reporting-dashboard-layout-plan.md` EXACTLY: add a "Templates"
strip to `NewDashboardModal.tsx` with a **"Reporting dashboard"** option; create `reportingTemplate.ts`
(pure fn: given the definitions list → a `UserDashboardConfig` seeding one `report:table` widget per
definition, unique ids, visible, increasing order); add `__tests__/reportingTemplate.spec.ts` and one
e2e flow (create from template → land on canvas → widgets present).

## Do NOT
- Do NOT alter the SmartWizard (follow-up per plan §6.7). No migration. No `/sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` (+ tests) pass before opening the PR. Never ask for approval.
