# Bid Prioritisation — cross-tender "worth chasing" ranked view (WL3 extension)

**Status:** SLICE-0 (this doc). Plan authored 2026-08-12.
**Extends:** `docs/plans/tender-winloss-ml-plan.md` (WL3 program).
**Distinct from:** WL3-S2 (single-tender detail widget), estimating-analytics (historical),
estimator-allocation (assign-next: who prices, not which to chase).

## Background

WL3-S1 shipped a per-tender **baseline win-likelihood API**
(`GET /tenders/:id/win-likelihood` on `apps/api/src/modules/tendering/tendering.controller.ts`,
backed by `apps/api/src/modules/win-likelihood/win-likelihood.service.ts` +
`win-likelihood-features.service.ts`). It returns `pointEstimate` + 95% Wilson CI +
why-factors, with feature extraction reusing `VALUE_BAND_EDGES` and `resolveCurrentOutcome`.

WL3-S2 (planned, `docs/plans/tender-winloss-ml-plan.md`) surfaces that likelihood on the
**tender detail page** as a read-only advisory widget.

**The gap this plan closes:** nothing today ranks OPEN tenders **across the portfolio** by
how much they are worth chasing. `estimatedValue` (Decimal, `apps/api/prisma/schema.prisma:1119`)
and `dueDate` (`schema.prisma:1115`) already live on `Tender`, and win-likelihood already
computes per tender — join them and the cohort has a natural expected-value ordering. No
web reference to win-likelihood exists on `main` yet (nothing surfaced).

## Locked decisions (PR-Master, 2026-08-12) — bake in, do NOT re-litigate

1. **Advisory only.** The ranking MUST NEVER feed pricing, auto-accept, or auto-reject
   (inherited WL3 guardrail — restated in every slice body). It ranks and surfaces; humans
   decide which tenders to pursue.
2. **Expected-value score = `pointEstimate x estimatedValue`**, subject to an
   **admin-configurable weighting** (weights are DATA, not code — consistent with the ERP
   config-layer doctrine). BP-1 chooses the storage shape (JSON config row vs. lookup) and
   states it in-slice.
3. **Null / UNKNOWN handling is explicit.** A tender with `pointEstimate == null`
   (WL3-S1 returns null when the cohort is empty) or `estimatedValue == null` /
   `valueBand: "UNKNOWN"` MUST render as **"insufficient data"** and MUST be excluded
   from the ranked position (or sorted to the bottom in a clearly-labelled bucket).
   Never substitute a fake `0` — that mis-ranks by producing a false tie with genuinely
   low-value bids.
4. **Reuse `tenders.view` permission.** Do NOT invent a new permission (WL3 guardrail).
5. **No ML/stats library dependencies.** The score is arithmetic (`Decimal.toNumber()` on
   `estimatedValue` × the `pointEstimate` returned by `win-likelihood.service`). Reuse the
   Decimal handling pattern that WL3-S1 already established.
6. **Reuse WL3-S1; do NOT recompute.** The ranking calls `WinLikelihoodService` per tender
   in the cohort — with batching / short-lived caching so a cohort of N does not become an
   N+1 pattern. If per-request cost is meaningful, BP-1 documents the batching strategy
   (e.g. compute cohort features once, reuse across tenders).
7. **Distinct from WL3-S2.** WL3-S2 is the per-tender detail widget. BP-2 is the
   cross-tender ranked list plus a **column** on the existing pipeline list
   (`apps/web/src/pages/tendering/TenderingPage.tsx`). BP-2 must coordinate with — never
   duplicate — WL3-S2's widget.

## Sub-slices (ORDERED; each <= ~10 files; authored as `-HOLD.md`)

### BP-1 (S1) — Priority API + expected-value compute

**Backend, read-only, advisory.** Exposes an endpoint (or a `ReportDefinition` registered
under `apps/api/src/modules/reporting/`, reusing the reporting framework — the slice picks
one and states why) that returns OPEN tenders ranked by expected value
(`pointEstimate x estimatedValue`, with the admin-configurable weight applied).

Reuses `WinLikelihoodService`; reuses `VALUE_BAND_EDGES`; handles `null`/`UNKNOWN`
explicitly per decision #3; permission-gated on `tenders.view` per decision #4; asserts
"advisory only" in a doc-comment on the service.

Backend + unit tests. **NO schema unless the configurable weight requires a new config
row.** If it does, that slice — and only that slice — carries `gate_allow: migrations`
+ non-empty `rollback_strategy` + `escalates: true` + the `docs/data-model/**` regen +
`GATE-ALLOW: migrations` bare in the PR body. Prefer a JSON blob under an existing
`SystemSetting`/`AdminSetting` shape if one exists, to avoid the migration overhead.

### BP-2 (S2) — Web "worth chasing" ranked view

**Frontend, advisory, gated on BP-1.** Two surfaces:

1. A new sorted list/table page (or drawer within Tendering) showing:
   tender · client · value · win-likelihood · expected-value · top-3 why-factors ·
   "insufficient data" badge where applicable.
2. A **win-likelihood / expected-value column** on the existing tender pipeline list
   (`apps/web/src/pages/tendering/TenderingPage.tsx`), sortable.

Coordinates with — does NOT duplicate — WL3-S2's per-tender detail widget. Chained via
`requires_file_on_main: <a new file BP-1 creates>` (typically the service or definition
file).

## Guardrails (all slices)

- **Advisory only** — the ranking MUST NEVER feed pricing, auto-accept, or auto-reject.
- Reuse `tenders.view`; do NOT invent a new permission.
- Reuse WL3-S1 (`WinLikelihoodService` + `VALUE_BAND_EDGES` + `resolveCurrentOutcome`);
  do NOT recompute win-likelihood or add ML/stats deps.
- Explicit null/UNKNOWN handling (decision #3) — never a fake `0`.
- Do NOT duplicate WL3-S2 (single-tender detail widget).
- Do NOT edit `/sot/`. Do NOT touch Azure/Entra/SharePoint. Do NOT use `requires_merged`.
- Every slice body carries the verbatim STANDING AUTHORITY block, per
  `docs/pr-prompts/PROMPT-SCHEMA.md`.
- Every slice prompt lints ADMIT under `node scripts/pipeline/lint-prompt.mjs` (exit 0).

## References

- `docs/plans/tender-winloss-ml-plan.md` — WL3 program.
- `apps/api/src/modules/win-likelihood/win-likelihood.service.ts` — reusable scorer.
- `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` —
  `VALUE_BAND_EDGES`, `resolveCurrentOutcome`.
- `apps/api/src/modules/tendering/tendering.controller.ts` — wiring precedent.
- `apps/api/src/modules/reporting/reporting.service.ts` — `ReportDefinition` framework
  (if BP-1 chooses that path).
- `apps/api/prisma/schema.prisma` L1102+ — `Tender` (dueDate, estimatedValue, status).
