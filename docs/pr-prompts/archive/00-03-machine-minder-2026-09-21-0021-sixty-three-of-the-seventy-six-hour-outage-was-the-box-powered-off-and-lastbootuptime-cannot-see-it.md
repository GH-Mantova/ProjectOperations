# Station 03 — Machine Minder | 2026-09-21T00:21:36Z–2026-09-21T00:40Z

## For Marco

**The machines are HEALTHY right now. What is wrong is the account of what happened over the
weekend, and it is wrong in the direction that makes the fix look cheaper than it is.**

1. **63.3 of the 76 hours were the box POWERED OFF.** Someone clicked Shut down from the Start menu
   on Friday at 15:52 local, and the machine did not come back until Monday 07:07 local. Windows
   Fast Startup makes that invisible to `LastBootUpTime`, which still reads 2026-09-15 — so every
   instrument that asks "did it reboot?" answers *no, it was up throughout*. It was not. See **F1**.
2. **That refutes the premise under the escalation that just merged.** Station 04's F1 (in `#2018`)
   reasoned: the host did not reboot ⇒ the failure is in the Cowork scheduled-task layer ⇒ put the
   out-of-band detector in the watcher, "which was demonstrably alive and logging throughout". The
   watcher's process was **gone** and the machine was **off** for 63 of those hours. A detector
   living on this box cannot see this outage at all. See **F1** for the corrected options.
3. **There were TWO outages, not one.** Cowork's stations stopped Friday 06:05 local while the
   machine was demonstrably alive for another 9.8 h — that half *is* an app-layer failure and
   Station 04's reading of it stands. The second half is the box being off. They need different
   answers, and one detector cannot cover both.
4. Two dead leftovers are confirmed prunable and are not mine to prune (**F3**, **F4**), and the
   duplicate-watchdog condition I escalated on 09-16 is absent today **only because the box was
   power-cycled** — the guard that would prevent it still does not exist (**F2**).

Nothing was repaired. Station 03 is report-only.

## GROUND

