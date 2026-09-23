# Station 00 — Supervisor | 2026-09-23T17:13Z–2026-09-23T17:32Z

## GROUND

```
UTC            2026-09-23T17:13Z
origin/main    4b837602            (fetched, then rev-parse)
dev tree       main @ 4b837602     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was READ-WRITE, not read-only.
Binding docs were read from the DEV TREE, and that is sound this run because the dev tree is level
with `origin/main`: `git rev-list --left-right --count HEAD...origin/main` → `0	0`, and
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, which is the real answer per §9.3. No piped
`hash-object` comparison was made (§9.1 forbids it under `powershell.exe`).

This was a **SIGHTED** run. Desktop Commander `start_process` opened a live `powershell.exe` on the
Windows host (PID 14632) and carried the whole run.

## WHAT I MEASURED

**[MEASURED] Cadence, from the live instrument, not from the bootstrap.** `list_scheduled_tasks`
returns `00-supervisor` `cronExpression: 5 * * * *`, `lastRunAt 2026-09-23T17:13:58Z`. Hourly,
and this is the on-time occurrence. **No missed occurrence to compute.**

**[MEASURED] The device-bridge git guard, quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **`GUARD_EXIT=2`**, last
line before it:

> `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`

Exit read from the INSTALLER itself, not from a pipeline appended to it. This is the **expected**
station outcome (the table in the contract), so it is a finding and not a stop. No `git` was run
through the device bridge at any point this run.

**[MEASURED] Freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `FRESHNESS_EXIT=0`,
`CLEAN`. `00` 0.8h (cadence 1h) ok · `03` 17.8h (24h) ok · `04` 3.1h (4h) ok · `05` 2.9h (24h) ok.
`02` dispatch-only. **No station is SILENT.** Crossed against `lastRunAt` from the MCP: every row is
the "both fresh and aligned" case in the contract's table — no station has a fresh `lastRunAt` with a
missing breadcrumb, so no transcript read was required.

**[MEASURED] Sweep.** `status-sweep.ps1` → `MARKER_SWEEP_DONE exit=0`. Section 0 positive controls
both pass (`gh CAN reach GitHub`, `node runs`). Section 7 verdict: **`SAFE TO ACT`**.

**[MEASURED] The board is ONE PR, and it is green.** `gh pr view 2127 -R GH-Mantova/ProjectOperations`
at `GH_EXIT=0`: `state=OPEN mergeState=CLEAN mergeable=MERGEABLE`, `author=GH-Mantova`,
`head=fix/field-service-nul-separator`, `created=2026-09-23T16:36:48Z`, **`labelcount=0`**. CI per the
sweep: **15 pass / 0 fail / 0 pending**. Files, both of them:

```
apps/api/src/modules/field/field.service.ts
docs/pr-prompts/superseded/pr-field-service-nul-separator-HOLD.md
```

**[MEASURED] §10.1 STEP 1 — #2127 carries a real watcher RULE-2 verdict, and it is `marco:true`.**
This is the strongest lane evidence §10.1 recognises, and it was read from the corpus, not inferred:

```
C:\ProjectOperations2\docs\pr-prompts\processed\pr-field-service-nul-separator-ready.md.log ::
[watcher] merge result for PR #2127: {"ok":false,"marco":true,
"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}
```

Instrument calibrated before the reading was believed: over the dev tree's `DEV_LOGS=2669`,
POSITIVE control `marco.:true` → **704**, NEGATIVE control `zzzNoSuchTokenZzz` → **0**, and the
`merge result for PR #2127` query returns exactly **1**. The regex needle uses `marco.:true` (dot for
the quote) deliberately — §9.4 and the 09-23 queue-watch note both record that escaped double quotes
do not survive the `-Command` layer.

⚠️ **A FALSE ZERO WAS CAUGHT ON THE WAY TO THAT READING, and it is the reason the controls above
exist.** The first probe searched `C:\po-watcher\logs`, which **does not exist**; it returned
`HITS=0` alongside a `PathNotFound` error. `HITS=0` there is a BROKEN PROBE, not an absence — read as
an absence it would have produced *"#2127 has no watcher verdict"*, which under §10.1 step 2 leads
to hand-classification and is precisely the *"absence reads as cleared"* failure that section is
written to stop. The corpus is the DEV TREE (2669 logs), not the watcher clone (23).

**[MEASURED] NOTHING IS ARMABLE — 14 of 14, by the linter rather than by my own reading.**
`armed (*-ready.md) = 0`; `*-HOLD.md` in the queue root = **14**. Every one linted individually:

```
TOTALS admit=0 reject=14
```

10 × `[HUMAN_GATE_PRESENT]` · 4 × `[FILE_GATE_NOT_RELEASED]`. The human-gated ten can only be cleared
by a person removing the marker from the prompt body — no agent action exists.

