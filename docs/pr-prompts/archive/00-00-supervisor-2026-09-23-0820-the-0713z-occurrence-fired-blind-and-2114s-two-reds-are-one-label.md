# Station 00 — Supervisor | 2026-09-23T08:14Z–2026-09-23T08:45Z

## GROUND

```
UTC            2026-09-23T08:14:17Z
origin/main    e8b58231            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ e8b58231     C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Version and bootstrap AGREE — this run was not read-only on that account.

**SIGHTED RUN.** `start_process` shell `powershell.exe` returned on the first call:
`2026-09-23T18:14:17.5598853+10:00`, `main`, `e8b58231`. Said loudly because a blind run and a
healthy quiet run both produce "no news" — and because *this station's own previous occurrence
was blind* (F1 below).

## WHAT I MEASURED

**Binding documents read in full this run**, from a working copy PROVED equal to `origin/main`
rather than assumed: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output**, which is the
real answer (PREFLIGHT step 2; no piped hash was taken, per its unsound-in-PowerShell rule).
`git rev-list --left-right --count HEAD...origin/main` → `0	0`.

**[MEASURED] vm-git-guard, exit code quoted from the INSTALLER and not from a pipeline.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **exit 2**, last line
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Its own controls, quoted: `bash -lc 'command -v git'` → the shim;
`bash -c 'command -v git'` → `/usr/bin/git`. This is the EXPECTED station outcome, a FINDING and
not a STOP. **The device-bridge git ban was therefore REMEMBERED this run, not mechanical.** No
`git` was run through the bridge against the Windows `.git`.

**[MEASURED] §9.1's `$`-expansion trap fired on my own first probe, and is the reason every
subsequent probe was a `.ps1` run with `-File`.** `powershell.exe -Command "… Write-Output
('FRESHNESS_EXIT=' + $LASTEXITCODE)"` arrived at the parser as `('FRESHNESS_EXIT=' + )` and died
`ExpectedValueExpression` — the `$LASTEXITCODE` token consumed before PowerShell saw it. Re-run
from a `.ps1` with `-File`, the identical statement printed `FRESHNESS_EXIT=0`. A live instance of
the nested-`-Command` form the 2026-09-14 correction names as the one that reproduces.

**[MEASURED] freshness, `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`:**

```
00  last 2026-09-23T06:25:00Z  1.8h ago  (cadence 1h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-22T23:29:00Z  8.8h ago  (cadence 24h)  ok
04  last 2026-09-23T06:10:00Z  2.1h ago  (cadence 4h)  ok
05  last 2026-09-22T14:23:00Z  17.9h ago (cadence 24h)  ok
```

**[MEASURED] crossed against `lastRunAt` (scheduled-tasks MCP), which is the step the breadcrumb
cannot do:**

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-23T08:13:53Z` (this run) | 06:25Z | **a gap of one hourly occurrence — resolved by the session directories, F1** |
| 03 | `2026-09-22T23:28:57Z` | 09-22 23:29Z | aligned, healthy |
| 04 | `2026-09-23T06:10:31Z` | 06:10Z | aligned, healthy |
| 05 | `2026-09-22T14:23:04Z` | 09-22 14:23Z | aligned, healthy |

`00`'s `ok` is the weakest row here by construction: `check-breadcrumb.mjs`'s `CADENCE` map still
carries `'00': 2` against a live cron of `5 * * * *`, so it cannot call 00 SILENT until 4 h.
That is why the `lastRunAt` cross-check is not optional for this station.

**[MEASURED] session-directory scan, ANY directory name at that depth (the 2026-09-15 rename
means a `local_*` filter answers zero):** 00 fired at `00:14`, `01:14`, `02:14`, `03:14`, `04:14`,
`05:14`, `06:13`, **`07:13:53Z`** and `08:13:53Z` UTC. **The 07:13Z occurrence DID fire.**
18 directories created in the last 14 h.

**[MEASURED] COLLECT — the tracked set was asked of `origin/main`, never of the dev-tree index.**
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` matched by basename:
exactly **one** `00-*` breadcrumb at depth 1 — this station's own `…-0625-…`. Every 03/04/05
breadcrumb is already in `archive/`, including 04's `…-2026-09-23-0610-…` (landed by `#2115`) and
03's `…-2026-09-22-2329-…`. **Nothing from another station is uncollected or undispositioned.**
`git status --porcelain -- docs/pr-prompts` → EMPTY.

