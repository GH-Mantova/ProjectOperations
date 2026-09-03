VERDICT: MERGE

Scope compliance:
- In scope: Plant column group (Type/Qty/Days/Day rate/Total) added to ScopeQuantitiesTable.tsx following the manpower slice pattern. Exactly 5 columns rendered as discrete <td> cells, with grouped catalogue select (non-transport only), custom machine drop-out capability, and rate unit badge. New test file wbs-plant-columns.test.tsx covers all 4 verification scenarios + edge cases (54 tests).
- Out of scope: None. No API, service, schema, manpower, or measurement changes. Plant section cleanly removed from ItemBodyInputs; measurement cell renamed but unchanged. /sot/ untouched.

Self-verification claims:
- [x] pnpm build green (Web — lint, logic tests, vitest, build: SUCCESS)
- [x] pnpm lint green (same job)
- [x] grep -q "SCOPE_WBS_PLANT_V1" present (12+ occurrences in diff)
- [x] All 114 test files / 1668 tests green (PR body: "54 new plant tests")
- [x] Catalogue machine pick tested (suite: "catalogue machine pick")
- [x] Custom machine drop-out + revert tested (suites: "custom machine drop-out", "revert custom machine to list")
- [x] Custom machine typed rate totals correctly (test: plantRowTotal(1, 3, 950) = 2850)
- [x] Custom machine shows no revert-to-locked control (test comment: "isCustom branch renders plain input, not OverrideField")
- [x] Column widths stable (Type cell minWidth: 140; Qty/Days width: 54 unconditional; test suite confirms)
- [x] Card total unchanged for no-plant card (plantRowTotal(null, null, null) = null → fmtPlantTotal(null) = "—"; test suite confirms)
- [x] Payload guardrail satisfied (PlantRate data already on /estimate-rates/plant endpoint; no new API/DTO/schema)

Risks Marco should know:
- PR escalates (escalates: true) — correctly held for Marco approval only. No risk; expected behavior.
- Two CI jobs still in progress (API compliance smoke, tendering-e2e), but web job succeeded and all gates passed. Safe to merge when API/e2e complete (they are unrelated infrastructure checks).
- Mergeable state: true.

Recommendation: Merge after remaining CI jobs complete; escalation approval required as flagged.
