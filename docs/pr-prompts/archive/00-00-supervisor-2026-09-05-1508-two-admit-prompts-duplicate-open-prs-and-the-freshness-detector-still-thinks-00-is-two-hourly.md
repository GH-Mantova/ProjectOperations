# Station 00 — Supervisor | 2026-09-05T15:08Z–2026-09-05T15:4xZ

## GROUND

```
UTC            2026-09-05T15:08:04Z
origin/main    52232fec            (git fetch origin +refs/heads/main:..., then git rev-parse --short)
dev tree       main @ 52232fec     C:\ProjectOperations2   (HEAD == origin/main, 0/0)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run is read-write within its lane.

`[MEASURED]` **SIGHTED run.** `start_process` shell `powershell.exe` → PID 36384, local clock
`2026-09-06T01:08:29+10:00` = **15:08Z**. The first call (a `-Command` form carrying `$env:`) came
back as a **PowerShell parser error from the Windows host** — which is itself proof of reach, and is
DOCTRINE §9.1's pre-expansion trap firing exactly as written. Re-run through
`interact_with_process`, which does not expand.

`[MEASURED]` **The three binding documents were read from `origin/main`'s content**, verified the
sound way (§9.2 — never a piped hash):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY**, in the dev tree `C:\ProjectOperations2`, at
`HEAD == origin/main == 52232fec`. All three read in full.

## WHAT I MEASURED

### Preflight sweep — SAFE TO ACT

`[MEASURED]` `scripts/pipeline/status-sweep.ps1`, captured to a FILE (83,784 B,
`C:\po-sup-fix-scripts\sweep-0006.txt`) because it returns early and hides its own §7 verdict.
Section 0 controls both PASS (`gh` reached GitHub; `node` runs). Section 7:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 3's inputs: `in-progress prompts: 0` · `index.lock interactive/clone: False / False` ·
`git processes running: 0` · `no PR touched on GitHub in the last 2 min`.

### The board — three open PRs, all three Marco's, and I merged none of them

`[MEASURED]` `gh pr view <n> --json number,title,author,labels,mergeStateStatus,files,headRefName`:

| PR | state | labels | files | classification |
|---|---|---|---|---|
| **#1662** | CLEAN (was BLOCKED at 15:09Z; checks settled by 15:2xZ) | `[]` | 6 | `apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/` ⇒ **MARCO'S** |
| **#1665** | CLEAN | `[]` | 8 | `apps/api/prisma/migrations/20260905020000_scope_operational_cost_lines/` ⇒ **MARCO'S** |
| **#1667** | CLEAN | `[]` | 2 | `scripts/pipeline/lint-prompt.mjs` is outside all three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S** |

`[MEASURED]` **RULE 2 probe, on the LIVE tree and never the clone** (§9.5): `docs\pr-prompts\processed`
= **4002** logs, newest `rev-1670-ready.md.log` @ `2026-09-05T14:46:51Z` — younger than the oldest
open PR (#1662, created `11:45:57Z`), which is the control that separates the live directory from the
17-day-stale decoy. POSITIVE `marco.:true` → **612**. NEGATIVE `zzzNoSuchNeedleZzz` → **0**.
Per-PR, over `pr-*.log` only (excluding `rev-*`, §9.5): **#1662 → 0 · #1665 → 0 · #1667 → 0**;
NEGATIVE control `PR #999999` → **0**.

⇒ all three are **`[NO LANE VERDICT — hand-classified]`**, hand-classified by `classifyPolicyFiles`
under §10.1 step 2 as above. §10.1 step 3's known-station-lane exception does not rescue any of them:
00's recorded lane is `docs/`, and none of these three is `docs/`. **#1662 is additionally a
destructive migration** (drops five columns) — DOCTRINE §8.3 escalates that class outright,
independent of lane.

`[MEASURED]` `.arming-log.txt` cross-check: last arm `2026-09-04T22:03:13Z
pr-crmui-account360-s1-tiles-and-next-action`. **No arm inside any of the three PRs' windows**, which
with the zero prompt-logs is the second-lane signature (§10.1 step 2), not a broken probe.

### Machinery — healthy, nothing to lead with

