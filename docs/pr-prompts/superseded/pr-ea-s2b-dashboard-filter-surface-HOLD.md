---
premise: '! grep -q "DASHBOARD_FILTER_BAR_V1" apps/web/src/dashboards/DashboardCanvas.tsx'
premise_means: >-
  A dashboard's filters can only be changed by editing and saving its config in the customise
  drawer. There is no view-time filter surface, no way to see whether a filter reaches a given
  widget, and no way to read a chart widget's underlying rows. The period control on a report
  widget is worse than absent - it is offered, it does nothing, and setting it breaks the widget.
scope:
  - apps/web/src/dashboards/DashboardCanvas.tsx
  - apps/web/src/dashboards/reportRegistry.ts
  - apps/web/src/dashboards/widgets/reportChartWidget.tsx
  - apps/web/src/dashboards/widgets/reportTableWidget.tsx
  - apps/web/src/dashboards/widgets/reportWidgetChrome.tsx
  - apps/web/src/dashboards/DashboardFilterBar.tsx
  - apps/web/src/dashboards/__tests__/DashboardFilterBar.test.tsx
  - apps/web/src/dashboards/__tests__/reportWidgetFilters.test.tsx
done_when: >-
  pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q
  "DASHBOARD_FILTER_BAR_V1" apps/web/src/dashboards/DashboardCanvas.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: dashboards
design_ref: https://claude.ai/code/artifact/10c03a71-0346-4a9e-8b07-7974fd191544
cluster: estimating-analytics-v2
cluster_order: 3
requires_on_main: 'apps/api/prisma/seed.ts :: estimating-analytics'
---

# EA-2b — the view-time filter surface the dashboard has never had

Third of three, after `pr-ea-gate-report-self-filter` and `pr-ea-s2a-dashboard-preset-seed`.
Those two plus this one **supersede `pr-ea-s2-dashboard-preset-HOLD.md`**; retire it to
`superseded/` in a board PR once all three land. Do not delete it.

**The mock-up at `design_ref` is binding for the UI and the behaviour.** Marco approved it on
2026-09-08 and said: *"I like the way the Estimating Analytics looks and feels. Make sure when
staging this PR, it reflects the UI/UX you built on the mock-up."* Open it first and read its
on-page grounding panel — it carries every measurement below with file:line, and it shows every
control in a real populated state.

This is generic dashboard machinery, not an estimating feature. It lands on
`apps/web/src/dashboards/**` and every dashboard with report widgets gets it.

## The defect that makes this more than an affordance

**`config.period` never reaches a report widget.** Neither `reportChartWidget.tsx` nor
`reportTableWidget.tsx` mentions `period`, `resolvePeriod` or `globalPeriod` — only `ops.tsx`,
`forms.tsx` and `tendering.tsx` call `resolvePeriod`. So today **every report widget runs
unwindowed, over all time**, while the picker above it says "Last 30 days".

**And setting a per-widget Period breaks it outright.** `buildConfigSchema` emits a `period`
ConfigField for every report widget (`reportRegistry.ts:66`), `WidgetSettingsPopover` renders it
and writes it into `payload.filters`, `buildQuery` serialises it onto the URL — but
`ReportRunQueryDto` has no `period` and the global pipe runs
`whitelist: true, forbidNonWhitelisted: true` (`bootstrap/create-app.ts:21-27`). It 400s.

**Fix it web-side by removing the dead field, not by widening the API.** A report widget does not
read `period` even when the request succeeds, so adding `period` to the DTO would make a broken
control into a silent no-op — worse, because it would then look like it worked. Delete the
`period` ConfigField from `buildConfigSchema` for report widgets and let real `from`/`to` do the
windowing. **No API change; this slice stays inside `apps/web/**`.**

The dashboard-level period picker stays, because `ops`, `forms` and `tendering` widgets do honour
it. That asymmetry is exactly what the window-resolution line exists to make visible.

## What to build — all of it is in the mock-up

