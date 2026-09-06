---
premise: 'grep -q "model EstimateLabourRate" apps/api/prisma/schema.prisma'
premise_means: >-
  The legacy Estimate*Rate models are still in schema.prisma; the permanent
  removal of the legacy rates tables, API, and resolver fallback has not been
  done. NOTE: EstimateMaterialDensity is explicitly OUT OF SCOPE — see
  "EstimateMaterialDensity is NOT dropped" below.
scope:
  - apps/api/src/**
  - apps/api/prisma/**
  - apps/api/prisma/migrations/**
  - tests/e2e/**
  - docs/data-model/**
done_when: >-
  pnpm build && ! grep -q "model EstimateLabourRate" apps/api/prisma/schema.prisma
  && grep -q ESTIMATE_WASTE_RATES_DROPPED docs/data-model/rates-migration/STEP-11C-DONE.md
size: 8
gate_allow: migrations
escalates: true
backfill: false
seed_only: false
rollback_strategy: >-
  PERMANENT / NOT auto-revertable once merged — drops tables. A pre-merge DB
  backup is the rollback path. Do not merge without it.
requires_file_on_main: docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md
---

# SLICE 11c — remove the legacy rates tables, API, and resolver fallback

## ⛔ HARD STOP — OPEN AS DRAFT; MARCO SIGN-OFF + DB BACKUP BEFORE MERGE ⛔
This slice DROPS database tables. It is permanent and NOT auto-revertable.
**Open the resulting feature PR as a DRAFT** (`gh pr create --draft ...`) so
GitHub itself refuses the merge until Marco explicitly marks it ready — this is
the hard, automation-proof lock. Do NOT arm auto-merge. The PR MUST also be
labelled **do-not-merge** and left for Marco. Do NOT merge it — and Marco must
not mark it ready / merge it — until BOTH are true:
1. A production DB backup of the `Estimate*Rate` tables has been taken.
2. A full real pricing cycle has run on `RATES_CANONICAL_SOURCE=ratetable` and
   `node scripts/rates/fallback-audit.mjs` shows ZERO fallbacks.
The slice may RUN and go green (proving the drop compiles/passes) while staying
a DRAFT; the MERGE waits on the two conditions above and Marco marking it ready.
This is the point of no return for the plan.

Read `docs/plans/rates-migration-plan.md` (section "11c") first. Gated on 11b
(STEP-11B-DONE.md on main).

## Do
1. Migration dropping the eight legacy `Estimate*Rate` tables, and removing
   those models from `schema.prisma` (regenerate the client; update sot/04
   references via the normal spec update in-scope — do NOT edit /sot/ directly,
   note it for a doc-reconcile). **Do NOT touch `EstimateMaterialDensity`** —
   see the section below.
2. Delete the `/estimate-rates/*` controller + service and their tests.
3. Remove the resolver's `tryLegacy` path and the ratetable-miss → legacy
   fallback in `rate-resolver.service.ts`; a genuine miss now throws (as designed).
4. If `RATES_CANONICAL_SOURCE` handling is now vestigial, either remove it or
   leave it defaulting to ratetable — flag the choice for Marco at review.
5. Confirm no consumer (scope-item-pricing, scope-waste, scope-of-works,
   tender-rate-set, estimates, lookup-rate, tip-recommendations) reads a legacy
   model.
6. **On success, write the landed marker** `docs/data-model/rates-migration/STEP-11C-DONE.md`
   carrying the literal token `ESTIMATE_WASTE_RATES_DROPPED` on a line of its own, the way 11a
   and 11b already drop `STEP-11A-DONE.md` / `STEP-11B-DONE.md`. `docs/data-model/**` is already
   in `scope`. **This is not optional bookkeeping:**
   `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` gates on that exact file AND that
   exact token via `requires_on_main`, so until this slice writes it, s3 is parked permanently —
   gates are evaluated before the premise, so it can never surface as SPENT, as a CANDIDATE, or
   as anything a reader can act on. MEASURED by Station 04, 2026-09-06T10:10Z (F1): nothing in
   the repository was told to write that file or that token. Note that `STEP-11A-DONE.md` and
   `STEP-11B-DONE.md` carry prose only (`11b landed`) and no token, so this marker is the first
   of the series that has to be greppable — write the token on its own line.

## Do NOT
- Do NOT open as a normal (non-draft) PR. Do NOT arm auto-merge. Do NOT merge
  (see HARD STOP). Do NOT skip the backup.
- Do NOT change any surviving rate value.
- **Do NOT drop, alter, or empty `EstimateMaterialDensity`, and do NOT remove
  its admin surface.** See below.

## 🛑 `EstimateMaterialDensity` is NOT dropped — scope correction

**Decided by Marco, 2026-09-02.** Earlier versions of this prompt listed
`EstimateMaterialDensity` alongside the eight legacy `Estimate*Rate` tables in
instruction 1 and in the HARD STOP backup list. That was wrong and has been
removed. This resolves the conflict raised in
`docs/pr-prompts/needs-marco/CONFLICT-materialdensity-524-vs-11c-2026-08-26.md`
in favour of `pr-524-rates-b-slice2-canonical-HOLD.md`, whose `done_when`
already requires the model to survive.

Why it stays:

1. **It is not a `$` rate.** It is a physics lookup — 39 rows of material →
   density (kg/m³, or kg/m² for sheet goods) — that converts a measured volume
   or area into the tonnage the tip bills by. Nothing in it is a price, so it
   is not part of the RateTable projection story this slice exists to finish.
2. **It carries waste classification.** `defaultWasteGroup` /
   `defaultWasteItem` auto-classify a scope row's waste stream when a material
   is picked, feeding the scope-waste aggregator's `(wasteGroup, wasteItem)`
   grouping.
3. **It has live consumers on both sides.** Measured 2026-09-02: 47 files
   reference it, 20 of them live — including
   `apps/api/src/modules/estimates/estimate-calculators.ts`,
   `estimates.service.ts`, `apps/api/src/modules/rates/rate-resolver.service.ts`,
   `apps/api/prisma/seed-initial-services.ts`, canonical test
   `CP-08-seed-idempotency.spec.ts`, and
   `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` (Scope of Works).
4. **It is named in four `sot/` documents** — `02-roadmap-and-status.md`,
   `03-progress-log.md`, `04-data-model.md`, `06-active-specs.md`. Dropping it
   would require a Station 05 reconcile across all four, which is not in this
   slice's scope.

The density path — model, rows, admin surface, and the resolver's
`listMaterialDensities` / `resolveMaterialDensity` read seam — is to be left
exactly as-is by this slice.

## Verify
- `pnpm build`; parity/fallback audit still green; full API + e2e suites green;
  grep confirms no legacy model or `/estimate-rates` route remains.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
