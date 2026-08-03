# Reporting dashboard layout — binding slice plan

**Status:** SLICE-0 (this document). Every code slice below chains behind it via
`requires_merged`. Slices ship independently, each ≤ ~10 files, each CI-green.
**Owner:** Marco / ProjectOperations desktop-shell.
**Ask (verbatim):** Marco likes the Reports screen (cross-module BI: pick a report, filter,
chart + table, export). He wants it folded into the dashboard module so a user can create a
custom dashboard on a **"reporting" layout** — compose report widgets, filters, and export in
a saved dashboard.

Nothing here changes existing report or dashboard behaviour. No schema change is required in
the primary path; one optional schema slice (SLICE 8) is called out under `gate_allow: schema`
with a rollback strategy and is not the default execution path.

---

## 1. Ground truth (evidence pinned to files/lines seen on origin/main, 2026-08-03)

### 1a. What "a report" is today (BI reporting layer)
- **Definition registry.** `apps/api/src/modules/reporting/reporting.service.ts:52-60` —
  each report is a `ReportDefinition` (`key`, `title`, `description`, `parameters`, `columns`,
  optional `chart`, `run(prisma, params)`). New reports drop in by pushing an entry into
  `REPORT_DEFS`; the controller, exporter, and web page pick them up without further wiring
  (comment at `reporting.service.ts:6-13`).
- **HTTP surface.** `apps/api/src/modules/reporting/reporting.controller.ts`:
  - `GET /reporting/definitions` (`:44-49`) → `ReportDefinitionSummary[]`
  - `GET /reporting/:reportKey?from&to&projectId&clientId` (`:52-63`) → `ReportRunResponse`
  - `GET /reporting/:reportKey/export?format=xlsx|csv|pdf&…` (`:65-85`) → binary download
  - Every route is gated by `@RequirePermissions("reporting.view")` and `JwtAuthGuard +
    PermissionsGuard` (`:37`).
- **Parameter shape (today).** `ReportRunParams = { from?, to?, projectId?, clientId? }`
  (`reporting.service.ts:40-45`). The `parameters` array on each definition tells the UI
  which of those four to render — there is no free-form filter set today. This is important
  for §3 (filter model) — the plan does **not** invent new filter axes.
- **Response shape.** `ReportRunResponse` (`reporting.service.ts:71-76`) includes the
  full definition summary plus `params`, `rows[]`, optional `totals`, and `generatedAt`.
- **Export.** `reporting-export.service.ts` (imported at controller line 9) turns the same
  run into `{ buffer, filename, contentType }` for the three formats. The web page
  (`apps/web/src/pages/reports/ReportsPage.tsx:156-188`) already streams the blob via
  `Content-Disposition` filename — this is the same code path a widget-embedded export
  would call.
- **Web page.** `apps/web/src/pages/reports/ReportsPage.tsx` (440 lines) — left sidebar
  report list, filter row, "Run report" + three "Export …" buttons, chart (bar only via
  `BarChartWidget`), table with totals row. Renders one report at a time; no persistence.

### 1b. What "a dashboard" is today (dashboard system)
- **Files in scope.** `apps/web/src/dashboards/**` (17 files, 5667 LOC total across the top
  level; 3448 LOC across `widgets/`). Key entries:
  - `types.ts` — `UserDashboardConfig`, `WidgetConfigEntry`, `WidgetMeta`, `WidgetCategory`,
    `WidgetSubConfig`, `WidgetFilters = Record<string, unknown>` (`types.ts:15`).
  - `widgetRegistry.ts` (894 lines) — the flat `WIDGET_BY_TYPE` map; every widget declares
    `type`, `name`, `category`, `size/…Span`, optional `fieldSchema`/`configSchema`, and
    `component`.
  - `DashboardCanvas.tsx` (906 lines) — grid + dnd + auto-save; reads
    `WIDGET_BY_TYPE`, renders each `WidgetConfigEntry` through its component with
    `{ config, globalPeriod, colSpan, rowSpan, onConfigChange }`.
  - `WidgetGalleryModal.tsx` (785 lines) — "Add widget" surface; groups by category /
    submodule; the "Group by Module" view keys off `WidgetMeta.submodule` (`types.ts:139-141`).
  - `WidgetSettingsPopover.tsx` (556 lines) — per-widget settings editor driven by
    `configSchema`.
  - `CustomisePanel.tsx` (293 lines) — global dashboard-level panel (period, layout).
  - `NewDashboardModal.tsx` (234 lines) — "Copy from" source picker (`copySourceDashboards`
    in `types.ts:74-78`).
  - `SmartWizardModal.tsx` (271 lines) + `smartWizardCatalog.ts` (235 lines) — role/persona-
    based "build me a dashboard" flow.
