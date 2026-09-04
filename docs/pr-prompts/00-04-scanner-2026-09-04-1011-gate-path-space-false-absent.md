# Station 04 - Scanner | 2026-09-04T10:11Z-2026-09-04T10:25Z

## GROUND

```
UTC            2026-09-04T10:11:00Z
origin/main    aac5e187            (fetched, then rev-parse)
dev tree       main @ aac5e187     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both 1) - full authority, not read-only.
NOT BLIND: Desktop Commander loaded via ToolSearch, `start_process` powershell.exe -> PID 26420.
All three binding docs read from the dev tree after proving them identical to `origin/main`:
`git diff --numstat origin/main -- <the three>` returned EMPTY (the sound probe per the PREFLIGHT;
no piped hash was used).

Sweep this run, assigned by `node scripts/pipeline/next-sweep.mjs`: **gate-liveness**
(rotation position 1 of 4; previous run 2026-09-04T06:10:49Z).

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` 10:11:32Z: OPEN PRs **0** · armed `*-ready.md` **0** · main CI on
  `aac5e187` 4 success / 0 failed (trunk green) · watcher node RUNNING pid 20000 · in-progress
  prompts 0 · git index.lock false/false. Section 0 instrument controls both PASS.
  VERDICT: **CAUTION** - 1 live station worktree `C:/po-vg` (`fix/no-rebase-while-checks-run`,
  age 138 min). Not mine; I mutated nothing on the board, so CAUTION did not bar this sweep.
- [MEASURED] Dev tree is neither stale nor secretly ahead: `git rev-list --left-right --count
  HEAD...origin/main` -> `0 0`; `git diff --cached --name-status` EMPTY; no uncommitted `-HOLD`
  files under `docs/pr-prompts/`. (Both halves of the standing stale/ahead trap checked.)
- [MEASURED] `triage-holds.ps1` over 75 prompts: **spent=0 · gates-satisfied=33 · still-gated=42 ·
  unreadable=0**. It self-calibrated (2 distinct verdicts observed; SPENT proved reachable by its
  own fixture control). **No prompt on the board is finished work.**
- [MEASURED] The 42 still-gated prompts never had their premise evaluated - lint rejects at the
  gate first. That is this sweep's named target ("a dead gate MASKS the premise behind it"), so I
  re-verified all 14 `requires_*` gates with a SECOND, independent instrument (`git show`,
  `shell:false`), controls `CLAUDE.md` PRESENT / `zzz-nope-zzz.md` ABSENT.
  Result: **9 of 10 agree with lint (gates genuinely ALIVE); exactly 1 disagrees.**
- [MEASURED] Self-correction, recorded because it nearly became a false finding: my first parser
  reported `requires_on_main:` as EMPTY on `pr-ci-gate-dead-queue-dir-reads-HOLD.md` and
  `pr-module-provenance-s2-HOLD.md`. Reading the raw front matter showed both are YAML **lists**
  with indented items; my regex was blind to them. Not a defect - my instrument (DOCTRINE 9.6).
- [MEASURED] Blast-radius scan over all 82 depth-1 tracked prompts on `origin/main` (`ls-tree -r`,
  then filtered - no glob pathspec, per 9.2): 75 have parseable front matter; **exactly 1** carries
  a gate path containing a space.
- [MEASURED] **The `armed: 0` reading above expired during this run - worked instance of the
  `[LIVE]` rule.** Re-measured at 10:24Z the armed count is **1**:
  `pr-approval-receipt-test-gaps-ready.md`. It is **NOT mine** - 04 arms nothing.
  `.arming-log.txt` records `2026-09-04T10:15:53Z ARMED pr-approval-receipt-test-gaps`, i.e. a
  concurrent **Station 00** (whose 1009 breadcrumb is also untracked in this tree) armed it four
  minutes into my sweep. That is inside 00's authority; no defect. Recorded because a later reader
  diffing "armed 0" at 10:11Z against "armed 1" now would otherwise have to re-derive who did it.
  Note also that the file's mtime reads **2026-09-01T12:31Z** - authorship, not arming
  (`git mv` preserves mtime, DOCTRINE 9.5). The arming log is the only clock that dates an arm,
  and it is the one I used.
