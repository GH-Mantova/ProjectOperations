---
premise: '! test -f apps/api/src/modules/reporting/tender-winloss-report.definitions.ts'
premise_means: The reporting engine has a tender-pipeline and a by-estimator win-rate report, but no win/loss report broken down by client, value band, or structured reason, and no capture-coverage figure.
requires_file_on_main: apps/api/src/modules/tendering/tender-outcome-capture.service.ts
scope:
  - apps/api/src/modules/reporting/tender-winloss-report.definitions.ts
  - apps/api/src/modules/reporting/reporting.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/reporting/tender-winloss-report.definitions.ts && grep -q "tender-winloss-report.definitions" apps/api/src/modules/reporting/reporting.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# WL-2 — Tender win/loss report — by client, value band, reason, over time (+ capture coverage)

Slice WL-2 of the tender win/loss program (`docs/plans/tender-winloss-datacapture-plan.md`).
Descriptive reporting only — **no ML, no prediction** (WL-3 is a later, separate program). Depends on
WL-1a (`feat/tender-outcome-capture-api`), which added `TenderOutcome.resultType`
(`WON`/`LOST`/`NO_BID`), `.reason` (bounded enum), `.tenderValue`, `.clientId`, and the append-only
`supersedesId` chain. The `requires_file_on_main` gate holds this until WL-1a lands.

`apps/api/src/modules/reporting/reporting.service.ts` already implements a generic, data-driven engine:
a `REPORT_DEFS: ReportDefinition[]` array of `{ key, title, description, parameters, columns, chart,
run(prisma, params) }`. `GET /reporting/definitions`, `GET /reporting/:key`, and the web
`ReportsPage.tsx` all pick up new entries automatically — **no frontend work needed**. An existing
`tender-win-rate` definition breaks tenders down by estimator; nothing exists by client, value band,
reason, or coverage.

## What to build

1. **`apps/api/src/modules/reporting/tender-winloss-report.definitions.ts` (new)** — export
   `TENDER_WINLOSS_REPORT_DEFS: ReportDefinition[]` (import `ReportDefinition` and the run param/result
   types from `./reporting.service`), each reading `prisma.tenderOutcome` joined to its `tender`:
   - `tender-winloss-by-client` — win rate grouped by `clientId` (null → "Unknown client"); columns:
     client, won, lost, no-bid, win rate %. Bar chart on win rate.
   - `tender-winloss-by-value-band` — win rate by fixed `tenderValue` bands (`<$50k`, `$50k-$250k`,
     `$250k-$1M`, `>$1M`; null → "Unknown"); same won/lost/no-bid/win-rate columns.
   - `tender-winloss-by-reason` — count grouped by `reason`, restricted to rows where `resultType` is
     `LOST` or `NO_BID`; columns: reason, count. Bar chart on count.
   - `tender-winloss-over-time` — grouped by month of `recordedAt`; columns: month, won, lost, no-bid,
     win rate %.
   - `tender-outcome-coverage` — the honesty check: for tenders in a terminal status over the window,
     the count and PERCENTAGE that have a current recorded outcome vs none; columns: period (or
     total), closed tenders, with outcome, coverage %. This stops a thin (skipped) sample from being
     read as gospel win rates.
   Reuse the `dateRangeFilter` / `decimalToNumber` helpers and the `from`/`to` parameter pattern from
   `reporting.service.ts` (import them; if not exported, export them there — check first).
   Because `TenderOutcome` is **append-only** (corrections supersede via `supersedesId`), every `run()`
   must count **current outcomes only** — exclude any row pointed at by another row's `supersedesId`,
   so a correction never double-counts.

2. **`apps/api/src/modules/reporting/reporting.service.ts`** — import `TENDER_WINLOSS_REPORT_DEFS` and
   spread it into `REPORT_DEFS` (`[...existing, ...TENDER_WINLOSS_REPORT_DEFS]`, smallest-diff style).
   No other change.

## Do NOT

- Do **not** add ML / prediction / pricing-suggestion logic — WL-3 is a separate later program.
- Do **not** touch `schema.prisma` or add a migration.
- Do **not** touch `ReportsPage.tsx` or any frontend file — the generic page renders any definition.
- Do **not** touch the existing `tender-pipeline` or `tender-win-rate` definitions.
- Do **not** touch Azure/Entra/SharePoint, `sot/`, or anything outside `apps/api/src/modules/reporting`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
