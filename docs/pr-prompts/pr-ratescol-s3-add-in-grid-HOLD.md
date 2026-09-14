---
premise: '! grep -q "structureAdding" apps/web/src/components/rates/FilterableRateGrid.tsx'
premise_means: Columns and rows can still only be added from cards below the grid, an empty rate table still greets the user with database-word instructions, and the Fields card still lists fields above the grid instead of beside the pricing steps that consume them.
scope:
  - apps/web/src/components/rates/FilterableRateGrid.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
  - apps/web/src/components/rates/EmptyTableFirstStep.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "structureAdding" apps/web/src/components/rates/FilterableRateGrid.tsx && test -f apps/web/src/components/rates/EmptyTableFirstStep.tsx
size: 5
gate_allow: none
seed_only: false
escalates: true
module: admin
cluster: ratescol
cluster_order: 4
requires_on_main: 'apps/web/src/pages/admin/RatesListsAdminPage.tsx :: handleUpdateColumn'
design_ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
---

# Rates columns S3 - build the table in the grid: first step, add column, add row, shrink the card

**Slice 4 of 5** of `ratescol`. This is the slice that moves adding into the grid and answers the
audit's biggest objection (the Fields card's "Used in") by shrinking that card rather than deleting
it. The mock-up in `design_ref` is the standard: states 1, 2, 6, and the "loss" cards in the cost
panel are the acceptance test.

**Gate:** S2 must be on main (`handleUpdateColumn` on the page) - S3 reuses its settings panel for
the add-column flow.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the five files in `scope`.

## Guardrails

- One attempt. If `structureAdding` is already in the grid on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. `pnpm build`, `pnpm lint` and the web tests
  must pass, `ChargeStepsEditor.test.tsx` included (out of scope, must stay green).
- `escalates: true` - same reason as S2: it rewrites how a used screen is built. Open, leave unmerged.

## Grounded on main (read first; cite line numbers in the PR body)

- A brand-new table is genuinely empty: `createTable` writes a `rate_tables` row and no columns
  (`rate-tables.service.ts` ~49-70). Today that lands on *"No fields yet — add KEY, VALUE, and
  INFO columns below."* (`RatesListsAdminPage.tsx` ~1417) and *"Add columns before you add rows."*
  (~1701) - two database-word instructions with no hint that a price column is compulsory.
- `assertStructure` refuses a table with no VALUE column, and a VALUE column with no unit unless
  the table carries a per-row Unit column (`rate-validation.service.ts` ~29-48). So the guided
  first step must produce **one VALUE/CURRENCY column with a unit** in a single
  `POST tables/:id/columns` - the route `handleAddColumn` (~957) already uses.
- Add row today is a panel below the grid (~1747-1800) built from `CellEditor` /
  `ListRefCellEditor` (~1904-1994); a list column's editor loads `GET /lists/{slug}/items` with
  archived filtered out (~1974-1982). Cells are keyed by **column id**, not position
  (`schema.prisma` ~6021-6031). A number/money column gets a numeric box, a list column a select.
- The Fields card is `FieldsCard` (~1363), rendered at ~1215; it lists each field with a "Used in"
  column from `stepsUsingField` / `usedInLabel` (`ratesListsHelpers.ts` ~328/~342) and a
  From-source for line fields (the estimate-line vs column distinction Marco ruled for package 9;
  `ChargeStepsEditor.tsx` `FIELD_SOURCE_LABELS` ~620-623). `rateFieldRows` (~356) builds its rows.
- The grid's other consumer is `RatesTab.tsx` ~345 - **do not touch**; every new prop optional.

## What to build

### 1. `EmptyTableFirstStep.tsx` - "Start with the price" (states 1, 2)

When the selected table has **zero columns**, the grid area shows one empty cell and this panel
instead of the "No fields yet" text. Two questions - **What are you charging for?** (name,
placeholder "Rate") and **$ per what?** (unit, e.g. m / hr / tonne / day / hole) - and **Create the
table**, disabled until both are filled. On submit it calls `handleAddColumn` with
`{ name, role: VALUE, dataType: CURRENCY, unit }`. Copy is the mock-up's; no database words. Below,
quietly: *You can add everything else after.*

### 2. `FilterableRateGrid.tsx` - add column, add row (states 2, 6)

New optional prop `structureAdding?: { onAddColumn(), onAddRow(), addRowDraft?: {...} }`.
- A `+` at the end of the header row (`onAddColumn`) - opens the naming-in-the-header flow: an
  editable header cell, then the S2 `ColumnSettingsPanel` in its create mode (two questions:
  *What goes in it?* and *What is this column for?*, plus the fourth-slot control and Required).
  Reuse S2's panel; do not build a second column form.
- A `+ Add a row` line under the last row (`onAddRow`). When `addRowDraft` is set, the draft row
  renders **in the grid** with one editor per column chosen by the column's kind - list -> select
  over that list's items, number/money -> numeric box - `CellEditor` / `ListRefCellEditor` reused.
  Cancel / **Add the row**. Absent (RatesTab) -> no `+`, no draft row.

### 3. `RatesListsAdminPage.tsx` - wire it, shrink the Fields card

- Render `EmptyTableFirstStep` when `columns.length === 0`; otherwise the grid. The two old empty
  strings (~1417, ~1701) go.
- `handleAddRow(draft)` - build `cells` keyed by column id from the draft, `POST tables/:id/rows`
  as the shipped Add-row panel does, refetch. Keep the shipped panel's validation.
- Pass `structureAdding` (and the S2 `structureEditing`) to the grid; remove the standalone
  Add-column form and the below-grid Add-row panel now that both live in the grid.
- **Shrink `FieldsCard` to "What the pricing steps use"** (Marco's ruling 2026-09-14): a small
  list - one row per field the steps actually name, showing **name**, **source** (from the column,
  or from the estimate line) and **steps** (`usedInLabel`) - and nothing else. No add, no delete,
  no role/unit editing (those are the header now). Move it to sit **with the charge-steps card**
  that consumes it, not above the grid. This preserves the standing "what breaks if I change this"
  answer and the From-the-estimate-line distinction that a grid of columns structurally cannot show
  (line fields like Metres / Holes have no column). Keep `rateFieldRows` but reduce it to those
  three fields; keep `deleteFieldWarning` and `usedInLabel` (S2's warnings use them).

### 4. `ratesListsHelpers.ts` + spec

`pricingFieldRows(columns, steps)` -> the shrunk list's rows (name, source, steps), one per field a
step names, columns and line fields both. Case in `__tests__/ratesListsHelpers.test.ts`: a table
whose steps name one column and three line fields yields four rows, the three line fields marked
source = estimate line.

## Do NOT

- Do NOT touch `RatesTab.tsx`, `ChargeStepsEditor.test.tsx`, the API, the schema or `/sot/`.
- Do NOT delete the Fields card outright - shrink and move it. "Used in" and the From distinction
  must survive.
- Do NOT build a second column form - reuse S2's `ColumnSettingsPanel` in create mode.
- Do NOT key row cells by position - key by column id.
- Do NOT add the import-from-row-1 behaviour - that is S4.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "structureAdding" apps/web/src/components/rates/FilterableRateGrid.tsx
test -f apps/web/src/components/rates/EmptyTableFirstStep.tsx
git diff --stat origin/main -- apps/web/src/pages/tendering/RatesTab.tsx   # must be empty
```

Open the PR titled `feat(rates): S3 - add columns and rows in the grid, guided first step, shrink the Fields card`
and leave it UNMERGED.
