---
premise: '! test -f docs/data-model/rates-migration/STEP-11A-DONE.md'
premise_means: >-
  The three legacy-only rate categories (enclosure, other-rates, material
  densities) have not yet been built into the canonical RateTable model and
  their data migrated. STEP-11A-DONE.md is written only after 11a's acceptance
  passes.
scope:
  - apps/api/src/**
  - apps/api/prisma/**
  - apps/api/prisma/migrations/**
  - apps/web/src/**
  - scripts/rates/**
  - tests/e2e/**
  - docs/data-model/**
done_when: >-
  pnpm build && test -f docs/data-model/rates-migration/STEP-11A-DONE.md
size: 9
gate_allow: migrations
escalates: true
seed_only: false
requires_file_on_main:
  - docs/plans/rates-migration-plan.md
rollback_strategy: >-
  Additive only. Revert the PR: new RateTables/rows/migration and UI/resolver
  wiring are removed; legacy tables are untouched and remain authoritative. No
  data loss.
---

# SLICE 11a — build enclosure / other-rates / material-densities into RateTable + migrate

Read `docs/plans/rates-migration-plan.md` (section "11a") first — it is the
binding design for this slice. Follow it exactly; this body is the summary.

## Do

1. Add `enclosure` and `other-rates` as **priced** RateTables and
   `material-densities` as an **`isReference=true`** RateTable, columns/rows
   mirroring the legacy `EstimateEnclosureRate` / `EstimateOtherRate` /
   `EstimateMaterialDensity` shapes.
2. **Additive migration** that seeds the new RateTable rows **byte-faithfully
   from the current legacy values** — same keys, same numeric values, same
   units. No re-pricing.
3. Surface all three on `apps/web/src/pages/admin/RatesListsAdminPage.tsx`
   (`/settings/reference-data`), behind the SAME `rates.manage` / `lists.manage`
   gate the screen already enforces.
4. Route `resolveMaterialDensity` / `resolveReferenceValue` (and the enclosure /
   other-rates resolve paths) to the new tables when canonical = ratetable,
   preserving current outputs for every consumer listed in the plan.
5. Extend `scripts/rates/fallback-audit.mjs` and the resolver parity tests to
   cover the three new slugs. `assertRateParity` must return `matches: true`
   for every enclosure / other-rates / density key.
6. As the FINAL step, only after `pnpm build`, the parity audit (exit 0 for all
   6 + 3 slugs), and all suites are green, write
   `docs/data-model/rates-migration/STEP-11A-DONE.md` (one line: "11a landed").

## Escalates — do NOT auto-merge

This slice changes `schema.prisma` and touches live pricing resolution. The
resulting feature PR must be labelled **do-not-merge** and opened for Marco's
review. It RUNS and goes green; only the merge waits for him.

## Do NOT
- Do NOT change any rate VALUE — this is a faithful copy, not a re-price.
- Do NOT touch the legacy admin page, `/estimate-rates/*` API, or drop any
  legacy table — those are slices 11b and 11c.
- Do NOT alter tender snapshot/lock behaviour.

## Verify
- `pnpm build`
- `node scripts/rates/fallback-audit.mjs` exits 0 (zero fallbacks, all slugs)
- resolver parity spec green for enclosure / other-rates / densities
- `/settings/reference-data` shows and saves the three new categories
