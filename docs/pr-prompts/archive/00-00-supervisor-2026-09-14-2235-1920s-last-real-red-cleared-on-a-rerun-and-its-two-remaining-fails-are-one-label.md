# Station 00 — Supervisor | 2026-09-14T22:08:30Z–2026-09-14T22:40Z

## GROUND

```
UTC            2026-09-14T22:08:56Z
origin/main    a3e94700            (fetched, then rev-parse)
dev tree       main @ a3e94700     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

Binding documents read IN FULL this run: `docs/pipeline/DOCTRINE.md` (2506 lines),
`docs/pipeline/STATION-CAPABILITIES.md` (515 lines), `docs/pipeline/stations/00-supervisor.md`
(1319 lines). Read from the **working copy of the dev tree**, which PREFLIGHT permits here because
`HEAD == origin/main == a3e94700` and `git diff --numstat` was EMPTY at 22:08:56Z — the two
readings PREFLIGHT step 2 prescribes (`git rev-parse` / `--numstat`, never a piped hash).

**Device-bridge git guard — [CANNOT MEASURE], eighth consecutive station run.**
`bash …/scripts/pipeline/vm-git-guard.sh` failed before reaching the script:
`RPC error -1: failed to mount … under Plan9 share "c" which is not mounted`, with the harness
adding *"A Windows update released September 8 prevents Claude's workspace from reaching your
files."* Per PREFLIGHT this is a FINDING, not a STOP, and the guard's absence is not a licence to
run `git` against the mount — which this run did not, because the mount is not reachable at all.
The outage is already on file from 2026-09-09 onward; see F4.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] Desktop Commander `start_process` shell `powershell.exe`
returned `2026-09-15T08:08:40.7949306+10:00` on the first call. Not blind.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured with `*>` to a file and decoded
`utf16le` in node (DOCTRINE §9.3 — the prescribed capture is itself a UTF-16LE trap). 864 lines,
exit 10, generated `2026-09-14 22:09:51Z`. Section 0 instrument controls both PASS
(`gh CAN reach GitHub (saw merged PR #1939)`, `node runs`). Section 7 verdict, verbatim:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**Section 5 `[STALE]` escalation rows: ZERO.** [MEASURED] `Select-String '\[STALE\]'` over the
decoded capture returns 4 hits and **not one of them is an escalation row** — lines 1 and 4 are the
report header's own legend, line 121 is a `[FILE]` quotation of an older station summary, line 864
is the closing footer. The eleven dead PR-scoped escalations that the station doc records as having
survived ten days are cleared and have stayed cleared. Nothing to discharge this run.

**Board.** [MEASURED] 2 open PRs, trunk green on `a3e94700` (4 success / 0 failed).

| PR | state | mergeState | labels | checks |
|---|---|---|---|---|
| `#1923` | OPEN | **CLEAN** | none | 15 pass / 0 fail |
| `#1920` | OPEN | BLOCKED | `do-not-merge` | 13 pass / **2 fail** |

**RULE 2, re-taken live this run — both PRs are MARCO'S.** [MEASURED] against the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (2224 logs; newest `rev-1938-ready.md.log` at
`2026-09-14T20:31:59Z`, younger than either PR's `createdAt`, which is the freshness control the
decoy-directory bullet requires on top of POS>0). Probe form `'marco.:true'` — regex, dot matches
the quote, never `-SimpleMatch`. POSITIVE control **666**; NEGATIVE control, a freshly minted needle
over the same corpus, **0**; `PR #999997` over `processed\pr-*.log` (prompt logs only, `rev-*`
excluded), **0**.

