---
premise: '! grep -q "seed-estimating-analytics-dashboard" apps/api/prisma/seed.ts'
premise_means: The "Estimating Analytics" curated global-dashboard preset row is not seeded yet — EA-2 has not run.
scope:
  - apps/api/prisma/seed.ts
  - apps/api/src/modules/platform/**
  - apps/web/src/dashboards/**
done_when: pnpm build && pnpm lint && grep -q "seed-estimating-analytics-dashboard" apps/api/prisma/seed.ts
size: 9
gate_allow: none
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive: the default path is a preset upsert into seed.ts with no
  UPDATE ... SET and no migration. Revert the PR to remove the preset row; no
  existing dashboard, report definition or user data is touched either way.
requires_on_main: 'apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts :: estimator-turnaround'
design_ref: https://claude.ai/code/artifact/10c03a71-0346-4a9e-8b07-7974fd191544
---
<!-- escalates was false until 2026-08-23. lint-prompt.mjs DESTRUCTIVE_MUST_ESCALATE fires
     because `scope` reaches apps/api/prisma/seed.ts AND the body mentions "backfill" in the
     conditional migration-path guidance below. The default path is genuinely additive, so
     `backfill: false` is a true assertion - but `escalates: false` on a prompt that can reach
     the seed file is the exact trap that lets merge-queue.ps1 auto-merge a CLEAN unlabelled PR.
     Marco: if you want this back on auto-merge, set escalates: false and reword the sub-bullet
     at "Satisfy Gate A" so the word does not appear. Supervisor chose the safe half. -->

# EA-2 — "Estimating Analytics" curated GLOBAL dashboard preset

**Binding plan:** `docs/plans/estimating-analytics-plan.md` (read it in full before starting).
This is **EA-2**, the second and final slice of the estimating-analytics program. It
**assembles** the existing shipped win-rate reports + EA-1's two new definitions into a
curated **`Dashboard { scope: "GLOBAL" }`** row via the existing dashboard mechanism. It is
**NOT** a bespoke page and **NOT** a pivot builder.

---

# AMENDMENT 2026-09-08 — READ THIS BEFORE THE BODY BELOW

Marco reviewed and approved the mock-up at `design_ref` on 2026-09-08 and said, in his own
words: *"I like the way the Estimating Analytics looks and feels. Make sure when staging this
PR, it reflects the UI/UX you built on the mock-up."*

**The mock-up is binding for UI/UX.** Where the body below and the mock-up disagree about what
the screen looks like or how it behaves, the mock-up wins. Open it before you write any code and
read its on-page grounding panel — it carries every measurement behind the sections that follow,
with file:line.

The body below is **retained as the record**, not erased. Four passages in it are superseded.

## A. The body seeds the WRONG TABLE. This blocks the whole slice.

The body says to seed `Dashboard` + `DashboardWidget` modelled on `seed-home-dashboard`. **That
subsystem cannot render a report widget at all.** `dashboards.service.ts:206-226` switches on a
fixed `kpi|bar_chart|line_chart|donut_chart|chart|table` list against a hardcoded `metricKey`
set and returns `{ type: "unsupported" }` for anything else, which `GlobalDashboardPage.tsx`
prints as "not renderable here".

Report widgets live on **`UserDashboard`** (`schema.prisma:2846`), seeded by
`seedUserDashboards()` at `seed.ts:3900`, rendered by `DashboardCanvas` at `/dashboards/:id`.
Config shape is
`{ period: WidgetPeriod, widgets: WidgetConfigEntry[], dashboardFilters?: WidgetFilters }`
(`apps/web/src/dashboards/types.ts:25-44`).

**Supersedes:** "Migration gate", "Grounded state on main" bullets 1-2, and "What to build" §1.
The stable id and the `isDefault: false` rule still stand.

## B. The widget shape in "What to build" §1 does not exist

`type: "report-chart"` with `config: { reportKey }` is not a shape this repo accepts. The report
key lives **inside the type string** — `report:chart:<key>` / `report:table:<key>`
(`reportRegistry.ts:117,132`) — and `WidgetSubConfig` is `{ period?, filters?, fields? }`. There
is no `reportKey` config field anywhere.

**`tender-winloss-by-estimator` does not exist.** The report that does that job is
**`tender-win-rate`** ("Tender win rate by estimator"), `reporting.service.ts:203`.

**Layout trap:** `registerReportWidgets` defaults every report widget to `colSpan: 4`. A preset
that omits `colSpan` renders as nine stacked full-width cards. The mock-up's spans are
`w4, w2, w2, w2, w2, w2, w2, w4, w2, w2` — use them.

## C. "Do NOT expose one estimator's numbers" is NOT satisfied by the body's §2

Self-filtering exists **only** in EA-1's two definitions. `tender-win-rate` — widget 1 in the
body's own list — and all five `tender-winloss-*` never read `currentUser`. Their only guard is
`@RequirePermissions("reporting.view")`. As the body specifies it, an estimator-only user sees
every colleague's win rate, in direct breach of Decision EA-D5 stated further down.

Worse, `selfFilterClause` tests `!isSuperUser`, not "estimator-only" — so an estimating manager
who is not a super-user is silently self-filtered, the opposite of this dashboard's intent.

**This needs Marco's ruling before the slice is armed.** Do not paper over it.

## D. Two live defects the mock-up surfaced, both outside this scope

1. **`config.period` never reaches a report widget.** Neither `reportChartWidget.tsx` nor
   `reportTableWidget.tsx` mentions `period`, `resolvePeriod` or `globalPeriod`. Every report
   widget runs **unwindowed, over all time**, while the picker above says "Last 30 days".
2. **Setting a Period on a report widget 400s it.** `buildConfigSchema` emits a `period` field
   (`reportRegistry.ts:66`), the settings popover writes it into `payload.filters`, `buildQuery`
   serialises it — but `ReportRunQueryDto` has no `period` and the global pipe runs
   `whitelist: true, forbidNonWhitelisted: true` (`bootstrap/create-app.ts:21-27`).

Fixing (2) needs `apps/api/src/modules/reporting/` — **not in this prompt's `scope`.**

## E. The UI/UX this PR must deliver, per the mock-up

All of the following sit inside `apps/web/src/dashboards/**`, which IS in scope:

- **A view-time filter bar** writing straight into `dashboardFilters`: the existing period
  presets, plus real `from`/`to` date inputs, `clientId` and `estimatorId`. **No schema change
  is needed** — `WidgetFilters` is `Record<string, unknown>` (`types.ts:15`) and
  `dashboardFilters` already exists (`:43`). Today the only editor is the customise drawer,
  which saves config rather than filtering a view.
- **A window-resolution line** stating which widgets obey which control, and whether a hand-typed
  date range has diverged from the selected preset. Given defect D-1, this is not cosmetic.
- **Filter-reachability chips** per card — `applied` / `available` / `not a parameter`. Measured:
  `estimatorId` is declared by **only** `estimator-turnaround` and `estimator-qty-vs-value`;
  `tender-win-rate` takes `from`/`to` only. A filter that cannot reach a widget must say so
  rather than look applied.
- **A per-widget override badge** where `config.filters` differs from the bar —
  `resolveEffectiveFilters` is `{...dashboardFilters, ...widgetFilters}` (`types.ts:208`) and an
  explicit empty string clears rather than defers.
- **A chart/table toggle** on every chart widget, the table face reproducing
  `reportTableWidget` exactly: `formatCell` semantics, right-aligned numerics, the totals row,
  the `Generated …` line.
- **Each definition's real `description`** under its title.
- **A catalogue** of the estimating-analytics report set, marking what is on the dashboard and
  what is strip-only.
- **Refresh + an as-at stamp**, and a **dashboard-level export** alongside the per-widget
  Excel/CSV/PDF strip that `reportWidgetChrome.tsx` already ships.

**Marco's scope ruling, 2026-09-08:** `job-status-summary`, `worker-competency-expiry` and
`asset-utilisation-snapshot` are **out of scope** — Operations/HR reports, not estimating
analytics. They are not in the catalogue. `/reports` stays the only surface reaching them, and a
later `/reports` retirement must rehome them rather than assume this dashboard absorbed them.

## F. Consequence for size and scope — Marco decides before arming

`size: 9` and "Do NOT exceed 9 files" were written for a seed-only preset. Section E is real web
work on top of a corrected seed target. Two honest shapes:

1. **Widen EA-2** — raise `size`, keep `apps/web/src/dashboards/**`, ship preset + filter bar
   together. Defect D-2 still needs its own slice for the reporting DTO.
2. **Split** — EA-2a seeds the corrected `UserDashboard` preset with the mock-up's spans; EA-2b
   builds the view-time filter surface. D-2 is a third, small slice.

Recommendation: **2**, with D-2 first, because until the DTO accepts `period` the settings
popover breaks any widget it touches.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main.
Never ask a question or "stand by" for approval. Read the CI job log before diagnosing any
failure. `pnpm build` and `pnpm lint` must pass.

---

## Migration gate — READ THIS BEFORE CODING

The default plan is that this preset lands as **an idempotent upsert added to
`apps/api/prisma/seed.ts`** (following the `seed-home-dashboard` pattern around L354 —
`prisma.dashboard.upsert` + `prisma.dashboardWidget.createMany`). With that shape,
**`gate_allow: none` is correct** and no migration is needed.

**IF (and only if)** you determine that the preset requires a Prisma **data migration**
(SQL that upserts the dashboard row into a running database, not a seed script), you MUST:

1. Change the front-matter of THIS file to `gate_allow: migrations`, `escalates: true`, and add
   a `rollback_strategy: '<one-line note — e.g. "delete rows where id = seed-estimating-analytics-dashboard; forward-only otherwise">'`.
2. Add the migration path to `scope` (`apps/api/prisma/migrations/**`).
3. Declare `GATE-ALLOW: migrations` bare at column 0 of the PR body.
4. Add `docs/data-model/**` to `scope` and regenerate the data-model map
   (`node scripts/data-model/build-relationship-map.mjs`) — CP-24 hard-fails otherwise.
5. Satisfy Gate A: either name a `*.spec.ts` in scope that exercises the migration against
   a seeded row, or declare `backfill: false` in the front-matter (a preset upsert with no
   `UPDATE … SET` is genuinely additive).

**Default path (seed edit + code):** no migration, no gate change, `escalates: false`.

## Grounded state on main (read before coding)

- **`Dashboard` model** — `apps/api/prisma/schema.prisma` (~L649): `Dashboard { id, name,
  description, scope, ownerUserId, ownerRoleId, isDefault, ... }` plus
  `DashboardWidget { dashboardId, type, title, description, position, width, height,
  config: Json? }`.
- **Global-preset seeding pattern** — `apps/api/prisma/seed.ts` (see `seed-home-dashboard`
  upsert around L354 and the `seed-admin-dashboard` upsert around L382 with
  `prisma.dashboardWidget.deleteMany` + `createMany`). **Model your preset on this
  pattern** — idempotent, stable id, delete-then-createMany for widgets so re-seeding is
  clean.
- **Dashboards service** — `apps/api/src/modules/platform/dashboards.service.ts` reads
  `scope: "GLOBAL"` dashboards. `user-dashboards.service.ts` handles per-user overrides
  (`isSystem`/`isDefault`).
- **Web dashboard shell** — `apps/web/src/dashboards/GlobalDashboardPage.tsx`,
  `DashboardSwitcher.tsx`, `CustomisePanel.tsx`, `DashboardCanvas.tsx` render the preset.
  Read these for the widget-config shape they expect.
- **Report widget factories** — `apps/web/src/dashboards/widgets/reportRegistry.ts`
  factory-generates `report:table:<reportKey>` and `report:chart:<reportKey>` widgets
  from `ReportDefinitionSummary[]`.
- **EA-1 is merged** (gated by `requires_on_main` above). Report keys available:
  `estimator-turnaround`, `estimator-qty-vs-value`.
- **Existing shipped report keys** to assemble (do NOT rebuild):
  `tender-winloss-by-estimator`, `tender-winloss-by-client`,
  `tender-winloss-by-value-band`, `tender-winloss-over-time`,
  `tender-outcome-coverage` (see `tender-winloss-report.definitions.ts` +
  `reporting.service.ts`).
- **Tendering time-series widget** — `apps/web/src/dashboards/widgets/tendering.tsx`
  provides quarterly/monthly submitted-vs-won buckets — reuse as-is if the preset uses it.

## What to build

### 1. Seed the preset row in `apps/api/prisma/seed.ts`

Add an idempotent block modelled on `seed-home-dashboard`:

- Stable id: `seed-estimating-analytics-dashboard`
- `name`: `"Estimating Analytics"`
- `description`: `"Curated view: win-rate, turnaround, throughput, and pipeline value for the estimating team."`
- `scope`: `"GLOBAL"`
- `ownerUserId`: `null`
- `ownerRoleId`: `null`
- `isDefault`: `false` (do NOT displace the existing Home default)

Then `prisma.dashboardWidget.deleteMany({ where: { dashboardId } })` followed by
`prisma.dashboardWidget.createMany` with a FOCUSED widget list (keep it lean — Decision EA-D6):

1. `type: "report-chart"` / `config: { reportKey: "tender-winloss-by-estimator" }` — SHIPPED
2. `type: "report-table"` / `config: { reportKey: "tender-winloss-by-client" }` — SHIPPED
3. `type: "report-chart"` / `config: { reportKey: "tender-winloss-by-value-band" }` — SHIPPED
4. `type: "report-chart"` / `config: { reportKey: "estimator-turnaround" }` — NEW from EA-1
5. `type: "report-chart"` / `config: { reportKey: "estimator-qty-vs-value" }` — NEW from EA-1
6. Tendering time-series widget (submitted-vs-won monthly) via the `tendering.tsx` widget
   key — reuse the exact `type`/`config` shape another `seed.ts` block uses for this
   widget so you don't invent a shape.
7. Pipeline-value widget:
   - **If** `pr-crm-s6-pipeline-dashboard` has landed and exposes a stable widget key /
     report key, reference it here.
   - **Else** fall back to a report widget on an existing shipped `estimatedValue` /
     `closedTenders` def (verify the key on main before hardcoding).

**Widget `type` values must match the exact strings the web `widgetRegistry.ts` /
`reportRegistry.ts` accept.** Read those files before writing the `type` strings — do NOT
invent new type names.

### 2. Role gating (self-view vs rollup)

**Enforcement is at compute time in EA-1's `run()` (already shipped).** The preset simply
needs to pass the right params:

- When the current user is estimator-only, the widgets on this preset render with
  `estimator = currentUser.id` so the compute-time gate kicks in as self-view.
- When manager/leadership, no `estimator` param is passed and the rollup is returned.
- Read `CustomisePanel.tsx` / `DashboardCanvas.tsx` for how widget params are threaded from
  user context. Reuse that mechanism — do NOT invent a new param-threading layer.

### 3. Web changes (minimal)

- If `GlobalDashboardPage.tsx` / `DashboardSwitcher.tsx` auto-discover global dashboards via
  the API, **no web edit is required** and you should keep the web-side diff empty.
- If a switcher entry / nav label needs to be added, follow the existing convention (do
  NOT introduce a bespoke `EstimatingAnalyticsPage.tsx` — Decision EA-D6 forbids a bespoke page).

### 4. Tests

- Prisma-mock spec (`apps/api/src/modules/platform/__tests__/` or wherever the existing
  preset specs live — read first) asserting:
  - The `seed-estimating-analytics-dashboard` row is created/updated on seed with
    `scope: "GLOBAL"`.
  - The expected widget keys/`reportKey` values are present in the correct positions.
  - Re-running the seed is idempotent (no duplicate widget rows).
- If web changes are non-trivial, add or extend a web test using the pattern in
  `apps/web/src/dashboards/__tests__/`.

## Do NOT

- Do NOT edit `apps/api/prisma/schema.prisma` — the preset uses existing `Dashboard` /
  `DashboardWidget` models. No new columns, no new tables.
- Do NOT rebuild the shipped `tender-winloss-*` report defs or the `leadTimeDays` maths —
  ASSEMBLE, do not reimplement (Decision EA-D1).
- Do NOT build the pipeline-value widget from scratch — reference the CRM S6 output if it
  has landed, otherwise fall back to an existing shipped report key (Decision EA-D6 keeps
  scope tight).
- Do NOT build a bespoke `EstimatingAnalyticsPage.tsx` — the home is inside the existing
  global-dashboard mechanism (Decision EA-D6).
- Do NOT build any Excel-style pivot UI — Decision EA-D7 (out of scope for this program).
- Do NOT displace `seed-home-dashboard` as `isDefault: true`.
- Do NOT expose one estimator's numbers to another — pass params so EA-1's compute-time
  role gate kicks in as self-view (Decision EA-D5).
- Do NOT invent a new `DashboardWidget.type` string. Reuse the exact strings the web
  registries accept.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside declared scope.
- Do NOT exceed 9 files.
- Do NOT use `requires_merged` — the dependency is declared via `requires_on_main`
  above.
