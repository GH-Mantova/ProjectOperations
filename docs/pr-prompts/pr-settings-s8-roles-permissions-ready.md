---
premise: 'test -f apps/web/src/pages/RolesPage.tsx'
premise_means: The standalone RolesPage.tsx still exists, so SLICE 8 (fold Roles + Permissions into one editable page) has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && ! test -f apps/web/src/pages/RolesPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 934
---

# SLICE-8: Consolidate Roles + Permissions into one editable page

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 8. Roles and Permissions are two separate Settings
screens today (`RolesPage.tsx` at `/settings/administration/roles`, `PermissionsPage.tsx` at
`/settings/administration/permissions`). SLICE 8 folds them into ONE editable page reusing the existing
combined `AdminRolesPermissionsTab` component, mounted at `/settings/administration/roles`. Behaviour is
unchanged — the combined tab already edits both roles and permissions. No schema, no API, no /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 8, plus §2 target IA and §4 redirect map.
Paths below are verified against main.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **New page** `apps/web/src/pages/administration/RolesPermissionsPage.tsx`: a thin page that renders
   the existing `AdminRolesPermissionsTab` (from `../admin/AdminRolesPermissionsTab`) — the combined
   roles+permissions editor. No new behaviour; just a route-level host so the tab stands alone.

2. **App.tsx** `apps/web/src/App.tsx`:
   - Route `administration/roles` renders `<RolesPermissionsPage />` (inside the existing `AdminOnly`
     wrapper) instead of `<RolesPage />`.
   - Route `administration/permissions`: since `PermissionsPage` is deleted, replace its element with a
     `<Navigate to="/settings/administration/roles" replace />` so the old in-Settings permissions URL
     still resolves to the merged page. (The `/admin/permissions` → `/settings/administration/permissions`
     redirect on main then chains through correctly; leave it as-is.)
   - Remove the now-unused `import { RolesPage } from "./pages/RolesPage"` and
     `import { PermissionsPage } from "./pages/PermissionsPage"`. Do NOT touch `JobRolesPage` or its route.

3. **Delete** `apps/web/src/pages/RolesPage.tsx` and `apps/web/src/pages/PermissionsPage.tsx` entirely
   (git rm).

4. **SettingsShell** `apps/web/src/components/SettingsShell.tsx`: remove the separate `"Permissions"`
   nav item; relabel the `"Roles"` item to **"Roles & Permissions"** (it keeps `to:
   "/settings/administration/roles"`). Keep its `requiresPermission` gate as `roles.view` (the combined
   tab governs permission editing internally). Do NOT touch the `"Job roles"` item. Remove the stale
   SLICE-8 "two separate items today" comment if present.

5. **AdminSettingsPage** `apps/web/src/pages/AdminSettingsPage.tsx`: remove the
   `{ id: "permissions", label: "Permissions" }` entry from `TABS` and its
   `{tab === "permissions" && <AdminRolesPermissionsTab />}` render branch. Remove the now-unused
   `import { AdminRolesPermissionsTab }` from THIS file (it is now owned by the new page). Do NOT touch
   any other tab.

6. **E2E** `tests/e2e/**/batch8-admin-portal.spec.ts` (and siblings): drop any assertion of a separate
   "Permissions" tab/nav item; assert the merged Roles & Permissions surface renders at
   `/settings/administration/roles`. Keep coverage equivalent.

## Do NOT
- Do NOT change `AdminRolesPermissionsTab` behaviour, its API calls, or permission model.
- Do NOT touch `JobRolesPage` / `/settings/administration/job-roles` (that is SLICE 15).
- Do NOT touch other AdminSettingsPage tabs or other slices' surfaces.
- Do NOT change schema/API/permissions registry or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT invent permission codes; reuse existing `roles.view` / `permissions.view` as already present.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If `RolesPage.tsx` is already gone on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass. Read the CI job log before
  diagnosing any failure.
- Behaviour parity: an admin who could edit roles and permissions before can still do both, now at the
  single `/settings/administration/roles` page.