⚠️ **My own first-pass gate detector DISAGREED with the linter and was WRONG.** A regex over
`requires_merged:` / `requires_file_on_main:` / `requires_on_main:` reported three prompts
(`pr-devtree-sync-ff-only-guard`, `pr-nav-jobs-projects-merge`, `pr-vendor-invoice-ocr`) as ungated
and non-escalating — which would have contradicted the 16:25Z breadcrumb's *"the only ungated prompt
on a board of fifteen"* and, acted on, would have armed three human-gated prompts. The linter rejects
all three on markers my regex could not see (`Arm ONLY`, `watcher: do-not-arm`, `DO NOT ARM`).
**Lint ADMIT is necessary and not sufficient (§9.5); lint REJECT is decisive, and it is the instrument
that settles arming.**

**[MEASURED] Section 5 tagged NO escalation `[STALE]` this run — and the first count of that was
also wrong.** A substring count over the captured sweep returned `STALE_ROWS=4`, which I nearly wrote
up as four dead escalations to discharge. Printing the four lines shows every one is the literal word
in the sweep's own legend/header plus one `[FILE]` line quoting the standing dispatch — **zero real
`[STALE]` verdict rows**. Controls on the same capture: `[FILE]` → 286, `[LIVE]` → 82, negative → 0,
so the reader is sound and the four are an artefact of matching a legend. **Nothing to discharge into
`needs-marco/discharged/` this run.** The capture was decoded `utf16le` (the `*>` trap, §9.3).

**[MEASURED] Machinery.** watcher node **RUNNING pid 9744**; auto-restart wrapper **alive (1)**;
heartbeat 31 min with an EMPTY queue, which is idle-correct and explicitly **not** wedged. Safe-to-act
gate: `index.lock` False/False, scoped git processes **0**, no PR touched in the last 2 min.
Watcher clone `branch=main dirty=1`. One non-main worktree classified **orphaned**: `C:/po-wt/s9hex`,
`f878a0a1`, detached HEAD, `dirty=0`, age **660 min**.

**[MEASURED] Dev tree untracked, tracked-status EMPTY otherwise.** `git status --porcelain` →
`?? "Claude Design/docs/index.html"` and `?? docs/pr-reviews/pr-2119-review.md`. `git diff --cached
--name-status` → EMPTY, so nothing of another chat's was staged under this run's commit.

**[CANNOT MEASURE] Whether Marco has seen the 14:37Z approval-channel escalation.** There is no
read-receipt on `needs-marco/`. Stated rather than assumed.

## WHAT CHANGED

**On the board: NOTHING. No merge, no arm, no label, no dispatch executed by me.**

- **#2127 was NOT merged.** RULE 2 applies to it by a step-1 watcher verdict. This is the correct
  outcome, not a blocked one.
- **Nothing was armed.** 14 of 14 prompts REJECT on lint.
- **No `do-not-merge` label was touched** (there is none on the board — `labelcount=0`).
- **No `[STALE]` escalation was discharged**, because there are none.
- The only mutation this run is this breadcrumb and the archiving of the 16:25Z one, both inside this
  run's own PR worktree (`C:\po-wt\00collect1730`, branch `docs/station-00-collect-2026-09-23-1730`,
  cut from `origin/main` 4b837602) — **never in the dev tree**, so no path is left there to block the
  next fast-forward.

**COLLECT is complete.** One breadcrumb existed in this cycle, `00-00-supervisor-2026-09-23-1625-…`
(TRACKED, and `git cat-file -e origin/main:<path>` → exit 0, so it is on main). All five of its
findings carry dispositions (F1 ACTIONED, F2 ACTIONED, F3 DEFERRED, F4 DEFERRED, F5 ESCALATED), so it
is fully collected and is `git mv`'d to `docs/pr-prompts/archive/` in this PR.

## FINDINGS

### F1 — The one green PR on the board is Marco's, and the pipeline has no way to move it.

