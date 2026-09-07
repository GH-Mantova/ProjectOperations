# Station 00 — Supervisor | 2026-09-07T13:15Z–2026-09-07T13:5xZ

## GROUND

```
UTC            2026-09-07T13:16:49Z
origin/main    0f0154e6            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 0f0154e6     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not read-only.

SIGHTED. `start_process` shell `powershell.exe` returned a live prompt on the Windows host on the
first call after `ToolSearch` loaded the Desktop Commander schemas. Not a blind run.

Device-bridge git guard, last line quoted verbatim:

```
vm-git-guard installed at /sessions/<session>/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)
```

All three binding documents were read from the working copy, which is PROVED equal to
`origin/main` this run: `HEAD == origin/main` (`git rev-list --left-right --count HEAD...origin/main`
-> `0	0`) with `git diff --numstat` and `git diff --cached --name-status` both EMPTY, so the
working copy and the `origin/main` blobs cannot differ. No piped hash was used (PREFLIGHT step 2).

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1`, captured to a FILE (it returns early and hides its
own §7 verdict otherwise). Section 0 controls both PASS. Section 7:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**[MEASURED] The board — 5 open, unchanged in membership since 11:0xZ.**
`gh pr view <n> --json number,createdAt,labels,files,mergeStateStatus` per PR (never a list field —
DOCTRINE §9.4's `merged` bullet):

| PR | state | labels | lane by `classifyPolicyFiles` |
|---|---|---|---|
| `#1777` 09:33:10Z | **CLEAN**, CI 15/0 green | `[]` | `scripts/pipeline/sweep-breadcrumbs.ps1` -> MARCO'S |
| `#1775` 08:57:26Z | BLOCKED, CI 13/2 | `do-not-merge` | `apps/api` + `scripts/rates` -> MARCO'S |
| `#1774` 08:57:11Z | BLOCKED, CI 13/2 | `[]` | `.github/workflows` + `scripts/pipeline` -> MARCO'S |
| `#1767` 06:43:58Z | BLOCKED, CI 13/2 | `do-not-merge` | `(^\|/)migrations/` -> MARCO'S |
| `#1760` 05:34:03Z | BLOCKED, CI **15/0 green** | `[]` | `scripts/pr-watcher` -> MARCO'S |

**[MEASURED] RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`
(never the clone — DOCTRINE §9.5): **2054** logs, newest **09-07 12:33** — younger than all five open
PRs, which is the control that separates this directory from the 17-day-stale decoy. POSITIVE
`marco.:true` -> **620**. NEGATIVE, freshly minted needle `zzQq00Needle20260907T1330` -> **0**.
Per-PR over `pr-*.log` only (excluding `rev-*`, DOCTRINE §10.1): `#1777 0 · #1775 0 · #1774 0 ·
#1767 0 · #1760 0`; NEGATIVE `PR #999999` -> **0**. All five therefore
**`[NO LANE VERDICT — hand-classified]`** and all five hand-classify as MARCO'S. **I merged nothing.**

**[MEASURED] Arming — 0 of 18 ADMIT prompts are tests/docs-only.**
`triage-holds.ps1`: 46 HOLDs at depth 1, **gates-satisfied=18**, still-gated=28, spent=0 (SPENT
fixture control PASS). Each ADMIT's `scope:` list was classified in node against all three
`NESTED_TEST_PATHS` forms plus the `(^|/)migrations/` clause:

```
TESTS-DOCS-ONLY COUNT = 0 of 18
CONTROLS: positive(tests/foo.spec.ts)=true (must be true)  negative(apps/web/src/x.tsx)=false (must be false)
```

4 are MIGRATION (`company-manage-s1`, `fv2-maintenance-usage-intervals`, `sor-s9a-register-api`,
`tr-s1-reminder-policy`), 14 are MARCO by path. Four are §10.6 duplicates of an open PR, matched on
the prompt's own marker rather than the head branch: `brandtheme-s2`↔`#1774`, `tipid-s2`↔`#1775`,
`watcher-gate-path-space`↔`#1760`, `tr-s1`↔`#1767` (via the `migrations/**` PREFIX form).
`pr-fixlane-s1` overlaps `#1760` on one file and remains the measured FALSE POSITIVE it was.

**[MEASURED] Watcher healthy.** `restart-watcher-if-wedged.ps1` (report-only):
`VERDICT: OK - nothing armed and the watcher is alive` — node pid 31660, wrapper alive, restart churn
0 cycles in 20 min, armed 0. No `-Fix` run and none warranted.

**[MEASURED] COLLECT — no station breadcrumb is new since my last run.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0:
`00` 11:08Z 2.2h · `03` 09-06T23:02Z 14.3h · `04` 10:18Z 3.0h · `05` 09-06T14:11Z 23.1h — all `ok`.
Crossed against `lastRunAt` from the scheduled-tasks MCP: `03` 09-06T23:01:13Z, `04` 10:10:07Z,
`05` 09-06T14:11:01Z, `weekly-security-audit` 09-06T21:32:44Z — every one aligned with its newest
breadcrumb, so no station is SILENT and none needs a transcript read. The three breadcrumbs in the
queue root (`00`@1008, `00`@1108, `04`@1018) are all tracked on `origin/main` and were all
dispositioned by the 11:08Z run; nothing arrived after it.

**[MEASURED] Station 00's 12:08Z occurrence never fired, and the 11:08Z run was still alive when
this one started.** Session directories under
`…\local-agent-mode-sessions\`, by `CreationTimeUtc`, last 9 hours:

```
05:08:24  06:08:25  06:10:04(04)  07:08:25  08:08:26  09:08:27  10:08:28  10:10:07(04)  11:08:28  13:15:37(this run)
```

There is **no directory at 12:0xZ**. POSITIVE control that an absent directory is a real absence and
not retention: 04's `06:10:04` and `10:10:07` are both still on disk, as are seven consecutive 00
directories from 05:08 to 11:08. Run durations, session `CreationTimeUtc` -> newest file write inside
that directory:

| session start | last write | duration |
|---|---|---|
| 05:08:24 | 05:19:42 | 11.3 min |
| 06:08:25 | 06:41:21 | 32.9 min |
| 07:08:25 | 07:54:37 | 46.2 min |
| 08:08:26 | 08:41:20 | 32.9 min |
| 09:08:27 | 09:53:56 | 45.5 min |
| 10:08:28 | 10:30:41 | 22.2 min |
| **11:08:28** | **13:14:55** | **126.4 min** |

The 11:08Z run was written to until **13:14:55Z — 42 seconds before this run's session was created**,
and it merged its own board PR `#1781` at **12:37Z**, i.e. it was demonstrably still executing 29
minutes past the 12:08 slot. `lastRunAt` from the MCP reads `2026-09-07T13:15:37.942Z` — this run —
and can say nothing about the 12:08 occurrence, exactly as the station doc's third-instrument note
predicts. `cronExpression` is `5 * * * *` with `jitterSeconds: 172`, so this run's own 13:15:37 start
is ~7 minutes later than jitter alone allows.

**[MEASURED] `#1760` is blocked by CodeQL, not by a label and not by any check `gh pr checks` shows.**
Every named check passes — including `Approval receipt (CP-26) pass` and
`PR gates — diff checks pass` — `mergeable: MERGEABLE`, `reviewDecision` empty, labels `[]`, and
`mergeStateStatus` is still BLOCKED. `scripts/pipeline/why-blocked.ps1 -Pr 1760` surfaced the rule:

```
gh: Repository rule violations found
CodeQL has detected 2 alerts blocking this code from being merged.  (HTTP 405)
```

`gh api repos/GH-Mantova/ProjectOperations/code-scanning/alerts?ref=refs/pull/1760/head&state=open`
(raw `--json` + `ConvertFrom-Json`, never `--jq` from PS 5.1 — §9.4):

```
#30  medium/error  js/shell-command-constructed-from-input  scripts/pr-watcher/index.mjs:1349
#29  medium/error  js/shell-command-constructed-from-input  scripts/pr-watcher/index.mjs:1022
```

Both messages read *"This shell argument which depends on **library input** is later used in a shell
command."* CONTROL: the same endpoint with no `ref` — i.e. the default branch — returns **0 open
alerts**, so these two are the PR's, not main's.

**[MEASURED] The cause, read from the PR head rather than from the diff page.**
Line 1022 is the sink: `spawn(GH_BIN, args, { cwd: REPO_ROOT, shell: true, env: childEnv })` inside
`runGh` — **pre-existing on `main`, untouched by this PR**. Line 1349 is the source:
`runGh(["pr", "view", String(n), "--json", "state"])` inside `unmetDependencies(deps)`, which this
branch changed from a module-private function to `export async function unmetDependencies(deps)` so
its new test could observe it end-to-end. Exporting it makes `deps` a public API entry point, so
CodeQL now has a taint source into a shell sink that was always there. **The PR removed `shell: true`
from `runGit` and from `warnOnUntrackedReadyPrompts` and left it on `runGh`.**

## WHAT CHANGED

**1. One commit pushed to `#1760`'s branch `fix/watcher-gate-path-space` — `4b746f64` -> `62d1e655`.**
`fix(pr-watcher): runGh must not spawn through a shell either`. Made in a disposable worktree off the
PR head (`C:\po-wt\wt-1760-0007`), never in the dev tree and never in `C:\po-watcher`; torn down after
the push. Edited in **node** with a function-free concatenation and an asserted byte delta (§9.3):

```
eol=CRLF
bytes before=147050 after=148076 delta=1026 expected=1026 MATCH=true
readback old_gone=true new_present=true
git diff --numstat  ->  14	1	scripts/pr-watcher/index.mjs
node --test scripts/pr-watcher/__tests__/gate-path-space.test.mjs  ->  pass 13  fail 0  exit 0
```

Read back after the push: `gh pr view 1760 --json headRefOid` -> **`62d1e655500a98bcf7390a05c5b742a6c2247fd0`**,
`state: OPEN`. At 13:28:52Z the re-run reads **15 checks, 0 failures, 3 pending**.
🔴 **[CANNOT MEASURE this run] whether CodeQL alerts #29/#30 close and `mergeStateStatus` leaves
BLOCKED** — the scan was still in flight when this run ended. **The next run must re-query
`code-scanning/alerts?ref=refs/pull/1760/head&state=open` and expect 0.** If it is still 2, this fix
is wrong and the sink is elsewhere.

**2. Two dispositioned breadcrumbs archived** — `00-00-supervisor-2026-09-07-1008-*` and
`00-04-scanner-2026-09-07-1018-*` `git mv`'d to `docs/pr-prompts/archive/`. Both were already tracked
at the root path on `origin/main` and every finding in each carries a disposition from the 11:08Z run.
The 1108 breadcrumb stays in the root: it is the current cycle.

**Nothing else.** No merge, no arm, no label touched, no `-Fix`, no `/sot/` edit, no watcher restart.

## FINDINGS

### F1 — Station 00 overruns its own hourly cadence and silently eats the next occurrence. The 12:08Z run never happened.

Seven consecutive 00 sessions fired on the hour from 05:08 to 11:08; **12:08 has no session
directory**, and the 13:0x occurrence started at 13:15:37 — outside its own 172-second jitter. The
11:08Z session was written to until 13:14:55Z, a 126.4-minute run that spanned both missed slots, and
it merged `#1781` at 12:37Z so it was provably still working past 12:08.

This is not new-in-kind — escalation #23 already records that a lost occurrence is invisible — but the
**cause is new and it is self-inflicted**: 00's median run today is ~33 minutes against a 60-minute
cadence, with a long tail that exceeds it. Nothing on the box detects the collision.
`check-breadcrumb.mjs --freshness` cannot: its `CADENCE` map still holds `'00': 2`, so it will not say
SILENT until **four** consecutive hourly runs are lost. `lastRunAt` cannot: it holds only the latest
run. The session directory is the only instrument that answers, and no scheduled probe reads it.

RULE 1 options for Marco, complete-and-additive first:

- **(a) Give 00 an overlap guard plus a lost-occurrence detector** — a lock file naming the running
  session, so a fire that finds a live predecessor records `SKIPPED: predecessor still running` in a
  tracked file instead of vanishing; and a probe that groups session directories by hour and reports
  any hour with no 00 directory. **Complete** (the loss stops being invisible now, and stays visible
  for every future cadence change) and **additive** (it records, it does not kill the running run, so
  no in-flight board work is ever discarded). Needs Marco only for the cron/task layer if the guard
  must live there; the detector is repo-side and is mine.
- **(b) Slow 00 to every 2 hours**, matching the cadence its instruments already assume. Fails the
  *complete* half: it hides the collision rather than detecting it, and a 126-minute run still eats a
  2-hour slot. Passes the *additive* half.
- **(c) Make 00 runs shorter** (split COLLECT from board-driving into two tasks). Fails *complete*
  the same way — a long run can still overrun — and fails *additive*, because two 00 tasks is two
  actors on one board, which is LL-38.

**DISPOSITION: ESCALATED** — written to
`docs/pr-prompts/needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`.
The cron and the scheduled-task layer are Marco's; the detector half is repo-side and I will build it
on his answer rather than guess which he wants.

### F2 — `#1760` was blocked by CodeQL, and the blocker was invisible to every instrument this pipeline routinely reads.

`gh pr checks` said 15 pass / 0 fail. `mergeable` said MERGEABLE. There was no label, no
`do-not-merge`, no red check, no review requirement — and the PR could not merge. Only an attempted
REST merge names the rule. **This falsifies, for a second PR in two runs, the "every red on the board
is one label" model**: `#1774`'s red is a missing CP-26 receipt (found 11:0xZ) and `#1760` isn't red
at all.

Root cause, measured from the head file rather than the diff: `runGh` spawns `gh` with
`shell: true` — pre-existing on `main` — and this branch exported `unmetDependencies` for its test,
which gave CodeQL a library-input source into that shell sink. So the branch's own (correct) test
change surfaced a latent defect on `main`, and the defect is exactly the class the branch exists to
close: with `shell: true`, node joins argv into one command string for `cmd.exe`, so every `gh`
argument carrying a space or a shell metacharacter — a PR title, a body, a branch name, a gate path
like `"Claude Design/docs/01-commercial.md"` — is re-split or interpreted before `gh` sees it.

Fix chosen (RULE 1, complete-and-additive): **remove `shell: true` from `runGh`**, which kills the
sink for every caller, present and future, and weakens nothing. Rejected: a numeric guard on `n`
alone (closes one path, leaves the sink live for titles and bodies — fails *complete*); un-exporting
`unmetDependencies` (removes the observation, not the defect, and costs the test — fails both); a
CodeQL suppression comment (a mask, forbidden by DOCTRINE §8.2).

**DISPOSITION: ACTIONED** — pushed as `62d1e655`, 13 of 13 targeted tests pass locally, CI re-running
clean at 13:28:52Z. Verified to the limit of this run; the CodeQL verdict itself is the next run's
read-back, named explicitly under WHAT CHANGED.

### F3 — `why-blocked.ps1` diagnoses by attempting a real REST merge, on PRs RULE 2 forbids merging.

The only instrument that named `#1760`'s blocker did so by calling the merge endpoint. On `#1760` it
was refused (HTTP 405) and I read back `state: OPEN`, `mergedAt: null` — nothing merged. But the
script is prescribed by the station doc for exactly the case *"a PR is BLOCKED with every visible
check green"*, and every open PR on this board hand-classifies as Marco's. **A PR whose only blocker
had been a stale rollup would have been merged by the diagnostic**, with no RULE 2 check anywhere in
the path.

**DISPOSITION: DEFERRED** — real, not now. It needs a one-line guard in `why-blocked.ps1` (refuse the
REST attempt when the PR has no watcher verdict clearing it, or gate it behind an explicit
`-AttemptMerge` switch), and `scripts/` is outside 00's `docs/` lane to merge, so it would land as a
sixth PR waiting on Marco on a board where five already are. **What would make it urgent:** any PR
reaching the board whose `mergeStateStatus` is stale rather than genuinely blocked — that is the
shape where the probe succeeds instead of returning 405.

### F4 — The board is unchanged and every open PR is still Marco's; arming stays at zero for the sixth consecutive run.

0 of 18 gate-cleared prompts is tests/docs-only, so arming any of them opens a PR only Marco can
merge, on a board already holding five of those. `#1777` and `#1760` are both green and both waiting
on him; `#1774`, `#1775` and `#1767` are red for reasons already escalated or already his.

**DISPOSITION: DEFERRED** — the arming precondition (a tests/docs-only candidate) is measurably
absent, not overlooked; re-measured every run with its controls. **What would make it urgent:** a
tests/docs-only prompt entering the ADMIT bucket, or Marco clearing the board so that arming
non-tests/docs work stops growing a queue only he can drain.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs return `NO LOG` from the RULE 2 probe and all five
  hand-classify as Marco's under §10.1 step 2. `#1777` is CLEAN and green and I still left it: the
  §10.1 step 3 station-lane exception covers 00's `docs/` lane, and `scripts/pipeline/*.ps1` is not
  it. Marco's 2026-09-07 ruling via `#1736` ("the lane merges, but writes a receipt first") is scoped
  to the SUPERVISED cloud lane; this is the scheduled lane and it does not inherit it.
- **Armed nothing** — measured, not skipped. See F4.
- **Left the third `shell: true` in `index.mjs` alone**, at the `spawn(CLAUDE_BIN, …)` call. Its argv
  is entirely literals plus `String(MAX_TURNS)`, CodeQL does not flag it, and `claude` may be a
  `.cmd` shim on Windows, which genuinely needs a shell. Removing it would be a mask-shaped change
  with a real chance of killing every build.
- **Did not touch `docs/pipeline/sweep-rotation.json`, the `C:\po-vg` orphaned worktree
  (`fix/no-rebase-while-checks-run`, 1 dirty file, 4644 min old), the watcher clone's `dirty=6`, or
  the clone's stash loop.** All are 03's lane and all are already dispatched or escalated; the po-vg
  worktree holds uncommitted work and `--force` would discard it.
- **Did not read any station transcript.** None was needed: every station's `lastRunAt` aligns with
  its newest breadcrumb, so nothing reads SILENT.
- **Did not run `pnpm build` / `pnpm lint`** in the `#1760` worktree — no `node_modules` there, and
  CI is running both on the pushed head. The targeted `node --test` that does run without install
  passed 13/13.
- **Did not touch Azure, Entra or SharePoint, `/sot/`, production data, any label, or the cron.**
