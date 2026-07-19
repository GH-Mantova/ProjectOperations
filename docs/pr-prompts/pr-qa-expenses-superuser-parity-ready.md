---
premise: 'grep -q "permissions.includes(" apps/web/src/pages/expenses/ExpensesPage.tsx'
premise_means: ExpensesPage still computes canManage/canApprove from raw user.permissions.includes(...) checks that ignore isSuperUser, instead of the shared can() helper.
scope:
  - apps/web/src/pages/expenses/ExpensesPage.tsx
done_when: 'pnpm build && pnpm lint && grep -q "auth/permissions" apps/web/src/pages/expenses/ExpensesPage.tsx && ! grep -q "permissions.includes(" apps/web/src/pages/expenses/ExpensesPage.tsx'
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: ExpensesPage must honor isSuperUser for its manage/approve gates (S3 super-user parity)

Branch: `fix/qa-expenses-superuser-parity`. New PR.

## Why this PR exists (Station 04 Part-0 (a) finding, S3)

`apps/web/src/pages/expenses/ExpensesPage.tsx` (lines 117-118) computes both capability flags from
**raw permission-array membership that ignores `isSuperUser`**:

```ts
const canManage = user?.permissions.includes("expenses.manage") ?? false;
const canApprove = user?.permissions.includes("expenses.approve") ?? false;
```

This is a **frontend/backend parity mismatch**, verified on both layers:

- **Backend GRANTS the super-user.** `apps/api/src/modules/expenses/expenses.controller.ts` gates
  its mutating routes with `@RequirePermissions("expenses.manage")` (L73/84/97) and
  `@RequirePermissions("expenses.approve")` (L109/122/135). Those run through
  `apps/api/src/common/auth/permissions.guard.ts`, which short-circuits at L31 with
  `if (request.user?.isSuperUser) return true;`.
- **Frontend HIDES it from the super-user.** `permissions` is built from role grants ONLY --
  `UsersService.toSafeUser` returns `permissions = this.flattenPermissions(user)` and carries
  `isSuperUser` as a **separate boolean** (`users.service.ts` L262-303); `auth.service.ts` L211/254
  puts `permissions` and `isSuperUser` into the token side by side. Nothing anywhere enumerates the
  full code list for a super-user.

Net effect: a super-user whose roles do not happen to grant `expenses.manage` / `expenses.approve`
sees the create/edit/approve/reject affordances hidden on a page whose API would have accepted every
one of those calls. Per DOCTRINE Part-0 (a), a capability flag that ignores super-user is **S3**.

The project already ships the correct helper in `apps/web/src/auth/permissions.ts`:

```ts
export function can(user: SafeUser | null | undefined, code: string): boolean {
  if (!user) return false;
  return user.isSuperUser === true || user.permissions.includes(code);
}
```

`ExpensesPage.tsx` is the **last remaining `permissions.includes(` offender outside the helper
itself** -- a repo-wide grep of `apps/web/src` returns exactly three files: `auth/permissions.ts`
(the helper, correct by definition), `App.tsx` (already covered by the armed
`pr-qa-field-guard-superuser-ready.md`), and this file.

## What to build -- ONE file, frontend only

In `apps/web/src/pages/expenses/ExpensesPage.tsx`:

- Import `can` from `../../auth/permissions`.
- Replace the two raw checks with the helper, keeping both variable names unchanged so every
  downstream `{canManage && ...}` / `{canApprove && ...}` JSX guard is untouched:

```ts
const canManage = can(user, "expenses.manage");
const canApprove = can(user, "expenses.approve");
```

`can()` already returns `false` for a null/undefined user, so the `?? false` tails are redundant and
should go with them.

After the change **no `permissions.includes(` remains in this file** and `can` is imported and used.

## Do NOT

- Do NOT change which JSX is gated, the expense workflow, statuses, or any API call.
- Do NOT touch the backend, `permissions.guard.ts`, `flattenPermissions`, the permission registry,
  permission seeds, or roles. `expenses.manage` and `expenses.approve` are BOTH already present in
  `permission-registry.ts` -- verified; this PR adds no codes.
- Do NOT touch `App.tsx` -- its `FieldOnlyGuard` / `RootRedirect` offenders belong to
  `pr-qa-field-guard-superuser-ready.md`. Two prompts must not edit the same file.
- Do NOT touch Azure, Entra, SharePoint, migrations, or seeds.
- Do NOT alter behaviour for a normal user holding the codes (they stay `true`); this only ADDS
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
