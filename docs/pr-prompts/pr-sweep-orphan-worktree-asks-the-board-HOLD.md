---
premise: '! grep -q "WORKTREE_ORPHAN_ASKS_THE_BOARD_V1" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  status-sweep.ps1 classifies a non-main worktree by DIRECTORY MTIME alone - the only test is
  `$isLive = ($ageMinutes -ge 0 -and $ageMinutes -lt 30)` - and prints
  "orphaned worktree (aborted run leftover -- investigate/prune)" for anything older. Nothing asks
  whether that worktree's branch carries an OPEN PR. MEASURED 2026-09-25T01:2xZ by Station 00 at
  1e5f3f11: C:/po-wt/s8i-fixforward was tagged orphaned/prune at age 101 min while checked out on
  `fix/s8i-travel-index-reset-and-tip-dailykm`, which is the head branch of OPEN PR #2184.
scope:
  - scripts/pipeline/status-sweep.ps1
  - docs/pr-prompts/superseded/pr-sweep-orphan-worktree-asks-the-board-HOLD.md
done_when: >-
  grep -q "WORKTREE_ORPHAN_ASKS_THE_BOARD_V1" scripts/pipeline/status-sweep.ps1 &&
  ! test -f docs/pr-prompts/pr-sweep-orphan-worktree-asks-the-board-HOLD.md
size: 2
gate_allow: none
seed_only: false
escalates: true
module: pipeline
---

# status-sweep: a worktree whose branch has an OPEN PR is not an orphan

Staged by Station 00 on 2026-09-25 while discharging Station 03's **F6** (breadcrumb
`00-03-machine-minder-2026-09-24-2320-...`), which dispatched the prune DECISION to 00. The decision
is *do not prune*, and the reason is a defect in the instrument that asked for it.

## What is wrong

The classifier is at the comment block beginning
`# worktree-liveness: classify each non-main worktree as LIVE or orphaned` in
`scripts/pipeline/status-sweep.ps1`. Its rule, corrected on 2026-09-05, is deliberate and is
**right about what it measures**: recency decides liveness, dirtiness only warns before a prune.

What it never asks is whether anything still NEEDS the worktree. A watcher build finishes, the
directory stops being written to, and thirty minutes later its tree is reported as an
`aborted run leftover -- investigate/prune` - while the PR it built is open, green-or-red, and
waiting on Marco's label. **On this board that is the normal state of every PR**, because
`do-not-merge` holds them for hours or days, so the false label is the common case rather than
the edge case.

[MEASURED] 2026-09-25T01:2xZ at `1e5f3f11`, all six non-main worktrees crossed against the board
with `gh pr list --head <branch> --state all` (POSITIVE control - four branches resolved to real
PR numbers; NEGATIVE control - a branch with no PR returned `NO PR`):

| worktree | branch | sweep label | truth |
|---|---|---|---|
| `C:/po-wt/s8i-fixforward` | `fix/s8i-travel-index-reset-and-tip-dailykm` | orphaned / **prune** | **#2184 OPEN** - pruning it removes a live PR's tree |
| `C:/po-worktrees/sup-cwd-paths` | `fix/pipeline-scripts-resolve-state-paths-from-module` | orphaned + HOLDS UNCOMMITTED WORK | #2154 MERGED; the 2 files are a CRLF smudge on a generated file and a scratch `pr-body.md` - nothing to preserve |
| `C:/po-wt/stage-formrule-web` | `docs/stage-formrule-legacy-payload-retire` | orphaned / prune | #2176 MERGED - genuinely prunable |
| `C:/po-wt/fv2drop` | `wt-fv2-formrule-contract-drop` | orphaned / prune | NO PR - a build tree, prunable |
| `C:/po-wt/s8h` | `wt-s8h` | orphaned / prune | NO PR - a build tree, prunable |
| `C:/po-wt/sec-a1` | `wt-sec-a1` | orphaned / prune | NO PR - a build tree, prunable |

So the label is wrong on **one of six**, and the one it is wrong about is the only one where acting
on it destroys something. It is also wrong in the expensive direction on the dirty row: it demands
a human preserve "uncommitted work" that is a line-ending smudge.

## The change

**Keep the recency classifier exactly as it is.** Add one question after it, before the
`investigate/prune` line is printed.

1. For each worktree the recency rule classifies as orphaned, resolve its branch from the
   `git worktree list` line (the `[<branch>]` field already parsed nearby).
2. Ask the board once per branch:
   `gh pr list -R <owner>/<repo> --head <branch> --state open --json number`. Pass `-R` and test
   `$LASTEXITCODE` before parsing - a `gh` call from a non-repo CWD answers empty for every question
   at exit 1 (DOCTRINE section 9.4), and this script is run by stations whose shell opens outside the
   repo.
3. If an open PR exists, replace the prune wording for that row with
   `RETAINED - branch has OPEN PR #<n>; do NOT prune` and do **not** add it to `$liveWorktrees`
   (it is not a live station worktree, and must not start gating section 7's safe-to-act verdict).
4. If none exists, print today's wording unchanged.

Tag the new branch `WORKTREE_ORPHAN_ASKS_THE_BOARD_V1` in a comment so the premise and `done_when`
can see it.

**Also fix the dirty-row wording**, in the same edit: before telling a reader to preserve
uncommitted work, ask `git -C <path> diff --numstat origin/main -- <each dirty path>`. EMPTY means
the working copy matches `origin/main` and there is nothing local to lose - say so, rather than
`HOLDS UNCOMMITTED WORK`. That is the probe DOCTRINE section 9.2 already names as the real
uncommitted-work test, and section 9.3 names for a length/EOL disagreement.

## Cost, stated plainly

This adds one `gh` call per orphaned worktree to a script every station runs. Cache by branch so a
repeated branch costs nothing, and keep the call out of the loop's hot path if the count is large.
If `gh` is unreachable, print `[CANNOT MEASURE] board not reachable; prune advice withheld` for
those rows - never fall back to the prune wording, because the whole point is that the prune wording
is the dangerous default.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Work in your own disposable worktree off `origin/main`. `pnpm build` and `pnpm lint` must pass
before the PR. Retire this prompt in the same PR by `git mv`-ing it to
`docs/pr-prompts/superseded/` - its own path is in `scope` for exactly that reason, and the
`done_when` above checks it is gone.

This is a PowerShell file, so two shell rules from DOCTRINE section 9.1 bind the code you are
editing: **no single-letter variable names**, and **no automatic-variable names** (`$home`, `$host`,
`$input`, `$pwd`, `$args`, `$matches`) as a loop or assignment target - binding one throws to the
error stream once and the loop body never runs, at exit 0.

Control the new branch against a worktree you know carries an open PR's head branch and one you know
carries none. A lookup that returned nothing and a lookup that never ran are byte-identical in
output.

`escalates: true` because it edits a shared pipeline instrument: the PR opens, is labelled
`do-not-merge`, and Marco releases it.
