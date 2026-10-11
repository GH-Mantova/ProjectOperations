# Station 00 — Supervisor | 2026-10-11T10:23Z–2026-10-11T11:05Z

## GROUND

```
UTC            2026-10-11T10:31:29Z   (true UTC, see F0 — the 10:24 figure this run first took was wrong)
origin/main    bf245896               (git fetch origin exit 0, then git rev-parse origin/main)
dev tree       main @ bf245896        C:\ProjectOperations2   (0 0 vs origin/main; cached EMPTY; numstat NOT empty — see F7)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                      (scheduled-task SKILL.md station_doc_version)
```

Version check: doc version 1 == bootstrap 1. **No mismatch — this run was NOT read-only.**

**This run was SIGHTED.** Desktop Commander connected on the first call after one keyword
`ToolSearch` for `desktop-commander`, then one `select:` call for the seven tool ids the search
reported. All three preflight documents were read from `git show origin/main:<path>` in the dev
tree after `git fetch origin` (exit 0): `00-supervisor.md`, `DOCTRINE.md` in full, and
`STATION-CAPABILITIES.md` (740 lines) in sections §1–§8.

---

## WHAT I MEASURED

**F0 — my own first GROUND timestamp was an instrument lie, caught by a second instrument.
[MEASURED]**

The run's first host call used `Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"` and returned
`2026-10-11T20:24:18Z`. **`-Format` does not convert to UTC — the `Z` is a literal character in
the format string, so that is Brisbane local time wearing a UTC suffix.** Caught because
`check-breadcrumb.mjs --freshness` then reported station 05 at `-3.9h ago`, which is only possible
if one of the two clocks is wrong. Controls:

```
Get-Date -Format "...Z"                        -> 2026-10-11T20:24:18Z   <- WRONG, local+literal Z
(Get-Date).ToUniversalTime().ToString("s")+"Z" -> 2026-10-11T10:31:29Z   <- correct
(Get-Date).ToString("s")                       -> 2026-10-11T20:31:29    <- local, honestly labelled
(Get-TimeZone).Id                              -> E. Australia Standard Time  (UTC+10)
```

Recorded because it is a **new** §9.1-class trap not in that list, it is a **positive false claim**
rather than an absence, and a station stamping GROUND this way publishes a breadcrumb that is ten
hours wrong while looking perfectly well-formed. **This is very likely the mechanism behind 05's
`...2026-10-11-1425...` filename**, which three consecutive runs have now recorded as "stamped +24h"
and treated as a day-boundary question: a +10h local-for-UTC substitution on a 04:25 local run
produces exactly that, and it is a *formatting* bug, not a calendar one. Not asserted as 05's cause
— I did not read 05's code — but it is the first mechanism offered that fits.

**1. The device bridge reached the box on the first call. The VM-side git guard could NOT be
installed — third consecutive run. [MEASURED]**

```
attempt 1  bash .../scripts/pipeline/vm-git-guard.sh  -> request timed out after 30s
attempt 2  same -> bash failed on resume, create, and re-resume. RPC error -1:
                   process with name "optimistic-upbeat-albattani" already running
                   (id: oneshot-c1707e58-3cce-44fc-bc03-b6716ccda03a)
attempt 3  same (after sleep 20) -> identical RPC error, attempt 3 of 5 since last success
```

**No installer last line and no exit code to quote, because the installer never ran.** Per the
contract this is a FINDING, not a STOP, and it is **not a licence to run my own `git` against the
mount**: I ran **zero** VM-side git this run. Every `git` below was native `git.exe` on the Windows
host in the dev tree. This is the same wedge the 0618 and 0943 runs hit — the sandbox shell, not
the guard script.

**2. ROOT CAUSE OF THE SHELL STORM — NAMED, with the code. [MEASURED]**

The 0943 run got as far as *"the cohort's `-EncodedCommand` payload begins `function Resolve-W…`
and decoding it names the owner outright"*, and could not finish the decode. **It is decoded.**

Rather than enumerate 1017 rows (which is what starved the two previous attempts), I walked the
parent chain of the one PID the 0943 run named, `35512`, with two-column `ProcessId`-filtered WQL:

```
PARENTPROC 35512  name=powershell.exe  ppid=36032  created=2026-10-10 11:35:03 (local)
  PARENT_CMD = powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden
               -File "C:\po-watcher\watcher-launcher-singlelane.ps1"
  GRANDPARENT 36032  name=powershell.exe
  GRANDPARENT_CMD = "...\powershell.exe" -Version 5.1 -s -NoLogo -NoProfile -EncodedCommand ZgB1AG4A…
```

That `-EncodedCommand` is the cohort's command line — the same one 993 of 1017 shells share.
Decoded as UTF-16LE it is:

```
function Resolve-WatchdogJudgedAgeMinutes {
    param(
        [object] $HeartbeatUtc,
        [object] $NodeStartUtc,
        [Parameter(Mandatory=$true)][datetime] $NowUtc,
        [Parameter(Mandatory=$true)][int]      $HungMin
    )
    ...
}
```

**That is not an unknown process. It is this pipeline's own watchdog**, and the repo says exactly
where it comes from:

```
origin/main:scripts/pr-watcher/supervise-watcher.ps1
  L575  function Resolve-WatchdogJudgedAgeMinutes {
  L631  $wdGraceFnInfo = Get-Command Resolve-WatchdogJudgedAgeMinutes -CommandType Function
  L633      "function Resolve-WatchdogJudgedAgeMinutes {`n" + $wdGraceFnInfo.ScriptBlock.ToString() + "`n}"
  L641  $null = Start-Job -Name pr-watcher-heartbeat-watchdog -InitializationScript $wdGraceInit -ScriptBlock { … }
```

`Start-Job` spawns one `powershell.exe -Version 5.1 -s -NoLogo -NoProfile -EncodedCommand <init>`
session host per job, plus one `conhost`. **The `-InitializationScript` IS the payload**, which is
why every shell in the cohort carries an identical encoded command line and why that command line
is a function definition rather than a script path.

**The census that closes it, over all 1070 lines of that file:**

```
Start-Job   = 3   (L321 comment, L616 comment, L641 the ONE real call)
Remove-Job  = 0
Receive-Job = 0
Wait-Job    = 0
Stop-Job    = 0
Get-Job     = 0
```

**The watchdog job is started and never reaped — not on exit, not on restart, not ever.** One
leaked session host + one conhost per supervisor start. 993 of them means ~993 supervisor starts,
which is consistent with the crash/restart loop the file's own `crashWaitSec` / `maxSameFail`
parameters describe. **This also explains the shape nobody could account for: the count keeps
climbing while the watcher "is not running" — it is the restart loop, not the node, that leaks.**

**3. THE 0943 RUN'S "CIM ANSWERS AGAIN, WITH BOTH CONTROLS" IS REFUTED, 80 MINUTES LATER.
[MEASURED]**

That run declared F1's kill precondition MET on `CIM_CONTROL_explorer=OK count=1`. Same control,
this run:

```
Get-CimInstance -Query "... WHERE Name = 'explorer.exe'"          -> rows=0     <- POSITIVE CONTROL FAILED
Get-CimInstance -Query "... WHERE Name = 'zqx-st00-11oct-…exe'"   -> rows=0     <- negative, expect 0
Get-Process -Name explorer                                         -> 1          <- INDEPENDENT instrument
```

**Explorer is running. CIM said it was not.** A positive and a negative control returning the same
answer is a dead instrument, and §7's rule is that a check never seen to succeed is not a check.
Meanwhile `ProcessId`- and `ParentProcessId`-filtered CIM queries *did* answer correctly in the same
script (that is how §2 above was obtained), so the failure is **specific to `Name`-filtered
queries**, which is precisely the form any kill-by-image or kill-by-command-line selection would
use. By 11:01Z CIM had degraded further: a single `ProcessId`-filtered query against one `node` PID
**hung for over two minutes and never returned**.

Sound instruments at 10:52Z, taken with `Get-Process`, which answered every time:

```
Get-Process powershell -> 1029      Get-Process conhost -> 1028      Get-Process node -> 9
total processes 2403   (0943 run: 2370;  0815 run: 2378)
```

**The storm is no longer flat — it is up ~16 shells in 80 minutes**, against the 0943 run's "flat".

**4. 04's F2 and my §3 are the same defect seen from two sides, and together they put the inherited
"watcher is down" in doubt. [MEASURED + INFERRED]**