```
UTC            2026-09-21T00:21:36Z
origin/main    875e1076            (git fetch origin +refs/heads/main:..., then rev-parse --short)
dev tree       main @ 875e1076     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not restricted to read-only on that
account. Station 03 is report-only by its authority row regardless.

⚠️ **The board moved under this run, twice, and the GROUND line is as-of 00:21:36Z.** Station 00 was
live in the same minutes: `origin/main` was `875e1076` at 00:21:36Z, `64abcdcd` at 00:32Z, and the
dev tree tracked it to `64abcdcd` by 00:37:17Z. Every measurement below carries its own timestamp for
that reason.

**SIGHTED run.** Desktop Commander reached the box on the first call. Host PS `5.1.26100.9444`.

**Fresh negative control minted for this run:** `zzQq03Needle` + `20260921T0037` (written split so
this breadcrumb does not spend it twice). It returned **0** over `ensure-watcher.log`, over
`docs/pr-prompts/*.md` and over this run's sweep capture, against positive controls of **75**
(`RELAUNCHED`) and **91** (`[LIVE]`) on the same two files. It is spent the moment this file lands.

## WHAT I MEASURED

### Preflight

- **[MEASURED] Reachability.** `start_process` shell `powershell.exe` → PID 6072 on the first call;
  `interact_with_process` returned `UTC 2026-09-21T00:21:36Z` from the host. **Not blind.**
  (A first attempt through a nested `powershell.exe -NoProfile -Command "…$env:…"` died with
  `$env:COMPUTERNAME` already substituted and `$env:` forms emptied — DOCTRINE §9.1's expansion
  bullet, met and routed around by sending statements direct. The bullet stands.)
- **[MEASURED] VM git guard installed FIRST, before any VM-side call. Last line, verbatim:**
  `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
  preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
  mounted cwd, allows everything else (three controls passed)`. PASS. **No VM-side `git` ran against
  the Windows `.git` at any point in this run;** every `git` below ran in PowerShell on the host.
- **[MEASURED] All three binding documents read in full, and proved current by the sound form —
  not by a version match and not by a piped hash.** Run in the **dev tree**:
  `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
  docs/pipeline/stations/03-machine-minder.md` → **EMPTY**, which is the real answer (§9.1). So the
  working copies are byte-identical to `origin/main` and reading them was sound. DOCTRINE.md 2588
  lines, STATION-CAPABILITIES.md 545 lines, station doc 349 lines.
- **[MEASURED] Sweep.** `scripts\pipeline\status-sweep.ps1 *> <file>`, **exit 10**. Capture confirmed
  **UTF-16LE** (`bom_utf16le=true bytes_in=153426`) and decoded `utf16le` in node before reading —
  §9.3's `*>` trap, met and handled. 910 lines, 10 sections.
  **§7 VERDICT: `CAUTION: 2 LIVE STATION WORKTREE(s) detected … A station may be mid-run.`**
  (`C:/po-worktrees/s05-reconcile-20260921`, `C:/po-wt/00-board-20260921`.)
  ⚠️ **Re-measured 10 minutes later, both are GONE** (`Test-Path` → False on each): 05 and 00 both
  completed inside this run. A clean instance of §7's `[LIVE]` expiry rule — the verdict was true
  when printed and false when acted on.

### Locks — there are none, so no stale-lock arithmetic was needed

`index.lock` **ABSENT** in both trees (`Test-Path`, 00:26Z), and independently sweep §3
`git index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`.
`MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `sequencer` → **all
False in both trees.** No byte-size/age cross-check was required because no lock exists.

### The watcher chain is ALIVE, and the sanctioned probe says so

| | value | [MEASURED] |
|---|---|---|
| watcher node | **pid 9744**, created `2026-09-20T21:14:06Z`, `…\pr-watcher\index.mjs` | `Get-CimInstance Win32_Process` filtered by **command line**, never by image name |
| wrapper | **pid 30116**, created `2026-09-20T21:14:02Z`, `-File "C:\po-watcher\watcher-launcher-singlelane.ps1"` | count = **1** |
| `.watcher.lock` | `9744` | matches the live node |
| keepalive | `PO Watcher Keepalive` **State Ready**, `LastTaskResult 0`, `NumberOfMissedRuns 0`, next run 2 min out | `Get-ScheduledTask` / `Get-ScheduledTaskInfo` |
| sanctioned liveness probe | `restart-watcher-if-wedged.ps1` (no `-Fix` — its own header says *"SAFE BY DEFAULT: reports only"*), **exit 0**: `VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.` `restart churn: 0 cycle(s) in 20 min (starts=0 exits=0, threshold 4)` | |

**The rescan loop is NOT frozen and NOT paused — the authoritative probe, sampled twice more than
five minutes apart.** `.queue-state.json` `ts`: `2026-09-21T00:29:07.581Z` → `2026-09-21T00:34:07.929Z`,
a delta of one `RESCAN_INTERVAL_MS`. Its home is
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json` (found by search, not by
assuming a path — it is **not** at either repo root, where the obvious guess puts it).

**Armed = 0, measured at TOP LEVEL ONLY** per this station's own rule:
`Get-ChildItem docs\pr-prompts -Filter '*-ready.md' -File` → **0**. The watcher was mid-build on
`rev-2019-ready.md` at 00:31Z (heartbeat `elapsed=240s`), which is an auto-generated **REVIEW JOB,
not a prompt** (§9.5) — `.queue-state.json` `armed:1` at 00:29Z and `armed:0` at 00:34Z is that job
entering and leaving, and the restarter agrees at `armed prompts waiting: 0`.

**Kill sentinels.** `C:\po-watcher\STOP-WATCHER-LANE2` **present** (1090 B) — by design since
2026-08-15, not drift and not a stop signal. `C:\po-watcher\STOP-WATCHER` **absent**.

### Clone drift — 2 behind, and NEITHER commit touches the watcher, so no restart is owed

| probe | result |
|---|---|
| clone HEAD | `895bdefc` (branch `main`) |
| `git -C <clone> rev-list --left-right --count HEAD...origin/main` (clone's own ref, pinned at launch) | `0  1` |
| `git -C <dev> rev-list --count 895bdefc..origin/main` against the LIVE `64abcdcd` | **2** |
| `git -C <dev> diff --name-only 895bdefc..origin/main` filtered for `scripts/pr-watcher\|scripts/pipeline` | **no output** — all 7 paths are under `docs/pr-prompts/` |
| clone dirty, sweep's form (`git status --short`) | **1** |
| clone dirty, what `start-watcher.ps1` actually counts (`--porcelain --untracked-files=no`) | **0** |
| clone stashes | **77** |

So the clone is behind, and *"a restart adopts nothing"* does not apply: there is no watcher code on
`main` that the running node lacks. **The one dirty entry is `?? scripts/pr-watcher/.conflict-notified-prs.json`**
— the watcher's own state file, untracked by design. That is §9.5's documented false warning, and
Station 04 filed the class-widening for it today (its F3); **I am not re-filing it.** The stash count
is the documented closed loop: **77**, against **71** recorded 2026-09-10 — reported as growth, per
§9.2, and never `pop`.

### The outage — and this is where the account on file is wrong

Station 04 measured the Cowork side at 00:04Z today and filed F1 (`#2018`). I measured the **host**
side, which 04 did not, and the two do not compose into one 76-hour story.

| [MEASURED] | UTC | local (Brisbane, UTC+10) |
|---|---|---|
| last station session before the gap | 2026-09-17T20:05:26Z | Fri 06:05 |
| last watcher output from node 33388 | `[2026-09-18T05:48:14.179Z] [review] verdict-archive sweep` | Fri 15:48 |
| last `ensure-watcher.log` row before the gap | 2026-09-18T05:45:03Z | Fri 15:45 |
| last launcher line in `2026-09-18.log` | 2026-09-18T05:51:19Z `SINGLE-INSTANCE: watcher already running (PID 33388)` | Fri 15:51 |
| **`User32` event 1074** | **2026-09-18T05:52:41Z** | **Fri 15:52** |
| `Kernel-Power` 42 "entering sleep" / 107 "resumed" | 2026-09-18T05:52:54Z / 05:52:56Z | Fri 15:52 |
| **System-log events in `2026-09-18T06:00Z … 2026-09-20T21:00Z`** | **ZERO** | — |
| `Kernel-General` 1 + `EventLog` 6013 + **`Kernel-Boot` 27 "The boot type was 0x1"** | 2026-09-20T21:07:04–05Z | Mon 07:07 |
| new interactive `Win32_LogonSession` (LogonType 2) | 2026-09-20T21:07:07Z | Mon 07:07 |
| keepalive's first `RELAUNCHED` after the gap | 2026-09-20T21:07:26Z — **19 s after the logon** | Mon 07:07 |
| new watcher node 9744 | 2026-09-20T21:14:06Z | Mon 07:14 |
| Cowork stations resume | 2026-09-21T00:04:02Z | Mon 10:04 |
| `(Get-CimInstance Win32_OperatingSystem).LastBootUpTime`, read **today, after the resume** | **2026-09-15T13:32:45Z** | — |

Event 1074, quoted verbatim: *"The process
`C:\Windows\SystemApps\Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy\StartMenuExperienceHost.exe`
(LAPTOP-E6NHU4E4) has initiated the **power off** of computer LAPTOP-E6NHU4E4 on behalf of user
LAPTOP-E6NHU4E4\Marco for the following reason: Other (Unplanned) Reason Code: 0x0 **Shut-down Type:
power off**"* — i.e. a person used Start ▸ Shut down.

**POSITIVE control on the event-log query, which is what makes the zero mean something:** the same
`Get-WinEvent -FilterHashtable @{LogName='System'; …}` over the 5 h 50 m immediately before the hole
(`2026-09-18T00:00Z … 05:50Z`) returned **141** events. The gap query returned *"No events were
found"*. The instrument works; the world was empty.

**`ensure-watcher.log` independently, per UTC day:** 09-17 → 161 rows / 17 RELAUNCHED · 09-18 → 56 / 21 ·
**09-19 → 0 / 0** · **09-20 → 19 / 2, all at or after 21:07Z** · 09-21 → 4 / 0. Largest inter-row gap
across 3331 rows: **3802.4 min (63.4 h), `2026-09-18T05:45:03Z → 2026-09-20T21:07:26Z`.** And the
watcher's daily clone logs, found by **name shape then mtime** (never constructed from a date, §9.5):
`2026-09-16.log`, `2026-09-18.log`, `2026-09-21.log` — **no `2026-09-19` and no `2026-09-20` file at
all**, because no launcher ran on either day.

### Scheduled state, read ONLY from the scheduled-tasks MCP

| task | cron | enabled | lastRunAt |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | true | 2026-09-21T00:25:35Z |
| `03-machine-minder` | `0 9 * * *` | true | 2026-09-21T00:20:35Z (**this run**) |
| `04-scanner` | `0 */4 * * *` | true | 2026-09-21T00:04:02Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-09-21T00:04:02Z |
| `weekly-security-audit` | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z |

Live enabled count is **four**. `00-supervisor` reads `enabled: true` — **my 09-16 F2 (00 disabled
42 h) and 09-16 F3 (the `needs-marco/` banner declaring that outage REFUTED) are both SPENT by their
own stated falsifying probes**, and `#2018` merging at 00:22Z is the collect channel demonstrably
working again. My own cadence still reads DAILY (`0 9 * * *`) against a bootstrap that says "every
4 hours"; that disagreement is already open with Marco (STATION-CAPABILITIES §5) and is not re-filed.

