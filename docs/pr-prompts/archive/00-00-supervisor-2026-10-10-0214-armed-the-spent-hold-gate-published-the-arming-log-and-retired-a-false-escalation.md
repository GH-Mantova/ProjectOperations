# Station 00 — Supervisor | 2026-10-10T02:14:19Z–2026-10-10T02:5xZ

## GROUND

```
UTC            2026-10-10T02:14:19Z
origin/main    1dfb705b            (git fetch origin, then rev-parse)
dev tree       main @ 1dfb705b      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      v1, station_doc_version: 1
```

Doc version and bootstrap AGREE (1 = 1), so this run was not restricted to read-only.

## WHAT I MEASURED

**Reachability.** [MEASURED] One keyword `ToolSearch` for `desktop-commander` loaded the toolkit; the
ids resolved under the `mcp__plugin_desktop-commander_desktop-commander__*` prefix, not the bare
`mcp__desktop-commander__*` form. `start_process` with shell `powershell.exe` returned on the FIRST
call with `2026-10-10T02:14:19.3886688Z`. **Not blind.** `BOOTSTRAP_CONNECT_RETRY_V1` was not needed.

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
exit **2**. Last line, verbatim:

```
   PATH="/sessions/zealous-adoring-mccarthy/.local/bin:$PATH" git <args>
```

headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Controls it printed: `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` →
`/usr/bin/git`. Exit 2 is the documented EXPECTED station outcome (PREFLIGHT step 1, three-outcome
table): a FINDING, not a stop. **No `git` ran through the device bridge against the mount at any
point** — every git call in this run went through the Windows host shell.