Station 04's 10:11Z breadcrumb (written 10:35Z, read in full this run) finds that
`scripts/pipeline/status-sweep.ps1:263` coerces a **failed** `Get-CimInstance Win32_Process`
(`HRESULT 0x80010002`, *"Call was canceled by the message filter"*) into an empty array and prints
`[LIVE] watcher node: NOT RUNNING` as a fact. That is the same CIM failure my §3 measured from the
other end.

Two facts measured this run are **inconsistent** with the inherited F2:

- `watcher-launcher-singlelane.ps1` (PID 35512) is **ALIVE**, started 2026-10-10 11:35 local.
- `Get-Process node` returns **9**, one of them PID 71124 started **2026-10-11T07:29:56Z** — i.e.
  *after* the 415-minute heartbeat age the 0943 run reported.

[INFERRED, and flagged as such] I did **not** establish that any of those 9 is the watcher node —
the per-PID CIM call that would have read their command lines is the one that hung (§3). So this is
**a refutation of the evidence, not a positive claim that the watcher is up.** The honest state is:
*nobody currently knows whether the watcher is running, because the only instrument that was
answering the question has been shown to fail open.*

**5. Board, live. Nothing a station may act on. [MEASURED]**

```
gh pr list --state open --json number,title,labels,mergeStateStatus,updatedAt
  #2303  BEHIND  do-not-merge  fix(pipeline): refuse a HOLD whose own PR is already open   updated 2026-10-10T05:01Z
  #2294  BEHIND  do-not-merge  fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5  updated 2026-10-10T01:25Z
```

Both carry `do-not-merge`, **which only Marco removes**. No merge was available and none was
attempted. No instrument-lane merge was available: INSTRUMENT_LANE_V1 requires *no* `do-not-merge`
label and both PRs carry one. **Instrument-lane merges this run: none.**
**MARCO_QUEUE_LINE_V1: WAITING ON MARCO = 2; ALL OPEN (non-draft) = 2; oldest #2294, open ~57h.**
Recorded as the contract requires, though I armed nothing.

**6. Freshness: CLEAN, exit 0. [MEASURED]**

```
node scripts/pipeline/check-breadcrumb.mjs --freshness        (FRESHNESS_EXIT=0)
structure: 23 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-11T09:43:00Z   0.8h ago   (cadence 1h + grace 0.5h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-10T23:07:00Z  11.4h ago   (cadence 24h + grace 3h)    ok
  04  last 2026-10-11T06:13:00Z   4.3h ago   (cadence 4h + grace 1h)     ok
  05  last 2026-10-11T14:25:00Z  -3.9h ago   (cadence 24h + grace 3h)    ok
CLEAN
```

No station is MISSED, so no MISSED classification is owed this run. 04's figure is already stale in
my favour — it reported again at 10:11Z, after this scan. 05's `-3.9h` is the known skew, and F0
above offers the first mechanism that fits it.

**7. COLLECT. [MEASURED]**

`--freshness` named the untracked set; 04's 10:11Z breadcrumb landed after it and is added by hand:

```
00-00-supervisor-2026-10-11-0000-blind-no-host-shell.md                       UNTRACKED
00-00-supervisor-2026-10-11-0618-blind-no-device-bridge-…                     UNTRACKED
00-00-supervisor-2026-10-11-0815-merged-2311-…                                UNTRACKED
00-00-supervisor-2026-10-11-0943-cim-answers-again-…                          UNTRACKED
00-04-scanner-2026-10-11-0000-blind-no-shell.md                               UNTRACKED
00-04-scanner-2026-10-11-0613-blind-no-device-bridge.md                       UNTRACKED
00-04-scanner-2026-10-11-1011-gate-liveness-clean-but-…cancelled-cim-call.md  UNTRACKED  <- NEW
```

**Seven, plus this one makes eight.** The only breadcrumb carrying uncollected findings is 04's
1011Z; I read it in full and dispositioned its F1–F4 below. The 0943 breadcrumb is my own
predecessor's and I read it in full to inherit its open items.

**8. Pre-mutation gate: NOT OBTAINED. [MEASURED]**

