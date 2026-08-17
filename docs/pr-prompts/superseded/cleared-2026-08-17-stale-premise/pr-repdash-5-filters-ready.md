---
premise: ! grep -q "dashboardFilters" apps/web/src/dashboards/types.ts
premise_means: SLICE 5 of the reporting-dashboard plan (per-widget + dashboard-level report filters) is not built.
scope:
  - apps/web/src/dashboards/**
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && grep -q "dashboardFilters" apps/web/src/dashboards/types.ts && test -f apps/web/src/dashboards/__tests__/dashboardFilters.spec.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/web/src/dashboards/widgets/reportTableWidget.tsx
---

# feat(web): report widget filters + dashboard filter bar (SLICE 5)

Implement **SLICE 5** of `docs/plans/reporting-dashboard-layout-plan.md` EXACTLY: add optional
`dashboardFilters?: WidgetFilters` to `UserDashboardConfig` (additive JSON field, NO schema change);
add a "Report filters" section to `CustomisePanel.tsx` (union of report-widget `parameters`, only when
a report widget is present); resolve `effectiveFilters = { ...dashboardFilters, ...widget.config.filters }`
in the table + chart widgets (widget overrides dashboard — the rule in plan §5, incl. empty-string
override semantics); add `__tests__/dashboardFilters.spec.ts` and one e2e flow.

## Do NOT
- Do NOT add a Prisma migration (the field lives on the JSON `config`). No `/sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` (+ tests) pass before opening the PR. Never ask for approval.
