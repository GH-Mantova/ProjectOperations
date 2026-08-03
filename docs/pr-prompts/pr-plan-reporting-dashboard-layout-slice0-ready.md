---
premise: '! test -f docs/plans/reporting-dashboard-layout-plan.md'
premise_means: No plan exists yet for a custom "reporting" dashboard layout; the BI reporting surface and the dashboard widget system are separate today.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/reporting-dashboard-layout-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: a "reporting" dashboard layout — user-composed reports as a dashboard

Author `docs/plans/reporting-dashboard-layout-plan.md` (house style of docs/plans/settings-restructure-plan.md).
Plan document only.

Marco's ask: he likes the Reports screen (cross-module BI: pick a report, filter, chart + table,
export). He wants it incorporated into the dashboard module so a user can create a **custom dashboard
on a "reporting" layout** — compose report widgets, filters, and export in a saved dashboard.

## Ground first (cite file:line)
- The BI reporting layer (PR #720): its report registry, filter model, data endpoints, and export
  path (Excel/CSV/PDF) — what a "report" is made of server-side.
- The dashboard system: `apps/web/src/dashboards/**` (DashboardCanvas, WidgetGalleryModal,
  CustomBuilderWidget, CustomisePanel, types.ts, hooks.ts) and the Dashboard/Widget schema — how a
  dashboard, its layout, and its widgets are stored and rendered; whether a "layout kind" concept
  exists or must be added.
- sot/01 SECTION 12 (Dashboard system) + the dashboard-widget catalogue in sot/06.

## The plan must decide/cover
1. **Concept:** what a "reporting layout" dashboard is vs the existing widget dashboards — a new
   dashboard `layout`/`kind`, or report-type widgets in the normal canvas, or both. Justify.
2. **Report-as-widget:** how a BI report (with its filters + export) becomes a placeable, saveable
   widget; how per-widget filters and dashboard-level filters compose; export from within the dashboard.
3. **Reuse, don't rebuild:** explicitly map which existing reporting + dashboard pieces are reused so
   this is additive (the Reports page itself stays or is superseded — state which).
4. **Ordered slices** (each ≤ ~10 files, `requires_merged` edges, rollback notes; migration slices
   carry `gate_allow: migrations` + `rollback_strategy`) and a risks section.

## Do NOT
- Do NOT write code in this slice — plan document only (`scope` is `docs/plans/**`).
- Do NOT edit `/sot/` — decisions land via a doc-reconcile slice.
- Do NOT rebuild the BI reporting layer or the dashboard engine; the plan composes them.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/reporting-dashboard-layout-plan.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
