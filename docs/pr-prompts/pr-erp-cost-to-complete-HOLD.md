---
premise: '! grep -rqi "costToComplete\|cost_to_complete" apps/api/src'
premise_means: There is no cost-to-complete / forecast-at-completion view against job budget.
scope:
  - apps/api/src/modules/projects/**
  - apps/api/src/modules/procurement/**
  - apps/web/src/pages/**
done_when: pnpm build && pnpm lint && grep -rqi "costToComplete\|cost_to_complete" apps/api/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: DO-NOT-ARM (gated on commitments) | ERP gap A/commercial | cost-to-complete -->
# HOLD — ERP: cost-to-complete forecasting

STATUS: DRAFTED, STAGED, **DO NOT ARM** until `pr-erp-commitments-budget` has merged (needs committed cost).
Combines budget + committed (from commitments) + actual to forecast cost-at-completion and margin. Procore
parity. Arm after commitments lands.

## What to build (when armed)
Branch: `feat/erp-cost-to-complete`. Reviewer: `GH-Mantova`. No migration expected.
1. API — compute per-job forecast: budget vs committed vs actual vs forecast-at-completion + variance; feed
   the staged BI/reporting layer.
2. Web — a cost-to-complete panel on the job (budget / committed / actual / forecast / variance).

## Do NOT
- Do NOT build until commitments exists. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
