# Station 00 - Supervisor | 2026-10-09T03:14Z-2026-10-09T03:5xZ

## GROUND

```
UTC            2026-10-09T03:14:57Z
origin/main    6a0e7fca            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 6a0e7fca      C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                   (station_doc_version: 1)
```

Doc version and bootstrap AGREE, so this run is not read-only.

**NOT BLIND.** Desktop Commander loaded on one keyword `ToolSearch` for `desktop-commander`;
`start_process` with shell `powershell.exe` returned `main` and `2026-10-09T03:14:57Z` on the first
call. No retry was needed.

**Git guard, quoted as the contract requires.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
Last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/beautiful-zen-clarke/.local/bin:$PATH" git <args>
```

**EXIT CODE 2** - `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` That is the EXPECTED station outcome per the preflight table: a FINDING, not a STOP. The
device-bridge git ban was therefore REMEMBERED, not mechanical, for this whole run. It was kept: no
`git` was run through the Linux bridge against any mount. Every git and `gh` call below ran in a
`powershell.exe` shell on the Windows host.

## WHAT I MEASURED

**Ground, and the freshness readings cross-checked against `lastRunAt`.**

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, exit **0**.
Structure pass: 3 checked, 0 malformed. Freshness: `00` last 02:45Z (0.6h, cadence 1h+0.5h) ok;
`03` last 2026-10-08T23:06Z (4.2h, 24h+3h) ok; `04` last 02:10Z (1.2h, 4h+1h) ok;
`05` last 2026-10-08T22:38Z (4.7h, 24h+3h) ok. `02` dispatch-only.

[MEASURED] `list_scheduled_tasks` (scheduled-tasks MCP), which is the only live schedule - four
ENABLED tasks, never "the five":

| task | cron | lastRunAt | nextRunAt | enabled |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-09T03:14:35Z | 04:13:52Z | true |
| `03-machine-minder` | `0 9 * * *` | 2026-10-08T23:06:07Z | 23:02:45Z | true |
| `04-scanner` | `0 */4 * * *` | 2026-10-09T02:10:14Z | 06:09:31Z | true |
| `05-sot-keeper` | `10 0 * * *` | 2026-10-08T22:38:07Z | 14:22:37Z | true |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | - | **false** |

**Every station is both fresh and aligned** - the healthy row of the station doc's cross-check
table. `00`'s hourly cron is confirmed live from the MCP, matching the bootstrap's measured value;
no cadence figure in this report was taken from a document.

**Board, from `scripts/pipeline/status-sweep.ps1`.**

[MEASURED] section 0 positive controls both PASS - `gh CAN reach GitHub (saw merged PR #2272)`,
`node runs`. No `[BROKEN]`. Section 7 **VERDICT: `SAFE TO ACT`** - no board mutation in progress,
no recent remote activity, no live station worktrees.

[MEASURED] section 1: **OPEN PRs: 1** - `#2261` BEHIND, `CI: 13 pass / 2 fail / 0 pending`.
**WAITING ON MARCO: 0** open PRs labelled `do-not-merge`. `main` CI on `6a0e7fca`: 4 success /
0 failed / 0 running (trunk green).

[MEASURED] section 3 safe-to-act inputs: `git index.lock interactive/clone: False / False`;
git processes touching our trees **0**; watcher build **no build in flight** (newest tick 31.8 min
old); **board lease: free**; no PR touched on GitHub in the last 2 min.

[MEASURED] section 4 queue: **armed (`*-ready.md`): 0**. `needs-marco/` 53, `no-pr-opened/` 111,
`failed/` 80, `blocked/` 204. Section 6 backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.

**MARCO_QUEUE_LINE_V1, both figures, as the ARM bullet requires:** armed = **0**, WAITING ON MARCO
= **0 open PRs labelled `do-not-merge`**. Nothing was armed this run - see F20.

**#2261, measured per-PR and never from a listing (LL-47).**

[MEASURED] `gh pr view 2261 --json number,state,mergeStateStatus,headRefOid,headRefName,labels,files`
-> `state=OPEN`, `labels=[]`, `mergeStateStatus=BEHIND`, `headRefOid=a5a3d9bcd1ee052f4d69ed493ed9b6aadae5c272`,
`headRefName=fix/gitpush-worktree-mandatory-v1`, one file `scripts/pipeline/pipeline-lib.ps1` (+19 -1).

[MEASURED] `gh api repos/GH-Mantova/ProjectOperations/issues/2261/timeline --paginate`, parsed with
node, no `--jq` (DOCTRINE 9.4) - the complete `do-not-merge` history:

```
labeled   | do-not-merge | GH-Mantova | 2026-10-07T03:25:55Z
unlabeled | do-not-merge | GH-Mantova | 2026-10-09T02:47:10Z
```

[MEASURED] CP-26's verdict token, quoted from column 3 of job `113645296569`, run `37876207430`
(started 02:47:19Z - i.e. the unlabel triggered it - against the unchanged head `a5a3d9bc`):

```
FAIL - CP-26 do-not-merge [PR #2261 was labelled do-not-merge and released, but
docs/decisions/merge-approvals/2261.md is not in this PR's diff against merge-base with
origin/main.]
```

The second red, `Approval receipt (CP-26)` (job `113645296362`), is the same cause: its log ends in
the receipt template and `exit code 1`. **Two reds, one cause.** Everything else in
`PR gates - diff checks` PASSed or SKIPped (CP-11, 12, 13, 17, 23, 24, 25 pass; CP-09/10, 22, 27 skip).

[MEASURED] `gh pr view 2261 --json comments,reviews` -> `comments=1`, `reviews=0`. The one comment
is the watcher's pre-merge verdict: `VERDICT: MERGE`, `REVIEWED-SHA: a5a3d9bcd1ee052f4d69ed493ed9b6aadae5c2...`
= the current `headRefOid`, so the verdict is anchored to the live head and nothing has been pushed
to the branch since the review.

**Who removed the label - the session-window measurement.**

[MEASURED] session directories under `...\local-agent-mode-sessions\9df6923b-...\6662b30d-...\`,
scanned at depth with no name filter (DOCTRINE 9.5: the name format changed 2026-09-15, and
`list_sessions` reports `running` long after a session stops, so it cannot answer this alone):

| session dir | created (UTC) | newest file write (UTC) | run |
|---|---|---|---|
| `425d4aa4` | 2026-10-09T02:10:14 | 2026-10-09T02:21:38 | Station 04 |
| `0143207f` | 2026-10-09T02:14:34 | 2026-10-09T02:45:57 | Station 00 (0214 + 0245 breadcrumbs) |
| `a198f187` | 2026-10-09T03:14:35 | 2026-10-09T03:22:25 | this run |

So at 02:47:10Z **no station session was alive**: 04's had been dead 26 min, 00's had stopped
writing 73 s earlier. [MEASURED] `docs/pr-prompts/.arming-log.txt` last line is
`2026-10-07T02:30:35Z ARMED pr-gitpush-worktree-mandatory escalates=true actor=station-00`; the
supervised interactive lane (`station-00.interactive-NNNN`) last appears **2026-09-24T20:21:20Z**.
[MEASURED] `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs` contains **no `2026-10-09.log`**
(newest `2026-10-08.log`, 43848 bytes), so the watcher has logged nothing today under either the UTC
or the Brisbane-local reading of the date.

[CANNOT MEASURE] whether the running watcher (pid 8848) removed the label without logging it. The
recursive heartbeat probe over `C:\po-watcher` timed out at 180 s and was **not retried**, so no
heartbeat file content was read. The only heartbeat figure in this report is the sweep's derived
`heartbeat age: 31 min`, which is not a log line and is not used to support any verdict.

**F15's handed-over rotation probe, run exactly as specified.**

[MEASURED] `docs/pipeline/sweep-rotation.json` in the dev tree: `last_index=0`,
`last_run_utc=2026-10-08T22:38:44Z`, `last_station=04-scanner`. `git diff --numstat origin/main --
docs/pipeline/sweep-rotation.json` -> **EMPTY**, i.e. byte-identical to `main`, so the advance was
not merely uncommitted - it was never written. `node scripts/pipeline/next-sweep.mjs` (read-only)
assigned `instrument-honesty`, `rotation position 2 of 4` - the same sweep 04 had just completed.

[MEASURED] 04's session `425d4aa4` last wrote at 02:21:38Z, 61 minutes before this reading, so
**04 is not mid-run** and F15's second condition is met. Both of F15's conditions hold, so the
advance was executed - see WHAT CHANGED and F17.

**Instrument controls run this cycle.**

[MEASURED] `gh pr view 999999 --json number` -> prints `{"number":999999}` and exits **0**.
`gh pr view 999999 --json number,state` -> `GraphQL: Could not resolve to a PullRequest with the
number of 999999`, exits **1**. Positive control `gh pr view 2261 --json number,state` ->
`{"number":2261,"state":"OPEN"}`, exit 0. See F18.

[MEASURED] `Invoke-GitPush` on `origin/main` still reads
`param([string]$Branch, [string]$WorkTree = $script:WORKTREE)` - the defect #2261 exists to fix is
live on `main`, which is why every push in this run passed `-WorkTree` explicitly.

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json` advanced to `last_index=1`.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-09T02:10:14Z`, exit **0**.
   Read back: `last_index=1 last_run_utc=2026-10-09T02:10:14Z last_station=04-scanner`, and
   `--status` now prints `-> NEXT [2] repo-hygiene`. **The stamp is 04's measured `lastRunAt` from
   the MCP, not this run's clock** - the script's own comment says the caller supplies the time it
   measured, and the sweep in question is 04's, not mine. Run **once**, in the isolated worktree,
   never in the shared dev tree. CONTROL: the dev tree's copy is still `last_index=0` and its
   `git diff --numstat origin/main` is still EMPTY, so nothing was dirtied there.

2. **The 02:14-02:45Z cycle archived.** `git mv` of three breadcrumbs to
   `docs/pr-prompts/archive/`, each exit 0: the `0214` and `0245` Station 00 breadcrumbs and the
   `0210` Station 04 breadcrumb. All three were confirmed tracked on `origin/main` with
   `git ls-tree -r --name-only origin/main -- docs/pr-prompts` before moving. `check-breadcrumb.mjs`
   matches by basename, so they still count for `--freshness`.

3. **A correction appended to
   `docs/pr-prompts/needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`.**
   Confirmed tracked with `git ls-files` first, as the report contract requires for anything under
   that gitignored-by-rule folder. It records the label removal, the new CP-26 token, the session-window
   measurement, and the two-option question for Marco.

4. **This breadcrumb**, and the board PR that carries all of the above.

**Nothing else.** No merge, no label write, no arm, no prune, no retire, no `/sot/` edit.

## FINDINGS

### F16 - #2261 was released at 02:47:10Z and its gate flipped to RELEASED_NO_RECEIPT, but no instrument available to a scheduled run can attribute the release

The `do-not-merge` label came off #2261 at 2026-10-09T02:47:10Z by `GH-Mantova`, CI re-fired nine
seconds later, and CP-26's token changed from the `[RECEIPT_REQUIRED_BY_DIFF]` this PR was
escalated on 2026-10-07 to the released-without-a-receipt form. The watcher's `MERGE` verdict is
anchored to the current head. **One artefact is missing and it is a signature, not a check.**

`docs/decisions/merge-approvals/README.md` records that both the watcher (which applies the label)
and Marco (who removes it) authenticate as `GH-Mantova`, so the `unlabeled` event is unattributable
- which is why
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`
recommends **against** letting a scheduled run author `approved_by: marco` from that event alone.
That reasoning binds this run and I followed it.

What this run adds is a real narrowing rather than an argument: the session-window table under WHAT
I MEASURED shows **no station session alive at 02:47:10Z**, no interactive-lane trace for 15 days,
and no watcher log line today. That **eliminates the "a station cleared its own gate" branch for
this instance** - the exact branch CP-26 is built to catch. It does not identify the actor, and the
watcher branch is explicitly `[CANNOT MEASURE]` because the heartbeat probe timed out.

**[INFERRED]** the most probable actor is Marco at 12:47 Brisbane. **An inference is not a
receipt**, and a gate that accepts one cannot tell Marco's approval from an agent's.

**DISPOSITION: ESCALATED** - to Marco, as a question with options, appended as a dated correction
to the existing #2261 escalation rather than filed as a new one (DOCTRINE 10.5: one artefact, one
identity). The complete-and-additive option is first and named as such: **leave the release word
where a headless run can read it** - commit `docs/decisions/merge-approvals/2261.md` with
`authority: personal`, or post a one-line `released: 2261` comment, either of which carries an
author and a timestamp the API returns. That is also option (A) of the 2026-09-24 file, so one
answer discharges both. Alternatives (b) hand it to the interactive lane and (c) authorise the
inference are listed with the half of RULE 1 each fails.