### `failed/` — one new entry since my last run, and it is a review job

`failed/` total **55**. Entries newer than my previous breadcrumb (`2026-09-16T23:02Z`): **three
files, one failure** — `rev-2016-ready.md` (2026-09-17T19:27:53Z) with its `.log` and `.report.md`
(both 2026-09-18T05:43:14Z). `rev-<n>-ready.md` are **auto-generated REVIEW JOBS, not prompts**
(§9.5): they have no front matter by design, they are excluded from prompt audits, and a review job
that quarantined is not a code failure to write a `rev-` fix prompt for. Its `.log` timestamp
(05:43:14Z) sits **five minutes before the power-off** and inside the window in which the watcher
node was about to disappear, so the available reading — *a review job died with the machine* — is a
lead, not a diagnosis. **No fix prompt was staged and none is due.** Nothing is limit-parked, so
there is no `## Parked` section.

## WHAT CHANGED

**Nothing on the board, in either git tree, in any worktree, or in any scheduled task.** No prompt
armed, disarmed, renamed, moved or deleted; no PR opened or merged; no label touched; no worktree
pruned; no process started, killed or restarted; no lock cleared (there was none); no `/sot/` edit;
no Azure / Entra / SharePoint contact; no production data written.

Three writes, all outside the board:

1. `vm-git-guard` shim at `/sessions/<id>/.local/bin/git` inside the Linux VM — idempotent,
   re-verified byte-identical on re-run. It **constrains** this run rather than enabling it.