```
PR #1923  ->  2 hits, both in pr-ratescol-s0-column-api-hygiene-ready.md.log
   PR #1923 open and unmerged: https://github.com/GH-Mantova/ProjectOperations/pull/1923
   [watcher] merge result for PR #1923: {"ok":false,"marco":true,
     "reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}

PR #1920  ->  2 hits, both in pr-ea-s2a-dashboard-preset-seed-ready.md.log
   EA-2a shipped as PR #1920, unmerged as required.
   [watcher] merge result for PR #1920: {"ok":false,"marco":true,"fixLane":false,
     "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

Each verdict sits in the log of the prompt that built it, alongside that prompt's own line naming
the same PR number — which is the cross-check the prose-scrape bullet requires before a verdict may
be read as a routing rather than as a number scraped out of an agent's sentence. Both verdicts are
genuine. **RULE 2 binds on both. Neither is mine to merge, and a lane verdict is only as of the
minute it was taken — this one was taken at 22:2xZ.**

**Freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 2:

```
00  last 2026-09-14T21:09:00Z   1.1h ago  (cadence 2h)   ok
02  dispatch-only
03  last 2026-09-10T23:10:00Z  95.1h ago  (cadence 24h)  SILENT
04  last 2026-09-14T18:20:00Z   3.9h ago  (cadence 4h)   ok
05  last 2026-09-14T14:11:00Z   8.0h ago  (cadence 24h)  ok
```

`structure: 2 checked, 0 malformed`. Both root breadcrumbs `ADMIT`.

**Crossed against `lastRunAt` (scheduled-tasks MCP), because the breadcrumb is one instrument and
cannot name a cause.** [MEASURED]

| task | enabled | cron | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | true | `5 * * * *` | 2026-09-14T22:08:30Z | 2026-09-14T23:07:52Z |
| `03-machine-minder` | true | `0 9 * * *` | **2026-09-10T23:01:10Z** | **2026-09-14T23:00:45Z** |
| `04-scanner` | true | `0 */4 * * *` | 2026-09-14T22:10:09Z | 2026-09-15T02:09:31Z |
| `05-sot-keeper` | true | `10 0 * * *` | 2026-09-14T14:11:11Z | 2026-09-15T14:10:37Z |
| `weekly-security-audit` | **false** | `30 7 * * 1` | 2026-09-06T21:32:44Z | — |

**Third instrument — the session directory, which is the only one that can answer about an EARLIER
occurrence.** [MEASURED] 1521 session directories retained under this container. Grouped by
`birthtime` UTC day:

```
09-05 = 32   09-06 = 33   09-07 = 31   09-08 = 14
09-09 =  7   09-10 = 30   09-11 =  8   09-12 = ABSENT
09-13 = ABSENT            09-14 = 26
```

Last fire before the hole `2026-09-11T06:06:58Z`; first after it `2026-09-14T03:08:21Z` — **69.0
hours with no session of any station.** POSITIVE control that this is absence and not retention:
every day from 09-05 to 09-11 is still on disk. `03-machine-minder` has exactly **one** session
directory in the whole container, `2026-09-10T23:01:10.339Z`, matching its `lastRunAt` to the
millisecond.

**This is not new and must not be re-diagnosed.** The 69-hour hole, its cause (Marco switched the
tasks off on 2026-09-11; the 00:27Z interactive run re-enabled four of five) and its consequences
for `03`/`05` are already measured and dispositioned in
`00-00-supervisor-2026-09-14-1008-the-scheduler-lost-69-hours-and-the-interactive-lane-masked-it.md`
and re-confirmed in the 1410Z and 1509Z breadcrumbs. Re-measured here only because `--freshness`
exits 2 every run and the contract requires 00 to disposition the silence rather than repeat it.

**04 is running concurrently.** [MEASURED] `list_sessions` shows `local_314c7b4d "04 scanner"` in
state `running`, created `2026-09-14T22:10:09Z` — 100 seconds after this run started. 04 is
read-only on the board; the single-actor gate was re-checked immediately before the mutation below.

**Dev tree.** [MEASURED] `git status --porcelain` at 22:3xZ: 17 untracked files, **zero** tracked
modifications; `git diff --numstat` EMPTY, `git diff --cached --name-status` EMPTY.
`docs/pipeline/sweep-rotation.json` is NOT dirty this run, so the second post-merge fast-forward
blocker does not apply. Twelve of the untracked files are `docs/pr-reviews/pr-*.md` written by the
review lane by design.

**`§9.1`'s nested-`-Command` expansion trap reproduced live, on the transport the 2026-09-14T18:2xZ
correction identifies.** [MEASURED] this run: `start_process` with
`powershell.exe -NoProfile -Command "…; 'EXIT=' + $LASTEXITCODE; …"` returned
`+ ... 'EXIT=' + ; (Get- ...  You must provide a value expression following the '+' operator` —
`$LASTEXITCODE` consumed before the child parsed. POSITIVE control, the same statements sent
**direct** to the `start_process` shell (no nested `-Command`): `ROW_A_direct_shell:42`, the `42`
surviving. Two transports, minutes apart, one session. This is a confirmation of a correction
already on `main`, not a new finding — recorded because that correction's own falsifying probe is
exactly this pair and a run that meets it should say so.

## WHAT CHANGED

**On the board: NOTHING.** No merge, no arm, no label touched, no branch updated, no PR closed.
`armed (*-ready.md)` was **0** at the sweep and **0** at the re-check before the mutation.

**In the repo: one docs PR** carrying this breadcrumb and moving two fully-dispositioned
breadcrumbs out of the queue root into `docs/pr-prompts/archive/`:

- `00-04-scanner-2026-09-14-1820-…` — collected and dispositioned by the 2026-09-14T20:10Z run
  (`[MEASURED]` its filename appears at line 114 of that run's breadcrumb, now on `main`).
- `00-00-supervisor-2026-09-14-2109-…` — this station's own previous run, self-dispositioned,
  merged as `#1939`.

Both were TRACKED at the root path before the move, so the archive `git mv` happens inside the PR
worktree and leaves no untracked copy in the dev tree. This breadcrumb was written **inside the PR
worktree** — cure 1 of the post-merge fast-forward section — so no loose dev-tree copy exists for
the next fast-forward to trip over.

## FINDINGS

### F1 — `#1920`'s last REAL red cleared itself on a branch-update rerun, and the two fails that remain are ONE label. S3.

The 2109Z run found `tendering-e2e` red on `#1920` and diagnosed it NON-DETERMINISTIC — the
duplicate-key error it logged was absent from both green runs of the same code. That diagnosis is
now confirmed by a third observation it could not have made.

[MEASURED] `gh pr checks 1920 -R GH-Mantova/ProjectOperations`, run `34900013752`, head
`3fc77a6cbcadea5b08553a9b990442f4923f67de`: **`tendering-e2e  pass  13m44s`**. Thirteen other checks
pass. Exactly two report `fail`:

- `Approval receipt (CP-26)`
- `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`

[MEASURED] the CP-26 **verdict token**, read from column 3 of the job log per `§9.1` (the log is
222 tab-separated lines and column 1 is the job name, so grepping the whole line for `CP-26` matches
every line of it):

```
2026-09-14T21:39:43Z  FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge
label (escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control, verdict tokens in column 3: **1**. NEGATIVE control, a freshly minted needle over
the same column: **0**.

`[LABEL_PRESENT]` is **PARKED BY DESIGN**. The same check runs twice — as the required check and as
a step inside `PR gates — diff checks` — which is why one cause shows as two reds. `§9.4` records
that three consecutive collect runs listed such PRs among "the reds" as though they were work.
**They are not. `#1920` has no remaining defect, and only Marco can release it.**

Two things worth keeping. First, the run that produced this green e2e was created at **21:39:43Z**,
one minute after `#1939` merged at 21:38Z — that is `pollForBehindPrs` rebuilding an open Marco PR,
the already-escalated behaviour the 2109Z run's F2 priced. This time it bought a green. Second, the
green is what makes the price legible: the same mechanism put a spurious red on this PR an hour ago
and took it off again, with nobody reading either.

**DISPOSITION: ACTIONED** — verified by the check list and the verdict token, and recorded so the
next run does not re-open `#1920` as a red board item. The `pollForBehindPrs` escalation is
unchanged and stays where it is.

### F2 — Both open PRs carry a GENUINE watcher `marco:true` verdict, re-taken this run. S4.

Verdicts, controls and the per-log cross-check are quoted in full above. Neither absence nor
ambiguity is involved: each PR's verdict sits in its own prompt's log beside that prompt's own
line naming the same PR number, so neither is a number scraped out of agent prose, and neither is
a `[NO LANE VERDICT — hand-classified]` case.

`#1923` is the one worth stating precisely, because it is the shape that invites a mistake: it is
**CLEAN, green on 15 of 15, and carries NO label**. Every visible signal says mergeable. It is
still Marco's, because the watcher routed it `outside tests/ or docs/` on
`apps/api/src/modules/rates/rate-tables.service.ts`. **Removing a label is not what clears RULE 2,
and neither is the absence of one.**

**DISPOSITION: ACTIONED** — re-verified live, and left alone. Both PRs are Marco's to merge.

### F3 — `03` reads SILENT at 95.1 h, and the occurrence that decides scheduler-vs-station is still 50 minutes away. S2.

Unchanged from the 2109Z run's F3, and re-stated only because `--freshness` exits 2 every run and
00 must disposition it rather than repeat it.

`03`'s missed occurrences of 09-11, 09-12 and 09-13 fall inside the 69.0-hour hole measured above,
which was a machine-wide condition — Marco switched the tasks off — and not a station defect. `03`
is **enabled**, its cron is `0 9 * * *`, and its next occurrence is `2026-09-14T23:00:45Z`, which
has not yet arrived at the time of writing.

**Do not report `03` as a stopped station.** The falsifying condition is already written down and
is unchanged: **if `03`'s `lastRunAt` does not move past `2026-09-14T23:00:45Z`, this stops being
the outage and becomes a real defect.** The next 00 run at 23:07Z is the first that can read it,
and it lands seven minutes after 03's slot.

**DISPOSITION: DEFERRED** — the deciding measurement is 50 minutes away and belongs to the next run.

### F4 — The VM/mount transport has now failed on eight consecutive station runs, so `vm-git-guard.sh` cannot be installed. S3.

[MEASURED] this run, verbatim: `failed to mount … as uploads: source path … is under Plan9 share
"c" which is not mounted`, plus `ensure user: user zen-brave-ptolemy already exists unexpectedly`,
plus the harness note naming a Windows update released September 8.

The consequence is the one PREFLIGHT names: the guard that stops a cut-short VM-side `git` call
leaving a 0-byte `index.lock` with no owning Windows process **is not installed on this box**, and
has not been for eight runs. The exposure is bounded only by the same outage — a transport that
cannot mount the folder also cannot run `git` against it — so the risk is latent rather than live,
and it becomes live the moment the mount returns before anyone installs the guard.

This is already on file continuously from 2026-09-09; nothing here is new except the count and the
more specific error text.

**DISPOSITION: DEFERRED** — install the guard on the first run where the mount is reachable, before
any other VM-side call. Not escalated again: re-filing a known-and-filed infrastructure outage every
hour is how a real finding gets lost in its own repetitions.

### F5 — Three orphaned worktrees, one of them holding uncommitted work for 10.6 days. S3.

[MEASURED] from the sweep and confirmed by `git worktree list`:

| worktree | head | dirty | age |
|---|---|---|---|
| `C:/po-fix1891` | `1dc31858` (detached) | 0 | 1255 min (20.9 h) |
| `C:/PR-Master/worktrees/po-vg` | `23c91ba9` `[fix/no-rebase-while-checks-run]` | **1** | 15256 min (10.6 d) |
| `C:/PR-Master/worktrees/pr1823` | `9664f95a` `[feat/ea-gate-reporting-team-permission]` | 0 | 7198 min (5.0 d) |

`po-vg` is already escalated and its uncommitted file was identified by Station 04 on 2026-09-10 as
a superseded draft; it is NOT to be force-pruned, and `git worktree remove` will refuse it, which is
the correct behaviour. The other two are clean and are ordinary aborted-run leftovers.

Pruning local trees is Station 03's lane, not mine, and 00 doing 03's work is the LL-38 incident.

**DISPOSITION: DISPATCHED → Station 03.** Fold into the existing clone-hygiene dispatch: prune
`C:/po-fix1891` and `C:/PR-Master/worktrees/pr1823` after re-confirming `git status --porcelain` is
empty in each at the moment of pruning, and **preserve `po-vg` untouched**. Note that 03 has not
run since 09-10 and its next slot is 23:00:45Z tonight, so this dispatch lands with the other open
asks in its queue rather than into a station that is reading.

### F6 — The watcher clone's `dirty=2` is the untracked-review-verdict false warning, NOT clone hygiene. S4.

[MEASURED] the sweep prints
`watcher clone: branch=main dirty=2  <-- NOT clean-on-main; the watcher may refuse to start`.
`§9.5` records that `status-sweep.ps1` counts untracked files while `start-watcher.ps1` explicitly
does not, and that a tracked-dirty clone AUTO-STASHES rather than refusing — so both conjuncts of
that warning sentence are false, and the files it counts are review verdicts the `rev-<N>` job
writes into the clone by design. Thirteen verbatim quotations of that line already sit in
`archive/`, each of them a mis-routed dispatch.

**DISPOSITION: ACTIONED** — recognised, not dispatched. The watcher is RUNNING (pid 30976, wrapper
alive, heartbeat 99 min old with an empty queue, which is idle and not wedged).

## WHAT I DID NOT DO

- **Did not arm anything.** `armed` was 0 at both readings and the queue's gate-satisfied HOLDs
  offer nothing inside the `tests-docs` lane, so every arm available today opens a PR that lands on
  Marco — and the board already holds two of those. Arming faster makes the queue longer, not
  shorter. This is a judgement about throughput, not an inability: the arming path is available.
- **Did not merge, re-run, rebase or update either open PR.** Both carry a genuine `marco:true`
  verdict (F2), `#1920` additionally carries `do-not-merge`, and `#1923` needs nothing.
- **Did not remove any label.** Only Marco removes `do-not-merge`.
- **Did not re-file the 69-hour scheduler hole, the `weekly-security-audit` disable, the
  `pollForBehindPrs` rebuild cost, or the mount outage as new findings.** All four are measured,
  escalated and on file; re-filing them would bury the one thing this run actually adds.
- **Did not prune any worktree** — Station 03's lane (F5).
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or `scripts/pr-watcher/**`.**
- **Did not run `git` against the mount** — it is unreachable, and the guard that would make such a
  call safe is not installed (F4).
