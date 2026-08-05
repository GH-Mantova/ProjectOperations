---
premise: '! grep -q "AdministrationLandingPage" apps/web/src/App.tsx'
premise_means: There is no /settings/administration landing route yet, so a direct hit on that URL 404s and SLICE 16 has not landed.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -q "AdministrationLandingPage" apps/web/src/App.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 951
---

# SLICE-16: Register a /settings/administration landing page (fix direct-hit 404)

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 16. `App.tsx` mounts the Administration sub-pages at
`administration/system`, `administration/users`, `administration/roles`, `administration/audit`,
`administration/platform`, `administration/automations` (job-roles moved to Workers in SLICE 15) — but
there is NO route for bare `administration`. A direct hit on `/settings/administration` therefore 404s.
This slice adds a small `AdministrationLandingPage` hub that lists the Administration sub-nav items the
caller has permission to see. SettingsShell already renders the sub-nav; this only fixes the direct-hit
404. No behaviour, API, permission, schema, or /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 16, plus §2 IA. Verified against main:
- `App.tsx`: `/settings` has `<Route index element={<Navigate to="account" replace />} />` and a set of
  `path="administration/*"` child routes under `<SettingsShell />`, but NO `path="administration"` (index)
  route. `SettingsShell.tsx` builds the Administration nav group with per-item permission gates
  (system=`platform.admin`, users=`users.view`, roles=`roles.view`, audit=`audit.view`,
  platform=`platform.admin`, automations=`automations.view`).
- Convention for administration pages: `apps/web/src/pages/administration/` (e.g. RolesPermissionsPage.tsx from SLICE 8).

## What to build (all under apps/web/src/ and tests/e2e/)

1. **New page** `apps/web/src/pages/administration/AdministrationLandingPage.tsx`: a small hub that lists
   the Administration sub-nav destinations the current user can access, each as a link/card to its route
   (`/settings/administration/system|users|roles|audit|platform|automations`). Filter by the SAME
   permission code each item uses in `SettingsShell.tsx` (reuse the existing `can(user, code)` helper and,
   if `SettingsShell` exports its Administration items list, import and reuse it rather than duplicating —
   otherwise replicate the gated list with the exact same codes; do NOT invent codes). If the user can
   access none, render `<NoAccess ... />`. Keep it minimal — plain list/cards, no re-skin (that is SLICE 18/19).

2. **App.tsx**: register `<Route path="administration" element={<AdministrationLandingPage />} />` as a
   child of `<SettingsShell />`, wrapped consistently with its sibling `administration/*` routes (match the
   existing wrapper — AdminOnly / RequirePermissions — the neighbours use). Import `AdministrationLandingPage`.
   Do NOT change any existing administration/* route.

3. **E2E** `tests/e2e/**`: add/adjust an assertion that a direct visit to `/settings/administration`
   renders the hub (not a 404/blank) and shows the accessible items; do not disturb other admin-portal
   assertions. Keep tendering-e2e green.

## Do NOT
- Do NOT change SettingsShell's sub-nav, any existing route, or any other slice's surface.
- Do NOT re-skin or restyle (SLICE 18/19). Keep the hub plain and functional.
- Do NOT change schema/API/permission registry or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If `AdministrationLandingPage` already exists in App.tsx on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass; keep tendering-e2e green.
  Read the CI job log before diagnosing any failure.
- Parity: `/settings/administration` now renders a hub of the caller's accessible admin items instead of 404;
  all existing `/settings/administration/*` pages and the SettingsShell sub-nav are unchanged.
