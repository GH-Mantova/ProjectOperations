---
premise: '! grep -q "SCOPE_PLANT_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The Plant column group calls no server handler at all. Type, custom description, revert, qty,
  days and day rate override every one of them writes to a local Map and stops. Because the new
  columns do not save, the legacy plant cluster was deliberately left inside the Measurement cell
  as the only plant UI that reaches the database, so the first row of every WBS item shows plant
  twice.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-plant-persist.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-plant-columns.test.tsx
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/scope/__tests__/scope-item-pricing.spec.ts
  - tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
done_when: pnpm build && pnpm lint && grep -q "SCOPE_PLANT_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 9
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-persistence
cluster_order: 2
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_MANPOWER_PERSIST_V1'
rollback_strategy: >-
  One web component plus one pure pricing function and their tests. No schema, no migration, no new
  column, no new dependency - the store this slice writes into (`plant_items` JSONB) has been on
  main since 20260425_feat_scope_redesign_v2. Revert and the plant columns go back to local state
  and the legacy cluster comes back with them.
---

# The Plant columns save nothing, so the card still carries two plant UIs

Second slice of the persistence cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`. There is **no `patchItem` call on any plant path**.
`onPlantTypeChange`, `onCustomDescription`, `onRevertToList`, `onQtyBlur`, `onDaysBlur` and
`onDayRateOverride` on `<PlantRowCells>` (`ScopeQuantitiesTable.tsx`:1163-1182) all call
`setRowPlant` and nothing else, so every plant field on every row dies on reload.

That is also why the card shows plant twice. The comment above the legacy cluster (:2080-2084)
says so in as many words: *"these legacy cells are retained deliberately: they are the only plant
UI that persists to plantItems ... Remove them in the slice that wires the new columns to the
server, and port the e2e in that same slice."* This is that slice. (The duplicate is on the first
row of each item only - `ItemMeasurementCell` returns `null` for `rowIdx > 0` at :1829-1832 - which
is where an estimator does most of the typing, and it is the copy that currently holds the data.)

## What to build

**0. The store already exists. Confirm it, then use it.** Audited 2026-09-04, field by field:

- `ScopeOfWorksItem.plantItems` is a `Json?` column (`plant_items JSONB`, added by
  `20260425_feat_scope_redesign_v2`). Documented shape in `schema.prisma`:
  `[{ plantRateId?, description, qty, days, unit }]`, plus the `columnIndex` the legacy cluster
  writes.
- The DTO field is `plantItems?: unknown` with `@IsOptional() @IsArray()` and **no element
  validation** (`dto/scope-of-works.dto.ts`).
- `ScopeOfWorksService` hands it straight to Prisma as `Prisma.InputJsonValue`
  (`scope-of-works.service.ts`:143-144) and `listItems` returns the row spread, so whatever the web
  sends comes back verbatim.
- Therefore **plant type, the free-typed custom description, qty, days and a per-row day rate
  override all have a home today.** The override needs no new column and no DTO change: an extra
  key on an element of an untyped JSON array persists like the rest. Name it `dayRateOverride` and
  document it in the `schema.prisma` comment block that already lists the shape - a comment is not
  a schema change.
- **No schema change is expected from this slice.** `gate_allow` stays `none`.

**1. Wire the columns, whole-array.** `updateItem` persists exactly what the DTO sends - the
contract `scope-update-item-preserve.spec.ts` locks in - so a PATCH carrying a partial `plantItems`
**replaces** the array and loses everything it left out. Every plant handler must read
`item.plantItems`, merge its one row, and send the complete array, the way the legacy
`updatePlant` (:1879-1890) already does. Mark the component with `SCOPE_PLANT_PERSIST_V1`.

**2. Write `description` on every entry, not only on custom rows.** `getCardSummary` skips any
plant entry with no `description` (`if (!p.description) continue;`), so a catalogue-picked row that
carries only a `plantRateId` is invisible to the card's plant days. The legacy cluster copies
`rate.item` into `description` when a type is picked (:2498-2502); do the same.

**3. Price what you now store.** `computeScopeItemTotal` (`scope-item-pricing.ts`) skips any entry
without a `plantRateId` and always multiplies by the catalogue rate from `plantRateById`. So a
custom machine prices at $0 and an overridden day rate prices at the number the estimator
overrode. Add the two legs: honour `dayRateOverride` when present, and price a
description-only row from its override. This is a change to one pure function plus its spec - both
readers (`ScopeOfWorksService.listItems` and the `/scope/summary` bucket loop in
`scope-redesign.service.ts`) call it and inherit the fix with no further edit.

**4. Carry the existing plant across, and prove it.** Rows written through the legacy cluster are
keyed by `columnIndex`, allocated from 1 upward by `addPlant` (:1897-1901); the new columns are
keyed by `rowIdx`, from 0. **Migrating this data must not lose any of it.** Adopt each existing
entry in `columnIndex` order into a row of the new group, and grow the item's row count to fit
what it already has rather than showing 1 row and orphaning the rest. **The PR body must state how
many existing rows were carried and by what query** - for example
`SELECT count(*) FROM scope_of_works_items WHERE jsonb_array_length(plant_items) > 0;` for the row
count and a second query for the entry count. A number with no query behind it is not evidence.

**5. Then retire the legacy plant cluster in the Measurement cell.** Remove the `PlantCluster`
block and its `+ Plant` button from `ItemBodyInputs` (:2085-2115) together with `updatePlant`,
`addPlant`, `removePlant` and the `PlantCluster` component itself, and port the e2e that covers
the old path - the `"plant pills: add a plant cluster, set qty/days, remove it (PRs #241, #72)"`
test in `tests/e2e/pr-acceptance/batch3-scope-items.spec.ts` - onto the new columns in this same
PR. Do this **last**, after steps 1-4 are green: until the new columns save, that cluster is the
only plant UI that reaches the database, and removing it first loses data.

## Do NOT

- **Do not add, change or remove any schema field, migration, API route, DTO field or service
  method.** The only API file in scope is the pure pricing function and its spec. If you conclude
  a column is needed, you have gone wrong: say
  `NO-OP: plant persistence needs a schema change - out of scope for this slice` and stop.
- **Do not touch the Manpower column group.** `pr-cardpersist-s1` owns it, including the
  `rowIdx === 0` guards at :1143, :1147 and :1151.
- **Do not touch the Markup cell or the Item total cell.** `pr-cardpersist-s3` owns those.
- Do not touch the Measurement section itself - length/height/depth, material, waste - or the
  Actions column. `pr-cardui-s5` owns both. You are removing the plant block that sits above the
  measurement fields, and nothing else in that cell.
- Do not change presentation: no column order, no group rules, no money formatting. The
  corrections cluster owns all of it.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` and `pnpm --filter @project-ops/api test` green.
- [ ] Fill type, qty, days and day rate on three plant rows of one item, reload, and **state which
      fields survived, row by row.**
- [ ] Free-type a custom machine name and a rate, reload, and state whether both came back and what
      the row total reads.
- [ ] Take an item that already has two legacy plant entries. Say how many rows the new group shows
      after this change, and give the query and the count for how many existing rows were carried
      across overall.
- [ ] Edit one plant row and confirm the other rows on the same item are still there afterwards -
      the whole-array write is the thing that breaks this. Say how many entries the PATCH body
      carried.
- [ ] State the Item total, the card subtotal and the discipline summary bar figure before and
      after adding one plant row, all three, and say by how much each moved.
- [ ] Confirm the Measurement cell no longer renders any plant control, and name the e2e test you
      ported and where it now points.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
