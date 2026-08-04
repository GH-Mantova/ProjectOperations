---
premise: ! grep -q "FormNumberSequence" apps/api/prisma/schema.prisma
premise_means: There is no FormNumberSequence model, so a "Unique ID" field type has no atomic row-locked counter to generate from — the field type does not exist on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/20260804_fv2_form_number_sequence/migration.sql
  - apps/api/src/modules/forms/form-number-sequence.service.ts
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "FormNumberSequence" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/forms/form-number-sequence.service.ts
size: 7
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: DROP TABLE "form_number_sequences"; additive-only table, no existing data touched, safe to drop on rollback since nothing else references it yet.
---

# F-4 — Forms Engine v2 field types, wave 1

## What exists on main (ground truth — read before touching anything)

`apps/web/src/pages/forms/FormFillPage.tsx` already renders several of the field types this wave was
scoped for, so **do not rebuild what's already there** — extend only the genuinely missing pieces:

- **Table** (`case "table"` ~L1858, `TableInput`) — fully built: repeating rows of typed columns backed
  by `FormField.config.columns`. Leave as-is.
- **Terms & acceptance** (`case "terms"` ~L1403, `TermsInput` ~L2075) — fully built: renders
  `config.termsText`, records `{ accepted: true, version, acceptedAt }` on the submission value, and
  `apps/api/src/modules/forms/rules-engine.service.ts`'s `validateValues` already treats an un-accepted
  terms field as "missing" for required validation. Leave as-is.
- **Lookup** (`case "lookup"` ~L1395, `LookupInput` ~L1671) — built for a single flat Global List
  (`config.listSlug` → `GET /lists/:slug/items`, backed by `GlobalList`/`GlobalListItem` in
  `apps/api/prisma/schema.prisma`). It has NO support for a lookup whose options depend on another
  field's selected value ("nested" lookup) — that is the gap to close.
- **Calculation** (`case "calculation"` ~L1399, `CalculationDisplay` ~L1813) — currently a **stub**: it
  reads `config.operation` and `config.operandKeys` but only renders static label text ("Auto-calculated
  (sum of N fields)") — it never actually sums/computes the operand values. That is the gap to close.
- **Unique ID** — does NOT exist as a field type anywhere, and there is no `FormNumberSequence` model.
  The established pattern for atomic sequential numbering already exists for five other domains
  (`SafetyIncidentNumberSequence`, `DocketNumberSequence`, `CaseNumberSequence`,
  `ContractNumberSequence`, `JobNumberSequence` — all in `apps/api/prisma/schema.prisma`, each a
  `{ id Int @id @default(1), lastNumber Int @default(0) @map("last_number") }` row-locked counter).

## What to build

1. **Schema**: add `model FormNumberSequence { id Int @id @default(1); lastNumber Int @default(0)
   @map("last_number"); @@map("form_number_sequences") }` to `apps/api/prisma/schema.prisma`, following
   the exact `SafetyIncidentNumberSequence` shape/pattern.
2. **Migration** `apps/api/prisma/migrations/20260804_fv2_form_number_sequence/migration.sql`:
   `CREATE TABLE "form_number_sequences" ("id" INTEGER PRIMARY KEY DEFAULT 1, "last_number" INTEGER NOT
   NULL DEFAULT 0);` — mirror `apps/api/prisma/migrations/20260426_feat_safety_forms/migration.sql`'s
   sequence table exactly.
3. **New service** `apps/api/src/modules/forms/form-number-sequence.service.ts`: a row-locked
   `SELECT ... FOR UPDATE` + increment against `FormNumberSequence` (mirror whatever locking pattern the
   existing safety-incident number service uses in this codebase), exposing a method that returns the
   next formatted unique ID string (prefix/padding driven by the field's `FormField.config`, e.g.
   `config.prefix` + zero-padded `lastNumber`).
4. Wire it into `apps/api/src/modules/forms/forms-engine.service.ts`'s submission-create path: when a
   template version has a field with `fieldType === "unique_id"`, call the new service and write the
   generated ID as that field's submission value (server-generated, not user-entered).
5. **FormFillPage.tsx**: add a `case "unique_id"` render — read-only display of the value once generated
   (client never generates it; it shows what the server assigned, or a "will be assigned on submit"
   placeholder before first save).
6. **FormFillPage.tsx — fix Calculation**: make `CalculationDisplay` actually compute
   `operation` (`sum`/`average`/etc.) over the current values of `operandKeys` from the live `ValueMap`
   the page already tracks, and render the computed number instead of the static placeholder text.
7. **FormFillPage.tsx — nested Lookup**: extend `LookupInput` so `config` can specify a
   `dependsOnFieldKey`; when set, refetch/filter the `GET /lists/:slug/items` call (or an equivalent
   nested-list endpoint if the list API already supports a parent filter — check
   `apps/api/src/modules/global-lists/global-lists.service.ts` before adding new API surface) using the
   current value of the field named by `dependsOnFieldKey`.
8. **FormDesignerPage.tsx**: add "Unique ID" to the field-type palette, with a config panel for
   prefix/padding; add a "Depends on field" selector to the Lookup field's config panel.
9. Regenerate the data-model map: `node scripts/data-model/build-relationship-map.mjs`, commit the
   updated `docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
   `docs/data-model/metadata-catalog.json`.
10. Put a bare `GATE-ALLOW: migrations` line at column 0 of the PR body.

GATE-ALLOW: migrations

## Do NOT

- Do not rebuild Table or Terms & acceptance — both are complete on main; touch them only if a shared
  helper you add genuinely requires it.
- Do not touch the rules builder, WARN/BLOCK, or repeating sections (F-2c / F-3).
- Do not touch Azure/Entra/SharePoint.
- Do not add a new Global Lists API surface if `global-lists.service.ts` already supports filtering by a
  parent value — check first.

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
