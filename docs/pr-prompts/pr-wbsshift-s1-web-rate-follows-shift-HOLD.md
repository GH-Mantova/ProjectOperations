---
premise: 'grep -q "Number(r.dayRate)" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The WBS manpower group has a Shift dropdown and prices every row at the day rate. MEASURED
  2026-09-03 at origin/main de811907 - SHIFT_OPTIONS at line 308 offers Day, Night and Weekend; the
  LabourRate type at lines 137-145 already carries dayRate, nightRate and weekendRate, so the
  payload from GET /estimate-rates/labour has all three; and labourRateById at lines 561-565 maps
  each rate id to Number(r.dayRate) alone, discarding the other two. The column header at line 785
  reads "Day rate" beside a shift the estimator just chose. Night is 1000 against a day rate of 600
  for five of seven roles, so a night line reads 40 percent under. No API, route or DTO change is
  needed - the data is already on the wire and is thrown away in the browser.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx
done_when: >-
  ! grep -q "Number(r.dayRate)" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx && grep -q "nightRate" apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx && pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: wbs-shift
cluster_order: 2
requires_on_main: apps/api/src/modules/tendering/scope-item-pricing.ts :: labourRateForShift
---

# WBS-SHIFT-S1: the rate the WBS shows must follow the shift the estimator picked

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T05:3xZ.**

Web only. Two files. No API change, no route change, no DTO change — **the payload already carries
all three rates.**

**This slice is GATED on WBS-SHIFT-S2 landing first**, and the order is not arbitrary. Today the
label and the price are both the day rate: wrong, but consistent, so nobody is misled about what was
quoted. Correcting the display alone would show a night rate over a price still computed at the day
rate — the screen would look fixed while the stored number stayed wrong, which is worse than the
current state. So the pricing lands first and the display catches up.

## The measurement

`ScopeQuantitiesTable.tsx`:

- `:308` — `SHIFT_OPTIONS = ["Day", "Night", "Weekend"]`, rendered in the manpower group.
- `:137-145` — `type LabourRate` already declares `dayRate`, `nightRate`, `weekendRate`.
- `:561-565` — `labourRateById` reduces each rate to `Number(r.dayRate)`. **The other two are dropped
  here and nowhere else.**
- `:1202` — the cell reads `labourRateById.get(rowState.labourTypeId)` for the catalogue rate.
- `:785` — the column header is the literal string `Day rate`.

Row 0's shift is `item.shift` and writes through with `patchItem`; rows above 0 keep `shift` in local
row state. Both are available at the point the rate is resolved.

## Do

1. **Widen the lookup.** Change `labourRateById` from `Map<string, number>` to a map of the id to the
   three rates — `{ day, night, weekend }` as numbers — and add a small pure helper beside
   `manpowerRowTotal` that takes that record plus a shift string and returns the right number.
   Default to the day rate when the shift is absent, unrecognised or null, so an unset shift behaves
   exactly as it does today.
2. **Resolve by shift at every consumer**, including the override placeholder and the row total, so
   the placeholder shown in the override cell is the rate that would actually apply.
3. **Rename the column header** from `Day rate` to `Rate`, and show the applicable shift beneath or
   beside the value where the existing cell layout allows it without a new column. A header that
   names one shift while the row prices another is how this survived review.
4. **Export the helper** so it is unit-testable without rendering, in the same style as
   `manpowerRowTotal`.
5. **Extend `wbs-manpower-columns.test.tsx`.** Add cases proving: a Night row resolves the night
   rate; a Weekend row resolves the weekend rate; a Day row is unchanged from today; a null or
   unknown shift falls back to the day rate; and an explicit override still beats all four. The
   fallback case is the regression guard — without it a later refactor can reintroduce a silent zero.

## Do NOT

- Do NOT touch `apps/api/**`. The endpoint already returns all three rates; changing it here would
  collide with WBS-SHIFT-S2.
- Do NOT change what is persisted. `labourTypeId` is local row state today and stays local — this
  slice does not start sending it, and does not change the `patchItem` payload.
- Do NOT change `manpowerRowTotal`'s signature. Add the resolver beside it; leave its existing tests
  passing untouched.
- Do NOT add a column. The fix is which number the existing cell shows.
- Do NOT touch `sot/`.

## Verify

- `grep -n "Number(r.dayRate)" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` returns nothing.
- `grep -n "Day rate" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` returns no table header.
- `pnpm --filter @project-ops/web test:logic` passes, with the new cases visible in the output.
- `pnpm build` and `pnpm lint` exit 0.
- `git diff --stat` lists exactly two files.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run. Finishing the work and then asking for permission is
> indistinguishable from failing.