#2127 is CLEAN, MERGEABLE, unlabelled and 15/15 green, and it carries
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}`.
Nothing is wrong with it. It is one human action from `main` and no agent may take that action.

**DISPOSITION: ESCALATED — deliberately NOT as a new file.** The channel this belongs to was escalated
**today at 14:37Z** as `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`,
and `needs-marco/` already holds **46** files. A 47th naming the same constraint is noise, and the
sweep would tag it the same way it tags the rest. The specific new fact — *the channel is now
blocking a finished, green PR, not just parked prompts* — is carried in FOR MARCO below.

### F2 — Agent-executable supply is now ZERO, and that is a change of kind, not of degree.

Previous runs reported an empty board with prompts still parked. This run is the first where
**every** remaining prompt is un-armable by any agent (`admit=0, reject=14`, ten of them on markers
only a human can remove) **and** the single built PR is human-gated. There is no work this station can
create, arm, fix or merge.

**DISPOSITION: ESCALATED — folded into the same existing escalation, not a new file.** Same reasoning
as F1. RULE 1 options are put to Marco below.

### F3 — `vm-git-guard` installs INERT (exit 2) on the station shell. Fifth consecutive run today.

Quoted in WHAT I MEASURED. The shim is byte-correct; the station's shell is non-interactive and
non-login, so it sources neither `~/.bashrc` nor `~/.profile` and resolves the real `git`. The
device-bridge git ban is therefore REMEMBERED, not mechanical.

**DISPOSITION: DEFERRED.** No station-side action exists — this is the documented expected outcome and
the contract says carry on. It becomes urgent the moment a run needs `git` on the VM side, which this
one did not: every git call went through the Windows host shell. Unchanged from the 16:25Z run's F3;
re-filing it as new would be the duplicate-signal failure.

### F4 — An orphaned worktree and a dirty watcher clone, both in Station 03's lane.

`C:/po-wt/s9hex` @ `f878a0a1`, detached HEAD, `dirty=0`, **660 min** old — the sweep's own classifier
calls it an aborted-run leftover. Watcher clone reads `branch=main dirty=1`, which the sweep flags as
*"NOT clean-on-main; the watcher may refuse to start."* Neither is affecting the board right now (the
watcher is running and the queue is empty), so neither is urgent.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Prune `C:/po-wt/s9hex` after re-confirming
`dirty=0` at the moment of pruning, and reconcile the clone's single dirty path. I did not do it
myself: worktree and clone hygiene is 03's lane, doing it here is the LL-38 shape, and 03 wakes on its
own cadence and reads this file. 03's `lastRunAt` is 2026-09-22T23:29Z with a 24h cadence, so it is
due within the day.

### F5 — Two instrument readings in this run were wrong in opposite directions, and both were caught only by a control.

The broken-path `HITS=0` would have manufactured *"no RULE-2 verdict"* on #2127 (a false clear, the
dangerous direction). The regex gate-scan would have manufactured *"three ungated prompts"* (a false
arm). A third, `STALE_ROWS=4`, would have manufactured four phantom discharges. All three were
well-formed, exit-0 answers; none warned.

**DISPOSITION: ACTIONED — no doc change proposed, and that is deliberate.** Every one of the three is
already named in DOCTRINE: §9.6 (empty result ≠ empty world), §9.5 (lint ADMIT necessary-not-
sufficient), §7 guard 1 (positive control first). The rules did their job; nothing rotted. Recording
the three live hits here is the whole value — adding a fourth restatement of an existing rule is the
documented way this section grows without getting truer.

## WHAT I DID NOT DO

- **Did not merge #2127**, and did not enable auto-merge on it. RULE 2, step 1, verdict quoted.
- **Did not arm anything.** 14/14 REJECT. In particular did not arm the three my own regex called
  ungated, and did not touch `pr-rates-s11c-drop-legacy-tables-HOLD.md` — it is on the never-arm
  denylist, it is `escalates:true`, it drops tables, and its backlog note says it must not merge until
  the parity proof has RUN clean.
- **Did not stage `rates-11c-blocked-consumers`** despite the sweep listing it under *"READY TO STAGE"*.
  Its own note routes the work through `rates-s11c`, which is denylisted; "ready" there describes the
  backlog gate, not arming permission.
- **Did not remove or add any label**, did not touch `/sot/` (Station 05's lane), did not touch Azure,
  Entra or SharePoint, did not write production data, did not commit to `main`, and did not run `git`
  through the device bridge.
- **Did not clear the two untracked dev-tree paths** (`Claude Design/docs/index.html`,
  `docs/pr-reviews/pr-2119-review.md`). They are untracked, so `git clean` is the only one-step
  removal and DOCTRINE §9.2 forbids it outright — consumed prompts come back armed. They will block a
  fast-forward only if those exact paths land on `main`; neither is in any open PR. Left alone
  deliberately, named here so the next run does not re-discover them.
- **Did not file a new `needs-marco/` file** for F1 or F2. The channel is already escalated as of
  14:37Z today and the folder holds 46 files.

## FOR MARCO

**The board is not stuck on a defect. It is stuck on you, and it is now one click from moving.**

**#2127 is finished work.** `fix(field): replace raw NUL byte with Unicode escape in composite sort
key` — 15/15 green, CLEAN, MERGEABLE, no labels, two files. The watcher routed it to you for one
reason only: `field.service.ts` sits outside `tests/` and `docs/`, which is RULE 2 doing exactly what
it is designed to do. There is no question about the change itself and nothing for an agent to fix.

Behind it, **every one of the 14 parked prompts now rejects on lint** — ten of them on `Arm ONLY` /
`DO NOT ARM` markers that only a person can remove. So the pipeline's supply is genuinely at zero,
not merely quiet.

Two ways forward, and per RULE 1 the complete-and-additive one first:

**(a) Merge #2127, then clear a batch of the ten human-gate markers in one pass.**
Solves it immediately *and* for the future, and damages no data entry — the markers are prompt-body
text, the prompts stay staged, and each still has to pass lint and CI on its own afterwards. This is
the only option that restores supply rather than draining the last of it. It costs you one review
sitting.

**(b) Merge #2127 alone.**
Fails the *future* half of RULE 1: the board empties again within the hour and the next run reports
this same finding with nothing left to build. It damages nothing, but it buys one PR.

I am not proposing a third option that widens the tests-docs auto-merge lane to cover `apps/`. That
would move the boundary RULE 2 exists to hold, and it is your call to make deliberately, not a
throughput fix for an agent to slip in.
