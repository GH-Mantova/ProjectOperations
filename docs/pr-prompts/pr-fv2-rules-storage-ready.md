---
premise: ! awk '/^model FormRule \{/,/^\}/' apps/api/prisma/schema.prisma | grep -q "definition"
premise_means: The FormRule model (apps/api/prisma/schema.prisma ~L1887) has no `definition` JSON column yet, so there is no shared rule-definition storage format to backfill or expand.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260804_fv2_formrule_expand/migration.sql
  - packages/config/src/forms-rule-definition.ts
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/forms/__tests__/rules-engine.service.spec.ts
  - docs/data-model/relationship-map.json
  - docs/data-model/relationship-map.md
  - docs/data-model/metadata-catalog.json
done_when: pnpm build && pnpm lint && grep -q "definition" apps/api/prisma/schema.prisma && test -f packages/config/src/forms-rule-definition.ts && grep -q "forms-rule-definition" apps/api/src/modules/forms/rules-engine.service.ts && grep -q "forms-rule-definition" apps/web/src/pages/forms/FormFillPage.tsx
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: DROP COLUMN "definition" from "form_rules"; the column is nullable/additive-default so the migration is reversible with no data loss beyond the JSON backfill values (legacy sourceFieldKey/targetFieldKey/operator/comparisonValue/effect columns are kept, not dropped, so nothing is lost by rolling back).
---

# F-2a — FormRule storage expansion + shared rule-definition type

## What exists on main

- `FormRule` (`apps/api/prisma/schema.prisma` ~L1887) is a **legacy** flat row shape:
  `sourceFieldKey`, `targetFieldKey`, `operator`, `comparisonValue`, `effect`. Per the doc comment in
  `apps/api/src/modules/forms/dto/forms.dto.ts` ("Legacy show/hide-style rule stored as a FormRule row —
  distinct from the richer JSON FieldRule contract evaluated by RulesEngineService"), this model is
  populated by `apps/api/src/modules/forms/forms.service.ts` (`tx.formRule.createMany(...)`) but is NOT
  what `RulesEngineService` evaluates.
- The actual rule contract lives as untyped JSON on `FormField.conditions` / `.actions`
  (`apps/api/prisma/schema.prisma` ~L1851-1885) and is evaluated by
  `apps/api/src/modules/forms/rules-engine.service.ts`, which declares its own local
  `Condition` / `ConditionGroup` / `RuleAction` / `FieldRule` types inline.
- `apps/web/src/pages/forms/FormFillPage.tsx` independently re-declares near-identical local types
  (`type FieldRule`, `type Condition`, `type ConditionGroup`, ~L11-26) AND its own parallel evaluator
  (`isGroup`, `evalGroup`, `evalCondition`, ~L103-161). This is the two-evaluator drift risk (sot/06 R5).
- `packages/config/src/index.ts` is a plain shared TS package (no build step) already resolvable from
  both `apps/api` and `apps/web` via the `@project-ops/config/*` path alias in `tsconfig.base.json`.

## What to build

1. **Schema**: add a nullable `definition Json?` column to `FormRule` in `apps/api/prisma/schema.prisma`
   (keep all existing columns — do not drop `sourceFieldKey`/`targetFieldKey`/`operator`/
   `comparisonValue`/`effect`, per the plan's soak-before-drop rule).
2. **Migration** `apps/api/prisma/migrations/20260804_fv2_formrule_expand/migration.sql`:
   - `ALTER TABLE "form_rules" ADD COLUMN "definition" JSONB;`
   - Inline SQL backfill: for every existing row, populate `definition` with a JSON object shaped like
     the shared rule-definition contract (a single condition + a show/hide-style action derived from
     `source_field_key`/`operator`/`comparison_value`/`effect`), so no legacy row is left with a null
     `definition`. Write this as a single `UPDATE "form_rules" SET "definition" = jsonb_build_object(...)
     WHERE "definition" IS NULL;` — idempotent by construction.
3. **Shared type** — create `packages/config/src/forms-rule-definition.ts` exporting the ONE canonical
   `Condition`, `ConditionGroup`, `RuleAction`, `RuleActionType`, `ConditionOperator`, and `FieldRule`
   types. Base the shape on the existing types in `rules-engine.service.ts` (do not invent a new shape —
   port it verbatim so no behavioural change occurs).
4. Update `apps/api/src/modules/forms/rules-engine.service.ts` to import
   `Condition`/`ConditionGroup`/`RuleAction`/`RuleActionType`/`ConditionOperator`/`FieldRule` from
   `@project-ops/config/forms-rule-definition` instead of declaring them locally. Keep all evaluation
   logic (`evaluateCondition`, `evaluateConditionGroup`, etc.) unchanged — this slice is types-only on
   the server side.
5. Update `apps/web/src/pages/forms/FormFillPage.tsx` to import the same types from
   `@project-ops/config/forms-rule-definition` in place of its local `type FieldRule` / `type Condition` /
   `type ConditionGroup` declarations. Do NOT touch `evalGroup`/`evalCondition`/`isGroup` logic in this
   slice — unifying the evaluators is F-2b's job; here you only remove the duplicate type declarations.
6. Update `apps/api/src/modules/forms/__tests__/rules-engine.service.spec.ts`'s imports/expectations if
   the type re-export changes any `toHaveBeenCalledWith(...)` shape assertions.
7. Regenerate the data-model map: `node scripts/data-model/build-relationship-map.mjs`, and commit the
   updated `docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
   `docs/data-model/metadata-catalog.json`.
8. Put a bare `GATE-ALLOW: migrations` line at column 0 of the PR body.

GATE-ALLOW: migrations

## Do NOT

- Do not drop or rename any existing `FormRule` column — `definition` is additive only.
- Do not change `RulesEngineService`'s evaluation behavior or `FormFillPage.tsx`'s evaluator functions —
  types only in this slice.
- Do not build the rules builder UI, WARN/BLOCK actions, or repeating-section operators — those are F-2c
  and F-3.
- Do not touch Azure/Entra/SharePoint.
- Do not create a new `packages/*` package — extend `packages/config` only.

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