### F17 - F15's rotation advance is done, and F15's own probe was one flag short of executable

Both of F15's stated conditions held, so the advance was executed once in an isolated worktree and
read back: `last_index=1`, next sweep `repo-hygiene`. 04's 06:09Z run will now get a sweep it has
not just done, instead of repeating `instrument-honesty` for a third consecutive cycle.

The handover was good enough to execute without re-deriving anything, and it still had one defect
worth recording because it is the class this pipeline keeps paying for: F15's probe said *"run
`node scripts/pipeline/next-sweep.mjs --advance` once"*, and the script **REJECTs** that form -
`REJECT --advance requires --utc <ISO timestamp> - pass the time you actually measured`, exit 1.
The tool is right and the probe was stale. It failed **loudly**, which is the only reason this cost
one call rather than a silent no-op; a prescribed command that no longer runs is still drift.

A second drift sits in the same tool and is already self-documented: `next-sweep.mjs`'s closing
lines say *"LEFT DIRTY: ... Station 00 commits it with the next board PR"*, which assumes 04
advanced in the shared dev tree. Advancing in a worktree is strictly safer and reaches the same
state, but the tool's text does not describe what actually happened here.

**DISPOSITION: ACTIONED** - the rotation is advanced and read back, and the dev tree is proved
untouched by the control above. The probe-vs-tool wording is carried forward as a lead for the next
run rather than fixed here: `next-sweep.mjs` is `scripts/**`, outside this station's `docs/` lane,
and on the never-list reasoning of #2261 a one-line text fix there would open a PR no station can
merge. Naming it costs nothing; arming it would cost a build.

