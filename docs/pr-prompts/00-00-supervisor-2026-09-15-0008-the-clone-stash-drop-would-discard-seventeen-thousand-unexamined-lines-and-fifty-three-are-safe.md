# Station 00 — Supervisor | 2026-09-15T00:08Z–00:45Z

## GROUND

```
UTC            2026-09-15T00:08:52Z
origin/main    86a6efea at 00:08Z -> 4396b12e at 00:36Z   (fetch first, then rev-parse)
dev tree       main @ 4396b12e  C:\ProjectOperations2   (tracked-clean: --numstat EMPTY, --cached EMPTY)
doc version    1
bootstrap      1
```

Transport: Desktop Commander `start_process`, shell `powershell.exe`, PID 29700 — **SIGHTED**.
Statements sent direct to the shell (no nested `powershell.exe -Command` layer — DOCTRINE §9.1), with a
literal `MARKER_*` echo after every chain so an unrun statement cannot read as an empty result.

**PREFLIGHT step 1, the device-bridge git guard: INSTALL FAILED, and this is a FINDING, not a stop.**
Quoted verbatim, the whole of what `bash scripts/pipeline/vm-git-guard.sh` returned:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/Users/.../uploads as uploads: source path ... is under Plan9 share "c"
which is not mounted; create: RPC error -1: ensure user: user focused-vibrant-lamport already exists
unexpectedly ... A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

The VM has no transport to the mount at all this run, so the class of damage the guard exists to prevent
— a cut-short VM-side `git` against the Windows `.git`, leaving a 0-byte `index.lock` — **cannot be
reached from here**. No VM-side `git` was run. See F5.

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` captured with `*>` to a file and decoded `utf16le` in node (§9.3 —
  the raw capture is **143,636 B, UTF-16LE, 418 lines**; read as UTF-8 it is structureless).
  Section 7 verdict: **`SAFE TO ACT`** — no board mutation in progress, no recent remote activity,
  no live station worktrees. Section 5 carried **zero `[STALE]` rows** (`Select-String '[STALE]'
  -SimpleMatch` over the decoded file → 0), so there was nothing for the COLLECT-clears-them rule to do.
  Section 0 instrument controls both passed.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 6 checked, 0
  malformed`, **`CLEAN`, exit 0**; `00` 0.3h · `03` 1.2h · `04` 2.1h · `05` 10.1h, all `ok`. Crossed
  against `list_scheduled_tasks` `lastRunAt`: `00` `00:08:31Z` (this run) · `03` `23:01:23Z` ·
  `04` `22:10:09Z` · `05` `2026-09-14T14:11:11Z` — every station aligned with its newest breadcrumb,
  no row in the "fresh `lastRunAt`, no breadcrumb" or "`lastRunAt` older than one cadence" columns.
  ⚠️ `--freshness` still prints `(cadence 2h)` for `00` against a live cron of `5 * * * *`; that is the
  known `const CADENCE =` defect, already filed, not re-raised.
- [MEASURED] **No station breadcrumb has been written since my last run.** 03's `2301` and 04's `2211`
  were both collected and dispositioned by the `2308` run (its F3 names "Station 03's F3", its F5 names
  "04's F5"); the `2358` breadcrumb is the interactive lane 0003 signing off.
- [MEASURED] Board, live: **1 open PR.** `#1943` read `OPEN CLEAN` in the 00:10:36Z sweep and
  **`MERGED`** when I asked `gh pr view` at 00:2xZ — §7's `[LIVE]` rule firing inside one run, twenty
  minutes apart. It carried its own receipt `docs/decisions/merge-approvals/1943.md` in its diff.
  `origin/main` 86a6efea → **4396b12e**.
