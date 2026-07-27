---
premise: grep -q "captureGps" apps/web/src/pages/field/FieldTimesheetPage.tsx
premise_means: The field timesheet still uses manual GPS pin buttons; mandatory auto-capture with hard-block is not built yet.
scope:
  - apps/web/src/pages/field/useAutoGps.ts
  - apps/web/src/pages/field/FieldTimesheetPage.tsx
  - apps/api/src/modules/field/field.service.ts
  - apps/api/src/modules/field/dto/field.dto.ts
  - apps/api/src/modules/field/__tests__/**
  - tests/e2e/pr-acceptance/batch7-field.spec.ts
done_when: pnpm lint && grep -q "useAutoGps" apps/web/src/pages/field/FieldTimesheetPage.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# GPS-A1 - Mandatory auto-captured GPS on clock-on/clock-off (hard-block)

Marco-approved slice plan (2026-07-27, PR Master session), slice 1 of 3.
Ruling: GPS on clock events moves from OPT-IN + MANUAL PIN to MANDATORY + AUTOMATIC.
"Hard-block clock-on or out without GPS" - Marco, verbatim.

## Already on main (build on it, do not rebuild)

- PR #84/#85: Timesheet clockOn/OffLat/Lng/Accuracy columns, WorkerLocationLog table,
  `/field/location-consent` GET+POST, WorkerProfile.locationConsent, manual
  `captureGps` pin buttons in FieldTimesheetPage.tsx (~line 258).
- Site geofencing (20260716140000): clock-on point auto-matches a geofence and
  auto-picks the job (`autoPickJobFromGeofence`). Keep this working - it now runs
  off the auto-captured point.

## What to build

1. New hook `apps/web/src/pages/field/useAutoGps.ts`: promise-wrapped
   `navigator.geolocation.getCurrentPosition` (enableHighAccuracy, 10s timeout,
   maximumAge 0) returning `{lat,lng,accuracy}` or a typed failure
   (unsupported | denied | timeout | unavailable).
2. FieldTimesheetPage: DELETE the manual pin buttons + `captureGps`. On submit,
   when clockOnTime and/or clockOffTime is set, auto-capture via the hook and attach
   the reading(s). HARD-BLOCK: any capture failure => inline error
   "Location is required to clock on/off. Enable location for this site, or see your
   supervisor to have the entry recorded." - and do NOT submit.
3. Consent becomes an acknowledgement (condition of use), not an opt-out: if
   `locationConsent` is false, show an acknowledgement panel (what is captured, when,
   who sees it, that capture stops at clock-off) with one button that POSTs
   `/field/location-consent {consent:true}`. Until acknowledged, clock fields stay
   disabled with the same hard-block message. Remove the silent-drop UX.
4. API hard gate in `/field` timesheet create/update (field.service.ts + field.dto.ts):
   clockOnTime present without clockOnLat/Lng => 400; same for clock-off. Keep
   accuracy optional. Do NOT touch the admin/desktop timesheet endpoints - they are
   the supervisor fallback for a worker whose phone cannot produce GPS.
5. Keep WorkerLocationLog writes exactly as they are.
6. Tests: update field service unit specs (`toHaveBeenCalledWith` payloads + new 400
   paths). batch7-field.spec.ts: replace the pin-button spec with auto-capture using
   `context.grantPermissions(["geolocation"])` + `context.setGeolocation(...)`, and
   ADD a deny-path spec (permission denied => hard-block error visible, no POST).

## Do NOT

- No prisma migration, no schema.prisma change (columns already exist).
- No sot/ edits - the SoT Keeper reconciles the "GPS optional" doctrine line after
  merge (CP-24).
- No breadcrumb trail (slice A2), no other surfaces (slice A3).
- Do not weaken seed-users-prod.ts, assertNoDevSeedUsers, or the e2e persona seed.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

## Guardrails

One attempt; never exit silently (say `NO-OP: <reason>`); never ask a question or
"stand by" for approval; read the job log before diagnosing any CI failure.
