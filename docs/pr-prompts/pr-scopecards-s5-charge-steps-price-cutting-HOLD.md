---
premise: '! test -f apps/api/src/modules/rates/charge-step-pricing.service.ts'
premise_means: The charge-step engine, the admin editor that authors steps and a parity harness that watches them all exist, but nothing prices anything with them. Cutting is priced by hand-written arithmetic in scope-redesign.service.ts with two multiplier constants and a depth-stretch special case, the harness only watches resolveRate which cutting never calls, and a locked tender freezes every rate value it used while freezing none of the formula, so a catalogue formula edit has nothing to be stopped by.
scope:
  - apps/api/src/modules/rates/charge-step-pricing.service.ts
  - apps/api/src/modules/rates/charge-step-parity.service.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/api/src/modules/rates/__tests__/charge-step-pricing.service.spec.ts
  - apps/api/src/modules/rates/__tests__/cutting-step-equivalence.spec.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/tender-rate-set.service.ts
  - apps/api/src/modules/tendering/__tests__/cutting-rate-corrections.spec.ts
  - apps/api/src/modules/tendering/__tests__/tender-rate-lock-formula.spec.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seeds/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- cutting-step-equivalence charge-step-pricing cutting-rate-corrections scope-redesign-rate-resolver charge-step-parity rate-step-evaluator tender-rate-lock-formula && grep -q "CHARGE_STEPS_PRICE_CUTTING_V1" apps/api/src/modules/rates/charge-step-pricing.service.ts && grep -q "charge_steps_snapshot" apps/api/prisma/schema.prisma && test "$(grep -c "ELEVATION_MULTIPLIER" apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0" && test "$(grep -c "METHOD_MULTIPLIER" apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0" && test "$(grep -c "perMmRate" apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0" && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
backfill: false
seed_only: false
escalates: true
module: rates
cluster: scopecards
cluster_order: 7
requires_on_main: 'apps/web/src/pages/tendering/ClientQuotesPanel.tsx :: QUOTE_PUSH_PANEL_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
rollback_strategy: Revert the PR. The one added column is nullable and is read only by code this PR introduces, so an older API ignores it and a locked tender simply prices live again. The seed additions are idempotent upserts that add rows and a second table; no existing row is rewritten, no row is removed and no migration carries an UPDATE, so nothing has to be undone by hand.
---

# Scope Cards S5 - charge steps reach the price

**Fifth of nine.** The formulas authored in Rates & Lists become the thing that prices cutting, and
the tender keeps a copy of the formula it used so a later catalogue edit cannot move a locked price.
API only - no web, no screen. **S6 and S7 (cutting) sit behind this slice** and must not be started
until its marker is on `main`.

> Marco, 2026-09-11: *Rate-calculation formulas are created in the Rates & Lists menu, which is a
> helper/authoring window - but the operative formula is embedded on the tender / scope of works.
> Same model as the locked SoR: the tender owns a copy of what it used, so a later catalogue edit can
> never move a locked tender's price.*

> The mock-up, on how a cutting rate is priced: *"a rate table is a LOOKUP - its key columns find one
> row, and that row carries the price... The loadings that used to be hardcoded constants are now
> either priced rows (Demosaw and Ringsaw wall cuts) or conditional steps (the +25% methods)."*

## Grounded on origin/main 49586724, 2026-09-15 - re-verify line numbers before you edit

- **The engine exists and is unplugged.** `RateTable.chargeSteps Json?` (`schema.prisma:5987`) and
  `lineFields Json?` (`:5994`, `RATE_LINE_FIELDS_V1`). `rate-step-evaluator.ts` (118 lines,
  `CHARGE_STEP_PARITY_V1`) is a thin server wrapper over
  `packages/config/src/charge-step-semantics.ts`, which the admin preview
  (`ChargeStepsEditor.tsx`) also calls - so the number the editor shows and the number the server
  would produce cannot differ. Grammar: `start` `multiply` `divide` `add` `subtract` `round` `floor`
  `cap`, each with **at most one** optional `when` (`charge-step-semantics.ts:58-94`); `floor` and
  `cap` take `value: number` - a literal, never a column.
