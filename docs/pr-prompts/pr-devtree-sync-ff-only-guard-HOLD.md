---
premise: '! grep -q "DEVTREE_RESET" .claude/hooks/guard.mjs'
premise_means: >-
  The command guard has no rule about `git reset` inside the dev tree C:\ProjectOperations2. Measured
  2026-08-28T08:10Z: the dev tree's reflog shows HEAD advanced to origin/main four times in one day by
  `reset: moving to origin/main`. A mixed reset moves HEAD and the index but never writes new files
  into the working tree, so every prompt added on main by a board PR stays invisible to the watcher,
  which globs the DISK. Three prompts staged by #1370 and #1371 were tracked-on-main and absent from
  disk within the hour. The same reset also silently discards a staged arming rename.
scope:
  - .claude/hooks/guard.mjs
  - scripts/pipeline/__tests__/**
done_when: >-
  grep -q "DEVTREE_RESET" .claude/hooks/guard.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: devtree-sync-guard
cluster_order: 1
---

# Dev-tree sync must be `merge --ff-only`, and the guard must say so

## The defect, measured

`git reset` is being used as the dev-tree convergence method. It is the wrong instrument for the job
and it fails in two directions at once:

1. **It cannot materialise a new file.** `reset` (mixed) moves `HEAD` and rewrites the index; the
   working tree is untouched. A prompt added on `main` therefore appears as ` D` (tracked, missing)
   and never reaches the disk queue the watcher globs. Arming is a `git mv` of an on-disk tracked
   `-HOLD.md`, so such a prompt is unarmable — it is staged, invisible, and looks landed.
2. **It silently discards a staged arming rename.** The dev-tree index is shared between concurrent
   chats. A `reset` to `origin/main` takes the `R100` rename with it and leaves no trace anywhere
   except the reflog.

`git fetch` + `git merge --ff-only origin/main` has neither failure: it writes the new files, and it
REFUSES when the tree has diverged instead of quietly winning.

## What to build

Add a narrow, deny-only rule to `.claude/hooks/guard.mjs`, marked with the literal token
`DEVTREE_RESET` so this premise can find it:

- **BLOCK** `git reset` (any form) when the command's working directory is the dev tree
  `C:\ProjectOperations2`. The stderr message must name the replacement:
  `git fetch origin +refs/heads/main:refs/remotes/origin/main` then `git merge --ff-only origin/main`,
  and must say that a refusal from `--ff-only` is information, not an obstacle.
- Keep the existing guard doctrine intact: **deny-only, never `ask`** (an ask-prompt hangs a headless
  run forever), **deny narrowly**, and **fail OPEN if the hook itself throws**.
- Do NOT block `reset` in worktrees, in `C:\po-watcher`, or on feature branches. The blast radius
  being guarded is the shared dev tree only.

Add a unit test that proves the rule fires on a dev-tree `git reset` and does NOT fire on the three
allowed cases above. A guard never seen to pass on a case it must allow is not a guard.

## Standing authority

You have STANDING AUTHORITY to finish the work, commit, push and open the PR without asking. Do not
exit 0 without a PR: if the premise is false, say so in the log and stop loudly.

## Why this is a HOLD

The rule it encodes is Marco's to ratify: it forbids a command several concurrent chats currently use
routinely. Escalated by Station 00 in its 2026-08-28T08:08Z breadcrumb. Arm only after he answers.
