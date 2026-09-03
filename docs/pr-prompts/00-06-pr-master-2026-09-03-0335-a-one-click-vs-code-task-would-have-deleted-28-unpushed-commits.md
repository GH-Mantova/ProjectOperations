# Station 06 — PR Master | 2026-09-03T03:25Z–03:37Z

Run by the **cloud/chat lane** following the Station 06 pathway at Marco's instruction.
`[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1. Brief: repo hygiene that works every
time without conflicting with running PRs (Marco, 2026-09-02).

## GROUND

```
UTC            2026-09-03T03:25Z
origin/main    f5c01415
dev tree       main @ 52f985e8   C:\ProjectOperations2
doc version    1
bootstrap      n/a — invoked from chat
```

## WHAT I MEASURED

**[MEASURED] 🔴 `.vscode/tasks.json:145` is a one-click, unguarded branch nuke.** Verbatim from
`git show origin/main:.vscode/tasks.json`:

```
"command": "powershell -NoProfile -File scripts/branch-prune.ps1; git fetch --prune;
            git branch -vv | Select-String ': gone]' |
            ForEach-Object { git branch -D ($_.ToString().Trim() -split '\\s+')[0] }"
```

It force-deletes **every** branch whose upstream reads `[gone]`, with no check for unpushed
commits, open PRs, or worktrees. **`fix1483` carried 28 commits that existed nowhere else and read
`[gone]` until 03:0xZ this morning.** One click on that task on any day before today would have
destroyed them, silently, with `-D`.

**[MEASURED] `scripts/branch-prune.ps1` does not exist** — absent from `origin/main`
(`git cat-file -e` fails) and absent from disk. **Two** callers invoke it: the VS Code task above,
and the **enabled, Ready** scheduled task `GH Branch Prune`. Both have been failing silently. The
VS Code one then falls through to the destructive line; the scheduled task simply does nothing,
which is why 414 local branches accumulated.

**[MEASURED] Delete-on-merge does not apply, and my earlier design was wrong.** I had proposed
"delete-on-merge at source plus a rare backstop". `gh pr merge --squash --delete-branch` already
removes the *remote* branch and GitHub confirms it — **3 remote branches against 201 local**. The
local branches do not come from merges at all; they come from station work (`board/00-collect-*`,
`docs/*`, `chore/*`) with no merge event to hang a deletion on. **The backstop is the whole fix.**

**[MEASURED] Nothing is queued for this.** No prompt in `docs/pr-prompts/` matches
`branch prune|branch-prune|delete-branch|stale branch`.

**[MEASURED] Both trees, now:** dev tree 201 local branches / 0 stashes / 46 remote-tracking refs.
`DOCTRINE.md:389` already records why the tracking refs linger — *"without `--prune` never deletes
a tracking ref, so branches GitHub deleted on merge live on"* — and pruning those destroys nothing.

## WHAT CHANGED

One prompt placed at the queue root as `-HOLD` (nothing armed; `armed: 0`, `HOLD: 75`):

| File | Lint |
|---|---|
| `pr-hygiene-s1-guarded-branch-prune-HOLD.md` | **ADMIT (size 3)** |

Nothing else. No arming, no code, no `sot/`.

## FINDINGS

**F1 — A destructive one-click task has been sitting in the repo, and it nearly cost 28 commits.**
The hazard is not that the prune is missing; it is that the *fallback for the prune being missing*
is unguarded `branch -D`. That fallback is removed in this slice.
**DISPOSITION: DISPATCHED** — Station 00, as `pr-hygiene-s1-guarded-branch-prune`.

**F2 — The replacement is designed to be safe unattended, because one caller is a schedule.**
`-DryRun` is the **default**; deleting needs an explicit `-Apply`. Six exclusions, each proven
rather than assumed: `main` and the current branch · anything in `git worktree list --porcelain` ·
anything whose upstream is not `[gone]` · **anything that is the head of an open PR, read from
GitHub, aborting the whole run if that query fails** · anything with a `+` line from
`git cherry origin/main <branch>` (the patch-id test that would have saved `fix1483`) · anything
matching `-Keep`. A restore manifest is written **before** deletion, with the recovery command in
its header, and a manifest that cannot be written aborts the run.
**DISPOSITION: DISPATCHED** — same prompt.

**F3 — The prune must not race the watcher.** Deleting refs takes the same lock the watcher checks
out against. The script gates on `status-sweep.ps1` and exits 0 without deleting on anything but
its safe verdict. The prompt deliberately instructs the agent to **read the sweep script and match
the verdict strings it actually emits** rather than trusting my wording — §7.
**DISPOSITION: DISPATCHED** — same prompt.

**F4 — The scheduled task stays disabled by this slice.**
`GH Branch Prune` is currently enabled and pointing at a file that does not exist. The prompt
explicitly forbids re-enabling it or changing its schedule: the script existing is the
precondition, not the decision. Turning an unattended destructive job on is Marco's call, once he
has seen a dry run.
**DISPOSITION: ESCALATED** — Marco, after the slice merges. Run
`powershell -File scripts/branch-prune.ps1` with no arguments, read the plan, then decide whether
the schedule goes back on and at what cadence.

## WHAT I DID NOT DO

- **Did not arm anything.** The `git mv` to `-ready` is Station 00's.
- **Did not write a delete-on-merge hook.** Grounding refuted my own earlier design for it (see
  WHAT I MEASURED); building it anyway would have added a mechanism with nothing to trigger it.
- **Did not touch the watcher clone.** It has its own branches and ~64 stashes; out of scope and
  deliberately not this script's business.
- **Did not touch stashes anywhere.** `git stash drop` is irreversible and unrelated.
- **Did not prune the 46 stale remote-tracking refs** by hand. `git fetch --prune` stays in the VS
  Code task and destroys nothing.
- **Did not touch `sot/`.**
