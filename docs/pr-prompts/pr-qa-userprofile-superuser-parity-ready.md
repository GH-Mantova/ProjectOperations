---
premise: 'grep -q "r.name === " apps/web/src/pages/account/UserProfilePage.tsx'
premise_means: UserProfilePage still computes isAdmin from a raw roles.some(r.name === "Admin") check that ignores isSuperUser, instead of the shared isAdminUser() helper.
scope:
  - apps/web/src/pages/account/UserProfilePage.tsx
done_when: 'pnpm build && pnpm lint && grep -q "isAdminUser" apps/web/src/pages/account/UserProfilePage.tsx'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: UserProfilePage must honor isSuperUser for its admin gate (S3 super-user parity)

Branch: `fix/qa-userprofile-superuser-parity`. New PR.

## Why this PR exists (Station 04 Part-0 (a) finding, S3)

`apps/web/src/pages/account/UserProfilePage.tsx` computes its admin flag from a **raw literal
role-name check that ignores `isSuperUser`**:

```ts
const isAdmin = useMemo(() => user?.roles?.some((r) => r.name === "Admin") ?? false, [user]);
// ...
<GlobalListsSection isAdmin={isAdmin} />
```

`GlobalListsSection` gates its admin controls on that boolean (`{isAdmin ? (...admin UI...) : ...}`).
So a **super-user whose roles do not include the literal `"Admin"` role** is shown `isAdmin=false`
and loses the admin affordances in the Global Lists section of their own profile page.

The backend builds the frontend `permissions`/`roles` from role grants only; `isSuperUser` is a
**separate flag** (`UsersService.flattenPermissions` does not enumerate codes or synthesize an
"Admin" role for a super-user). The project already ships the correct helper in
`apps/web/src/auth/permissions.ts`:

```ts
export function isAdminUser(user: SafeUser | null | undefined): boolean {
  return user.isSuperUser === true || (user.roles?.some((r) => r.name === "Admin") ?? false);
}
```

This is the identical parity class as the field-guard / RatesListsAdminPage work: a frontend gate
that reimplements the `roles.some(name === "Admin")` test inline instead of routing through the
super-user-aware helper. It is the last remaining inline offender — `AdminUsersTab.tsx` already
checks `isSuperUser || role?.name === "Admin"`, and every other admin gate uses `can()` /
`isAdminUser()`.

## What to build -- ONE file, frontend only

In `apps/web/src/pages/account/UserProfilePage.tsx`:

- Import `isAdminUser` from `../../auth/permissions`.
- Replace the inline `useMemo` computation with `const isAdmin = isAdminUser(user);`
  (drop the now-unneeded `useMemo`/`user?.roles?.some(...)` expression; keep the `isAdmin` name so
  the `<GlobalListsSection isAdmin={isAdmin} />` prop is unchanged). Remove the `useMemo` import if
  it becomes unused.

After the change **no raw `r.name === "Admin"` literal remains in this file**, and `isAdminUser`
is imported and used.

## Do NOT

- Do NOT change `GlobalListsSection` or what it renders — only the source of the `isAdmin` boolean.
- Do NOT touch backend auth, `flattenPermissions`, permission seeds, roles, Azure, Entra, or
  SharePoint.
- Do NOT introduce a new permission code or a new helper — use the existing `isAdminUser`.
- Do NOT alter behaviour for a normal Admin-role user (they stay `isAdmin=true`); this only ADDS
  super-user parity.

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
