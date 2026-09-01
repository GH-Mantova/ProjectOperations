# Station 03 — Machine Minder | 2026-08-31T23:02Z–2026-08-31T23:12Z

## GROUND

```
UTC            2026-08-31T23:02:20Z
origin/main    5b7e9a63            (git fetch origin, then rev-parse)
dev tree       main @ 5b7e9a63     C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                   (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md)
```

Doc version and bootstrap AGREE. Not a read-only run.

**Reachability: SIGHTED, not blind.** `start_process` shell `powershell.exe` returned an
interactive PS 5.1 on the host (pid 2812) at 23:02:03Z; `HOST= USER=Marco NOW=2026-09-01
09:02:08+10:00 REPO=True`. This station appeared in the scheduled-task listing AND had Desktop
Commander — the listing predicted nothing, exactly as `STATION-CAPABILITIES.md` §2 records.
Bootstrap v1 still carries the REFUTED rule *"if this station appears in the scheduled-task
listing, it is cloud-fired and structurally cannot reach the box"*; this run is a live
counter-example. Folded into F4.

## WHAT I MEASURED

**Watcher chain — HEALTHY.** [MEASURED] `Get-CimInstance Win32_Process`, full command lines:

```
13464  ppid 14140  2026-08-31T09:35:31Z  powershell -File C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher.ps1
32496  ppid 13464  2026-08-31T09:35:32Z  powershell -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
32916  ppid 32496  2026-08-31T09:35:33Z  node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

Three-deep chain intact, uptime **13h27m**. Resolved by PID and command line, never by image name
(DOCTRINE §9.5) — 24 `node.exe` were running and exactly one is the watcher.

**Auto-restart wrapper — TICKING.** [MEASURED] `C:\po-watcher\ensure-watcher.log` tail: twelve
consecutive `watcher alive, pid(s) 32916` at 10-minute intervals, 21:15:03Z → 23:05:02Z, no gap.

**The watcher is MID-RUN, and productive.** [MEASURED] `watcher-launch.log` tail: #1461 built,
reviewed (`rev-1461-ready.md`), verdict mirrored, archived; `pr-crm-s11-archive-reason-delete-empty-ready.md`
started 22:58:57Z with `all dependencies met`; PRs #1457 and #1443 auto-updated off BEHIND at
23:01:42Z/23:01:45Z. Heartbeat age 1 min is therefore *mid-run tick*, not idle-stale (DOCTRINE §9.5).

**Armed queue — 1, top level only.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File`
(no recursion): `pr-crm-s11-archive-reason-delete-empty-ready.md`. Its file mtime is
`2026-08-27T08:05:45Z`; the arming log records `2026-08-31T22:58:55Z ARMED
pr-crm-s11-archive-reason-delete-empty escalates=true by=Marco@`. **Arm age is 4 minutes, not 4.6
days** — DOCTRINE §9.5's mtime trap, avoided by reading `.arming-log.txt`. `escalates=true` on an
armed prompt gating the MERGE and not the RUN is DOCTRINE §5b working as designed; not a defect.

**Locks — ALL CLEAN.** [MEASURED] `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`,
`rebase-merge`, `rebase-apply` absent in both `C:\ProjectOperations2\.git` and
`C:\po-watcher\ProjectOperations\.git`. Zero git processes at sweep time. No size/age adjudication
needed because nothing was present.

**Sentinel — by design.** [MEASURED] `Get-ChildItem -Filter STOP-WATCHER*` across the dev tree, the
clone and `C:\po-watcher` returns exactly one hit: `C:\po-watcher\STOP-WATCHER-LANE2`. Present by
design since 2026-08-15 (DOCTRINE §9.5). The real sentinel `STOP-WATCHER` is ABSENT. Not drift.

**Guard hook present.** [MEASURED] via sweep §2: `.claude/hooks/guard.mjs` present.

**Disk — ample.** [MEASURED] `Get-PSDrive C`: free **199.4 GB**, used 752.9 GB.

**A live worktree appeared DURING this run.** [MEASURED] At 23:04Z `git worktree list` returned the
dev tree alone. At 23:05Z `git worktree list --porcelain` returned a second entry,
`C:/po-worktrees/lane-doctrine` on `refs/heads/docs/doctrine-s10-second-lanes`, with its admin
`index` and `COMMIT_EDITMSG` written at 23:05:13Z. Another chat committed inside my measurement
window. This is DOCTRINE §7's `[LIVE]` rule reproduced first-hand: the earlier reading was correct
when printed and false ninety seconds later. It is **live — do not prune**, and it is *not* one of
the nine escapees in F3, which predate it by days.

