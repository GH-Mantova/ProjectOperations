---
premise: '! grep -q "CHARGE_STEP_INPLACE_V1" apps/web/src/pages/admin/ChargeStepsEditor.tsx'
premise_means: >-
  A saved step cannot be edited. The step list renders read-only sentences built by stepSentence
  (ChargeStepsEditor.tsx:60-84, rendered at :620-629), and the only way to change a rule is the
  separate add-step form below it (AddStepForm, :708-994), which appends to the end of the list
  (addStep, :404-406). Changing the operand of step 2 of a five-step rule therefore means removing
  steps 2 to 5 and typing four of them again in order, and the first thing removed is the step
  being corrected. There is also now a second class of operand to choose from - line fields - and
  no single control that offers both.
scope:
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "CHARGE_STEP_INPLACE_V1" apps/web/src/pages/admin/ChargeStepsEditor.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: line-fields
cluster_order: 2
requires_on_main: 'apps/api/src/modules/rates/rate-tables.service.ts :: RATE_LINE_FIELDS_V1'
rollback_strategy: >-
  Web-only, one component plus its test. No API, no schema, no migration, no new dependency. The
  stored step JSON is unchanged in shape - this slice changes how a step is edited, not what a step
  is. Revert and the card renders read-only sentences with the add-step form below them, exactly as
  it does today.
---

# Every step is editable where it sits, and there is one place to pick an operand

Second slice of the line-fields cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Marco ruled on 2026-09-04, on the four decisions behind package 9, that in-place step editing gets
built (Decision 3: build it), as its own slice AFTER the model change - not folded into it, because
a PR carrying both a schema change and an editor rebuild sits unreviewed. The reason it is worth
building is **correctness, not convenience**: Marco edits a rule perhaps three times a year, and on
those three occasions the only path is destroy-and-retype, which is exactly the condition under
which finding 9.4.7 bites.

Slice 1 put line fields in the model and made the server accept a step that names one. This slice
builds the control that lets someone choose one, and the row that lets them change their mind.

Measured 2026-09-04 against `origin/main`. Same standing note as the rest of the cluster:
`chargeSteps` is stored, validated and previewed and is never priced against anything -
`evaluateSteps` has two references in the repo, its own definition and its unit spec, and
`RateResolverService` never reads the field.

## What to build

**1. The step row IS the editor.** The mock-up's step is a four-part grid - number, body, running
total, actions - and the body holds live controls, not a sentence. Replace the read-only sentence at
`ChargeStepsEditor.tsx:620-629` with:

- an **operation select** carrying the eight known ops,
- an **operand control** (item 2),
- for `round`, the direction select and the interval input the add-form already has
  (`:875-905`),
- for `floor` and `cap`, the literal value input the add-form already has (`:908-921`),
- the **condition pill** (item 3).

The running total beside the step and the up / down / remove controls keep their positions. Every
control writes straight into the step at that index and marks the list dirty through the existing
`updateSteps` (`:381-384`), so Save behaves exactly as it does now.

`AddStepForm` stops being the way to change a rule. What remains is a single **+ Add a step**
button that appends one step in the same editable shape the rows already use - the mock-up's
`#addstep`. Do not keep a parallel form with its own copy of the operand and condition controls;
one implementation of each control, used by every row.

**2. ONE operand picker, offering both kinds of field and showing which is which.** After slice 1
there are two sources of operand - a rate-table column and an estimate line field - and the mock-up
never gives them two controls. It gives one select listing every field with its unit, plus a final
`a number...` option that reveals a numeric input. The `From` distinction the mock-up draws in its
Fields table - *the rate table* versus *the estimate line* - must be legible in the picker: group
the options so the two sources are separable and labelled, and keep the labels consistent with the
words the mock-up uses.

Build it as one component in this file and use it in the row for every arithmetic operand. It
replaces the three-control arrangement the add-form uses today (Mode select at `:828-840`, Column
select at `:841-857`, Value input at `:858-870`). Arithmetic operands offer number-kind fields only;
condition fields offer both kinds - the rule slice 1 put on the server, and the rule
`numericFieldOptions` / `allFieldOptions` (`:50-57`) already encode on the client.

**3. The condition is a pill on the row.** The mock-up renders `only when <field> <comparator>
<value>` inline with a remove control, and offers `+ only when...` on a step that has none. Build
that. The comparator select and the value control come from the add-form's condition block
(`:938-978`); where the chosen condition field is a text field with a declared option list, the
value control is a select over those options rather than a free-text input - the mock-up does this,
and it is the difference between `Inverted` matching and `inverted` being typed by hand.

