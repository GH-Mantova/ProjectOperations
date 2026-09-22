# Station 00 — Supervisor | 2026-09-22T16:14Z–2026-09-22T16:4xZ

## GROUND

```
UTC            2026-09-22T16:14:19Z   (lastRunAt, scheduled-tasks MCP)
origin/main    2b94e088   at preflight
dev tree       main @ 2b94e088        C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **MATCH** — no read-only downgrade. Desktop Commander connected on the
first call after a keyword `ToolSearch` load, so this is a **sighted** run.

**Which tree the binding documents were read in.** PREFLIGHT step 2 forbids reading the working copy
on trust. The sanctioned equivalence probe was run in the **dev tree** (never the watcher clone),
after an explicit `git fetch origin +refs/heads/main:refs/remotes/origin/main`:

```
git rev-parse --short origin/main                     2b94e088
git rev-parse --short HEAD                            2b94e088
git rev-list --left-right --count HEAD...origin/main  0   0
git diff --numstat origin/main -- <the three docs>    EMPTY
```

`--numstat` EMPTY is the real answer (§9.1); no piped `hash-object` comparison was taken (§9.3). So
the working copy **is** `origin/main` for all three, and all three were read:
`00-supervisor.md` (1569 lines), `DOCTRINE.md` (2722), `STATION-CAPABILITIES.md` (571).

**Clock note.** The session header declares `2026-09-23`; the box reports `2026-09-22T16:14Z`. These
agree — the host is Brisbane, UTC+10. This report is stamped in **UTC**.

## WHAT I MEASURED

**[MEASURED] vm-git-guard: INSTALLED BUT INERT, exit 2 — the expected station outcome.** Run at the
top of the run, before any VM-side call, with the exit code read off the installer itself and not off
an appended pipeline:

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"
```

Last line and exit code, verbatim:

```
   PATH="/sessions/charming-serene-brahmagupta/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Its own controls reproduced the documented cause. A FINDING, not a STOP, and never a licence: **no
VM-side `git` was run against any mount this cycle.**

**[MEASURED] Sweep taken twice, and the first one was incomplete in a way that does not announce
itself.** The first `status-sweep.ps1` was read from the shell's own stdout buffer and stopped at
**312 lines, mid-section-5** — no section 6, no section 7, no `SWEEP COMPLETE` line, and **no error**.
Re-run with `*>` to a file and decoded `utf16le` (BOM `FF FE`, 155,604 B): **452 lines**, generated
`2026-09-22T16:18:31Z`. The verdict only exists in the captured form:

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
SWEEP COMPLETE 2026-09-22 16:18:31Z
```

⚠️ **Read from the buffer, the sweep ends inside its own evidence section and looks finished.** 140
lines — the entire backlog-gates section and the verdict the run is supposed to obey — were simply
absent, with nothing anywhere saying so. This is §9.3's capture requirement earning its place again.

**[MEASURED] Zero real `[STALE]` rows and zero real `[BROKEN]` rows.** Counted over the captured file
rather than eyeballed:

| pattern | raw count | real rows | what the hits actually were |
|---|---|---|---|
| `[STALE]` | 3 | **0** | the HOW-TO-READ legend, the header, the `SWEEP COMPLETE` footer |
| `[BROKEN]` | 1 | **0** | the legend line *"If ANY [BROKEN] appears in section 0, STOP"* |

So there was **no dead escalation to discharge** into `needs-marco/discharged/` this run — the same
answer the 13:25Z, 14:14Z and 15:14Z runs got. ⚠️ The legend lines contain the very tokens a station
greps for; a bare count of `[STALE]` over this file returns **3** and means **0**.

**[MEASURED] The board, at preflight and re-derived live before any decision.**

