---
premise: ! test -f apps/web/src/dashboards/widgets/reportChartWidget.tsx
premise_means: SLICE 4 of the reporting-dashboard plan (generic ReportChartWidget, bar) is not built.
scope:
  - apps/web/src/dashboards/**
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/dashboards/widgets/reportChartWidget.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/web/src/dashboards/widgets/reportTableWidget.tsx
---

# feat(web): ReportChartWidget (SLICE 4)

Implement **SLICE 4** of `docs/plans/reporting-dashboard-layout-plan.md` EXACTLY: create
`reportChartWidget.tsx` (same lifecycle as the table widget; renders `BarChartWidget` from
`@project-ops/ui`; renders a friendly stub for unknown chart types per plan §6.3); extend
`registerReportWidgets` to emit `report:chart:<key>` for definitions with a `chart` spec; add the
smoke test + one `batch1-dashboards.spec.ts` flow. NO schema change.

## Do NOT
- Do NOT modify the BI reporting layer or `DashboardCanvas.tsx`. No migration. No `/sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` (+ tests) pass before opening the PR. Never ask for approval.
