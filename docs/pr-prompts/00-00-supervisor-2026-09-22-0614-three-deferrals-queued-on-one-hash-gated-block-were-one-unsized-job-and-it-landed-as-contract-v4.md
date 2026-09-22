# Station 00 — Supervisor | 2026-09-22T06:14:14Z–2026-09-22T07:0xZ

## GROUND

```
UTC            2026-09-22T06:14:14Z
origin/main    447bff3b            (git fetch origin, then git rev-parse)
dev tree       main @ 447bff3b     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE, so this run was not read-only.

**Which tree I read the binding documents in, and why the working copy was sound.** PREFLIGHT step 2
requires `git show origin/main:<path>` rather than the working copy. I read the working copy in
`C:\ProjectOperations2`, having first proved it identical: `HEAD == origin/main == 447bff3b`, and
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, which §9.3 names as the sound comparison
(no pipe, no length comparison, no `hash-object` across the boundary). All three were read in full.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] `start_process` shell `powershell.exe` after a keyword
`ToolSearch` for `desktop-commander`; PID 34460 answered `USER=Marco NOW=2026-09-22 16:14:49`
(Brisbane, UTC+10) from `C:\ProjectOperations2`. A second read-only shell, PID 20932, carried the
rest of the run. This was not a blind run.

**vm-git-guard — installed, INERT, and now SAYING SO. PREFLIGHT requires its last line quoted.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit **0**:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/<id>/.local/bin/git   (a LOGIN shell)
  bash -c  'command -v git' -> /usr/bin/git                    (the shell a STATION IS GIVEN)
=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL.
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/<id>/.local/bin:$PATH" git <args>
```

