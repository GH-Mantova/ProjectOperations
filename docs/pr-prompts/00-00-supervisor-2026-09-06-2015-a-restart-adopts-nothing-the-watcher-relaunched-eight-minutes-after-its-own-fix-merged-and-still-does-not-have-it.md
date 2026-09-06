# Station 00 — Supervisor | 2026-09-06T20:09Z–2026-09-06T20:2xZ

## GROUND

```
UTC            2026-09-06T20:09:29Z
origin/main    90ed644d            (fetched, then rev-parse)
dev tree       main @ 90ed644d     C:\ProjectOperations2   (opened 2 behind at f95d1793; fast-forwarded this run)
doc version    1
bootstrap      1
```

Sighted run. `start_process` shell `powershell.exe` succeeded on the first call after the schemas
were loaded, so this is a SIGHTED run and not a quiet blind one. Device-bridge git guard installed
at the top of the run, last line quoted verbatim:
`vm-git-guard installed at /sessions/lucid-zealous-carson/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`.

All three binding documents were read from the dev tree after confirming the dev tree is not stale
against them: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (no pipe, no hash
comparison — PREFLIGHT step 2).

## WHAT I MEASURED

**Sweep verdict: SAFE TO ACT.** [MEASURED] `status-sweep.ps1` captured to a file rather than read
from the stream (it returns early and hides its own §7 verdict otherwise), exit 0, §0 controls both
`[LIVE]`: 0 in-progress prompts, `index.lock` False/False in both trees, 0 git processes, no PR
touched on GitHub in the last 2 min.

**The board is ONE open PR and it is Marco's.** [MEASURED] `gh pr list --state open` → **1**.
`#1713` `feat/linefields-s1-model-and-validation`, created `11:46:21Z`, `mergeStateStatus BLOCKED`,
`labels []`, 12 files including
`apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql`. RULE 2 probe, LIVE tree
only (`C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone): **2012** logs, newest
`2026-09-06T19:31:09Z` — younger than the PR's `createdAt`, which is the control that separates the
live directory from the 17-day-stale decoy — `marco.:true` **617**, NEGATIVE control (a needle
minted this run) **0**, `PR #1713\b` over `pr-*.log` **0**, POSITIVE control `PR #1606\b` → **2**.
So: `[NO LANE VERDICT — hand-classified]`, and `classifyPolicyFiles` refuses it on its
`(^|/)migrations/` clause ⇒ **MARCO'S**. Its last red is not red: `tendering-e2e` /
`Tendering Browser Smoke` run `34057040894` was **created `20:08:11Z`**, `status in_progress` —
six minutes old at the time of reading, not a stall.

**The watcher relaunched EIGHT MINUTES AFTER its own fix merged, and still does not have it.**
[MEASURED] `#1704` (`VERDICT_HOME_RESOLVER_V1`) merged **`2026-09-06T11:41:36Z`**; the live watcher
node **pid 27236 started `2026-09-06T11:49:57Z`** — eight minutes later — and
`Select-String -Path scripts\pr-watcher\index.mjs -Pattern 'VERDICT_HOME_RESOLVER'` in
`C:\po-watcher\ProjectOperations` returns **0** (POSITIVE control `classifyPolicyFiles` → **2**;
NEGATIVE control, a needle minted this run → **0**). `#1731`
(`VERDICT_HEADING_TOLERANT_V1`) merged `19:45:57Z` and is likewise absent: `VERDICT_HEADING_TOLERANT`
→ **0**. The clone is at `16ddb58b`; `git rev-list --count 16ddb58b..origin/main`, run in the dev
tree because the clone's own `origin/main` is pinned at launch, → **27 behind** (22 at 19:08Z,
19 at 17:08Z, 18 at 16:12Z).

**The watcher family, re-measured — PIDs are state.** [MEASURED] `Get-CimInstance Win32_Process`
filtered by command line: **9** processes (8 at 17:08Z and 19:08Z). Live chain
`24952 (watcher-launcher, 05:35:03Z) → 28392 (11:49:55Z) → 27236 (node, 11:49:57Z)`; node uptime
**8.4 h**, so the watchdog kill loop is still not reproducing. Clone dirty = **1** untracked file,
`docs/pr-reviews/pr-1713-review.md` — down from three, because `pr-1709` and `pr-1731`'s reviews
left with their PRs. Stashes **69**, unchanged.

**Queue.** [MEASURED] armed (`*-ready.md`) **0** — unchanged for 11 hours; newest `.arming-log.txt`
row is still `2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver`. `needs-marco/` 29,
`no-pr-opened/` 109, `failed/` 41, `blocked/` 123.

