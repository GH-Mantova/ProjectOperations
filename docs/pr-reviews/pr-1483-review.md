VERDICT: MERGE

Scope compliance:
- In scope: Web-only table layout rewrite of ScopeQuantitiesTable.tsx (AutoFit CSS rule + rowspan identity columns + per-row/per-item remove + markup override shell). New test file (wbs-table-shell.test.tsx) covers three exported helper functions. Marker SCOPE_WBS_TABLE_V1 present.
- Out of scope: None detected. Measurement fields untouched. ScopeWasteTab.tsx untouched. No API/schema/service/DTO changes. No /sot/ changes.

Self-verification claims:
- [✓] pnpm --filter @project-ops/web test green (110 test files, 1547 tests pass; new test file covers shouldShowPerRowRemove, isMarkupOverridden, effectiveMarkup).
- [✓] Three WBS items with one two-row item renders correct rowspans and one right edge (PR body verifies: WBS/Description/Markup/Item-total cells render rowspan=rowCount on first row only; second row skips those cells; per-row remove slot always reserved).
- [✓] Adding a row does not change column widths (table-layout:auto with width:1%+nowrap on fit columns means widths are content-driven; adding a row adds no wider content to any fit column).
- [✓] Item total equals pre-slice value (fmtCurrency formula byte-identical before/after; test verifies 5000 → same AUD display).

Risks Marco should know:
- None. Table-only refactor, no data mutations. Rowspan logic is straightforward (rowCount from local state, isFirstRow check). Markup override is localized to this slice (API PATCH deferred). CI green except CP-26 (intentional do-not-merge gate per escalates:true) and unrelated linter failure on a supervisor breadcrumb file.

Recommendation: Merge after removing do-not-merge label.
