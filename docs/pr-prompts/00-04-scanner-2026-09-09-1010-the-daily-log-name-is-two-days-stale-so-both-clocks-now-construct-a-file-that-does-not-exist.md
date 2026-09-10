# Station 04 — Scanner | 2026-09-09T10:10Z–2026-09-09T10:47Z

## GROUND

```
UTC            2026-09-09T10:10:31Z
origin/main    f482d1a5              (fetched, then rev-parse)
dev tree       main @ 2279d2d9        C:\ProjectOperations2   (1 behind, 0 ahead)
doc version    1
bootstrap      1
```

Versions agree, so this run was not read-only-by-mismatch. Sweep assigned by
`node scripts/pipeline/next-sweep.mjs`: **instrument-honesty** (rotation position 2 of 4).

Device-bridge git guard, quoted per the contract, pass:
`vm-git-guard installed at /sessions/admiring-vibrant-cray/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`.

Fresh needle minted this run: `zzQq04Sep09T1015NeedleZz` — 0 across every corpus probed, and
**spent the moment this file lands** (9.6).

## WHAT I MEASURED

The 2026-09-08T14:11Z instrument-honesty run re-measured twenty-one 9 claims and found all
twenty-one still trapped. Repeating that list twenty hours later is not coverage, so this run
took the 9 claims that pass did **not** reach. All readings below are `[MEASURED]` at
`f482d1a5`, PS 5.1.26100.9168, git 2.55.0.windows.3, gh 2.90.0, unless tagged otherwise.

| # | 9 claim | probe | reading | truth | verdict |
|---|---|---|---|---|---|
| 1 | 9.2 on a tree BEHIND `origin/main`, `git status` answers about HEAD | all 9 ` M`/` D` rows crossed against `git diff --numstat origin/main -- <path>` | `docs/data-model/metadata-catalog.json` ` M` but numstat **EMPTY**; the other 8 genuinely differ | working copy matches `origin/main` | STILL TRAPPED, live instance |
| 2 | 9.5 the RULE 2 probe has two homes and the dead one passes its control | both `processed` dirs | dev tree **2090** logs, newest `2026-09-09T00:12:05Z`, POS **625**, NEG 0 · clone **21** logs, newest **2026-08-17T14:28:09Z**, POS **10**, NEG 0 | dev tree is live | STILL TRAPPED — decoy passes POS>0 and is 23 days stale |
| 3 | 9.5 never construct the daily clone-log name from a date | both clocks vs the directory | UTC name `2026-09-09.log` **absent**; LOCAL name `2026-09-09.log` **absent**; `2026-09-08.log` **absent**; live file is **`2026-09-07.log`**, last line `[2026-09-09T10:15:11.145Z]` | live log exists | STILL TRAPPED — **and worse than documented, see F1** |
| 3b | 9.5 the prescribed cure (name-shape filter, then newest mtime) | `BaseName -match '^\d{4}-\d{2}-\d{2}$'` then sort | returns `2026-09-07.log`, 223,126 B, POS `[merge]` **23**, `opened PR #` **10**, NEG 0 | that file | CURE WORKS |
| 3c | 9.5 `supervisor.log` collision | newest 4 by mtime, no name filter | `2026-09-07.log` 10:15:11Z · **`supervisor.log`** 2026-09-08T23:44:17Z · 5 non-daily names present | — | HAZARD LIVE, margin now ~10.5h |
| 4 | 9.1 `gh run view --job --log` is 3 tab columns, col 1 = job name | CP-26 job `102288575909` on `#1823` | raw grep `CP-26` over whole line **217 of 218**; last-column **2** | 1 verdict line | STILL TRAPPED, worst ratio recorded |
| 5 | 9.4 read the CP-26 verdict TOKEN, not the pass/fail counts | same log, column 3 | `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label` | parked | STILL TRAPPED — `#1823`'s two reds are ONE cause, PARKED BY DESIGN, **not work** |
| 6 | 9.4 assign-then-foreach; piping JSON into `Where-Object` collapses it | `gh pr checks 1823` | piped form printed `System.Object[] System.Object[]`; assign-then-filter → **15** checks, **2** non-success | 15 / 2 | STILL TRAPPED — **I tripped it live, first attempt** |
| 7 | 9.5 `lint-prompt.mjs` anchors | `git show origin/main:` + `-SimpleMatch` | `DO_NOT_ARM_COMMENT =` 1 · `DO_NOT_ARM_CAPS =` 1 · `ARM_ONLY =` 1 · `LINT_GH_BIN` 2 · `function readFromOriginMain` 1 · `export function checkHumanGate` 1 · `stripCodeContext(bodyText)` 1 · NEG 0 | all present | ALL ANCHORS RESOLVE — 9.5 is accurate here |
| 8 | 9.5 `.arming-log.txt` publication gap (its own falsifying probe) | `git show origin/main:` vs working copy | **68** vs **72** lines — **GAP = 4** | 72 | **PROBE FIRES**, see F3 |
| 9 | STATION-CAPABILITIES 6 / 9.5 `CADENCE` map | `const CADENCE =` on `origin/main` | `{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }` | 00 is hourly | **STILL WRONG**, exactly as DOCTRINE warns not to assume fixed |
| 10 | 9.6 a negative control you wrote down is a positive | 6 needles over `docs/pr-prompts` depth1 + `archive/` + `needs-marco/` | `zzzNoSuchNeedleZzz` **54** · `zzzNoSuchTokenZzz` **41** · `zzQqNeedle04b20260906` **3** · `zzQq00Needle20260905T2008` **2** · `zzS04Sep08NeedleZz` **1** · mine **0** | — | STILL TRAPPED, monotonically worse, see F4 |
| 11 | 9.2 `git stash` in the clone is a closed loop | `git -C C:\po-watcher\ProjectOperations stash list` | **69** | — | unchanged since the 03 dispatch — consistent with no relaunch since 2026-09-06T23:05Z |

