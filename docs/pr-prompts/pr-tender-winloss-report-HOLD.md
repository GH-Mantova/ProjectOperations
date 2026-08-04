---
premise: '! test -f apps/api/src/modules/reporting/tender-winloss-report.definitions.ts'
premise_means: The reporting engine has a tender-pipeline and a tender-win-rate-by-estimator report, but no win/loss report broken down by client, scope, value band, or structured loss reason.
scope:
  - apps/api/src/modules/reporting/tender-winloss-report.definitions.ts
  - apps/api/src/modules/reporting/reporting.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/reporting/tender-winloss-report.definitions.ts && grep -q "tender-winloss-report.definitions" apps/api/src/modules/reporting/reporting.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Tender win/loss report — by client, scope, value band, and reason

`apps/api/src/modules/reporting/reporting.service.ts` already implements a generic, data-driven
reporting engine: a `REPORT_DEFS: ReportDefinition[]` array, each entry a `{ key, title, description,
parameters, columns, chart, run(prisma, params) }` object. `GET /reporting/definitions` and `GET
/reporting/:key` (controller: `apps/api/src/modules/reporting/reporting.controller.ts`) and the web
`ReportsPage.tsx` (`apps/web/src/pages/reports/ReportsPage.tsx`) all pick up new entries automatically
— no frontend work is needed to add a report. The file's own header comment says as much: "New report
definitions drop in by pushing another entry into REPORT_DEFS; the controller, exporter, and web page
all pick them up without further wiring." An existing `tender-win-rate` definition already breaks
tenders down **by estimator**; there is nothing broken down by client, scope, value band, or (the
prior slice's) structured loss/decline reason.

The prior slice on this branch (`feat/tender-outcome-capture`) added `TenderOutcome.resultType`
(`TenderOutcomeResult`: `WON`/`LOST`/`NO_BID`), `TenderOutcome.reason`
(`TenderOutcomeReason`, a bounded enum), `TenderOutcome.tenderValue`, and `TenderOutcome.clientId` to
`apps/api/prisma/schema.prisma`. This slice is purely descriptive reporting on top of that data — no
ML, no prediction, no schema change.

## What to build

1. **`apps/api/src/modules/reporting/tender-winloss-report.definitions.ts` (new)** — export a
   `TENDER_WINLOSS_REPORT_DEFS: ReportDefinition[]` array (import the `ReportDefinition`,
   `ReportRunParams`, `ReportRunResult` types from `./reporting.service`) containing at least these
   report definitions, each reading `prisma.tenderOutcome` joined to its `tender`:
   - `tender-winloss-by-client` — win rate grouped by `TenderOutcome.clientId` (fall back to
     "Unknown client" when null), columns: client, won, lost, no-bid, win rate %. Bar chart on win
     rate.
   - `tender-winloss-by-value-band` — win rate grouped by fixed `tenderValue` bands (e.g.
     `<$50k`, `$50k-$250k`, `$250k-$1M`, `>$1M`; treat null `tenderValue` as "Unknown"), same
     won/lost/no-bid/win-rate columns.
   - `tender-winloss-by-reason` — count of outcomes grouped by `TenderOutcome.reason` (only rows
     where `resultType` is `LOST` or `NO_BID` — a bounded enum, so no free-text bucket needed),
     columns: reason, count. Bar chart on count.
   - `tender-winloss-over-time` — outcomes grouped by month of `recordedAt`, columns: month, won,
     lost, no-bid, win rate %. Bar or line-shaped bar chart on win rate.
   Follow the exact `dateRangeFilter`/`decimalToNumber` helper conventions and `from`/`to` parameter
   pattern already established in `reporting.service.ts` for date-windowed reports (reuse those
   helpers by importing them, or duplicate the small pure functions locally if they are not exported
   — check `reporting.service.ts` first and export them if that is the cleaner path).
   Because `TenderOutcome` is append-only (a corrected outcome supersedes rather than overwrites via
   `supersedesId`), every `run()` in this file must filter to **current** outcomes only — i.e.
   exclude any `TenderOutcome` row that is pointed at by another row's `supersedesId` (it has been
   superseded), so a correction does not double-count history.

2. **`apps/api/src/modules/reporting/reporting.service.ts`** — import
   `TENDER_WINLOSS_REPORT_DEFS` and spread it into `REPORT_DEFS` (e.g.
   `const REPORT_DEFS: ReportDefinition[] = [...existingEntries, ...TENDER_WINLOSS_REPORT_DEFS];` —
   match whatever array-literal style keeps the diff smallest). No other change to this file.

## Do NOT

- Do not add any ML/prediction logic, model, or pricing suggestion — this is a plain descriptive
  report only (per `docs/plans/tender-winloss-datacapture-plan.md`, WL-3 is explicitly a later,
  separate program).
- Do not touch `apps/api/prisma/schema.prisma` or add a migration.
- Do not touch `apps/web/src/pages/reports/ReportsPage.tsx` or any other frontend file — the generic
  reporting page already renders any `ReportDefinition` returned by the API.
- Do not touch the existing `tender-pipeline` or `tender-win-rate` (by-estimator) report definitions.
- Do not touch Azure/Entra/SharePoint or any module outside `apps/api/src/modules/reporting`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
