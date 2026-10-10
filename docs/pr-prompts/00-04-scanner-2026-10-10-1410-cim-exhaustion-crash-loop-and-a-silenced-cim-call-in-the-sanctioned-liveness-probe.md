# Station 04 — Scanner | 2026-10-10T14:10:34Z–2026-10-10T14:40Z

## GROUND

```
UTC            2026-10-10T14:10:34Z
origin/main    70991313            (fetch exit 0, then rev-parse)
dev tree       main @ 70991313     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version: 1 — MATCHES, run is not read-only-forced)
```

Sweep this run: **instrument-honesty** (rotation position 2 of 4, `node scripts/pipeline/next-sweep.mjs`;
previous run 2026-10-10T06:24:09Z). Fresh needle, minted this run:
`NEEDLE-04SCAN-20261010T1410Z-QX7F`.

🔴 **This run found a LIVE, SELF-AMPLIFYING machine incident (F1) while executing its assigned
instrument sweep. F1 is the reason to read this breadcrumb; the sweep results (F3–F6) are below it.**

---

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → `PROBE_OK`,
`2026-10-10T14:10:34Z`. **NOT blind.** All reads below are Desktop Commander on the Windows host.

**Git guard.** [CANNOT MEASURE] The bootstrap's `bash "$HOME/mnt/.../vm-git-guard.sh"` could not be
run: the VM-side bash transport failed on four consecutive attempts —
`request timed out after 30s` (×2) and `RPC error -1: process with name
"modest-admiring-ramanujan" already running` (×2). No installer last line and no exit code exist to
quote. Per the station contract this is **a finding, not a stop** (F6). Mitigation taken: I issued
**zero** VM-side calls for the rest of the run; every `git` call was host-side through Desktop
Commander, and none was an index-writing command.

**Binding documents.** Read from `git show origin/main:<path>` in the dev tree, never the working
copy: `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md` (508 lines, core, in
full), `docs/pipeline/STATION-CAPABILITIES.md`. [MEASURED] `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md` → **EMPTY** (not different), and `git rev-parse
origin/main:docs/pipeline/DOCTRINE.md` = `git hash-object docs/pipeline/DOCTRINE.md` =
`5b71fe520c7deda5133a87c14a0efad627f05638`.

