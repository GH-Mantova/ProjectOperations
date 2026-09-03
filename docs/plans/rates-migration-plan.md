# Rates migration plan — retire the legacy estimate-rates surface (SLICE 11)

Status: APPROVED (Marco, 2026-08-06). Authored by PR Master.
Escalates: yes — every code sub-slice touches live pricing and opens for Marco's review.

## Problem

The production deployment is on `legacy` because `RATES_CANONICAL_SOURCE` is
set in no environment — the only assignment in the repo is `.env.example:209`, a template
that is never loaded, and `.github/workflows/deploy.yml` sets no app settings,
so `app.config.ts:16` resolves the unset value to `legacy`. The resolver is
legacy-first for all eight priced slugs, and pricing reads from the eight
legacy `Estimate*Rate` tables via `EstimateRatesAdminPage`
(`/admin/estimate-rates`). The result is a **dead-edit trap on the new
reference-data screen** (`RatesListsAdminPage`, `/settings/reference-data`):
edits to the six priced categories (labour, plant, waste, cutting, core-hole,
fuel) seeded byte-identically into `RateTable` never reach pricing, while
enclosure, other-rates, and material-densities also resolve from legacy and
remain authoritative there. Two editing surfaces, silently divergent.

The 11c precondition further down this document — *"a full real pricing cycle
has run on `ratetable`"* — is therefore **still unmet**. This is a second,
independent bar on 11c alongside the map-locations decision.

Corrected 2026-09-03: measured, the variable is set in no environment.

## Goal

One canonical rates surface. Estimators edit every rate/reference value on the
new reference-data screen (`RatesListsAdminPage`, `/settings/reference-data`);
the legacy screen, tables, API, and resolver fallback are gone.

## Decisions locked with Marco

1. **Packaging:** a short chain of small steps (not one PR).
2. **Legacy tables:** removed fully (permanent DB change → hard sign-off + backup).
3. **Densities:** folded in. (Forced by decision 2 — deleting `EstimateMaterialDensity`
   would break density lookups unless densities also move. Panel call: model
   material-densities as an `isReference=true` RateTable.)

## Grounding (origin/main, 2026-08-06)

- Canonical resolver: `apps/api/src/modules/rates/rate-resolver.service.ts`
  (`resolveRate`, `assertRateParity`, `resolveMaterialDensity`,
  `resolveReferenceValue`, `getCanonicalSource`). `tryLegacy` covers 6 priced
  slugs; under `ratetable` it tries RateTable first, falls back to legacy on a miss.
- Canonical admin UI already exists: `apps/web/src/pages/admin/RatesListsAdminPage.tsx`
  at `/settings/reference-data` (`/admin/rates-lists` already redirects there).
  The six priced categories were seeded byte-identical (PR #552).
- Legacy surface: `apps/web/src/pages/EstimateRatesAdminPage.tsx` at
  `/admin/estimate-rates`, API `/estimate-rates/*`, models `Estimate*Rate` +
  `EstimateMaterialDensity` in `schema.prisma`.
- Parity/fallback harness: `scripts/rates/fallback-audit.mjs` (PR #747) forces
  `ratetable` and exits 0 only when zero legacy fallbacks are detected; currently
  mirrors the 6 priced slugs.
- Consumers to hold identical: `scope-item-pricing.ts`, `scope-waste.service.ts`,
  `scope-of-works.service.ts`, `tender-rate-set.service.ts`, `estimates.service.ts`,
  `lookup-rate.handler.ts`, `tip-recommendations.service.ts`.

## The three sub-slices (chained, each gated on the prior)

### 11a — Build the three legacy-only categories into the canonical model + migrate
Escalates (schema). Gate: `requires_file_on_main: docs/plans/rates-migration-plan.md`.
- Add `enclosure` and `other-rates` as priced RateTables and `material-densities`
  as an `isReference=true` RateTable (columns/rows mirroring the legacy shape).
- Additive migration that **seeds the new rows byte-faithfully from the current
  legacy values** (labour/etc. already seeded; this covers the 3 new ones).
- Surface all three in `RatesListsAdminPage` with the same `rates.manage` /
  `lists.manage` gate the screen already enforces.
- Extend `fallback-audit.mjs` and the resolver-parity tests to cover the three
  new slugs; `assertRateParity` must be green for every enclosure/other-rates/
  density key.
- Route `resolveMaterialDensity` / `resolveReferenceValue` to the new reference
  table when canonical=ratetable, preserving current outputs for every consumer.
- Landed marker (done_when): `docs/data-model/rates-migration/STEP-11A-DONE.md`.
- Acceptance: `pnpm build`; parity audit exits 0 for all 6+3 slugs; density
  lookups unchanged; the three appear and save on `/settings/reference-data`.

### 11b — Retire the legacy admin screen
Escalates. Gate: `requires_file_on_main: docs/data-model/rates-migration/STEP-11A-DONE.md`.
- `/admin/estimate-rates` → `<Navigate to="/settings/reference-data" replace />`;
  delete `EstimateRatesAdminPage.tsx`; drop any nav entry pointing at it.
- Leave the `/estimate-rates/*` API and legacy tables intact for now (11c removes them).
- Landed marker: `docs/data-model/rates-migration/STEP-11B-DONE.md`.
- Acceptance: `pnpm build`; the old route redirects; no dead imports; e2e green.

### 11c — Remove the legacy tables, API, and resolver fallback (PERMANENT)
Escalates + destructive. Gate: `requires_file_on_main: docs/data-model/rates-migration/STEP-11B-DONE.md`.
**Hard stop — must NOT merge without Marco's explicit go-ahead and a DB backup.**
Precondition beyond the gate: a full real pricing cycle has run on `ratetable`
and `fallback-audit.mjs` shows zero fallbacks.
- Drop the eight `Estimate*Rate` tables + `EstimateMaterialDensity` (migration).
- Delete the `/estimate-rates/*` controller/service and the resolver's `tryLegacy`
  path + the ratetable-miss fallback (a miss now throws, as intended).
- Remove `RATES_CANONICAL_SOURCE` handling if it is now vestigial (or leave the
  flag defaulting to ratetable — decide at 11c review).
- Acceptance: `pnpm build`; parity/fallback audit still green; no consumer reads
  a legacy model; full API + e2e suites green.

## Non-goals
- No re-pricing / no rate value changes — this is a faithful move, values unchanged.
- No visual redesign of `RatesListsAdminPage` (re-skin program handles styling).
- No change to how tenders snapshot/lock rates.

## Rollback
- 11a/11b are revertable (additive + a redirect). 11c is the point of no return —
  gated behind a backup and Marco's explicit sign-off for exactly that reason.
