# Station 00 — Supervisor | 2026-09-03T08:06Z–2026-09-03T08:30Z

## GROUND

```
UTC            2026-09-03T08:08:13Z
origin/main    5072f3f6 at open -> 0edff318 after this run merged #1537
dev tree       main @ 5072f3f6     C:\ProjectOperations2  (fetch --prune; local == origin/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — READ-WRITE. **SIGHTED**: `start_process` (powershell.exe) returned PID 26736 on the
first attempt after the Desktop Commander schemas were loaded. The MCP server spent ~60s in
`connecting` and `ToolSearch` returned "no matching deferred tools" twice before it came up — that is
an unloaded/still-connecting schema, **not** blindness (station doc PREFLIGHT step 1). Retrying the
search was the correct move and it is worth doing before anyone declares a blind run.

Sweep verdict: **SAFE TO ACT** (`bring-up-to-speed.ps1`, 08:09:10Z — no board mutation in progress,
no git lock, 0 git processes, no PR touched in 2 min, no live station worktrees).

Concurrency: `list_scheduled_tasks` shows `00-supervisor` cron `5 * * * *`, `lastRunAt`
2026-09-03T08:06:38Z (**this run**), `nextRunAt` 09:07:52Z. No second supervisor was on the board at
any point in this run — unlike the 07:06Z run.

## WHAT I MEASURED

**The board at 08:09Z.** [MEASURED] `gh pr list --state open --json ...`, assign-then-foreach
(DOCTRINE 9.4), `count=3`:

| PR | state | created | labels | lane |
|---|---|---|---|---|
| #1538 | CLEAN | 07:58:47Z | none | board PR, `board/00-2026-09-03-0756-collect` — **no watcher lane** |
| #1537 | CLEAN | 07:47:40Z | none | watcher, `pr-visualreview-s1`, **inside its merge wait** |
| #1536 | BLOCKED | 07:21:22Z | `do-not-merge` | watcher, `escalates:true` — **Marco's** |

**RULE 2 probe, with its positive control.** [MEASURED] in `docs/pr-prompts/processed/`:
`Select-String -Pattern 'merge result for PR #153[78]'` -> **0**;
positive control `Select-String -Pattern 'marco.:true'` -> **604**;
second control, a verdict that does exist ->
`[watcher] merge result for PR #1536: {"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
The probe is calibrated and returns empty for #1537/#1538.

**Lane classification (DOCTRINE 10.1).** #1537 was opened by the watcher — proven by
`[2026-09-03T07:47:54.459Z] [merge] pr-visualreview-s1-...: opened PR #1537, policy=tests-docs, waiting…`
— so its empty verdict means "still in flight", not "cleared". Its 2 files are both
`docs/pipeline/stations/*.md` -> `classifyPolicyFiles` OK, not Marco's.
#1538 has **[NO LANE VERDICT — hand-classified]**: 1 file,
`docs/pr-prompts/00-00-supervisor-2026-09-03-0756-...md`, inside `docs/` -> not Marco's.

**#1537's checks were all green at 07:49:16Z.** [MEASURED] `gh pr checks 1537 --json name,state,completedAt`:
14 checks, every one SUCCESS or SKIPPED, latest `completedAt` 2026-09-03T07:49:16Z. It then sat
open for 28 minutes with nothing enabling auto-merge.

**The auto-merge lane has fired FOUR times in its life, and not once since 2026-08-24.**
[MEASURED] in `C:\po-watcher\watcher-launch.log`:
`Select-String -Pattern 'policy satisfied'` -> exactly 4 lines, `#1176` (2026-08-18T03:15:01Z),
`#1295` (08-24T00:10:30Z), `#1297` (08-24T00:41:33Z), `#1301` (**08-24T02:41:33Z, the last**).
Positive control on the same file: `Select-String -Pattern 'policy=tests-docs, waiting'` -> **153**.
So 153 PRs entered the lane and 4 were ever enabled for auto-merge by it.

**`[merge] PR #N merged at ... (policy: tests-docs)` does NOT mean the lane merged it.**
[MEASURED, source] `index.mjs:1801-1803` emits that line the moment a poll observes
`state === "MERGED"`, whoever merged. [MEASURED, GitHub] `#1531`, `#1534` and `#1301` all report
`autoMergeRequest = null` and `mergedBy = GH-Mantova` (the shared token account, which does not
discriminate the watcher from Station 00). **This is the instrument that produced the current
project-memory claim that the lane "fired for the first time since #1301" on 2026-09-03.**

