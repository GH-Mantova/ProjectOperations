# Station 03 — Machine Minder | 2026-09-15T23:03:00Z–2026-09-15T23:12:00Z

## GROUND

```
UTC            2026-09-15T23:03:00Z
origin/main    af6c4f44              (fetched, then rev-parse)
dev tree       main @ 09ce4ffc       C:\ProjectOperations2   (2 behind origin/main, 0 ahead)
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree** — this run was not restricted to read-only on that account.

**This was a SIGHTED run.** Desktop Commander reached the host on the first call after the schema
load; `start_process` shell `powershell.exe` returned PID 8476 and every measurement below came from
it. This is stated explicitly because a blind run and a healthy quiet run produce the same "no news".

**Which tree I read my binding documents in.** `C:\ProjectOperations2` (the dev tree), per PREFLIGHT
step 2's rule that `origin/main` is a per-tree ref. I read the working copy, then proved it current
rather than assuming it:
`git diff --numstat origin/main -- <path>` returned **EMPTY** for all three of
`docs/pipeline/stations/03-machine-minder.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` — the prescribed sound form, no pipe, no hash comparison
(§9.1). **Coverage disclosure:** DOCTRINE §1–§9.6 read in full; §10 read by heading list plus the
opening of §10.1. I mutated no board object, so §10's second-lane rules did not bind an action this
run — but the partial read is recorded rather than implied.

**Device-bridge git guard.** Installed at the top of the run, before any VM-side call, as PREFLIGHT
requires. Last line quoted verbatim:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

(preceded by `vm-git-guard installed at /sessions/tender-inspiring-clarke/.local/bin/git - refuses
mounted paths and mounted cwd, allows everything else (three controls passed)`; exit 0.)

## WHAT I MEASURED

**Watcher chain — ALIVE, full ancestry, on cadence.** [MEASURED] `Get-CimInstance Win32_Process`,
matching on **command line**, never on image name (§9.5): 9 `node.exe` running, exactly one is the
watcher.

```
WATCHER_PID=20948 START_UTC=2026-09-15T22:21:29Z
  CMD="C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
