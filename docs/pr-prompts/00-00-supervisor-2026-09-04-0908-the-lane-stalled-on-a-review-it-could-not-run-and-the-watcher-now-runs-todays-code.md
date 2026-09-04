# Station 00 — Supervisor | 2026-09-04T09:09Z–2026-09-04T09:5xZ

**SIGHTED, not blind.** `start_process` shell `powershell.exe` returned on the first call
(`Get-Date -Format o` → `2026-09-04T19:09:03.40+10:00`). Every reading below was taken on the box.

## GROUND

```
UTC            2026-09-04T09:09:31Z
origin/main    d055c726 -> f8fbbfae   (git fetch origin --prune, then rev-parse; two merges this run)
dev tree       main @ d055c726 -> f8fbbfae   C:\ProjectOperations2   (ff-only exit 0)
doc version    1                       (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                       (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — full authority this run.
**Which tree I read in:** the dev tree `C:\ProjectOperations2`. Board work was built in an isolated
worktree `C:\po-0908` off `origin/main`, torn down at the end. The `.gitattributes` FF failure
recorded earlier on 09-04 did **not** recur: `git diff --cached --name-status` was EMPTY and
`git merge --ff-only origin/main` exited 0.

## WHAT I MEASURED

**[MEASURED] `bring-up-to-speed.ps1` at 09:10:23Z.** Section 0 controls PASS (`gh` reached GitHub, saw
merged #1578; `node` runs). **VERDICT: CAUTION** — 1 LIVE STATION WORKTREE (`C:/po-vg`), which bound
me to an isolated worktree and new branches only; it does not bar action.

- `[LIVE]` OPEN PRs: **2** — `#1579` CLEAN 9/0/0, `#1580` CLEAN 9/0/0. `main` CI on `d055c726` green.
- `[LIVE]` armed `*-ready.md`: **3** — `pr-preflight-tool-names-are-environment-specific-ready.md`
  plus `rev-1579`/`rev-1580` (review jobs, not prompts). **Real armed = 1.**
- `[LIVE]` watcher node RUNNING pid 2572, wrapper alive, heartbeat 1 min.
- `[LIVE]` single-actor gate: in-progress prompts **0**, `index.lock` **False / False**, git
  processes **0**, no PR touched in the last 2 min. Re-read immediately before each merge and again
  immediately before the restart.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** 6 breadcrumbs, 0 malformed;
00 `1.0h ok`, 03 `10.2h ok`, 04 `3.0h ok`, 05 `11.3h ok`. Crossed against `list_scheduled_tasks`:
00 `lastRunAt 09:08:50Z` (this run) on cron `5 * * * *` — **hourly, recorded as 2h**; 04 `06:10:28Z`
aligned with its 06:10Z breadcrumb; 03 `2026-09-03T23:01:39Z` on `0 9 * * *`; 05 `2026-09-03T14:11:26Z`
with next occurrence `14:10:37Z` today. **No station is SILENT**, so no transcript read was needed.

**[MEASURED] RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`:
**1881** logs, `marco.:true` → **608**, negative control (`zzzNoSuchNeedleZzz`) → **0**. 🔴 **The
mandated AGE control FAILED, and I say so rather than quoting the probe as clean**: the newest log was
`08:01Z`, *older* than both open PRs (created 08:35Z and 08:37Z), because the watcher had written no
processed log since 08:01. Both PRs read `NO LOG` — ambiguous under §9.5 — so I did not rest either
classification on the probe. See F1 for the instrument that did answer it.

**[MEASURED] the watcher's own live log is the lane record for #1580.**
`[2026-09-04T08:37:49.066Z] [merge] pr-preflight-tool-names-are-environment-specific-ready.md: opened
PR #1580, policy=tests-docs, waiting…` — the watcher had already run `classifyPolicyFiles` and placed
#1580 in the **automatic** lane, not Marco's. That is a positive statement of routing, not an absence.
`#1579` was opened by Station 00 by hand, one file under `docs/pr-prompts/`:
`[NO LANE VERDICT — hand-classified]`, inside `^(tests|docs)/` and inside 00's own recorded lane
(`STATION-CAPABILITIES.md` §5) ⇒ **not Marco's**.

