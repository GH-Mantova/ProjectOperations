---
premise: '! grep -q "RATE_FIELDS_TABLE_V2" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
premise_means: >-
  The card that lists a rate table's fields answers none of the three questions a person editing a
  charge rule actually has. Its header is Name / Role / Type / Unit-or-list / Req?
  (RatesListsAdminPage.tsx:1240-1245): it does not say whether a field comes off the rate table or
  off the estimate line, it does not say which steps use the field, and its Type column prints the
  raw storage enum - TEXT, NUMBER, CURRENCY, DATE, BOOL, LIST_REF - at :1255. Because nothing shows
  which steps depend on a column, deleting one succeeds (deleteColumn, rate-tables.service.ts:214-245,
  refuses only when the table still has rows) and the damage surfaces later as a server 400 on the
  next charge-steps save.
scope:
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "RATE_FIELDS_TABLE_V2" apps/web/src/pages/admin/RatesListsAdminPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: line-fields
cluster_order: 3
requires_on_main: 'apps/web/src/pages/admin/ChargeStepsEditor.tsx :: CHARGE_STEP_INPLACE_V1'
rollback_strategy: >-
  Web-only: one card's header and cells, two pure helpers with their spec, and one callback prop on
  the charge-steps editor. No API, no schema, no migration, no new dependency. Nothing about how a
  field is stored changes - only what the card prints about it. Revert and the card renders
  Name / Role / Type / Unit-or-list / Req? exactly as it does today.
---

# The Fields table does not say where a field comes from, or which steps use it

Third slice of the line-fields cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Marco ruled on 2026-09-04, on the four decisions behind package 9, that charge steps price against
estimator-entered values as well as stored columns, and that the mock-up - including its `From`
distinction between *the rate table* and *the estimate line* - is the specification. Slice 1 put
line fields in the model; slice 2 made a step name one. This slice is the card that lists them, and
it is the first place in the product where the `From` distinction is written down for a reader.

Measured 2026-09-04 against `origin/main`. Same standing note as the rest of the cluster:
`chargeSteps` is stored, validated and previewed and is never priced against anything -
`evaluateSteps` has two references in the repo, its own definition and its unit spec, and
`RateResolverService` never reads the field.

## What to build

**1. The mock-up's header, in the mock-up's order: `Field | From | Kind | Unit | Used in`.** Today
the header is `Name | Role | Type | Unit / list | Req?` plus the unlabelled action column
(`RatesListsAdminPage.tsx:1240-1246`). Keep the action column. Two columns go:

- **Role.** `RoleBadge` (`:1378-1386`) has exactly one call site, the cell at `:1253`. Remove both -
  KEY / VALUE / INFO is still stored, still set by the add-column form, and still what slice 4 reads
  to find the key columns. The mock-up does not show it here.
- **Req?** (`:1244`, `:1259`). `required` is untouched in the data and still enforced by
  `validateRowCells` (`ratesListsHelpers.ts:115`). Display only.

**2. `From` - the distinction the ruling names.** A rate-table column prints **the rate table**; a
line field prints **the estimate line**. Those are the mock-up's exact words; use them. Line fields
list under the same table as columns, so this column is the only thing telling a reader that one of
these rows is filled in on the estimate and the other is looked up.

**3. `Kind` - number and text, not storage enums.** The cell at `:1255` prints `c.dataType` raw.
Put the mapping in `ratesListsHelpers.ts` as one exported function beside the other pure helpers,
and export a `RateColumnDataType` -> label map that covers all six members of the enum declared at
`ratesListsHelpers.ts:9`:

- `NUMBER`, `CURRENCY` -> `number`
- `TEXT`, `LIST_REF` -> `text`
- `DATE` -> `date`
- `BOOL` -> `yes / no`

The mock-up shows only `number` and `text` because none of its four tables has a DATE or BOOL
column. Do not force those two into a kind they are not. A line field prints its own `kind`
directly, which is already `number` or `text`.

