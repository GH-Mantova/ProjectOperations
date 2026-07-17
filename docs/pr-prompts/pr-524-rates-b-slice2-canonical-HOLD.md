---
premise: grep -q "^model EstimateLabourRate" apps/api/prisma/schema.prisma
premise_means: The legacy rate tables still exist in schema.prisma; the destructive drop has not happened.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/estimates/**
  - apps/web/src/pages/admin/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && ! grep -q "^model EstimateLabourRate" apps/api/prisma/schema.prisma && grep -q "^model EstimateMaterialDensity" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm -->
# HOLD — Rates & Lists B-slice-2, PHASE D: drop the legacy rate tables (irreversible)

STATUS: DRAFTED, STAGED, **NOT ARMED**. This is the final destructive step of the
RateTable cutover. Decisions locked 2026-07-10 (Marco): density KEPT (excluded from the
drop), rate-table data DROPPED OUTRIGHT (no archive), staged-but-held.

## Arm ONLY when ALL of these are true (verify before renaming to -ready)

1. `pr-rates-b2-ratetable-canonical-cutover` has MERGED to `main` and deployed.
2. A full live pricing cycle has run with `RATES_CANONICAL_SOURCE=ratetable` and the
   structured warn log shows **zero** `ratetable-miss-fell-back-to-legacy` events — i.e.
   the RateTable projection has no gaps for any rate type. (Operational check Marco
   confirms; if any misses were logged, DO NOT arm — fix the projection first.)
3. Marco has explicitly confirmed the drop in MAIN chat.

Dropping tables is irreversible (data chosen to be dropped outright, not archived). Arm
this by renaming to `pr-524-rates-b2-phaseD-drop-ready.md` deliberately, never by a batch
sweep. Then replace this gate block with a one-line "confirmed <date>" note.

---

## Prompt body (for when armed)

Branch: `chore/rates-b2-phaseD-drop-legacy`
Reviewer: `GH-Mantova`
Migration: YES — destructive, drops tables. `GATE-ALLOW: migrations` at column 0. Full
timestamp migration folder. **Irreversible.** Do NOT auto-merge — human review required
regardless of `PR_WATCHER_AUTO_MERGE_POLICY`.

### Pre-work (verify, do not assume)

1. `git fetch origin && git checkout -f main && git reset --hard origin/main`, tree clean,
   `node scripts/data-model/build-relationship-map.mjs --check` prints OK.
2. Confirm on `main`: the cutover shipped, `RateResolverService.resolveRate()` reads
   RateTable as canonical, and the `RATES_CANONICAL_SOURCE` flag exists. If the cutover is
   NOT present on `main`, STOP — this PR is out of order.

### Scope of the drop

- **DROP** the 7 core rate tables: `EstimateLabourRate`, `EstimatePlantRate`,
  `EstimateWasteRate`, `EstimateCuttingRate`, `EstimateCoreHoleRate`, `EstimateFuelRate`,
  `EstimateEnclosureRate`. (Audit confirmed no inbound Prisma relation/FK to any of them.)
- **`CuttingOtherRate`: verify before dropping.** Confirm it is (a) fully represented in
  the RateTable projection and (b) has no remaining reader outside the legacy path. If
  either is not true, EXCLUDE it from this PR and report — do not drop a table still read
  off-projection.
- **KEEP `EstimateMaterialDensity` entirely** — it is a density lookup, not a $ rate, and
  is consumed by the estimates density calcs and `ScopeQuantitiesTable.tsx`. Do NOT drop
  it, do NOT touch its rows, do NOT remove its admin surface.

### Code changes

1. `RateResolverService.resolveRate()` — remove the legacy fallback branch and the
   `RATES_CANONICAL_SOURCE` flag; RateTable becomes the sole source for the dropped rate
   types. Leave the density path (EstimateMaterialDensity) exactly as-is.
2. `EstimateRatesAdminPage.tsx` — remove the editing UI for the dropped rate tables ONLY.
   **Preserve density management** (either keep the density section here or migrate it to
   `RatesListsAdminPage.tsx`) — density admin must survive. State which you did in the PR.
3. Destructive Prisma migration dropping the in-scope tables. Full timestamp folder,
   inline and irreversible; no down-migration data restore is possible (drop outright per
   the locked decision).

### Tests / gates

- `resolveRate()` returns correct values for every dropped rate type from RateTable with
  NO fallback present (the parity fixture from the cutover PR, minus the legacy side).
- Density calcs + `ScopeQuantitiesTable` unaffected (density specs stay green).
- `pnpm --filter @project-ops/api test:serial` + `pnpm --filter @project-ops/web test` +
  `pnpm compliance:smoke` green. `pnpm seed` idempotent x2. `pnpm build` + `pnpm lint`.
- `node scripts/data-model/build-relationship-map.mjs` regenerated (model count drops;
  commit the refreshed artifacts) and `--check` OK.

### PR body must include

- **Data-model impact:** the exact tables dropped, that it is irreversible, and that
  `EstimateMaterialDensity` was deliberately retained.
- The `CuttingOtherRate` in/out decision and the evidence behind it.
- Where density admin now lives (kept in place vs migrated).
- Explicit "no rollback except DB restore" line (data dropped outright).

### After opening

Do not merge or tick boxes — leave for shepherd re-verify + Marco review. Must not auto-merge.
