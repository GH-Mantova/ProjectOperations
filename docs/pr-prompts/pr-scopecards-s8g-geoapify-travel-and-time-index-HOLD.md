---
premise: '! grep -rq "GEOAPIFY_ROUTE_TRAVEL_V1" apps/api/src'
premise_means: Travel time is still a straight line multiplied by a road factor, the waste line has no traffic allowance the estimator can edit, required trips and duration are derived from a full-day km figure so fuel is charged for trips that never happen, and the tip finder throws away the map location it just resolved.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/travel-time.ts
  - apps/api/src/modules/tendering/providers/geoapify-route.provider.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/scope-waste.controller.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/geoapify-route.spec.ts
  - apps/api/src/modules/tendering/__tests__/travel-time.spec.ts
  - apps/api/src/modules/tendering/__tests__/scope-waste-travel.spec.ts
  - docs/runbooks/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- geoapify-route travel-time scope-waste-travel && grep -q "GEOAPIFY_ROUTE_TRAVEL_V1" apps/api/src/modules/tendering/providers/geoapify-route.provider.ts && grep -q "totalTripKm" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
backfill: false
rollback_strategy: Additive columns only (traffic index, planning minutes, provenance flags, total trip km) plus one arithmetic correction in the cost engine. No existing figure is rewritten by a migration. To revert, drop the columns and restore the dailyKm-based fuel term; stored lines keep every value they already hold. The provider is selected by configuration, so clearing the Geoapify key returns every line to the badged straight-line fallback with no code change.
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 14
requires_on_main: 'apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1'
---

<!-- GATE RELEASED 2026-09-24 by Marco, in chat to Station 06, his words: "the geoapify key is set
     up, release s8g's gate". The human marker that stood here is therefore removed. It had asked for
     his confirmation that the Geoapify key in the ERP vault is live and that its plan permits the
     Routing API, because the existing key was registered for geocoding. He has confirmed the key is
     set up. The plan half rests on that statement and was NOT independently measured by any station:
     if the plan refuses routing, the factory in `tendering.module.ts` selects the straight-line
     provider and every affected line carries the estimated badge, so the failure mode is a badge on
     the line, not a broken save or a wrong price. Recorded by Station 06; the release is Marco's.
     `escalates: true` stands - the built PR still stops for him before it merges. -->

# Scope Cards S8g - Geoapify road routing, an editable traffic index, and honest trip arithmetic

**Replaces the held Azure Maps prompt** (`pr-scopecards-s8b-azure-maps-travel-HOLD.md`). Marco chose
Geoapify, which the ERP already holds a key for (`integration-keys.registry.ts` slug `geoapify`,
`GEOAPIFY_API_KEY`, resolvable through `apiKeys.resolve("geoapify", "company")`). **The Azure Maps
prompt is superseded and must never be promoted**; Station 00 retires it once this one lands.

