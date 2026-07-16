---
premise: '! grep -q "model PrequalificationRequest" apps/api/prisma/schema.prisma'
premise_means: There is no structured subcontractor prequalification + insurance-compliance record.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/compliance/**
  - apps/api/src/modules/directory/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model PrequalificationRequest" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: DO-NOT-ARM (VERIFY existing prequal first) | ERP gap D/WHS | subbie prequalification -->
# HOLD — ERP: subcontractor prequalification + insurance compliance

STATUS: DRAFTED, STAGED, **DO NOT ARM until verified.** FORENSIC CAUTION: `prequal` already appears in
`compliance` and `directory` services — there may be partial prequalification logic already. Before arming,
grep those modules and CONFIRM there is no existing prequalification record; if there is, rescope this to
EXTEND it rather than duplicate. HammerTech parity.

## What to build (after verification)
Branch: `feat/erp-subbie-prequal`. Reviewer: `GH-Mantova`. Migration: only if truly new. `GATE-ALLOW: migrations` if so.
1. Schema (if none exists) — `PrequalificationRequest` (subcontractorId, status, insurances[], safety docs,
   licences, expiryDates, verifiedById, verifiedAt, riskRating?). Reuse existing directory/compliance models
   where they fit.
2. API/Web — capture + verify subbie insurances/safety/licences with expiry alerts; a compliance dashboard
   across subcontractors. (An external self-service portal is the separate Power-Pages item — not here.)

## Schema change -> REGENERATE the data-model map (MANDATORY, if schema changes)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files (#593).
Bare `GATE-ALLOW: migrations` at column 0 of the PR body if a migration is added.

## Do NOT
- Do NOT arm without verifying the existing prequal logic first. Do NOT build the external portal here.
  Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