`status-sweep.ps1` was launched at 10:31:34Z and was **still running, with zero bytes of output, at
10:52Z (21.5 minutes)**. It never returned inside this run. This is the third consecutive run to
fail to read the safe-to-act gate, and the cause is known and parked: `#2294` is the PR that adds
`-SkipSection5` and dedupes the section 5 crawl.

Hand-measured components (reported as components, **not** as a substitute for the gate):

```
git rev-list --left-right --count HEAD...origin/main  ->  0   0
git diff --cached --name-status                       ->  EMPTY
git status --porcelain (tracked)                      ->  1 entry:  M docs/pipeline/sweep-rotation.json
git diff --numstat                                    ->  2  2  docs/pipeline/sweep-rotation.json
Test-Path .git\index.lock                             ->  False
board lease file                                      ->  none present
PRs touched in last 2 min                             ->  none (newest updatedAt 2026-10-10T05:01Z)
```

The dirty tracked file is **Station 04's rotation state**, advanced from `last_index 3` to
`last_index 0` with `last_run_utc 2026-10-11T10:11:00Z`. 04's session went quiet at 10:37Z and its
breadcrumb was written at 10:35Z, so 04 has **finished** — this is a leftover, not a live
collision. I did not take the board lease and I mutated nothing.

**9. [CANNOT MEASURE] — stated, not papered over.**

- **Whether the watcher node is actually running** (§4). The per-PID CIM call hung.
- **`status-sweep.ps1` sections 3, 4 and 5** — safe-to-act gate, scheduled-task census, and the
  `needs-marco/` `[STALE]` re-check. No section produced output at all this run.
- **Any sandbox-side cross-check** of any host reading — the VM shell is wedged (§1).
- **Which of the 26 parent PIDs are still alive.** `PARENT 35512 children=0` this run against 482 at
  09:43Z; with CIM failing open (§3) I will not report that as "reaped".

---

## WHAT CHANGED

