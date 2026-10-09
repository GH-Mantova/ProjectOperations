# #2261 needs your release, and the thing that staged it never checked whether a station could ever merge it

**Raised by** Station 00 (scheduled), 2026-10-07T03:3xZ, at `origin/main` **83470c08**.
**Subject PR: #2261** — `fix(pipeline): make Invoke-GitPush -WorkTree mandatory and fail loud
(GITPUSH_WORKTREE_MANDATORY_V1)`. Head `a5a3d9bc`. One file: `scripts/pipeline/pipeline-lib.ps1`,
+19 −1. Now labelled `do-not-merge` by Station 00 so your queue line counts it.

## The question, in one line

**Do you want to release #2261 yourself, and do you want the never-list consulted before a prompt
like it is ever staged again?**

## What is true

[MEASURED] `gh pr checks 2261` → 13 pass, 2 fail. The CP-26 job log names its own cause:

```
FAIL - CP-26 approval-receipt [RECEIPT_REQUIRED_BY_DIFF] PR #2261 touches files that require an
approval receipt (outside tests/ or docs/: scripts/pipeline/pipeline-lib.ps1), but
docs/decisions/merge-approvals/2261.md is not in this PR's diff against merge-base with origin/main.
```

[MEASURED] `scripts/pr-gates/standing-lanes.json` on `origin/main` has exactly two lanes, `sot`
and `instrument`. [MEASURED] `scripts/pipeline/instrument-lane.json` on `origin/main` lists
`pipeline-lib.ps1` as the **first entry on its NEVER-LIST**, with the reason written beside it:
*"the core library all scripts depend on"*.

So neither receipt form is open to a station: `authority: standing` has no lane that admits this
file, and `authority: personal` requires that you released it — the label removed, or "release this"
said in chat. **This is the gate working as designed.** A station writing either receipt would be
forging its own release past a CI check built to make that impossible.

The second red, `tendering-e2e`, is a separate matter and is **not** what is blocking this PR: four
tests in `pr-acceptance-batch1-dashboards` failed, the nine previous real e2e runs (#2240–#2251) all
passed, and #2261's one PowerShell file cannot reach that suite. It is written up as F2 in this
run's breadcrumb with its falsifying probe. Station 00 deliberately did not re-drive #2261's CI: a
13-minute e2e rebuild buys nothing while the merge is blocked on a human.

## Question 1 — #2261 itself

**RULE 1, complete-and-additive first.**

**(a) Review it and release it, and keep the never-list as it is.** Remove the `do-not-merge` label
and the next Station 00 run commits `docs/decisions/merge-approvals/2261.md` with
`authority: personal` and merges it through `Assert-SmokedOrEscalate` → `Merge-Pr`.
*Solves it immediately* — the fix lands. *Solves it for the future* — the never-list keeps doing its
job, which is to make sure the core library every script depends on is never changed without you
looking. *Damages nothing* — no data entry, existing or future, is touched; the change is 19 lines
in a PowerShell helper. **This is the option that passes both halves.**

**(b) Close it unmerged and have the fix re-staged against a file that is in the lane.** Fails the
*complete* half: the defect F10 recorded — `Invoke-GitPush` defaulting to a non-existent worktree
and still printing a plausible SHA — lives in `pipeline-lib.ps1`, so there is nowhere else to fix
it. It would also leave the prompt needing an explicit `superseded/` home (F6 in the breadcrumb).
Nothing about it is additive; it is the same work deferred.

**(c) Add `pipeline-lib.ps1` to `instrument-lane.json` so stations can merge it in future.** Fails
the *without damaging the future* half, and badly. The never-list exists because that file is the
one every board operation runs through; putting it in the lane means a station could change the
merge primitive and then merge its own change with it. `instrument-lane.json` is yours by its own
terms — any change to it places a PR outside the lane. Listed only so the trade-off is on the record,
not as a recommendation.

## Question 2 — the staging gap (`STAGING_DID_NOT_CONSULT_THE_NEVER_LIST_V1`)

#2261 is here because an earlier cycle staged `pr-gitpush-worktree-mandatory-HOLD.md` (#2257) and
Station 00 armed it. The prompt was admissible, the watcher built it, 13 of 15 checks went green —
and **no station could ever have merged it**, because nothing in the staging or arming path reads
`instrument-lane.json`'s never-list.

Per occurrence the cost is small: one build, one 13-minute e2e, one PR in your queue. But it is
silent, and it will recur for every self-repair that touches `pipeline-lib.ps1`, `arm-prompt.ps1`,
`retire-escalation.mjs`, `dispatch.mjs`, or anything under `scripts/pr-watcher/` or
`scripts/pr-gates/` — which is the class of fix this pipeline writes about itself most often.

Station 00 has **already done the additive half** in the same PR as this file: one line in the ARM
bullet of `docs/pipeline/stations/00-supervisor.md` telling the arming station to read the
never-list first and to say in its breadcrumb that the resulting PR will need you. That is a
remembered rule, and DOCTRINE §9.2 records remembered rules as having failed seven times.

**The mechanical half is yours to choose:**

**(a) Gate it at `lint-prompt.mjs`: a prompt whose stated target files are all on the never-list is
REJECTed at admission, with a message saying it needs Marco's release and should be staged as an
escalation rather than armed.** *Complete now* — no such prompt reaches the board again.
*Complete in future* — it is mechanical, not remembered, and it reads the never-list rather than a
copy of it, so the two cannot drift. *Additive* — it adds a reject path; it changes no existing
admission, arms nothing differently, and touches no data. **This is the option that passes both
halves.** It needs your word because `lint-prompt.mjs` and the gate boundary are yours, and because
a new reject code changes what the watcher admits.

**(b) Leave it at the documented rule Station 00 just landed, and accept the occasional wasted
build.** Fails the *future* half for the reason above: it is a remembered rule in a pipeline whose
own doctrine records that remembered rules fail. Honest cost if you pick it: roughly one wasted
build plus one queue item each time an instrument fix lands on a never-listed file.

**(c) Make the never-list advisory and let stations merge with a new lane key.** Fails *without
damaging the future* for the same reason as Question 1(c), and it moves the question from "was this
reviewed" to "which list was current". Listed for completeness only.

## What Station 00 did and did not do about this

Did: labelled #2261 `do-not-merge` under the board lease, read back `labels=do-not-merge`, released
the lease; landed the documented ARM-bullet line; filed this.
Did not: write a receipt of either kind; remove any label; re-run or update-branch #2261; touch
`instrument-lane.json`, `standing-lanes.json`, `lint-prompt.mjs`, or anything under `scripts/pr-gates/`.

Full measurements, with commands and controls, are in this run's breadcrumb:
`docs/pr-prompts/00-00-supervisor-2026-10-07-0314-2261-targets-a-never-listed-file-so-no-station-can-ever-clear-its-cp26-gate.md`
(F1 and F4).

---

## CORRECTION 2026-10-09T03:2xZ - the label came OFF at 02:47:10Z, so the blocker changed shape: this is no longer RECEIPT_REQUIRED_BY_DIFF, it is RELEASED_NO_RECEIPT

**true at** `origin/main` **6a0e7fca** - raised by the Station 00 scheduled run of 2026-10-09T03:14Z.

### What changed

[MEASURED] `gh api repos/GH-Mantova/ProjectOperations/issues/2261/timeline --paginate`, parsed with
node (no `--jq`, per DOCTRINE 9.4), full `labeled`/`unlabeled` history for `do-not-merge`:

```
labeled   | do-not-merge | GH-Mantova | 2026-10-07T03:25:55Z
unlabeled | do-not-merge | GH-Mantova | 2026-10-09T02:47:10Z
```

[MEASURED] `gh pr view 2261 --json number,state,mergeStateStatus,headRefOid,labels,files` ->
`state=OPEN`, `labels=[]`, `mergeStateStatus=BEHIND`, `headRefOid=a5a3d9bc`, one file
`scripts/pipeline/pipeline-lib.ps1`. In-band positive control: the same instrument returned
`do-not-merge` for this PR on 2026-10-07, and the parse above returns both events rather than a
blanket empty.

[MEASURED] CP-26's verdict token, read verbatim from job `113645296569` of run `37876207430`
(started 02:47:19Z, i.e. triggered by the unlabel, against the unchanged head `a5a3d9bc`):

```
FAIL - CP-26 do-not-merge [PR #2261 was labelled do-not-merge and released, but
docs/decisions/merge-approvals/2261.md is not in this PR's diff against merge-base with
origin/main. Commit the receipt on the PR branch so the approval leaves an authored,
reviewable artefact.]
```

So the token this file was opened on - `[RECEIPT_REQUIRED_BY_DIFF]` - is **spent**. The live
reading is the released-without-a-receipt one. The two reds are still two reds with one cause
(`Approval receipt (CP-26)` and `PR gates - diff checks`, which runs CP-26 as a step).

[MEASURED] the watcher's own pre-merge verdict is still valid for this exact head:
`gh pr view 2261 --json comments` -> one comment, `VERDICT: MERGE`,
`REVIEWED-SHA: a5a3d9bcd1ee052f4d69ed493ed9b6aadae5c2...` = the current `headRefOid`. Nothing has
been pushed to the branch since the review.

### Question 1 of this file is therefore ANSWERED in the direction of option (a) - except for the signature

Option (a) read: *"Remove the `do-not-merge` label and the next Station 00 run commits
`docs/decisions/merge-approvals/2261.md` with `authority: personal` and merges it."* The label is
off. **This run did not write that receipt, and no scheduled run should.**

The binding reason is already filed as
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`, whose
option **(C)** - *"authorise a scheduled run to author `approved_by: marco` from the `unlabeled`
timeline event alone"* - is recommended **against** on the ground that
`docs/decisions/merge-approvals/README.md` records the event as unattributable: both the watcher
(which applies the label) and Marco (who removes it) authenticate as `GH-Mantova`. Writing it
anyway is the one thing CP-26 exists to prevent.

