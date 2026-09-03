# Station 00 — Supervisor | 2026-09-03T16:09Z–2026-09-03T16:5xZ

## GROUND

```
UTC            2026-09-03T16:09:05Z
origin/main    607d5436            (fetched, then rev-parse)
dev tree       main @ 607d5436     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Version match, so this run is READ-WRITE. **SIGHTED** — `start_process` shell `powershell.exe`
returned PID 26452 on the first call. This was not a blind run.

Freshness of the three binding docs was proved by CONTENT, not by version: for each of
`00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md`, `git hash-object <path>` equals
`git rev-parse origin/main:<path>` (`a2640ab2` / `ea91409d` / `eeaaf877`, `same=True` on all three).
All three were then read in full from that verified-clean tree.

## WHAT I MEASURED

- `[MEASURED]` **Sweep verdict: SAFE TO ACT.** `status-sweep.ps1` 16:09:56Z and 16:10:37Z. Both
  instrument positive controls passed (`gh` saw merged #1548; `node` runs). No board mutation in
  progress, no remote activity inside 2 min, no live station worktrees.
- `[MEASURED]` **Trunk green.** main CI on `607d5436`: 4 success / 0 failed / 0 running.
- `[MEASURED]` **Board: 4 open PRs, and all four are Marco's.** RULE-2 probe run with its controls
  from `docs/pr-prompts/processed/`: `-Pattern 'marco.:true'` → **606**, negative control
  `zzzNoSuchTokenZzz` → **0**, so the instrument is calibrated.

  | PR | state | CI | lane verdict |
  |---|---|---|---|
  | #1544 | UNKNOWN | 14 pass / 0 fail | **no verdict — hand-classified** |
  | #1543 | CLEAN | 14 pass / 0 fail | `marco:true` — *outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs* |
  | #1541 | CLEAN | 14 pass / 0 fail | `marco:true` — *outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs* |
  | #1536 | BLOCKED | 12 pass / **2 fail** | `marco:true` — *escalates:true, labelled do-not-merge* |

- `[MEASURED]` **#1544 is `[NO LANE VERDICT — hand-classified]`.** `Select-String` for
  `merge result for PR #1544` over `processed/*.log` returned **0 lines** against the calibrated
  probe above. Files: `.claude/agents/{00..05}*.md`, `docs/pipeline/STATION-CAPABILITIES.md`,
  `scripts/pipeline/lint-station.mjs`, `scripts/pipeline/next-sweep.mjs`. Paths outside
  `^(tests|docs)/` are present, so by `classifyPolicyFiles` it is **MARCO'S**. Recorded as a
  hand-classification, never as "not routed to Marco".
- `[MEASURED]` **#1544's `mergeable=UNKNOWN` is a stuck cache, not a conflict — re-confirmed.**
  `git merge-tree --write-tree origin/main origin/fix/agent-defs-double-encoded` → **exit 0**;
  positive control on #1543's branch → **exit 0**.
- `[MEASURED]` 🔴 **#1536's TWO reds have exactly ONE cause, and it is a label.** Read from the job
  logs, not the PR page (`gh run view 33772515991 --job …`):
  - job `100706046268` *Approval receipt (CP-26)*:
    `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
    (escalates:true). A human must review and REMOVE the label; removing it is what releases the
    merge.`
  - job `100706045805` *PR gates — diff checks*: `PASS` on CP-11, CP-12, CP-13, CP-17, CP-22,
    CP-23, CP-24, CP-25 — **every substantive gate passes** — then
    `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label …]` and exit 1.

  So the CP-26↔`PR gates` coupling already recorded in the board notes is confirmed live: **one
  cause, two red required checks.** #1536 carries no code defect that CI can see.
- `[MEASURED]` **Freshness (`check-breadcrumb.mjs --freshness`, exit 2):** `00` 1.0h ok · `02`
  dispatch-only · `03` 41.2h ok · `04` 6.0h ok · `05` **50.0h SILENT**.