- **The harness cannot help here.** `charge-step-parity.service.ts` (`RATE_PARITY_HARNESS_V1`)
  returns `Promise<void>` by construction and is called fire-and-forget at four sites inside
  `resolveRate` (`rate-resolver.service.ts:237, :248, :259, :265`). It writes to the Nest **logger**,
  not a table (`:101 :122 :143 :177 :207 :223 :232`) - there is no queryable soak data. And cutting
  never reaches it: `resolveCuttingRate` calls `listRates("cutting")`, not `resolveRate`.
- **How cutting is priced today** - `scope-redesign.service.ts:191-303`: sanitise elevation, method
  allowlist `METHODS_BY_EQUIPMENT` (`:118`), collapse elevation/material to the table's categorical
  set, deepest-at-or-above depth with a biggest-available fallback, the Tracksaw / Flush-cut stretch
  off the 25 mm floor row (`CUTTING_RATE_CORRECTIONS_V1` D2, the `perMmRate` block at `:251-267`),
  then `METHOD_MULTIPLIER` (`:109` - High-Freq 1.25, Low-emission 1.25) and `ELEVATION_MULTIPLIER`
  (`:102-107` - Floor 1.0, Any 1.0, **Wall 1.1**, Inverted 2.0) with Demosaw skipped (D4).
  `resolveCoreHoleRate` reads `METHOD_MULTIPLIER` the same way.
- **What the seed actually holds.** One table, slug `cutting`
  (`migrations/20260713140000_seed_baseline_rate_tables/migration.sql:~150-222`). Demosaw carries
  real Floor and Wall rows. **Ringsaw, Tracksaw and Flush-cut are stored with elevation `"Any"` and
  no wall rows at all** - which is why the code applies x1.1 for them and skips it for Demosaw.
- **The row already carries everything the evaluator needs.** `ListedRate`
  (`rate-resolver.service.ts:140-160`) exposes `rowId`, `keys`, `info`, `value`, `unit` - and
  `listRates` applies the tender's locked snapshot *above* the canonical-source branch (`:541-548`),
  so `value` is already the snapshot value for a locked tender. `RateColumnRole` is
  `KEY | VALUE | INFO` (`schema.prisma:5964`).
- **The lock is the natural home for the formula copy.** `TenderRateSet` (`schema.prisma:6051`, one
  per tender, `lockedAt`, `lockedById`) + `TenderRateEntry` (`:6066`,
  `originalValue` / `overrideValue`) - written by `tender-rate-set.service.ts:33` (upsert) and
  removed on unlock (`:145-152`). It freezes every value and no formula.
- **The plan row's scope path does not exist.** There is no `apps/api/src/modules/estimating/`.
  Pricing lives in `rates/` and `tendering/`.

## The calls, ruled by Marco 2026-09-15

1. **Steps own the arithmetic.** Every multiplier and every stretch becomes either a priced row or a
   step. Choosing *which* row answers a request stays code for now - see call 4.
2. **The formula copy rides the existing rate lock**, beside the values it already freezes - not a
   column on the quote line.
3. **The switch is proven in CI, not in production.** An equivalence spec over every seeded
   combination replaces the soak the harness was built for.
4. **The collapse, the allowlist and the sanitiser stay in this slice and are S6's to remove.** The
   mock-up has no collapsing, no allowlists and no sanitising - a combination with no row is simply
   never offered - but that changes what the estimator can pick, so it belongs with the screen.

**Corrected 2026-09-15 after grounding the mock-up's `CUT_TABLES`:** an earlier draft of this slice
invented a `Wall uplift` column on the row. There is no such column in the mock-up and there must not
be one here. The wall premium is a **priced row**, and the seeded numbers below are today's x1.1 to
the cent, so deleting the multiplier moves no price.