### F18 - `gh pr view <n> --json number` exits 0 for a PR that does not exist, so the pipeline's negative control is only sound in its longer form

The standing negative control in this pipeline's breadcrumbs is
`gh pr view 999999 --json number,state` -> exit 1, and it works. **Abbreviate it to
`--json number` and it silently stops being a control**: `gh` synthesises the `number` field from
the argument without reaching the API, printing `{"number":999999}` and exiting **0**. Measured
this run with all three readings side by side, including the positive control on #2261.

This is DOCTRINE 7's shape exactly - a failed-to-reach call returning a well-formed, confident,
wrong answer with exit 0, and 9.6 never fires because nothing is empty. The risk is concrete: a run
that writes down `gh pr view 999999 --json number -> exit 0` as its negative control has written
down a **false positive** and will then trust a per-PR read that never happened.

**DISPOSITION: DEFERRED** - real, and not now. No document currently prescribes the short form, so
nothing is presently mis-instructing anyone; the sound long form is already what the breadcrumb
corpus uses. What would make it urgent is any station doc, DOCTRINE 9.4 bullet or script adopting
`--json number` as a liveness or existence check. It is recorded here with both controls so the
next instrument-honesty sweep inherits the measurement, and it is named in the #2261 escalation's
falsifying probe so the next reader of that file uses the sound form.