**Board busy — I mutated nothing.** [MEASURED] Sweep §7 verdict: `CAUTION: no local lock, but a PR
was touched on GitHub in the last 2 min`. Dev tree carries 16 dirty files and **0 staged**
(`git diff --cached --name-status` empty) — the shared-index trap (DOCTRINE §9.2) was checked and is
clear, but Station 03 is report-only and committed nothing regardless.

**The 401 quarantine wave is STALE, not current.** [MEASURED] Newest entries in `failed/` are
2026-08-29 07:03 (`pr-crm-s3-account-on-client-create`, `rev-1386`), all
`API Error: 401 OAuth access token has expired`. Nothing since. Every watcher run in the last 13.5
hours completed. The auth expiry that produced them is not recurring. [INFERRED] The 41 files in
`failed/` are therefore a discharge backlog, not an active fault.

## WHAT CHANGED

**Nothing.** Station 03 is report-only. No file outside this breadcrumb was written, no worktree
pruned, no stash dropped, no process started or killed, no board object touched. I did not run
`restart-watcher-if-wedged.ps1` — the watcher is mid-run on an armed prompt and the sanctioned
liveness script can restart it.

## FINDINGS

### F1 — The watcher clone is 11 commits behind `origin/main`. No behaviour drift *today*; a restart would adopt stale code.

[MEASURED] `C:\po-watcher\ProjectOperations`: `branch=main head=3985d74f origin/main=5b7e9a63
behind=11 ahead=0 dirty=0`. `3985d74f` is `#1447`, committed 2026-08-31T10:53:50Z — so the clone
last fast-forwarded **12 hours ago**, while the watcher (started 09:35:33Z) has since built #1450,
#1451, #1461 and others by cutting worktrees at fresh `origin/main`. Building is not the problem.

[MEASURED] The load-bearing question is whether any missing commit touches watcher code:
`git log --oneline 3985d74f..5b7e9a63 -- scripts/pr-watcher scripts/pipeline` → **exactly one**,
`6d19e841 (#1460)`, and `git show --stat 6d19e841` → `scripts/pipeline/status-sweep.ps1 | 80 ++--`,
**1 file changed**. Nothing under `scripts/pr-watcher/**` landed in the window. The running
`index.mjs` is therefore behaviourally current.

[INFERRED] The exposure is conditional, and it is the one DOCTRINE §9.5 names: *"a restart adopts
nothing — the watcher runs `index.mjs` from the clone, so the clone must be fast-forwarded before a
restart changes any behaviour."* The inverse is the live risk here: the next restart, for whatever
reason, will drop the watcher back onto **`#1447`-era code** unless the clone is fast-forwarded
first. That is a footgun armed and waiting, not a fault firing.

[MEASURED] The sweep cannot warn anyone about this: §2 prints `watcher clone: branch=main dirty=0`
and **no behind-count**. A reader who trusts the sweep sees a clean clone.

**DISPATCHED → Station 00.** Two items, both small: (a) fast-forward
`C:\po-watcher\ProjectOperations` to `origin/main` at the next idle window — stop the WRAPPER first,
then the node, then relaunch detached, per the station brief's FIX LANE section; (b) add a
`behind origin/main: N` line to `status-sweep.ps1` §2 beside the existing `dirty=` so the drift is
visible without a manual `rev-list`. RULE 1: (b) is the complete-and-additive half — it makes every
future run see the drift; (a) alone fixes today and re-accrues by tomorrow.

### F2 — `status-sweep.ps1:168` throws a red `NativeCommandError` on every run that finds an empty escapee directory.

[MEASURED] The sweep's own output, mid-section-2:

```
Measure-Object : The property "Length" cannot be found in the input for any objects.
At C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1:168 char:95
... orAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
```

[MEASURED] Line 168 is
`$escapeeSize = (Get-ChildItem $subdir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`.
`C:\po-worktrees\fix-followup-notes` contains 3 entries and no files, so `Get-ChildItem -Recurse`
yields nothing and PS 5.1 `Measure-Object -Property Length` errors on empty input. The error is
non-terminating; the `$escapeeKB` fallback correctly reports `0KB` and the report completes.

[INFERRED] The damage is not the value — it is the **noise**. This sweep's own header says *"If ANY
`[BROKEN]` appears in section 0, STOP: the report is unreliable until the instrument is fixed."* A
report that prints a scarlet exception block on every run in the section immediately after that
instruction trains its readers to scroll past exceptions in a document whose whole purpose is to be
trusted. Landed 2026-08-31 in #1460, so it is one day old and has not yet had time to teach that.

[MEASURED, second-order] The same line pairs `-Recurse` with `-ErrorAction SilentlyContinue`, so a
sub-tree it cannot read reports `0KB` — byte-identical to genuinely empty. DOCTRINE §9.6: an empty
result is not an empty world. Not load-bearing today (size is advisory), worth fixing in the same
touch.