## Build this

`export const CHARGE_STEPS_PRICE_CUTTING_V1 = "scopecards-s5";` in
`apps/api/src/modules/rates/charge-step-pricing.service.ts`.

### 1. One loader, one evaluation - `charge-step-pricing.service.ts` (NEW)

`@Injectable() ChargeStepPricingService`, provided and **exported** from `rates.module.ts`.

Move `loadTable` (`charge-step-parity.service.ts:250`) and `findMatchedCells` (`:324`) into this
service - the parity harness then calls them from here. One loader, not two implementations of the
same cache that can drift apart.

```ts
priceRow(input: {
  tableSlug: string;
  row: ListedRate;                                   // already snapshot-applied by listRates
  lineFields: Record<string, string | number>;
  tenderId?: string | null;
}): Promise<{ value: number; trail: ChargeStepTrailEntry[]; issues: ChargeStepIssue[] } | null>
```

- **Where the steps come from:** when `tenderId` names a `TenderRateSet` whose
  `chargeStepsSnapshot` carries an entry for `tableSlug`, use that copy. Otherwise the live
  `RateTable`. This is the whole of call 2 - a locked tender reads its own formula.
- **The values map** is `buildStepValues(columns, cells, lineFields)`
  (`charge-step-semantics.ts:485`). The rate operand is the row's **`value` as handed in**, never a
  re-read of the live cell - re-reading would price a locked tender off the catalogue.
- **Returns `null`** when the table has no steps. That is how every other rate table stays exactly as
  it is today: the caller keeps its own arithmetic when it gets `null`.
- **A step that cannot be worked out returns `null` as well**, with the issues attached for the log.
  It never returns a guessed figure, and the caller treats it exactly as it treats "no rate found"
  today.

### 2. Cutting asks for a price instead of computing one - `scope-redesign.service.ts`

`resolveCuttingRate` **keeps** (all of it S6's to remove, not this slice's):
`sanitiseSawElevation`, `METHODS_BY_EQUIPMENT`, the elevation/material collapse, and the depth range
match with its biggest-available fallback. Add a comment saying why each survives: it chooses which
row answers the request, and the step grammar has no concept of row selection.

It **loses** three things:

- `ELEVATION_MULTIPLIER` and `METHOD_MULTIPLIER` - both constants deleted, both multiplications gone.
- **the `perMmRate` / Tracksaw stretch block** (`:251-267`). That arithmetic moves into the
  `cutting-mm` table's steps (section 3), so the special case in code disappears with it.

Which table a request goes to: **`cutting-mm` for Tracksaw and Flush-cut, `cutting` for everything
else.** After the row is chosen:

```ts
const priced = await chargeStepPricing.priceRow({
  tableSlug,                                  // "cutting" | "cutting-mm"
  row,
  lineFields: { method: effectiveMethod ?? "", depthMm, metres: 1 },
  tenderId: input.tenderId
});
```

Pass `metres: 1` - this function returns a **rate**, and the metres multiplication belongs to the
caller that knows the line's length. Keep that boundary exactly where it is today.

The returned shape **does not change** - callers depend on it. `finalRate` is the step total.
`methodMultiplier` is now **reported from the trail** (the factor of the method step, `1.0` when the
step was skipped) and `elevationMultiplier` is always `1.0` with a comment saying why: the elevation
premium is in the row, not in a multiplier. They are an explanation of the number, no longer an input
to it. When `priceRow` returns `null`, behave exactly as the "no rate row" path behaves today.

`resolveCoreHoleRate` loses `METHOD_MULTIPLIER` the same way and prices through the `core-hole`
table's steps.

### 3. The half that is data - the seed

Extend the seed idempotently (upsert; a re-run must not duplicate a row, a column or a step). **Add
rows, never remove or rewrite one.** Every figure below is from the mock-up's `CUT_TABLES`; do not
invent a rate.

**`cutting`** - saw cuts by depth band. Keys stay `Equipment`, `Elevation`, `Material`, `Depth`.

