---
premise: "git fetch -q origin worktree-agent-a26169fb93e8b9177 && git show origin/worktree-agent-a26169fb93e8b9177:apps/api/src/common/auth/__tests__/permission-matrix.spec.ts | grep -q 'path: ./admin/company/profile., permission: .company.manage., body: {}, viewer: 403, admin: true'"
premise_means: >-
  PR #1874's branch still asserts that the seeded Admin user passes BOTH guards on
  PATCH /admin/company/profile. It cannot: the handler calls `assertSuperUser(req.user)` after the
  permission guard, and admin@projectops.local is not a super-user. That one row is the only red
  test on the branch (run 34560047495: 1 failed, 4162 passed). The five sibling company/branding
  GET rows pass for admin, which proves Admin DOES hold company.manage - the migration grant is
  not the defect, whatever pr-1874-review.md says.
fixes_pr: 1874
scope:
  - apps/api/src/common/auth/__tests__/permission-matrix.spec.ts
done_when: >-
  pnpm --filter api lint && ! grep -qF 'path: "/admin/company/profile", permission:
  "company.manage", body: {}, viewer: 403, admin: true'
  apps/api/src/common/auth/__tests__/permission-matrix.spec.ts && grep -qF 'path:
  "/admin/company/profile", permission: "company.manage", body: {}, viewer: 403 }'
  apps/api/src/common/auth/__tests__/permission-matrix.spec.ts
size: 1
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: auth
---

# Repair PR 1874 - the PATCH /admin/company/profile matrix row asserts a pass the handler forbids

**Do this ON PR #1874's existing branch `worktree-agent-a26169fb93e8b9177`. Do NOT open a new PR.**
The defect is inside that PR's own diff (one spec row it added). main is green.

## FIRST: re-verify against the CURRENT head

Errors drift, and the watcher rebases this branch after every merge to main. Before changing
anything, read the API job log of the **latest** CI run on the branch and confirm the failure is
still exactly the one below. If it has changed, fix what the log actually shows and say so plainly.

At the time of writing (run 34560047495, head adb30f91, API job 103140790387):

    FAIL src/common/auth/__tests__/permission-matrix.spec.ts
      Permission matrix - role x endpoint authorization > company: PATCH /admin/company/profile [company.manage] - admin -> pass
        expect(received).not.toContain(expected)
        Expected value: not 403
        Received array: [401, 403]
    Test Suites: 1 failed, 1 skipped, 291 passed
    Tests:       1 failed, 6 skipped, 4162 passed

**One row, one red.** The other four reds on the PR are not yours: `PR gates - diff checks` falls
with `Approval receipt (CP-26)` (one cause, two reds), and CP-26 is SUPPOSED to fail - #1874 came
from an `escalates: true` prompt. Do NOT touch the `do-not-merge` label and do NOT try to make
CP-26 pass. Only Marco removes it.

## Why the review's diagnosis is wrong, and why it matters that you do not follow it

`docs/pr-reviews/pr-1874-review.md` says the migration's `INNER JOIN ... pa.code = 'platform.admin'`
misses the Admin role because Admin is granted "via the seed's bulk grant". Measure it instead:

- `seed-reference.ts` grants Admin **every** row of `permissions` with `createMany` - and
  `platform.admin` is one of those rows - so Admin holds an explicit `platform.admin`
  RolePermission, and `company.manage` is in the registry, so the seed grants that too.
- The PR adds six `admin: true` rows. **Five pass.** If Admin lacked `company.manage`, all six
  would 403. Only the PATCH does.
- `company-profile.controller.ts` `updateProfile` (the PATCH) calls `this.service.assertSuperUser(req.user)`
  before doing anything - "Super-user only (enforced server-side, not just UI)". The matrix's
  admin@projectops.local is not a super-user (the two super-users are declared in
  `seed-users-prod.ts`). So the guard passes, the handler forbids, and 403 is the correct answer.

Rewriting the migration would change production data to cure a test that is wrong about the
endpoint. Do not.

## What to change

In `apps/api/src/common/auth/__tests__/permission-matrix.spec.ts`, the row

    { group: "company", method: "patch", path: "/admin/company/profile", permission: "company.manage", body: {}, viewer: 403, admin: true },

becomes

    // PATCH /admin/company/profile is super-user gated in the handler (assertSuperUser) on top of
    // company.manage; the matrix admin is not a super-user, so only the permission guard is asserted here.
    { group: "company", method: "patch", path: "/admin/company/profile", permission: "company.manage", body: {}, viewer: 403 },

`admin?: boolean` on `MatrixRow` means "also assert the Admin role passes both guards"; leaving it
off keeps the viewer-403 assertion (the permission guard IS exercised) and drops the claim the
handler cannot honour. This is the same shape as the existing long-tail row
`/tenders/${MISSING}/award`.

Nothing else. Not the migration, not the controllers, not the registry.

## Verify, then push

1. `pnpm --filter api lint`.
2. If you have a database: `pnpm --filter api test -- permission-matrix` and read the company
   group - five admin passes, six viewer 403s. If you do not, say so; CI runs it.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1874` (a squash message is built
   from every commit message and GitHub would auto-close on merge).
4. Push. Do not open a PR - #1874 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1874 is the PR** - push to its branch
`worktree-agent-a26169fb93e8b9177` and do not open another.
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` is inherited from #1874 - it gates the MERGE, not the RUN. Marco merges #1874.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the file in `scope`.
- Never remove the `do-not-merge` label; never merge.