**DISPATCHED → Station 00.** One-line fix, `scripts/pipeline/status-sweep.ps1:168` — add
`-ErrorAction SilentlyContinue` to `Measure-Object`, or filter `| Where-Object { -not $_.PSIsContainer }`
first. RULE 1: additive, changes no reported value, and removes a signal-suppressor from the
pipeline's most-read instrument.

### F3 — Two worktree escapees point at destroyed Linux-sandbox gitdirs. They are dead by construction and cannot be revived.

[MEASURED] The sweep's new registry-escapee scan found 9 directories under `C:\po-worktrees` and
`C:\po-wt` absent from `git worktree list`. Reading each one's `.git`:

| path | `.git` | points at | age | size |
|---|---|---|---|---|
| `C:\po-worktrees\po-scan-1787002207` | **file** | `/sessions/funny-blissful-archimedes/mnt/ProjectOperations2/.git/worktrees/po-scan-1787002207` | 14.1 d | 26 MB |
| `C:\po-worktrees\scan-1787220682` | **file** | `/sessions/peaceful-gracious-knuth/mnt/ProjectOperations2/.git/worktrees/scan-1787220682` | 11.5 d | 28 MB |
| `C:\po-worktrees\ph` | dir (full clone) | — | **1.2 h** | 914 MB |
| `C:\po-wt\fix` | dir (full clone) | — | 17.0 d | 27 MB |
| `C:\po-worktrees\fix-followup-notes` | absent | — | 14.8 d | 0 KB |
| `C:\po-wt\agentB-out` | absent | — | 11.9 d | 200 KB |
| `C:\po-wt\draft` | absent | — | 13.6 d | 24 KB |
| `C:\po-wt\rescue-drop-corrections` | absent | — | 12.8 d | 21 KB |
| `C:\po-wt\s9files` | absent | — | 13.0 d | 1 KB |

[INFERRED] The two `gitdir:` pointers are **Linux sandbox paths**. Those VMs are destroyed; the
gitdir they name does not and cannot exist on this host, so no git command run on Windows will ever
resolve them. This is precisely §9.6's *"a lock left by a destroyed Linux VM has no Windows process
by construction, forever"* — the same failure mode, wearing a worktree's clothes. It is also
[INFERRED] evidence that DOCTRINE §9.2's *never run `git` through the device bridge against the
Windows `.git`* was breached at least twice, on 2026-08-17 and 2026-08-20.

🔴 **`C:\po-worktrees\ph` is 71 minutes old, 914 MB, with `node_modules` written 21:54Z and `.git`
21:40Z. It is LIVE OR RECENT. Do not prune it.** #1454 exists because the sweep once called a live
station worktree an aborted leftover and then said SAFE TO ACT; this is that same trap and the
escapee list does not distinguish it.

**DISPATCHED → Station 00.** Prune authority is not Station 03's (`STATION-CAPABILITIES.md` §5:
Station 03 is ⚠️ report-only). Recommended order, safest first: (1) the two sandbox-pointer
directories — `po-scan-1787002207`, `scan-1787220682` — 54 MB, unrecoverable by construction,
**MOVE, never delete**, per the standing paper-trail rule; (2) the five no-`.git` leftovers,
11–15 days old, 246 KB total — cosmetic, do them in the same touch; (3) `C:\po-wt\fix` (27 MB,
17 d) only after confirming no branch lives there; (4) **`ph` — leave alone entirely, and re-measure
its age before anyone reconsiders.** RULE 1: the complete half is teaching the sweep to classify
escapees by *age plus `.git` reachability* the way #1460 already classifies registered worktrees,
so the live-vs-dead call stops being a human judgement each run.

### F4 — Four documents name three different watcher-launcher paths, and `watcher-launcher-singlelane.ps1` exists at none of the repo paths.

[MEASURED] `Test-Path` across every candidate:

```
True   C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher.ps1              <- the one actually running
False  C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher-singlelane.ps1
True   C:\po-watcher\watcher-launcher.ps1
True   C:\po-watcher\watcher-launcher-singlelane.ps1
True   C:\po-watcher\ProjectOperations\scripts\pr-watcher\watcher-launcher.ps1
False  C:\po-watcher\ProjectOperations\scripts\pr-watcher\watcher-launcher-singlelane.ps1
```

[MEASURED] The live wrapper (pid 13464) is
`C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher.ps1` — a path **no document names**.

[INFERRED] The disagreement is four-way and each layer is confident:
- The station doc AUTHORITY section: *"The launcher is `watcher-launcher-singlelane.ps1`. Older
  instructions named a different file and called it 'the REAL launcher path'; that was wrong."*
  True only of `C:\po-watcher\watcher-launcher-singlelane.ps1`, which is **outside the repo** and is
  not what is running.