2. Scratch captures in `C:\po-sup-fix-scripts\` (the sanctioned scratch location):
   `sweep-2026-09-21-0021.txt` + `.utf8.txt`, `wedged-2026-09-21-0033.txt` + `.utf8.txt`, and
   `conv-utf16.js` (a 9-line UTF-16LE→UTF-8 converter, written because §9.3 forbids reading a `*>`
   capture as UTF-8 and forbids `Set-Content` for doc content).
3. This breadcrumb, in the **dev tree** at `docs/pr-prompts/` — a tracked directory, not one of the
   five gitignored sinks under `.gitignore`'s `# Overnight-QA scheduled task` comment, and not a
   disposable worktree. ⚠️ **It is UNTRACKED until a board PR commits it.** Station 00 ran at
   00:25:35Z and is collecting again, so it should be swept on 00's next pass.

## FINDINGS

### F1 — [S1] 63.3 of the 76-hour outage was the box POWERED OFF, `LastBootUpTime` is structurally blind to it, and the detector option now on file would have missed those 63 hours by construction

**The claim being corrected.** Station 04's F1, merged as `#2018`, records: *"The host did not reboot
(`LastBootUpTime` 2026-09-15T13:32:45Z, i.e. up throughout) … So this was neither a power event nor a
watcher death. The surviving location is the **Cowork scheduled-task layer**"*, and its option 1
nominates *"the watcher, which was demonstrably alive and logging throughout"* as the natural host
for an out-of-band detector. **Both the premise and the option's premise are refuted.**

**[MEASURED]** 2026-09-21T00:3xZ at `64abcdcd`, from the Windows event log with a positive control
(table above, reproduced in one line each):

- `User32` **1074** at **2026-09-18T05:52:41Z**: a **power off** initiated from the Start menu.
- **ZERO** System-log events in `2026-09-18T06:00Z … 2026-09-20T21:00Z` (**63.0 h**), against a
  **POSITIVE control of 141** events in the 5 h 50 m immediately before. The machine was not running.
- `Microsoft-Windows-Kernel-Boot` **Id 27, "The boot type was 0x1"** at **2026-09-20T21:07:05Z**.
  Boot type `0x1` is a **hibernation resume (Fast Startup)**, not a cold boot (`0x0`).
