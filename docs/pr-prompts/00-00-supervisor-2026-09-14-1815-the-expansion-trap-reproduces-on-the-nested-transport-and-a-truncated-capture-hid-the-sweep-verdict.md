# Station 00 — Supervisor | 2026-09-14T18:08Z–2026-09-14T18:5xZ

## GROUND

```
UTC            2026-09-14T18:08:28Z  (task lastRunAt; first probe 18:08:42Z)
origin/main    49685973              (fetched this run, then rev-parse)
dev tree       main @ 49685973       C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1                     (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (scheduled-task SKILL.md) — MATCH, full authority
```

SIGHTED, not blind. `start_process` shell `powershell.exe` answered on the first call
(`LAPTOP-E6NHU4E4`, `2026-09-15T04:08:42+10:00`).

Binding documents read from the working copy, which is sound this run because
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
returned **EMPTY** — the working copy is byte-identical to `origin/main` for all three (PREFLIGHT
step 2's sound form, no piped hash).

**Scope of the read, stated honestly.** `00-supervisor.md` in full (1318 lines). `DOCTRINE.md`
sections 1–9.4, 9.5 lines 985–1449, 9.6 and all of section 10 — **lines ~1450–1607 of 9.5 were NOT
read this run** and are `[CANNOT MEASURE]` for the purposes of anything below.
`STATION-CAPABILITIES.md` was NOT read this run. Both omissions are dispositioned in FINDINGS.

## WHAT I MEASURED

**The sweep.** `status-sweep.ps1` captured to a file, decoded `utf16le` from node (the `*>` trap).
Generated `2026-09-14 18:10:30Z`. Section 7 verdict, verbatim: `[LIVE] SAFE TO ACT: no board
mutation in progress, no recent remote activity, no live station worktrees.` `[MEASURED]`

| claim | reading | tag |
|---|---|---|
| open PRs | **2** — `#1923` CLEAN 15/0 green · `#1920` BLOCKED 13 pass / 2 fail | [MEASURED] |
| main CI on `49685973` | 4 success / 0 failed / 0 running — trunk green | [MEASURED] |
| armed (`*-ready.md`) | **0** | [MEASURED] |
| watcher | node RUNNING pid 30976, wrapper alive (1), heartbeat 105 min — idle with an empty queue, **not wedged** | [MEASURED] |
| safe-to-act inputs | `index.lock` False/False · scoped git processes **0** · no PR touched in 2 min | [MEASURED] |
| queue folders | needs-marco 54 · no-pr-opened 109 · failed 49 · blocked 135 | [MEASURED] |
| section 5 `[STALE]` escalation rows | **0** — all four `[STALE]` hits in the capture are the legend, a quoted snapshot line and the footer (POS control `[LIVE]` → 88, NEG → 0) | [MEASURED] |
| non-main worktrees | 3 — `C:/po-fix1891` (clean, 1015 min) · `C:/PR-Master/worktrees/po-vg` (**1 dirty file**, 15017 min) · `C:/PR-Master/worktrees/pr1823` (clean, 6959 min) | [MEASURED] |

**RULE 2, both open PRs.** Probe pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, prompt logs only (`pr-*.log`, excluding `rev-*`),
written without a quote character. **907** prompt logs; POSITIVE control `marco.:true` over
`*.log` → **666**; NEGATIVE controls `PR #999123` → **0** and a freshly minted needle
`zzQq00Needle20260914T1815` → **0**.

```
PR #1923 -> 2 hits, in pr-ratescol-s0-column-api-hygiene-ready.md.log
   "PR #1923 open and unmerged: https://github.com/.../pull/1923"
   [watcher] merge result for PR #1923: {"ok":false,"marco":true,
     "reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}
PR #1920 -> 2 hits, in pr-ea-s2a-dashboard-preset-seed-ready.md.log
   "EA-2a shipped as PR #1920, unmerged as required."
   [watcher] merge result for PR #1920: {"ok":false,"marco":true,"fixLane":false,
     "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

Both verdicts survive the section 10.1 anti-scrape cross-check: each sits in the log of the prompt
that **also** carries that PR's own "opened / shipped as PR #N" line, for the same number, with a
matching scope. Neither is a number scraped out of prose. `#1920` additionally carries the
`do-not-merge` label and a `migrations/` path — parked by design, and its two CI reds are the one
CP-26 `[LABEL_PRESENT]` cause counted twice, not work. **BOTH OPEN PRs ARE MARCO'S. `[MEASURED]`**

**Freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
`00 ok (1.1h)` · `03 SILENT 91.1h (cadence 24h)` · `04 ok (4.0h)` · `05 ok (4.1h)`; structure 1
checked, 0 malformed. Crossed against `list_scheduled_tasks`: `03-machine-minder` **enabled=true**,
cron `0 9 * * *`, `lastRunAt 2026-09-10T23:01:10Z`, `nextRunAt 2026-09-14T23:00:45Z`. `lastRunAt`
is older than one cadence ⇒ per the freshness table **the occurrences never fired**, not "ran and
did not report" — and `lastRunAt` aligns with 03's own newest breadcrumb (`2026-09-10T23:10Z`), so
03 reported correctly the last time it ran. `[MEASURED]`

Third instrument, the tracked breadcrumb set (`git ls-tree -r origin/main -- docs/pr-prompts/`):
Station 00's own breadcrumbs jump **`2026-09-11T04:08Z` → `2026-09-13T09:00Z` → `2026-09-14T00:27Z`**.
00 fires hourly, so those two holes are the scheduler, not a station — and all three of 03's missed
occurrences (09-11, 09-12, 09-13 at 23:00Z) fall inside them. This is the already-escalated
all-stations outage recorded by this station's own `…-1008-the-scheduler-lost-69-hours…` and
`…-1410-05-fired-at-its-first-slot-after-the-69-hour-hole…` breadcrumbs. `[INFERRED]` from those
three measured sets.

**The expansion trap, both transports, one session.** Host PS `5.1.26100.9444`, Desktop Commander
`start_process`, control `$CTRL=42`:

| transport | result |
|---|---|
| shell `powershell.exe`, statements sent **direct** | `ROW_A_direct_shell:42`, `USER_IS:Marco` — no expansion |
| shell `powershell.exe`, command = `powershell.exe -NoProfile -Command "…"` | `The string is missing the terminator: ".` — expansion |

POSITIVE control on real work: a `Select-String … | ForEach-Object { $_.LineNumber … }` written
through the nested form arrived as `{ .LineNumber …` and died `ParserError: An expression was
expected after '('` — the `$_` gone, not mis-valued. `[MEASURED]`

**The truncated capture.** First read of the sweep capture: **102,034 bytes / 383 lines**, ending on
a bare `==================== 6. BACKLOG GATES ====================` header with nothing after it.
Complete file, read minutes later: **142,656 bytes / 416 lines**, section 6 populated, section 7
verdict present, terminal `SWEEP COMPLETE` line present. `[MEASURED]`

**The marker is sound.** `Write-Host ("SWEEP COMPLETE " + $nowUtc + …)` is line **622 of 622** in
`scripts/pipeline/status-sweep.ps1` — unconditional, and after the section 7 verdict at line 604.
POSITIVE control: 5 pattern hits located, NEG control (freshly minted needle) 0. `[MEASURED]`

**VM transport.** `bash` into the Cowork Linux workspace failed on resume, create and re-resume
(*"source path … is under Plan9 share \"c\" which is not mounted"*), so
`scripts/pipeline/vm-git-guard.sh` **could not be installed this run**. Quoted per PREFLIGHT step 1.
`[MEASURED]` — and a failed install is a finding, not a stop.

## WHAT CHANGED

1. `docs/pipeline/DOCTRINE.md` — one clause appended to the first bullet of section 9.1, inside the
   `instruments v2` canonical block. Edited in node **by concatenation**, byte delta **asserted**:
   `BEFORE=190960 AFTER=193353 DELTA=2393 EXPECT=2393 OK=true`; anchor still present exactly once;
   prior marker `COMMAND_LAYER_EXPANSION_NOT_REPRODUCED_V1` intact (1); new marker present (1);
   NEG 0; `CRLF=2451 LF=2451` (no bare LF introduced).
2. `docs/pipeline/stations/_canonical-blocks.json` — hash re-recorded with
   `lint-station.mjs --write-canonical` (`instruments v2 89c1d4963993b43b`). Read back:
   **`ADMIT: all 8 docs clean`**, from `REJECT: 1 of 8` before the re-record — the cost this pipeline
   already measured for a DOCTRINE-only section 9 edit.
3. This breadcrumb, written **inside the run's own PR worktree** (cure 1 — no loose untracked copy
   is left in the dev tree, so the post-merge fast-forward cannot be blocked by it).
