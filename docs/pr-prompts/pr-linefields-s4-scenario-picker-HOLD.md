---
premise: '! grep -q "RATE_SCENARIO_PICKER_V2" apps/web/src/pages/admin/ChargeStepsEditor.tsx'
premise_means: >-
  The preview says which row it is pricing only by ordinal position. The scenario picker is a single
  select whose options are literally "Row 1", "Row 2", ... (ChargeStepsEditor.tsx:518-530), so on a
  seven-row table the person choosing has to count rows in the grid below to know which rule they
  are looking at, and there is no link between the two: scenarioRowId is local state inside
  ChargeStepsEditor (:317) and RowsCard is a sibling component mounted beside it
  (RatesListsAdminPage.tsx:1142-1168), sharing nothing. After slice 1 there is also a second half of
  the scenario - the estimate-line values - that the picker cannot set at all: it falls back to the
  sample value stored with each line field.
scope:
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/components/rates/FilterableRateGrid.tsx
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
  - apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx
done_when: pnpm build && pnpm lint && grep -q "RATE_SCENARIO_PICKER_V2" apps/web/src/pages/admin/ChargeStepsEditor.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: line-fields
cluster_order: 4
requires_on_main: 'apps/web/src/pages/admin/RatesListsAdminPage.tsx :: RATE_FIELDS_TABLE_V2'
rollback_strategy: >-
  Web-only. Two pure helpers with their spec, one lifted piece of local state, and one optional prop
  on the shared rate grid. No API, no schema, no migration, no new dependency. The added grid prop
  is optional, so the tender Rates tab that also renders the grid is unaffected. Revert and the
  picker is the Row-1..N select it is today.
---

# The preview picks a row by counting, and nothing on screen says which row it picked

Fourth and last slice of the line-fields cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Marco ruled on 2026-09-04, on the four decisions behind package 9, that the mock-up is the
specification for pricing against estimator-entered values as well as stored columns, and that all
four of its worked examples must be expressible when this cluster lands. Slices 1 to 3 built the
model, the step row and the Fields table. The last piece is the one that makes a worked example
readable: choosing a scenario the way an estimator describes one, and being shown the row it landed
on.

Measured 2026-09-04 against `origin/main`. Same standing note as the rest of the cluster:
`chargeSteps` is stored, validated and previewed and is never priced against anything -
`evaluateSteps` has two references in the repo, its own definition and its unit spec, and
`RateResolverService` never reads the field.

## What to build

**1. One dropdown per KEY column, cascading.** The mock-up's scenario bar has a select per KEY
column, and each later key offers only the values that still exist given the keys already chosen.
Put both rules in `ratesListsHelpers.ts` as pure, exported, unit-tested functions beside the
existing helpers:

- **options for a key**, given the columns, the rows and the keys chosen so far: distinct values of
  that column across rows that match every EARLIER key column, sorted numerically when both values
  parse as numbers and by locale otherwise.
- **the matched row**, given the columns, the rows and the chosen keys: the row whose every KEY cell
  equals the chosen value, compared as strings, or none.

`role === "KEY"` is what identifies a key column (`ratesListsHelpers.ts:10`), and it is still on the
data after slice 3 removed the Role column from the Fields table. When a chosen value stops existing
because an earlier key changed, fall back to the first remaining option rather than leaving the
select showing a value no row has.

**2. An input per line field.** Slice 1 stored a `sample` per line field so the preview had
something to work with; this slice replaces it with a control. Number-kind line fields get a numeric
input, text-kind line fields with a declared option list get a select over those options, and a
text-kind line field with no options gets a text input. Seed each control from the stored `sample`
so the card still shows a worked number the moment it opens.

**3. Highlight the matched row in the rows table, with the mock-up's caption.** The caption is
exactly: `The highlighted row is the one priced above.`

