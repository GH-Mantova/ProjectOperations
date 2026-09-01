# Station 04 - Scanner | 2026-08-31T22:10Z-2026-08-31T22:27Z

## GROUND

```
UTC            2026-08-31T22:10:54Z
origin/main    6d19e841              (fetched, then rev-parse)
dev tree       main @ cc4cc7b0        C:\ProjectOperations2   (behind main by 1 commit: #1460 status-sweep.ps1 only)
doc version    1                      (docs/pipeline/stations/04-scanner.md)
bootstrap      1                      (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions AGREE. Run was read-write within lane (staged one HOLD, advanced the rotation).
SIGHTED: `start_process` powershell.exe returned PID 15556 on the first call.

`git diff --stat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY, so the working copies of the three binding
documents are byte-identical to `origin/main` and reading them from disk was safe this run.

SWEEP THIS RUN: **instruction-drift** (`node scripts/pipeline/next-sweep.mjs`, rotation position
4 of 4; previous run 2026-08-31T18:10:27Z). Advanced to `gate-liveness` at the end of the run.

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` @22:11:20Z: verdict **SAFE TO ACT**. Open PRs 3 (#1457 CLEAN 13/13,
  #1450 BLOCKED 12/0/1 pending, #1443 CLEAN 13/13). Trunk green. Watcher node pid 32916 RUNNING,
  wrapper alive, heartbeat 103 min, `orphaned worktrees: none`, armed 0, no git processes, no
  index.lock. Instrument positive controls both passed.
- [MEASURED] `#1460` MERGED 21:54Z. The dev tree is one commit behind and the only delta is
  `scripts/pipeline/status-sweep.ps1` (+71/-9).
- [MEASURED] Watcher clone is `branch=feat/lint-not-a-prompt dirty=1`, NOT clean-on-main.
- [MEASURED] Bootstraps: all five station `SKILL.md` under `C:\Users\Marco\Claude\Scheduled` carry
  `station_doc_version: 1` and mtime `2026-08-24T22:54:22Z` (00 5340B, 02 5337B, 03 5315B,
  04 5276B, 05 5251B). `weekly-security-audit` has no `station_doc_version`; `_retired-2026-08-18`
  has no SKILL.md. There is no `06-pr-master` bootstrap folder.
- [MEASURED] All six repo station docs on `origin/main` declare `v1`. Bootstrap and doc AGREE on
  every station that has both. No READ-ONLY trigger fired.
- [MEASURED] `node scripts/pipeline/lint-station.mjs` -> exit 0, `ADMIT: all 7 docs clean`. One
  warning, on 04 only: `names a Windows path outside the known folder map: C:\po-scan-`. That
  string sits inside the commented-out SUPERSEDED worktree recipe, so it is a comment, not an
  instruction. NOT a finding.
- [MEASURED] Checked whether the linter's folder map is the reason 02's
  `C:\ProjectOperations-Reference\worktrees` did not warn: `lint-station.mjs:37-39` lists
  `C:\ProjectOperations-Reference` as known, and `:148` is the warn site. The asymmetry is correct
  behaviour, not a blind spot. NOT a finding.
- [MEASURED] Path-reference sweep over the 8 binding docs (DOCTRINE, STATION-CAPABILITIES and all
  six station docs), read from `origin/main`, script at `C:\po-sup-fix-scripts\scan-path-refs.mjs`:
  **177 repo-relative refs**, **85 Windows-path refs (24 distinct)**, **0 line-refs past EOF**.
  Controls: `tracked.has('docs/pipeline/DOCTRINE.md')=true`,
  `tracked.has('docs/pipeline/zzzNoSuchFile.md')=false`, over 2794 tracked files.
- [MEASURED] The raw run reported 50 "dangling" repo paths and 3 missing Windows paths. **Every one
  of the 53 is a false positive** - each is a file the doc itself labels gitignored, untracked, or
  created-on-demand. Verified individually, with controls:
  `git check-ignore -v docs/data-model/relationship-map.json` -> exit 0 `.gitignore:127`;
  same for `relationship-map.md` -> `.gitignore:128`; negative control `git check-ignore -v
  CLAUDE.md` -> exit 1 empty. Both map files are present on disk (2.03 MB / 164 KB).
  `docs/pr-prompts/AWAITING-MARCO-DECISION.md` is absent and not gitignored, but 02-board-driver.md
  6c already says so in the sentence that names it and calls it "a local convenience, NOT the
  escalation channel". `C:\ProjectOperations-Reference\worktrees` is absent, and 02-board-driver.md
  6c instructs `mkdir ... if missing` and `rmdir ... if it is now empty` - absent IS the designed
  steady state. **Net dangling references: 0.**
