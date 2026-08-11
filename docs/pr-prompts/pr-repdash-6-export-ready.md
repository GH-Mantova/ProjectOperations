---
premise: ! test -f apps/web/src/dashboards/widgets/reportWidgetChrome.tsx
premise_means: SLICE 6 of the reporting-dashboard plan (per-widget Excel/CSV/PDF export) is not built.
scope:
  - apps/web/src/dashboards/**
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/dashboards/widgets/reportWidgetChrome.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/web/src/dashboards/__tests__/dashboardFilters.spec.ts
---

# feat(web): per-widget report export (SLICE 6)

Implement **SLICE 6** of `docs/plans/reporting-dashboard-layout-plan.md` EXACTLY: create
`reportWidgetChrome.tsx` (shared Excel/CSV/PDF export control; extract the blob-download helper from
`ReportsPage.tsx` so both import it — no duplication); mount it in the table + chart widgets, disabled
while loading, passing the widget's effective filters to `/reporting/:key/export`; add one e2e flow.

## Do NOT
- Do NOT change the export endpoint or the BI layer. No migration. No `/sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if impossible. `pnpm build` + `pnpm lint` (+ tests) pass before opening the PR. Never ask for approval.
