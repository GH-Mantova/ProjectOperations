---
premise: '! test -f apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts'
premise_means: The estimator-turnaround + estimator-qty-vs-value report definitions file does not exist on main yet — EA-1 has not run.
scope:
  - apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts
  - apps/api/src/modules/reporting/estimating-analytics-report.definitions.spec.ts
  - apps/api/src/modules/reporting/reporting.service.ts
  - apps/api/src/modules/reporting/reporting.module.ts
  - apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts
  - apps/web/src/dashboards/widgets/reportRegistry.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts && grep -q "estimator-turnaround" apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts && grep -q "estimator-qty-vs-value" apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# EA-1 — Estimating-analytics report definitions (estimator turnaround + qty-vs-value)

**Binding plan:** `docs/plans/estimating-analytics-plan.md` (read it in full before starting).
This is **EA-1**, the first slice of the estimating-analytics program. It appends **two**
new `ReportDefinition` objects to the existing reporting framework — **no schema change,
no bespoke UI**. EA-2 (the curated global-dashboard preset) chains off the file this slice
creates.

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

## Grounded state on main (read before coding)

- **`ReportDefinition` framework** — `apps/api/src/modules/reporting/reporting.service.ts`
  exports the `ReportDefinition` interface (`key`, `title`, `description`, `parameters`,
  `columns`, `chart?`, `run(prisma, params)`) and the `REPORT_DEFS` array. New reports drop
  in as one object appended to that array (via the existing `TENDER_WINLOSS_REPORT_DEFS`
  spread pattern). Helper exports: `dateRangeFilter()`, `decimalToNumber()`,
  `formatEstimatorName()`.
- **Win-rate reports are ALREADY SHIPPED** in
  `apps/api/src/modules/reporting/tender-winloss-report.definitions.ts` (keys include
  `tender-winloss-by-client`, `tender-winloss-by-value-band`, `tender-winloss-by-reason`,
  `tender-winloss-over-time`, `tender-outcome-coverage`) plus `tender-winloss-by-estimator`
  in `reporting.service.ts`. **Do NOT rebuild these.**
- **`leadTimeDays` is ALREADY COMPUTED** in
  `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` (see the
  `leadTimeDays` field on `TenderFeatures` and the rounding logic ~L164). **Reuse or
  share this maths — do NOT duplicate the `submittedAt − createdAt` derivation.** If the
  computation is not already exported in a shape you can reuse from a report definition,
  extract a small pure helper from the service (e.g. `deriveLeadTimeDays(tender)`) and
  export it — do NOT copy-paste the arithmetic.
- **Reporting controller / permission gate** — read
  `apps/api/src/modules/reporting/reporting.controller.ts` to see the permission
  decorator already in use for report reads. Reuse it — do NOT invent a new permission.
- **Web report widget registry** —
  `apps/web/src/dashboards/widgets/reportRegistry.ts` factory-generates
  `report:table:<key>` / `report:chart:<key>` widgets from `ReportDefinitionSummary[]`.
  If it auto-picks up any def with `columns` / `chart`, you likely need NO web edit at all
  beyond confirming that. Read the file first.

## What to build

### 1. `apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts`

Export a `const ESTIMATING_ANALYTICS_REPORT_DEFS: ReportDefinition[]` with **two**
entries. Model the shape on the existing definitions in `tender-winloss-report.definitions.ts`.

#### Definition A — `estimator-turnaround`

- `key`: `"estimator-turnaround"`
- `title`: `"Estimator turnaround (avg days-to-quote)"`
- `description`: one line, includes the phrase "excludes still-open tenders".
- `parameters`: `estimator`, `client`, `from`, `to` (reuse the existing `ReportParameterSpec`
  shape — read `reporting.service.ts` for the type).
- `columns`:
  - `estimator` (string)
  - `count` (number — count of tenders included)
  - `avgDaysToQuote` (number — mean of `leadTimeDays`)
  - `medianDaysToQuote` (number — median if trivially derivable; otherwise omit rather than fabricate)
- `chart` (optional): `{ type: "bar", xKey: "estimator", yKey: "avgDaysToQuote", title: "Avg days to quote by estimator", unit: "days" }`
- `run()`:
  1. Query tenders joined to `estimator` / `assignedEstimator` (same select pattern as
     `tender-winloss-by-estimator`).
  2. **EXCLUDE still-open tenders.** Only include tenders whose outcome is
     submitted/quoted (won / lost / no-bid all count as "submitted"; verify the status
     enum in `schema.prisma` before hardcoding — do NOT invent status values).
  3. Derive `leadTimeDays` via the shared helper from
     `win-likelihood-features.service.ts` (see "Grounded state" above — extract a helper
     if it is not already exported). Skip tenders whose `leadTimeDays` is null.
  4. Bucket by estimator name (via `formatEstimatorName()`).
  5. Compute `avgDaysToQuote` = mean; `medianDaysToQuote` if trivially derivable.
  6. Sort descending by `avgDaysToQuote` (longest turnaround at top).

