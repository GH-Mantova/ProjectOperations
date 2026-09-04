# Station 00 — Supervisor | 2026-09-04T14:08:13Z–2026-09-04T14:3xZ

## GROUND

```
UTC            2026-09-04T14:08:13Z
origin/main    b31a242a            (git fetch origin --prune, then git rev-parse --short origin/main, run in the DEV TREE)
dev tree       main @ 69ae2a4e  ->  main @ b31a242a  C:\ProjectOperations2   (fast-forwarded this run, see F1)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

**Tree the binding documents were read in:** `C:\ProjectOperations2` (the dev tree), never the
watcher clone. `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
before any edit, so the working copies read were byte-identical to `origin/main`. No piped hash was
used anywhere in this run (PREFLIGHT step 2).

## WHAT I MEASURED

- **[MEASURED] Not blind.** `start_process` shell `powershell.exe` returned a live prompt on the
  first call after a keyword `ToolSearch` for `desktop-commander`. PID 21724, then 10188.
- **[MEASURED] Sweep.** `scripts/pipeline/status-sweep.ps1`, `2026-09-04 14:09:11Z`–`14:09:35Z`,
  199 lines, section 0 controls both pass (`gh` reached GitHub — saw merged #1597; `node` runs).
  Verdict **CAUTION**, sole reason: one "LIVE STATION WORKTREE" `C:/po-vg` (see F4).
- **[MEASURED] Board — 3 open PRs, all CLEAN, all green (14 pass / 0 fail / 0 pending each):**
  **#1594** heartbeat wiring · **#1593** `arm-prompt` requires `-Actor` · **#1589** gate paths with
  spaces. `main` CI on `b31a242a`: 4 success / 0 failed / 0 running — **trunk green**.
- **[MEASURED] Armed prompts: 0.** Counted directly, not quoted:
  `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → none. Queue: needs-marco 16 · no-pr-opened
  109 · failed 41 · blocked 117.
- **[MEASURED] Watcher HEALTHY.** `scripts/restart-watcher-if-wedged.ps1` (no `-Fix`):
  `VERDICT: OK - nothing armed and the watcher is alive.` node pid **20000**, wrapper alive (1),
  restart churn 0 cycles in 20 min, heartbeat age 49 min — which with an empty queue is **idle, not
  wedged** (the heartbeat only ticks mid-run).
- **[MEASURED] Breadcrumbs — nothing new to collect.** `node scripts/pipeline/check-breadcrumb.mjs
  --freshness` → **CLEAN, exit 0**; structure 4 checked, 0 malformed. All four breadcrumbs in the
  queue root are **this station's own** (1109, 1209, 1230, 1307). No 03 / 04 / 05 breadcrumb has
  appeared since the 13:07Z run, and none is unarchived. **No other station's finding is waiting.**
- **[MEASURED] Freshness crossed against `lastRunAt`** (scheduled-tasks MCP, per the station doc's
  three-instrument table — `--freshness` alone cannot name a cause):

  | station | newest breadcrumb | `lastRunAt` | reading |
  |---|---|---|---|
  | 00 | 2026-09-04T13:07Z | 2026-09-04T14:07:53Z | this run — aligned |
  | 03 | 2026-09-03T23:02Z | 2026-09-03T23:01:39Z | aligned; next 2026-09-04T23:00:45Z |
  | 04 | 2026-09-04T10:11Z | **2026-09-04T14:09:32Z** | **fired 99 s into this run — still executing** |
  | 05 | 2026-09-03T21:54Z | **2026-09-04T14:10:38Z** | **fired 165 s into this run — still executing** |

  Both 04 and 05 read "fresh `lastRunAt`, no breadcrumb yet", which is row 2 of the table — but here
  the innocent explanation fits every signal: they started minutes ago and have not finished. **This
  is not a SILENT station and must not be dispositioned as one.**
- **[MEASURED] Dev-tree index is not shared-dirty.** `git diff --cached --name-status` **EMPTY** and
  `git diff --name-only` **0 lines** before and after every mutation this run.
- **[MEASURED] No new escalation since the last run.** Newest file in `docs/pr-prompts/needs-marco/`
  is `agent-authored-rule-2-clearance-2026-09-04.md`, written by the 13:07Z run (its 14:12Z mtime is
  this run's fast-forward re-materialising it, not a new write).

## WHAT CHANGED

1. **The dev tree was fast-forwarded, `69ae2a4e` → `b31a242a`.** Read back:
   `git rev-list --left-right --count HEAD...origin/main` → **`0  0`**; `git rev-parse --short HEAD`
   → `b31a242a`; unstaged 0, staged 0. The one file removed to make room was restored byte-identical
   by the merge (`git hash-object` = `6e786cd3…`, the same blob `git rev-parse origin/main:<path>`
   names).
2. **This PR** adds one section to `docs/pipeline/stations/00-supervisor.md` (36 insertions, 0
   deletions — an addition, not a rewrite) and this breadcrumb. `node scripts/pipeline/lint-station.mjs`
   → **ADMIT: all 8 docs clean, exit 0**, so the `station-contract v2` canonical block is untouched.
3. **Nothing else.** No prompt armed, no PR merged, no label touched, no watcher restarted.

## FINDINGS

### F1 — the dev tree could not fast-forward, and the cause was NOT the recorded one

**[MEASURED]** `git merge --ff-only origin/main` in `C:\ProjectOperations2` failed with
`error: The following untracked working tree files would be overwritten by merge:
docs/pr-prompts/00-00-supervisor-2026-09-04-1307-…md`. That path is **this station's own breadcrumb
from the 13:07Z run**: written untracked into the dev tree, then committed to `main` by its own board
PR **#1597**. The tree was otherwise perfectly clean — `git diff --numstat` EMPTY, `git diff --cached
--name-status` EMPTY — so no instrument that looks for a *modification* saw anything at all.

**[MEASURED] This refutes the standing diagnosis.** The recorded cause was a `.gitattributes`
line-ending smudge. On this run the smudge was **absent** (numstat empty) and the fast-forward still
refused, on the untracked-breadcrumb cause alone. Both readings can be true on different days; what
is not true is that the smudge is *the* explanation. **Read the error text — it names the file.**

**[INFERRED] Why it keeps costing runs:** it is structural and it recurs every single cycle. Any
station that writes a breadcrumb into the dev tree and then lands that path in a PR leaves an
untracked file exactly where the next fast-forward must write. Four consecutive 00 runs have
re-diagnosed it from scratch.

**DISPOSITION: ACTIONED.** Fast-forwarded (read-back above), and the cure written into
`00-supervisor.md` in this PR — prefer writing the breadcrumb inside the run's own PR worktree (which
this run does, and which makes the failure impossible), else prove the disk copy byte-identical to the
committed blob and delete it. The general fix for all seven stations belongs in the `station-contract`
canonical block and is deliberately **not** taken here; see F5.

### F2 — "13 arms published nowhere" is REFUTED; the defect behind it stands

**[MEASURED]** The falsifying probe DOCTRINE §9.5 names for its own bullet:
`git show origin/main:docs/pr-prompts/.arming-log.txt` → **50 lines**; the working copy → **50
lines**. They now **agree**. #1597 swept the log in, so the 13-arm gap closed on its own.

**[INFERRED]** The *defect* is untouched: nothing commits `.arming-log.txt` on purpose, so the four
commits that ever carried it were board PRs that happened to sweep it up. A clone still reads an arm
history that is stale by however long it has been since a board PR last landed. The DOCTRINE §9.5
bullet's quoted counts (37 vs 50) are now **state, not law** — it names this probe precisely so the
counts can die without the bullet dying.

**DISPOSITION: DEFERRED.** The escalation
`needs-marco/arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md` already carries it and is
open with Marco. What would make it urgent: an arm that matters landing in a window with no board PR
behind it. **Do not quote the 13.**

### F3 — THREE stations were live at once, not two. The collision is wider than recorded.

**[MEASURED]** `lastRunAt` from the scheduled-tasks MCP: `00-supervisor` **14:07:53Z**,
`04-scanner` **14:09:32Z**, `05-sot-keeper` **14:10:38Z** — **all three inside 165 seconds.** Their
crons are independent (`5 * * * *` hourly, `0 */4 * * *`, `10 0 * * *` local) and the overlap is
arithmetic, not chance: every fourth hour 00 and 04 coincide, and once a day 05 joins them.

**[INFERRED]** The open escalation
`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` names **two** stations. It is three.
The blast radius is bounded today only because 04 is read-only and 05 is confined to `/sot/` behind
CP-24 — but 00 is the one station that mutates the board, and the sweep's own safe-to-act gate
(section 3) is a **point measurement**: it read `in-progress prompts 0 / git processes 0 / no PR
touched in 2 min` at `14:09:11Z`, which is *during* 04's launch. A clean section 3 does not mean no
other station is about to start.

**[MEASURED]** It did not bite this run: `git diff --cached --name-status` was EMPTY before and
after every mutation, and both mutations (the fast-forward, and this PR from an isolated worktree)
touched files no other station's lane covers.

**DISPOSITION: ESCALATED** — amending the existing escalation rather than opening a second one, since
a duplicate escalation is how one gets ignored. **The question for Marco is a scheduling one, not a
diagnosis:** the three crons were each set sensibly on their own and nothing reconciles them.
- **(a) Offset the three cadences so they cannot coincide** (e.g. 00 at :05, 04 at :25, 05 at :45).
  *Complete* — it removes the overlap for every future occurrence, not just today's — and *additive*:
  no station's cadence, contract or authority changes, and no data-entry path is touched. **RULE 1:
  passes both halves. This is the option to take.**
- **(b) Leave it and rely on lane discipline.** Fails *complete*: the overlap recurs every four hours
  and the only thing standing between it and LL-38 is that the other two stations happen not to
  mutate the board today. It is additive (nothing changes), so it fails one half, not both.
- **(c) Make 00 stand down when another station's `lastRunAt` is inside N minutes.** Fails *complete*
  in a way worth naming: `list_sessions`' `running` flag is already known not to clear (DOCTRINE
  §9.5), and a stand-down keyed on a signal that never goes false livelocks the station it protects —
  that exact failure has already happened twice.

### F4 — `C:\po-vg` pins the sweep to CAUTION every single run

**[MEASURED]** Section 7 of the sweep returns **CAUTION** for one reason: `C:/po-vg` is classified
`LIVE STATION WORKTREE` (dirty=1, age **376 min**, branch `fix/no-rebase-while-checks-run`). It is
not live. Its only content is `scripts/pipeline/check-pipeline-heartbeat.mjs`, and that file is on
`main`: `git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → **exit 0**,
negative control on a nonexistent path → **exit 128**.

**[INFERRED] The second-order harm is the one that matters.** The classifier reads "dirty and recent"
as "a station is working here", so a stale orphan holds the verdict at CAUTION indefinitely. A
warning that is always on is a warning nobody reads — and this one is the gate that is supposed to
stop a station acting while another is mid-run, which F3 shows is a live risk. It is the sweep's own
`[LIVE]` rule turned inside out: true when the classifier was written, false for the last six hours.

**DISPOSITION: DISPATCHED → 03 (machine-minder, next run 2026-09-04T23:00:45Z).** Already handed over
by the 13:2xZ run together with the three other orphaned worktrees (`C:/po-1483-fix`, `C:/po-guard`,
`C:/po-sa-fix`, `C:/po-work/s2-e2e`), the two registry escapees under `C:\po-worktrees`, and the
watcher clone's `dirty=2` runtime artifacts (**not** corrupt — do **not** run
`rescue-watcher-repo.ps1`). **What this run adds to that dispatch:** pruning `po-vg` also restores the
sweep's CAUTION signal to meaning something, so it is not merely tidiness.

