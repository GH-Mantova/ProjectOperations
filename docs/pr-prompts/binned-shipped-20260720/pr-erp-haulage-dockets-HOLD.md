---
premise: '! grep -q "model Docket" apps/api/prisma/schema.prisma'
premise_means: There is no digital delivery / haulage docket capture.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/jobs/**
  - apps/api/src/modules/field/**
  - apps/web/src/pages/**
  - apps/web/src/field/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Docket" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap C/time | digital haulage/delivery dockets -->
# ERP gap — digital delivery / haulage dockets

STATUS: DRAFTED, STAGED, arm-eligible. The paper docket is the lifeblood of skip-bin/waste cartage and
plant hire — direct fit for the sister Redcliffe waste business (`docket`=0). Assignar parity.

## What to build
Branch: `feat/erp-haulage-dockets`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `Docket` (jobId?, assetId? truck/plant, workerId driver, type delivery|haulage|disposal,
   material/wasteType?, quantity/tonnes?, from/to location, docketNumber, signedByName?, gpsLat/Lng?,
   status, capturedAt) + a per-docket attachment/signature (reuse the form attachment/signature pattern or
   add a simple pointer). Sequential docket numbering.
2. API in `jobs`/`field` — create/list dockets; real-time capture endpoint for the field app; guard.
3. Web/field PWA — a mobile docket capture form (driver): pick job/asset/material, qty, from/to, signature;
   office list/register with export.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT build weighbridge hardware integration. Do NOT touch Azure/prod. Consider reusing the forms engine
  signature/attachment models rather than new ones. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
