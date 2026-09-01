---
premise: '! grep -q "orphanWorktreeDirs" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  status-sweep.ps1 decides "orphaned worktrees: none" from `git worktree list` alone
  (status-sweep.ps1:117). A worktree DIRECTORY whose .git/worktrees/<name> admin entry is already
  gone is invisible to that query, so the sweep prints a clean [LIVE] line while abandoned trees sit
  on disk. Measured 2026-08-31T02:1xZ at c1244317: the sweep said "none" while
  C:\po-worktrees held three abandoned trees (56.2 MB, 11-14 days old), two of them pointing at
  gitdir paths inside destroyed Linux sandbox VMs.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: >-
  grep -q "orphanWorktreeDirs" scripts/pipeline/status-sweep.ps1 && grep -q "abandoned worktree
  DIRS" scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# status-sweep must also see abandoned worktree DIRECTORIES, not just registered worktrees

## The defect

`scripts/pipeline/status-sweep.ps1:117` builds its orphan list like this:

```powershell
$wt = @(git worktree list 2>$null | Where-Object { $_ -notmatch "\[main\]$" -and $_ -notmatch [regex]::Escape($Repo) })
```

`git worktree list` enumerates the entries under `.git/worktrees/`. It says nothing about
directories on disk. The moment a worktree's admin entry is removed - by `git worktree prune`, or
because the tree was created from a sandbox VM whose `.git/worktrees/<name>` directory never
existed on this filesystem - the directory becomes invisible to the check, and the sweep prints:

```
[LIVE] orphaned worktrees: none
```

That is DOCTRINE section 7 exactly: not a broken system, a broken MEASUREMENT of one. It reads as a
clean result and it is an empty query.

## The measurement that found it (2026-08-31T02:1xZ, origin/main c1244317)

`git worktree list` in the dev tree returned ONE line (`C:/ProjectOperations2 c1244317 [main]`),
`.git/worktrees` was empty in both the dev tree and the watcher clone, and status-sweep duly
reported `orphaned worktrees: none`. The same moment, on disk:

| path | files | bytes | last write | `.git` file contents |
|---|---|---|---|---|
| `C:\po-worktrees\fix-followup-notes` | 0 | 0 | 2026-08-17 | absent |
| `C:\po-worktrees\po-scan-1787002207` | 2295 | 27,283,317 | 2026-08-18 | `gitdir: /sessions/funny-blissful-archimedes/mnt/ProjectOperations2/.git/worktrees/po-scan-1787002207` |
| `C:\po-worktrees\scan-1787220682` | 2458 | 28,965,402 | 2026-08-20 | `gitdir: /sessions/peaceful-gracious-knuth/mnt/ProjectOperations2/.git/worktrees/scan-1787220682` |

Both `.git` pointers name `/sessions/<vm-id>/mnt/...`, i.e. Linux sandbox paths that do not resolve
on this host and never will. These are the `po-scan-*` orphans the 04-scanner station doc warns
about by name - and the instrument whose job is to surface them cannot see them.

## What to build

In `scripts/pipeline/status-sweep.ps1`, keep the existing `git worktree list` check exactly as it
is, and ADD a second, independent disk-side check next to it. Additive only: the registered-worktree
line must keep printing what it prints today, so nothing that reads this report has to change.

1. Define the worktree parent directories the pipeline uses - at minimum `C:\po-worktrees` and
   `C:\po-watcher-worktrees`. Put them in one array variable near the top of the section so a future
   reader can extend it in one place.
2. Enumerate the immediate child directories of each parent that exists. For each child, classify it:
   - **REGISTERED** - its path appears in the `git worktree list` output already gathered.
   - **ABANDONED** - it does not, i.e. no admin entry backs it.
3. Emit a `[LIVE]` line named `abandoned worktree DIRS: <n>` and, when n > 0, one indented line per
   directory carrying the path, the file count, the total size in MB, the last-write date, and the
   `gitdir:` target read out of its `.git` file when that file exists and is a file. When n is 0,
   print `abandoned worktree DIRS: none`.
4. Use a variable named `orphanWorktreeDirs` for the classified list - `done_when` greps for it, and
   the string `abandoned worktree DIRS` is the second grep target.
5. REPORT ONLY. The sweep must not remove, prune, clean or move anything. No agent bulk-removes
   worktrees; the sweep's job is to make them visible so a human decides.

## Guard against the obvious way of getting this wrong

- Do NOT replace the `git worktree list` check. Two instruments over the same population that can
  disagree is the whole value here; collapsing them back to one recreates the blindness.
- Do NOT use single-letter PowerShell variable names (DOCTRINE section 9.1 / section 7 lie #5).
- `Get-ChildItem -Recurse` over a 2000-file tree is slow. Measure the size, but keep the whole
  addition well under the sweep's existing runtime; skip the recursive size when the parent
  directory does not exist.
- Path comparison must be case-insensitive and slash-agnostic: `git worktree list` prints
  `C:/po-worktrees/foo` with forward slashes, `Get-ChildItem` yields `C:\po-worktrees\foo`.
  Normalise both sides before comparing, or every registered worktree will be misreported as
  abandoned. Prove it with a positive control before believing a non-zero count.

## Do NOT

- Do NOT touch any other section of `status-sweep.ps1`.
- Do NOT remove, prune or clean any worktree, directory or lock file.
- Do NOT touch `/sot/`, `apps/**`, `prisma/**`, or any file outside `scope`.
- Do NOT change the sweep's exit code or its VERDICT section.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - say `NO-OP: <reason>` if you do nothing.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure; never reason a red out of the diff.
- Before you finish, ask: is there a PR number in my output?