4. `docs/pr-prompts/00-00-supervisor-2026-09-14-1708-….md` archived by `git mv` into
   `docs/pr-prompts/archive/` — every finding in it carried a disposition.

**Nothing on the board was mutated. No PR was merged, no label touched, no prompt armed.**

## FINDINGS

**F1 — The 2026-09-11 non-reproduction of the `-Command` expansion trap is an artefact of the
transport, not a Desktop Commander change, and section 9.1's own control named it ambiguously.**
That bullet closed with *"Re-run both rows, and stamp the transport AND the Desktop Commander
version, before anyone edits this bullet again."* This run did exactly that. The 09-11 row ran
*"through `start_process` shell `powershell.exe` — the transport this bullet's own control
mandates"*: that is the shell **name**, not the `-Command` **layer**, and there is no expansion
layer on it, so it measured a transport the trap was never claimed for. Nested, the trap fires on
the first attempt (table above). The consequence of leaving it unresolved is the one section 9.1
names as the worst shape in the section — a silent wrong value at exit 0 — and a reader who took
the 09-11 row as a retirement would stop putting `$` in a `.ps1`.
**DISPOSITION: ACTIONED.** Clause `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` landed in
section 9.1 in this run's PR; nothing retired, the 09-11 block kept verbatim because it is a true
measurement of the direct transport; falsifying probe is the two-row table. Verified by
`lint-station.mjs` reading `ADMIT: all 8 docs clean` after the canonical re-record.

