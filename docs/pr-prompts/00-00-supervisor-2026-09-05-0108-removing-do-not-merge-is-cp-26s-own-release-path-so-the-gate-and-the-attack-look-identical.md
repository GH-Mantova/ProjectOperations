# Station 00 — Supervisor | 2026-09-05T01:08:56Z–2026-09-05T01:2xZ

## GROUND

```
UTC            2026-09-05T01:08:56.0274192Z
origin/main    b7daed3e   (was 42b30ba8 at sweep time; #1624 landed mid-run)
dev tree       main @ b7daed3e   C:\ProjectOperations2   (was b5efb5c9 — fast-forwarded this run)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run had full authority, not read-only.
Binding docs read from the working copy after proving it identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (PREFLIGHT step 2; no piped hash used).
Tree read in: the DEV tree `C:\ProjectOperations2`, never the watcher clone.

**NOT BLIND.** Desktop Commander loaded via `ToolSearch` first, then `start_process` shell
`powershell.exe` → PID 33244 / 17124. The first call returned a PowerShell *parser* error caused by
the `-Command` `$`-expansion layer (DOCTRINE §9.1) — that is the trap working exactly as §9.1
describes, not an unreachable machine.

## WHAT I MEASURED

**Board.** [MEASURED] `status-sweep.ps1` 01:10:58Z — OPEN PRs **5**: #1614 #1615 #1616 #1619 #1621,
every one of them RED, every one at the identical count `12 pass / 2 fail`. `armed: 0`.
`main CI on 42b30ba8: 4 success / 0 failed` (trunk green). Verdict **CAUTION**, on one cause only:
`LIVE STATION WORKTREE C:/po-vg`.

**The two reds are ONE cause, and the cause is my own label.** [MEASURED]
`gh run view 33934342363 --log-failed` on #1621 (LIMIT 6 — the log, never the diff):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
       (escalates:true). A human must review and REMOVE the label; removing it is
       what releases the merge.
FAIL - CP-26 do-not-merge   (inside "PR gates — diff checks")
```

Every other gate in that job PASSED or SKIPPED (CP-11, CP-12, CP-13, CP-17, CP-23, CP-24, CP-25).
So the known CP-26 → `PR gates` **coupling** is confirmed again: one cause, two reds. And the whole
board's redness is `do-not-merge`, which the 00:08Z run applied.

**Labels, read back per-PR** (`gh pr view N --json labels` → `ConvertFrom-Json`, never `--jq`):

| PR | mergeStateStatus | auto-merge | labels |
|---|---|---|---|
| #1614 | BEHIND | false | `do-not-merge` |
| #1615 | UNKNOWN | false | `do-not-merge` |
| **#1616** | BLOCKED | false | **[] — STRIPPED** |
| #1619 | BLOCKED | false | `do-not-merge` |
| #1621 | BLOCKED | false | `do-not-merge` |

[MEASURED] issue timeline for #1616 — the label has exactly two events in its whole life:

```
2026-09-04T23:11:53Z  labeled    do-not-merge  by=GH-Mantova
2026-09-05T00:49:45Z  unlabeled  do-not-merge  by=GH-Mantova
```

**CI churn, quantified.** [MEASURED] `gh run list --limit 200`, filtered to the last 60 minutes:
**72 workflow runs**, of which **48 are on the five blocked branches** (`fix/worktree-liveness…` 8+4,
`pr-crmui-chrome…` 6+3, `pr-crmui-relationships…` 6+3, `pr-crmui-comms…` 6+3, `pr-chargesteps…` 6+3).
#1621's branch created CI runs at 00:17:32Z, 00:31:31Z, 00:51:35Z, 01:11:31Z — one every ~18 min.
Two-thirds of this repository's entire CI spend, this hour, went on five PRs that **cannot** go green
while labelled.

**Releases since the 00:08Z run.** [MEASURED] `#1620` 23:49Z · `#1623` 00:47Z · `#1624` 01:10Z, all
`apps/web` / tendering feature work, all hand-classified **Marco's** under §10.1 step 2. #1623 and
#1624 were opened *and* merged inside the last hour.

**Collect.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**,
`CLEAN`; `structure: 2 checked, 0 malformed`. Crossed against `list_scheduled_tasks` `lastRunAt` as
the contract requires — **all four both fresh and aligned, no station SILENT**:

| station | newest breadcrumb | `lastRunAt` | reading |
|---|---|---|---|
| 00 | 2026-09-05T00:08Z | 2026-09-05T01:07:58Z | healthy (this run) |
| 03 | 2026-09-04T23:01Z | 2026-09-04T23:00:50Z | healthy |
| 04 | 2026-09-04T22:10Z | 2026-09-04T22:09:35Z | healthy |
| 05 | 2026-09-04T14:11Z | 2026-09-04T14:10:38Z | healthy — **05 is NOT stopped** |

