# Station 00 — Supervisor | 2026-09-03T02:46Z–03:2xZ

## GROUND

```
UTC            2026-09-03T02:46:44Z
origin/main    f5c01415
dev tree       main @ 52f985e8 -> fast-forwarded to f5c01415   C:\ProjectOperations2
doc version    1   (origin/main copy; local copy was one commit stale, see M1)
bootstrap      1
```

Versions AGREE, so this run is READ-WRITE.

## WHAT I MEASURED

**[MEASURED] M1 — I was served a stale copy of my own station doc, and the preflight caught it.**
`git hash-object` against `git rev-parse origin/main:<path>` for the three binding docs:
`DOCTRINE.md` SAME, `STATION-CAPABILITIES.md` SAME, `stations/00-supervisor.md` **DRIFT**
(`f89dce27` local vs `4ff1a77f` on main). The drift is `#1519` — `station-contract v1 -> v2`,
which adds "load the tool schema before declaring blindness" to PREFLIGHT step 1. `station_doc_version`
is still `1` on both sides, so the version match proved nothing — exactly as the contract warns.
Nothing in the drift changes behaviour I had already taken.

**[MEASURED] M2 — ALL FOUR station tasks were DISABLED for 19 hours. This is the run's headline.**
From `C:\Users\Marco\AppData\Local\Claude\Logs\main1.log` (timestamps LOCAL = UTC+10):

```
2026-09-02 17:19:08  [ScheduledTasks] Disabled scheduled task: 00-supervisor
2026-09-02 17:19:09  [ScheduledTasks] Disabled scheduled task: 04-scanner
2026-09-02 17:19:11  [ScheduledTasks] Disabled scheduled task: 05-sot-keeper
2026-09-02 17:19:12  [ScheduledTasks] Disabled scheduled task: 03-machine-minder
2026-09-03 09:57:53  [ScheduledTasks] Enabled  scheduled task: 03-machine-minder
2026-09-03 09:58:03  [ScheduledTasks] Enabled  scheduled task: 04-scanner
2026-09-03 09:58:07  [ScheduledTasks] Enabled  scheduled task: 05-sot-keeper
2026-09-03 09:58:11  [ScheduledTasks] Enabled  scheduled task: weekly-security-audit
```

In UTC: **disabled 2026-09-02T07:19Z, re-enabled 2026-09-02T23:57–23:58Z — 16.6 h with no station
running at all.** Two things in that record matter more than the outage itself:

1. **`00-supervisor` was never re-enabled by that path.** It is absent from the enable block. The
   `scheduled-tasks` MCP nevertheless reports it `enabled: true`, `cronExpression 5 * * * *`,
   `lastRunAt 2026-09-03T02:45:35Z` — i.e. it came back at the app restart described in M3, from
   whatever `scheduled-tasks.json` held on disk, **not because anyone turned it back on**. A disable
   that only lives in memory is silently undone by a crash or an update; a disable that reaches disk
   is not. Which of the two you got is not observable from the UI.
2. **`weekly-security-audit` WAS re-enabled** (and ran at 2026-09-02T23:58:18Z). The standing note
   that it is "off deliberately" is now false. It looks like collateral of a bulk re-enable.

**[MEASURED] M3 — a second, separate outage: `CoworkVMService` stopped after an app self-update.**
`cowork_vm_node.log` first `Startup failed: VM service not running` at **2026-09-03 10:20:33 local
(00:20Z)**, 34 consecutive failures, `Startup complete` at **12:45:21 local (02:45Z)** — a **2.4 h**
window in which any station that did fire was BLIND. The chat lane's own breadcrumb (`00-06`, this
PR) records that it fixed it with a non-elevated `Start-Service CoworkVMService`; **no reboot was
needed**, despite the app's own message saying otherwise. The log runs back to 2026-08-21 and holds
only 53 startup events, the first failure being today's — so **the VM is NOT the cause of the 19 h
silence.** M2 is. Two independent outages, back to back, is why the gap looked like one thing.

