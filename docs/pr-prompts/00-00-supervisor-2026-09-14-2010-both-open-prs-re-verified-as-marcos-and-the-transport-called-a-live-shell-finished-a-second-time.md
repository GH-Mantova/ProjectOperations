# Station 00 — Supervisor | 2026-09-14T20:08Z–2026-09-14T20:40Z

## GROUND

```
UTC            2026-09-14T20:08Z
origin/main    e42cd7ce            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ e42cd7ce     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run.

Binding documents read from the dev tree working copy, proved identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ **EMPTY**, and `git status -b` → `## main...origin/main` with no ahead/behind. No piped-hash
comparison was made (PREFLIGHT step 2, the 2026-09-04 clause).

All three were read **in full** this run: `00-supervisor.md` 1318 lines, `DOCTRINE.md` 2451 lines,
`STATION-CAPABILITIES.md` 514 lines. This is the thing the 18:15Z run escalated as F5 and could not
do; it was affordable here only because this run carried no long diagnosis.

Transport: Desktop Commander `start_process` / `interact_with_process`, shell `powershell.exe`,
statements sent **direct** (never a nested `powershell.exe -Command`, DOCTRINE §9.1). Host PS
`5.1.26100.9444`. Fresh negative needle minted for this run: `zzQq00Needle` + `20260914T2012`
(written split; treat as SPENT from here, §9.6).

## WHAT I MEASURED

**PREFLIGHT step 1 — the box.** `start_process` shell `powershell.exe` returned
`2026-09-15T06:08:44+10:00` / `LAPTOP-E6NHU4E4`. **Sighted run.** [MEASURED]

**PREFLIGHT step 1 — the VM git guard.** `bash .../scripts/pipeline/vm-git-guard.sh` failed. Last
line quoted verbatim, pass or fail, as the contract demands:

> `resume: RPC error -1: failed to mount … is under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user brave-vibrant-einstein already exists unexpectedly … A Windows update released September 8 prevents Claude's workspace from reaching your files.`

**A failed install is a FINDING, not a STOP.** No `git` was run from the VM side this run; every
measurement below went through Desktop Commander against the Windows host. [MEASURED]

