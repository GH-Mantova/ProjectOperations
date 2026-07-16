---
premise: '! grep -rqi "whosWorking\|liveCrewMap\|crew-map\|whos_working" apps/api/src apps/web/src'
premise_means: There is no live "who is working / where" map from clock-on GPS points.
scope:
  - apps/api/src/modules/workers/**
  - apps/api/src/modules/scheduler/**
  - apps/web/src/pages/**
done_when: pnpm build && pnpm lint && grep -rqi "whosWorking\|liveCrewMap\|crew-map" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: DO-NOT-ARM (arm after geofencing) | ERP gap C/time | live crew map -->
# HOLD — ERP: live "who's working / nearest worker" map

STATUS: DRAFTED, STAGED, **DO NOT ARM** until `pr-erp-timesheet-geofencing` has merged (shares the site/geo
plumbing). NOTE: `Timesheet.clockOnLat/Lng` already exist, so the data is there — this is a read/visualise
layer. QuickBooks Time parity. Arm after geofencing.

## What to build (when armed)
Branch: `feat/erp-live-crew-map`. Reviewer: `GH-Mantova`. No migration expected.
1. API — a "currently on the clock" query (clock-on without clock-off) returning worker + last known
   lat/lng + job; a "nearest available worker to a point" helper for reactive dispatch.
2. Web — a live map of on-clock crew + assets; click to see job; nearest-worker lookup.

## Do NOT
- Do NOT add continuous background location tracking (privacy) — use existing clock points only. Do NOT
  touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