**[MEASURED] the four watcher-code PRs were still not running, and the defect fired again.**
`[2026-09-04T09:35:56.983Z] [verdict-guard] PR #1580: verdict cites files not in PR — blocking mirror,
moving to blocked/` — the exact behaviour #1574 removes, 96 minutes after #1574 merged. The clone's
on-disk `index.mjs` was already current (`git log -1 -- scripts/pr-watcher/index.mjs` in the clone →
`b42dcc36 … (#1577)`; `NESTED_TEST_PATHS` present at `:1394`/`:1397`; negative control
`zzzNoSuchTokenZzz` → 0). **Only the running process was stale.**

**[MEASURED] the spent HOLD is still tracked on `origin/main`.**
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returns
`docs/pr-prompts/pr-preflight-tool-names-are-environment-specific-HOLD.md`; positive control, the same
query filtered to `-HOLD\.md$`, returns **220**.

## WHAT CHANGED

1. **Merged `#1580`** — `fix(pipeline): PREFLIGHT tool ids are environment-specific`, 9 files, all
   under `docs/`. `Assert-SmokedOrEscalate` → `Merge-Pr` (pipeline-lib). **Merged `09:30:36Z`**, read
   back on `origin/main` as `511f538d`. The watcher closed its own wait six seconds later —
   `[09:30:42Z] [merge] PR #1580 merged at 2026-09-04T09:30:36Z (policy: tests-docs)` and
   `[watcher] merge result for PR #1580: {"ok":true}` in its processed log.
2. **Merged `#1579`** — `docs(board): 00 collect 0809 addendum`, one file under `docs/pr-prompts/`.
   The watcher rebased it (`[09:31:15Z] [update] PR #1579 branch updated (was BEHIND)`); CI went green
   again at 09:33:00Z; `Assert-SmokedOrEscalate` → `Merge-Pr`. **Merged `09:33:18Z`**, `origin/main`
   `f8fbbfae`. **The board is now 0 open PRs.**
3. **Restarted the watcher** — F3. `2572` (started 06:25:08Z) → **`20000`** (started 09:37:14Z).
4. **This PR**: this breadcrumb, the spent `-HOLD.md` deleted, and the four fully-dispositioned
   pre-0809 breadcrumbs archived.

**Nothing else.** No arm (nothing was gate-cleared and waiting), no label added or removed, no
`do-not-merge` cleared, no `/sot/` edit, no worktree pruned, no `git` mutation in the watcher clone.

## FINDINGS

### F1 — #1580 sat green in the auto-merge lane for 51 minutes, and the cause is the defect that was already fixed on `main` but was not the code running

[MEASURED] `#1580` was opened by the watcher at `08:37:25Z` and classified `policy=tests-docs`. At
`09:28:40Z` — **51 minutes in** — all 14 of its checks were `SUCCESS`/`SKIPPED` and
`autoMergeRequest` was still **`none`**. Two facts about that window, both measured:

- `docs/pr-reviews/pr-1580-review.md` did **not** exist, in the dev tree or in the clone (positive
  control: `pr-1569-review.md` present in the dev tree). Its producer, `rev-1580-ready.md`, appears in
  the log as `[08:40:14Z] [queue] … (depth: 2, busy, source: watch)` with **no matching `[start]`**
  until `09:33:05Z` — i.e. after I merged #1580 and freed the single-lane worker.
- When it finally ran, its verdict was **rejected**: `[09:35:56Z] [verdict-guard] PR #1580: verdict
  cites files not in PR — blocking mirror, moving to blocked/`.

