# Station 00 — Supervisor | 2026-09-23T05:14:52Z–2026-09-23T05:40Z

## GROUND

```
UTC            2026-09-23T05:16:11Z
origin/main    29192b77              (fetched, then rev-parse; MOVED to 15542584 mid-run — see F0)
dev tree       main @ 946a23e6       C:\ProjectOperations2   (1 behind at open; fast-forwarded to 15542584)
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — the READ-ONLY-on-mismatch clause did not fire. This run was
**SIGHTED**: Desktop Commander connected on the first call after a keyword `ToolSearch` load.

`[MEASURED]` All three binding documents were read **in full** from the working copy, and the working
copy was first proved identical to `origin/main`: `git diff --numstat origin/main -- <path>` returned
**EMPTY** for `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`. That is PREFLIGHT step 2's requirement satisfied by the
sound probe rather than by a piped hash (§9.1).

## WHAT I MEASURED

**[MEASURED] `vm-git-guard.sh` — exit 2, INSTALLED BUT INERT.** Last line, verbatim:
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
`GUARD_EXIT=2`. That is PREFLIGHT's documented middle outcome and **the expected one for a station**:
a FINDING, not a STOP. The device-bridge git ban was therefore REMEMBERED, not mechanical, for this
run — and it held: no `git` was run through the device bridge against the Windows `.git`.

**[MEASURED] `status-sweep.ps1` — captured to a FILE, because the streamed form truncates.** The first
invocation returned 327 lines ending at the bare `==== 6. BACKLOG GATES ====` header with **sections 6
and 7 absent**, and the shell then reported no active session. Re-run with all streams captured to a
file (`Out-String` then `[IO.File]::WriteAllText` UTF-8, never `>` or `*>` — §9.3's UTF-16LE trap) it
returned **360** lines including the verdict. Quoting section 7:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 positive controls both passed (`gh` reached GitHub, `node` runs). **Section 5 `[STALE]`
rows: 0** — every escalation row was `[FILE]`, so there was nothing for COLLECT to discharge this run.

**[MEASURED] The sweep's trunk line was `[CANNOT MEASURE]`, not red:**
`main CI on 29192b77: 0 success / 0 failed / 4 running`. Nothing had concluded. No regression hunt was
started on it — §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` says re-derive a `[LIVE]` line before
acting on it, and there was nothing to act on.

**[MEASURED] Watcher: alive and correctly idle.** `watcher node: RUNNING pid 9744`, auto-restart
wrapper alive (1), heartbeat age 161 min with `armed: 0`. A stale heartbeat on an empty queue is the
documented IDLE reading, not WEDGED. `restart-watcher-if-wedged.ps1` was **not** run with `-Fix` and
nothing was restarted.

**[MEASURED] Queue census, counted by hand, not quoted:** `armed (*-ready.md): 0` at open ·
`needs-marco/: 44` · `no-pr-opened/: 111` · `failed/: 59` · `blocked/: 150`. `no-pr-opened/`'s two
newest entries are both `pr-scopecards-s7-one-cutting-total-b-ready.md` (17:25Z and a `.disarmed` at
13:28Z on 09-22) — that prompt shipped instead as `#2093` and its HOLD was retired by `#2103`, so
these are spent artefacts of a completed slice, not a live silent no-op.

**[MEASURED] COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`:**

| station | newest breadcrumb | age | cadence | verdict |
|---|---|---|---|---|
| 00 | 2026-09-23T04:14:00Z | 1.2 h | 1 h | ok |
| 03 | 2026-09-22T23:29:00Z | 5.9 h | 24 h | ok |
| 04 | 2026-09-23T02:30:00Z | 2.9 h | 4 h | ok |
| 05 | 2026-09-22T14:23:00Z | 15.0 h | 24 h | ok |

`structure: 3 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP — the
second instrument AUTHORITY requires, because the breadcrumb validator cannot name a cause — every row
agrees: 00 `05:14:52Z` (this run), 03 `2026-09-22T23:28:57Z`, 04 `02:29:58Z`, 05 `2026-09-22T14:23:04Z`.
`weekly-security-audit` remains `enabled: false`. **No station is SILENT and none is mid-run inside my
window.**