**PREFLIGHT step 4 — the sweep.** `status-sweep.ps1` captured with `*>` and decoded `utf16le` in
node (`ENC=utf16le BYTES=145080 LINES=867`). **The 18:15Z run's F2 cure was applied before any
section was read:** the literal `SWEEP COMPLETE` is present as the final line, so the capture is
whole and no early-return or mid-write truncation is in play. Section 0 controls:
`[LIVE] gh CAN reach GitHub (saw merged PR #1936)`, `[LIVE] node runs`. Section 7:
**`[LIVE] SAFE TO ACT`**. Section 5 produced **zero** `[STALE]` rows (grep for `[STALE]` returned
only the report's own legend lines). [MEASURED]

**Board.** `[LIVE] OPEN PRs: 2` — `#1923` CLEAN, `15 pass / 0 fail`, unlabelled; `#1920` BLOCKED,
`13 pass / 2 fail`, labelled `do-not-merge`. `armed (*-ready.md): 0`. Trunk at `e42cd7ce`:
`4 success / 0 failed (trunk green)`. [MEASURED]

**RULE 2, re-taken this run — a lane verdict is only as of the minute it is taken (§10.1).** Probe
pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`: **2222** logs, newest
`2026-09-14T18:27:08Z` (younger than either open PR), `marco.:true` → **666**, fresh needle → **0**.
Per PR, over `pr-*.log` only (`rev-*` excluded):

| PR | hits | verdict line | anti-scrape cross-check |
|---|---|---|---|
| `#1923` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` | same log carries that prompt's own `PR #1923 open and unmerged: <pull URL>` |
| `#1920` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | same log carries `EA-2a shipped as PR #1920, unmerged as required.` |
| `#999997` — NEGATIVE control | **0** | — | — |

Both verdicts sit in the log of the prompt that built them, beside that prompt's own PR line, so
neither is the prose-scrape shape §10.1 warns about. **RULE 2 binds on both. Nothing on this board
is mine to merge.** [MEASURED]

**`#1920`'s two reds are one cause.** Read from column 3 of the CP-26 job log (`run 34881107532`,
job `104100342650`, 221 lines, split on tab per §9.1):
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label`.
The second red is the same check running as a step inside `PR gates — diff checks`. **Parked by
design, not work** (§9.4). Only Marco removes the label. [MEASURED]

**Freshness, crossed against `lastRunAt`.** `check-breadcrumb.mjs --freshness` exit 2:
`00` 2.0h `ok` · `03` **93.1h SILENT** · `04` 1.9h `ok` · `05` 6.0h `ok`.
`structure: 2 checked, 0 malformed`, plus one `NOTE … is UNTRACKED` for the 04 breadcrumb.
`list_scheduled_tasks` at 20:1xZ:

| task | enabled | cron | `lastRunAt` | `nextRunAt` |
|---|---|---|---|---|
| `00-supervisor` | true | `5 * * * *` | 2026-09-14T20:08:29Z | 21:07:52Z |
| `03-machine-minder` | true | `0 9 * * *` | **2026-09-10T23:01:10Z** | **2026-09-14T23:00:45Z** |
| `04-scanner` | true | `0 */4 * * *` | 2026-09-14T18:10:07Z | 22:09:31Z |
| `05-sot-keeper` | true | `10 0 * * *` | 2026-09-14T14:11:11Z | 2026-09-15T14:10:37Z |
| `weekly-security-audit` | **false** | `30 7 * * 1` | 2026-09-06T21:32:44Z | — |

[MEASURED]

**Watcher.** node RUNNING pid 30976, auto-restart wrapper alive (1), heartbeat 104 min, queue
`armed: 0`. A stale heartbeat with an empty queue is an **idle** watcher, which is correct. I did
not run the `-Fix` path and had no verdict that would license it. [MEASURED]

**The `CADENCE` re-measurement Station 04 asked for.** Anchor `const CADENCE =` in
`scripts/pipeline/check-breadcrumb.mjs` at `e42cd7ce`:
`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };`, fresh needle over the same
file → **0**. Still wrong for `00`. [MEASURED]

## WHAT CHANGED

1. `docs/pipeline/DOCTRINE.md` — one clause appended inside the `instruments v2` canonical block,
   to the `EARLY_RETURN_REPORTED_AS_TERMINATION_V1` bullet of §9.1. Edited in node **by
   concatenation** (never a replacement string, §9.3), byte delta **asserted**:
   `BEFORE=193353 AFTER=195252 DELTA=1899 EXPECT=1899 OK=true`; new marker present once, prior
   marker intact once, anchor intact once, `CRLF=2472 LF=2472 BARE_LF=0`.
2. `docs/pipeline/stations/_canonical-blocks.json` — hash re-recorded with
   `lint-station.mjs --write-canonical` (`instruments v2 28524bab7cedfa88`). Read back:
   **`ADMIT: all 8 docs clean`**, from `REJECT: 1 of 8` before the re-record — the one-document cost
   a DOCTRINE-only §9 edit is supposed to carry, confirming `instruments v2` is still DOCTRINE-only.
3. `docs/pipeline/sweep-rotation.json` — committed here. Station 04 advanced it to
   `last_index=1 key=instrument-honesty` and left it dirty in the shared dev tree by its own
   station doc's instruction; 04 may not commit there, so 00 sweeps it up. Next sweep in the
   rotation is `instruction-drift`.
4. `docs/pr-prompts/00-04-scanner-2026-09-14-1820-….md` — Station 04's breadcrumb, collected and
   committed. Copy verified byte-identical with `Buffer.compare` (20,586 B).
5. `docs/pr-prompts/00-00-supervisor-2026-09-14-1815-….md` — archived by `git mv` into
   `docs/pr-prompts/archive/`; every finding in it now carries a disposition. It was written inside
   its own run's worktree, so no untracked root copy exists in the dev tree to double-commit
   (the 2026-09-07 duplicate-basename rule, checked against `git status` before the move).
6. `C:\ProjectOperations2\.sweep-04-0914.txt` — a Station 04 sweep capture left at the **dev tree
   root**, moved to the sanctioned scratch folder `C:\po-sup-fix-scripts\`. Read back:
   source `Test-Path` **False**, destination **True**. Nothing was deleted.
7. This breadcrumb, written **inside this run's own PR worktree** (cure 1 — no loose untracked copy
   in the dev tree, so the post-merge fast-forward cannot be blocked by it).

**Nothing on the board was mutated. No PR merged, no label touched, no prompt armed, no watcher
restarted.**

## FINDINGS

**F1 — The transport reported a live shell as finished for the second time in eight hours, and this
instance narrows the trigger from `git` to any native command writing a multi-line error to stderr.**
[MEASURED] 20:1xZ, shell PID 31840: a four-statement chain whose third statement was a
`gh … --jq` call with escaped double quotes failed exactly as §9.4 predicts
(`failed to parse jq expression`), and the transport then printed
`✅ Process 31840 has finished execution`. The fourth statement produced nothing. **POSITIVE
control: the next call to the same PID answered `PID31840-ALIVE` from `C:\ProjectOperations2` on the
first try** and carried the remaining twenty minutes of this run. The 12:1xZ bullet left the trigger
`[CANNOT MEASURE]` after two honest attempts, both of which re-ran `git`; this is a different native
command with the same stderr shape, so the class is narrower than the bullet could state. Guard (2)
— treat the message as a claim to falsify — cost one call and decided it.
**DISPOSITION: ACTIONED.** Clause `EARLY_RETURN_TRIGGER_IS_A_NATIVE_STDERR_WRITER_V1` landed in
§9.1 in this run's PR, with its own falsifying probe; nothing retired. Verified by `lint-station.mjs`
reading `ADMIT: all 8 docs clean` after the canonical re-record.

**F2 — Station 04's F1 re-measured and still live: `check-breadcrumb.mjs` hard-codes `'00': 2`
against an hourly cron.** Confirmed at `e42cd7ce` with a fresh negative needle (above). This is
escalation #23 (`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`),
open **12 days**, and its 2026-09-07 addendum already puts three RULE-1-ordered options to Marco:
**(a)** derive `CADENCE` from the live schedule, **(b)** the one character `'00': 1`, **(c)** rely
on the `lastRunAt` cross-check. **I did not take option (b).** The threshold is a decision Marco was
explicitly asked for, and a false SILENT licenses destructive action (§7) — picking one of his three
options unilaterally is guessing his intent (§5.5), not fixing a defect.
**DISPOSITION: DEFERRED.** What this run adds is the re-measurement that keeps the escalation alive.
**What would make it urgent:** any run in which 00 misses an hourly occurrence while `--freshness`
still reads `ok`. The cross-check that works today is `lastRunAt` from the scheduled-tasks MCP,
which this defect does not touch, and it was run above.

**F3 — Station 04's F2 is already answered, by a clause that landed five minutes after 04 wrote it.**
04 recorded `COMMAND_LAYER_EXPANSION` as non-reproducing for a third time and correctly refused to
propose a retirement. Its measurement was taken through the **direct** shell transport. The 18:15Z
run measured both rows minutes apart and found the cause: `-Command` in that bullet means a *nested*
`powershell.exe -Command "…"`, not the Desktop Commander shell whose name is `powershell.exe`, and
the nested form fails on the first attempt. That correction is on `main` in `#1936` as
`COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1`. 04's reading was true of the transport it used and
is not evidence of a Desktop Commander regression.
**DISPOSITION: ACTIONED** — landed before this collect, nothing further owed. 04's own F3 (the §9.6
corpus inversion it walked into and re-pointed inside the same run) needs nothing from me either;
its F5 litter is handled at item 6 of the changes above for the one part that was a hazard.