- `[MEASURED]` **Crossed against `lastRunAt` (scheduled-tasks MCP), which the breadcrumb cannot
  see:**

  | station | `lastRunAt` | newest breadcrumb | reading |
  |---|---|---|---|
  | 00 | 2026-09-03T16:08:43Z | 15:09Z | healthy (this run) |
  | 04 | 2026-09-03T14:10:20Z | 09-03T10:10Z | fired, produced nothing — the 529 already recorded at 15:09Z |
  | 05 | 2026-09-03T14:11:26Z | 09-01T14:11Z | fired 2 h ago, produced nothing — same 529 |
  | 03 | **2026-09-01T23:01:43Z** | 09-01T23:02Z | 🔴 **`lastRunAt` older than one cadence ⇒ the 09-02T23:00Z occurrence NEVER FIRED**; `nextRunAt` 2026-09-03T23:00:45Z |

  Note the shape: **03 prints `ok` while having missed a whole occurrence**, and **05 prints
  `SILENT` while having run two hours ago.** Neither word describes what happened.
- `[MEASURED]` **Machinery SAFE.** watcher node RUNNING pid **24744**; auto-restart wrapper alive
  (1); heartbeat 231 min (ticks only mid-run — stale + empty queue is idle, not wedged);
  `index.lock` false/false; **0** git processes; guard hook present. Watcher clone `branch=main
  dirty=3` — the three are **untracked review files**, so `rescue-watcher-repo.ps1` must NOT be run.
- `[MEASURED]` **armed (`*-ready.md`): 0.** needs-marco 13 · no-pr-opened 109 · failed 41 ·
  blocked 90.
- `[MEASURED]` **Left for 03:** 3 orphaned worktrees (`C:/po-1483-fix` 2270 min, `C:/po-sa-fix`
  632 min, `C:/po-work/s2-e2e` 2399 min) and 2 registry escapees (`C:\po-worktrees\fix-1523`,
  `C:\po-worktrees\vs-s2-durable-smoke`) — **all `dirty=0`**.
- `[MEASURED]` 🟢 **The project index's own "17.1 KB hard read limit, tail silently dropped" claim
  did NOT reproduce this run.** `MEMORY.md` is **23,163 bytes**, and the copy injected into this
  session ended on the file's true last line (`THE MATERIALISE SEQUENCE … "confirm the node process
  before any arming decision"`), verified by reading the last 6 lines off disk and comparing. So on
  this path, this run, the whole 23.1 KB arrived. This does **not** license growing the index — the
  claim may hold on another reader — but runs have been spending effort making the index
  byte-negative against a threshold that was not biting.
- `[MEASURED]` **Nothing to collect.** `check-breadcrumb.mjs` structure pass: **2 checked, 0
  malformed** — both are my own (1310, 1509), both already dispositioned and merged in #1547/#1548.
  No 03/04/05 breadcrumb has appeared since my 15:09Z run.

## WHAT CHANGED

**On the board: nothing.** No PR merged, no PR touched, no label added or removed, no prompt armed
or disarmed, no process restarted. The only mutation this run is this breadcrumb and the archiving
of the 1310 one, landed as a docs-only PR from a disposable worktree at `C:\po-wt\bc-1609`.

## FINDINGS

### F1 — #1536 is substantively green; one label is the entire red

Every diff gate passes. Both failing required checks are the same CP-26 `[LABEL_PRESENT]`
assertion, and the fix named in the log is *"a human reviews the PR and removes the `do-not-merge`
label"*. No agent may author `docs/decisions/merge-approvals/1536.md` or any other approval file,
and removing the label is Marco's alone — so there is no half of this an agent can take.

This also **corrects** the earlier board note that read #1536's red as *"a missed caller"*. That may
have been true at an older head; at `33772515991` it is not the cause, and reading it as one sends
the next run looking for code work that does not exist.

**DISPOSITION: ESCALATED** — Marco: #1536 needs a review and a label removal, nothing else. It is
already in his queue; what is new is that its cost is one click, not a debugging session.

