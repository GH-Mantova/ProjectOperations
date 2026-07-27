---
premise: '! grep -rqi "useAutoGps" apps/web/src/pages/sites apps/web/src/pages/forms'
premise_means: Site attendance, muster and form-fill surfaces do not use the mandatory auto-GPS capture yet.
requires_file_on_main: apps/web/src/pages/field/useAutoGps.ts
scope:
  - apps/web/src/pages/sites/MusterPage.tsx
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/sites/dto/site-attendance.dto.ts
  - apps/api/src/modules/sites/**
  - apps/api/src/modules/safety/muster.controller.ts
  - apps/api/src/modules/safety/muster.service.ts
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/web/src/pages/field/**
done_when: pnpm lint && grep -rq "useAutoGps" apps/web/src/pages/forms/FormFillPage.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# GPS-A3 - Mandatory GPS across all field surfaces (attendance, muster, forms)

Marco-approved slice plan (2026-07-27), slice 3 of 3 ("all fields" - Marco).
Depends on GPS-A1 (deferred until `useAutoGps.ts` is on main).

## What to build

1. Site attendance check-in/out and muster check-in (field-facing surfaces): capture
   GPS automatically via the shared `useAutoGps` hook at the moment of the event and
   HARD-BLOCK the action with the same standard error when no fix is available.
   Storage WITHOUT migration: write a WorkerLocationLog row
   (eventType "site_attendance" | "muster") at event time - worker + timestamp +
   eventType is the audit correlation. Do NOT add columns to site_attendance or
   muster tables in this slice.
2. Forms (FormFillPage.tsx already captures GPS when the template enables it, via
   getCurrentPosition ~line 419): when the template enables geolocation, make the
   capture MANDATORY for AUTHENTICATED submitters - client hard-block on failure, and
   forms-engine.service.ts returns 400 when the template requires GPS and lat/lng are
   missing. PUBLIC-LINK submissions keep GPS optional (external people, no policy
   footing to demand location) - server exemption must be explicit and commented.
3. Reuse the exact hard-block copy and acknowledgement gating from A1 - one shared
   component/constant, not three copies.
4. Tests: unit specs for the new 400 paths (forms-engine, attendance/muster services)
   and updates to any specs whose payload assertions change.

## Do NOT

- NO prisma migration, NO schema.prisma change in this slice. If you conclude a
  migration is unavoidable, STOP and say `NO-OP: needs migration slice` - do not
  smuggle one in.
- Do not touch public-link form flow beyond the explicit optional-GPS exemption.
- Do not touch admin/desktop entry paths (supervisor fallback stays GPS-free).
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