#### Definition B — `estimator-qty-vs-value`

- `key`: `"estimator-qty-vs-value"`
- `title`: `"Estimator throughput (qty priced vs $ value)"`
- `description`: one line explaining "count of tenders priced vs Σ estimatedValue, per estimator".
- `parameters`: `estimator`, `client`, `from`, `to`.
- `columns`:
  - `estimator` (string)
  - `priced` (number — count of tenders priced by this estimator)
  - `sumEstimatedValue` (number — Σ `estimatedValue`, via `decimalToNumber()`)
- `chart` (optional): a bar chart on `sumEstimatedValue` (or a dual chart if the framework
  supports it — do NOT invent a chart type not present elsewhere).
- `run()`:
  1. Query tenders joined to estimator (same select as A).
  2. Include only tenders with a non-null `estimatedValue` (a tender with no price is
     not "priced"). Verify status assumptions the same way as A.
  3. Bucket by estimator name.
  4. `priced` = count; `sumEstimatedValue` = `Σ decimalToNumber(estimatedValue)`.
  5. Sort descending by `sumEstimatedValue`.

### 2. Role-gated visibility

**Estimator self-view MUST NOT expose another estimator's rows.**

- Read how the current-user context is threaded into `ReportRunParams` / `run()` today
  (check `reporting.service.ts`, `reporting.controller.ts`, and any `spec` files).
- If the current user's role is estimator-only, the `run()` MUST filter tenders to
  `assignedEstimatorId = currentUser.id` (self-view) regardless of the `estimator` param
  the caller passed.
- If the current user is manager/leadership, no self-filter (full rollup).
- If today's framework does not thread `currentUser` into `run()`, add the SMALLEST
  possible plumbing (one field on `ReportRunParams`, one line in the controller to
  populate it, one line in each affected `run()`). Do NOT refactor the whole reporting
  framework in this slice.

### 3. Wire into `REPORT_DEFS`

In `apps/api/src/modules/reporting/reporting.service.ts`, spread
`ESTIMATING_ANALYTICS_REPORT_DEFS` into `REPORT_DEFS` using the same pattern already used
for `TENDER_WINLOSS_REPORT_DEFS`.

### 4. Web widget registry

Read `apps/web/src/dashboards/widgets/reportRegistry.ts`. If it factory-generates
`report:table:<key>` / `report:chart:<key>` widgets from the summaries endpoint, **no web
edit is required** and you should REMOVE `reportRegistry.ts` from your commit rather than
touch it. Only edit it if a registration is genuinely required (justify in the PR body).

### 5. Unit tests — `estimating-analytics-report.definitions.spec.ts`

Mirror the mock-Prisma pattern in `win-likelihood.service.spec.ts` and the existing
reporting specs. Cover:

- **A / turnaround:**
  - Still-open tender is EXCLUDED from the bucket.
  - Tender with null `submittedAt` (null `leadTimeDays`) is skipped, not counted as 0.
  - Two tenders for same estimator average correctly.
  - Sort order (longest avg first).
- **B / qty-vs-value:**
  - Tender with null `estimatedValue` is excluded.
  - `Decimal` values are converted via `decimalToNumber()` (never rendered as `{s, e, d}`).
  - Sum + count are grouped by estimator.
  - Sort order (largest sum first).
- **Role gate:**
  - Estimator self-view returns only their own rows regardless of param.
  - Manager view returns all rows.
- **Advisory:** no `run()` performs a Prisma create/update/delete (read-only).

## Do NOT

- Do NOT edit `apps/api/prisma/schema.prisma`. Both definitions are read-only aggregations
  over existing tables. No migration, no `gate_allow: migrations`.
- Do NOT rebuild `tender-winloss-by-estimator` / `-by-client` / `-by-value-band` — the
  preset (EA-2) ASSEMBLES them. Adding "a better version" in this slice is out of scope.
- Do NOT copy-paste `leadTimeDays` maths. Reuse via
  `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` (extract a
  shared helper if the existing surface does not fit).
- Do NOT include still-open tenders in the turnaround report — Decision D3.
- Do NOT expose one estimator's numbers to another via the self-view — Decision D5.
- Do NOT invent a new permission. Reuse the reporting controller's existing gate.
- Do NOT build the curated dashboard preset in this slice — that is EA-2.
- Do NOT build any Excel-style pivot UI — Decision D7 (out of scope for this program).
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside declared scope.
- Do NOT exceed 6 files. If you find yourself editing more, stop and re-scope.
- Do NOT use `requires_merged` (this slice has no dependency).
