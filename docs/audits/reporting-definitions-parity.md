# Reporting definitions parity audit (SLICE 2)

**Status:** SLICE 2 of `docs/plans/reporting-dashboard-layout-plan.md`. Docs-only. No code,
no schema, no `/sot/` touches.

**Owner:** Marco / ProjectOperations desktop-shell.
**Requires:** SLICE 1 (`docs/plans/reporting-dashboard-layout-conventions.md`, merged).
**Unblocks:** SLICE 3 (`WidgetCategory = "reporting"` + `ReportTableWidget` + factory) and
SLICE 4 (`ReportChartWidget`).

## Purpose

Enumerate every `ReportDefinition` currently in `REPORT_DEFS`
(`apps/api/src/modules/reporting/reporting.service.ts:139-371`) as the authoritative input
for the factory in SLICE 3 / SLICE 4. For each definition, record:

1. **Parameters** exposed on `ReportDefinitionSummary.parameters` (drives the widget's
   generated `configSchema` per SLICE 3).
2. **Columns** and their `format`.
3. Whether a `chart` is defined (drives whether SLICE 4 emits a
   `report:chart:<key>` widget).
4. Whether any column `format` is currently **unrepresented by widget rendering primitives**
   — `WidgetField.type` is `"currency" | "text" | "date" | "number" | "badge"`
   (`apps/web/src/dashboards/types.ts:107-112`). Gaps become work items for SLICE 3 (or a
   new `WidgetField` type).

Evidence pinned to origin/main at commit `34da8284` (2026-08-06).

## Source of truth

- BI definitions: `apps/api/src/modules/reporting/reporting.service.ts:139-371`.
- BI type contracts: `apps/api/src/modules/reporting/reporting.service.ts:15-45` —
  `ReportParamName = "from" | "to" | "projectId" | "clientId"`;
  `ReportColumnSpec.format = "text" | "number" | "currency" | "percent" | "date"`;
  `ReportChartSpec.type = "bar"`.
- Widget rendering primitives: `apps/web/src/dashboards/types.ts:107-112` — `WidgetField.type
  = "currency" | "text" | "date" | "number" | "badge"`.

The BI format axis and the widget primitive axis are **not** identical:

| BI `format`  | Widget primitive              | Notes                                                          |
|--------------|-------------------------------|----------------------------------------------------------------|
| `text`       | `text`                        | 1:1.                                                           |
| `number`     | `number`                      | 1:1.                                                           |
| `currency`   | `currency`                    | 1:1.                                                           |
| `date`       | `date`                        | 1:1. Definitions emit ISO string (`toISOString()`).            |
| `percent`    | **(none — GAP)**              | See §"Format gaps" — resolved in SLICE 3 as pre-formatted text |
| *(unset)*    | `text`                        | Definitions omit `format` on categorical columns (e.g. status).|

`badge` on the widget side has no BI counterpart today; it is safely unused by the report
factory in SLICE 3.

## Definitions inventory

### 1. `tender-pipeline`

Live tenders grouped by status with count and total estimated value; filter by creation
window and (optionally) client. Defined at `reporting.service.ts:140-195`.

- **Parameters (3):** `from` (date), `to` (date), `clientId` (string). None marked
  `required`. `clientId` has helperText.
- **Columns (3):**
  - `status` — format unset → widget primitive `text`.
  - `count` — format `number`.
  - `estimatedValue` — format `currency`.
- **Chart:** `{ type: "bar", xKey: "status", yKey: "count", title: "Tenders by status" }`
  → SLICE 4 emits `report:chart:tender-pipeline`.
- **Format parity:** clean. No unrepresented format.
- **Widget types produced:** `report:table:tender-pipeline`,
  `report:chart:tender-pipeline`.

### 2. `tender-win-rate`

Submitted / awarded / lost tenders per estimator, with rolling win rate; window measured
against tender submission date. Defined at `reporting.service.ts:196-261`.

- **Parameters (2):** `from` (date), `to` (date).
- **Columns (5):**
  - `estimator` — format unset → widget primitive `text`.
  - `submitted` — format `number`.
  - `awarded` — format `number`.
  - `lost` — format `number`.
  - `winRatePct` — **format `percent` — GAP** (see §"Format gaps").
- **Chart:** `{ type: "bar", xKey: "estimator", yKey: "winRatePct", title: "Win rate (%)
  by estimator", unit: "%" }` → SLICE 4 emits `report:chart:tender-win-rate`.
  - **Note:** `ReportChartSpec.unit` is set (`"%"`). `BarChartWidget` in `@project-ops/ui`
    is passed the unit today by `ReportsPage`; SLICE 4 must plumb `def.chart.unit` into
    `BarChartWidget` identically so parity holds for percent-axis charts.
- **Format parity:** ONE gap (`percent` on `winRatePct`).
- **Widget types produced:** `report:table:tender-win-rate`,
  `report:chart:tender-win-rate`.