`[MEASURED]` Sweep §2: watcher node **RUNNING pid 20000**, auto-restart wrapper alive (1), heartbeat
age 23 min (ticks only mid-run; stale + empty queue = idle, not wedged). `armed (*-ready.md): 0`.
Watcher clone `branch=main dirty=5`. One orphaned worktree `C:/po-vg` @ `23c91ba9`, **dirty=1,
age 1876 min** — `--force` would discard that file. Both are 03's, both already dispatched.

`[MEASURED]` **The freshness table crossed against `lastRunAt`**, as the COLLECT step requires,
because the breadcrumb is one instrument and cannot name a cause:

| station | `--freshness` | `lastRunAt` (scheduled-tasks MCP) | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | 0.4 h ago, `ok` | `2026-09-05T15:08:04Z` (this run) | 14:45Z | aligned |
| 03 | 16.2 h ago, `ok` | `2026-09-04T23:00:50Z` | 23:01Z | aligned, next fire 23:00Z |
| 04 | 1.0 h ago, `ok` | `2026-09-05T14:09:43Z` | 14:10Z | aligned |
| 05 | 1.0 h ago, `ok` | `2026-09-05T14:10:49Z` | 14:11Z | aligned |

`check-breadcrumb.mjs --freshness` → `CLEAN`, exit **0**; structure `3 checked, 0 malformed`.
**No station is SILENT and none is owed a run** — but see FINDING F2 for how much weight that `ok`
can carry for `00` specifically.

### The HOLD board

`[MEASURED]` `scripts/pipeline/triage-holds.ps1` → `spent=0 gates-satisfied=40 still-gated=42
unreadable=0 of 82`, exit 0, calibrated on 2 distinct verdicts (ADMIT, REJECT) with the SPENT fixture
control reachable. Read-only; nothing was armed, renamed, moved or staged. **82 HOLDs, against 79 on
2026-09-04T22:0xZ** — three staged since.

## WHAT CHANGED

**On the board:** nothing merged, nothing labelled, nothing closed, **nothing armed**. This PR opened.

**In the dev tree:** nothing. `git diff --numstat` and `git diff --cached --name-status` were both
EMPTY at the start of the run and were not touched.

**In an isolated worktree off `origin/main`** (`C:\po-wt\board-1508`, branch
`board/00-collect-2026-09-05-1508`, clean at checkout): the two docs edits below, the three collected
breadcrumbs archived, and this report.

`[MEASURED]` Both edits built by **string concatenation** — no `String.replace` replacement string
anywhere (§9.3, the trap that injected 7,734 B into the memory index on 09-04) — and each anchor
asserted unique before writing:

```
DOCTRINE.md                bytes 81709 -> 83983   delta=+2274  == asserted expected   numstat 35 0
STATION-CAPABILITIES.md    bytes 24918 -> 26367   delta=+1449  == asserted expected   numstat 17 0
```

Both are **additions only** — `0` deletions on each — so there is no line-ending churn hiding a
rewrite. `node scripts/pipeline/lint-station.mjs` → exit **0**, `ADMIT: all 8 docs clean`, **after**
the edits: the two hash-gated canonical blocks (`instruments v2` = §9, `station-contract v2` = the
station docs) are untouched, which is why the new DOCTRINE text is §10.6 and not a §9 bullet.

## FINDINGS

Station 05's five findings from `00-05-sot-keeper-2026-09-05-1411-*` are collected below as C1–C5,
followed by this run's own two.

### C1 (05) — `sot/02` §2 has been false for 32 days and ELEVEN breadcrumbs have said so

05 measured `sot/02-roadmap-and-status.md:61` still heading `In-PR - open right now (2)` and naming
**#894** and **#895**, both MERGED 2026-08-04 — 32 days stale — against a live open set of
#1662/#1665/#1667. It filed RULE 1 options (a)/(b)/(c) and escalated rather than narrowing its own
safety rule.

**DISPOSITION: ESCALATED — carried forward unchanged, and it is correctly 05's call, not mine.**
`sot/` is Station 05's lane and nobody else's (CP-24, no escape hatch), so I cannot action it even if
I agreed with option (a); and narrowing a never-auto-fix rule about Marco's own roadmap prose is a
§5.5 design question either way. What I add is the count: 05 says ten prior filings, its own makes
**eleven**, and this collect is the first time the loop has been named in a Station 00 breadcrumb
rather than only in 05's. **The finding is the loop, not the drift** — the station that can see it is
forbidden to fix it, and the stations that could fix it never run the probe.

