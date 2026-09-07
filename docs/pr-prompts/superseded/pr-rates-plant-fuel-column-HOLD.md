---
premise: '! grep -q "PLANT_FUEL_COLUMN_V1" apps/api/prisma/seed-initial-services.ts'
premise_means: The plant RateTable has one VALUE column (Rate). EstimatePlantRate.fuelRate has no RateTable equivalent, so the persona rate-lookup tool loses fuelRateAud at cutover - and that is the field the tendering persona is explicitly told to report.
scope:
  - apps/api/prisma/seed-initial-services.ts
  - apps/api/prisma/migrations/
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "PLANT_FUEL_COLUMN_V1" apps/api/prisma/seed-initial-services.ts && ls apps/api/prisma/migrations | grep -q plant_fuel_column
size: 4
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
cluster: rates-consumers
cluster_order: 5
requires_on_main: 'apps/api/src/modules/rates/rate-resolver.service.ts :: sortOrder'
rollback_strategy: 'Additive only - one rate_columns row (rt-plt-c-fuel) plus a fuel cell written into each existing rt-plt rate_rows JSONB, both guarded by WHERE NOT EXISTS / a key-absent test. Nothing existing is altered and no row is deleted. To revert: DELETE the rate_columns row and strip the key from the rows JSONB; the resolver change reverts with the code. Safe to leave applied - a column nothing reads is inert.'
---

# Give the plant rate table a Fuel rate column (PLANT_FUEL_COLUMN_V1)

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Why, and why it is smaller than it sounds

`rates-consumers-s3` could not finish. The agent migrated the two rate types that move cleanly
through `listRates()` and **stopped rather than force its `done_when` green**, reporting two missing
fields. `sortOrder` was the first and landed as `#1715`. **`fuelRate` is the second and it is the last
thing holding that slice.**

It is not a missing passthrough. `lookupPlant` returns `fuelRateAud`
(`lookup-rate.handler.ts:520`), and `tendering.persona.ts:368` instructs the model to report it
because *"the hire rate alone understates the all-in plant cost"*. The legacy plant info bag carries
only `{ Category, Unit }`, and the RateTable projection of plant has **one** VALUE column:

```
{ key: "rate", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "day", sortOrder: 4 }
```

So at cutover the figure simply disappears.

**A rate table holding two priced quantities is an existing, shipped pattern, not a new concept.**
The `waste` table three definitions further down the same seed file already does it:

```
{ key: "ton",  name: "Rate per tonne", dataType: "CURRENCY", role: "VALUE", unit: "tonne", sortOrder: 4 },
{ key: "load", name: "Rate per load",  dataType: "CURRENCY", role: "VALUE", unit: "load",  sortOrder: 5 }
```

Two VALUE columns, different units, one table. **Follow that template.** Marco ruled on 2026-09-07,
asked directly: *add Fuel rate as a second VALUE column.*

## What to build

1. **`seed-initial-services.ts`** &mdash; a second VALUE column on the `plant` table, shaped like
   `waste`'s pair: `{ key: "fuel", name: "Fuel rate", dataType: "CURRENCY", role: "VALUE", unit: "day",
   sortOrder: 5 }`, and the row projection gains the cell from `r.fuelRate`. Mark it
   `PLANT_FUEL_COLUMN_V1`.

2. **A migration.** Production runs `prisma migrate deploy` and **never** runs the TypeScript seed
   (CP-23), so a seed-only change never reaches it. Insert the `rate_columns` row and write the fuel
   cell into each existing `rt-plt` row's JSONB from the matching `EstimatePlantRate`. Guarded so a
   re-run is a no-op; **loud if the plant table or its rows cannot be found**, the way
   `20260906120000_rates_value_columns_require_unit` is &mdash; read that migration first, it is the
   house pattern for exactly this and it was measured against a live database.

   ⚠️ **Key on the unique constraint the seed uses (`rate_table_id` + `name`), NOT on the literal id.**
   A `rate_columns` row created by the admin UI carries a cuid under the same name, and an id-keyed
   migration would silently update nothing and exit 0. That is a mistake this repo has already made
   once and corrected; do not remake it.

3. **`rate-resolver.service.ts`** &mdash; the plant adapter surfaces the fuel figure so a consumer can
   read it from a `ListedRate` on **both** paths. **How** is the design call: `#1710` and `#1715` both
   added a named field to `ListedRate`, which is the established precedent and is probably right here
   too; the alternative is the `info` bag. Pick one, say why, and say what you rejected. Whatever you
   choose must hold for the RateTable path **and** the legacy path, or the cutover still loses the
   figure and this slice has not done its job.

## The invariant, unchanged from #1710 and #1715

**Not one `where` or `orderBy` may be added, removed or altered.** `listRates()` must return exactly
the row sets, in exactly the order, it returns today. Prove it and state the result in the PR body:

```
git diff -U0 -- apps/api/src/modules/rates/rate-resolver.service.ts | grep -E "where|orderBy"
```

should return **only comment lines**. Run it scoped to the production file &mdash; `#1715` established
that running it over the whole diff returns test assertions that *pin* the existing queries, which is
the opposite of the risk the check exists for.

## Tests

- the plant adapter reports the fuel figure on the legacy path, from a fixture whose `fuelRate` is
  **distinct from its `rate`** so the two cannot be confused;
- the same on the RateTable path, from a `rate_rows` fixture carrying the fuel cell;
- **a plant row with a null or absent `fuelRate` &mdash; what does it report?** Decide deliberately and
  test it. `EstimatePlantRate.fuelRate` defaults to `0` server-side per `estimates.service.ts:156`, so
  `0` is a real, meaningful value and `null` may not be reachable &mdash; check before assuming;
- the row set and its order are **unchanged**.

⚠️ **The `toEqual` trap, which has now bitten this cluster twice.** A fixture that omits the new field
makes the resolver emit `undefined`, and jest treats an undefined property as **absent**, so an
exhaustive `toEqual` passes while proving nothing. `#1710` and `#1715` each found this in the same
pre-existing RateTable-path test. **Check every fixture you touch, and revert your production hunk in a
scratch copy to confirm your new tests go red.** Report that result.

## Stop and report

- **If `EstimatePlantRate.fuelRate` turns out not to be per-day**, stop. The column unit above assumes
  it is billed on the same basis as the hire rate; if the data says otherwise the unit is wrong and
  the right value is a decision, not a guess.

## What this is NOT

- Not the consumer migration. `lookup-rate.handler.ts` is out of scope; finishing `rates-consumers-s3`
  is that slice's job once this lands.
- Not a filter. The resolver still returns inactive rows; consumers filter explicitly.
- Not a change to `estimates.service.ts` or to how `fuelRate` is entered today.
