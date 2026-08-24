---
premise: 'grep -q "AdminOnly" apps/web/src/App.tsx'
premise_means: App.tsx still wraps the company settings route in the legacy Admin role-name guard, so SLICE 17 is not closed and route access is still decided by a role name rather than a permission code.
scope:
  - apps/web/src/App.tsx
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/components/__tests__/route-guards.authz.test.ts
done_when: pnpm build && pnpm lint && ! grep -q "AdminOnly" apps/web/src/App.tsx && grep -q "company.manage" apps/web/src/App.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: company-manage
cluster_order: 2
requires_on_main: apps/api/src/common/permissions/permission-registry.ts :: company.manage
---

# company.manage slice 2 - swap the last `<AdminOnly>` for a permission guard and retire it

**Slice 2 of 2. This closes SLICE 17.**

**Gate:** slice 1 must be on main - `company.manage` present in
`apps/api/src/common/permissions/permission-registry.ts`. That matters for a real reason, not
bookkeeping: slice 1's migration grants `company.manage` to every role that already holds
`platform.admin`. **If this UI guard lands first, every current admin is locked out of the company
screen until the migration runs.** Do not remove the gate.

## Grounded on origin/main - read before coding

- **There is exactly ONE `<AdminOnly>` route wrapper left**, at `App.tsx` lines 410-417:
  ```
  <Route
    path="company"
    element={
      <AdminOnly>
        <AdminCompanyPage />
      </AdminOnly>
    }
  />
  ```
  (Grep for it - do not trust those line numbers.) `App.tsx:91` imports `AdminOnly` alongside
  `SettingsShell`, `RequirePermissions` and `SuperUserOnly`.
- **`AdminOnly` is defined at `SettingsShell.tsx:207`** and its own comment says it is a
  *"Legacy role-name guard. Kept for compatibility with App.tsx route wrappers until SLICE 17
  replaces them with `<RequirePermissions>`."* It calls `isAdminUser(user)` and renders
  `<NoAccess required="role:Admin" .../>`.
- **`RequirePermissions` already exists in the same file and is already used in `App.tsx`.** Read an
  existing usage and copy its prop signature exactly - do not invent one.
- `apps/web/src/components/__tests__/route-guards.authz.test.ts` enforces that admin-rendering routes
  are guarded, via `const GUARD_RE = /<(?:AdminOnly|SuperUserOnly|RequirePermissions)\b/` (~line 173),
  and it maintains a `SELF_GUARDED_ROUTES` list. ⚠️ **`/settings/company` appears in that file in
  more than one place** (around lines 33-35, 162, and 207-208) - read every occurrence before
  editing, because one of them is a deliberate note about bookmark URLs rendering `NoAccess`.

## What to build

1. **`App.tsx`** - replace the `<AdminOnly>` wrapper on the `company` route with
   `<RequirePermissions ...>` guarding on **`company.manage`**, matching the prop shape of the
   existing `RequirePermissions` usages in the same file. Remove `AdminOnly` from the import on
   line 91.

2. **`SettingsShell.tsx`** - once `App.tsx` no longer references it, **delete the `AdminOnly`
   export** and its now-dead comment.
   ⚠️ **First prove it has no other callers:** `grep -rn "AdminOnly" apps/web/src`. If anything
   outside `App.tsx` and the guard test still imports it, **do not delete it** - leave it, say so
   plainly in the PR body, and list the callers. A half-removed export that breaks an unrelated page
   is worse than a legacy guard nobody calls.
   Leave `isAdminUser` alone unless it becomes entirely unreferenced - it is a separate helper and
   may back nav visibility elsewhere.

3. **`route-guards.authz.test.ts`** - update `GUARD_RE` to drop the `AdminOnly` alternative once the
   component is gone, and update the surrounding comments that describe SLICE 17 as pending. **The
   test must still fail** when a route is left unguarded - after editing, satisfy yourself that the
   assertion can still fire, and say in the PR body what you did to convince yourself. A guard test
   that can no longer fail is worse than no test.

## Do NOT

- **Do NOT touch the API, the permission registry, or any migration** - that was slice 1. If
  `company.manage` is missing or misspelled, stop and report; do not add it here.
- Do NOT change any other route's guard, and do not touch `SuperUserOnly`.
- Do NOT widen `SELF_GUARDED_ROUTES` to make a failing assertion pass - if the test fails, the guard
  is wrong, not the test.
- Do NOT touch `sot/` (CP-24) or anything Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. If `App.tsx` no longer contains `AdminOnly` on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