**Collect.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0,
`structure: 5 checked, 0 malformed`, every station `ok`, `CLEAN`. Crossed against `lastRunAt` from
the scheduled-tasks MCP: 00 `20:08:18Z`, 04 `18:09:56Z`, 05 `14:11:01Z`, 03 `2026-09-05T23:01:01Z`
— each aligned with that station's newest breadcrumb, so no station is in either of the two failure
rows of the freshness table. Five breadcrumbs in the queue root, all tracked on `origin/main`, all
five with every finding carrying a disposition (`### F` / disposition grep over all five).

## WHAT CHANGED

- **Dev tree fast-forwarded** `f95d1793` → `90ed644d` (`#1731`, `#1709`). Read back all three:
  `git rev-list --left-right --count HEAD...origin/main` → `0	0`, `git diff --numstat` → EMPTY,
  `git diff --cached --name-status` → EMPTY. No breadcrumb blocked it — this run's own breadcrumb
  was written inside the PR worktree (cure 1), and the five already in the root are tracked and
  byte-identical to `main`.
- **One board PR**, carrying this breadcrumb and archiving three collected breadcrumbs.
- **Armed 0 before, 0 after. Merged nothing but this PR. No label touched, no clone write, no
  process killed, no worktree pruned.**

## FINDINGS

### F1 — a restart adopted nothing, because nobody fast-forwarded the clone first: DISPATCHED

DOCTRINE §9.5 says *"a restart adopts nothing — the watcher runs `index.mjs` from the clone, so the
clone must be fast-forwarded before a restart changes any behaviour."* Today is a dated instance of
it: the node **restarted eight minutes after `#1704` merged** and picked up nothing, because the
restart came from the watchdog kill loop rather than from a maintenance action, and the clone was
never fetched. Two watcher fixes are now stranded — `#1704` (the verdict-home resolver, which
`#1726`/`#1728` established is the cause of the review-verdict starvation) and `#1731` (verdict
headings) — and the clone is **27** commits behind.

**DISPATCHED → Station 03**, next occurrence `2026-09-06T23:00:45Z`. This supersedes the identical
dispatch in `#1727`/`#1728`/`#1732` only in its numbers, which are state; the sequence is unchanged
and every step is 03's, not mine — the fast-forward is a `git` write inside
`C:\po-watcher\ProjectOperations`, which this station may never make:

1. report each of the **9** watcher-family processes before killing anything, and leave exactly one
   family alive;
2. **preserve `docs/pr-reviews/pr-1713-review.md`** — it is untracked in the clone and `#1713` is
   still open, so it is live evidence, not litter;
3. `git stash drop`, never `pop` (69 stashes, a closed loop);
4. fast-forward the clone to `origin/main`, then restart in an idle window (armed 0 makes now idle);
5. **read back `VERDICT_HOME_RESOLVER` and `VERDICT_HEADING_TOLERANT` in the clone's `index.mjs`** —
   both must be non-zero, with `classifyPolicyFiles` as the positive control. A restart whose
   read-back is only "the node came back" proves nothing, which is the whole point of this finding.

**Do NOT re-arm `pr-watcher-verdict-home-resolver`** — it shipped as `#1704`; leave the `-LOOPING.md`
on disk.

### F2 — 03's daily cadence is not just a blind window; it is a hard latency floor on the watcher's own fixes: ESCALATED

The open escalation `needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`
argues the cadence from *measurement coverage* — a watcher death shortly after 23:00Z sits unseen
for ~22 h. Today supplies a second, sharper argument that was not on file: **Station 03 is the only
actor permitted to fast-forward the clone and restart the watcher** (00 is forbidden `git` writes in
`C:\po-watcher\ProjectOperations`; 04 and 05 are read-only in it), so at a daily cadence **a
watcher-code fix cannot take effect for up to 24 hours after it merges, no matter how urgent.**
[MEASURED] today: `#1704` merged `11:41:36Z`, `#1731` merged `19:45:57Z`, and at `20:16Z` the
running watcher has neither, with the earliest possible remedy `23:00:45Z` — **11.3 h** of latency
on the first fix, in a pipeline that merged four watcher-affecting PRs in one day.