### C2 (05) — 32 of 81 API modules are absent from `sot/01`'s module registry

**DISPOSITION: DEFERRED**, agreeing with 05's own reading and its urgency condition verbatim: it
becomes urgent the moment `sot/01`'s registry is used to *gate* anything — a permission map, a nav
generator, an ownership matrix — because a 40% blind spot then stops being documentation debt and
starts routing decisions. Nothing does that today. Not mine to decide in any case (`sot/`).

### C3 (05) — a `DO NOT ACT` verdict was TRANSIENT and 05's first explanation for it was wrong

05 read `git processes running: 2` at 14:11Z, hypothesised the sweep counts its own git children,
then **refuted itself** by re-running the whole named probe at 14:24:49Z and getting `0`.

**DISPOSITION: ACTIONED by 05; I am recording that it needs nothing from me.** This is the correct
shape and worth naming: 05 was one write away from dispatching Station 03 to repair a working
instrument, and the only thing that caught it was that the pre-mutation re-run is mandatory anyway. I
re-ran `status-sweep.ps1` myself this run and got `git processes running: 0` and `SAFE TO ACT` — a
third independent reading agreeing with 05's second. Nothing to hand to 03.

### C4 (05) — `C:/po-vg` holds one uncommitted file; the watcher clone is not clean on main

**DISPOSITION: DISPATCHED → Station 03, already open; I am confirming it rather than re-filing.**
`[MEASURED]` this run, one hour after 05: `C:/po-vg` @ `23c91ba9` `[fix/no-rebase-while-checks-run]`
**dirty=1, age 1876 min** (05 read 1819 — the same file, ageing, not a new one), and the watcher clone
is now **dirty=5** where 05 read 4. 03 fires next at `23:00Z`. 🔴 **`git worktree remove --force`
would DISCARD that file**, and destroying it is a §5.4 hard stop regardless of lane.

### C5 (05) — no sweep report was written on 2026-09-03 or 2026-09-04

05's own station doc prescribes **two** artifacts (a breadcrumb and a `docs/data-model/sweeps/*.md`)
where the canonical `station-contract v2` prescribes one, so the two runs that skipped the sweep file
were following the newer rule.

**DISPOSITION: DEFERRED, and it stays 05's to fix.** The clean cure is one edit to
`docs/pipeline/stations/05-sot-keeper.md` making the breadcrumb the single required artifact and the
sweep file explicitly optional. I did **not** fold it into this PR: a station doc is the layer its own
station may change, and 00 editing 05's brief to resolve a conflict 05 itself reported is how a
dispatch turns into a second author. **What makes it urgent:** a third skipped sweep file being read
as a missed run.

---

### F1 (this run) — TWO `ADMIT` prompts describe work already open as #1662 and #1665, and both stay armable until those PRs MERGE

`[MEASURED]` at `52232fec`. The watcher deletes a prompt when it builds it; **a second lane never
touches the queue at all** (§10.2), so second-lane work leaves its `-HOLD.md` in place with its
premise intact — and `triage-holds.ps1` then lists it under `GATES SATISFIED — CANDIDATES`, which is
precisely where an arming decision looks. Both of this run's instances are in that bucket of 40:

| `ADMIT` prompt | `scope:` | open PR | PR files | matched |
|---|---|---|---|---|
| `pr-plantdays-retire-and-drop-HOLD.md` | 6 | **#1662** | 6 | **6 of 6** |
| `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md` | 8 | **#1665** | 8 | **8 of 8** |

The premises are still true because they are keyed to `main`:
`grep -q "scopeItem.hookTruckDays" …scope-of-works.service.ts` and
`! grep -q "ScopeOperationalCostLine" …schema.prisma` both still hold, and will until those PRs merge.
So for the entire time #1662 and #1665 wait on Marco — indefinitely, since both are migrations —
arming either opens a **duplicate PR for work already open**.

`[MEASURED]` The standing head-branch test would have caught both, because this lane names its branch
after the prompt slug (`pr-plantdays-retire-and-drop`, `pr-scopecosts-s1-operational-cost-lines-api`).
**But that is the other lane's convention, not a property of the prompt:**
`Select-String -Pattern 'branch|headRef'` over both prompt files returns **0**. A branch test is
checking something the prompt never asserted, and it can stop working silently the first time a lane
names a branch differently.

