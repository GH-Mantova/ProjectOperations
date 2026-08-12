# Bid-Prioritisation Ranked "Worth Chasing" View — Plan

**Status:** SLICE-0 emitted 2026-08-12. BP-1 + BP-2 slice prompts authored (HOLD).

## Program context

This plan extends the **WL3 win-likelihood program** (`docs/plans/tender-winloss-ml-plan.md`).
WL3-S1 ships `GET /tenders/:id/win-likelihood` — a point estimate, Wilson CI, and why-factors
for a SINGLE tender. WL3-S2 (already planned, in `tender-winloss-ml-plan.md`) will surface that
estimate on the tender detail page (single-tender widget). **This plan adds what WL3 does not
have: a cross-tender ranked list** — open tenders ordered by "expected value" (likelihood ×
estimated value), so estimators can see at a glance which bids are worth chasing.

### What this is NOT

- **NOT WL3-S2.** WL3-S2 is the single-tender detail widget. This plan is the cross-tender
  ranked list. The two are complementary and MUST NOT overlap.
- **NOT the staged estimating-analytics** (historical win/loss descriptives — WL-2).
- **NOT the estimator-allocation "assign-next"** feature (who prices, not which tender to chase).
- **NOT an ML system.** The score is arithmetic: `pointEstimate × estimatedValue`, configurable
  weight, computed over the existing win-likelihood API output.

---

## Guardrails (all slices, non-negotiable)

These are inherited from WL3 and extended:

1. **ADVISORY ONLY.** The ranking MUST NEVER feed pricing, auto-accept, or auto-reject. It ranks
   and surfaces; humans decide. Every slice body must restate this.
2. **No ML/stats library dependencies.** The score is arithmetic over existing API output.
3. **Reuse `tenders.view` permission.** Do NOT invent a new permission gate.
4. **Null/UNKNOWN handling.** A tender with null `pointEstimate` or UNKNOWN value band MUST render
   as "insufficient data" — never a fake 0 that mis-ranks it against real estimates.
5. **No N+1 cohort query.** The ranking computes win-likelihood for every open tender; the
   implementation MUST batch or cache; a sequential per-tender query is a correctness defect.
6. **No schema change unless the configurable weight requires a config row.** If that config row
   is needed it belongs in BP-1 (with `gate_allow: migrations`).

---

## Locked decisions (PR-Master, 2026-08-12)

| # | Decision |
|---|---|
| D1 | Expected-value score = `pointEstimate × estimatedValue`, with admin-configurable weighting (data, not code). Stored in config layer consistent with ERP doctrine. |
| D2 | Null `pointEstimate` or UNKNOWN value band → display "insufficient data". Score is NOT imputed as 0. |
| D3 | Permission gate: `tenders.view` (reuse, do not invent). |
| D4 | Advisory-only guardrail: result MUST NOT feed pricing or automated accept/reject. |
| D5 | Win-likelihood reuse: call `WinLikelihoodService` (already exported). Do NOT re-implement or add stats deps. |
| D6 | Performance: batch the cohort query across all open tenders in one pass; do not N+1. |

---

## Reuse map (grounded against origin/main, 2026-08-12)

| Artifact | Path | What to reuse |
|---|---|---|
| Win-likelihood service | `apps/api/src/modules/win-likelihood/win-likelihood.service.ts` | `WinLikelihoodService` — `pointEstimate`, `interval`, `confidence`, `whyFactors`, `captureGaps` |
| Feature-extraction service | `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` | `WinLikelihoodFeaturesService`, `VALUE_BAND_EDGES`, `TenderFeatures` |
| Permission gate | `apps/api/src/modules/tendering/tendering.controller.ts` | `JwtAuthGuard`, `PermissionsGuard`, `@RequirePermissions('tenders.view')` pattern |
| Reporting framework | `apps/api/src/modules/reporting/` | `ReportDefinition` pattern (if the endpoint is expressed as a report) |

---

## Ordered slices

### BP-1 — Priority API + expected-value compute (backend + tests)

**Slug:** `priority-api`
**Gate:** `gate_allow: migrations` ONLY IF the configurable weight needs a DB config row (decide
in the prompt body). If weight is hardcoded to 1.0 and made configurable later, no migration is
needed.

**What it builds:**
- An endpoint (or `ReportDefinition` — the prompt body picks one) that returns open tenders ranked
  by expected value.
- Expected-value formula: `score = pointEstimate × estimatedValue × weight` (weight from config or
  hardcoded 1.0 with a TODO comment and a named constant for easy replacement).
- Calls `WinLikelihoodService` for each open tender in a single batched pass.
- Returns: `{ tenderId, title, client, estimatedValue, dueDate, pointEstimate, confidence,
  expectedValueScore, whyFactors, insufficientData: boolean }[]` sorted descending by
  `expectedValueScore` (nulls / UNKNOWN last).
- Unit tests: score computation, null handling, sort order, batching contract.
- Advisory-only: endpoint must be read-only; no write path.

**Dependency:** none (WL3-S1 already merged as of 2026-08-12 per worktree HEAD).

**Config row (if needed):** a single `AppConfig` row keyed `bid_priority_weight` (Decimal, default
1.0, admin-editable). If the existing config/settings infrastructure supports in-process constants
(check `app.module.ts` / settings module first), prefer that over a migration. The prompt must
verify and decide.

### BP-2 — Web "worth chasing" ranked view (frontend)

**Slug:** `worth-chasing-view`
**Gate:** `gate_allow: none`

**What it builds:**
- A sorted list/table page (or panel on the tender pipeline page): tender name, client, estimated
  value, win-likelihood (%), expected-value score, and why-factors summary.
- Tenders with `insufficientData: true` shown at the bottom with a "Insufficient data" label —
  never a fake score.
- A win-likelihood/priority column on the existing tender pipeline list (coordinate with WL3-S2's
  detail widget to avoid duplicating the per-tender widget).
- Gated on BP-1 file (`requires_file_on_main`).
- Advisory-only label visible on the page: "Rankings are advisory only. They do not feed pricing
  or acceptance decisions."

**Dependency:** `requires_file_on_main: apps/api/src/modules/win-likelihood/win-likelihood.service.ts`
(ensures WL3-S1 is merged AND BP-1 has shipped its service file before this runs).

---

## Sequencing

```
WL3-S1 (merged) ──► BP-1 (priority API) ──► BP-2 (worth-chasing view)
                                             WL3-S2 (detail widget) ──► BP-2 also coordinates here
```

BP-2 must coordinate with WL3-S2 so the tender pipeline list column is added once, not twice.
The BP-2 prompt body must instruct the agent to check whether WL3-S2 has already added a
win-likelihood column before adding one.

---

## Files authored in this SLICE-0

- `docs/plans/bid-prioritisation-plan.md` (this file)
- `docs/pr-prompts/pr-bp-s1-priority-api-HOLD.md`
- `docs/pr-prompts/pr-bp-s2-worth-chasing-view-HOLD.md`
