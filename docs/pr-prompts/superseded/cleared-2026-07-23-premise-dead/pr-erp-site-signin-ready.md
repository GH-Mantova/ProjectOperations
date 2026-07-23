---
premise: '! grep -q "model SiteAttendance" apps/api/prisma/schema.prisma'
premise_means: There is no site sign-in/sign-out record, so nobody knows who is on a site right now.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/sites/**
  - apps/web/src/pages/field/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model SiteAttendance" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---

# Site sign-in / sign-out (who is on site right now)

STATUS: ARMED - RUN NOW. No predecessor on main. Verified 2026-07-20 against origin/main 285e779:
no `SiteAttendance` model and no sign-in surface exists anywhere.

## Why this exists

`pr-erp-muster-headcount` (evacuation muster roll) is gated on site sign-in, and site sign-in had
never been written - it was blocked on a predecessor that did not exist. This is that predecessor.
It is also the WHS spine: in an evacuation you must be able to say who is on site.

## What to build

Branch: `feat/erp-site-signin`. Reviewer: `GH-Mantova`. Migration: YES - additive.
Bare `GATE-ALLOW: migrations` at column 0 in the PR body.

1. **Schema** - `SiteAttendance`: `siteId` (required), `workerId` (required), `signedInAt`
   (required), `signedOutAt` (nullable - null means STILL ON SITE), optional `jobId`, optional
   `method` and `notes`. Index `[siteId, signedOutAt]` so "who is on site now" is one cheap query.
   **Do not** reuse or extend the scheduler's shift models - a roster is an intention, attendance
   is a fact, and conflating them is what makes muster rolls wrong.
2. **API** in `sites`: `signIn`, `signOut`, and `currentlyOnSite(siteId)`. Guard with
   `sites.view` / `sites.manage` - and if you add any new permission code, register it in
   `apps/api/src/common/permissions/permission-registry.ts`, or the CI coverage guard will not see
   it and the gate ships permanently false.
   Any hand-rolled permission check MUST include `isSuperUser ||` - `user.permissions` is never
   expanded for super-users.
3. **Idempotency** - signing in twice without signing out must NOT create a second open row;
   return the existing open attendance. Signing out when not signed in is a no-op, not an error.
4. **Field PWA** (`apps/web/src/pages/field/`, FieldLayout): a prominent Sign in / Sign out control
   showing current state and which site. It MUST work through the existing IndexedDB offline outbox
   like the other field surfaces - a worker on a site with no signal must still be able to sign in,
   and it syncs later. Do not build a new offline mechanism.
5. Regenerate the data-model map (`node scripts/data-model/build-relationship-map.mjs`) and commit
   the result - schema changes are CI-gated on it.

## Design notes (Marco, 2026-07-20)
- Site is the unit, not job - a worker can work several jobs on one site in a day.
- Sign-out may be missing (people forget). `signedOutAt` null therefore means "still on site" AND is
  the known data-quality problem; surface stale open attendances rather than auto-closing them
  silently. **Do not** invent an auto-sign-out rule here - that is a separate decision for Marco.

## Do NOT
- Do NOT build the muster/evacuation view - `pr-erp-muster-headcount` owns that and reads this.
- Do NOT auto-close attendances. Do NOT tie attendance to timesheets or payroll in this slice.
- Do NOT touch Azure/prod. If it exceeds 10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". Finishing the work then asking permission is indistinguishable from
> failing - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
