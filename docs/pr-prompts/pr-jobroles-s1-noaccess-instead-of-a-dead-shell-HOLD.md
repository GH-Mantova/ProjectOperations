---
premise: '! grep -q "NoAccess" apps/web/src/pages/admin/JobRolesPage.tsx'
premise_means: >-
  Job roles is the only settings-class page that gates on a capability and never says so. MEASURED
  2026-09-05 - `apps/web/src/pages/admin/JobRolesPage.tsx` imports `useAuth` for `authFetch` only
  (:18); it contains zero occurrences of `NoAccess`, `can(`, `resources.view` or `resources.manage`.
  Its API is guarded: `job-roles.controller.ts:21` applies `PermissionsGuard`, `:26` requires
  `resources.view` to read, and `:43/:53/:63` require `resources.manage` to write. So a user without
  `resources.view` gets a 403 from `/job-roles` - and `load()` swallows it: `const rolesJson =
  rolesRes.ok ? await rolesRes.json() : []`. The page then renders an EMPTY LIST. It does not say
  "you cannot see this"; it says "there are none", which is a false statement about the data. A user
  with `resources.view` but not `resources.manage` gets the opposite lie: full Edit, Delete and
  "+ New role" controls that 403 on click. `NoAccess.tsx` exists for exactly this and its own header
  cites sot/01 SECTION 6: "Any page that gates on a capability MUST render this component when the
  capability is missing."
design_ref: https://claude.ai/code/artifact/524ef7db-7234-4254-8c7f-9e5da3d953c1
scope:
  - apps/web/src/pages/admin/JobRolesPage.tsx
  - apps/web/src/pages/admin/__tests__/JobRolesPage.access.test.tsx
done_when: >-
  grep -q "NoAccess" apps/web/src/pages/admin/JobRolesPage.tsx && grep -q "resources.view" apps/web/src/pages/admin/JobRolesPage.tsx && grep -q "resources.manage" apps/web/src/pages/admin/JobRolesPage.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# JR-S1: Job roles must say "you cannot see this" instead of "there are none"

**Grounded against `origin/main`, measured 2026-09-05 by the cloud/chat lane (station 06).**

Two files. One page gains the permission honesty every comparable page already has, plus one test
file that proves it.

## About the `design_ref`

There is no mock-up of this page and none of `NoAccess`. The cited artifact is **Settings Home**,
which is the design that advertises this page with the caption `needs resources.view`. This slice
makes the destination honour what that card promises. The visual pattern of record is
`apps/web/src/components/NoAccess.tsx` itself and sot/01 SECTION 6 - **copy that, do not design
anything new.**

## The defect, measured

| probe | result |
|---|---|
| `NoAccess` in `JobRolesPage.tsx` | **0** |
| `can(` in `JobRolesPage.tsx` | **0** |
| `resources.view` / `resources.manage` in `JobRolesPage.tsx` | **0** / **0** |
| `@RequirePermissions("resources.view")` on `GET /job-roles` | `job-roles.controller.ts:26` |
| `@RequirePermissions("resources.manage")` on POST / PATCH / DELETE | `:43` / `:53` / `:63` |

`JobRolesPage.tsx` `load()`:

```ts
const rolesJson: JobRoleRecord[] = rolesRes.ok ? await rolesRes.json() : [];
```

A 403 and an empty table are indistinguishable to this code, and therefore to the user. That is the
failure `NoAccess` was written to end - its header records the 2026-07-13 incident where Rates &
Lists "appeared to open the dashboard" when the real cause was a missing permission, and the hours
that cost.

## Copy the pattern that already exists

`apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` is the reference implementation:

- `:15` `import { useAuth } from "../auth/AuthContext";`
- `:17` `import { can } from "../auth/permissions";`
- `:18` `import { NoAccess } from "../components/NoAccess";`
- `:319` `const canManage = useMemo(() => can(user, "rates.manage"), [user]);`
- `:514` `return <NoAccess required="rates.manage" />;`

Mirror it. Adjust the import depth - `JobRolesPage.tsx` sits one level deeper, under
`pages/admin/`.

## Do

1. **Read gate.** Take `user` from `useAuth()` alongside `authFetch`. Compute
   `canView = can(user, "resources.view")`. When it is false, return
   `<NoAccess required="resources.view" />` **before any fetch runs** - do not call the API and
   then interpret the failure. Returning early is the point: the current bug is that the failure
   is interpreted as data.

2. **Write gate.** Compute `canManage = can(user, "resources.manage")`. When false, do not render
   the "+ New role" button, the per-row Edit control, or the Delete control. A user who can see the
   list but not change it must not be offered a control that 403s.

3. **Stop swallowing a failed read.** In `load()`, a non-ok `/job-roles` response must set an error
   state that the page renders, not `[]`. An empty array must mean "the server returned zero rows".
   Keep the existing `EmptyState` for the genuinely-empty case; it is correct and stays.

4. **Do not touch the competencies fetch** beyond the same non-ok handling. Its permission is not in
   evidence and this slice does not guess at it.

## Tests - `JobRolesPage.access.test.tsx`

Follow the shape of the existing `.tsx` tests in that folder.

- A user with **neither** permission renders `data-testid="no-access"` and the string
  `resources.view`, and **no fetch to `/job-roles` is made**. Assert the fetch count, not just the
  markup - an early return is the fix, and a test that only checks the markup would pass on a page
  that still called the API first.
- A user with `resources.view` but not `resources.manage` renders the table and renders **no**
  "+ New role" control.
- A user with both renders the table and the "+ New role" control.
- A non-ok `/job-roles` response for a permitted user renders the error state and **not** the empty
  state. This is the regression guard for the swallow.

## Do NOT

- Do NOT change `job-roles.controller.ts` or anything under `apps/api/`. The API is already correct
  and is the evidence this slice is built on.
- Do NOT change `NoAccess.tsx`, or add a variant of it.
- Do NOT redirect, navigate, or render blank on a permission failure. `NoAccess.tsx` says in its own
  header why: a redirect looks identical to a broken feature.
- Do NOT add the page to any settings nav list, and do NOT touch `settings-nav-items.ts` or
  `SettingsHomePage.tsx` - that is `pr-settings-home-s1`'s scope and touching it here creates a
  conflict.
- Do NOT invent a permission. The two codes in this prompt are read from the controller.
- Do NOT run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`.

## Verify

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-jobroles-s1-noaccess-instead-of-a-dead-shell-ready.md
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
grep -q "NoAccess" apps/web/src/pages/admin/JobRolesPage.tsx
grep -q "resources.view" apps/web/src/pages/admin/JobRolesPage.tsx
grep -q "resources.manage" apps/web/src/pages/admin/JobRolesPage.tsx
git diff --name-only   # exactly the two paths in scope
```

Paste, in the PR body, the rendered output for all three personas and the failed-read case.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