**F4 — Station 03 has been SILENT 93.1 h, and the test that decides whether this is the scheduler or
the station is due in 2.8 h — this run does not cross it.** `lastRunAt 2026-09-10T23:01:10Z`,
enabled, cron `0 9 * * *`, `nextRunAt 2026-09-14T23:00:45Z`. Its `lastRunAt` aligns exactly with its
own newest breadcrumb, so it reported correctly when it last ran, and all three missed occurrences
(09-11/12/13 at 23:00Z) fall inside the already-escalated 69-hour all-stations scheduler hole. 03 is
simply the only station whose cadence is long enough that it has had no slot since the scheduler
recovered — 00, 04 and 05 have all fired since. Six consecutive runs have now handed this forward.
**DISPOSITION: DEFERRED**, unchanged, with the boundary restated precisely so the run that crosses
it does not have to re-derive it: **if `lastRunAt` for `03-machine-minder` is still
`2026-09-10T23:01:10Z` after `2026-09-14T23:00:45Z` while 00 has continued to fire hourly, the
shared-scheduler explanation is REFUTED and 03 is a station defect to escalate.** The next 00 run
after 23:01Z is the one that owes this answer.

**F5 — The VM/mount transport is down for a sixth consecutive station run, so `vm-git-guard.sh`
could not be installed.** Failure quoted verbatim above. The hazard the guard exists to stop — a
cut-short VM-side `git` call leaving a 0-byte `index.lock` on the Windows `.git` — is moot while the
mount is unreachable, because there is no VM-side `git` to make the call. **An uninstallable guard
is never a licence to run `git` against the mount**, and none was run.
**DISPOSITION: DEFERRED** — already escalated as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`; this is its Nth occurrence,
not new information. **What would make it urgent:** the mount returning while the guard is still
uninstalled, which restores the `index.lock` hazard that freezes every station — or a run needing
the mount for COLLECT because Desktop Commander is down at the same time. Desktop Commander carried
everything this run.

## WHAT I DID NOT DO

- **Merged nothing on the board.** Both open PRs carry a genuine watcher `marco:true` verdict,
  re-taken this run with positive and negative controls and cross-checked against the anti-scrape
  rule. RULE 2 binds and is not cleared by green, by CLEAN, by an empty label list, or by a routing
  reason I could argue with.
- **Removed no label.** `#1920`'s `do-not-merge` is Marco's alone, and its two CI reds are that one
  label counted twice. There is no agent-side action behind `[LABEL_PRESENT]`.
