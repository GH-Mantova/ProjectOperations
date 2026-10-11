# Station 00 — Supervisor | 2026-10-10T22:08:59Z–2026-10-10T23:05Z

## GROUND

```
UTC            2026-10-10T22:08:59Z  (lastRunAt, scheduled-tasks MCP)
origin/main    eff8b4b5              (git fetch origin, then git rev-parse origin/main)
dev tree       main @ eff8b4b5       C:\ProjectOperations2
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md @ origin/main)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 == 1), so this run was not restricted to read-only on that account.

**This run was SIGHTED.** Desktop Commander reached the Windows host. The VM sandbox transport
wedged mid-run (see WHAT I MEASURED) but the host transport held throughout.

## WHAT I MEASURED

**Reachability.** [MEASURED] One keyword `ToolSearch` for `desktop-commander` returned the toolkit;
the ids reported were `mcp__plugin_desktop-commander_desktop-commander__*`, not any literal id a
document could have hard-coded. First `start_process` (shell `powershell.exe`) returned output, so
no blindness. PS version `5.1.26100.9444`.

**Git guard, quoted verbatim as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **EXIT CODE 2**, last line:

```
   PATH="/sessions/lucid-inspiring-bohr/.local/bin:$PATH" git <args>
```

headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Exit 2 is the EXPECTED station outcome per the station contract's three-outcome table — a FINDING,
not a stop. The device-bridge git ban was therefore kept by not needing it: **no `git` was run
through the VM transport at any point in this run.** Every `git` call below ran on the Windows host.

**Ground readings.** [MEASURED] `git fetch origin` exit 0; `git rev-parse origin/main` and
`git rev-parse HEAD` both `eff8b4b5342824f1b452fdea863f83350f0b71a2`;
`git rev-list --left-right --count HEAD...origin/main` → `0  0`. The three binding documents were
read from `git show origin/main:<path>` in the **dev tree**, never the working copy and never the
watcher clone: `00-supervisor.md` 32,883 B, `DOCTRINE.md` 30,719 B, `STATION-CAPABILITIES.md`
54,828 B. No piped `git hash-object --stdin` was used anywhere (DOCTRINE §9.2).

**DOCTRINE §9.1 reproduced first-hand, in this run.** [MEASURED] A `-Command "..."` call containing
`$f.Length` came back as a ParserError reading
`... Get-Item C:\Users\Marco\AppData\Local\Temp\sweep.txt; 'LEN=' + .Length ...` — the `$f` token
replaced by its value and the `$env:TEMP` expanded by the outer layer before PowerShell parsed it.
Every subsequent `$`-bearing command was sent through an interactive `interact_with_process` session
instead, and all of them worked. This is the EXPANDED signature §9.1 records, not the STRIPPED one
STATION-CAPABILITIES §3 was corrected for on 2026-08-30.

**status-sweep.ps1.** [MEASURED] Started 2026-10-10T22:14:41Z (its own header stamp). Section 0
positive controls both pass: `gh CAN reach GitHub (saw merged PR #2309)`, `node runs`. No `[BROKEN]`
in section 0, so the report is usable. At 22:49:46Z it was **still writing** (41,218 B) and had
reached only the `l…` filenames of the 56 `needs-marco/` files in section 5. See F6.

**Board, from section 1 [LIVE].** OPEN PRs: 2.
`#2303` BEHIND, CI 11 pass / 4 fail / 0 pending — RED.
`#2294` BEHIND, CI 13 pass / 2 fail / 0 pending — RED.
`WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 26h`.
`ALL OPEN (non-draft): 2`. `main CI on eff8b4b5: 4 success / 0 failed / 0 running (trunk green)`.
Most recent merges: #2309 22:00Z, #2308 19:21Z, #2307 16:48Z — all three are breadcrumb sweeps.

**Safe-to-act gate, from section 3 [LIVE].** `git index.lock interactive/clone: False / False`;
`git processes touching our trees (scoped): 0`; `board lease: free`;
`no PR touched on GitHub in the last 2 min`; and
`watcher build (heartbeat -- blocks arming and merging (section 7)): BUILD IN FLIGHT:
rev-2309-ready.md (tick 1 min old)`.

**Queue, from section 4 [LIVE].** armed (`*-ready.md`): **1** — `rev-2309-ready.md`, an
auto-generated review job (DOCTRINE §9.5: review jobs carry no YAML front matter by design).
`needs-marco/`: **56**. `no-pr-opened/`: 111. `failed/`: 80. `blocked/`: 207.

**MARCO_QUEUE_LINE_V1 figures, copied as the contract requires.** `WAITING ON MARCO: 2`;
`ALL OPEN (non-draft): 2`. **I armed nothing this run** (the heartbeat gate forbids it), so these
figures are unchanged by me.

**Live schedule, from the scheduled-tasks MCP — never from a pasted cadence.** [MEASURED]
`00-supervisor` `5 * * * *`, enabled, `lastRunAt 2026-10-10T22:08:59Z`,
`nextRunAt 2026-10-10T23:13:52Z`. `04-scanner` `0 */4 * * *`, `lastRunAt 2026-10-10T22:10:09Z`.
`05-sot-keeper` `10 0 * * *`, `lastRunAt 2026-10-10T14:22:59Z`.
`03-machine-minder` `0 9 * * *`, `lastRunAt 2026-10-09T23:02:54Z`,
`nextRunAt 2026-10-10T23:02:45Z`. `weekly-security-audit` **enabled: false**. Live ENABLED count: **4**.

**The host clock, taken live.** [MEASURED] `[DateTime]::UtcNow` on the Windows host →
`2026-10-10T22:51:01.5908216Z`. This single reading is what refutes F2 below.

**check-breadcrumb.mjs --freshness.** [MEASURED] exit **2**. `structure: 17 checked, 0 malformed,
0 skipped`. One `NOTE`: 04's `…2026-10-11-0209-…` breadcrumb is UNTRACKED. Freshness block:

```
  00  last 2026-10-10T21:14:00Z   1.6h ago  (cadence 1h + grace 0.5h)   MISSED
  02  dispatch-only — no cadence to miss
  03  last 2026-10-09T23:03:00Z  23.7h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-11T02:09:00Z  -3.4h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-10-11T14:25:00Z -15.6h ago  (cadence 24h + grace 3h)    ok
```

The two NEGATIVE ages are the instrument telling you it was handed future-dated inputs. See F4.

**Dev tree dirty set.** [MEASURED] `git status --porcelain=v1`:
` M docs/data-model/metadata-catalog.json`, ` M docs/pipeline/sweep-rotation.json`,
`?? .codex/`, `?? AGENTS.md`, `?? "Claude Design/docs/index.html"`,
`?? "Claude Design/proposed/{estimate-export,list-item-rename,quote-override}/"`,
`?? docs/pr-prompts/00-04-scanner-2026-10-11-0209-….md`.
`git diff --cached --name-status` → **EMPTY**, so nothing else is staged and no pathspec commit was
needed. The `.codex/` + `AGENTS.md` pair is the already-mapped `CODEX_LAYER_MAPPED_V1` row in
STATION-CAPABILITIES §1, not a new finding.

**The process storm.** [MEASURED] `Get-Process powershell` enumerated **~900** live
`powershell.exe` PIDs, the oldest two (`1572`… and PIDs `2068`, `8416`) started
**2026-10-08 07:28 local** — two days old. Section 2 independently reports
`auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1`,
`wrapper pid 2068 started 10-08 07:28 local` and `wrapper pid 35512 started 10-10 11:35 local`.

**VM sandbox transport.** [CANNOT MEASURE] the VM clock. `mcp__workspace__bash` first timed out,
then returned
`bash failed on resume, create, and re-resume. resume: RPC error -1: process with name
"lucid-inspiring-bohr" already running (id: oneshot-677ca611-…)`. This is the same sandbox wedge 00
recorded at 1705 and 04 recorded as F1 at 0209. The guard install earlier in the run had already
succeeded, before the wedge.

**Worktrees, section 2 [LIVE].** `non-main worktrees found: 33`, plus
`worktree-registry-escapees: 3` (`C:\PR-Master\worktrees\bootstrap-check`,
`C:\PR-Master\worktrees\sweep-section5`, `C:\po-wt\dispatch-register-v1`, all `size=0KB`,
`.lock=False`). Many hold unpushed commits. `guard hook (.claude/hooks/guard.mjs): present`.

## WHAT CHANGED

**One board PR opened: `#2310`.** No prompt armed, no prompt disarmed, no PR merged, no branch
updated on an existing PR, no label added or removed, no escalation retired, no scheduled task
touched, no `/sot/` edit, no worktree pruned, no process killed.

**`#2310` — `docs(pipeline): commit 04's sweep-rotation advance to index 3`.** This closes F7, which
had deferred four consecutive occurrences. Every board-driving condition read back:

1. **Sanctioned primitives / lane.** Docs-only, one file, two lines
   (`docs/pipeline/sweep-rotation.json`, `last_index` 2 → 3) — inside 00's recorded `docs/` lane and
   outside CP-26's receipt trigger, so no receipt was written and none was needed. No raw
   `gh pr merge` and no hand `git merge` was used, because nothing was merged.
2. **Clean isolated worktree.** `git worktree add -b chore/commit-sweep-rotation-1010
   C:\po-wt\rot1010 origin/main` → exit 0, `HEAD is now at eff8b4b5`. Never the dev tree, never
   `C:\po-watcher`, never the interactive tree. **Torn down:** `git worktree remove C:\po-wt\rot1010`
   → exit 0.
3. **Single actor.** `Enter-BoardLease -Actor 'station-00.scheduled'` → `True` **before** the
   mutation, with `$env:PO_ACTOR='station-00.scheduled'` set so the generated-actor trap
   (`pwsh-<pid>` refusing a station against its own lease) could not fire. `Exit-BoardLease -Actor
   'station-00.scheduled'` → `True` after. The pre-existing checks also passed first: both
   `index.lock` readings `False`, scoped git processes `0`, no PR touched in 2 min, lease `free`.
4. **Read back, not "I pushed".** `git status` in the worktree: one modified path, `--cached` empty,
   so no pathspec commit was needed. Commit `71e67b5a`, `1 file changed, 2 insertions(+), 2
   deletions(-)`. Push exit 0 with local `71e67b5a` == `origin/chore/commit-sweep-rotation-1010`
   `71e67b5a`. `gh pr view 2310 --json number,state,headRefOid,mergeStateStatus,labels,files` →
   `state OPEN`, `headRefOid 71e67b5a` (matches), `labels []`, `mergeStateStatus BLOCKED`, files
   exactly the one path. **`#2310` is OPEN and NOT merged** — see below.

⚠️ **`#2310` was deliberately not merged.** Section 3's `BUILD IN FLIGHT` reading blocks merging, and
`mergeStateStatus` is `BLOCKED` pending its own checks. It carries **no** `do-not-merge` label and it
is a second-lane PR in the sense of DOCTRINE §10.1 step 3 — opened by a station inside its own
recorded authority — so it is classified by STATION-CAPABILITIES §5, not by `classifyPolicyFiles`,
and it is docs-only. **Next occurrence: re-read the gate, then `Assert-SmokedOrEscalate` → `Merge-Pr`
with `-Actor station-00.scheduled`.** Do not read `BLOCKED` as needing Marco.

**Dev tree left as I found it.** After teardown: `git rev-list --left-right --count
HEAD...origin/main` → `0  0`, `--cached` EMPTY, and the only path I added to the dirty set is this
breadcrumb. `docs/pipeline/sweep-rotation.json` is still modified in the dev tree — that is
expected and harmless now: once `#2310` lands, the dev-tree copy and `main` carry identical content,
and the fast-forward hazard resolves itself rather than needing the restore-from-`HEAD` cure.

**Why nothing was armed or merged**, and the reading is the sanctioned one: section 3 reports
`BUILD IN FLIGHT: rev-2309-ready.md (tick 1 min old)`, which **blocks arming and merging** by its
own wording. Independently, there was nothing to merge: both pre-existing open PRs are RED **and**
carry `do-not-merge`, which only Marco removes. So the output of this occurrence is a COLLECT, this
report, and the one docs-only PR that closes a four-times-deferred dispatch.

**One file written:** this breadcrumb, at the tracked path
`docs/pr-prompts/00-00-supervisor-2026-10-10-2208-….md` in the **dev tree** — the second of the two
sanctioned homes, where `sweep-breadcrumbs.ps1` batches it onto a branch and Station 00 collects it.
It is **untracked until that sweep's PR lands**, and I am saying so here as the contract requires.
It is not in `docs/qa/`, not in any of the five gitignored sinks named under the
`# Overnight-QA scheduled task` comment in `.gitignore`, not in a disposable worktree, and not in
this session's `outputs` folder.

**`breadcrumb-clean`, and here is the command.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs`
run against this file after it was written: exit **0**,
`structure: 18 checked, 0 malformed, 0 skipped as pre-contract`, and this file `ADMIT`. That is the
one validator the contract recognises, run in its structure form, not `lint-prompt.mjs` — which
rejects breadcrumbs for having no YAML front matter and whose verdict on one is not evidence either
way. The same run re-emitted the `NOTE … is UNTRACKED` line for this file, which is the state
described above.

## FINDINGS

**F1 — `status-sweep.ps1` prints `watcher node: NOT RUNNING` from a FAILED `Get-CimInstance`, and
the same report contradicts it two sections later.**
[MEASURED] Section 2, run 22:14:41Z, emits
`Get-CimInstance : The remote procedure call failed.` at `status-sweep.ps1:263`
(`$w = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Wher…`), HRESULT
`0x800706be`, and then prints `[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain`.
Line 267 (`Name='powershell.exe'`) additionally failed with `Call cancelled`
(`0x80041032`), and section 3's line 548 (`Name='claude.exe'`) failed with the same
`0x800706be` before printing `[INFO] headless claude-code sessions: 0`.
[MEASURED] **Section 3 of the very same run reports the opposite, from a different instrument:**
`watcher build … BUILD IN FLIGHT: rev-2309-ready.md (tick 1 min old)`. A heartbeat that ticked one
minute ago is positive evidence the watcher IS running, and the heartbeat only ticks MID-RUN
(DOCTRINE §9.5) — so it is evidence of a *live build*, not of an idle process.
[INFERRED] A failed CIM call returned an empty collection, the empty collection flowed into a count
comparison, and the comparison printed a confident negative tagged `[LIVE]`. That is DOCTRINE §7
standing guard 2 — *"connect, then assert; never let a failed call flow into a comparison"* —
violated **inside the sanctioned safe-to-act instrument**, and §9.6 cannot fire because nothing is
empty at the point the reader looks. The failure mode is the one §7 names as the worst available:
*"a broken MEASUREMENT of a working system."*
⚠️ **This is a recurrence, with a new instance.** 04's 1410 breadcrumb already filed
*"a silenced CIM call in the sanctioned liveness probe"*; this adds `status-sweep.ps1` lines 263,
267 and 548 to the same class, and 00's own 2114 breadcrumb refuted the obvious CIM→WMI swap within
the hour (WMI had failed too). So the fix direction is genuinely open and not guessable.
⚠️ **Falsifying probe:** re-run `status-sweep.ps1` and read sections 2 and 3 together. If section 2
ever reports `NOT RUNNING` with **no** `Get-CimInstance` error above it, and section 3 agrees, this
finding is wrong and the watcher really is down.
**DISPOSITION: ESCALATED.** Folded into the single ask in FOR MARCO below — the file is
`scripts/pipeline/status-sweep.ps1`, i.e. outside `tests/`/`docs/`, so CP-26 demands a receipt and
`standing-lanes.json` has no lane that covers `scripts/`. No station can merge it.

**F2 — 04's F2, *"Station 00 has been dark for roughly three hours and three hourly occurrences"*,
is REFUTED. Its premise was a clock, not the scheduler.**
[MEASURED] 04's own falsifying probe, re-read live this run: `00-supervisor` `nextRunAt` is
`2026-10-10T23:13:52Z`. The host clock at the moment of reading was `2026-10-10T22:51:01.5908216Z`.
`nextRunAt` is therefore **23 minutes in the FUTURE**, not ~3 hours in the past.
[MEASURED] `lastRunAt 2026-10-10T22:08:59Z` **is this run**, and this run is sighted and produced
this breadcrumb — so the 23:13, 00:13 and 01:13 occurrences 04 reported as "did not fire" had not
yet come due when 04 measured. 03 is in the same shape: `nextRunAt 2026-10-10T23:02:45Z` is also in
the future, so its "~3h past" reading fails identically.
[INFERRED] 04 compared a correct `nextRunAt` against a wrong *now*. Its breadcrumb is stamped
`2026-10-11-0209` while its `lastRunAt` is `2026-10-10T22:10:09Z` — a forward skew of about four
hours in whatever clock the blind transport handed it, which is exactly the size needed to turn
`23:13:52Z` into "~3h ago".
⚠️ 04 was right to quote the raw pairs instead of asserting a day count, and right that the previous
instance of this shape was discharged as false
(`docs/pipeline/discharges/2026-10-10-0226Z-stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`).
That discipline is what made this refutable in one reading. **The honest framing is not "it is back
with a 3-hour gap" — it is "the same false shape has now been produced twice, by two different
instruments, and neither time was the scheduler at fault."**
**DISPOSITION: ACTIONED.** Refuted here with a live host-clock reading against the live MCP, so the
next run does not re-escalate it and Marco is not asked a third time. No scheduler change is needed
and none was made.

**F3 — 00's own `MISSED` from `--freshness` is this run mid-flight, not a defect.**
[MEASURED] `--freshness` exit 2, `00  last 2026-10-10T21:14:00Z  1.6h ago (cadence 1h + grace 0.5h)
MISSED` — i.e. missed by about six minutes. [MEASURED] `lastRunAt 2026-10-10T22:08:59Z` is fresh,
and the session producing it is the one writing this file.
Against the station doc's classification table that is the row *"`lastRunAt` fresh, no breadcrumb,
session `running` → mid-run — NOT a defect"*, and against FRESHNESS_ONE_CADENCE_V1's three classes
it is none of **never fired**, **fired and died** or **reported, not merged**: the breadcrumb simply
did not exist yet at the moment the validator ran. The station doc's own rule applies —
*"MISSED is a lead, not a verdict"* — and the validator cannot see a report that is being written
while it runs.
**DISPOSITION: ACTIONED.** Classified, and the writing of this breadcrumb is what clears it. The
next run should read 00 as `ok`; if it does not, that is a real MISSED and belongs to F4's question.

**F4 — `--freshness` returned NEGATIVE ages for two of four stations, which is the breadcrumb-stamp
clock defect 04 filed at 1810 (F6), now visible in the validator's own output.**
[MEASURED] `04  last 2026-10-11T02:09:00Z  **-3.4h ago**` and
`05  last 2026-10-11T14:25:00Z  **-15.6h ago**`, both printed `ok`. A negative elapsed time is not a
quantity — it is the instrument reporting that the filename dates it parsed are in the future
relative to true UTC. Both stations ran blind; 04's `lastRunAt` is `2026-10-10T22:10:09Z` and 05's
is `2026-10-10T14:22:59Z`, so both filenames are stamped from a clock that is not the host's UTC.
⚠️ **Why this is not cosmetic.** `--freshness` compares breadcrumb dates and nothing else, so a
future-dated filename buys a station free grace: 05's breadcrumb would read `ok` for a further 15
hours after it genuinely stopped reporting. The defect therefore points in the direction of **not
noticing a missed run** — escalation #23's exact failure mode, and the same direction as the
`CADENCE` constant `#2090` fixed.
⚠️ **Falsifying probe:** compare each station's newest breadcrumb filename stamp against that
station's `lastRunAt` from the MCP. If they agree for every station, this is wrong.
**DISPOSITION: DEFERRED.** Real, already filed by 04 as its 1810 F6, and it needs Marco's one-line
ruling on whether a breadcrumb filename carries UTC or his local Brisbane day — both answers are
one line in the station contract and only he can pick. What would make it urgent: a station using a
`--freshness` `ok` as the sole evidence that another station is reporting. Added to FOR MARCO below
as awareness, not as a new question, because 04 already owns the ask.

**F5 — The `powershell.exe` process storm is still live, is two days old, and two auto-restart
wrappers are alive where one is expected.**
[MEASURED] ~**900** live `powershell.exe` PIDs; oldest start times `2026-10-08 07:28 local`
(PIDs 2068 and 8416). [MEASURED] section 2:
`auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1`,
`wrapper pid 2068 started 10-08 07:28 local`, `wrapper pid 35512 started 10-10 11:35 local`.
[INFERRED] This is the leading cause of F1: WMI/CIM has a per-host handle and RPC budget, and
`0x800706be` plus `Call cancelled` on three separate `Win32_Process` queries in one script is the
signature of that budget being exhausted rather than of any watcher state. 00's 2015 breadcrumb
measured 929 shells across eight wrapper pids; the shell count is unchanged and the wrapper count is
now two, so **the generator is still running.**
⚠️ The oldest surviving wrapper (pid 2068) predates the newer one by two days, which is the shape of
a wrapper that was never retired when a second was started.
**DISPOSITION: ESCALATED.** Killing ~900 processes and one of two wrappers is machine repair, and the
authority matrix records Station 03 as **report-only** on *Repair the machines* — so there is no
station I can dispatch this to for the actual kill, and choosing *which* wrapper dies is
irreversible in the sense DOCTRINE §5.4 means. Folded into FOR MARCO below.

**F6 — `status-sweep.ps1` ran for over 35 minutes without finishing, dominated by section 5, and the
PR that fixes exactly this is red and waiting on Marco.**
[MEASURED] header stamp `22:14:41Z`; still writing at `22:49:46Z` at 41,218 B; at that point section
5 had reached only the `l…` filenames of 56 `needs-marco/` files, each costing one `gh` round trip.
[MEASURED] `#2294` is titled *"fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast
switch"* — this defect, named — and is BEHIND, 13 pass / 2 fail, labelled `do-not-merge`, open 26 h.
⚠️ **The run was NOT blocked by this**, and that is worth recording precisely: sections 0–4 carry the
positive controls, the board census, the safe-to-act gate and the queue, and all four were on disk
by ~22:15Z. A station that waits for exit 0 before reading them burns its whole occurrence on a
crawl it does not need. **But the corollary is that no run can honestly quote a `SWEEP_EXIT`** — this
one never saw one, and says so rather than reporting the exit code of a pipeline it appended.
**DISPOSITION: ESCALATED.** Folded into FOR MARCO below; `#2294` needs only his release.

**F7 — 04's F7 is confirmed for a FOURTH consecutive occurrence: the sweep-rotation advance exists
only as an uncommitted dev-tree edit.**
[MEASURED] `git status --porcelain=v1` → ` M docs/pipeline/sweep-rotation.json`, with
`git diff --cached --name-status` EMPTY. #2308's commit message records the previous occurrence
(*"04's 0624 and 1410 advances were never committed"*), and 04's 0209 F7 dispatched the fix to me.
[MEASURED] 04's 0209 breadcrumb is also still untracked, and `--freshness` flagged it:
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`.
⚠️ **The hazard 04 flagged is real and I am not making it worse.** A tracked-but-modified file in the
dev tree blocks the next `git merge --ff-only` while `--numstat` and `--cached` both read EMPTY —
the documented PASS reading. `docs/pipeline/sweep-rotation.json` is in exactly that state now.
**DISPOSITION: ACTIONED — `#2310` opened, and the read-backs are in WHAT CHANGED.**
`docs/pipeline/sweep-rotation.json` (`last_index` 2 → 3) is committed as `71e67b5a` on
`chore/commit-sweep-rotation-1010`, built in a disposable worktree off `origin/main` under the board
lease, pushed with local == remote verified, and the PR reads `state OPEN`, `headRefOid 71e67b5a`,
`labels []`, one file. It is **not merged** — the heartbeat gate forbids that — so the next
occurrence merges it.
⚠️ **I did NOT defer this a fifth time, and that was the call worth making.** The honest alternative
was to hand it on again with a reason, which is what the previous three occurrences each did; a
dispatch that is re-deferred every cycle is indistinguishable from one nobody owns. Opening the PR
is not arming and not merging, so the heartbeat gate does not reach it.
**The two untracked breadcrumbs stay with their designed owner.** 04's 0209 and this file are left
for `sweep-breadcrumbs.ps1`, which is demonstrably working — #2307 (16:48Z, 46 breadcrumbs), #2308
(19:21Z, 3) and #2309 (22:00Z, 3) all landed today. I deliberately did not fold them into `#2310`:
committing a breadcrumb path by hand while the sweep is also batching it invites two PRs racing for
the same path, and the sweep is the mechanism the NO-DRIFT section names.

## WHAT I DID NOT DO

- **Did not arm.** The heartbeat gate (`BUILD IN FLIGHT: rev-2309-ready.md`) blocks arming by its
  own wording, and one prompt is already armed. I also did not read
  `scripts/pipeline/instrument-lane.json`'s NEVER-LIST, because NEVER_LIST_BEFORE_ARMING_V1 only
  binds a run that is about to arm an instrument fix, and I armed nothing.
- **Did not merge anything, and did not call `Assert-SmokedOrEscalate` or `Merge-Pr`.** The two
  pre-existing open PRs are RED and both carry `do-not-merge`; my own `#2310` is new, `BLOCKED`
  pending its first checks, and merging is barred by the live heartbeat gate anyway. So there was no
  merge decision to make and no receipt to write — and I did not write a standing receipt
  speculatively for a merge that has not happened.
- **Did not remove a `do-not-merge` label** — only Marco does, and **did not merge a watcher-routed
  PR**. I did not evaluate the instrument lane for either PR: `INSTRUMENT_LANE_V1` requires *no*
  `do-not-merge` label as its first condition, so both fail at the first test and the remaining
  conditions were not measured.
- **Did not hold the board lease longer than the one mutation needed.** It was taken as
  `station-00.scheduled` immediately before `#2310`'s worktree and released immediately after the PR
  read-back, rather than held across the whole run or left to expire on its 30-minute timer.
- **Did not call `gh pr update-branch` on either BEHIND PR.** The watcher's auto-update timer is OFF
  by default and every stray update-branch costs a full CI rebuild — and the rule is to never call it
  on a PR you are not about to merge. I am not about to merge either.
- **Did not retire any escalation.** Section 5 of the sweep never finished, so I have no complete
  `[STALE]` row set to work from, and the rows I did see are `[FILE]`, not `[LIVE]`. The ones visible
  all carry the same *"cites #N (MERGED) as evidence — not its premise; does not clear the
  escalation"* shape, and section 5's own line says *"section 5 CANNOT decide whether it is stale.
  Read the file; do not clear it on this line alone."* Clearing one on that reading would be the
  cautious-looking sweep DOCTRINE §5b records as discarding work Marco asked for.
- **Did not archive the breadcrumbs I collected, although I did open a board PR.** `#2310` was
  deliberately kept to the single rotation file: 04's 0209 and this breadcrumb are still untracked
  and belong to `sweep-breadcrumbs.ps1`, so `git mv`-ing them into `archive/` from a PR would move
  paths the sweep is concurrently batching. They stay in the queue root, which is where the contract
  puts the CURRENT cycle anyway; the next cycle archives them once they are tracked.
- **Did not kill a process, prune a worktree, or clear a lock.** 33 non-main worktrees and 3
  registry escapees are recorded above for 03; both `index.lock` readings were `False`, so there was
  no lock to measure byte size and age on, let alone clear — and clearing one is 03's on 00's
  dispatch, never mine.
- **Did not restart, disable, enable, re-run or edit any scheduled task.** F2 and F3 are readings
  about the scheduler, and FRESHNESS_ONE_CADENCE_V1 forbids all of those on a MISSED reading alone.
- **Did not edit `/sot/`** — Station 05's lane only. **No Azure, Entra or SharePoint contact of any
  kind**: no portal, no App Service settings, no app registration, no secret, no permission, no
  consent, no `az`, no `Connect-MgGraph`. **No production data read or written.**
- **Did not run `git` through the VM transport**, and did not reach for the VM mount as a substitute
  when the sandbox wedged. The guard install's own last line was available as a one-call escape
  hatch and I did not use it, because I had no `git` to run there.
- **Did not claim a `SWEEP_EXIT`** (F6) — this run never saw one, and reporting the exit code of a
  pipeline I appended to the script would be the 2026-09-22 mistake. `breadcrumb-clean` IS claimed,
  but only because `check-breadcrumb.mjs` was actually run and exited 0 (quoted in WHAT CHANGED).
  I did not run `lint-prompt.mjs` against this breadcrumb — it rejects breadcrumbs for having no
  YAML front matter and never returns a passing verdict on one, so its result would not be evidence
  of anything in either direction.
- **Did not substitute GitHub-side reads for host coverage.** This run was sighted; every board fact
  above came from `status-sweep.ps1`'s own `[LIVE]` lines on the host.
- **Did not write to this session's `outputs` folder.** That is the measured 2026-09-22 way for a
  complete report to reach nobody.

## FOR MARCO

Three things. **Only the first two need you, and the second is one click.**

**1. The safe-to-act instrument is lying, in the direction that matters, and the obvious fix is
already refuted.** `status-sweep.ps1` printed `watcher node: NOT RUNNING <-- the queue will not
drain` while a build was in flight with a one-minute-old heartbeat, because three
`Get-CimInstance Win32_Process` calls failed with RPC `0x800706be` and the empty results flowed
straight into the counts (F1). Your own earlier 2114 run already refuted swapping CIM for WMI — WMI
has failed too. The cause underneath is almost certainly F5: ~900 `powershell.exe` processes, the
oldest from 10-08, and **two** auto-restart wrappers alive where one is expected (pids 2068 and
35512). RULE 1, complete-and-additive first:

- **(a) Retire the duplicate wrapper and clear the orphaned shells, THEN make the three CIM call
  sites fail loud instead of fail quiet** — a `try/catch` that prints `[CANNOT MEASURE] CIM
  unavailable` and refuses to emit a `[LIVE]` verdict. This passes both halves: it removes the
  generator *and* makes the instrument honest the next time any enumeration budget runs out, and it
  touches no data. It needs you twice — the kill is irreversible and picking which wrapper dies is
  yours, and `scripts/pipeline/status-sweep.ps1` is outside `tests/`/`docs/` so CP-26 wants a
  receipt no `standing-lanes.json` lane covers.
- **(b) Clear the processes only** — fails the *future* half: the next exhaustion prints the same
  confident `NOT RUNNING` with nothing warning.
- **(c) Change the CIM calls only** — fails the *immediately* half: the storm keeps growing and
  every other `Win32_Process` reader on this box stays unreliable.

**Would you rather I staged (a) as a prompt for the script half, or add a `pipeline` lane to
`standing-lanes.json` so instrument fixes under `scripts/pipeline/` stop needing you by hand?** The
second is what stops this class recurring — it is the same question my 1814 run asked about a `ci`
lane for `.github/`, which suggests the lane list, not the individual fixes, is the real gap.

**2. The board is waiting entirely on you, and `#2294` is the one that unblocks a station.** It is
*"dedupe section 5 PR crawl and add -SkipSection5 fast switch"* — the fix for F6, where my sweep ran
35+ minutes without finishing and no run can honestly quote an exit code. Its two reds are the
`do-not-merge` gate and the receipt that gate implies; nothing else. `#2303` additionally has a real
defect, already written up with options in
`needs-marco/spent-hold-gate-fails-closed-…-2026-10-10.md`. **Queue: 1 armed** (`rev-2309-ready.md`,
an auto-generated review job, currently building), `WAITING ON MARCO: 2`.

`#2310`, which I opened this run, **does not need you** — it is docs-only, unlabelled, inside 00's
lane, and the next occurrence merges it. It exists only to stop 04's rotation advance stalling a
fifth time.

**3. No action, for awareness.** I **refuted** 04's escalation that stations 00 and 03 had gone dark
for three hours (F2) — `nextRunAt` was 23 minutes in the *future*, and 04 had compared it against a
clock running about four hours fast. The scheduler is fine and I changed nothing. That same skew is
why `--freshness` printed *negative* ages for 04 and 05 (F4), which buys a silent station up to 15
hours of free grace — the one-line UTC-vs-Brisbane ruling 04 asked for in its 1810 F6 would close
both. Second time this false-dark shape has been produced by a different instrument; both times the
scheduler was innocent.