- **Seed the missing wall rows.** Ringsaw is stored today as elevation `"Any"` with no wall row. Add
  the `Wall` rows the mock-up lists - 175 mm `$78.43`, 200 mm `$92.68`, 225 mm `$105.71`,
  250 mm `$118.80`, 300 mm `$138.99`, 320 mm `$155.65` - and add the matching `Floor` rows at
  today's figures. **Leave the existing `"Any"` rows in place**; the collapse still resolves to them
  until S6 removes it.
- Demosaw already has its own Floor and Wall rows. Do not touch them, and do not add an uplift to
  them - its wall rows are 1.71x the floor, which is what D4 has always been about.
- `lineFields`: `method` (text), `metres` (number).
- `chargeSteps`:
  1. `start` - the table's rate column
  2. `multiply` `1.25` **when** `method` **is** `High-Freq`
  3. `multiply` `1.25` **when** `method` **is** `Low-emission`
  4. `multiply` line field `metres`

**`cutting-mm` (NEW table)** - saw cuts by the millimetre, for Tracksaw and Flush-cut. Keys
`Equipment`, `Elevation`. Rows: Tracksaw Floor `$18.00`, Tracksaw Wall `$19.80`, Flush-cut Floor
`$18.00`, Flush-cut Wall `$19.80`. `lineFields`: `depthMm` (number), `metres` (number), `method`
(text).

- `chargeSteps`: `start` rate column -> `multiply` line field `depthMm` -> `divide` `25` ->
  `floor` `18` -> `multiply` `1.25` when `method` is `High-Freq` -> `multiply` line field `metres`.
- This is the D2 stretch, exactly: 25 mm gives `$18.00`, 80 mm gives `$57.60`.
- **Keep the slug `cutting` for the band table.** The mock-up calls the two tables *by depth band*
  and *by the millimetre*; renaming the live slug would break every stored reference for no
  behavioural gain, so only the new table gets a new slug.

**`core-hole`** - keys `Diameter`. `lineFields`: `depthMm` (number), `elevation` (text),
`holes` (number). `chargeSteps`: `start` line field `depthMm` -> `divide` `10` -> `round` nearest
`1` -> `floor` `1` -> `multiply` rate column -> `multiply` `1.1` when `elevation` is `Wall` ->
`multiply` `2` when `elevation` is `Inverted` -> `multiply` line field `holes`. Those two factors are
today's `ELEVATION_MULTIPLIER` Wall and Inverted, unchanged - on this table elevation is a line
field, not a key, so the premium stays a step.

**Out of scope:** the mock-up's fourth table, *Cutting - other rates* (establishment fee, wet vacuum,
GPR scanning and the rest). Do not create it here.

**If rate-table content in this environment does not ship by seed**, stop and say
`NO-OP: cutting rate content is not seeded here` with what you found. Do **not** write a data
migration to do it instead.

### 4. The lock keeps the formula - `tender-rate-set.service.ts` + schema

- `schema.prisma`: `chargeStepsSnapshot Json? @map("charge_steps_snapshot")` on `TenderRateSet`.
  **One migration file, purely additive, no `UPDATE` anywhere in it.** Existing locks keep `null`,
  which is correct and true: no formula was in force when they were taken.
- At lock (`:33`), for each rate-table slug the set covers that has steps, write
  `{ [slug]: { chargeSteps, lineFields, columns: [{ name, role }] } }` - enough for the evaluator to
  rebuild the values map without reading the live table.
- Unlock (`:145-152`) already deletes the set, so the copy goes with it. An unlocked tender prices
  live, exactly as it does now. Re-locking takes the current formula. No new lifecycle.
- Regenerate `docs/data-model/` (`node scripts/data-model/build-relationship-map.mjs`).

### 5. The harness keeps its job

`charge-step-parity.service.ts` keeps its `Promise<void>` signature and its four fire-and-forget call
sites. It still watches every table that steps do **not** price. It only changes by calling the
shared loader instead of owning a private copy.

