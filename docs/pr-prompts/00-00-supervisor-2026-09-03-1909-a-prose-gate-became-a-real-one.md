# Station 00 — Supervisor | 2026-09-03T19:09:06Z–2026-09-03T19:2xZ

## GROUND

```
UTC            2026-09-03T19:09:06Z
origin/main    bf0fa62a            (git fetch --prune, then rev-parse)
dev tree       main @ bf0fa62a     C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions agree, so this run was NOT read-only-by-mismatch.
**SIGHTED, not blind.** `start_process` (powershell.exe) returned PID 32628 on the first call
and every measurement below is a Windows-host probe. This was not a quiet blind run.

The dev tree is byte-for-byte `origin/main` (`rev-list --left-right --count origin/main...HEAD`
→ `0 0`), so reading the station doc from the working copy was safe this run.

## WHAT I MEASURED

**Board — unchanged from 18:2xZ, and still four PRs that only Marco can move.**
[MEASURED] `gh pr list --state open --json number,mergeStateStatus,labels,baseRefOid`:

| PR | state | base | classification |
|---|---|---|---|
| #1544 | UNKNOWN | `6c0012ea` (behind) | MARCO'S — `.claude/agents/**`, `scripts/pipeline/**` (hand-classified, no lane verdict) |
| #1543 | CLEAN | `bf0fa62a` | MARCO'S — genuine `marco:true` |
| #1541 | CLEAN | `bf0fa62a` | MARCO'S — genuine `marco:true` |
| #1536 | BLOCKED, `do-not-merge` | `bf0fa62a` | MARCO'S — genuine `marco:true` |

[MEASURED] RULE-2 probe `Select-String -Path docs\pr-prompts\processed\*.log -Pattern 'marco.:true'`
→ **POS 606**; negative control `zzzz-no-such-needle-zzzz` → **0**. Two opposite questions, two
opposite answers, so the empty side is informative. **Armed `*-ready.md` = 0**, counted directly
(`Get-ChildItem docs\pr-prompts -Filter *-ready.md -File`), not quoted from a note.

**Machinery: SAFE.** [MEASURED] `status-sweep.ps1` §7 → `SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees` (19:09:40Z). Watcher node
**pid 24744**, ppid 27684; **0** in-progress prompts; **no `.git\index.lock`**;
`git worktree list` → dev tree on `main @ bf0fa62a` plus the three known orphans
(`po-1483-fix`, `po-sa-fix`, `po-work/s2-e2e`), all Station 03's and all already reported.

**Freshness, crossed against `lastRunAt` AND the schedule — the three-instrument rule.**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 2, `SILENT: 1 station`:

```
00  last 2026-09-03T18:09Z   1.0h  (cadence 2h)   ok
03  last 2026-09-01T23:02Z  44.1h  (cadence 24h)  ok
04  last 2026-09-03T18:10Z   1.0h  (cadence 4h)   ok
05  last 2026-09-01T14:11Z  53.0h  (cadence 24h)  SILENT
```

[MEASURED] `list_scheduled_tasks` disagrees with two of those four lines, exactly as escalation
#23 predicts:

| station | `lastRunAt` | `nextRunAt` | reading |
|---|---|---|---|
| 03 | **2026-09-01T23:01:43Z** | 2026-09-03T23:00:45Z | **`ok` IS WRONG** — one whole occurrence (09-02T23:00Z) never fired |
| 04 | 2026-09-03T18:10:22Z | 2026-09-03T22:09:31Z | healthy, aligned |
| 05 | **2026-09-03T14:11:26Z** | 2026-09-04T14:10:37Z | **`SILENT` IS WRONG about 05's health** — it fired 5 h ago and produced no breadcrumb |

[INFERRED] 03's missing 09-02T23:00:45Z occurrence falls **inside** the already-measured 17.8 h
all-stations session hole (09-02T06:10:27Z → 23:58:18Z). That is an outage casualty, not a
station defect, and 03 is not stopped: it fires again tonight at 23:00:45Z.

[INFERRED, from the 15:0xZ run's MEASURED transcript read] 05's 14:11:26Z run died on
`API Error: 529 Overloaded` on the first assistant turn — a run recorded in `lastRunAt` having
executed nothing. **Not re-read this run** (the datum is about the same single run and was read
by a probe I would only be repeating), so this line is INFERRED, not MEASURED.

**Station 04's breadcrumb, collected.** [MEASURED]
`00-04-scanner-2026-09-03-1810-gate-liveness-two-holds-claim-a-gate-they-never-declared.md`,
untracked in the dev tree, three findings, all three dispositioned below.

**Sweep §5 stale-claim cross-check.** [MEASURED] 24 `[STALE]` lines naming merged PRs across six
`needs-marco/` files; **3 `[LIVE]`** — `hourly-board-pr-rebases…` → #1543 and #1541,
`tests-docs-lane-deadlock…` → #1541. Nothing in the `[STALE]` set is repeated as current here.

## WHAT CHANGED

All of it in one disposable worktree off `origin/main` (`C:\po-worktrees\00-1909`, branch
`chore/board-2026-09-03-1909`), torn down at the end of the run. Nothing was written to the
shared dev tree, the watcher clone, or `/sot/`.

- **Declared the two prose gates for real** — `pr-bp-s2-worth-chasing-view-HOLD.md` and
  `pr-ea-s2-dashboard-preset-HOLD.md` each gained the `requires_on_main` key their bodies already
  claimed to have, and the four prose references to the non-existent `requires_file_on_main` now
  name the key that exists. See F1.
- **Retired one spent HOLD** — `pr-tfm-s10-guard-site-fallback-HOLD.md` → `superseded/`. See F4.
- **Published 04's staged fix** — `pr-lint-requires-merged-gate-unevaluated-HOLD.md` committed,
  **NOT armed**. See F3.
- **Committed `docs/pipeline/sweep-rotation.json`** — 04 advanced it and may not commit; without
  this its next run repeats `gate-liveness` instead of `instrument-honesty`.
- **Committed 04's breadcrumb**, and archived my own two dispositioned ones (1709, 1809) to
  `docs/pr-prompts/archive/`.
- **Nothing armed, nothing disarmed, nothing merged of Marco's, no label added or removed, no
  `/sot/` edit, no Azure / Entra / SharePoint contact of any kind.** Armed count 0 → 0.

## FINDINGS

### F1 — S3 — Two HOLDs asserted a gate that did not exist. It exists now. **ACTIONED.**

Station 04 measured it and, correctly for its lane, refused to fix it: `bp-s2` and `ea-s2` each
say twice in the body that the predecessor is "gated by `requires_file_on_main` above", and
**neither front matter carried any dependency key at all**. `hasDeclaredDependencies` returns
false on that shape (asserted at `scripts/pr-watcher/__tests__/dispatch-gate.test.mjs:14`), so
the watcher would have dispatched both immediately with no gate evaluated, while `-HOLD`, the
lint ADMIT and the body's own reassurance all read as "chained".

04 dispatched it to **06 (PR Master)**. **06 has no cadence** — that is itself an open escalation
— so a dispatch to 06 is a dispatch into a void, and this is the "DISPATCHED → a FUTURE RUN"
trap the ledger already names. The repair is two front-matter lines on two `docs/` files, which
is my lane, so I did it rather than hand it to a station that does not wake.

[MEASURED] Added, byte-safely (`latin1` round-trip, so the CP1252 mojibake already in both files
is untouched — non-ASCII byte count before/after: bp `59 → 59`, ea `105 → 105`, IDENTICAL):

```
pr-bp-s2: requires_on_main: 'apps/api/src/modules/tendering/tendering.controller.ts :: priority-ranking'
pr-ea-s2: requires_on_main: 'apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts :: estimator-turnaround'
```

[MEASURED] Both still `ADMIT` after the edit (bp size 5, ea size 9, exit 0) — so the gate is
satisfied *and now actually evaluated*. **Negative control**, the one that makes the ADMIT mean
something: `pr-cardui-s6-other-operational-costs-HOLD.md` → exit 1,
`GATE_NOT_RELEASED: requires_on_main … needle not found in origin/main`. The gate checker is
live and does reject, so an ADMIT here is a real answer, not a broken query.

Also replaced the four prose mentions of `requires_file_on_main` with `requires_on_main`
(1 heading line + 1 "Do NOT use" line per file; `left=0` on a read-back grep). Doing it in a
disposable worktree is what made this safe: recovering these files with `git checkout --` inside
`docs/pr-prompts/` is THE BOARD TRAP, so the only sound revert path was to not touch the dev tree.

### F2 — S2 — The freshness detector was wrong about two of four stations in the same print. **ESCALATED (existing file — new evidence, no new question).**

Today's run is the cleanest instance yet of escalation #23, because both failure directions
appeared in one output: `--freshness` printed **`03 … ok`** for a station that missed an entire
occurrence, and **`05 … SILENT`** for a station that had fired five hours earlier. A detector
that is wrong in both directions at once cannot be used to decide anything on its own.

The evidence is in WHAT I MEASURED. What is new: 03's miss is now attributable without ambiguity
— `lastRunAt` 09-01T23:01:43Z and `nextRunAt` 09-03T23:00:45Z bracket exactly one skipped daily
occurrence, and it lands inside the known 17.8 h hole.

Options unchanged and still Marco's, because a false SILENT licenses destructive action
(DOCTRINE §7): **(a) record each station's real cadence and alarm at `1× cadence + grace`** —
complete and additive, so RULE 1 puts it first; **(b) fix only 00's `2` → `1`** — fails
*complete*, it leaves every other station's single-miss blind spot; **(c) drive the check off
`lastRunAt` plus the session-directory grouping** — necessary alongside (a), because it is the
only instrument that separates *never fired* from *fired and died*, but it cannot replace (a)
since the MCP is unreachable from CI.

Filed at `docs/pr-prompts/needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`.
**No new question is raised; the threshold is still his call.** Nothing here is re-escalated.

### F3 — S3 — `requires_merged` is a gate the arming path cannot see. Fix published, deliberately NOT armed. **DEFERRED.**

04's F2, verified rather than repeated: [MEASURED] `pr-lint-requires-merged-gate-unevaluated-HOLD.md`
lints `ADMIT (size 3)`, exit 0, in a clean worktree off `origin/main`. It is now **committed and
tracked**, which it had to be before it could ever be armed — arming is a `git mv` of a *tracked*
HOLD, and an untracked one cannot be armed at all.

**I did not arm it, and that is a decision, not an omission.** Its scope is `lint-prompt.mjs`,
so the PR it opens is outside `tests/` and `docs/` and the watcher routes it to Marco (RULE 2).
The board already holds four PRs that only Marco can move. Arming a fifth makes his queue longer,
not the board faster — the throughput constraint stated exactly. The standing rule is to ask
first whether to arm at all, and Marco is not present on a scheduled run.

**What would make this urgent:** a `requires_merged` gate pointing at a PR that is *not* merged.
[MEASURED by 04, at `e7f55174`] all 6 declaring HOLDs point at MERGED PRs (#1361, #1317, #1351,
#1348, #1257, #1111), so the defect is latent. It becomes operative the moment a 7th is staged
against an open PR. **Question banked for Marco: arm it, or leave it staged?**

### F4 — S4 — One HOLD was spent. Retired. **ACTIONED.**

[MEASURED] `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-tfm-s10-guard-site-fallback-HOLD.md`
→ exit **3**, `STALE … The work is ALREADY DONE`. **Positive control** on the same command in the
same shell: `pr-lint-requires-merged-gate-unevaluated-HOLD.md` → exit 0 ADMIT, so exit 3 is a
verdict and not the linter failing on everything. That is the second instrument agreeing with
04's premise-execution harness.

`git mv docs/pr-prompts/pr-tfm-s10-guard-site-fallback-HOLD.md docs/pr-prompts/superseded/`,
staged as `R100`. [MEASURED] `superseded/` carries 278 tracked files on `origin/main`, so it is a
real home and not a gitignored sink.

### F5 — S4 — #1544 is UNKNOWN on a base 1 commit behind. **DEFERRED.**

[MEASURED] `#1544 mergeStateStatus=UNKNOWN, baseRefOid=6c0012ea` while `origin/main` is
`bf0fa62a`. UNKNOWN is GitHub's *"not computed yet"*, i.e. a stuck cache, not a failure — and
`mergeStateStatus` from `gh pr list` is a cached rollup that must be confirmed per-PR before it
is believed. It is Marco's PR either way, so nothing I do changes when it can move.

**What makes it urgent:** UNKNOWN persisting after its base moves. It will move on its own —
`PR_WATCHER_AUTO_UPDATE=true` (`start-watcher.ps1:159`) rebases every BEHIND PR on a timer, so
merging this run's board PR will itself re-base and re-check #1544 within minutes. That is
escalation #24's churn working in our favour for once; it is still ~4 CI cycles/hour spent on
work that cannot move.

## WHAT I DID NOT DO

- **Did not arm anything.** Armed count 0 → 0, deliberately, for the reason in F3. Every HOLD
  whose gates are satisfied would open a PR that lands in Marco's queue behind four others.
- **Did not merge, touch, label, rebase or comment on #1536, #1541, #1543 or #1544.** All four
  are Marco's — three by a genuine `marco:true` verdict, #1544 by hand-classification because it
  carries no lane verdict at all. RULE 2 bars me from all four and `do-not-merge` on #1536 is
  Marco's label to remove, not mine. **No agent may author `merge-approvals/1536.md`.**
- **Did not re-read 05's session transcript.** The 529-on-turn-one datum concerns the same single
  run and was already measured; F2's line is marked INFERRED rather than dressed up as fresh.
- **Did not touch the three orphaned worktrees, the two registry escapees, the watcher clone's
  dirty files, `docs/data-model/metadata-catalog.json`, `.arming-log.txt`,
  `docs/pr-prompts/queue-watch-state.md`, `.queue-sync-ledger.txt`, the untracked
  `docs/pr-reviews/pr-15xx-review.md` verdicts, or the `Claude outputs/` directory.** All are
  03's or are local-only by design; all were already reported.
- **Did not clear a single `[STALE]` escalation line.** Six `needs-marco/` files now carry dead
  PR references. Clearing them is real work and it is not this run's work; naming them here so it
  is not lost.
- **Did not go near Azure / Entra / SharePoint, production data, or `/sot/`.** `/sot/` is now
  unkept since `cdc78159` (09-01T14:36:51Z) = **52.5 h**, and will be ~72 h when 05 next fires at
  09-04T14:10:37Z. Editing it is 05's lane and nobody else's; that cost is the already-escalated
  price of the 04/05 collision.