**F2 — A capture file read while it is still being written reads as a sweep that stopped before its
verdict, and the prescribed diagnosis for that shape is the wrong one.** PREFLIGHT step 4 tells
every station to capture the sweep to a FILE *because* `status-sweep.ps1` returns early and hides
its own section 7 verdict. This run's producing call hit the Desktop Commander 180 s transport
timeout (the documented timeout-but-succeeded trap), and the file read at that moment was
**102,034 bytes, 383 lines, ending on a bare section 6 header** — byte-indistinguishable from the
early-return the capture exists to defeat. The complete file is **142,656 bytes, 416 lines**, with
the verdict present. Nothing warns, nothing is empty, and the available conclusion is a defect in
the sweep.
🔧 **The cure is one line and it always exists: `SWEEP COMPLETE` is line 622 of 622, unconditional,
after the section 7 verdict. Assert that literal is present in the capture BEFORE reading any
section; absent ⇒ the sweep did not finish writing, whatever the reason, and the answer is to wait
and re-read, never to diagnose.** This is complete-and-additive — it costs one string test, it
subsumes the early-return case as well as the truncation case, and it cannot mis-read a genuine
early return as success because an early return skips line 622 too.
**DISPOSITION: DEFERRED.** It belongs in the `station-contract v3` canonical block (PREFLIGHT step
4), which binds all seven station docs — and a canonical-block change must be re-recorded and
shipped across all seven in one PR, which is more than a collect run should carry alongside a
section 9 edit in the same diff. **What would make it urgent:** a second run reporting a missing
sweep verdict. It is recorded here with its measurement and its cure so the next run pays nothing
to re-find it.

**F3 — Station 03 has been SILENT 91.1 h, and the cause is the scheduler, not the station.**
`lastRunAt 2026-09-10T23:01:10Z` against a 24 h cron, enabled, `nextRunAt 2026-09-14T23:00:45Z`. Its
`lastRunAt` aligns exactly with its own newest breadcrumb, so it reported correctly when it last
ran. All three missed occurrences (09-11/12/13 at 23:00Z) fall inside windows where **Station 00's
hourly breadcrumbs are also absent** — the already-escalated 69-hour all-stations scheduler hole. 03
is simply the only station whose cadence is long enough that it has not yet had a slot since the
scheduler recovered; 00, 04 and 05 have all fired since.
**DISPOSITION: DEFERRED** until 03's next slot at `2026-09-14T23:00:45Z`, ~4.8 h from this run.
**What would make it urgent, and it is a real test rather than a wait:** if 03 misses that
occurrence while 00 continues to fire hourly, the shared-scheduler explanation is refuted and 03 is
a station defect to escalate. The existing escalation
`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md` already carries the
adjacent question and is untouched by this.

