---
premise: 'grep -nE "permissions\?\.includes\(" apps/web/src/pages/directory/SubcontractorsPage.tsx apps/web/src/pages/projects/ProjectDetailPage.tsx | grep -qv "isSuperUser"'
premise_means: At least one bare capability flag in SubcontractorsPage or ProjectDetailPage still reads user.permissions directly with no isSuperUser short-circuit, so a super-user without the role grant is denied the action.
scope:
  - apps/web/src/pages/directory/SubcontractorsPage.tsx
  - apps/web/src/pages/projects/ProjectDetailPage.tsx
  - apps/web/src/auth/__tests__/superuser-parity.guard.test.ts
done_when: 'pnpm --filter @apps/web build && pnpm lint && ! grep -qE "permissions\?\.includes\(" apps/web/src/pages/directory/SubcontractorsPage.tsx apps/web/src/pages/projects/ProjectDetailPage.tsx'
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Frontend super-user parity: the four capability flags `pr-frontend-superuser-guard-parity` left behind

## The defect (04-scanner, Part 0 (a) authorization parity, 2026-07-20)

Verified on a clean worktree off `origin/main` @ `2e29ad7`. Four capability flags gate on
`user.permissions` with **no** `isSuperUser` short-circuit:

```
apps/web/src/pages/directory/SubcontractorsPage.tsx:124  const canManage = Boolean(user?.permissions?.includes("directory.manage"));
apps/web/src/pages/directory/SubcontractorsPage.tsx:125  const canAdmin  = Boolean(user?.permissions?.includes("directory.admin"));
apps/web/src/pages/projects/ProjectDetailPage.tsx:478    const canManage = user?.permissions?.includes("projects.manage") ?? false;   // ScheduleTab
apps/web/src/pages/projects/ProjectDetailPage.tsx:1956   const canManage = user?.permissions?.includes("projects.manage") ?? false;   // DailyDiaryTab
```

`user.permissions` is **never expanded for super-users** — `users.service.ts` builds it purely from
`userRoles -> role -> rolePermissions`, and `isSuperUser` is minted as a **separate** JWT claim. Both
backend guards (`common/auth/permissions.guard.ts`, `personas/persona-permission.guard.ts`) do
`if (request.user?.isSuperUser) return true;`. So the API will serve these actions to a super-user
while the UI hides the controls: a silent, one-sided lockout.

## Not a suspicion, and not a re-file

**Angle 1 — reproduced twice** on the clean worktree (grep, then read the source lines directly).

**Angle 2 — source.** The shared helper already exists and is the house convention:
`apps/web/src/auth/permissions.ts:5` — `return user.isSuperUser === true || user.permissions.includes(code);`

**Angle 3 — ground truth.** Station brief Part 0 (a): a capability flag that ignores super-user is S3.

**Angle 4 — history.** These sites are the residue of finding **S3-015**. Its fix prompt,
`pr-frontend-superuser-guard-parity-ready.md`, is in `docs/pr-prompts/processed/` — it **ran and
fixed the others** but left these four. Proof that the rest are done, from the same sweep on
`2e29ad7`: `CorrectiveActionDetailPage.tsx:87`, `CorrectiveActionsPage.tsx:76`,
`FormsListPage.tsx:135-136`, `FormSubmissionDetailPage.tsx:287`, `WorkerDetailPage.tsx:212,217` all
now read `|| user?.isSuperUser`. No redirect guard on main ignores super-user (that class is closed).
No open PR, live `-ready.md`, or HOLD file names these two files' permission flags.

**Angle 5 — blast radius.** 2 files, 4 sites. `ProjectDetailPage.tsx:1956` (DailyDiaryTab) was **not**
in the S3-015 call-site list — the file's top-level component correctly uses `can()`, and two inner
tab components each hand-rolled their own copy. That is why a file-level sweep missed it.

## What to build

1. In both files, replace each bare flag with the existing helper — import it, do not re-implement:

   ```ts
   import { can } from "../../auth/permissions";   // adjust the relative path per file
   ...
   const canManage = can(user, "directory.manage");
   const canAdmin  = can(user, "directory.admin");
   ```

   Apply the same to `ProjectDetailPage.tsx` `ScheduleTab` and `DailyDiaryTab`
   (`can(user, "projects.manage")`). Change **only** the flag derivation — leave every downstream
   use of `canManage` / `canAdmin` exactly as it is.

2. Add `apps/web/src/auth/__tests__/superuser-parity.guard.test.ts`: read the two source files, and
   assert that no line matching `/permissions\?\.includes\(/` remains in either. Give it a
   **positive control** in the same test (assert the extractor finds a known-present marker such as
   `can(` in each file, `expect(hits).toBeGreaterThan(0)`) — an extractor that silently matches
   nothing is not a guard (DOCTRINE §7).

3. Run `pnpm --filter @apps/web build` and `pnpm lint`; fix anything the change breaks.

## Do NOT

- Do NOT change what any permission code *is* — no code is added, removed, retargeted or renamed,
  and no role is granted anything. This is parity with the backend guards only.
- Do NOT touch `apps/web/src/auth/permissions.ts` — `can()` is already correct.
- Do NOT sweep other files. The rest of the S3-015 list is already fixed; widening scope here risks
  colliding with `pr-qa-timeline-superuser-and-contacts-perm-ready.md` (API side) and
  `pr-qa-clients-perms-registry-ready.md` (registry), both armed this cycle.
- Do NOT touch migrations, seeds, `.env`, `schema.prisma`, `sot/**`, or Azure/Entra/SharePoint.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` — never exit silently, never "stand by" for approval.
- Read the CI job log before diagnosing any red check (never from the diff alone).
- The completion test: is there a PR number in your output? If not because the work was already on
  `main`, say `NO-OP`. If not because you are waiting for someone — WRONG, there is nobody; open the PR.
