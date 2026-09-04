---
premise: '! grep -q "CHARGE_STEP_PARITY_V1" apps/api/src/modules/rates/rate-step-evaluator.ts'
premise_means: >-
  The charge-step preview in the admin editor and the server evaluator do not agree about the same
  stored rule. Conditions are compared with a string fallback on the client and strictly on the
  server, so a condition can match in the preview and never match on the server. Where an operand is
  missing, non-numeric, or zero, the client silently treats the step as a no-op while the server
  either resolves the operand to 0 or throws. The editor can therefore show a price the server would
  not produce, and nothing tells the person who typed the rule which of the two numbers is real.
scope:
  - packages/config/src/charge-step-semantics.ts
  - packages/config/package.json
  - apps/api/src/modules/rates/rate-step-evaluator.ts
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "CHARGE_STEP_PARITY_V1" apps/api/src/modules/rates/rate-step-evaluator.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: charge-steps-correctness
cluster_order: 1
rollback_strategy: >-
  One new shared module in packages/config plus its two call sites and their specs. No API route, no
  DTO, no schema, no migration, no new dependency. Nothing in the pricing path reads chargeSteps
  today, so a revert restores exactly the behaviour on main and cannot move a tender total.
---

# The preview and the evaluator disagree about the same stored rule

First slice of the charge-steps correctness cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Measured 2026-09-04 against `origin/main`, mock-up compared against both shipped evaluators line by
line.

**Read this first, because it explains why none of the below has been reported as a bug.**
`chargeSteps` is stored, validated and previewed, and is never priced against anything.
`evaluateSteps` (`apps/api/src/modules/rates/rate-step-evaluator.ts:237`) has exactly two references
in the repo: its own definition and `apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts`.
`RateResolverService` never reads `chargeSteps` - grep the repo for the field and the only hits are
`ChargeStepsEditor.tsx`, `RatesListsAdminPage.tsx`, `rate-tables.service.ts` and `rates.controller.ts`.
This slice hardens a path that does not yet run in production. Wiring the evaluator into rate
resolution is Marco's call and is not in this cluster - see Do NOT.

## What to build

**1. One comparison rule, defined once, used by both sides.** The two implementations differ three
ways today:

- Mock-up: string comparison ignoring case.
- Client, `checkCondition` in `ChargeStepsEditor.tsx:279`:
  `case "is": return lhs === rhs || String(lhs) === String(rhs);`
- Server, `evaluateCondition` in `rate-step-evaluator.ts:176`: `return lhs === rhs;` - strict, with
  no coercion at all.

Two consequences, both real:

- `Elevation is "inverted"` against a cell holding `Inverted` matches in the mock-up and matches in
  neither shipped path. Both are case-sensitive.
- A value the editor stored as a number against a cell the preview holds as a string matches in the
  preview and **never** on the server. This is reachable through the shipped UI today: the scenario
  map at `ChargeStepsEditor.tsx:355-362` coerces every non-number cell with `String(raw)`, while
  `AddStepForm` at `ChargeStepsEditor.tsx:763` stores a numeric-looking condition value as
  `Number(condValue)`. Put `150` in a TEXT column, write the condition `is 150`, and the preview
  applies the step while the server skips it. **The preview can show a price the server would not
  produce.**

Define the rule once and have both sides call it. `packages/config` is the only package both apps
already depend on, and there is an exact precedent for this: `evaluateCondition` /
`evaluateConditionGroup` in `packages/config/src/forms-rule-definition.ts` exist so the form rules
engine cannot drift between client and server, and that file writes its chosen semantics down in a
comment at the definition ("Equality is loose (==) by design so '5' == 5 holds"). Do the same
here. Add `packages/config/src/charge-step-semantics.ts`, export it as a subpath in
`packages/config/package.json` exactly as `./forms-rule-definition` is exported, and have
`rate-step-evaluator.ts` and `ChargeStepsEditor.tsx` both import it.