- [MEASURED] **`#1923` is Marco's, and the probe is clean in both directions.** RULE 2 probe pinned to
  the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): **2226** logs,
  newest **`2026-09-15T00:05:29Z`** — younger than `#1923`'s `createdAt` `2026-09-14T08:28:53Z`, which
  is the control that separates the live directory from the 17-day-stale decoy. POSITIVE `marco.:true`
  (regex, dot matches the quote) → **666**. NEGATIVE, a freshly minted needle `zzQq00Needle20260915T0015`
  → **0**. `PR #1923` over `processed\pr-*.log` → **2**; `PR #999997` → **0**. Both hits are in one
  file, `pr-ratescol-s0-column-api-hygiene-ready.md.log`:

  ```
  L7  :: PR #1923 open and unmerged: https://github.com/GH-Mantova/ProjectOperations/pull/1923
  L17 :: [watcher] merge result for PR #1923: {"ok":false,"marco":true,
         "reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}
  ```

  That log carries the prompt's **own** PR line for the **same** number, so this is a routing and not a
  prose scrape (§10.1's `PRNUMBER_SCRAPED_FROM_PROSE_V1`). Hand-classification agrees independently:
  of its 2 files, `rate-tables.service.spec.ts` matches `NESTED_TEST_PATHS`, `rate-tables.service.ts`
  matches none — **Marco's**. Rollup **14 SUCCESS / 1 IN_PROGRESS** (`tendering-e2e`), `BEHIND`.
- [MEASURED] Trunk on `origin/main` `4396b12e1c21ba431fa1f4c56de158f911d1fe89` (full 40-char SHA, `-R`
  passed, `$LASTEXITCODE` tested): 4 runs — `CI` success, `CodeQL` success, `Tendering Browser Smoke`
  and `Deploy` still `in_progress`. Trunk-only subset after the Dependabot/schedule denylist:
  **2 success / 0 failed / 2 running**. No red.
- [MEASURED] Queue: **armed (`*-ready.md`) = 0** · `needs-marco/` **56** · `no-pr-opened/` 109 (newest
  still `2026-09-02T03:47Z`) · `failed/` 49 · `blocked/` 135.
- [MEASURED] Watcher: node **RUNNING pid 30976**, wrapper alive (1), heartbeat 6 min. Not wedged, not down.
- [MEASURED] **The watcher clone's one dirty file is a pure line-ending smudge, and both `git status`
  forms agree on it** — which is the opposite shape to the false positive DOCTRINE §9.5 records:

  | probe (clone `C:\po-watcher\ProjectOperations`) | result |
  |---|---|
  | `git status --short` | **1** — ` M docs/data-model/metadata-catalog.json` |
  | `git status --porcelain --untracked-files=no` | **1** |
  | `git diff --numstat` (vs HEAD) | **EMPTY** |
  | `git diff --numstat origin/main -- <path>` | **EMPTY** |
  | `git hash-object <path>` | `25dba2d48c09de09643e1c4852bbc0570bf127d0` |
  | `git rev-parse HEAD:<path>` | `25dba2d48c09de09643e1c4852bbc0570bf127d0` — **identical blob** |

  git says so itself: *"warning: in the working copy of 'docs/data-model/metadata-catalog.json', LF will
  be replaced by CRLF the next time Git touches it."* ⚠️ **§9.5's clone-dirty bullet is NOT refuted by
  this.** Its falsifying probe requires the two forms to be run *"while an untracked file is present"*,
  and today the clone holds none — so the precondition was never met and the bullet stands unqualified.
  What is measured here is a **third** cause of the same false warning, which that bullet does not name.
- [MEASURED] **The clone's 72 stashes, classified by `git stash show --numstat` — the instrument nobody
  has been running.** Every entry 0..71 asked individually:

  | class | count | droppable? |
  |---|---|---|
  | **EMPTY** (0 files) | **11** | yes — no content |
  | **DELETION-ONLY** (files listed, `insertions = 0`) | **42** | yes — every file still exists in HEAD |
  | **CARRIES INSERTIONS** | **19** | **NO — 17,128 inserted lines** |

  The 19, with dates: `stash@{2}` 3f **+485/-75** (09-10) · `{3}` +86 · `{4}` +135 · `{5}` +45 (09-06) ·
  `{8}` +1 · `{9}` +22 · `{10}` +1 · `{11}` +88 · `{12}` +22 · `{13}` +75 · `{14}` +51 · `{15}` +92
  (09-01) · `{31}` 37f +20/-1197 · `{32}` 37f +19/-1197 (08-27) · `{66}` **+682/-50** · `{67}` **+682/-50**
  (07-23) · `{69}` +2 · **`{70}` 149 files, +14,617/-1,186** · `{71}` +3 (07-14).
  `stash@{70}`'s first rows are whole migration SQL files added (`+29`, `+19`, `+176`, `+51`).
  🔴 **And the two newest entries are both EMPTY**, so a run that samples `stash@{0}` and `stash@{1}` —
  the obvious sample — measures 0 files and concludes the loop produces empty stashes. That reading is
  wrong for **61 of 72**. I made it myself, two probes before the one above corrected it.

## WHAT CHANGED

- **Nothing on the board.** No merge, no arm, no label, no branch update, no watcher action.
- This PR archives the six dispositioned root breadcrumbs (`00-2235`, `00-2308`, `00-2326`, `00-2358`,
  `03-2301`, `04-2211`) into `docs/pr-prompts/archive/`, and adds this one.
- No prompt armed. `armed` was 0 at the start of the run and is 0 at the end.

## FINDINGS

### F1 — `git stash drop` on the clone's 72 stashes would discard 17,128 unexamined inserted lines, and 53 of the 72 are provably safe to drop today

The standing hand-over to Station 03 reasons from the stash **count** and prescribes *"`git stash drop`,
never `pop`"*. Run over all 72 that is an irreversible action on content nobody has looked at (DOCTRINE
§5.4). Measured above: 11 are empty, 42 are deletion-only, and **19 carry insertions totalling 17,128
lines**, one of them 149 files and +14,617. The discriminator is one column — `git stash show --numstat`'s
insertion total — and it is read-only, so any run or station can take it.