**[MEASURED] `status-sweep.ps1`, captured to a file and decoded `utf16le`** (the `*>` redirect
writes UTF-16LE in PS 5.1; read as UTF-8 its section headers match no regex):
134,852 bytes, 388 lines, generated `2026-09-23T08:15:52Z`.
Section 0 instrument controls both PASS. Section 7 verdict: **SAFE TO ACT**.

- OPEN PRs: **1** — `#2114`, BLOCKED, `13 pass / 2 fail`.
- `main` CI on `e8b58231`: **4 success / 0 failed — trunk green.**
- watcher node RUNNING **pid 9744**; auto-restart wrapper alive (1); clone `branch=main dirty=0`.
- heartbeat age 102 min — with an EMPTY queue that is **idle, not wedged**; the heartbeat only
  ticks mid-run. No liveness emergency is declared on it.
- armed `*-ready.md`: **0**. `needs-marco/` 44 · `no-pr-opened/` 111 · `failed/` 59 · `blocked/` 150.
- **Section 5 produced no `[STALE]` rows this run** — every row is a `[FILE]` "cannot decide"
  line. There was nothing to discharge into `needs-marco/discharged/`.
- one orphaned worktree: `C:/po-wt/s9hex`, `f878a0a1` detached HEAD, **dirty=0**, age 121 min (F3).

**[MEASURED] `#2114` — the whole of the open board.**
`gh pr view 2114 -R GH-Mantova/ProjectOperations --json …` → exit 0, OPEN, BLOCKED, not draft,
head `worktree-agent-a7fb6f7f79e60c457`, created `2026-09-23T06:10:46Z`,
label **`do-not-merge`** (`escalates:true - Marco merges this, not automation (DOCTRINE 5b)`).
16 files, including `apps/api/prisma/migrations/20260923200000_transport_capacity_rig_type/
migration.sql`, `apps/api/**`, `apps/web/**`.

**LANE, established before anything else, §10.1 step 1 — the PROMPT logs alone, `rev-*` excluded:**

| probe | result |
|---|---|
| `processed\pr-*.log` matching `PR #2114\b` | **3** |
| …carrying a real verdict | `[watcher] merge result for PR #2114: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` |
| POSITIVE control, `PR #2109` | **2** |
| NEGATIVE control, a freshly minted needle | **0** |

**WATCHER-OPENED, and the verdict is `marco:true`. RULE 2 binds absolutely.** The verdict also
appears alongside that log's own prompt (`pr-scopecards-s9-transport-capacity-matrix-ready.md.log`),
so it is a routing and not a number scraped out of agent prose.

**[MEASURED] the two reds are ONE cause, read from column 3 of the job log and never from the
pass/fail counts** (`gh run view … --job … --log` emits three tab-separated columns and column 1
is the job name, so a whole-line grep matches every line):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

and, inside `PR gates — diff checks`, `FAIL - CP-26 do-not-merge [ … same sentence … ]`.
Verdict token **`[LABEL_PRESENT]`** — not `[RELEASED_NO_RECEIPT]`, which would be a real finding.
NEGATIVE control over the same decoded column → 0; the gates job's own PASS rows → 6.
**This is PARKED BY DESIGN. It is not a defect, it is not a red to chase, and there is no
agent-side action behind it** — only Marco removes the label. Three prior collect runs have
listed PRs in this exact state among "the reds"; this one does not.

**[MEASURED] arming — asked live, not quoted from my own previous note.**
`scripts/pipeline/triage-holds.ps1`, exit 0, read-only. Its own controls PASS
(`GIT control: PASS — git read origin/main:DOCTRINE.md, 215487 chars`;
`SPENT control: PASS — lint-prompt.mjs emitted exit 3 on the fixture`), which is what answers its
closing `!!! SUSPECT: every prompt landed in ONE bucket` warning — node and git both resolve, so
the uniformity is the board's and not the probe's.

```
14 prompts at depth 1: HOLD=14, ready=0, LOOPING=0
SPENT                          (none)
GATES SATISFIED — CANDIDATES   (none)
POSSIBLE DUPLICATES            (none)
STILL GATED (lint exit 1)      14
SPENT BEHIND A REJECT          (none)
```