This needs state above both cards. Today `scenarioRowId` is local to `ChargeStepsEditor` (`:317`)
and `RowsCard` is a sibling mounted at `RatesListsAdminPage.tsx:1151-1168`. Lift the chosen keys and
the matched row id to the detail component that mounts both (`:1142` and `:1151`), pass the matched
row id down to each, and have the editor read the scenario values from the matched row through the
shared values-map builder `RATE_LINE_FIELDS_V1` introduced.

`FilterableRateGrid` has no highlight. Add one optional prop - `highlightRowId?: string | null` -
and apply it in `BodyRow` (`FilterableRateGrid.tsx:856-897`) to the `<tr>` at `:869`, as a token
background plus an inset left rule. `BodyRow` has exactly one call site (`:845`), so every row path
picks it up. **The prop is optional and defaults to no highlight, so `RatesTab.tsx:345`, the other
consumer of this grid, is unchanged - do not touch that file.**

**4. Say when nothing matches.** A combination with no row must say so in the mock-up's words -
`No row on this sheet matches that combination.` - and must not print running totals beside the
steps. A preview computed from an empty values map is a number nobody should read.

Mark `apps/web/src/pages/admin/ChargeStepsEditor.tsx` with `RATE_SCENARIO_PICKER_V2`.

## Do NOT

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path. That
  is Decision 2, it is parity-gated, and it has not been made. A scenario picker that names a row
  and a set of line values looks exactly like a pricing call; it is not one, and it must not become
  one here.
- **Do not change what any step evaluates to.** The values map is still built by the shared builder
  from `RATE_LINE_FIELDS_V1`; this slice changes where its inputs come from, not how they resolve.
  Given the same row and the same line values, every running total is unchanged.
- **Do not change the step row UI** that `CHARGE_STEP_INPLACE_V1` built, or the Fields table that
  `RATE_FIELDS_TABLE_V2` built.
- **Do not change `RatesTab.tsx` or any other consumer of `FilterableRateGrid`,** and do not make
  the new prop required.
- **Do not add row filtering, sorting or grouping behaviour to the grid.** The highlight marks a
  row; it does not scroll to it, select it, or hide the others.
- **Do not add, change or remove an API route, controller, DTO or schema field.**
- Do not touch `/sot/` or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Quote the picker before and after. Before: one select, options `Row 1 ... Row N`. After: one
      select per KEY column, plus one control per line field. State the control count for a table
      with four key columns and one line field (must be 5).
- [ ] **Cascade, with the mock-up's `Saw cuts - by depth band` rows** (Roadsaw/Floor/Concrete/150,
      Roadsaw/Floor/Concrete/200, Roadsaw/Floor/Asphalt/150, Demosaw/Floor/Any/150,
      Demosaw/Wall/Concrete/150, Ringsaw/Floor/Any/200, Ringsaw/Wall/Any/200). State the options
      offered at each step: Equipment must offer `Demosaw, Ringsaw, Roadsaw`; with Roadsaw chosen,
      Elevation must offer `Floor` only; then Material must offer `Asphalt, Concrete`; then Depth
      must offer `150, 200`.
- [ ] **Worked example.** Choose Roadsaw / Floor / Concrete / 200, enter `Metres` 24, and state the
      matched row's `Rate` (18.95) and the line total (454.80). Confirm the highlighted row in the
      rows table is that row and quote the caption printed beneath it.
- [ ] Change one key so that no row matches. Quote the message, and confirm no running total is
      printed beside any step.
- [ ] Stale-value fallback: choose Roadsaw / Floor / Asphalt / 150, then change Equipment to
      Demosaw. State the Material and Depth values the picker settles on and confirm a row matches.
- [ ] Line-field controls: state the control type rendered for a number line field, a text line
      field with options, and a text line field without options. Confirm each is seeded from the
      stored `sample`.
- [ ] `FilterableRateGrid`: confirm `highlightRowId` is optional, state the number of call sites of
      `BodyRow` (must be 1), and confirm `RatesTab.tsx` is not in the diff.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
