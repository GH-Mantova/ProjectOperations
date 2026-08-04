---
premise: "! ls apps/api/prisma/migrations | grep -q fv2_formrule_contract"
premise_means: The fv2_formrule_contract migration that drops FormRule's legacy show/hide-style columns after soak has not been created yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/
  - apps/api/src/modules/forms/rules-engine.service.ts
  - apps/api/src/modules/forms/forms.service.ts
  - apps/api/src/modules/forms/dto/forms.dto.ts
  - apps/api/prisma/seed.ts
  - apps/api/prisma/seed-initial-services.ts
  - docs/data-model/relationship-map.json
  - docs/data-model/relationship-map.md
  - docs/data-model/metadata-catalog.json
done_when: pnpm build && pnpm lint && ls apps/api/prisma/migrations | grep -q fv2_formrule_contract && grep -c "sourceFieldKey" apps/api/prisma/schema.prisma | grep -q "^0$"
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: "This is a destructive column drop and is deliberately irreversible for the dropped column *values*: an earlier rules-storage slice already backfilled every legacy row (sourceFieldKey, targetFieldKey, operator, comparisonValue, effect) into the richer `definition` Json tree and both evaluators have been reading `definition` exclusively since that slice's soak period began — `definition` is the single source of truth by the time this migration runs, so no runtime code depends on the dropped columns. If a rollback is genuinely needed, add the five columns back as nullable in a follow-up migration and leave them NULL; do NOT attempt to reverse-populate them from `definition` in this PR or any rollback migration — that would reintroduce a second writable rule store and recreate exactly the drift risk section 3.5 eliminated. Confirm with `prisma migrate status` that this is the next unapplied migration before merging (any merge is a separate, later, human-driven step — this PR itself stays unmerged)."
---

# Contract slice — drop legacy FormRule columns after soak

`model FormRule` in `apps/api/prisma/schema.prisma` still carries its original primitive columns
(`sourceFieldKey`, `targetFieldKey`, `operator`, `comparisonValue`, `effect`) alongside the
richer `definition Json` grammar tree an earlier rules-storage slice added. Per
`sot/06-active-specs.md` section 3.5, those legacy columns were made nullable and inline-backfilled
into `definition` specifically so this contract slice could drop them once both evaluators
(`rules-engine.service.ts` server-side, `FormFillPage.tsx` client-side) have been reading only
`definition` through a full soak period. This slice performs that drop and removes every
remaining code path that reads or writes the legacy columns directly. **No new source file is
created by this slice** — the deliverable is the migration and the cleanup of the callers that
still reference the old columns: `forms.service.ts`'s `formRule.createMany` legacy insert path,
the `FormRuleInputDto` legacy fields on `forms.dto.ts` (already commented there as "Legacy
show/hide-style rule stored as a FormRule row — distinct from the richer JSON FieldRule
contract"), and the seed scripts (`apps/api/prisma/seed.ts` and
`apps/api/prisma/seed-initial-services.ts`) that still call `prisma.formRule.create` with
`sourceFieldKey` etc.

## What to build

1. **`apps/api/prisma/schema.prisma`** — drop `sourceFieldKey`, `targetFieldKey`, `operator`,
   `comparisonValue`, `effect` from `model FormRule`, keeping `name`, `isEnabled`, `timing`,
   `definition`. Add the migration under `apps/api/prisma/migrations/` (folder name containing
   `fv2_formrule_contract`).
2. **`GATE-ALLOW: migrations`** — put this bare line at column 0 of the PR body.
3. **`rules-engine.service.ts`** — remove any remaining fallback that reads the legacy columns
   directly; `definition` must be the only rule source read.
4. **`forms.service.ts`** — remove the `formRule.createMany` legacy-shape insert path (the
   `dto.rules` / `FormRuleInputDto` branch) or convert it to write `definition` only, per
   whichever the current `forms.dto.ts` comment indicates is still live.
5. **`forms.dto.ts`** — remove the now-dead legacy fields on `FormRuleInputDto` (or the whole DTO
   if nothing else references it after step 4).
6. **`seed.ts`** / **`seed-initial-services.ts`** — update every `prisma.formRule.create` /
   `formRule.deleteMany` call to the `definition`-only shape.
7. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json` + `.md` + `metadata-catalog.json`.
8. Update the affected `*.spec.ts` `toHaveBeenCalledWith(...)` expectations (`forms.service.spec.ts`,
   `CP-08-seed-idempotency.spec.ts` if it asserts on `formRule` shape) in the same PR.

## Do NOT

- Do not attempt to reverse-populate the dropped columns from `definition` anywhere in this PR.
- Do not touch `FormRule.definition`, `timing`, `isEnabled`, or `name` — those stay.
- Do not touch Azure/Entra/SharePoint, the push engine, or output channels.
- Do not merge this migration without confirming via `prisma migrate status` that no other
  unmerged migration is ordered ahead of it (house rule
  `reference_prisma_migration_ordering`) — and regardless, leave the PR unmerged per the standing
  authority note below.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if genuinely nothing to do, say `NO-OP: <reason>` and stop.
- Never ask for or wait on approval.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
- This PR must be opened and left UNMERGED — do not merge it under any circumstance.