- [MEASURED] DOCTRINE 9.5 pins 15 `scripts/pipeline/lint-prompt.mjs:<line>` citations. Checked each
  against both `origin/main` and `origin/feat/lint-not-a-prompt` (PR #1457):
  `:439 :492 :563 :826 :865 :903` -> `readFromOriginMain`; `:728` `DO_NOT_ARM_COMMENT`,
  `:730` `DO_NOT_ARM_CAPS`, `:732` `ARM_ONLY`; `:743 :755 :767` `HUMAN_GATE_PRESENT`;
  `:1164` `LINT_GH_BIN`, `:1165` `gh pr view`. **14 of 15 land on the claimed content on BOTH
  refs.** Negative control: line 1 does not contain `DO_NOT_ARM_COMMENT`.
- [MEASURED] The fifteenth: `single gh call` is at **1518 on main** and **1535 on #1457's head**
  (`checkFixesPrTargetOpen` itself stays at `:1132` on both). File length 1663 -> 1702;
  `git diff --numstat origin/main...origin/feat/lint-not-a-prompt -- scripts/pipeline/lint-prompt.mjs`
  = `46 7`. Negative control needle `zzzNoSuchTokenZzz` -> 0 hits.
- [MEASURED] Chain gate for the staged prompt: `NOT_A_PROMPT` occurs **0** times in
  `origin/main:scripts/pipeline/lint-prompt.mjs` and **3** times on #1457's head (control
  `readFromOriginMain` = 6 on main). The gate is live, not dead.
- [MEASURED] `docs/qa/.qa-run.lock` was ABSENT at 22:11Z. Claimed with epoch `1788214280`.

## WHAT CHANGED

Three writes, all inside lane. No board mutation, nothing armed, nothing merged, no `sot/` touched.

1. **Staged** `docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md` (new, untracked,
   `-HOLD` so it matches no watcher glob). Read back: `lint-prompt.mjs` -> exit **1**
   `[GATE_NOT_RELEASED]`, which is the CORRECT verdict for a parked HOLD and is what
   `triage-holds.ps1` classifies as "still gated". **Positive control run:** a scratch copy with
   only the `requires_on_main:` line removed linted **ADMIT, exit 0** - so the prompt is otherwise
   fully lint-clean and its only rejection is the intended chain gate. The scratch copy
   (`zztmp-lintcontrol-HOLD.md`) was deleted and its absence read back.
2. **Advanced the sweep rotation**: `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-08-31T22:11:20Z` -> `last_index=3 last_run_utc=2026-08-31T22:11:20Z`. Read back:
   `git diff --stat -- docs/pipeline/sweep-rotation.json` = `1 file changed, 2 insertions(+),
   2 deletions(-)`, and a fresh `next-sweep.mjs` now reports `SWEEP: gate-liveness`.
   **This file is UNCOMMITTED in the dev tree - Station 00 must commit it with this breadcrumb, or
   the next 04 run repeats instruction-drift.**
3. **Claimed and released** `docs/qa/.qa-run.lock` (gitignored).

Both new/edited tracked-path files are UNTRACKED or unstaged in the dev tree. Station 00 collects.

## FINDINGS

### F1 - DOCTRINE 9.5's `:1518` citation goes stale the moment #1457 merges (S3)

**Evidence.** Above, under WHAT I MEASURED. `single gh call` is at 1518 on `origin/main` and 1535
on `origin/feat/lint-not-a-prompt`. #1457 is CLEAN, 13/13 green, and changes that same file
`+46/-7`. The other 14 citations are unaffected on both refs.

**Why it matters more than one wrong number.** The citation lives inside
`<!-- CANONICAL-BLOCK: instruments v2 -->`. `lint-station.mjs` hash-gates that block against being
EDITED. It cannot detect it going STALE. Section 9.5 already records this exact failure once: the
block-scalar bullet asserted a pending fix for thirteen hours after the fix had landed, and four
station runs read the block in full inside that window without catching it. A line number is a
stale-by-construction anchor - invalidated by any edit ABOVE it, in a file that has no obligation
to tell DOCTRINE it changed.

**RULE 1.** The complete-and-additive fix is to re-anchor the citation on the SYMBOL and its
comment text rather than the line, which no future edit above it can invalidate, and to record the
general rule in the same bullet. It damages no existing or future data entry: it is a docs-only
edit plus the mandatory canonical-hash re-record. The alternative - re-pinning to `:1535` - passes
the "immediately" half and FAILS the "future" half, because it is the same instrument aimed one
edit further along and will be wrong again on the next change above it.

**Why I did not just fix it myself.** Two reasons, both structural. Station 04 is READ-ONLY on the
board and may stage but not arm. And the fix must land AFTER #1457, not before: writing `:1535`
into DOCTRINE today would make it wrong NOW. Hence a gated HOLD rather than an edit.