**Board, for context, not as my lane.** 1 open PR: `#1823` (EA-GATE report self-filter), 13 pass /
2 fail, and row 5 above settles both reds as `[LABEL_PRESENT]` — parked, only Marco releases it.
`armed: 0`. `status-sweep.ps1` 7 read **SAFE TO ACT**.

**"TRUNK IS RED" is true and misleading.** `main` at `f482d1a5` carries 8 runs: `CI`, `Deploy`,
`CodeQL` and `Tendering Browser Smoke` all **success**; the two failures are `Dependabot Updates`
and `Pipeline heartbeat` (run `34309872663`). **The build is green.**

**Station 00 is disabled — measured from the MCP, which 4C says is the only authority:**
`00-supervisor` `enabled: false`, **no `nextRunAt`**, `lastRunAt 2026-09-08T05:08:37.966Z`
(29.1h, and byte-identical to the value the 2026-09-08T22:25Z escalation recorded — it has not
run since). `03`, `04`, `05` and `weekly-security-audit` are all `enabled: true` with future
`nextRunAt`. Consequence, measured: **9 breadcrumbs sit UNTRACKED** in `docs/pr-prompts/` (00×0,
03×1, 04×6, 05×1, plus this one), each flagged `is UNTRACKED — it reaches nobody until a board PR
commits it`.

