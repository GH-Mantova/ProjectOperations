---
premise: ! grep -q "entryIndex" apps/api/prisma/schema.prisma
premise_means: No FormSubmissionValue row carries an entryIndex, so a repeating FormSection (isRepeating/minRepeat/maxRepeat already reserved on the model) has no way to store more than one entry's worth of values per submission.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260804_fv2_repeating_entry_index/migration.sql
  - packages/config/src/forms-rule-definition.ts
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/api/src/modules/forms/forms.service.ts
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/web/src/pages/forms/RepeatingSectionEntries.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "entryIndex" apps/api/prisma/schema.prisma && test -f apps/web/src/pages/forms/RepeatingSectionEntries.tsx && grep -q "has-any-entry-where" packages/config/src/forms-rule-definition.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: DROP COLUMN "entry_index" from "form_submission_values"; additive/nullable-with-default column, no data loss on rollback since existing (non-repeating) rows keep their implicit single-entry semantics.
---

# F-3 — repeating sections: entryIndex, designer toggle, fill UI, rule operators

## What exists on main

- `FormSection` (`apps/api/prisma/schema.prisma` ~L1832) already reserves `isRepeating` (Boolean,
  default false), `minRepeat` (Int?), `maxRepeat` (Int?) and a `conditions` Json column, but nothing
  reads them: per sot/06, "the fill page has zero references to repeating (grep of `FormFillPage.tsx`
  for `repeat`/`isRepeating`: no matches)". `apps/web/src/pages/forms/FormDesignerPage.tsx` has no UI to
  toggle a section as repeating or set min/max.
- `FormSubmissionValue` (`apps/api/prisma/schema.prisma` ~L2085) has no column distinguishing which
  repeat "entry" of a section a value belongs to — every value is implicitly entry 0.
- `packages/config/src/forms-rule-definition.ts` (landed in F-2a/F-2b) holds the shared
  `ConditionOperator` union and `evaluateCondition`/`evaluateConditionGroup` functions consumed by both
  `apps/api/src/modules/forms/rules-engine.service.ts` and `apps/web/src/pages/forms/FormFillPage.tsx`.
  Per sot/06 sequencing, F-2 (one evaluator) lands before F-3 specifically so there is a single place to
  teach these new repeating-section operators.

## What to build

1. **Schema**: add `entryIndex Int @default(0) @map("entry_index")` to `FormSubmissionValue`
   (`apps/api/prisma/schema.prisma`).
2. **Migration** `apps/api/prisma/migrations/20260804_fv2_repeating_entry_index/migration.sql`:
   `ALTER TABLE "form_submission_values" ADD COLUMN "entry_index" INTEGER NOT NULL DEFAULT 0;` — additive,
   existing rows default to entry 0 (their current implicit single entry).
3. **Designer** (`apps/web/src/pages/forms/FormDesignerPage.tsx`): add a per-section "Repeating section"
   toggle wired to `isRepeating`, plus min/max entry count inputs (`minRepeat`/`maxRepeat`) and an
   entry-label text field (persist the label in the section's existing `title`/description or a small
   addition to the section's own config — do not add a new column beyond `entryIndex` in this slice).
4. **Fill UI** — new `apps/web/src/pages/forms/RepeatingSectionEntries.tsx`: renders N entries of a
   repeating section's fields, with Add-entry / Remove-entry controls respecting `minRepeat`/`maxRepeat`,
   and namespaces each entry's values by `entryIndex` when building the submission payload. Wire it into
   `apps/web/src/pages/forms/FormFillPage.tsx` wherever a section has `isRepeating === true`.
5. **Persist entryIndex**: update `apps/api/src/modules/forms/forms.service.ts`'s submission-value
   creation path so each submitted value is written with its `entryIndex` instead of always defaulting
   to 0.
6. **Rule operators**: extend `packages/config/src/forms-rule-definition.ts`'s `ConditionOperator` union
   with `"has_any_entry_where"`, `"entry_count"`, and `"column_total"`, and implement their evaluation in
   the shared `evaluateCondition`/`evaluateConditionGroup` functions (operating over an array of
   per-entry value maps for a repeating section, not a single flat `ValueMap`). Update
   `apps/api/src/modules/forms/rules-engine.service.ts` call sites that build the `ValueMap` passed into
   evaluation so repeating sections' values are grouped by entry before evaluation.
7. Regenerate the data-model map: `node scripts/data-model/build-relationship-map.mjs`, commit the
   updated `docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
   `docs/data-model/metadata-catalog.json`.
8. Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations in
   `apps/api/src/modules/forms/__tests__/` that assert on the old (no-`entryIndex`) value-creation shape.
9. Put a bare `GATE-ALLOW: migrations` line at column 0 of the PR body.

GATE-ALLOW: migrations

## Do NOT

- Do not touch the rules-builder UI (`FormRulesBuilderPage.tsx`) or WARN/BLOCK actions — that's F-2c,
  which must land before this if not already on main.
- Do not add new field types (Lookup/Calculation/Unique ID/Terms/Table) — that's F-4.
- Do not touch Azure/Entra/SharePoint.
- Do not implement system-value conditions — still F-10, out of scope.

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
