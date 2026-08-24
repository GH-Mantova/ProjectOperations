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
- **EA-1 is merged** (gated by `requires_file_on_main` above). Report keys available:
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
`prisma.dashboardWidget.createMany` with a FOCUSED widget list (keep it lean — Decision D6):

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
  NOT introduce a bespoke `EstimatingAnalyticsPage.tsx` — Decision D6 forbids a bespoke page).

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
  ASSEMBLE, do not reimplement (Decision D1).
- Do NOT build the pipeline-value widget from scratch — reference the CRM S6 output if it
  has landed, otherwise fall back to an existing shipped report key (Decision D6 keeps
  scope tight).
- Do NOT build a bespoke `EstimatingAnalyticsPage.tsx` — the home is inside the existing
  global-dashboard mechanism (Decision D6).
- Do NOT build any Excel-style pivot UI — Decision D7 (out of scope for this program).
- Do NOT displace `seed-home-dashboard` as `isDefault: true`.
- Do NOT expose one estimator's numbers to another — pass params so EA-1's compute-time
  role gate kicks in as self-view (Decision D5).
- Do NOT invent a new `DashboardWidget.type` string. Reuse the exact strings the web
  registries accept.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside declared scope.
- Do NOT exceed 9 files.
- Do NOT use `requires_merged` — the dependency is declared via `requires_file_on_main`
  above.