**The same function decides which fields the operand picker offers as an arithmetic operand:**
number-kind only. That is why `ChargeStepsEditor.tsx` is in `scope` - point
`numericFieldOptions` (`ChargeStepsEditor.tsx:50-52`) at the shared helper so the card's label and
the picker's contents cannot disagree about what counts as a number.

**4. `Used in` - the column that stops the deletion.** Scan the step list and print the step numbers
that name the field, one-based and comma-joined, exactly as the mock-up does: `step 1, 5`; `-` when
nothing uses it. Count **both** places a name can appear: the arithmetic operand (`field`) and the
condition field (`when.field`) - the mock-up counts both, and the server rejects both
(`rate-tables.service.ts:402-406` and `:440-444`).

Then use it: **deleting a field whose `Used in` is non-empty must be warned about in the table,
naming the steps.** Today `handleDeleteColumn` deletes without a question, the server allows it
(`deleteColumn`, `rate-tables.service.ts:214-245`, refuses only when the table still has rows), and
the first anyone hears of it is `Step i (op: x): field "Y" is not a column on this table.` the next
time the charge steps are saved. Put the warning where the person is standing.

**5. Wiring: the card needs the step list, and there must be one copy of it.** The steps live inside
`ChargeStepsEditor`, loaded by its own GET at `:327`. `ColumnsCard` is a sibling
(`RatesListsAdminPage.tsx:1140` and `:1142`) and has no access to them. Add an `onStepsChange`
callback prop to `ChargeStepsEditor`, called once after load and again after every mutation, and
hold the list in the detail component to pass down to the card.

**Do not issue a second GET for the same step list.** Two fetches means two copies, and a `Used in`
column computed from a stale copy is worse than no column at all. Fire the callback from `load`
(`:323-338`) and from `updateSteps` (`:381-384`), not from a render-time effect.

Mark `apps/web/src/pages/admin/RatesListsAdminPage.tsx` with `RATE_FIELDS_TABLE_V2`.

## Do NOT

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path. That
  is Decision 2, it is parity-gated, and it has not been made.
- **Do not change what any step evaluates to,** and do not touch the step row UI that
  `CHARGE_STEP_INPLACE_V1` built. The only edits permitted in `ChargeStepsEditor.tsx` are the
  `onStepsChange` prop and pointing `numericFieldOptions` at the shared kind helper.
- **Do not build the scenario picker.** The cascading key dropdowns, the line-field inputs and the
  highlighted row in the rows table are slice 4. The scenario select keeps its `Row {i+1}` options
  in this slice, and the rows table is not touched.
- **Do not block a deletion that the server allows.** `Used in` warns and names the steps; it does
  not invent a new refusal rule. Changing what the server permits is an API slice, not this one.
- **Do not add, change or remove an API route, controller, DTO or schema field.** No new GET, no
  widened response.
- Do not touch `/sot/`, the add-column form's payload, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Quote the rendered header row before and after, in order. Before:
      `Name | Role | Type | Unit / list | Req?`. After: `Field | From | Kind | Unit | Used in`.
      Confirm `RoleBadge` has zero references after the change.
- [ ] `From`: with one column and one line field on a table, quote both cells. They must read
      `the rate table` and `the estimate line`.
- [ ] `Kind`: give the printed label for all six enum members and for a `number` and a `text` line
      field - eight rows, before and after. State that the operand picker and this column now read
      the same function, and name it.
- [ ] `Used in`: build the mock-up's `Core holes` rule (start `Depth`, divide 10, round, never less
      than 1, multiply `Rate`, multiply 2 only when `Elevation` is `Inverted`, multiply `Holes`) and
      quote the `Used in` cell for `Depth`, `Rate`, `Elevation`, `Holes` and `Diameter`. `Elevation`
      must be listed against the step that carries the condition, and `Diameter` must read `-`.
- [ ] Deletion warning: delete `Rate` while a step uses it, quote the warning, and confirm it names
      the step number. Then say what happens on `origin/main` today for the same action, and quote
      the 400 that eventually surfaces.
- [ ] One copy of the step list: state the number of GET requests to
      `/rates/tables/:id/charge-steps` made when the detail page renders (must be 1), and confirm
      `Used in` updates when a step is edited without a save or a reload.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