**[MEASURED] M4 — freshness confirms the shape.** `node scripts/pipeline/check-breadcrumb.mjs
--freshness` -> exit **2**: `00 last 2026-09-02T06:09Z (20.7 h, cadence 2 h) SILENT`,
`04 last 2026-09-02T06:10Z (20.7 h, cadence 4 h) SILENT`, 03 and 05 `ok` only because their 24 h
cadence gives them a 48 h window. Structure: 3 checked, 0 malformed. The last 00 and 04 breadcrumbs
are 70 and 69 minutes before the disable — the silence starts exactly where M2 says it does.
Note the cadence table says 00 = 2 h; the live cron is **hourly** (`5 * * * *`). Harmless today
(hourly is stricter), but the two disagree.

**[MEASURED] M5 — the board is ONE PR, and it is Marco's.** `#1523`
`feat/scope-wbs-plant-columns`, BLOCKED, label `do-not-merge`. Watcher verdict, read from
`docs/pr-prompts/processed/`:
`[watcher] merge result for PR #1523: {"ok":false,"marco":true,"reason":"escalates:true - held for
Marco, labelled do-not-merge"}`. RULE-2 instrument controls on the same corpus, written without a
quote character: `-Pattern 'marco.:true'` POS **602**, breadth `marco` **1294**. **RULE 2 bars me
from merging it.**

**[MEASURED] M6 — `#1523`'s three reds are TWO causes, not three.** `gh pr checks 1523`:
`Approval receipt (CP-26)` fail 8s, `PR gates — diff checks` fail 8s, `tendering-e2e` fail 14m3s.
Job logs read, not the PR page:

- Both 8-second reds are the SAME assertion. The gates log passes CP-11/12/13/17/23/24/25, skips
  CP-09/10 and CP-22, then: `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label
  (escalates:true). A human must review and REMOVE the label; removing it is what releases the
  merge.]` and exits 1. CP-26 is now BOTH its own required check AND a step inside the gates job,
  so one label produces two required reds. **This is the designed state of a Marco-held PR, not a
  defect** — see F3 for what it costs.
- `tendering-e2e`: **163 passed, 1 skipped, 1 failed.** The one failure is
  `tests/e2e/pr-acceptance/batch3-scope-items.spec.ts:256 "plant pills: add a plant cluster, set
  qty/days, remove it (PRs #241, #72)"` — `Test timeout of 60000ms exceeded`, then
  `Error: apiRequestContext.fetch: Target page, context or browser has been closed` at
  `pr-acceptance/api-helpers.ts:65` (that second line is teardown, not the cause).

**[MEASURED] M7 — the failing e2e test is plausibly IN SCOPE for `#1523`, so it is not obviously a
flake.** `gh pr diff 1523 --name-only` returns exactly two files:
`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` and
`apps/web/src/pages/tendering/__tests__/wbs-plant-columns.test.tsx`. The failing test drives **plant
pills on scope items**; the diff moves the plant controls into the WBS row. Same feature area.
The reviewer's verdict (`docs/pr-reviews/pr-1523-review.md`, staged in this PR) says **MERGE** and
predicts e2e will be fine — it was written while e2e was still running. A review verdict is not
evidence a PR is green.

**[MEASURED] M8 — machinery is healthy.** `bring-up-to-speed.ps1` at 02:47Z: watcher node RUNNING
pid 26656, wrapper alive (1), clone `branch=main dirty=0`, heartbeat 1188 min but **armed = 0**, so
idle-not-wedged. `main` CI on `f5c01415` 4/4 green. Section 3 gate: 0 in-progress prompts, no
`index.lock` in either tree, 0 git processes, no PR touched in 2 min -> **SAFE TO ACT**. Two orphaned
worktrees remain (`C:/po-1483-fix` 24.5 h, `C:/po-work/s2-e2e` 26.6 h), both `dirty=0`.
The only lock anywhere is `.git/objects/maintenance.lock`, **0 bytes, 2 days old, no git process** —
STALE by the §7 test, and 03's to clear, not mine.

