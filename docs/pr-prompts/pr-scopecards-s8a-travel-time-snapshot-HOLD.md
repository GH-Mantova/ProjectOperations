---
premise: '! grep -rq "TRAVEL_TIME_PORT_V1" apps/api/src'
premise_means: Nothing in the ERP works out how long a truck actually takes to reach a tip. Loads per day, truck days and daily km are typed in by hand on every waste line, and the only distance code in the repo is a straight-line haversine used by the tip finder. Two estimators sizing the same run disagree, and the 8-hour cycle rule Marco described is written down nowhere in code.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/travel-time.ts
  - apps/api/src/modules/tendering/__tests__/travel-time.spec.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/scope-waste.controller.ts
  - apps/api/src/modules/tendering/__tests__/scope-waste-travel.spec.ts
  - apps/api/src/modules/operations-settings/**
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/admin/**
done_when: pnpm build && pnpm lint && grep -q "TRAVEL_TIME_PORT_V1" apps/api/src/modules/tendering/travel-time.ts && grep -q "travelSource" apps/api/prisma/schema.prisma
size: 7
gate_allow: migrations
backfill: false
rollback_strategy: One additive migration - nullable travel snapshot columns on scope_waste_items, a nullable map_location_id FK, and three nullable settings columns. Nothing existing is rewritten and no stored figure changes. To revert, drop the columns; every line keeps the loads, truck days and km it already stores.
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 12
design_ref: Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html
requires_on_main: 'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'
---

# Scope Cards S8a - the truck cycle, written down once, with straight-line as the only source yet

**Plan row S5, renumbered S8, first of two.** S8a builds the one place travel time is resolved and
recorded, and derives loads per day and daily km from it. Its only source is the straight-line
fallback that already exists. **S8b adds the real routing provider behind the same port** - that
slice is the one that needs Azure, and it is held until Marco provisions it.

> Marco's rules, carried verbatim into code comments:
> - Haulage is priced on **actual truck travel time**, averaged between normal and peak hours
>   (the averaging arrives with the provider, in S8b).
> - **Straight-line distance is only ever an automatic fallback, badged.** It is never an option the
>   estimator selects.
> - A tip about 45 minutes away is roughly a 2-hour round trip, so an 8-hour day shift is **up to 4
>   loads**. That 8-hour shift belongs to this field only and is not a general working-day constant.
> - Marco's picks, 2026-09-22: snapshot the resolved figure onto the line; fallback badged.

## Grounded on origin/main 25aa3115 - re-verify before you edit

- `ScopeWasteItem` (`schema.prisma:~3843`) already stores `wasteLoads`, `truckDays`, `qtyTrucks`,
  `loadsPerTruckPerDay`, `capacityPerLoad`, `capacityUnit`, `dailyKm` and the engine's snapshots
  (`transportCost`, `fuelCost`, `disposalCost`, `quotedTransportRatePerDay`, ...).
  **`wasteFacility` is free text** - the line does not point at a map location, so there is nothing
  to route to today.
- `scope-waste.service.ts` `create` (~:190-290) and `update` (~:330-440) narrow the DTO numbers and
  hand them to `computeCostEngine`, which fires only with `transportRateId` + `qtyTrucks` +
  `loadsPerTruckPerDay` + `capacityPerLoad`; otherwise the legacy `/3` truck-days path runs.
- The only distance code: `haversineKm` in `map-locations/tip-recommendations.service.ts:~118`
  (`travelCost = haversineKm x 2 x OperationsSettings.travelRatePerKm`), plus a separate copy in
  `scheduler` and `field.service.ts`. **Do not add a fourth copy** - export one and use it.
- `OperationsSettings` (`schema.prisma`, `model OperationsSettings`) holds `fuelPricePerLitre`,
  `travelRatePerKm`, `sopaResponseDays`. It is the right home for the new numbers.
- `MapLocation` (`:~7162`) carries `latitude` / `longitude` for `kind = TIP`.

## What to build

### 1. One travel-time port - `apps/api/src/modules/tendering/travel-time.ts` (NEW)
- `export const TRAVEL_TIME_PORT_V1 = "scopecards-s8a";`
- ```ts
  export type TravelEstimate = {
    km: number; minutesOneWay: number;
    source: "straight-line" | "route";       // "route" arrives in S8b
    detail: string;                           // e.g. "straight line x 1.3 road factor at 45 km/h"
    resolvedAt: Date;
  };
  export interface TravelTimeProvider { resolve(from: LatLng, to: LatLng): Promise<TravelEstimate | null>; }
  ```
- `StraightLineTravelProvider` - the ONE haversine (import it; do not re-implement), multiplied by
  `OperationsSettings.roadDistanceFactor`, with minutes from
  `OperationsSettings.avgTruckSpeedKmh`. Both settings nullable; when either is unset the provider
  returns `null` rather than inventing a number.
- `deriveCycle({ minutesOneWay, shiftMinutes, tipTurnaroundMinutes })` -
  `loadsPerDay = floor(shiftMinutes / (2 * minutesOneWay + tipTurnaroundMinutes))`, minimum 0.
  `shiftMinutes` is 480 and `tipTurnaroundMinutes` comes from settings (Marco's 30). A comment states
  the 8-hour shift is site-to-tip only and must not be reused elsewhere. Assert Marco's own worked
  example in the spec: 45 minutes each way, 30 at the tip, gives 4 loads.

### 2. The line can point at a tip (one additive migration)
- `ScopeWasteItem.mapLocationId String?` + relation to `MapLocation` (`onDelete: SetNull`), index.
- Travel snapshot on the line, all nullable: `travelKm Decimal(8,2)`, `travelMinutesOneWay Int`,
  `travelSource String`, `travelDetail String`, `travelResolvedAt DateTime`.
- `OperationsSettings`: `roadDistanceFactor Decimal(4,2)?`, `avgTruckSpeedKmh Int?`,
  `tipTurnaroundMinutes Int?`. Nullable, no defaults in SQL - unset means the feature stays quiet.
- No backfill. No NOT NULL. No existing figure changes.

### 3. The service resolves, snapshots, and defaults - never overrides
- On create and update, when the line has a `mapLocationId` with coordinates and the tender's site
  has coordinates: resolve through the provider, store the snapshot columns.
- **Derived defaults apply only where the estimator left the field empty**:
  `loadsPerTruckPerDay` defaults to `deriveCycle(...)`, and `dailyKm` defaults to
  `loadsPerDay x 2 x travelKm`. A typed figure always wins and is never recomputed.
- A resolve that returns `null` (no coordinates, settings unset) leaves every field exactly as it is
  today and stores no snapshot. **Nothing in this slice can make a save fail.**
- Re-resolve only when the tip, the site or an input actually changes - never on a plain read.

### 4. The web shows the cycle and where it came from
- `ScopeWasteTab.tsx`: the waste line gains a tip picker (map locations of kind `TIP`), and a
  read-only cycle line under the loads field:
  `Straight line 18.4 km - 25 min each way - 4 loads/day (estimated, no route)`.
  The badge text for `straight-line` is **"estimated, no route"** and it is not selectable.
  A typed loads figure shows `Manual` instead, with the derived figure still visible beside it.
- Admin operations settings: the three new numbers, with plain labels - road distance factor,
  average truck speed, minutes at the tip.

## Tests
- `travel-time.spec.ts`: `deriveCycle` gives 4 loads for 45/30 and 8-hour shift; 2 loads at 90
  minutes each way; 0 when a cycle exceeds the shift; the straight-line provider returns `null` when
  either setting is unset, and multiplies the haversine by the factor when both are set.
- `scope-waste-travel.spec.ts`: a line with no `mapLocationId` is byte-identical to today; a line
  with a tip stores the snapshot; a typed `loadsPerTruckPerDay` survives a save that would have
  derived a different figure; a typed `dailyKm` survives; clearing the typed figure restores the
  derived one; a provider that throws leaves the save successful with no snapshot.

## Do NOT
- Do NOT call any external service in this slice, and do NOT add an HTTP client, key or setting for
  one - that is S8b.
- Do NOT touch Azure / Entra / SharePoint.
- Do NOT reprice or resize any existing waste line, and do NOT backfill.
- Do NOT add a fourth haversine. Export the one in `map-locations` (or lift it to a shared util that
  all three callers then import - no behaviour change).
- Do NOT let the estimator pick "straight line" as a source, and do NOT hide the badge.
- Do NOT touch the fuel, disposal or transport-rate arithmetic.
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
- `escalates: true` - a migration and the first code that sizes a haulage run. Marco merges.
