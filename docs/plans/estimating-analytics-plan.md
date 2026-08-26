# Estimating-Analytics Program — Plan (SLICE-0)

**Status:** SLICE-0 emitted 2026-08-12. EA-1 + EA-2 slice prompts authored (HOLD).

## Program context

This program adds an **"Estimating Analytics" curated global dashboard** on top of the
existing reporting/dashboard framework. It **assembles** already-shipped report
definitions plus two NEW read-only definitions that fill the specific gaps Marco
identified. It is **NOT** an Excel-style free-form pivot builder (that is a separate,
bigger program and explicitly out of scope).

### Reuse map — grounded against `origin/main` (2026-08-12)

| Artifact | Path | What to reuse |
|---|---|---|
| `ReportDefinition` framework + `REPORT_DEFS` array | `apps/api/src/modules/reporting/reporting.service.ts` | New reports drop in as one `ReportDefinition` object each; zero schema change. |
| Shipped win-rate reports (by estimator / client / value band / reason / time) | `apps/api/src/modules/reporting/reporting.service.ts` + `apps/api/src/modules/reporting/tender-winloss-report.definitions.ts` | Do NOT rebuild — the preset assembles these keys. |
| `leadTimeDays` (submittedAt − createdAt, rounded, null-safe) | `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` | Share/reuse — do NOT duplicate the maths. |
| Global-dashboard model + service | `apps/api/prisma/schema.prisma` (`Dashboard { scope: "GLOBAL" }`), `apps/api/src/modules/platform/dashboards.service.ts` | The preset is a `Dashboard` row with `scope: "GLOBAL"` + child `DashboardWidget` rows. |
| Global-dashboard seeding pattern | `apps/api/prisma/seed.ts` (see `seed-home-dashboard` upsert around L354) | Model the preset upsert on this pattern (idempotent, stable id). |
| Web dashboard shell | `apps/web/src/dashboards/GlobalDashboardPage.tsx`, `DashboardSwitcher.tsx`, `CustomisePanel.tsx`, `DashboardCanvas.tsx` | The preset renders inside this shell — no bespoke page. |
| Report widget factories | `apps/web/src/dashboards/widgets/reportRegistry.ts` (+ `reportChartWidget.tsx`, `reportTableWidget.tsx`) | `report:table:<key>` / `report:chart:<key>` widgets are auto-generated per definition. |
| Tendering time-series widgets (submitted-vs-won quarterly/monthly) | `apps/web/src/dashboards/widgets/tendering.tsx` | Reuse as-is if the preset wants that shape. |

### What this program is NOT

- **NOT** a rebuild of `tender-winloss-*` reports (already shipped in `tender-winloss-report.definitions.ts` — the preset ASSEMBLES them).
- **NOT** a duplication of `leadTimeDays` maths — reuse the win-likelihood feature service.
- **NOT** the pipeline dashboard (queued as `pr-crm-s6-pipeline-dashboard`). The preset REFERENCES pipeline value; it does not rebuild it.
- **NOT** an Excel-style free-form pivot builder. Out of scope.
- **NOT** a bespoke standalone page. The home is inside the existing global-dashboard mechanism.

---

## Locked decisions (PR-Master panel, 2026-08-12) — bake in, do NOT re-litigate

| # | Decision |
|---|---|
| EA-D1 | **Reuse, don't rebuild.** Win-rate is shipped. The two NEW definitions are only the GAPS: estimator turnaround/lead-time, and qty-vs-$ throughput. |
| EA-D2 | **No schema change** — both new reports are read-only `ReportDefinition`s over existing tables. If EA-2's preset genuinely requires a seeded global-dashboard ROW (a data migration), THAT slice — and only that slice — carries `gate_allow: migrations` + a rollback strategy and sets `escalates: true`. |
| EA-D3 | **Turnaround = days-to-quote**, reusing win-likelihood's `leadTimeDays`. **Exclude still-open tenders** (count only submitted/quoted). Group by estimator. Params: estimator / client / period / date-range. |
| EA-D4 | **qty-vs-$ throughput** = count of tenders priced vs Σ `estimatedValue`, per estimator. |
| EA-D5 | **Role-gated visibility.** Estimators see their OWN performance (self-view filters to the current user); managers/leadership see the ALL-estimator rollup. The report params + preset must respect role. |
| EA-D6 | **Home = inside the reporting/dashboard framework** (a curated "Estimating Analytics" GLOBAL dashboard preset), NOT a bespoke page. Keep the preset focused (priority metrics), not a wall of widgets. |
| EA-D7 | **Excel-style free-form pivot builder is OUT of scope** for this brief. |

---

## Guardrails (all slices, non-negotiable)

1. **NO schema change for EA-1.** Both new report definitions are read-only aggregations over existing tables. If EA-2 needs a seeded row, that is a `gate_allow: migrations` data migration on EA-2 only.
2. **Reuse the reporting/dashboard framework.** No bespoke page, no bespoke pivot UI, no new widget subsystem.
3. **Reuse `leadTimeDays`.** Import from `win-likelihood-features.service.ts`. Do NOT re-derive `submittedAt − createdAt`.
4. **Role gate the numbers.** Estimator self-view MUST NOT expose another estimator's rows. Managers see the rollup.
5. **Exclude still-open tenders** from turnaround (only submitted/quoted count).
6. **No permission invention.** Reuse the existing `reports.view` (or the equivalent already applied on the reporting controller — read it before wiring).