**ESCALATED — appended to the existing escalation file, deliberately NOT opened as a new one.**
Station 04 measured at 18:10Z that `status-sweep.ps1` §5 currently tells every reader to clear 26 of
the 29 open escalations; adding a 30th makes that worse. The appended note strengthens option **(1)**
already on file (set 03's live cron to `0 */4 * * *`, matching its own bootstrap and
`STATION-CAPABILITIES.md` §6) — complete immediately, because it cuts the worst-case latency from
24 h to 4 h; complete in future, because the three layers stop disagreeing; and additive, because 03
is report-only and writes no data. It also names a composition Marco should see: the alternative of
making the launcher self-refresh sits inside
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` — the launchers live outside both git
repos, so that route cannot be reviewed or gated until the chain is versioned. **The cron is Marco's
to change; it lives in the scheduled-tasks layer, not this repo.**

### F3 — the whole open board is one migration PR and it is Marco's: ACTIONED as a classification, nothing merged

`#1713` is unlabelled, so nothing on the PR itself says who owns it; the classification is the
measurement above — no watcher verdict, and `classifyPolicyFiles` refuses it on the `migrations/`
clause. Recorded as `[NO LANE VERDICT — hand-classified]`. Its remaining check is a six-minute-old
`in_progress` browser smoke, not a failure, so there is no red for this station to root-cause.
**ACTIONED** — classified and left alone. **Merged nothing.**

### F4 — armed 0 for eleven hours, and I armed nothing again: DEFERRED

Arming now would be built by a watcher **27** commits stale, running pre-`#1704` code whose measured
defect is that the review verdict never reaches `verdictApproves` — so the `tests-docs` lane would
time out and write `{"ok":false,"marco":true,…}`, which is byte-identical to a genuine routing and
permanently human-gates a PR nobody needed to gate. **Arming now manufactures Marco-work.**

**DEFERRED. What makes it act-able is unchanged and precise:** F1 landing — clone fast-forwarded and
the watcher restarted with both markers reading non-zero. Then arm exactly ONE `tests|docs`-only
prompt, one at a time, after RULE 4's three-marker detector (`DO_NOT_ARM_COMMENT` and `ARM_ONLY`
case-**insensitively**, `DO_NOT_ARM_CAPS` case-sensitively) and after reading the body for a prose
gate. Still on the never-arm list: `pr-sweep-stale-check-retires-live-escalations-HOLD` (routes to
Marco) and `pr-hygiene-s1-guarded-branch-prune-HOLD` (would delete `#1612`'s only copy).

### F5 — `C:\po-vg` still holds the only copy of one file: DEFERRED

[MEASURED] from the sweep: orphaned worktree `C:/po-vg` at `23c91ba9`
`[fix/no-rebase-while-checks-run]`, dirty **1** file, age **3617 min**. Already escalated as
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`. **DEFERRED** — it
becomes urgent the moment anyone prunes worktrees, because `git worktree remove --force` would
discard it. Unchanged from 19:08Z except its age.

### F6 — five collected breadcrumbs, every finding dispositioned; three archived: ACTIONED

All five 2026-09-06 breadcrumbs in the queue root (`00` at 1810, 1830, 1908, 1930 and `04` at 1810)
carry a disposition on every finding, verified by grepping `### F` against the four disposition
words in all five files. **ACTIONED** — `git mv` of the three oldest (`00-1810`, `00-1830`,
`04-1810`) into `docs/pr-prompts/archive/` in this PR. The 1908/1930 pair is the immediately
preceding cycle and stays in the root, per the station doc's *"leave the CURRENT cycle in the root"*.
Archiving is safe for freshness: `check-breadcrumb.mjs` builds its tracked set with `git ls-tree -r`
and matches by trailing path segment, so an archived breadcrumb still counts and can never make a
station read SILENT.

## WHAT I DID NOT DO

- **Did not touch the clone.** Not the fast-forward, not the stashes, not the restart, not the
  untracked review file. All four are `git` or process writes inside
  `C:\po-watcher\ProjectOperations` and belong to Station 03 — doing them myself is LL-38 exactly.
- **Did not merge `#1713`**, and did not enable auto-merge on it. It is a migration and therefore
  Marco's under `classifyPolicyFiles`; its own CI is still running.
- **Did not open a 30th `needs-marco/` file.** The cadence escalation already exists and the new
  measurement belongs inside it.
- **Did not clear or re-date any open escalation**, including the 26 the sweep's §5 currently
  suggests clearing — 04's 18:10Z finding is that the sweep is wrong about those, and it is
  published on `main` as a tracked `-HOLD.md`.
- **Did not restart the watcher on my own authority.** `restart-watcher-if-wedged.ps1` would report
  *"OK — nothing armed"* with 0 armed, and a stale-but-running watcher is neither WEDGED nor DOWN.
  A restart without a preceding clone fast-forward is precisely the no-op this run's F1 measured.