## WHAT CHANGED

1. **Fast-forwarded the dev tree**, `52f985e8 -> f5c01415`, `git merge --ff-only origin/main`.
   Read back with `git rev-parse --short HEAD` -> `f5c01415`. This discharges 06's F4.
2. **Re-ran `#1523`'s failed e2e job**, `gh run rerun 33697001238 --failed`. Read back: new job id
   `100504607724`, status `in_progress`. This is the doctrine's own first move on a possible flake,
   before diagnosing a defect.
3. **Opened this board PR** from a disposable worktree off `origin/main`
   (`C:\po-work\00-board-0303`, branch `docs/00-board-2026-09-03-0246`), never the interactive tree.
   It carries: 06's breadcrumb; the two `pr-vmguard-*-HOLD.md` slices Marco approved; four
   `docs/pr-reviews/` verdicts; the additive `.arming-log.txt` line for the 09-02T06:31:37Z arm;
   this breadcrumb; and the **deletion of `pr-cardui-s4-plant-columns-HOLD.md`**.
4. **Nothing was armed, no label was touched, nothing was merged.**

## FINDINGS

**F1 — Every station was off for 16.6 hours and the only detector was one of the stations that was
off.** M2 + M4. `check-breadcrumb.mjs --freshness` names a SILENT station correctly and exits 2 — but
**Station 00 is the only consumer of that exit code**, and Station 00 was the disabled task. The
pipeline cannot notice its own scheduler being switched off. Nothing here is a repo bug; every
component behaved as written. The gap is that "am I scheduled to run?" is asked only from inside a
run. Compounding it, M2(1): 00 returned to `enabled: true` **without anyone enabling it**, so the
live state also cannot be trusted to reflect anyone's intention.
**DISPOSITION: ESCALATED** — written to `needs-marco/` this run; the question and the RULE-1 ordering
of the options are in that file, not here.

**F2 — A `do-not-merge` PR now shows TWO required reds from one label, and the second one lies.**
M6. CP-26 is now a required check in its own right AND still a step inside `PR gates — diff checks`,
which exits the whole job on it. So `#1523` displays `PR gates — diff checks: fail` while
**every gate in that job passed** — the job name says the diff checks failed, and they did not. A
future reader diagnosing `#1523` from the check list, not the log, will go looking for a gate defect
that does not exist. The general rule this instance proves: **never fold a new assertion into
`pr-gates.mjs`; give it its own job**, or one cause reports as two and one of the two is misleading.
**DISPOSITION: DEFERRED** — the coupling is cosmetic while the board is one PR wide, and unpicking
it is a change to a required check, which is not a thing to do in the same run that discovers it.
It becomes urgent the moment a second held PR is open, because the misreading then costs a diagnosis
each time.

**F3 — `#1523` can never go green, by construction, and that is the design.** M5 + M6. It is
`escalates:true`, labelled `do-not-merge`, and CP-26 fails **because** the label is present;
removing the label is the documented clearance and **removing it is forbidden to me**. So the honest
statement of its state is not "red, needs fixing" but *"held for Marco; two of its three reds are
the hold itself."*
**DISPOSITION: ESCALATED** — it is Marco's to release. It is already in his queue by virtue of the
label; I have added nothing but this note, deliberately, rather than a second escalation file.

**F4 — `#1523`'s one real red is an e2e test in its own feature area.** M6 + M7. 163/165 passed;
the failure is the scope-items **plant pills** test timing out at 60 s, and the diff moves the plant
controls into the WBS row. The rerun in WHAT CHANGED is the discriminator: same test fails again ->
real regression in the slice, and the fix is mine; passes -> flake, and the PR is as green as a held
PR gets. **Whoever reads this next: the rerun's answer is on `#1523`, not in this file.**
**DISPOSITION: ACTIONED (rerun dispatched, result pending at write time)** — if it fails again the
next Station 00 run owns the fix under the ACTIVE DRIVE MANDATE; it is not an escalation and not
Marco's.

