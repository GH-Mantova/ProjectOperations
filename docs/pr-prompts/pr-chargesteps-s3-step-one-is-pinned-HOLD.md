---
premise: '! grep -q "CHARGE_STEP_GUARDS_V1" apps/web/src/pages/admin/ChargeStepsEditor.tsx'
premise_means: >-
  The step list can be moved into a state that cannot be saved and, in one case, cannot be undone.
  Reorder and remove act blindly on any index, and the add-step form defaults to another "start", so
  nothing stops a person putting a "Multiply by" in slot 1 or taking step 1 out altogether. Either
  one turns the whole card red and disables Save; the second is only recoverable by clearing the
  list and typing every step again, because a new step is always appended to the end.
scope:
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "CHARGE_STEP_GUARDS_V1" apps/web/src/pages/admin/ChargeStepsEditor.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: charge-steps-correctness
cluster_order: 3
requires_on_main: 'apps/web/src/pages/admin/ChargeStepsEditor.tsx :: CHARGE_STEP_CARD_V2'
rollback_strategy: >-
  Web-only, one component plus its test. No API, no schema, no migration, no new dependency. The
  change is three guards on local step-list state. Revert and reorder, remove and add behave exactly
  as they do today.
---

# Step 1 is pinned, and the list cannot be walked into a state it cannot leave

Third slice of the charge-steps correctness cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Measured 2026-09-04 against `origin/main`. Slices 1 and 2 made the card compute and read correctly;
this one stops it being walked into a dead end.

Same standing note as the earlier slices: `chargeSteps` is stored, validated and previewed but never
priced against anything - `evaluateSteps` has two references in the repo, its own definition and its
unit spec, and `RateResolverService` never reads the field. This slice is hardening a path that does
not yet run in production, which is why the dead end has not been reported.

## What to build

One defect, three guards. The mock-up pins the `start` op to slot 1: it coerces the op when a step
is reordered into slot 0, and it gives step 1 no remove control. The shipped card does none of that.

**1. Coerce the op when a step arrives in slot 0.** `moveUp` and `moveDown`
(`ChargeStepsEditor.tsx:386-398`) swap two array entries and nothing else. Move a "Multiply by" to
the top and the list is instantly invalid: `validateSteps` (`:166-168`) pushes
`First step must have op "start".` at index 0, which renders as `Step 1: First step must have op
"start".` in the red panel at `:539-556`, and `canSave` (`:377`) goes false so the Save button at
`:454-462` is disabled. The API would refuse it too - `rate-tables.service.ts:390-392` throws a 400
with the same rule - but nobody gets that far, because the client will not send it. Coerce the
incoming step to `start` in slot 0, as the mock-up does, so the list stays saveable through any
reorder.

**2. Give step 1 no remove control.** `removeStep` (`:400-402`) filters by index with no guard, and
the remove button at `:648-656` is rendered for every step including the first. This is the case
that does not undo: `addStep` (`:404-406`) appends to the end of the list, so once step 1 is gone
there is no way to put a `start` back at the front. `moveUp` cannot help - there is no start step to
move. The only exit is to remove every remaining step and type the whole rule again, and even the
empty list cannot be saved (`canSave` also requires `steps.length > 0`). Render no remove control on
step 1, and guard `removeStep` against index 0 as well, so a stray call cannot do what the missing
button no longer can.

**3. Stop the second `start`.** `AddStepForm` initialises `op` to `"start"` (`:717`) and offers it
in the menu unconditionally, so the fastest way to add a step adds another `start` - and a `start`
anywhere but slot 0 is caught by nothing. `validateSteps` only checks `steps[0]`, and the server
check at `rate-tables.service.ts:390-392` is also index-0-only, so a second `start` saves cleanly
and then silently discards everything computed before it, because the `start` case assigns the
running total rather than combining with it. Once the list is non-empty, `start` is not an operation
that can be added: leave it out of the menu and default the form to the first op that can.

Mark `apps/web/src/pages/admin/ChargeStepsEditor.tsx` with `CHARGE_STEP_GUARDS_V1`.

## Do NOT

These four are Marco's decisions, not this cluster's work. Do not helpfully build one.

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path.
- **Do not add "line fields."** The mock-up implies estimator-entered operands such as Depth and
  Holes. The data model has no such thing - a step operand is a rate-table column name or a numeric
  literal. Do not add a place to type one.
- **Do not turn the read-only step sentences into in-place editing.** Fixing the dead end is not a
  licence to build the editor that would have avoided it. The sentences stay read-only text.
- **Do not let `floor` or `cap` take a field.** They keep their literal `value: number`.
- **Do not relax either validation rule.** `validateSteps` and the 400 in
  `rate-tables.service.ts:390-392` both stay exactly as they are. The fix is to stop the bad state
  being reachable, not to start accepting it.
- **Do not change what any step evaluates to,** and do not change the card's presentation - those
  were slices 1 and 2.
- Do not touch `/sot/`, the rates list columns, the API, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Reorder: with the list `1 Start with Depth, 2 Multiply by Holes, 3 Add Fee`, move step 2 to
      the top. Quote the resulting three sentences, state whether the red panel appeared, and state
      whether Save stayed enabled. All three must hold together.
- [ ] Remove: state the number of remove controls rendered for a three-step list, before and after
      (3 -> 2), and name the step that lost one.
- [ ] Call `removeStep(0)` directly in a test and state the resulting list length.
- [ ] Second start: quote the operation menu's options for an empty list and for a three-step list,
      and say which option is absent from the second and what the form now defaults to.
- [ ] State the number of ways left to reach `Step 1: First step must have op "start".` through the
      UI. It must be zero, and say how you established that.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