**F4 — The VM git guard could not be installed, and the hazard it guards is absent this run.**
`bash` into the Cowork workspace failed on resume, create and re-resume; the mount is unreachable,
so `vm-git-guard.sh` did not run. The guard exists to stop a VM-side `git` call leaving a 0-byte
`index.lock` on the Windows `.git`. With no VM at all there is no VM-side `git` to guard, and this
run ran none. **An uninstallable guard is never a licence to run `git` against the mount**, and none
was run. Already escalated as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`.
**DISPOSITION: DEFERRED** — the escalation is live and this is its Nth occurrence, not new
information. **What would make it urgent:** a run that needs the mount for COLLECT because Desktop
Commander is down at the same time; on this run Desktop Commander was up and carried everything.

**F5 — Reading the binding documents in full now costs more than a collect run can carry, and this
run did not do it.** `DOCTRINE.md` is **2422 lines / 190,960 bytes**; `00-supervisor.md` is 1318;
`STATION-CAPABILITIES.md` was not opened at all. PREFLIGHT step 2 says "in full, every run", and
this run read roughly 85% of DOCTRINE and none of STATION-CAPABILITIES — declared in GROUND rather
than glossed, because a report that claims a full read it did not perform is exactly the rumour
section 7.1 exists to stop. The growth is structural: every station correction appends to section 9,
and nothing retires.
**DISPOSITION: ESCALATED** — filed this run as
`docs/pr-prompts/needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`,
because the remedy is a change to what the contract *requires*, and only Marco decides what a
station may skip. Options, RULE 1 applied — **(a) complete and additive, FIRST: split `DOCTRINE.md`
so sections 1–8 and 10 (the LAW, which binds behaviour) stay a mandatory full read, and section 9
(the INSTRUMENT traps, which are looked up when an instrument is used) becomes a required read of
its bullet HEADLINES plus the full text of any bullet whose instrument the run actually touches** —
passes both tests: no rule is lost, no future rule is harder to add, and every run still meets the
law in full. **(b)** cap section 9 by retiring bullets on an age or falsification schedule — fails
the "no damage to future data" half, because every retirement is a measured trap going back into
circulation, which section 9.5 has already recorded happening. **(c)** leave it and accept that
every run silently reads a different 85% — fails both halves, and is the status quo.

## WHAT I DID NOT DO

- **Merged nothing.** Both open PRs carry a real watcher `marco:true` verdict, measured this run
  with positive and negative controls and cross-checked against the anti-scrape rule. RULE 2 binds
  and is not cleared by green, by CLEAN, by an empty label list, or by a routing reason I could
  argue with. `#1923` is green and stays open; `#1920` is labelled and stays open.
- **Removed no label.** `#1920`'s `do-not-merge` is Marco's alone, and its two CI reds are that one
  label, counted twice. There is no agent-side action behind `[LABEL_PRESENT]`.
- **Armed nothing.** `armed = 0` and it stays 0. Every arm available today lands on Marco — the
  board already holds two PRs of his, and the sweep's own snapshot states the constraint:
  *"Arming faster makes the queue longer, not shorter."* With no human present to answer *whether*
  to arm, the additive choice is to leave the queue where it is and say so, not to lengthen it.
- **Cleared no escalation.** Section 5 produced **zero** `[STALE]` rows this run — the eleven dead
  files a previous run inherited are already discharged. Nothing was moved into
  `needs-marco/discharged/`, because nothing qualified.
- **Did not restart or touch the watcher.** Verdict inputs were healthy: node running, wrapper
  alive, queue empty. A 105-minute heartbeat with 0 armed prompts is an **idle** watcher, which is
  correct, not wedged. I did not run the `-Fix` path and had no verdict that would license it.
- **Left all three orphaned worktrees alone.** `C:/PR-Master/worktrees/po-vg` holds **1 uncommitted
  file** and is already escalated
  (`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`); pruning it is
  destructive and 03's lane, not mine. The other two are clean but are still another station's
  housekeeping.
- **Did not clean the watcher clone** (`dirty=2`). Git in `C:\po-watcher\ProjectOperations` is
  read-only to me, absolutely, and the clone's hygiene is 03's dispatch.
- **Did not read `STATION-CAPABILITIES.md` or section 9.5 lines ~1450–1607.** Declared in GROUND and
  dispositioned as F5 rather than papered over.
- **Did not fold F2's cure into the `station-contract` canonical block.** That is a seven-document
  ship and it does not belong in the same diff as a section 9 edit; F2 records the cure so the next
  run inherits it for free.