### What this run ADDS, and it narrows the attribution without closing it

The 2026-09-24 file could say only *"unattributable"*. This instance can say more, because the
local-agent session directories timestamp every station run:

[MEASURED] session directories under
`...\local-agent-mode-sessions\9df6923b-...\6662b30d-...\`, scanned at depth with no name filter
(DOCTRINE 9.5 - the name format changed 2026-09-15, and `list_sessions` reports `running` long
after a session stops):

| session dir | created (UTC) | newest file write (UTC) | which run |
|---|---|---|---|
| `425d4aa4` | 2026-10-09T02:10:14 | 2026-10-09T02:21:38 | Station 04 |
| `0143207f` | 2026-10-09T02:14:34 | **2026-10-09T02:45:57** | Station 00 (wrote the 0214 and 0245 breadcrumbs) |
| `a198f187` | 2026-10-09T03:14:35 | 2026-10-09T03:22:25 | **this run** |

**The unlabel at 02:47:10Z falls in a gap with no live station session**: 04's had been dead for
26 minutes and Station 00's stopped writing 73 seconds earlier. [MEASURED]
`docs/pr-prompts/.arming-log.txt` last line is `2026-10-07T02:30:35Z ... actor=station-00`, so the
supervised interactive lane (`station-00.interactive-NNNN`) has left no trace since
2026-09-24T20:21Z. And [MEASURED] the watcher clone's log directory
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs` holds **no `2026-10-09.log` at all**
(newest is `2026-10-08.log`), so the watcher has written no line today in either the UTC or the
Brisbane-local reading of the date.

