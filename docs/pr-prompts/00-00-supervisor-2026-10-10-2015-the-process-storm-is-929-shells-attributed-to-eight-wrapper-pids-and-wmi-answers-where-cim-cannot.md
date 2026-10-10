# Station 00 — Supervisor | 2026-10-10T20:15:21Z–2026-10-10T20:4xZ

## GROUND

```
UTC            2026-10-10T20:15:21Z
origin/main    ab62ec04            (git fetch origin --quiet, then rev-parse --short origin/main)
dev tree       main @ ab62ec04      C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version claimed by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 == 1), so this run was not restricted to read-only.

**This run was SIGHTED.** Said loudly, because the occurrence before it (19:28Z) was blind and a
blind run and a healthy quiet run produce the same "no news".

## WHAT I MEASURED

**Preflight 1 — reachability.** One keyword `ToolSearch` for `desktop-commander` FIRST (ids not
assumed), then `start_process` shell `powershell.exe`. [MEASURED] host reachable on the first call,
no retry needed: `UTC=2026-10-10 20:15:21`. **NOT blind.**

**Preflight 1 — the device-bridge git guard.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
last line: To get the protection for one call, put the shim on PATH yourself:
              PATH="/sessions/zealous-sweet-bell/.local/bin:$PATH" git <args>
headline : vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
EXIT CODE: 2
```

[MEASURED] exit **2**, read from the INSTALLER directly with no pipeline appended — the documented
middle outcome and the EXPECTED one for a station. **A FINDING, not a stop.** I ran no `git` against
the mount in any form; every `git` this run ran in a shell on the Windows host.

**Preflight 2 — the three documents,** all read via `git show origin/main:<path>` in the DEV tree
(never the working copy, never the watcher clone), after `git fetch origin`:
`docs/pipeline/stations/00-supervisor.md` (v1, in full), `docs/pipeline/DOCTRINE.md` (in full),
`docs/pipeline/STATION-CAPABILITIES.md` (in full, 52.2 KB). I compared no piped hash against
anything.

**Preflight 4 — freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 2**:

```
structure: 14 checked, 0 malformed, 0 skipped
00  last 2026-10-10T18:14:00Z   2.1h ago  (cadence 1h + grace 0.5h)   MISSED
02  dispatch-only — no cadence to miss
03  last 2026-10-09T23:03:00Z  21.2h ago  (cadence 24h + grace 3h)    ok
04  last 2026-10-10T18:10:00Z   2.1h ago  (cadence 4h + grace 1h)     ok
05  last 2026-10-11T14:25:00Z -18.1h ago  (cadence 24h + grace 3h)    ok
MISSED: 1 station(s)
```

The negative `-18.1h` on 05 is the mis-dated filename 04 filed as its F2, not a future run.

**Freshness crossed against `lastRunAt`** (scheduled-tasks MCP, the only live schedule):

| station | `lastRunAt` | `nextRunAt` | newest breadcrumb | verdict |
|---|---|---|---|---|
| 00 | 2026-10-10T20:14:22Z (this run) | 21:13:52Z | 18:14Z | **MISSED — classified in F1** |
| 03 | 2026-10-09T23:02:54Z | 2026-10-10T23:02:45Z | 2026-10-09-2303 | aligned, within cadence |
| 04 | 2026-10-10T18:09:55Z | 2026-10-10T22:09:31Z | 18:10Z | both fresh and aligned — healthy |
| 05 | 2026-10-10T14:22:59Z | 2026-10-11T14:22:37Z | `…2026-10-11-1425…` | aligned once the +10 h offset is removed |

[MEASURED] my own cron from the MCP is `5 * * * *` — **hourly**. I computed no missed-occurrence
verdict from a pasted cadence. `weekly-security-audit` remains `enabled: false`; live enabled
count is FOUR.

