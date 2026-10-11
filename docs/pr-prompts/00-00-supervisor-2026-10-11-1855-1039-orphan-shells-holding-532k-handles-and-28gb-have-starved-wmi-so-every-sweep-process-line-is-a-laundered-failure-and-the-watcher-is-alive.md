# Station 00 — Supervisor | 2026-10-11T18:19Z–2026-10-11T18:58Z

## GROUND

```
UTC            2026-10-11T18:19:29Z (start) / 2026-10-11T18:58Z (end)
origin/main    f5e71921            (git fetch origin, then git rev-parse)
dev tree       main @ bf245896      C:\ProjectOperations2   (0 ahead, 2 behind origin/main)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                    (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE. Full-authority run, not read-only.

Three binding documents read in full from `git show origin/main:<path>` in the dev tree, after
`git fetch origin` (FETCH_EXIT=0): `docs/pipeline/stations/00-supervisor.md` (466 lines),
`docs/pipeline/DOCTRINE.md` (508 lines), `docs/pipeline/STATION-CAPABILITIES.md` (740 lines).
REFERENCE files not opened — no core line sent me there this run.

**NOT BLIND.** Desktop Commander loaded on the third keyword `ToolSearch` for `desktop-commander`
(the first two returned "still connecting" — an unloaded schema, not an unreachable machine, per
BOOTSTRAP_PREFLIGHT_V1). `start_process` shell `powershell.exe` returned `git version
2.56.0.windows.2`.

**vm-git-guard:** last line and exit code, verbatim —
`   PATH="/sessions/jolly-vigilant-davinci/.local/bin:$PATH" git <args>`, headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`,
**EXIT=2**. Expected outcome for a station; a FINDING, not a stop. No `git` was run through the
device bridge this run — every `git` call went through Desktop Commander on the Windows host.

## WHAT I MEASURED

**[MEASURED] The host clock is CORRECT, and "the host clock is exactly 24h behind" is REFUTED.**
Three independent clocks, same second: Windows host `HOST_UTC=2026-10-11T18:42:49Z`; GitHub's own
HTTP response header `gh api -i repos/GH-Mantova/ProjectOperations` → `Date: Sun, 11 Oct 2026
18:42:50 GMT`; Cowork sandbox `date -u` → `2026-10-11T18:19:29Z` at run start. Host local reads
`2026-10-12T04:42:49`, tz `E. Australia Standard Time` (UTC+10) — so the Cowork prompt's
`Today's date: 2026-10-12` is the host's **local** date, and the only wrong clock in the system is
a run that pairs that local DATE with a UTC TIME. The breadcrumb
`00-00-supervisor-2026-10-12-1637-...-nailed-the-host-clock-to-exactly-24h-behind.md` is tracked on
`origin/main` and its central claim is wrong. See F1.

