# Station 00 — Supervisor | 2026-09-14T21:09Z–2026-09-14T21:40Z

## GROUND

```
UTC            2026-09-14T21:09Z
origin/main    25e7684e            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 25e7684e     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run.

Binding documents read from the dev tree working copy, proved identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ **EMPTY**, and `git rev-list --left-right --count origin/main...HEAD` → `0 0`. No piped-hash
comparison was made (PREFLIGHT step 2, the 2026-09-04 clause).

All three were read **in full**: `00-supervisor.md` 1318 lines, `DOCTRINE.md` 2505 lines,
`STATION-CAPABILITIES.md` 514 lines.

Transport: Desktop Commander `start_process` / `interact_with_process`, shell `powershell.exe`,
statements sent **direct** — never a nested `powershell.exe -Command` (DOCTRINE §9.1). Host PS
`5.1.26100.9444`. Fresh negative needle minted for this run: `zzQq00N` + `20260915T2130` (written
split; treat as SPENT from here, §9.6).

## WHAT I MEASURED

**PREFLIGHT step 1 — the box.** `start_process` shell `powershell.exe` returned a live prompt.
**Sighted run.** [MEASURED]

**PREFLIGHT step 1 — the VM git guard.** `bash .../scripts/pipeline/vm-git-guard.sh` failed. Last
line quoted verbatim, pass or fail, as the contract demands:

> `resume: RPC error -1: failed to mount … is under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user bold-practical-gauss already exists unexpectedly … A Windows update released September 8 prevents Claude's workspace from reaching your files.`

**A failed install is a FINDING, not a STOP.** No `git` was run from the VM side; every measurement
below went through Desktop Commander against the Windows host. [MEASURED]

**PREFLIGHT step 4 — the sweep.** `status-sweep.ps1` captured with `*>` and decoded `utf16le` in
node (`ENC=utf16le BYTES=143024 LINES=417`). The literal `SWEEP COMPLETE` is present as the final
line, so the capture is whole. Section 0 controls: `[LIVE] gh CAN reach GitHub (saw merged PR
#1938)`, `[LIVE] node runs`. Section 7: **`[LIVE] SAFE TO ACT`**. Section 5 produced **zero**
`[STALE]` rows — a grep for `[STALE]` returned 4 lines, all of them the report's own legend and one
quotation inside a `[FILE]` snapshot, none an escalation row. Nothing qualified for
`needs-marco/discharged/`. [MEASURED]

**Board at 21:10Z.** `[LIVE] OPEN PRs: 2`. `#1923` CLEAN, `15 pass / 0 fail`, labels `[]`, head
`86801c70`. `#1920` BLOCKED, **`12 pass / 3 fail`**, labelled `do-not-merge`, head `5806605c`.
`armed (*-ready.md): 0`. Trunk at `25e7684e`: `4 success / 0 failed (trunk green)`. **The third red
on `#1920` is new since the 20:10Z run, which measured `13 pass / 2 fail`.** [MEASURED]

**RULE 2, re-taken this run — a lane verdict is only as of the minute it is taken (§10.1).** Probe
pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`: **2224** logs, newest
`2026-09-14T20:31:59Z` — younger than either open PR — `marco.:true` → **666**, fresh needle → **0**.
Per PR, over `pr-*.log` only (`rev-*` excluded, §10.1):

| PR | hits | verdict line | anti-scrape cross-check |
|---|---|---|---|
| `#1920` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | same log carries `EA-2a shipped as PR #1920, unmerged as required.` |
| `#1923` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` | same log carries `PR #1923 open and unmerged: <pull URL>` |
| `#999995` — NEGATIVE control | **0** | — | — |

Both verdicts sit in the log of the prompt that built them, beside that prompt's own PR line, so
neither is the prose-scrape shape §10.1 warns about. **RULE 2 binds on both. Nothing on this board
is mine to merge.** [MEASURED]