- The station brief's FIX LANE section, same file, further down: *"relaunch DETACHED via
  `C:\po-watcher\watcher-launcher.ps1`"* — a different file, contradicting the section above it.
- The scheduled-task bootstrap: *"The real launcher is `watcher-launcher-singlelane.ps1`"*, bare,
  with no path.
- Reality: `C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher.ps1`.

This is a restart footgun sitting directly on top of F1's restart requirement. Whoever executes F1(a)
has three plausible launchers to choose from, two of which exist, and only one of which reproduces
the running chain.

[MEASURED, same family] The bootstrap also still asserts *"If this station appears in the
scheduled-task listing, it is cloud-fired and structurally cannot reach the box."* This run appeared
in the listing (`list_scheduled_tasks` → `03-machine-minder`, `lastRunAt 2026-08-31T23:01:32Z`) **and
reached the box.** `STATION-CAPABILITIES.md` §2 records that rule as REFUTED in both directions; the
bootstrap was rewritten 2026-08-24T22:54:22Z and has not caught up.

**DISPATCHED → Station 00.** Repo-side is an agent's to fix and should be: make the station doc name
the measured path once, delete the contradicting FIX LANE line, and record the singlelane file's
actual location. The bootstrap at `C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md` is
**Marco's paste** and no agent can edit it — 00 should carry both corrections to him together.
RULE 1: the complete-and-additive option is a probe rather than a prose correction — have
`status-sweep.ps1` print the live wrapper's resolved command line in §2, so the launcher path is
*measured* every run and no document can go stale about it again. Editing the docs alone fixes
today's four-way split and leaves the next one free to form.

### F5 — The watcher clone's stash pile is at 55 and still a closed loop; 20 are pure preflight garbage.

[MEASURED] `C:\po-watcher\ProjectOperations`: **55** stashes total —
**20** matching `watcher-preflight-autostash`, **35** other/real WIP. Oldest is
`2026-07-14T08:44:31+10:00`; newest is the current watcher's own launch,
`watcher-preflight-autostash ... 2026-08-31T19:35:32+10:00`. Dev tree `C:\ProjectOperations2`: **11**
stashes, **0** preflight.

[INFERRED] DOCTRINE §9.2 records this as a closed loop by design — the launcher stashes on every
start and nothing ever pops — and instructs Station 03 to *report the count and its growth*. Growth
reference point: `C:\po-watcher\stash-trim-2026-08-24-station03.log` (2026-08-24) enumerates entries
through `stash@{37}`. The log does not record the post-trim count, so I can state the ceiling it saw
but **[CANNOT MEASURE]** the true delta since — a rate needs two counts and I have one. From this run
forward the number above is the baseline.

The 20 preflight entries are unambiguously discardable (`git stash drop`, **never `pop`** — §9.2).
The 35 others are real WIP going back seven weeks and are not mine to judge.

**DEFERRED.** Not urgent: 55 stashes cost nothing but disk, and disk has 199 GB free. It becomes
urgent if the count starts climbing faster than one per watcher restart, or if anyone needs to read
the clone's stash list to recover work and has to sift 35 entries. The additive fix, when someone
does touch it: have the launcher's preflight **drop its own previous autostash** before creating the
next, so the loop closes itself and the 35 real ones stay legible.

## WHAT I DID NOT DO

- **Pruned nothing.** Nine escapees, 55 + 11 stashes, a stale-claim list in sweep §5 — all left
  exactly as found. Station 03 is report-only (`STATION-CAPABILITIES.md` §5); Station 00 dispatches
  the repair.
- **Did not run `restart-watcher-if-wedged.ps1`.** It is the sanctioned liveness probe and it can
  restart the watcher. The watcher is mid-run on an armed `escalates=true` prompt. Liveness was
  established from three independent read-only sources instead (process tree, `ensure-watcher.log`,
  `watcher-launch.log`).
- **Did not fast-forward the clone** (F1a) or touch `C:\po-watcher\ProjectOperations` in any way.
  Never `checkout`/`commit`/`push` in the watcher's repo (DOCTRINE §4) — and a live agent worktree
  `agent-a003198cfd3e86856` is checked out there right now.
- **Did not commit this breadcrumb.** The dev tree has 16 dirty files, another chat committed inside
  `C:\po-worktrees\lane-doctrine` at 23:05:13Z, and the index is shared (§9.2). The breadcrumb is
  written untracked to `C:\ProjectOperations2\docs\pr-prompts\` for Station 00 to sweep up.
- **Did not touch the board, the queue, or any prompt.** No arming, no merging, no labels, no
  `needs-marco/` moves — including the eight `[STALE]` escalations sweep §5 lists, which are queue
  hygiene and belong to 00.
- **Did not go near Azure / Entra / SharePoint.** Absolute, all stations.
