---
premise: '! test -f apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts'
premise_means: The bid-prioritisation service does not exist yet; BP-1 has not landed.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/bid-prioritisation/**
  - apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.spec.ts
  - apps/api/src/modules/reporting/bid-priority-report.definitions.ts
  - apps/api/src/modules/reporting/reporting.service.ts
  - apps/api/src/modules/reporting/reporting.module.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts && grep -q "bid-priority-worth-chasing" apps/api/src/modules/reporting/reporting.service.ts && grep -q "bid_priority_win_weight" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: additive nullable columns on OperationsSettings; safe to leave on main if the code lands stale (app defaults to weight=1.0 when null). To fully revert, drop the two columns after reverting the report definition.
backfill: false
---

# HOLD — BP-1: Priority API + expected-value compute (advisory ranked "worth chasing" report)

STATUS: DRAFTED, STAGED, HOLD. Arm by renaming to `pr-bp-s1-priority-api-ready.md`. Head
of the bid-prioritisation chain; BP-2 chains behind this via `requires_file_on_main`.

Extends the WL-3 program (`docs/plans/tender-winloss-ml-plan.md`, `docs/plans/bid-prioritisation-plan.md`)
by adding the CROSS-TENDER ranked list WL-3 does not have. Reuses the WL3-S1 win-likelihood
service — do NOT recompute win-likelihood, do NOT add ML/stats dependencies.

## ADVISORY ONLY — non-negotiable

The ranking this slice ships MUST NEVER feed pricing, auto-accept, or auto-reject anywhere
in the codebase. It ranks and surfaces; humans decide. This is the WL-3 guardrail inherited
unchanged, and the plan's Locked Decision #1.

## What to build

1. **New module `apps/api/src/modules/bid-prioritisation/`** with:
   - `bid-prioritisation.service.ts` — `rankOpenTenders()` returns rows of
     `{ tenderId, tenderNumber, title, clientName, estimatedValue, pointEstimate,
        expectedValue, whyTopFactors, dataStatus: "OK" | "INSUFFICIENT_DATA" }`.
     - Load OPEN tenders in a SINGLE `findMany` (statuses NOT in
       `["AWARDED","LOST","CONTRACT_ISSUED","WITHDRAWN"]`).
     - For each, call `WinLikelihoodService.computeForTender` — MEMOISE on the cohort key
       `(clientId, valueBand, season)` so identical cohorts are computed once. No N+1.
     - Read `bidPriorityWinWeight` and `bidPriorityValueWeight` from `OperationsSettings`;
       default each to `1.0` when the row or column is null.
     - Score = `weightWin * pointEstimate * weightValue * Number(estimatedValue)`.
     - If `pointEstimate` is null OR `estimatedValue` is null → emit `expectedValue: null`
       with `dataStatus: "INSUFFICIENT_DATA"`. **NEVER substitute 0** — that would mis-rank
       real opportunities off the top of the list.
     - Sort: `OK` rows by `expectedValue DESC`, then `INSUFFICIENT_DATA` rows appended
       after, sorted by `dueDate ASC` as a stable tiebreak.
   - `bid-prioritisation.module.ts` — imports `WinLikelihoodModule`, exports the service.
   - `bid-prioritisation.service.spec.ts` — Jest unit tests covering:
     - correct ranking by expected value;
     - null `pointEstimate` → INSUFFICIENT_DATA, `expectedValue: null`;
     - null `estimatedValue` → INSUFFICIENT_DATA, `expectedValue: null`;
     - weight override read from `OperationsSettings` changes the ranking;
     - memoisation: `computeForTender` called at most once per unique cohort key.

2. **Report definition** in
   `apps/api/src/modules/reporting/bid-priority-report.definitions.ts` — key
   `bid-priority-worth-chasing`, label `"Worth Chasing (Bid Priority)"`, RBAC
   `tenders.view` (REUSE — do NOT invent a new permission). No params required.
   Register it in the `REPORT_DEFS` array in
   `apps/api/src/modules/reporting/reporting.service.ts` and wire the service provider in
   `apps/api/src/modules/reporting/reporting.module.ts` (import `BidPrioritisationModule`).

3. **Additive migration** on `OperationsSettings`:
   ```
   ALTER TABLE operations_settings ADD COLUMN bid_priority_win_weight   NUMERIC(6,3);
   ALTER TABLE operations_settings ADD COLUMN bid_priority_value_weight NUMERIC(6,3);
   ```
   Both nullable. **No `UPDATE ... SET` backfill** — the app-side default of `1.0` handles
   nulls, and `backfill: false` in front-matter reflects that. Full timestamp migration
   folder. Update the `OperationsSettings` model in `schema.prisma` with the two new
   `Decimal?` fields (`@db.Decimal(6, 3)`) mapped to those column names.

4. **Regenerate the data-model map** — mandatory per PROMPT-SCHEMA whenever
   `schema.prisma` changes:
   ```
   node scripts/data-model/build-relationship-map.mjs
   ```
   Commit `docs/data-model/relationship-map.json`, `relationship-map.md`, and
   `metadata-catalog.json`. CI's data-model drift check hard-fails on a stale map.

## PR body must include

- **`GATE-ALLOW: migrations`** as a bare line at column 0 of the PR body (NOT
  `## GATE-ALLOW`, NOT with a trailing period — CP-11 fails those variants; see PROMPT-SCHEMA
  §gate_allow).
- One-line data-model impact: two nullable Decimal columns on `OperationsSettings`, no
  backfill, app-side default 1.0.
- Explicit **ADVISORY ONLY** statement quoting Locked Decision #1 of the plan.
- Note that `escalates: true` gates MERGE only (per PROMPT-SCHEMA) — the watcher opens the
  PR and leaves it for Marco.

## Do NOT

- Do NOT add a new bespoke endpoint outside the reporting framework — the plan picks
  `ReportDefinition` deliberately.
- Do NOT recompute win-likelihood, do NOT reach into `WinLikelihoodFeaturesService`
  internals — call `computeForTender` and consume its output.
- Do NOT add any ML or stats library dependency.
- Do NOT invent a new permission; reuse `tenders.view`.
- Do NOT substitute `0` for null `pointEstimate` or null `estimatedValue`.
- Do NOT let the score feed pricing, auto-accept, or auto-reject.
- Do NOT touch `/sot/`. Do NOT ship UI in this slice (that is BP-2).
- Do NOT use `requires_merged` for the chain — BP-2 uses `requires_file_on_main`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- **Never ask a question or "stand by" for a go/no-go.** The go was given when this prompt
  was armed.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.
- `escalates: true` gates MERGE only, per PROMPT-SCHEMA — it does NOT stop the run.

## VERIFY

- `pnpm build && pnpm lint` green.
- `pnpm --filter @project-ops/api test` green including the new
  `bid-prioritisation.service.spec.ts`.
- `apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts` exists on branch.
- `REPORT_DEFS` in `reporting.service.ts` includes `"bid-priority-worth-chasing"`.
- `schema.prisma` contains `bid_priority_win_weight` and `bid_priority_value_weight`.
- `node scripts/data-model/build-relationship-map.mjs --check` prints OK.
- PR body has `GATE-ALLOW: migrations` bare at column 0.
