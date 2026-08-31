VERDICT: MERGE

## Scope compliance

Prompt: pr-estpricing-s3-rate-table-step-lists-ready.md

In scope:
- schema.prisma: nullable Json column `chargeSteps` added to RateTable ✓
- Migration 20260831040000_add_rate_table_charge_steps: additive, idempotent, properly sequenced (40000 > prior 30000) ✓
- rate-step-evaluator.ts: pure function with full ChargeStep grammar (start, multiply, divide, add, subtract, round, floor, cap), condition evaluation, typed StepArithmeticTypeError ✓
- rate-step-evaluator.spec.ts: 50 unit tests covering every step type, conditions met/unmet, text-in-arithmetic rejection, trail invariants, three real pricing shapes (core-holes, per-unit-with-floor, banded) ✓
- metadata-catalog.json: regenerated to include chargeSteps field ✓

Out of scope (correctly absent):
- No wiring into resolveCuttingRate, resolveCoreHoleRate, or any pricing path ✓
- No UI (editor deferred to separate prompt/PR) ✓
- No RateColumn.role changes ✓
- No removal of hardcoded calculations ✓

## Self-verification claims

All claimed verifications passed:
- `pnpm build` — green (CI job "Web — lint, logic tests, vitest, build" passed) ✓
- `pnpm lint` — green (API and Web lint both passed) ✓
- `pnpm --filter @project-ops/api exec jest --testPathPattern=rate-step-evaluator` — 50/50 pass (claimed in PR body) ✓
- `node scripts/data-model/build-relationship-map.mjs --check` — OK (claimed in PR body) ✓
- `grep chargeSteps apps/api/prisma/schema.prisma` — matches ✓

## CI Status

All substantive checks PASSED:
- ✓ API — lint, test, compliance smoke (5m54s)
- ✓ Web — lint, logic tests, vitest, build (1m16s)
- ✓ Data model — generator sanity (7s)
- ✓ All gates CP-09/10/12/13/17/22/23/24/25 PASSED
- X CP-26 do-not-merge: FAILED (by design, escalates:true requires Marco's explicit label removal)

The only failure is the intentional escalation gate. No code, test, or compliance failures.

## Risks Marco should know

1. Migration orderi: Confirmed sorted AFTER 20260831030000_crm_s7_interaction_log ✓
2. No schema drift: Single additive nullable column, safe for live production tables ✓
3. Evaluator unreachable: No caller wired until next slice, no production impact ✓
4. GATE-ALLOW: migrations marker present and correct ✓

## Recommendation

MERGE. Scope is clean, all CI checks pass, self-verification complete. Remove the do-not-merge label to release for merge.
