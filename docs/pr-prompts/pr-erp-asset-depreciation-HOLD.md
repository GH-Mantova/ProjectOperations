---
premise: '! grep -rqi "depreciation" apps/api/src'
premise_means: There is no asset depreciation calculation.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/assets/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "depreciation" apps/api/src
size: 8
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: DO-NOT-ARM (DECISION required) | ERP gap B/asset | depreciation -->
# HOLD — ERP: asset depreciation (DECISION: build vs Xero)

STATUS: DRAFTED, STAGED, **DO NOT ARM — needs Marco's decision.** Depreciation may be better owned by Xero
(consistent with "keep Xero as the ledger"). Only arm if Marco decides to compute plant depreciation inside
the ERP (e.g. for internal plant-hire rate build-up), not for statutory accounts.

## What to build (only if Marco decides to build it)
Branch: `feat/erp-asset-depreciation`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — depreciation fields on `Asset` (method straight-line|declining, cost, residual, usefulLifeMonths,
   startDate) + a computed/derived book value; optional `AssetDepreciationEntry` for period schedules.
2. API/Web — show current book value + a depreciation schedule on the asset.

## Do NOT
- Do NOT arm without Marco's explicit decision. Do NOT attempt to sync depreciation to Xero. Do NOT touch
  Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