### 6. Tests

- **`cutting-step-equivalence.spec.ts` (NEW)** - the gate on the whole slice, and what replaces the
  production soak. Pin the pre-change arithmetic as a local function inside the spec, constants
  inlined, then for **every seeded combination** - each equipment x elevation x material x every
  seeded depth, both Tracksaw cases (25 mm floor row, 80 mm scaled), a High-Freq and a Low-emission
  saw cut, and a Wall and an Inverted core hole - assert old path and step path agree **to the cent**.
  Ringsaw Wall 175 mm must come out `$78.43` both ways, and Tracksaw Wall `$19.80` both ways.
- **`charge-step-pricing.service.spec.ts` (NEW)** - steps read from the live table with no
  `tenderId`; from the embedded copy when the tender is locked; `null` when the table has no steps;
  a step issue yields `null` and never a number.
- **`tender-rate-lock-formula.spec.ts` (NEW)** - lock a tender, change the formula in the catalogue,
  re-read the price: **the number holds**. Unlock, re-lock, re-read: the new formula applies.
- **`cutting-rate-corrections.spec.ts` (EDIT)** - D2 and D4 assertions keep their exact figures and
  now pass through the step path.
- `scope-redesign-rate-resolver.spec.ts`, `charge-step-parity.service.spec.ts` and
  `rate-step-evaluator.spec.ts` keep passing untouched.

## Do NOT

- Do NOT add a `Wall uplift` column, or any other column that carries a loading. A loading is either
  a priced row or a conditional step - the mock-up says so and this slice is built that way.
- Do NOT edit `packages/config/src/charge-step-semantics.ts`. No new operators, no list of
  conditions, no column-valued `floor` or `cap`. If a rule cannot be expressed in today's grammar,
  say `NO-OP: <the rule>` and stop.
- Do NOT remove `sanitiseSawElevation`, `METHODS_BY_EQUIPMENT` or the categorical collapse. They are
  S6's, with the screen that offers the combinations.
- Do NOT remove or rewrite an existing seeded rate row, and do NOT rename the `cutting` slug.
- Do NOT give `checkParity` a return value, and do NOT delete the harness.
- Do NOT put steps on any table other than `cutting`, `cutting-mm` and `core-hole`.
- Do NOT put an `UPDATE` in the migration, and do NOT edit a migration that is already applied.
- Do NOT change what `resolveCuttingRate` or `resolveCoreHoleRate` return.
- Do NOT touch the web app, `tokens.css`, or `/sot/`.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- cutting-step-equivalence charge-step-pricing cutting-rate-corrections scope-redesign-rate-resolver charge-step-parity rate-step-evaluator tender-rate-lock-formula
pnpm build && pnpm lint
grep -n "ELEVATION_MULTIPLIER\|METHOD_MULTIPLIER\|perMmRate" apps/api/src/modules/tendering/scope-redesign.service.ts   # must be empty
grep -n "Wall uplift\|wallUplift" apps/api/ -r                                                                          # must be empty
grep -c "UPDATE" apps/api/prisma/migrations/*charge_steps_snapshot*/migration.sql                                       # 0
git diff --stat origin/main -- packages/config/src/charge-step-semantics.ts                                             # must be empty
grep -n "Promise<void>" apps/api/src/modules/rates/charge-step-parity.service.ts                                        # still there
node scripts/data-model/build-relationship-map.mjs --check
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote the migration SQL, the full output of the
equivalence spec, the D2 and D4 assertions before and after, and the seeded step lists for `cutting`,
`cutting-mm` and `core-hole`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- `escalates: true` - this slice changes how a price is produced and adds a column to the tender
  rate lock. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Fifth of
the `scopecards` chain; dispatches once `QUOTE_PUSH_PANEL_V1` (S4b) is on `main`. S6 and S7 are
authored once `CHARGE_STEPS_PRICE_CUTTING_V1` is on `main`.