**RULE 1, complete-and-additive first.** **(a)** Drop the **53 measured-safe entries by their numstat
signature** (`files = 0`, or `insertions = 0` with every listed path present in `HEAD`), re-measure, and
leave the 19 in place with this table beside them — solves it now (the pile stops being a wall) and in
future (the signature is a rule, not a one-off list), and destroys nothing. **(b)** Drop all 72 — fails
the no-damage half outright. **(c)** Leave all 72 — fails the solve-it half; the loop is unbounded and
every launch adds one.
⚠️ Dropping by **index** is unsafe: `stash@{N}` renumbers after every drop. Drop by the stash **commit
SHA**, or drop highest-index-first.
**DISPOSITION: DISPATCHED → Station 03**, folded into the existing clone-hygiene / stash-loop dispatch
rather than opened as a new one. 03 owns the clone; 00 may not write git there. The table above is the
whole input it needs.

### F2 — The clone's dirty flag is a line-ending smudge whose blob is byte-identical to HEAD, and that is what feeds the stash loop

`status` says ` M`, `--numstat` says EMPTY, and `hash-object` equals `rev-parse HEAD:` exactly
(`25dba2d4`). Station 04's `2211` breadcrumb named this shape from `--numstat`; the blob-hash equality
settles it at a level `--numstat` cannot be argued with. The consequence is the loop: the launcher's
preflight auto-stash fires on a file that differs from HEAD in nothing, on every start, forever. The cure
is one read-write call in the clone — `git add --renormalize docs/data-model/metadata-catalog.json` then
`git update-index --refresh` — which is 03's lane, not mine ("you never touch git in the watcher's repo").
**DISPOSITION: DISPATCHED → Station 03**, same dispatch as F1. Fixing F2 stops the pile growing; fixing
F1 shrinks the pile that already exists. Neither substitutes for the other.

### F3 — The sweep's "may refuse to start" warning has a third cause, and today it is the only one present

DOCTRINE §9.5 records that `status-sweep.ps1`'s clone-dirty flag over-counts because it includes
untracked files while `start-watcher.ps1` does not. Today both forms return **1** and the flag is *still*
wrong, for a reason that bullet does not carry: the tracked file is a smudge, and a tracked-dirty clone
**auto-stashes** rather than refusing. So the warning line is false again, by a new route, and the two
recorded routes to distrusting it do not cover this one.
**DISPOSITION: DEFERRED.** The honest edit is one clause added to that §9.5 bullet, and it belongs in the
same PR as F2's cure so the bullet and the board agree — which is 03's dispatch, not this collect's. The
bullet is not wrong today and its own falsifying probe did not fire (no untracked file was present), so
nothing is misleading anyone in the meantime. It becomes urgent the moment a run reads the flag and
dispatches clone hygiene on it — which archived runs have already done 13 times.