Ten reject `[HUMAN_GATE_PRESENT]`, four `[FILE_GATE_NOT_RELEASED]`. **Nothing is armable**, and
nothing merged between `#2115` (06:29Z) and this run, so no gate has been released since the
06:25Z occurrence assessed the same question.

## WHAT CHANGED

**On the board: nothing.** No PR merged, no label touched, no branch updated, no check re-run.
**In the queue: nothing.** Nothing armed, disarmed, renamed, retired or moved.
**On the machines: nothing.** No watcher restart, no lock cleared, no process killed, no worktree
pruned.

The only mutation this run makes is this PR: it lands this breadcrumb at a tracked path and
`git mv`s the fully-dispositioned `…-2026-09-23-0625-…` breadcrumb into `archive/`. Both are
written inside this run's own PR worktree (`C:\po-wt\s00-collect-0835`, branched off
`origin/main` at `e8b58231`), which is REPORT CONTRACT cure 1 — so no untracked copy is left in
the dev tree to block the next fast-forward, and the post-merge restore dance is not needed.

Single-actor precondition re-measured immediately before creating the worktree, not quoted from
the 08:15:52Z sweep: `index.lock` dev **False** / clone **False**, `git.exe` processes **0**,
`git diff --cached --name-status` **EMPTY** (the dev tree's index is shared between chats, so this
is checked before every commit).

## FINDINGS

### F1 — The 07:13:53Z occurrence fired, was BLIND, stopped correctly at STEP 1, and left no breadcrumb. One hour of board coverage lost; this is recurrence N on an already-open escalation.

`lastRunAt` cannot answer "did an EARLIER occurrence fire?" — it holds only the most recent run,
which is this one. The session directory does: `…\6662b30d…\9b645bdf\`, `CreationTimeUtc`
**2026-09-23T07:13:53.0689612Z**. Its transcript (`list_sessions` → `read_transcript`, session
`local_9b645bdf-…`, titled `00 supervisor`) records the cause verbatim:

> `desktop-commander` … failed to connect with `CONNECT_TIMEOUT: "MCP server
> plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`, confirmed after
> four ToolSearch attempts spanning the server's full connect window.

**That run behaved correctly** and is not being written up as a station defect: it loaded the tool
schemas first (so the failure was after the load, i.e. real blindness and not an unloaded schema),
it stopped at STEP 1, it refused to substitute `origin/main` reads for coverage, and it said so
loudly. Calling it stopped would be a §7 false alarm, and a false alarm licenses destructive action.

**Three of today's nine 00 occurrences were blind** — 01:15Z, 04:14Z and 07:13Z all carry
`blind`/`desktop-commander-connect-timeout` breadcrumbs or transcripts. That is 33%, consistent
with the ~40% `STATION-CAPABILITIES.md` §2 records, and its cause remains unknown.

**This is already escalated and I am not filing a duplicate.** `needs-marco/` holds
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` (POSITIVE control: 18 of
44 `needs-marco/` files match `desktop.commander|CONNECT_TIMEOUT|blind`, 39 match `Marco`;
NEGATIVE control, a freshly minted needle, 0). The escalation's premise is untouched by anything
that happened today — it recurred three times.

One narrow sub-observation, recorded because it is cheap and the next blind run inherits it: that
run wrote **no** breadcrumb, reasoning that an untracked file in the shared dev tree risks being
swept into another chat's commit. `STATION-CAPABILITIES.md` §3's 2026-09-10 correction measured
that the native file tools are a read-WRITE transport a blind run still has, and that writing the
breadcrumb is how a blind run leaves a report at a tracked path. Both positions are defensible and
the difference is real; it is not worth a PR of its own this run.

**DISPOSITION: ESCALATED** — recurrence appended, in this breadcrumb, to the open escalation
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`. Marco: the fix
is in the MCP layer, not in this repo, and no station can reach it.

### F2 — `#2114` is two reds with one cause, and the cause is the label. Nothing to fix.

Measured above: verdict token `[LABEL_PRESENT]` on `Approval receipt (CP-26)`, and the identical
sentence inside `PR gates — diff checks`, which runs the same check as a step. Both reds, one
cause, and that cause is a human gate working exactly as designed. The PR is additionally
watcher-routed `marco:true`, carries the `do-not-merge` label, and touches
`apps/api/prisma/migrations/**` — so it fails `classifyPolicyFiles` on its own migration clause as
well. Three independent gates, all pointing the same way.

