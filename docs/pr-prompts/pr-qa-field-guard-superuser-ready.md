---
premise: 'grep -q "user.permissions.includes(" apps/web/src/App.tsx'
premise_means: App.tsx's FieldOnlyGuard and RootRedirect still gate their redirects on raw user.permissions.includes(...) checks that ignore isSuperUser, so a super-user whose roles lack field.view is bounced off /field.
scope:
  - apps/web/src/App.tsx
done_when: 'pnpm build && pnpm lint && ! grep -q "user.permissions.includes(" apps/web/src/App.tsx'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: FieldOnlyGuard / RootRedirect must honor isSuperUser (S2 super-user lockout)

Branch: `fix/qa-field-guard-superuser`. New PR.

## Why this PR exists (Station 04 Part-0 finding, S2)

`apps/web/src/App.tsx` has two route guards that decide redirects from **raw**
`user.permissions.includes(...)` checks and **ignore `isSuperUser`**:

```ts
function FieldOnlyGuard({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  const hasField = user.permissions.includes("field.view");
  if (!hasField) return <Navigate to="/" replace />;   // <-- bounces a super-user off /field/*
  return children;
}

function RootRedirect({ children }) {
  const { user } = useAuth();
  if (user) {
    const hasField = user.permissions.includes("field.view");
    const hasDesktop =
      user.permissions.includes("projects.view") || user.permissions.includes("tenders.view") ||
      user.permissions.includes("users.view")   || user.permissions.includes("dashboards.view");
    if (hasField && !hasDesktop) return <Navigate to="/field/allocations" replace />;
  }
  return children;
}
```

The backend builds the frontend `permissions` array via
`UsersService.flattenPermissions` = **role-granted codes only** (it does NOT enumerate all codes for
a super-user; `isSuperUser` is a separate flag). So a super-user whose roles do not include
`field.view` has a `permissions` array without it, and **`FieldOnlyGuard` redirects them off the
entire `/field/*` surface to `/`** — the exact class as the 2026-07-10 `RatesListsAdminPage` bounce
(DOCTRINE Part-0 (a): a redirect guard that ignores super-user is **S2**).

The project already has the correct helpers in `apps/web/src/auth/permissions.ts` —
`can(user, code)` and `canAny(user, ...codes)` — both of which short-circuit on
`user.isSuperUser === true`. These guards simply don't use them.

## What to build -- ONE file, frontend only

In `apps/web/src/App.tsx`, replace the raw `user.permissions.includes(...)` checks **in both
`FieldOnlyGuard` and `RootRedirect`** with the existing helpers:

- `hasField` -> `can(user, "field.view")`
- `hasDesktop` -> `canAny(user, "projects.view", "tenders.view", "users.view", "dashboards.view")`

Import `can` and `canAny` from `./auth/permissions`. After the change **no raw
`user.permissions.includes(` call remains in App.tsx.**

**Why BOTH guards, not just FieldOnlyGuard:** if only `hasField` starts honoring `isSuperUser`,
then in `RootRedirect` a super-user with no desktop-role codes would get `hasField=true` and
`hasDesktop=false` and be **misrouted to `/field/allocations`**. Routing `hasDesktop` through
`canAny` (which also honors super-user) keeps a super-user on the desktop root. Both must move
together.

## Do NOT

- Do NOT change whether a **non-super** desktop user can reach `/field/*`. The guard's comment
  ("If a desktop user lands on /field/* they can still use it") contradicts its own code, but
  resolving that is a product decision for Marco — this PR is strictly about honoring `isSuperUser`.
  Leave the field.view-less non-super behaviour exactly as it is today.
- Do NOT touch backend auth, `flattenPermissions`, permission seeds, Azure, Entra, or SharePoint.
- Do NOT introduce a new permission code or a new helper — use `can` / `canAny` as they exist.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly -- never exit silently, never "stand by"
  for approval (there is no human in this run).
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- The completion test: is there a PR number in your output? If not because the work was already on
  main, say `NO-OP`. If not because you are waiting for someone -- there is nobody. Open the PR.