1. **`DashboardFilterBar.tsx` (new), mounted by `DashboardCanvas`.** Carries the existing period
   presets, plus real `from` / `to` date inputs, `clientId` and `estimatorId`. It writes straight
   into `dashboardFilters`.
   **No schema change is needed.** `WidgetFilters` is `Record<string, unknown>` (`types.ts:15`) and
   `dashboardFilters` already exists on the config (`:43`). Today the only editor is
   `CustomisePanel.tsx:51-52`, which saves config rather than filtering a view.
   Mark `DashboardCanvas.tsx` with `DASHBOARD_FILTER_BAR_V1`.

2. **A window-resolution line** under the bar: which widgets obey the period, which obey the date
   range, and whether a hand-typed range has diverged from the selected preset. Given the defect
   above this is not decoration — it is the only honest way to show what the numbers cover.

3. **Filter-reachability chips per card** — `applied` / `available` / `not a parameter`. Derive
   them from each definition's real `parameters` array, which `/reporting/definitions` already
   returns. Measured: `estimatorId` is declared by **only** `estimator-turnaround` and
   `estimator-qty-vs-value`; `tender-win-rate` takes `from`/`to` only; `asset-utilisation-snapshot`
   takes none. **A filter that cannot reach a widget must say so rather than look applied.**

4. **A per-widget override badge** wherever `config.filters` differs from the bar.
   `resolveEffectiveFilters` is `{...dashboardFilters, ...widgetFilters}` (`types.ts:208`) and an
   explicit empty string **clears** the dashboard value rather than deferring to it — surface that,
   it is not guessable from the card.

5. **A chart/table toggle on every chart widget.** The table face must reproduce
   `reportTableWidget` exactly — its `formatCell` semantics (`:59`), right-aligned numerics, the
   totals row (`:229`) and the `Generated …` line (`:258`). Extract the shared renderer rather
   than writing a second one, or the two will drift.

6. **Each definition's real `description`** under its title. `ReportDefinitionSummary` already
   carries it; widgets show only a title today.

7. **Refresh + an as-at stamp**, and a **dashboard-level export** beside the per-widget
   Excel/CSV/PDF strip `reportWidgetChrome.tsx` already ships. The per-widget strip mounts only on
   report widgets, so state the count honestly in the UI rather than promising "all widgets".

8. **Remove the dead `period` ConfigField** from report widgets in `reportRegistry.ts` (see above).

## Verification

- [x] `pnpm --filter @project-ops/web test` green; state the before/after counts.
- [x] Quote the `period` ConfigField before and after, and state what the settings popover now
      renders for a report widget.
- [x] Reachability: state the chip each of `estimatorId`, `clientId`, `from`/`to` earns on
      `tender-win-rate` and on `estimator-turnaround`, and confirm they differ.
- [x] Override: set a widget's `config.filters.clientId` to an empty string with a client selected
      in the bar, and confirm the widget shows the override badge and runs unfiltered.
- [x] Toggle: flip one chart widget to its table face and confirm the totals row and the
      `Generated …` line match `reportTableWidget`'s output for the same query.
- [x] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero. `var(--token, #fallback)` counts as a hex literal.
- [x] `RatesTab.tsx` and every non-dashboard consumer are absent from the diff.

## Do NOT

- Do NOT add `period` to `ReportRunQueryDto` or touch `apps/api/**` at all. The fix is to remove a
  control that does nothing, not to make the API accept it.
- Do NOT make report widgets read `config.period`. Windowing for reports is `from`/`to`.
- Do NOT change the dashboard-level period picker's effect on `ops`, `forms` or `tendering`
  widgets.
- Do NOT persist the filter bar's state into the saved config — it is a **view-time** surface.
  Saving is the customise drawer's job and stays there.
- Do NOT write a second table renderer (see §5).
- Do NOT add a charting library. Existing widgets hand-author their SVG; match them.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, `apps/api/**`, or any file outside `scope`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>`. Read the CI job log before diagnosing
any failure. `pnpm build`, `pnpm lint` and the web test suite must all pass.