**F5 — the spent `pr-cardui-s4-plant-columns` prompt was still armable on `main`.** `#1523` consumed
it (`armed = 0`, no `-ready.md` on disk, a `processed/` log with the merge verdict) but `#1523`'s
diff is two source files — **it never retired its own HOLD**, so the HOLD sat on `main` able to build
a duplicate PR. This is the fourth instance of the same defect (`pr-gates-approval-receipt`,
`pr-cardui-s3`, `pr-schema-label-removal-is-marcos`, now this).
**DISPOSITION: ACTIONED** — the HOLD is deleted in this PR. The general fix (a queue check that
fails when a prompt is still tracked on `main` after its PR opened) remains unstaged and is named
again here so it is not lost.

**F6 — `weekly-security-audit` is running again and probably should not be.** M2(2). It was
re-enabled at 2026-09-02T23:58:11Z in the same bulk action as 03/04/05 and ran seven seconds later.
The standing record says it is off deliberately.
**DISPOSITION: ESCALATED** — folded into the F1 escalation file as a one-line question, because it
is the same act and Marco should answer both together rather than in two places.

**F7 — a packaged-app update can leave `CoworkVMService` stopped, and the app's own advice is a
reboot.** M3, and 06's F3. A reboot on this box takes down the watcher, Docker and every station;
a non-elevated `Start-Service CoworkVMService` fixed it in seconds. This is worth being written
where the next reader finds it *before* rebooting.
**DISPOSITION: DISPATCHED** — to Station 05, for an incident entry in `sot/05-decisions-and-lessons.md`.
Not mine to write: `sot/` is 05's alone.

**F8 — the freshness cadence for 00 (2 h) disagrees with its live cron (hourly).**
M4. Stricter in the safe direction today, so it hides nothing; but a cadence table that is wrong in
the *other* direction would hide a silent station, which is precisely what F1 is about.
**DISPOSITION: DEFERRED** — a one-line change, but it belongs with whatever answers F1, since the
answer may move the cadence anyway.

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is `#1523` and RULE 2 bars it (M5). I did not remove
  its `do-not-merge` label, and I never will.
- **Did not arm anything.** `pr-vmguard-s1` lints ADMIT and Marco approved the design, but arming is
  a `git mv` of a **tracked** HOLD and it is untracked until this PR lands. Arming is therefore next
  run's move, not this one's — which is also what 06's F1 asked for ("stage them"). `pr-vmguard-s2`
  is correctly `REJECT [GATE_NOT_RELEASED]` on a live gate and must not be armed at all yet.
- **Did not touch the three modified files I do not own**: `docs/data-model/metadata-catalog.json`,
  `pr-cardui-s8-waste-section-HOLD.md` (06 is mid-edit in it), `pr-rates-s11c-drop-legacy-tables-HOLD.md`.
- **Did not stage four other untracked items** — `pr-tfm-s10-guard-site-fallback-HOLD.md`,
  `pr-tfm-s11-copy-recursive-preserve-HOLD.md`, `docs/housekeeping/REPO-MAP-2026-09-02.md`,
  `superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`, and the
  `archive/review-escalations-516-1346/` directory. I did not write them and have not verified their
  premises; staging an unverified prompt is how something gets armed later on nobody's authority.
  **They are named here so the lane that wrote them can stage them — they are invisible otherwise.**
- **Did not clear `.git/objects/maintenance.lock`** (0 bytes, 2 days old, no git process). Stale by
  the §7 test, but clearing a lock is 03's and 00 has not dispatched it.
- **Did not prune the two orphaned worktrees** (`C:/po-1483-fix`, `C:/po-work/s2-e2e`, both clean,
  ~25 h old). Also 03's, and already on its existing clone-hygiene dispatch.
- **Did not touch `sot/`, Azure, Entra, SharePoint, or production data.**
- **Did not re-derive the Station 00 blindness escalation (#17).** M3 rules the VM outage out as its
  cause for this window, and M2 explains the whole gap without it. #17 is untouched, not discharged.