**[CANNOT MEASURE]** whether the watcher process (pid 8848, RUNNING) removed the label without
logging it. The recursive probe of `C:\po-watcher` for a heartbeat file timed out at 180 s and was
not retried, so no heartbeat content was read; the only heartbeat figure available is
`status-sweep.ps1`'s `heartbeat age: 31 min` at 03:15:40Z, which is a derived age and not a log
line. That branch stays open.

**[INFERRED]**, and labelled as such: with no station session alive, no interactive-lane trace for
15 days, and no watcher log line today, the most probable actor is Marco at 12:47 Brisbane time.
**That is an inference, and an inference is not a receipt.** It is recorded because it eliminates
the "a station cleared its own gate" branch for this instance, which is the branch CP-26 is built
to catch - not because it licenses a signature.

### What Marco needs to do, and it is one of two things

**RULE 1, complete-and-additive first.**

**(a) Leave the release word somewhere a headless run can read.** Either commit
`docs/decisions/merge-approvals/2261.md` yourself with `authority: personal`, or post a one-line
comment on #2261 (`released: 2261`). *Complete now* - the next Station 00 run merges #2261 through
`Assert-SmokedOrEscalate` -> `Merge-Pr` on the strength of an artefact that carries an author and a
timestamp. *Complete in future* - it is the same move for every release, and it is exactly option
(A) of the 2026-09-24 file, so answering here answers that file too. *Additive* - it adds a record;
it removes no gate, changes no admission path, and touches no data entry. **This is the option that
passes both halves.**

