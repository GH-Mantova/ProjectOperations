---
premise: '! grep -q "CHARGE_STEP_CARD_V2" apps/web/src/pages/admin/ChargeStepsEditor.tsx'
premise_means: >-
  The charge-steps card never shows the one number it exists to produce. The step list ends and the
  add-step form begins, with no line total between them. The running totals beside each step are
  printed to four decimal places, carry no unit, and are never money-formatted even after a currency
  column has entered the sum. The operation and comparator menus render raw storage keys, and the
  round wording contradicts itself while the formula disclosure emits tokens no spreadsheet accepts.
scope:
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "CHARGE_STEP_CARD_V2" apps/web/src/pages/admin/ChargeStepsEditor.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: charge-steps-correctness
cluster_order: 2
requires_on_main: 'apps/api/src/modules/rates/rate-step-evaluator.ts :: CHARGE_STEP_PARITY_V1'
rollback_strategy: >-
  Web-only. One component, one prop widened at its mount point, one test file. No API, no schema, no
  migration, no new dependency. Every change is presentation: what the card renders, not what it
  computes. Revert and the card reads exactly as it does today.
---

# The step card does not show the number it exists to produce

Second slice of the charge-steps correctness cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Measured 2026-09-04 against `origin/main`, mock-up compared against the shipped card element by
element. Slice 1 made the preview and the server agree on what a step evaluates to; this slice is
about what the card puts on screen. It changes no arithmetic.

Same standing note as slice 1: `chargeSteps` is stored, validated and previewed but never priced
against anything - `evaluateSteps` has two references in the repo, its own definition and its unit
spec, and `RateResolverService` never reads the field. This slice is hardening a path that does not
yet run in production, which is why none of the below has surfaced as a bug report.

## What to build

**1. Close the list with a line total.** The mock-up ends the step list with a money-formatted LINE
TOTAL row. The shipped card has none: the `<ol>` closes at `ChargeStepsEditor.tsx:660` and the
add-step form begins at `:664` with nothing between them. The final running total exists in memory
(the last entry of `trail`, computed at `:367-370`) and is never given a home of its own. Put it
where the mock-up puts it, labelled as the mock-up labels it, and read it from the trail the card
already computes rather than summing a second time.

**2. Make a running total say what it is.** Three separate faults in `formatTotal`
(`ChargeStepsEditor.tsx:1036-1040`), whose own comment reads "Plain measurement - no $ sign, to
nearest 4dp":

- It prints to four decimal places. The mock-up prints two.
- It carries no unit. The mock-up shows `18 mm` beside step 1 where the operand column is measured
  in millimetres; the card shows `18`.
- It is never money-formatted, even after a currency column has entered the sum.

The mock-up's rule is not "add a dollar sign". It is: *a running total is only money once a price
has entered it - before that it is still a measurement, and showing it as dollars misleads.*
Implement that rule. A column's `dataType` already distinguishes `CURRENCY` from `NUMBER` (the
option is offered at `RatesListsAdminPage.tsx:1311`), so the card can tell when a currency operand
has entered the running total and switch presentation from that step onward.

Two things the card needs and does not have. `RateColumnMeta` (`ChargeStepsEditor.tsx:42-47`) has no
`unit`, and the mount point at `RatesListsAdminPage.tsx:1146` passes only `id`, `name`, `dataType`
and `role` - even though `RateColumn` carries `unit?: string` (`:893`). Widen both. That one-line
prop change is the ONLY edit permitted in `RatesListsAdminPage.tsx` (see Do NOT).

Do not invent a second money format. `renderCellDisplay` at `RatesListsAdminPage.tsx:1650-1663`
already formats currency with `Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })`
and already appends a unit to a plain number. Match it, so the card and the rows table below it
never disagree about what a dollar looks like.

**3. Stop printing storage keys in the menus.** Both `<option>` lists render raw keys today:
`KNOWN_OPS` at `:819-821` gives `start, multiply, divide, add, subtract, round, floor, cap`, and
`CONDITION_CMPS` at `:964` gives `is, is not, >, <, >=, <=`. The mock-up reads:

- operations: Start with / Multiply by / Divide by / Add / Subtract / Round / Never less than /
  Never more than
- comparators: is / is not / is more than / is less than / is at least / is at most

Label only. The stored `op` and `cmp` values are unchanged, and the option `value` attributes stay
the keys.

**4. Fix the round wording and the formula.** `stepSentence` at `:74` renders
`Round ${step.direction} to nearest ${step.interval}`, which produces the self-contradictory
"Round up to nearest 10". The mock-up is directional: "to the nearest" for `nearest`, "up to the
next" for `up`, "down to the last" for `down`.

The formula disclosure has the same problem in a worse place. Its whole point is that an estimator
can read the rule as arithmetic, and the mock-up's is pasteable into a spreadsheet. The shipped one
is not: `:133` emits `[round up to 10]`, `:136-140` emits `max(` with a placeholder dot, and
`:143-147` emits `min(` the same way. None of those are functions. Emit real `ROUND`, `ROUNDUP`,
`ROUNDDOWN`, and real `MAX` / `MIN`. `IF(...)` is already emitted correctly for conditions at
`:107`, `:114`, `:121` and `:128` - keep that shape and make the rest match it.

Mark `apps/web/src/pages/admin/ChargeStepsEditor.tsx` with `CHARGE_STEP_CARD_V2`.

## Do NOT

These four are Marco's decisions, not this cluster's work. Do not helpfully build one.

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path.
- **Do not add "line fields."** The mock-up implies estimator-entered operands such as Depth and
  Holes. The data model has no such thing - a step operand is a rate-table column name or a numeric
  literal. Do not add a place to type one.
- **Do not turn the read-only step sentences into in-place editing.** The sentences stay read-only
  text; editing a step is still remove-and-re-add in this cluster.
- **Do not let `floor` or `cap` take a field.** They keep their literal `value: number`, and the
  new "Never less than" / "Never more than" labels change nothing about that.
- **Do not change what any step evaluates to.** This slice is presentation. `evaluateStepsClient`,
  `checkCondition`, `resolveNum` and the shared comparison rule from slice 1 are untouched. If a
  number on screen changes, it changes only by rounding or formatting, and you say so in the PR.
- **Do not touch the rates list columns card, the rows table, or any other part of
  `RatesListsAdminPage.tsx`.** The only permitted edit in that file is widening the props object at
  `:1146` to pass `unit` through.
- Do not touch `/sot/`, the API, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] The line total renders. Give the step list you used, the per-step running totals, and the line
      total, and confirm it equals the last trail entry rather than a second sum.
- [ ] Decimal places: state the figure before and after for one non-integer total (for example
      `18.3333` becomes `18.33`).
- [ ] Unit: with a millimetre column as step 1's operand, quote what the card printed before and
      after (`18` becomes `18 mm`).
- [ ] The money rule: give a four-step list where a `CURRENCY` column enters at step 3, and quote
      all four running totals. Steps 1 and 2 must be measurements, steps 3 and 4 must be money.
      State which step flipped it.
- [ ] Menus: quote the full rendered option text of both menus, and confirm the stored `op` and
      `cmp` values are unchanged by showing one saved step's JSON.
- [ ] Round wording: quote the sentence produced for each of the three directions.
- [ ] Formula: paste the emitted formula for a list containing a round, a floor and a cap, and
      confirm every token is a real spreadsheet function.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