1. **Four read-only diagnostic `.ps1` written to `C:\po-sup-fix-scripts\`** — the sanctioned scratch
   location (STATION-CAPABILITIES §4): `st00-decode2-2026-10-11.ps1`,
   `st00-transcripts-2026-10-11.ps1`, `st00-jobcensus-2026-10-11.ps1`,
   `st00-nodecheck-2026-10-11.ps1`. None kills, mutates, or writes outside its own output file.
2. **This breadcrumb**, written to `C:\ProjectOperations2\docs\pr-prompts\`, untracked, for the
   sweep to collect. Named here so `sweep-breadcrumbs.ps1` finds it.

**Nothing else.** No PR merged, opened, updated or closed. No prompt armed or disarmed. No label
added or removed. No escalation retired. No breadcrumb archived or `git mv`'d. No board lease taken.
No worktree touched. No lock cleared. No scheduled task enabled, disabled, edited or re-run. No
orphan shell killed. No process terminated at all this run. No `/sot/` file read for edit or
written. No commit on `main`. No `git` run through the device bridge.

---

## FINDINGS

### F1 — The shell storm is ROOT-CAUSED: `supervise-watcher.ps1:641` starts a named watchdog `Start-Job` and the file contains zero `Remove-Job`, `Receive-Job`, `Wait-Job`, `Stop-Job` or `Get-Job`. One leaked session host per supervisor start, ~993 starts.

Full measurement in §2. The 0943 run handed this forward as *"one step from being named"*; it is
named. The decoded `-EncodedCommand` is the `-InitializationScript` carrying
`function Resolve-WatchdogJudgedAgeMinutes`, built at L631–L633 and passed at L641, and the job is
never reaped anywhere in 1070 lines.

Two things follow that were previously guesswork:

- **Why the count climbs while the node is "down".** The leak is per *supervisor start*, not per
  build. A crash/restart loop leaks one shell per iteration forever, with no node ever staying up.
- **Why it is one identical command line.** `-InitializationScript` is a constant for a given
  revision of the file, so every leaked host is byte-identical by construction. This also retires
  the idea that the cohort is foreign: **it is ours.**

**I killed nothing, and the reason has changed again — see F2.** It is no longer "I cannot identify
them": I can. It is that the instrument needed to *select* them safely has failed again, Marco holds
the open authorisation question, and repairing machines is 03's lane on 00's dispatch.

**ESCALATED** — to Marco, as the fact that **changes both his options**, not a fourth ask:

> **I found what is making the shells, and it is our own code.** Every one of the ~993 identical
> PowerShell processes is a background job started by `scripts/pr-watcher/supervise-watcher.ps1`
> line 641 — the heartbeat watchdog. The file starts that job and **never cleans it up**: there is
> no `Remove-Job` anywhere in its 1070 lines. One orphaned shell per supervisor start, and the
> supervisor has been restarting in a loop, which is why the count climbed to ~1030 while the
> watcher itself looked dead.
>
> **RULE 1 — the complete-and-additive option, first:**
>
> **Option 1 — reboot, then merge a one-line reap into `supervise-watcher.ps1`.** This is the only
> option that passes both halves. The reboot clears all ~2060 processes immediately and damages no
> data; the code fix stops it recurring. Without the second half, a reboot buys you days and the
> storm comes back, because the leak is structural. I have **not** opened that PR — see F3 for why,
> and it is one word from you.
>
> **Option 2 — kill in place.** I now advise **against** this, more strongly than at 09:43. The
> instrument needed to select the right processes has failed again: `Get-CimInstance` by process
> *name* returned **zero** rows for `explorer.exe` while `Get-Process` simultaneously found it
> running, and by 11:01 a single CIM query was hanging outright. **A kill selection built on that
> would either match nothing or match the wrong set**, and the wrong set includes your watcher's own
> 19 shells. It also still fails the "future" half: it does not touch the leak.
>
> **Option 3 — do nothing.** Fails both halves and the cost is now measurable: the storm is up ~16
> shells in 80 minutes, it has blinded roughly 40% of station runs, and it has blocked the channel
> that commits station reports to `main` for three consecutive runs.

Handed to **Station 03 — Machine Minder** as well (next occurrence `0 9 * * *`), with the file, the
line number and the census, so 03 starts from a named defect rather than a search.

### F2 — The 0943 run's CIM positive control is REFUTED 80 minutes later: `Name`-filtered CIM queries now return false negatives, and by 11:01Z CIM hangs. The kill precondition DOCTRINE §9.5 demands is UNMET again.

Measurement and controls in §3. `explorer.exe`: CIM 0 rows, `Get-Process` 1. Positive and negative
controls returning the same value is a dead instrument.

This matters beyond F1 because **the 0943 run's central claim was built on this control passing**,
and that run's own words were *"the precondition for killing cannot be met, so killing is
forbidden… it can be met now."* It cannot. The honest sequence is: unmeasurable at 08:15,
apparently measurable at 09:43, **demonstrably lying at 10:44**. An instrument that intermittently
passes its own control is worse than one that fails consistently, because a run that samples it in
a good minute writes down a verdict that is false by the time anyone acts on it.

**ACTIONED** — this run. I did not route around it or re-run hoping for green: I identified the
sound instrument and used it. `Get-Process` answered every call (1029 / 1028 / 9) and
`ProcessId`-filtered WQL answered until it began hanging, which is how F1 was obtained without ever
enumerating by name. **The standing cure for every station until the host is cleared: do not count
or select processes with `Name`-filtered CIM — use `Get-Process`, and cross any CIM reading against
it.** Verified by the explorer control above, which is the cheapest possible positive control and
takes one line.

### F3 — I did not open the `supervise-watcher.ps1` fix PR, and the reason is a merge gate, not a doubt about the fix.

The fix is small, additive and well understood: reap the watchdog job. The obstruction is
structural and identical in shape to the one that has parked F3 of the 0943 breadcrumb:
`scripts/pr-watcher/` sits **outside `tests/` and `docs/`**, CP-26 is armed by the diff
(CP26_ARMED_BY_DIFF_V1), and `scripts/pr-gates/standing-lanes.json` holds only `sot` and
`instrument` — **no lane covers `scripts/pr-watcher/`**, so any PR I open there is un-mergeable by
any station and lands on Marco's desk needing a release he has not been asked for.

The sanctioned route — write a prompt, let the watcher open the PR — is unavailable: the watcher's
state is exactly what is in doubt (F4), and arming anything while the queue is in the state 04's F1
describes would be actively harmful.

I also did **not** take the half-measure of opening it anyway and labelling it `do-not-merge`. That
would add a third parked PR to a board that already has two, and the 0943 run's F3 records the
reasoning for not doing this: opening the PR answers Marco's open question in the direction that
costs him a release.

**ESCALATED** — to Marco, folded into F1's Option 1 as a single yes/no: *"shall I open the
`supervise-watcher.ps1` reap fix as a PR for you to release?"* One word unblocks it, and the fix
itself is ready to write. **What would make it urgent without an answer:** the shell count passing
~1200, or any station reporting a *second* consecutive hard failure to reach the host.

### F4 — The twice-deferred transcript reads are DONE, and they refute the question. All four sessions ran to completion with ZERO API errors; they were blind, and they deliberately wrote no breadcrumb.

F5 of the 0815 breadcrumb and F4 of the 0943 breadcrumb both deferred this. It is discharged.

```
session    created    lines  bytes     api_error_records  CONNECT_TIMEOUT mentions
c31080da   03:13:53     72   1,028,421        0                  7
818d535a   04:14:06     50     860,750        0                  4
ff192d72   05:13:57     82     963,996        0                 10
eebda5d5   07:14:21     49     864,441        0                  8
```

**None is a turn-one API error** — the hypothesis both prior runs were testing. Each ran 49–82
turns, wrote ~1 MB of transcript, and ended with a coherent, complete, dispositioned blind report
*in chat*. Their closing turns say why no breadcrumb exists, and all four reached the same
conclusion independently:

> *"a breadcrumb has to land at a tracked path via a commit, and with no `git` I will not drop an
> uncommitted file into a dev tree whose index is shared with other chats"* — ff192d72
>
> *"I did not open a second-lane PR for the breadcrumb. It sits uncommitted at its contract path"*
> — c31080da

**So the station doc's three-way MISSED classification does not contain the shape that actually
happened.** These were not `never fired`, not `fired and died`, and not `reported, not merged`.
They are a fourth: **ran to completion, reported fully, and wrote to a channel nobody reads.**
STATION-CAPABILITIES §7 is explicit that chat is *"not durable; no other agent can read it"*.

**ACTIONED** — the deferral is discharged and will not be carried forward a third time. The four
session ids are recorded above so the reading can be re-checked rather than redone.

### F5 — Four consecutive blind runs independently concluded that a breadcrumb requires a commit. The REPORT CONTRACT says the opposite, and the cost was four lost reports.

This is F4's consequence and it is a documentation defect, not a run defect — which is why it is
separated out.

The REPORT CONTRACT is unambiguous: *"Breadcrumbs, station notes and scanner output are left
UNTRACKED"*, and *"The breadcrumb is untracked until the next board PR commits it."* STATION-
CAPABILITIES §3 records that a blind run can reach the live dev tree through the Cowork mount at
`/sessions/<id>/mnt/ProjectOperations2/`, where **writing a file needs no `git` at all** — and the
0000 and 0618 breadcrumbs from today were written exactly that way, proving the route works while
blind.

Four runs in one morning nonetheless reasoned themselves out of it, all citing the shared index and
a supposed commit requirement. **A rule that four independent readers get wrong the same way is a
rule that is being read wrong, not four careless readers.** [INFERRED] the likely trigger is the
contract's own emphasis that a breadcrumb only *reaches* anyone once a board PR commits it, which a
blind run with no `git` reads as "so I cannot file one".

I did not change the text. The sentence that would need amending sits **inside the hash-gated
canonical block** (`CANONICAL-BLOCK: station-contract v5`, *"byte-identical in every station doc"*,
`lint-station.mjs` fails on any edit), so the change is seven station docs plus a re-recorded hash
in one PR — not something to improvise at the end of a run whose board gate is unreadable.

**DEFERRED** — to a run that can open a board PR, as a single-purpose docs change: add one sentence
to the canonical block stating that **a blind run writes its breadcrumb through the Cowork mount and
does not need `git`**. It is inside Station 00's `docs/` lane, so it is mergeable without Marco once
the gate is readable. **What would make it urgent:** a fifth blind run losing its report the same
way. On this morning's rate that is likely within hours, which is why it is written down now rather
than left as a lead.

### F6 — 04's 10:11Z findings, collected and dispositioned.

Read in full. 04's own dispositions are sound and I am not overriding them; what follows is 00's
disposition, which is the thing that closes.

- **04 F1** (the only two armable prompts are the two whose work is already in an open PR) —
  **DEFERRED**, agreeing with 04. Already with Marco as
  `needs-marco/spent-hold-gate-fails-closed-…-2026-10-10.md`. **I armed nothing this run**, which is
  the interim protection 04 asked for, and I record the reason here so it is not read as inattention.
- **04 F2** (`status-sweep.ps1:263` turns a failed CIM call into `[LIVE] watcher node: NOT RUNNING`)
  — **ESCALATED**, and **strengthened by my §3 and §4**: this is the same CIM failure measured from
  the other end, and today it is *not* printing the truth. 04 noted the defect was invisible because
  the fail-open and reality agreed; one hour later that coincidence has broken. 04's option (a) —
  fold a connect-then-assert guard into `#2294` before it merges — is the complete-and-additive one
  and I endorse it unchanged. It needs `#2294`'s label removed, which only Marco does.
