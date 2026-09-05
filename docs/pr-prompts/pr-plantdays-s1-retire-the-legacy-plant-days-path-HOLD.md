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
done_when: pnpm build && pnpm lint && ! grep -q "scopeItem.hookTruckDays" apps/api/src/modules/tendering/scope-of-works.service.ts && grep -q "PLANT_DAYS_RETIRED_V1" apps/api/src/modules/tendering/scope-of-works.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: legacy-plant-days
cluster_order: 1
rollback_strategy: >-
  Code only. NO schema change, NO migration, and the five columns keep every value they hold - this
  slice stops the server READING them, nothing more. Revert and the path returns with its data
  intact. Dropping the columns is a separate, deliberately later slice (cluster_order 2).
---

# Retire the legacy plant-days path — code only, columns untouched

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
`apps/web/src` — no screen can write them. All five are still accepted by
`UpdateScopeItemDto`, so the API write path is open even though the UI is gone. The
`plantItems` JSON array (`SCOPE_PLANT_PERSIST_V1`) is the live replacement, and it is what every
current screen uses.

**Why the trucks made this urgent.** `Hook truck` and `Semi tipper` are also priceable through the
waste transport engine (`ScopeWasteItem.transportRateId` → an `EstimatePlantRate` with
`category === "Truck"`). The WBS plant picker already excludes transport plant — `groupPlantTypeOptions(plantRates.filter((p) => !isTransportPlant(p)))`, the same predicate `ScopeWasteTab`
uses to include them — so the two current surfaces are complementary. **This legacy path is the one
route by which the same truck can reach a tender twice.** The other three columns carry no
double-count risk; they are in scope because they are the same mechanism, and leaving three of five
behind would read as an accident to whoever finds them next.

## What to do

1. Delete the five `addPlantLineIfSet` calls in `createEstimateItemFromScope`.
2. Delete the five fields from the update DTO so the write path closes with the read path. Leaving
   the DTO open would let a caller keep writing columns nothing reads — worse than either end alone.
3. Delete the five assignments in the service's update payload.
4. Fix the spec fixtures that name the removed fields.
5. **Leave `addPlantLineIfSet` itself alone if anything else calls it.** Check first. If the five
   calls were its only callers, remove the helper too and say so.
6. **Mark the file `PLANT_DAYS_RETIRED_V1`** in a comment where the five calls used to be, recording
   what was removed, when, and that the columns still hold their data. `pr-plantdays-s2` gates on
   this exact string via `requires_on_main`, so without it the column-drop slice can never unblock.

## 🔴 COUNT THE AFFECTED ROWS BEFORE YOU REMOVE ANYTHING, AND PUT THE NUMBER IN THE PR BODY

This is a **pricing path**. Any scope item holding a non-null value in one of the five columns
currently contributes a plant line to its estimate item, and after this slice it will not. That is a
silent price change on somebody's tender.

Run, against the dev database, and report each figure:

```sql
SELECT
  count(*) FILTER (WHERE excavator_days   IS NOT NULL) AS excavator,
  count(*) FILTER (WHERE bobcat_days      IS NOT NULL) AS bobcat,
  count(*) FILTER (WHERE ewp_days         IS NOT NULL) AS ewp,
  count(*) FILTER (WHERE hook_truck_days  IS NOT NULL) AS hook_truck,
  count(*) FILTER (WHERE semi_tipper_days IS NOT NULL) AS semi_tipper
FROM scope_of_works_items;
```

- **All zero** ⇒ this is dead-code removal and cannot change any price. Say so plainly.
- **Any non-zero** ⇒ **STOP. Do not remove the calls.** Open the PR as a report instead: state the
  counts, name the affected tenders, and escalate. A number here is Marco's decision, not yours.

If you cannot reach a database at all, say that explicitly and do not guess — an unrun query is not
a zero.

## Do NOT

- **Do not touch `apps/api/prisma/schema.prisma` and do not write a migration.** The columns and
  every value in them stay exactly as they are. Dropping them is `cluster_order: 2` and deliberately
  separate, so that this change is revertible and that one is not conflated with it.
- Do not touch the `plantItems` path, the waste transport engine, or the WBS plant picker.
- Do not touch `/sot/` or `.github/workflows/**`.

## Verification

- [ ] `pnpm --filter @project-ops/api test` green.
- [ ] The five row counts above, quoted in the PR body.
- [ ] `grep -rn "hookTruckDays\|semiTipperDays\|excavatorDays\|bobcatDays\|ewpDays" apps/api/src apps/web/src`
      returns nothing outside `dist/`. Paste the output.
- [ ] State whether `addPlantLineIfSet` survived and why.
- [ ] `PLANT_DAYS_RETIRED_V1` present in `scope-of-works.service.ts` — `pr-plantdays-s2` is gated on it.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN — open the PR and leave it unmerged for Marco.
