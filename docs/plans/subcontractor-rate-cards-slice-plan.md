# SLICE-0 plan — Subcontractor rate cards

**Status:** PLAN ONLY (Marco 2026-08-04, "a thousand times yes; check what's deployed so it does not
conflict/damage anything"). No sub-slice armed yet. This plan grounds the deployed rate system first,
then proposes an additive design that does NOT disturb the in-flight rate-table migration.

## Problem / goal

Store each subcontractor's own agreed rates (their $/unit for tasks/scopes) so estimates and orders
can pull that subbie's pricing instead of only the generic estimate rates. Faster, accurate subbie
pricing; a foundation for subcontractor-priced scope lines and (later) the parked subcontractor portal.

## Current state (grounded on origin/main) — DO NOT DISTURB

- **Rates are estimate-side.** Legacy per-domain tables (`EstimateLabourRate`, `EstimatePlantRate`,
  `EstimateWasteRate`, `EstimateCuttingRate`, `EstimateCoreHoleRate`, `EstimateFuelRate`,
  `EstimateEnclosureRate`) plus a newer typed `RateTable`, resolved through `RateResolverService`
  (`apps/api/src/modules/rates/rate-resolver.service.ts`). The resolver is **mid-migration** — it reads
  legacy tables by default and moves them to `RateTable` one at a time. **This migration must not be
  touched by this work.**
- **Subcontractors** are the `SubcontractorSupplier` model (entityType, prequal status/notes/review,
  documents) with a `SubcontractorsPage` in the directory. No per-subcontractor rate concept exists.

## Proposed design (additive, isolated from the estimate-rate migration)

- **New model `SubcontractorRate`** (own table, own migration): `subcontractorSupplierId` FK,
  a rate-kind/scope-code discriminator (align with the canonical 4-scope-code system, sot/01 §10),
  `unit`, `rate Decimal`, optional `validFrom/validTo`, `notes`, `isActive`, timestamps. Append-only
  movement rule applies (sot/01, Marco 2026-07-23) — supersede, don't mutate historical rates.
- **Do NOT route subbie rates through `RateResolverService`.** That resolver is the *estimate* pricing
  spine mid-migration; a subbie rate card is a *different axis* (who does the work, not what the house
  rate is). Keep it a separate lookup so the two never collide. If a future slice wants a scope line
  priced from a subbie's card, that is an explicit opt-in at the line, not a resolver default.

## Proposed sub-slices (ordered)

- **RC-1 — model + CRUD + permissions** (`feat/subbie-rate-cards-model`). `SubcontractorRate` model +
  migration (escalates:schema, GATE-ALLOW: migrations, regenerate data-model map in-PR); a
  `subcontractor-rates` module (CRUD) guarded by a new `subcontractors.rates.manage` /`.view` permission;
  seed nothing. ~7-9 files. Premise: `! grep -q "model SubcontractorRate" schema.prisma`.
- **RC-2 — rate card UI on the subcontractor page** (`feat/subbie-rate-cards-ui`). A "Rates" tab on the
  `SubcontractorsPage` detail: list/add/edit/supersede a subbie's rates. ~5-7 files. Premise: no
  subbie-rates tab on main.
- **RC-3 (optional, later) — opt-in scope-line pricing from a subbie card.** Explicit per-line action
  to price an allocated scope line from the assigned subcontractor's card. Gated behind Marco + the
  subcontractor-assignment (PR-213) decision — do NOT build until that lands.

## Risks

- **Collision with the estimate-rate migration** — mitigated by keeping `SubcontractorRate` a separate
  table and NOT touching `RateResolverService` (RC-1/RC-2). RC-3 is the only slice that would interact,
  and it is explicitly gated.
- **Scope-code alignment** — reuse the canonical 4-scope-code system so subbie rates map cleanly to
  scope lines later; do not invent a parallel taxonomy.

## Sequencing

RC-1 (escalates, Marco reviews the table design) -> RC-2. RC-3 deferred behind PR-213. Arm RC-1 first.
