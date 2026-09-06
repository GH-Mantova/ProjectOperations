---
premise: 'grep -q "scopeItem.hookTruckDays" apps/api/src/modules/tendering/scope-of-works.service.ts'
premise_means: >-
  Five legacy plant-days columns on ScopeOfWorksItem still generate estimate plant lines server-side,
  while the plantItems picker has superseded all of them. No screen writes the five columns, but the
  API DTO still accepts them, so the path is live and invisible at the same time.
scope:
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/tendering/__tests__/scope-of-works-rate-resolver.spec.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && ! grep -q "hookTruckDays" apps/api/prisma/schema.prisma && ! grep -q "scopeItem.hookTruckDays" apps/api/src/modules/tendering/scope-of-works.service.ts
size: 6
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
cluster: legacy-plant-days
cluster_order: 1
rollback_strategy: >-
  NONE for the data. This slice retires the code AND drops the five columns in one PR, at Marco's
  explicit instruction (2026-09-05, twice). A git revert restores the columns EMPTY - whatever they
  held is gone permanently. The code half would have been revertible on its own; combining them
  gives that up deliberately. The row-count gate below is therefore the ONLY thing standing between
  this PR and irreversible loss of live pricing data, and it is not optional.
---

# Retire the legacy plant-days path and drop its columns — one PR, irreversible

`ScopeOfWorksItem` carries five plant-days columns that `createEstimateItemFromScope` still turns
into estimate plant lines:

```ts
await this.addPlantLineIfSet(item.id, "Excavator 16T-25T (wet hire)", scopeItem.excavatorDays, 0, tenderId);
await this.addPlantLineIfSet(item.id, "Bobcat",  scopeItem.bobcatDays,     1, tenderId);
await this.addPlantLineIfSet(item.id, "EWP",     scopeItem.ewpDays,        2, tenderId);
await this.addPlantLineIfSet(item.id, "Hook truck",  scopeItem.hookTruckDays,  3, tenderId);
await this.addPlantLineIfSet(item.id, "Semi tipper", scopeItem.semiTipperDays, 4, tenderId);
```

**[MEASURED 2026-09-05, `origin/main`.]** All five have **zero** references anywhere in
`apps/web/src` — no screen can write them. All five are still accepted by `UpdateScopeItemDto`, so
the API write path is open even though the UI is gone. The `plantItems` JSON array
(`SCOPE_PLANT_PERSIST_V1`) is the live replacement, and it is what every current screen uses.

**Why the trucks made this urgent.** `Hook truck` and `Semi tipper` are also priceable through the
waste transport engine (`ScopeWasteItem.transportRateId` → an `EstimatePlantRate` with
`category === "Truck"`). The WBS plant picker already excludes transport plant —
`groupPlantTypeOptions(plantRates.filter((p) => !isTransportPlant(p)))`, the same predicate
`ScopeWasteTab` uses to include them — so the two current surfaces are complementary. **This legacy
path is the one route by which the same truck can reach a tender twice.** The other three columns
carry no double-count risk; they are here because they are the same mechanism, and leaving three of
five behind would read as an accident to whoever finds them next.

## 🔴 THIS PR CANNOT BE UNDONE. READ THE GATE BEFORE YOU WRITE ANY CODE.

This was authored as two slices — retire the code, then drop the columns after a soak, the way
`pr-fv2-formrule-contract-HOLD.md` has been held since 2026-08-12. **Marco instructed on 2026-09-05
that they go in one shot**, having been told plainly that retiring the code is revertible and
dropping the columns is not. That instruction is recorded here so the next reader knows the
single-PR shape is a decision and not an oversight.

What that costs: there is no window in which the code is retired but the data still exists. If a
tender turns out to have depended on this path, there is nothing to restore.

## 🔴 THE GATE — run this FIRST, before touching a single file

```sql
SELECT
  count(*) FILTER (WHERE excavator_days   IS NOT NULL) AS excavator,
  count(*) FILTER (WHERE bobcat_days      IS NOT NULL) AS bobcat,
  count(*) FILTER (WHERE ewp_days         IS NOT NULL) AS ewp,
  count(*) FILTER (WHERE hook_truck_days  IS NOT NULL) AS hook_truck,
  count(*) FILTER (WHERE semi_tipper_days IS NOT NULL) AS semi_tipper
FROM scope_of_works_items;
```

- **All five zero** ⇒ proceed. This is dead-code removal plus an empty-column drop, and no price can
  change. Quote the five zeros in the PR body.
- **ANY count non-zero** ⇒ **STOP. Write no migration. Remove no code. Open no PR that drops
  anything.** Open a PR containing ONLY a report — the counts, and which tenders are affected — and
  escalate. Dropping a column that holds live pricing data is Marco's call with the number in front
  of him, not yours, and combining the slices is exactly what removed his second chance to make it.
- **Cannot reach a database** ⇒ say so explicitly and **STOP**. An unrun query is not a zero. This is
  the single most important sentence in this prompt.

## What to build, once the gate passes

1. Delete the five `addPlantLineIfSet` calls in `createEstimateItemFromScope`.
2. Delete the five fields from the update DTO, so the write path closes with the read path.
3. Delete the five assignments in the service's update payload.
4. Fix the spec fixtures that name the removed fields.
5. **Check whether anything else calls `addPlantLineIfSet`.** If those five were its only callers,
   remove the helper too and say so.
6. Leave a `PLANT_DAYS_RETIRED_V1` comment where the calls were, recording what was removed, when,
   and on whose instruction — this is the only trace that will remain once the columns are gone.
7. One migration, `drop_legacy_plant_days`, dropping exactly the five columns and nothing else, plus
   the matching removal from `schema.prisma`.

The migration must contain **no `UPDATE`**, no data movement, and no other DDL. It should be five
lines. Quote it in full in the PR body.

## Do NOT

- Do not drop any other column, however dead it looks. A destructive migration's blast radius must be
  exactly readable from its own diff.
- Do not combine this with any other schema change.
- Do not touch the `plantItems` path, the waste transport engine, or the WBS plant picker.
- Do not touch `/sot/` or `.github/workflows/**`.

## Required by the schema rules — do these up front, CI will not let you fix-forward

1. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`. The
   drift check hard-fails a schema change that leaves the map stale.
2. Put a bare `GATE-ALLOW: migrations` line at **column 0** of the PR body. CP-11 hard-fails an
   undeclared migration.

## Verification

- [ ] The five row counts, quoted in the PR body, all zero.
- [ ] `pnpm --filter @project-ops/api test` green.
- [ ] `grep -rn "hookTruckDays\|semiTipperDays\|excavatorDays\|bobcatDays\|ewpDays" apps/` returns
      nothing outside `dist/`. Paste the output.
- [ ] The migration SQL quoted in full — five `DROP COLUMN`, no `UPDATE`.
- [ ] State whether `addPlantLineIfSet` survived and why.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN — open the PR and leave it unmerged for Marco. Given
this PR is irreversible, that hold is the last checkpoint: the five row counts must be visible in
the body when he looks at it.