`13 pass / 2 fail` is therefore **not** a board blockage to diagnose. There is no CI defect here,
no branch to rebase, no conflict to resolve, and no re-run that could help.

**DISPOSITION: ESCALATED** — to Marco, as the label already says. The only action that moves this
PR is Marco reviewing it and removing `do-not-merge`; removing it is what releases the merge. No
station may remove that label, this one included. Nothing is asked of him beyond the review he is
already the gate for.

### F3 — One orphaned build worktree, clean, from `#2114`'s own build.

`C:/po-wt/s9hex`, `f878a0a1`, detached HEAD, **dirty=0 files**, age 121 min at the sweep — which
places its creation alongside `#2114`'s `06:10:46Z` open. `worktree-registry-escapees: none found
under known roots`. Nothing is at risk: the work is already pushed and on the board, and the
worktree holds no uncommitted content.

Worktrees are Station 03's lane, not mine, and the station doc is explicit that a worktree is
listed with its age and `git status --short` read before anyone suggests deletion — never deleted
unsupervised. I did not touch it.

**DISPOSITION: DISPATCHED → 03-machine-minder.** Prune `C:/po-wt/s9hex` (`f878a0a1`, dirty=0) at
its next occurrence — **but only once `#2114` has settled**, since it is that PR's own build tree.
03 wakes daily (`0 9 * * *`, `lastRunAt 2026-09-22T23:28:57Z`) and reads this file.

### F4 — `vm-git-guard` reports INERT, so the device-bridge git ban is remembered rather than mechanical.

Quoted in full under WHAT I MEASURED: exit **2**, headline `INSTALLED BUT INERT`, with the
installer's own two controls showing the shim resolves in a login shell and `/usr/bin/git`
resolves in the shell a station is actually given. This is the documented EXPECTED outcome for a
station and is recorded so that it is visible in the report rather than inferred — an install
nobody can see in the report is indistinguishable from one that never ran, which is why the
bullets telling stations not to run `git` there did not stop the last occurrence.

No `git` was run through the bridge against the Windows `.git` this run; every `git` call went
through `powershell.exe` on the host.

**DISPOSITION: DEFERRED** — the inertness is by construction (a non-interactive, non-login shell
sources neither `~/.bashrc` nor `~/.profile`), it is already written into the PREFLIGHT block as
the expected middle outcome, and no change a station can make alters it. It becomes urgent the
moment a 0-byte `index.lock` with no owning Windows process appears in either tree — neither was
present this run (both `Test-Path` → False).

## WHAT I DID NOT DO

- **Did not touch `#2114` in any way** — no merge, no auto-merge arm, no label change, no re-run,
  no branch update. It is watcher-routed `marco:true` AND `do-not-merge`-labelled AND carries a
  migration. Each of those alone is disqualifying.
- **Did not remove a `do-not-merge` label.** Only Marco does, in either of 00's two modes.
- **Did not arm anything.** 0 of 14 HOLDs lint ADMIT; there was no candidate to read the body of.
- **Did not restart, kill or otherwise touch the watcher.** It is RUNNING (pid 9744) with its
  wrapper alive and an empty queue. A 102-minute heartbeat on an idle queue is the documented
  correct state, not WEDGED — and I did not run `restart-watcher-if-wedged.ps1 -Fix`, which is
  sanctioned only on a WEDGED or DOWN verdict from that script.
- **Did not prune `C:/po-wt/s9hex`** — 03's lane, and it belongs to a PR that is still open (F3).
- **Did not clear anything from `needs-marco/`.** The sweep produced no `[STALE]` rows this run,
  and the `[FILE]` "section 5 CANNOT decide" rows are explicitly not a clearing instruction.
- **Did not file a new blindness escalation** — one is open and its premise is intact; a duplicate
  would be noise on the queue this station is supposed to be draining.
- **Did not touch `/sot/`** (Station 05's, CP-24), Azure / Entra / SharePoint (absolute), or any
  production data.
- **Did not run `git` through the device bridge against the Windows `.git`** (F4).
- **Left alone** in the dev tree: the two untracked paths `Claude Design/docs/index.html` and
  `docs/pr-reviews/pr-2114-review.md`. Neither is a path this PR lands, so neither can block the
  fast-forward after it merges, and the second is a review verdict the `rev-` lane writes by design.