- **04 F3** (five dead gates, two of them the Marco-approval class) — **DEFERRED**, agreeing. Filed
  18 days. **I repaired no gate**, and specifically did not touch
  `pr-rates-s11c-drop-legacy-tables`, which drops tables.
- **04 F4** (tipid-s3's second gate is masked by its first and sits behind the table-dropping
  approval) — **DEFERRED**. Recorded so no future run repeats the archive's mistake of repairing
  gate 1 in isolation and reporting it as progress.

### F7 — The safe-to-act gate was unobtainable for the third consecutive run, so nothing was mutated and the untracked breadcrumb set has grown to eight.

`status-sweep.ps1` ran 21.5 minutes with zero output and never returned (§8). The hand-measured
components were clean except one: Station 04 left `docs/pipeline/sweep-rotation.json` **modified and
uncommitted** in the shared dev tree. 04 has finished, so it is a leftover rather than a live
collision — but the station doc is explicit that a tracked file left modified in the dev tree
**blocks the next `git merge --ff-only`** exactly as an untracked breadcrumb at a landing path does.
This is the second day running that 04's rotation state has survived only as an uncommitted dev-tree
edit (the 1814 breadcrumb recorded it yesterday).

**I did not commit it, and will not**: it is another station's work, `git diff --cached` was empty
so it is not mine to sweep, and a pathspec commit is the contract for exactly this situation.

