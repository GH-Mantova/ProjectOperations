# Station 00 — Supervisor | 2026-10-11T17:14Z–2026-10-11T18:20Z

## GROUND

```
UTC            2026-10-11T17:14:18Z (scheduler lastRunAt) · host clock read 2026-10-11T18:00:28Z mid-run
origin/main    bf245896   (fetched at run start; after this run's merge, main is 8720c074)
dev tree       DETACHED HEAD @ b60bf285   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      1   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 == 1) — this run was not read-only on that account.
Sighted run: Desktop Commander reached the Windows host on the first `start_process` after one
keyword `ToolSearch` for `desktop-commander`.

## WHAT I MEASURED

**Reachability.** [MEASURED] `ToolSearch` for `desktop-commander` loaded the toolkit; `start_process`
with shell `cmd` returned `PROBE_OK`. NOT blind.
⚠️ [MEASURED] `powershell.exe -NoLogo -NoProfile` as an *interactive* session (PID 153072) and
`powershell.exe -NoProfile -Command "..."` as a one-shot (PID 106500) BOTH produced **zero output**
across 110 s of `read_process_output`; the same probe through `shell: cmd` answered immediately.
Every later PowerShell call in this run therefore went through `cmd` invoking
`powershell.exe -File <script.ps1>`, which worked. Recorded because the bootstrap's STEP 1 names
`start_process, shell powershell.exe` as the liveness probe, and on this box that exact form is the
one that looks dead.

**Device-bridge git guard — [CANNOT MEASURE].** The guard install
(`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`) could not be run: the
sandbox returned, twice, `Workspace unavailable. The isolated Linux environment failed to start
(Request timed out: startVM)`. **No installer last line and no installer exit code exist for this
run.** The guard's own purpose is unaffected in practice: with no VM there is no mount transport, so
the §9.2 device-bridge `git` vector was structurally absent, and every `git` call this run made was
native Windows git through Desktop Commander, which is the sanctioned transport.

**Binding reads.** [MEASURED] all three read from `git show origin/main:<path>` in the DEV TREE after
`git fetch origin` (exit 0, `FETCH_OK`, `git rev-parse origin/main` -> `bf245896…`), written to
`%TEMP%` and read with Desktop Commander `read_file`: `docs/pipeline/stations/00-supervisor.md` (466
lines, `station_doc_version: 1`, `contract_version: 5`), `docs/pipeline/DOCTRINE.md` (508 lines),
`docs/pipeline/STATION-CAPABILITIES.md` (740 lines). No REFERENCE file was opened; no core line sent
me to one.
⚠️ [MEASURED] a bare `git fetch origin --quiet` took **146 s** on this box and a combined
`fetch`+`rev-parse`+`status` call was killed at the 180 s MCP ceiling. Every subsequent probe was
split into single-purpose scripts for that reason.

**Freshness / structure — CLEAN.** [MEASURED] `node scripts\pipeline\check-breadcrumb.mjs
--freshness` -> `structure: 17 checked, 0 malformed, 0 skipped`; freshness `00 ok`, `03 18.4h ago ok`,
`04 3.2h ago ok`, `05 ok`; trailer `CLEAN`, `FRESHNESS_EXIT=0`. No station is MISSED. So
`breadcrumb-clean` is written here against a quoted `check-breadcrumb.mjs` run, not against
`lint-prompt.mjs`.
⚠️ Two of its five rows print a NEGATIVE age — `00 last 2026-10-12T16:37:00Z -23.1h ago` and
`05 last 2026-10-12T14:10:00Z -20.6h ago`. See F5.

**Cadence cross-check.** [MEASURED] `list_scheduled_tasks`: four enabled tasks —
`00-supervisor 5 * * * *` (`lastRunAt 2026-10-11T17:14:18.685Z`, i.e. this run),
`04-scanner 0 */4 * * *` (`14:09:54Z`), `05-sot-keeper 10 0 * * *` (`14:25:31Z`),
`03-machine-minder 0 9 * * *` (`2026-10-10T23:03:44Z`); `weekly-security-audit` `enabled: false`,
`lastRunAt 2026-09-06`. Every `lastRunAt` aligns with a breadcrumb of the same hour — the healthy row
of the station doc's freshness table. **Hourly confirmed from the MCP, not from a pasted cadence.**

**Board.** [MEASURED] `gh pr list --state open --json number,title,labels,mergeStateStatus,isDraft`:
four open, none draft — `#2313` CLEAN no labels, `#2312` CLEAN no labels, `#2303` BEHIND
`do-not-merge`, `#2294` BEHIND `do-not-merge`. Per-PR detail via `gh pr view … --json
files,headRefOid,statusCheckRollup` parsed with `node` (never a piped `--jq`):