**Why the lane cannot fire, structurally.** [MEASURED, source]
`waitForPolicyMerge` (`index.mjs:1759-1849`) enables auto-merge only at `:1826`:
`if (!mergeEnabled && allGreen && (await verdictApproves(prNumber, policyPrFiles)))`.
`verdictApproves` (`:1414-1430`) reads `<REPO_ROOT>/docs/pr-reviews/pr-<N>-review.md`, requires
`^VERDICT:\s*MERGE\b`, and its `catch` returns **false** when the file is absent. There is no
"no review required" path.
That file is written by the `rev-<N>-ready.md` review job, which the watcher enqueues **after**
opening the PR and **behind itself**:
`[07:50:19Z] [review] enqueued review for PR #1537 -> rev-1537-ready.md` /
`[07:50:19Z] [queue] rev-1537-ready.md (depth: 1, busy, source: watch)`.
The watcher is single-lane (`watcher-launcher-singlelane.ps1`) and is blocked inside the wait for up
to `MERGE_TIMEOUT_MS` = 90 min (`index.mjs:129-130`). [MEASURED] `Test-Path
C:\po-watcher\ProjectOperations\docs\pr-reviews\pr-1537-review.md` -> **False**, and the newest
review files there are `pr-1529`, `pr-1526`, `pr-1523` — none for #1531/#1534/#1537.
[MEASURED] the only worker activity between 07:47:54Z and 08:18:25Z was the 5-minute
`verdict-archive sweep` heartbeat. **The condition for merging can only be satisfied by the job the
merge wait is blocking. That is a deadlock, and it times out at 90 minutes into
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}`.**

**Consumed prompts still tracked as `-HOLD.md` on `origin/main` — the general probe, with a control.**
[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered to depth-1
`*-HOLD.md` -> **83**; intersected by basename with the 1857 `processed/*-ready.md.log` stems -> **4**
hits. But the naive intersection **over-reports**: cross-checking each HOLD's last commit date on
`main` against its processed log separates a hazard from a deliberate re-stage.

| stem | HOLD last commit on main | processed log | verdict |
|---|---|---|---|
| `pr-tfm-s10-guard-site-fallback` | 2026-09-03T04:18:58Z (#1527) | 2026-08-18T10:07:51Z | **re-staged after consumption — LEAVE** |
| `pr-unified-api-key-vault-slice4c-retire-old-screens` | 2026-08-24T01:24:56Z (#1300) | 2026-08-13T19:49:06Z | **re-staged after consumption — LEAVE** |
| `pr-visualreview-s1-restore-vision-review-to-00` | 2026-09-03T04:18:58Z (#1527) | 2026-09-03T08:18:29Z | **stale — RETIRE** |
| `pr-wbsshift-s2-api-pricing-reads-shift` | 2026-09-03T05:58:45Z (#1530) | 2026-09-03T07:22:53Z | **stale — RETIRE** |

**The rule the queue check must encode: a tracked `-HOLD.md` is a re-arm hazard only when its
processed log is NEWER than the commit that last wrote the HOLD.** Basename intersection alone
scores 4 where the truth is 2 — a 50% false-positive rate, and two of the four are prompts a
previous run deliberately restored.

**Neither #1537 nor #1536 deletes its own HOLD.** [MEASURED] `gh pr view <n> --json files`:
#1537 touches `docs/pipeline/stations/00-supervisor.md` and `02-board-driver.md` only; #1536 touches
five `apps/api/src/modules/tendering/**` files only. This is the 6th and 7th PR to leave its own
consumed prompt armable on `main`.

**Station cadences.** [MEASURED] `list_scheduled_tasks`: all five tasks **enabled**.
`03-machine-minder` `lastRunAt` 2026-09-01T23:01:43Z, `nextRunAt` 2026-09-03T23:00:45Z;
`05-sot-keeper` `lastRunAt` 2026-09-01T14:11:31Z, `nextRunAt` 2026-09-03T14:10:37Z. Each MISSED
exactly one daily run — the 09-02 one, inside the already-escalated 16.6h all-stations-disabled
window. `check-breadcrumb.mjs --freshness` exits **0** / `CLEAN` (03 at 33.2h and 05 at 42.0h are
both under the 2x-cadence silence threshold), so **the freshness detector does not see a single
missed run** — only a second consecutive one.

**Machinery.** [MEASURED, sweep 08:09:10Z] watcher node RUNNING pid 26656, wrapper alive (1),
heartbeat 0 min, main CI on 5072f3f6 4 success / 0 failed. Watcher clone `branch=main dirty=1`.
Three orphaned worktrees (`C:/po-1483-fix` 1789 min, `C:/po-sa-fix` 151 min, `C:/po-work/s2-e2e`
1917 min, all `dirty=0`) plus one registry escapee `C:\po-worktrees\fix-1523` (0KB, 153 min,
`.lock=False`).

## WHAT CHANGED

1. **Merged #1537** at 2026-09-03T08:17:41Z, merge commit `0edff318`, via
   `Assert-SmokedOrEscalate -PR 1537` then `Merge-Pr -PR 1537` (both returned True).
   **Read back:** `gh pr view 1537 --json state,mergedAt,mergeCommit` -> `state=MERGED
   mergedAt=2026-09-03T08:17:41Z sha=0edff318c32c25461580ba9c968891dd92c65eb7`.
   **Effect proved:** the watcher's next poll wrote
   `[watcher] merge result for PR #1537: {"ok":true}` into
   `processed/pr-visualreview-s1-restore-vision-review-to-00-ready.md.log` — **not** `marco:true`.
   Merging inside the window is what stopped a false human gate being minted at 09:17:54Z.
   The lane then drained: `[08:18:29Z] [ok] pr-visualreview-s1-...-ready.md -> processed/`,
   `[08:18:30Z] [worktree] reclaimed orphan worktree .../vs-s1`, `[08:18:30Z] [start] rev-1537-ready.md`.
2. **#1538**: `gh pr update-branch 1538` (it had gone BEHIND when #1537 landed), then
   `Merge-Pr -PR 1538 -Auto`. **Read back:** `state=OPEN mergeState=BLOCKED autoMergeRequest=enabled`
   — auto-merge is ARMED, the PR is NOT yet merged. Do not read "armed" as "landed".
3. **Retired two consumed prompts** to `docs/pr-prompts/superseded/` in this PR (see FINDINGS F3).
4. Disposable worktree `C:\po-worktrees\00-0808` created off `origin/main` for this PR and torn
   down at the end of the run.

Nothing was armed this run. Nothing in `/sot/` was touched. No watcher process was restarted.

## FINDINGS

### F1. The `tests-docs` auto-merge lane is DEADLOCKED and has been since 2026-08-24. The evidence that "refuted" lane occupancy was an instrument lie.

Measured above. The lane requires a MERGE verdict from a review job that the same single-lane worker
cannot run while it is blocked waiting for that verdict. It has enabled auto-merge 4 times ever, last
on #1301 on 2026-08-24, against 153 entries into the wait. The `[merge] PR #N merged at ...
(policy: tests-docs)` line is emitted on *observing* a merge (`index.mjs:1801-1803`) and is not
evidence the lane did it; `autoMergeRequest=null` on #1531/#1534 confirms it did not.

This **refutes the current standing note** that lane occupancy was disproved by four docs-only PRs
auto-merging on 2026-09-03. Those PRs were merged by Station 00, by hand, inside its own runs. The
note tells every future run "DO NOT CHASE IT"; that instruction is built on a misread log line and
should be reversed.

It also revises escalation #21. The CI-creation-latency cause (#1500: first CI run created 212.6 min
after the PR opened, against a 90 min window) is real and measured, but it is **not** the operative
cause today — #1537's checks were all green 86 seconds after it opened and the lane still did not
fire. **Two independent causes produce the same byte-identical `marco:true` timeout string.**

**DISPOSITION: ESCALATED.** The fix is a change to `scripts/pr-watcher/**` merge ordering; the
choice between the options below is a design call and the safety properties differ. Question and
options are in `docs/pr-prompts/needs-marco/tests-docs-lane-deadlock-2026-09-03.md` and repeated in
full below so they survive the gitignore.

**THE QUESTION FOR MARCO.** The `tests-docs` lane exists to land docs and tests work with no human.
It cannot currently do that, and every attempt costs 90 minutes of the single lane and then mints a
`marco:true` that RULE 2 correctly refuses to clear. Which fix?

**(A) Run the review job BEFORE entering the merge wait.** The watcher opens the PR, runs
`rev-<N>` to completion so `docs/pr-reviews/pr-<N>-review.md` exists, and only then calls
`waitForPolicyMerge`. *RULE 1: passes both halves.* Complete — every future docs/tests PR can fire
the lane, and the 90-minute lane occupancy disappears with it. Additive — the MERGE verdict is still
required, still produced by the reviewer, still guarded by `validateVerdict`'s cites-files check. No
gate is weakened and no data path changes. **This is the complete-and-additive option; I recommend it.**

**(B) Give the review job its own worker/lane.** Complete — both jobs can run. But it reinstates a
second concurrent actor writing `docs/pr-reviews/` and the queue, which is the LL-38 shape the
single-lane launcher was adopted to remove. *Fails the "without damaging" half* by adding a
concurrency hazard to fix a sequencing bug.

**(C) Drop `verdictApproves` from the tests-docs condition — green checks alone auto-merge.**
Immediate and small. *Fails the "without damaging" half*: docs would land with nobody having read
them, which DOCTRINE 10.3 already names as the cost of hand-landing.

**(D) Do nothing; Station 00 keeps hand-merging docs PRs inside the window (what it did today).**
*Fails the "future" half of RULE 1*: it works only while a supervisor happens to be awake inside a
90-minute window, and every miss permanently human-gates a docs PR.

**This does not replace the DISTINCT-REASON fix you already chose for #21** — it makes it more
urgent. With two causes producing the identical string, a reader cannot tell a CI-latency timeout
from a deadlock timeout from a genuine policy routing. Whichever of A-D lands, the timeout reason
must still name which of the three it was.

### F2. `#1537` would have been falsely human-gated in 59 minutes. It was not, because it was merged inside the window.

Direct consequence of F1, recorded separately because it is the operational rule, not the defect.
**Standing rule confirmed by measurement:** when a watcher-opened docs/tests PR is CLEAN and green
and the watcher is in `policy=tests-docs, waiting...`, Station 00 should merge it rather than let the
window expire — the watcher's poll then records `{"ok":true}` and no false gate is created. Merging
it also releases the lane immediately. The ordering rule still binds: **the PR inside the window is
merged FIRST**; merging any other PR ahead of it puts it BEHIND, `PR_WATCHER_AUTO_UPDATE=true`
rebases it, its checks go to zero and the timeout becomes certain.

**DISPOSITION: ACTIONED.** Merged, read back `state=MERGED`, and the `{"ok":true}` verdict is quoted
above as the proof.

### F3. Two consumed prompts were still tracked as `-HOLD.md` on `main`; two more look like it and are NOT.

Retired in this PR to `docs/pr-prompts/superseded/`:
`pr-visualreview-s1-restore-vision-review-to-00-HOLD.md` and
`pr-wbsshift-s2-api-pricing-reads-shift-HOLD.md`. Both were consumed today (#1537, #1536), neither
PR deletes its own prompt, so any `git checkout .` / `reset --hard` / fresh clone would have re-armed
them. `superseded/` preserves the file — nothing is deleted.

**LEFT ALONE, deliberately:** `pr-tfm-s10-guard-site-fallback-HOLD.md` and
`pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md`. Both match the naive
"tracked HOLD with a processed log" probe, and both are **deliberate re-stagings** committed AFTER
their consumption (#1527 and #1300 respectively). Retiring them would have undone a previous run's
repair. The date cross-check is what separates them; without it this probe is 50% wrong.

**DISPOSITION: ACTIONED** for the two retirements.

### F4. The permanent queue check for F3 is still unstaged, and it needs the date cross-check.

Memory has carried "the prompt still tracked on main after arming" as an unstaged queue check for
several runs. This run supplies its algorithm and its calibration: intersect depth-1 `-HOLD.md` on
`origin/main` with `processed/*-ready.md.log` basenames, then **keep only those whose processed-log
time is NEWER than `git log -1 --format=%cI origin/main -- <hold path>`**. Positive control: today
that returns exactly the two retired above and correctly rejects the two re-staged ones.

🔴 It must be a **standalone script**, not a new assertion inside `pr-gates.mjs` — CP-26 failing
already takes `PR gates - diff checks` down with it, and folding more into that file couples more
reds to one cause.

**DISPOSITION: DISPATCHED -> Station 06 (PR Master)**, to stage as a prompt. Same dispatch as the
four DOCTRINE §9 drift findings Station 04 raised; fold them into one staging pass if 06 prefers.

### F5. Station 03 and Station 05 each missed exactly one daily run, and `--freshness` cannot see it.

[MEASURED] both tasks are ENABLED with correct next-run times; the missed run for each falls inside
the already-escalated 16.6h all-stations-disabled window
(`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`).
`check-breadcrumb.mjs --freshness` exits 0 because it only flags at **2x** cadence, so a single
missed daily run is invisible to the one detector we have. 03 does not run again until
2026-09-03T23:00Z and it is carrying the whole machine backlog (clone `dirty=1`, three orphaned
worktrees, the `C:\po-worktrees\fix-1523` registry escapee, the `ensure-watcher.ps1`-not-in-repo
question).

**DISPOSITION: DEFERRED.** It is the tail of an escalation Marco already has, and both stations run
again today. What would make it urgent: a **second** consecutive miss by either — at that point
`--freshness` will finally fire, which is exactly the "the detector only reports after the second
failure" weakness the existing escalation is about. Not re-escalated; it belongs in that file.

### F6. Machine hygiene: watcher clone dirty, three orphaned worktrees, one registry escapee.

[MEASURED, sweep 08:09:10Z] `watcher clone: branch=main dirty=1`; orphaned worktrees `C:/po-1483-fix`
(1789 min, dirty=0), `C:/po-sa-fix` (151 min, dirty=0), `C:/po-work/s2-e2e` (1917 min, detached HEAD,
dirty=0); registry escapee `C:\po-worktrees\fix-1523` (0KB, 153 min, `.lock=False`). All three
worktrees are `dirty=0`, so nothing is at risk of loss, but none of them is mine and 00 does not
prune another station's leftovers (LL-38).

**DISPOSITION: DISPATCHED -> Station 03 (Machine Minder)**, folded into the existing clone-hygiene
dispatch rather than raised as a new one. Note for 03: you do not run again until 2026-09-03T23:00Z.

### F7. Answer sheet, explicitly.

- **Q1 DIRTY PRs: ZERO.** #1538 was BEHIND (a rebase, not a conflict) and is now auto-merging; #1536
  is BLOCKED by its own `do-not-merge` label, which is a policy block, not a conflict. No PR on this
  board has frozen CI.
- **Q2** — no conflict exists, so nothing to escalate and no `pr-zzz-resolve-all-dirty-prs` prompt is
  needed.
- **Q3 armed count, counted myself:** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` returned
  **3** at 08:12Z — `pr-visualreview-s1-...-ready.md` (in flight, since consumed at 08:18:29Z),
  `rev-1537-ready.md` and `rev-1538-ready.md`. The two `rev-*` are auto-generated REVIEW JOBS, not
  prompts (DOCTRINE 9.5) — **real armed prompt count: 1, now 0.**
- **Q4** — every claim I carried in from memory was re-probed. One failed: see F1, the "lane fired
  again" claim is false.
- **Q5 silent no-ops:** `no-pr-opened/` holds 109 and the newest is 2026-09-02T13:47Z
  (`pr-cardui-s3-manpower-columns`), which pre-dates my last run and was dispositioned then. **No new
  silent no-op this run.**
- **Q6 the single most important thing blocking progress:** the `tests-docs` lane cannot merge
  anything, so every docs and tests PR needs a supervisor awake inside a 90-minute window or it is
  permanently human-gated (F1).

## WHAT I DID NOT DO

- **Armed nothing.** `pr-visualreview-s2-keep-the-screenshots-HOLD.md`'s gate released the moment
  #1537 landed (08:17:41Z) and it is the obvious next arm, but the lane was mid-run on `rev-1537`
  and then `rev-1538` when this run ended, and RULE 4 is one at a time. Left for the 09:07Z run,
  which should re-lint it against the new `origin/main` rather than trust this sentence.
- **Did not merge #1536.** It is `escalates:true`, labelled `do-not-merge`, and the watcher recorded
  `marco:true` for it. Marco removes the label **and** authors `merge-approvals/1536.md`; no agent
  may ever write that receipt.
- **Did not touch the two re-staged HOLDs** (F3) — retiring them would have reverted #1527 and #1300.
- **Did not prune any worktree or touch the watcher clone** (F6) — Station 03's.
- **Did not touch `/sot/`**, Azure/Entra/SharePoint, or production data.
- **Did not commit** `docs/data-model/metadata-catalog.json`, `docs/pipeline/sweep-rotation.json`,
  `docs/pr-prompts/.arming-log.txt`, `pr-cardui-s8-waste-section-HOLD.md` (Station 06 is mid-edit on
  it), `pr-rates-s11c-drop-legacy-tables-HOLD.md`, or the untracked `Claude outputs/` directory in
  the repo root — all dirty in the shared dev tree and none of them mine. This PR was built in a
  disposable worktree off `origin/main` precisely so none of them could be swept in.