- **Schema (per-user dashboards).** `apps/api/prisma/schema.prisma:2424-2439` — `UserDashboard`
  is `{ userId, name, slug, isSystem, isDefault, config: Json }` with unique
  `(userId, slug, isSystem)`. **The layout/kind concept does not exist as a field**; today
  the JSON `config` holds `{ period, widgets: WidgetConfigEntry[] }` only
  (`types.ts:37-40`).
- **HTTP surface.** `GET/POST/PATCH/DELETE /user-dashboards`, `POST
  /user-dashboards/:id/default` — served by
  `apps/api/src/modules/platform/user-dashboards.controller.ts` +
  `user-dashboards.service.ts`. React Query keys defined in
  `apps/web/src/dashboards/userDashboards.ts`.
- **Second dashboard family (older, unused by the personal-dashboards canvas).**
  `schema.prisma:618-654` — `Dashboard` + `DashboardWidget` (`scope`, `ownerUserId`,
  `position/width/height`, per-row config). Served by
  `apps/api/src/modules/platform/dashboards.{controller,service}.ts`. **This plan does not
  touch that family** — the personal-canvas UI uses `UserDashboard`. See §7 out-of-scope.
- **Routes.** `apps/web/src/App.tsx`:
  - `/reports` → `ReportsPage` (`App.tsx:95, 450`)
  - Dashboards routed via `UserDashboardPage` / `GlobalDashboardPage` (both delegate to
    `DashboardCanvas`).
- **Nav.** `apps/web/src/components/ShellLayout.tsx:203-208` — sidebar "Reports" entry
  `to: "/reports"` gated `reporting.view`. Breadcrumb at `:435`.
- **sot references.** `sot/01-charter-and-architecture.md` §12 (Dashboard system),
  `sot/06-dashboard-widget-catalogue.md` (widget inventory), `sot/01` §9 (nav / IA). Any
  concept change lands via SLICE 10 doc-reconcile — never mixed with code.

### 1c. What is missing to compose reports as widgets
1. `WidgetCategory` (`types.ts:80-88`) currently enumerates `operations | tendering | jobs |
   maintenance | forms | compliance | safety | custom`. **No `reporting` category.** Adding it
   is a type-level change (SLICE 3).
2. There is no widget today that renders a `/reporting/:reportKey` run. A generic
   `ReportTableWidget` + `ReportChartWidget` pair does not exist.
3. `WidgetSubConfig.filters` is `WidgetFilters = Record<string, unknown>` — the slot exists
   but no widget reads BI report parameters into it. A widget's `configSchema` translates
   report `parameters` into edit-panel controls; this convention needs to be codified.
4. There is no export affordance on any widget. The BI export endpoint is only reachable
   through `ReportsPage`.
5. The dashboard has no notion of "layout kind." `UserDashboardConfig` is `{ period,
   widgets }` — no `layout: "grid" | "reporting"` field. See §3 for the additive-vs-schema
   decision.
6. `NewDashboardModal` "Copy from" seeds only from existing dashboards. There is no
   "reporting starter" template.

---

## 2. Target concept — what a "reporting layout" dashboard is