**(b) Say the word in chat to the supervised interactive lane and let it write the receipt.** Fails
the *future* half: it works only while that lane is awake, it has left no trace for 15 days, and a
scheduled run meeting the next released PR has no move except to stop again - which is the third
time this pipeline has recorded that stall.

**(c) Authorise a scheduled run to write `approved_by: marco` from the `unlabeled` event.** Fails
*without damaging the future*, for the reason the 2026-09-24 file already gives and this run's
measurements do **not** overturn: eliminating the station branch by inference is not the same as
attributing the act, and a gate that accepts an inference cannot tell your approval from an
agent's. Listed so the trade-off is on the record, not as a recommendation.

### Question 2 of this file - the staging gap - is UNCHANGED and still open

Nothing in this correction touches `STAGING_DID_NOT_CONSULT_THE_NEVER_LIST_V1`. The documented
ARM-bullet half is on `main`; the mechanical half at `lint-prompt.mjs` is still your call.

### What this run did and did not do about #2261

Did: measured the timeline, the live labels, the CP-26 token for the current head, the watcher
verdict and its `REVIEWED-SHA`, and the session windows; wrote this correction.
Did not: write a receipt of either kind; remove, add or re-apply any label; merge; run
`gh pr update-branch`; re-run CI; or touch `instrument-lane.json`, `standing-lanes.json`,
`lint-prompt.mjs` or anything under `scripts/pr-gates/`.

**Deliberately did NOT re-park it.** Re-applying `do-not-merge` would undo a release that is
probably Marco's, and the 2026-09-24 file records two such re-parks two seconds apart being read
as a programmatic write for weeks afterwards. A PR left released with its cause named is honest;
a PR silently re-parked by a station is not.

### Falsifying probe

Re-ask `gh pr view 2261 --json state,labels,mergedAt` and re-read CP-26's verdict token from the
newest run. `[LABEL_PRESENT]` means it was re-parked and this correction is spent (DOCTRINE 9.4
classes that state as parked-by-design). `PASS` means a receipt landed and #2261 is Station 00's to
merge. `[RELEASED_NO_RECEIPT]` means nothing has changed and the question above is still open.
Note the control: use `--json number,state`, never `--json number` alone - see F18 of
`docs/pr-prompts/00-00-supervisor-2026-10-09-0314-*.md`, which measured that `gh pr view 999999
--json number` exits **0** and echoes the number without reaching the API.
