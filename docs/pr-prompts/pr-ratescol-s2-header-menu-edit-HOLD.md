---
premise: '! grep -q "handleUpdateColumn" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
premise_means: The Rates & Lists page still has no way to edit a column - the PATCH endpoint exists on the server but nothing on the screen calls it, so rename, unit, role, list and reorder are all impossible from the UI.
scope:
  - apps/web/src/components/rates/FilterableRateGrid.tsx
  - apps/web/src/components/rates/ColumnSettingsPanel.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "handleUpdateColumn" apps/web/src/pages/admin/RatesListsAdminPage.tsx && test -f apps/web/src/components/rates/ColumnSettingsPanel.tsx
size: 5
gate_allow: none
seed_only: false
escalates: true
module: admin
cluster: ratescol
cluster_order: 3
requires_on_main: 'apps/web/src/components/rates/rateGridModel.ts :: chargedFrom'
design_ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
---

# Rates columns S2 - configure a column from its header: settings, move, delete

**Slice 3 of 5** of `ratescol`. The Lists gesture: the chevron menu every header already opens
gains four structure items - **Column settings**, **Move left**, **Move right**, **Delete
column** - and `handleUpdateColumn` finally calls the PATCH that has existed since R0. Admin-only,
behind one optional grid prop, so the tender Rates tab never sees a Delete item. The mock-up in
`design_ref` is the standard: states 4, 5, 7, 8, 9 and 14 are the acceptance test.

**Gate:** S1 must be on main (`chargedFrom` in `rateGridModel.ts`) - the warnings below refer to the
charged-from mark S1 draws.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the five files in `scope`.

## Guardrails

- One attempt. If `handleUpdateColumn` is already on the page on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. `pnpm build`, `pnpm lint` and the web tests
  must pass, `ChargeStepsEditor.test.tsx` included (out of scope, must stay green).
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
  Raised by Marco on 31 Aug for the previous version of this slice and kept: this rewrites how
  estimators change columns on a screen they use, and a reorder or a role change alters what a
  priced lookup returns.

## Grounded on main (read first; cite line numbers in the PR body)

- `HeaderDropdown` (`FilterableRateGrid.tsx` ~581-760): Sort ascending / Sort descending
  (~659-668), a value list with a find box, `Clear range` for number columns (~716). Container
  `position: absolute`, 4px below, min-width 220, 6px radius, 8px padding, 13px (~629-644), with
  **no flip logic** - the rightmost column's menu can open off-screen inside the horizontally
  scrolling grid. Two consumers: the admin page ~1707 and `RatesTab.tsx` ~345 (**do not touch**).
- Server: `PATCH tables/:tableId/columns/:columnId` (`rates.controller.ts` ~181) takes
  `UpdateRateColumnDto` (`rate-column.dto.ts` ~53-73: optional `name, dataType, role, unit,
  listSlug, required, min, max, sortOrder`; enums `RateColumnDataTypeDto` ~13, `RateColumnRoleDto`
  ~22). `updateColumn` runs `assertStructure` over the **merged** column set (`rate-tables.service.ts`
  ~196) - `>=1 KEY, >=1 VALUE, every VALUE has a unit unless the table carries a per-row Unit column`
  (`rate-validation.service.ts` ~29-48, `UNIT_PER_ROW_V1`). A name clash answers 409
  `Pick another name` (S0). `DELETE …/columns/:columnId` (~194) answers 409 while the table has
  any rows, naming the count (S0).
- `sortOrder` has **no unique constraint** (`schema.prisma` ~6013) and `createColumn` hands new
  columns `sortOrder: table.columns.length` (~167) while the seed numbers from 1 - a tie is
  possible, and a tie makes the leftmost price column arbitrary. A move is therefore a **swap of
  two columns' `sortOrder` in two PATCHes**, never one PATCH.