**Preflight 4 — `scripts/pipeline/status-sweep.ps1`.** Section 0 positive controls both `[LIVE]`
PASS (`gh` reached GitHub, saw merged #2308; `node` runs). No `[BROKEN]`. **But it never reached its
SAFE / CAUTION / DO-NOT-ACT verdict — see F2.** Everything quoted below from it is a `[LIVE]` line
it did print.

[MEASURED] **the board, authoritative from GitHub:**

```
OPEN PRs: 2
  #2303  BEHIND  fix(pipeline): refuse a HOLD whose own PR is already open   CI 11 pass / 4 fail
  #2294  BEHIND  fix(pipeline): dedupe section 5 PR crawl, -SkipSection5     CI 13 pass / 2 fail
WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 24h
ALL OPEN (non-draft): 2
main CI on ab62ec04: 4 success / 0 failed / 0 running  (trunk green)
armed (*-ready.md): 0
```

**MARCO_QUEUE_LINE_V1, copied as required:** `WAITING ON MARCO: 2` · `ALL OPEN (non-draft): 2`.
I armed nothing, so these figures are unchanged by me.

[MEASURED] **the previous cycle's board PR landed:** `#2308  2026-10-10 19:21Z  docs(pipeline):
sweep 3 breadcrumb(s)` — so the 18:14Z run's breadcrumb, its rotation commit and the two it
collected are all on `main`, and `sweep-rotation.json` is no longer dirty in the dev tree.

[MEASURED] **the four reads the contract demands of the dev tree:**

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0      PASS
git diff --numstat origin/main                        ->  (empty)  PASS
git diff --cached --name-status                       ->  (empty)  PASS
git status --porcelain                                ->  NOT EMPTY:
   M docs/data-model/metadata-catalog.json
  ?? .codex/ · ?? AGENTS.md · ?? Claude Design/… (4) · ?? docs/pr-reviews/pr-2308-review.md
```

**Only the fourth read catches it.** The index was clean before I touched anything, so no pathspec
commit was needed on that account. `metadata-catalog.json` is the same CRLF/stat smudge over
byte-identical content the 18:14Z run measured and deliberately left; I left it too (F5).

[MEASURED] **the process census, with `Get-Process` deliberately and not CIM**, at 20:32Z:

```
total processes 2194   |   powershell 929   |   claude 14   |   node 9
```

[MEASURED] **all safe-to-act lock signals, read directly in both trees** (because the sweep could
not answer), at 20:32Z:

```
C:\ProjectOperations2\.git\        index.lock False  MERGE_HEAD False  REBASE_HEAD False
                                   CHERRY_PICK_HEAD False  rebase-merge False  rebase-apply False
C:\po-watcher\ProjectOperations\.git\   all six: False
```

[MEASURED] **the machine, from the sweep's `[LIVE]` lines:** watcher node RUNNING pid 16148;
**8 auto-restart wrappers alive, expected 1 (`WRAPPER_COUNT_ANOMALY_V1`)**; heartbeat age 66 min
with an empty queue, which is idle not wedged; watcher clone `branch=main tracked-dirty=0
untracked=3`; **33 non-main worktrees**, nearly all *orphaned (aborted run leftover)*, three holding
21 / 16 / 15 unpushed commits and two holding uncommitted work; `worktree-registry-escapees: 3`;
guard hook present.

## WHAT CHANGED

**Nothing on the board. No arm, no merge, no label added or removed, no branch updated, no
scheduled task touched, no `/sot/` edit, no Azure / Entra / SharePoint contact, no production data,
no process killed, no worktree pruned, no lock cleared.**

- **I did NOT take the board lease**, and that is deliberate: I could not obtain a safe-to-act
  verdict (F2), so I made no mutation that needs one.
- **Appended a dated addendum** to the existing open escalation
  `needs-marco/system-thread-exhaustion-2116-processes-and-cim-is-dead-so-the-safe-to-act-gate-cannot-answer-2026-10-10.md`
  — verified UNTRACKED first (`git ls-files --error-unmatch` → exit 1), so the edit cannot ride into
  another actor's commit. Content is F3 below. **No new `needs-marco/` file was created.**
- **Wrote this breadcrumb** to the dev tree at `docs/pr-prompts/`. 🔴 **It is UNTRACKED and stays
  that way this run** — committing it is itself a git mutation and I have no safe-to-act verdict to
  stand on. **The next sighted Station 00 must sweep it** (`sweep-breadcrumbs.ps1`), along with the
  escalation addendum. Named here so it is not lost, and flagged as the known FF-blocker shape.

## FINDINGS

### F1 — COLLECT: no new station breadcrumb to collect, and the one MISSED station is classified **fired and died BLIND**, not "never fired".

[MEASURED] every breadcrumb in `docs/pr-prompts/` root was already dispositioned by the 18:14Z run
(which collected `…1705` and `…04-scanner-…1810`, the last two uncollected). 04's next occurrence is
22:09Z and 03's is 23:02Z, so **nothing new has been filed since.** The channel is current.

**The 00 MISSED reading, classified as the contract requires** — and the classification needed the
session folder, because `lastRunAt` holds only the most recent run (which is me):

```
local-agent-mode-sessions, -Recurse -Depth 2, no name filter (DOCTRINE §9.5):
  ac4278ee  2026-10-10T16:14:14Z      5604ec82  2026-10-10T18:14:15Z
  f96b4afe  2026-10-10T17:14:28Z      5cadefe9  2026-10-10T19:28:25Z   <-- the MISSED occurrence
  61b0f6a4  2026-10-10T18:09:55Z      868b43d5  2026-10-10T20:14:22Z   <-- this run
```

**A session folder EXISTS for 19:28Z, so this is `fired and died`, NOT `never fired`.** Its
transcript (38 lines, 852 KB, last write 19:30:54Z — a 2.5-minute run) opens its final assistant
turn with:

```
BLIND: bash failed on resume, create, and re-resume. resume: VM guest is not connected.;
create: VM guest is not connected.  and  plugin:desktop-commander:desktop-commander
(CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"
… Station 00 — Supervisor, run of 2026-10-11: BLIND. Run ended at STEP 1.
```

So it **lost both named transports in the same minute** and stopped correctly at STEP 1. It is not
an unexplained silence, and **no station needs to re-do its work** — I am the next occurrence and
have covered the window.

**DISPOSITION: ACTIONED.** Classified, and the class is one the contract already allows. I did not
disable, enable, re-run or edit any scheduled task on this reading — DOCTRINE §7 forbids it. **Two
consecutive `never fired` readings would be the escalation trigger; this is not one of them.**

🔧 **But it cost a breadcrumb, and that part is fixable.** That run had `Read`/`Write` available
(`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`, STATION-CAPABILITIES §3 — measured on 2026-09-10 by a
Station 00 run in exactly this double-transport failure, which wrote its breadcrumb through `Write`).
It did not reach for them, so its report reached nobody and `--freshness` now reads MISSED — which
is **indistinguishable from `never fired`**, the reading that escalates. **DISPATCHED to the station
contract via F6.**

### F2 — `status-sweep.ps1` no longer prints a wrong number at the safe-to-act gate. It HANGS. No scheduled run can obtain the verdict Station 00 arms and merges behind.

**S1 — it is the gate on every board mutation, and it is now unobtainable rather than wrong.**

[MEASURED] twice this run. The sweep printed sections 0, 1 and 2 in full, reached the
`==================== 3. IS THE BOARD BUSY? (safe-to-act gate …` header, and then produced
**nothing further for 13 minutes** before I stopped reading. 04 measured the same stall at 947 s
inside `Get-CimInstance`; the 18:14Z run, 2 hours ago, got a *completed* sweep that printed a
**wrong** `[INFO] headless claude-code sessions: 0` after an `HRESULT 0x800706be` RPC failure.
**So the failure has moved from "fails loud then lies" to "does not return".**

⚠️ **One instrument lie of my own, recorded because it is the §7 shape.** My first sweep call piped
through `| Out-String -Width 220` and produced **zero output for 11 minutes**. That was not the
sweep hanging — `Out-String` buffers its entire input before emitting anything. I re-ran without the
pipe and got 156 lines immediately. **A reader who had trusted the first call would have reported a
total sweep failure at section 0, two sections earlier than the truth.**

**DISPATCHED to Station 04** (next occurrence 22:09Z), which owns this instrument finding already
(`00-04-scanner-2026-10-10-1410-…-and-a-silenced-cim-call-in-the-sanctioned-liveness-probe`), **with
the cure now measured — see F3 item 4: `Get-WmiObject` answers on this box where `Get-CimInstance`
does not.** The gate is not unobtainable in principle; the sweep calls the wrong cmdlet.

### F3 — The process storm's 929 shells are now ATTRIBUTED, every one of them to the eight wrapper PIDs. And WMI answers where CIM is dead, which makes one cure in-lane.

**S1 — this is the single biggest blocker on this board, and the remedy is destructive, so it is Marco's.**

[MEASURED] 2026-10-10T20:32Z. Third consecutive worsening reading:

| | 04 @ 14:34Z | 00 @ 16:4xZ | **00 @ 20:32Z** |
|---|---|---|---|
| total processes | 2019 | 2116 | **2194** |
| powershell | 834 | 883 | **929** |

[MEASURED] `Get-WmiObject -Class Win32_Process -Filter "Name='powershell.exe'"` grouped by
`ParentProcessId` — **929 rows, every one a child of a wrapper the sweep flags under
`WRAPPER_COUNT_ANOMALY_V1`**, and the eight parents are exactly the eight wrapper PIDs it printed:

```
parent=35512  children=473      parent=59548  children=38
parent=2068   children=201      parent=94620  children=20
parent=78320  children=86       parent=48456  children=17
parent=18460  children=65       parent=74456  children=16
```

Sample command line: `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File
"C:\po-watcher\watcher-launcher-singlelane.ps1"`. Start times (local) span 10-10 11:00 continuously
to this minute at ~40–140/hour for ~19 h. **Step 4 of the escalation's MECHANISM is therefore no
longer a chain of reasoning: one wrapper has spawned 473 shells that never exited, and nothing
reaps them.**

[MEASURED] **the positive control that changes what is actionable** — same box, same minute:

```
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'"
   -> Get-CimInstance : Call cancelled      HRESULT 0x80041032
Get-WmiObject  -Class Win32_Process -Filter "Name='powershell.exe'"
   -> rows=929   (the grouping above)
```

**WMI is answering; it is the CIM/WinRM path that is not.** So *"no scheduled run can obtain a
safe-to-act verdict while this lasts"* is true of the **sweep as written**, not of the box.
[MEASURED] `scripts/pipeline/status-sweep.ps1` is the **first entry** in
`scripts/pipeline/instrument-lane.json`'s `files` list (that file has keys `files`, `tests`,
`_readme` and no never-list of its own), so the two-call `Get-CimInstance` → `Get-WmiObject` swap,
inside a try/catch printing `[CANNOT MEASURE]` instead of a count, is **IN_LANE and mergeable by
Station 00 without Marco removing a label.**