**The third red, diagnosed from the job log and never from the diff (§3).**
`gh run view 34894440823 --job 104144853933 --log`, 3033 lines, split on tab and read from the LAST
column (§9.1's three-column trap): **`4 failed`** in `pr-acceptance-batch1-dashboards`, all four the
same shape — `expect(locator).toBeVisible() failed … element(s) not found` on
`nav.getByRole("link", { name: dashName })` at lines 383, 419, 489, plus a `.not.toBeVisible()` on
the "Customise dashboard" dialog at line 331. Underneath them, three Postgres lines:

```
2026-09-14 20:47:52.709 UTC [290] ERROR:  duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"
2026-09-14 20:48:06.234 UTC [292] ERROR:  ... (same constraint)
2026-09-14 20:48:19.819 UTC [291] ERROR:  ... (same constraint)
```

`#1920` is *"EA-2a — seed Estimating Analytics UserDashboard preset"*, so a duplicate key on
`user_dashboards` is squarely its own subject. [MEASURED]

**But the history says transient, and the delta says it cannot be the diff.**
`gh run list --branch feat/ea-2a-estimating-analytics-preset --workflow 'Tendering Browser Smoke'
--limit 12` → **11 consecutive `success`, then this one `failure`.** The failing head `5806605c`
differs from the last green head `b0fdd463` by exactly one commit, and
`gh pr view 1920 --json commits` (assign-then-parse, never `--jq` with spaces — §9.4) shows it is
`Merge branch 'main' into feat/ea-2a-estimating-analytics-preset`, authored
`GH-Mantova <273896040+…@users.noreply.github.com>` at `20:41:19Z` — the branch-update path, not a
human edit. What landed on `main` in that window was `#1937` and `#1938`, **my own docs-only board
PRs**. A docs diff cannot change dashboard behaviour. That is DOCTRINE rule 5's transient shape
exactly. [MEASURED]

**POSITIVE control before re-running: the duplicate key is ABSENT from the green predecessor.**
The log of run `34892819907` (`b0fdd463`, success) contains **0** occurrences of
`user_dashboards_user_id_slug_is_system_key`, against `20 passed (1.6m)` and `166 passed (10.0m)`.
So the error is not benign background noise that every run emits — it appeared only in the red run,
which is the reading that argued *against* calling it a flake. [MEASURED]

**The discriminator: `gh run rerun 34894440823 --failed`, same commit, no code change.**
Attempt 2 completed `success` at `21:31Z`. Its log: **`20 passed (1.6m)`** and
**`166 passed (9.8m)`**, `user_dashboards_user_id_slug_is_system_key` → **0**, `ERROR:` lines → **0**,
fresh needle → **0**. Identical commit, identical code, opposite result. [MEASURED]

**Board after the re-run.** `gh pr checks 1920` lists exactly **two** failing checks —
`Approval receipt (CP-26)` and `PR gates — diff checks` — which are the same check counted twice
from one cause, `[LABEL_PRESENT]`, parked by design (§9.4). The e2e red is gone. `#1920` remains
`BLOCKED` on the label, `#1923` remains `CLEAN`. [MEASURED]

**Freshness, crossed against `lastRunAt`.** `check-breadcrumb.mjs --freshness` exit 2:
`00` 1.1h `ok` · `03` **94.1h SILENT** · `04` 2.9h `ok` · `05` 7.0h `ok`.
`structure: 2 checked, 0 malformed`. `list_scheduled_tasks` at 21:2xZ:

| task | enabled | cron | `lastRunAt` | `nextRunAt` |
|---|---|---|---|---|
| `00-supervisor` | true | `5 * * * *` | 2026-09-14T21:08:29Z | 22:07:52Z |
| `03-machine-minder` | true | `0 9 * * *` | **2026-09-10T23:01:10Z** | **2026-09-14T23:00:45Z** |
| `04-scanner` | true | `0 */4 * * *` | 2026-09-14T18:10:07Z | 22:09:31Z |
| `05-sot-keeper` | true | `10 0 * * *` | 2026-09-14T14:11:11Z | 2026-09-15T14:10:37Z |
| `weekly-security-audit` | **false** | `30 7 * * 1` | 2026-09-06T21:32:44Z | — |

[MEASURED]

**Watcher.** node RUNNING pid 30976, auto-restart wrapper alive (1), heartbeat 39 min, queue
`armed: 0`. A stale heartbeat with an empty queue is an **idle** watcher, which is correct. I did
not run the `-Fix` path and had no verdict that would license it. [MEASURED]

**Dev tree.** `git diff --numstat` EMPTY, `git diff --cached --name-status` EMPTY. Untracked
non-review entries: `Claude Design/docs/index.html`, `docs/pr-prompts/.queue-sync-ledger.txt`,
`docs/pr-prompts/queue-watch-state.md`, and the two `-LOOPING.md` under
`docs/pr-prompts/superseded/`. **No breadcrumb litter at the repo root and no dirty
`sweep-rotation.json`** — the 20:10Z run committed it. [MEASURED]

## WHAT CHANGED

1. **`#1920`'s `tendering-e2e` was re-run and is now green.** `gh run rerun 34894440823 --failed`,
   attempt 2, `success` at `21:31Z`. Read back from GitHub, not from my impression of it:
   `gh pr checks 1920` now lists two failing checks where it listed three, and the two remaining are
   the CP-26 pair. **No code was pushed to that branch and no label was touched.**
2. This breadcrumb, written **inside this run's own PR worktree** `C:\po-wt\bd-0915` (cure 1 — no
   loose untracked copy in the dev tree, so the post-merge fast-forward cannot be blocked by it).