**[INFERRED]** from `index.mjs:1841`
(`if (!mergeEnabled && allGreen && (await verdictApproves(prNumber, policyPrFiles)))`) the wait could
not clear: `allGreen` was true, so the missing term was `verdictApproves`, which needs that review
file. `MERGE_TIMEOUT_MS` is 90 min, so the wait would have expired at **`10:07:49Z`** and written
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` —
byte-identical to a genuine policy routing, on a docs-only PR, with RULE 2 then correctly barring every
station from clearing it. The next Station 00 occurrence was `nextRunAt 10:07:52Z`, **three seconds
later**, so the arriving run would have inherited a permanently human-gated PR carrying the third
failed landing of a fix to *step 1 of every station's every run*.

🔴 **This is NOT the discharged "the lane is deadlocked" claim, and it is not a re-derivation of the
refuted cause (a).** `_DISCHARGE-NOTE-tests-docs-lane-deadlock-2026-09-04.md` retracted that premise on
measurement (139 of 157 waits were sub-second) and named the real cause: `verdict-guard.mjs` rejecting
thorough verdicts, **fixed in #1574**. What I measured is that same cause still executing at 09:35:56Z
because #1574 was merged but not running — plus the ordering effect that put the review job behind the
wait in the first place. The discharge stands; its fix simply had not taken effect.

**DISPOSITION: ACTIONED.** I merged #1580 under the standing rule for exactly this state — *merge a
green watcher-opened docs PR while it is in `waiting…`; the PR inside the window goes FIRST* — with the
lane established from the watcher's own `policy=tests-docs` line rather than from the `NO LOG` probe
whose age control had failed. The watcher recorded `{"ok":true}` within six seconds, so no false
routing was ever written, and #1579 was merged only afterwards. The general cure is F3's restart, which
puts #1574 into the running process.

**Falsifying probe for the next run, and it must be run rather than assumed:** the next watcher-opened
docs-only PR should now reach `autoMergeRequest: ENABLED` inside its 90-minute window with no
supervisor touching it. If it does not, the ordering effect above is a second, independent cause and
becomes a new escalation — and the evidence to bring is the `[queue] rev-<N> … busy` line with no
`[start]` before the merge, exactly as recorded here.

### F2 — #1574 merged at 07:59Z and the defect it removes fired at 08:29Z and again at 09:35Z

[MEASURED] two occurrences today of `[verdict-guard] … blocking mirror, moving to blocked/` — on #1578
at `08:29:58Z` (recorded by the 0809 run) and on #1580 at `09:35:56Z` (this run) — both **after** the
fix was on `main`. A merged PR that changes nothing about behaviour reads as "shipped" on the board and
is worth nothing until the process restarts.

**DISPOSITION: ACTIONED via F3.** Re-measure after the restart: the next `rev-<N>` verdict should
mirror to its PR instead of moving to `blocked/`. `blocked/` currently holds the backlog the discharge
note counted (108 of 109 files were `rev-*`); draining or re-queueing it is **not** claimed here and is
not this run's work.

### F3 — The watcher now runs today's code. Restarted, on the trigger the 0809 run set

The 0809 addendum deferred this with an explicit bar: *"the next run that finds `armed = 0`, no
in-progress prompt and a HEALTHY verdict does the restart and reads back the new PID."* All three were
true between `09:36:26Z` and `09:37:06Z`, and I waited for them rather than restarting mid-run —
`rev-1580` was still executing at 09:35 and finished at 09:35:57.

[MEASURED] before the kill, and reported before killing anything, per HARD STOP 5:

| pid | what it was |
|---|---|
| `20932` | `powershell -File C:\po-watcher\watcher-launcher-singlelane.ps1` — the wrapper |
| `23648` | `powershell -File …\scripts\pr-watcher\start-watcher.ps1` |
| `2572` | `node --no-deprecation …\scripts\pr-watcher\index.mjs`, started `06:25:08Z` |

Killed in that order (wrapper first, so nothing auto-restarted the old node); post-kill count of
`pr-watcher/index.mjs` processes **0**; relaunched DETACHED via `watcher-launcher-singlelane.ps1`.

[MEASURED] read-back: **new node `pid 20000`, started `09:37:14Z`**, parent chain
`35328 watcher-launcher-singlelane.ps1 → 36224 start-watcher.ps1 → 20000 node`. Soaked 75 s and
re-read — still alive, so the adopt path did not regress.
`restart-watcher-if-wedged.ps1` at `09:39:25Z` → **`VERDICT: OK`**, `ALIVE (pid 20000)`, churn
`1 cycle in 20 min` against a threshold of 4. Startup banner: `auto-review: ON`,
`auto-update: ON (every 120 s)`, `preflight: untracked-ready-prompt count = 0`.

**DISPOSITION: ACTIONED.** #1570, #1572, #1574 and #1577 are now the code that is running.
**Note for the next run:** #1577's *never rebase a PR whose checks are still running* guard has never
been observed live. The first PR that goes BEHIND with checks in flight is the natural test — report
what it does, because `PR_WATCHER_AUTO_UPDATE` churn cancelling in-flight CI is a live standing trap
and this is the fix for it.

### F4 — A spent `-HOLD.md` stayed tracked on `main` for the third time today

[MEASURED] `pr-preflight-tool-names-are-environment-specific-HOLD.md` was armed at 08:29:37Z, consumed,
and shipped as #1580 — and is **still tracked on `origin/main`**, visible in the dev tree only as an
unstaged ` D`. #1580's own diff touches no path under `docs/pr-prompts/`, so nothing in the shipping PR
removed it, and a later `triage-holds.ps1` pass would offer it as a live candidate again.

The general cure was already built: `pr-queue-armed-tracked-detector` ran at 04:24Z and opened
**`#1567`** (`feat/detect-swallowed-armed-prompts`), whose watcher verdict is
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}` — it adds a CI
job, so it is correctly **Marco's**. It is not on the open board (open PRs = 0 at 09:34Z), so it was
closed or merged and I did not establish which.

**DISPOSITION: ACTIONED for this instance** — deleted in this PR, which is what makes the deletion
reach `main` instead of sitting unstaged in one tree. **The general defect stays open and is Marco's**:
#1567 carries a real watcher `marco:true` verdict and RULE 2 binds absolutely. Confirming #1567's fate
is one `gh pr view 1567` and belongs to the next run — **do that before anyone writes a fourth
detector.**

### F5 — Escalation #23 recurrence: 00's recorded cadence is still 2h against an hourly cron

[MEASURED] `check-breadcrumb.mjs --freshness` printed `00 … (cadence 2h) ok` while
`list_scheduled_tasks` returns `cronExpression: "5 * * * *"` for `00-supervisor`. Unchanged from the
0809 run, and with the detector alarming only past **2×** cadence, Station 00 must miss **four**
consecutive occurrences before it can read SILENT.

**DISPOSITION: ESCALATED — Marco, as recurrence evidence on OPEN escalation #23**
(`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`), **not a new
escalation and no new options.** #23's RULE-1 option **(a)** — record each station's real cadence and
alarm at `1× cadence + grace` — is still first and still the only one that is both complete and
additive.

### F6 — Six non-main worktrees and two registry escapees, unchanged

[MEASURED] from the 09:10:23Z sweep: orphaned `C:/po-1483-fix` (3290 min), `C:/po-guard` (545 min),
`C:/po-sa-fix` (1652 min), detached `C:/po-work/s2-e2e` (3418 min), LIVE `C:/po-vg` (dirty=1, 77 min),
and registry escapees `C:\po-worktrees\fix-1523` and `…\vs-s2-durable-smoke`. `C:/po-vg` holds the work
that shipped as #1577, merged at 08:15Z, so it is very likely no longer live — but *very likely* is not
a measurement I will prune on, and pruning next to a worktree I do not own is the shape of the incident
this station is named for.

**DISPOSITION: DEFERRED → Station 03**, whose lane this is; unchanged from 00-0609 F5 and 00-0809. It
becomes urgent if the count grows or if one of them holds uncommitted work — `git status --short`
inside each is the check. 03 next runs at `2026-09-04T23:00:45Z`.

## WHAT I DID NOT DO

- **Did not arm anything.** Real armed was 0 at the end of the run and nothing was gate-cleared and
  waiting. Arming to keep the queue non-empty is not a reason.
- **Did not touch `#1567`** (F4). It carries a genuine watcher `marco:true` verdict; RULE 2 binds.
- **Did not drain or re-queue `blocked/`** (F2). The verdict-guard fix is only now running; whether the
  109 blocked entries should be replayed is a decision with a blast radius, and nobody has measured
  what replaying them would do.
- **Did not prune any worktree** (F6), and did not mutate `git` in the watcher clone — every clone read
  above is `rev-parse` / `log` / `Select-String` only. My own `C:\po-0908` is torn down.
- **Did not add or remove a label anywhere**, and did not clear any `do-not-merge`.
- **Did not touch** `/sot/`, Azure, Entra, SharePoint, or production data.
- **Did not archive the 0809 or 04-0610 breadcrumbs.** They are this cycle. The four earlier 00
  breadcrumbs were fully dispositioned by the 0809 run and are archived in this PR.
