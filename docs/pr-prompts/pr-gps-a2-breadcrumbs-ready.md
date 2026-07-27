---
premise: '! grep -rqi "breadcrumb" apps/api/src/modules/field apps/web/src/pages/field'
premise_means: No breadcrumb trail exists between clock-on and clock-off yet.
requires_file_on_main: apps/web/src/pages/field/useAutoGps.ts
scope:
  - apps/web/src/pages/field/useBreadcrumbTrail.ts
  - apps/web/src/pages/field/FieldTimesheetPage.tsx
  - apps/api/src/modules/field/field.controller.ts
  - apps/api/src/modules/field/field.service.ts
  - apps/api/src/modules/field/dto/field.dto.ts
  - apps/api/src/modules/workers/live-crew.service.ts
  - apps/api/src/modules/workers/live-crew.controller.ts
  - apps/api/src/modules/workers/__tests__/live-crew.service.spec.ts
  - apps/web/src/pages/workers/**
done_when: pnpm lint && grep -rq "breadcrumb" apps/api/src/modules/field
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# GPS-A2 - Breadcrumb trail while on the clock (track-while-app-open, honest gaps)

Marco-approved slice plan (2026-07-27), slice 2 of 3. Depends on GPS-A1
(deferred automatically until `useAutoGps.ts` is on main).

TSheets-parity background tracking is NOT possible in a browser/PWA - mobile
browsers stop geolocation when backgrounded. Marco accepted option A: capture a
breadcrumb trail whenever the app is OPEN between clock-on and clock-off, and render
the gaps HONESTLY. Full parity is a separate native-wrapper backlog item.

## What to build

1. Hook `apps/web/src/pages/field/useBreadcrumbTrail.ts`: while the worker is on the
   clock (open timesheet: clockOnTime set, clockOffTime null) and the page is open,
   sample location at most once per 180s (getCurrentPosition on an interval is fine;
   watchPosition + throttle also fine). Skip the POST when the new point is <25m from
   the last sent point. Stop sampling the moment the worker clocks off or consent is
   revoked. No wake locks, nothing when the tab is hidden (document.visibilityState).
2. API: POST `/field/location-breadcrumbs` (field.controller/service/dto). Validates:
   worker has locationConsent, worker has an OPEN timesheet - otherwise 409/403.
   Writes WorkerLocationLog { eventType: "breadcrumb", timesheetId: <open shift> }.
   NO new table, NO migration - worker_location_logs already fits
   (schema.prisma ~L4616). Server-side floor: reject if the last breadcrumb for that
   timesheet is <120s old (client bugs must not flood the table).
3. Live crew (apps/api/src/modules/workers/live-crew.service.ts): whosWorking() lat/lng
   becomes the LATEST of clock-on pin vs newest breadcrumb for the open timesheet.
   New GET `/workers/live-crew/:workerProfileId/trail` returning the open shift's
   ordered points (clock-on pin + breadcrumbs) with recordedAt.
   REWRITE the stale comment at the top of the service ("we do NOT introduce
   continuous background tracking") to state the new deliberate doctrine: tracking
   runs ONLY while on the clock AND the app is open; it stops dead at clock-off.
4. Live Crew map page (apps/web/src/pages/workers/): clicking a worker shows the trail
   (polyline/dots) for the current shift. HONEST GAPS: any span >10 min between points
   renders as an explicit gap ("no data - app closed or offline"), never interpolated,
   never smoothed.
5. Visibility: trail endpoint restricted to the same permission that gates the Live
   Crew page today. Workers may fetch their own trail.
6. Tests: unit specs for the new service logic (validation, floor, latest-point
   selection, trail ordering) + update live-crew.service.spec.ts.

## Do NOT

- No migration, no schema.prisma change.
- No background/native APIs, no service-worker geolocation, no wake locks.
- No tracking outside an open shift - the server MUST reject those points.
- No retention change - rows live and die with existing timesheet retention.
- No sot/ edits (CP-24).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails

One attempt; never exit silently (say `NO-OP: <reason>`); never ask a question or
"stand by" for approval; read the job log before diagnosing any CI failure.
