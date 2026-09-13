---
premise: "git fetch -q origin worktree-agent-ab8ed118705aa1958 && ! git show origin/worktree-agent-ab8ed118705aa1958:apps/api/src/modules/tendering/__tests__/tender-delete.spec.ts | grep -qi 'rateset'"
premise_means: >-
  PR #1891 added a tenth constructor parameter to TenderingService (`rateSetService:
  TenderRateSetService`) and updated one spec, but five other suites still construct the service
  with nine arguments and fail to compile (TS2554 "Expected 10 arguments, but got 9"):
  tendering.service.spec.ts (11 sites), __tests__/team-and-comm-filter.integration.spec.ts:24,
  __tests__/tendering-win-counted.spec.ts:45, __tests__/tender-client-bid-status.spec.ts:22,
  __tests__/tender-delete.spec.ts:42. 5 suites failed, 288 passed on head cfbb46fc (run
  34749726976, API job 103704247060). The PR title has already been corrected to feat(tendering).
fixes_pr: 1891
scope:
  - apps/api/src/modules/tendering/tendering.service.spec.ts
  - apps/api/src/modules/tendering/__tests__/team-and-comm-filter.integration.spec.ts
  - apps/api/src/modules/tendering/__tests__/tendering-win-counted.spec.ts
  - apps/api/src/modules/tendering/__tests__/tender-client-bid-status.spec.ts
  - apps/api/src/modules/tendering/__tests__/tender-delete.spec.ts
done_when: >-
  pnpm --filter api build && pnpm --filter api lint && pnpm --filter api test -- tendering
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1891 - five tendering suites still construct TenderingService with nine arguments

**Do this ON PR #1891's existing branch `worktree-agent-ab8ed118705aa1958`. Do NOT open a new PR.**
The defect is inside that PR's own diff (a new constructor dependency the tests did not follow).
main is green.

## FIRST: re-verify against the CURRENT head

Errors drift, and the watcher rebases this branch after every merge to main. Read the API job
log of the **latest** CI run on the branch and confirm the failures are still the TS2554s below.
If they have changed, fix what the log shows and say so plainly.

At the time of writing (run 34749726976, head cfbb46fc, API job 103704247060):

    FAIL src/modules/tendering/tendering.service.spec.ts  - TS2554: Expected 10 arguments, but got 9  (x11)
    FAIL src/modules/tendering/__tests__/team-and-comm-filter.integration.spec.ts:24
    FAIL src/modules/tendering/__tests__/tendering-win-counted.spec.ts:45
    FAIL src/modules/tendering/__tests__/tender-client-bid-status.spec.ts:22
    FAIL src/modules/tendering/__tests__/tender-delete.spec.ts:42
    Test Suites: 5 failed, 1 skipped, 288 passed

## What to change

`TenderingService`'s constructor on the branch ends with `private readonly rateSetService:
TenderRateSetService` (tenth parameter). Every `new TenderingService(...)` in the five files above
passes nine `as never` mocks; append a tenth mock in the same style. Read `tendering.service.ts`
on the branch first and mock exactly the methods the service calls on `rateSetService` (the
submit path creates a rate set when the tender was never locked - see
`__tests__/tendering-submit-locks-rates.spec.ts`, which the PR itself wrote and which shows the
shape the author intended), with `jest.fn().mockResolvedValue(...)` returns that keep every
existing assertion true. Where an existing test never reaches the submit path, an empty
`{}` cast `as never` is enough - do not invent behaviour those tests do not exercise.

Nothing else: not the service, not the web files, not the new spec the PR added.

## Verify, then push

1. `pnpm --filter api build && pnpm --filter api lint`.
2. `pnpm --filter api test -- tendering` - the five suites compile and pass; the PR's own
   `tendering-submit-locks-rates.spec.ts` still passes.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1891`.
4. Push. Do not open a PR - #1891 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1891 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the five files in `scope`.
- Never add or remove a label; never merge.