- `LastBootUpTime`, read **after** that resume, is still **2026-09-15T13:32:45Z**.

**The mechanism, and it is a §7 instrument lie of the purest kind.** With Fast Startup enabled,
"Shut down" hibernates the kernel session; power-on restores it, and
`Win32_OperatingSystem.LastBootUpTime` is **never updated**. So the field returns a well-formed
timestamp that was never measuring what its reader thinks: it answers *"when was this kernel session
first started"*, not *"has this machine been running since then"*. Nothing is empty and nothing
warns, so §9.6 cannot fire. Every reading taken from it during this incident was in the dangerous
direction — *the box was up, so look in the software* — and it is the single load-bearing premise of
the escalation now on the board.

**So there are TWO outages, with different causes and different answers.**

| | window (UTC) | local | duration | machine | cause |
|---|---|---|---|---|---|
| **A — app layer** | 2026-09-17T20:05:26Z → 2026-09-21T00:04:02Z | Fri 06:05 → Mon 10:04 | 76.0 h | **alive for the first 9.8 h**, then off, then alive again for 2.95 h before recovery | Cowork scheduled-task layer. **[CANNOT MEASURE]** from a station — Station 04's reading stands for this window |
| **B — host off** | 2026-09-18T05:52:41Z → 2026-09-20T21:07:05Z | Fri 15:52 → Mon 07:07 | **63.3 h** | **OFF** | an operator power-off, hidden by Fast Startup |

The two are not the same event and B is not a consequence of A: the keepalive logged 21 `RELAUNCHED`
rows and the watcher wrote `[review]` lines for **9.8 hours after** A began, which is how I know the
machine was alive in that window. And recovery is split too: the keepalive resumed **19 seconds**
after the Monday logon, while Cowork's stations took a further **2.95 hours** — **[CANNOT MEASURE]**
why, though the desktop app being launched later than the logon is the obvious unproved candidate.

**Why this is worth Marco's attention rather than a footnote: it changes which fix is correct.**

**RULE 1, on the options — complete-and-additive first.**

1. **An OFF-BOX watcher — something not on LAPTOP-E6NHU4E4 that alarms when this machine stops
   reporting (passes both halves).** *Complete*: it is the only option that covers **both** windows,
   because window B is the machine being switched off and no process on it can observe that. The
   cheapest concrete form is a dead-man's-switch: the keepalive (which already runs every 10 min and
   already writes a log) pings a free external monitor, and the monitor alerts Marco when a ping is
   missed for N minutes. *Additive*: it adds one outbound call to an existing task, changes no
   station's behaviour, mutates no data, and cannot itself stop the board. **Passes both halves.**
2. **An in-machine detector outside Cowork — e.g. hosted in the watcher or the keepalive, which is
   04's option 1.** *Additive*, and genuinely useful: it would have caught **window A's first 9.8
   hours**, which is the half a station can actually reach. **Fails *complete*:** for 63.3 of the 76
   hours the host was off, so the detector would have been off with it and would have produced
   exactly the artefact this incident already produced — nothing. ⚠️ **This is the option on file,
   and it is on file with a premise I have just refuted;** it should be adopted as a *partial*
   measure with that scope stated, not as the answer.
3. **Do nothing — the scheduler recovered on its own.** *Additive*. **Fails *complete*:** the cause
   of window A is still unknown, window B will recur the next time the laptop is shut for a weekend,
   and the only reason anybody knows about either is that a station happened to run
   `check-breadcrumb.mjs --freshness` three days late.

⚠️ **Falsifying probe, and it is three lines.** (i) `Get-WinEvent` the System log across any suspected
gap and compare the count against a window you know was live; (ii) read `Kernel-Boot` Id 27 at the
resume — `0x1` means Fast Startup hibernation and `LastBootUpTime` is not evidence, `0x0` means a
real cold boot and it is; (iii) read `LastBootUpTime` after the resume and check whether it moved.
**If a 63-hour System-log hole ever coexists with an unchanged `LastBootUpTime` and a boot type of
`0x0`, this finding is wrong and must be re-measured.**

⚠️ **Related, and this is now the third occurrence of the class, not the first.** My own two prior
breadcrumbs name it: `00-03-machine-minder-2026-09-15-2303-a-plain-logoff-killed-the-watcher-for-nine-hours-and-the-open-escalation-only-covers-reboots.md`
and `00-03-machine-minder-2026-09-09-2301-a-logon-gated-keepalive-cost-the-watcher-eight-hours…`.
The title of the first one is the whole lesson: **the open escalation only covers reboots**, and a
Fast-Startup power-off is not a reboot by any instrument on this box.