Marco's ask reads as **one** feature: create a dashboard that behaves like Reports plus
persistence, composition, and side-by-side comparison. There are three ways to model it —
the plan picks (A) and defers (B/C) unless (A) proves insufficient.

**Option A — additive, no schema change (chosen default).**
A "reporting dashboard" is an ordinary `UserDashboard` whose widgets happen to come from a
new `reporting` `WidgetCategory`. Every BI report becomes selectable in
`WidgetGalleryModal` as one of two widget types:
- `report:table:<reportKey>` — renders rows + totals.
- `report:chart:<reportKey>` — renders the chart (bar today; extensible when the BI layer
  gains more chart types).
Each report widget:
- Owns per-widget filters in `WidgetSubConfig.filters` (existing field), edited through
  `WidgetSettingsPopover` off the definition's `parameters`.
- Exposes an "Export" affordance in the widget chrome that hits
  `/reporting/:reportKey/export?format=…` with the widget's filters.
- Composes with a **dashboard-level filter bar** in `CustomisePanel` — widget filters
  override dashboard-level ones when both are set (rule spelled out in SLICE 5).
A "reporting starter" template (SLICE 7) is added to `NewDashboardModal`: one click seeds a
canvas pre-populated with one widget per report and no filters. The user then rearranges,
filters, and saves — a plain `UserDashboard` on the wire.

**Why A first:** zero schema change, zero migration, additive on both sides, and the
`WidgetSubConfig.filters` slot already exists — the plan just fills it in with a
convention. Ships in ~7 small slices without touching Prisma.

**Option B — new `layoutKind: "grid" | "reporting"` field on UserDashboard (deferred).**
If Marco decides the canvas chrome for a reporting dashboard must differ (e.g. no free
resize, single-column stack, report-first title bar, dashboard-level export-all), we add
`layoutKind` on `UserDashboard` and branch the canvas. SLICE 8 lays this out under
`gate_allow: schema` with rollback; **not on the default path**. Marco decides after
SLICE 7 lands whether to run SLICE 8.

**Option C — retire ReportsPage, replace with dashboards (rejected in this plan).**
Deletes the drill-in single-report workflow; loses "quickly run one report without
persisting anything" and creates a discoverability regression. Not in scope; if Marco
requests it later it is its own plan.

**Explicit disposition of the existing `ReportsPage`:** stays. It is the fast-path
drill-in for a single report; the dashboard route is the composed/persistent path. Once
Option-A widget parity holds (SLICE 6 done), ReportsPage becomes a candidate for later
consolidation — **not in this plan**.

---

## 3. Reuse map (what is used as-is, what is added)

| Piece                                                | Existing?                       | Slice used-by |
|------------------------------------------------------|---------------------------------|---------------|
| `GET /reporting/definitions`                         | yes (controller.ts:44)          | 3, 4          |
| `GET /reporting/:reportKey`                          | yes (controller.ts:52)          | 3, 4          |
| `GET /reporting/:reportKey/export`                   | yes (controller.ts:65)          | 6             |
| `reporting.view` permission                          | yes (controller.ts:45)          | 3, 4, 6, 7    |
| `UserDashboard` schema                               | yes (schema.prisma:2424)        | all           |
| `UserDashboardConfig = { period, widgets }`          | yes (types.ts:37)               | all           |
| `WidgetSubConfig.filters`                            | yes (types.ts:15, 17-23)        | 3, 4, 5       |
| `WidgetMeta` + `WIDGET_BY_TYPE`                      | yes (widgetRegistry.ts)         | 3, 4          |
| `WidgetGalleryModal` category grouping               | yes (WidgetGalleryModal.tsx)    | 3, 4          |
| `WidgetSettingsPopover` (configSchema-driven)        | yes (WidgetSettingsPopover.tsx) | 5             |
| `CustomisePanel` (dashboard-level controls)          | yes (CustomisePanel.tsx)        | 5             |
| `NewDashboardModal` "Copy from" template surface     | yes (NewDashboardModal.tsx)     | 7             |
| `BarChartWidget` (from `@project-ops/ui`)            | yes (ReportsPage.tsx:2)         | 4             |
| **`WidgetCategory = "reporting"`**                   | NEW                             | 3             |
| **Generic `ReportTableWidget` component**            | NEW                             | 3             |
| **Generic `ReportChartWidget` component**            | NEW                             | 4             |
| **Registry factory `registerReportWidgets(defs[])`** | NEW                             | 3             |
| **Per-widget export button**                         | NEW                             | 6             |
| **Dashboard-level filter bar (from/to/project/etc.)**| NEW                             | 5             |
| **"Reporting starter" template**                     | NEW                             | 7             |
| **`layoutKind` field on UserDashboard** (Option B)   | NEW / OPTIONAL                  | 8 (deferred)  |