### 3. `job-status-summary`

Live jobs grouped by status with count; filter by creation window and (optionally) client.
Defined at `reporting.service.ts:262-296`.

- **Parameters (3):** `from` (date), `to` (date), `clientId` (string). None marked
  `required`.
- **Columns (2):**
  - `status` — format unset → widget primitive `text`.
  - `count` — format `number`.
- **Chart:** `{ type: "bar", xKey: "status", yKey: "count", title: "Jobs by status" }` →
  SLICE 4 emits `report:chart:job-status-summary`.
- **Format parity:** clean.
- **Widget types produced:** `report:table:job-status-summary`,
  `report:chart:job-status-summary`.

### 4. `worker-competency-expiry`

Worker competencies expiring within the selected window (defaults to next 90 days). Proxy
for WHS ticket / licence expiry until the full compliance-alert surface ships. Defined at
`reporting.service.ts:297-347`.

- **Parameters (2):** `from` (date, helperText "Defaults to today"), `to` (date,
  helperText "Defaults to +90 days"). Definition applies its own defaults when both are
  absent — the widget must not paper over `undefined` filters with client-side defaults;
  let the server apply them.
- **Columns (4):**
  - `worker` — format unset → widget primitive `text`.
  - `competency` — format unset → widget primitive `text`.
  - `expiresAt` — format `date` (ISO string from `toISOString()`).
  - `daysToExpiry` — format `number`.
- **Chart:** `undefined` — SLICE 4 emits **no** chart widget for this definition.
- **Format parity:** clean.
- **Widget types produced:** `report:table:worker-competency-expiry`. **No chart widget.**

### 5. `asset-utilisation-snapshot`

Current asset register grouped by status. Snapshot view. Defined at
`reporting.service.ts:348-370`.

- **Parameters (0).** Widget's `configSchema` for this report is therefore empty; the
  settings popover renders nothing. Dashboard-level filters (SLICE 5) are also inert for
  this widget because the definition ignores `ReportRunParams` — SLICE 5's filter
  composition rule still applies (fields the definition does not declare are dropped
  before the request, per plan §5.3), so the widget silently ignores dashboard filters.
- **Columns (2):**
  - `status` — format unset → widget primitive `text`.
  - `count` — format `number`.
- **Chart:** `{ type: "bar", xKey: "status", yKey: "count", title: "Assets by status" }`
  → SLICE 4 emits `report:chart:asset-utilisation-snapshot`.
- **Format parity:** clean.
- **Widget types produced:** `report:table:asset-utilisation-snapshot`,
  `report:chart:asset-utilisation-snapshot`.

## Aggregate counts

- **Definitions in `REPORT_DEFS`:** 5.
- **Definitions with `columns` (all eligible for `report:table:*`):** 5.
- **Definitions with `chart` (eligible for `report:chart:*`):** 4 — all except
  `worker-competency-expiry`.
- **Total widgets emitted by the factory in SLICES 3+4:** 5 table + 4 chart = **9**.
- **Distinct parameter names across all definitions:** 3 — `from`, `to`, `clientId`.
  `projectId` (declared on `ReportParamName`) is not referenced by any current definition.
  The dashboard-level filter bar in SLICE 5 dedups parameters across widgets on the
  current dashboard, so it will present at most those three today.
- **Distinct column formats used:** 4 — `text` (implicit + explicit), `number`,
  `currency`, `date`, `percent`. Widget primitive `badge` is unused.

## Format gaps

**One gap:** column format `percent`, used only by `tender-win-rate.winRatePct`
(`reporting.service.ts:210`). `WidgetField.type` has no `percent` primitive.

**Resolution (recommended, per SLICE 3 boundaries):** the `report:table:*` widget does
**not** need to introduce a new `WidgetField` type. `ReportsPage.tsx` today renders
`percent`-format cells by pre-formatting the number and displaying as text (the BI layer
returns a number like `55.5`, the page appends `%`). The `report:table:*` widget in
SLICE 3 should mirror that: switch on `column.format === "percent"` and render the value
as text with a trailing `%`, keeping right-alignment. No `WidgetField` schema change is
required, and the audit records this as a **rendering-adapter concern local to
`reportTableWidget.tsx`**, not a schema gap.

**Alternative (rejected here):** adding `percent` to `WidgetField.type`. Would ripple
through `WidgetSettingsPopover`, `configSchema` handling, and every widget that consumes
`fieldSchema`. Out of scope for SLICE 3 and unjustified by a single BI column today. If a
future BI column expands the surface, revisit as its own slice.

**No other gaps.** Every remaining column format (`text`, `number`, `currency`, `date`, and
implicit `text` on unset) has a 1:1 widget primitive.

## Chart-side parity notes

`ReportChartSpec.type` is currently the literal `"bar"` (`reporting.service.ts:33`).
`ReportsPage.tsx` uses `BarChartWidget` unconditionally. SLICE 4 keeps that unconditional
mapping and, per plan risk §6.3, renders a friendly stub if a future `def.chart.type` is
unrecognised rather than throwing.

