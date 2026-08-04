---
premise: ! grep -q "model FormFieldPushBinding" apps/api/prisma/schema.prisma
premise_means: There is no FormFieldPushBinding table and no post-commit push executor — the only trigger writes today are the three hardcoded create_record cases in forms-engine.service.ts.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/src/modules/forms/push-executor.service.ts
  - apps/api/src/modules/forms/forms.module.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model FormFieldPushBinding" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/forms/push-executor.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Drop the FormFieldPushBinding table and the status/lastError/attempts columns added to FormTriggeredRecord (fv2_push_bindings); no backfill was written, so both drops are safe.
---

# Forms Engine v2 — push engine core (F-9a)

`FormTriggeredRecord` already exists in `apps/api/prisma/schema.prisma`
(submission → created-record audit link) and is already written to by three
hardcoded triggers in `apps/api/src/modules/forms/forms-engine.service.ts`
(`safety_incident` L594, `hazard_observation` L617, `maintenance_job` L641,
each logged via the row-locking `nextSeq` helper at L851). There is no
`FormFieldPushBinding` table and no general executor — pushes today are
three special-cased branches. This slice (F-9a, the first half of the F-9
flagship, split for size) builds the storage and the generic post-commit
executor **without** any UI or the Plant Pre-Start bindings — those are
F-9b, chained after this slice.

## What to build

- Add to `apps/api/prisma/schema.prisma`:
  ```
  model FormFieldPushBinding {
    id            String   @id @default(cuid())
    fieldId       String
    targetModule  String
    targetAction  String
    applyOn       String   @default("submit")
    config        Json     @default("{}")
    isEnabled     Boolean  @default(true)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }
  ```
  with `fieldId` → `FormField` (Cascade). `FormTriggeredRecord` (schema,
  `id`/`submissionId`/`recordType`/`recordId`/`createdAt`, 6 columns total —
  no status/error tracking today) needs `status String @default("success")`,
  `lastError String?`, and `attempts Int @default(1)` added so failed and
  retried pushes are visible on the same audit spine rather than a new
  table. Migration
  `apps/api/prisma/migrations/<timestamp>_fv2_push_bindings/migration.sql` —
  new `FormFieldPushBinding` table plus the three new nullable/defaulted
  `FormTriggeredRecord` columns, no backfill (existing rows default to
  `status = "success"`, which is correct — they all succeeded).
- Create `apps/api/src/modules/forms/push-executor.service.ts`
  (`PushExecutorService`): given a sealed `FormSubmission` and an `applyOn`
  stage (`"submit"` | `"approval"`), loads all enabled
  `FormFieldPushBinding` rows for that submission's template-version fields
  matching the stage, and for each:
  1. Resolves the target record from the binding's `config` (e.g.
     `config.assetFromFieldKey` names the field whose submitted value is the
     target asset id) against the submission's `FormSubmissionValue` rows.
  2. Dispatches to the owning module by `targetModule`/`targetAction` —
     stub the dispatch as an injectable map/strategy so F-9b can register the
     Plant Pre-Start actions (`record_usage_reading`, defect creation,
     Major-severity flag) without touching this executor's core loop.
  3. On success, writes a `FormTriggeredRecord` row linking the submission to
     the created/updated record — exactly the pattern the three hardcoded
     triggers already use at L564.
  4. On failure (owning module throws), the push is marked failed but **the
     submission save is never rolled back** — section 4.4's locked
     principle: a push failure never holds compliance data hostage. Write a
     `FormTriggeredRecord` row with `status = "failed"` and `lastError` set
     to the caught error's message, so failures are visible on the same
     audit spine rather than a new table.
  Make execution **idempotent**: re-running the executor for a submission
  that already has a `FormTriggeredRecord` for a given binding must not
  create a duplicate record.
- Wire `PushExecutorService` into `forms.module.ts` and call it from
  `forms-engine.service.ts`/`forms-engine.controller.ts`'s existing submit
  flow (`POST /forms-engine/submissions/:id/submit`, controller L96) for
  `applyOn = "submit"` bindings, **after** the submission save (step 2 of the
  documented flow in `sot/06-active-specs.md` §4.2) and **only** once the
  submission is sealed (F-5's `sealedAt`) — a push never fires on an
  unsealed submission.
- Add a minimal retry entry point (a method on `PushExecutorService`, e.g.
  `retryFailedPushes(submissionId)`) that F-9b's UI will call — no HTTP route
  is required in this slice unless trivially adding one to
  `forms-engine.controller.ts`.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the
  regenerated `docs/data-model/relationship-map.json`, `.md`, and
  `metadata-catalog.json`.
- Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations touched by
  the new schema table.

## Do NOT

- Do not build the Push tab UI, the properties panel, or any Plant
  Pre-Start-specific binding — that is F-9b, chained after this slice.
- Do not call `AssetsService.recordUsageReading` or any concrete
  targetModule handler yet — stub the dispatch surface only; F-9b registers
  the real Plant Pre-Start actions.
- Do not touch the apply-on-approval toggle UI — F-9b.
- Do not touch Azure/Entra/SharePoint.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — if something in scope cannot be completed,
say `NO-OP: <reason>` and stop. Never ask or stand by for approval. Read the
CI job log before diagnosing any failure. `pnpm build` and `pnpm lint` must
both pass before pushing.
