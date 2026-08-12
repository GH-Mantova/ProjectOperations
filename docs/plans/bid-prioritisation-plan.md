# Bid Prioritisation — Ranked "Worth Chasing" View — Plan

**Status:** slices staged -HOLD (2026-08-12). Extends the WL-3 program without duplicating it.

## Program relationship (READ BEFORE EDITING)

This is the **cross-tender ranked list** that WL-3 does not have. WL3-S1 (merged, #1014)
gave every tender a baseline win-likelihood (`GET /tenders/:id/win-likelihood`, point
estimate + 95% Wilson CI + why-factors). WL3-S2 (planned in
`docs/plans/tender-winloss-ml-plan.md`) is the **single-tender detail widget** on the tender
detail page.

Neither answers *"of the tenders open right now, which are worth chasing first?"* That is
the gap this plan fills, by joining the existing win-likelihood with `estimatedValue` and
`dueDate` already on `Tender` (schema.prisma:1102) into an expected-value ranking.

Related program docs — read alongside:
- `docs/plans/tender-winloss-ml-plan.md` (WL-3 program; WL3-S2 detail widget)
- WL3-S1 API: `apps/api/src/modules/win-likelihood/win-likelihood.service.ts`

## Locked decisions (PR-Master, 2026-08-12) — baked into every slice

1. **ADVISORY ONLY.** The ranking MUST NEVER feed pricing, auto-accept, or auto-reject. It
   ranks and surfaces; humans decide. This is the WL-3 guardrail, inherited unchanged.
2. **Expected-value score = `pointEstimate × estimatedValue`, with an admin-configurable
   weighting.** Formula is `weightWin × pointEstimate × weightValue × estimatedValue` where
   both weights default to `1.0`. Weights live in `OperationsSettings` (data, not code —
   consistent with the ERP's config-layer doctrine). Adding the two nullable columns is why
   BP-1 carries `gate_allow: migrations`.
3. **Null / UNKNOWN handling is explicit and NEVER a fake zero.** A tender with no
   `estimatedValue` OR whose win-likelihood returns `pointEstimate: null` (cohort too small)
   is surfaced in a **separate "insufficient data" bucket** with score `null`, sorted after
   the ranked cohort. A missing value ranking as `$0 × p = $0` would push real
   opportunities off the top of the list — that is the anti-pattern this decision closes.
4. **Reuse `tenders.view` permission.** No new permission is invented. (WL-3 guardrail.)
5. **Distinct from and non-overlapping with**:
   - WL3-S2 — single-tender detail widget (this plan does not touch the detail page's
     win-likelihood panel; BP-2 coordinates with it for column reuse).
   - Staged estimating-analytics (historical; different data set).
   - Staged estimator-allocation "assign-next" (who prices, not which to chase).
6. **No ML / stats library dependencies.** The score is arithmetic over the existing
   `WinLikelihoodService.computeForTender()` output. WL3-S1 already ships the only stats
   this plan needs (Wilson CI on the underlying point estimate).
7. **Performance: batch, do not N+1.** BP-1 computes win-likelihood per open tender; the
   ranker MUST batch the cohort query (single `findMany` for open tenders + a batched
   feature/likelihood pass) and MUST NOT loop calling `computeForTender` inside a per-row
   handler. A short in-memory memoisation on `(clientId, valueBand, season)` cohort keys is
   permitted; a persistent cache table is NOT in scope for BP-1.

## Ordered slices

### BP-1 (S1) — Priority API + expected-value compute — `pr-bp-s1-priority-api-HOLD.md`

**Backend + tests. Delivered as a `ReportDefinition`** registered on the existing
reporting framework (`apps/api/src/modules/reporting/reporting.service.ts`, alongside
`tender-winloss-report.definitions.ts`) — NOT a new bespoke endpoint. Reusing the report
framework gives us params, RBAC, and the standard `POST /reports/:key/run` shape for free,
consistent with the WL-2 win/loss reports that already ride it.

Deliverables:
- New `BidPrioritisationService` in `apps/api/src/modules/bid-prioritisation/` that:
  - loads OPEN tenders in a single query (statuses NOT in the terminal set
    `AWARDED | LOST | CONTRACT_ISSUED | WITHDRAWN`),
  - calls `WinLikelihoodService.computeForTender` once per open tender (memoised on
    cohort key so repeated cohorts are not recomputed),
  - reads the two weight fields from `OperationsSettings` (falls back to `1.0` when the
    row / column is null),
  - emits ranked rows `{ tenderId, tenderNumber, title, clientName, estimatedValue,
    pointEstimate, expectedValue, whyTopFactors[], dataStatus: "OK" | "INSUFFICIENT_DATA" }`.
- New report definition `bid-priority-worth-chasing` in
  `apps/api/src/modules/reporting/bid-priority-report.definitions.ts`, registered in
  `reporting.service.ts`'s `REPORT_DEFS`.
- Additive migration adding two nullable Decimal columns on `OperationsSettings`:
  `bid_priority_win_weight`, `bid_priority_value_weight`. **No backfill** — nullable, app
  reads defaults. Slice front-matter therefore declares `backfill: false`.
- Regenerated data-model map (`docs/data-model/**`) — mandatory because schema.prisma
  changes (PROMPT-SCHEMA schema-touch rule).
- Unit specs for the service: ranking correctness, null-guard behaviour (null pointEstimate
  and null estimatedValue both route to `INSUFFICIENT_DATA` with `expectedValue: null`),
  weight override, memoisation (no duplicate `computeForTender` for identical cohort keys).

Slice metadata:
- `gate_allow: migrations` (adds two config columns) — `GATE-ALLOW: migrations` bare at
  column 0 of the PR body.
- `rollback_strategy`: additive nullable columns; safe to leave on main; revert by dropping
  the two columns if the ReportDefinition is also reverted.
- `backfill: false` (satisfies Gate A; the migration is purely `ALTER TABLE ... ADD COLUMN`).
- `escalates: true` — this slice touches production config (extension of
  `OperationsSettings`, a live production table). Watcher opens the PR and does not merge;
  Marco reviews. Per PROMPT-SCHEMA the flag does NOT stop the run.
- `requires_merged` / `requires_file_on_main`: none (this is the head of the chain).

### BP-2 (S2) — Web "worth chasing" ranked view — `pr-bp-s2-worth-chasing-view-HOLD.md`

**Frontend only.** No API changes; consumes BP-1's report via the existing report-runner
UI plumbing, and adds a priority column to the tender pipeline list.

Deliverables:
- New page `apps/web/src/pages/tenders/BidPriorityPage.tsx` — sortable table (tender,
  client, value, win-likelihood, expected-value, top why-factor) with an "insufficient
  data" section pinned below the ranked cohort. Advisory banner in the header, verbatim
  from the WL-3 guardrail.
- Priority column on the tender pipeline list (`apps/web/src/pages/tenders/**`) —
  additive; existing default sort unchanged; column hidden behind the same feature flag
  the page uses so we can dark-launch. Coordinate with WL3-S2's detail widget so that
  clicking through from the ranked list lands on the same win-likelihood panel — do not
  render a second copy.
- Route registration, nav link (under Tenders, next to "Pipeline"), unit tests for the
  sort + null-bucket behaviour.

Slice metadata:
- `gate_allow: none` (docs already regenerated in BP-1; no schema, no env vars, no deps).
- `requires_file_on_main`: `apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts`
  (chains behind BP-1's landing on main).
- `escalates: false` (read-only advisory UI).

## Explicit non-goals

- Do NOT recompute win-likelihood or add any ML / stats dependency — reuse WL3-S1.
- Do NOT duplicate WL3-S2 (single-tender detail panel on the tender detail page).
- Do NOT let the ranking feed pricing, auto-accept, or auto-reject anywhere in the codebase.
- Do NOT invent a new permission — `tenders.view` covers this surface.
- Do NOT show `$0` for tenders with null `estimatedValue` or null `pointEstimate`; those
  belong in the "insufficient data" bucket with `expectedValue: null`.
- Do NOT touch `/sot/` — this plan lives in `docs/plans/` as an operational plan.
- Do NOT use `requires_merged` for the BP-1 → BP-2 chain; use `requires_file_on_main`
  (file presence is the durable signal).