### F19 - `status-sweep.ps1` streamed to the console returned at section 2 with no verdict, and the same script redirected to a file produced all seven sections

First call: `powershell.exe -File .\scripts\pipeline\status-sweep.ps1` read through
`read_process_output` stopped after **103 lines**, mid-section-2, reporting `0 remaining`.
Sections 3 through 7 - including the `SAFE TO ACT` verdict this station is required to obey - were
absent, and **nothing errored**. Second call, same script, `*> $env:TEMP\st00_sweep.txt`:
**467 lines**, all seven sections, `SWEEP COMPLETE`. Every board figure in this report is from the
467-line capture.

This is DOCTRINE 9.1's *"streamed output can return EARLY with output still pending"* reproducing
on the single most consequential script in the station's preflight, and the failure mode is the
dangerous polarity: a truncated sweep looks like a complete quiet one. A run that read only the
103-line form would have had no verdict at all and could have mistaken the absence for permission.

**DISPOSITION: ACTIONED** - worked around in this run by capturing to a file and reading that, and
the reading is stated above with its line count so it can be re-checked. **The cure for future
runs is to redirect the sweep to a file and read the file, never to read it streamed** - that is a
calling convention, not a code change, so it needs no PR into `scripts/**` and no never-list
collision. Falsifying probe for the next run: call the sweep both ways in one cycle and compare
line counts; if the streamed form ever returns `SWEEP COMPLETE`, this finding is spent.

### F20 - nothing on this board is armable, and nothing is mergeable by this station