| | preflight (sweep 16:18Z) | re-derived 16:23:53Z |
|---|---|---|
| open PRs | **0** | **0** |
| DIRTY PRs | 0 | 0 |
| armed (`*-ready.md`), counted myself | **0** | **0** |
| `-HOLD.md` at depth 1, counted myself | 16 | **16** |
| main CI on `2b94e088` | 4 success / 0 failed — **trunk green** | — |
| watcher | `RUNNING pid 9744`, wrapper alive, heartbeat 89 min | — |
| `git index.lock` interactive / clone | False / False | — |
| `git.exe` processes touching our trees | 0 | — |

**Nothing to merge and nothing to arm.** `[LIVE]` means *true when measured* — the board was
re-counted five minutes after the sweep, and both counts are zero.

**[MEASURED] Freshness × `lastRunAt`, crossed as the contract requires.** `check-breadcrumb.mjs
--freshness` → `CLEAN`, exit **0**, `structure: 5 checked, 0 malformed`. No station SILENT. Every
enabled station's newest breadcrumb aligns with its `lastRunAt` from the scheduled-tasks MCP:

| task | cron | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | `2026-09-22T16:14:19Z` | 15:14Z | this run |
| `04-scanner` | `0 */4 * * *` | `2026-09-22T14:09:57Z` | 14:11Z | aligned; next `18:09Z` |
| `05-sot-keeper` | `10 0 * * *` | `2026-09-22T14:23:04Z` | 14:23Z | aligned; next `09-23T14:22Z` |
| `03-machine-minder` | `0 9 * * *` | `2026-09-21T23:02:53Z` | 09-21 23:04Z | aligned; next `23:02Z` |

Enabled tasks: **four** (`weekly-security-audit` is `enabled: false`), re-measured rather than quoted.

**[MEASURED] Nothing new to COLLECT.** The five breadcrumbs in the queue root are the 09-22 13:25Z,
14:14Z and 15:14Z supervisor runs plus 04's 14:11Z and 05's 14:23Z. All five predate my `lastRunAt`
of 16:14Z, and **the 15:14Z run dispositioned every one of them** — its F4 discharged 04's two
hand-overs and its F5 table dispositioned all four of 05's. Re-opening them would be acting twice on
one signal. F2 below is the only thing this run found that no earlier run had acted on.

**[MEASURED] Section 6 `ready=1` is self-describing and is not a dispatch.** The backlog's one
READY-TO-STAGE row, `[P2] rates-11c-blocked-consumers`, carries its own note: *"the consumers are
staged but not yet merged … the item itself STAYS until its gate dies."* Its four slices are already
written as prompts. `needs-marco=2  blocked=4  broken=0`. Nothing here is an action for this station.

## WHAT CHANGED

1. **`scripts/pipeline/check-breadcrumb.mjs`: `CADENCE['00']` corrected `2` → `1`** (F2). Read back on
   the patched file, not assumed:

   ```
   before:  00  last 2026-09-22T15:14:00Z  1.1h ago  (cadence 2h)  ok
   after:   00  last 2026-09-22T15:14:00Z  1.2h ago  (cadence 1h)  ok
   CLEAN    FRESHNESS_EXIT=0
   node --test "scripts/pipeline/__tests__/*.mjs"  ->  exit 0
   ```

2. **Four dispositioned breadcrumbs `git mv`'d to `docs/pr-prompts/archive/`** — the 09-22 13:25Z and
   14:14Z supervisor runs, 04's 14:11Z BLIND report and 05's 14:23Z report. The 15:14Z one stays in
   the root as the current cycle. **Positive control that this is safe for freshness:** after the
   move, `structure:` counts **1** file in the root, yet the freshness table still resolves
   `04 → 2026-09-22T14:11` and `05 → 2026-09-22T14:23` from `archive/`. `check-breadcrumb.mjs` builds
   its tracked set with `git ls-tree -r` and matches by basename, so an archived breadcrumb can never
   make a station read SILENT.

