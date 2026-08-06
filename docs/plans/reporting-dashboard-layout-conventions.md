# Reporting dashboard layout — conventions (SLICE 1)

**Status:** SLICE 1 of `docs/plans/reporting-dashboard-layout-plan.md` (merged).
Captures the two decisions that SLICES 3–7 depend on. Docs-only. No code, no schema, no
`/sot/` touches.

**Owner:** Marco / ProjectOperations desktop-shell.
**Requires:** SLICE 0 (the plan itself, already merged).
**Unblocks:** SLICE 2 (definitions parity audit) and SLICE 3 (`WidgetCategory =
"reporting"` + `ReportTableWidget` + factory).

---

## Decision 1 — Option A vs Option B (execution path)

**Marco-confirmed 2026-08-06: default execution is Option A.**

- **Option A (chosen).** A "reporting dashboard" is an ordinary `UserDashboard`.
  Reports become composable widgets via a new `reporting` `WidgetCategory`. No schema
  change, no migration; the existing `WidgetSubConfig.filters` slot carries per-widget
  BI parameters. Ships in SLICES 3–7.
- **Option B (deferred).** Add a `layoutKind: "grid" | "reporting"` field on
  `UserDashboard` so the canvas chrome can branch (e.g. no free resize, dashboard-level
  export-all). Lives in SLICE 8 under `gate_allow: schema` with the additive-column +
  drop-on-revert rollback strategy called out in the plan. **DEFERRED until Marco asks
  after SLICE 7 lands** — the trigger is "Option A's chrome is insufficient", not a
  schedule.

Rationale for A-first (from plan §2):
1. Zero schema change, zero migration.
2. Additive on both API and web sides.
3. `WidgetSubConfig.filters` already exists as `Record<string, unknown>`; SLICES 3–5
   just fill it with a convention.
4. Every slice stays ≤ ~10 files and CI-green independently.

Option C (retire `ReportsPage`, replace with dashboards) remains rejected in this plan
per §2 of the parent plan — `ReportsPage.tsx` stays as the fast-path drill-in.

### Trigger to revisit Option B

Only reopen Option B if, after SLICE 7 ships, one of the following is true:

- Marco requests dashboard-level "export all widgets as one file" (plan risk §6.6).
- The grid canvas chrome (free resize, per-widget headers) is judged wrong for a pure
  reporting layout and a stacked / single-column mode is needed.
- A reporting-only affordance emerges that cannot be expressed as a widget
  (`report:*`) or a dashboard-level control in `CustomisePanel`.

Absent one of those, SLICE 8 stays DEFERRED and is not scheduled.

---

## Decision 2 — Widget-type naming convention

Report widgets follow a **colon-delimited, three-segment** type string:

```
report:table:<reportKey>
report:chart:<reportKey>
```

Rules:

1. **Segment 1 — namespace:** literal `report`. Reserved for widgets whose backend is a
   BI `ReportDefinition` in
   `apps/api/src/modules/reporting/reporting.service.ts` (`REPORT_DEFS`).
2. **Segment 2 — render kind:** literal `table` or `chart`. `table` renders rows +
   totals via the widget's own copy of the `s7-table` markup used in
   `apps/web/src/pages/reports/ReportsPage.tsx` (rows 362–408). `chart` renders
   `BarChartWidget` from `@project-ops/ui` (as `ReportsPage.tsx:2` already does) and
   only emits a widget for definitions whose `chart` is defined. Additional render
   kinds are added by extending this segment (e.g. `report:kpi:<reportKey>`); no
   new kinds are introduced by SLICES 3–7.
3. **Segment 3 — `reportKey`:** the `ReportDefinition.key` verbatim (kebab-case, no
   normalization). Every existing key in `REPORT_DEFS` is already kebab-case; the
   registry factory must not lowercase, snake-case, or otherwise mutate the key.
4. **Delimiter:** ASCII colon `:`. Chosen because every existing entry in
   `WIDGET_BY_TYPE` (`apps/web/src/dashboards/widgetRegistry.ts`) uses snake_case
   identifiers with no `:` — the colon namespace is empty today, so
   `report:table:<key>` cannot collide with any current or plausibly-added
   snake_case type.

### Non-collision check (evidence)

Grepped `apps/web/src/dashboards/widgetRegistry.ts` — every current `type: "..."`
literal is snake_case (`ops_active_projects_kpi`, `ten_win_rate_kpi`,
`ops_jobs_by_status_donut`, …). No existing widget type contains `:`. Adding
`report:*` therefore introduces a fresh, disjoint sub-namespace.

### Examples

Given the current `REPORT_DEFS` list (audited in SLICE 2), the naming convention
produces:

| `ReportDefinition.key`      | Table widget `type`               | Chart widget `type` (if `def.chart`) |
|-----------------------------|-----------------------------------|--------------------------------------|
| `projects-by-status`        | `report:table:projects-by-status` | `report:chart:projects-by-status`    |
| `timesheets-utilisation`    | `report:table:timesheets-utilisation` | (only if `def.chart` present)    |
| `contracts-summary`         | `report:table:contracts-summary`  | (only if `def.chart` present)        |

SLICE 2 produces the authoritative list; SLICE 3 (table factory) emits one
`report:table:<key>` per definition with `columns`; SLICE 4 (chart factory) emits
`report:chart:<key>` only when `def.chart` is present.

### What the convention does NOT do

- Does not encode filter axes, permission scope, or category into the `type`.
  `category: "reporting"` and `permissions: ["reporting.view"]` live on the
  `WidgetMeta` object; the `type` string carries identity only.
- Does not version the widget. If a report definition changes shape incompatibly,
  the `reportKey` itself should change in `REPORT_DEFS` — the widget follows.
- Does not require alphabetical ordering. The factory preserves the order returned
  by `GET /reporting/definitions`; gallery grouping (`WidgetGalleryModal`) sorts by
  category first, then by name.

---

## Verification of this document

- [x] `test -f docs/plans/reporting-dashboard-layout-conventions.md`
- [x] Option-A confirmation dated 2026-08-06 and Option-B trigger conditions stated.
- [x] Naming convention specifies namespace, render kind, `reportKey` handling, and
      delimiter, plus a non-collision check against the current
      `widgetRegistry.ts`.
- [ ] `pnpm lint` (run at PR-open time; docs-only change, no code paths touched).
