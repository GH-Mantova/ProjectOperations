---
premise: 'test -f apps/web/src/pages/UsersPage.tsx'
premise_means: The standalone UsersPage.tsx still exists, so SLICE 7 (consolidate Users onto AdminUsersTab) has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && ! test -f apps/web/src/pages/UsersPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
---

# SLICE-7: Consolidate Users — keep AdminUsersTab, delete UsersPage.tsx

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 7. The Settings restructure keeps ONE Users surface:
the richer `AdminUsersTab` component. The standalone `UsersPage.tsx` (currently rendered at the
`/settings/administration/users` route) is redundant and must be removed, with the route rendering
`AdminUsersTab` directly. Behaviour is unchanged — the richer capabilities win, the weaker page dies.
This is a CONSOLIDATION, not a rework: no new behaviour, no schema, no API, no /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 7, plus §2 target IA and §4 redirect map.
Implement to that spec; the file/route names below are the plan's, verified against main.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **Route** `apps/web/src/App.tsx`: the existing `<Route path="administration/users" ...>` under the
   SettingsShell must render `AdminUsersTab` (from `./pages/admin/AdminUsersTab`) via a thin route
   wrapper instead of `UsersPage`. If `AdminUsersTab` stands alone with no required props, render it
   directly; if it assumes tab context, add a minimal wrapper that supplies what it needs. Remove the
   now-unused `import { UsersPage } from "./pages/UsersPage"`.

2. **Delete** `apps/web/src/pages/UsersPage.tsx` entirely.

3. **AdminSettingsPage** `apps/web/src/pages/AdminSettingsPage.tsx`: remove the
   `{ id: "users", label: "Users" }` entry from the `TABS` array and its corresponding tab-render
   branch. If `AdminUsersTab` is no longer referenced anywhere in this file afterwards, remove its
   now-unused import. Do NOT touch any other tab (notifications, email, operations, access-requests,
   ai, integrations, platform, geofences, permissions, client-versions, map-locations, audit) — those
   are other slices.

4. **Nav test** `apps/web/src/components/__tests__/ShellLayout.nav.test.ts`: update ONLY if it asserts a
   Users nav entry that this change moves or removes; otherwise leave untouched.

5. **E2E** `tests/e2e/**/batch8-admin-portal.spec.ts` (and any sibling admin-portal spec): update any
   assertion that reaches Users via the old `UsersPage` or the in-AdminSettings "Users" tab so it
   targets `/settings/administration/users` rendering `AdminUsersTab`. Keep coverage equivalent.

## Do NOT
- Do NOT change AdminUsersTab behaviour, its API calls, or the reset-password flow.
- Do NOT remove or alter the `/admin/users` → `/settings/administration/users` redirect (already on main).
- Do NOT touch other AdminSettingsPage tabs or any other slice's surface.
- Do NOT change schema/API/permissions or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT pull in SLICE 8 (Roles/Permissions) — keep the users-page shape stable for it.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> "Do NOT auto-merge" would mean open-and-leave-unmerged — it does NOT mean wait for approval to start
> or to push. There is no human in this run. Finishing the work and then asking permission is failing.

## Guardrails
- One attempt. If `UsersPage.tsx` is already gone on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass. Read the CI job log before
  diagnosing any failure.
- Behaviour parity: a user who could manage users before can still do so, at the same route.