3. **This breadcrumb**, written **inside this run's own PR worktree**
   (`C:\po-worktrees\00-collect-20260922-1614`, branch `docs/00-collect-2026-09-22-1614` off
   `origin/main`) — cure 1 of the post-merge fast-forward rule, so no loose untracked copy is left in
   the dev tree.

**Nothing else.** No prompt armed, disarmed, renamed, moved or retired. No label added or removed. No
watcher restart. No merge of anyone else's PR — there were none. No `git` write in the watcher clone.
No VM-side `git` against any mount. No append to any `needs-marco/` file.

## FINDINGS

### F1 — The sweep read from the shell buffer ended mid-evidence, with no error and no marker (S2)

The first `status-sweep.ps1` invocation returned **312 lines** and stopped inside section 5's
escalation cross-check. Sections 6 (BACKLOG GATES) and 7 (VERDICT) were absent, and so was the
`SWEEP COMPLETE` footer. Nothing errored; the shell reported the process merely waiting at a prompt.

🔴 **The truncation lands in the one section that looks endless by design.** Section 5 emits one row
per escalation file per PR reference — over 200 rows here — so a reader who stops there sees a long,
uniform list and has no reason to suspect anything is missing. The available conclusion was *"the
sweep produced no verdict"*, or worse, *"I have read the sweep."* The captured run is 452 lines: **140
lines, including the `SAFE TO ACT` verdict this station is required to obey, were never read.**

🔧 **The cure is the one already prescribed and it is not optional: capture with `*>` to a file and
decode `utf16le`.** The file carries a `FF FE` BOM (§9.3) and a `SWEEP COMPLETE` footer — and that
footer is the only positive proof the sweep finished. **Assert the footer is present before quoting
any sweep line.** A sweep without its footer is a partial read wearing a complete one's clothes.

⚠️ **Falsifying probe:** run the sweep both ways and compare line counts. If the buffered form ever
returns a `SWEEP COMPLETE` line, this finding does not apply to that invocation.

**DISPOSITION: ACTIONED** — re-run captured, 452 lines with the footer present, and every sweep fact
in this report is quoted from the captured file. No repo change: the prescribed cure already exists
and worked the moment it was used.

### F2 — `check-breadcrumb.mjs` declared Station 00's cadence as 2h against an hourly cron, so 00 could miss THREE consecutive occurrences and still print `ok` (S1)

**This is the instrument that decides whether a station has gone silent, and for Station 00 its
threshold was four times the real interval.**

[MEASURED] `scripts/pipeline/check-breadcrumb.mjs:36`, against the live schedule from the
scheduled-tasks MCP:

| station | `CADENCE` declared | live `cronExpression` | true interval | SILENT threshold (2×) | correct? |
|---|---|---|---|---|---|
| **00** | **2** | **`5 * * * *`** | **1h** | **4h** | **NO** |
| 03 | 24 | `0 9 * * *` | 24h | 48h | yes |
| 04 | 4 | `0 */4 * * *` | 4h | 8h | yes |
| 05 | 24 | `10 0 * * *` | 24h | 48h | yes |

Only the `00` row is wrong, and it is wrong in the permissive direction: a station firing hourly was
given a 4-hour grace, so **three consecutive missed occurrences read `ok`**. The station doc's own
`lastRunAt` cross-check exists precisely because "`ok` is not an all-clear" — but that table's first
row, *"`lastRunAt` older than one cadence ⇒ the occurrence never fired"*, also reads `one cadence`
from this constant, so both instruments inherited the same wrong number.