**[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.**
`structure: 18 checked, 0 malformed, 0 skipped`. But two rows carry NEGATIVE ages:
`00  last 2026-10-12T16:37:00Z  -21.9h ago  (cadence 1h + grace 0.5h)  ok` and
`05  last 2026-10-12T14:10:00Z  -19.5h ago  (cadence 24h + grace 3h)  ok`. `03` 19.6h ok,
`04` 4.4h ok. The stamp is built from the FILENAME (`check-breadcrumb.mjs:292`,
`const stamp = \`${date}T${hhmm.slice(0,2)}:${hhmm.slice(2)}:00Z\``) and compared at line 328
(`(now - Date.parse(n.stamp)) / 3.6e6`). See F2.

**[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts | Select-String '2026-10-12'`**
returns exactly two future-dated breadcrumbs:
`00-00-supervisor-2026-10-12-1637-collected-eleven-breadcrumbs-and-nailed-the-host-clock-to-exactly-24h-behind.md`
and `00-05-sot-keeper-2026-10-12-1410-blind-again-sot-is-clean-on-every-reachable-probe-and-twenty-breadcrumbs-sit-uncollected-at-depth-1.md`.
Both are ~22h ahead of the true clock. POSITIVE control: the same probe for `2026-10-11` matches the
real breadcrumbs; NEGATIVE control: `2026-10-13` → 0 hits.

**[MEASURED] THE PROCESS STORM, by `Get-Process` (pure .NET, no RPC — the only enumerator still
working on this box).** At 2026-10-11T18:53:59Z:

| metric | value |
|---|---|
| `powershell.exe` processes | **1039** |
| `pwsh` | 0 |
| `node.exe` | 16 |
| open handles, powershell only (sum `HandleCount`) | **532,217** |
| working set, powershell only (sum `WorkingSet64`) | **27,979 MB (~27.3 GB)** |
| oldest powershell | `2026-10-07T21:28:39Z` (4 days) |

Accumulation profile by start hour (UTC), from the same enumeration — the acquisition burst is
~34 h old and what remains is a pool that never drains:

```
2026-10-07T21Z  n=2
2026-10-10T01Z  n=111   02Z n=108   03Z n=136   04Z n=76   05Z n=91
2026-10-10T06Z  n=44    07Z n=40    08Z n=42    09Z n=75   10Z n=43
2026-10-10T11Z  n=24    12Z n=24    13Z n=1     14Z n=18   15Z n=27
2026-10-10T16Z  n=11    17Z n=13    18Z n=9     19Z n=20   20Z n=9   21Z n=10   23Z n=14
2026-10-11T00Z  n=35    02Z n=14    10Z n=12    18Z n=15   (remaining hours 1-4 each)
```

Prior readings for the trend: 929 shells (00's 2026-10-10 2015Z breadcrumb) → **1039** now.

**[MEASURED] WMI/RPC IS OUT OF MEMORY, AND IT IS NOT A CimCmdlets PROBLEM.** Two different
enumerators that go through the RPC/WMI endpoint both fail; the one that does not, works:

- `Get-CimInstance Win32_Process` → `HRESULT 0x800706be` (RPC_S_CALL_FAILED_DNE)
- `tasklist /FI "IMAGENAME eq node.exe"` → `ERROR: The remote procedure call failed.`
- `Get-Process -Name node` → **16 rows with PIDs and start times.** Works.

And the supervisor log records the memory error directly:
`Watcher exited with failure (exit 1). REASON: + FullyQualifiedErrorId : HRESULT 0x80041006,
Microsoft.Management.Infrastructure.CimCmdlets.GetCimInstanceCommand` — **0x80041006 is
WBEM_E_OUT_OF_MEMORY.** This refutes both cures proposed in earlier breadcrumbs (swap CIM→WMI;
swap CIM→tasklist): every RPC-based enumerator is down together. See F3, F4.

**[MEASURED] `status-sweep.ps1` PRINTS `[LIVE]` ON A FAILED CALL, AND THE FAILING LINE IS NAMED.**
Run as a detached process with stdout/stderr redirected (the inline `| Out-String` form produced
zero output for 13 minutes and had to be force-terminated — a second instrument trap). `sweep.err`:

```
Get-CimInstance : The remote procedure call failed.
At C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1:267 char:10
+ $sup = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' ...
    + FullyQualifiedErrorId : HRESULT 0x800706be,...GetCimInstanceCommand
```

and `sweep.out` section 2, from that failure:

```
[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain
[LIVE] auto-restart wrapper: NOT RUNNING -- watcher will not self-restart
[LIVE] heartbeat age: 1 min
```

Note the sweep **contradicts itself inside one section**: a 1-minute-old heartbeat alongside
"NOT RUNNING". See F4.

**[MEASURED] THE WATCHER IS ALIVE. Both "NOT RUNNING" lines are false.** By log CONTENT, never by
mtime or by process name:

- `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-10-11.log` newest line
  `[2026-10-11T18:52:19.959Z] [review] poll failed: gh pr list ... TLS handshake timeout` — read at
  18:52:43Z, i.e. **24 seconds old**.
- `...\logs\2026-10-12.log`: `SINGLE-INSTANCE: watcher already running (PID 97560). Not starting
  another.` ×4, newest `2026-10-12T04:37:28+10:00`.
- `Get-Process` confirms pid 97560 alive, started `2026-10-10T22:02:39Z`.
- The watcher is working the queue: `[2026-10-11T18:42:30.321Z] [start] rev-2313-ready.md
  (max-turns=240)`.

**[MEASURED] THE WATCHER'S GitHub POLLS ARE FAILING ON NETWORK while mine succeed.** Same log:
`18:47:09Z` *"error connecting to api.github.com"*; `18:49:33Z`, `18:49:34Z`, `18:52:19Z`,
`18:52:19Z` *"Post https://api.github.com/graphql: net/http: TLS handshake timeout"*. Over the same
minutes my own `gh pr list` and `gh api -i` returned complete payloads and the sweep's section 1 was
genuinely `[LIVE]`. GitHub is reachable from this box; the watcher's calls are being starved. See F3.

**[MEASURED] THE supervise-watcher RESTART LOOP IS MULTI-INSTANCE.** `supervisor.log` tail shows
out-of-order independent counters — `Identical consecutive failures: 1 of 5` … `4 of 5` … `3 of 5`
… `1 of 5` interleaved with four `Restarting in 60 s.` and two `ADOPT: the adopted watcher has
exited.` inside 90 seconds (`2026-10-12T04:43:30+10:00`–`04:49:04+10:00`). One supervisor cannot
hold four different counters. See F3.

**[MEASURED] FOUR crash-loop escalations in under two hours**, all written by
`scripts/pr-watcher/supervise-watcher.ps1`, all naming `HRESULT 0x800706be ...GetCimInstanceCommand`:
`needs-marco/WATCHER-CRASH-LOOP-2026-10-12-{011717,020737,023220,031113}.md`, mtimeUtc
`15:17:17Z`, `16:07:37Z`, `16:32:20Z`, `17:11:13Z`. (Their filenames carry the local date; their
mtimes are real.)

**[MEASURED] BOARD.** `gh pr list --state open --limit 100 --json ...` → **2 open PRs**, and the
sweep's section 1 agrees:

| PR | branch | state | CI | labels |
|---|---|---|---|---|
| #2303 | `fix/pipeline-spent-hold-pr-open` | BEHIND | 11 pass / **4 fail** | `do-not-merge` |
| #2294 | `fix/sweep-section5-dedupe-and-fast-switch` | BEHIND | 13 pass / **2 fail** | `do-not-merge` |

`[LIVE] WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 47h`.
`[LIVE] ALL OPEN (non-draft): 2`. `[LIVE] main CI on f5e71921: 4 success / 0 failed / 0 running
(trunk green)`. Recent merges confirm last run's hand-off: **#2313 merged 2026-10-11T17:57Z**
(reported QUEUED by 00's 1800 breadcrumb — now confirmed MERGED, which is the required next-run
confirmation under UPDATE_AT_MERGE_TIME_V1) and #2312 merged 17:47Z.

**MARCO_QUEUE_LINE_V1 figures, for the record:** WAITING ON MARCO = **2**; ALL OPEN (non-draft) = **2**.

**[MEASURED] QUEUE CENSUS.** armed `*-ready.md` = **1** (`rev-2313-ready.md` — an auto-generated
REVIEW JOB, not a prompt, DOCTRINE §9.5; in flight since 18:42:30Z). `*-HOLD.md` = **16**.
`needs-marco/*.md` = **69**.

**[MEASURED] DEV TREE.** `git status --porcelain=v1` — no tracked modifications, no staged paths
(`git diff --cached --name-status` EMPTY), no `index.lock`. Eight untracked entries: `.codex/`,
`AGENTS.md`, three `Claude Design/proposed/*` folders, `Claude Design/docs/index.html`,
`docs/pr-reviews/pr-2312-review.md`, and my predecessor's breadcrumb
`00-00-supervisor-2026-10-11-1800-...-laundered-cim-failure.md`.

**[MEASURED] ANOTHER ACTOR MOVED THE DEV TREE'S HEAD MID-RUN.** At 18:25Z: `HEAD=b60bf285`,
`BRANCH=HEAD` (detached). At 18:55Z: `HEAD=bf245896`, `BRANCH=main`. Nothing I ran touched a ref.
Per BOARD_LEASE_V1 condition 3 this is "something else is mid-mutation", and it is the reason this
run took no board action. See WHAT I DID NOT DO.

**[MEASURED] WORKTREES.** `[LIVE] non-main worktrees found: 33`. At least three classified orphaned
and two hold unpushed commits on no remote branch: `C:/po-worktrees/marco-queue-line` (`369d73e9`
[`feat/marco-queue-line`], 1 commit, dirty=1, age 7912 min), `C:/po-worktrees/st05-sot-2026-10-09`
(`7f2badd1` [`docs/sot-reconcile-2026-10-09`], 2 commits, dirty=0, age 4090 min),
`C:/po-worktrees/sup-cwd-paths` (`66ac4dcd`). See F5.

**[CANNOT MEASURE]** Which of the 1039 `powershell.exe` processes are supervise-watcher instances,
station shells, or watcher children. Command lines on Windows require `Win32_Process`, and that is
the exact call that is down. `Get-Process` returns no command line. The multi-instance conclusion in
F3 rests on the interleaved supervisor-log counters, not on process attribution — it is
**[INFERRED]** and labelled as such.

**[CANNOT MEASURE]** Any smoke or safe-to-act verdict on #2303 / #2294. Both are `do-not-merge`, so
no merge path was open and `Assert-SmokedOrEscalate` was not run.

## WHAT CHANGED

**Nothing on the board. No arm, no merge, no label change, no branch update, no PR, no lease taken,
no escalation retired, no breadcrumb archived.** The only write this run made anywhere is this
breadcrumb file. Reason: an actor outside this run moved the dev tree's HEAD mid-run while a review
job was building, which is BOARD_DRIVING condition 3's explicit STOP; and both open PRs carry
`do-not-merge`, which only Marco removes.

## FINDINGS

### F1 — "The host clock is 24h behind" is REFUTED, and the wrong clock is the Cowork prompt's local date

`00-00-supervisor-2026-10-12-1637-...-nailed-the-host-clock-to-exactly-24h-behind.md` is tracked on
`origin/main` and its headline claim is false. Measured this run: host UTC and GitHub's HTTP `Date`
header agree to **one second**, and the sandbox `date -u` agrees too. What is 24h-ish off is a
*derived* value: the Cowork prompt states `Today's date: 2026-10-12`, which is the host's **Brisbane
local date** (UTC+10, measured `HOST_LOCAL=2026-10-12T04:42:49`). A blind run with no host shell
reads that line, pairs the local DATE with a UTC-looking TIME, and stamps a breadcrumb up to a day in
the future. This matters beyond a filename: a run that believes the host clock is 24h wrong will
misjudge every lock age, every heartbeat age and every worktree age it measures — and lock staleness
is what Station 03 clears on.

The cure is additive and does not touch the clock: **take the stamp from the host (`(Get-Date).ToUniversalTime()`),
and when blind, from the sandbox `date -u` — never from the prompt's `Today's date` line**, and say
which one was used. 04's 2026-10-11 1810Z breadcrumb had already identified the mechanism
("a blind run's breadcrumb date comes from the local clock"); what is new here is the refutation of
the 24h-skew claim with a GitHub-side control, and the consequence for age arithmetic.

**DISPOSITION: ESCALATED** — see `## FOR MARCO`, item 3. The code change belongs in a prompt, and
no prompt can be armed into a starved machine this run (F3); the standing-instruction half of it
(stations stamping from the prompt line) is a doc change in `docs/pipeline/`, which is a lane I can
drive once the box is healthy.

### F2 — A future-dated breadcrumb permanently DISARMS the silence detector for that station

`check-breadcrumb.mjs` builds its freshness stamp from the filename (line 292) and computes
`ageH = (now - Date.parse(stamp)) / 3.6e6` (line 328). A future-dated filename yields a **negative**
age, and a negative age can never exceed `cadence + grace`. So the station reports `ok` **no matter
how long it is actually silent** — until real time passes the fabricated stamp. Right now that is
`2026-10-12T16:37Z` for station 00 and `2026-10-12T14:10Z` for station 05: **both stations are
un-MISS-able for the next ~20 hours**, and `--freshness` says `CLEAN` with exit 0 while saying it.

This is §7 in its most expensive shape: not a check that fails, but a check that **passes for the
wrong reason** at exactly the moment it is needed. It is also precisely the defect class #2090 was
merged to fix (a wrong cadence constant that stopped 00 being called SILENT until three runs had
been missed) — reappearing through the stamp instead of the cadence.

RULE 1, complete-and-additive first:

1. **Complete + additive (recommended).** In `check-breadcrumb.mjs`, treat `ageH < 0` as a
   **malformed stamp**: print the row as `FUTURE-STAMPED` and exit 1 (the existing "malformed
   report" code), never `ok`. Additive — it adds a failure mode that currently reads as success,
   changes no cadence, rewrites no history, and cannot hide a real MISSED. Pairs with F1's
   stamp-source rule so new ones stop being created.
2. Rename the two offending breadcrumbs to their true dates. **Fails the no-damage half**:
   DOCTRINE §10.5 — an artifact carries ONE identity for its whole life; renaming a tracked
   breadcrumb breaks `--freshness` basename matching and the archive trail. Rejected.
3. Do nothing and rely on `lastRunAt` cross-checks. **Fails the complete half**: the cross-check is
   a human step in the station doc, and the instrument keeps printing `CLEAN`.

**DISPOSITION: ESCALATED** — see `## FOR MARCO`, item 3. `scripts/pipeline/check-breadcrumb.mjs` is
outside `tests|docs` and outside 00's recorded lane, so a PR touching it needs Marco's release
(NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1); and NEVER_LIST_BEFORE_ARMING_V1 means I must
not arm it blind into a machine that cannot build.

### F3 — 1039 orphaned shells holding 532k handles and 27 GB have starved WMI/RPC; this is the root cause of the watcher crash loop, the TLS timeouts and every lying process probe

One cause, five symptoms, all measured above:

- **1039** `powershell.exe` processes, **532,217** handles, **~27.3 GB** working set, oldest 4 days.
- WMI answers `0x80041006` — **WBEM_E_OUT_OF_MEMORY** — in the supervisor log. Not a config fault;
  the service is out of memory.
- Every RPC-based enumerator fails together (`Get-CimInstance`, `tasklist`); only `Get-Process`
  works. **Both previously-proposed cures (CIM→WMI, CIM→tasklist) are therefore refuted.**
- `start-watcher.ps1` makes a `Get-CimInstance` call, so the watcher child dies on it, 5 identical
  times, and `supervise-watcher.ps1` stops and escalates — four times in two hours.
- The watcher's `gh` polls fail with TLS handshake timeouts while mine succeed in the same minutes:
  port/handle starvation, not a network outage.
- **[INFERRED]** multiple `supervise-watcher.ps1` instances are running (interleaved, out-of-order
  `1 of 5` / `4 of 5` / `3 of 5` counters inside 90 seconds; one process cannot hold four counters).
  Each instance restarts a child every 60 s, so the loop **feeds** the shell pool it is starving on.

⚠️ And the sanctioned sweep is a contributor, not only a victim: `status-sweep.ps1:267` runs
`Get-CimInstance Win32_Process -Filter "Name='powershell.exe'..."` — enumerating 1039 instances out
of a memory-starved WMI service, hourly, behind Station 00's cadence.

The cure is **machine repair**, and the authority matrix is unambiguous: 00 is ❌ on "repair the
machines" and dispatches 03; 03 is ⚠️ **report-only**. Killing ~1000 processes is also irreversible
in the §5.4 sense, and restarting the WMI service needs `sc` / `net`, both on Desktop Commander's
blocked list. **So the repair is Marco's, and I am not reaching for it.** Options for him are in
`## FOR MARCO` item 1, complete-and-additive first.

**DISPOSITION: ESCALATED** — to Marco (item 1). Deliberately NOT written as a fifth
`WATCHER-CRASH-LOOP-*.md`: four already say "the child died on a CIM call" and none of them carries
the diagnosis. This breadcrumb is the diagnosis.

### F4 — `status-sweep.ps1` tags a FAILED call `[LIVE]`, and the watcher it declares dead is alive

`[LIVE] watcher node: NOT RUNNING` and `[LIVE] auto-restart wrapper: NOT RUNNING` are both printed
from the `Get-CimInstance` at line 267 **after that call has thrown**, with the exception visible
only on stderr. Both are false: pid 97560 is alive, its log line is 24 s old, and the restart
wrapper is not merely running but running in several copies. The sweep then contradicts itself inside
the same section with a true, file-derived `[LIVE] heartbeat age: 1 min`.

This is the §7 failure in its purest form — *a failed call read as a meaningful answer* — and it is
aimed at the one line the whole pipeline is told to obey. The project instruction says *"report ONLY
from its [LIVE] lines"*, and the `[LIVE]` tag is what certifies authority. A station obeying that
instruction literally today reports a dead watcher, a dead restarter and a frozen queue, all three
false, and the confident wrong verdict is the expensive outcome DOCTRINE §7 exists to prevent.

RULE 1, complete-and-additive first:

1. **Complete + additive (recommended).** Wrap the line-267 enumeration (and every other
   `Get-CimInstance` in the script) so a throw yields **`[BROKEN] process enumeration unavailable:
   <error>`** instead of a derived `[LIVE]` verdict. Section 0 of the sweep already has the
   machinery and the contract — *"If ANY [BROKEN] appears in section 0, STOP: the report is
   unreliable until the instrument is fixed"* — so this routes a failure into a path that already
   exists. Additive: it removes no true line, changes no verdict that was actually measured, and
   makes "I could not measure it" impossible to read as "it measured false", which is §7's standing
   guard verbatim. Second, cheap, independent half: add a `Get-Process`-based fallback for
   *presence* (it works today), while keeping command-line-dependent claims `[CANNOT MEASURE]`.
2. Read process liveness from the heartbeat/log files only, dropping enumeration. **Fails the
   complete half**: §9.5 — the heartbeat only ticks mid-run, so files alone cannot separate idle
   from wedged.
3. Leave it and rely on each station noticing. **Fails both halves.** Three consecutive Station 00
   runs have now had to re-derive this by hand, and the first one shipped the phrase "laundered CIM
   failure" precisely because the line is believable.

**DISPOSITION: ESCALATED** — to Marco (item 2). `scripts/pipeline/status-sweep.ps1` is outside
`tests|docs` and outside 00's lane, and it is the *second entry* in the instrument NEVER-LIST
territory this run cannot arm into (F3). Note #2294 — open 47 h, `do-not-merge`, CI 13/2 — already
touches this file for a different reason (section 5 dedupe + `-SkipSection5`), so item 2 says
whether to fold this in or keep it separate.

### F5 — 33 non-main worktrees, at least two holding unpushed commits on no remote branch

`[LIVE] non-main worktrees found: 33`. `C:/po-worktrees/marco-queue-line` holds 1 commit
(`369d73e9`, `feat/marco-queue-line`) on no remote branch, dirty=1, age 7912 min (5.5 days);
`C:/po-worktrees/st05-sot-2026-10-09` holds 2 commits (`7f2badd1`,
`docs/sot-reconcile-2026-10-09`), dirty=0, age 4090 min (2.8 days);
`C:/po-worktrees/sup-cwd-paths` (`66ac4dcd`) also classified orphaned. The sweep's own caveat
applies and I did not resolve it: a squash-merged branch shows here identically, so each needs
`gh pr list --head <branch> --state merged` before anyone prunes. **Nothing here may be pruned until
those commits are confirmed reachable — this is a §5.4 irreversible.**

Worktrees, locks and clone drift are Station 03's lane, and 03 is self-scheduled (`0 9 * * *`, last
breadcrumb 2026-10-10 2307Z, `--freshness` 19.6h ok).

**DISPOSITION: DISPATCHED** — to **Station 03 — Machine-minder**, on its next occurrence. Handed
over: (a) classify all 33 non-main worktrees, confirming each orphan's branch against
`gh pr list --head <branch> --state merged` **before** proposing any prune; (b) treat
`marco-queue-line`, `st05-sot-2026-10-09` and `sup-cwd-paths` as preserve-first, prune-never-yet;
(c) report only — the prune itself is Marco's under §5.4. ⚠️ **03 must read F3 before trusting any
process or liveness reading it takes on this box, and must not take `[LIVE] ... NOT RUNNING` from
`status-sweep.ps1` at face value.**

### F6 — My predecessor's breadcrumb is untracked in the dev tree and reaches nobody until a board PR commits it

`docs/pr-prompts/00-00-supervisor-2026-10-11-1800-merged-2312-queued-2313-and-the-sweeps-not-running-watcher-line-is-a-laundered-cim-failure.md`
is `??` in `git status`, and `check-breadcrumb.mjs` flagged it itself:
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`. Its two substantive claims
are both **confirmed** this run and neither needed to be re-escalated: #2313 is MERGED (17:57Z), and
the sweep's "not running" line is indeed a laundered CIM failure (F4, now with the script line
number and the stderr). **This breadcrumb is in the same state** — written to the dev tree,
untracked, for the same reason (no board PR could be opened safely this run).

**DISPOSITION: DEFERRED** — it becomes urgent the moment a board PR lands either path on `main`,
because an untracked file at a path a fast-forward must create blocks `git merge --ff-only` while
`--numstat` and `--cached` both read EMPTY (the documented PASS reading). What would make it urgent:
the next `sweep-breadcrumbs.ps1` run, or the next Station 00 occurrence finding the box healthy
enough to open a board PR — which should sweep **both** files and archive the collected ones.

## FOR MARCO

Three items. All three are blocked on you, and item 1 blocks the pipeline.

**1. The box has ~1000 orphaned PowerShell processes holding 532,217 handles and 27 GB, and WMI is
now returning OUT OF MEMORY.** Everything else is downstream of this: the watcher child dies on a
`Get-CimInstance` call, the restart wrapper has escalated four times in two hours, the watcher's
GitHub polls are timing out on TLS while an ordinary `gh` call from the same box succeeds, and every
process-based probe in the pipeline — including `status-sweep.ps1`'s `[LIVE]` lines — is returning a
confident wrong answer. The oldest shell is from 2026-10-07; the burst was 2026-10-10 01Z–12Z.
I cannot clear this: repairing machines is outside Station 00's authority, killing ~1000 processes is
irreversible, and `sc` / `net` are blocked for me.

- **(a) Complete + additive — recommended.** Reboot the box, then start one
  `supervise-watcher.ps1` and confirm exactly one is running. A reboot clears the shell pool, the
  handle table and the starved WMI service in one move, loses nothing (the queue is on disk —
  1 armed review job, 16 HOLDs — and the two unpushed worktree branches in F5 are untouched by a
  reboot), and leaves no partially-cleaned state for the next station to misread. Pairs with the
  permanent half: **a single-instance guard on `supervise-watcher.ps1`**, so the restart loop cannot
  multiply again. `start-watcher.ps1` already has `SINGLE-INSTANCE` logic for the *watcher*; the
  *supervisor* evidently does not.
- **(b) Kill the orphaned `powershell.exe` processes in place and restart the WMI service.** Faster,
  no reboot. Fails the *no-damage* half: with `Win32_Process` down there is no way to read command
  lines, so there is no way to tell a 4-day-old orphan from a live station shell or a watcher child
  — and I measured a station shell starting at 18:53:59Z during this very run. A blind kill by image
  name is exactly what DOCTRINE §9.5 forbids.
- **(c) Leave it and let the stations keep running.** Fails both halves: the pool grew 929 → 1039
  since 2026-10-10, the hourly sweep enumerates it out of a memory-starved service every run, and
  every station report taken on this box is unreliable until it is cleared.

**2. `status-sweep.ps1` prints `[LIVE] watcher node: NOT RUNNING` from a `Get-CimInstance` call that
has already thrown** (line 267; exception on stderr only). Today that line is false and the watcher
is alive. Our project instruction is *"report ONLY from its [LIVE] lines"*, so this is the one
instrument failure that can make every station confidently wrong at once. The fix is small and
additive — route the throw to the `[BROKEN]` path section 0 already defines, and add a
`Get-Process` presence fallback (that enumerator still works). **Your call: fold it into #2294**,
which is already open against this file (47 h, `do-not-merge`, CI 13 pass / 2 fail), **or keep it as
its own prompt?** I did not arm anything, because `scripts/pipeline/*` is outside my lane and
NEVER_LIST_BEFORE_ARMING_V1 says a prompt that lands only there cannot be merged by any station
anyway — and nothing can build until item 1 is done.

**3. Two breadcrumbs on `origin/main` are stamped ~22 h in the future, and that silently disarms the
silence detector.** `00-00-supervisor-2026-10-12-1637-...` and `00-05-sot-keeper-2026-10-12-1410-...`
were named from the Cowork prompt's `Today's date: 2026-10-12`, which is the Brisbane **local** date
— your host clock is correct, and agrees with GitHub's to the second. Because
`check-breadcrumb.mjs` derives freshness from the filename, stations 00 and 05 now report `ok` for
the next ~20 hours **however long they are actually silent**, and `--freshness` says `CLEAN`, exit 0.
The 00 breadcrumb's own title — *"nailed the host clock to exactly 24h behind"* — is wrong, and a
future run acting on it will misjudge every lock age and heartbeat age it measures. Recommended fix,
additive and in one place: make `ageH < 0` a **malformed stamp** (`FUTURE-STAMPED`, exit 1) rather
than `ok`, and have stations take the stamp from the host clock or the sandbox `date -u`, never from
the prompt line. I did not rename the two files — DOCTRINE §10.5 says an artifact keeps one identity
for life. **Confirm the clamp is what you want before I write the prompt?**

## WHAT I DID NOT DO

- **Did not arm anything.** 16 HOLDs are staged and one review job (`rev-2313-ready.md`) is already
  in flight. Arming into a box whose WMI is out of memory and whose watcher cannot complete a
  GitHub poll would produce a build that cannot finish, and every candidate fix (F2, F4) targets
  `scripts/pipeline/*` — never-list territory under NEVER_LIST_BEFORE_ARMING_V1, so the resulting
  PR could not be merged by any station regardless. MARCO_QUEUE_LINE_V1 figures recorded above.
- **Did not merge anything.** Both open PRs (#2303, #2294) carry `do-not-merge`, which only Marco
  removes, and both are RED (4 and 2 failing checks) and BEHIND. `Assert-SmokedOrEscalate` was not
  run because no merge path was open. #2313, reported QUEUED last run, is confirmed **MERGED**.
- **Did not take the board lease, update a branch, or touch a label.** BOARD_DRIVING condition 3:
  another actor moved the dev tree's HEAD between 18:25Z and 18:55Z (`b60bf285` detached →
  `bf245896` on `main`) while a review job was building. That is the LL-38 collision signature, and
  condition 3 says STOP.
- **Did not open a board PR, archive a collected breadcrumb, or retire a `[STALE]` escalation.** All
  four are dev-tree git mutations, barred by the line above. Consequence stated plainly: **this
  breadcrumb and my predecessor's are both untracked and reach nobody until a sweep commits them**
  (F6). The 69 `needs-marco/` files were censused, not triaged — the sweep's section 5 PR crawl is
  the slow path #2294 exists to fix, and it had not produced its `[STALE]` rows when I stopped
  reading.
- **Did not repair the machine.** Outside Station 00's authority (00 ❌ "repair the machines",
  dispatches 03; 03 report-only), irreversible under §5.4, and `sc` / `net` are blocked. No process
  killed, no service restarted, no watcher started, no scheduled task enabled, disabled, run or
  edited.
- **Did not prune a worktree.** Two orphans hold unpushed commits on no remote branch; pruning
  before confirming them against `gh pr list --head <branch> --state merged` would destroy work.
  Dispatched to 03 as preserve-first (F5).
- **Did not run `git` through the device bridge.** The guard reported INERT (exit 2), which is not a
  licence; every `git` call this run went through Desktop Commander on the Windows host.
- **Did not write a fifth `WATCHER-CRASH-LOOP-*.md`.** Four exist and none carries a diagnosis;
  adding a duplicate would add noise to a 69-file queue. The diagnosis is F3 and `## FOR MARCO`
  item 1.
- **Did not claim `breadcrumb-clean`.** `check-breadcrumb.mjs --freshness` was run and exited 0,
  but the structure validator was not run against *this* file, and F2 is a live argument that its
  `CLEAN` is currently unreliable for stations 00 and 05.
- **Did not open the REFERENCE files.** No core line sent me to one, and `BOOTSTRAP_CORE_REFERENCE_V1`
  makes them read-on-demand.
