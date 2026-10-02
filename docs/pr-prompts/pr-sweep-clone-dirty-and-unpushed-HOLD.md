---
premise: '! grep -q "SWEEP_DIRTY_MEANS_WHAT_THE_WATCHER_MEANS_V1" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  Two status-sweep.ps1 warnings measure the wrong thing. MEASURED 2026-10-02 at origin/main cf09be41.
  (1) The watcher-clone block counts `git status --short`, which includes untracked files, then
  prints "NOT clean-on-main; the watcher may refuse to start". But start-watcher.ps1 decides with
  `git status --porcelain --untracked-files=no` (start-watcher.ps1, the comment "Only TRACKED
  modified/staged files count as dirty"). So the sweep warns about a clone the watcher starts on
  happily. That is why the sweep has printed "watcher clone dirty=1, may refuse to start" for weeks.
  (2) In the worktree-liveness block, an orphaned worktree with dirty=0 gets no warning at all, even
  when its branch holds commits that exist on no remote. Pruning it destroys them.
  Sources: needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md and
  needs-marco/status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md (local, gitignored);
  items 1 and 2 of the 2026-09-24 handover to Station 06.
requires_on_main: 'scripts/pipeline/status-sweep.ps1 :: WORKTREE_ORPHAN_ASKS_THE_BOARD_V1'
done_when: >-
  pnpm build && pnpm lint &&
  grep -q "SWEEP_DIRTY_MEANS_WHAT_THE_WATCHER_MEANS_V1" scripts/pipeline/status-sweep.ps1 &&
  grep -q "untracked-files=no" scripts/pipeline/status-sweep.ps1 &&
  grep -q "not --remotes" scripts/pipeline/status-sweep.ps1
scope:
  - scripts/pipeline/status-sweep.ps1
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  One read-only reporting script. Reverting restores the two old warnings. It changes no state.
escalates: true
module: pipeline
---

# status-sweep: "dirty" means what the watcher means, and unpushed commits block a prune

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

**Why this waits for another prompt.** Station 00's staged `pr-sweep-orphan-worktree-asks-the-board`
edits the same orphaned-worktree block. This prompt is gated on that prompt's needle
(`requires_on_main`) so the two never collide. Build on top of its version of the block: keep its
`RETAINED - branch has OPEN PR` row and its `diff --numstat origin/main` dirty-row wording exactly as
merged.

Tag each change with `SWEEP_DIRTY_MEANS_WHAT_THE_WATCHER_MEANS_V1` in a comment.

## 1. The clone-dirty flag uses the watcher's own test

In the `# watcher CLONE health` block:

- Count **tracked** changes with `git status --porcelain --untracked-files=no`, the exact command
  `start-watcher.ps1` uses, so the two instruments cannot disagree.
- Count untracked files separately with `git status --porcelain --untracked-files=normal`, keeping
  only lines starting with `??`.
- The `NOT clean-on-main; the watcher may refuse to start` flag fires only on a wrong branch or on
  tracked changes > 0.
- When only untracked files are present, print an informational line instead, for example
  `watcher clone: N untracked file(s) -- the watcher ignores these; add them to .git/info/exclude if they are expected`.
  The 2026-09-24 handover's worked instance was cured exactly that way.

Output line shape: `watcher clone: branch=main tracked-dirty=0 untracked=3`. Keep the `LIVE` tag.

## 2. An orphaned worktree with unpushed commits is not safe to prune

In the orphaned-worktree branch of the liveness loop, for every row that would otherwise read as
prunable:

- Count commits that exist on no remote:
  `git -C <path> rev-list --count HEAD --not --remotes`. Test `$LASTEXITCODE` before using the
  number.
- If it is > 0, print
  `<-- HOLDS <n> COMMIT(S) ON NO REMOTE BRANCH. Push or preserve before pruning. A squash-merged branch also shows here: confirm with gh pr list --head <branch> --state merged.`
  and do not print any "safe to prune" wording for that row.
- If git cannot answer (exit non-zero, detached with no history), print
  `[CANNOT MEASURE] unpushed commits; prune advice withheld`. Never fall back to "safe".

This applies whether or not the row is dirty. Dirty and unpushed are separate warnings, and either
one alone withholds the prune advice.

## Shell rules (DOCTRINE section 9.1)

This is PowerShell. **No single-letter variable names**, and no automatic-variable names (`$home`,
`$host`, `$input`, `$pwd`, `$args`, `$matches`) as an assignment or loop target.

## Controls before opening the PR

Run the sweep and paste the relevant lines into the PR body:

- **Positive (1):** create an untracked scratch file in a throwaway clone and point the clone block at
  it. It shows `tracked-dirty=0 untracked=1` and **no** "may refuse" flag. Modify a tracked file and
  the flag appears. Then clean up the scratch.
- **Positive (2):** a throwaway worktree with one local commit, older than 30 minutes (back-date it
  with `(Get-Item <path>).LastWriteTime = (Get-Date).AddHours(-2)`), shows the
  `COMMIT(S) ON NO REMOTE BRANCH` warning.
- **Negative (2):** a worktree checked out at `origin/main` with no local commits shows no such
  warning.

Remove the throwaway worktrees with `scripts/pipeline/new-worktree.ps1 -Remove` when done.

`escalates: true`: it edits a shared pipeline instrument. The PR opens labelled `do-not-merge`, and
Marco releases it.