Armed prompts: **0**. Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`. The single open
PR, #2261, is RED on a gate only Marco can clear (F16), carries no `do-not-merge` label to count
against his queue line, and touches the first entry on `instrument-lane.json`'s NEVER-LIST, so no
receipt form is open to a station even with CI green. There was therefore no arm and no merge to
make - and the board lease was still taken, because the archive, the rotation advance and the
board PR are board mutations.

**DISPOSITION: DEFERRED** - the board is correctly idle, not stuck. What would make it urgent is
either a release signature on #2261 (which makes it this station's to merge) or a HOLD whose gates
go satisfied. Both are checked every run by the sweep and `--freshness`; neither needs a dispatch.

## WHAT I DID NOT DO

- **I did not write a receipt of any kind for #2261**, and that is the single most deliberate
  omission in this report. `approved_by: marco` from an `unlabeled` event is option (C) of the
  2026-09-24 escalation, recommended against there and forbidden in effect by what CP-26 exists to
  prevent. Eliminating the station branch by inference is not attribution.
- **I did not remove, add or re-apply any label.** In particular I did not re-park #2261. Re-applying
  `do-not-merge` would undo a release that is probably Marco's, and the 2026-09-24 file records two
  such programmatic re-parks being misread for weeks.
- **I did not merge #2261**, did not run `gh pr update-branch` on it, and did not re-run its CI. It
  is BEHIND, but updating a branch I am not about to merge costs a full CI rebuild for nothing.
- **I did not arm anything.** Armed = 0 before and after; `ready=1` in the backlog gate is a gate
  state, not an armable prompt.
- **I did not edit `scripts/**`** - not `next-sweep.mjs`'s misleading closing lines (F17), not
  `pipeline-lib.ps1`, not `lint-prompt.mjs`, not `instrument-lane.json` or `standing-lanes.json`.
  Outside this station's `docs/` lane, and on the never-list the first of those is unmergeable anyway.
- **I did not retire an escalation or clear a `[STALE]` row.** Section 5 produced 53 `needs-marco/`
  files and not one `[STALE]` line; every PR it cross-checked was cited as evidence rather than as a
  premise, which the sweep itself says does not clear anything.
- **I did not prune a worktree.** 31 non-main worktrees remain; four hold commits on no remote
  branch and one (`C:/po-worktrees/sup-cwd-paths`) holds 2 uncommitted files that `--force` would
  destroy. That is 03's lane and an irreversible action besides.
- **I did not dispatch 03, 04 or 05.** All four stations measured fresh and aligned; a dispatch on
  a healthy reading is noise, and touching a scheduled task on a freshness reading is forbidden.
- **I did not re-measure the watcher's heartbeat after the probe timed out**, and I did not let the
  sweep's derived `heartbeat age` stand in for it. The watcher branch of F16 is `[CANNOT MEASURE]`.
- **I did not run `lint-station.mjs --write-canonical`.**
- **I did not touch `/sot/`**, Azure, Entra or SharePoint, and wrote no production data.
- **I did not run `git` through the Linux device bridge** against any mount, although the guard
  reported itself INERT (exit 2) and the ban was therefore remembered rather than mechanical.

---

## CORRECTION 2026-10-09T03:5xZ - F21: `Merge-Pr` merged #2273 and then threw `squash-merge failed (exit 1)`, and a read-back taken after the merge reported the PR OPEN

**true at** `origin/main` **75ba9fad** - same run, written after the merge of #2273 landed. Added to
this file rather than filed separately: DOCTRINE 10.5, one artefact keeps one identity, and the 0115
breadcrumb's own correction (#2270) set the precedent for a finding that postdates its report.

### F21 - the merge primitive reported failure for a merge that succeeded

Sequence, all of it [MEASURED]:

1. `Assert-SmokedOrEscalate -PR 2273` -> `True True`, `ASSERT_OK=True`.
2. `Merge-Pr -PR 2273 -Actor station-00.sched0314` -> the enclosing tool call hit its 180 s cap
   while the script was still running, so no return value was read.
3. `gh pr view 2273 --json state,mergedAt,autoMergeRequest` (run from `C:\ProjectOperations2`)
   -> `{"autoMergeRequest":null,"mergedAt":null,"number":2273,"state":"OPEN"}`.
4. On that reading the merge was retried. `Merge-Pr` -> `MERGE_THREW: Merge-Pr: #2273 squash-merge
   failed (exit 1).`
5. `gh pr view 2273 --json number,state,mergedAt,mergeStateStatus` -> `state=MERGED`,
   **`mergedAt=2026-10-09T03:40:03Z`**.

So the merge landed at 03:40:03Z and **two instruments then disagreed with it**: a per-PR `gh pr
view` reported `OPEN`/`mergedAt:null`, and `Merge-Pr` reported a failed squash. Content read-back on
`origin/main` 75ba9fad confirms the merge was real and complete: rotation `last_index=1`, all three
breadcrumbs under `docs/pr-prompts/archive/`, the #2261 escalation correction present, this
breadcrumb present. The dev tree then fast-forwarded `6a0e7fca..75ba9fad` with all four readings
clean (`left-right 0 0`, `--numstat` EMPTY, `--cached` EMPTY, tracked `status --porcelain` EMPTY).

**This is DOCTRINE 1's table happening live** - *"`git commit` succeeded / the log looked clean"* -
with the polarity reversed, which is the rarer and more expensive direction. A false FAILURE on a
merge invites exactly what this run did next: retry a mutation that has already happened. Nothing
was damaged here because a squash of an already-merged PR fails closed, but the same false negative
on an arm or a branch update would not be harmless.

**One confound is named rather than hidden.** At step 4 the script's working directory was
`C:\po-sup-fix-scripts`, which is not a git repository; the same script printed `failed to run git:
fatal: not a git repository` for its own inline `gh pr view`, and `gh` resolves the repo from the
cwd. So the exit-1 squash at step 4 may be that cwd fault rather than a defect in `Merge-Pr`. **What
the cwd cannot explain is step 3**, which ran from `C:\ProjectOperations2` and still returned
`OPEN`/`null` for a PR already merged - either a stale GitHub read (DOCTRINE 9.4's family) or a
clock-ordering I cannot pin, because the tool-call timeout means I do not have a timestamp for step 3
precise enough to prove it followed 03:40:03Z.

**[CANNOT MEASURE]** which of the two it was. Separating them needs a merge driven with a known cwd
and a stamped read-back on each side, and this run had already merged.

**DISPOSITION: DEFERRED** - real, reproducible-in-principle, and not fixable from here. `Merge-Pr`
lives in `scripts/pipeline/pipeline-lib.ps1`, the **first entry on `instrument-lane.json`'s
NEVER-LIST**, so a station cannot merge a change to it - which is the whole of F16's story and the
reason #2261 is sitting on Marco's desk. Arming a prompt against that file would open a second
PR nobody can merge. What would make this urgent: any run reporting a merge it cannot confirm, or a
retry of a mutation on a false-negative reading.

**Cure available to every station now, needing no code change:** after `Merge-Pr`, believe the
**content read-back on `origin/main`**, not the primitive's return value and not a single `gh pr
view` - and run it from inside the repo. `Merge-Pr`'s own docstring already says *"never report a
merge you have not confirmed"*; this run shows the symmetric rule is also needed - **never report a
failure you have not confirmed.** Falsifying probe for the next run: drive one CLEAN docs PR to
merge with the script's cwd set to `C:\ProjectOperations2` throughout, and record whether
`Merge-Pr` returns `MERGED` or throws. If it returns `MERGED`, step 4 was the cwd fault and only
step 3 survives as a finding.

### Correction to this report's own WHAT CHANGED

Item 4 said *"this breadcrumb, and the board PR that carries all of the above"*. The board PR is
**#2273**, merged `2026-10-09T03:40:03Z`, `origin/main` now **75ba9fad**. The dev tree was
fast-forwarded to it and is clean on all four readings. The board lease taken at 03:28Z was released
by `Merge-Pr`'s own `finally` (a later `Exit-BoardLease` returned `False` because the lease was
already gone, and `Get-BoardLease` read `free`); a fresh lease was taken for this correction and is
released at the end of it. The `C:\po-wt\st00-0314` worktree was torn down, `git worktree remove`
exit 0, path confirmed absent.

### Correction to WHAT I DID NOT DO

That section said no merge was made. That was true when written, before #2273 was green. **#2273 was
merged** - this station's own docs-only board PR, inside its `docs/` lane, through
`Assert-SmokedOrEscalate` -> `Merge-Pr`, with CP-26 PASSing because a docs-only diff arms no receipt
requirement. **#2261 was still not merged, and no label was touched.** Every other line of that
section stands.