**[MEASURED] The tracked-set probe was asked of `origin/main`, never of the dev tree index**
(§9.5's `TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`):
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returned 642 `00-*` breadcrumbs. Matched
by basename, the three loose files in the queue root resolve as:

| breadcrumb | on `origin/main` |
|---|---|
| `…-0248-collect-04-and-clear-the-dev-tree-it-flagged.md` | **tracked at the root path** |
| `…-0315-every-open-pr-is-parked-on-marco-…md` | **tracked at the root path** |
| `…-0414-blind-desktop-commander-connect-timeout-…md` | **NOT ON MAIN** |

So exactly one breadcrumb was genuinely unreported, and the other two are not the 2026-09-07 duplicate
shape — a dev-tree `git status` alone could not have told me that.

**[MEASURED] RULE-2 lane verdicts, taken live this run, never carried forward** (§10.1's
non-monotonic warning). Prompt logs only, `rev-*` excluded:

| PR | hits | verdict line |
|---|---|---|
| `#2109` | 2 | `merge result for PR #2109: {"ok":false,"marco":true,…"escalates:true - held for Marco, labelled do-not-merge"}` |
| `#2107` | 2 | `merge result for PR #2107: {"ok":false,"marco":true,…"escalates:true - held for Marco, labelled do-not-merge"}` |
| `#2108` (POSITIVE control) | 2 | a real `marco:true` verdict |
| `PR #994417` (NEGATIVE control, freshly minted) | **0** | — |

Both open PRs were watcher-opened and both carry a genuine `marco:true` routing.

**[MEASURED] The `do-not-merge` label came OFF both PRs at 04:57–04:58Z — by Marco, 43 minutes after
the blind 04:14Z run wrote its breadcrumb.** Read per-PR, never from a board listing (LL-47), via
`gh api repos/<repo>/issues/<n>/events`:

| PR | labeled | unlabeled |
|---|---|---|
| `#2107` | `do-not-merge` 2026-09-23T00:39:36Z | **2026-09-23T04:57:41Z** |
| `#2109` | `do-not-merge` 2026-09-23T02:24:33Z | **2026-09-23T04:58:44Z** |

Per-PR `labels` on both now read `[]`, and CP-26 passes on both.

**[MEASURED] Marco then merged them himself, mid-run.** `#2108` merged `05:13:14Z`; `#2109` merged
**`05:26:03Z` — 56 seconds before I read it.** `origin/main` moved `29192b77` to `15542584` inside my
own run, and the fast-forward brought in `travel-time.ts`, `TRAVEL_TIME_PORT_V1` and the
merge-approval receipts `docs/decisions/merge-approvals/2108.md` and `2109.md`. Board at close:
**one open PR, `#2107`**, `BLOCKED` only on `tendering-e2e`.

**[MEASURED] The `tendering-e2e` pending check is NOT a stuck job, and the obvious reading is wrong.**
`#2107` was opened `00:39Z`, so `pending 0` invites *"queued 4.7 hours"*. `gh run view` on both runs:
created **`05:13:37Z`** and **`05:13:41Z`**, `status: in_progress` — i.e. **24 seconds after `#2108`
merged**, which re-triggered them. They were 12 minutes old, not 4.7 hours. No stuck-CI finding was
filed.

**[MEASURED] Fast-forward succeeded on the FIRST attempt with the untracked breadcrumb on disk.**
`git merge --ff-only origin/main` printed `Updating 946a23e6..15542584`, `FF_EXIT=0`. All four
read-backs passed together: `git rev-list --left-right --count HEAD...origin/main` gave `0 0`;
`--numstat` EMPTY; `--cached` EMPTY; `git status --porcelain --untracked-files=no` EMPTY.
**No cure was needed** — see F3.

**[MEASURED] `triage-holds.ps1`: 15 HOLD, 0 ADMIT, 0 gates-satisfied, 0 spent — and its own
`!!! SUSPECT: every prompt landed in ONE bucket` warning fired.** I ran the control it demands:
`git` resolves to `C:\Program Files\Git\cmd\git.exe`, `node` to `C:\Program Files\nodejs\node.exe`,
`git rev-parse origin/main` exit 0. **And the warning is a false alarm on this board by
construction:** DOCTRINE §9.5 records that a missing `git` makes `readFromOriginMain` return `null`
and every gate *skip*, which fails **OPEN** — it would produce ADMITs, not REJECTs. Fifteen REJECTs
across **three distinct codes** (`HUMAN_GATE_PRESENT`, `FILE_GATE_NOT_RELEASED`,
`GATE_NOT_RELEASED`) is a discriminating instrument, not a uniform one.

**[MEASURED] `pr-scopecards-s9-transport-capacity-matrix-HOLD.md` flipped to PROMOTE inside this run**,
because the two commits that release it both landed during it:

```
PROMOTE pr-scopecards-s9-transport-capacity-matrix-HOLD.md  (size 6)
  GATE_RELEASED requires_on_main: "apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1"
  GATE_RELEASED requires_on_main: "apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1"
```

Pre-arm checks, all run before the `git mv`:

| check | result |
|---|---|
| premise `! grep -rq "resolveCapacityPerLoad" apps/api/src` | **0 hits, so premise TRUE, so not shipped** |
| POSITIVE control (`quotedTransportRatePerDay` in the same tree) | 25 |
| NEGATIVE control (freshly minted needle) | 0 |
| merged board, `--search TRANSPORT_CAPACITY_MATRIX` | `[]` — no duplicate |
| human-gate grep (`watcher: do-not-arm`, `DO NOT ARM` caps, `Arm ONLY`) | 0 / 0 / 0, and lint says PROMOTE not `HUMAN_GATE_PRESENT` |
| never-arm denylist | not on it |
| `scope:` vs the one OPEN PR `#2107` (§10.6) | `#2107` touches `scripts/pipeline/check-d-register*` only — **zero overlap** |
| single-actor gate, re-taken immediately before acting | newest PR activity `05:26:20Z`, armed at `05:29:49Z` = **3 min quiet**; `index.lock` dev/clone False/False; `git` processes 0 |

**[MEASURED] A second Station 00 lane armed twice earlier tonight.** `.arming-log.txt` records
`01:06:09Z pr-scopecards-s7b-…  actor=station-00.interactive-0004` and `01:47:18Z
pr-scopecards-s8a-…  actor=station-00.interactive-0004`. That is the supervised interactive lane, and
it is the subject of the already-open escalation
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`.
Recorded as corroboration; not re-raised.

## WHAT CHANGED

- **ARMED `pr-scopecards-s9-transport-capacity-matrix`** via `arm-prompt.ps1` (never a bare `git mv`),
  `-WhatIf` first (exit 0), then for real at **`2026-09-23T05:29:49Z`**, `ARM_EXIT=0`.
  **Read back:** `READY_COUNT=1` (`pr-scopecards-s9-transport-capacity-matrix-ready.md`),
  `S9_HOLD_STILL_PRESENT=False`, arming log line
  `2026-09-23T05:29:49Z  ARMED  pr-scopecards-s9-transport-capacity-matrix  escalates=true  actor=station-00.sched-0514`,
  and `git diff --cached --name-status` EMPTY afterwards (the script releases its own staged rename).
  `escalates: true` gates the **merge**, not the run (§5b) — the watcher will open the PR and label it
  `do-not-merge` for Marco.
- **Fast-forwarded the dev tree** `946a23e6` to `15542584`, with all four read-backs.
- **This board PR**, carrying: this breadcrumb; the untracked `0414` blind-run breadcrumb; the
  `.arming-log.txt` line this run wrote (§9.5 requires any arming run to commit it); the `-HOLD.md`
  deletion the arm produced; `docs/pr-prompts/.queue-sync-ledger.txt`;
  `docs/pr-prompts/queue-watch-state.md`; the review lane's
  `docs/pr-reviews/pr-2101/2102/2103-review.md`; and the `0248` and `0315` breadcrumbs moved to
  `archive/` now that every finding in them is dispositioned.
- **Nothing merged.** No label added or removed. No CI re-run. No watcher process touched. `sot/` not
  opened for writing. No Azure / Entra / SharePoint surface approached. No production data written.

## FINDINGS

**F0 — `origin/main` moved twice inside this run and the board emptied under me; every board fact in
this report is stamped with when it was taken.** `29192b77` at 05:16Z became `15542584` by 05:28Z,
with `#2109` merging at `05:26:03Z`, 56 seconds before I read its state. The 05:17Z sweep's board
section was already wrong by 05:27Z. **DISPOSITION: ACTIONED** — the arming decision was made on a
lint run re-executed at the *new* HEAD, and the single-actor gate was re-taken immediately before the
`git mv`, which is the `[LIVE]` rule applied rather than quoted. No action was taken on any
carried-forward board reading.

**F1 — The 04:14Z blind run's own urgency trigger FIRED 43 minutes later, and this is the first
measured instance of the blindness escalation costing a real merge window.** That breadcrumb deferred
its F1 with an explicit condition: *"It becomes urgent for Marco the moment a `do-not-merge` label
comes off `#2107` / `#2108` / `#2109`, because from that moment a blind hour is a lost merge window
rather than a lost no-op."* **[MEASURED]** the labels came off `#2107` at `04:57:41Z` and `#2109` at
`04:58:44Z`. The 04:14Z occurrence was blind; the next scheduled occurrence was mine at `05:14Z`; in
the gap Marco merged `#2108` himself at `05:13:14Z` and `#2109` at `05:26:03Z`. **The station whose
lane is "drive released PRs to merge" was absent for the entire release window, and Marco did the
merging by hand.** The escalation
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` has been open
**22 days**. **DISPOSITION: ESCALATED** — appended to that existing file rather than opening a second
one (PHASE 1b: add signal, not noise), and only after `git ls-files -- docs/pr-prompts/needs-marco/`
was run to confirm the file's tracked state, per the REPORT CONTRACT's red rule that
`git check-ignore` answers about the RULE and never about the index. The new signal is the trigger
firing, not the recurrence count.

**F2 — Confirmed by direct observation: the freshness instrument scored the blind 04:14Z run as
`ok`.** The 0414 breadcrumb predicted this; `--freshness` this run returned
`00  last 2026-09-23T04:14:00Z  1.2h ago  (cadence 1h)  ok` and `CLEAN`, exit 0, for an hour in which
the station drove nothing. Both instruments AUTHORITY names — the breadcrumb date and `lastRunAt` —
read healthy, exactly as the 529 case in AUTHORITY's own red rule predicts. **DISPOSITION: DEFERRED**
— re-affirmed with fresh evidence, not re-escalated. The durable fix is a machine-readable blind
marker counted separately by `check-breadcrumb.mjs`; that is a `scripts/` change, which
`STATION-CAPABILITIES.md` §5's `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing puts
**outside** Station 00's recorded merge lane, so it must be staged as a prompt for Marco rather than
authored-and-merged by me. What would make it urgent: a run quoting `--freshness ok` as evidence that
coverage was continuous. The mitigation already in force costs nothing — every blind run says BLIND in
its first line and in its title slug.

**F3 — The 0414 breadcrumb's F3 prediction did NOT reproduce, and the reason matters so the next run
does not diagnose a phantom.** It warned that its own untracked path would block the next
fast-forward and prescribed the raw-`Buffer` restore cure. **[MEASURED]** `git merge --ff-only
origin/main` succeeded on the **first** attempt with that file untracked on disk the whole time, and
all four read-backs passed. The prediction was conditional and its condition was not met: the blocker
fires only once a PR has landed *that exact path* on `main`, and no PR had — the tracked-set probe
returned **NOT ON MAIN** for it. The two breadcrumbs that *were* tracked at the root path were
correspondingly not `??` at all. **DISPOSITION: ACTIONED** — the breadcrumb is swept into this board
PR, which is what its F3 asked for; nothing was restored, no `git checkout -- <path>` and no
`git clean` was run (§9.2). The general FF-blocker rule is untouched; only this instance's prediction
was premature.

**F4 — Both open PRs were released by label removal, and label removal does not clear a watcher
`marco:true` verdict for a scheduled lane — so I could not have merged them even had I been faster.**
`#2107` still carries `{"ok":false,"marco":true}` while reading `labels: []` and CP-26 `pass`.
`STATION-CAPABILITIES.md` §5 gate 2 is explicit that the routing is *"Not overridden by green,
unlabelled, or a verified diff - only by an explicit instruction from Marco naming that PR"*, and a
scheduled run cannot read the chat that instruction lives in. **DISPOSITION: ESCALATED** — this is the
standing escalation
`needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md` (with
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` as its twin), and it is now
demonstrated end to end on one board in one hour: Marco removed two labels, no station could act on
that, and he merged both by hand. Both files are appended with this instance; no third file was
opened. **`#2107` is therefore left OPEN and unmerged deliberately.** It is green but for an in-flight
`tendering-e2e`, and it is Marco's.

**F5 — `triage-holds.ps1` fires `!!! SUSPECT: every prompt landed in ONE bucket` on a board where the
uniformity is real, and the warning's own remedy cannot discharge it.** The script tells the reader to
prove `node` and `git` resolve before believing the run; I did, and both do. But the warning reasons
from a symptom whose cause runs the **other** way: a missing `git` makes every gate *skip*, which
reads ADMIT, so a broken `git` can never manufacture 15 REJECTs. The three distinct reject codes
settle it independently. **DISPOSITION: DEFERRED** — real and low-cost, but it is a `scripts/` change
outside my merge lane, and it costs one control per run rather than a wrong answer. What would make it
urgent: a run that reads the SUSPECT banner, cannot discharge it, and therefore refuses to arm a
genuinely armable prompt — which is one step from the failure this run avoided by arming S9.

## WHAT I DID NOT DO

- **Did not merge `#2107`.** Watcher `marco:true` binds absolutely and only Marco clears it (F4). Its
  `tendering-e2e` was still `in_progress` at close in any case.
- **Did not remove or re-apply a `do-not-merge` label on anything.** Only Marco removes it — and both
  had already been removed by him before my run opened.
- **Did not arm a second prompt.** ARM ONE AT A TIME; `READY_COUNT=1` and the watcher had not yet
  picked S9 up when I closed.
- **Did not restart, kill or inspect-and-act-on the watcher.** It read RUNNING with its wrapper alive
  and an empty queue; `restart-watcher-if-wedged.ps1 -Fix` runs only on WEDGED or DOWN, and a stale
  heartbeat over an idle queue is neither.
- **Did not prune the orphaned worktree `C:/po-wt/dns-s5`** (detached `d6552de1`, dirty=0, 271 min
  old). Worktree hygiene is Station 03's lane and it is not blocking anything; the sweep already lists
  it and reports it clean. Named here as the hand-over.
- **Did not commit `Claude Design/docs/index.html`.** It is untracked in the dev tree, it is not mine,
  and it is outside the `docs/` lane `DOCTRINE.md` §10.1 step 3 classifies this station's board PRs by.
  Left exactly as found and named here so the next run does not read it as new.
- **Did not touch `sot/`** — that is Station 05's, gated by CP-24 — and did not do 03 / 04 / 05's work.
- **Did not clear a sweep section 5 `[STALE]` row.** There were none: every row was `[FILE]`.
- **Did not re-raise `weekly-security-audit` being disabled**, the `00`-cadence row in
  `check-breadcrumb.mjs`'s `CADENCE` map, or the second Station 00 lane. All three are already carried
  by open escalations or by the binding documents; an eleventh mention is noise.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported INERT
  (exit 2), so the ban was remembered rather than mechanical — and it held.

---

*Written by Station 00 (scheduled, **SIGHTED**), inside this run's own PR worktree per the REPORT
CONTRACT's preferred home, so no loose copy is left in the dev tree to block the next fast-forward.
Ground stamped at `29192b77`; `origin/main` was `15542584` by close.*
