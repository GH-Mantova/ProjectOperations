---
premise: '! grep -rq "WASTE_TRAVEL_INDEX_UI_V1" apps/web/src'
premise_means: The estimator cannot see or change the traffic allowance behind a waste line's travel time, cannot tell a derived figure from one they typed, gets no explanation when a cycle will not fit an eight-hour shift, and the Find-tip button still throws away the facility it just resolved.
scope:
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/components/TipFinderDrawer.tsx
  - apps/web/src/pages/tendering/__tests__/waste-travel-index.test.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
done_when: pnpm build && pnpm lint && grep -q "WASTE_TRAVEL_INDEX_UI_V1" apps/web/src/pages/tendering/ScopeWasteTab.tsx && ! grep -q "_mapLocationId" apps/web/src/pages/tendering/ScopeWasteTab.tsx
size: 5
gate_allow: none
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 15
requires_on_main: 'apps/api/src/modules/tendering/providers/geoapify-route.provider.ts :: GEOAPIFY_ROUTE_TRAVEL_V1'
design_ref: Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html
---

# Scope Cards S8h - the traffic allowance on screen, and Find tip that sticks

**Web half of the Geoapify slice.** S8g put the route, the modelled traffic allowance, the trip
arithmetic and the provenance flags on the server. This slice shows them, lets the estimator
overrule the allowance, and fixes the Find-tip hand-off. **No API change, no migration, no
arithmetic in the web** - every figure below is one the server already returns.

**The mock-up is the specification**: `Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html`
(approved by Marco 2026-09-24). Match its wording, its chips and its blank states.

## Grounded on origin/main ca04826b + S8g - re-verify before you edit

- `ScopeWasteTab.tsx` handles the tip-finder accept with the map location id named
  `_mapLocationId` and **discards it** (~:690-700) - it writes the facility name only. The row's own
  tip dropdown already patches `mapLocationId` (~:1307-1311). `TipFinderDrawer.tsx` supplies the id.
- The waste row type at `ScopeWasteTab.tsx:~74` already carries `mapLocationId`.
- After S8g the row also carries, from the server: `travelKm`, `travelMinutesOneWay` (baseline),
  `travelIndex`, `travelIndexSource` (`geoapify` | `manual` | `none`),
  `travelPlanningMinutesOneWay`, `travelSource` (`route` | `straight-line`), `travelDetail`,
  `totalTripKm`, `loadsSource` (`cycle` | `manual`), `dailyKmSource` (`derived` | `manual`), and the
  infeasible-cycle flag. **Read them; never recompute them.**

## What to build

1. **`export const WASTE_TRAVEL_INDEX_UI_V1 = "scopecards-s8h";`** in `ScopeWasteTab.tsx`.
2. **The travel strip** on an expanded waste row, exactly as mock-up section 1: the route headline
   (`Route 21.6 km one way`) with a `Geoapify route` chip, then the chain
   `Baseline -> x allowance -> Adjusted -> average -> Planning`, each figure in its own box with its
   label. Underneath, one sentence saying the allowance is **modelled** - Geoapify's approximated
   time over its free-flow time - **not measured peak-hour traffic**.
3. **The allowance is editable** on the line: a number input, 2 dp, minimum 1.00. Typing a value
   patches `travelIndex` and the row's chip becomes `Manual`, showing what was suggested beside it,
   with a **Return to automatic** action that patches `travelIndex: null`. A suggested value shows
   the `Suggested` chip. When `travelIndexSource` is `none` the field reads 1.00 with the note that
   no route was available to suggest one.
4. **Provenance chips on the derived fields** - loads per truck per day, daily km, capacity per load:
   `From cycle` / `From matrix` / `Derived` when automatic, `Manual` with the automatic figure beside
   it and a **Return to automatic** action when typed. Clearing a field is what returns it to
   automatic, and the row must re-read the server's answer afterwards.
5. **The totals strip** (mock-up section 1): quantity, required trips with its `ceil(qty / capacity)`
   note, trucks, duration with its own note, total route km with `trips x 2 x one-way`, and
   `Fuel charged on <totalTripKm> km`. One line under it: fuel follows the trips that happen,
   including the final part-used day.
6. **The infeasible-cycle state** (mock-up section 4, left): when the server says no whole load fits
   the shift, the strip shows the cycle minutes and a red `No whole load fits an 8-hour shift` chip,
   trips / duration / price read as blank rather than zero, and the row still saves. Offer the three
   ways out in one sentence: a closer tip, a lower allowance, or plan it by hand.
7. **The fallback state** (mock-up section 4, right): `Straight line ... estimated, no route`, badge
   not selectable, allowance 1.00 with its note. Unchanged from what S8a shipped except for the
   allowance row.
8. **Find tip sticks** (mock-up section 5): the accept handler takes the map location id and patches
   `mapLocationId` on the row - the same patch the dropdown makes - so the server resolves the route
   on that save. Rename `_mapLocationId`; the `done_when` grep proves the discard is gone. Under the
   finder's list, one line: the finder ranks on straight-line distance, and the line prices the real
   route, so the two figures differ.

## Do NOT
- Do NOT compute a rate, a distance, a cycle, a trip count, a duration or a price in the web. Fold
  and display server figures only.
- Do NOT call Geoapify from the web, and do NOT re-rank the tip finder on routed distance - that is
  a separate slice.
- Do NOT let the allowance accept a value below 1.00, and do NOT seed it with 1.37 or any other
  example figure.
- Do NOT describe the allowance as measured, actual or peak-hour traffic anywhere in the copy.
- Do NOT block saving in any state, including infeasible and fallback.
- Do NOT touch the API, the schema, `tokens.css` or `/sot/` (CP-24).

## Tests (`waste-travel-index.test.tsx` NEW, `waste-section.test.tsx` EDIT)
- The chain renders baseline, allowance, adjusted and planning from server fields, and the copy
  contains "modelled" and does not contain "peak hour" or "measured".
- Editing the allowance patches `travelIndex` and shows `Manual` with the suggested figure beside it;
  **Return to automatic** patches `travelIndex: null`.
- A `manual` loads-per-day row keeps its chip and its value after an allowance edit; its
  **Return to automatic** clears it.
- The infeasible flag renders the red chip, blanks trips / duration / price, and the save button
  stays enabled.
- The fallback row renders `estimated, no route`, allowance 1.00, and no `Geoapify route` chip.
- Accepting a tip from the finder patches `mapLocationId` with the id the drawer supplied - the
  regression test for the discarded `_mapLocationId`.
- A row with `totalTripKm` renders `Fuel charged on <n> km`, and changing the allowance in the
  fixture leaves that figure unchanged.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- If `GEOAPIFY_ROUTE_TRAVEL_V1` is not on main, STOP with `NO-OP: predecessor s8g not merged`.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- This changes what an estimator sees on a priced line: label the PR `do-not-merge` for Marco.