🟢 **This is `#2065` working, not a new defect.** `#2065` (*"vm-git-guard self-certifies success
while inert"*, merged 2026-09-22T02:58Z) exists precisely so the installer stops reporting success
it cannot deliver. A fresh scheduled run now gets the honest answer on the first call. **The ban was
observed, not relied on:** every `git` and `gh` call in this run went through the Windows shell.

**Sweep — SAFE TO ACT.** [MEASURED] `status-sweep.ps1` captured with `*>` and decoded `utf16le` in
node (the capture is **152,338 B opening `FF FE`** — §9.3's UTF-16LE trap, which the prescribed
capture walks straight into). Section 7: `SAFE TO ACT: no board mutation in progress, no recent
remote activity, no live station worktrees.` Section 3: `index.lock` False/False, scoped git
processes **0**, no PR touched in the last 2 min. No `index.lock` existed, so no staleness call was
needed.

**`[STALE]` escalation rows — NONE to clear this run.** [MEASURED] exactly **one** `[STALE]` line in
the whole report, and it is not PR-scoped: *"no station summary younger than 3 days"*. The eleven
PR-scoped rows the station doc was written for are not present. The remaining section-5 volume is
`[FILE]` lines of the shape *"cites #N (MERGED) as evidence — not its premise; does not clear the
escalation"*, which the sweep itself says do not decide anything. **Nothing discharged, correctly.**

**Watcher — HEALTHY, and idle is correct.** [MEASURED] node RUNNING pid 9744, auto-restart wrapper
alive (1), heartbeat 45 min. Armed prompts: **0**. An idle watcher with an empty queue is the
correct state, not wedged — I did not run `-Fix` and there was no verdict that would license it.

**The answer sheet.**

- **Q1 — every open PR and its `mergeStateStatus`.** [MEASURED] `gh pr list -R <owner>/<repo>
  --state open --limit 100 --json number,title,headRefName,mergeStateStatus,isDraft,labels`:
  **exactly one**, `#2071` `feat(tendering): scopecards S6 — one cutting surface
  (CUTTING_ONE_SURFACE_V1)`, `BLOCKED`, carrying **`do-not-merge`**. **DIRTY: zero.** No PR on this
  board has frozen CI, so nothing is blocked on a conflict.
- **Q2 — conflicts.** None exist. Nothing to fix and nothing to escalate.
- **Q3 — armed prompts, counted myself.** [MEASURED] `*-ready.md` → **0**. No LOOP is possible with
  nothing armed, and no prompt was renamed.
- **Q4 — every claim re-verified.** The five root breadcrumbs were re-read from disk this run and
  their tracked status re-measured rather than assumed (all five `tracked=True`). The sweep's own
  `[LIVE]` trunk line was cross-checked: `main CI on 447bff3b: 4 success / 0 failed (trunk green)`.
- **Q5 — silent no-ops.** `no-pr-opened/` newest entry is **2026-09-02T03:47Z**, twenty days old.
  Nothing new; no prompt ran and produced nothing this cycle, because nothing was armed.
- **Q6 — the single most important thing blocking progress.** Nothing on the board is blocked. The
  one open PR is parked on Marco by design and the queue is empty, so the binding constraint this
  run was **the backlog of deferred instrument work**, which is why I spent the run on it.

**Freshness, crossed against `lastRunAt` — and the one row that needed a third instrument.**
[MEASURED] `check-breadcrumb.mjs --freshness` → `CLEAN`, exit **0**, all stations `ok`.

| station | newest breadcrumb | `lastRunAt` (MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-22T05:30Z | 2026-09-22T06:14:14Z | this run; aligned |
| 03 | 2026-09-21T23:04Z | 2026-09-21T23:02:53Z | aligned; cron `0 9 * * *`, not due |
| 04 | 2026-09-22T02:11Z | **2026-09-22T06:09:53Z** | **fresh `lastRunAt`, no breadcrumb** |
| 05 | 2026-09-21T14:11Z | 2026-09-21T14:10:40Z | aligned; `nextRunAt` 14:22Z, not due |

🔴 **04's row is the "it started and died, or ran and did not report" shape — and it is neither.**
The table in my own station doc would have me read it as a defect. [MEASURED] `list_sessions`:
`local_d9ce72d7-…` **"04 scanner" (running)**, created against the 06:09:53Z occurrence, i.e. **four
minutes before this run started**. 04 was **mid-run inside my window**, which is the innocent
explanation the doc requires me to look for before dispositioning a station SILENT. Its breadcrumb
is not late; it is not written yet. ⚠️ `list_sessions`' state field is not a lock (§9.5) and I did
not use it as one — it agrees with `lastRunAt` here, and the two together are what settle it.

**`#2071`'s three reds, diagnosed from the job logs and not from the PR page.**

| check | verdict token, read from **column 3** of the job log (§9.1) | what it is |
|---|---|---|
| `Approval receipt (CP-26)` | `FAIL - CP-26 approval-receipt **[LABEL_PRESENT]** PR carries the do-not-merge label` | **PARKED BY DESIGN.** Only Marco removes the label. |
| `PR gates — diff checks` | `FAIL - CP-26 do-not-merge [...]`, and **every other gate PASS or SKIP** (CP-11/12/13/17/23/24/25 PASS, CP-22/27 SKIP) | the **same** check running a second time — one cause, two rows (§9.4) |
| `tendering-e2e` | `1 failed` — `batch4-tender-documents.spec.ts:95:7 › mock SharePoint mode: Open shows the connection-required toast`, `expect(locator).toBeVisible() failed / element(s) not found` | the only real red |

🔴 **The e2e red is NOT this branch's own failure, and the run history is what proves it.**
[MEASURED] `gh run list --branch feat/scopecards-s6-one-cutting-surface`, `Tendering Browser Smoke`,
every run on a **different head** (the branch was pushed eight times in three hours by a second lane):

| created | head | result | failing specs, from `--log-failed` |
|---|---|---|---|
| 02:57Z | `820fcf96` | failure | **4**, all `batch3-scope-cutting.spec.ts` |
| 03:52Z | `95cde5fc` | failure | **4**, all `batch3-scope-cutting.spec.ts` |
| 04:19Z | `feaceb40` | failure | **2**, both `batch3-scope-cutting.spec.ts` |
| **04:43Z** | **`5b6ab08c`** | **success** | **0** |
| 05:30Z | `643609e1` | failure | **1**, `batch4-tender-documents.spec.ts` — a different file |

**The earlier reds were the PR's OWN acceptance tests and they converged 4 → 4 → 2 → 0** under a
second lane that was fixing them. The current red is a **different spec** that the diff cannot
reach: `#2071` touches seven `apps/web/src/pages/tendering/**` files plus
`tests/e2e/pr-acceptance/batch3-scope-cutting.spec.ts`, and nothing under tender documents or
SharePoint. POSITIVE controls in the same hour: the identical suite passed on **`main`** at 05:28Z,
on `collect/00-20260922-0530` at 05:25Z, and on `fix/vm-git-guard-honest-reachability` at 02:46Z.
**`main` is green on this test, so it is not a trunk regression**, which is the reading rule 5 of my
station doc would otherwise force. That is the transient class, and rule 5 says re-run it.

**The false-termination trap fired TWICE in this run, and the corrected guard settled it both
times.** [MEASURED] an `interact_with_process` chain ending in a `gh run view … --log` returned
`📭 (No output produced)` and `✅ Process 20932 has finished execution`. DOCTRINE §9.1's correction
of 2026-09-14T20:3xZ says that message is an EARLY READ, not a stopped shell, and that the cure is
to **read the buffer** rather than merely ping the PID. `read_process_output` on 20932 returned
**137 lines** including every marker and the full e2e failure text. The shell then carried the
whole rest of the run. A second instance, a `status-sweep.ps1` call, exceeded the 180 s MCP tool
timeout; the same read returned `MARKER_SWEEP_DONE` intact. **Both shells were alive the entire
time; nothing was abandoned and no second shell was started on the strength of either message.**

## WHAT CHANGED

1. **`station-contract` canonical block v3 → v4, in all seven station docs plus
   `_canonical-blocks.json`.** Commit `5b9ed2a4`. Three changes, listed under F1.
   - **Read-back:** `node scripts/pipeline/lint-station.mjs` → **exit 0**, `ADMIT: all 8 docs
     clean`. An independent re-hash of the block in each of the seven docs gives
     `v4 9da584730ab9b784` for all seven, **DISTINCT=1**, matching the sha `--write-canonical`
     recorded. `instruments` sha is **unchanged** at `10ec46a02e70a2b3` — DOCTRINE was not touched.
   - **Byte-delta assertion (§9.3):** each of the seven files moved by exactly **+2053 bytes**,
     equal to the sum of the intended `NEW − OLD` lengths. The replacement was passed as a
     **function**, never a string, so `$&` / `` $` `` substitution was disabled.
   - The first attempt **failed safe and wrote nothing**: the anchor
     `CANONICAL-BLOCK: station-contract v3` occurs **twice** per file, because
     `END-CANONICAL-BLOCK:` contains it as a substring. The uniqueness guard caught it, the run
     aborted before any write, and the anchor was narrowed to `<!-- CANONICAL-BLOCK:`.
2. **Five fully-dispositioned breadcrumbs archived** — `git mv` into `docs/pr-prompts/archive/`, in
   this same PR. Root `00-*.md` count after the move: **0**, plus this report. Archiving is safe for
   freshness (`--freshness` matches by trailing path segment, §9.5).
3. **One CI re-run dispatched** — `gh run rerun 35690967578 --failed`, exit 0. Read back under F2.
4. **An isolated worktree created and torn down** — `C:\po-wt\canon-v4` off `origin/main`, never the
   shared dev tree. Teardown read back under "What I did not do".

**Nothing else was mutated.** No prompt armed, disarmed or renamed. No merge. No label touched. No
watcher restart. No `sot/` edit. Nothing committed on `main` in the dev tree; the dev tree's index
was verified clean (`git diff --cached --name-status` EMPTY) before the worktree was created.

## FINDINGS

### F1 — Three findings had each been DEFERRED **alone** onto the one hash-gated canonical block, each for the same reason, and the reason stopped being true the moment there were three. `STATION_CONTRACT_V4_THREE_QUEUED_CHANGES_V1`

The `station-contract` block is byte-identical in all seven station docs and `lint-station.mjs`
fails on any edit without a re-recorded hash, so a change must ship in all seven at once. That cost
is real, and each of three findings was individually judged *"more than a collect run should
carry"*:

| # | the change | deferred by | since |
|---|---|---|---|
| 1 | the post-merge fast-forward blocker belongs in the contract, not in `00-supervisor.md` alone | `00-supervisor.md`'s own note | **2026-09-05** |
| 2 | `needs-marco/` is described as a uniformly gitignored sink; **6 of 61** files are TRACKED | Station 04's F6, **DISPATCHED to 00** | 2026-09-22 |
| 3 | *"Never leave it in a disposable worktree"* omits the Cowork session's `outputs` folder | 00's own F1, 05:30Z run | 2026-09-22 |

🔴 **Each deferral was locally correct and the sequence was wrong.** The hash re-record and the
seven-file ship dominate the cost and are paid **once**; the marginal cost of the second and third
items is near zero. Item 1 had been waiting **seventeen days** on a judgement that only ever
compared one item against the fixed cost. The 05:30Z run named the trigger — *"a third item arriving
on the same block"* — and deferred *"for the last time on this reasoning"*, leaving the work sized
for its successor. **That trigger had fired, and this is the successor.**

Conditions for doing it now, all met and all measured: the board is quiet (**1** open PR, parked on
Marco; **0** armed), the sweep says `SAFE TO ACT`, and the dev tree index was clean. A
canonical-block edit botched under pressure breaks `lint-station.mjs` for every station doc at once,
which is why the quiet board is a precondition rather than a convenience.

**What v4 actually adds** — all three inside the block, so all seven stations get them together:
the FF-blocker rule with the **raw-Buffer** restore as the first move and the **four** read-backs
(the three previously prescribed all pass on a dirty tree; only `--porcelain` catches it); the
`needs-marco/` ignored-by-rule-but-tracked-in-fact correction with the `git ls-files` probe that
answers it, since `git check-ignore` answers about the rule and never about the index; and the
session `outputs` folder named alongside the disposable worktree.

**DISPOSITION: ACTIONED** — landed in commit `5b9ed2a4` in this run's PR. Verified by
`lint-station.mjs` exit **0**, by an independent per-document re-hash (`DISTINCT=1`, matching the
recorded sha), and by a byte-delta assertion on every file. ⚠️ **Falsifying probe:** re-hash the
block in all seven docs and compare against `_canonical-blocks.json`; if any doc disagrees, the
ship did not land byte-identically and v4 must be re-recorded.

### F2 — `#2071`'s only real red is a spec its diff cannot reach, on a branch whose own tests had just gone green, while `main` passes the identical suite

Two of the three reds are the **one** `do-not-merge` cause rendered twice (§9.4), and are parked by
design — there is no agent-side action behind `[LABEL_PRESENT]`, because only Marco removes the
label. The third is `batch4-tender-documents.spec.ts` failing a SharePoint toast assertion. The
branch's own `batch3` specs went **4 → 4 → 2 → 0** across four heads as a second lane fixed them,
and the head that failed is the one **after** the green head, on a different spec entirely. Positive
controls: the same suite passed on `main` at 05:28Z and on two other branches inside the same hour.

Rule 5 of my station doc names exactly this shape — a CODE check failing on an unrelated diff while
`main` is green — as transient, and says to re-run before treating it as a defect.
`gh run rerun 35690967578 --failed`, exit **0**.

⚠️ **Read-back at the time of writing: `{"conclusion":"","status":"in_progress"}`.** The job takes
~15 minutes and had not finished when this report was written. **I am not claiming it went green.**
The honest statement is: the re-run was dispatched and its result is not yet known.

**DISPOSITION: ACTIONED** — the diagnosis is complete and the sanctioned remedy is dispatched.
⚠️ **This leaves a named trigger for the next collect run, and it is the whole value of this
finding:** read `gh run view 35690967578 --json conclusion`. **`success` ⇒ transient, confirmed,
and `#2071` is green apart from its label, i.e. it is waiting on nothing but Marco.** **`failure`
⇒ the transient reading is REFUTED**, and the next step is not a third re-run — it is to check
whether `batch4` is failing on `main` by then, and if not, to treat `643609e1` as having broken a
spec it does not touch, which would be a real and interesting defect. Do not re-run it twice on the
same reasoning; §5.6 calls two honest attempts the limit.

### F3 — `vm-git-guard` reports itself INERT on a fresh scheduled run: `#2065`'s fix is working, and the ban it was meant to mechanise is still only remembered

PREFLIGHT requires the installer's last line quoted, pass or fail, because *"an install nobody can
see in the report is indistinguishable from one that never ran"*. Quoted in full under WHAT I
MEASURED. The shim is installed and correct; a non-interactive non-login `bash -c` — **the shell a
station is actually given** — resolves `/usr/bin/git` and never the shim, because neither
`~/.bashrc` nor `~/.profile` is sourced.

🟢 **The finding is that this is now VISIBLE.** Before `#2065` the installer certified success while
inert, which is the §7 shape — a confident, coherent, wrong reading of a protection that was not
there. It now says so on the first call, unprompted. **A failed install is a FINDING, not a STOP**
(PREFLIGHT says so explicitly, and widening the stop contract here would turn a missing shell script
into a frozen board). The run proceeded, and the ban was honoured by discipline: **every `git` and
`gh` call in this run ran in the Windows shell**, never through the device bridge.

**DISPOSITION: DEFERRED** — the residual is that the device-bridge git ban is still remembered
rather than mechanical, which DOCTRINE §9.2 records as having failed seven times. The cure is a
change to how the VM shell is launched (it must be a login shell, or the shim must be installed
somewhere a non-login shell reads), which is neither `docs/` nor inside this station's lane to
merge. ⚠️ **What would make it urgent:** the next 0-byte `index.lock` with no owning Windows
process. That freezes every station, and it is the exact outcome the guard exists to prevent.

### F4 — COLLECT: all five root breadcrumbs were already fully dispositioned, and the correct action was to archive them, not to re-disposition them

[MEASURED] every finding in all five carries one of the four literal dispositions, and all five are
**tracked on `origin/main`** (`git ls-files docs/pr-prompts`, matched by basename). The 05:30Z run
had already collected Station 04's six findings F1–F6 and landed them in `#2072`. **The cycle
closed; there was nothing outstanding to disposition.** The one item addressed to me — 04's F6
half, *"`needs-marco/` described as a uniformly gitignored sink"*, **DISPATCHED to Station 00** — is
item 2 of F1 above and is now on `main`.

Re-dispositioning a closed finding is the failure my station doc warns about from the other side —
*"Never act twice on one signal"* — and the queue root had five dispositioned files sitting in the
board I arm from.

**DISPOSITION: ACTIONED** — all five `git mv`'d to `docs/pr-prompts/archive/` in this run's PR;
root `00-*.md` after the move is **0** plus this report. Freshness is unaffected: `--freshness`
builds its tracked set with `git ls-tree -r` and matches by trailing path segment, so an archived
breadcrumb still counts and no station can be made to read SILENT by the move (§9.5).

### F5 — Station 04 was mid-run inside my window, and the freshness table's own reading for that row is a false positive

Carried forward deliberately rather than filed as a defect. [MEASURED] 04 fired at **06:09:53Z**,
four minutes before this run, and `list_sessions` shows its session **running**. Its 06:09Z
breadcrumb did not exist when I read freshness, which is byte-identical to *"it started and died, or
ran and did not report"* in my station doc's cross-check table. It is neither.

🔴 **The general point is that the table has no row for "still running", and 00 runs hourly while 04
runs every four hours — so 00 lands inside a live 04 run by construction.** DOCTRINE §6 of
`STATION-CAPABILITIES.md` already records that `00` (`5 * * * *`) collides with `04` (`0 */4 * * *`)
on **every one** of 04's six daily occurrences. So this is not a rare coincidence; a sixth of 00's
runs meet a live 04, and the prescribed reading of that row is wrong every time.

**DISPOSITION: DEFERRED** — the fix is a row in the cross-check table inside `00-supervisor.md`
(*`lastRunAt` fresh, no breadcrumb, **and the session is still running** ⇒ mid-run, not a defect*),
which is `docs/` and inside my lane, but it is a **station-doc** change and this run has already
shipped a seven-file canonical-block edit. Landing a second doc change in the same PR would mix a
careful contract ship with an ordinary correction. ⚠️ **What makes it urgent:** the first run that
dispositions 04 as SILENT on this row and dispatches work 04 was already doing. **The next collect
run should land it**, and it is one table row.

### F6 — `C:/po-wt/s6fix` is still orphaned, now 172 minutes old, and the authority to prune it is still unowned

[MEASURED] from the sweep: `orphaned worktree (aborted run leftover): C:/po-wt/s6fix 5b6ab08c
(detached HEAD), dirty=0 files, age=172 min`. `dirty=0` means **no work can be lost**. It sits at
`5b6ab08c`, which is the very head whose `Tendering Browser Smoke` went green at 04:43Z — i.e. it is
a leftover from the second lane's work on `#2071`, and that PR is still open.

The last two runs bounced this between 00 and 03 and neither authority row owns it: the matrix gives
03 **report-only**, and 00 dispatches machine repair rather than doing it.

**DISPOSITION: DEFERRED** — unchanged from the 05:30Z run's reading, and I am adding the reason it
should stay deferred rather than merely repeating the deferral: **its PR is still open**, so the
worktree may yet be in use by the lane that created it. Pruning a worktree at an open PR's head
while a second lane is actively pushing to that branch is the LL-38 shape. ⚠️ **What makes it
urgent:** `#2071` merging or closing. At that point it is unambiguously dead, and the authority
question — which is a real gap in the matrix — is Marco's to settle, not a station's to assume.

## WHAT I DID NOT DO

- **I did not merge, touch or re-run anything on `#2071` beyond the one sanctioned CI re-run.** It
  carries `do-not-merge`; only Marco removes that label and only Marco merges it. I did not remove
  the label, did not enable auto-merge, and did not push to its branch — a second lane was pushing
  to it eight times in three hours and pushing under that is the LL-38 shape.
- **I did not arm anything.** `*-ready.md` = 0 and section 6 of the sweep lists one backlog item as
  READY TO STAGE (`rates-11c-blocked-consumers`). I left it. Its own note says the consumers are
  *"staged but not yet merged"*, and arming a destructive rates chain is not something to start at
  the end of a run that has already shipped a canonical-block change. The two `UNBLOCKED, BUT NEEDS
  MARCO` items (`model-merge-slices-rehomed`, `map-locations-waste-rate-coupling`) are explicitly
  do-not-auto-stage and I did not touch them.
- **I did not clear any `needs-marco/` escalation.** Exactly one `[STALE]` row existed and it was
  not PR-scoped; the section-5 volume is `[FILE]` lines the sweep itself says do not decide
  anything. Discharging on a `[FILE]` line alone is what the station doc forbids.
- **I did not prune `C:/po-wt/s6fix`** — see F6; its PR is still open.
- **I did not restart the watcher.** It is RUNNING with its wrapper alive, and an idle watcher with
  an empty queue is correct, not wedged. No verdict licensed `-Fix`.
- **I did not do 03's, 04's or 05's work.** 04 was mid-run throughout; I read its state and left it.
- **I did not edit `/sot/`** — Station 05's, CP-24.
- **I did not touch Azure, Entra or SharePoint.**
- **I did not commit anything in the dev tree, and I did not commit on `main`.** All work happened
  in an isolated worktree off `origin/main`. The dev tree's index was verified clean before and is
  unchanged; this report was written **inside the PR worktree** (Cure 1), which is the rule this
  run's own v4 change just put into the contract — so no untracked copy exists in the dev tree to
  block the next fast-forward.
- **I did not claim the e2e re-run went green.** It was still `in_progress` at write time, and F2
  names the probe and both readings for the next run.

---

**Breadcrumb validation.** `node scripts/pipeline/check-breadcrumb.mjs` result is quoted in the PR
body; `lint-prompt.mjs` is not an instrument for a breadcrumb and no verdict from it is quoted here
(§ REPORT CONTRACT).

**This report is UNTRACKED until this run's PR merges.** It is inside that PR, so no sweep is needed
to pick it up.
