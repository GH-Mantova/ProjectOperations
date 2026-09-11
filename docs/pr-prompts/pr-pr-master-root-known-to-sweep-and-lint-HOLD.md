---
premise: '! grep -q "PR-Master" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  Marco created C:\PR-Master on 2026-09-11 as the ONE root every station and chat puts its
  per-PR worktree under, so a missing or orphaned PR tree can be found by listing one folder
  instead of eighteen. Nothing in the pipeline knows the folder yet: status-sweep.ps1's
  registry-escapee scan reads only C:\po-worktrees, C:\po-wt and C:\po-watcher-worktrees
  ($worktreeRoots, :250), lint-station.mjs's known-machine-paths list (:37-38) does not carry
  it, and watcher-loop-check.ps1 (:62) reports C:\po-worktrees alone. A worktree under the new
  root is therefore invisible to the only instrument that reports escapees.
scope:
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/lint-station.mjs
  - scripts/watcher-loop-check.ps1
  - docs/pipeline/PR-MASTER.md
done_when: >-
  grep -q "PR-Master" scripts/pipeline/status-sweep.ps1 && grep -q "PR-Master"
  scripts/pipeline/lint-station.mjs && grep -q "PR-Master" scripts/watcher-loop-check.ps1 &&
  test -f docs/pipeline/PR-MASTER.md && node scripts/pipeline/lint-station.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: pipeline
---

# PR-Master: teach the three instruments the one root every PR worktree now lives under

Marco, 2026-09-11 in chat: "can't all these 'pr folders' be inside one root folder, let's say
PR Master? this way is much easier for you and all the other chats/agents to monitor and find
any missing prs." He created `C:\PR-Master` and mapped it for the project. The rule that every
PR is built on its own branch in its own worktree stands; what changes is WHERE those
worktrees go.

## The convention (write it into `docs/pipeline/PR-MASTER.md`, new file, short)

- `C:\PR-Master\worktrees\<slug>` - every disposable worktree a station, lane or chat adds with
  `git worktree add` (board PRs, receipt pushes, verification checkouts, smoke trees). One
  folder per PR/branch, named for the PR or the run, removed with `git worktree remove` when
  the PR lands.
- `C:\PR-Master\drafts\` - prompts and breadcrumbs being written that are not yet in the queue.
- Legacy roots (`C:\po-worktrees`, `C:\po-wt`, `C:\po-wt-h`, `C:\po-watcher-worktrees`,
  `C:\po-vg`, `C:\po-fix*`, `C:\po-smoke`, `C:\po-sec-fix`, `C:\po-sup-fix`, `C:\po-preserve`,
  `C:\po-work`) are NOT deleted by anyone. Station 03 moves each one to
  `C:\PR-Master\_retired-<yyyy-mm-dd>\<name>` once `git worktree list` no longer names it and
  its dirty count is 0; a dirty one is listed, never moved. Marco's rule: never delete, quarantine.
- The watcher's own clone (`C:\po-watcher\ProjectOperations`) and the dev tree
  (`C:\ProjectOperations2`) stay where they are; they are not PR folders.
- Name the doc's sections with plain words, never with the `#` characters in prose
  (check-breadcrumb orders sections by `text.indexOf`).

## The three code changes (each one line or two)

1. `scripts/pipeline/status-sweep.ps1` :250 - `$worktreeRoots` gains `"C:\PR-Master\worktrees"`
   FIRST in the array, and keeps the three legacy roots (they still hold trees today). Add one
   comment line above it saying the legacy roots retire per `docs/pipeline/PR-MASTER.md`.
2. `scripts/pipeline/lint-station.mjs` :37-38 - add `'C:\\PR-Master'` to the known-machine-paths
   list beside `'C:\\po-worktrees'`. Run `node scripts/pipeline/lint-station.mjs` afterwards; it
   must still pass on every station document (this is a list of paths documents may NAME,
   nothing else).
3. `scripts/watcher-loop-check.ps1` :62-66 - the block that lists `C:\po-worktrees` loops over
   `@("C:\PR-Master\worktrees", "C:\po-worktrees")` and prints each root's count on its own line;
   a root that does not exist prints `<root> does not exist` exactly as the current line does.

Do NOT move any folder, do NOT touch `git worktree` state, do NOT change what the sweep does
with an escapee (report, never prune). This prompt makes the instruments SEE the new root;
the migration of old trees is Station 03's, by hand, under the doc's rule.

## Verify

- `pnpm exec node scripts/pipeline/lint-station.mjs` exit 0.
- `powershell -NoProfile -File scripts/pipeline/status-sweep.ps1 *> /tmp/sweep.txt` (or the
  Windows equivalent under `C:\po-sup-fix-scripts\`) and grep the output for
  `worktree-registry-escapees` - the line must still print, and if `C:\PR-Master\worktrees`
  holds a directory not in `git worktree list` it must appear as `REGISTRY-ESCAPEE`.
- `git diff --numstat` shows exactly the four files.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: false` - three instrument lists and one doc; nothing here touches data, auth or a
client-facing document.

## Guardrails

- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied` and exit.
- Touch only the four files in `scope`.
