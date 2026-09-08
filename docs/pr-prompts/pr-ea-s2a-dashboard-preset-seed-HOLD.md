---
premise: '! grep -q "estimating-analytics" apps/api/prisma/seed.ts'
premise_means: >-
  The Estimating Analytics dashboard preset is not seeded. EA-2 has not run, and the original
  EA-2 prompt cannot run as written because it seeds Dashboard/DashboardWidget, a subsystem that
  cannot render a report widget at all.
scope:
  - apps/api/prisma/seed.ts
  - apps/api/src/modules/platform/__tests__/estimating-analytics-preset.spec.ts
done_when: >-
  pnpm build && pnpm lint && grep -q "estimating-analytics" apps/api/prisma/seed.ts && grep -q
  "report:chart:estimator-turnaround" apps/api/prisma/seed.ts
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: platform
design_ref: https://claude.ai/code/artifact/10c03a71-0346-4a9e-8b07-7974fd191544
cluster: estimating-analytics-v2
cluster_order: 2
requires_on_main: 'apps/api/src/common/permissions/permission-registry.ts :: reporting.team'
---

# EA-2a — seed the Estimating Analytics preset, on the table that can actually render it

Second of three. Replaces **"What to build" §1 of `pr-ea-s2-dashboard-preset-HOLD.md`**, which is
superseded by this slice together with `pr-ea-gate-report-self-filter` and
`pr-ea-s2b-dashboard-filter-surface`. Retire the old prompt to `superseded/` in a board PR once
all three land — do not delete it.

**The mock-up at `design_ref` is binding for the widget set, their order and their spans.** Marco
approved it on 2026-09-08. Open it and read its on-page grounding panel before writing anything;
it carries every measurement below with file:line.

## Why the original EA-2 could not work

Measured on origin/main. The original prompt seeds `Dashboard` + `DashboardWidget` modelled on
`seed-home-dashboard`. **That subsystem cannot render a report widget.**
`dashboards.service.ts:206-226` switches on a fixed `kpi|bar_chart|line_chart|donut_chart|chart|table`
list against a hardcoded `metricKey` set and returns `{ type: "unsupported" }` for anything else,
which `GlobalDashboardPage.tsx` prints as *"not renderable here"*.

Two more errors in the same passage:

- **The widget shape does not exist.** `type: "report-chart"` with `config: { reportKey }` is not
  accepted anywhere. The report key lives **inside the type string** —
  `report:chart:<key>` / `report:table:<key>` (`reportRegistry.ts:117,132`) — and
  `WidgetSubConfig` is `{ period?, filters?, fields? }` (`apps/web/src/dashboards/types.ts:17-23`).
  There is no `reportKey` config field in the repo.
- **`tender-winloss-by-estimator` does not exist.** The report that does that job is
  **`tender-win-rate`**, *"Tender win rate by estimator"*, `reporting.service.ts:203`.

## Ground truth — read before coding

Report widgets live on **`UserDashboard`** (`schema.prisma:2846`), seeded by `seedUserDashboards()`
at `apps/api/prisma/seed.ts:3900`, rendered by `DashboardCanvas` at `/dashboards/:id`
(`App.tsx:638`).

**`UserDashboard` is PER USER, not global.** Its unique key is
`userId_slug_isSystem`, and `seedUserDashboards` loops every user creating one row each. There is
no `scope: "GLOBAL"` on this model — the original prompt's central assumption. Follow the existing
`home` block exactly: find-then-update-or-create on that composite key, `isSystem: true`.

Config shape, from the same block:

```ts
{ period: "30d", widgets: [ { id, type, visible: true, order, config: { period: null, filters: {} } } ] }
```

## What to build

Add a second block to `seedUserDashboards`, beside `home`:

- `slug`: `"estimating-analytics"`
- `name`: `"Estimating Analytics"`
- `isSystem`: `true`
- **`isDefault`: `false`** — do NOT displace Home.
- **Seed it only for users who hold `reporting.view`.** Home is seeded for every user because
  everyone needs a home; an estimating dashboard on a field worker's switcher is noise. Derive the
  user set by permission, not by role name or a hardcoded list. State the query in the PR body.

**Widgets — take the set, the order and the spans from the mock-up, not from this list.** As
measured there, it is ten cards spanning `w4, w2, w2, w2, w2, w2, w2, w4, w2, w2`: the
`estimator-turnaround` hero, then win-rate and throughput, the monthly submitted-vs-won series and
the win-rate trend, value bands and loss reasons, the by-client table full width, then pipeline and
outcome coverage. Nine are report widgets; the monthly series is the hand-written
`ten_win_rate_chart` registry key, which is not a report widget and carries no export strip.

**`colSpan` is mandatory on every entry.** `registerReportWidgets` defaults every report widget to
`colSpan: 4` (`reportRegistry.ts`), so a preset that omits it renders as ten stacked full-width
cards. This is the single most likely way to ship something that passes CI and looks wrong.

**Read `widgetRegistry.ts` and `reportRegistry.ts` and copy the exact `type` strings.** Do not
invent one, and do not assemble one by string concatenation in the seed.

## Test — `estimating-analytics-preset.spec.ts` (new)

Read the existing preset specs under `apps/api/src/modules/platform/__tests__/` first and match
their Prisma-mock idiom. Assert:

- the row is created with `slug: "estimating-analytics"`, `isSystem: true`, `isDefault: false`
- every `type` string is one the web registries accept — **assert against the real registry
  strings, not against a copy pasted into the spec**, or the test cannot catch the error it exists
  to catch
- every entry carries an explicit `colSpan`
- re-running the seed is idempotent — no duplicate rows, no duplicate widgets
- Home is still `isDefault: true`

## Do NOT

- Do NOT seed `Dashboard` / `DashboardWidget`, and do NOT use `scope: "GLOBAL"` — see above.
- Do NOT edit `schema.prisma`, add a migration, or regenerate the data-model map.
- Do NOT build a bespoke `EstimatingAnalyticsPage.tsx` — Decision EA-D6 forbids a bespoke page.
- Do NOT rebuild any report definition. This slice ASSEMBLES (Decision EA-D1).
- Do NOT include `job-status-summary`, `worker-competency-expiry` or `asset-utilisation-snapshot`.
  **Marco ruled 2026-09-08** that they are Operations/HR reports, out of scope here.
- Do NOT displace `home` as the default.
- Do NOT touch `apps/web/**` — the filter surface is EA-2b's.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside `scope`.

## Why this is Marco's to merge

`escalates: true`. It writes seeded dashboard rows for real users on deploy, and it is the slice
that puts per-estimator numbers on one screen — which is why `requires_on_main` holds it behind
`reporting.team`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>`. Read the CI job log before diagnosing
any failure. `pnpm build` and `pnpm lint` must both pass.
