---
premise: ! test -f apps/api/src/modules/forms/__tests__/formrule-definition-backfill.spec.ts
premise_means: Gate A's CI layer (docs/plans/pipeline-correctness-gates-plan.md SLICE 2, merged #937) is not built — no test runs a FormRule.definition backfill against a seeded legacy row and asserts the produced JSON is contract-valid. This is the exact gap that let #923 (operator copied verbatim, not lowercased) pass green CI.
scope:
  - apps/api/src/modules/forms/__tests__/formrule-definition-backfill.spec.ts
  - .github/workflows/**
done_when: pnpm --filter @project-ops/api build && pnpm lint && test -f apps/api/src/modules/forms/__tests__/formrule-definition-backfill.spec.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# test(api): Gate A — FormRule.definition backfill correctness (pipeline-correctness-gates SLICE 2)

Implements Gate A's CI layer of `docs/plans/pipeline-correctness-gates-plan.md` (merged #937). Closes the
#923 class: a migration backfill that writes CONTRACT-INVALID data passes green CI because JSONB content
is not type-checked and nothing asserts a backfilled row is valid.

## What exists on main
- Migration `apps/api/prisma/migrations/20260804_fv2_formrule_expand/migration.sql` backfilled
  `FormRule.definition` (JSONB) from the legacy flat columns. The #923 bug was `operator` copied verbatim
  (uppercase `"EQUALS"`) instead of `lower(operator)`; canonical `ConditionOperator`
  (`packages/config/src/forms-rule-definition.ts`) is lowercase. Fixed in `23dcf30b`.
- The api test lane runs jest against a seeded Postgres (see sibling `apps/api/src/modules/forms/__tests__/`
  specs for the DB-seeding pattern used in this repo — reuse it, do not invent a new harness).
- No test asserts the backfill produces a valid `FieldRule`.

## What to build
Create `apps/api/src/modules/forms/__tests__/formrule-definition-backfill.spec.ts`:
1. Seed a LEGACY-shape `form_rules` row using the repo's existing api-test DB pattern — crucially with an
   UPPERCASE `operator` (e.g. `"EQUALS"`) and uppercase `effect` (e.g. `"SHOW"`), `definition` NULL.
2. Run the SAME backfill transform the migration applies (execute the migration's backfill `UPDATE`
   statement, or import/apply the identical SQL) so the row's `definition` is populated.
3. ASSERT the produced `definition` is contract-valid against the canonical types in
   `@project-ops/config/forms-rule-definition`: every `conditionGroup.conditions[].operator` is a member
   of `ConditionOperator` (i.e. LOWERCASE — this assertion goes RED on the pre-fix `"EQUALS"`), every
   action `type` is a member of `RuleActionType`, and the object shape matches `FieldRule`.
3b. Add a negative-control case proving the assertion CAN fail (feed an uppercase operator through a
    non-normalizing path and confirm the validator rejects it) so the gate is a proven instrument.
4. CI wiring: if the existing api jest job already globs `**/*.spec.ts`, the new spec runs in the existing
   REQUIRED api lane — no workflow edit needed (confirm by reading the api test script/job). Only edit a
   `.github/workflows/*.yml` if the spec would NOT otherwise be picked up as a required check.

## Do NOT
- Do NOT add a Prisma migration or schema change, and do NOT alter the existing migration — this slice is
  test (+ optional CI wiring) only. `gate_allow: none`.
- Do NOT invent a new test-DB harness; reuse the sibling forms specs' seeding approach.
- Do NOT change production code.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- `pnpm --filter @project-ops/api build` and `pnpm lint` must pass; run the new spec locally against the
  seeded DB and confirm it passes before opening the PR.
- If CI fails, read the actual job log before diagnosing — don't guess.
- Never ask for or wait on approval.
