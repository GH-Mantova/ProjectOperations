---
premise: 'grep -q "export type ListedRate" apps/api/src/modules/rates/rate-resolver.service.ts && ! grep -A18 "export type ListedRate" apps/api/src/modules/rates/rate-resolver.service.ts | grep -q "sortOrder"'
premise_means: >-
  ListedRate carries no sortOrder, so the six persona rate-lookup helpers that order by
  [{sortOrder asc}, {field asc}] cannot preserve their order after being routed through
  listRates(). This is the measured blocker that stopped rates-consumers slice 3 finishing.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
done_when: >-
  pnpm build && pnpm lint && grep -A18 "export type ListedRate"
  apps/api/src/modules/rates/rate-resolver.service.ts | grep -q "sortOrder"
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: rates-consumers
cluster_order: 4
requires_on_main: 'apps/api/src/modules/rates/rate-resolver.service.ts :: isActive: boolean'
---

# Surface sortOrder on ListedRate (the second 11b consumer prerequisite)

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Why this exists

`pr-rates-consumers-s3-persona-export` was built on 2026-09-06 and could not finish. The agent
migrated the two rate types that move cleanly and **stopped rather than force its `done_when`
green**, reporting that 12 of 16 call sites in
`apps/api/src/modules/personas/tools/handlers/lookup-rate.handler.ts` cannot move because
`ListedRate` is missing two fields. This slice supplies the first of them.

This is deliberately the same shape as
`pr-rates-11b2-resolver-isactive-surface` (merged as #1710, which surfaced `isActive` for exactly
the same reason): **surface the field, change no row set, change no order, touch no `where`.**

## The measured blocker

Six `available*` helpers in the handler order by `[{ sortOrder: "asc" }, { <field>: "asc" }]`, and
`lookupOther` orders its `matches[]` payload the same way. **`sortOrder` is a curated business
order, not alphabetical.** The `CuttingOtherRate` seed runs "Extra man" (5), "Stand-down time" (6),
"Clean-up time" (7) … "Overtime hourly charge beyond minimum" (28), and the model carries
`@@index([isActive, sortOrder])` for it. Alphabetical would be a completely different sequence, and
`matches[]` is a real response payload the model picks from — so reordering it is a behaviour
change, not cosmetics.

`ListedRate` exposes no `sortOrder`, and no `info` bag carries it, so the order cannot be rebuilt at
the call site.

## What to build

Add `sortOrder` to `ListedRate`, populated from the backing row, in `tryListRateTable` **and in
every legacy adapter case** — the same treatment #1710 gave `isActive`.

**Check the schema first, as #1710 did.** #1710 verified that all nine backing models declare
`isActive Boolean @default(true)` before claiming the field was universal. Do the same here:
enumerate every model the resolver serves (`EstimateLabourRate`, `EstimatePlantRate`,
`EstimateWasteRate`, `EstimateCuttingRate`, `EstimateCoreHoleRate`, `EstimateFuelRate`,
`EstimateEnclosureRate`, `CuttingOtherRate`, `RateRow`) and report which ones actually declare a
sort column and what it is called. **If any of them does not have one, stop and report** — do not
default it to 0 and do not invent an ordinal from array position. A fabricated order is worse than
an absent one, because the caller cannot tell it is fabricated. If the field is genuinely absent on
some kind, `sortOrder: number | null` with the reason documented is the honest shape, and say so
rather than deciding silently.

Labour's three fan-out entries take their shared row's value, as they do for `isActive`.

## The invariant, unchanged from #1710

**Not one `where` or `orderBy` may be added, removed or altered.** `listRates()` must return exactly
the row sets, in exactly the order, that it returns today. Prove it the way #1710 did:
`git diff -U0 | grep -E "where|orderBy"` should return only comment lines. State that result in the
PR body.

## Tests

In `__tests__/rate-resolver.service.spec.ts`:

- for a legacy kind and for the RateTable path, a fixture whose rows carry **distinct, non-sequential**
  `sortOrder` values, asserting each entry's `sortOrder` matches its row and that the **row set and
  order are unchanged**;
- the labour fan-out: one row, three entries, all three carrying the row's value;
- **a test that would fail if `sortOrder` were derived from array position rather than read from the
  row** — i.e. give the fixture rows whose `sortOrder` does not match their position. This is the
  point of the slice and it is the assertion most likely to be written uselessly.

⚠️ **Beware the `toEqual` trap this project has now been bitten by twice.** A fixture row that omits
`sortOrder` makes the resolver emit `undefined`, and jest's `toEqual` treats an undefined property
as **absent** — so an exhaustive `toEqual` will pass while proving nothing. #1710's author found
exactly this in the pre-existing RateTable-path test and had to add the field to the mocked rows to
make the assertion real. Check every fixture you touch for the same hole, and **revert your
production hunk in a scratch copy to confirm your new tests go red**. Report that result.

## What this is NOT

- Not the consumer migration. `lookup-rate.handler.ts` is not in scope; finishing slice 3 is slice 3's
  job once this and the `fuelRate` question are settled.
- Not a filter. The resolver still returns inactive rows; consumers filter explicitly.
- Not the `fuelRate` gap. `lookupPlant` returns `fuelRateAud` and the legacy plant info bag carries
  only `{ Category, Unit }`; that one is a genuine asymmetry with no RateTable equivalent and needs
  a decision from Marco, not a patch here.
