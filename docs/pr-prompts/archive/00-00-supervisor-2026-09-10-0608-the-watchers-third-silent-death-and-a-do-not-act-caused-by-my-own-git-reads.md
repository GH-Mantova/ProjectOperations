# Station 00 — Supervisor | 2026-09-10T06:08Z–2026-09-10T06:5xZ

## GROUND

```
UTC            2026-09-10T06:08:41Z
origin/main    eaf0bcd2            (git fetch origin --prune, then git rev-parse --short)
dev tree       main @ eaf0bcd2     C:\ProjectOperations2   (0 behind, 0 ahead)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED run.** `ToolSearch` loaded the Desktop Commander schemas first; `start_process` shell
`powershell.exe` then returned a live prompt on the first call. A validation error would have been
an unloaded schema, not an unreachable machine — the load came first and the call succeeded. This
is not being reported as a quiet run.

**vm-git-guard: [CANNOT MEASURE], and the signature CHANGED.** PREFLIGHT step 1 asks for
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. The Linux workspace never
reached the script. Last line, verbatim: `bash failed on resume, create, and re-resume. resume: RPC
error -1: failed to mount … under Plan9 share "c" which is not mounted; create: RPC error -1:
ensure user: user dazzling-great-einstein already exists unexpectedly`. A failed install is a
FINDING, not a STOP. Blast radius is nil by construction: with no VM there is no VM-side `git` to
guard, and none was run — every probe below went through Desktop Commander against the Windows host.

**Read from the working copy, proved sound rather than assumed.**
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, so the working copy is `origin/main`'s blobs and
the staleness distinction could not bite. No piped `hash-object` comparison was made (§9.1 — unsound
in `powershell.exe`). All three read in full.

**Fresh needle minted this run, now SPENT by appearing here:** `zzQ00N20260910T0615`.

## WHAT I MEASURED

**Sweep — SAFE TO ACT, twice.** `status-sweep.ps1` captured to a file (it returns early and hides
its own §7 verdict). 06:09:42Z: `SAFE TO ACT: no board mutation in progress, no recent remote
activity, no live station worktrees.` Re-run immediately before the board mutation at 06:25Z:
`index.lock` False / False, `git processes running: 0`, no PR touched in 2 min, **SAFE TO ACT**.

**Board — 2 open, both CLEAN, both green, and both Marco's.** `#1832` (opened 00:12:33Z) and
`#1823` (opened 2026-09-09T00:05:42Z), 15 pass / 0 fail each, `labels: []` on both. `main` CI on
`eaf0bcd2`: 4 success / 0 failed. Armed `*-ready.md`: **0**, counted by hand.

**RULE 2 — re-verified live, not inherited.** Probe pinned to `C:\ProjectOperations2\docs\pr-prompts\processed`
and never the clone: **2106** logs, newest `2026-09-10T04:27:04Z` — more recent than both PRs'
`createdAt`, which is the control that separates the live directory from the seventeen-day-stale
decoy. POSITIVE `marco.:true` → **627**; NEGATIVE (needle above) → **0**; NEGATIVE `PR #999999` → **0**.

- `#1832` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}`
- `#1823` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`

Both are genuine policy routings with specific reasons, not the byte-identical timeout path.
**RULE 2 binds on both and I merged neither.** Label absence does not clear it.

**Queue — 40 HOLDs, 9 gate-satisfied, and 0 of the 9 can enter the `tests-docs` lane.**
Classified against `classifyPolicyFiles`' three `NESTED_TEST_PATHS` forms, verbatim from `index.mjs`.
POSITIVE control (`docs/a.md`, `tests/b.ts`, `scripts/x/__tests__/y.mjs`, `apps/api/z.spec.ts`) →
all true; NEGATIVE control (`apps/api/src/main.ts`, a `migrations/` path) → both false. Every one of
the nine carries `apps/**`, `scripts/**` or `.github/**`, and three carry
`apps/api/prisma/migrations/**`, which fails on its own clause. **Fifth consecutive run to measure
this.**

**Watcher — running, and it restarted mid-window.** node RUNNING **pid 18228**, `CreationDate`
**2026-09-10T05:39:45.7Z**; the 05:08Z run recorded pid 13352. Auto-restart wrapper alive (1).
Clone `branch=main dirty=0`. Not wedged: heartbeat ticks only mid-run and `armed: 0`, so a stale
heartbeat on an empty queue is the correct idle reading.

