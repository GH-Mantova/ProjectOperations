---
premise: '! test -f scripts/branch-prune.ps1'
premise_means: >-
  Two callers invoke scripts/branch-prune.ps1 and the file does not exist on origin/main or on
  disk - the "GH Branch Prune" scheduled task (enabled, Ready) and .vscode/tasks.json:145. Both
  have been failing silently. Worse, the VS Code task does not stop there: it falls through to
  `git branch -vv | Select-String ': gone]' | ForEach-Object { git branch -D ... }`, which deletes
  EVERY branch whose upstream is gone, with no check for unpushed commits, open PRs or worktrees.
  Measured 2026-09-03 - fix1483 carried 28 commits that existed nowhere else and read `[gone]`
  until it was pushed that morning. One click on that task would have destroyed them.
scope:
  - scripts/branch-prune.ps1
  - .vscode/tasks.json
  - scripts/pipeline/__tests__/branch-prune.test.mjs
done_when: >-
  test -f scripts/branch-prune.ps1 && grep -q "DryRun" scripts/branch-prune.ps1 && ! grep -q "branch -D" .vscode/tasks.json
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# HYG-S1: a branch prune that exists, and cannot eat unpushed work

**Grounded against `origin/main` = `f5c01415`, measured 2026-09-03.**

Decided by Marco 2026-09-02: *"fix it in a way that will promote repo hygiene correctly and
efficiently every time, without creating conflicts or issues with running prs."*

## What grounding changed about the design

The original plan was "delete-on-merge at source, plus a rare backstop". **Delete-on-merge does not
apply here.** `gh pr merge --squash --delete-branch` already deletes the *remote* branch, and
GitHub confirms it — `origin` carries 3 branches against 201 local. The local branches do not come
from merges; they come from station work (`board/00-collect-*`, `docs/*`, `chore/*`) that has no
merge event to hang a deletion on. **So the backstop is the whole fix**, and it must be safe enough
to run unattended.

## Do

1. **Write `scripts/branch-prune.ps1`.** Pure ASCII. Prunes **local** branches only in
   `C:\ProjectOperations2`. It NEVER touches a remote ref — GitHub already deletes on merge.

   **`-DryRun` is the DEFAULT.** Deleting requires an explicit `-Apply`. A hygiene script whose
   default action is destructive is the wrong shape for something on a schedule.

   Parameters: `-Repo` (default `C:\ProjectOperations2`), `-DryRun` (default `$true`), `-Apply`.

   **Six exclusions, every one of which must be proven before a branch is eligible:**
   - `main`, and the currently checked-out branch.
   - Any branch checked out in a worktree — from `git worktree list --porcelain`, not by guessing.
   - Any branch whose upstream is NOT `[gone]` — read from `%(upstream:track)`.
   - **Any branch that is the head of an OPEN PR.** Query GitHub for the real list
     (`gh pr list --state open --json headRefName`). Do not infer it from local state; only GitHub
     knows. **If that query fails, ABORT the whole run** — a prune that cannot see the open PRs is
     exactly the prune that eats one.
   - Any branch where `git cherry origin/main <branch>` reports one or more `+` lines. A `+` means
     a commit is not upstream by patch-id. This is the test that would have saved `fix1483`.
   - Any branch whose name matches an operator-supplied `-Keep <glob[]>`.

2. **Write a restore manifest before deleting anything**, not after:
   `C:\_SWEEP-branch-prune\<UTC yyyyMMddTHHmmss>.txt`, one `<sha>  <committerdate>  <name>` per
   line, with a header giving the exact recovery command
   `git branch <name> <sha>`. Then delete. If the manifest cannot be written, ABORT.

3. **Gate it on the sweep.** Before any deletion, run `scripts/pipeline/status-sweep.ps1` and obey
   it. **Read that script and match the verdict strings it actually emits** — do not assume the
   wording. On anything other than its safe verdict: print the verdict, exit 0, delete nothing.
   Deleting refs takes the same lock the watcher checks out against, and a prune racing a checkout
   is how a 0-byte `index.lock` gets made (DOCTRINE §9.2, seven occurrences).

4. **Fix `.vscode/tasks.json:145`.** Replace the whole compound command with a single call to the
   new script in dry-run:
   `powershell -NoProfile -File scripts/branch-prune.ps1`.
   **Delete the `git branch -D` fall-through entirely.** Keep `git fetch --prune` — DOCTRINE:389
   is right that stale tracking refs need it, and pruning a tracking ref destroys nothing.

5. **Tests** (`scripts/pipeline/__tests__/branch-prune.test.mjs`, following the existing
   `__tests__/*.test.mjs` convention). Build a throwaway repo under `$env:TEMP` — **never** the dev
   tree — and assert:
   - a branch with an unpushed commit is **kept**, and named in the output as kept;
   - a branch fully patch-equivalent to `main` is listed for deletion in dry-run and **not deleted**
     without `-Apply`;
   - the same branch **is** deleted with `-Apply`, and the manifest exists and names it;
   - `main` and a worktree-held branch are never listed;
   - a simulated `gh` failure aborts the run with a non-zero exit and deletes nothing.

## Do NOT

- Do NOT delete remote branches, ever. Not `git push --delete`, not `gh api`.
- Do NOT run in the watcher clone. `C:\po-watcher\ProjectOperations` has its own branches and
  stashes and is not this script's business.
- Do NOT drop stashes. `git stash drop` is irreversible and nothing here is about stashes.
- Do NOT make `-Apply` the default, and do NOT add a `-Force` that skips the sweep gate.
- Do NOT re-enable the "GH Branch Prune" scheduled task in this slice, and do NOT change its
  schedule. Marco decides when an unattended prune starts running; the script existing is the
  precondition, not the decision.
- Do NOT touch `sot/`.

## Verify

- `powershell -File scripts/branch-prune.ps1` with no arguments: prints a plan, **deletes nothing**,
  exits 0. Run this first — it is the control that proves the default is safe.
- `git for-each-ref refs/heads/ | wc -l` is identical before and after that dry run.
- With `-Apply` on the throwaway test repo: only patch-equivalent branches go, the manifest exists
  and every deleted branch appears in it, and `git branch <name> <sha>` from the manifest restores
  one.
- **The `fix1483` control, on the real repo, dry-run only:** create a scratch branch two commits
  ahead of `origin/main` with no upstream, confirm the script lists it as **KEPT** with the reason,
  then delete the scratch branch by hand.
- `grep -c "branch -D" .vscode/tasks.json` returns 0.
- The new test file passes; the existing `scripts/pipeline/__tests__` suites still pass.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