**DISPOSITION: ACTIONED in this PR.** New **DOCTRINE §10.6** records the mechanism, both measured
instances, and the durable test — cross the prompt's `scope:` list against
`gh pr list --state open --json number,files`, **not** the head branch. §10.6 sits outside the
`instruments v2` canonical block, so it costs no hash re-record (`lint-station.mjs` exit 0 before and
after). **I armed nothing this run**, and these two are the reason the ADMIT bucket of 40 was not
mined for a candidate.

### F2 (this run) — the cadence correction that landed 24 minutes ago missed the instrument, and `--freshness` still will not call `00` SILENT for 4 hours

`[MEASURED]` `scripts/pipeline/check-breadcrumb.mjs`, anchor `const CADENCE =`:
`{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`; NEGATIVE control `zzzNoSuchNeedleZzz` over the
same file → **0**. `[MEASURED]` live cron from the scheduled-tasks MCP: `00-supervisor` =
**`5 * * * *`**, hourly. `03` = `0 9 * * *` (matches its `24`), `04` = `0 */4 * * *` (matches its `4`).
**`00` is the only wrong row**, and it is wrong by 2x.

`#1670` — this station's own PR, merged `14:49Z`, **24 minutes before this run started** — corrected
`STATION-CAPABILITIES.md` §6 to say `00` is hourly. It did not touch the instrument, because the
finding it was actioning (04's F4) was about the documented cadence. So the number now disagrees with
itself across two files in the same repo, and the copy a run *executes* is the stale one:
`--freshness` will not print `SILENT` for `00` until **4 h**, i.e. only after **three** consecutive
missed hourly runs. That is open escalation #23's failure mode — erring toward not noticing — sitting
inside the probe the COLLECT step is told to start with.

**DISPOSITION: ACTIONED (the docs half) in this PR; the one-character code fix is ESCALATED.**
`STATION-CAPABILITIES.md` §6 now carries the third-copy warning with its own falsifying probe, so any
run reading a green `ok` for `00` knows how weak that statement is and is sent to `lastRunAt` instead —
which the COLLECT step already requires and which this defect does not touch. The fix itself
(`'00': 1`) is a `scripts/` change, outside 00's recorded lane to merge (§5 matrix; and
`check-breadcrumb.mjs` is outside all three `NESTED_TEST_PATHS` forms), and it is filed for Marco in
the needs-marco queue **alongside** the still-unanswered `lint-station.mjs` version-field question —
deliberately in the same file, because both ask him the identical one-line question: *may Station 00
land small `scripts/pipeline/` corrections directly, or must they be staged as prompts and armed?*
**One answer unblocks both.** I did not open a third `scripts/` PR: `#1667` is already open, green and
unmerged from this station's 14:08Z run, and the pending question is precisely whether that PR should
have existed.

## WHAT I DID NOT DO

- **Merged nothing on the board.** #1662, #1665 and #1667 are all hand-classified MARCO'S with the
  probe controlled in both directions; #1662 is additionally a destructive column drop (§8.3). All
  three are CLEAN and green — none of them is waiting on me for anything.
- **Armed nothing**, from an `ADMIT` bucket of 40. F1 is the measured reason: two of those 40 are
  duplicates of open PRs, and the ones I did not individually clear were not cleared. The board's
  throughput constraint is Marco's review queue, not the arm rate — arming faster makes that queue
  longer, not shorter.
- **Did not remove or apply any label, and authored no `merge-approvals/` receipt.** No agent may.
- **Did not touch `sot/`** (C1, C2 and C5 all point there and all are 05's), **the watcher clone**
  (`dirty=5`), or **`C:/po-vg`** (`dirty=1`) — the last two are 03's and already dispatched.
- **Did not edit `§9`, `§9.5`, or any canonical block.** The new material is §10.6 and a §6 addendum,
  both outside the hash-gated blocks, verified by `lint-station.mjs` exit 0 on both sides of the edit.
- **Did not fold F2's one-line fix into `#1667`.** Amending an open PR Marco is reviewing changes what
  he is reviewing after the fact, and `#1667`'s stated scope is the `Arm ONLY` marker.
- **Did not run `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere**, and did not
  run `git` through any VM-side transport against the Windows `.git`.