### F2 — 03-machine-minder missed an entire occurrence and the detector said `ok`

`lastRunAt` 2026-09-01T23:01:43Z against a 24 h cadence means the 09-02T23:00Z occurrence never
fired at all, while `--freshness` printed `41.2h ago (cadence 24h) ok` because its alarm is at 2x.
This is the already-filed detector defect, now with a second worked instance.

**DISPOSITION: ESCALATED** — no new file. `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
already carries the options and the threshold question; this run adds the instance, not a new ask.
03 is scheduled to fire again at 23:00:45Z tonight — if it does, this self-heals; if it does not,
that is two consecutive misses and the ask sharpens.

### F3 — 05-sot-keeper has not reported for 50 h and will not run again for 22 h

It fired at 14:11:26Z today and produced nothing (the 529-on-turn-one already recorded at 15:09Z),
and `nextRunAt` is 2026-09-04T14:10:37Z. Stated plainly: **`/sot/` has had no keeper since
2026-09-01T14:11Z**, and a single transient 529 costs a full day of that coverage with no retry.

**DISPOSITION: ESCALATED** — same file as F2; this is the consequence half of that escalation, and
it is the reason the threshold question is worth Marco's time rather than being left to decay.

### F4 — 3 orphaned worktrees and 2 registry escapees, all clean

`C:/po-1483-fix`, `C:/po-sa-fix`, `C:/po-work/s2-e2e`, plus `C:\po-worktrees\fix-1523` and
`C:\po-worktrees\vs-s2-durable-smoke`. Every one reports `dirty=0`, so nothing is at risk in them.
Pruning is machine work and it is not mine.

**DISPOSITION: DISPATCHED → 03-machine-minder.** Re-confirm `dirty=0` per tree at the time you act
(`git status --short` in each — the sweep's reading is a `[LIVE]` sample, not a state), then prune.
Also standing for you: the watcher clone's `dirty=3` is **untracked review files** — do not run
`rescue-watcher-repo.ps1` on it.

### F5 — the index's own size limit is not what the index says it is

Measured above: 23,163 bytes injected intact. Runs have been compacting `MEMORY.md` against a
17.1 KB ceiling that did not apply on this path.

**DISPOSITION: ACTIONED** — the index note is corrected in project memory this run to say what was
measured and on which path, so the next run does not either (a) shave a live finding to hit a
threshold that is not biting, or (b) assume the tail is safe on a reader that has not been tested.

### F6 — the board is one human's queue, and arming makes it longer

Four PRs open, four Marco's, zero armed. Every lane out of the board that touches anything outside
`tests/` or `docs/` stops at him, and `#1543` shows how tight that prefix is — a **test file** under
`scripts/pipeline/__tests__/` is outside `tests/` and routes to Marco on the path prefix alone.
Arming more work now lengthens a queue that cannot drain.

**DISPOSITION: DEFERRED.** It becomes urgent the moment Marco clears the four, or the moment a
docs-only prompt exists whose landing unblocks something else. armed=0 is a decision this run, not
an omission.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs are Marco's — three by live watcher verdict, one by
  hand-classification. RULE 2 forbids the first three; §10.1 rule 2 forbids the fourth.
- **Did not touch #1536's `do-not-merge` label, and did not author an approval receipt.** Both are
  Marco-only, and the second is a standing absolute.
- **Did not arm any prompt.** See F6 — deliberate, not overlooked.
- **Did not restart or kill anything.** The watcher is RUNNING with a live wrapper; heartbeat age on
  an empty queue is idle, not wedged.
- **Did not prune the worktrees or the escapees** — dispatched to 03 (F4).
- **Did not run `rescue-watcher-repo.ps1`** on the clone's `dirty=3` — untracked review files.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, production data, or the watcher clone's git.**
- **Did not open a new `needs-marco/` file** for F2 or F3. The existing escalation already asks the
  right question; a second file would split one thread in two.
