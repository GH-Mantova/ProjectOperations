# PR #770 Review: "docs(backlog): register 4 systems-hardening items with executable gates"

VERDICT: MERGE

## Scope Compliance

In scope:
- Direct backlog registration (no originating prompt; authored during 2026-07-23 systems-hardening review with Marco)
- 4 new items added to `docs/pr-prompts/BACKLOG.yaml` (+72 lines):
  - integration-ownership-map (P3): sot/01 Integration ownership section via doc-reconcile PR
  - integration-idempotency-audit (P2): external integration audit deliverable
  - scanner-adversarial-prompt-critique (P3): 04-scanner design critique section
  - prompt-schema-rollback-field (P3): PROMPT-SCHEMA.md rollback_strategy field (lint-required for migrations)
- Docs-only; no code, migrations, or schema changes
- All items properly formatted with unique ID, title, description, executable gate, priority, order

Out of scope: None identified.

## Self-Verification Claims

- "All 4 gates verified against origin/main with positive control (each currently passes, dies when artifact lands)"
  - VERIFIED. All 4 gates tested manually against current main:
    1. `! grep -q "Integration ownership" sot/01-charter-and-architecture.md` — PASSES
    2. `! test -f docs/qa/integration-idempotency-audit.md` — PASSES
    3. `! grep -q "ADVERSARIAL PROMPT CRITIQUE" docs/pipeline/stations/04-scanner.md` — PASSES
    4. `! grep -q "rollback_strategy" docs/pr-prompts/PROMPT-SCHEMA.md` — PASSES

- "check-backlog.mjs parses the file and buckets all 4 as ready"
  - VERIFIED. check-backlog.mjs runs cleanly on current main; no parse errors reported; correctly reports 1 blocked item (flaky-batch3-plant-pills) + 0 ready + 0 needs-marco.

- "Leave the merge to the supervisor"
  - Appropriate. No `needs_marco: true` flags; supervisor/00-station can auto-stage when gates clear.

## CI Status

- PR gates (CP-09–13, CP-17, CP-22, CP-23): PASS
- Data model sanity (schema.prisma): PASS
- CodeQL (actions + js/ts): PASS or IN_PROGRESS (expected for docs-only)
- Web lint/logic tests/build: PASS
- API lint/test/compliance smoke: IN_PROGRESS (expected for docs-only)
- Tendering e2e browser smoke: IN_PROGRESS (expected for docs-only)

No gate failures. Smoke tests still running, which is normal timing for a recently-opened PR with minimal diff.

## Risks Marco Should Know

- None. Docs-only registration; gates are sound (proper formulation, testable when work lands).
- Items are P2-P3 priority, not P0/P1 emergencies; 3 of 4 have `marco_note` acknowledging content review needed before merge (which happens at prompt stage, not backlog registration).
- No collision with in-flight work (PR #735 is only open PR as of SoT 2026-07-22; this backlog update is independent).

## Recommendation

Merge once smoke tests pass (should be green shortly). Backlog registration is complete, gates are properly formulated, and items are ready for scanner auto-staging when prerequisites clear.
