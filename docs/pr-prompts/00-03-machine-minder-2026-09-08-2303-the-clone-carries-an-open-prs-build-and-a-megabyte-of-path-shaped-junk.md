# Station 03 — Machine Minder | 2026-09-08T23:02:32Z–2026-09-08T23:12Z

## GROUND

```
UTC            2026-09-08T23:02:32Z
origin/main    2279d2d9              (fetched, then rev-parse, in the dev tree)
dev tree       main @ 533604dc       C:\ProjectOperations2   (2 behind origin/main)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is not read-only-by-mismatch.

**Sighted run.** Desktop Commander reached the Windows host on the first call
(`PROBE_OK 0 2026-09-09 09:01:55` local). Every `[MEASURED]` line below is a
PowerShell probe on the box, not a GitHub-side substitute.

**Binding docs read from a working copy PROVED byte-identical to `origin/main`,**
not from a blind working-copy read: `git diff --numstat origin/main --` over all
three returned EMPTY, and `git rev-parse origin/main:<path>` equalled
`git hash-object <path>` on each — `813ae540` (03-machine-minder.md),
`289eb32f` (DOCTRINE.md), `69f57d4e` (STATION-CAPABILITIES.md). No pipe, no
re-encode (§9.1). The tree being 2 behind did not touch any of the three.

## WHAT I MEASURED

**Device-bridge git guard — installed, quoted as the contract requires.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, last line:
`vm-git-guard installed at /sessions/sharp-wizardly-bohr/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`.
PASS. No VM-side `git` was run against a Windows `.git` this run.

**Mount enumeration.** [MEASURED] `ls /sessions/sharp-wizardly-bohr/mnt/` returns
**three** entries — `ProjectOperations2`, `outputs`, `uploads`. Not the eleven
STATION-CAPABILITIES §3 records for a blind 00 run; the mount list is a property
of the session, as that section says. Irrelevant to this run (sighted), recorded
so the next reader does not treat eleven as a constant.

### The watcher is ALIVE and its rescan loop is TICKING

| probe | [MEASURED] |
|---|---|
| watcher node | pid **31660**, `StartTime` **2026-09-06T23:05:03Z** — up ~48 h |
| its command line | `node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs` |
| resolved how | `Get-Process` joined to `Win32_Process.CommandLine` by PID — **never** by image name (19 `node.exe` are running; exactly one is the watcher) |
| keepalive task | `PO Watcher Keepalive` = **Ready**, `lastRunUtc` 2026-09-08T23:05:02Z, `lastResult` **0** |
| `ensure-watcher.log` | 2231 lines, last four all `watcher alive, pid(s) 31660`, newest **23:05:03Z** |
| `.queue-state.json` `ts` | **2026-09-08T23:05:10.133Z** — read at 23:07:59Z, **169 s old** |
| daily clone log, newest line | `[2026-09-08T23:05:10.132Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=107` |

The `ts` and the log line agree to the millisecond, and both sit inside one
`RESCAN_INTERVAL_MS` (5 min) of the read. **Not frozen, not paused.** The two
`ts` samples I took were identical only because they were 2.8 min apart —
inside the interval — so that pair is *not* the freeze probe and is not offered
as one.

**The daily-log naming trap reproduced exactly as DOCTRINE §9.5 records it.**
[MEASURED] the LIVE log is named **`2026-09-07.log`** and its newest line is
stamped **2026-09-08T23:05Z** — a day and a half of drift between the filename
and the content. Selected by name-shape filter then newest `LastWriteTimeUtc`,
never by constructing a date:
`2026-09-07.log` mtime 23:05:10Z / 205,033 B — `2026-09-06.log` mtime
2026-09-06T23:04:05Z — `2026-09-04.log` mtime 2026-09-06T05:27:31Z.
2022 lines; POSITIVE control `[merge]` → **20**; `opened PR #` → **9**;
NEGATIVE control, freshly minted needle `zzQq03Needle20260908T2305` → **0**.
A run naming the file in UTC would have opened `2026-09-08.log`, which does not
exist.

### Locks, mid-flight state, sentinels — all clean

- [MEASURED] `index.lock` **absent** in both `C:\ProjectOperations2\.git` and
  `C:\po-watcher\ProjectOperations\.git`. Nothing to age or size.
- [MEASURED] running `git` processes: **0**.
- [MEASURED] `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` /
  `rebase-apply` / `sequencer`: **none present** in either tree.
- [MEASURED] `C:\po-watcher\STOP-WATCHER` **absent** (`Test-Path` → False);
  `C:\po-watcher\STOP-WATCHER-LANE2` **present** — by design, not drift;
  `watcher-launcher-singlelane.ps1` **present**. NEGATIVE control
  `C:\po-watcher\zzQq03NoSuchFile20260908` → False.
- [MEASURED] dev-tree stashes: **0**.

### The clone is NOT running stale watcher code — no restart is owed

[MEASURED] in the dev tree:
`git diff --name-only 533604dc origin/main -- scripts/pr-watcher` → **EMPTY**.
POSITIVE control that the instrument works:
`git diff --name-only origin/main~40 origin/main` → **167** files.

The whole of `533604dc..origin/main` is four files across two commits —
`2279d2d9` (personas lookup-rate handler + its spec + personas.module.ts) and
`88873ae7` (`apps/web/src/styles/tokens.css`). **No `scripts/pr-watcher/**`
change is waiting to be adopted, so the standing "restart to adopt" question is
answered NO for this run** — and a restart would cost the 48 h of live process
for nothing.

### failed/ — nothing new to triage

[MEASURED] `failed/` holds 43 files; **0** of them written after my previous run
(2026-09-07T23:03Z). Newest is `rev-1746-ready.md.log` at **2026-09-07T00:29:13Z**
(`SessionEnd hook … Hook cancelled`), which my 2026-09-07 breadcrumb already
covered. Diffed against the **13** tracked `00-03-machine-minder-*` breadcrumbs on
`origin/main` (POSITIVE control: 249 `00-00-supervisor-*` crumbs by the same query).
No new triage this run, and nothing is limit-parked.

## WHAT CHANGED

**Nothing.** This station is report-only and mutated no state: no repair, no arm,
no merge, no label, no board file, no `git` write in any tree. The only files I
created are three scratch `.ps1` under `C:\po-sup-fix-scripts\`, one 205 KB copy
of the daily log for reading (the live file is held open by the watcher), and
this breadcrumb.

### Station 00 is DISABLED — measured from the prescribed source

[MEASURED] the scheduled-tasks MCP, this run:

| task | cron | enabled | lastRunAt |
|---|---|---|---|
| **`00-supervisor`** | `5 * * * *` | **`false`** | **2026-09-08T05:08:37Z** |
| `03-machine-minder` | `0 9 * * *` | true | 2026-09-08T23:01:39Z (this run) |
| `04-scanner` | `0 */4 * * *` | true | 2026-09-08T22:10:25Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-09-08T14:11:27Z |
| `weekly-security-audit` | `30 7 * * 1` | true | 2026-09-06T21:32:44Z |

00 is hourly and has not run in **~18 hours**. Four stations are still firing and
filing; the one that dispositions their findings is switched off.

[MEASURED] corroboration from `check-breadcrumb.mjs` in the same run — **six**
breadcrumbs are `UNTRACKED — it reaches nobody until a board PR commits it`:
this one, `00-04-scanner-…-1011`, `…-1411`, `…-1811`, `…-2210`, and
`00-05-sot-keeper-…-1411`. Station 04 reached the same conclusion independently
and twice today: its 06:10Z breadcrumb is titled *"station 00 is disabled so no
breadcrumb collects"* and its 22:10Z one *"the one alarm that fires blames the
stations when it is the collect that stopped"*.

**03's own cadence disagreement is visible in the same table** — cron
`0 9 * * *` (daily) against a bootstrap that says every 4 hours. That is the
already-open escalation
`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`;
I am recording it as still-open, not re-filing it.

## FINDINGS

### F0 — The collect channel is down, so every disposition below is a message in a bottle

The four dispositions in F1–F5 are written to the contract, but the contract's
closing clause — *"Station 00 collects … that is the only channel that closes"* —
does not currently hold. With 00 disabled, DISPATCHED means *queued for a station
that is not running*, and my breadcrumb joins five others that no board PR will
sweep up.

This is not a defect I can fix or route around. The scheduled-tasks layer is
Marco's (STATION-CAPABILITIES §1: an agent cannot edit it), 03 has no arm, merge
or PR authority, and manufacturing a second collector is exactly the
unsynchronised-second-actor failure DOCTRINE §10.2 forbids. Nor may I re-enable
it: that is a change to a live automation's state, made without him.

**ESCALATED** → Marco. One question, and RULE 1 applied to it:

- **(a) COMPLETE AND ADDITIVE — re-enable `00-supervisor`, and add an alarm that
  fires on a *disabled* station rather than on a silent one.** The re-enable
  clears today's backlog; the alarm is what stops the next 18-hour gap, because
  the detector this pipeline already has reads breadcrumb *freshness* and a
  disabled station looks identical to a quiet one. Passes both halves: fixes it
  now, and fixes the class. (Station 04's 22:10Z breadcrumb is about precisely
  this blind spot and is worth reading alongside this.)
- **(b) Re-enable it and nothing else.** Fixes today; **fails the future half** —
  the same silence recurs on the next accidental disable, undetected for as long
  as nobody happens to look.
- **(c) Leave it off deliberately and collect by hand.** Legitimate if the
  disable was intentional — I cannot tell whether it was — but it **fails the
  first half** while the backlog stands, and it needs someone named to do the
  collecting, or the four live stations keep writing into a channel with no
  reader.

⚠️ **I do not know why 00 is disabled.** If Marco turned it off on purpose this
finding is noise and (c) is the answer; the reason it is escalated rather than
assumed is that a station cannot tell an intentional disable from an accidental
one, and the cost of guessing wrong is asymmetric.

### F1 — The clone carries an OPEN PR's build as uncommitted work, and the stash loop is at 69

[MEASURED] `git status --porcelain` in `C:\po-watcher\ProjectOperations`:

```
 M apps/api/src/modules/admin-imports/admin-imports.module.ts
 M apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.spec.ts
 M apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
 M docs/data-model/metadata-catalog.json
?? "C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"
?? docs/pr-reviews/pr-1822-review.md
```

[MEASURED] `git diff --numstat` on the three source files: **13/1 · 258/14 ·
214/60** — 485 insertions, 75 deletions. [MEASURED] clone stash count: **69**
(dev tree: 0).

[INFERRED] from the file paths and the board: this is the build of **#1822**,
*"feat(admin-imports): TFM-S11 recurse into legacy subfolders"* — the one open
PR, and the only board item touching `admin-imports`. The scope matches
exactly.

[MEASURED] the watcher's own code is clean: `git status --porcelain --
scripts/pr-watcher` in the clone → **EMPTY**. The dirt is entirely build
residue, not tampering with the machine.

This is the DOCTRINE §9.2 closed loop doing what it does: the launcher stashes
on every start, nothing ever pops, and the count only grows. 69 stashes is not
itself a failure — it is a monotonic record of every restart since the loop
opened — but a clone that is `dirty=6` on `main` is the condition
`status-sweep.ps1` flags as *"the watcher may refuse to start"*, and it is one
launcher restart away from stash 70.

**Not mine to clear.** Cleaning a clone that holds an open PR's build is a git
write in a shared tree (§4), and the residue may be the only copy of work #1822
still needs.

**DISPATCHED** → Station 00: decide whether #1822's build residue in the clone
is disposable (its branch is pushed, so it likely is) and, if so, whether the
69-stash loop gets drained in the same move or stays as the audit trail. Do not
`stash pop` — `drop`, per §9.2.

### F2 — A megabyte of junk in the clone root whose FILENAME is a collapsed Windows path

[MEASURED] `C:\po-watcher\ProjectOperations\C?po-watcherProjectOperations.._scratch_1740_log.txt`
— **1,033,778 bytes**, mtime **2026-09-07T01:24:17Z**. Git renders the name
`"C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"`; the octal
`\357\200\272` is **U+F03A**, the private-use-area colon substitute Windows uses
when a `:` is escaped into a filename. The intended path was evidently
`C:\po-watcher\ProjectOperations\..\_scratch_1740_log.txt`; the separators and
the drive colon were flattened, and the whole path became one filename **inside**
the repo it was trying to escape from.

So some tool built that path by string concatenation, wrote a 1 MB scratch log to
it, and left it untracked in a repo whose cleanliness gates the watcher's start.
It is one of the two `??` entries keeping the clone dirty in F1.

[CANNOT MEASURE] which tool wrote it. `1740` reads like a PR or PID, but nothing
in the file's name or location records the author, and the write predates every
log I can still read at that granularity.

**DISPATCHED** → Station 00: safe to delete on its face (untracked scratch, two
days old, outside every tracked path), but deletion is a mutation in a shared
tree and the `1740` in its name is the only handle on whatever produced it —
worth one grep for `_scratch_` in `scripts/**` before it goes, so the generator
gets fixed rather than the symptom swept.

### F3 — Same untracked file has pinned the same dead worktree for a fifth day

[MEASURED] `git worktree list` in the dev tree:

```
C:/ProjectOperations2 533604dc [main]
C:/po-vg              23c91ba9 [fix/no-rebase-while-checks-run]
```

[MEASURED] `git -C C:\po-vg status --porcelain` → exactly one line:
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`. Age reported by the sweep:
**6670 min ≈ 4.6 days**.

**This is the third consecutive run reporting it, and the root cause has not
moved.** My own breadcrumb
`docs/pr-prompts/archive/00-03-machine-minder-2026-09-04-2301-one-untracked-file-pins-a-dead-worktree-live-forever.md`
named this exact mechanism five days ago: `git worktree remove` refuses while an
untracked file is present, and `--force` discards it, so the worktree survives
every prune and every sweep tags it live. The pinning file is a *pipeline
instrument that was never committed anywhere* — it exists in no tree but this
dead one.

Per this station's own brief (*"repeat failure of the same root cause =
ESCALATED, not retried"*), I am not filing this as a fourth dispatch.

**ESCALATED** → Marco. The question, with RULE 1 applied:

- **(a) COMPLETE AND ADDITIVE — recover the file, then prune.** Copy
  `C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs` into the dev tree,
  open it as an ordinary PR (it is a `scripts/pipeline/` file, so it is not 03's
  to merge), and only then `git worktree remove C:/po-vg`. Nothing is lost, the
  worktree stops being reported live every four hours, and the next orphan hits
  the same drill. Passes both halves: solves it now and in future, destroys no
  work.
- **(b) `git worktree remove --force`.** One command, ends the noise today.
  **Fails the second half** — it discards the only copy of that file in
  existence.
- **(c) Leave it.** **Fails the first half** — the sweep will report it as a live
  orphan for as long as it stands, and a real orphan will eventually hide behind
  the familiar line.

I have not read the file's contents beyond its name, so I cannot tell you
whether it is worth (a)'s PR — but that is precisely why (b) is the wrong
default.

### F4 — The clone's `origin/main` says it is up to date, and it is 2 commits behind

[MEASURED], same minute, two trees:

| tree | `git rev-parse --short HEAD` | `git rev-parse --short origin/main` |
|---|---|---|
| `C:\po-watcher\ProjectOperations` | `533604dc` | **`533604dc`** |
| `C:\ProjectOperations2` | `533604dc` | **`2279d2d9`** |

[MEASURED] in the clone, `git rev-list --left-right --count origin/main...HEAD`
→ **`0	0`**. [MEASURED] in the dev tree,
`git merge-base --is-ancestor 533604dc origin/main` → exit **0**, and
`git rev-list --count 533604dc..origin/main` → **2**.

**The clone reports itself perfectly synchronised while being two commits
behind**, at exit 0, with no warning — because `origin/main` is a per-tree
remote-tracking ref and the clone only fetches when the launcher starts, which
was 48 hours ago. This is DOCTRINE §9.5's per-tree trap, and it is a *repeat*:
`00-03-machine-minder-2026-09-03-2302-the-clones-origin-main-is-stale-so-the-freshness-cure-fails-there.md`
recorded the same mechanism at a 10-commit, 14-hour gap.

It cost nothing this run — the drift is four files of application code and none
of `scripts/pr-watcher/**` (see WHAT I MEASURED), so the watcher is not running
stale code. It is recorded because the *reading* is dangerous whatever today's
gap happens to be: any station that runs `git show origin/main:<path>` in the
clone gets a well-formed, plausible, two-days-stale document and no signal.

**DEFERRED.** Not urgent while the watcher's own code is identical to `main` and
the launcher re-fetches on every start. It becomes urgent the moment a
`scripts/pr-watcher/**` change merges — then the stale ref and the un-restarted
watcher compound, and the clone will still report `0 0`. The cure is already
written in §9.5 (fetch first in any tree but the dev tree); what is missing is
anything that *makes* a run do it.

### F5 — `ManagementDateTimeConverter::ToDateTime` threw on all 19 node processes; `Get-Process` answered fine

[MEASURED] my first pass resolved watcher PIDs via
`Get-CimInstance Win32_Process` and converted `CreationDate` with
`[Management.ManagementDateTimeConverter]::ToDateTime($proc.CreationDate)`. It
threw `ArgumentOutOfRangeException: Specified argument was out of the range of
valid values. Parameter name: dmtfDate` — **19 times, once per node process**,
and the script continued to completion printing `node.exe total: 19`.

The failure was loud, so this is not a §7 silent-wrong-value. But the shape is
worth one line in the ledger: **the pipeline's own standing rule is *"never count
or kill by image name — resolve PIDs and verify command lines"*, and the obvious
CIM route to a process start time is the one that breaks.** A run that wrapped
that call in a `try` — or that read `CreationDate` without converting it — would
have had 19 empty start times and no exception to show for it.

[MEASURED] the working form, same run, same processes:
`Get-Process node` for `StartTime`, joined by PID to a `Win32_Process` hashtable
for the command line — returned `pid=31660 startUtc=2026-09-06T23:05:03Z` plus
the full command line. POSITIVE control `Get-Process powershell` → 12;
NEGATIVE control `Get-Process zzQq03NoSuchProc` → 0.

**DEFERRED** as a DOCTRINE §9.1 candidate. Real, measured, and cheap to write up
— but it is one line of instrument advice, not a live defect, and §9.1 sits in a
hash-gated canonical block whose re-record is a deliberate, batched act (00's,
not 03's). Worth folding into the next §9 edit rather than opening a PR of its
own. It becomes urgent only if a station reports a process age it could not have
measured.

## WHAT I DID NOT DO

- **Repaired nothing.** 03 is report-only; 00 dispatches the repair. F1's stashes,
  F2's junk file and F3's worktree were all left exactly as found.
- **Did not restart the watcher**, and did not propose it. The measurement in
  WHAT I MEASURED argues *against* a restart: no `scripts/pr-watcher/**` change
  is pending adoption, so a restart would discard 48 h of live process to adopt
  nothing.
- **Did not touch the board.** #1822 is RED (13 pass / 2 fail) and `main` CI on
  `2279d2d9` is RED (4 success / 1 failed). Both are real, both are 00's and 02's
  lane, and neither is a machine fault — I name them only so this report is not
  read as "the board is fine".
- **Did not `git fetch` in the clone** to cure F4. It is a shared tree with a
  live watcher in it (§4), and the fix is 00's to sequence.
- **Did not clear or drop any stash**, did not `git worktree remove`, did not
  delete the scratch file.
- **Did not open a PR.** 03 has no PR authority (STATION-CAPABILITIES §5). This
  breadcrumb is **untracked in the dev tree** at
  `docs/pr-prompts/00-03-machine-minder-2026-09-08-2303-…md` and needs Station 00
  to sweep it into a board PR — which, per F0, is not currently running.
- **Did not re-enable `00-supervisor`, and did not appoint myself its
  replacement.** Both are out of lane, and the second is the failure §10.2 names.

## VALIDATION

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 15 checked,
0 malformed, 0 skipped`, `CLEAN`, **EXIT=0**, with this file listed `ADMIT`.
`breadcrumb-clean` is therefore earned rather than asserted. No `lint-prompt.mjs`
result is quoted — it gates prompts, not breadcrumbs, and returns no meaningful
verdict on one.
- **Did not read `/sot/`, touch Azure/Entra/SharePoint, or write production
  data.**
