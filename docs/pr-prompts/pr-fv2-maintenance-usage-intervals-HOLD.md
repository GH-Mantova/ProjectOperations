---
premise: ! grep -q "intervalUsage" apps/api/prisma/schema.prisma
premise_means: AssetMaintenancePlan has no usage-based interval columns yet — it is calendar-only (intervalDays/warningDays/nextDueAt).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/maintenance/maintenance.service.ts
  - apps/api/src/modules/maintenance/dto/maintenance.dto.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "intervalUsage" apps/api/prisma/schema.prisma && grep -q "usageWarningPct" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Drop the intervalUsage/usageUnit/lastCompletedReading/nextDueReading/usageWarningPct columns on AssetMaintenancePlan (fv2_maintenance_usage_intervals); all are nullable or have a default with no backfill, so the drop is safe.
---

# Forms Engine v2 — maintenance usage intervals (F-8)

`model AssetMaintenancePlan` in `apps/api/prisma/schema.prisma` is
calendar-only today: `intervalDays`, `warningDays`, `lastCompletedAt`,
`nextDueAt`. `apps/api/src/modules/maintenance/maintenance.service.ts`
(`MaintenanceService.upsertEvent`) rolls `nextDueAt` forward by
`intervalDays` on event completion (`calculateNextDueAt`) but has no
usage-based equivalent. `apps/api/src/modules/platform/notifications.service.ts`
already exists and is the existing notification machinery every other
module reuses for reminders (`corrective-actions.service.ts`,
`compliance.service.ts`, `scheduler.service.ts`, etc. all inject
`NotificationsService` from `platform/notifications.service.ts`). This slice
adds usage-based maintenance intervals as an *additional*, optional
threshold alongside the existing calendar one — a plan may be days-based,
usage-based, or both.

## What to build

- Add to `model AssetMaintenancePlan` (all nullable/defaulted, existing
  plans behave identically): `intervalUsage Decimal?`, `usageUnit String?`
  (`"hours"` | `"km"`), `lastCompletedReading Decimal?`,
  `nextDueReading Decimal?`, `usageWarningPct Int @default(90)`. Migration
  `apps/api/prisma/migrations/<timestamp>_fv2_maintenance_usage_intervals/migration.sql`.
- In `MaintenanceService`, add a recompute path invoked in two places:
  1. When a reading is recorded for an asset (this slice adds the consumer
     side — the actual `AssetUsageReading` insert lives in the assets module
     from F-7; call the recompute from wherever this service already reacts
     to asset state, or expose a `recomputeUsageIntervals(assetId, unit,
     reading)` method the assets module's `recordUsageReading` can call
     after F-7 lands). For every `ACTIVE` plan on that asset with
     `intervalUsage` set for the matching `usageUnit`, compute
     `nextDueReading = lastCompletedReading + intervalUsage` (or from the
     first reading if `lastCompletedReading` is null).
  2. On maintenance event completion (`upsertEvent`, mirroring the existing
     `calculateNextDueAt` days roll): when the event's plan has
     `intervalUsage` set, set `lastCompletedReading` to the asset's current
     reading for that unit and roll `nextDueReading` forward by
     `intervalUsage`.
  When the current reading crosses `usageWarningPct` percent of the way from
  `lastCompletedReading` to `nextDueReading`, call `NotificationsService`
  (inject it into `MaintenanceService` the same way `corrective-actions.service.ts`
  and `scheduler.service.ts` already do) to raise a reminder — do not build a
  parallel notification path.
- A plan may have either threshold, both, or neither; whichever trips first
  drives the derived maintenance state (`buildMaintenanceSummary` already
  computes `DUE_SOON`/`OVERDUE` from the calendar threshold — extend it to
  also consider the usage threshold when present, without changing behaviour
  for plans that only set `intervalDays`).
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the
  regenerated `docs/data-model/relationship-map.json`, `.md`, and
  `metadata-catalog.json`.
- Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations touched by
  the new schema columns (`apps/api/src/modules/maintenance/maintenance.service.spec.ts`).

## Do NOT

- Do not implement `AssetsService.recordUsageReading` or the
  `AssetUsageReading` table — that is F-7; this slice depends on it landing
  first and only consumes readings it produces.
- Do not add a new notification channel — reuse
  `platform/notifications.service.ts` exactly as every other module does.
- Do not add any forms code or the push engine — that is F-9.
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
