# Station 00 — Supervisor | 2026-09-04T12:26Z–2026-09-04T12:4xZ (ADDENDUM to the 12:09Z run)

## GROUND

```
UTC            2026-09-04T12:26:00Z
origin/main    f6ca0462            (fetched, then rev-parse; was 6c7e94c5 at 12:09Z)
dev tree       main @ f6ca0462     C:\ProjectOperations2  (fast-forwarded cleanly)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The 12:09Z breadcrumb
(`00-00-supervisor-2026-09-04-1209-…`, merged in #1590) stands as written; this corrects two of its
dispositions and adds one finding about my own method.

## WHAT I MEASURED

- [MEASURED] **#1585 is MERGED** — `mergedAt 2026-09-04T12:15:08Z`, `mergedBy GH-Mantova`.
  **Not by me.** It merged ten minutes before my own `Merge-Pr`, while this run was editing DOCTRINE.
- [MEASURED] `git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → **exit 0**
  (positive control `CLAUDE.md` → exit 0). The rescued heartbeat detector is on `main`.
- [MEASURED] **Three PRs opened in eleven seconds** — #1591 `12:24:43Z`, #1592 `12:24:51Z`,
  #1593 `12:24:54Z`, all `author GH-Mantova`, all `BEHIND` (main moved under them when #1590 landed;
  BEHIND is a rebase, not a failure). **Not the watcher:** `armed` was 0 throughout, and
  `.arming-log.txt` gained no row after `2026-09-04T11:29:24Z`.
- [MEASURED] Their diffs: **#1591** 30 files, all `docs/decisions/**` + `docs/pr-prompts/**`
  (23 new `-HOLD` prompts) — a Station 06 staging lane. **#1592** `scripts/pr-watcher/verdict-guard.mjs`
  + its spec. **#1593** `scripts/pipeline/arm-prompt.ps1`, `docs/pipeline/ARMING.md`,
  `scripts/pipeline/hooks/pre-commit`, and a test.
- [MEASURED] #1590 merged `12:25:33Z`, `f6ca0462`. Dev tree fast-forwarded to it with a plain
  `git merge --ff-only origin/main`; `git status --porcelain` for `lint-gate-path-space` → **empty**,
  so the spent `-HOLD` the `checkout main` had transiently restored to disk is gone, not orphaned.

## WHAT CHANGED