**DISPOSITION: DISPATCHED** → **Station 00**. It owns the collect channel and `needs-marco/`
annotation, it merged `#2018` carrying the refuted premise, and the escalation to Marco already
exists — what it needs is this measurement folded in and its option set corrected, not a second
escalation racing the first. The three options above are written to be handed to Marco intact.

### F2 — [S2] The duplicate-watchdog condition I escalated on 09-16 is absent today only because the box was power-cycled; `ensure-watcher.ps1` still has no wrapper-level guard

**Re-read rule applied to my own artifact, and the central claim has shifted in a way that could be
misread as a fix.** My 2026-09-16 F1 recorded two `watcher-launcher-singlelane.ps1` wrappers holding
`Stop-Process -Force` over one node, reported by the sweep as `auto-restart wrapper: alive (2)`.

**[MEASURED]** 2026-09-21T00:3xZ: wrapper count is **1** (pid 30116, created 2026-09-20T21:14:02Z),
and the sweep prints `auto-restart wrapper: alive (1)`.

🔴 **But nothing was fixed.** `ensure-watcher.ps1` §2 (anchor: the comment
`# --- 2. Is the watcher already alive? ---`) still reads
`$alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | …)` followed by
`if ($alive.Count -ge 1) { … exit 0 }`. A `Select-String` for `watcher-launcher` in that file returns
**two** hits and both are the `$Launcher =` assignment (anchor: `$Launcher  =`) and a comment — **no
test for an existing wrapper process anywhere.** So option (a) of my 09-16 F1 has **not** landed, and
the duplicate is absent for one reason only: the 63-hour power-off destroyed every wrapper and
exactly one was recreated on Monday.

**Why that distinction is the finding.** A run that reads `alive (1)` and stops there records the
condition as resolved, and the standing escalation gets closed on the strength of a power cycle. The
mechanism is unchanged: the keepalive stands down on a live **node**, the launcher is a bare
`while (-not (Test-Path $stopSentinel))` loop with no mutex or PID file, and `ensure-watcher.log` now
holds **75** `RELAUNCHED` events (against **35** on 09-16) — so node-down windows, the precise
trigger, are not rare. The hazard remains **latent** rather than active only because armed is 0.

⚠️ **Falsifying probe:** count `powershell.exe` processes whose command line matches
`watcher-launcher`, and `Select-String` `ensure-watcher.ps1` for a test against a **wrapper**
process. **If §2 ever tests for a wrapper as well as a node, option (a) has landed and this finding
is spent.** The `RELAUNCHED` count is STATE — re-measure it, never quote it.