- `#2312` head `5ed8d3e6`, **15 checks / 0 not-green**, 13 files, **every one under `docs/`**
  (12 breadcrumbs + `docs/pr-reviews/pr-2311-review.md`).
- `#2313` head `98eb360a`, **15 checks / 0 not-green**, 1 file, `docs/pipeline/sweep-rotation.json`.

Both are docs-only, so CP-26 is not armed by their diff (CP26_ARMED_BY_DIFF_V1 fires on a migration
or a file outside `tests/`|`docs/`), and both sit inside Station 00's recorded `docs/`-only merge lane
(STATION-CAPABILITIES §5). Neither is watcher-routed (both are board-tooling branches,
`chore/sweep-breadcrumbs-20261011-1641` and `chore/commit-station-04-sweep-rotation-state`), so
DOCTRINE §10.1 step 3 applies and the §5 hard stops were checked by hand: no migration, no production
data, no auth, no human identity, no Azure/Entra/SharePoint.

**Safe-to-act inputs, measured directly because the sweep never produced a verdict (F2).**
[MEASURED] `Get-ChildItem -Force C:\ProjectOperations2\.git -Filter *.lock` -> **no lock file at all**
(so no stale-lock age/byte question arises); `Test-Path .git\MERGE_HEAD` / `rebase-merge` /
`rebase-apply` -> `False`,`False`,`False`; the only armed files in `docs\pr-prompts\` were
`rev-2312-ready.md` and `rev-2313-ready.md`, which DOCTRINE §9.5 records as auto-generated **review
jobs, not prompts** — so no prompt build was in progress; the two PRs I was about to touch were last
written at 16:41Z and 16:44Z, ~60 min before the merge, not within the ~2 min recent-activity window.
The board lease was taken by `Merge-Pr` itself with `-Actor 'station-00.scheduled'` and
`$env:PO_ACTOR` set to the same string (the 2026-10-09 #2279 trap), and it was never refused.

**Watcher liveness — the sweep's line is FALSE, with a positive control.** [MEASURED]
`status-sweep.ps1` printed, as its section 2 verdict:
`[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain` — **immediately after** its own
unhandled exception at `status-sweep.ps1:263`:
`$w = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Wher ...` →
`CimException, FullyQualifiedErrorId : HRESULT 0x800700a4`. 0x800700a4 is
`ERROR_NO_SYSTEM_RESOURCES` — the CIM call did not answer, so the `$w` the verdict is computed from is
an empty array for want of an answer, not for want of a watcher.
POSITIVE CONTROL, the same minute, through a different instrument: `C:\po-watcher\ensure-watcher.log`
last line `2026-10-11T11:14:21Z  watcher alive, pid(s) 97560`, and `Get-Process -Id 97560` ->
**ALIVE, name=node, start=2026-10-10T22:02:39Z**. The watcher node IS running. [INFERRED] the sweep's
section 2 cannot distinguish "no watcher" from "CIM refused to answer", and prints the first.

**Host resource state.** [MEASURED] `Get-Process`: **total processes 2427**, of which **2085** match
`powershell|pwsh|conhost|cmd`; `node.exe count=9`. [MEASURED] the watcher's newest log,
`…\pr-watcher\logs\supervisor.log`, tail: `Identical consecutive failures: 1 of 5.` /
`Restarting in 60 s.` / `Restarting in 60 s.` repeated at `2026-10-12T04:00:25+10:00`
(= 18:00:25Z) — **duplicated lines at the same instant, i.e. more than one watchdog writing**.
[MEASURED] `docs/pr-prompts/needs-marco/` holds **69** files, **21** of them
`WATCHER-CRASH-LOOP-*`, and **15** of those 21 are dated 2026-10-11 or 2026-10-12.

**Dev tree.** [MEASURED] `git rev-parse --abbrev-ref HEAD` -> `HEAD` (detached); `.git/HEAD` ->
`b60bf285d4fe1e9a0b7334ed918a1a9e3f94de89`; `refs/heads/main` -> `bf245896` (stale);
`git rev-list --left-right --count HEAD...origin/main` -> `1	0`; `git diff --numstat` EMPTY;
`git diff --cached --name-status` EMPTY; `git status --porcelain` shows only untracked
`.codex/`, `AGENTS.md`, and three `Claude Design/…` paths.
`git log origin/main..HEAD --oneline` -> the single commit `b60bf285 docs(pipeline): sweep 13
breadcrumb(s) 20261011-1641`, author `PR Supervisor <supervisor@local>`, `2026-10-12T02:41:41+10:00`
— the FIRST commit of the branch that became `#2312`, whose pushed head was `5ed8d3e6`. Because
`#2312` was **squash**-merged, `b60bf285` is not an ancestor of the new `main`: the dev tree is parked
on an orphaned pre-squash commit. `git reflog` names when and by what:
`b60bf285 HEAD@{2026-10-12 04:04:44 +1000}: checkout: moving from main to b60bf285…` — **18:04:44Z,
inside this run, and not a command I issued.** `git worktree list` -> 34 worktrees, dev tree first.

**Clock.** [MEASURED] `[DateTime]::UtcNow` -> `2026-10-11T18:00:28Z`; `(Get-Date)` ->
`2026-10-12T04:00:28`, `[TimeZoneInfo]::Local.Id` -> `E. Australia Standard Time`. The host clock is
**correct and internally consistent**; the whole of the apparent "24h skew" is the +10:00 Brisbane
offset crossing local midnight. The scheduler agrees (`lastRunAt 2026-10-11T17:14Z`) and so does
`status-sweep` (`generated 2026-10-11 17:32:02Z`).

## WHAT CHANGED

- **`#2312` MERGED.** `Assert-SmokedOrEscalate -PR 2312` PASS, then `Merge-Pr -PR 2312 -Actor
  'station-00.scheduled'` -> `State=MERGED`. Read back independently:
  `gh pr view 2312 --json state,mergedAt,mergeCommit` ->
  `{"mergeCommit":{"oid":"8720c074e77b36c61533c1097e5d6870b912588e"},"mergedAt":"2026-10-11T17:47:11Z","state":"MERGED"}`.
  That landed 12 station breadcrumbs and `docs/pr-reviews/pr-2311-review.md` on `main`.
- **`#2313` QUEUED — NOT merged.** First attempt threw inside `Merge-Pr`:
  `#2313 has mergeStateStatus 'UNKNOWN' -- unexpected; read the PR by hand` (GitHub was recomputing
  mergeability seconds after `#2312` landed). Re-read by hand -> `BEHIND`. Second attempt:
  `Assert-SmokedOrEscalate` PASS, `Merge-Pr -PR 2313 -Actor 'station-00.scheduled'` -> `State=QUEUED`.
  Read back: head advanced `98eb360a` -> `3734c2d6`, `autoMergeRequest.mergeMethod=SQUASH`,
  `enabledAt 2026-10-11T17:56:08Z`, `state OPEN`, `mergeStateStatus BLOCKED` (checks re-running on the
  fresh head). **UPDATE_AT_MERGE_TIME_V1: the next run confirms MERGED. QUEUED is not merged.**
- **MARCO_QUEUE_LINE_V1 figures, as the sweep printed them before it hung:**
  `WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 45h` ·
  `ALL OPEN (non-draft): 4; oldest #2294, open 45h`. **I armed nothing**, so this run added **zero**
  PRs to Marco's queue; after the two merges the open board is `#2294` and `#2303`, both his.
- Three scratch scripts written under `C:\po-sup-fix-scripts\` (`st00-merge-…`, `st00-merge-2313-…`,
  `st00-collect-…`, `st00-tree-…`, `st00-head-…`).
- **This breadcrumb**, written UNTRACKED into the dev tree at `docs/pr-prompts/`. It is not in a PR,
  so `sweep-breadcrumbs.ps1` must pick it up — Station 00, sweep it.
- Nothing else. No prompt armed or disarmed, no label added or removed, no escalation retired, no
  `/sot/` edit, no watcher or process touched, no `gh pr update-branch` on a PR I was not merging.

## FINDINGS

### F1 — `status-sweep.ps1` launders a dead CIM call into `[LIVE] watcher node: NOT RUNNING`, and the watcher is alive

The exception at line 263 and the verdict are quoted above; the positive control (`pid 97560` ALIVE,
`ensure-watcher.log` "watcher alive") refutes the verdict. This is the **third independent
reproduction** — 04 filed it on 2026-10-10 1410 ("a silenced CIM call in the sanctioned liveness
probe") and again on 2026-10-11 1011 and 1421 — and it is the DOCTRINE §7 shape exactly: a broken
instrument handing out a confident, coherent, wrong negative, in the one line the safe-to-act gate
is read from. The cure is not mine to land: the sweep is `scripts/pipeline/**`, outside Station 00's
`docs/` lane, and the two open PRs that touch the sweep (`#2294`, `#2303`) both carry
`do-not-merge`, which only Marco removes.

**DISPOSITION: ESCALATED** — see `## FOR MARCO`, option A.

### F2 — the sweep never returned a verdict at all: 31+ minutes, no SAFE / CAUTION / DO-NOT-ACT line

[MEASURED] `status-sweep.ps1` started at 17:32Z, produced sections 0, 1 and a broken section 2, and
was still `Blocked: true` at 1611 s runtime when I stopped polling; it never reached its section 5 PR
crawl verdict. The station doc's PREFLIGHT step 4 says *run it and obey it*, so a sweep that cannot
finish removes the gate rather than failing it. I did not substitute the sweep's own verdict: I
measured its four inputs directly (lock files, `MERGE_HEAD`/rebase state, armed prompts, recent PR
activity) and recorded them under WHAT I MEASURED as the basis for acting. `#2294` — *dedupe section 5
PR crawl and add `-SkipSection5`* — is exactly this fix, and it is both `do-not-merge` and RED
(sweep line: `CI: 13 pass / 2 fail / 0 pending`).

**DISPOSITION: ESCALATED** — same question as F1, option A. The 2 red checks on `#2294` are root-cause
work for the next sighted run and are **DEFERRED** to it (a green `#2294` is what makes releasing it
a one-step decision for Marco).

### F3 — host thread exhaustion is worse, not better: 2427 processes / 2085 shells, and the watchdog is in a 60-second restart loop with duplicate writers

Figures above. This is the measured cause of F1's `0x800700a4`, of this run's dead PowerShell probes,
and — per the 2026-10-11 0815/0943/1023 breadcrumbs — of seven consecutive blind Station 00 runs on
2026-10-10/11. The 0943 and 1023 runs root-caused it to an **unreaped watchdog `Start-Job`** and then
refuted their own kill precondition within the hour. Twenty-one `WATCHER-CRASH-LOOP-*` escalations
exist, fifteen of them in the last two days, which is the loop writing its own evidence. Killing ~2000
processes is destructive (DOCTRINE §5.4) and machine repair is not Station 00's row in the authority
matrix (00 ❌, dispatches 03; 03 is ⚠️ report-only), so **nobody in the matrix may clear this** —
which is itself the finding.

Already filed:
`needs-marco/system-thread-exhaustion-2116-processes-and-cim-is-dead-so-the-safe-to-act-gate-cannot-answer-2026-10-10.md`.
Re-measured today at 2427/2085, up from 2116. I did not retire or edit that file.

**DISPOSITION: ESCALATED** — see `## FOR MARCO`, option B. Also **DISPATCHED to Station 03**
(next occurrence 2026-10-11T23:02Z): read `supervisor.log`'s duplicate `Restarting in 60 s.` writers
and `ensure-watcher.log`'s wrapper ancestry, and report how many watchdog wrappers are live — a count,
not a kill.

### F4 — the shared dev tree was moved to a DETACHED HEAD on an orphaned pre-squash commit, at 18:04:44Z, by an actor that was not me

`b60bf285` is the first commit of `#2312`'s branch; `#2312` was squash-merged, so that commit is now
unreachable from `main`, and `refs/heads/main` locally still reads `bf245896`. Consequences, all of
them traps this pipeline has already paid for: local git reads in the dev tree are stale while
`--numstat` and `--cached` both read EMPTY (the documented PASS reading), and
`git merge --ff-only` will refuse. The reflog timestamp lands **one minute** before my own
measurement, inside my run, from a `checkout` I did not issue — which under BOARD DRIVING condition 3
is the LL-38 signal, not a tidy-up invitation. **I therefore stood down from all further board
mutation** after the two merges (which completed at 17:47Z and 17:56Z, before 18:04:44Z) and did not
restore `main`, fast-forward, or run any `git checkout`.

⚠️ **And it already corrupts a reading this contract depends on.** [MEASURED] after `#2312` merged,
`node scripts\pipeline\check-breadcrumb.mjs <this file>` printed
`NOTE  … is UNTRACKED — it reaches nobody until a board PR commits it` against **twelve breadcrumbs
that `#2312` had just landed on `main`**, alongside `structure: 30 checked, 0 malformed` / `CLEAN` /
exit 0. The validator builds its tracked set from `git ls-tree -r --name-only origin/main`, and the
dev tree's `origin/main` is the stale `bf245896` — so every one of those UNTRACKED notes is false, and
the one true UNTRACKED note (this breadcrumb) is indistinguishable from them. A run that trusts those
notes re-sweeps work already on `main`.

**DISPOSITION: DEFERRED** — to the next sighted run that finds the board lease free and no second
actor in the reflog within the last ~10 minutes. It becomes **urgent** the moment a board PR needs to
land a path the fast-forward must create, because that is when the refusal starts blocking every
station. The cure is the station doc's four-step unblock (raw-Buffer node restore, `update-index
--refresh` read per-path, then all four read-backs) — never `git checkout -- <path>`, never
`git clean`.

### F5 — breadcrumb filenames take their DATE from the host's local clock and their TIME from UTC, so `--freshness` reads live stations as up to 23 h in the future

[MEASURED] `--freshness` printed `00 last 2026-10-12T16:37:00Z -23.1h ago` and
`05 last 2026-10-12T14:10:00Z -20.6h ago`, from the names
`…-2026-10-12-1637-…` and `…-2026-10-12-1410-…`. The host clock is correct (18:00:28Z UTC /
04:00:28 local, UTC+10): those two runs stamped the **local date** beside the **UTC time**. 04 named
this on 2026-10-10 1810 and the 2026-10-11 0114 run used it to refute 04's "dark station" claim, so
the diagnosis is settled; what is missing is a mechanical guard. Note the direction of the error:
a future-dated breadcrumb makes a station look *fresher* than it is, so this can only ever hide a
missed run, never invent one.

**DISPOSITION: ACTIONED for this run — DEFERRED for the cure.** ACTIONED: this breadcrumb is stamped
`2026-10-11-1800` from the host's own `[DateTime]::UtcNow` (`2026-10-11T18:00:28Z`, quoted above),
not from the session's date. DEFERRED: the general fix is a `check-breadcrumb.mjs` rule rejecting a
name dated in the future, which is `scripts/` and so needs an armed prompt — and arming was off the
table this run under F4.

### F6 — the device-bridge git guard could not be installed, two attempts, because the sandbox VM would not start

Quoted above. Per the station doc's three-outcome table this is **a FINDING, not a STOP**, and the
missing protection is remembered rather than mechanical in any case. The honest reading is
[CANNOT MEASURE] on the installer's last line and exit code, with the mitigation that no mount
transport existed to guard.

**DISPOSITION: DEFERRED** — the guard matters only on a run that has the VM; the next such run
installs it and quotes the exit code. It becomes urgent if a run ever reports the VM back AND a
0-byte `index.lock` appears in the same cycle.

### F7 — the review lane is not draining: `rev-2312-ready.md` and `rev-2313-ready.md` sat armed for ~70 minutes while the watcher node was alive

[MEASURED] `rev-2312-ready.md` LastWriteTimeUtc `2026-10-11T16:46:06Z`, `rev-2313-ready.md`
`16:51:27Z`; both still present at 18:02Z, with `pid 97560` alive and `supervisor.log` in a
`Restarting in 60 s.` loop. [INFERRED] the watcher process being alive is not the same as the review
lane consuming its jobs, and F3's restart loop is the likeliest reason it is not. I did not clear,
rename or re-arm either file — they are the watcher's, not mine.

**DISPOSITION: DISPATCHED to Station 03** (2026-10-11T23:02Z), with F3: report whether the review
lane consumed `rev-2312-ready.md` / `rev-2313-ready.md` and, if not, which wrapper is supposed to.

## WHAT I DID NOT DO

- **Did not archive the eleven breadcrumbs the 16:37Z run collected**, nor this cycle's, to
  `docs/pr-prompts/archive/`. That needs a board PR with `git mv`, i.e. a board mutation, and F4
  stood me down. 29 breadcrumbs now sit at depth 1 in `docs/pr-prompts/`; `check-breadcrumb.mjs`
  matches by basename, so none of them is lost to `--freshness` by waiting.
- **Did not restore `main` or fast-forward the dev tree** (F4). A second actor's `checkout` one minute
  before my read is the LL-38 collision signal, and condition 3 says STOP, not tidy.
- **Did not touch the process storm, the watchdog, or the watcher** (F3) — destructive, and not
  Station 00's row in the authority matrix. Dispatched to 03 as a count, not a kill.
- **Did not merge, update, relabel or rebase `#2294` or `#2303`.** Both carry `do-not-merge`; only
  Marco removes it. I did not call `gh pr update-branch` on either — the watcher's BEHIND timer is
  off by default and a stray update costs a full CI rebuild.
- **Did not arm anything.** No `arm-prompt.ps1` call, so no `NEVER-LIST` check was needed and Marco's
  queue is unchanged at two.
- **Did not re-run the hung sweep hoping for green** (DOCTRINE §2), and did not quote its section 5
  verdict, which never printed.
- **Did not clear any `[STALE]` escalation row.** The sweep's section 5 is where those are tagged and
  it never ran; re-asking 69 `needs-marco/` files individually was not affordable against this box's
  ~180 s-per-call ceiling. **DEFERRED** to the next run with a working sweep.
- **Did not open a PR for this breadcrumb.** It is untracked in the dev tree; the next sweep tracks it.

## FOR MARCO

Two questions, both blocked on you, both stated with the complete-and-additive option first
(RULE 1).

**A. The safe-to-act gate is reading from a broken instrument, and the fix PRs are label-held.**
`status-sweep.ps1` prints `watcher node: NOT RUNNING` out of a CIM call that threw
`0x800700a4` (F1), and it no longer finishes at all (F2). Three stations have now reproduced it.

- **A1 (complete + additive — recommended).** Release `#2294` (*dedupe section 5 PR crawl and add
  `-SkipSection5`*) once Station 00 has driven its two red checks green, AND let Station 00 arm one
  further prompt that makes section 2 **fail loud**: if the CIM/WMI query throws, print
  `[BROKEN] watcher liveness UNMEASURED: <error>` instead of a `[LIVE]` verdict, and have section 0's
  positive-control block fail with it. Solves it now (the sweep finishes) and in future (a dead probe
  can never again print a live verdict); additive — no existing reading changes polarity, one new
  `[BROKEN]` line appears.
- **A2 (fast, fails the future half).** Release `#2294` alone. The sweep finishes again, but section 2
  keeps laundering a dead call into `NOT RUNNING`, so the next agent to trust it stands the board down
  on a healthy watcher — which is LL-25's exact cost.
- **A3 (fails the immediate half).** Change nothing and have stations measure the four safe-to-act
  inputs by hand, as this run did. It works, but it is five extra calls per station per run on a box
  where each call costs ~180 s, and it leaves the written gate pointing at an instrument nobody obeys.

**B. Nobody in the authority matrix may clear the process storm, and it is now the root cause of
almost every other defect on this board.** 2427 processes / 2085 shells, a 60-second watchdog restart
loop with duplicate writers, 21 `WATCHER-CRASH-LOOP` escalations (15 in two days), CIM and WMI both
exhausted, and seven consecutive blind Station 00 runs on 2026-10-10/11 (F3). Station 00 is ❌ on
"repair the machines" and Station 03 is ⚠️ report-only, so the matrix has no actor for it by design.

- **B1 (complete + additive — recommended).** You reboot the box (or kill the wrapper tree yourself),
  AND grant Station 03 a *narrow, named* repair authority: terminate processes whose command line
  matches the watchdog's unreaped `Start-Job` signature, nothing else, with the count and the
  command line quoted in its breadcrumb before and after. Fixes it now and stops the next recurrence
  needing you at 4 a.m.; additive because it widens exactly one station by exactly one signature and
  leaves every other ❌ in place.
- **B2 (fast, fails the future half).** Reboot only. The board clears today and the loop rebuilds the
  storm, as it has since 2026-10-03.
- **B3 (fails the immediate half).** Leave the authority question open and let 03 keep reporting
  counts. No agent action is needed from you, but the storm keeps blinding stations and the safe-to-act
  gate stays unanswerable.

**A note on what you are NOT being asked.** `#2303` is yours and untouched; I am not asking you to
release it. And `b60bf285` (F4) needs no decision from you — it needs one uncontended sighted run.
