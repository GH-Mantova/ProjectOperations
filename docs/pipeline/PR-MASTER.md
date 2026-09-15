# PR-Master root convention

Marco created `C:\PR-Master` on 2026-09-11 as the ONE root every station, lane and chat
puts its per-PR worktree under. A missing or orphaned PR tree can now be found by listing
one folder instead of eighteen. The rule that every PR is built on its own branch in its
own worktree stands; what changes is WHERE those worktrees go.

## Layout

- `C:\PR-Master\worktrees\<slug>` — every disposable worktree a station, lane or chat adds
  with `git worktree add`. One folder per PR/branch, named for the PR or the run, removed
  with `git worktree remove` when the PR lands. This covers board PRs, receipt pushes,
  verification checkouts, smoke trees — anything.
- `C:\PR-Master\drafts\` — prompts and breadcrumbs being written that are not yet in the
  queue.
- The watcher's own clone (`C:\po-watcher\ProjectOperations`) and the dev tree
  (`C:\ProjectOperations2`) stay where they are; they are NOT PR folders and do not move.

## Binding on every station (Marco, 2026-09-15)

Marco restated the convention as a rule, not a preference: *"PR-Master is the root folder for all
pr worktrees, to keep everything tidy (not cluttering my C:\ with several different folders), this
is where station 06 should be saving all its drafted prs."* Three consequences, all checkable:

- **No station, lane or chat creates a worktree at the drive root.** `C:\po-fix1891`,
  `C:\po-rcpt<n>`, `C:\po-collect-<hhmm>` and the rest of that shape are violations, whoever
  makes them - Station 00's own supervised lane made every one of them on 2026-09-14/15. The path
  is `C:\PR-Master\worktrees\<slug>`, always.
- **Station 06 stages from `C:\PR-Master\worktrees\<slug>` and drafts into
  `C:\PR-Master\drafts\`.** Its staging scripts hard-code `C:\po-worktrees\<slug>`
  (`s06-stage*.ps1`, fifteen of them) - that is the clutter this convention exists to end.
- **`status-sweep` can now see the violation.** Its escapee scan listed only the SUBDIRECTORIES of
  four container roots, so a tree at the drive root was invisible to it; PR_MASTER_BARE_TREE_SCAN_V1
  adds the bare-tree scan. A convention nothing can measure is a preference.

The watcher's agent worktrees under `C:\po-watcher\ProjectOperations\.claude\worktrees\` are
NOT in scope: they sit inside the watcher's own clone, not at the drive root, and the watcher
reclaims them itself. Ageing those out is Station 03's, not this convention's.

## Legacy roots

The pre-2026-09-11 roots — `C:\po-worktrees`, `C:\po-wt`, `C:\po-wt-h`,
`C:\po-watcher-worktrees`, `C:\po-vg`, `C:\po-fix*`, `C:\po-smoke`, `C:\po-sec-fix`,
`C:\po-sup-fix`, `C:\po-preserve`, `C:\po-work` — are NOT deleted by anyone. Never
delete; quarantine. Station 03 moves each one to
`C:\PR-Master\_retired-<yyyy-mm-dd>\<name>` once `git worktree list` no longer names it
and its dirty count is 0. A dirty one is listed, never moved.

The three pipeline instruments (status-sweep, lint-station, watcher-loop-check) know both
the new root AND the legacy roots, so a tree living in either place is still visible to
the sweep during the migration window.

## What this doc does not change

- No folder is moved by this convention. Migration of old trees is Station 03's, by hand,
  under the rule above.
- No `git worktree` state is touched. A tree registered against a legacy path stays
  registered against that path until Station 03 removes and re-adds it under the new root.
- The sweep still REPORTS escapees; it never prunes them.