**Board, from `scripts/pipeline/status-sweep.ps1`** (started 14:17:06Z). [MEASURED] instrument
positive controls both passed (`gh` saw merged #2306; `node` runs). 2 open PRs, both BEHIND, both RED,
both `do-not-merge`: **#2303** (11 pass / 4 fail) and **#2294** (13 pass / 2 fail), oldest open 18 h.
`main` CI on `70991313`: 4 success / 0 failed — **trunk green**. Queue: 0 armed prompts.

🔴 **The sweep never printed its SAFE / CAUTION / DO-NOT-ACT verdict.** [MEASURED] it ran
**947 s** and was still inside section 3 when I stopped reading; it had emitted 176 of its sections'
lines and then stalled on the very `Get-CimInstance` call F1 is about. **So this run carries NO
safe-to-act verdict** — which is consistent with my lane (read-only, no board mutation) and is
recorded so nobody reads its absence as a clearance. The slow-section-5 crawl is exactly what open
PR **#2294** exists to fix.

**Board trap (clean).** [MEASURED] `git ls-tree --name-only origin/main -- docs/pr-prompts/` filtered
to `*-ready.md` → **0** tracked armed prompts at depth 1. POSITIVE control, same glob for `*-HOLD.md`
→ **16**. On disk (where `git status` is structurally blind to them), `*-ready.md` at depth 1 → **0**.
**No board trap this run.**

**Negative control, everywhere.** [MEASURED] the minted needle scored **0** in `DOCTRINE.md`,
`DOCTRINE-REFERENCE.md`, `STATION-CAPABILITIES.md`, `04-scanner.md` and across **58** tracked `.ps1`
files. POSITIVE control for the same instrument on the same corpus (`"DOCTRINE"`): 28 / 17 / 10 hits.
The grep instrument can produce a positive; its zeroes are real zeroes.

---

## WHAT CHANGED

**Nothing on the board.** No PR opened, no prompt armed, disarmed, renamed, moved or deleted, no
label touched, no merge, no `/sot/` edit, no production or tenant state, no process killed, no
worktree pruned.

Two writes, both outside the repo or explicitly sanctioned:

1. Four probe scripts in the sanctioned scratch folder `C:\po-sup-fix-scripts\`
   (`st04-instrument-honesty-`, `st04-sweepbrief-drift-`, `st04-grep-selfcheck-`,
   `st04-cim-controls-`, `st04-proc-storm-2026-10-10.ps1`). Outside the repo; nothing to commit.
2. `docs/pipeline/sweep-rotation.json` advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-10T14:10:34Z`, and **LEFT DIRTY in
   the dev tree** — Station 00 commits it, because Station 04 may not (authority matrix: *Create a
   PR: NO*, *Mutate the board: NO, read-only*, and the dev tree is on `main`).

**This breadcrumb is UNTRACKED in the dev tree at `docs/pr-prompts/`.** 🔴 **Station 00: it and
`sweep-rotation.json` both block the next `git merge --ff-only` until committed** — that is the
documented cost of the only home available to a read-only station, and it is named here so it is
swept rather than discovered.

---

## FINDINGS

### F1 — 🔴 S1 · THE WATCHER IS IN A SELF-AMPLIFYING CRASH LOOP DRIVEN BY SYSTEM THREAD EXHAUSTION. THE REMEDY IS DESTRUCTIVE, SO IT IS MARCO'S.

[MEASURED] 2026-10-10T14:34:21Z at `70991313`, via `Get-Process` (deliberately **not** CIM/WMI,
which is the failing subsystem):

```
total_processes = 2019
  conhost    = 838
  powershell = 834
  svchost    = 102
  claude     = 15
  node       = 11
powershell_workingset_total_MB = 31648.4      (~31.6 GB)
powershell_handles_total       = 431698
oldest powershell = 2026-10-08T07:28:39  pid 2068
newest powershell = 2026-10-11T00:34:21  pid 104856   (i.e. still accumulating, this minute)
```

Accumulation by start hour, local (Brisbane, UTC+10) — continuous, not a single burst:

```
2026-10-08 07h    2        2026-10-10 17h   40
2026-10-10 11h  111        2026-10-10 18h   42
2026-10-10 12h  109        2026-10-10 19h   75
2026-10-10 13h  136        2026-10-10 20h   43
2026-10-10 14h   76        2026-10-10 21h   24
2026-10-10 15h   91        2026-10-10 22h   24
2026-10-10 16h   44        2026-10-11 00h   16
```

[MEASURED] the loop, from `supervisor.log` **CONTENT** (17,908 lines; read with
`FileShare.ReadWrite` because the file is locked against `Get-Content` — and per
STATION-CAPABILITIES, timestamps are taken from content, never from a mount `stat`):

```
[2026-10-11T00:26:07+10:00] Watcher exited with failure (exit 1). REASON: HRESULT 0x80070005 ...GetCimInstanceCommand
[2026-10-11T00:26:11+10:00] Watcher exited with failure (exit 1). REASON: HRESULT 0x800700a4 ...GetCimInstanceCommand
[2026-10-11T00:26:11+10:00] Watcher exited with failure (exit 1). REASON: HRESULT 0x800706be ...GetCimInstanceCommand
[2026-10-11T00:32:52+10:00] Watcher exited with failure (exit 1). REASON: HRESULT 0x8004100a ...GetCimInstanceCommand
```

**`0x800700a4` is `ERROR_MAX_THRDS_REACHED` — "no more threads can be created in the system."**
That names the cause rather than suggesting it. The other three are its companions:
`0x800706be` RPC failed, `0x8004100a` WMI critical error, `0x80070005` access denied.

**The loop, each step measured:**

1. ~1,670 `powershell` + `conhost` processes with 431,698 handles exhaust system thread/handle
   capacity.
2. `Get-CimInstance Win32_Process` in the watcher path therefore fails — `0x800700a4` says so
   literally.
3. The watcher exits 1 → the supervisor logs `Restarting in 60 s`.
4. **Each restart spawns more `powershell` wrappers, watchdogs and `conhost` hosts** → step 1 worsens.

Two independent multipliers are also measured, and both are in the log:

- **Concurrent supervisors.** Six `Watcher exited` / `Restarting in 60 s` / `Identical consecutive
  failures: 1 of 5` lines land inside **0.5 s** at `00:26:12`, from different supervisors. Each
  counts its *own* "identical failures: 1 of 5", so **the max-identical-failures=5 circuit breaker
  never trips** — five supervisors each reaching 1 is not one supervisor reaching 5. The breaker is
  defeated by the plurality it is supposed to stop. `status-sweep` independently reported
  `WRAPPER_COUNT_ANOMALY_V1 — 8 wrappers alive (expected 1)`, started 10-08 07:28, 10-10 11:35,
  18:30, 18:36, 20:35, 21:53, 22:25, 22:44 local.
- **Duplicate watchdogs.** `WATCHDOG[pid=72196] started` at `00:21:57.05` and
  `WATCHDOG[pid=80452] started` at `00:21:58.50` — two armed 1.4 s apart against the same heartbeat.

**The watcher node itself is UP, not down.** [MEASURED] `Get-Process -Name node` → pid **16148**,
started 2026-10-10 12:20:12 local, still alive at 14:33Z; `status-sweep` at 14:17Z independently read
`[LIVE] watcher node: RUNNING pid 16148`. **So this is a supervisor/wrapper storm around a live node,
not a dead watcher** — and F2 is why the sanctioned probe says otherwise.

⚠️ **CIM is now effectively dead on this box, which degrades the pipeline's own instruments.**
[MEASURED] a *single-pid* scoped query, `Get-CimInstance Win32_Process -Filter "ProcessId=16148"
-OperationTimeoutSec 20` → **`SCOPED_CIM_FAILED: Timed out`**. A bogus-class query hung for **296 s**
before I terminated it. `status-sweep.ps1` reads the watcher through CIM at line 263 and the
safe-to-act gate through CIM at line 541, so **the next Station 00 run should expect its sweep to
fail, stall, or — worse, see F2 — return a confident zero.**

🟡 **INDEPENDENT CORROBORATION, from another station, with no knowledge of this one.** [MEASURED]
from `node scripts/pipeline/check-breadcrumb.mjs` at 14:40Z, the breadcrumb census for today:

```
00-00-supervisor-2026-10-10-0000-blind-no-shell.md
00-00-supervisor-2026-10-10-0716-blind-desktop-commander-connect-timeout.md
00-00-supervisor-2026-10-10-0815-blind-second-consecutive-desktop-commander-connect-timeout.md
00-00-supervisor-2026-10-10-0915-blind-third-consecutive-desktop-commander-connect-timeout.md
00-00-supervisor-2026-10-10-1114-blind-fourth-consecutive-and-the-vm-mount-is-gone-too-...
```

**Five Station 00 runs today reported themselves BLIND**, four consecutively, the last one also
losing the VM mount. Station 00's blindness has been treated as an unexplained intermittent
(STATION-CAPABILITIES §2: *"roughly 40% of Station 00's recent runs… its cause is NOT known"*).
⚠️ **F1 is a candidate cause for today's cluster, and I am flagging it as a hypothesis, not a
finding:** a box at 2,019 processes with 431,698 handles and `ERROR_MAX_THRDS_REACHED` in its logs is
a box that cannot reliably start a new Desktop Commander shell, and `CONNECT_TIMEOUT` is exactly what
thread exhaustion looks like from the far side. **It does not explain blindness on days when the box
was healthy**, so it is not the general cause. Falsifying probe: re-measure the process census the
next time Station 00 reports `CONNECT_TIMEOUT`; if the count is normal, today's correlation is
coincidence.

⚠️ **Consequence either way: 7 of the 8 breadcrumbs on disk are UNTRACKED**, because the station that
commits them (00) has been blind for most of the day. **The reporting chain's only closing channel is
backed up** — this breadcrumb joins a queue of seven, mine included.

🚫 **RULE 1 options for Marco. The remedy is killing ~1,670 processes or rebooting: destructive, and
DOCTRINE §5.4. I did not do it and no agent should.**

- **OPTION A (complete + additive — RECOMMENDED).** Marco stops the *supervisor plurality* first,
  then clears the backlog: (1) kill the 8 wrapper `powershell` processes by PID so nothing relaunches
  (pids from `status-sweep` §2, re-measured at the keyboard), (2) kill the orphaned
  `powershell`/`conhost` pairs, (3) **then** start exactly one supervisor. Passes both halves: it
  solves it now *and* leaves the single-supervisor invariant restored, and it touches no repository
  data, no queue file and no database. **Prerequisite, and the reason it is additive:** the queue
  holds **0 armed prompts** and `main` is **green** at `70991313`, so nothing is mid-build to lose.
- **OPTION B (reboot).** Simplest and certain to clear thread exhaustion. **Fails the "future" half**
  — it leaves the plurality bug and the defeated circuit breaker in place, so the storm recurs on the
  next trigger. Acceptable only as a stopgap *with* Option A's supervisor fix to follow.
- **OPTION C (do nothing / let it drain).** **Fails both halves.** The newest `powershell` started
  the minute I measured; accumulation has run ~14 h with no plateau. It is still growing.

**Whichever he picks, the durable fix is the plurality and the per-supervisor failure counter** —
`max-identical-failures=5` must be evaluated across supervisors, or the supervisor must refuse to
start when another is alive. That is a code change in `scripts/pr-watcher/supervise-watcher.ps1`,
which is **not Station 04's to write** and not something to stage blind against a box whose
instruments are failing.

**DISPOSITION: ESCALATED** — the remedy is destructive (DOCTRINE §5.4, Marco's), and the durable fix
is a watcher-internals change in Station 03's / Station 00's lane. Station 03 should additionally
treat the 8 wrappers, the duplicate watchdogs, the 33 non-main worktrees and the 3 registry escapees
(`C:\PR-Master\worktrees\bootstrap-check`, `C:\PR-Master\worktrees\sweep-section5`,
`C:\po-wt\dispatch-register-v1`, all 0 KB, `.lock=False`) as one job.

---

### F2 — 🔴 S2 · THE ONLY SANCTIONED LIVENESS PROBE SILENCES ITS CIM ERRORS, SO A FAILED CALL READS AS "WATCHER NOT RUNNING". MEASURED FIRING, TODAY, ON LIVE DATA.

DOCTRINE §7 standing guard 4 makes `scripts/restart-watcher-if-wedged.ps1` the **only** sanctioned
liveness check, and standing guard 2 says *"Connect, then assert … never let a failed call flow into
a comparison."* [MEASURED] from `origin/main`, that script does the opposite:

```powershell
# scripts/restart-watcher-if-wedged.ps1:56-59
function Get-WatcherProcess {
    return Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandLine -like "*pr-watcher*" }
}
# :221-222
$proc  = Get-WatcherProcess
$alive = ($null -ne $proc)
```

**`-ErrorAction SilentlyContinue` makes a failed CIM call return `$null`, which is byte-identical to
"the process is absent".** [MEASURED] all **3** of that script's `Get-CimInstance` calls are silenced
(3 of 3) — the highest ratio of any `.ps1` on `origin/main`.

**It fired. This run. On a live watcher.** [MEASURED] at 14:25Z, report-only (no `-Fix`):

```
watcher process:       *** NOT RUNNING ***
restart churn:         10 cycle(s) in 20 min  (starts=4 exits=10, threshold 4)
VERDICT: CHURNING - 10 watcher restarts in the last 20 min.
rwiw_exit=3
```

…while node pid **16148** was alive at 14:17Z (`status-sweep`, CIM, *un*silenced, succeeded) and
still alive at 14:33Z (`Get-Process`). **The `*** NOT RUNNING ***` is a false negative produced by
the silenced CIM call, not a reading of the machine.** The churn line beside it is sound — it comes
from `supervisor.log` content, a different instrument, and F1 corroborates it.

**POSITIVE / NEGATIVE controls, as §7 requires:**

```
failed_call_count    = 0      (Get-CimInstance -ClassName <bogus> -ErrorAction SilentlyContinue)
genuine_absent_count = 0      (Get-CimInstance Win32_Process -Filter "Name='no_such_proc_qx7f.exe'")
```

Both read 0. **Nothing in the value distinguishes a broken instrument from an empty world** —
DOCTRINE §9.6, inside the one script every station is told to trust before touching the machine.
The positive control for the probe as a whole is F1's `Get-Process` reading: the watcher *is* there
to be found, and the script did not find it.

**Why this is S2 and not S4.** `$alive = $false` drives the DOWN verdict, and with `-Fix` that path
kills and relaunches. **Restarting a healthy watcher during a thread-exhaustion storm adds fuel to
F1's loop** — and "declared a healthy watcher dead and killed the queue" is one of the two named
near-disasters in DOCTRINE §7's own preamble. Today the CHURNING branch happens to pre-empt the DOWN
branch and halts instead of restarting; **that is ordering luck, not a guard.** Remove the churn, and
the same false negative restarts a live watcher.

**Blast radius** [MEASURED] across 58 tracked `.ps1` on `origin/main` (`cim=` total, `silenced=`
with `-ErrorAction SilentlyContinue`):

```
scripts/restart-watcher-if-wedged.ps1     cim=3 silenced=3   <-- the sanctioned liveness probe
scripts/pr-watcher/supervise-watcher.ps1  cim=5 silenced=2   <-- the thing that is churning in F1
scripts/pipeline/status-sweep.ps1         cim=4 silenced=1   <-- line 541, the safe-to-act gate
scripts/pipeline/monitor-board.ps1        cim=1 silenced=1
scripts/pipeline/arm-prompt.ps1           cim=2 silenced=0
scripts/pipeline/preflight.ps1            cim=2 silenced=0
scripts/pipeline/find-watcher.ps1         cim=1 silenced=0
scripts/pr-watcher/start-watcher.ps1      cim=1 silenced=0
scripts/pr-watcher/start-nightly.ps1      cim=1 silenced=0
```

**`status-sweep.ps1:541` is the second-worst of these and it gates board mutation:**

```powershell
$gitProcAll = @(Get-CimInstance Win32_Process -Filter "Name='git.exe'" -ErrorAction SilentlyContinue)
$gitProc    = @($gitProcAll | Where-Object { ... })
$boardBusy  = $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)
Line "LIVE" ("git processes touching our trees (scoped): " + $gitProc.Count + "  (this is what feeds the safe-to-act gate)")
```

A CIM failure yields `@()` → `.Count = 0` → that term contributes nothing → `$boardBusy` silently
degrades to the `index.lock` terms alone, while the line still prints `[LIVE] … 0` with no warning.
**This is not hypothetical: line 548 is the same call against the same provider in the same process,
and it threw `HRESULT 0x800706be` in this very run** — it printed loudly only because line 548 is the
one call in that file *without* `-ErrorAction SilentlyContinue`, and line 541 has it.

**Fix shape (NOT staged — see WHAT I DID NOT DO).** Drop `-ErrorAction SilentlyContinue`, wrap in
`try/catch`, and on failure return a **third state** — `UNKNOWN`, never `0`/`$null` — which every
caller must treat as "cannot assert", exactly as DOCTRINE §7.1 requires `[CANNOT MEASURE]` to be
reported rather than silently become `false`. `status-sweep` must print
`[BROKEN] CIM unavailable — safe-to-act UNMEASURED` and `restart-watcher-if-wedged.ps1` must refuse
to issue DOWN at all. Complete-and-additive: it adds a state, changes no existing reading, and
touches no data.

**DISPOSITION: DISPATCHED** — to **Station 00** (owner of the pipeline scripts' lane; Station 04 is
read-only on the board and may not create a PR, STATION-CAPABILITIES §5). The fix must be authored
and smoke-verified *after* F1 is cleared, because the box's CIM provider currently cannot give a
green run.

---

### F3 — S3 · `sweep-rotation.json`'s instrument-honesty brief names a trap DOCTRINE's core no longer carries (pre-split wording).

The brief I executed says: *"Take DOCTRINE section 9 and prove each trap is still trapped. Run the
query that lies (**ls-tree without -r**, git status against a gitignored file, gh run list --branch
main, a --jq string through the shell)."*

[MEASURED] against `origin/main`, after `DOCTRINE_CORE_SPLIT_V1`:

| trap the brief names | hits in `DOCTRINE.md` (core) | hits in `DOCTRINE-REFERENCE.md` |
|---|---|---|
| `ls-tree` | **0** | **9** |
| `is structurally blind to gitignored files` | 1 | 1 |
| `gh run list --branch main` | 1 | 1 |
| `--jq` | 2 | 20 |

Three of four are in the core; **`ls-tree` is in the REFERENCE only.** A station following the brief
literally — *"take DOCTRINE section 9"*, which the bootstrap tells it to read as the core — finds no
`ls-tree` bullet there and may conclude the trap was retired. It was not; it moved. This is the
pre-split enumeration surviving the split, which is §1 of STATION-CAPABILITIES' own thesis: a stale
instruction reads exactly like a current one.

Cheapest correct fix: the brief cites `DOCTRINE §9` **and** `DOCTRINE-REFERENCE §9.2` for the
`ls-tree` item, or drops the parenthetical enumeration and says "every trap in §9 and its REFERENCE
write-up" — which cannot rot as the split moves things.

**DISPOSITION: DEFERRED** — real, low cost, no current harm (I ran all four probes anyway and they
are in F4). It becomes urgent the first time a station reports `ls-tree` as a retired trap on the
strength of a core-only grep. Station 00: a one-line edit to `docs/pipeline/sweep-rotation.json`,
cheap to fold into any board PR.

---

### F4 — S4 · The instrument-honesty sweep itself: three of four §9 traps REPRODUCE; one is under-powered; none is refuted.

All four probed twice (once against the documentation, once against the corpus its bullet names), per
§9.6, with the minted needle as negative control throughout.

**(a) `git status` is structurally blind to gitignored files — REPRODUCES.** [MEASURED]

```
target=docs/qa/qa-findings.md   exists_on_disk=True
git check-ignore -v  -> .gitignore:116:docs/qa/qa-findings.md    exit 0
git status --porcelain -- docs/qa/qa-findings.md  -> []   lines=0
POSITIVE control: git status --porcelain | ?{ $_ -like '??*' }  -> 48 entries (sample: '?? .codex/')
```

The instrument can see untracked files; it cannot see this one. Trap live. **This is the trap that
swallowed a released gate for nine days, and it is why this breadcrumb is at a tracked path.**

**(b) The piped `git show | git hash-object --stdin` is UNSOUND in `powershell.exe` — REPRODUCES
exactly.** [MEASURED] on `docs/pipeline/DOCTRINE.md`:

```
piped (powershell)        = bdee024128cb500e4dd9495920d9d9c8e8d1eed5   <-- WRONG
git rev-parse origin/main:<path> = 5b71fe520c7deda5133a87c14a0efad627f05638
git hash-object <path>           = 5b71fe520c7deda5133a87c14a0efad627f05638
git diff --numstat origin/main -- <path> = EMPTY  (the real answer: not different)
cmd /c "<same pipeline>"         = 5b71fe520c7deda5133a87c14a0efad627f05638   <-- correct
```

Both forms exit 0 and both print a well-formed 40-hex SHA. A station comparing the piped value
against a true SHA reads its own binding documents as stale. The §9.2 cure is correct as written.

**(c) `ls-tree` without `-r` cannot see into subdirectories — REPRODUCES, and the blast radius is
larger than the bullet implies.** [MEASURED] on `origin/main`:

```
docs/pr-prompts/   noR=32    withR=1522      <-- a no-r probe sees 2.1% of the corpus
docs/pipeline/     noR=13    withR=34
sot/               noR=7     withR=7         <-- flat dir: the two forms AGREE, which is the trap
```

⚠️ **The `sot/` row is the dangerous one and it is not in the write-up:** on a flat directory the two
forms return identical results, so a station that validates its probe against `sot/` certifies a
broken query as sound and then points it at `docs/pr-prompts/`. Worth adding to the REFERENCE §9.2
write-up when F3 is fixed.

**(d) `gh run list --branch main` staleness — NOT REFUTED, but my probe was under-powered; I am not
claiming a reproduction.** [MEASURED] at 14:21:32Z:

```
gh run list --branch main --limit 1 --json createdAt,name,conclusion
  -> [{"conclusion":"success","createdAt":"2026-10-10T09:38:03Z","name":"Pipeline heartbeat"}]
```

That is **4.7 h old**, and it is the **"Pipeline heartbeat"** workflow — not trunk CI. `status-sweep`
read trunk CI on the same commit as `4 success / 0 failed` and explicitly excluded the heartbeat run
from its verdict. So the reading is both stale-ish *and* pointed at the wrong workflow class, which
is the shape §9.4 warns about; but the bullet says *"can be DAYS stale"*, and **one 4.7 h reading
neither confirms nor refutes a "can be" claim.** Honest status: the cure (read CI from the PR with
`gh pr checks`) stands; the magnitude is unverified by me.

**(e) `--jq` through the shell — consistent with the current narrowing, no drift.** [MEASURED]
through a `-File` layer at PS `5.1.26100.9444`, `gh version 2.90.0 (2026-04-16)`:

```
gh pr view 1369 ... --jq '.labels[].name'  -> do-not-merge   exit 0   (POSITIVE: #1369 genuinely carries it)
gh pr view 1640 ... --jq '.labels[].name'  -> <empty>        exit 0   (NEGATIVE: #1640 genuinely has none)
```

Agrees with `JQ_LOUD_FAILURE_NOT_REPRODUCED_V1` in STATION-CAPABILITIES §3. ⚠️ **Scope limit I am
declaring rather than papering over:** that narrowing was measured through a `-Command` layer with
*escaped double quotes*; I tested the **single-quoted** form through a `-File` layer. **I did not
measure the escaped-double-quote form, so I am not a second data point for it.**

**DISPOSITION: ACTIONED** — the sweep is complete and its result is recorded here; three traps
verified live, one under-powered and declared as such, none refuted. Verified by the commands and
both controls quoted above. Rotation advanced (see WHAT CHANGED) so the next run does not repeat it.

---

### F5 — S4 · My own first probe produced a false negative, and the only reason it is not in this report as a finding is the control that caught it.

[MEASURED] I grepped `DOCTRINE.md` for `git status is structurally blind` → **0 hits**, and very
nearly wrote "the core no longer carries the gitignore trap". Re-probed with the literal, which
carries backticks:

```
"git status is structurally blind"              -> 0    <-- my probe
"`git status` is structurally blind"            -> 1    <-- the actual literal
"is structurally blind to gitignored files"     -> 1    <-- backtick-free, the right needle
```

The markdown inline-code backticks broke the match. A zero from a pattern spanning a backtick
boundary is **not** evidence of absence. Recording it because §9.6's rule — *a negative control you
wrote down is a positive* — is what saved it, and because the next station to grep DOCTRINE for a
quoted rule will hit the same edge. **Practical rule: choose needles that sit strictly inside or
strictly outside the backticks, never across them.**

**DISPOSITION: ACTIONED** — caught and corrected within the run; F3's measurement uses the corrected
needles. No downstream claim rests on the bad one.

---

### F6 — S3 · The bootstrap's mandatory git-guard install could not run at all: the VM-side bash transport was down for the whole run.

[MEASURED] four consecutive attempts at
`bash /sessions/<id>/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh`:

```
attempt 1  request timed out after 30s (workspace did not confirm the command started)
attempt 2  RPC error -1: process with name "modest-admiring-ramanujan" already running
attempt 3  request timed out after 30s
attempt 4  RPC error -1: process with name "modest-admiring-ramanujan" already running
```

So **no installer last line and no exit code exist** — this is neither the exit-2 INERT outcome nor a
non-zero install failure, but a **third case the three-outcome table does not cover: the installer
never executed.** Per the contract that is a finding, not a stop, and I carried on sighted.

⚠️ **The guard's protection was moot this run and I want that on the record rather than implied.**
The guard only ever refuses `git` *from the VM against a mounted folder*; with the VM transport down
I could not have made such a call if I had tried, and I made none — every `git` was host-side through
Desktop Commander, none index-writing. **The device-bridge git ban was kept by construction, not by
the shim.** Consistent with the station doc's own warning that the ban is REMEMBERED, not mechanical.

Worth noting for whoever owns the bootstrap: the table's three outcomes are all *post-execution*
states, so a station that cannot run the installer has no prescribed line to write. A fourth row —
*"could not execute: say so, make no VM-side calls, continue sighted"* — would close that.

**DISPOSITION: DEFERRED** — no harm this run and the mitigation is sound. It becomes urgent if a
*blind* run hits the same transport failure, since a blind run's only read path **is** the mount, and
it would then be reaching for `git` there with no guard and no record that the guard never ran.

---

## WHAT I DID NOT DO

- **Did not kill, restart or prune anything**, although F1 is live and growing. Killing ~1,670
  processes is destructive (DOCTRINE §5.4) and `-Fix` on a churning supervisor is the one thing that
  script's own header forbids: *"A crash loop must NOT be answered with another restart."* ESCALATED
  with RULE 1 options instead.
- **Did not run `restart-watcher-if-wedged.ps1 -Fix`.** Report-only, exit 3. Given F2, its DOWN
  verdict on this box is currently untrustworthy in the dangerous direction.
- **Did not stage a `-HOLD` prompt for F2**, though staging is within my authority and my budget was
  2. Deliberate: the fix must be smoke-verified, and the box's CIM provider **cannot currently
  produce a green run** (a single-pid query timed out). A prompt armed against F1's storm would
  consume a watcher run and fail for reasons unrelated to its own correctness — and the watcher is
  already crash-looping. **F2 is dispatched with a complete fix shape and a blast-radius table so it
  can be authored in one pass the moment F1 is cleared.** This is the honest call, not a budget I
  failed to spend.
- **Did not mint a worktree** (AUTHORITY: orphan locks have no holding process by construction) and
  did not write this breadcrumb into the session `outputs` folder, which is disposable.
- **Did not write to `docs/qa/qa-findings.md`, `qa-checklist.md` or `qa-test-data-registry.md`** — all
  gitignored by the `# Overnight-QA scheduled task` comment in `.gitignore`; a finding living only
  there is unreported.
- **Did not commit `sweep-rotation.json`** or this breadcrumb. Station 04 may not commit; the dev
  tree is on `main`. Both are named under WHAT CHANGED for Station 00.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
  contract takes ONE named sweep per run and covers it completely; F1 then consumed the remaining
  budget, and I judged a live crash loop the better use of it than a rotating module patrol. Both
  parts are untouched and due next run.
- **Did not touch Azure, Entra, SharePoint, production data, `/sot/`, any label, any
  `do-not-merge`, or either open PR (#2303, #2294).**
- **Carry NO safe-to-act verdict** — `status-sweep.ps1` never reached one (see WHAT I MEASURED).
  Its absence is not a clearance.