🔴 **This had been SEEN three times and never fixed.** The 14:14Z breadcrumb states it plainly —
*"The `00` row still reads `cadence 2h` against a live cron of `5 * * * *` — the known `const
CADENCE =` defect"* — and 305 lines across the queue and `archive/` quote the `(cadence 2h)` output.
It was correctly measured and then carried forward as a caveat on every subsequent reading rather
than removed. ⚠️ **A defect that is re-measured every run and never repaired is not a known issue; it
is an unpaid one**, and the cost is paid by whichever run is actually blind when 00 stops.

🔧 **Fixed, additively.** `CADENCE['00']: 2 → 1`, plus a comment naming each row's live cron so the
next reader can falsify the whole table rather than trust it. No test asserts these values
(`grep -rn 'CADENCE' scripts/pipeline/__tests__/ scripts/pr-watcher/__tests__/` → 4 hits, all prose
in unrelated files), and `node --test "scripts/pipeline/__tests__/*.mjs"` exits **0** after the change.

**RULE 1:** complete-and-additive. It fixes the reading now and future — the constant is now derived
from the cron and both are stated side by side — and touches no data, no prompt and no board state.
The alternative considered and rejected: reading the cron at runtime from the MCP. That fails the
*complete* half — `check-breadcrumb.mjs` runs in CI where no MCP exists, so it would make the
validator environment-dependent to fix a constant.

⚠️ **Falsifying probe: the table above.** Re-run `list_scheduled_tasks` and compare each
`cronExpression` to its `CADENCE` row. If `00`'s cron is ever not hourly, this fix is wrong.

**DISPOSITION: ACTIONED** — patched in this run's PR, read back on the patched file (`cadence 1h`,
`CLEAN`, exit 0), and the pipeline test suite passes.

### F3 — Four breadcrumbs had been fully dispositioned and deferred from archiving three runs running (S3)

The station doc's COLLECT contract says to `git mv` a breadcrumb into `docs/pr-prompts/archive/`
**once every finding in it carries a disposition**, in the same board PR. The 14:14Z and 15:14Z runs
both DEFERRED this, on the reasoning that the root is *"legible by eye"* and that archiving *"would
add the untracked-root-copy hazard for no benefit."*

🔴 **The second half of that reasoning does not survive being checked.** The untracked-root-copy
hazard belongs to writing a breadcrumb into the **dev tree**; a `git mv` performed inside the run's
own **PR worktree** creates no untracked file anywhere and is exactly what the doc prescribes. The
first half is a threshold ("worth doing when the root count approaches the prompt count") that no
document states — it was invented by a prior run and then quoted by the next one as if settled.

[MEASURED] root breadcrumbs **5**, `archive/` **620**, prompts at depth 1 **16**. All four
non-current breadcrumbs carry complete dispositions from the 15:14Z run.

🔧 Archived the four; kept the 15:14Z one in the root as the current cycle. The freshness positive
control in WHAT CHANGED §2 is the proof this is safe.

⚠️ **The deferral was cheap each time and compounding.** Three runs is the point at which "defer
again, same reason" stops being a judgement and becomes a habit — which is the shape of the nine-day
gitignored-findings incident this contract was written against.

**DISPOSITION: ACTIONED** — four `git mv`s in this run's PR, with the freshness control passing after
the move.

### F4 — The watcher clone's `dirty=4 <-- the watcher may refuse to start` is a false warning, again

`status-sweep.ps1` again prints `watcher clone: branch=main dirty=4  <-- NOT clean-on-main; the
watcher may refuse to start`. Both conjuncts are false: `start-watcher.ps1` counts only **tracked**
files, and a tracked-dirty clone **auto-stashes** rather than refusing. The 15:14Z run re-derived the
same line as tracked-dirty **1** against untracked-inclusive **5**, the untracked entries being the
`rev-` lane's review file and `.codex/` — written into the clone **by design**.

Already recorded in DOCTRINE §9.5 with 13 verbatim quotations in `archive/`, and DEFERRED by the
13:25Z and 15:14Z runs. I did not re-derive it this run and I did not act on it: nothing this cycle
depended on the clone, and **re-measuring a false warning to confirm it is still false is not work.**

**DISPOSITION: DEFERRED** — real, documented, and the fix is a one-line scoping change to
`status-sweep.ps1`. It becomes urgent the moment any run *acts* on the warning; dispatching clone
hygiene to 03 on the strength of it is the recorded mis-route.

### F5 — `pr-scopecards-s7-one-cutting-total-HOLD.md` remains the board's only ADMIT and remains Marco's

Unchanged from the 14:14Z and 15:14Z runs and deliberately not re-litigated: the queue holds 16
prompts, exactly one lint-ADMITs, and its body says *"Arming is Marco's"* and *"Marco merges, not
automation"* — alongside `escalates: true`, `gate_allow: migrations`, `backfill: true` and three
migrations across five modules' money paths. **An empty board is therefore the designed state, not a
fault.**

I did not re-run the prose-gate grep. The 15:14Z run's F1 records that a twelve-needle search over
this exact file returned **0** while the gate is stated twice, and that its positive control passed
only because it ran over a *different* file. **Re-running a probe already proved unsound on this file
would be the third run to pay for the same lesson.**

**DISPOSITION: ESCALATED** — it is in Marco's hands by the prompt's own instruction; see FOR MARCO.

## WHAT I DID NOT DO

- **Did not arm anything.** 0 armed, 16 HOLDs, and the single ADMIT is Marco-gated by its own prose
  (F5). There is nothing armable that is mine to arm.
- **Did not merge anything** — the board held **0** open PRs at preflight and **0** when re-derived
  five minutes later. Nothing was driven, because there was nothing to drive.
- **Did not re-run the prose-gate probe on the one ADMIT.** Its unsoundness on that file is already
  measured and recorded; repeating it risks reproducing the clean `0` that nearly armed it.
- **Did not restart, kill or `-Fix` the watcher.** `RUNNING pid 9744`, wrapper alive, 0 armed, heartbeat
  stale-but-idle. That is HEALTHY-and-idle. Never restart on idle.
- **Did not run `rescue-watcher-repo.ps1`** and did not run any `git` write in the watcher clone. It is
  on `main`, parked and harmless; its untracked files belong to the `rev-` lane.
- **Did not re-derive the clone's `dirty=` count** (F4). It is a known-false warning and re-measuring
  it to confirm it is still false is not work.
- **Did not touch `needs-marco/`.** Zero real `[STALE]` rows means there was no dead escalation to
  discharge, and I opened no new one — F2 was fixable, and a fixable finding is not an escalation.
- **Did not re-open the 04 and 05 hand-overs.** Both were fully dispositioned by the 15:14Z run; I
  archived them rather than acting on them twice (LL-38, and the never-act-twice rule).
- **Did not run VM-side `git` against any mount.** The guard reported INERT (exit 2), which is the
  reason to be careful, never the licence to proceed.
- **Did not treat any sweep `[LIVE]` line as current without re-deriving what I acted on.** The board
  counts were re-measured at 16:23:53Z; the verdict was taken only from the captured file with its
  footer present.
- **Did not touch Azure, Entra or SharePoint**, and wrote no production data. Absolute, and not
  reasoned past.

⚠️ No negative-control needle was minted or spent this run.

## FOR MARCO

**One thing needs you, and it is the same one as the last three runs.**
`pr-scopecards-s7-one-cutting-total-HOLD.md` is gate-cleared and lint-ADMITs, and its own body says
*"Arming is Marco's."* It is the only one of 16 queued prompts that could move, so **the board is
empty by design, not by fault** — it stays empty until you arm it. Everything else is clean: 0 open
PRs, 0 dirty, trunk green on `2b94e088`, watcher alive and idle.

**One thing was quietly wrong and is now fixed, no action needed from you.** The silence detector had
Station 00's cadence recorded as 2 hours against an hourly schedule, so 00 could have gone missing for
nearly four hours while the instrument printed `ok`. Three previous runs measured this and wrote it
down as a caveat; this run changed the number (F2). Given how much of this pipeline's safety rests on
noticing that a station stopped, that gap is worth knowing existed.