---

## Ordered slices

### EA-1 — Two new report definitions (backend + registry wiring + tests)

**Slug:** `report-defs`
**Gate:** `gate_allow: none` (no schema change). `escalates: false`.
**Primary artifact:** `apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts`

**What it builds:**
- New file `estimating-analytics-report.definitions.ts` exporting an array of `ReportDefinition`
  with two entries:
  - **`estimator-turnaround`** — average days-to-quote per estimator. Uses
    `WinLikelihoodFeaturesService.leadTimeDays` (or the shared derivation exported by that
    file — reuse, do not re-derive). **Excludes tenders that are still open** — count only
    submitted/quoted. Group by estimator. Params: `estimator`, `client`, `from`, `to`.
    Columns: estimator, count, avgDaysToQuote, medianDaysToQuote (if trivially derivable).
    Optional bar chart: avgDaysToQuote per estimator.
  - **`estimator-qty-vs-value`** — throughput per estimator: `count` of tenders priced vs
    `sumEstimatedValue` (Σ `estimatedValue`). Params: `estimator`, `client`, `from`, `to`.
    Columns: estimator, priced, sumEstimatedValue. Optional dual-axis chart.
- Append both defs into `REPORT_DEFS` (import via the existing `TENDER_WINLOSS_REPORT_DEFS`
  spread pattern in `reporting.service.ts`).
- **Role gate at compute time.** When the current user's role is estimator-only, the `run()`
  method MUST filter to `assignedEstimatorId = currentUser.id` (self-view). When manager/
  leadership, no self-filter (rollup across all estimators). Read the existing reporting
  controller/service for the `ReportRunParams` shape and how `currentUser` is threaded — do
  NOT invent a new plumbing pattern; if the existing framework lacks a currentUser context,
  add the smallest possible plumbing to pass it into `run()`.
- **Decimal handling:** convert `estimatedValue` (Prisma `Decimal?`) with `decimalToNumber()`
  (already exported by `reporting.service.ts`).
- Register report widgets in `apps/web/src/dashboards/widgets/reportRegistry.ts` if any
  wiring is needed beyond the factory auto-generation (read the file first — the factory
  may already register any def with columns automatically).
- Unit tests (`estimating-analytics-report.definitions.spec.ts`): score maths, exclusion of
  open tenders (turnaround), null-safe `leadTimeDays`, `Decimal` conversion, role-filter
  behaviour (estimator sees own only; manager sees all), sort order.

**Dependency:** none (`WinLikelihoodFeaturesService` already merged).

### EA-2 — "Estimating Analytics" curated GLOBAL dashboard preset

**Slug:** `dashboard-preset`
**Primary artifact:** the preset ROW (seeded in `apps/api/prisma/seed.ts`) OR a
code-defined preset registry the admin service installs on-demand — the slice prompt picks
one after reading the current global-dashboard mechanism. If the choice requires a
Prisma data migration (SQL that upserts the row), the slice carries **`gate_allow: migrations`
+ `escalates: true` + a `rollback_strategy` line**. If it lands purely as a `seed.ts` edit
plus a code-defined widget list, `gate_allow: none` is fine.
**Chain:** `requires_file_on_main: apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts`

**What it builds:**
- A curated `Dashboard { scope: "GLOBAL" }` row (stable id: `seed-estimating-analytics-dashboard`)
  with a focused set of `DashboardWidget` rows referencing existing report keys — an example
  layout (agent may tune count/position, but keep the preset FOCUSED not a wall of widgets):
  1. `report:chart:tender-winloss-by-estimator` (win rate — SHIPPED)
  2. `report:table:tender-winloss-by-client` (win rate by client — SHIPPED)
  3. `report:chart:tender-winloss-by-value-band` (win rate by value band — SHIPPED)
  4. `report:chart:estimator-turnaround` (NEW from EA-1)
  5. `report:chart:estimator-qty-vs-value` (NEW from EA-1)
  6. Tendering time-series widget (submitted-vs-won monthly) via `tendering.tsx`
  7. Pipeline value widget — if `pr-crm-s6-pipeline-dashboard` has landed, link to its
     widget key; otherwise fall back to the existing `estimatedValue` / `closedTenders` defs.
- Preset date-range / estimator / client params are threaded via the existing dashboard
  parameter mechanism (read `CustomisePanel.tsx` / `DashboardCanvas.tsx` for the pattern).
- **Role gate the preset view.** When a user is estimator-only, the widgets render with
  `estimator = currentUser.id` (self-view). Manager/leadership sees the unfiltered rollup.
  EA-1's role-gate at compute time is the enforcement point; the preset must pass the
  correct params so it works end-to-end.
- Add nav entry / DashboardSwitcher entry (follow existing convention).
- Tests: dashboard row exists with the expected slug and widget keys; role gating passes
  the right params.

**Dependency:** `requires_file_on_main: apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts`

---

## Sequencing

```
EA-1 (report defs) ──► EA-2 (curated global-dashboard preset)
```

EA-2 must NOT run before EA-1's definition file is on `main` — enforced by
`requires_file_on_main` on the EA-2 prompt.

---

## Files authored in this SLICE-0

- `docs/plans/estimating-analytics-plan.md` (this file)
- `docs/pr-prompts/pr-ea-s1-report-defs-HOLD.md`
- `docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md`