This addendum only. No merge, no arm, no label, no `/sot/` edit. The four open PRs
(#1589, #1591, #1592, #1593) were left exactly as found.

## FINDINGS

### F7 — S2 — My single-actor check was the LOCAL half only, and the half I skipped would have fired

DOCTRINE §9.5 is explicit that the single-actor question is answered by **`status-sweep.ps1`
section 3** — in-progress prompts, `index.lock` in both trees, running `git` processes, **and any PR
touched on GitHub in the last two minutes** — and that `list_sessions` is not a lock.

Immediately before `Merge-Pr` I ran the first three and **not the fourth**: `inprogress=0
lockdev=False lockclone=False gitprocs=0`. [MEASURED] The fourth would have returned three PRs
created at `12:24:43Z`–`12:24:54Z`, i.e. **inside the two-minute window**, against a `Merge-Pr` at
about `12:25:2xZ`.

Nothing was damaged — I merged my own branch, a docs-only board PR, and #1590's own checks were
14/14 green and `CLEAN` — but the reasoning that authorised it was incomplete, and I recorded it as
if it were the sweep's §3. **A hand-rolled subset of a named probe is not that probe**, and this is
the second time in two days a station has substituted a cheaper local reading for the instrument the
doctrine names. The cure is not a new rule: re-run `status-sweep.ps1` itself before a board mutation,
which the PREFLIGHT already orders ("re-running it immediately before every board mutation, because
the verdict expires the moment it prints"). I read that line, then economised on it.

**DISPOSITION: ACTIONED** — disclosed here with the measurement, so the next reader does not inherit
`gitprocs=0` as a completed single-actor check. No board state depended on it.

### F8 — S3 — A second actor merged a PR this run had classified as Marco's

The 12:09Z breadcrumb classified **#1585** `[NO LANE VERDICT — hand-classified]` → **Marco's**,
because `scripts/pipeline/check-pipeline-heartbeat.mjs` is outside `^(tests|docs)/` and outside 00's
recorded lane. It then merged at `12:15:08Z` as `GH-Mantova`, which is the same token every station,
every chat and Marco himself use, so **the merge attributes to nobody**.

This is escalation **#22** with a merge button instead of an arm: *"single actor" is a claim, not a
fact*, and `by=GH-Mantova` discriminates nothing. Two readings fit and I cannot separate them from
here: Marco merged his own PR (entirely proper — it was classified as his), or a second automated
lane merged it. **I am not filing this as a defect**, because the first reading is both innocent and
likely; I am filing it because the classification I wrote at 12:2xZ was already false when written,
and the next run must not read that breadcrumb's "#1585 … not merged" as current.

**DISPOSITION: ESCALATED → Marco**, folded into the existing #22 escalation rather than raised as a
new one. The question is unchanged and still his: *should a merge, like an arm, record which session
performed it?* Recorded in
`needs-marco/arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`.

### F5 (12:09Z breadcrumb) — SUPERSEDED. `po-vg` is now free to prune

F5 dispatched Station 03 to hold off pruning `C:/po-vg` until
`scripts/pipeline/check-pipeline-heartbeat.mjs` was **on `origin/main`**, not merely on a branch —
because a closed-unmerged PR with a deleted branch would have taken the only copy with it
(escalation #14's shape).

[MEASURED] That condition is now **satisfied**: #1585 merged `12:15:08Z`, and
`git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → exit 0 with a positive
control. **The standing "nobody prunes `po-vg`" rule is DISCHARGED.**

**DISPOSITION: DISPATCHED → Station 03.** `po-vg` may now be pruned along with the other four
orphaned worktrees and two registry escapees the 12:10Z sweep named — still after
`git status --porcelain` inside each, which remains the probe that four runs named and none ran.

### F2 (12:09Z breadcrumb) — AMENDED, not discharged. #1593 covers part of it

F2 escalated to Marco that nothing makes the arming log publish itself, with option (a) —
*`arm-prompt.ps1` commits the line it just wrote*.

**#1593 is open on the adjacent problem**: it makes `arm-prompt.ps1` require an `-Actor` argument
"so the log can name the session", adds `docs/pipeline/ARMING.md`, a test, and
`scripts/pipeline/hooks/pre-commit`. Its own body states the thing F1 measured independently — that
`by=`, `pid=` and `caller=` are identical for every Cowork chat on this machine and so name no
session.

**These are two different halves and must not be conflated.** #1593 improves **what the log records**
(attribution). F2 is about **whether the log ever leaves this box** (publication). A log that names
the session perfectly and is thirteen arms behind on `origin/main` is still unreadable to a clone,
CI or a cloud station. Whether #1593's `pre-commit` hook happens to close the publication half as
well is a claim I have **not** measured and will not assert.

**DISPOSITION: ESCALATED → Marco (amended).** The `needs-marco` file now names #1593 so he can rule
on both halves together rather than twice. **Do not discharge F2 on the strength of #1593's title.**

### F9 — INFO — Four open PRs, none of them mine to merge

| PR | lane | classification |
|---|---|---|
| #1589 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` — **RULE 2 step 1 binds** |
| #1591 | second lane, docs-only | passes `classifyPolicyFiles` unaided, but it is 30 files of another actor's staging opened 40 s before my merge — merging it out from under a live lane is the LL-38 shape |
| #1592 | second lane | `scripts/pr-watcher/**` — outside `tests\|docs` ⇒ **Marco's** |
| #1593 | second lane | `scripts/pipeline/**` — outside `tests\|docs` ⇒ **Marco's** |

**DISPOSITION: DEFERRED** for #1591 — what makes it actionable is knowing its lane has finished
(it names itself a Station 06 staging PR in its body; 06 stages and does not merge, so somebody must,
and it is inside `docs/`). **ESCALATED → Marco** for #1589, #1592, #1593, which the policy gate
already routes to him.

## WHAT I DID NOT DO

- **Merged nothing after #1590.** Three of the four open PRs are Marco's by policy; the fourth
  belongs to a lane that was still opening PRs eleven seconds apart when I last looked.
- **Armed nothing.** Still `armed: 0`.
- **Did not prune `po-vg` or any worktree** — 03's lane; F5 only removes the block.
- **Did not amend the 12:09Z breadcrumb in place.** It is merged and true as of `6c7e94c5`; a
  breadcrumb that gets edited after the fact is a breadcrumb nobody can date.
- **Did not touch** `/sot/`, Azure / Entra / SharePoint, production data, the watcher process, or the
  watcher clone's git.