- **Armed nothing.** `armed = 0` and it stays 0. Every arm available lands on Marco, whose board
  already holds two PRs; with no human present to answer *whether* to arm, the additive choice is
  to leave the queue where it is and say so.
- **Did not take option (b) on escalation #23**, though it is one character and I could have. See F2.
- **Cleared no escalation.** Section 5 produced zero `[STALE]` rows; nothing qualified for
  `needs-marco/discharged/`.
- **Did not restart or touch the watcher.** node running, wrapper alive, queue empty, heartbeat
  104 min — an idle watcher, not a wedged one.
- **Left all three orphaned worktrees alone.** `C:/PR-Master/worktrees/po-vg` holds 1 uncommitted
  file and is already escalated
  (`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`); pruning is
  destructive and 03's lane. The other two are clean and are still another station's housekeeping.
- **Did not clean the watcher clone** (`dirty=2`, both `docs/pr-reviews/pr-*-review.md` the `rev-`
  job writes there by design — the false-warning shape §9.5 records). Git in
  `C:\po-watcher\ProjectOperations` is read-only to me, absolutely.
- **Deleted nothing.** The stray sweep capture was MOVED to scratch, not removed; the two
  `-LOOPING.md` files under `docs/pr-prompts/superseded/` were left exactly where they are — they
  match no watcher glob and tracked `*-ready.md` at depth 1 is 0, so THE BOARD TRAP is clear.
- **Did not fold the 18:15Z run's F2 cure (`assert SWEEP COMPLETE`) into the `station-contract`
  canonical block.** That is a seven-document ship and does not belong in the same diff as a §9
  edit. I applied the cure by hand this run instead, and it is recorded above so the next run
  inherits it for free.