LAUNCHER_PID=14836 ... -File "C:\po-watcher\watcher-launcher-singlelane.ps1"     START_UTC=22:21:21Z
LAUNCHER_PID=10748 ... -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1  START_UTC=22:21:26Z
```

**The rescan loop is LIVE, not merely logged.** [MEASURED] the authoritative freeze probe — the `ts`
field inside `.queue-state.json`, sampled twice across more than one `RESCAN_INTERVAL_MS`:

| sample | wall clock | `ts` |
|---|---|---|
| A | 2026-09-15T23:03:00Z | `2026-09-15T23:01:31.833Z` |
| C | 2026-09-15T23:06:37Z | `2026-09-15T23:06:31.081Z` |

`ts` **advanced by exactly 5 min 00 s**, the configured rescan interval. Cross-checked against the
live daily log, whose last three `verdict-archive sweep` lines are `22:51:31` · `22:56:31` ·
`23:01:31` — five minutes apart, no gap. The sweep's `heartbeat age: 20 min` is the documented
mid-run-only tick against an empty queue, i.e. **idle, not wedged**.

**I selected the live log by NAME SHAPE then mtime, never by constructing a date** (§9.5). The trap
was live this run: the newest daily log is **`2026-09-16.log`** (host-local Brisbane name) while UTC
is still 2026-09-15. A UTC-constructed name would have opened `2026-09-15.log`, frozen at 13:26:36Z —
the dead file, whose positive control passes.

**Locks and in-progress state — CLEAN in both trees.** [MEASURED] `.git/index.lock` **ABSENT** in
`C:\ProjectOperations2` and in `C:\po-watcher\ProjectOperations`; no `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` or `sequencer` in either. Nothing to age, nothing
to classify stale.

**Clone drift.** [MEASURED] clone `HEAD=64053600`, and its **own** `origin/main` also reads
`64053600` — so `git rev-list --left-right --count origin/main...HEAD` in the clone returns `0 0`
and reads "zero behind". Measured against the **real** `origin/main` from the dev tree, the clone is
**1 commit behind** (`git rev-list --count 64053600..af6c4f44` → 1). The clone's ref is pinned to
whatever `main` was at the 22:21Z launch, exactly as PREFLIGHT warns. **1 commit is normal drift for
a 46-minute-old watcher and needs no restart.**

**Stashes — the closed loop, and it is still growing.** [MEASURED] clone stash count **76**
(dev tree: 0). My 2026-09-08 breadcrumb is the last one in the corpus to quote a figure; the number
is state and is recorded here to be re-measured, never quoted forward.

**Restarter.** [MEASURED] `PO Watcher Keepalive` — `State=Ready`, `LastRun 2026-09-15T22:55:01Z`,
`LastTaskResult=0`, `NextRun 23:05:00Z`, repetition `PT10M`. It relaunched the watcher at 22:21:22Z
and verified detachment: `VERIFIED node pid 20948 ancestry: powershell.exe:10748 <- powershell.exe:14836
<- WmiPrvSE.exe:5164  detached=True`.

**Queue.** [MEASURED] globbed at **top level only** (§9.5 — deeper returns the inert retirement
corpus): `*-ready.md` armed at depth 1 = **0**; `*-HOLD.md` = 36; `needs-marco/` = 57. All three arms
of 2026-09-15 were consumed.

**Board.** [MEASURED] `gh pr list -R GH-Mantova/ProjectOperations --state open`, with `-R` passed
explicitly and `$LASTEXITCODE` tested before parsing (§9.4) — exit 0, 5 open: **#1975**, **#1974**,
**#1971** `[do-not-merge]`, **#1967** `[do-not-merge]`, **#1960**. The two labelled PRs are
**CP-26 `[LABEL_PRESENT]` — parked by design, not work** (§9.4); only Marco removes the label.

**Instrument positive controls, from the sweep's own section 0** — both PASS:
`gh CAN reach GitHub (saw merged PR #1973)` and `node runs`.
**Negative control, freshly minted this run:** `zzMM03Needle20260916T09` over
`docs/pr-prompts/needs-marco/*.md` → **0**, against the positive control `Keepalive` → 1 file.
⚠️ That needle is spent the moment this file lands; the next run mints its own.

**The `*>` capture trap fired, as PREFLIGHT predicts.** `status-sweep.ps1 *> <file>` wrote a
**149,346-byte UTF-16LE** file opening `FF FE`. Decoded `utf16le` in node it is 893 lines and all 13
section headers resolve; read as UTF-8 it would have been structureless at exit 0.

**Triage of `docs/pr-prompts/failed/` against my own prior breadcrumbs.** My last run was
2026-09-14T23:01Z (archived). Exactly one entry is NEW since:
`pr-fv2-import-s2-review-route-c-ready.md` (+`.log`, +`.report.md`), quarantined 2026-09-15T01:15:02Z
after `agent exited 0 but opened no PR on all 3 attempts`. Agent output, quoted:
*"This prompt is `STATUS: HOLD` … I won't start work until you arm it. What would you like …"* —
a **prose** human gate, invisible to `lint-prompt.mjs`'s three literal markers (§9.5), combined with
a headless agent asking a question §6 forbids. **It is already closed and I did not re-open it:**
`.arming-log.txt` records
`2026-09-15T01:20:51Z REFIRED pr-fv2-import-s2-review-route reason=writer-refused-on-stale-STATUS-HOLD-section-3x-queue-paused from=failed/pr-fv2-import-s2-review-route-c-ready.md`,
and `processed/pr-fv2-import-s2-review-route-ready.md.log` carries `PR #1948 opened` plus
`merge result for PR #1948: {"ok":false,"marco":true,...}`. Station 00 diagnosed it identically and
fixed it within six minutes. `rev-1923` (09-14T08:32Z) and `rev-1897` (09-13) predate my last run and
are not re-triaged. **No restage staged by me; none is needed.**

**[CANNOT MEASURE] — why the keepalive did not fire during the outage, from the Task Scheduler's own
log.** `Microsoft-Windows-TaskScheduler/Operational` returned 0 events, and the control shows why:
`Get-WinEvent -ListLog` reports **`IsEnabled=False`**. That zero is a disabled log, not an idle
scheduler, and is reported as unmeasured rather than as evidence. The cause below was established
from a different instrument.

## WHAT CHANGED

**Nothing.** This station is report-only and this run mutated no machine, no tree, no queue file, no
label and no PR. The only writes were: my own breadcrumb (this file, in the dev tree), a byte copy of
the live daily log to `C:\po-sup-fix-scripts\mm-log-copy.log` (the live file is held open by the
watcher and cannot be read in place), and the sweep capture at
`C:\po-sup-fix-scripts\mm-sweep-20260916.txt`. Both scratch files are outside every git tree. I
staged nothing — the dev tree's index is shared with concurrent chats (§9.2) and three unrelated
deletions were already sitting in it.

## FINDINGS

### F1 — A plain LOG-OFF killed the watcher for 8 h 50 m on a machine that never slept, and the open escalation is framed around reboots, which this was not

`KEEPALIVE_GATE_FIRES_ON_LOGOFF_NOT_ONLY_REBOOT_V1`

[MEASURED] The watcher's previous instance (pid 7404) wrote its last log line at **13:26:36Z** and
`ensure-watcher.log` recorded its last `watcher alive` row at **13:25:02Z**. The next row in that
file is **`2026-09-15T22:21:22Z RELAUNCHED`** — a hole of **8 h 56 m** in which the keepalive did not
merely fail to relaunch the watcher, it **did not execute at all**.

🔴 **The machine was awake for the whole hole, so sleep is excluded.** [MEASURED] `Get-WinEvent`
over `System`: **646** events fall strictly inside the gap (782 in the surrounding 16 h). Last event
before the relaunch `22:20:44Z`, first after `22:21:49Z` — a continuous log, not a resume. Kernel-Power
`Id=42,107` over 16 h → **0**.

🔴 **The cause is a user log-off, and it brackets the hole almost exactly.** [MEASURED] `System` /
`Microsoft-Windows-Winlogon`, 2 events in 16 h:

| UTC | Id | event |
|---|---|---|
| **2026-09-15T13:29:20Z** | 7002 | **User Log-off** |
| **2026-09-15T22:19:47Z** | 7001 | **User Log-on** |

Watcher dies 13:26:36Z → logoff 13:29:20Z → **8 h 50 m 27 s of no interactive session** → logon
22:19:47Z → relaunch 22:21:22Z, **92 seconds later**. The recovery was automatic and fast; the
*detection* was gated entirely on a human returning to the keyboard.

🔴 **Why this is not a duplicate of the file already open.**
`needs-marco/watcher-keepalive-is-gated-on-an-interactive-logon-2026-09-11.md` is **still open and
still correct** — I ran its own falsifying probe and it does not discharge:
`LogonType=Interactive`, `RunLevel=Limited`, `UserId=Marco`, triggers `MSFT_TaskLogonTrigger` +
`MSFT_TaskDailyTrigger (PT10M)`, **no boot trigger**, `WakeToRun=False`. But that file frames the
defect as *"after an unattended restart the machine comes up…"* and both its measured occurrences
(09-09, 09-10) are reboots. **Today there was no reboot.** A log-off on a running machine kills the
watcher *and* disables the thing that would notice, simultaneously — and that is a strictly larger
exposure than the one on file, because it needs no restart to happen.

🔧 **It also re-weights that file's own options, in Marco's favour.** Its option **(b)** — add the
boot trigger only, leave the principal `Interactive` — would have done **nothing** here: there is no
boot to trigger on. Only the **principal** half of option (a) covers a log-off. So the boot trigger
is the optional half and *"run whether the user is logged on or not"* is the load-bearing half — the
reverse of how the two read as a pair.

**Measured cost this occurrence, so the ask is concrete.** Three PRs already open when the watcher
died sat unattended for the whole hole: **#1960** (created 05:03:17Z), **#1967** (07:51:44Z),
**#1971** (11:49:32Z). #1960 **has merge conflicts**, and the watcher posted the conflict comment at
**22:51:35Z** — first observation at 22:49:42Z, i.e. **only after it came back**, nine hours late.

**DISPOSITION: ESCALATED.** Not as a new file — the escalation exists and re-filing it would split
the thread. The ask for Marco is the existing question in
`watcher-keepalive-is-gated-on-an-interactive-logon-2026-09-11.md`, **plus this correction**: the
principal change is the half that matters, it is needed for log-offs and not only reboots, and this
is now the **third** measured occurrence. **RULE 1 applied** — (a) *set the principal to run whether
logged on or not, and add the startup trigger* is the only option that is both immediate and future,
and is additive: the keepalive is `MultipleInstances IgnoreNew` and `ensure-watcher.ps1` no-ops while
the watcher lives, which its own unbroken 10-minute rows demonstrate. (b) *boot trigger only* fails
the future half and, as measured today, would not have caught this occurrence at all. (c) *rely on
noticing* failed the future half for the third time. The two things still only Marco can settle are
unchanged: the stored account password, and whether anything in
`watcher-launcher-singlelane.ps1 → start-watcher.ps1 → node index.mjs` needs an interactive desktop.

### F2 — An orphaned worktree eleven days old holds the only copy of an uncommitted file, and the prescribed cleanup would discard it

[MEASURED] `git worktree list` in the dev tree, cross-read with the sweep's section 2 liveness
classification. Five non-main worktrees, four classified orphaned:

| worktree | branch / head | dirty | age |
|---|---|---|---|
| `C:/PR-Master/worktrees/po-vg` | `fix/no-rebase-while-checks-run` | **1** | **16754 min ≈ 11.6 days** |
| `C:/PR-Master/worktrees/pr1823` | `feat/ea-gate-reporting-team-permission` | 0 | 8696 min ≈ 6.0 days |
| `C:/PR-Master/worktrees/dp3hex` | `347eee55` (detached) | 0 | 42 min |
| `C:/PR-Master/worktrees/stagedconv` | `docs/drafts-staged-lifecycle` | 0 | 37 min |

[MEASURED] `git -C C:/PR-Master/worktrees/po-vg status --porcelain` →
`?? scripts/pipeline/check-pipeline-heartbeat.mjs` — **untracked**, so it is on no branch, in no
stash and in no commit anywhere. `git worktree remove` refuses a dirty worktree and `--force`
**discards** it. Eleven days is long enough that nobody is coming back for it by accident.

**DISPOSITION: ESCALATED.** Not because the decision is hard but because it is **irreversible** and
that is a DOCTRINE §5 hard stop — the file's only copy dies with a `--force` that a routine cleanup
would reach for. Marco's call, and RULE 1 puts the complete-and-additive option first: **(a)** copy
`check-pipeline-heartbeat.mjs` out to `C:\po-sup-fix-scripts\` (or commit it on its own branch)
**and then** prune the worktree — solves it now, cannot recur for this file, destroys nothing.
**(b)** `--force` the prune — immediate, fails the no-damage half outright. **(c)** leave it —
destroys nothing today but leaves a growing orphan set and a file one careless cleanup from gone.
The three clean worktrees need no decision: `dp3hex` and `stagedconv` are minutes old and plausibly
just-finished runs, and `pr1823` is clean, so any of them can be pruned safely whenever 00 chooses.

### F3 — `status-sweep.ps1`'s clone-dirty warning is false again, and it is the exact defect DOCTRINE §9.5 already records

[MEASURED] both forms against `C:\po-watcher\ProjectOperations` in the same minute, which is that
bullet's own falsifying probe:

| form | result |
|---|---|
| `git status --short` (what the sweep counts) | **3** |
| `git status --porcelain --untracked-files=no` (what `start-watcher.ps1` counts) | **0** |

The three are `?? docs/pr-reviews/pr-1974-review.md`, `?? docs/pr-reviews/pr-1975-review.md` and
`?? scripts/pr-watcher/.conflict-notified-prs.json` — **all untracked, all written by the watcher's
own review and conflict-tracking steps by design.** The sweep's `[LIVE] watcher clone: branch=main
dirty=3  <-- NOT clean-on-main; the watcher may refuse to start` is therefore false in both halves:
the tracked tree is clean, and a tracked-dirty clone auto-stashes rather than refusing.

**DISPOSITION: DEFERRED.** The reading is understood, is written down in DOCTRINE §9.5 with this
same probe, and cost nothing this run because I re-derived the line from its own source before
believing it. The fix is a one-line scope change inside `scripts/pipeline/status-sweep.ps1`, which
is a `scripts/` change and outside my report-only lane. **What would make it urgent:** a run that
acts on the warning — dispatching clone hygiene, or restarting a healthy watcher on the strength of
*"may refuse to start"*. The archive already holds 13 verbatim quotations of that line, so the
mis-routing is recurrent rather than hypothetical.

### F4 — Three arms are recorded nowhere but this machine's disk

[MEASURED] `.arming-log.txt` is **126** lines in the working copy against **123** on `origin/main` —
the gap DOCTRINE §9.5 says closes and re-opens by luck, currently **OPEN at 3**. The three
uncommitted arms, with the matching `-HOLD.md` deletions also uncommitted:

```
2026-09-15T06:59:44Z  ARMED  pr-scopecards-s1-operational-costs-priced      escalates=true
2026-09-15T11:24:00Z  ARMED  pr-crmvis-s2-relationships                    escalates=true
2026-09-15T12:06:13Z  ARMED  pr-draftpanel-s3-carry-over-and-picker        escalates=false
```

I proved these are genuinely uncommitted rather than an artefact of reading a behind-HEAD tree
(§9.2): `git diff --numstat origin/main -- <path>` returns a real delta for all five paths — the log
(`3 0`), `sweep-rotation.json` (`2 2`) and the three deletions (`0 119`, `0 275`, `0 242`).

**DISPOSITION: DISPATCHED to Station 00.** Committing the arming log and the consumed-prompt
deletions in the next board PR is 00's lane, not mine — I may not stage in a shared index. Until they
land, **any arm age read from `origin/main` is a lower bound, not the answer**, and a clone, CI or a
blind station reads a day-stale arm history that answers rather than admitting it does not know.

### F5 — The sweep's CAUTION verdict is correct and benign, and I confirmed that rather than assuming it

[MEASURED] Section 7 returned `CAUTION: 1 LIVE STATION WORKTREE(s) detected —
C:/PR-Master/worktrees/rcpt1972`. That worktree's newest file is `1972.md` at **23:07:50Z**, written
*after* the sweep finished at 23:07:35Z, and `gh pr view 1972 --json number,state,mergedAt,title`
(server-supplied fields, never `--json number` alone — §9.4) returns
`{"mergedAt":"2026-09-15T23:06:27Z","state":"MERGED"}`. So a station is writing a merge receipt for
a PR that merged 83 seconds earlier: **live work, not an aborted-run leftover.**

**DISPOSITION: ACTIONED** — the action being the verification itself. I re-derived a `[LIVE]` line
from its own source before treating it as a fact, and the answer changed its meaning from
"investigate" to "do not touch". I mutated nothing while another actor was live in the tree.

## WHAT I DID NOT DO

- **I did not repair, arm, merge, label, restage or prune anything.** Station 03 is report-only; the
  repair is Station 00's to dispatch. Every finding above is left exactly as measured.
- **I did not restart the watcher.** It is 46 minutes old, its chain is intact and detached, its
  rescan `ts` advanced by a full interval across my two samples, and its clone is 1 commit behind —
  normal drift. There is nothing a restart would adopt that is worth the risk.
- **I did not prune the four orphaned worktrees**, including the three that are clean and safe. The
  one that matters holds an untracked file and `--force` is irreversible (§5); the other three are
  00's to sweep whenever it likes, and splitting the set would obscure that.
- **I did not restage `pr-fv2-import-s2-review-route`.** Station 00 already refired it and it opened
  #1948. Restaging a prompt whose body still carries a prose `STATUS: HOLD` gate would have failed
  identically a fourth time.
- **I did not touch `needs-marco/`.** F1 belongs to a file that is already open there; appending to
  it would put a finding in a gitignored path, and the breadcrumb is the tracked channel.
- **I did not enable `Microsoft-Windows-TaskScheduler/Operational`.** Turning on an event log is a
  machine configuration change; it is reported as `[CANNOT MEASURE]` instead, and the cause was
  reached from Winlogon anyway.
- **I did not touch Azure, Entra or SharePoint**, and nothing this run came near them.
- **I did not run `git` from the VM against either Windows `.git`.** The guard was installed first and
  every git command above ran in PowerShell on the host.
