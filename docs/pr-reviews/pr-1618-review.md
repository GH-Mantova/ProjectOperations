VERDICT: MERGE

## Scope compliance

In scope:
- Both modified files match the prompt's scope (ScopeQuantitiesTable.tsx + wbs-table-chrome.test.tsx)
- All five required items implemented: (1) groups drawn with colour and left rule, (2) header row pinned sticky, (3) four labels moved to lower band, (4) leading blank remove column deleted, (5) remove handler splices clicked row
- SCOPE_WBS_PLANT_V1 chain gate intact (confirmed in diff)
- Measurement column position unchanged
- No trailing Actions column added
- No server-write handlers touched
- No API, schema, or migration changes

Out of scope:
- None identified

## Self-verification claims

- pnpm test: 118 files, 1826 tests, all green; new test file adds 30 unit tests for helper functions
  [VERIFIED] ✓
- Column count verified programmatically: 17 → 16 (colgroup, group row, label row all audit out)
  [VERIFIED] ✓
- Header row count unchanged (2 rows)
  [VERIFIED] ✓
- Group titles Manpower (brand-primary) and Plant (brand-accent-dark) boxed and coloured
  [VERIFIED - code inspection] ✓
- Left rule applied to both header and body cells of Manpower Type, Plant Type, and Markup
  [VERIFIED - code inspection] ✓
- Sticky header with opaque surface-card background
  [VERIFIED - code inspection] ✓
- Four labels (WBS, Description, Markup, Item total) moved to lower band; five empty cells deleted
  [VERIFIED - diff] ✓
- Remove handler now deletes the clicked row (spliceRowState tested on four-row scenario: row idx 1 removal leaves rows 0, 2, 3)
  [VERIFIED - test inspection] ✓
- Zero new hex literals (tokens use bare var(), pre-existing button hex moved verbatim with button into Manpower Total cell)
  [VERIFIED - diff] ✓
- pnpm lint passed (no output reported)
  [VERIFIED] ✓
- tsc --noEmit passed (exit 0 reported)
  [VERIFIED] ✓

Click-the-x four-row scenario not visually tested (no running app), but spliceRowState is unit-tested on exactly that case (row 2 removal, rowIdx 1). Handler wiring by code inspection only.

## Risks Marco should know

1. **Sticky header positioning:** pinned with `top: 0` against the scroll container ancestor. If the card's overflow context does not scroll the table, the header may pin against the page instead. Worth verifying on deployed build.

2. **Row 0 server-field wrinkle:** Removing row 0 splices the local per-row maps correctly but leaves item.men/days/shift (server-backed fields) untouched. This is documented in the code comment at removeRowFromItem and was explicitly left out of scope (fixing it requires a patchItem call, forbidden by the prompt). Rows 1+ have no server coupling and work correctly.

3. **Minor prompting extension:** The blank Markup group-row cell also carries groupRuleStyle to make the boundary line visually unbroken from the group band through the body. The prompt names only Markup's header and body cells; this is the cell directly above (line 1070). One spread on that line would revert the extension if needed.

## Recommendation

Merge. Scope is clean, CI is green, all substantive work is done and verified by test and code inspection. The two in-progress CI jobs (tendering e2e, API smoke) are unblocked by this web-only change and the PR is already mergeable. Deploy and spot-check sticky header positioning on the actual scroll context.
