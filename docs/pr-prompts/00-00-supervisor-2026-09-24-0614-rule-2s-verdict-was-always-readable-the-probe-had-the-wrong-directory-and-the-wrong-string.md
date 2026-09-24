# Station 00 — Supervisor | 2026-09-24T06:14Z–2026-09-24T07:0xZ

**SIGHTED run.** Desktop Commander connected, `powershell.exe` ran on the Windows host, and the
whole lane (COLLECT / ARM / DISPATCH / MERGE) was available. Doc version and bootstrap AGREE
(`station_doc_version: 1` both sides), so no READ-ONLY posture applies.

**Headline: RULE 2's verdict for the open board was readable the whole time.** The probe that has
answered *"no log for all four PRs"* for eight consecutive occurrences was looking in a directory
that does not exist for a string the watcher does not write. With the right directory and the right
string the verdicts come back in one `Select-String`, with a positive control of 12 and a negative
control of 0 — and they settle the board: **all four open PRs are Marco's, and #2131 is a second-lane
PR with no RULE-2 verdict at all.**

## GROUND

```
UTC            2026-09-24T06:14Z start
origin/main    ffcc9506              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ ffcc9506       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version: 1)
```

**Freshness of the binding documents, measured rather than assumed.** PREFLIGHT step 2 forbids
reading them from the working copy. This run read them from the working copy *after* proving the
working copy is byte-identical to `origin/main` for exactly those paths, using the sanctioned
unpiped form (never `git show ... | git hash-object --stdin`, which PREFLIGHT step 2 records as
UNSOUND in `powershell.exe`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md
  -> EMPTY   (and HEAD == origin/main == ffcc9506, git rev-list --left-right --count -> 0  0)
```

EMPTY output is the real answer: not different. So the working copy IS `origin/main` for the three
documents this run gated on.

## WHAT I MEASURED

### PREFLIGHT step 1 — the box, and the VM git guard

**[MEASURED] The Windows host is reachable.** `ToolSearch` by keyword for `desktop-commander`
(never a hard-coded `select:` of ids, per the step-1 warning) returned the toolkit; `start_process`
shell `powershell.exe` opened PID 12932; `git rev-parse --abbrev-ref HEAD` -> `main`. The 05:14Z
occurrence was blind on the same task one hour earlier, so blindness remains intermittent with an
unknown cause, exactly as DOCTRINE records.

**[MEASURED] `vm-git-guard.sh` — exit 2, the EXPECTED station outcome, quoted as the contract asks.**
Installer's last line and its own exit, read unpiped (`bash .../vm-git-guard.sh; echo "GUARD_EXIT=$?"`,
NOT through `tail`):

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
   PATH="/sessions/inspiring-compassionate-darwin/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Row 2 of the three-outcome table: a FINDING, not a STOP. The device-bridge git ban is REMEMBERED,
not mechanical, for this shell. **No `git` was run against the mount at any point this run** — every
git call went through the Windows shell.

### PREFLIGHT step 4 — the sweep, and the safe-to-act gate

**[MEASURED] `bring-up-to-speed.ps1` ran to completion, `BUTS_EXIT=0`, trailing marker present.**
Its verdict, verbatim:

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Re-measured immediately before the only mutation this run made (the worktree + PR), because §7 says
`[LIVE]` means *true when measured*, not *true now*:

```
index.lock dev: False    index.lock clone: False    git procs: 0
```

No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase-merge / rebase-apply / sequencer
anywhere. **No stale lock, and nothing to clear.**

**[MEASURED] Single-actor (BOARD DRIVING condition 3) was NOT satisfied at the start of this run and
WAS satisfied before the mutation.** `04-scanner` fired at `06:09:44Z` — five minutes before this
occurrence — and `list_sessions` showed `local_f1a6f0bb... "04 scanner" (running)` while this run was
building its picture. That is the documented by-construction overlap (00 hourly x 04 four-hourly),
not a defect. **Nothing was mutated while it was running.** A later `list_sessions` showed the same
session `idle`, and 04's 06:10Z breadcrumb had landed on disk — so 04 had finished, not been
interrupted. Only then was the worktree created.

### COLLECT — the breadcrumbs, and what the freshness table alone cannot say

**[MEASURED] `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0, re-run after 04 finished:**

```
structure: 3 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-09-24T05:14:00Z  1.3h ago  (cadence 1h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  7.4h ago  (cadence 24h)  ok
  04  last 2026-09-24T06:10:00Z  0.3h ago  (cadence 4h)   ok
  05  last 2026-09-23T14:23:00Z  16.1h ago (cadence 24h)  ok
CLEAN
```

**[MEASURED] The `lastRunAt` cross-check the contract requires, because the breadcrumb is one
instrument and cannot name a cause.** `list_scheduled_tasks` (scheduled-tasks MCP):

| task | cron | lastRunAt | newest breadcrumb | row |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` (hourly) | `2026-09-24T06:14:05Z` | 05:14Z | this run; aligned |
| `04-scanner` | `0 */4 * * *` | `2026-09-24T06:09:44Z` | 06:10Z | **both fresh and aligned — healthy** |
| `05-sot-keeper` | `10 0 * * *` | `2026-09-23T14:22:41Z` | 14:23Z | aligned; next `2026-09-24T14:22Z` |
| `03-machine-minder` | `0 9 * * *` | `2026-09-23T23:02:54Z` | 23:04Z | aligned |
| `weekly-security-audit` | `30 7 * * 1` | `2026-09-06T21:32Z` | — | **`enabled: false`** — already escalated, unchanged |

**Station 00's own cadence, read from the live listing rather than from any pasted line: `5 * * * *`
— hourly.** The bootstrap's own warning not to compute a missed-occurrence verdict from a pasted
cadence is honoured: this table is the MCP's answer, today.

**No station is SILENT. No station is mid-run unreported. Nothing here is a defect.**

**[MEASURED] Two untracked breadcrumbs were waiting to be swept, and this run swept both.**

```
NOTE 00-00-supervisor-2026-09-24-0514-blind-desktop-commander-connect-timeout.md is UNTRACKED
NOTE 00-04-scanner-2026-09-24-0610-four-pipeline-scripts-misname-a-wrong-cwd-...md is UNTRACKED
```

The 05:14Z blind run closed with *"Station 00's next sighted run must sweep this file up — it is the
one thing this run needs from the next one."* Done, in this run's PR. 04's 06:10Z breadcrumb landed
in the same PR, together with the `docs/pipeline/sweep-rotation.json` advance 04 is told to leave
dirty in the shared dev tree because it may not commit there (` M`, the only TRACKED modification in
the dev tree).

### THE FINDING — RULE 2's verdict, and the probe that could not read it

**[MEASURED] The watcher log directory is `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\`
— 53 files, newest written `2026-09-24T06:20:01Z`. `C:\po-watcher\logs` DOES NOT EXIST
(`Test-Path` -> `False`).** A probe pointed at the second answers zero files, exit 0, no warning —
§9.6 with the emptiness manufactured by a wrong path.

**[MEASURED] The line the watcher actually writes is not the line the probe hunts for.** In today's
log — 452 lines, 234 containing `PR`, 50 containing `merge`, so the instrument is demonstrably able
to find things — the string `merge result for PR` matches **0** times. The live shape is:

```
[2026-09-23T20:41:55.269Z] [merge] pr-devtree-sync-ff-only-guard-ready.md: PR #2135 stays for Marco (outside tests/ or docs/: .claude/hooks/guard.mjs)
```

**[MEASURED] With the right directory and the right string, every verdict is there.** Positive
control: `Select-String -Path "$D\*.log" -Pattern 'stays for Marco'` -> **12** rows. Negative
control: a freshly minted needle over the same files -> **0**.

| PR | RULE-2 row in the watcher's own log | verdict |
|---|---|---|
| **#2148** | `[merge] pr-sec-a3-no-credential-logs-ready.md: PR #2148 stays for Marco (escalates:true - PR already carries do-not-merge - no duplicate apply)` | **Marco's** |
| **#2135** | `[merge] pr-devtree-sync-ff-only-guard-ready.md: PR #2135 stays for Marco (outside tests/ or docs/: .claude/hooks/guard.mjs)` | **Marco's** |
| **#2127** | `[merge] pr-field-service-nul-separator-ready.md: PR #2127 stays for Marco (outside tests/ or docs/: apps/api/src/modules/field/field.service.ts)` | **Marco's** |
| **#2131** | **NO ROW. No `stays for Marco`, and no `opened PR #2131` either.** | **§10.1 — second lane** |

**[MEASURED] #2131 was not opened by the watcher, and that is the whole difference.** The
`[merge] <prompt>: opened PR #N` row exists for #2127 (`16:38:11Z`), #2135 (`20:41:54Z`) and #2148
(`02:56:43Z`), and is **absent for #2131**. The only trace of #2131 in the watcher's files is from
the *review* lane — `[review] enqueued review for PR #2131 ... rev-2131-ready.md`, which seeds from
the GitHub board and therefore sees second-lane PRs too. Control: the last six `opened PR #` rows of
any number are all present and well-formed, so the probe is not blind.

**So the 04:14Z diagnosis was half the cause.** That run attributed *"no log for all four PRs"* to a
regex escape doubling as it crossed PowerShell into `node`, and #2151 landed that in DOCTRINE. The
escape bug is real and its note stands. **It is not what was hiding these verdicts**: the directory
was wrong and the search string was wrong, and the working probe needs no `node` at all. A cure that
fixed only the escaping would still have returned zero.

🔧 **The probe, in the form that works — quote this one:**

```powershell
$D = 'C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs'
Select-String -Path "$D\*.log" -Pattern 'PR #<n> stays'      # the RULE-2 verdict
Select-String -Path "$D\*.log" -Pattern 'opened PR #<n>'     # did the WATCHER open it? (§10.1)
```

⚠️ **Falsifying probe, and it is the control pair above.** Run `'stays for Marco'` and a minted
needle over the same glob. If the first ever returns 0 while the files are non-empty and the
negative control also returns 0, the shape has changed again and this must be re-measured. If
`C:\po-watcher\logs` ever comes into existence, the directory half is wrong and must be re-measured.

### THE ONE RED ON THE BOARD — diagnosed from the job log, never from the diff

**[MEASURED] #2148's two failing checks are ONE cause, and it is a human gate, not a defect.**
`gh run view 35956346202 --job 107495381078 --log`:

```
PASS - CP-11 migrations [no migration changes]
PASS - CP-12 env-vars   PASS - CP-13 dependencies   PASS - CP-17 dto-validation
SKIP - CP-09/10 scope   PASS - CP-23 seed-without-migration   PASS - CP-24 sot-purity
SKIP - CP-22 verification-checklist   PASS - CP-25 failure-honesty   SKIP - CP-27 sot-inpr-freshness
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
##[error]Process completed with exit code 1.
```

15 checks: 13 green, and the two reds — `PR gates — diff checks` and `Approval receipt (CP-26)` —
are **the same CP-26 firing in two jobs**. **There is nothing to fix and nothing to re-run.** The
red IS the gate. Re-running it would be the §2 *"never re-run hoping for green"* mistake with extra
steps, and "drive it green" is impossible by construction: only Marco removing the label clears it.

### ARMING — nothing is armable, and that is now measured rather than inferred

**[MEASURED] armed = 0. HOLDs = 15. `lint-prompt.mjs` over every one of them: ADMIT 1 / REJECT 14.**

| reject class | count | prompts |
|---|---|---|
| `HUMAN_GATE_PRESENT` | 8 | `pr-524-rates-b-slice2-canonical`, `pr-nav-jobs-projects-merge`, `pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`, `pr-scopecards-s8b-azure-maps-travel`, `pr-sec-a2-email-codes-and-reset-links`, `pr-siteid-notnull-backfill`, `pr-vendor-invoice-ocr` |
| `FILE_GATE_NOT_RELEASED` | 4 | `pr-fv2-ai-digests`, `pr-fv2-output-channels`, `pr-rates-s11c-drop-legacy-tables`, `pr-tenant-mt4-s2-ownership-migration` |
| `GATE_NOT_RELEASED` | 2 | `pr-sec-a1-auth-secret-fail-fast`, `pr-tipid-s3-retire-the-name-guard-for-an-id-check` |

**The single ADMIT is `pr-fv2-formrule-contract-HOLD.md`, which is on the PERMANENT never-arm
denylist** named in this station's own doc and enforced in `queue-sync.ps1`. That is DOCTRINE §9.5
exactly as written: **lint ADMIT is necessary, not sufficient.** It was not armed.

**[MEASURED] Two HOLDs have had their machine gate MET and are still correctly un-armable, which is
worth stating because a gate-met prompt looks armable at a glance.** Markers read from `origin/main`
with a negative control of 0:

- `docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` -> **1 hit, gate MET** for
  `pr-queue-layout-sot-entry-HOLD.md`. It carries `<!-- watcher: do-not-arm -->` and, in its own
  body, *"NEVER ARM THIS PROMPT ... the watcher does not read a prompt's `station:` front-matter
  field, so arming this would hand a `sot/`-only build to Station 01."* It is **Station 05's**.
- `apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1` -> **2 hits, gate MET** for
  `pr-scopecards-s8b-azure-maps-travel-HOLD.md`, whose marker reads *"MARCO GATE: arm only after
  Marco has created the Azure Maps account..."*. Azure. Not a station's to clear, ever.

**[MEASURED] The sec-auth chain is intact and #2148 is its keystone.**
`SEC_A3_NO_CREDENTIAL_LOGS_V1` in `apps/api/src/modules/auth/otp-delivery.port.ts` on `origin/main`
-> **0 hits** (the file itself is PRESENT, so this is the marker's absence, not the file's). A1 and
A2 are therefore correctly HELD, and they unblock the moment Marco takes the label off #2148.

**[MEASURED] The approvals channel has issued one file, ever.**
`git ls-tree -r --name-only origin/main -- docs/approvals/` -> `README.md` and
`watcher-identity-approved-by-marco.md`. Five HOLDs name an approval file under that path and **all
five are ABSENT**. That is the standing escalation
(`five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`), still
true, still Marco's, and not re-opened as a new finding here.

### Escalation hygiene

**[MEASURED] `status-sweep.ps1` section 5 tagged ZERO rows `[STALE]` this run.** Every row was
`[FILE] ... cites #N (MERGED) as evidence -- not its premise; does not clear the escalation`, or
*"no PR ref — read it as a SNAPSHOT"*. So there is **nothing to discharge into
`needs-marco/discharged/`** this cycle. The one `[LIVE]` row is
`pr-2135-review-fix.md references #2135 = OPEN -- genuinely open`, which is correct and stays.
`needs-marco/` = 47, unchanged.

### The machine

**[MEASURED] Watcher HEALTHY, and by more than one signal.** `node` RUNNING pid 38776; auto-restart
wrapper alive (1); watcher clone `branch=main`; non-main worktrees: none; registry escapees: none;
guard hook present. The sweep's `heartbeat age: 100 min` is the *build* heartbeat and ticks only
mid-run — with `armed = 0` that is idle-correct, not wedged. Independent liveness cross-check: the
watcher's own log is still ticking every five minutes, last line
`[2026-09-24T06:25:01.399Z] [review] verdict-archive sweep: archived=0 kept=2 skipped=0 tracked=171`.
**An idle watcher with nothing armed is CORRECT.** No restart was considered.

## WHAT CHANGED

**One PR, docs-only, opened by this run. Nothing else on the board was touched.**

- Swept up `00-00-supervisor-2026-09-24-0514-blind-desktop-commander-connect-timeout.md` (12812 B) —
  the blind run's report, previously untracked and reaching nobody.
- Swept up `00-04-scanner-2026-09-24-0610-four-pipeline-scripts-misname-a-wrong-cwd-and-one-points-at-a-gate-defeating-remedy.md`
  (22846 B) — Station 04's report, previously untracked.
- Swept up `docs/pipeline/sweep-rotation.json` (2837 B) — 04's rotation advance, which 04 cannot
  commit in the shared dev tree.
- `git mv`-ed `00-00-supervisor-2026-09-24-0414-...md` into `docs/pr-prompts/archive/` — every
  finding in it carries a literal disposition, verified by the 05:14Z run and re-confirmed here.
- Added this breadcrumb, **written inside the PR worktree** (REPORT CONTRACT cure 1), so no loose
  copy of it exists in the dev tree and it cannot block the next fast-forward.

**No PR was merged, labelled, closed or commented on. No prompt was armed, disarmed, renamed or
binned. No `-HOLD.md` was moved. No escalation file was discharged. No watcher process was touched.
`sot/` was not read for edit and not written.**

## FINDINGS

### F1 — RULE 2's verdict for the whole board was readable all along; the probe had the wrong directory AND the wrong string, and the 04:14Z diagnosis named only a third cause

Measured in full above, with a positive control of 12 and a negative control of 0. Eight
consecutive occurrences have reported *"no log for all four PRs"* and treated the board's routing as
unknowable. It was never unknowable. The cost was not a wrong merge — every run correctly withheld —
but eight runs of an instrument reporting an absence it manufactured, which is precisely the §7
shape, and a real second-lane PR (F2) sat unidentified inside that blind spot the whole time.

**DISPOSITION: ACTIONED** — the working probe is recorded above with both controls and its own
falsifying probe, and it is landed in this run's PR where the next run reads it. Verified by
re-running it against three PRs whose verdict was independently confirmable from `gh pr view`
(`#2148` carries `do-not-merge`; `#2135` touches `.claude/hooks/guard.mjs`; `#2127` touches
`apps/api/src/modules/field/field.service.ts`) — all three agreed. The DOCTRINE / station-doc text
that still names the old string is left alone deliberately: see WHAT I DID NOT DO.

### F2 — #2131 is a second-lane PR: CLEAN, green, unlabelled, reviewed MERGE, and carrying no RULE-2 verdict at all

`fix(pipeline): why-blocked.ps1 is an unconditional squash-merge and both docs called it read-only`.
`mergeStateStatus=CLEAN`, 15/15 checks green, `labels=[]`, no auto-merge, open since
`2026-09-23T19:28Z` — and the watcher never opened it, so RULE 2 never ruled on it. This is DOCTRINE
§10.1 in the flesh: **a PR the watcher did not open carries no RULE-2 verdict, and that absence must
never be read as "cleared for merge."** To a run that reads only `CLEAN` + `labels=[]` it is the
most merge-eligible thing on the board. It also edits **this station's own binding doc**
(`docs/pipeline/stations/00-supervisor.md`) and `scripts/pipeline/why-blocked.ps1`.

It was **not merged**, and not on the absence of a verdict — on the verdict's own criterion applied
to the diff: `scripts/pipeline/why-blocked.ps1` is outside `tests/` and outside `docs/`, which is
exactly what routed #2135 and #2127 to Marco. Had the watcher opened it, RULE 2 would have written
`stays for Marco (outside tests/ or docs/: scripts/pipeline/why-blocked.ps1)`.

**DISPOSITION: ESCALATED** — Marco's, with one question at the end of this report. The PR is
correct, reviewed MERGE by the review lane, green, and structurally unmergeable by this station.

### F3 — Station 04's F1 was DISPATCHED to Station 00 and this run did not build the repair

04's 06:10Z breadcrumb, F1: four of the five cwd-relative state paths in `scripts/pipeline` name the
wrong cause when a station runs them from the shell it is actually given, and `lint-station.mjs`'s
message points at a remedy that **defeats the canonical-block hash gate**. 04 states the repair is
`scripts/pipeline/**`, outside its own lane, and hands it to me. Its own 2026-08-28 deferral's named
trigger has now fired, which is why 04 re-raised it rather than leaving it deferred.

**DISPOSITION: DEFERRED** — real, correctly mine, and deliberately not started in the last fifteen
minutes of an hourly slot this pipeline already has an open escalation about overrunning
(`station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`). **The trigger is
explicit and dated: it is the FIRST work item of the next Station 00 run**, ahead of collect, with
the scope 04 already named. What would make it urgent sooner: a station acting on one of those four
wrong causes, or anyone following `lint-station.mjs`'s advisory and re-recording a canonical-block
hash it should not have touched — the second is a silent gate defeat and is why this is S3, not S4.

### F4 — 04's F2 and F3, carried with their dispositions intact

- **04/F2** — the four enabled bootstraps still cite `.gitignore:107-111` for the QA sinks (they are
  at 115-119), and `05-sot-keeper`'s still cites `pr-gates.mjs:327`, retired to a symbol anchor on
  2026-09-10. 04 dispositioned it *"DEFERRED - already with Marco, nothing for a station to do"*,
  day 18. The bootstraps live outside the repo; no station can edit them.
  **DISPOSITION: ESCALATED** — unchanged, already with Marco, restated in FOR MARCO below only
  because day 18 of a rotting citation in every station's first instruction is worth one line.
- **04/F3** — `lint-station.mjs`'s Windows-path advisory fires on regex literals, so a clean run
  prints unactionable warnings. **DISPOSITION: DEFERRED** — cosmetic today, and it folds naturally
  into F3's repair above since both live in `scripts/pipeline`.

### F5 — The blind 05:14Z occurrence, and its three findings

F1 (blind run), F2 (the binding-read contract has no sighted-free path) and F3 (the four PRs are
Marco's) were all dispositioned by that run and needed only sweeping up.

**DISPOSITION: ACTIONED** — its one request, *"Station 00's next sighted run must sweep this file
up"*, is satisfied by this run's PR. Its F1 falsifying probe is confirmed NOT to have graduated:
`--freshness` reads `00 ... ok`, not SILENT, so the blindness remains intermittent rather than
persistent and stays a data point rather than a question for Marco. Its F3 is superseded by F2
above, which measures what that run could only carry forward.

### F6 — Nothing is armable, and the board cannot move without Marco

Measured above: armed 0, HOLDs 15, lint ADMIT 1 / REJECT 14, and the single ADMIT is permanently
never-arm. Four open PRs, all Marco's. The two gate-MET HOLDs are gated on a human, not a machine.
**The single most important thing blocking progress right now is that every remaining path forward
runs through Marco**, and the shortest one is one label on #2148 — which then releases two more
HOLDs (A1, A2) on the same chain.

**DISPOSITION: ESCALATED** — see FOR MARCO. No new question; the ranking is new.

## WHAT I DID NOT DO

- **Did not merge anything, including the three green PRs.** #2135, #2127 and #2148 carry explicit
  RULE-2 `stays for Marco` rows quoted above; #2131 carries none and §10.1 forbids reading that as
  clearance. This is the eighth consecutive occurrence on which the correct action was to withhold,
  and the first on which it was withheld *from a measured verdict* rather than from an unreadable
  one.
- **Did not re-run #2148's red checks.** The log names CP-26, a human label gate. Re-running a gate
  that is doing its job is the §2 mistake.
- **Did not arm `pr-fv2-formrule-contract-HOLD.md`** despite its lint ADMIT — permanent never-arm
  denylist, §9.5.
- **Did not arm the two gate-MET HOLDs.** `pr-queue-layout-sot-entry` is Station 05's by its own
  body; `pr-scopecards-s8b-azure-maps-travel` is behind an Azure account Marco must create, and
  Azure is an absolute hard stop.
- **Did not fix the DOCTRINE / station-doc text that still names the old RULE-2 probe string.**
  DOCTRINE §9 is a canonical block whose hash is gated by `lint-station.mjs`; editing it requires
  re-recording the hash and shipping all seven station docs in one PR, which is more than a collect
  run should carry — and `docs/pipeline/stations/00-supervisor.md` is being edited right now by
  #2131, so a second edit would manufacture the conflict. The working probe lives in this
  breadcrumb, which is where state belongs; the doc change is named here for a run that can carry
  it.
- **Did not act while Station 04 was running.** The picture was built during 04's run; the worktree
  and the PR came after `list_sessions` showed it idle and its breadcrumb on disk.
- **Did not touch `sot/`** — never this station's.
- **Did not touch `C:\po-watcher\ProjectOperations` with anything but read-only `Select-String` over
  its log files.** No `git` of any kind ran there.
- **Did not discharge any `needs-marco/` file** — the sweep tagged zero `[STALE]` rows, so there was
  nothing dead to clear, and discharging on anything weaker than a per-PR re-ask is forbidden.
- **Did not leave a loose copy of this breadcrumb in the dev tree.** It was written inside the PR
  worktree (cure 1), so the post-merge fast-forward has no untracked path of mine to collide with.
  The two breadcrumbs this run swept up WERE written to the dev tree by their own runs, so the
  fast-forward after this PR merges will meet them; the cure and its four read-backs are in the
  station doc.
- **Did not quote a `lint-prompt.mjs` verdict about this breadcrumb.** It rejects every breadcrumb
  for having no front matter and its result on one is not evidence in either direction. The
  validator that counts is `check-breadcrumb.mjs`, quoted in the PR body.

## FOR MARCO — one label is the whole board

Everything is healthy and nothing can move. The watcher is up, the trunk is green, no station is
silent, nothing is looping, no lock is stale, and there is **nothing left that a station is allowed
to do**: 15 held prompts, 14 rejected by lint on a gate, and the one that passes is on the permanent
never-arm list.

**The shortest path is #2148.** It stops live sign-in codes and password-reset links being written
to the production log. It is 13/15 green, and both reds are the *same* check — CP-26 — saying
*"a human must review and REMOVE the `do-not-merge` label; removing it is what releases the merge."*
Taking that label off also releases two more held prompts (`sec-a1` JWT fail-closed and `sec-a2`
email codes / reset links), which are waiting on a marker only #2148 puts on `main`. One label,
three things move.

**Then #2135, #2127, and #2131.** All green, all yours — the first two because the watcher routed
them to you for touching files outside `tests/` and `docs/`, the third for a different reason worth
thirty seconds of your attention:

> **#2131 was not opened by the watcher.** It is green, reviewed MERGE, carries no labels — and no
> routing verdict of any kind, because RULE 2 only ever ran on PRs the watcher opened. It also edits
> Station 00's own binding instructions. I treated it as yours by applying RULE 2's rule to its diff
> (`scripts/pipeline/why-blocked.ps1` is outside `tests/` and `docs/`). **The standing question is
> unchanged and is still the one in `CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`:
> when a lane that is not the watcher opens a PR, who routes it?** Today the answer is "nobody, and
> the stations withhold" — which is safe, and is also why green PRs sit.

One smaller thing, day 18: the `.gitignore` line-number citations in all four enabled station
bootstraps are stale again (`107-111`, actually `115-119`), and `05-sot-keeper`'s still points at
`pr-gates.mjs:327`, which now lands on a carve-out comment rather than the block it names. Those
files live outside the repo, so no station can fix them — it is the same ITEM 1 / ITEM 2 pair
already in front of you.

Nothing else needs you. If the next hourly run reports the same board, that is not a stall in the
machinery — it is the machinery correctly waiting.
