---
premise: ! grep -q "recordUsageReading" apps/api/src/modules/assets/assets.service.ts
premise_means: AssetsService has no recordUsageReading method and Asset/schema.prisma has no meter-reading table or denormalised current-reading columns yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/assets/assets.service.ts
  - apps/api/src/modules/assets/assets.controller.ts
  - apps/api/src/modules/assets/assets.module.ts
  - apps/api/src/modules/assets/dto/assets.dto.ts
  - apps/web/src/pages/assets/AssetDetailPage.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "recordUsageReading" apps/api/src/modules/assets/assets.service.ts && grep -q "model AssetUsageReading" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Drop the AssetUsageReading table (fv2_asset_usage_reading) and drop the currentHoursReading/currentKmReading/lastReadingAt nullable columns on Asset (fv2_asset_current_reading_denorm); no backfill was written for either migration so both drops are safe.
---

# Forms Engine v2 — asset usage readings (F-7, assets module only)

`apps/api/src/modules/assets/assets.service.ts` (`AssetsService`) currently
covers categories, asset CRUD, checkout/check-in custody tracking, and
barcode/QR scan lookup — it has no meter-reading concept. `model Asset` in
`apps/api/prisma/schema.prisma` has no meter fields at all. This is an
**assets-module slice with no forms code**: it lays the append-only reading
history and denormalised current-reading columns that the push engine (F-9)
will later write into via this service — never directly.

## What to build

- Add to `apps/api/prisma/schema.prisma`:
  ```
  model AssetUsageReading {
    id                 String   @id @default(cuid())
    assetId            String
    unit               String
    reading            Decimal  @db.Decimal(12,1)
    previousReading    Decimal? @db.Decimal(12,1)
    recordedAt         DateTime @default(now())
    recordedById       String?
    sourceSubmissionId String?
    isMeterReplacement Boolean  @default(false)
    note               String?
    @@index([assetId, unit, recordedAt])
  }
  ```
  with FKs: `assetId` → `Asset` (Cascade), `recordedById` → `User`
  (SetNull), `sourceSubmissionId` → `FormSubmission` (SetNull). Migration
  `apps/api/prisma/migrations/<timestamp>_fv2_asset_usage_reading/migration.sql`
  — new table only, no backfill.
- Add to `model Asset`: `currentHoursReading Decimal?`,
  `currentKmReading Decimal?`, `lastReadingAt DateTime?`. Migration
  `apps/api/prisma/migrations/<timestamp>_fv2_asset_current_reading_denorm/migration.sql`
  — nullable columns, no backfill (no historical readings exist yet).
- Add `AssetsService.recordUsageReading(assetId, dto, actorId)`: looks up the
  asset's last reading for the given `unit` (`hours` | `km`), **rejects a
  reading below the last recorded one** unless `dto.isMeterReplacement` is
  true, and **`isMeterReplacement` may only be set by a caller holding the
  Asset Manager or Warehouse Manager role** (check the same way existing
  `AssetsService` methods authorize — via the caller's role, not a new
  mechanism). On success: inserts the `AssetUsageReading` row (with
  `previousReading` snapshotted) and updates `Asset.currentHoursReading` /
  `currentKmReading` + `lastReadingAt` in a single Prisma transaction (mirror
  the transaction pattern `MaintenanceService.updateAssetStatus` already
  uses), then writes an `assets.usage-reading.create` audit entry via
  `AuditService` (already injected into `AssetsService`). Throw
  `ConflictException` on a rejected reading, `NotFoundException` on an
  unknown asset — the same exception vocabulary the rest of the service
  uses.
- Add a controller route (e.g. `POST /assets/:id/usage-readings` and
  `GET /assets/:id/usage-readings`) on `assets.controller.ts`, guarded the
  same way every other route on that controller is
  (`JwtAuthGuard`/`PermissionsGuard`), plus DTOs in
  `apps/api/src/modules/assets/dto/assets.dto.ts`.
- Add a readings-history section to `apps/web/src/pages/assets/AssetDetailPage.tsx`
  (a simple reverse-chronological list — reuse the page's existing
  table/list patterns for maintenance plans/events, do not build a new
  design system component).
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the
  regenerated `docs/data-model/relationship-map.json`, `.md`, and
  `metadata-catalog.json`.
- Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations touched by
  the new schema columns (`apps/api/src/modules/assets/__tests__/assets.service.spec.ts`
  and/or `apps/api/src/modules/assets/assets.service.spec.ts`).

## Do NOT

- Do not add any forms code, any `FormFieldPushBinding` table, or wire this
  into the forms fill/submit pipeline — that is F-9, which depends on this
  slice landing first.
- Do not touch `apps/api/src/modules/maintenance/*` — usage-interval
  recompute is F-8, a separate slice that depends on this one.
- Do not touch `platform/weather.service.ts` or any forms field types.
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
