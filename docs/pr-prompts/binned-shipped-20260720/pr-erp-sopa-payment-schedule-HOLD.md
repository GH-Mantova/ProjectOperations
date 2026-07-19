---
premise: '! grep -q "model PaymentSchedule" apps/api/prisma/schema.prisma'
premise_means: Progress claims exist but there is no SOPA payment-schedule response record (AU Security of Payment).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/procurement/**
  - apps/api/src/modules/projects/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model PaymentSchedule" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap A/commercial | SOPA payment schedule -->
# ERP gap — SOPA payment-schedule response on claims (AU Security of Payment)

STATUS: DRAFTED, STAGED, arm-eligible. NOTE (forensic): `ProgressClaim`/`ClaimLineItem`/retention already
exist. The gap is the statutory **payment schedule** response (AU Security of Payment Act) — a scheduled
amount + reasons issued within the statutory window; missing it can make the full claimed amount payable.

## What to build
Branch: `feat/erp-sopa-payment-schedule`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `PaymentSchedule` (progressClaimId, scheduledAmount, reasons?, respondedAt, dueBy computed from
   the claim date + a configurable statutory window, status). Link 1:1 to `ProgressClaim`.
2. API — create/record a payment schedule against a claim; surface the statutory due-by date and a
   warning when it is approaching/overdue. Make the window a configurable setting (state-based), not hardcoded.
3. Web — on the progress-claim view, a "payment schedule" panel with due-by + status.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT give legal advice in-app beyond surfacing the configurable window + status. Do NOT hardcode the
  statutory period. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
