---
premise: '! grep -rq "WASTE_PANEL_LAYOUT_V1" apps/web/src'
premise_means: >-
  The waste line's expanded panel still presents one quantity several ways and the tip three ways.
  MEASURED 2026-10-02 at origin/main 7d9926ae (after #2184):
  - ScopeWasteTab.tsx has three tip entry points: the Facility select with Find tip (mode "find",
    :1083), the Map button beside Daily km (mode "map", :1964), and the "Tip (map location)" select
    (:1982). Both buttons open the same TipFinderDrawer.
  - The Goes-to header carries width "1%" (:870), and the shared QuoteDestinationSelect has no
    width (scope-cards/QuoteDestinationSelect.tsx:53), so the options render as "In th".
  - TipFinderDrawer pre-fills loadTonnes from the row's whole quantity (TipFinderDrawer.tsx:30),
    while the server ranks disposal on loadTonnes plus ONE return trip of travel. Distance is
    under-weighted by the number of trips, and the recommended tip can be the wrong one.
  - The comment at ScopeWasteTab.tsx:90 says dailyKm is "totalTripKm / trucks". The server computes
    loadsPerDay x 2 x one-way km (scope-waste.service.ts derivedDailyKm).
  POSITIVE CONTROL: grep -n 'mode: "map"' apps/web/src/pages/tendering/ScopeWasteTab.tsx returns
  a hit, so the zero for the marker is real.
design_ref: Claude Design/proposed/s8j-waste-panel/s8j-waste-panel-mockup.html
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test && node scripts/pipeline/check-hex-ratchet.mjs &&
  grep -q "WASTE_PANEL_LAYOUT_V1" apps/web/src/pages/tendering/ScopeWasteTab.tsx &&
  ! grep -q 'mode: "map"' apps/web/src/pages/tendering/ScopeWasteTab.tsx &&
  ! grep -q '"1%"' apps/web/src/pages/tendering/ScopeWasteTab.tsx
scope:
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/components/TipFinderDrawer.tsx
  - apps/web/src/pages/admin/TipFinderPanel.tsx
  - apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx
  - apps/web/src/pages/tendering/__tests__/waste-panel-layout.test.tsx
  - apps/web/src/pages/tendering/__tests__/tip-finder-per-trip.test.tsx
  - apps/web/src/pages/tendering/__tests__/quote-destination-width.test.tsx
size: 6
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Web only. No API, schema, migration, seed or env var. Reverting restores today's panel; every
  value the panel writes (wasteFacility, mapLocationId, dailyKm via the chip) uses existing routes
  and fields.
escalates: false
module: tendering
---

# Scope cards S8j: the waste panel reads as one panel: one tip, one trip plan, a readable "Goes to"

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`, which Marco approved on 2026-10-02. Marco also ruled on
2026-10-02 that the **Goes-to width fix is shared across all four screens**.

**Web only.** No API change, no migration, no change to the cost engine or the travel resolve. Every
priced figure on a saved line must come out identical; test 6 pins that.

## 1. "Goes to" is readable on all four screens

- `scope-cards/QuoteDestinationSelect.tsx`: `baseSelectStyle` gains `minWidth: 96, maxWidth: 112`,
  the values the Discipline Cards artifact specifies for `.destsel`.
- `ScopeWasteTab.tsx:870`: remove `width: h === "Goes to" ? "1%" : undefined`.
- The four screens that use the control: `ScopeWasteTab`, `ScopeCuttingSheet`,
  `ScopeQuantitiesTable`, `scope-cards/OtherOperationalCosts`. You touch only the shared component
  and the waste header. Verify all four by screenshot.

## 2. One tip control

Marker: `export const WASTE_PANEL_LAYOUT_V1 = "scopecards-s8j";`

- Replace the Facility select, the "Tip (map location)" select and the Map button with **one "Tip"
  control**, plus **one Find tip button**.
- The control lists facility rates. Each option shows its gate rate and whether it is linked to a
  map location ("route ✓"). A facility with no map location is still selectable. The panel then
  says plainly that it has no map location and the line uses the badged straight-line estimate.
- Selecting a tip writes `wasteFacility` **and** `mapLocationId` in **one** patch. **No `dailyKm`
  key in that patch, ever.**
- `handleTipChosen` keeps #2184's behaviour exactly: no automatic `dailyKm` write.
- Its map-distance **click-to-apply chip stays**, now shown on the Daily km figure, and applying it
  still records `dailyKmSource: "manual"`.
- Both values stay on the row and both stay patchable. Nothing in the data model changes; only the
  extra controls go.

## 3. Panel layout, in this order (mock-up section 2)

1. **Tip**: the control above.
2. **Route & travel**: the S8h travel block, unchanged in content. One-way km, planning minutes,
   traffic allowance with its chip and "Return to automatic", and cycle. Move it so it sits directly
   under the tip.
3. **Trip plan**:
   - Read in derivation order: quantity ÷ capacity per load = trips, then loads per truck per day
     (with its `cycle`/`manual` chip and "Return to automatic"), trucks, and duration.
   - Below that, **two separately labelled kilometre figures**:
     - **"Total route km: the whole job"**: trips × 2 × one-way km, with the note "fuel is charged on
       this".
     - **"Daily km: one truck, one full day"**: loads per truck per day × 2 × one-way km, with its
       `derived`/`manual` chip and the map chip.
   - Capacity per load, trucks and transport item stay editable where they are today. Grouping is
     not merging: **trips and loads per truck per day are different numbers and stay two figures.**
- Fix the stale comment at `ScopeWasteTab.tsx:90` to the real server derivation:
  `loadsPerTruckPerDay × 2 × one-way km`.
- Keep the infeasible-cycle state and the straight-line fallback badge from S8h.

## 4. Find tip compares one real trip

`TipFinderDrawer` stops pre-filling the row's whole quantity. Instead:

```
requiredTrips = row.wasteLoads when set (respect an override - never re-derive it)
                else ceil(qty ÷ capacityPerLoad) ONLY when capacityUnit is tonnes
perTripTonnes = qty ÷ requiredTrips          (NOT capacityPerLoad - 100 t at 26 t is 4 trips of 25 t)
loadTonnes    = perTripTonnes                (sent to the existing endpoint; no API change)
```

Handle each case as its own branch:

- **Tonnes and trips both resolvable:** rank on `perTripTonnes`. The drawer says "Compared on one
  trip of 25 t (this line: 100 t in 4 trips)".
- **Trips unresolvable** (no override and no tonne capacity): ask for capacity per load, say why, and
  compute nothing until it is entered.
- **Tonnes absent**, any capacity: ask for the tonnage and compute nothing. The rate library prices
  per tonne.
- **Capacity in m³:** never divide tonnes by an m³ capacity. Use `row.wasteLoads`, or ask.
- **Never** fall back to the row total. That is the defect this slice exists to remove.

Other drawer changes:

- **"Coming from" is not a field when the drawer opens from a waste row.** Show
  "From the tender site: <address>" as text. The request still sends `originType: "tender"` and
  `tenderId`.
- The admin page's `TipFinderPanel` keeps its own fields. Change it only through the drawer-mode
  props.
- This changes **advice only**. "Use" writes facility and `mapLocationId`, and the line then prices
  the real route.

## Tests

1. `quote-destination-width.test.tsx`:
   - The shared select carries `minWidth` 96 and `maxWidth` 112.
   - All four `DESTINATION_LABELS` render in full on each of the four screens.
   - The waste table header for Goes-to has no `1%` width.
2. `waste-panel-layout.test.tsx`: exactly **one** tip control and **one** Find tip button. No element
   opens the drawer in `"map"` mode, and the "Tip (map location)" label is absent.
3. `waste-panel-layout.test.tsx`: choosing a tip on the row sends **one** patch containing
   `wasteFacility` **and** `mapLocationId` and **no `dailyKm` key**. Assert the key is absent, not
   just that the value is unchanged. Do the same for "Use" in the finder via `handleTipChosen`.
4. `waste-panel-layout.test.tsx`:
   - The map chip still applies a manual override with `dailyKmSource: "manual"`.
   - After a tip change, `dailyKmSource` reads `"derived"`.
5. `waste-panel-layout.test.tsx`: all four figures are present and separately labelled. They are
   trips, loads per truck per day, total route km and daily km.
6. `waste-panel-layout.test.tsx`: for a fixed row fixture, `totalTripKm`, `lineTotal` and every cost
   field rendered are **byte-identical** before and after. The layout must not touch arithmetic.
7. `tip-finder-per-trip.test.tsx`:
   - A 100 t row with `wasteLoads` 4 sends `loadTonnes` **25**, not 100 and not 26.
   - A row with `wasteLoads` 5 for 100 t sends **20**, because the override is respected.
8. `tip-finder-per-trip.test.tsx`: the close-rate case.
   - Kedron is 12 km at $61.95/t; Wacol is 22 km at $60.00/t; `travelRatePerKm` is $2.50.
   - At 25 t Kedron ranks first. At 26 t Wacol ranks first.
   - Assert the **chosen tip** at each value, not only the argument.
9. `tip-finder-per-trip.test.tsx`:
   - Missing capacity with no override shows the ask and issues **no** request.
   - Missing tonnes does the same.
   - An m³ capacity with no override asks, and never divides.
10. `tip-finder-per-trip.test.tsx`: opened from a waste row, there is no "Coming from" control, the
    tender address renders as text, and the request body still carries `originType: "tender"`.
11. The existing `waste-travel-index.test.tsx`, `waste-section.test.tsx` and
    `other-operational-costs.test.tsx` stay green **unchanged**. If one has to change, explain why in
    the PR.
12. Tests 2, 3, 7, 8 and 10 each **fail on `origin/main`**. Revert the production hunk once to prove
    it, and say so in the PR.

## DO NOT

- Do not change any API, the cost engine, `scope-waste.service.ts`, the travel resolve, or the
  schema.
- Do not reinstate an automatic `dailyKm` write in any form. That includes "helpfully" seeding it
  when a tip is chosen.
- Do not re-rank on route distance. The finder stays straight-line; per-candidate routing is a
  separate decision.
- Do not change whether the Loads column is editable. Do not add a map view.
- No new `#RRGGBB` literals; use tokens. Do not touch `sot/` (CP-24).

## PR body must include

1. **Screenshots:**
   - Desktop (≥1440 px) and narrow (≤420 px), each in light and dark, showing a routed row expanded
     and a straight-line fallback row.
   - Each of the other three Goes-to screens, before and after.
   - At ≤420 px every table scrolls inside its own container, and the body gains no horizontal
     scroll.
2. **A task test run by a person, with what they actually said:** "Here is a tender with a waste
   line. Choose a tip, tell me its gate rate and how far the trucks drive, raise the traffic
   allowance to 1.4, then tell me how many trips the job takes, how many loads one truck does a day,
   and what it costs." It passes only if they finish without opening another tab, without asking
   which tip field to use, and while naming trips and loads per day as two different things.