**Rule of reuse:** no rewrite of the BI reporting layer, no rewrite of the dashboard engine.
Every new widget is registered through the existing `WIDGET_BY_TYPE` mechanism; no changes
to `DashboardCanvas.tsx` unless SLICE 8 (Option B) is exercised.

---

## 4. Slice list (ordered, independently shippable)

Each slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. Only SLICE 8 (the
optional Option-B path) declares `gate_allow: schema` — every other slice is code-only or
docs-only.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/reporting-dashboard-layout-plan.md`.
- **Gate/CI:** `pnpm build && pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below.

### SLICE 1 — Marco decision + widget-type naming convention (docs-only) `size:1`
- **Files:** `docs/plans/reporting-dashboard-layout-conventions.md`.
- **Purpose:** capture two decisions:
  1. **Option A vs Option B** — default execution is A. Marco signs off in a `PENDING-MARCO`
     block that B (schema change) is deferred until parity is achieved on A.
  2. **Widget-type naming.** Format `report:table:<reportKey>` and `report:chart:<reportKey>`
     — kebab-case reportKey unchanged, colon delimiter (matches the flat namespace already
     used in `WIDGET_BY_TYPE`; no existing type uses `:`, so no collision risk).
- **Requires:** SLICE 0.

### SLICE 2 — BI definitions read for widget bootstrap (docs-only audit) `size:1`
- **Files:** `docs/audits/reporting-definitions-parity.md`.
- **Purpose:** enumerate every `ReportDefinition` currently in `REPORT_DEFS`, and for each,
  record: parameters exposed, columns, whether a `chart` is defined, and whether any column
  format is currently unrepresented by widget rendering primitives (`text | number |
  currency | date | badge` from `WidgetField.type`). Any gaps become work items for SLICE 3
  or a new WidgetField type. **Audit-only — no code**, so the parity report is stable input
  for SLICE 3.
- **Requires:** SLICE 1.