`ReportChartSpec.unit` is optional and set only on `tender-win-rate` today (`"%"`). SLICE 4
must pass `def.chart.unit` through to `BarChartWidget` verbatim so the axis label matches
what `ReportsPage` renders.

## Parameters axis — what SLICE 3 must emit as `configSchema`

`ReportParameterSpec.type` is `"date" | "string"` (`reporting.service.ts:17-23`). The web
`ConfigFieldType` is `"select" | "multiselect" | "period" | "number" | "text" | "textarea"`
(`apps/web/src/dashboards/types.ts:118`) — there is **no `date` primitive** in
`ConfigField`. This is a **secondary gap** worth flagging for SLICE 3:

- **Definitions affected:** every definition with a `from`/`to` parameter — i.e. 4 of 5
  (`asset-utilisation-snapshot` is the only exception).
- **Resolution options for SLICE 3 (implementer picks; called out here so it is not a
  surprise):**
  1. **Map `from` + `to` together to `ConfigFieldType: "period"`.** The dashboard already
     has a period concept (`UserDashboardConfig.period`), and `WidgetSettingsPopover`
     understands `period`. Preferred: reuses an existing primitive and lets the widget
     inherit dashboard-level period when the user does not override.
  2. **Extend `ConfigFieldType` with `"date"`.** Cleaner semantics but ripples through
     `WidgetSettingsPopover` and every consumer of `ConfigField`. Rejected here as
     out-of-scope for SLICE 3 unless SLICE 3 already has budget.
  3. **Fall back to `"text"` with placeholder `YYYY-MM-DD`.** Ugly. Only use if (1) and
     (2) are both blocked; SLICE 3's PR body should justify.

Option (1) is the recommended default for SLICE 3. `clientId` (string) maps cleanly to
`ConfigFieldType: "text"` — or, if SLICE 3 wires up `dynamicOptions` for a client picker,
to `"select"` with `dynamicOptions: "clients"` (would require adding `"clients"` to the
`dynamicOptions` union on `types.ts:125`; a further small extension, out of scope for
SLICE 2's audit but noted).

## Work items surfaced by this audit (for SLICE 3 / SLICE 4)

- **W1 (SLICE 3):** `report:table:<key>` widget must handle
  `column.format === "percent"` by rendering as text with trailing `%`, right-aligned.
  No `WidgetField` schema change.
- **W2 (SLICE 3):** the factory-generated `configSchema` for `from`/`to` parameters
  should collapse into a single `ConfigFieldType: "period"` field per widget (rather than
  two separate `date` fields), and inherit `UserDashboardConfig.period` when the widget
  does not override.
- **W3 (SLICE 3):** the factory-generated `configSchema` for `clientId` parameters maps
  to `ConfigFieldType: "text"`. Upgrading to `"select" + dynamicOptions: "clients"` is a
  follow-on, not blocking.
- **W4 (SLICE 4):** `BarChartWidget` must receive `def.chart.unit` verbatim so the
  percent-axis label on `tender-win-rate` matches `ReportsPage`.
- **W5 (SLICE 4):** definitions with `chart: undefined` (only `worker-competency-expiry`
  today) MUST NOT produce a chart widget. Factory skips them.
- **W6 (SLICE 5):** `asset-utilisation-snapshot` accepts zero parameters — the
  dashboard-level filter bar must not force filter values into its request. The plan §5.3
  drop-unknown-fields rule already handles this; audit flags it so the SLICE 5 unit test
  covers a zero-parameter definition.

## Not surfaced by this audit

- BI report **totals** shape (`ReportRunResult.totals`). Every current definition emits a
  totals row; the `report:table:*` widget in SLICE 3 should render it identically to
  `ReportsPage.tsx:395-407` (last row, distinguished styling). Not a parity gap — no
  action item beyond "mirror ReportsPage's totals row markup".
- BI export format list (`xlsx | csv | pdf`) — that is SLICE 6's concern; every
  definition supports all three unconditionally today per
  `reporting.controller.ts:65-85`, and the widget-side export chrome in SLICE 6 offers
  all three uniformly.
- New BI definitions. If BI adds a report post-audit, re-run this audit (or add an entry
  inline) and repeat the parity check before SLICE 3's factory picks it up.

## Verification of this document

- [x] `test -f docs/audits/reporting-definitions-parity.md`
- [x] Every definition in `REPORT_DEFS` (5 total) has an entry with parameters, columns,
      chart status, and format-parity assessment.
- [x] The one column-format gap (`percent`) and one parameter-type gap (`date`) are
      called out with recommended, non-schema-changing resolutions for SLICES 3 / 4.
- [x] Every claim pinned to a file:line seen on origin/main at `34da8284` (2026-08-06).
- [ ] `pnpm lint` (run at PR-open time; docs-only change, no code paths touched).