**DISPATCHED** -> Station 00. Arm `docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md`
once #1457 is on `main`; its own gate (`requires_on_main: scripts/pipeline/lint-prompt.mjs ::
NOT_A_PROMPT`, measured 0 on main / 3 on #1457's head) will keep it parked until then, and
`lint-prompt.mjs` will flip from exit 1 to ADMIT by itself. It is a **docs-only** PR, so the
watcher can auto-merge it under the `tests-docs` policy and it does NOT lengthen Marco's queue.

### F2 - a PowerShell loop returned a confident wrong version number at exit 0 (S3, method)

**Evidence.** Reading `station_doc_version` out of each bootstrap with
`$v = (Select-String ... | Select-Object -First 1).Matches.Groups[1].Value` inside a `ForEach-Object`:
for `weekly-security-audit`, which has no such key, the indexing threw
`Cannot index into a null array`, `$v` was never reassigned, and the loop printed
**`weekly-security-audit  bootstrap_v=1`** - carrying the previous iteration's value. The pipeline
exited 0 and the table looked complete and plausible.

This is a fresh instance of the DOCTRINE section 7 shape: a failed call flowing into a report as
though it were an answer. It is close kin to trap #5 (case-insensitive variable clobber) but the
mechanism is different and not currently in section 9: **a loop variable assigned inside a
`ForEach-Object` retains its previous iteration's value when the assignment throws, so an absent
key reads as the value of the item before it.** The guard is to initialise the variable to `$null`
at the top of each iteration, or to bind the match and test it before indexing.

Had this run trusted it, the report would have said a non-station bootstrap declares `v1` and
matches - a version-agreement claim about a document that has no version at all.

**DEFERRED.** Real, and worth a line in DOCTRINE section 9.1, but section 9 is a hash-gated
canonical block and I have one docs-only prompt staged this run already; two edits to the same
block from two prompts is a conflict waiting to happen. **What would make it urgent:** any station
reporting a per-item value from a `ForEach-Object` loop, or a second sighting. Cheapest path is to
fold the bullet into F1's prompt when 00 arms it, since that prompt already edits section 9 and
already re-records the hash.

### F3 - a naive path-reference scan over the binding docs yields 53 phantom findings (S4, method)

**Evidence.** 50 "dangling" repo paths and 3 "missing" Windows paths, every one of them false.
The docs reference gitignored state files (`docs/qa/qa-findings.md`, `qa-checklist.md`,
`qa-test-data-registry.md`, `.qa-run.lock`, `qa-github-audit.md`, both `relationship-map.*`,
`apps/api/scripts/xero-import-report.md`, `apps/web/.env.local`), untracked local conveniences
(`queue-watch-state.md`, `triage-state.md`, `AWAITING-MARCO-DECISION.md`), one file the doc itself
records as deleted in the 2026-08-17 cleanup (`Master-QA-and-Consolidation-Program-Plan.md`), and
one directory the doc creates and removes on demand (`C:\ProjectOperations-Reference\worktrees`).

The docs are RIGHT in every case; the instrument is what is naive. This matters because the
instruction-drift sweep recurs every fourth rotation and the obvious implementation of "check every
path still resolves" is exactly the query that just produced 53 false positives. A future run that
files them will burn a whole cycle and, worse, will look like it found something.

**DEFERRED.** The scan script lives at `C:\po-sup-fix-scripts\scan-path-refs.mjs` (untracked,
outside the repo, so it survives no `git clean` and no clone). **What would make it urgent:** the
next instruction-drift rotation, i.e. after three more 04 runs. The fix is to promote the script
into `scripts/pipeline/` with a three-way classifier - tracked / gitignored-by-design /
genuinely-dangling - resolving the second class via `git check-ignore -v` on the FILE form only
(DOCTRINE 9.2: the directory form's silence is byte-identical to a true negative).

### F4 - watcher clone is parked on a feature branch and dirty

**Evidence.** `status-sweep.ps1` @22:11:20Z: `watcher clone: branch=feat/lint-not-a-prompt dirty=1
<-- NOT clean-on-main; the watcher may refuse to start`. Watcher pid 32916 is nonetheless alive
with the wrapper up and `armed: 0`, so this is idle-with-drift, not wedged.

**DISPATCHED** -> Station 03, folded into the existing clone-hygiene dispatch (which already
carries the 11 dev-tree stashes and the eight dead `needs-marco/` files). Not new, not mine to
repair: STATION-CAPABILITIES section 5 gives clone repair to 03 and 04 is read-only on the machines.
Restated here only because it is currently true and a restart adopts nothing (DOCTRINE 9.5): the
clone must be fast-forwarded before any restart changes behaviour.

## WHAT I DID NOT DO

- **Did NOT re-measure the bootstrap-vs-repo-doc content drift.** Both sides declare v1, which is
  the gate the contract actually asks for, and the standing escalation on this is already open with
  Marco (the yes/no on `fix-station-bootstraps.mjs` authority). Re-diffing five files to re-derive a
  question that is waiting on an answer is how a run bills itself for work already done. Measured
  the versions, confirmed agreement, moved on.
- **Did NOT run Part 0 static cross-layer audit, Part 1 GitHub reconciliation, or Part 2 live-site
  patrol.** The AUTHORITY section is explicit that the rotation, not the brief's list order,
  decides: "Take ONE named sweep per run and cover it completely ... a shallow pass over everything
  is why findings rot." `next-sweep.mjs` named instruction-drift; I covered it and advanced the
  rotation. Part 0 (a) and the (b)-(f) rotation are the correct main effort on a run whose named
  sweep is not instruction-drift.
- **Did NOT arm anything.** Arming is 00's on Marco's authority. Real armed count stays 0.
- **Did NOT merge, label, rebase, or touch any open PR.** All three open PRs (#1457, #1450, #1443)
  are untouched. #1457 in particular is only READ here.
- **Did NOT edit `scripts/pipeline/lint-prompt.mjs`.** The code is correct; the citation drifted.
- **Did NOT edit DOCTRINE section 9 directly**, even though the finding is about it. Editing a
  hash-gated canonical block is a board mutation with a required hash re-record, and the fix must
  land after #1457, not before.
- **Did NOT touch `/sot/`**, Azure/Entra/SharePoint, the watcher clone, `C:\po-watcher`, any
  worktree, or any production data.
- **Did NOT clear any lock or stale file** flagged by the sweep's section 5 (the 17 `[STALE]`
  needs-marco cross-checks). That discharge is already dispatched to 03.
- **Did NOT run `git checkout`, `reset`, `stash pop` or `clean`** anywhere.
- **Left the dev tree one commit behind `origin/main`.** Fast-forwarding it is 00's move and the
  only delta is #1460's `status-sweep.ps1`; I ran the sweep from the dev tree copy, which is the
  older one, so its output is the pre-#1460 classifier. Worth knowing when comparing this run's
  sweep text against the next one.

---

### ADDENDUM 2026-08-31T22:18Z - a `[LIVE]` reading of mine decayed inside this run

The bullet above says "Real armed count stays 0". That was true of MY actions and it is now FALSE
as a statement of board state. Correcting it here rather than editing it above, so the decay is
visible.

[MEASURED] At 22:18:13Z the dev tree shows `armed (*-ready.md) = 1`:
`docs/pr-prompts/pr-crm-s10-comms-inbox-tab-ready.md`, with the matching ` D` on
`docs/pr-prompts/pr-crm-s10-comms-inbox-tab-HOLD.md` in `git diff --name-status` - the `git mv`
arming signature. `.arming-log.txt` tail: `2026-08-31T22:16:43Z  ARMED  pr-crm-s10-comms-inbox-tab
escalates=false  pid=23736  caller=powershell.exe:24776`. **My shell is pid 15556. I armed
nothing.** A CONCURRENT Station 00 run did, at 22:16:43Z - and `check-breadcrumb.mjs` had already
shown me its breadcrumb (`00-00-supervisor-2026-08-31-2211-...`, untracked) a minute earlier.

Three things worth carrying:

1. **`status-sweep.ps1` printed `armed: 0` at 22:11:20Z and it was correct; it was false 323
   seconds later.** Same shape as the 2026-08-22 `watcher RUNNING pid 42112` case, and the same
   cure: re-measure immediately before acting, never quote a sweep line as current state.
2. **DOCTRINE 9.5 re-confirmed live.** The armed file's mtime is **2026-08-27T08:05:45Z** while its
   arming happened at **22:16:43Z today** - 4.6 days apart. `git mv` preserves mtime; only the
   arming log dates an arm, and that log is untracked.
3. **`git diff --name-status` also carries an unrelated ` D` on
   `docs/pr-prompts/pr-sweep-worktree-liveness-HOLD.md`** - the consumed prompt whose tracked HOLD
   still needs `git rm` on the next board PR. That is housekeeping for 00, not drift, and it is not
   mine to stage.

The shared index was EMPTY at 22:18:13Z (`git diff --cached --name-status` returned nothing), so
nothing of mine or 00's is staged and no pathspec-commit hazard exists right now. **Station 00: two
chats were live in this window. Read `git diff --name-status` before committing anything, and note
that `docs/pipeline/sweep-rotation.json` is modified by ME, not by the 22:11Z supervisor run.**
