---
premise: ! grep -q "location_stamp" apps/web/src/pages/forms/formDesignerState.ts
premise_means: The forms designer's FieldType union has no WHS field types yet (worker_picker, asset_picker, location_stamp) and FormSignature/FormSubmission carry no seal columns.
scope:
  - apps/web/src/pages/forms/formDesignerState.ts
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/web/src/pages/forms/FormDesignerPage.tsx
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "location_stamp" apps/web/src/pages/forms/formDesignerState.ts && grep -q "sealedAt" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Drop the sealedAt column on FormSubmission and the signedById/requiredRole columns on FormSignature via a down migration; no backfill was written so the drop is safe.
---

# Forms Engine v2 — WHS field wave (F-5)

`apps/web/src/pages/forms/formDesignerState.ts` currently defines the `FieldType`
union with basic/choice/survey/layout/advanced types plus `signature` and
`image_capture` in the "Site & WHS" palette group (`PALETTE_GROUPS`, key
`site_whs`). `apps/api/prisma/schema.prisma` has `model FormSignature` (signer
name + timestamps only, no role gating) and `model FormSubmission` (no
`sealedAt`). `apps/web/src/pages/forms/FormFillPage.tsx` already renders a
basic signature pad and photo capture. This slice adds the WHS field wave: a
Worker picker, an Asset picker, a Location stamp, upgraded Photo config, and
Signature v2 with role-gated locking and submission sealing.

## What to build

- In `apps/web/src/pages/forms/formDesignerState.ts`: add `"worker_picker"`,
  `"asset_picker"`, `"location_stamp"` to the `FieldType` union and to the
  `site_whs` entry of `PALETTE_GROUPS`. Give each a `defaultConfigFor` entry:
  - `worker_picker`: `{ prefillFromAllocation: true, checkCompetency: false }`
  - `asset_picker`: `{ siteFiltered: true, showServiceWarnings: true }`
  - `location_stamp`: `{}` (captures lat/lng automatically at fill time, no
    authored config needed)
  Extend `image_capture`'s config shape (still keyed off the existing type —
  no new FieldType needed) with `{ minCount, cameraOnly, stampLocation,
  stampTime, allowAnnotation }` defaults.
- Create the picker field components (new files) that `FormFillPage.tsx`
  renders for `worker_picker` / `asset_picker` / `location_stamp` field types:
  - Worker picker: fetches today's allocation for the current filler (reuse
    the same context auto-fill data `forms-engine.service.ts` already
    computes at draft-create — L105-138 — for the filler's active
    timesheet/allocation) to pre-select a default worker, and runs a
    competency check via the existing compliance module before allowing
    submission (surface a warning, do not silently pass).
  - Asset picker: lists assets filtered to the submission's `siteId`
    (`FormSubmission.siteId` already exists) and surfaces the asset's
    `maintenanceSummary`/service warnings (the same derived summary
    `AssetsService`/`MaintenanceService` already compute — call the existing
    read endpoint, do not duplicate the derivation).
  - Location stamp: captures `navigator.geolocation` at fill time and stores
    lat/lng in `FormSubmissionValue` (reuse the existing GPS handling already
    present in `FormFillPage.tsx` for `FormSubmission.lat`/`lng`, do not
    invent a parallel store).
  Wire the new component's file into `FormFillPage.tsx`'s field-type switch.
- Photo upgrades: extend the existing photo-capture path in
  `FormFillPage.tsx` (case `photo`/`image_capture`) to honour
  `config.minCount` (block submit below the minimum), `config.cameraOnly`
  (skip the file-picker fallback), `config.stampLocation`/`stampTime` (burn a
  visible location/timestamp caption onto the captured image), and
  `config.allowAnnotation` (surface an annotate affordance — a simple
  freehand overlay is sufficient, do not build a full drawing library).
- Signature v2: add `requiredRole String?` and `signedById String?` to
  `model FormSignature` and `sealedAt DateTime?` to `model FormSubmission` in
  `apps/api/prisma/schema.prisma`. Migration
  `apps/api/prisma/migrations/<timestamp>_fv2_signature_seal/migration.sql` —
  nullable columns only, no backfill. In `forms-engine.service.ts`, when a
  signature field with `config.requiredRole` is signed, verify the signer
  holds that role (reuse the existing permissions/role lookup already used
  elsewhere in this service — do not add a new auth mechanism), record
  `signedById`, and when the signing field is configured to seal the form,
  set `FormSubmission.sealedAt = now()`. Once `sealedAt` is set, reject
  further value PATCHes in `forms-engine.controller.ts`'s PATCH values route
  with a 409 — sealing locks the form.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the
  regenerated `docs/data-model/relationship-map.json`, `.md`, and
  `metadata-catalog.json`.
- Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations touched by
  the new schema columns.

## Do NOT

- Do not build the push-engine bindings (`FormFieldPushBinding`) — that is
  F-9, gated on this slice landing.
- Do not build the weather field or touch `platform/weather.service.ts` —
  that is F-6.
- Do not touch `AssetUsageReading`, `AssetsService.recordUsageReading`, or
  any assets-module write path — that is F-7. The asset picker here only
  *reads* asset data.
- Do not touch Azure/Entra/SharePoint.
- Do not drop or rename the legacy `FormRule` columns (`sourceFieldKey`,
  `operator`, `comparisonValue`, `effect`) — out of scope (F-2's contract
  slice, not this one).

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