**DISPOSITION: ESCALATED** — Marco, on the **existing** 09-16 F1 question, not a new one. Two of the
three files involved (`ensure-watcher.ps1`, `watcher-launcher-singlelane.ps1`) live in
`C:\po-watcher\` outside this repo and are his to place; the `status-sweep.ps1` half (report a
wrapper count > 1 as a defect rather than as aliveness) is a `scripts/` change a station must PR.

### F3 — [S3] The registry escapee `C:\po-worktrees\po-fix-2005` is confirmed dead and safe to prune — and the obvious count of it returns 6079, which reads as the opposite

Sweep §2: `REGISTRY-ESCAPEE: C:\po-worktrees\po-fix-2005  size=0KB  age=4844min  .lock=False` and
`worktree-registry-escapees: 1 found -- Station 03 should review and prune if confirmed dead`.
That line is addressed to this station, so here is the review.

**[MEASURED]** 2026-09-21T00:2xZ:

| probe | result | reading |
|---|---|---|
| `Test-Path C:\po-worktrees\po-fix-2005\.git` | **False** | not a git worktree at all — no gitdir pointer |
| present in `git worktree list` for the dev tree | **no** (2 entries: the dev tree and `po-vg`) | not registered |
| present in `git worktree list` for the clone | **no** (1 entry: the clone itself) | not registered |
| top-level contents | `apps`, `node_modules`, `packages` | an install skeleton |
| `Get-ChildItem -Recurse -Force -File \| Measure-Object` | **0 files, 0 bytes** | holds no content |
| mtime | 2026-09-17T05:39:00Z (**80.9 h**) | predates the power-off |

**It is 6079 empty directories and nothing else** — a torn-down or failed `pnpm`/worktree setup that
left its folder tree behind. **The sweep's `size=0KB` is CORRECT and I am recording that explicitly
so the next run does not re-doubt it.**

⚠️ **The trap is in the obvious verification, and I walked into it.** My first probe,
`Get-ChildItem C:\po-worktrees\po-fix-2005 -Force -Recurse | Measure-Object`, returned **6079** —
because `Measure-Object` counts **entries**, directories included. Read against a sweep line saying
`size=0KB`, `6079` is a confident, coherent, wrong finding in the dangerous direction: *the sweep is
lying and this folder holds 6079 things somebody may need*. The discriminator is `-File`, and it
returns 0. **Count FILES, never entries, before calling a directory non-empty.**

⚠️ **Falsifying probe:** `Test-Path <dir>\.git`, `git worktree list` in both trees, and
`Get-ChildItem -Recurse -Force -File | Measure-Object`. **If a `.git` pointer appears, or the file
count is ever non-zero, it is not dead and must not be pruned.**

**DISPOSITION: DISPATCHED** → **Station 00**, for the prune. Station 03 is report-only
(STATION-CAPABILITIES §5: *Repair the machines — ⚠️ report-only*) and does not prune even when the
sweep addresses the line to it. There is no `git worktree remove` to run: it is an unregistered
directory, so the operation is a plain directory delete.

### F4 — [S3] The `po-vg` orphan worktree is still parked at 16.7 days over a file that is an earlier draft of work already on main; the supersession re-verified unchanged

Sweep §2: `orphaned worktree (aborted run leftover -- investigate/prune): C:/PR-Master/worktrees/po-vg
23c91ba9 [fix/no-rebase-while-checks-run]`, `dirty=1 files age=24029 min`, with the blocking warning
`<-- HOLDS UNCOMMITTED WORK (1 file(s)). PRESERVE OR COMMIT BEFORE PRUNING`.

**24,029 min = 16.7 days**, up from 12.6 days when I filed this on 09-16. The one file is
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`. **[MEASURED]** again this run rather than carried
forward, because the whole point of the preserve warning is that content might be unique:

| probe | result | 09-16 |
|---|---|---|
| `git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` | `84ec92d4720241431ca9e5d4ed53da5961e9a2fc` | same |
| `git -C <po-vg> hash-object <path>` | `9c4587fbf4e906fca096941f014de8ef4671ebee` | same |
| worktree file mtime | `2026-09-04T07:55:32Z` | same |
| `git log -1 --format=%cI origin/main -- <path>` | `2026-09-04T21:38:04Z` | same |

**The blobs differ, so "already rescued" is not established by path existence** — but main's copy was
committed **13.7 h after** the worktree copy was last written, and on 09-16 it measured strictly
larger with 95 differing lines including a block the worktree copy lacks entirely. **The worktree
holds an earlier draft of work that subsequently landed.** Nothing is lost by pruning it.

⚠️ **This file's identity is worth flagging to whoever reads F1.** It is
`check-pipeline-heartbeat.mjs` — an in-repo pipeline heartbeat checker, i.e. the closest thing this
repo already has to the detector F1 is about. Its landed version is on `main`; the orphan is the
draft. **Nobody should read the orphan as the missing detector.**

⚠️ **Falsifying probe:** the two blob reads and the date pair above. **If the worktree copy ever
proves newer than main's last commit for that path, or contains a symbol absent from main, it holds
real work and must be preserved.**

**DISPOSITION: DISPATCHED** → **Station 00**, for the prune, unchanged from 09-16. The two
`C:\PR-Master\worktrees` escapees I recorded on 09-16 (`s2afix`, `s3hex`) are **gone** — the sweep now
reports exactly one escapee, which is F3's.

### F5 — [S4] Two of the sweep's `[LIVE]` lines were true when printed and false nine minutes later, on the same run, and one of them is the watcher-health headline

Offered because §9.5 asks for its `[LIVE]`-expiry rule to be re-proved on real work rather than a
fixture, and this run produced two clean instances inside ten minutes.

