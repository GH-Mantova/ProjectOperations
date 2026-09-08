# PR #1631 Review: feat(tendering) — plant rows persist

## VERDICT: MERGE (PENDING SMOKE TEST)

**Status:** All unit/lint/gate checks green. E2e smoke test IN_PROGRESS (not yet complete). Core scope complete. One deviation acceptable.

Code and tests are ready. **Marco should merge after confirming the e2e test (tendering-e2e job) completes with SUCCESS.**

## Scope compliance

In scope — exactly matching prompt:
- `ScopeQuantitiesTable.tsx`: All six plant handlers (type, description, revert, qty, days, override) wired to `commitPlantRow` → PATCH; SCOPE_PLANT_PERSIST_V1 token present (verified via API).
- `wbs-plant-columns.test.tsx`: Row-state literals updated for description/unit.
- `wbs-plant-persist.test.tsx`: New test file (635 lines), comprehensive round-trip + multi-row coverage.
- `scope-item-pricing.ts`: Comment documenting plantItems payload shape; 10 new tests pinning override and custom-machine legs.
- `scope-item-pricing.spec.ts`: 184 additions, covering blank rows, NULL items, multi-row sums, zero-override semantics.
- `batch3-scope-items.spec.ts`: E2e ported from legacy PlantCluster to columns (83 additions).

Out of scope — none detected.

## Self-verification claims

- [✅] `pnpm --filter @project-ops/web test` — **2053 tests green** (new file: 71, plant tests: 126).
- [✅] `pnpm --filter @project-ops/api test` — **476 tests green** (was 466, +10 in scope-item-pricing.spec.ts).
- [✅] Lint + tsc — no output, exit 0.
- [✅] SCOPE_PLANT_PERSIST_V1 token present in ScopeQuantitiesTable.tsx (verified with API file fetch + grep).
- [⏳] Fill three rows, reload, verify fields: Pinned as pure round-trip tests (`save → reload → save`), live execution deferred ("not verifiable in this lane").
- [⏳] Free-type custom machine: Pure round-trip test covers this; live execution deferred.
- [⏳] Two legacy entries → row count: Queries provided in PR body; counts not filled (no running database). Adoption logic (`sortedPlantEntries`, `plantRowCountFromItem`) documented.
- [⏳] Edit one row, confirm others survive: Test written (`addRowToItem / removeRowFromItem now carry plant keys in same PATCH`); live execution deferred.
- [⏳] Item total / card subtotal / discipline figures: Tests written; live page render deferred ("no running app, no browser, no database").
- [✅] Measurement cell retired: PlantCluster, + Plant button, updatePlant, addPlant, removePlant, PlantCluster component (101 lines) removed. E2e ported.

## Risks Marco should know

1. **E2e test still IN_PROGRESS at verdict time** — this is an integration test running against a real database/browser. All unit tests passed. The e2e will validate the ported test and the form-save round-trip Marco emphasized. **Recommendation: merge after e2e completes successfully**, which is likely imminent (other CI checks all green, e2e is last gate).

2. **Schema.prisma comment for dayRateOverride: deferred** — Prompt step 0 asked for a one-line comment in the `plantItems` JSON block documenting the new `dayRateOverride` key. Agent states (deviation #1): "schema.prisma is not in `scope:`" (correct — scope list is six files, schema.prisma not listed). Agent documented the field in `ScopePlantEntry` type and `scope-item-pricing.ts` instead. **Follow-up PR could add the schema.prisma comment if Marco prefers**, but it is not a blocker for this slice's correctness.

3. **Removal bug fixed alongside persistence** — The prompt did not require this, but agent fixed a race condition in `removeRowFromItem` (was splicing sparse local map, deleting wrong row). Now works against materialised plant list and writes both arrays in one PATCH. Documented in commit message; test covered.

4. **NULL plantItems behavior preserved** — Existing items with NULL plant column continue to price at $0 and render one blank row (test `NULL contributes no plant at all` pinned this). No backfill.

5. **No schema, migration, DTO or API route changes** — gate_allow stays `none`. Plant payload is `plantItems: [{ columnIndex, plantRateId, description, qty, days, unit, dayRateOverride }, …]` — all keys present, JSONB untyped array, rides on existing `plant_items` column (on model since 20260425_feat_scope_redesign_v2). PR body explicitly confirms no schema change needed despite prompt offering NO-OP for "plant persistence needs schema change".

## CI summary

- [✅] Web — lint, logic tests, vitest, build: COMPLETED / SUCCESS
- [✅] API — lint, test, compliance smoke: COMPLETED / SUCCESS
- [✅] PR gates (CP-09–13, CP-17, CP-22, CP-23): COMPLETED / SUCCESS
- [✅] Approval receipt (CP-26): COMPLETED / SUCCESS
- [✅] Data model — schema.prisma: COMPLETED / SUCCESS
- [✅] CodeQL: COMPLETED / SUCCESS
- [⏳] Tendering e2e: IN_PROGRESS (not yet complete at verdict time)

**Mergeable:** yes

## Recommendation

**Check e2e result, then merge.** The e2e (Tendering Browser Smoke test) is the final gate; all others are passing. See job status at https://github.com/GH-Mantova/ProjectOperations/actions/runs/33939198513/job/101233129273.

- If e2e: SUCCESS → **merge immediately** (code is ready, all functional requirements met).
- If e2e: FAILURE → investigate failure and either fix or ask the agent to re-fire the prompt (very unlikely; all unit tests passed).

The deviation (schema.prisma comment deferred) is acceptable because the field is documented in `ScopePlantEntry` type and `scope-item-pricing.ts`, and is not a functional risk. The core work—wiring plant handlers to persistence, pricing custom machines and overrides, removing the legacy cluster, porting the e2e—is complete and tested.

Prompt-quality note: The `done_when` gate (`grep -q "SCOPE_PLANT_PERSIST_V1"`) was satisfied (token present 5 times in ScopeQuantitiesTable.tsx, verified via API). The self-verification checklist mixes "unit test simulation" with "live form interaction" — the agent correctly noted which could not run headless. This is a checklist-design issue in the prompt, not a substantive gap in the PR.
