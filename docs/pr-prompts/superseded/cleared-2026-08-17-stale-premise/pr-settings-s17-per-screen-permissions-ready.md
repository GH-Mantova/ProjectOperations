---
premise: '! grep -q "system.manage" apps/api/src/common/permissions/permission-registry.ts'
premise_means: >-
  The Administration routes still use the blanket AdminOnly guard and the new
  system.manage permission code does not yet exist; the per-screen permission
  unification has not been done.
scope:
  - apps/api/src/**
  - apps/web/src/**
  - tests/e2e/**
  - docs/data-model/**
done_when: >-
  pnpm build && grep -q "system.manage" apps/api/src/common/permissions/permission-registry.ts
size: 7
gate_allow: none
escalates: true
seed_only: false
requires_file_on_main:
  - apps/web/src/pages/administration/MapLocationsPage.tsx
rollback_strategy: >-
  Revert the PR: routes return to the AdminOnly guard and system.manage is
  removed from the registry. Permission is additive (seed upserts, never
  deletes RolePermission rows), so no access is lost on revert.
---

# SLICE 17 — per-screen permissions for the Administration routes

Replace the blanket `AdminOnly` route guard on the Administration screens with
a SPECIFIC permission per screen. Gated on SLICE 14 (runs after
`apps/web/src/pages/administration/MapLocationsPage.tsx` is on main) so the two
slices do not collide on `App.tsx`.

## The mapping (apply exactly)

In `apps/web/src/App.tsx`, for each Administration route currently wrapped in
`<AdminOnly>`:

| Route (`administration/...`) | Screen | New guard |
|---|---|---|
| `administration` (hub) | AdministrationLandingPage | **remove the outer guard** — the page already filters items by permission and renders `<NoAccess/>` when none are visible |
| `administration/system` | AdminSettingsPage | `system.manage` (NEW code) |
| `administration/users` | AdminUsersTab | `users.view` |
| `administration/roles` | RolesPermissionsPage | `roles.view` |
| `administration/audit` | AuditLogsPage | `audit.view` |
| `administration/platform` | PlatformPage | `sharepoint.view` |
| `administration/automations` | AutomationsPage | `automations.view` |
| `/admin/settings` (redirect) | Navigate → system | `system.manage` |

Use a route-level permission guard. If a `RequirePermissions` (or equivalent)
web guard component already exists, use it; otherwise add a small
`RequirePermissions` wrapper mirroring `AdminOnly` that checks a permission code
against the current user's permissions and renders `<NoAccess/>` on failure
(fail-closed). Keep `AdminOnly` in place for any non-Administration usage.

## New permission code
Add to `apps/api/src/common/permissions/permission-registry.ts`:
`{ code: "system.manage", module: "platform", label: "Manage system settings",
description: "Access and edit the aggregate system settings (notifications,
email, AI, integrations)" }`. It is upserted by the seed / API-startup sync.

## Fail-closed / no lockout — CRITICAL
Whoever passes `AdminOnly` today MUST retain access. In the seed, grant the
admin role every code this slice introduces or newly gates on — at minimum
`system.manage` — so existing admins are not locked out of the system settings
page. Verify: an admin user reaches all seven screens after the change.

## Escalates — do NOT auto-merge
Security-sensitive (route authorisation). The feature PR must be labelled
**do-not-merge** and opened for Marco's review. It RUNS and goes green; the
merge waits for him.

## Tests
- e2e: a user with `users.view` but NOT `roles.view` reaches
  `/settings/administration/users` and gets `<NoAccess/>` at
  `/settings/administration/roles`.
- e2e: an admin (all codes) reaches all seven screens.
- Update any nav/route test that asserted the AdminOnly wrapper.

## Do NOT
- Do NOT loosen any gate below what AdminOnly enforced (fail-closed only).
- Do NOT touch non-Administration routes or the `SuperUserOnly` guard.
- No schema migration — permissions are code-seeded, not a prisma table change.

## Verify
- `pnpm build`; `system.manage` present in the registry; admin reaches all seven
  screens; a scoped non-admin is correctly allowed/blocked per the mapping;
  e2e + unit suites green.
