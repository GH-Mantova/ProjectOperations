# Station 00 - Supervisor | 2026-08-25T07:09:30Z-2026-08-25T07:25:00Z

## GROUND

```
UTC            2026-08-25T07:09:30Z
origin/main    c0d5d57b              (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ c0d5d57b       C:\ProjectOperations2   (behind=0 ahead=0 at 07:12:33Z)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md) - MATCH, full authority this run
```

NOT BLIND. Desktop Commander reached the Windows host on the first call (`start_process`,
`powershell.exe`, PID 41336, `hostname` = LAPTOP-E6NHU4E4). Every `[MEASURED]` line below was
obtained on the box.

## WHAT I MEASURED

**Ground, and a live concurrent actor caught mid-run.**

- `[MEASURED]` At 07:10:04Z the dev tree read `main @ 16c1cb28  behind=4`. At 07:12:33Z the same
  query read `main @ c0d5d57b  behind=0`, and `git reflog -6` showed
  `c0d5d57b HEAD@{0}: merge origin/main: Fast-forward`. **Another chat fast-forwarded the shared dev
  tree during this run.** Reflog also shows it authored `001f5f0a` on `pipeline/close-4b-6-7` - that
  is PR #1315, merged 05:20:58Z.
- `[MEASURED]` `status-sweep.ps1` @07:10:18Z and again @07:14:38Z: **SAFE TO ACT** both times -
  in-progress prompts 0, `index.lock` False/False in dev tree and clone, git processes 0, no PR
  touched in the last 2 min. A third immediate pre-mutation re-measure at 07:16:18Z: same.
- `[INFERRED]` The sweep's safe-to-act gate does not see a fast-forward. It reported SAFE while
  another chat was demonstrably operating in the same tree seconds later. Its verdict is about
  *board mutation*, not about *sole occupancy* - do not read it as the latter.

**Board and queue.**

- `[MEASURED]` GitHub: **0 open PRs.** Most recent merges #1315 (05:20Z), #1314 (07:01Z), #1313
  (06:46Z), #1312 (06:30Z), #1311 (06:13Z). main CI last 3 runs: 1 success / 0 not-success.
- `[MEASURED]` Queue at 07:10Z: **armed 0**, 56 `-HOLD.md` at depth 1, `needs-marco/` 9,
  `no-pr-opened/` 107, `failed/` 20, `blocked/` 0. **The pipeline was idle and producing nothing.**
