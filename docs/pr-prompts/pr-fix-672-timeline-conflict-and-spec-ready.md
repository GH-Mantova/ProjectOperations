---
premise: gh pr view 672 --json state -q .state | grep -q OPEN
premise_means: PR #672 (universal activity Timeline) is still open, so its conflict + red CI still need fixing.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/platform/platform.module.ts
  - apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test:serial
size: 6
gate_allow: migrations
seed_only: false
escalates: false
---

# Unblock PR #672 - feat(ux): universal activity Timeline

**PR:** https://github.com/GH-Mantova/ProjectOperations/pull/672
**Branch:** `feat/ux-universal-timeline`

This PR is the single blocker on the board. It is DIRTY (merge conflict with `main`), so its
`pull_request` CI is FROZEN - GitHub cannot build the merge commit, gates silently skip, and the
checks will NEVER go green until the conflict is resolved. Resolving the conflict IS the unblock.

You are fixing an EXISTING PR. Do not open a new one. Push to `feat/ux-universal-timeline`.

## Evidence gathered by 00-supervisor on 2026-07-19 (do not re-derive; verify then act)

Merge base: `d05052fd4b91b6e7b7ea3326e3fbffabffbac77a`.

`git merge-tree` says exactly TWO files are "changed in both":

1. `apps/api/prisma/schema.prisma`
2. `apps/api/src/modules/platform/platform.module.ts`

Both are additive-registration conflicts (a model appended to the schema; a
provider/controller added to the module). Take BOTH sides - keep `main`'s additions AND the
Timeline additions. Do not drop either.

The other six files in the PR are adds/edits with no conflict:
`apps/api/prisma/migrations/20260717140000_feat_universal_timeline/migration.sql`,
`apps/api/src/modules/jobs/jobs.service.ts`,
`apps/api/src/modules/platform/timeline.controller.ts`,
`apps/api/src/modules/platform/timeline.service.ts`,
`apps/web/src/components/timeline/Timeline.tsx`,
`apps/web/src/pages/jobs/JobDetailPage.tsx`.

## Work item 1 - resolve the conflict

In a fresh worktree off the PR branch:

    git merge origin/main

Resolve `schema.prisma` and `platform.module.ts` by keeping BOTH sides. Then commit the merge.
Never abandon a merge half-finished - if you cannot resolve it, `git merge --abort` and report
`NO-OP: <reason>`.

## Work item 2 - fix the ONE failing API test (root cause confirmed from the job log)

Job log (run 29630206451, job 88042219922) says:

    FAIL src/modules/jobs/__tests__/jobs.service.spec.ts
      * JobsService.createIssue > creates an issue with defaulted severity and status, writes audit
        TypeError: Cannot read properties of undefined (reading 'create')
    Test Suites: 1 failed, 1 skipped, 175 passed
    Tests:       1 failed, 6 skipped, 2315 passed

Cause, confirmed from the diff: this PR added a new Prisma call inside `JobsService.createIssue`
in `apps/api/src/modules/jobs/jobs.service.ts`:

    await this.prisma.activityEntry.create({ data: { entityType: "Job", entityId: jobId, ... } });

The spec's Prisma mock object (`const prisma: Record<string, unknown> = {` at ~line 52 of
`apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts`) has **no `activityEntry` key**, so
`this.prisma.activityEntry` is `undefined` and `.create` throws.

**Fix:** add an `activityEntry` mock to that object, immediately alongside the existing
`jobStatusHistory` entry at ~line 93, in the same style:

    activityEntry: { create: jest.fn().mockResolvedValue({}) },

That is the whole fix. Do NOT change `jobs.service.ts` - the service behaviour is correct; the
mock was simply never updated (this is the exact failure class PROMPT-SCHEMA warns about:
"Update the affected unit specs").

## Work item 3 - regenerate the data-model map (schema.prisma is in scope)

Because you touch `apps/api/prisma/schema.prisma`, the CI "data model - drift check" will hard-fail
if the generated map is stale (it sank #593). Run and commit the output:

    node scripts/data-model/build-relationship-map.mjs

Commit `docs/data-model/relationship-map.json`, `relationship-map.md`, `metadata-catalog.json`.

## Work item 4 - fix the CP-11 gate failure (PR body, not code)

The gates job failed with:

    FAIL - CP-11 migrations [undeclared: apps/api/prisma/migrations/20260717140000_feat_universal_timeline/migration.sql]

Every other gate PASSed. This is a human-acknowledgement gate, not a defect. First VERIFY the
migration is additive only (no DROP, no destructive ALTER) by reading
`apps/api/prisma/migrations/20260717140000_feat_universal_timeline/migration.sql`. If and only if
it is additive, add this line to the PR body **bare, at column 0** - not as a markdown heading,
no trailing period, nothing else on the line:

    GATE-ALLOW: migrations

Use `gh pr edit 672 --body-file <file>`. CP-11 reads the body LIVE, so no new push is needed for
the gate itself. If the migration is NOT additive, stop and report `NO-OP: migration is
destructive, escalating` - do not add the marker.

## Work item 5 - tendering-e2e

`tendering-e2e` (run 29630206436, job 88042219893) also failed, but it ran against the frozen
pre-conflict state. After items 1-4 are pushed, let CI re-run and READ THE JOB LOG before
diagnosing it - never reason an e2e failure out of the diff. If it is still red for a reason
outside items 1-4, report that plainly rather than guessing.

## Do NOT

- Do NOT open a new PR. #672 already exists; push to `feat/ux-universal-timeline`.
- Do NOT merge #672. Leave it unmerged for the supervisor/shepherd.
- Do NOT change `apps/api/src/modules/jobs/jobs.service.ts`, the timeline service/controller, or
  the web components. Their behaviour is correct.
- Do NOT touch anything under `sot/` (CP-24 hard-fails a PR mixing code and sot/).
- Do NOT run any git command inside `C:\po-watcher\ProjectOperations` or the interactive tree.
- Do NOT touch Azure, Entra or SharePoint.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

Here the PR already exists, so the equivalent completion test is: **is there a pushed commit on
`feat/ux-universal-timeline` and an updated #672 body in my output?**

## Guardrails

- One honest attempt. If two verification attempts fail, say so plainly and stop. Do not loop.
- **Never exit silently.** If you do nothing, say `NO-OP: <reason>` loudly.
- **Never ask a question or "stand by" for approval.** There is nobody awake. Ten runs died that way.
- **Never diagnose a CI failure without reading the job log** (`gh run view <run> --job <job> --log`).
- Read back every mutation. "I pushed" is not evidence; `git log`/`gh pr view` is.