**ESCALATED — appended to the existing open file, no duplicate created.** The kill is destructive
(DOCTRINE §5.4) and Station 03 is report-only on the machine, so **no agent in this pipeline has the
authority to clear 929 processes.** The addendum sharpens OPTION A step 1 from "re-measure the
wrapper set" into the eight PIDs above, 35512 first, and adds one new one-word question: fold the
CIM→WMI swap into `#2294` (which is open, 24 h old and already edits that same file), or open it
separately after `#2294` lands?

**I did not stage or arm the swap.** `#2294` already modifies `status-sweep.ps1`; a second prompt
against the same file is the collision `#2303`'s own gate exists to refuse, and arming needs the
very safe-to-act verdict this incident prevents. Bringing the question costs Marco one word;
arming into it would have cost a third PR on his queue and a probable conflict.

### F4 — The board is red on exactly two PRs and both reds are Marco's gates, not defects I can fix.

[MEASURED] from the sweep's `[LIVE]` lines and confirmed against the 18:14Z run's per-job log reads
at the same heads (neither PR has moved: both still `BEHIND`, same check counts):

- **#2294 — 13 pass / 2 fail.** Both failures are `CP-26 do-not-merge` and `Approval receipt
  (CP-26)`, i.e. the two gates that exist to hold it for Marco. **It is SOUND.** Third independent
  run to reach that conclusion.
- **#2303 — 11 pass / 4 fail.** The same two, plus two real test failures whose root cause is
  already written up with options in
  `needs-marco/spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`
  (its new `lint-prompt.mjs` gate shells `gh pr list`, which cannot run on a CI runner, so the gate
  fails CLOSED and rejects every HOLD).

**DEFERRED to Marco's release.** Not ESCALATED, because both are already on open escalation files
and duplicating them is how `needs-marco/` reached 56 entries. What would make either urgent: a
`do-not-merge` label removed, at which point `Assert-SmokedOrEscalate` → `Merge-Pr` runs on the next
occurrence — after `#2303`'s real reds are fixed, which is its own escalation's business.