### F4 — Lane 0003 dispositioned two findings to Station 06, which has no consumer

The `2358` breadcrumb ends its F1 *"ESCALATED to 04/06"* and its F2 *"ESCALATED to 06"*. **Station 06 has
no scheduled task** — confirmed again from the MCP this run, which lists only `00`, `03`, `04`, `05` and
the disabled `weekly-security-audit`. That is a standing finding, escalated 2026-08-26T16:09Z and
re-actioned 2026-09-05T21:08Z; I am **not re-raising it**. What needs doing is re-homing the two findings:

- Its F1 (the hex-ratchet DONE rule has not been seen to work) — the action is *"measure the next two UI
  builds"*, which is **Station 04's** lane and 04 does have a schedule. No UI build has run since 08:34Z,
  so there is nothing to measure yet.
- Its F2 (a prompt touching `prisma/seed*.ts` must declare whether prod needs the rows) — **already has a
  home**: `needs-marco/prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md`. The
  09-14 pair (`#1913` brandtheme-s4, `#1920` ea-s2a) is the second and third recurrence of that
  escalation's own subject.

**DISPOSITION: ACTIONED** — its F1 re-homed to 04 (named here, which is the channel 04 reads), its F2
re-homed to the existing `needs-marco/` file. Neither now depends on a station nothing wakes.

### F5 — The workspace VM has been unreachable for a fourth consecutive station run, so the prescribed git guard cannot be installed

Quoted in full under GROUND. Already escalated as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`; the `2308` run recorded it as three
consecutive stations and this is the fourth. **Not re-raised.** Worth one line only because PREFLIGHT
requires the installer's last line be quoted pass or fail, and because the guard's absence is harmless in
exactly this configuration: with no VM transport there is no VM-side `git` to guard.
**DISPOSITION: DEFERRED** — the escalation is open and correctly filed; it becomes urgent for a *blind*
run, which loses one of its two read transports, and not for a sighted one like this.

### F6 — Every arm available tonight still lands on Marco, so I armed nothing

`armed = 0`, and the `tests-docs` lane starvation the `2308` run measured (its F7: 0 of 15 gate-satisfied
HOLDs eligible) is unchanged — no HOLD's gates opened in the last hour and no prompt merged that would
open one. Marco already holds `#1923`. Arming another Marco-bound prompt lengthens his queue without
moving the board, which is the throughput constraint this pipeline has recorded since 08-31.
**DISPOSITION: DEFERRED.** Already escalated as
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`. It becomes urgent when the board
empties: with zero open PRs the argument for not arming disappears, and the choice is then arm-for-Marco
or idle, which is a decision for him and not for a run.

## WHAT I DID NOT DO

- **Did not merge, update-branch, rebase or label `#1923`.** It carries a genuine watcher `marco:true`
  verdict whose reason names the exact out-of-lane file, the probe was controlled in both directions, and
  its last check was still running — rebasing a PR mid-check is the defect the parked
  `fix/no-rebase-while-checks-run` branch exists for. RULE 2 binds; only Marco clears it.
- **Did not touch the watcher clone's git.** F1 and F2 are both write operations there; they are 03's.
  Everything I ran against the clone was read-only (`status`, `diff`, `hash-object`, `rev-parse`,
  `stash list`, `stash show`).
- **Did not `git stash drop` anything** — that is the irreversible action F1 exists to bound.
- **Did not arm a prompt** (F6), did not edit `/sot/`, did not touch Azure / Entra / SharePoint, did not
  remove any label, did not restart the watcher (`RUNNING pid 30976`, wrapper alive, not wedged).
- **Did not re-raise** three standing escalations whose files are open and current: Station 06 having no
  schedule, `weekly-security-audit` being disabled
  (`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`,
  filed 09-14 11:15), and the VM mount.
- **Did not prune the three orphaned worktrees.** `C:/PR-Master/worktrees/po-vg` still holds 1
  uncommitted file at 15,377 min, and the unpushed-commits question is already open as
  `needs-marco/two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md`.
- **Did not use** `git checkout .`, `checkout -- <path>`, `reset --hard`, `stash pop` or `git clean` in
  any tree, at any point.
