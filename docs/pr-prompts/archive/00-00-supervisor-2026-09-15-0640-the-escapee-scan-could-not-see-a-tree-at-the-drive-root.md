# Station 00 — Supervisor | 2026-09-15T05:40Z–06:45Z (supervised interactive lane 0003)

## GROUND

```
UTC            2026-09-15T06:21:39Z (#1959 merged) / 06:45Z (this breadcrumb)
origin/main    c1094ced at 05:40Z -> 49586724 at 06:21Z             (fetch first, then rev-parse)
dev tree       main @ 49586724  C:\ProjectOperations2                (tracked dirty: none)
doc version    1
bootstrap      n/a — interactive Cowork lane, not a scheduled task (actor station-00.interactive-0003)
```

Transport: Desktop Commander `start_process` (PowerShell 5.1) — sighted. Marco asked whether the watcher,
agents and stations monitor `C:\PR-Master` for PR creation, then ruled on the root. This run answers the
question, lands the ruling, and repairs the instrument that could not enforce it.

## WHAT I MEASURED

- [MEASURED] **Nothing monitors `C:\PR-Master`, and nothing should.** PR creation/opening is discovered
  through the GitHub API: `pollForNewPrs()` → `runGh(["pr","list",…])` every 90 s, plus `pollForBehindPrs()`.
  The only filesystem watch in the watcher is `fsWatch(PROMPT_DIR)` (index.mjs:3545) with a 5-minute
  `rescan()` fallback, and PROMPT_DIR is the prompt QUEUE, not a PR folder.
- [MEASURED] Live watcher node pid 13840 runs with `PR_WATCHER_REPO_ROOT=C:\po-watcher\ProjectOperations`
  and `PR_WATCHER_PROMPT_DIR=C:\ProjectOperations2\docs\pr-prompts` (watcher-launcher-singlelane.ps1:22-23).
  Grep for `PR-Master|PR_MASTER` across `scripts/pr-watcher/**`, both launchers, `ensure-watcher.ps1` and the
  five `C:\Users\Marco\Claude\Scheduled\*\SKILL.md` bootstraps: **0 hits**. Two instruments know the root and
  only for hygiene — `status-sweep.ps1:251` (escapee scan) and `lint-station.mjs:37` (allowed paths).
- [MEASURED] The convention was not being followed, by this lane above all. Under `C:\PR-Master\worktrees`:
  only `po-vg` (09-04) and `pr1823` (09-09). Every worktree lane 0003 created on 09-14/15 went to the drive
  root — `C:\po-fix*`, `C:\po-rcpt<n>`, `C:\po-collect-<hhmm>`, `C:\po-hexfix<n>`. They are torn down per
  run, but `C:\po-fix1891` (3713 files, clean, HEAD `1dc31858`) was still registered AND on disk 28 h later.
- [MEASURED] **The escapee scan could not have caught it.** `status-sweep.ps1` listed the SUBDIRECTORIES of
  four container roots; a tree at `C:\<name>` is inside no container. A/B control, 2026-09-15T06:35Z: built
  an unregistered fake tree at `C:\po-ctrl-scan` (a `.git` FILE, no git state) — OLD sweep printed
  `worktree-registry-escapees: none found under known roots`; NEW sweep printed
  `REGISTRY-ESCAPEE: C:\po-ctrl-scan` and `1 found`. Same box, same minute, one line of difference.
- [MEASURED] The bulk of worktrees on this machine are NOT at the drive root: 145 agent trees under
  `C:\po-watcher\ProjectOperations\.claude\worktrees\` (08-12 → 09-15), which the watcher reclaims itself
  (`[worktree] reclaimed orphan worktree …` seen live 09-15T01:21Z). They are inside the watcher's clone, so
  they never clutter `C:\` and are out of scope for this convention.
- [MEASURED] `C:\po-worktrees` is now EMPTY, yet fifteen Station 06 staging scripts still hard-code
  `C:\po-worktrees\<slug>` (`s06-stage2..15.ps1`). [stated by Marco 06:38Z] he has told Station 06 to move
  its drafts to `C:\PR-Master\drafts\` and its worktrees to `C:\PR-Master\worktrees\<slug>`.

## WHAT CHANGED

- `status-sweep.ps1` — `PR_MASTER_BARE_TREE_SCAN_V1`: container roots gain `C:\po-wt-h`; a new bare-tree scan
  finds drive-root worktrees by the one test that separates a worktree from a clone and from an ordinary
  folder (`.git` is a FILE, not a directory), so `Windows\` and `Program Files\` can never be mistaken for
  trees; `C:\PR-Master\_retired-*` is excluded so quarantine — the correct end state — never reports as a
  defect. The nested root/subdir loop collapses to one loop over the assembled candidates. PS 5.1 parser: 0 errors.
- `docs/pipeline/PR-MASTER.md` — new section "Binding on every station (Marco, 2026-09-15)" quoting the
  ruling, naming this lane's own violations, and scoping the watcher's `.claude/worktrees` OUT.
- `docs/pipeline/stations/06-pr-master.md` — Phase 6 step 1 now names both paths where 06 reads them.
- `C:\po-fix1891` quarantined to `C:\PR-Master\_retired-2026-09-15\po-fix1891` (moved, never deleted — 3713
  files before and after), then `git worktree prune`. Registered worktrees are now the dev tree plus the two
  legitimately under `C:\PR-Master\worktrees`. No `po-*` worktree remains at `C:\`.
- This lane's own reusable scripts retargeted to `C:\PR-Master\worktrees\<slug>` (`sup-0003-receipt.ps1`,
  `sup-0003-hexfix.ps1`, `sup-0003-lint-branch-prompt.ps1`, the board-PR builder). Proven in use: this PR's
  own worktree is `C:\PR-Master\worktrees\collect-0640`.

## FINDINGS

### F1 — A convention no instrument can measure is a preference, not a rule
PR-MASTER.md has stood since 2026-09-11 and was violated by the supervisor itself for four days without one
report. The gap was not neglect: the check was structurally incapable of seeing the violation.
DISPOSITION: **ACTIONED** — scan fixed with an A/B control, ruling made binding, offender quarantined.

### F2 — Station 06's staging scripts still write to `C:\po-worktrees\<slug>`
Fifteen scripts. The directory is empty today only because the trees were torn down.
DISPOSITION: **ESCALATED** to 06 — Marco has already instructed it; the station doc now carries the rule.
Next sweep after 06's next staging run is the check.

### F3 — 145 agent worktrees inside the watcher clone, oldest 2026-08-12
Not drive-root clutter and not this convention's business, but nothing ages them out either.
DISPOSITION: **ESCALATED** to 03 — decide a retention window; do not let it ride on this PR.

## WHAT I DID NOT DO

- Did not rewrite the ~80 spent one-off scripts under `C:\po-sup-fix-scripts` that name legacy paths; their
  worktrees are long gone. Only the reusable four were retargeted.
- Did not touch the watcher's `.claude/worktrees`, `/sot/`, the desktop scheduled-task store, or any label.
- Did not move `po-vg` or `pr1823`: both are registered, live, and already under the correct root.