**DEFERRED** — to the first run that can read the gate, which should sweep **eight** breadcrumbs and
either commit or explicitly leave 04's rotation edit. **What makes it urgent:** it already is, at
the margin — three runs of station findings now exist only as untracked files on one laptop, and
F1's storm is the reason the gate cannot be read. The permanent fix is one of: Marco releasing
`#2294`, or clearing F1. Both are in front of him above; **not re-escalated separately.**

---

## WHAT I DID NOT DO

**I merged nothing, and there was nothing to merge.** `#2303` and `#2294` both carry
`do-not-merge`, which **only Marco removes**. I did not remove a label and did not reason past one.
No instrument-lane merge was available — the lane requires *no* `do-not-merge` label and both PRs
carry one. **Instrument-lane merges this run: none.**

**I armed nothing.** 04's F1 shows the only two ADMIT-ing prompts are the ones whose own work is
already in flight in `#2303` and `#2294`; arming either would send the watcher to rebuild parked
work. The watcher's state is in doubt (F4) besides, and a `*-ready.md` rename would block the next
fast-forward. **MARCO_QUEUE_LINE_V1 figures are in §5** as the contract requires.

**I opened no PR** — not the board PR that would commit eight breadcrumbs, and not the
`supervise-watcher.ps1` fix (F3). The pre-mutation safe-to-act gate never returned. A clean dev tree
is not that gate and I did not substitute one for the other. I did not take the board lease.

**I killed no process** — not one of the ~1029 shells, and unlike the 0943 run not even my own
stalled probes. The 21.5-minute `status-sweep.ps1` (PID 32548) and the hung node-check were left
running rather than terminated, because with CIM failing (F2) I could not re-verify what else shared
their command lines, and the station doc requires a verified command line per PID before any kill.

**I did not reboot the host and did not advise anyone but Marco to.** It is his working PC.

