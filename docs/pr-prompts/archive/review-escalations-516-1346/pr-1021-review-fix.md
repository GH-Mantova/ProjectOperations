# PR #1021 (SLICE 4 — ReportChartWidget) needs test file update before merge

The reportChartWidget implementation is correct and ships the expected code, but the supporting test file `apps/web/src/dashboards/__tests__/widgetGallery-reporting.spec.ts` was not updated. This test file (from SLICE 3) contains two assertions that explicitly anticipate SLICE 4 chart widget emission:

1. **Line 103**: `expect(metas).toHaveLength(5)` — expects exactly 5 metas, but SLICE 4 now emits 9 (4 chart + 5 table widgets for the 5 definitions, where 4 have a chart spec)
2. **Lines 176–179**: `expect(meta.type).not.toMatch(/^report:chart:/)` — explicitly tests that "SLICE 3 does not emit any report:chart:* widgets (those belong to SLICE 4)"

The comments in the test file (lines 173–174, 176) state "SLICE 4 will add chart widgets" and "those belong to SLICE 4", confirming the test expectations should change when SLICE 4 ships.

**Fix:** Update the test file to expect 9 metas and assert that chart widgets ARE now emitted. The code is correct; only test assertions need updating.