- Existing page handlers to mirror: `handleAddColumn` ~957, `handleDeleteColumn` ~977 (call, read
  `readApiErrorMessage`, refetch). Existing helpers: `validateColumnStructure` (`ratesListsHelpers.ts`
  ~184) - the client-side twin of `assertStructure`; `stepsUsingField` ~328, `usedInLabel` ~342,
  `deleteFieldWarning` ~403. Steps bind to a column **by name** (`buildStepValues` writes
  `out[col.name]`, `packages/config/src/charge-step-semantics.ts` ~493-497), so a rename breaks
  any step that names the column; a locked tender's entry is keyed `{rowId}:{columnId}`
  (`rate-resolver.service.ts` ~571), so a rename never reaches locked money.
- The move warning's last line is the charge-steps card's existing impact sentence, *"a change
  applies to new lines only; tenders with locked rates keep their snapshot"*
  (`ChargeStepsEditor.tsx` ~1397-1399). Reuse it; do not write a second version.
- `ConfirmDialog.tsx` ~110 asks for `s7-btn s7-btn--danger`, which `tokens.css` does not define.
  This slice needs no danger confirm - the delete is refused on the control, not after a question.

## Plain-language vocabulary (settled in the previous draft; stored values unchanged)

| stored | shown |
|---|---|
| dataType `TEXT / NUMBER / CURRENCY / DATE / BOOL / LIST_REF` | `Text / Number / Money / Date / Yes or no / Pick from a list` |
| role `KEY / VALUE / INFO` | `Look it up by this / This is a price / Just information` |
| `unit` on a price column | asked as **$ per what?** (e.g. m / hr / tonne / day / hole) |
| `listSlug` | asked as **Which list?** - a picker of list **names**, storing the slug |
| `required` | **Must be filled in** |
| `min` / `max` | **Smallest allowed / Largest allowed**, folded under **More options** |

## What to build

### 1. `FilterableRateGrid.tsx` - the four items, behind one optional prop

New optional prop `structureEditing?: { onOpenSettings(col), onMove(col, dir: -1 | 1), onDelete(col), canMoveLeft(col), canMoveRight(col), deleteRefusal(col): string | null }`. When absent
(RatesTab), the dropdown is exactly what it is today. When present, the dropdown gains a divider
and, below the shipped items: `Column settings`, `Move left`, `Move right`, `Delete column`.
Move items disable at the ends. Delete is **disabled with the refusal text** when
`deleteRefusal(col)` returns a string, enabled otherwise - the row count is already on the page,
so the refusal is stated before the click, never after it (state 8). With zero rows it deletes
without a dialog: there is nothing to lose (state 1-2 flow).

Fix the flip: when the dropdown would overflow the grid's scroll container on the right, anchor it
`right: 0` instead of `left: 0`. Measured, not guessed - use the container's bounding rect.

### 2. `ColumnSettingsPanel.tsx` - five controls, More options folded