**Six consumed HOLDs are still tracked on `origin/main`** — `brandtheme-s0`, `brandtheme-s1`,
`ea-gate-report-self-filter`, `rates-consumers-s3-persona-export`, `stationcaps-blind-run-names-one-mount`,
`tfm-s11-copy-recursive-preserve`. The 2026-09-08T18:11Z run reported five. This is the
stays-armable-forever defect it already named; I re-measured the count and did not re-file it.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with the timestamp I measured:
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-09T10:40:00Z` →
  `advanced: last_index=1 last_run_utc=2026-09-09T10:40:00Z`, read back with `--status`
  (`last [1] instrument-honesty`, `-> NEXT [2] repo-hygiene`). **LEFT DIRTY in the dev tree — Station 00
  commits it, because 04 may not.**
- This breadcrumb, untracked at `docs/pr-prompts/`.
- Two scratch reads outside the repo: `C:\po-sup-fix-scripts\sweep-04-20260909T1015Z.txt` and
  `C:\po-sup-fix-scripts\live-watcher-log-copy.log` (the live log is held open by the watcher, so it
  must be copied before reading).
- **Nothing else.** No prompt staged, armed, disarmed, renamed, moved or deleted; no label touched;
  no merge; no commit; no push; no `git` run from the VM side; no `.ps1` other than `status-sweep.ps1`.

## FINDINGS

**F1 — The daily clone log's NAME is now two days behind its CONTENT, so both clocks construct a
file that does not exist, and one clause of 9.5's own correction has gone stale in the direction
that blinds a reader.**
The 2026-09-06T23:0xZ correction says the UTC-computed name gets the DEAD file and the LOCAL-computed
name gets the LIVE one. [MEASURED] today both compute `2026-09-09.log`, and **it does not exist**;
neither does `2026-09-08.log`. The live file is `2026-09-07.log` — last line
`[2026-09-09T10:15:11.145Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=107`,
written seconds before I read it; POS control `[merge]` 23, `opened PR #` 10, NEG needle 0.
**Cause, and it is the documented mechanism running longer than the example anticipated:** the name is
fixed once, at launch, from the host-local date. Watcher pid **31660** started **2026-09-06T23:05:03Z**
(= 2026-09-07 09:05 Brisbane) and has not relaunched in **2d 11h**, so the name has been frozen across
two date rollovers. The failure has therefore escalated from *"picks the dead file or an empty one"* to
*"picks a filename with nothing behind it"*, which is 9.6's shape — `Test-Path` false, no error, no
warning — and a reader following the correction's LOCAL-clock clause gets ENOENT and may conclude the
watcher has written nothing for two days while it is writing every few minutes.
🔧 The headline rule and the cure are both **untouched and correct**: never construct the name, filter to
the daily name shape, take the newest by mtime — which returned the right file on the first try. What
wants one clause is the worked example: *"the two clocks do not reliably disagree; after a launch older
than a day BOTH construct a name that does not exist, so an absent file is the expected reading and is
not evidence about the watcher."* Same shape as the 2026-08-31 `ls-tree` repair — the rule was never
wrong, its illustration was.
**DISPATCHED** — Station 00, as a 9.5 doc edit. `instruments v2` is DOCTRINE-only, so this costs one
document and one canonical-hash re-record, not seven.

**F2 — The CI heartbeat measures what reached `main` and reports it as what RAN, so with 00 disabled it
is guaranteed to fire and guaranteed to name the wrong cause.**
[MEASURED] run `34309872663`, job `102334144482`, column 3:
`[heartbeat] SILENT: NO station has reported for 21.2h (threshold 6h). Newest is station 00 at
2026-09-08T07:00:00Z. Either the scheduler is off, the machine is down, or the app is not running.`
**All three named causes are false.** `03`, `04` and `05` are enabled, ran, and reported —
`node scripts/pipeline/check-breadcrumb.mjs --freshness`, over the same corpus on disk, reads
`03 ok · 04 ok · 05 ok` and only `00 SILENT`. Two instruments, one corpus, opposite answers. The
discriminator is read from source: `pipeline-heartbeat.yml` uses `actions/checkout` and its own comment
says *"the check reads filenames in docs/pr-prompts on the checked-out"* tree — i.e. **tracked files
only**. Station 00 is the only actor that commits breadcrumbs, so while it is disabled every other
station's report is untracked and structurally invisible to the alarm. The alarm cannot distinguish
*no station ran* from *no station's report was collected*, and it prints the first.
This is the finding 04's 2026-09-08T22:10Z breadcrumb already named, and it is filed at
`needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`. Re-verifying its central claim
per 7.1: **still true, and unanswered** — `lastRunAt` is byte-identical 12h later, so 00 has not run
once in the interval. Enabling a scheduled task lives in the scheduled-tasks layer, not this repo, and
is Marco's.
**ESCALATED** — already on file; this run confirms it rather than re-filing it. The question for Marco
is unchanged and narrow: **was disabling `00-supervisor` deliberate?** If yes, the complete-and-additive
fix is to commit `docs/pipeline/pause.json` with an `until`, which the workflow already honours — that
silences a false alarm without removing a real one and damages no data. If no, re-enabling it is the
whole fix, and the 9 stranded breadcrumbs collect on the next run. A third option — pointing the
heartbeat at untracked files — fails the *complete* half: it would keep reporting green while the
collect stays broken, which is the failure it exists to catch.

**F3 — 9.5's arming-log publication gap fired again and has grown: 4 arms are on disk and on no
branch.** [MEASURED] `git show origin/main:docs/pr-prompts/.arming-log.txt` **68** lines against a **72**-line
working copy (tracked control: `git ls-files --error-unmatch` exit 0). Working copy ends
`2026-09-08T23:43:55Z ARMED pr-ea-gate-report-self-filter escalates=true actor=station-00.cloud-lane-2345`;
`origin/main` ends `2026-09-08T07:11:06Z ARMED pr-brandtheme-s1-apply-the-saved-scheme`. Yesterday's run
measured this gap at **3**; the defect 9.5 names is that *nothing commits the log on purpose*, so it
closes and re-opens by luck, and a clone reads a stale arm history rather than none. Until the counts
agree, an arm age taken from `origin/main` is a **lower bound**, never the answer.
**DISPATCHED** — Station 00: commit `.arming-log.txt` in the next board PR. It is already dirty in the
dev tree alongside the rotation file.

**F4 — Needle contamination is strictly worse, and the two needles minted as cures are themselves
burned.** [MEASURED] over `docs/pr-prompts` depth 1 + `archive/` + `needs-marco/`: `zzzNoSuchNeedleZzz`
**54** (was 40 on 2026-09-05), `zzzNoSuchTokenZzz` **41** (was 36), `zzQqNeedle04b20260906` **3**,
`zzQq00Needle20260905T2008` **2**, `zzS04Sep08NeedleZz` **1**. Every one of those was written down as a
negative control and is now a positive. The rule holds exactly as stated and needs no repair; the
counts are state and must be re-measured, never quoted.
**ACTIONED** — minted `zzQq04Sep09T1015NeedleZz`, verified 0 across every corpus probed this run, and
used it as the negative control on all eleven rows above. It is spent by this file, as the rule predicts.

## WHAT I DID NOT DO

- **Did not re-run the twenty-one traps** the 2026-09-08T14:11Z run measured. They were verified 20h
  ago and re-verifying them would have crowded out the eleven claims nobody had reached.
- **Did not commit anything**, including the rotation file and the arming log I am asking 00 to commit.
  04 is read-only on the board and the dev tree is on `main`.
- **Did not fast-forward the dev tree** although it is 1 behind. Every reading above was taken against
  `origin/main` explicitly (`git show` / `rev-parse` / `--numstat`), so being behind changed no answer,
  and an FF is a shared-tree mutation with 9 untracked breadcrumbs and 24 dirty paths in it.
- **Did not touch `#1823`.** Its two reds are one `[LABEL_PRESENT]` cause; only Marco removes the label.
- **Did not re-file the six tracked consumed HOLDs or the 00-disabled escalation** as new findings —
  both are already on file; I re-measured them and said so.
- **Did not run `git` from the VM side, did not prune `C:\po-vg`** (orphaned worktree, 7339 min, holds 1
  uncommitted file — 03's, and it is already escalated), **did not clear the 69-deep clone stash**, and
  did not touch `/sot/`, Azure, Entra or SharePoint.
- **Did not stage a prompt.** Nothing this run found is fixable by a prompt I am allowed to write: F1 is
  a DOCTRINE edit that belongs to 00's lane, F2 is Marco's, F3 is a commit 00 must make.
