---
premise: 'grep -q "<AdminOnly" apps/web/src/App.tsx'
premise_means: App.tsx still wraps the company settings route in the legacy Admin role-name guard, so SLICE 17 is not closed and access to the company screen is still decided by a role name rather than a permission code.
scope:
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && ! grep -q "<AdminOnly" apps/web/src/App.tsx && grep -q "company.manage" apps/web/src/App.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: company-manage
cluster_order: 2
requires_on_main: apps/api/src/common/permissions/permission-registry.ts :: company.manage
---

# company.manage slice 2 - swap the last `<AdminOnly>` route guard for a permission guard

**Slice 2 of 2. This closes SLICE 17's last route.** One file: `apps/web/src/App.tsx`.

**Gate:** slice 1 must be on main - `company.manage` present in
`apps/api/src/common/permissions/permission-registry.ts`. That matters for a real reason, not
bookkeeping: slice 1's migration grants `company.manage` to every role that already holds
`platform.admin`. **If this guard lands first, every current admin is locked out of the company
screen until the migration runs.** Do not remove the gate.

> Narrowed 2026-09-21 (Marco: *"do as you suggested"*). The earlier version also deleted the
> `AdminOnly` export from `SettingsShell.tsx` and edited the route-guard test. That took the slice
> outside the linter's no-screen exemption and forced it to cite a design it does not implement.
> The guard swap is the whole of the security change and changes no screen, so it ships alone.
> The dead export and the test's regex clean-up ride along with the next Settings slice that
> carries a real design.

## Grounded on origin/main 2b3e1ee7 - re-verify before you edit

- **Exactly ONE `<AdminOnly>` route wrapper is left**, at `App.tsx:427-429`, around
  `<AdminCompanyPage />` on the `company` route. Grep for it - do not trust the line numbers.
- **`App.tsx:95`** imports it: `import { SettingsShell, AdminOnly, RequirePermissions, SuperUserOnly } from "./components/SettingsShell";`
- **The word `AdminOnly` also appears in two comments** in `App.tsx` (`:468` and `:598`, both
  describing earlier SLICE 17 swaps). They are history, not code. Leave them - which is why this
  prompt's checks look for the JSX `<AdminOnly`, not the bare word.
- **`RequirePermissions` is already used in `App.tsx`** (for example the `system.manage` route near
  `:598`). Copy the prop shape of an existing usage exactly - do not invent one.
- **The route-guard test keeps passing unchanged.** `route-guards.authz.test.ts:173` accepts
  `/<(?:AdminOnly|SuperUserOnly|RequirePermissions)\b/`, so a `company` route wrapped in
  `RequirePermissions` still counts as guarded. That test is **not** in scope and must not be edited.

## What to build

1. Replace the `<AdminOnly>` wrapper on the `company` route with `<RequirePermissions ...>` guarding
   on **`company.manage`**, in the same prop shape as the existing usages.
2. Remove `AdminOnly` from the import on `App.tsx:95`. Keep `SettingsShell`, `RequirePermissions`
   and `SuperUserOnly`.

That is the whole slice. The `AdminOnly` export in `SettingsShell.tsx` stays, now unused by any
route - its own comment already calls it legacy.

## Do NOT

- Do NOT touch any file but `apps/web/src/App.tsx` - not `SettingsShell.tsx`, not the guard test.
- Do NOT touch the API, the permission registry or any migration - that was slice 1. If
  `company.manage` is missing or misspelled, stop and report; do not add it here.
- Do NOT change any other route's guard, and do not touch `SuperUserOnly`.
- Do NOT edit the two history comments that mention `AdminOnly`.
- Do NOT touch `sot/` (CP-24) or anything Azure / Entra / SharePoint.

## VERIFY before opening the PR

```
pnpm build && pnpm lint
pnpm --filter @project-ops/web test -- route-guards.authz        # must pass UNCHANGED
grep -n "<AdminOnly" apps/web/src/App.tsx                          # must be empty
grep -n "company.manage" apps/web/src/App.tsx                      # the new guard
git diff --name-only origin/main                                   # exactly apps/web/src/App.tsx
```

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: one file. That is a scope limit, **not** a reason to stop before
pushing.

## Guardrails

- One attempt. If `App.tsx` no longer contains `<AdminOnly`, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