### F5 — `metadata-catalog.json` is still dirty over byte-identical content; I left it, for the second run running, deliberately.

[MEASURED] `git status --porcelain` shows ` M docs/data-model/metadata-catalog.json` while
`git diff --numstat origin/main` is EMPTY — the CRLF/stat smudge the 18:14Z run measured in full
(both blob ids `69214e66…`, `update-index --refresh` declined to clear it).

**DEFERRED, same judgement as the 18:14Z run and for the same reason.** It is a generated artifact
in Station 05's data-model lane, byte-identical to `HEAD`, and the contract's own cure paragraph
warns that reaching for an EOL conversion on this reading is **measured to corrupt a mixed-EOL
blob**. **What would make it urgent: the next `git merge --ff-only` in the dev tree refusing.** The
measurement is already done for whoever runs the one raw-Buffer write.

### F6 — A blind run that loses BOTH named transports currently files nothing, and `--freshness` then reads MISSED — the same reading as `never fired`, which is the one that escalates.

**S2 — it corrupts the only freshness instrument the pipeline has, in the direction of a false alarm.**

[MEASURED] in F1: the 19:28Z occurrence lost Desktop Commander and the sandbox bash together,
declared BLIND, and ended at STEP 1 with no breadcrumb. Six other blind runs today DID file one
(0716, 0815, 0915, 1114, 1514, 1705) — so the behaviour is not uniform, and the difference is
whether the run reached for `Read`/`Write`.

