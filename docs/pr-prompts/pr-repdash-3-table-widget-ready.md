---
premise: ! test -f apps/web/src/dashboards/widgets/reportTableWidget.tsx
premise_means: SLICE 3 of the reporting-dashboard plan (the `reporting` WidgetCategory + generic ReportTableWidget + registerReportWidgets factory) is not built.
scope:
  - apps/web/src/dashboards/**
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/dashboards/widgets/reportTableWidget.tsx && grep -q "reporting" apps/web/src/dashboards/types.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: docs/audits/reporting-definitions-parity.md
---

# feat(web): reporting widget category + ReportTableWidget (SLICE 3)

Implement **SLICE 3** of `docs/plans/reporting-dashboard-layout-plan.md` EXACTLY (its §4 SLICE 3 file
list): add `"reporting"` to `WidgetCategory` (`types.ts`); create a generic `reportTableWidget.tsx`
that reads `WidgetSubConfig.filters` and renders `/reporting/:reportKey` rows+totals (reuse the
`s7-table` markup from `ReportsPage.tsx`); create `registerReportWidgets(defs)` producing `WidgetMeta`
entries (`report:table:<key>`, category `reporting`, configSchema from `def.parameters`); wire it into
`widgetRegistry.ts` with lazy hydration (no import-time async — see plan §6.1); add the smoke + gallery
tests and one `batch1-dashboards.spec.ts` flow. Option A (Marco-confirmed) — NO schema change.

## Do NOT
- Do NOT modify the BI reporting layer or `DashboardCanvas.tsx`. Do NOT add a migration. Do NOT touch `/sot/`.
- Do NOT exceed the plan's SLICE 3 file set.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` (+ the named tests) pass before opening the PR. Read the CI log before diagnosing. Never ask for approval.