**Daily clone log selected by NAME SHAPE then mtime, never constructed from a date** (§9.5).
`2026-09-10.log`, mtime 06:09:46Z, 42,388 B. Its own first line is stamped
`2026-09-10T08:01:00+10:00` — the host-local naming trap, live: a file named for the Brisbane date
whose newest line is `06:09:46Z` UTC. POSITIVE control `[merge]` → 4; NEGATIVE (minted needle) → 0.

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json`** — Station 04's `--advance` carried across
   (`last_index` 3→0, `last_run_utc` →`2026-09-10T06:10:05Z`), plus 04's F3 safety clause appended to
   the `gate-liveness` brief. Edited in node by JSON round-trip, never `Set-Content` and never a
   `String.replace` replacement string. Byte delta ASSERTED and fully reconciled: 2407 → 2809 =
   **+430 content** (the clause, exactly) **−28 line-endings** (28 lines, CRLF→LF on the node write).
   `git diff -U0` shows exactly the 3 intended lines; the other three briefs are byte-identical.
2. **25 collected breadcrumbs archived** to `docs/pr-prompts/archive/` — all as pure `R` renames,
   read back: root 31 → 6, archive 387 → 412, zero basename collisions, none left at root.
3. **Station 04's two hand-offs committed** — its 06:10Z breadcrumb and its staged
   `pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md`, both copied byte-exact
   (`Buffer.compare` → 0) from the dev tree where 04 must leave them untracked.
4. **This breadcrumb**, written inside this run's own PR worktree (cure 1), so no loose copy is left
   in the dev tree to block the next fast-forward.
5. **Nothing merged. Nothing armed. No label touched. No `sot/` edit. No production data. No
   Azure / Entra / SharePoint. No `git` run in `C:\po-watcher\ProjectOperations`** — reads only.

## FINDINGS

### F1 — The watcher died with no recorded exit for the third time, and its relaunch manufactured an EMPTY stash entry from a line-ending smudge

[MEASURED] The previous watcher's last log line is `[2026-09-10T05:36:04.455Z] [review]
verdict-archive sweep` — a healthy 5-minute tick. The next line in the same file is
`[2026-09-10T15:39:44.03+10:00] PRE-FLIGHT` from a **new launcher**. There is no `Watcher exited`
line, no exit code, no SIGINT, and no error between them. The process died silently inside a
3.5-minute window, and `CreationDate` on pid 18228 confirms the replacement at `05:39:45.7Z`.
Nothing was lost: `armed: 0` and no build was in flight.

This is 03's open dispatch item (1) — *the watcher dies UNCLEAN with no recorded exit* — with a
**third dated instance**, and the first one to occur inside a Station 00 run window.

**And the relaunch fed the stash loop with nothing.** The preflight autostash reported one modified
tracked file, `docs/data-model/metadata-catalog.json`, alongside git's own
`LF will be replaced by CRLF` warnings for it. The resulting entry is **empty**:
`git diff --name-only stash@{0}^ stash@{0}` → no files, exit 0, against POSITIVE control
`stash@{1}` → 3 files. So the "dirtiness" was a line-ending smudge, not content, and the stash list
is now **71** with nothing draining it.

**This also discharges the 05:08Z run's F5** (*"the watcher clone is dirty on main", dirty=2,
dispatched to 03 as possible build residue*). It was never residue. Neither recent entry holds work
absent from `main`: `git diff --numstat origin/main stash@{1} -- apps/api/src/modules/admin-imports/`
shows the three stashed files unchanged against `origin/main` (its only row is a file the stash's
older base predates). **There is nothing to recover from either.**

**DISPATCHED** — to Station 03 (next occurrence 2026-09-10T23:00Z), its own lane and its own tree.
Two things it does not yet have: the third instance is dated and bounded to a 3.5-minute window in
the daily clone log, and the two newest stash entries are provably safe to `git stash drop` —
**never `pop`** — because neither contains anything absent from `main`. I did not run `git` in the
clone beyond reads.

### F2 — One breadcrumb from the outage window was never collected, and its escalation file now bundles a DEAD finding with a LIVE one under the dead one's title

The 2026-09-09T23:08Z run restarted the collect and named the eleven breadcrumbs it dispositioned.
Crossed against what is actually at the queue root, **one 04 breadcrumb from the Station-00 outage
window is in neither that list nor any later collect**:
`00-04-scanner-2026-09-08-0610-station-00-is-disabled-so-no-breadcrumb-collects.md`.

I collected it this run. All five of its findings, re-measured against today's state:

| its finding | today | disposition |
|---|---|---|
| F1 — Station 00 is DISABLED, nothing collects [S1] | **DEAD by its own falsifying probe**: `enabled: true`, `nextRunAt 2026-09-10T07:07:52Z`, `lastRunAt 06:08:06Z`, and 00 has run hourly since | **ACTIONED** |
| F2 — the bootstraps omit 4 load-bearing PREFLIGHT preconditions [S2] | **STILL LIVE**, re-measured | **ESCALATED** (below) |
| F3 — `.gitignore:107-111` cited by 5 bootstraps points at the Claude Design allowlist [S3] | **STILL LIVE**, re-measured | **DEFERRED** — on file since 09-06 |
| F4 — two bootstrap cadence lines contradict their live crons [S3] | **STILL LIVE**: 00's bootstrap says *"every 2 hours"* against cron `5 * * * *` | **DEFERRED** — on file |
| F5 — an uncommitted deletion of a tracked HOLD in the dev tree [S3] | **DISCHARGED**: `git diff --numstat origin/main` → EMPTY, not on disk, not on `origin/main` | **ACTIONED** |

F2's re-measurement, over the **6** live bootstrap `SKILL.md` (retired folders excluded):
`ToolSearch` → **0**, `vm-git-guard` → **0**, `git show origin/main` → **0**, `Stamp the ground` →
**0**. POSITIVE control `STEP 1` → **5**; NEGATIVE control (minted needle) → **0**. F3 re-measured
against the real file: `.gitignore` is 151 lines, 107-111 are the `!Claude Design/...` allowlist,
the five QA sinks are at 115-119, and **5 bootstraps cite 107-111**.

🔴 **The new problem is the FILE, not the findings.** Both F1 and F2 were escalated into a single
`needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`. Its **title asserts a claim
that is now false**. DOCTRINE §7.1's re-read rule tells the next reader to re-verify an artifact's
central claim and treat a stale one as a lead — which here means reading a refuted title and
discarding a file whose *other* half is a live, six-day-old S2 about the layer that governs STEP 1
and that no CI gate reaches. A dead finding is camouflage for a live one when they share a filename.

**ESCALATED** — F2 is split out to
`docs/pr-prompts/needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md`, carrying
its own measurement and falsifying probe, so it no longer dies with F1's title. The original file is
**annotated, not deleted** — the standing rule is never to clear a line carrying an unanswered
escalation, and whether 00 was switched off deliberately is still Marco's to say.

### F3 — Station 04's DO NOT ACT was caused by MY OWN git reads, 82 seconds after my sweep said SAFE TO ACT

Two runs of the same instrument, on the same idle board, minutes apart, opposite verdicts:

| | verdict | `index.lock` | `git processes running` |
|---|---|---|---|
| Station 00 (this run), 06:09:42Z | **SAFE TO ACT** | False / False | **0** |
| Station 04, 06:11:04Z | **DO NOT ACT** | False / False | **1** |
| Station 00 (this run), 06:25Z | **SAFE TO ACT** | False / False | **0** |

Station 04 found the mechanism independently and staged the fix (its F1): the gate counts
`Get-Process -Name git` **by image name**, with no PID resolution and no command-line test — which
§9.5 forbids in as many words — and 04 measured that one ordinary `git log` takes the counter 0 → 2
while `index.lock` stays False throughout.

**What 04 could not see is whose git it was.** 04 fired at `06:09:45Z`, **99 seconds** after this
run started, and at 06:11:04Z this run was executing `git fetch --prune`, `git rev-parse` and three
`git diff --numstat` probes against the same dev tree. 04 records the owning process as
`[CANNOT MEASURE]` because it had exited. It was almost certainly mine.

So the by-image-name counter and the `00`×`04` cron collision are not two independent defects —
**they compose.** `00` is hourly at `:05` and `04` is `0 */4 * * *`; STATION-CAPABILITIES §6 already
records that this puts them inside ten minutes of each other on **all six** of 04's daily runs, by
construction. The station that measures second reads the first one's ordinary reads as a mutation
and stands down. The verdict fails safe for writes, but it costs a whole run, and it does so on a
schedule.

**ACTIONED, in the half that is mine** — 04's `pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md`
is committed and published in this PR (untracked, it was invisible to every clone, to CI and to any
other station). I did **not** arm it: its scope is `scripts/`, so `classifyPolicyFiles` routes the
resulting PR to Marco, and the board is already saturated with work only he can clear (F5).
**The composition above is added to the open cron-offset escalation** as a second, measured cost —
it was raised as an LL-38 collision risk, and this is the same collision degrading an instrument
rather than corrupting an index.

### F4 — Archiving had been deferred for six consecutive runs on a premise that was already false

The 02:08Z run recorded, as its F6, *"Archiving was skipped for a fourth consecutive run, because
nothing links a breadcrumb to the run that collected it."* That link does exist: the 23:08Z collect
names its eleven breadcrumbs explicitly in findings F6/F7/F8, disposition by disposition, and the
later runs name theirs in prose.

Verified before touching anything, against the **tracked set** rather than the dev tree (the rule
that stops a second copy being committed at the root path): 31 tracked at root, 387 tracked in
`archive/`, **0 duplicated basenames**, 0 untracked strays. POSITIVE control (`CLAUDE.md` tracked) →
true; NEGATIVE control (minted path) → not tracked.

**ACTIONED** — 25 archived, everything dated before today plus 04's 02:10Z run whose finding the
03:08Z collect landed into DOCTRINE §9.1. Today's six 00 breadcrumbs and 04's 06:10Z breadcrumb stay
at the root as the current cycle. Read-back: 25 staged entries, **all `R`**; root 6; archive 412.
Archiving is freshness-safe by construction — `check-breadcrumb.mjs` builds `trackedSet` from
`git ls-tree -r` and matches by trailing path segment — and the post-merge `--freshness` run is
recorded under WHAT I DID NOT DO as the read-back that proves it.

### F5 — Nothing on this board can move without Marco, and this is the fifth consecutive run to measure it

Both open PRs carry live watcher `marco:true` verdicts. All nine gate-satisfied HOLDs are outside
`tests|docs`. `needs-marco/` holds **53** files. There is no red to fix — `main` is green and both
PRs are 15/15. The constraint is not the machinery; it is that every remaining path forward
terminates in a human decision.

Three separate escalations already name pieces of this — the RULE 2 clearance that lives in a chat
no scheduled run can read (filed 05:45Z today), the `tests-docs` lane starvation, and the vacuous
CP-26 gate. I am deliberately not filing a fourth that would restate them.

**DEFERRED** — real, measured, and already escalated in three places. **What would make it urgent:**
a gate-satisfied HOLD appearing that *is* `tests|docs`-only, which would prove the lane can still be
fed and make the starvation a scheduling problem rather than a structural one. That is cheap to
re-test — it is the classification table under WHAT I MEASURED, re-run.

### F6 — The Cowork Linux workspace failed again, with a DIFFERENT signature

Fifth consecutive station run without the VM. The signature changed: the 05:08Z run recorded
`SDK version 2.1.260 not verified`; this run and Station 04's 06:10Z run both recorded a **Plan9
share not mounted** failure plus `ensure user … already exists unexpectedly`. Same outcome, two
different causes, which matters because a single-cause fix may not clear it.

Already on file as `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`.

**DEFERRED** — not re-raised. The guard it blocks protects against a VM-side `git` call reaching the
Windows `.git`, and with no VM there is no such call. **What would make it urgent:** a run where the
workspace *does* start — that run must install the guard before its first mount-side call and must
not read this note as cover for skipping it.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live, specific watcher `marco:true` verdict.
  RULE 2 binds and is not cleared by green, by CLEAN, by an absent label, or by a receipt.
- **Did not add or remove a label** on either PR. Only Marco removes `do-not-merge`.
- **Did not arm anything.** `armed: 0` at the start and at the end. All nine gate-satisfied HOLDs
  route to Marco, including 04's new one, and lengthening the queue he is already the constraint on
  is not progress.
- **Did not treat Station 04's `DO NOT ACT` as a licence to reason past a stop.** I re-ran the sweep
  myself and it returned SAFE TO ACT with `git processes running: 0`, twice, including immediately
  before the mutation. Had it returned DO NOT ACT I would have resolved the git PIDs by command line
  — the sanctioned instrument — rather than acting through the verdict.
- **Did not delete or clear** `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`.
  Its F1 is dead but the question it puts to Marco is his to close.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond reads, and did not touch the
  stash. Dropping the two safe entries is 03's, and F1 hands it the measurement.
- **Did not touch `C:\po-vg`** (1 uncommitted file, ~8,540 min) or `C:\po-worktrees\pr1823` (its PR
  is open). Worktree hygiene is 03's lane and `po-vg` is already escalated.
- **Did not commit the other untracked paths** in the dev tree — `queue-watch-state.md`,
  `.queue-sync-ledger.txt`, two `docs/pr-reviews/pr-18xx-review.md`, the `Claude Design` index, and
  `pr-watcher-verdict-home-resolver-LOOPING.md`. None is a hand-off addressed to this run, and a
  collect PR is the wrong place to adopt files whose provenance I have not established.
- **Did not touch `/sot/`** (Station 05's), Azure / Entra / SharePoint (absolute), or production data.
- **Did not edit DOCTRINE.** F3's composition finding is real, but landing it means editing the
  `instruments v2` canonical block and re-recording its hash — a separate PR from a collect, and the
  measurement is preserved here and in the cron escalation meanwhile.
