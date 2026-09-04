---
premise: '! grep -q "SCOPE_WBS_GROUPRULES_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The WBS table is seventeen columns wide with no vertical rules, no group colour and no sticky
  header, so nothing on screen says where Manpower ends and Plant begins. It also carries a blank
  unlabelled column before WBS that the approved mock-up does not have, which displaces every
  column after it by one place, and its row-remove control deletes the last row rather than the row
  that was clicked.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-table-chrome.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_GROUPRULES_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-corrections
cluster_order: 1
rollback_strategy: >-
  Web-only, one component plus its test. No API, no schema, no migration, no new dependency. Every
  change is presentation or local row state. Revert and the table renders exactly as it does today.
---

# The WBS table reads as one wall of columns, and one of them should not be there

First slice of the corrections cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`, mock-up read in full and compared cell by cell. **The
column order inside Manpower and inside Plant is already correct** - `Type, Qty, Days, Shift, Day
rate, Total` and `Type, Qty, Days, Day rate, Total`, labels and sequence both. Nothing needs
reordering. What displaces the row is a column the mock-up does not have, and what makes it read as
chaos is that the group boundaries were never drawn.

## What to build

**1. Draw the groups.** The mock-up boxes each group header, rules the first cell of every group
with a left border, and colours the two group titles - Manpower in `--brand-primary`, Plant in
`--brand-accent-dark`. Take the colours from the tokens, never as literals. Apply the left border
to the header cell **and** the body cell of the first column in each group: Manpower Type, Plant
Type, Markup.

**2. Pin the column header row.** `position: sticky; top: 0` on the lower header row, over an
opaque surface token so rows do not show through it. A card of forty items is unreadable without
it.

**3. Put the header labels on the right band.** `WBS`, `Description`, `Markup` and `Item total`
currently sit on the *group* row beside the Manpower and Plant titles, with five blank header cells
underneath them. The mock-up puts them on the *lower* row, level with `Type` / `Qty` / `Days`.
Move them down and drop the empty cells.

**4. Remove the leading blank column.** The row-remove `x` gets its own first column today. The
mock-up appends it into the existing **Manpower Total** cell, and says why:
*"the x slot is always reserved so the money column keeps one right edge"*. Do the same, and delete
the `<col>` and the `<th aria-label="Remove">` that go with it.

**5. Make remove delete the row that was clicked.** Today the handler decrements a row count, so
the **last** row disappears whichever `x` was pressed. Remove the identified row instead. Row state
is local, so this is an index-aware splice, not a data change.

Mark the component with `SCOPE_WBS_GROUPRULES_V1`.

## Do NOT

- **Do not touch the Measurement column.** It sits between Plant Total and Markup as an interim
  state and `pr-cardui-s5` moves it. The comment in the file above it says so. Leave it exactly
  where it is, including its position in the header.
- Do not add the trailing Actions column - that is also `pr-cardui-s5`.
- **Do not change any handler that writes to the server.** No `patchItem` call may be added,
  removed or re-pointed by this slice. Persistence is a separate cluster and mixing them makes both
  unreviewable.
- Do not touch the plant pickers, the labour dropdowns, rate resolution, markup inheritance or any
  money formatting - those are slices 2 and 3 of this cluster.
- Do not touch `/sot/`, the API, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Header row count is unchanged; state the column count before and after (17 -> 16) and name
      the column that went.
- [ ] With a four-row item, clicking the `x` on row 2 removes row 2. Say which row you clicked and
      which one went.
- [ ] Screenshot or describe the header: Manpower and Plant titles carry their group colour, and a
      left rule sits at Manpower Type, Plant Type and Markup.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
