---
premise: '! grep -rqi "geofence" apps/api/src'
premise_means: Timesheets capture GPS clock points but there is no geofence auto clock-in/out or geofence-to-job binding.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/workers/**
  - apps/api/src/modules/scheduler/**
  - apps/web/src/pages/**
  - apps/web/src/field/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "geofence" apps/api/src
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap C/time | timesheet geofencing -->
# ERP gap — geofenced clock-in/out (GPS capture already exists)

STATUS: DRAFTED, STAGED, arm-eligible. NOTE (forensic): `Timesheet` ALREADY captures GPS
(`clockOnLat/Lng/Accuracy`, `clockOffLat/Lng/Accuracy`). The gap is GEOFENCING only — do NOT rebuild GPS
capture. QuickBooks Time parity: define a site geofence, auto-prompt clock-in/out on entry/exit, and bind
time to the right job by geofence.

## What to build
Branch: `feat/erp-timesheet-geofencing`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `SiteGeofence` (siteId/jobId, centre lat/lng, radiusMetres, isActive) — reuse the existing
   `Site` record's coordinates if present.
2. API — on clock-on/off, evaluate the captured lat/lng against active geofences; flag in/out-of-geofence on
   the timesheet; expose a "which job geofence am I in" lookup for the field app to prompt the right job.
3. Web/field PWA — geofence-entry clock-in reminder + auto-select the job whose geofence the worker is in;
   admin UI to draw/set a site geofence (centre + radius).

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT rebuild GPS clock capture (it exists). Do NOT add continuous background tracking (privacy) — only
  clock-event + on-demand geofence checks. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
