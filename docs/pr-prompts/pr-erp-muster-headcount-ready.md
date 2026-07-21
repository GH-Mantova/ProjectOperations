---
premise: '! grep -q "model MusterEvent" apps/api/prisma/schema.prisma'
premise_means: There is no live muster / evacuation headcount from site sign-in.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/safety/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model MusterEvent" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: false
---
# HOLD - ERP: live muster / evacuation headcount

STATUS: ARMED 2026-07-21 by Station 04 at Marco's request. Gate SATISFIED: `model SiteAttendance` IS on origin/main b6e63cb (site sign-in shipped), so the muster roll now has an attendance source. Read the open attendances (`signedOutAt` NULL) as the on-site roll.

## What to build (when armed)
Branch: `feat/erp-muster-headcount`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema ??? `MusterEvent` (siteId, startedAt, startedById, status) capturing who is signed-in-on-site at the
   moment it is triggered; mark each person safe/accounted.
2. API/Web ??? a "start muster" action that snapshots the live on-site headcount (from QR/kiosk sign-ins) and a
   check-off screen for evacuation roll-call; live headcount widget on the site dashboard.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files (#593).
Bare `GATE-ALLOW: migrations` at column 0 of the PR body.

## Do NOT
- Do NOT arm before site sign-in exists. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge ??? leave the PR for Marco.