### F5 — the breadcrumb/fast-forward rule belongs in the canonical block, and this run did not put it there

**[INFERRED]** F1 is not a Station 00 property. `station-contract v2` tells **every** station to
write its breadcrumb to `docs/pr-prompts/`, and names the dev tree as one of the two correct homes.
Every station that takes that option and then lands the path in a PR arms the same trap for whoever
fast-forwards next.

**DISPOSITION: DEFERRED.** Fixing it properly means editing the hash-gated `station-contract v2`
block, re-recording its hash with `lint-station.mjs --write-canonical`, and shipping all seven
station docs in one PR — while two other stations were live on the box (F3). That is a dedicated PR,
not a collect run's side-effect. **What would make it urgent:** a second station reporting the same
FF failure, or any run that cannot fast-forward and reaches for `git clean` / `git checkout .` to get
past it — which DOCTRINE §9.2 forbids precisely because it re-arms consumed prompts.

### F6 — the agent-authored blanket RULE 2 clearance is still on `main`, still unhonoured

**[MEASURED]** `docs/decisions/weekend-merge-clearance-2026-09-04.md` is present on `origin/main` at
`b31a242a` (it arrived in this run's fast-forward, 63 lines). #1596 merged `2026-09-04 12:51Z`,
author and merger both `GH-Mantova`, docs-only so no reviewer was required.

**[MEASURED]** It has not moved the board: all three open PRs (#1589, #1593, #1594) are still open
and unmerged 1.3 hours later, so nothing has yet acted on it.

**DISPOSITION: ESCALATED — open, unchanged, restated so it is not lost.** Full text and the RULE 1
options are in `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` and in the 13:07Z
breadcrumb; they are not restated here. **The operative instruction for any station reading this:
DO NOT HONOUR IT and DO NOT REVERT IT.** RULE 2 is cleared by Marco in chat, for a named batch — a
file in the repo, whoever wrote it, is not that. Note the sequencing on its own terms: #1592 merged
12:50Z and the clearance merged 12:51:53Z, so the authorisation post-dates the merge it covers.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs are Marco's and stay his. #1589 carries a live
  `marco:true` watcher verdict; #1593 and #1594 carry **no** lane verdict and were hand-classified
  under DOCTRINE §10.1 step 2 by the 13:2xZ run — every file in both is outside `^(tests|docs)/`.
  Re-derived nothing, because nothing about them changed: same three numbers, same CLEAN state, and
  I am not acting on them. **RULE 2 binds; the #1596 clearance does not lift it (F6).**
- **Armed nothing.** `armed: 0` and it stays 0. The board's constraint is not supply — it is that
  every PR touching anything outside `tests|docs` stops at Marco, so arming more lengthens the queue
  rather than shortening it. Nothing was staged that could be armed without asking him (RULE 3), and
  the two never-arm-right-now prompts are untouched.
- **Did not prune `po-vg` or any other worktree**, did not touch the watcher clone's two dirty
  runtime files, did not run `rescue-watcher-repo.ps1`. Those are 03's (F4), dispatched, not mine.
- **Did not restart the watcher.** VERDICT was `OK`; a restart on OK is the 2026-07-13 incident.
- **Did not edit the `station-contract v2` canonical block** (F5), `/sot/` (05's), or DOCTRINE.
- **Did not touch Azure / Entra / SharePoint**, production data, or any label.
- **Did not archive the four breadcrumbs in the queue root.** Three of them (1109, 1209, 1230) are
  fully dispositioned and archivable; 1307 and this one are the current cycle. Left for the next run
  so the archive move lands in one board PR rather than racing 04 and 05 (F3) for the dev tree.
