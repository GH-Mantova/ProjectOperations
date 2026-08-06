---
premise: 'grep -q "model EstimateLabourRate" apps/api/prisma/schema.prisma'
premise_means: >-
  The legacy Estimate*Rate / EstimateMaterialDensity models are still in
  schema.prisma; the permanent removal of the legacy rates tables, API, and
  resolver fallback has not been done.
scope:
  - apps/api/src/**
  - apps/api/prisma/**
  - apps/api/prisma/migrations/**
  - tests/e2e/**
  - docs/data-model/**
done_when: >-
  pnpm build && ! grep -q "model EstimateLabourRate" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
escalates: true
seed_only: false
requires_file_on_main:
  - docs/data-model/rates-migration/STEP-11B-DONE.md
rollback_strategy: >-
  PERMANENT / NOT auto-revertable once merged — drops tables. A pre-merge DB
  backup is the rollback path. Do not merge without it.
---

# SLICE 11c — remove the legacy rates tables, API, and resolver fallback

## ⛔ HARD STOP — OPEN AS DRAFT; MARCO SIGN-OFF + DB BACKUP BEFORE MERGE ⛔
This slice DROPS database tables. It is permanent and NOT auto-revertable.
**Open the resulting feature PR as a DRAFT** (`gh pr create --draft ...`) so
GitHub itself refuses the merge until Marco explicitly marks it ready — this is
the hard, automation-proof lock. Do NOT arm auto-merge. The PR MUST also be
labelled **do-not-merge** and left for Marco. Do NOT merge it — and Marco must
not mark it ready / merge it — until BOTH are true:
1. A production DB backup of the `Estimate*Rate` + `EstimateMaterialDensity`
   tables has been taken.
2. A full real pricing cycle has run on `RATES_CANONICAL_SOURCE=ratetable` and
   `node scripts/rates/fallback-audit.mjs` shows ZERO fallbacks.
The slice may RUN and go green (proving the drop compiles/passes) while staying
a DRAFT; the MERGE waits on the two conditions above and Marco marking it ready.
This is the point of no return for the plan.

Read `docs/plans/rates-migration-plan.md` (section "11c") first. Gated on 11b
(STEP-11B-DONE.md on main).

## Do
1. Migration dropping the eight legacy `Estimate*Rate` tables and
   `EstimateMaterialDensity`, and removing those models from `schema.prisma`
   (regenerate the client; update sot/04 references via the normal spec update
   in-scope — do NOT edit /sot/ directly, note it for a doc-reconcile).
2. Delete the `/estimate-rates/*` controller + service and their tests.
3. Remove the resolver's `tryLegacy` path and the ratetable-miss → legacy
   fallback in `rate-resolver.service.ts`; a genuine miss now throws (as designed).
4. If `RATES_CANONICAL_SOURCE` handling is now vestigial, either remove it or
   leave it defaulting to ratetable — flag the choice for Marco at review.
5. Confirm no consumer (scope-item-pricing, scope-waste, scope-of-works,
   tender-rate-set, estimates, lookup-rate, tip-recommendations) reads a legacy
   model.

## Do NOT
- Do NOT open as a normal (non-draft) PR. Do NOT arm auto-merge. Do NOT merge
  (see HARD STOP). Do NOT skip the backup.
- Do NOT change any surviving rate value.

## Verify
- `pnpm build`; parity/fallback audit still green; full API + e2e suites green;
  grep confirms no legacy model or `/estimate-rates` route remains.