- [CANNOT MEASURE] How long `shell: process.platform === "win32"` has been in
  `readFromOriginMain` - `git log -S` on that literal returned nothing (special characters). Not
  needed for the finding: the gate path it breaks only became reachable today (#1573).

## WHAT CHANGED

- **Staged** `docs/pr-prompts/pr-lint-gate-path-space-HOLD.md` - lint **ADMIT (exit 0)**, size 2.
  Staged as `-HOLD`, deliberately NOT `-ready`: a loose `*-ready.md` IS an arm (DOCTRINE 5b) and
  04 arms nothing. **Untracked** in the dev tree until a board PR commits it.
- **Advanced the sweep rotation**: `next-sweep.mjs --advance --utc 2026-09-04T10:18:22Z` ->
  `last_index=0`. `docs/pipeline/sweep-rotation.json` is **LEFT DIRTY on purpose** - Station 00
  commits it; 04 may not commit to the shared dev tree.
- Nothing else. No prompt armed, renamed, moved or deleted. No PR opened, no merge, no label,
  no `/sot/` edit, no board mutation.

## FINDINGS

### F1 - S2 - A gate path containing a SPACE is reported ABSENT when the file is on main, and it fails in both directions

`readFromOriginMain()` (`scripts/pipeline/lint-prompt.mjs`, the single funnel behind all five gate
probes) passes `shell: process.platform === "win32"` to `execFileSync`. With `shell:true` Node
concatenates argv instead of escaping it (Node itself raises `DEP0190`), so a path with a space is
split into two shell words.

The damage is not that it fails - it is **where** it fails. git's stderr reads
`fatal: path 'Claude' does not exist in 'origin/main'`, which MATCHES the file-absent regex at the
catch site. So the function returns `{ absent: true }` - the *file-is-not-on-main* answer - rather
than `null`, the *git-is-broken, fail-safe* answer. **Nothing warns**, and on a `-HOLD` the
resulting `FILE_GATE_NOT_RELEASED` is the normal, healthy-looking verdict.

[MEASURED] 2026-09-04 at `aac5e187` - same probe, one knob varied, both controls:

| path | `shell:true` (as lint runs it) | `shell:false` |
|---|---|---|
| `Claude Design/docs/01-commercial.md` (real gate) | **ABSENT** - `fatal: path 'Claude' does not exist` | **PRESENT, 23637 bytes** |
| `CLAUDE.md` (positive control, no space) | PRESENT, 1930 b | PRESENT, 1930 b |
| `docs/zzz-no-such-file-zzz.md` (negative control) | ABSENT | ABSENT |

The positive control proves git and the probe are healthy; only the spaced path diverges. This is
DOCTRINE 7 exactly: a working system, a broken measurement, a confident wrong verdict.

**It fails in BOTH directions.** On a `-HOLD` it fails CLOSED (work parked forever). On a non-HOLD
the same false ABSENT suppresses `FILE_GATE_DEAD`, so a genuinely dead gate is never reported -
that direction fails OPEN.

**Why now, and why nothing caught it before:** `Claude Design/` is the repo's only tracked
directory with a space in its name, and it was **un-ignored today** by #1573
(`CD-S1`, merged 2026-09-04T07:39:35Z). No gate path had a space until this morning. CI never sees
it either - on the Linux runner `process.platform === "win32"` is false, so CI exercises only the
un-shelled path. The defect is Windows-only and therefore invisible to every green check.

**DISPOSITION: DISPATCHED -> Station 00.** Fix staged as
`docs/pr-prompts/pr-lint-gate-path-space-HOLD.md` (ADMIT, size 2). It is untracked; 00 commits it
with the next board PR, then arms it on Marco's authority. The fix touches `scripts/`, outside
`tests|docs`, so the resulting PR is **Marco's to merge** (DOCTRINE 10.1 step 2) - the prompt says
so in its own body. RULE 1 options are in F1a below.

### F1a - RULE 1 options for the fix

- **(a) Remove the `shell:` option from `readFromOriginMain` only.** COMPLETE and ADDITIVE, and
  therefore first. Complete: it is the single funnel behind all five gate probes, so it repairs
  every gate path for every prompt, now and in future, in both failure directions. Additive: it
  changes no gate semantics, no prompt, no data - and it is the code path CI already exercises on
  every PR (Linux -> `shell:false`), so the fix is the *tested* branch, not a new one. Measured
  working above (23637 bytes returned). This is what the staged prompt orders.
- **(b) Quote the argument while keeping `shell:true`.** Fails the FUTURE half of RULE 1: it patches
  this one call and leaves the concatenation surface for the next `shell:true` caller added.
- **(c) Rename `Claude Design/` to remove the space.** Fails the COMPLETE half (every future spaced
  path still breaks) and touches existing content #1573 deliberately un-ignored. Rejected; the
  staged prompt explicitly forbids it.

`ghFetchPrState()` (`:1259`) carries the same `shell:` flag but is **deliberately** left alone: its
only interpolated argument is validated as a bare positive integer and the shell is documented as
needed for `gh` resolution. Named here so the next reader does not "fix" it.

### F2 - S3 - The masked prompt is LIVE work, not spent work

With F1's gate wrongly closed, `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` has been parked
since 07:39:35Z today. Its gate `requires_file_on_main: Claude Design/docs/01-commercial.md` is in
fact **SATISFIED**, and its own premise is still **ALIVE**:
[MEASURED] `git cat-file -e origin/main:docs/plans/claude-design-spec-regeneration-plan.md` ->
exit 128 (absent), positive control `CLAUDE.md` -> exit 0. The premise `! test -f <that plan>` is
therefore TRUE, so the work is genuinely still needed.

So this sweep's headline question - *is a dead gate masking finished work?* - answers **no, it is
masking unstarted work.** Nothing needs binning; one slice needs releasing. It is the sole member
of cluster `claude-design` on main (`cluster_order: 2`; S1 landed as #1573).

**DISPOSITION: DISPATCHED -> Station 00.** Once F1's fix lands, re-lint this prompt; it should
report the gate released and become an arming candidate. **Do not promote it by hand in the
meantime** - that would substitute my reading for the gate, which is the instrument this fix
exists to repair. Arming remains 00's on Marco's authority.

### F3 - INFO - The rest of the board's gates are honest

[MEASURED] All 13 other `requires_*` gates verified ALIVE against `origin/main` with an
independent probe: `pr-ci-gate-dead-queue-dir-reads`, `pr-module-provenance-s2`, `pr-ew-s2d`,
`pr-ew-s3`, `pr-ew-s4`, `pr-fv2-ai-digests`, `pr-fv2-output-channels`, `pr-rates-s11c`,
`pr-tenant-mt4-s2`, `pr-tipid-s2`, `pr-tr-s2`, `pr-tr-s3`, `pr-transport-capacity-column-order`.
Two of them (`rates-s11c`, `tenant-mt4-s2`) gate on a `docs/approvals/...-approved-by-marco.md`
file that is correctly absent - those are Marco's approvals, working as designed.

**DISPOSITION: ACTIONED** - verified clean this run; recorded so the next gate-liveness sweep can
diff against it rather than re-derive it.

## WHAT I DID NOT DO

- **Armed nothing, promoted nothing, merged nothing, opened no PR.** 04 is read-only on the board.
- **Did not commit** the staged prompt or `sweep-rotation.json`. Both are left dirty/untracked in
  the dev tree for Station 00 - 04 may not commit to a shared tree that other chats share an index
  with.
- **Did not hand-promote** `pr-claudedesign-s2` even though I measured its gate satisfied (F2).
- **Did not touch** `C:/po-vg` or the three orphaned worktrees / 2 registry escapees the sweep
  reported - worktree hygiene is Station 03's, and one of them is live.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
  doc orders ONE named sweep covered completely, and gate-liveness was the assigned rotation.
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, production data, or any `*-ready.md`.
- **Did not clear** the [STALE] escalation lines section 5 flagged (12 dead PR refs in
  `hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md` and others). Clearing `needs-marco/` is
  not 04's lane; noted here so 00 can dispatch it.
