---
station: 00-supervisor
run_utc_start: 2026-08-25T12:08:35Z
run_utc_end: 2026-08-25T12:22:00Z
sha: b968e4f1
---

# Station 00 - Supervisor | 2026-08-25T12:08:35Z-12:22:00Z

## GROUND

```
UTC            2026-08-25T12:08:35Z
origin/main    b968e4f1            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (behind origin/main: 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE - full authority run. **NOT BLIND**: Desktop Commander present, PowerShell
reached the box on the first call. This breaks the 08-25 04:08Z / 10:09Z blind-run streak.

## WHAT I MEASURED

### Board - 6 open PRs, ALL SIX watcher-routed to Marco

[MEASURED] `status-sweep.ps1` 12:09:03Z, section 1, and `gh pr view <n> --json` per PR:

| PR | state | CI | labels | routing reason (from the watcher log) |
|---|---|---|---|---|
| #1322 win_rate display | CLEAN | 12/0/0 green | (none) | outside tests/ or docs/: `apps/web/src/pages/crm/AccountDetailPage.tsx` |
| #1321 win-count triple-flip guard | CLEAN | 12/0/0 green | do-not-merge | escalates:true - held for Marco |
| #1320 /crm+/clients behind crm.view | CLEAN | 12/0/0 green | (none) | outside tests/ or docs/: `apps/web/src/App.tsx` |
| #1319 Account backfill | UNSTABLE | 11/1/0 | do-not-merge | escalates:true - held for Marco |
| #1317 Playwright container trial | CLEAN | 12/0/0 green | (none) | outside tests/ or docs/: `.github/workflows/playwright-container-trial.yml` |
| #1316 capacity service (EW-2a) | CLEAN | 12/0/0 green | (none) | outside tests/ or docs/: `apps/api/jest.config.ts` |

[MEASURED] **RULE 2 probe, BOTH files, both confirming.**
`logs/2026-08-24.log` (still the live log at 12:19Z) carries one
`[merge] <prompt>: PR #N stays for Marco (<reason>)` line for **each of the six**, timestamps
07:37:21Z (#1316) through 10:16:48Z (#1322). `processed/<prompt>.md.log` carries the JSON twin -
controlled on two: `#1322 {"ok":false,"marco":true,"reason":"outside tests/ or docs/: ..."}` and
`#1321 {"ok":false,"marco":true,"reason":"escalates:true - ..."}`.

[MEASURED] **A label-only check would have been WRONG on four of six.** #1316, #1317, #1320 and
#1322 carry **no label at all** and are routed purely by the `tests-docs` path. The label is the
gate on only 2 of 6. This is the concrete case DOCTRINE 9.4's `labels=[]` warning describes.

### #1319's red is the hold itself, not a defect

[MEASURED] `gh run view 32833543696 --job 97757596917 --log`: CP-09/10 SKIP, CP-11/12/13/17/23/24/25
PASS, CP-22 SKIP, and
`FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must review
and REMOVE the label; removing it is what releases the merge.]`
There is nothing to fix. CP-26 self-clears when Marco removes the label. **I did not touch it.**

### Watcher - LIVE, and the freeze probe is clean

[MEASURED] Three `.queue-state.json` `ts` samples from
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`:
`12:08:07.459Z -> 12:13:07.365Z -> 12:18:07.293Z` = **two consecutive 5.00 min gaps**. Not frozen.
[MEASURED] node pid **29024**, resolved by command line `pr-watcher[\\/]index\.mjs`, exactly one
match. Auto-restart wrapper alive (1).
[CANNOT MEASURE] `logs\heartbeat.log` does not exist at that path (the sweep reads an age from
somewhere else). Not chased - the `ts` GAP is the authoritative probe and it is clean.

### Queue

[MEASURED] armed at run start: **0**. needs-marco 9, no-pr-opened 107, failed 20, blocked 0.
[MEASURED] depth-1 `pr-*.md` on disk: **62**. Tracked: 60. **UNTRACKED: exactly 2** -
`pr-hygiene-gitignore-no-pr-opened-HOLD.md` and `pr-watcher-idle-tick-liveness-HOLD.md`.
Control: `pr-rates-s11c-drop-legacy-tables-HOLD.md` reads tracked=True.

### Breadcrumb freshness

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`: 8 checked, **0 malformed**,
7 skipped as pre-contract. SILENT: **00** (last 08:08Z, 4.0h, cadence 2h) and **03**
(last 2026-08-24T23:01Z, **13.2h**, cadence 4h). 04 ok (2.0h), 05 ok (21.9h).
[MEASURED] All 8 contract-era breadcrumbs are UNTRACKED - they reach nobody until a board PR
commits them.

## WHAT CHANGED

**One mutation: armed `pr-arm-lock-s1-serialize-arming` (`git mv` HOLD -> ready).**

Pre-flight, all [MEASURED] immediately before the rename:
- `status-sweep.ps1` VERDICT: `SAFE TO ACT` (12:09:03Z); re-checked at 12:13Z - armed 0,
  `index.lock` dev False / clone False, git processes 0, `git diff --cached --name-status` EMPTY.
- `lint-prompt.mjs` -> **ADMIT** (size 5). Control: `lint-prompt.mjs` itself exists, and `gh` reaches
  GitHub (sweep section 0), so this is not DOCTRINE 9.5's absent-`gh` failure.
- Premise `! test -f scripts/pipeline/arm-prompt.ps1` -> file absent, **premise ALIVE**.
- Body read for the markers the linter cannot see: the **exact grant literal**
  `STANDING AUTHORITY to finish the work, commit, push` is present (True).
- Two `do-not-arm` grep hits inspected line by line: **both are the prompt SPECIFYING the detector**
  (lines 54 and 77, inside backticks), not a marker addressed to me. See F3.

Read-back after the rename:
```
staged: R100  docs/pr-prompts/pr-arm-lock-s1-serialize-arming-HOLD.md
           -> docs/pr-prompts/pr-arm-lock-s1-serialize-arming-ready.md
armed count: 0 -> 1        HOLD gone: True        ready on disk: True
```
The index carries **only** my rename. Nothing else was staged before or after.

**Pickup PROVEN** - `logs/2026-08-24.log`:
```
[2026-08-25T12:13:54.036Z] [queue] pr-arm-lock-s1-serialize-arming-ready.md (depth: 1, source: watch)
[2026-08-25T12:13:54.245Z] [start] pr-arm-lock-s1-serialize-arming-ready.md (max-turns=240)
```
Arm -> pickup was **seconds**, via `source: watch` (the fs watcher), not the 5-min rescan.

**I merged nothing, removed no label, and touched no PR.** Six of six are watcher-routed (RULE 2).

## FINDINGS

### F1 - Station 03 has been SILENT for 13.2 h, 4th consecutive run reporting it

[MEASURED] `check-breadcrumb.mjs --freshness`: `03  last 2026-08-24T23:01:00Z  13.2h ago
(cadence 4h)  SILENT`. Three previous supervisor runs recorded the same growing gap. Repeating it
a fifth time is a status update, not a finding, so it is escalated with a question instead.

Station 03 is a **device task** (invisible to `list_scheduled_tasks` by construction, per
STATION-CAPABILITIES section 2), so no station can see whether it is scheduled, disabled, or
firing-and-failing. That diagnosis needs the desktop-app task UI, which only Marco has.

**DISPOSITION: ESCALATED** - see E2.

### F2 - two staged prompts are UNTRACKED, and `git mv` REFUSES to arm them

[MEASURED] `git mv docs/pr-prompts/pr-watcher-idle-tick-liveness-HOLD.md ...-ready.md` ->
`fatal: not under version control`. Measured cause: 2 of 62 depth-1 prompts are untracked
(`pr-hygiene-gitignore-no-pr-opened-HOLD.md`, `pr-watcher-idle-tick-liveness-HOLD.md`), both staged
today by chats that - correctly, under LL-38 - could not open a PR to commit them.

This is the 08-25 08:20Z F4 defect recurring, and it is structural, not a slip: **a scheduled
station may stage a prompt on disk but may not create the PR that tracks it**, so every
station-staged prompt is born unarmable by the sanctioned `git mv`. The `Move-Item` workaround arms
it but leaves no audit trail. I declined the workaround and armed a tracked prompt instead.

Worth noting the interaction: `arm-prompt.ps1` (the thing I just armed) **requires the HOLD to be
tracked** at its step 3, so once it lands the workaround stops being available at all. That is the
right outcome, but it makes closing this gap a prerequisite rather than a nicety.

**DISPOSITION: ESCALATED** - folded into E1, because the fix is the same authority question.

### F3 - a naive do-not-arm grep would refuse to arm the do-not-arm detector itself

[MEASURED] `pr-arm-lock-s1-serialize-arming-HOLD.md` contains the literal strings
`<!-- watcher: do-not-arm -->` (line 54) and `DO NOT ARM` (line 77) - both inside backticks, in the
prose that tells the implementing agent what to detect. A bare `grep -q` guard, which is exactly
what that prompt's step 3 specifies, would **refuse to arm this prompt**.

The fix is small and belongs to the agent now building it: match the marker only as an HTML comment
at line start, or only outside fenced/inline code, and add a test case whose fixture is this very
prompt. I armed it anyway, with the two hits read line by line - the check that step 3 automates is
the check I performed by hand.

**DISPOSITION: DISPATCHED** - to the running agent for `pr-arm-lock-s1-serialize-arming`, via this
breadcrumb and project memory. It is a self-test the prompt already implies; no new prompt needed.

### F4 - `pr-watcher-idle-tick-liveness` will trip `lint-station.mjs` as written

[MEASURED] The prompt's `done_when` requires `grep -q "verdict-archive sweep" docs/pipeline/DOCTRINE.md`
and its body says to add the entry "in the section that names the specific ways an instrument lies
(section 9)". Section 9 is enclosed in `<!-- CANONICAL-BLOCK: instruments v1 -->`, and
`scripts/pipeline/lint-station.mjs` hashes exactly that block
(`const blocks = isDoctrine ? ['instruments'] : ['station-contract']`) and fails with
`canonical block instruments has been EDITED`. The prompt never mentions
`lint-station.mjs --write-canonical`, so the PR will go red on its first run.

[MEASURED] The premise is nonetheless **ALIVE and correctly scoped**: the log at 12:18:07Z reads
`verdict-archive sweep: archived=0 kept=6 skipped=0` - it only goes mute at 0/0/0, i.e. on an empty
board. `grep "verdict-archive sweep: idle"` returns False; the control `grep "verdict-archive sweep"`
returns True, so the instrument can produce a positive.

I did not edit the prompt - prompt content is Station 06's lane, and an uncommitted edit to a file
that is not even tracked would sit dirty in a shared index.

**DISPOSITION: DEFERRED** - it becomes urgent the moment anyone arms this prompt. It is untracked
(F2) so it cannot be armed cleanly today anyway. Fixing F2 and this in one staging pass is the
efficient move.

### F5 - Station 04's 10:10Z breadcrumb has never been dispositioned

[MEASURED] `00-04-scanner-2026-08-25-1010-instrument-honesty-doctrine-s9.md`, written 10:10-10:22Z.
The 10:09Z supervisor run was **blind** and started before it existed, so no supervisor has read it.
Its ten findings, dispositioned here:

- **F1/F2 (lint-prompt.mjs fails quiet without `gh`; do-not-arm blind spot grown 8 -> 12, 11 ADMIT,
  two of them drop DB tables)** - DEFERRED to a Station 06 staging pass. Mitigated meanwhile by the
  standing rule I followed this run: read the body, every time. My own `gh` control passed, so F1
  did not bite here.
- **F3/F4/F5/F7 (four section-9 doc corrections)** - DEFERRED. They live in `CANONICAL-BLOCK:
  instruments v1`, so they must ship as ONE change with the hash re-recorded and all six station
  docs together. Same constraint that produces F4 above; batch them.
- **F5 confirmed live this run**: `$` in a `-Command` string is substituted, not stripped -
  `'EXIT ' + [string]$LASTEXITCODE` printed `EXIT string`. A wrong value that parses, exactly as
  described. I moved every probe containing `$` into `.ps1` files under `C:\po-sup-fix-scripts\`.
- **F6 (`status-sweep.ps1:86` tags trunk CI `[LIVE]` with no freshness assertion)** - DEFERRED to
  Station 06 with F1/F2's code fix. Did not bite this run; I quoted no trunk colour.
- **F8 (clone stashes are 39, not ~136)** - **ACTIONED**: project memory corrected this run.
- **F9/F10 (eight traps still trapped; docs byte-clean)** - noted, no action.
- **Its item 6 (commit this breadcrumb and `docs/pipeline/sweep-rotation.json`, or the next scanner
  run repeats `instrument-honesty` instead of drawing `repo-hygiene`)** - **ESCALATED**, folded into
  E1. I cannot commit it: Station 00 does not create PRs (LL-38). This is now a *measurable*
  consequence of the authority gap - a station will demonstrably redo a completed sweep.

**DISPOSITION: as itemised above** (1 ACTIONED, 1 ESCALATED, the rest DEFERRED).

### F6 - the `tests-docs` escalation from 10:09Z is unanswered, and the board grew again

[MEASURED] Board went 2 (08:08Z) -> 5 (10:09Z) -> **6** (12:09Z). Four of the six are routed by a
one-file touch outside `tests/`: a jest config, a workflow file, `App.tsx`, `AccountDetailPage.tsx`.
Every real slice now terminates at the human gate, and **nothing in the queue changes that** - I
checked the armable HOLDs and every one of them touches `apps/` or `scripts/`.

Consequence, stated plainly: the pipeline can still *build* but can no longer *land* anything without
Marco. Chains stalled: EW-2b behind #1316, e2e-s2 behind #1317, wincount s2/s3 behind #1321.

**DISPOSITION: ESCALATED** - E3, restated with RULE 1 options because it is now costing four chains.

## FOR MARCO - three questions, RULE 1 options, complete-and-additive first

### E1 - a scheduled station can stage a prompt but cannot track it. Who commits?

**The measured cost today:** `git mv` refused on 2 of 62 prompts (F2); Station 04's rotation file
is uncommitted, so its next run will repeat a sweep it already finished (F5); and all 8
contract-era breadcrumbs are unreadable by anyone but the box that wrote them.

- **(a) COMPLETE + ADDITIVE - give Station 00 a narrow "housekeeping PR" lane.** One PR per run,
  pathspec-restricted to `docs/pr-prompts/00-*.md` and `docs/pipeline/sweep-rotation.json`, opened
  via `gh pr create` from a disposable worktree off `origin/main`, never merged by 00. It cannot
  touch code, cannot touch `sot/`, and CP-24 still applies. Passes both halves: the reports become
  readable immediately, and nothing about future data entry changes.
- **(b) Let Station 06 sweep them on its next on-demand run.** Fails the *immediately* half - 06
  runs only when you invoke it, so the gap persists for an unbounded time, which is how the nine-day
  `docs/qa/` swallow happened.
- **(c) Leave project memory as the only channel.** Fails the *completely* half - memory has no
  audit trail, is invisible to CI and to a clone, and cannot carry `sweep-rotation.json` at all.

### E2 - Station 03 has not reported in 13.2 h. Is it still scheduled?

I cannot see this: 03 is a device task, structurally invisible to `list_scheduled_tasks`.

- **(a) COMPLETE + ADDITIVE - check the desktop-app task list, and have 03 write a
  `station-03-alive` breadcrumb even on a clean no-op run.** A no-op breadcrumb costs nothing and
  makes silence self-diagnosing forever after; today silence is indistinguishable between
  "not scheduled", "ran and crashed", and "ran and found nothing".
- **(b) Just re-enable/re-create the task.** Fixes today, leaves the next silence just as
  ambiguous - fails the *future* half.
- **(c) Fold 03's checks into 00.** Fails the *without damaging* half: 00 would be mutating the
  queue and the watcher process in the same run, which is the LL-38 collision by design.

### E3 - `tests-docs` sends every real slice to you. Six PRs are waiting. (restated from 10:09Z)

- **(a) COMPLETE + ADDITIVE - a named allow-list of config-only paths** the watcher may merge
  without routing: e.g. `apps/api/jest.config.ts`, `.github/workflows/playwright-*.yml`. Named
  paths, not a pattern; `escalates:true` and the `do-not-merge` label untouched, so every prompt
  that genuinely writes data still stops. Additive - it can only ever *remove* a routing, never add
  a merge path for data.
- **(b) Widen `tests-docs` to a glob** (e.g. any `*.config.ts`). Fails the *without damaging* half:
  a glob written today silently admits files nobody has looked at yet.
- **(c) Leave it and merge the six by hand.** Fails the *future* half - the seventh arrives tonight.

**Nothing in E1-E3 is actioned by me. RULE 2 held on all six PRs; I merged nothing.**

## WHAT I DID NOT DO

- **Merged nothing.** All six open PRs are watcher-routed to Marco, proven in both log files.
  RULE 2 is not overridden by green, by an absent label, or by a clean diff.
- **Removed no `do-not-merge` label** (#1319, #1321). Only Marco removes it.
- **Did not "fix" #1319's red.** Its only failure is CP-26, which *is* the hold and self-clears.
- **Armed only ONE prompt**, and specifically declined to arm a second while the first is running.
- **Did not arm `pr-watcher-idle-tick-liveness`** despite it being the fix Station 04 asked for
  twice: it is untracked (F2) and would trip `lint-station.mjs` as written (F4). Arming it via
  `Move-Item` would have worked on disk and left no audit trail; that is not worth the run.
- **Did not edit any prompt body.** Prompt content is Station 06's lane.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or any production data.**
- **Did not clear the 4 orphaned worktrees or the 39 clone stashes** - Station 03's lane, and 03 is
  the station that is silent (F1/E2). Reported, not touched.
- **Did not chase the missing `heartbeat.log`** - the `ts` GAP is the authoritative probe and it is
  clean, so this is a curiosity, not a lead.

---
Station 00 - Supervisor. All facts measured against `b968e4f1` between 2026-08-25T12:08:35Z and
12:22Z unless tagged otherwise. **This breadcrumb is UNTRACKED** until a board PR commits it - which
is exactly finding F2/E1.

## ADDENDUM - a new instrument trap, found while verifying this breadcrumb

🔴 **`git check-ignore` reports a path that is IN THE INDEX as NOT ignored.** My first control run
asked it whether `docs/pr-prompts/pr-arm-lock-s1-serialize-arming-ready.md` was ignored - a file
that `.gitignore:75` ignores by name - and it exited **1 (not ignored)**, because the `git mv` had
just put that path in the index and `check-ignore` skips index entries by default.

That is DOCTRINE section 7's exact shape: a confident, coherent, wrong negative from a failed
precondition rather than a real answer. **Add `--no-index`.** Re-run with it:

```
git check-ignore -v --no-index -- docs/pr-prompts/pr-arm-lock-s1-serialize-arming-ready.md
  .gitignore:75:docs/pr-prompts/*-ready.md   ...-ready.md      exit 0   <- control PASSES
git check-ignore -v --no-index -- docs/pr-prompts/00-00-supervisor-2026-08-25-1208-...md
                                                                        exit 1   <- not ignored, good
```

Practical consequence: **the moment you arm a prompt, `check-ignore` stops being able to tell you
that `*-ready.md` is gitignored** - which is precisely when someone is most likely to ask. Station
04's 10:10Z control was sound only because its control file (`rev-1321-ready.md`) was untracked.

**Verification of this breadcrumb, after the correction:** not ignored (exit 1, `--no-index`);
`git status` shows it `??`; `check-breadcrumb.mjs` returns **ADMIT**, 9 checked, **0 malformed**;
17444 bytes, **no BOM, 0 U+FFFD, 0 double-encode sequences**; and the index still carries only the
single `R100` arming rename.

**DISPOSITION: ACTIONED** - recorded here and in project memory. It belongs in DOCTRINE section 9.2
alongside the other git traps; batch it with the four section-9 corrections in F5, since they all
need the canonical hash re-recorded together.