You are choosing the semantics, so state them in the module header in one sentence and make the
choice consistent for `is` and `is not` together. The mock-up asks for case-insensitive string
comparison; `>` `<` `>=` `<=` already agree on both sides (both coerce with `Number`) and must keep
behaving as they do.

**2. One error taxonomy, defined once, and surfaced in the editor.** Three cases, each handled a
different way on each side today:

| case | mock-up | client | server |
| --- | --- | --- | --- |
| operand field has no value in the previewed row | hard error naming the step | `resolveNum` returns `null` (`:265`) and the step becomes a no-op (`:220-221`) | `resolveNumeric` resolves `undefined` to `0` (`:153-154`) |
| text in an arithmetic slot | targeted message: "Text belongs in the 'only when' part of a step, not in the sum." | `Number(val)` is `NaN`, so `null`: `start` sets the running total to 0 (`:216`), every other op is a no-op | throws `StepArithmeticTypeError` (`:155-157`) |
| divide by zero | error | silently skipped (`:226`) | throws `divide by zero at step i` (`:282`) |

Give the two sides the same taxonomy, returned rather than guessed at, and render it in the editor
against the step it belongs to. The mock-up's message for the text case is quoted above; use it.

The first row of that table is the one to test hardest. Remove a column that a `multiply` step
names and the preview keeps printing a running total computed as if that step multiplied by 1, while
the server would multiply by 0. The editor is not silent - `validateSteps` (`:177-179`) does flag
`Field "X" is not a column on this table.` and the row is tinted at `:588-594` - but the number
beside the step at `:632-645` is still rendered as a plausible figure, so the editor's own number
and the editor's own error line contradict each other. An unresolvable step must not print a
running total that looks like an answer.

Mark `apps/api/src/modules/rates/rate-step-evaluator.ts` with `CHARGE_STEP_PARITY_V1`.

## Do NOT

These four are Marco's decisions, not this cluster's work. Do not helpfully build one.

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path. This
  slice makes the two evaluators agree; whether a stored step list is allowed to price a tender line
  is a separate decision that has not been made.
- **Do not add "line fields."** The mock-up implies estimator-entered operands such as Depth and
  Holes. The data model has no such thing - a step operand is a rate-table column name or a numeric
  literal, and nothing else. Do not invent a place to type one.
- **Do not turn the read-only step sentences into in-place editing.** `stepSentence` output stays
  read-only text in this cluster.
- **Do not let `floor` or `cap` take a field.** `FloorStep` and `CapStep` carry `value: number` and
  keep carrying a literal.
- Do not touch `/sot/`, the rates list columns card, the rows table, or any file outside `scope:`.
- Do not add, change or remove an API route, controller, DTO or schema field. The PATCH route at
  `ChargeStepsEditor.tsx:412` and its validation in `rate-tables.service.ts` stay as they are.

## Verification

- [ ] `pnpm --filter @project-ops/api test` and `pnpm --filter @project-ops/web test` both green.
- [ ] Name the file the shared comparison rule lives in and quote the one sentence that states its
      semantics. Say how many places now implement `is` / `is not` (must be 1).
- [ ] Worked example, both sides, same input: TEXT column `Grade` holding `150`, condition
      `Grade is 150`. Give the preview total and the server total before the change (they differ)
      and after (they match). State both numbers each time.
- [ ] Worked example for case: cell `Inverted`, condition `is "inverted"`. State the before and
      after result on each side and say which semantics you chose.
- [ ] Worked example for the missing operand: steps `start Depth`, `multiply Holes` with `Holes`
      absent from the row. State the preview figure and the server figure before (they differ) and
      after. The editor must no longer print a running total for that step.
- [ ] Divide by zero and text-in-arithmetic each produce the same named error on both sides. Quote
      the two messages and say which step index each names.
- [ ] Report the reference count for `evaluateSteps` after the change and confirm no new caller in
      any pricing path was added.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco. It is
`true` here because this slice changes what a stored rule evaluates to.
