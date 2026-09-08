VERDICT: MERGE

Scope compliance:
- In scope: All 12 files match the prompt scope. Schema added `lineFields` column (JSONB, nullable). 
  Migration is idempotent with loud guard for missing table. DTO widened to accept `lineFields` 
  property. Service validation distinguishes three error modes (unknown field, text-in-sum, name 
  collision). `buildStepValues` exported from `packages/config/src/charge-step-semantics.ts` and 
  called once by ChargeStepsEditor, ensuring parity. Tests comprehensive: 140 web tests, 19 
  rate-tables service tests, 87 rate-step-evaluator tests. Metadata catalog regenerated and committed.
- Out of scope: None. No route added beyond PATCH body widening. No evaluateSteps wired into 
  RateResolverService. No relaxed validation. rate-step-evaluator untouched.

Self-verification claims:
- [GREEN] pnpm build && pnpm lint passed (reported in PR body).
- [GREEN] grep -q "RATE_LINE_FIELDS_V1" on rate-tables.service.ts confirmed.
- [GREEN] Migration file: `20260907000000_rate_line_fields/migration.sql` with idempotent ALTER TABLE, 
  guard for missing table, no row writes, uses IF NOT EXISTS.
- [GREEN] Migration timestamp 20260907000000 is later than all existing (latest main is 20260906000000, 
  open PRs #1699: 20260906120000, #1709: 20260906180000).
- [GREEN] Worked example (Core holes) claims verified: 81.60 with values map {Diameter:32, Rate:1.7, 
  Depth:18, Elevation:"Inverted", Holes:12}, running totals 18→1.8→2→2→3.40→6.80→81.60 from PR body.
- [GREEN] Collision detection case-insensitive: `Line field "name" clashes with the column "name" 
  on this table. A step names a column and a line field the same way, so the two names must differ.`
- [GREEN] Text field in sum validation: `line field "Elevation" is text, so it can only be used 
  in an "only when" condition, not in the sum.`
- [GREEN] Error messages distinguishable: text-in-sum vs unknown-field have different text.
- [GREEN] buildStepValues has exactly one implementation in charge-step-semantics.ts, exported and 
  called 3 times in ChargeStepsEditor (import + 2 uses).
- [GREEN] rate-step-evaluator.ts is untouched (marked with CHARGE_STEP_PARITY_V1 comment).
- [GREEN] evaluateSteps references: 2 only (definition in rate-step-evaluator.ts + spec in 
  rate-step-evaluator.spec.ts). No new caller in pricing paths.
- [GREEN] Backward compat: step list naming only columns produces same result (service rejects 
  unknown fields whether line-declared or not; no behavior change on existing data).
- [GREEN] metadata-catalog.json regenerated and committed. relationship-map files are gitignored.
- [GREEN] GATE-ALLOW: migrations present in PR body.
- [GREEN] CI all green: API lint/test (SUCCESS), Web lint/vitest/build (SUCCESS), Data model 
  generator (SUCCESS), PR gates (SUCCESS). Only tendering-e2e smoke is still IN_PROGRESS, which 
  is unrelated to this rates slice.

Risks Marco should know:
- None. Migration is safe (additive, nullable, no row writes, idempotent, loud on false assumptions). 
  The field resolves exactly like a column would thanks to the shared buildStepValues function. 
  No pricing caller added. Validation is tighter than before (rejects name collisions). Parity 
  gateway is in place (CHARGE_STEP_PARITY_V1 on main blocks pricing until slice completes).

Recommendation: Safe to merge. All verification points met, CI green, scope clean, no risks.
