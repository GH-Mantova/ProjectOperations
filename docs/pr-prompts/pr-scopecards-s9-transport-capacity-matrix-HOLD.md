---
premise: '! grep -rq "resolveCapacityPerLoad" apps/api/src'
premise_means: The transport capacity matrix (rate table rt-tc, material class x transport type -> capacity in tonnes and m3) has been seeded since July and is read by nothing. Every waste line's capacity per load is typed in by hand, so two estimators sizing the same truck for the same material can disagree, and the matrix Marco maintains changes nothing.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/transport-capacity.ts
  - apps/api/src/modules/tendering/__tests__/transport-capacity.spec.ts
  - apps/api/src/modules/estimates/estimates.service.ts
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/admin/**
done_when: pnpm build && pnpm lint && grep -q "TRANSPORT_CAPACITY_MATRIX_V1" apps/api/src/modules/tendering/transport-capacity.ts && grep -q "resolveCapacityPerLoad" apps/api/src/modules/tendering/scope-waste.service.ts
size: 6
gate_allow: migrations
backfill: false
rollback_strategy: One additive migration (a nullable transport_type column on estimate_plant_rates). Nothing is rewritten, and every existing waste line keeps the capacity it already stores. To revert, drop the column and the default resolution stops firing - typed capacities are untouched.
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 11
design_ref: Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html
requires_on_main: 'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'
---

# Scope Cards S9 - the transport capacity matrix actually sizes the load

**Plan row S7, renumbered S9.** The matrix exists and nobody reads it. This slice makes it the
default source of a waste line's capacity per load, and leaves the estimator's own figure untouched
when they have typed one.

> Marco's standing rule: *capacity lives in a reference table keyed by (material class x transport
> type); a per-line override stays local to the line and never pushes back to the table.*
>
> Marco, 2026-09-22, on the one open call (call 5 of the S8 drawing, *"go with your picks"*): a
> transport plant rate **carries a transport type**, chosen from the matrix's own list, rather than
> being matched on its name or chosen again on every waste line. The hold is lifted on that answer;
> the list itself lives in the matrix and Marco edits it in Rates & Lists, so no code change is
> needed if the fleet changes.

## Grounded on origin/main 25aa3115 - re-verify before you edit

- **The matrix**: rate table `rt-tc`, slug `transport-capacity`, `isReference = true`, seeded by
  `20260715120000_r3_t0_asset_fuel_capacity_ops_settings/migration.sql:~57-130`. KEY columns
  *Material class* and *Transport type*; VALUE columns *Capacity (tonnes)* and *Capacity (m3)*.
  24 seeded rows: 6 material classes x 4 transport types. The migration's own comment says the
  material classes match the `wasteGroup` values already used by the waste-facility seeds
  (Rubble, Soil, Asphalt, Vegetation, plus Mixed demolition and Steel), and that the four transport
  types are "the four rigs the Initial Services fleet actually runs (Marco to confirm)".
  Being a reference table it is **excluded from tender rate-set snapshots**
  (`RateResolverService.enumerateRateSet` checks `isReference`) - so a capacity default is resolved
  live, not locked.
- **Where capacity is used**: `scope-waste.service.ts` `create` (~:217-267) and `update` pass
  `capacityPerLoad` and `capacityUnit` from the DTO into `computeCostEngine`. The engine only fires
  with `transportRateId` + `qtyTrucks` + `loadsPerTruckPerDay` + `capacityPerLoad`; any missing value
  drops the line back to the legacy path. `ScopeWasteItem.capacityPerLoad` / `capacityUnit` store what
  was used.
- **What identifies the rig**: `ScopeWasteItem.transportRateId` points at an `EstimatePlantRate`
  (the transport lines are the `Truck` category ones - `ScopeWasteTab.tsx:~86`). **There is no field
  on that rate saying which of the matrix's transport types it is.** That is what this slice adds.

## What to build

### 1. The plant rate says which rig it is (one additive migration)
- `EstimatePlantRate.transportType String?` (`@map("transport_type")`), nullable.
  Migration `<ts>_transport_capacity_rig_type` - `ADD COLUMN` only, no backfill, no NOT NULL.
- In the Rates & Lists admin surface for plant rates, transport-category rows get a **Transport type**
  select. **Its options are read from the matrix's own Transport type key column** - never a second
  hard-coded list - so the two can never drift. Blank is allowed and means "no matrix default".

### 2. One resolver - `apps/api/src/modules/tendering/transport-capacity.ts` (NEW)
- `export const TRANSPORT_CAPACITY_MATRIX_V1 = "scopecards-s9";`
- `resolveCapacityPerLoad(rateResolver, { wasteGroup, transportType, capacityUnit })` ->
  `{ capacity: number; source: "matrix"; materialClass: string; transportType: string } | null`.
- It reads the matrix through `RateResolverService.listRates("transport-capacity")`, matches
  **Material class = the line's `wasteGroup`, exactly as stored** and **Transport type = the plant
  rate's `transportType`**, and returns the tonnes column when `capacityUnit` is `t`, the m3 column
  when it is `m3`.
- **No guessing.** No fuzzy matching, no aliases, no "nearest" row. Either both keys match a row or
  it returns `null`. A material class with no row (a `wasteGroup` the matrix has never heard of) is a
  `null`, not a default.

### 3. The engine uses it only where the estimator has not decided
- In `scope-waste.service.ts` `create` and `update`: when the DTO's `capacityPerLoad` is null or
  absent **and** the line has a `transportRateId` whose rate carries a `transportType`, call the
  resolver and use what it returns. When the DTO carries a figure, that figure wins, untouched.
- Whatever is used is stored on the line, as today. **Nothing is ever written back to the matrix.**
- Store where it came from: `ScopeWasteItem.capacitySource String?` - `"matrix"` or `"manual"` - in
  the same migration, so the row can say so months later. Existing rows stay null (unknown).

### 4. The web says where the number came from
- `ScopeWasteTab.tsx`: the capacity field, when it is empty and a matrix default exists, shows the
  matrix figure as its placeholder with a small badge - `Matrix: Rubble - Truck & dog - 26 t`.
  Typing a figure replaces it and the badge reads `Manual`. Clearing the field returns to the matrix.
- When the plant rate has no transport type, or the matrix has no row, the badge reads
  `No matrix row - enter a capacity` and nothing is defaulted.

## Tests (`transport-capacity.spec.ts` + a scope-waste spec)
- Exact match on both keys returns the tonnes figure for `capacityUnit = "t"` and the m3 figure for
  `"m3"`; an unmatched material class, an unmatched transport type, or a blank transport type each
  return `null`.
- A DTO capacity of `12` survives untouched even when the matrix says `26`.
- A DTO with no capacity and a matched rig stores the matrix figure and `capacitySource = "matrix"`.
- A line saved twice does not change its stored capacity when the matrix row changes in between and
  the capacity was manual.
- The matrix is never written by any code path in this slice (assert no `rateRow.update` / `create`
  against `rt-tc`).

## Do NOT
- Do NOT write to the matrix, ever, from a line, a save, or an import.
- Do NOT re-price or re-size an existing waste line. This slice changes no stored figure.
- Do NOT put the transport-type list in code - read it from the matrix's key column.
- Do NOT make the new columns NOT NULL, and do NOT backfill them.
- Do NOT touch the fuel, disposal or transport-rate arithmetic, or the legacy path.
- Do NOT touch `tokens.css` or `/sot/` (CP-24).

## PR body must carry (column 0, bare)
```
GATE-ALLOW: migrations
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- `escalates: true` - a migration plus the first read of a reference table that sizes real loads.
- Hard stop: Azure / Entra / SharePoint, production auth or secrets, any irreversible action.