### SLICE 3 — `WidgetCategory = "reporting"` + `ReportTableWidget` + factory `size:7`
- **Files (target ≤ 7):**
  - `apps/web/src/dashboards/types.ts` — add `"reporting"` to `WidgetCategory`.
  - `apps/web/src/dashboards/widgets/reportTableWidget.tsx` — generic widget: props include
    `reportKey`; reads `WidgetSubConfig.filters` for `{from,to,projectId,clientId}`; calls
    `/reporting/:reportKey?…` on mount + whenever filters change; renders the table (reuses
    the `s7-table` markup from `ReportsPage.tsx:362-408`).
  - `apps/web/src/dashboards/widgets/reportRegistry.ts` — `registerReportWidgets(defs)` that,
    given a `ReportDefinitionSummary[]`, produces `WidgetMeta` entries for each definition
    that has `columns` (all of them, per SLICE 2's parity report). Each entry:
    - `type: "report:table:<key>"`, `name: def.title`, `category: "reporting"`,
      `submodule: def.key`, `description: def.description`, `size: "full"`,
      `defaultColSpan: 4`, `defaultRowSpan: 3`.
    - `configSchema` derived from `def.parameters` (date / string → `date` / `text`).
  - `apps/web/src/dashboards/widgetRegistry.ts` — call `registerReportWidgets` at module load
    with a lazy-loaded definitions list (bootstrapped via a small `getReportDefinitions`
    hook OR a top-of-tree effect that hydrates once — pick whichever avoids side effects at
    import; the factory returns entries synchronously, hydration re-runs it when the
    definitions arrive). Implementation detail is per-slice.
  - `apps/web/src/dashboards/widgets/__tests__/reportTableWidget.spec.tsx` — smoke test.
  - `apps/web/src/dashboards/__tests__/widgetGallery-reporting.spec.ts` — asserts the
    `reporting` category appears with N entries matching the definitions endpoint.
  - `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — add one flow: add a report widget
    from the gallery to a scratch dashboard and see it render rows.
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:web:logic` (SLICE 2 of the settings
  plan already fixed the vitest wiring, or run vitest locally with proof in the PR body).
- **Requires:** SLICES 1, 2.

### SLICE 4 — `ReportChartWidget` (bar) `size:4`
- **Files:**
  - `apps/web/src/dashboards/widgets/reportChartWidget.tsx` — same lifecycle as SLICE 3's
    table widget; renders `BarChartWidget` (reuse from `@project-ops/ui`, imported at
    `ReportsPage.tsx:2`). Skips itself gracefully if `def.chart` is absent.
  - `reportRegistry.ts` — extend factory to emit a second `WidgetMeta`
    (`type: "report:chart:<key>"`) for any definition with a `chart` spec.
  - `apps/web/src/dashboards/widgets/__tests__/reportChartWidget.spec.tsx`.
  - `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — flow: add a chart widget, assert
    the chart title renders.
- **Requires:** SLICE 3.

### SLICE 5 — Per-widget filter editing + dashboard-level filter bar `size:6`
- **Files:**
  - `apps/web/src/dashboards/CustomisePanel.tsx` — add a "Report filters" collapsible
    section that surfaces the union of `parameters` across all report widgets on the current
    dashboard (dedup by param name); persisted into `UserDashboardConfig` as
    `dashboardFilters` (see below). Only rendered when at least one report widget is
    present.
  - `apps/web/src/dashboards/types.ts` — extend `UserDashboardConfig` with an optional
    `dashboardFilters?: WidgetFilters` (JSON-back-compat: additive field on a JSON blob;
    no schema change).
  - `apps/web/src/dashboards/widgets/reportTableWidget.tsx` + `reportChartWidget.tsx` —
    resolver: `effectiveFilters = { ...dashboardFilters, ...widget.config.filters }` (widget
    overrides dashboard); pass to the `/reporting/:reportKey` fetch.
  - `apps/web/src/dashboards/WidgetSettingsPopover.tsx` — surface each `parameters` control
    as an editable field (`configSchema` already handles this — this slice just verifies the
    generated `configSchema` from SLICE 3 renders correctly here; may be a no-op).
  - `apps/web/src/dashboards/__tests__/dashboardFilters.spec.ts` — resolver unit test
    (widget overrides dashboard; empty widget filters fall through; empty dashboard filters
    leave widget filters intact).
  - `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — flow: set dashboard-level
    `from/to`, add two report widgets, override one, assert each widget hits its expected
    URL.
- **Requires:** SLICE 3.

### SLICE 6 — Per-widget export (Excel / CSV / PDF) `size:4`
- **Files:**
  - `apps/web/src/dashboards/widgets/reportWidgetChrome.tsx` — small shared export button
    component (three-format dropdown or triple button set); reuses the blob-download logic
    from `ReportsPage.tsx:156-188` (extract as a helper for both to import — same slice, so
    no duplication).
  - `apps/web/src/dashboards/widgets/reportTableWidget.tsx` +
    `reportChartWidget.tsx` — mount the chrome inside the widget frame; disabled while the
    widget is loading; passes the widget's effective filters to `/reporting/:key/export`.
  - `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — flow: click Export on a report
    widget, assert the download starts (or the Content-Disposition arrives, depending on
    e2e conventions used in the file).
- **Requires:** SLICE 5.

### SLICE 7 — "Reporting starter" template in NewDashboardModal `size:4`
- **Files:**
  - `apps/web/src/dashboards/NewDashboardModal.tsx` — add a "Templates" strip above the
    existing "Copy from" picker. First template: **"Reporting dashboard"** — creates a
    dashboard whose config contains one `report:table` widget per available definition
    (dashboardFilters left empty; user tunes from there).
  - `apps/web/src/dashboards/reportingTemplate.ts` — pure function that, given the current
    definitions list, produces a `UserDashboardConfig`.
  - `apps/web/src/dashboards/__tests__/reportingTemplate.spec.ts` — asserts the seeded
    config has one widget per definition, unique widget ids, all `visible: true`,
    monotonically increasing `order`.
  - `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — flow: create a dashboard from the
    Reporting template, land on the canvas, expect widgets to be present.
- **Requires:** SLICE 4 (chart widget must exist so the template can seed it if the
  definition has a chart; otherwise the template just seeds table widgets).

### SLICE 8 (OPTIONAL, DEFERRED) — `UserDashboard.layoutKind` field (Option B) `size:6`
- **Only exercised if Marco decides Option A's chrome is insufficient after SLICE 7 lands.**
- `gate_allow: schema` — declares a Prisma migration adding `layoutKind String @default("grid")`
  to `user_dashboards`.
- **Rollback strategy:**
  1. Migration is additive with a default — safe to run on live data.
  2. Rollback = drop the column (migration `revert` script provided in the same slice).
  3. UI branches on `layoutKind === "reporting"` inside `DashboardCanvas.tsx`; if reverted,
     the canvas falls back to the current grid behaviour (branch removed with the code
     revert).
- **Files:**
  - `apps/api/prisma/schema.prisma` — add field.
  - `apps/api/prisma/migrations/<ts>_add_user_dashboard_layoutkind/migration.sql` — up + down.
  - `apps/api/src/modules/platform/user-dashboards.service.ts` — accept + persist `layoutKind`
    on create/update.
  - `apps/web/src/dashboards/types.ts` — extend `UserDashboard` with `layoutKind`.
  - `apps/web/src/dashboards/DashboardCanvas.tsx` — branch on `layoutKind`.
  - `apps/api/src/modules/platform/user-dashboards.service.spec.ts` — coverage.
- **Requires:** SLICE 7, plus explicit Marco go-ahead.

### SLICE 9 — sot doc-reconcile (`sot/01` §12 + `sot/06`) `size:1`
- **Files:** `sot/01-charter-and-architecture.md` (§12 dashboard system — record the
  `reporting` widget category, filter composition rule, export path), and
  `sot/06-dashboard-widget-catalogue.md` (add report widgets to the catalogue).
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Requires:** every code slice merged (SLICES 3-7, plus SLICE 8 if exercised).

---

## 5. Filter composition rule (spelled out — MUST be honoured by every report widget)

Given a report widget with:
- `dashboardFilters: Partial<{from, to, projectId, clientId}>` (from
  `UserDashboardConfig.dashboardFilters`, may be undefined/empty)
- `widgetFilters: Partial<{from, to, projectId, clientId}>` (from
  `WidgetConfigEntry.config.filters`, may be undefined/empty)

the effective query is: `effective = { ...dashboardFilters, ...widgetFilters }`.

Rules:
1. **Widget overrides dashboard.** If both set `from`, the widget's `from` wins. Rationale:
   users who bother to open a widget's settings intended to specialise it.
2. **Explicit empty vs missing.** An explicitly empty string in `widgetFilters` (e.g. user
   cleared it) clears the field for that widget — treat empty string as an override.
   Missing key defers to the dashboard filter.
3. **Fields the definition does not declare are dropped** before the request. The BI DTO
   (`ReportRunQueryDto`) currently accepts only `from/to/projectId/clientId` — passing
   others is harmless but wasteful; drop for cleanliness.

The rule is unit-tested in SLICE 5.

---

## 6. Risks

### 6.1 Widget bootstrap timing
`registerReportWidgets` needs `/reporting/definitions` to know the definitions; the
`widgetRegistry` module today is populated at import time (static). If the bootstrap runs
lazily, `WidgetGalleryModal` may render before report widgets exist. Mitigation: gallery
subscribes to the same query cache; hydrate on modal open. Called out in SLICE 3 file list
so the implementer picks lazy-with-hydration, not import-time async.

### 6.2 Report parameters that gain new axes
If BI adds `siteId` or similar to `ReportRunParams` post-plan, the composed dashboard filter
bar must pick it up. Because `WidgetSubConfig.filters` is `Record<string, unknown>` and the
per-widget filter editor is driven by the definition's `parameters`, this is additive on
both sides — no code change in the widget beyond the DTO update. Documented so it stays
that way.

### 6.3 Chart-type expansion
Today only `type: "bar"` exists. `ReportChartWidget` should render a friendly stub for
unknown chart types rather than throwing. Called out in SLICE 4.

### 6.4 e2e coverage churn
Every widget-adding slice appends flows to `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`.
Each slice PR body must list the flows it added.

### 6.5 Confusion with the older `Dashboard`/`DashboardWidget` model family
`schema.prisma:618-654` still ships the older row-per-widget model. This plan does not
touch it. If a future slice consolidates the two, that is its own plan.

### 6.6 Export button vs page-level "Export all"
Option A does not offer "export all widgets on this dashboard as one file." If Marco wants
that, it lands via Option B (SLICE 8) alongside the branched chrome. Not planned here.

### 6.7 SmartWizardModal parity
The Smart Wizard (`SmartWizardModal.tsx`) drives persona-based dashboard seeding. The
reporting template lives in `NewDashboardModal` (SLICE 7) — Wizard integration is a
follow-up, not blocking. If Marco wants the Wizard to also seed reporting dashboards,
schedule as a small follow-on slice after SLICE 7.

---

## 7. Out of scope

- Rewriting the BI reporting layer (`apps/api/src/modules/reporting/**`). This plan composes;
  it does not rewrite. Any new report definition still lands via `REPORT_DEFS`.
- Rewriting the dashboard engine (`DashboardCanvas.tsx`, `widgetRegistry.ts`).
  Option A adds widgets only; Option B (SLICE 8) branches chrome only.
- Consolidating the older `Dashboard`/`DashboardWidget` schema (`schema.prisma:618-654`) with
  `UserDashboard`. Separate plan if needed.
- Deleting or superseding `ReportsPage.tsx`. Kept as the fast-path drill-in; consolidation
  is a later cycle.
- Warehouse / Power BI embed (mentioned as a "future slices" comment in
  `reporting.service.ts:11-13`). Not this plan.
- New BI report definitions. If the Reporting → Dashboard integration exposes gaps, they
  are logged in SLICE 2's audit and handled by whichever BI team owns `REPORT_DEFS`.
- Any change to `/sot/` outside SLICE 9's doc-reconcile.
- Mobile / Field surface. Field has its own dashboard shell; this plan is desktop-only.

---

## 8. Verification of this document

- [x] `test -f docs/plans/reporting-dashboard-layout-plan.md`
- [x] Every reused file/endpoint in §1 is pinned to a file:line seen on origin/main
      2026-08-03.
- [x] Every new/changed identifier in §3 references either an existing symbol or a slice
      that creates it.
- [x] SLICE 8 (schema) declares `gate_allow: schema` and a rollback strategy; every other
      slice is code-only or docs-only.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