3. The 20:10Z breadcrumb is archived by `git mv` into `docs/pr-prompts/archive/` in this run's PR —
   every finding in it carries a disposition. It was written inside its own run's worktree, so
   there is no untracked root copy in the dev tree to double-commit (the 2026-09-07
   duplicate-basename rule, checked against `git status` before the move).

**Nothing else on the board was mutated. No PR merged, no label touched, no prompt armed, no
watcher restarted, nothing deleted.**

## FINDINGS

### F1 — An e2e red on `#1920` was NON-DETERMINISTIC, and the duplicate-key error it logged is absent from BOTH green runs of the same code. S2.

The two readings available at 21:10Z pointed opposite ways and each had real evidence.
**For a genuine defect:** the failing constraint `user_dashboards_user_id_slug_is_system_key` is the
PR's own subject, and it is **absent from the green predecessor's log** — so it was not background
noise. **For a transient:** 11 consecutive greens on the same branch, and the only delta was a
`Merge branch 'main'` of two docs-only PRs of my own.

The re-run settled it: **same commit `5806605c`, no code change, attempt 2 passed 20 + 166 with zero
`ERROR:` lines and zero occurrences of that constraint.** So the failure is real but
**intermittent**, and the honest statement is not *"it was a flake"* — it is *"this test batch
non-deterministically collides on a unique index that this PR introduces rows into."*

**Two candidate mechanisms, neither measured, and I am not choosing between them:** the seeded EA
preset may be racing the dashboard-creation the test performs, or the seed may not be
insert-if-absent under a re-run of the same ephemeral database. Naming a cause I have not measured
is what §8.1 forbids.

**Why it is recorded rather than waved through.** §2 says *"never re-run hoping for green"* — I
re-ran having first read the job log, established the 11-green history and proved the delta was
docs-only, which is rule 5's licensed order. But a green re-run closes the CI question, not the
defect question, and a flake with a named signature is cheaper for the next run than a rediscovery.