**Binding reads.** [MEASURED] Both cores read in full from `git show origin/main:<path>` in the DEV
TREE (`C:\ProjectOperations2`), never the working copy and never the watcher clone:
`docs/pipeline/stations/00-supervisor.md` (467 lines, 32883 bytes) and `docs/pipeline/DOCTRINE.md`
(509 lines, 30719 bytes). `STATION-CAPABILITIES.md` (54828 bytes) was extracted the same way and
consulted on demand for §5 (merge receipts, 00-dispatches/03-acts) per
`BOOTSTRAP_CORE_REFERENCE_V1`. `git rev-parse HEAD` = `git rev-parse origin/main` = `1dfb705b`, and
`git rev-list --left-right --count HEAD...origin/main` → `0 0`, so the working copy was not behind at
read time. No REFERENCE section was opened: no core line sent me to one.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated 2026-10-10T02:15:25Z, runtime
222 s, `SWEEP_EXIT=10`. Section 7 verdict verbatim: `SAFE TO ACT: no board mutation in progress, no
recent remote activity, no live station worktrees.` Section 0 positive controls both PASSED (`gh`
saw merged #2301; `node` runs) — no `[BROKEN]`, so the report is usable. Section 3: 0 scoped git
processes, **board lease free**, no PR touched in the last 2 min, no watcher build in flight (newest
heartbeat tick 39 min old; ticks are 60 s apart only while a build runs, so stale + empty queue =
idle, not wedged). Section 2: **watcher node RUNNING pid 34996**, watcher clone `branch=main
tracked-dirty=0 untracked=3`.

**Board.** [MEASURED] 1 open PR, `#2294`, `BEHIND`, **13 pass / 2 fail / 0 pending**, labelled
`do-not-merge`, head `191a6e2aabac14b993a09280ec1b4b8337b6f3bc`, open 6h. The two reds are
`Approval receipt (CP-26)` and `PR gates — diff checks`; every other check passes. `main` CI on
`1dfb705b`: 4 success / 0 failed (trunk green). Armed `*-ready.md` at run start: **0**.
`MARCO_QUEUE_LINE_V1` figures, copied as required: **WAITING ON MARCO: 1** open PR (oldest #2294,
open 6h); **ALL OPEN (non-draft): 1**.

**Queue census.** [MEASURED] needs-marco 53, no-pr-opened 111, failed 80, blocked 204. Backlog gates:
`ready=1 needs-marco=2 blocked=4 broken=0` — the single READY item is still
`rates-11c-blocked-consumers` [P2], unchanged from the 0114Z run.

**HOLD admissibility, by EXIT CODE only.** [MEASURED] All 16 `docs/pr-prompts/*-HOLD.md` passed to
`node scripts/pipeline/lint-prompt.mjs`, classified on `$LASTEXITCODE` and never on the word in
stdout (the 0114Z run's F3 trap: the REJECT message itself contains the word ADMIT):

| verdict | count |
|---|---|
| REJECT (exit 1) | **14** |
| ADMIT (exit 0) | **2** |

The two ADMITs were `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` (staged by the 0114Z run,
premise live) and `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` (the spent prompt whose own PR
#2294 is OPEN — F2's subject, fourth consecutive reproduction). Negative control, run the same way:
`node scripts/pipeline/lint-prompt.mjs README.md` → exit **1**, so the instrument can produce a
REJECT on a non-prompt and a 0 is not its default (DOCTRINE §7 positive/negative control).

**Instrument-lane boundary, read before arming (`NEVER_LIST_BEFORE_ARMING_V1`).** [MEASURED] from
`scripts/pipeline/instrument-lane.json` itself, not from memory: `files` contains
`scripts/pipeline/lint-prompt.mjs`; `tests` contains `scripts/pipeline/__tests__/**`. The `_readme`
NEVER-LIST puts **everything under `docs/`** out of lane, and `INSTRUMENT_LANE_V1` requires EVERY
changed file to be in lane. The prompt's `scope` names
`docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md`, so the built PR
will be **OUT_OF_LANE** and will need Marco's release. See F1.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit
**0**, `CLEAN`; structure `2 checked, 0 malformed`. Per-station: `00 last 2026-10-10T01:14:00Z 1.1h
ago (cadence 1h + grace 0.5h) ok`; 03 3.3h (cadence 24h) ok; 04 0.2h (cadence 4h) ok; 05 12.0h
(cadence 24h) ok. **No station is MISSED**, so no `FRESHNESS_ONE_CADENCE_V1` classification was
required this run. It also printed `NOTE 00-04-scanner-2026-10-10-0210-instruction-drift.md is
UNTRACKED — it reaches nobody until a board PR commits it`, which is what this PR does.

**Cadence, from the MCP and not from any document.** [MEASURED] `list_scheduled_tasks`: four enabled —
`00-supervisor` `5 * * * *` lastRun `2026-10-10T02:14:02Z` (this run), `04-scanner` `0 */4 * * *`
lastRun `2026-10-10T02:09:41Z`, `03-machine-minder` `0 9 * * *` lastRun `2026-10-09T23:02:54Z`,
`05-sot-keeper` `10 0 * * *` lastRun `2026-10-09T14:22:42Z`; `weekly-security-audit` `enabled:
false`. My cadence is **hourly**, confirming the bootstrap's own measured line rather than any pasted
figure.

**Collected breadcrumbs.** [MEASURED] Two since my last run, both read in full before dispositioning:
`00-00-supervisor-2026-10-10-0114-…-only-marco-can-green-it.md` (tracked on `origin/main`, landed in
merged #2301) and `00-04-scanner-2026-10-10-0210-instruction-drift.md` (untracked in the dev tree,
written mid-run — see F5 for why I did not archive it).

**Section 5 cross-check produced no `[STALE]` row, again.** [MEASURED] Every needs-marco line came
back in the shape `[FILE] <name> cites #N (MERGED) as evidence -- not its premise; does not clear the
escalation`, plus `names no subject PR … section 5 CANNOT decide whether it is stale`. That is
explicitly not a clearance, so `status-sweep.ps1` cleared nothing for me and the one retirement this
run (F4) rests on a live MCP re-measurement instead.

**Gate re-measure immediately before the mutation.** [MEASURED] at `2026-10-10T02:19:03Z`, 4 minutes
after the sweep printed and seconds before arming: `.git/index.lock` absent; `git` processes **0**;
`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` all False; `git diff --cached --name-status` EMPTY
(the dev tree index is shared between chats, so this is checked, not assumed); `*-ready.md` on disk
**none**. `[LIVE]` means true when measured, so these are the readings the arm acted on, not the
sweep's 02:15Z ones. I did not re-run the whole sweep for this: its section 5 PR crawl costs ~3 of
this run's ~60 minutes, the `-SkipSection5` fast switch that would make a re-run cheap is exactly
what is parked in #2294, and the re-measured signals above ARE the content of section 3's safe-to-act
gate. Stated as a deliberate choice, not an omission.

## WHAT CHANGED

**Board lease.** `Enter-BoardLease -Actor 'station-00.scheduled'` → **`True`**, with `$env:PO_ACTOR`
set to the SAME string in every process that followed. Reason recorded: *arm the lint-prompt
spent-HOLD gate; open board PR*. (The measured 2026-10-09 #2279 trap: an unset `-Actor` makes the
primitives generate `pwsh-<pid>` and be refused by the station's own lease, which reads as a
collision with "another lane".)

**Armed one prompt — `pr-lint-prompt-refuse-a-hold-whose-pr-is-open`.** Dry run first:
`arm-prompt.ps1 … -WhatIf` → exit **0**, plan `D` the HOLD + `A` the ready path and nothing else.
Then for real, `arm-prompt.ps1 -Name pr-lint-prompt-refuse-a-hold-whose-pr-is-open -Actor
station-00.scheduled` → exit **0**, which internally took the exclusive
`.git\po-arm.lock` (PID 42092), re-checked the index clean, re-checked RULE 4 (no other prompt
armed), re-ran `lint-prompt.mjs`, took the board lease again under the same actor, did the `git mv`,
verified the index held exactly the two expected paths, wrote the audit line, then released the
staged rename (`ARM_INDEX_RELEASED`) leaving the index clean.

Read back from disk, not from the exit code:

- `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-ready.md` present, **8054 bytes**
- `HOLD_STILL_PRESENT=False`
- `git diff --cached --name-status` after the arm: **EMPTY**

Arming was a `git mv` of a **tracked** `-HOLD.md`, never the creation of a `-ready.md`
(`.gitignore:75` swallows those). One at a time: this is the only armed prompt on the board.

**Retired one spent escalation** (F4): `stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`,
through `retire-escalation.mjs`, never by hand and never by deletion. See F4 for the read-backs.

**This board PR** carries: this breadcrumb; the 0114Z supervisor breadcrumb `git mv`'d to
`docs/pr-prompts/archive/`; Station 04's 0210Z breadcrumb added at a tracked root path;
`docs/pipeline/sweep-rotation.json`, which `next-sweep.mjs --advance` left dirty in the dev tree with
`LEFT DIRTY: name this file in your breadcrumb` and which 04 has no authority to commit;
`docs/pr-prompts/.arming-log.txt` with this run's audit line (F3); and the escalation retirement with
its discharge note.

**Nothing was merged.** See WHAT I DID NOT DO.

## FINDINGS

### F1 — the spent-HOLD gate is armed, and its PR will need Marco because the prompt's own retirement path is on the never-list

The 0114Z run staged `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` and deliberately did not
arm it in the same run that wrote it. Its premise, `! grep -q "SPENT_HOLD_PR_OPEN"
scripts/pipeline/lint-prompt.mjs`, is live on `main`; it linted **ADMIT by exit code** with a working
negative control; and the trap it closes has now reproduced on four consecutive Station 00 runs
(0.1913Z, 2214Z, 2315Z of 2026-10-09 and 0114Z of 2026-10-10), each time as *the only ADMIT on the
board being the one prompt that must not be armed*. So I armed it: measurements above, read back from
disk.

`NEVER_LIST_BEFORE_ARMING_V1` requires the lane check BEFORE arming, and I made it from
`instrument-lane.json` rather than from the prompt's own claim about itself. The code half
(`lint-prompt.mjs`, `scripts/pipeline/__tests__/**`) is in lane; the `scope`'s third path,
`docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md`, is under `docs/`
and therefore never-listed, and the lane requires EVERY changed file to be in lane. **So the PR the
watcher opens will be OUT_OF_LANE, will fail CP-26 `RECEIPT_REQUIRED_BY_DIFF`, and will need Marco's
release — exactly as #2294 does.** Arming it anyway is allowed by that same rule (the build is not
wasted if Marco wants the fix) provided the breadcrumb says so, which this does, and provided the
resulting PR is labelled `do-not-merge` so the WAITING ON MARCO line counts it. The prompt carries
`escalates: false`, so the watcher will **not** apply that label itself: **next Station 00 run, label
the PR `do-not-merge` as soon as it exists.** The prompt's own "Lane expectation" section predicts
this and forbids buying `IN_LANE` by dropping the retirement path, because a prompt whose `scope`
does not name its own file is never retired and stays armable forever — which is the defect it
exists to close.

`MARCO_QUEUE_LINE_V1`: WAITING ON MARCO was **1** when I armed, there is no limit (Marco,
2026-10-03), so the call was mine. One parked PR is not a queue.
→ **ACTIONED** — armed, read back from disk (ready file present at 8054 bytes, HOLD gone, index clean
after `ARM_INDEX_RELEASED`), with the lane consequence stated and a named follow-up for the next run.

### F2 — a HOLD whose own PR is OPEN still lints ADMIT: fourth consecutive reproduction, and this run is the first with the fix in flight

Measured by exit code above: `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` ADMITs while its PR
#2294 is OPEN, because `lint-prompt.mjs` evaluates the premise against `origin/main` and the fix is
unmerged, so the premise is still true there. Arming it would send the watcher to rebuild work that
is already sitting in an open PR — DOCTRINE §10.6 arriving from the opposite direction.

What is new this run is only that the mechanical cure is now armed (F1) rather than merely staged.
The window stays open until either #2294 merges (premise dies, lint REJECTs) or the gate lands.
→ **DISPATCHED** — to the watcher's code-writer, via the armed prompt in F1. Nothing further for 00:
the fix is in flight and I did not arm the spent prompt.

### F3 — arming dirties two tracked files in the dev tree, so every arm plants a fast-forward blocker unless the arm's own board PR carries them

[MEASURED] immediately after the arm, `git status --porcelain` in `C:\ProjectOperations2`:

```
 M docs/pipeline/sweep-rotation.json
 M docs/pr-prompts/.arming-log.txt
 D docs/pr-prompts/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md
```

and `git diff --numstat` → `1 0 docs/pr-prompts/.arming-log.txt`. `git ls-files --error-unmatch
docs/pr-prompts/.arming-log.txt` exits **0**, so the arming log is **tracked**; `arm-prompt.ps1`
appends the audit line and then releases the index, so the line sits as an uncommitted modification
to a tracked file. The station doc is explicit that *"a TRACKED file you left modified or deleted
there blocks [the fast-forward] identically"*, and this is not new: two archived breadcrumbs name it
in their own titles (`…2026-09-02-0609-…and-the-tracked-arming-log-lost-an-arm`,
`…2026-09-04-1209-the-arming-log-is-tracked-and-thirteen-arms-are-unpublished`), and #2296 recorded a
dev-tree FF actually blocked by a mixed-EOL arming log.

The `D` of the HOLD is the arm itself and must stay on disk until the watcher consumes the ready file,
so it is not a defect. The other two are publishable state that simply had no carrier.

RULE 1 — complete-and-additive first. (1) *Carry both files in the arming run's own board PR*, which
is what I did: the audit line gets published, the rotation advance gets published, and nothing is
discarded or rewritten. Complete for every arm that is followed by a board PR, and purely additive.
(2) *Restore them from `HEAD` with the raw-Buffer node write* the station doc gives for breadcrumbs —
fails the additive half outright for `.arming-log.txt`: it would **discard an arm's only audit
record**, which is the measured 2026-09-02 failure. (3) *Leave them dirty* — fails the future half:
it is how thirteen arms went unpublished and how #2296's FF jammed.
→ **ACTIONED** — both files are in this PR; the dev tree's tracked dirt is reduced to the arm's own
`D`, which is correct state. The structural question of whether `arm-prompt.ps1` should commit its own
audit line is left where it already lives, in the two archived breadcrumbs.

### F4 — a needs-marco escalation claiming stations 00/03/05 had not fired for nine to eleven days is spent, and was still filed as a live hard stop

Dispatched to me by Station 04's 0210Z breadcrumb (its F3), and 04 asked me to re-measure rather than
quote it, which is DOCTRINE §7.1's re-read rule applied correctly to a dispatch. Re-measured from the
scheduled-tasks MCP in **this** run, which is the only authority
(`STATION-CAPABILITIES.md` §4C): `00-supervisor` lastRunAt **2026-10-10T02:14:02Z** (this run),
`03-machine-minder` **2026-10-09T23:02:54Z**, `05-sot-keeper` **2026-10-09T14:22:42Z**, all enabled,
all with a `nextRunAt` on their crons. The file's central claim is **FALSE**: nothing has gone
nine days without firing.

Blast radius is why this is worth a run's attention rather than a shrug: `needs-marco/` is the ONE
real stop in this pipeline (DOCTRINE §5b), so a spent file there reads to the next run exactly like a
live hard stop, and can park work that is fine.

Before touching the folder I checked `git ls-files -- docs/pr-prompts/needs-marco/` as the report
contract requires, because that folder is gitignored by RULE and partly tracked in FACT and
`git check-ignore` answers about the rule, never the index: **12 tracked files**, and the target is
one of them. I also confirmed it was not already discharged by listing
`origin/main:docs/pipeline/discharges` (11 notes, none naming it).
→ **ACTIONED** — retired through `retire-escalation.mjs` with `--actor station-00.scheduled`, the live
`lastRunAt` triple as `--evidence`, and `--record-into` this PR's worktree. **Nothing was deleted:**
the file moved to `needs-marco/discharged/` and a tracked note was written to
`docs/pipeline/discharges/`. I ran it with `--repo` pointed at the worktree rather than the dev tree,
so the move and the note both land in THIS PR instead of leaving a tracked deletion behind in a
shared tree — a departure from the station doc's example invocation, made deliberately and recorded
here. 52 escalations remain open.

### F5 — Station 04's run window was still open when I collected its breadcrumb, so I committed it at root rather than archiving it

[MEASURED] 04's breadcrumb header reads `2026-10-10T02:10Z–2026-10-10T02:40Z`, its `lastRunAt` from
the MCP is `02:09:41Z`, and the sweep counted **2 headless claude sessions** (04 and me). It appeared
in `--freshness` between my 02:17Z and 02:19Z calls, i.e. it was written while I was mid-run. It is
structurally complete — `check-breadcrumb.mjs` printed `ADMIT` for it and `0 malformed` — and all
four of its findings carry dispositions, which is the condition the station doc sets for archiving.

But a station that is still running may still amend its own report, and `archive/` is where a cycle
goes once it is closed. Committing it at the tracked root path publishes it now (the sweep's own
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`) while leaving the next
supervisor to archive a cycle it can see finished. `check-breadcrumb.mjs --freshness` matches by
basename and sees `archive/`, so neither placement changes any freshness reading.
→ **ACTIONED** — committed at `docs/pr-prompts/00-04-scanner-2026-10-10-0210-instruction-drift.md`,
not archived. Next Station 00: archive it once 04's window has closed.

### F6 — 04's other three findings, dispositioned

- **04's F1, the inert git guard (exit 2).** I measured the identical outcome independently this run
  (above), from a different session path. It is the documented expected station outcome, and the cure
  — invoking a station's shell as a login shell, or writing the `PATH` export somewhere a
  non-interactive non-login shell sources — is 03's or Marco's, not mine.
  → **DEFERRED**. Urgent if a run actually needs `git` against the mount, or if a fresh 0-byte
  `index.lock` with no owning process appears in a sweep.
- **04's F2, `03-machine-minder`'s bootstrap says "every 4 hours" while its cron is `0 9 * * *`.**
  Re-measured live here: the cron is `0 9 * * *`, daily. A factor-of-six disagreement between the
  instruction a run reads and the schedule that fires it. Already filed at
  `needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`; 04 re-verified
  rather than duplicating it (§10.5), which is right. It is NOT spent, so unlike F4 it stays filed.
  The bootstrap layer is Marco's and I cannot edit it.
  → **ESCALATED** (already open with Marco since 2026-09-03; re-verified, not re-filed). RULE 1: the
  complete-and-additive fix is to have the bootstrap read its cadence from the MCP instead of
  asserting one — correct for every station now and later, and it destroys no state; editing 03's
  line to "daily" fixes today only and silently re-breaks the next time Marco changes a cron.
- **04's F4, the 2-wrapper anomaly and 3 worktree-registry escapees.** Independently measured this
  run: `WRAPPER_COUNT_ANOMALY_V1`, pids 2068 (started 10-08 07:28 local) and 35512 (10-10 11:35
  local — i.e. minutes after #2301 merged); `worktree-registry-escapees: 3`; 33 non-main worktrees,
  the oldest `C:/po-wt/fv2drop` at 22656 min holding **21 commits on no remote branch**, with
  `C:/po-wt/sup-cwd-paths` and `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` holding uncommitted
  work. The wrapper half already has its own escalation
  (`needs-marco/ensure-watcher-relaunches-a-second-wrapper-because-it-only-asks-about-the-node-2026-09-25.md`).
  → **DEFERRED** to Station 03's next occurrence (23:02Z), its lane per STATION-CAPABILITIES §5 — 00
  dispatches, 03 acts. Every line says *"Push or preserve before pruning"* and a squash-merged branch
  shows identically to a lost one, so a count is not a licence to prune. Urgent if a worktree holding
  unpushed commits is about to be reaped, or if the escapee count grows with no 03 report.

### F7 — #2294 is unchanged and remains the one biggest blocker; no station can green it

[MEASURED] this run: `state OPEN`, `mergeStateStatus BEHIND`, head `191a6e2a` (the head the 0114Z run
pushed), `do-not-merge` present, 13 pass / 2 fail. The two reds ARE the release gate —
`PR gates — diff checks` fails *because* the label is present, and `Approval receipt (CP-26)` wants
`docs/decisions/merge-approvals/2294.md`, which Station 00 is forbidden to write (a standing receipt
is not permitted on a PR ever labelled `do-not-merge`; a personal receipt requires Marco's release).
Nothing about it has changed in the hour since it was escalated, and the 0114Z run already put both
RULE-1 options on the PR itself. This also keeps `pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md`
parked on `requires_merged: 2294`, and keeps every sweep paying the 3-minute section 5 crawl that
#2294's `-SkipSection5` would remove.
→ **ESCALATED** (re-stated, not re-opened). Options are already on
`https://github.com/GH-Mantova/ProjectOperations/pull/2294` — in short: (1) remove the `do-not-merge`
label and let the next Station 00 update, merge and write the personal receipt naming the release —
complete, additive, touches no data; (2) leave it labelled — breaks nothing but keeps the follow-up
slice parked and the sweep slow. I left the branch BEHIND on purpose: `PR_WATCHER_AUTO_UPDATE` is OFF
and `Merge-Pr` updates a BEHIND branch as the first step of merging, so updating now buys only a CI
rebuild on a PR that cannot merge.

## WHAT I DID NOT DO

- **Did not remove or alter `#2294`'s `do-not-merge` label, and did not write it a receipt.** Both are
  Marco's alone, and the first is an absolute hard stop.
- **Did not merge anything.** The only open PR is label-gated; there was nothing to put through
  `Assert-SmokedOrEscalate` → `Merge-Pr`. No instrument-lane merge was available either: no PR met
  `INSTRUMENT_LANE_V1`'s five conditions.
- **Did not run `gh pr update-branch` on #2294**, though it is BEHIND — F7.
- **Did not arm the spent `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`** despite its ADMIT (F2),
  and did not arm anything else: one at a time, and the other 14 HOLDs REJECT on named gates.
- **Did not stage the one READY backlog item** (`rates-11c-blocked-consumers`). Unchanged from the
  0114Z run's reasoning: its own note says the consumers are staged but unmerged and 11c must not
  merge until the parity proof has RUN clean, and the coupled design question
  `map-locations-waste-rate-coupling` is still unanswered by Marco and must be settled *before* 11c
  drops `estimate_waste_rates`, after which the backfill option becomes impossible. Staging into that
  ordering unasked is the guess DOCTRINE §5.5 forbids.
- **Did not re-run `status-sweep.ps1` before the arm**, by deliberate choice — I re-measured section
  3's gate signals directly at 02:19:03Z instead, and said so under WHAT I MEASURED rather than
  letting the 02:15Z verdict stand unexamined.
- **Did not delete any escalation.** F4's retirement is a move plus a tracked note; 52 remain open,
  and I retired only the one whose premise I re-measured as false.
- **Did not touch `/sot/`** — Station 05's exclusively.
- **Did not run `git` through the device bridge**, the guard's exit 2 notwithstanding; the one-call
  `PATH=…` form was not needed because every git call went through the Windows host shell.
- **Did not prune, clear or touch any worktree but the one I created for this PR** (F6) — 03's lane.
- **Did not clear a lock.** None existed: `index.lock` absent in both trees, and no
  `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`.
- **Did not touch Azure, Entra or SharePoint**, and nothing in this run approached them.
- **Did not edit any station doc, DOCTRINE, or `instrument-lane.json`.** The 0114Z run's F1 — the
  seven-doc canonical-block change that would make a blind run leave a breadcrumb — is still Marco's
  and is not restated here as a new finding.
- **Did not re-run any check hoping for green** (DOCTRINE §2).
- **Did not archive Station 04's breadcrumb** (F5), and did not amend it.
- **Left this breadcrumb inside this run's own PR** rather than loose in the dev tree, so no
  `sweep-breadcrumbs.ps1` pass is needed and it cannot block the next fast-forward. The worktree is
  torn down at the end of the run.

---

## ADDENDUM — measured after the breadcrumb was first committed (35af3e65), same run

### F8 — dot-sourcing `pipeline-lib.ps1` SILENTLY CLOBBERS a caller variable named `$workTree`, and `Invoke-GitPush` then pushes nothing while naming a tree you never chose

[MEASURED] 2026-10-10T02:27Z. My push script set `$workTree = 'C:\po-wt\st00-0214-board'`, then dot-sourced
`scripts/pipeline/pipeline-lib.ps1`, then called
`Invoke-GitPush -Branch $st00Branch -WorkTree $workTree`. It threw:

```
Invoke-GitPush: WorkTree does not exist: C:\po-fix
```

`C:\po-fix` is a path my script never mentions. The library assigns its own `$workTree` at
dot-source time, and because **PowerShell variables are case-insensitive and dot-sourcing runs in
the caller's scope**, the library's value replaced mine between the assignment and the call. Proved
by printing both after the dot-source: the library's `$workTree` = `C:\po-fix`; a freshly named
`$st00BoardTree` = `C:\po-wt\st00-0214-board`. The same call with the distinct name returned
`PUSH_RESULT=35af3e65`, and `git ls-remote origin refs/heads/docs/board-0214-collect` = local `HEAD`
= `35af3e65`.

This is DOCTRINE §9.1's *"PowerShell variables are CASE-INSENSITIVE — never reuse single letters
like `$c`/`$C`"* one level up: the hazard is not short names, it is **any name the dot-sourced
library also uses**, and the library's variables are not documented at its call site. It failed
LOUDLY here only because `GITPUSH_WORKTREE_MANDATORY_V1` (added 2026-10-07, F10) tests the tree
before `Push-Location`. Without that guard this is the §7 shape exactly: every git call would have
run against an ambient directory, returned a well-formed SHA and exited 0, proving nothing — which
is the failure that guard was written for, arriving by a different route than the missing-argument
one it anticipated.

→ **ACTIONED** for this run (distinct variable name, push read back from the remote). The durable
half is a one-line warning at `Invoke-GitPush`'s call-site documentation — *"name your tree variable
something the library does not use; dot-sourcing runs in your scope"* — but `pipeline-lib.ps1` is
the **first entry on the instrument lane's NEVER-LIST**, so a station cannot land that edit without
Marco, and a prompt targeting only that file would reach 13/15 green and be un-mergeable
(`NEVER_LIST_BEFORE_ARMING_V1`, measured on #2261). I have therefore NOT staged a prompt for it.
RULE 1: the complete-and-additive fix is the comment plus a `Set-StrictMode`-style guard that makes
the library declare its locals in a function scope rather than at file scope — it fixes every current
and future caller and changes no behaviour; renaming the library's `$workTree` alone fixes today and
re-breaks on the next shared name. **DEFERRED to Marco's never-list decision**, not re-escalated as a
separate question, because it is the same lane interaction already open as F77 / #2261.

### F9 — the arm WAS consumed; an armed prompt's mtime is not evidence either way

[MEASURED] At 02:29:20Z, ten minutes after the arm, `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-ready.md`
was still on disk with `mtimeUTC=2026-10-10T01:34:08Z` — **older than the arm itself**, because
`git mv` preserves mtime — and `processed/` held nothing newer than `rev-2301-ready.md.log` at
01:37Z. Read naively that says the watcher never saw it.

It did. Measured properly: the watcher resolved **by command line, never by image name**
(DOCTRINE §9.5 — 19 `node.exe` processes were alive) is pid **16148**, running
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`; and its own
`scripts/pr-watcher/.queue-state.json`, mtime **02:25:14Z** (i.e. after the 02:19:21Z arm), reads:

```json
{ "ts": "2026-10-10T02:25:14.928Z", "lane": null, "lanes": 2,
  "armed": 1, "owned": 1, "deferred": [], "runnable": 1, "conflictedPrs": [1960] }
```

`armed: 1, owned: 1, runnable: 1` — the prompt is claimed and in flight. The ready file stays on disk
until the build finishes and moves it to `processed/`, so its continued presence is the expected
mid-build state, not a miss.

→ **ACTIONED** — recorded so the next run does not re-diagnose this. **Two readings that look like
"the arm was lost" and are not:** a `-ready.md` whose mtime predates the arm (`git mv` keeps mtime),
and an empty `processed/` during the build. The authoritative instrument is the watcher clone's
`.queue-state.json`, and the authoritative way to find the watcher is its command line.
**Next Station 00: confirm the PR this build opens, and label it `do-not-merge`** per F1 — the prompt
carries `escalates: false`, so nothing else will.

### F10 — dev-tree tidy, recorded because it removed a file

After #2302 was pushed, the dev tree held an **untracked** file at
`docs/pr-prompts/needs-marco/discharged/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
— the destination of F4's retirement, created there because `retire-escalation.mjs` refuses
`--record-into` equal to `--repo` and so must move the file in the dev tree. An untracked file at a
path an incoming fast-forward must create is precisely what makes `git merge --ff-only` refuse, while
`--numstat` and `--cached` both read EMPTY (the documented PASS reading) — the trap the station doc
warns about, arriving from the retirement path rather than from a breadcrumb.

I removed it, and only after proving the content survives elsewhere: `git hash-object` of the local
file = `fa07123f2a92816fe8de0ff083cc6a44ca875340` = `git rev-parse HEAD:<the old needs-marco path>`,
and the identical blob is committed in #2302 at the `discharged/` path (worktree and dev-tree copies
also compared by SHA-256, `IDENTICAL=True`). So this removed a transient duplicate, not an artifact —
*"nothing is ever deleted"* is intact: the escalation exists on the branch at its new path, plus a
tracked discharge note.

Dev tree after the tidy, `git status --porcelain` (tracked lines only): `M sweep-rotation.json`,
`M .arming-log.txt`, `D needs-marco/stations-…-2026-10-06.md`, `D pr-lint-prompt-…-HOLD.md`. The two
`M`s and the first `D` are byte-identical to what #2302 commits, so the fast-forward has nothing to
overwrite; the second `D` is the live arm and must stay until the watcher moves the ready file to
`processed/`. `git rev-list --left-right --count HEAD...origin/main` → `0 0`.
→ **ACTIONED** — verified by hash before removal, and the resulting dev-tree state enumerated above.