| sweep line, 00:22:41Z | re-derived | at |
|---|---|---|
| `heartbeat age: 4610 min` (76.8 h) | heartbeat's newest tick `[2026-09-21T00:31:41.131Z] rev-2019-ready.md elapsed=240s` — **1 min old** | 00:32Z |
| `§7 CAUTION: 2 LIVE STATION WORKTREE(s)` | `Test-Path` → **False** on both paths; 05 and 00 had finished | 00:31Z |
| `armed (*-ready.md): 0` | `.queue-state.json` `armed:1` at 00:29Z, `armed:0` again at 00:34Z (a `rev-` review job, not a prompt) | 00:29–00:34Z |

Both sweep readings were **correct when taken** — the `rev-2019` build started at 00:27:41Z, five
minutes *after* the sweep. **Neither is a defect.** What they are is the measured cost of acting on a
sweep more than a few minutes old: a run that had reached for `restart-watcher-if-wedged.ps1 -Fix` on
the strength of `heartbeat age: 4610 min` would have killed a live build at `elapsed=240s`, which is
LL-25 exactly. I ran the restarter **without** `-Fix` and it returned `VERDICT: OK`.

**DISPOSITION: DEFERRED** — no action is correct today; the rule already exists and worked. It
becomes urgent the moment any run is caught quoting a sweep line older than its own action, which is
the condition §7's `[LIVE]` bullet was written for.

## WHAT I DID NOT DO

- **Did not repair anything.** Station 03 is report-only (STATION-CAPABILITIES §5). Specifically: did
  not prune `po-fix-2005` or `po-vg`, did not restart, relaunch, kill or otherwise touch the watcher
  node, wrapper or keepalive, and did not clear a lock (there was none).
- **Did not run `restart-watcher-if-wedged.ps1 -Fix`.** The no-`-Fix` form is the sanctioned
  report-only liveness probe by that script's own header, and a build was in flight at `elapsed=240s`
  when I measured — restarting on a stale heartbeat is the LL-25 failure (F5).
- **Did not arm, disarm, rename, move or delete any prompt**, and did not write anywhere under
  `docs/pr-prompts/` other than this breadcrumb. Armed was **0** at top level throughout.
- **Did not open or merge a PR.** Station 03's authority row is *Create a PR: ❌*, so this breadcrumb
  is untracked until 00 sweeps it.
- **Did not stage a `rev-` fix prompt for `failed/`'s one new entry.** `rev-2016-ready.md` is an
  auto-generated review job with no front matter by design (§9.5), not a code failure, and its cause
  is entangled with the power-off — a lead, not a diagnosis. AMBIGUOUS ⇒ stage nothing.
- **Did not commit `docs/pipeline/sweep-rotation.json`**, which Station 04 left dirty by instruction
  for 00. I committed nothing at all, so the shared dev-tree index was not touched. ⚠️ Noted for
  whoever does commit: `git status --porcelain` showed 38 entries from other actors at 00:21Z
  (` M docs/pipeline/sweep-rotation.json` plus ~24 untracked `docs/pr-reviews/pr-*.md`) — **use an
  explicit pathspec, never `git add -A`.**
- **Did not re-file the sweep's clone `dirty=1` warning as clone hygiene.** It is §9.5's documented
  false positive (re-derived to **0** with the tracked-only form in the same minute), Station 04
  filed the class-widening today, and re-filing it is the recorded mis-route — 13 verbatim
  quotations of that line already sit in `archive/`.
- **Did not re-file the 76-hour outage as a new escalation.** Station 04 filed it and 00 merged it as
  `#2018`; F1 corrects the evidence underneath it through the channel that owns it.
- **Did not re-file my 09-16 F2 or F3.** Both are spent by their own falsifying probes now that
  `00-supervisor` reads `enabled: true`.
- **Did not touch `/sot/`** — Station 05's, CP-24. Station 05 was mid-run in its own worktree while
  this run measured.
- **Did not touch Azure, Entra or SharePoint**, and ran no `az` or `Connect-MgGraph`. Absolute.
- **Did not write production data.**
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and its last line is quoted above.
- **Did not run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`** in
  the dev tree, and did not `pop` any of the clone's 77 stashes.
- **Did not point any §9 probe at §9 itself**, per §9.6's closing rule; each ran against the corpus
  its own bullet names.
- **Did not act on any `[LIVE]` line without re-deriving it from its own source** (F5), and did not
  construct a daily-log filename from a date (§9.5) — the log set was found by name shape, then mtime.
- **Did not write to any of the five gitignored `docs/qa/` sinks.**
