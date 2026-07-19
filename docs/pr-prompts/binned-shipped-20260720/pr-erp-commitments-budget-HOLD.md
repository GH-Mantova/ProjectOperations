---
premise: '! grep -q "model Commitment" apps/api/prisma/schema.prisma'
premise_means: There is no commitment (subcontract/PO) cost tracking against job budget.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/procurement/**
  - apps/api/src/modules/projects/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Commitment" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap A/commercial | commitments to budget -->
# ERP gap — commitments (subcontract/PO) tracked against budget

STATUS: DRAFTED, STAGED, arm-eligible. The missing COST side of cost control: progress claims
(`ProgressClaim`) already handle revenue, but committed costs (subcontracts, POs to tip sites / haulage /
plant hire / subbies) are not tracked to budget (`commitment`=0). Procore parity.

## What to build
Branch: `feat/erp-commitments-budget`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `Commitment` (jobId/projectId, type subcontract|purchase_order, supplierId/subcontractorId,
   reference, description, value, status draft|approved|closed, createdAt) + `CommitmentItem` (cost line,
   budget code/category, qty, rate, amount) + optional `CommitmentChange` for variations to a commitment.
   Link to existing procurement PO where one exists.
2. API in `procurement`/`projects` — CRUD; roll committed totals up to the job so a budget view can show
   budget vs committed vs actual. Guard via existing authority seam.
3. Web — a Commitments list on the job with committed-cost total; show against budget.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT build cost-to-complete forecasting here (separate, gated prompt). Do NOT duplicate procurement PO
  if it already fits — extend it. Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