No new 03/04/05 breadcrumb since the 00:08Z run; both breadcrumbs in the queue root were my own and
already collected. **Nothing was handed to me this cycle.**

**Machinery.** [MEASURED] watcher node **RUNNING pid 20000**, auto-restart wrapper alive (1),
heartbeat 23 min (ticks only mid-run; with `armed: 0` an idle watcher is CORRECT, not wedged).
`index.lock` false in both trees, git processes **0**, in-progress prompts **0**.
Watcher clone `branch=main dirty=7`.

**[CANNOT MEASURE] this run:** whether removing the label was Marco or an agent. The actor field
reads `GH-Mantova` for the watcher, for Marco's `gh`, and for me. That is escalation #22's identity
gap, and its fix is half-landed — `app-auth.mjs` reads `PO_WATCHER_APP_ID` / `PO_WATCHER_INSTALLATION_ID`
and nothing sets them (Machine and User env both empty). Applying them is production auth ⇒ Marco's
alone.

## WHAT CHANGED

1. **Dev tree fast-forwarded, `b5efb5c9` → `b7daed3e`.** The two breadcrumbs from my 23:08Z and
   00:08Z runs were sitting untracked at paths `main` now carries — the documented FF blocker. Proved
   both byte-identical to the committed blobs (`git rev-parse origin/main:<path>` vs
   `git hash-object <path>`, never a piped hash): `131e4182` = `131e4182`, `aa00be8c` = `aa00be8c`.
   Staged set EMPTY, `git diff --numstat` EMPTY. Then `Remove-Item` (never `git clean`, never
   `git checkout .`) and `git merge --ff-only origin/main`.
   **Read back:** `git rev-list --left-right --count HEAD...origin/main` → `0	0`.
2. **This breadcrumb + one `needs-marco/` escalation written.** No prompt armed, no label added or
   removed, no PR merged.

## FINDINGS

### F1 — Removing `do-not-merge` IS CP-26's own documented release path, so the gate being honoured and the gate being defeated are the SAME observable event

My 00:08Z run filed this as *"an actor is stripping the do-not-merge gate one PR at a time"* and
escalated it as an attack. **Reading CP-26's log this run makes that headline unsafe.** The gate's own
failure text says, in the imperative: *"A human must review and REMOVE the label; removing it is what
releases the merge."* An unlabel event at 00:49:45Z by `GH-Mantova` is **byte-for-byte what a correct,
sanctioned human release looks like.** I cannot distinguish it from an agent defeating the gate, and
neither can any later reader — which is §9.6 with a merge button attached, and this time the empty
world is *"whose decision was that?"*.

One thing my 00:08Z escalation got outright **wrong** and I am correcting rather than leaving to be
re-derived: it said *"a label cannot hold against anything with PR-write scope; it needs a REQUIRED
CHECK."* **It already has one.** CP-26 is its own required check run (ruleset-added 2026-09-02,
#1492), and this run measured it doing exactly its job — the label mechanically pins the PR red. The
gap is not that the label lacks teeth. The gap is that **the release leaves no signature.**

CP-26 already ships a second release path that *does* leave one: commit
`docs/decisions/merge-approvals/<N>.md` carrying `pr:`, `approved_by:`, `approved_at:` and a written
reason. That path is attributable, timestamped and in git history forever. Label removal is none of
those things, and today the weaker path is sufficient on its own.

**I did not re-apply the label to #1616, and that was a decision, not an oversight.** Three reasons:
the removal is indistinguishable from Marco exercising his own documented authority, and overriding
that would breach RULE 3; the 00:08Z run already escalated this and re-fighting it unanswered is the
"do not loop" case (DOCTRINE §5.6); and re-labelling now has a **measured** cost — see F2. Four of the
five PRs still carry the label. I merged nothing, so RULE 2 is not at risk from my side either way.

**DISPOSITION: ESCALATED** — options in
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`.

### F2 — The label gate and `PR_WATCHER_AUTO_UPDATE` compose into a permanent CI burn: 48 of 72 runs this hour

Neither half is a defect alone. `do-not-merge` correctly pins CP-26 red. `PR_WATCHER_AUTO_UPDATE`
correctly rebases BEHIND PRs. Together they mean every gated PR is rebased every ~18 minutes, fires a
fresh CI + Browser Smoke + CodeQL matrix, and that matrix is **structurally incapable of passing**
while the label is on. It will repeat until a human intervenes, and it cancels in-flight CI on the
way past (escalation #24's churn).

[MEASURED] 48 of 72 workflow runs in the last 60 minutes were on the five gated branches.
This is the first time the cost of #24 has been put in numbers, and it makes the case for the
`--force-with-lease`/re-fetch cure concrete rather than theoretical.

**DISPATCHED → 03-machine-minder.** `PR_WATCHER_AUTO_UPDATE` is the watcher's own configuration and
its lane, not mine. Handing over: the setting reads `"true"` against a documented default of OFF;
`pollForBehindPrs()` rebases on a timer; the measurement above is the cost. 03's next occurrence is
2026-09-05T23:00Z.

### F3 — `#1621`, which fixes the false CAUTION verdict, is itself held red by the label

