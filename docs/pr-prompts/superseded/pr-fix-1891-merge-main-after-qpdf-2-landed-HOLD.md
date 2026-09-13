---
premise: "git fetch -q origin main worktree-agent-ab8ed118705aa1958 && git merge-tree $(git merge-base origin/main origin/worktree-agent-ab8ed118705aa1958) origin/main origin/worktree-agent-ab8ed118705aa1958 | grep -q '^+<<<<<<<'"
premise_means: >-
  PR #1891 (draftpanel S1) branched before qpdf-2 (#1892, merged 2026-09-13 13:14Z, 4f1c5078)
  rewrote the status-transition block of TenderingService.updateStatus. Both touch
  apps/api/src/modules/tendering/tendering.service.ts and tendering.service.spec.ts in the same
  hunks, git cannot auto-merge them (mergeStateStatus DIRTY, four conflict hunks), and the
  watcher's update-branch cannot rebase a conflicting PR. Every other red on the branch is gone:
  the constructor-arg and scope-card ratchet fixes both landed (c279b851).
fixes_pr: 1891
scope:
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/tendering.service.spec.ts
done_when: >-
  git merge-base --is-ancestor origin/main HEAD && pnpm --filter @project-ops/api lint && pnpm
  --filter @project-ops/api test -- tendering.service && pnpm --filter @project-ops/api build
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1891 - merge main (qpdf-2's status-transition rewrite) into the draftpanel S1 branch

**Do this ON PR #1891's existing branch `worktree-agent-ab8ed118705aa1958`. Do NOT open a new
PR.** Nothing is wrong with either side; they need to be joined by hand.

## FIRST: re-verify against the CURRENT head

`git fetch origin && git merge origin/main` on the branch. Confirm the conflicts are confined to
`apps/api/src/modules/tendering/tendering.service.ts` and
`apps/api/src/modules/tendering/tendering.service.spec.ts`. If any other file conflicts,
resolve it the same way and say so plainly.

## How to resolve - keep BOTH, never drop either

Both sides agree on the principle: **`ratesSnapshotAt` is owned by `TenderRateSetService.lock()`
and a status change must never stamp it directly.**

- qpdf-2 (main) REMOVED the bare `data.ratesSnapshotAt = now` stamp from `updateStatus` and
  left the comment "The rate snapshot timestamp is owned by TenderRateSetService.lock() and
  must NOT be written here". It also reshaped the SUBMITTED / AWARDED / LOST branches
  (`submittedAt` pinned on first transition, `wonAt`/`lostAt` likewise).
- draftpanel S1 (the branch) added `let needsRateLock = false`, sets it to `true` in each
  branch where `submittedAt` is being pinned and `!existing.ratesSnapshotAt`, and calls
  `await this.rateSetService.lock(id, actorId ?? "system")` BEFORE `this.prisma.tender.update`
  so `lock()` is what writes the snapshot.
- The resolved `tendering.service.ts` keeps main's branch structure and comment, keeps NO
  direct `ratesSnapshotAt` write, and keeps S1's `needsRateLock` flag in every branch that pins
  `submittedAt` plus the `rateSetService.lock(...)` call before the update. Where the two
  comments describe the same rule, keep one comment that says both things.
- The resolved `tendering.service.spec.ts` keeps main's expectations (no `ratesSnapshotAt` in
  the update `data`) AND S1's expectations (`rateSetService.lock` called once on the first
  SUBMITTED transition when no snapshot exists; not called when one exists; the ten-argument
  constructor). If a single assertion cannot satisfy both, main's shipped behaviour wins and
  S1's assertion is adjusted to it.
- Use a MERGE commit (`git merge origin/main`), not a rebase: the branch carries two fix-lane
  commits and the watcher's rebase loop is what got it here.

## Verify, then push

1. `pnpm --filter @project-ops/api lint`.
2. `pnpm --filter @project-ops/api test -- tendering.service` - green.
3. `pnpm --filter @project-ops/api build`.
4. The merge commit's message must not put fix/fixes/close/closes/resolve/resolves immediately
   before `#1891` (the squash message is built from every commit message).
5. Push. Do not open a PR - #1891 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1891 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already merged` and exit.
- Touch only what the merge requires; the two files in `scope` are the ceiling.
- Never add or remove a label; never merge the PR.