**DISPOSITION: DEFERRED.** It is on a PR that is Marco's to merge, the fix would touch
`apps/api` seed or test code on his branch, and the choice between the two mechanisms is a real
diagnosis this run did not have the budget to complete honestly. **What would make it urgent:** a
second occurrence — the signature to grep for in any `tendering-e2e` log is
`user_dashboards_user_id_slug_is_system_key`, and the tell is `4 failed` in
`pr-acceptance-batch1-dashboards` with `element(s) not found` on a dashboard nav link. Two
occurrences make it a reproducible defect rather than a flake, and at that point it should be
staged as a fix prompt rather than re-run. **Falsifying probe: re-run any future red of this batch
on an unchanged commit.** If it fails identically twice on the same SHA, this finding is wrong and
the failure is deterministic.

### F2 — The branch-update path put a red on a Marco PR that nobody would have re-run, and this is the already-escalated `pollForBehindPrs` cost, now with a measured price. S3.

The commit that carried the red into `#1920` is `Merge branch 'main' into …` at `20:41:19Z`, about
13 minutes after `#1938` merged. That is the auto-update-on-behind path already escalated as
`needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`. Until now the recorded cost
was churn — rebuilt PRs and clone drift. **This run measures a sharper one: the rebuild re-rolled a
non-deterministic test and lost.** A PR that had been green for eleven runs showed `3 fail` to
anyone who looked, on a branch whose code had not changed, and the only actor positioned to notice
is the hourly collect.

**The compounding part is that RULE 2 makes nobody else able to clear it.** `#1920` is Marco's;
agents do not merge it, so a red sitting on it is simply *there* until a station re-runs it or
Marco reads past it. The escalation's option (a) — *skip PRs `classifyPolicyFiles` refuses* — is the
complete-and-additive one and would have prevented this instance outright: `#1920` carries a
`migrations/` path, so `classifyPolicyFiles` refuses it and it can never auto-merge, which makes
every branch update on it pure cost.

**DISPOSITION: DEFERRED**, folded into the existing escalation rather than raised as a new one —
this is a second measured consequence of a filed cause, not a new defect, and DOCTRINE §9.5's
closing bullet is explicit that re-filing a live escalation under a new name is how a queue rots.
**What would make it urgent:** a branch update landing a red on a Marco PR that then goes
*unnoticed* into a run that reports the board as blocked on a defect. This run caught it inside 60
minutes because the previous collect recorded `13 pass / 2 fail` and the diff was one check.

### F3 — Station 03 has been SILENT 94.1 h, and the test that decides scheduler-vs-station is still 1.5 h away. This run does not cross it either. S2.

`lastRunAt 2026-09-10T23:01:10Z`, enabled, cron `0 9 * * *`, `nextRunAt 2026-09-14T23:00:45Z`. Its
`lastRunAt` aligns exactly with its own newest breadcrumb, so 03 reported correctly when it last
ran, and all three missed occurrences fall inside the already-escalated all-stations scheduler hole.
03 is simply the only station whose cadence is long enough that it has had no slot since the
scheduler recovered — 00, 04 and 05 have all fired since.

**DISPOSITION: DEFERRED**, unchanged, with the boundary restated verbatim so the run that crosses it
does not re-derive it: **if `lastRunAt` for `03-machine-minder` is still `2026-09-10T23:01:10Z`
after `2026-09-14T23:00:45Z` while 00 has continued to fire hourly, the shared-scheduler
explanation is REFUTED and 03 is a station defect to escalate.** The **23:07Z** run is the one that
owes this answer; the 22:07Z run will not reach it either. Seven runs have now handed this forward,
and that is a property of 03's cadence, not of the handoffs.

### F4 — The VM/mount transport is down for a seventh consecutive station run, so `vm-git-guard.sh` could not be installed. S3.

Failure quoted verbatim above. The hazard the guard exists to stop — a cut-short VM-side `git` call
leaving a 0-byte `index.lock` on the Windows `.git` — is moot while the mount is unreachable,
because there is no VM-side `git` to make the call. **An uninstallable guard is never a licence to
run `git` against the mount**, and none was run.