The capability is recorded and measured (`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`,
STATION-CAPABILITIES §3, measured 2026-09-10 in this exact double failure) — but it lives in a file
the PREFLIGHT's STOP clause tells a blind run it is finished before it reads. **The STOP wording is
what needs one line, not the capability.**

**DISPATCHED to the station contract, for Station 04 or 05 to carry as a docs PR** (one line, inside
`tests|docs`, so it needs no receipt and no release): the PREFLIGHT STOP should read *"write one
paragraph saying you are blind — through `Write` if both the shell and the mount are gone — name
what you could not reach, and END THE RUN"*, so a blind run's last act is a breadcrumb rather than a
chat message nobody reads. **RULE 1:** that is complete (it removes the class — every future
double-transport failure files) and additive (a wording change to a contract, no gate behaviour, no
data). The alternative, teaching `--freshness` to treat a dead-session folder as "reported", fails
the complete half: it would hide genuine dead runs.

### F7 — 33 orphaned worktrees, three holding 21 / 16 / 15 unpushed commits, two holding uncommitted work, plus 3 registry escapees.

[MEASURED] from the sweep's `[LIVE]` classification, unchanged from the 18:14Z reading. Ages
~2,263 to ~23,813 min. `C:/po-wt/fv2drop` 21 commits · `C:/po-wt/s8h` 16 · `C:/po-wt/rcpt-2183` 15.
Uncommitted work in `C:/po-worktrees/sup-cwd-paths` (2 files) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 file).

**DISPATCHED to Station 03** (next occurrence 2026-10-10T23:02Z), whose lane this is and which is
**report-only** there. Two cautions from the sweep's own output: `git worktree remove` will refuse
the two dirty ones and `--force` would discard real work; and a squash-merged branch also shows as
"holds N commits on no remote branch", so each must be confirmed with
`gh pr list --head <branch> --state merged` before anything is pruned. **I pruned nothing.**

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry `do-not-merge`, which **only Marco removes**, and
  CP-26's own job names the label as the cause. Nothing was mergeable, so `Assert-SmokedOrEscalate`
  and `Merge-Pr` were not called. No QUEUED PR from a prior run to confirm.
- **Did not remove a `do-not-merge` label, and did not merge a watcher-routed PR.**
- **Did not call `gh pr update-branch`** on #2303 or #2294 although both read `BEHIND` — the
  watcher's auto-update timer is off and a stray update-branch costs a full CI rebuild on a PR I am
  not about to merge.
- **Did not arm anything.** `armed: 0`. Two independent reasons, either sufficient: no safe-to-act
  verdict was obtainable (F2), and the SPENT_HOLD question governing the remaining HOLDs is still
  open with Marco. MARCO_QUEUE_LINE figures are copied above regardless.
- **Did not take the board lease**, because I made no mutation that needs one. The lock signals
  were measured clean in both trees anyway, and quoted above.