Builds on what is already on main: the travel-time port (#2109), the capacity matrix defaults
(#2114) and the tip finder (#819, #1039).

## THE CALCULATION CONTRACT - this is the specification, follow it exactly

1. **Road kilometres come from the route.** One-way road km is Geoapify's route distance between the
   job site and the selected tip. **A time index never multiplies kilometres.**
2. **Baseline one-way minutes come from the route**, requested with `traffic=free_flow`.
3. **Suggested traffic index** = Geoapify's `traffic=approximated` duration divided by its
   `free_flow` duration for the same route, to 2 dp, never below 1.00. It is a **modelled traffic
   allowance, not measured peak-hour traffic** - label it that way everywhere it appears.
   The estimator may edit the index on any waste line. **1.37 is an example, never a default.**
   When either sample is missing, the index is 1.00 and its source is recorded as `none`.
4. **Averaging, as Marco ruled:** `adjusted = baseline x index`;
   `planning = average(baseline, adjusted)`. Store and show baseline, index, adjusted and planning.
5. `cycle minutes = 2 x planning + tipTurnaroundMinutes`.
   `loads per truck per day = floor(480 / cycle minutes)` - **whole loads only**; 3.5 is 3, never 4.
   **If the result is 0, the line is in an infeasible-cycle state**: no division, no invented rate, a
   clear flag the web can show. A save must still succeed.
6. **Required trips are separate arithmetic:** `trips = ceil(waste quantity / capacity per load)` -
   3.5 capacities is 4 trips, 4.5 is 5. Keep the matrix capacity and any genuine estimator override
   exactly as #2114 left them.
7. `duration days = ceil(trips / (trucks x loads per truck per day))`, subject to the existing
   commercial day-rate rules. An index change moves loads/day and duration **in steps** - it never
   scales the job by the index percentage.
8. **Total route kilometres = trips x 2 x one-way road km.** For the same quantity, capacity, site
   and tip, **changing the index must leave this total unchanged.** It moves only when the number of
   trips or the route changes.
9. **Fuel is charged on total trip kilometres**, including the final partly used day. The current
   engine multiplies a full-capacity `dailyKm` by rounded duration and by trucks
   (`scope-waste.service.ts`, `computeCostEngine`) - that charges fuel for trips that never happen.
   Truck day hire may still rise with duration; fuel may not. Preserve every existing rate and quote
   snapshot field and its meaning.

## Grounded on origin/main ca04826b - re-verify before you edit

- `travel-time.ts` (#2109) exports `TRAVEL_TIME_PORT_V1`, `LatLng`, `TravelEstimate`
  (`km`, `minutesOneWay`, `source: "straight-line" | "route"`, `detail`, `resolvedAt`),
  `TravelTimeProvider`, `StraightLineTravelProvider` and `deriveCycle` (floor, 480-minute shift,
  site-to-tip only). **Extend this file; do not fork it.**
- `ScopeWasteItem` carries `mapLocationId`, `travelKm`, `travelMinutesOneWay`, `travelSource`,
  `travelDetail`, `travelResolvedAt`, `capacitySource`, plus the R3 T-1 engine columns
  (`qtyTrucks`, `loadsPerTruckPerDay`, `capacityPerLoad`, `capacityUnit`, `dailyKm`,
  `transportCost`, `fuelCost`, `quotedFuelPricePerLitre`, ...).
- `scope-waste.service.ts`: `resolveTravelEstimate` (never throws, returns null on any miss),
  `deriveTravelDefaults` (applies a derived value only when the DTO field is null),
  `computeCostEngine` - `loads = ceil(wasteAmount / capacityPerLoad)`,
  `durationDays = ceil(loads / qtyTrucks / loadsPerTruckPerDay)`,
  `fuelPerDay = fuelPrice * consumption * dailyKm / 100`,
  `fuelCost = fuelPerDay * durationDays * qtyTrucks`.
  **On create the engine runs BEFORE `resolveTravelEstimate`** (engine ~:275, travel ~:294), so the
  first save prices a line whose travel-derived values do not exist yet.
  **On update, a stored value is treated as typed** (`eDailyKm = dto ?? existing`), so an automatic
  value never refreshes when the route or the index changes.
- Web: `ScopeWasteTab.tsx` handles the tip-finder accept with the map location id named
  `_mapLocationId` and **discards it** (~:690-700), while the row's own tip dropdown does patch
  `mapLocationId` (~:1307-1311).
- Geoapify Routing API (verified 2026-09-24): `GET https://api.geoapify.com/v1/routing`,
  `waypoints=lat,lon|lat,lon`, `mode=` (`truck`, `medium_truck`, `heavy_truck`, ...),
  `traffic=free_flow|approximated`, `units=metric`, `apiKey=`. Response carries `distance`
  (metres), `distance_units` and `time` (seconds).

## What to build

### 1. `providers/geoapify-route.provider.ts` (NEW)
- `export const GEOAPIFY_ROUTE_TRAVEL_V1 = "scopecards-s8g";`
- `GeoapifyRouteProvider implements TravelTimeProvider`, key resolved through the existing vault
  (`apiKeys.resolve("geoapify", "company")` / `GEOAPIFY_API_KEY`) - **no new secret store, no key in
  the repo, no key in a log or in `detail`**.
- **Two requests per resolve**, same waypoints, `traffic=free_flow` and `traffic=approximated`.
  Timeout 5 s each, one retry, then return `null` (the caller falls back).
- Returns `TravelEstimate` with `source: "route"`, `km` = free-flow distance in km (2 dp),
  `minutesOneWay` = free-flow seconds / 60 rounded, and a new optional
  `suggestedIndex` = approximated / free-flow (2 dp, floor 1.00, `null` when either sample failed).
  `detail` reads like `Geoapify route, 21.6 km, 26 min free-flow, modelled allowance 1.22`.
- The truck profile comes from a new `OperationsSettings.routeVehicleMode` (default `truck` when
  unset). Marco can change it without a deploy.

### 2. Provider selection and the fallback
- One factory in `tendering.module.ts`: Geoapify when a key resolves, otherwise
  `StraightLineTravelProvider`. A provider failure falls through to straight line, badged exactly as
  today (`estimated, no route`). **A save never fails because routing failed.**

### 3. Schema - one additive migration
On `ScopeWasteItem`, all nullable: `travelIndex Decimal(4,2)`, `travelIndexSource String`
(`geoapify` | `manual` | `none`), `travelPlanningMinutesOneWay Int`, `totalTripKm Decimal(10,2)`,
`loadsSource String` (`cycle` | `manual`), `dailyKmSource String` (`derived` | `manual`).
On `OperationsSettings`: `routeVehicleMode String?`. No backfill, no NOT NULL.

### 4. The arithmetic, in one place
Extend `travel-time.ts` with pure functions and use them from the service - no second copy:
`planningMinutes({ baseline, index })`, `deriveCycle` (unchanged), `requiredTrips({ quantity,
capacityPerLoad })`, `durationDays({ trips, trucks, loadsPerDay })`, `totalTripKm({ trips,
oneWayKm })`. `loadsPerDay === 0` returns an `infeasibleCycle: true` result that the service stores
(`loadsSource = "cycle"`, loads null) and the engine treats as "cannot price yet" - never a divide.

### 5. The cost engine
- Fuel becomes `fuelPrice * consumption / 100 * totalTripKm` - **once, for the whole job**, not per
  day and not per truck. Day hire keeps its existing `perDay * durationDays * qtyTrucks` shape.
- `dailyKm` stays as a stored figure and keeps its `derived`/`manual` provenance, but it no longer
  drives fuel.
- **Create must resolve travel before it prices.** Move the engine call after travel resolution so a
  new line's loads, duration, km, fuel and total agree on its first save.

### 6. Provenance and "return to automatic"
- A value the estimator typed sets its source to `manual` and is never recomputed.
- A value the system derived sets `cycle` / `derived` and **is** recomputed whenever the route, the
  index, capacity, trucks or quantity change.
- Clearing the field (explicit `null` in the DTO) returns it to automatic and immediately re-derives.
- Do not infer "typed" from "stored" anywhere in the update path.

### 7. Tip finder wiring (API side)
`mapLocationId` already flows into create and update. Keep the tip's own facility rate lookup working
and make sure a line that arrives with a `mapLocationId` resolves its route in the same save. The web
handler that discards the id is fixed in the web slice (S8h), not here.

**Tip-finder ranking stays out of this slice.** It ranks on haversine today; re-ranking it on routed
distance is its own slice, because it would put a paid call behind every candidate in the list. The
web slice explains the difference on screen: the finder's figure is an estimate for choosing a tip;
the waste line's figure is the priced route.

## Tests
- `geoapify-route.spec.ts` (provider mocked, no live call in CI): both samples average into an index;
  a failed sample gives `suggestedIndex: null`, not a half answer; a timeout returns `null` within
  budget with exactly one retry; no key appears in any log, error or `detail`; with no key the
  factory picks straight line and makes no HTTP call.
- `travel-time.spec.ts` (EDIT): the acceptance examples, verbatim -
  8 trips, 20 km one way, 4 loads/day -> 2 days and **320 km**;
  the same 8 trips at 2 loads/day -> 4 days and **still 320 km**;
  quantity = 3.5 capacities -> 4 trips; 4.5 -> 5 trips;
  `planning = average(baseline, baseline x index)`;
  `loadsPerDay = 0` -> infeasible, no division.
- `scope-waste-travel.spec.ts` (EDIT): first save prices loads, duration, km, fuel and total
  consistently; a final day with one remaining trip charges fuel for one trip, not a full day;
  editing the index changes time, loads/day and duration but **not** km per trip; a manual loads/day
  override survives an index change until it is cleared; clearing it re-derives; a route failure
  falls back badged and the save succeeds; rate and quote snapshots are unchanged by all of it.

## Do NOT
- Do NOT multiply kilometres by the traffic index, anywhere, ever.
- Do NOT call Geoapify from a test, from CI, or from the tip finder's ranking.
- Do NOT let a provider failure, a missing key or an infeasible cycle block a save.
- Do NOT describe the index as measured or peak-hour traffic in code, copy or docs.
- Do NOT touch Azure, Entra or SharePoint. Do NOT put a key in the repo, `.env.example` (beyond a
  commented placeholder) or a log line.
- Do NOT change the capacity matrix behaviour from #2114, the rate snapshots, or `tokens.css` / `sot/`.
- Do NOT touch `apps/web` - the editable index, the shown inputs and the tip-finder fix are S8h.

## PR body must carry (column 0, bare)
```
GATE-ALLOW: migrations
```
plus a worked example of each acceptance case and one before/after of a real line's fuel figure.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- `escalates: true` - a migration plus a correction to how haulage fuel is charged. Marco merges.
- Hard stop: Azure / Entra / SharePoint, production auth or secrets, any irreversible action.