**DISPOSITION: DEFERRED** — already escalated as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`; this is its Nth occurrence,
not new information. **What would make it urgent:** the mount returning while the guard is still
uninstalled, or a run needing the mount for COLLECT because Desktop Commander is down at the same
time. Desktop Commander carried everything this run.

### F5 — The transport called a live shell finished twice more, and the strengthened guard settled both in one call each. S4.

`Process 17580 has finished execution` was printed twice this run, both times after a statement
whose output was large. **The shell was alive both times**: `read_process_output` on the same PID
returned the pending buffer, and a subsequent `"PING-ALIVE"` answered from
`C:\ProjectOperations2` with its working directory intact. One of the two lost only the node
statement's stdout, which was recovered by re-running that statement alone against the same shell.

This is exactly what `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1` predicts —
landed on `main` in `#1938` at 20:28Z, i.e. the clause was 40 minutes old when it paid for itself
twice. **The strengthened guard (2) — do not merely ping the PID, READ ITS BUFFER — is what
decided it**, and no shell was abandoned.

**DISPOSITION: ACTIONED** — nothing to add to §9.1; the clause is correct as written and its cure
worked unmodified. Recorded so the bullet has a third independent instance rather than only its
two authoring runs. **Falsifying probe unchanged:** on the next such message, drain the buffer and
look for the chain's last marker.

## WHAT I DID NOT DO

- **Merged nothing on the board.** Both open PRs carry a genuine watcher `marco:true` verdict,
  re-taken this run with positive and negative controls and cross-checked against the anti-scrape
  rule. RULE 2 binds and is not cleared by green, by CLEAN, by an empty label list, or by a routing
  reason I could argue with. `#1923` is CLEAN and green and is still not mine.
- **Removed no label.** `#1920`'s `do-not-merge` is Marco's alone, and its two remaining CI reds are
  that one label counted twice. There is no agent-side action behind `[LABEL_PRESENT]`.
- **Pushed no code to `#1920`'s branch.** The e2e red was settled by a re-run of the identical
  commit. Pushing a speculative fix for a mechanism I had not measured would have been a second bug
  (§8.1), on a branch that is Marco's, for a failure that does not reproduce.
- **Armed nothing.** `armed = 0` and it stays 0. Every arm available today lands on Marco, whose
  board already holds two PRs, one of which spent this hour red. With no human present to answer
  *whether* to arm, the additive choice is to leave the queue where it is and say so.
- **Cleared no escalation.** Section 5 produced zero `[STALE]` escalation rows; nothing qualified
  for `needs-marco/discharged/`.
- **Did not re-file F2 as a new escalation.** It is a second measured consequence of
  `hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`, and re-filing a live escalation under a
  new name is the queue rot §9.5 records.
- **Did not take the one-character `'00': 1` fix to `check-breadcrumb.mjs`.** Unchanged from the
  20:10Z run's reasoning: the threshold is a decision Marco was explicitly asked for in escalation
  #23, and picking one of his three options unilaterally is guessing his intent (§5.5). Re-measured
  this run only in the sense that `--freshness` again reported `00 … (cadence 2h)`.
- **Did not restart or touch the watcher.** node running, wrapper alive, queue empty, heartbeat
  39 min — an idle watcher, not a wedged one.
- **Left all three orphaned worktrees alone.** `C:/PR-Master/worktrees/po-vg` holds 1 uncommitted
  file and is already escalated; pruning is destructive and 03's lane. The other two are clean.
- **Did not clean the watcher clone** (`dirty=2`, both `docs/pr-reviews/pr-*-review.md` the `rev-`
  job writes there by design — the false-warning shape §9.5 records). Git in
  `C:\po-watcher\ProjectOperations` is read-only to me, absolutely.
- **Deleted nothing.** The two `-LOOPING.md` under `docs/pr-prompts/superseded/` and the untracked
  queue-state files were left exactly where they are — they match no watcher glob, and tracked
  `*-ready.md` at depth 1 is 0, so THE BOARD TRAP is clear.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and wrote no production data.