- **Did not commit or sweep this breadcrumb.** It is untracked in the dev tree and the next sighted
  Station 00 must sweep it with `sweep-breadcrumbs.ps1`. I name it here, and I name the FF-blocker
  risk the contract warns of, rather than reaching for a commit I cannot gate.
- **Did not create a single `needs-marco/` file.** The storm, both PRs' reds, the blindness and the
  breadcrumb-date question are all existing open files; I searched the folder (56 entries) before
  writing anything. The one append went to a file verified UNTRACKED first, per the contract's
  `git ls-files -- docs/pr-prompts/needs-marco/` rule (14 of 60 are tracked and `git check-ignore`
  cannot tell you which).
- **Did not retire any `[STALE]` escalation.** The sweep never reached section 5, so I have **no
  measurement** of which rows it would flag — `[CANNOT MEASURE]`, and I did not substitute a guess.
  `retire-escalation.mjs` was not called and nothing was deleted.
- **Did not archive any breadcrumb to `docs/pr-prompts/archive/`.** The root holds this cycle's
  files and `#2308` has just landed the previous ones; archiving them is a `git mv` batch, i.e. a
  mutation, and the gate was unobtainable.
- **Did not kill a process, prune a worktree, clear a lock, or restart the watcher.** 929 shells and
  8 wrappers is a destructive remedy (DOCTRINE §5.4) and killing by image name is forbidden
  (§9.5); the machine is 03's lane and 03 is report-only there. No lock existed to clear.
- **Did not touch any scheduled task** — not enabled, disabled, re-run or edited, on a MISSED
  freshness reading that DOCTRINE §7 explicitly forbids acting on.
- **Did not rename `…00-05-sot-keeper-2026-10-11-1425…`** despite its date being a day out
  (DOCTRINE §10.5: one identity for life; `check-breadcrumb.mjs` matches by basename).
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported
  itself INERT (exit 2) and I treated that as no licence at all; every `git` ran in a host shell.
- **Did not run `git checkout .`, `reset --hard`, `stash pop`, `git clean` or
  `git checkout -- <path>`** anywhere, and did not touch `C:\po-watcher\ProjectOperations`.
- **Did not write `breadcrumb-clean`** — `check-breadcrumb.mjs` was run (`--freshness`, exit 2, its
  output quoted in full) and its structure pass admitted 14 of 14 with 0 malformed, but exit 2 is
  not a clean verdict and I am not reporting it as one. I quoted no `lint-prompt.mjs` verdict on a
  breadcrumb; it rejects them by design and proves nothing either way.
- **Did not write to any of the five gitignored sinks** under `.gitignore`'s
  `# Overnight-QA scheduled task` comment, and **did not leave this report in the Cowork session's
  `outputs` folder** — the measured 2026-09-22 way for a report to reach nobody.
- **No Azure / Entra / SharePoint contact of any kind. No production data read or written.**

## FOR MARCO

Two things, and the first is the only one that matters.

1. **The box is in thread exhaustion and it is now self-amplifying through eight watcher wrappers.**
   929 `powershell` processes, 2,194 total, and I have attributed **every one of the 929 to the eight
   wrapper PIDs** — 473 to pid `35512` alone, all running `watcher-launcher-singlelane.ps1` and never
   exiting. The open escalation
   `needs-marco/system-thread-exhaustion-2116-…-2026-10-10.md` carries your A/B/C options; I have
   appended the PID list so OPTION A step 1 is a list, not a search. **The kill needs your hands —
   it is destructive and no station may do it.**
2. **One new question, one word of answer.** `Get-WmiObject` answers on this box where
   `Get-CimInstance` fails, so the safe-to-act gate is fixable without waiting for the kill — and
   `status-sweep.ps1` is inside the instrument lane, so I can merge that fix myself. But `#2294` is
   already open and already edits that file. **Fold the CIM→WMI swap into `#2294`, or open it
   separately after `#2294` lands?** Folding it in keeps your queue at two PRs.

Everything else is unchanged and waiting on you: **#2294 is sound** (its only two reds are the
`do-not-merge` gate and the receipt that gate implies), **#2303 has a real defect already written up
with options**, and the queue is **0 armed** — I am still holding the remaining HOLDs until the
SPENT_HOLD question is answered, because either answer changes arming behaviour for all of them.
