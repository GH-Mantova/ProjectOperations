---
premise: '! grep -q "SCOPE_WBS_TABLE_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  A WBS item is a stack of loose form fields, so nothing lines up column-to-column between items.
  An estimator cannot scan a card for the item that carries the money, and one item cannot carry
  more than one manpower/plant pairing at all.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-table-shell.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_TABLE_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 8
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 2
requires_on_main: 'apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx :: SCOPE_DISCBAR_V1'
rollback_strategy: >-
  Web-only re-layout of one component. No API, no schema, no migration, no data written. Revert the
  commit and the loose-field rows come back; nothing an estimator typed is lost, because the fields
  bind to the same item and row records either way.
---

# The WBS item table - shell and identity columns

Second slice. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

**This slice builds the table and its identity columns only.** Manpower is slice 3, plant is slice
4, the actions column and expandables are slice 5. Read those before deciding what to leave alone.

## What to build

Replace the loose-field stack in `ScopeQuantitiesTable.tsx` with the mock-up's `table.subtbl`:

1. **The auto-fit layout rule, verbatim from the mock-up.** Word's "AutoFit to contents" then
   "AutoFit to window": every column shrinks to its content, the description column takes the slack.

   ```css
   table.subtbl{width:100%;table-layout:auto}
   table.subtbl th.fit,table.subtbl td.fit{width:1%;white-space:nowrap}
   ```

   This is Marco's standing layout rule, not a preference: **a column must not resize as rows are
   added**, and no text may overflow its box.

2. **A WBS item is one or more rows.** The item owns `rows[]`; each row is one manpower/plant
   pairing. `WBS`, `Description`, `Markup` and `Item total` are `rowspan`-ed across the item's rows;
   everything else is per-row. An item with one row must look identical to today's single row.

3. **The columns this slice owns:** `WBS` (the computed code, e.g. `DEM1.1`, with a remove-item
   button), `Description` (the free-text input), `Markup` (percentage input that inherits the card
   default and shows a revert control when overridden), `Item total`.

4. **Manpower and plant keep their current inputs**, rendered inside a single spanning cell between
   Description and Markup, with the two group headers (`Manpower`, `Plant`) already in place above
   them. The screen must stay usable at every point in this chain: a table with today's inputs in
   the middle is coherent; a table with empty holes where the money is entered is not.

5. **Add and remove.** `+ Add WBS item` below the table; a per-row remove that only appears when the
   item has more than one row; a per-item remove on the WBS cell. The remove slot is always
   reserved, even when it renders nothing, so the money column keeps one right edge.

Mark the component with `SCOPE_WBS_TABLE_V1`.

## Do NOT

- Do not add, change or remove any API route, service method or DTO. Web-only.
- Do not move the measurement fields (L/H/D/material/density/tonnes/waste/cutting) anywhere. They
  stay exactly where they are until slice 5 relocates them into the Measurement expandable.
- Do not build the actions column, the Measurement, Comment or ACM blocks - slice 5.
- Do not touch `ScopeWasteTab.tsx` or `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] A card with three WBS items, one of which has two rows, renders with correct rowspans and one
      right edge on the money column. Say so in the PR body with the row count.
- [ ] Adding a row does not change any column's width. State how you measured it.
- [ ] An item's total still equals what the same item totalled before this slice. Give both figures.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