Opens from the menu, anchored under the header like the dropdown (state 5). Controls, in order:
**What do you want to call it?** / **What is this column for?** (the three role words; under it,
on the charged-from column, the sentence *"This table's only price — so it is the one estimates
use"* when it is the only price column) / **What goes in it?** (the six type words) / the fourth
slot follows the choice - a price asks **$ per what?**, a list column asks **Which list?**,
anything else asks **Measured in (optional)** / **Must be filled in** / **More options** (folded:
Smallest allowed, Largest allowed, with the note that they are checked when a row is saved).
Position is **not** in here - Move left / Move right own it. Cancel / Save. Save sends **only what
changed**.

Pre-checks before anything is sent, each rendered inline under the control it concerns:

- **Name clash** (state 9): the table already has a column with that name (case-insensitive,
  excluding this column) -> *This table already has a column called "Depth". Pick another name.*
  Blocks Save.
- **Structure** - run `validateColumnStructure` over the proposed set (this column replaced);
  show its message (e.g. *"Rate" needs a $ per what? before this table can price*). Blocks Save.
- **Rename used by a step** (state 9): the name changes and `stepsUsingField` names this column
  -> the two-clause warning, both halves: *"Rate" is used in step 1. Rename it and step 1 will
  still be looking for "Rate" — pricing on this table stops working until you open Charge steps
  and point that step at the new name.* then *The tenders that already priced it are fine — N
  tenders hold this column in their locked books and keep the figures they were quoted.*
  (N from the page's existing open-tenders data if it has it; otherwise omit the count, never
  invent one). Step numbers via `usedInLabel`, so this and the charge-steps card can never
  disagree. **Warn, do not block** - the button reads **Save anyway**.
- **Role change moves the charged-from mark** (state 14, Marco's ruling 2026-09-14): changing
  *What is this column for?* to or from *This is a price* such that `markChargedFrom` would pick a
  different column -> the same warning as a move (below), fired before Save. Warn, never block.

### 3. `RatesListsAdminPage.tsx` - the handlers

- `handleUpdateColumn(columnId, patch)` - `PATCH /rates/tables/${table.id}/columns/${columnId}`
  with the changed fields, `readApiErrorMessage` on failure (a 409 from S0 shows its message under
  the name control; a 400 from `assertStructure` shows under the control it names), refetch on
  success. Mirror `handleDeleteColumn` (~977).
- `handleMoveColumn(columnId, dir)` - swap `sortOrder` with the neighbour in **two PATCHes**, then
  refetch. Before the move, compute the charged-from column before and after with
  `markChargedFrom`; if it changes, show the warning **after** the move (it warns, it does not
  block), with **Put it back** (reverse the swap) and **Keep it**:
  *New estimates will now price at the night rate. Anything that prices against Labour rates takes
  the leftmost price column. You have just moved Night rate in front of Day rate, so a labourer
  costed on this table comes out at the night figure. Day rate — $600.00 per day → Night rate —
  $1,000.00 per day.* plus the charge-steps card's own last line. Values are the first row's,
  formatted as the cell is.
  Moving a **look-up** column gets the other note (state 7): *Prices are unchanged. What changed is
  the order the questions get asked in, and how the grid groups.* - only earlier columns narrow a
  later menu (`scenarioKeyOptions` ~497-517) and the grid groups by the leftmost text look-up.
- `deleteRefusal(col)` - `rows.length > 0` -> *This table still has N rows, and every one of them
  has a value stored under "Rate". Remove the rows first, or leave the column where it is.* (the
  same fact S0's server string states; no "deactivate" advice). Zero rows -> `null`.
- Pass all of it to the grid as `structureEditing`. The Fields card, its Add-column form and the
  Rows card stay as they are in this slice - S3 moves them.

### 4. `ratesListsHelpers.ts` + spec - pure helpers, tested

`columnNameClash(columns, name, excludeId)`, `renameWarning(name, usedIn, lockedCount?)`,
`chargedFromChange(before, after)` (returns the from/to pair or null), `swapSortOrders(columns,
id, dir)` (returns the two PATCH bodies), `moveNote(column, before, after)`. Cases in
`__tests__/ratesListsHelpers.test.ts` for each, including: clash is case-insensitive and ignores
the column itself; a tie in `sortOrder` still produces two distinct PATCH bodies; a role change
that does not alter the charged-from column returns null.

## Do NOT

- Do NOT touch `RatesTab.tsx`, `ChargeStepsEditor.test.tsx`, `rateGridModel.ts`, the API or `/sot/`.
- Do NOT reorder with one PATCH, and do NOT implement drag-and-drop.
- Do NOT block a rename or a move - warn.
- Do NOT show a danger confirm dialog; refuse on the control.
- Do NOT print `KEY` / `VALUE` / `INFO` / `LIST_REF` / `slug` anywhere a user reads.
- Do NOT move the Fields card, the Add-column form or the Rows card - that is S3.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "handleUpdateColumn" apps/web/src/pages/admin/RatesListsAdminPage.tsx
test -f apps/web/src/components/rates/ColumnSettingsPanel.tsx
git diff --stat origin/main -- apps/web/src/pages/tendering/RatesTab.tsx   # must be empty
```

Open the PR titled `feat(rates): S2 - column settings, move and delete from the grid header (handleUpdateColumn)`
and leave it UNMERGED.