- `[MEASURED]` `check-breadcrumb.mjs --freshness` @07:11Z: 5 breadcrumbs checked, **1 malformed**
  (00's own 06:13Z report, missing all five canonical sections), **all 5 UNTRACKED**, and station
  **03 SILENT 8.2h against a 4h cadence** (exit 2).

**Watcher liveness - measured three independent ways, the last one decisive.**

- `[MEASURED]` node pid **29024**, command line matching `pr-watcher[\\/]index\.mjs`; wrapper alive (1).
- `[MEASURED]` `.queue-state.json` `ts` field in the **clone**: 07:08:02.438Z -> 07:13:02.439Z ->
  07:18:02.453Z. Three samples, two clean **5m00s** gaps: `rescan()` is ticking, **not frozen**.
- `[MEASURED]` **Arm-to-pickup ~1 second.** Armed at 07:16:18Z; `heartbeat.log` in the clone reads
  `[2026-08-25T07:17:19.828Z] pr-ew-s2a-capacity-service-ready.md elapsed=60s`, i.e. the job began
  ~07:16:19Z. At 07:18:19Z it read `elapsed=120s`. The watcher is alive **and working**, not merely
  present.

**Arming pre-flight on `pr-ew-s2a-capacity-service-HOLD.md` (DOCTRINE section 9.5 - ADMIT is not enough).**

- `[MEASURED]` `lint-prompt.mjs` -> **ADMIT (size 3), exit 0**.
- `[MEASURED]` Body scans: `<!-- watcher: do-not-arm -->` **false**, `DO NOT ARM` prose **false**,
  `docs/approvals/` gate **false**, standing-authority grant **present**. **Positive control on the
  same regex**: `pr-arm-lock-s1-serialize-arming-HOLD.md` returns **true** - the scan can find one.
- `[MEASURED]` Front matter: `gate_allow: none` (so it is not one of F4's 13 doomed prompts),
  `escalates: false`, `seed_only: false`.
- `[MEASURED]` Gate `requires_on_main: apps/api/prisma/schema.prisma :: model EstimatorCapacity` ->
  **present on origin/main** (read via `git show origin/main:...`, asserted not `^fatal:` first).
- `[MEASURED]` Premise `! test -f apps/api/src/modules/tendering/capacity.service.ts` -> **alive**:
  absent from `git ls-tree -r --name-only origin/main -- apps/api/src/modules/tendering`
  (**`-r` present**; control `tendering.module.ts` returns true on the same query), and absent on disk.
- `[MEASURED]` Not already shipped: no capacity-service PR in the last 60 merged. EW-1 (#1274,
  the schema this gates on) is the only related merge.

## WHAT CHANGED

Four board writes. Nothing merged, no PR opened, no commit, no push.

1. **ARMED `pr-ew-s2a-capacity-service`** - `git mv` of the tracked `-HOLD.md` to `-ready.md`.
   Read back: `-ready.md` on disk **true**, `-HOLD.md` gone **true**, armed count **0 -> 1**,
   and the watcher picked it up in ~1s (heartbeat above).
2. **BINNED `pr-watchdog-heartbeat-during-merge-wait-HOLD.md`** (`git rm`) - Station 04 F3: its
   premise is dead, the work shipped in **#1304** (merged 08-24 04:51Z). Read back: gone from disk.
3. **Added the STANDING AUTHORITY grant to `pr-e2e-container-s1-trial-workflow-HOLD.md`** (node,
   utf8 - not PowerShell, DOCTRINE section 9.3). Read back: grant present **true**, `U+FFFD` count
   **0**, delta **+769 bytes** (the appended block only), lint still **ADMIT**. This closes the
   prerequisite Station 04 handed to 00 in F2 step 1.
4. **Repaired the 06:13Z breadcrumb's structure** (node) - inserted the five canonical `##` headings
   and demoted the originals one level. **No prose altered**; the missing GROUND block is recorded as
   *not stamped* rather than reconstructed. Read back: all five present, `U+FFFD` 0, delta +1036
   bytes, and `check-breadcrumb.mjs` now reports **0 malformed** (was 1).

`[MEASURED]` Shared index after the writes carries **exactly** my two entries and nothing else:
`R100 pr-ew-s2a-capacity-service-HOLD.md -> ...-ready.md` and
`D pr-watchdog-heartbeat-during-merge-wait-HOLD.md`.

## FINDINGS

### F-A - The board was idle with zero armed prompts, and that is the thing 00 exists to fix

`[MEASURED]` 0 open PRs, 0 armed, watcher alive and idle, 27 prompts with an open gate and a live
premise. The machine was healthy and doing nothing.

**ACTIONED** - armed `pr-ew-s2a-capacity-service`, one at a time, after the eight-check pre-flight
above. Picked up in ~1s; the chain it unblocks is 2a -> 2b -> 2c -> 2d -> EW-3/4/5.

### F-B - Station 04's F5 (stale staged rename) had already been drained by the concurrent chat

`[MEASURED]` `git diff --cached --name-status` at 07:10:04Z carried
`R100 pr-apierr-s12-ci-gate-HOLD.md -> ...-ready.md` (a **consumed** prompt - it opened #1314). At
07:12:33Z the index was **empty** and the worktree showed an unstaged ` D` for that HOLD.

**ACTIONED (by another actor, verified by me)** - the re-arming hazard is gone. What remains is
cosmetic: 8 unstaged worktree deletions of consumed `-HOLD.md` files, which is queue hygiene, not a
hazard. Folded into the Station 03 dispatch below.

### F-C - Station 03 has been SILENT for 8.2h against a 4h cadence, and there is work waiting for it

`[MEASURED]` `check-breadcrumb --freshness`: `03  last 2026-08-24T23:01:00Z  8.2h ago  SILENT`
(exit 2). Meanwhile the sweep reports machine work that is squarely 03's lane:
`[MEASURED]` watcher clone `branch=main dirty=34` ("NOT clean-on-main; the watcher may refuse to
start"), and 4 orphaned worktrees - `C:/po-worktrees/sot-d-register`, `sot-readme-fetch`,
`sotk-03-ledger`, `C:/po-wt-h`.

**DISPATCHED - Station 03.** Work list, in order: (1) the 34 dirty paths in
`C:\po-watcher\ProjectOperations` - report what they are before touching anything, and remember
`git stash drop`, **never `pop`**; (2) `git status --short` in each of the 4 orphaned worktrees
*before* proposing any prune; (3) the 8 unstaged consumed-`-HOLD.md` deletions in the dev tree.
Also: 03 must say **why** it was silent - "did not run" and "ran and did not report" are different
defects and only 03 can tell them apart.

### F-D - 13 of 15 `gate_allow` prompts are born doomed; nothing bridges front matter to the PR body

`[MEASURED]` (Station 04, F4, re-read not re-measured by me): `pr-gates.mjs:67` reads
`GATE-ALLOW:` out of the **PR body**; `gate_allow:` front matter is read by `lint-prompt.mjs:823`
only. 13 of 15 prompts declaring `gate_allow != none` carry no bare column-0 marker in their body,
and **6 are armable today**. Each would burn an agent run and then red-fail CP-11/CP-12.

**DISPATCHED - Station 06.** RULE 1, complete-and-additive first:
**(a)** have the watcher emit the bare `GATE-ALLOW: <value>` line into the PR body from `gate_allow`
at PR-open time - one writer, every future prompt covered, no prompt bodies edited, no existing data
touched, CP-11 keeps its authority. **(b)** Backfill the 13 bodies by hand - additive, but fails the
*future* half: prompt #16 is born doomed identically. **(c)** Make `lint-prompt.mjs` REJECT such a
prompt - stops the waste but fails the *complete* half, converting a red CI run into a red lint and
still leaving 13 hand edits. (a) and (c) compose; (b) alone does not.
**I did not arm any of the 6** - that is why `pr-ew-s2a` (`gate_allow: none`) was chosen instead.

### F-E - `MISSING_STANDING_AUTHORITY` is WARN-only, and it predicted a lost day of work

`[MEASURED]` (Station 04, F2) `lint-prompt.mjs:710` marks it WARN-only, "does not affect exit code".
It fired on `pr-e2e-container-s1` on 08-20; that run did the work, asked a question into a headless
run, exited 0, and the 116-line artifact was destroyed.

**Step 1 ACTIONED** (grant added to the prompt body this run - see WHAT CHANGED 3).
**Step 2 DISPATCHED - Station 06:** promote `MISSING_STANDING_AUTHORITY` to a **REJECT** (exit 1).
Complete and additive: it adds text only, touches no repo data, and the board is now **57/57**
compliant, so the migration cost is zero files.

### F-F - Every breadcrumb since 2026-08-25T00:00Z is UNTRACKED, and no scheduled station may fix that

`[MEASURED]` `check-breadcrumb` prints `is UNTRACKED - it reaches nobody until a board PR commits it`
for all 5 current breadcrumbs. `[INFERRED]` The authority matrix gives **Create a PR** to 02
(dispatch-only, no schedule), 05 (`/sot/` doc-reconcile only) and 06 (on demand, no schedule) -
and explicitly **not** to 00. So the three stations that actually run on a clock (00, 04, 05) all
write to a channel none of them can close. That is structural, not an oversight by any one run.

**DISPATCHED - Station 06.** Stage a hygiene prompt that commits `docs/pr-prompts/00-*.md` (docs-only,
so the watcher's own `tests-docs` policy merges it). Complete and additive: it adds files, deletes
nothing, and closes the channel permanently rather than once. Until it lands, **project memory
remains the primary channel** - which is where this run's findings also went.

### F-G - Carried forward, still open, still Station 06's

`[INFERRED]` from prior breadcrumbs, re-stated so they do not decay silently:
1. **16 x `Date.now()` in `scripts/pr-watcher/index.mjs`** - every deadline is freeze-blind.
2. **The verdict-archive tick is gated** (`index.mjs:734` logs only when `archived+kept+skipped > 0`),
   so on an empty board the freeze detector goes mute. One unconditional line restores it.
3. **Station doc defect - `00-supervisor.md` section 3b ENSURE-UP** tells 00 to relaunch
   `supervise-watcher.ps1` whenever it is absent. It is now permanently absent **by design** (the
   singlelane launcher replaced it to kill a self-sustaining watchdog loop), so obeying 3b starts a
   second supervisor carrying that loop. The correct check is: Keepalive scheduled task Ready with
   lastResult 0. `[MEASURED]` this run: the sweep reports `auto-restart wrapper: alive (1)`, so the
   trap did not fire today.

**DISPATCHED - Station 06** (all three).

### F-H - `map-locations-waste-rate-coupling` is unblocked and waiting on Marco

`[MEASURED]` Backlog gate check: `>>> UNBLOCKED, BUT NEEDS MARCO`. The measurement that changes the
decision is already in: **all 8 TIP locations match a waste-rate facility exactly, by name** -
observed through the production code path (the "Set" badge on Settings > Map locations renders from
the very string join in question), not inferred from a query.

**ESCALATED - Marco.** RULE 1, complete-and-additive first:
**(a)** Give TIP facilities a real relation - `MapLocation` gains an id that waste rates point at,
and the rename guard becomes an FK. **Solves it completely and additively**: existing rows are
matched 8 of 8 with no fuzzy matching and no hand-built mapping table, and no data entry present or
future is damaged. **(b)** Move the guard to `RateTable` - smallest change, preserves behaviour
exactly, but fails the *complete* half: it keeps the string join and the fragility forever.
**(c)** Drop the guard and warn in the UI - fails the *no-damage* half: renaming a TIP silently
orphans its rates.
**Ordering constraint, and the reason this cannot wait:** it must be settled **before** SLICE 11c
drops `estimate_waste_rates`. After the drop there is no way to tell which facilities had rates, and
option (a) becomes impossible.
**One residual unknown, stated plainly:** the screen proves every TIP has rates; it cannot rule out a
waste-rate facility string with no TIP at all, because such a row renders nowhere. Check that before
committing to (a).

### F-I - `rates-11c-blocked-consumers` is READY TO STAGE

`[MEASURED]` Backlog gate check: `>>> READY TO STAGE - the blocker is GONE`. Both decisions settled
2026-08-19; the four consumer slices are staged but not merged.

**DISPATCHED - Station 06** (staging is 06's lane, not 00's). Note the standing constraint recorded
with the item: 11c must not merge until the **parity proof** (`pr-rates-11b2-c-parity-proof`) has
actually RUN clean - "the instrument exists" is not "the instrument passed".

## WHAT I DID NOT DO

- **Did not arm a second prompt.** ONE AT A TIME. `pr-e2e-container-s1-trial-workflow-HOLD.md` is now
  grant-complete and lint-ADMIT; it is the obvious next arm **once `pr-ew-s2a` settles** - that is its
  named trigger.
- **Did not arm any of the 6 armable `gate_allow` prompts** (F-D). They are born doomed until the
  marker is bridged; arming one would burn an agent run to earn a red gate.
- **Did not create a PR.** LL-38 / the authority matrix: 00 does not create PRs. That is exactly why
  F-F is dispatched rather than fixed.
- **Did not touch the watcher clone, its git, or the 4 orphaned worktrees.** Station 03's lane, and
  the clone is `dirty=34` - precisely the state a second actor should stay out of.
- **Did not clear anything with `git checkout .` / `reset --hard` / `stash pop` / `clean`.** The board
  trap. The one index drain that was needed had already been done correctly by another chat.
- **Did not touch Azure / Entra / SharePoint, `/sot/`, or production data.**
- **Did not restart or kill the watcher.** It was measured alive, ticking on a 5m00s rescan, and
  working a job.

---

**Run end state, 07:27:03Z `[MEASURED]`:** `pr-ew-s2a-capacity-service-ready.md elapsed=600s`, still
running, **0 open PRs** yet - normal for a `size: 3` prompt. The shared index still carries exactly
my two entries. The next 00 run inherits the PR; note **RULE 2** will apply to it if the watcher
routes it to Marco.

**Note for whoever commits this:** this breadcrumb is UNTRACKED until a board PR carries it (F-F).
Its findings are duplicated into project memory, which is the only channel that reliably survives.