**4. Absorb the step-one guards; do not build a second copy of them.** `pr-chargesteps-s3-step-one-is-pinned`
is in the queue at `docs/pr-prompts/pr-chargesteps-s3-step-one-is-pinned-HOLD.md`, its sentinel is
`CHARGE_STEP_GUARDS_V1`, and it targets this same file. **Read it in full before you start.** It
specifies three guards:

- the op is coerced to `start` when a step is reordered into slot 0 (`moveUp` / `moveDown`,
  `:386-398`, swap and nothing else today),
- step 1 renders no remove control and `removeStep` (`:400-402`) refuses index 0,
- `start` is not offerable once the list is non-empty (`AddStepForm` defaults `op` to `"start"` at
  `:717` and offers it unconditionally at `:819-821`).

In a row-editable list all three are expressible in the controls themselves, which is how the
mock-up does it: `start` is disabled in the operation menu for every index above 0, every non-start
op is disabled at index 0, and the remove control at index 0 is replaced by a spacer.

Two cases, and you must say in the PR body which one you found:

- **`CHARGE_STEP_GUARDS_V1` is already in the file** - keep those guards' behaviour and re-express
  it through the new controls. Do not leave an add-form guard and a row guard side by side.
- **It is not** - implement all three here, to the behaviour that prompt specifies.

Either way there must be exactly one implementation of each guard when you are done, and the
outcome must be the same: no reachable path through the UI produces
`Step 1: First step must have op "start".`

Mark `apps/web/src/pages/admin/ChargeStepsEditor.tsx` with `CHARGE_STEP_INPLACE_V1`.

## Do NOT

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path. That
  is Decision 2, it is parity-gated, and it has not been made.
- **Do not change what any step evaluates to.** `evaluateStepsClient`, the shared comparison rule
  from `CHARGE_STEP_PARITY_V1` and the shared values-map builder from `RATE_LINE_FIELDS_V1` are
  untouched. This slice changes how a step is entered, not what it computes. If a number on screen
  changes, it changes only because the step changed, and you say so in the PR.
- **Do not relax either validation rule.** `validateSteps` (`:157-193`) and the 400s in
  `rate-tables.service.ts` stay exactly as they are. Making a bad state unreachable is the job;
  starting to accept it is not.
- **Do not let `floor` or `cap` take a field.** They keep their literal `value: number`, and the
  one operand picker is not offered for them.
- **Do not build the Fields table** with `From`, `Kind` and `Used in` - that is slice 3 - and **do
  not build the scenario picker** with cascading key dropdowns, line-field inputs or the
  highlighted row - that is slice 4. The scenario select at `:513-536` keeps its `Row {i+1}`
  options in this slice.
- **Do not add, change or remove an API route, controller, DTO or schema field.** The PATCH at
  `:412` sends the same body shape it sends today.
- Do not touch `/sot/`, `RatesListsAdminPage.tsx`, the rows table, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Editing in place: take the list `1 Start with Depth, 2 Multiply by Holes, 3 Add Fee` and
      change step 2's operand to `Rate`. State the number of controls touched before this slice and
      after (before: remove 2 steps and re-enter 2; after: one select), and quote the three
      sentences that result.
- [ ] The operand picker: quote its full rendered option list for a table with two columns and two
      line fields, and say how a reader tells a rate-table field from an estimate-line field. State
      how many operand pickers exist in the file (must be 1).
- [ ] Arithmetic operands offer number-kind fields only: name a text field on the table and confirm
      it is absent from the operand picker and present in the condition field picker.
- [ ] Condition pill: add `only when Elevation is Inverted` to step 2 in place, quote the resulting
      step JSON, and confirm the value control was a select over the declared options rather than a
      free-text input.
- [ ] Guards, and say which case you found. Quote the operation menu's options at index 0 and at
      index 2. State the number of remove controls rendered for a three-step list (must be 2) and
      name the step that has none. Move step 2 to the top and state the resulting op of step 1,
      whether the red panel appeared, and whether Save stayed enabled - all three must hold
      together. State the number of implementations of each guard (must be 1 each).
- [ ] State the number of ways left to reach `Step 1: First step must have op "start".` through the
      UI. It must be zero, and say how you established that.
- [ ] Re-enter the mock-up's `Core holes` rule, then edit step 5's operand in place from `Rate` to a
      number and back. State the line total after each edit; it must return to `81.60`.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