**I did not restart the watcher or the wrapper**, did not clear the watcher clone's `index.lock`,
did not touch any of the 33 non-main worktrees, and did not run `rescue-watcher-repo.ps1`. All 03's
lane; dispatched in F1 with the file and line number.

**I did not retire any `[STALE]` escalation row, and could not have.** Section 5 of the sweep — the
section that flags them — never ran. Nothing was retired on a LIST reading (§9.4).

**I did not archive any breadcrumb.** All eight in the current cycle are untracked, so there is no
tracked path to `git mv`, and the current cycle stays in the queue root by contract.

**I did not commit, stage or revert Station 04's `sweep-rotation.json` edit** (F7), and ran no
`git checkout --`, `reset --hard`, `stash pop` or `clean` anywhere.

**I ran zero VM-side `git`**, despite the guard being uninstallable (§1). The absence of the guard
is not a licence.

**I did not edit `standing-lanes.json` or `instrument-lane.json`.** Both are Marco's; a change to
either puts a PR outside the lane by definition.

**I did not read or edit anything under `/sot/`.** Station 05's lane; CP-24 hard-fails any PR
mixing code and `sot/`.

**I did not do 03's, 04's or 05's work.** 04 reported at 10:11Z and is collected (F6); 03's next
occurrence is tonight; 05 is within cadence on a wrong number, and F0 offers a mechanism for that
number rather than re-asking the question already in front of Marco.

**I did not touch a scheduled task** — none enabled, disabled, edited, run or re-run. Freshness was
CLEAN (§6), so no MISSED reading existed to tempt it.

**No Azure, Entra or SharePoint contact of any kind — no portal, no App Service settings, no Entra
registrations, secrets, permissions or consent, no SharePoint permissions or structure, no `az` and
no `Connect-MgGraph`. No production data read or written. No force-push, no branch deletion, no
destructive migration, no secret deleted.**

**I did not write this report to the session's `outputs` folder.** It is at
`C:\ProjectOperations2\docs\pr-prompts\`, untracked, where Station 00 collects.

---

## FOR MARCO

**I found what has been making the processes, and it is our own code — one line of it.**

Every one of those ~1030 PowerShell processes is a background job started by
`scripts/pr-watcher/supervise-watcher.ps1`, line 641 — the heartbeat watchdog. That file starts the
job and **never cleans it up**: no `Remove-Job`, anywhere, in 1070 lines. One abandoned process per
supervisor start. The supervisor has been restarting in a loop, which is why the count kept climbing
even while the watcher itself looked dead — **it was never the watcher leaking, it was the thing
that keeps trying to restart it.**

**What I'd ask you for, in one message:**

1. **Reboot the laptop** — clears all ~2060 processes, risks nothing, damages no data.
2. **Say yes to one PR** — I'll write the three-line fix that reaps that job, and you release it.
   Without it the reboot buys days, not a cure, because the leak is structural. I have not opened it
   because `scripts/pr-watcher/` has no standing merge lane, so it would just become a third PR
   parked on your desk without your say-so.

**I withdrew yesterday's "you could kill them selectively instead."** At 09:43 I told you the
diagnostic instrument had come back and you could safely pick the right processes. **Eighty minutes
later I caught that instrument lying**: asked whether `explorer.exe` was running it answered *no*,
while a second tool found it running fine. A kill list built on that would have matched the wrong
processes — including your watcher's own. Reboot is now clearly the better of the two.

**Two things still waiting on you, unchanged, and I am not re-asking — just naming them so the
picture is complete.** `#2294` and `#2303` are both parked with `do-not-merge`. `#2294` matters more
than it looks: it is the PR that makes the status sweep finish, and that sweep is the gate I'm
required to read before touching the board. **It hasn't finished in 21 minutes for three runs
running, so eight station reports — three mornings of findings — are now sitting untracked on your
laptop and nowhere else.** Clearing the processes fixes that too.

And Station 04 found something worth your eye independent of all this: the status sweep prints
`[LIVE] watcher node: NOT RUNNING` when its process query *fails*, rather than saying it could not
tell. I hit the same failure from the other side this morning. **So "the watcher is down", which
three of my own reports have now told you, may simply be the tool failing out loud.** 04's
recommended fix is to fold a guard into `#2294` before it merges — same PR, no new work.
