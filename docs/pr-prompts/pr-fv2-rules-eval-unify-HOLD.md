---
premise: grep -q "function evalGroup" apps/web/src/pages/forms/FormFillPage.tsx
premise_means: FormFillPage.tsx still has its own local evalGroup/evalCondition rule evaluator, duplicating apps/api/src/modules/forms/rules-engine.service.ts's logic with no test proving they agree — the two evaluators can silently drift (sot/06 R5).
scope:
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/forms/rules-engine.service.ts
  - packages/config/src/forms-rule-definition.ts
  - apps/api/src/modules/forms/__tests__/rules-engine.service.spec.ts
  - apps/web/src/pages/forms/__tests__/formRulesContract.test.ts
done_when: pnpm build && pnpm lint && pnpm test -- formRulesContract && test -f apps/web/src/pages/forms/__tests__/formRulesContract.test.ts && ! grep -q "function evalGroup" apps/web/src/pages/forms/FormFillPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# F-2b — one rule evaluator, contract-tested

## What exists on main (after F-2a)

- `packages/config/src/forms-rule-definition.ts` holds the ONE shared `Condition` / `ConditionGroup` /
  `RuleAction` / `FieldRule` type contract (landed in F-2a), already imported by both
  `apps/api/src/modules/forms/rules-engine.service.ts` and
  `apps/web/src/pages/forms/FormFillPage.tsx` for typing.
- Despite sharing types, the two files still carry **separate evaluation implementations**:
  server-side `RulesEngineService.evaluateCondition` / `evaluateConditionGroup`
  (`apps/api/src/modules/forms/rules-engine.service.ts`), and client-side `evalCondition` / `evalGroup` /
  `isGroup` in `apps/web/src/pages/forms/FormFillPage.tsx` (~L103-161). These can drift in behaviour
  (e.g. loose-equality handling, `between`/`is_one_of` edge cases) even though the JSON they read is
  now typed identically.

## What to build

1. In `packages/config/src/forms-rule-definition.ts`, add the ONE shared, pure, dependency-free
   evaluation functions (`evaluateCondition`, `evaluateConditionGroup`) — port the exact logic currently
   in `RulesEngineService.evaluateCondition` / `evaluateConditionGroup`
   (`apps/api/src/modules/forms/rules-engine.service.ts`) verbatim, since that is the more complete/
   tested implementation (compliance-gate-adjacent code stays server-only; only the pure
   condition/group evaluation moves).
2. Update `apps/api/src/modules/forms/rules-engine.service.ts` so `evaluateCondition` and
   `evaluateConditionGroup` delegate to (or are thin wrappers around) the shared functions instead of
   containing their own logic. Keep the public method signatures unchanged so
   `apps/api/src/modules/forms/forms-engine.service.ts`'s existing calls
   (`evaluateFieldVisibility` / `evaluateFieldRequired` / `validateValues` / `checkComplianceGates` /
   `collectOnSubmitActions`) keep working.
3. Update `apps/web/src/pages/forms/FormFillPage.tsx` to delete its local `evalCondition` / `evalGroup` /
   `isGroup` functions and call the shared `evaluateCondition` / `evaluateConditionGroup` from
   `@project-ops/config/forms-rule-definition` instead, at every call site.
4. Add `apps/web/src/pages/forms/__tests__/formRulesContract.test.ts`: a table of fixture
   `ConditionGroup` + `ValueMap` pairs with expected boolean results, covering every operator in
   `ConditionOperator` (`equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`,
   `between`, `is_empty`, `is_not_empty`, `is_one_of`, `is_not_one_of`) plus nested AND/OR groups. Run the
   SAME fixtures through both the shared `evaluateConditionGroup` (imported directly, exercising what
   `FormFillPage.tsx` now calls) and `RulesEngineService.evaluateConditionGroup` (imported from
   `apps/api/src/modules/forms/rules-engine.service.ts`, instantiated with a stub `PrismaService`),
   asserting identical results for every fixture — this is the contract test that closes R5.
5. Update `apps/api/src/modules/forms/__tests__/rules-engine.service.spec.ts` if any
   `toHaveBeenCalledWith(...)` expectations shift due to the delegation refactor.

## Do NOT

- Do not touch `apps/api/prisma/schema.prisma` or add a migration — no schema in this slice.
- Do not build the rules-builder UI, WARN/BLOCK actions, or acknowledgement recording — that's F-2c.
- Do not add repeating-section operators — that's F-3.
- Do not touch Azure/Entra/SharePoint.
- Do not change `checkComplianceGates` (DB-backed, stays server-only).

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt; never exit silently — if something is genuinely impossible, say `NO-OP: <reason>` instead
  of stopping quietly.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — don't guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