The sweep's only reason for CAUTION is `LIVE STATION WORKTREE C:/po-vg` — dirty=1, age 1037 min, a
worktree already established as not live (#1602). #1621 is titled *"a dirty worktree pinned LIVE
forever and froze the board safe-to-act gate"*: it is the fix. It touches `scripts/`, so it
hand-classifies as **Marco's** under §10.1 step 2 and I may not merge it regardless. But it is worth
saying plainly that the board's stale CAUTION and the fix for that CAUTION are blocked by the same
label, so every station will keep reading CAUTION until F1 is answered.

**DISPOSITION: DEFERRED** — becomes urgent the moment a station needs a SAFE verdict to act on
something time-critical. Nothing this run needed one.

### F4 — Watcher clone is `dirty=7` on main

[MEASURED] `status-sweep.ps1` §2: `watcher clone: branch=main dirty=7 <-- NOT clean-on-main; the
watcher may refuse to start`. Not corrupt — no `MERGE_HEAD`, no rebase, no unmerged paths, no
`index.lock`, and the watcher is running fine on pid 20000. Read-only git in that tree is all I am
permitted and all I did.

**DISPATCHED → 03-machine-minder** (clone hygiene is its lane; ABSOLUTE rule — 00 never runs
mutating git in `C:\po-watcher\ProjectOperations`).

### F5 — Board collect: nothing was handed to 00 this cycle

Freshness CLEAN, all four stations cross-checked against `lastRunAt` and aligned, no breadcrumb from
03/04/05 newer than my last run. Recorded so the next run does not re-derive it. **05 is healthy —
do not report it as a stopped station.**

**DISPOSITION: ACTIONED** (collect performed; nothing to disposition).

## WHAT I DID NOT DO

- **Did not re-apply `do-not-merge` to #1616.** F1 gives the reasoning. This is the one judgement in
  this run a later reader should challenge first if they disagree.
- **Did not remove any label, and did not merge any PR.** All five open PRs are hand-classified
  Marco's — four `apps/web`, one `scripts/` — under §10.1 step 2, recorded as
  **[NO LANE VERDICT — hand-classified]**. RULE 2 binds; a `rev-<N>-ready.md.log` is a REVIEW JOB and
  carries no lane information.
- **Did not arm anything.** `armed: 0` and nothing's gates are cleared. The three
  `pr-crmui-{chrome,comms,relationships}-s1-…-HOLD` prompts stay unarmed — #1614/15/16 already carry
  that work.
- **Did not author an approval receipt** for any PR. No agent may ever author
  `docs/decisions/merge-approvals/<N>.md`. F1 proposes making that file *mandatory*, which makes the
  standing rule more load-bearing, not less.
- **Did not restart the watcher.** pid 20000 alive, wrapper alive, `armed: 0` — an idle watcher with
  an empty queue is correct, not wedged. `restart-watcher-if-wedged.ps1 -Fix` was not run.
- **Did not touch `C:/po-vg`, prune any worktree, or run mutating git in the watcher clone.**
- **Did not clear the `[STALE]` lines on `agent-authored-rule-2-clearance-2026-09-04.md`.** Its
  `[LIVE]` refs #1614/#1615/#1616 are its subject and are still open.
- **Did not re-escalate #23** (00's cron is hourly, `check-breadcrumb.mjs` records its cadence as 2h,
  so SILENT needs four misses). Open and unanswered; carried, not re-raised.

## FALSIFYING PROBE FOR THIS REPORT

F1 and F2 both rest on *"the label is the sole cause of the red"*. #1616 was unlabelled at
00:49:45Z; its 00:49:30Z CI run started 15 seconds earlier and still saw the label, so the first
honest test is the run created at **01:11:37Z**, which was in progress when this was written.

```
gh run list --branch pr-crmui-relationships-s1-four-panels --limit 4 --json createdAt,conclusion,name
```

**If that CI run concluded `success`, the label was the sole cause and F1/F2 stand as written.
If it concluded `failure`, there is a second cause on that branch and F2's cost figure still stands
but F1's "structurally incapable of passing" must be narrowed to the four PRs that are still
labelled.** Re-run it before quoting either finding.
