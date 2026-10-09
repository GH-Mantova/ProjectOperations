# Station 03 — Machine Minder | 2026-10-06T23:03Z–2026-10-06T23:16Z

## GROUND

```
UTC            2026-10-06 23:03Z
origin/main    ed2543df            (git fetch origin; git rev-parse --short origin/main)
dev tree       main @ ed2543df     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                   (station_doc_version: 1) — MATCH, full authority
```

Read in full from `git show origin/main:<path>` in the dev tree: `03-machine-minder.md`,
`DOCTRINE.md` (core, DOCTRINE_CORE_SPLIT_V1), `STATION-CAPABILITIES.md`.
Sighted run — Desktop Commander present, `start_process` shell `powershell.exe` returned a prompt
on the first call after the `ToolSearch` load. **NOT BLIND.**

## WHAT I MEASURED

**Git guard (PREFLIGHT 1).** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line:
`To get the protection for one call, put the shim on PATH yourself:` followed by
`PATH="/sessions/amazing-sweet-johnson/.local/bin:$PATH" git <args>`.
Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
**EXIT CODE 2** — read from the installer itself, not from a pipeline. This is the expected
station outcome per the station doc's three-outcome table: a FINDING, not a stop. No `git` was run
through the device bridge against any mount this run; every `git` call was made in the Windows
shell.

**Sweep.** [MEASURED] `& C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1`, generated
2026-10-06 23:03:51Z, 761 lines. Section 0 positive controls both PASS (`gh` reached GitHub and saw
merged #2253; `node` runs). No `[BROKEN]` anywhere.

**Watcher — healthy.** [MEASURED] from the sweep and from the clone log:
- `watcher node: RUNNING pid 39052`; `auto-restart wrapper: alive (1)`.
- `heartbeat age: 31 min` at 23:03Z, with `armed (*-ready.md): 0` — the heartbeat ticks only
  mid-run, so stale + empty queue is IDLE, not wedged (DOCTRINE §9.5).
- Newest clone log line at 23:07:57Z: `[review] verdict-archive sweep: archived=0 kept=0 skipped=0
  tracked=185` — the loop is ticking on a five-minute cadence right now. Timestamp taken from log
  CONTENT, not from a mount `stat`.
- `PO Watcher Keepalive` scheduled task: **State = Ready** (`Get-ScheduledTask`). The 2026-09-27
  breadcrumb's finding — keepalive disabled one second before the watcher stopped — does not
  reproduce; it is enabled now.
- Restarter chain present: `C:\po-watcher\ensure-watcher.ps1`, `watcher-launcher-singlelane.ps1`,
  `scripts\restart-watcher-if-wedged.ps1` all `Test-Path` True.

**Locks and board-busy.** [MEASURED] `git index.lock interactive/clone: False / False`; git
processes touching our trees: 0; board lease: free. **No stale lock to adjudicate this run.**

**Clone drift — none.** [MEASURED] `git -C C:\po-watcher\ProjectOperations rev-list --left-right
--count HEAD...origin/main` → `0 0` (clone HEAD `65e7c22c` is the clone's own ref; it is level with
its `origin/main`).

**Dev tree clean on all four readings** (the fast-forward test the station doc prescribes).
[MEASURED] `rev-list --left-right --count HEAD...origin/main` → `0 0`; `git diff --numstat` EMPTY;
`git diff --cached --name-status` EMPTY; `git status --porcelain` tracked-portion EMPTY.
23 untracked paths remain (breadcrumbs and scratch), which do not block a fast-forward until a PR
lands one of those exact paths on `main`.

**Board.** [MEASURED] OPEN PRs: 0. Labelled `do-not-merge`: 0. `main` CI on `ed2543df`:
4 success / 0 failed / 0 running — trunk green. Queue: armed 0, `needs-marco/` 55,
`no-pr-opened/` 111, `failed/` 80, `blocked/` 201.

**Live schedule, from the scheduled-tasks MCP (never from a doc).** [MEASURED] 2026-10-06T23:1xZ —
four ENABLED tasks:

| task | cron | lastRunAt | age at read |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-06T22:14:01Z | 49 min — on cadence |
| `03-machine-minder` | `0 9 * * *` | 2026-10-06T23:02:55Z | this run |
| `04-scanner` | `0 */4 * * *` | 2026-10-06T22:09:40Z | 54 min — on cadence |
| `05-sot-keeper` | `10 0 * * *` | **2026-09-27T21:38:18Z** | **9.06 DAYS** |

`weekly-security-audit` remains `enabled: false` (lastRunAt 2026-09-06T21:32:44Z), so the live
enabled count is FOUR, as STATION-CAPABILITIES §1's 2026-09-15 correction records.

**Prior-breadcrumb diff (station brief step 1).** [MEASURED] Newest tracked 03 breadcrumb:
`archive/00-03-machine-minder-2026-09-24-2320-...`. Newest on disk: the untracked
`00-03-machine-minder-2026-09-27-2144-the-keepalive-was-disabled-...md` at depth 1 in
`docs/pr-prompts/`. So the last 03 report is **9 days old**, and it was never swept into a PR.

**New `failed/` entries since that breadcrumb — 10 prompts, ONE dominant signature.** [MEASURED]
`Get-ChildItem docs\pr-prompts\failed | ? LastWriteTimeUtc -gt 2026-09-27T21:44Z` → 19 files
covering 10 prompts:

| when (UTC) | prompt | log tail |
|---|---|---|
| 10-02 05:53 | `rev-2192-ready.md` | `401 OAuth access token has expired` |
| 10-02 05:54 | `rev-2193-ready.md` | `401 OAuth access token has expired` |
| 10-02 05:55 | `rev-2195-ready.md` | `401 OAuth access token has expired` |
| 10-02 07:01 | `pr-sweep-orphan-worktree-asks-the-board-b-ready.md` | report.md has an EMPTY agent-output block |
| 10-04 12:23 | `rev-2244-ready.md` | `401 OAuth access token has been revoked` |
| 10-04 12:28 | `rev-2243-c-ready.md` | `401 OAuth access token has been revoked` |
| 10-04 15:51 | `pr-doctrine-core-and-reference-ready.md` | `401 OAuth access token has been revoked` |
| 10-06 05:47 | `pr-sweep-marco-queue-line-ready.md` | `API Error: 400 ... 'thinking' or 'redacted_thinking' blocks in the latest assistant...` |

Six of eight are the SAME root cause — the watcher's Claude OAuth credential expiring (10-02) and
then being revoked (10-04). Three runs burned in 193 seconds on 10-02 because the watcher kept
dequeuing into a dead credential. **It has since recovered:** [MEASURED]
`Select-String -Path logs\2026-10-06.log -Pattern '401|revoked|expired'` → **0**, and the work both
affected prompts described landed anyway — `#2246` (DOCTRINE core split) merged 10-06 05:11Z and
`#2251` (marco queue line) merged 10-06 22:10Z. So this is a CLOSED episode, not a live defect.

**New watcher-loop error, one occurrence, self-recovered.** [MEASURED]
`[2026-10-06T22:48:31.751Z] [review] poll failed: gh pr list --state open --json ... exited 1:
failed to run git: BUG (fork bomb): C:\Program Files\Git\bin\git.exe - will retry next tick`.
Frequency across every daily log on the box: `2026-07-20.log` → 1, `2026-10-06.log` → 1, all others
0. POSITIVE control `poll failed` in today's log → 1 (the same line). NEGATIVE control, a freshly
minted needle `zqx7-mm-20261006` → 0. The next tick at 22:52:57Z succeeded, so the retry path
worked as designed.

**Worktree census — the standing mess, unchanged in shape and larger in count.** [MEASURED] from
the sweep: `non-main worktrees found: 30`, every one classified `orphaned worktree (aborted run
leftover)`. Of those, **26 hold commits on no remote branch** and **2 hold uncommitted work**:
`C:/po-worktrees/sup-cwd-paths` (2 files dirty, age 18209 min ≈ 12.6 days, 4 unpushed commits) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 file dirty, age 5895 min, 1 unpushed commit).
Oldest: `C:/po-wt/fv2drop`, age 18144 min, **21 unpushed commits**. Plus
`worktree-registry-escapees: 2` — `C:\PR-Master\worktrees\bootstrap-check` (0KB, 5738 min, no
`.lock`) and `C:\po-wt\dispatch-register-v1` (0KB, 5844 min, no `.lock`). NEGATIVE control against
the sweep file, fresh needle `qqv3-mm-check` → 0. Guard hook `.claude/hooks/guard.mjs`: present.

**Bootstrap cadence drift persists in a file edited yesterday.** [MEASURED]
`(Get-Item 'C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md').LastWriteTimeUtc` =
`2026-10-06T05:59:29Z`. That file's opening line still reads *"Cadence: every 4 hours"*, against a
live cron of `0 9 * * *` (daily). The bootstrap was rewritten **yesterday** and the drift survived
the rewrite.

**[CANNOT MEASURE]** whether `03-machine-minder` fired at all between 2026-09-27 and this run. The
MCP exposes only `lastRunAt`, which this run has just overwritten, and there is no run history on
disk. The 9-day breadcrumb gap is consistent with both "did not fire" and "fired blind and reported
nowhere", and I cannot separate them.

## WHAT CHANGED

Nothing. This station is REPORT-ONLY (STATION-CAPABILITIES §5: *Repair the machines — report-only*).
No worktree pruned, no lock cleared, no prompt armed or disarmed, no label touched, no PR opened or
merged, no watcher restarted, no `/sot/` edit. The only write this run made is this breadcrumb.

## FINDINGS

### F1 — `05-sot-keeper` has not FIRED for nine days against a daily cron, and no instrument on this board is pointed at that

[MEASURED] scheduled-tasks MCP, 2026-10-06T23:1xZ: `05-sot-keeper`, `cronExpression: "10 0 * * *"`,
`enabled: true`, `nextRunAt: 2026-10-07T14:22:37Z`, **`lastRunAt: 2026-09-27T21:38:18.894Z`** —
9.06 days, against a cadence of one day. Nine scheduled occurrences produced no run. Controls: the
other three enabled tasks read from the same instrument in the same call are all inside one cadence
(`00` 49 min on hourly, `04` 54 min on 4-hourly, `03` this run), so the MCP's `lastRunAt` is not
globally stale — it is this one task.

Why this is a machine finding and not a breadcrumb-freshness finding: `#2253` (merged 22:31Z,
*"collect - three of four stations silent nine to eleven days"*) read the **silence** from
breadcrumb dates. `check-breadcrumb.mjs --freshness` compares breadcrumb dates and nothing else, so
it cannot tell "the station ran and wrote nothing" from "the station never ran". `lastRunAt` can,
and it says **never ran**. That distinction decides the remedy: a station that is reporting badly
needs its report contract fixed; a station that is not being fired needs the scheduler looked at,
and nine days of `/sot/` drift have gone unaudited either way.

The falsifying probe is one call: read `lastRunAt` for `05-sot-keeper` from the scheduled-tasks MCP.
If it is ever within 24 h of the read, this finding is discharged.

Note the second-order effect: the same nine-day gap exists in 03's own breadcrumb trail (newest
tracked 09-24, newest on disk 09-27), so whatever is dropping 05's occurrences may not be specific
to 05 — but for 03 I have no run history to prove it, which is the `[CANNOT MEASURE]` above.

**DISPATCHED** — Station 00. This is scheduler state in the `C:\Users\Marco\Claude\Scheduled\`
layer, which no station may mutate; 00 holds the decision and the escalation channel to Marco.
Hand-over content: the table under WHAT I MEASURED, and the one-call falsifying probe.

### F2 — 30 orphaned worktrees, 26 holding unpushed commits, 2 holding uncommitted work; two of them have been pinned for 12.6 days

[MEASURED] see the census under WHAT I MEASURED. This is the same condition the 2026-09-21
breadcrumb raised (*"a merged PR's draft has pinned a worktree for eighteen days"*) and the count
has grown rather than drained. The two that matter are the dirty ones — `git worktree remove` will
refuse them and `--force` would discard real work:
`C:/po-worktrees/sup-cwd-paths` (4 unpushed commits + 2 dirty files, 12.6 days) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 unpushed commit + 1 dirty file, 4.1 days).
`C:/po-wt/fv2drop` holds 21 unpushed commits and is 12.6 days old.

The sweep itself names the gate before any prune: for each branch, confirm with
`gh pr list --head <branch> --state merged`, because a squash-merged branch shows identically to a
genuinely unpushed one. I did not run those 26 confirmations — pruning is not my lane and a
confirmation I gather now expires before whoever prunes reads it.

RULE 1 on the options, complete-and-additive first:
1. **Confirm-then-preserve-then-prune, per worktree** — for each of the 26, run the `gh pr list
   --head` check; where the branch is squash-merged the commits are already on `main` and the
   worktree is safely prunable; where it is not, push the branch to `origin` (additive — nothing is
   destroyed and the work becomes reviewable) before pruning. Solves it now and permanently, and
   destroys nothing. Both halves of RULE 1 pass.
2. Prune only the 28 clean ones and leave the 2 dirty — fails the *completely* half: the two
   highest-risk trees stay pinned indefinitely, and that is exactly how the 18-day pin in the
   09-21 breadcrumb became a 12.6-day pin here under a different name.
3. `git worktree prune --force` across the board — fails the *without damaging* half outright; it
   discards 26 worktrees' unpushed commits and two sets of uncommitted edits.

**DISPATCHED** — Station 00, which dispatches the repair (STATION-CAPABILITIES §5). I am
report-only; option 1 above is the recommendation.

### F3 — The watcher burned three queued prompts in 193 seconds against an already-dead credential, and the credential then stayed dead for two more days

[MEASURED] `rev-2192` / `rev-2193` / `rev-2195` each started and exited 1 within 60 s of one
another (05:51:42→05:53:49, 05:53:49→05:54:49, 05:54:50→05:55:50 on 10-02), all three with
`Failed to authenticate. API Error: 401 OAuth access token has expired.` On 10-04 three more
(`rev-2244`, `rev-2243-c`, `pr-doctrine-core-and-reference`) failed with `401 ... has been revoked`.

The health question is not the token — it is that the dequeue loop treats a 401 as a per-prompt
failure and quarantines the prompt, so an authentication outage consumes the queue at one prompt per
minute and files each as a code failure in `failed/`. Six prompts were quarantined for a condition
none of them caused, and a later actor triaging `failed/` sees six independent entries rather than
one outage.

Currently recovered and not reproducing: 0 hits for `401|revoked|expired` in today's clone log, and
the two affected bodies of work landed as `#2246` and `#2251`.

**DEFERRED** — real, not now. It is closed as an incident and the board is empty, so there is
nothing to re-run and no live breakage. What would make it urgent: a 401 appearing again in
`scripts/pr-watcher/logs/<today>.log` while the queue holds armed prompts — at that point the loop
will quarantine the whole queue, and the fix (treat an auth 401 as a stop-the-loop condition rather
than a prompt failure) belongs in `scripts/pr-watcher/index.mjs` with a watcher restart to adopt it.

### F4 — The `03` bootstrap says "every 4 hours"; the live cron is daily — and the file was rewritten yesterday with the drift intact

[MEASURED] bootstrap mtime `2026-10-06T05:59:29Z`; its first body line says *"Cadence: every 4
hours, or manually after any crash or reboot"*; MCP `cronExpression: "0 9 * * *"`.
STATION-CAPABILITIES §6 already records this half as open with Marco. What is new here is that the
rewrite on 10-06 touched the file and left the wrong cadence in it, so the drift is not a stale file
nobody opens — it survived an edit.

Consequence, concretely: a reader of the bootstrap expects six 03 runs a day and gets one, which is
an error in the direction of *not noticing a missed run* — the same shape as the `00` 2× error that
STATION-CAPABILITIES §6 records.

**ESCALATED** — Marco. The question, with options, complete-and-additive first:

> 03's bootstrap claims a 4-hour cadence; its live cron is daily (`0 9 * * *`). Which is the
> intended cadence for Machine Minder?
> 1. **Set the cron to 4-hourly and leave the bootstrap as written** — the bootstrap, the station
>    doc's own cadence line and STATION-CAPABILITIES §6 all already say 4 h, so one change makes
>    three layers agree, and machine faults (dead watcher, stale lock, pinned worktree) get caught
>    within 4 h instead of up to 24. Additive: nothing is removed, and the only cost is more runs.
>    ⚠ It also widens the 00×04 collision §6 records — a 4-hourly 03 would need a minute away from
>    `:05` and `:00`.
> 2. Change the bootstrap to say "daily" — cheapest, and fails the *completely* half: it accepts a
>    24-hour blind window on machine health, which is longer than every outage this station has
>    recorded.
> 3. Leave both and rely on the reader to check the MCP — fails both halves; it is the status quo
>    that produced this finding.

## WHAT I DID NOT DO

- **Pruned nothing.** 30 worktrees, 2 registry escapees, 26 branches needing a `gh pr list --head`
  confirmation — all left exactly as found. Report-only lane, and F2 is dispatched to 00.
- **Did not clear any lock** — there was none to clear (`index.lock` False/False).
- **Did not restart or touch the watcher.** It is running, the wrapper is alive, and the keepalive
  task is Ready; there is no wedge to break.
- **Did not run the 26 `gh pr list --head <branch> --state merged` confirmations.** A verdict I
  gather now expires before the station that prunes reads it (`[LIVE]` means "true when measured"),
  so collecting them here would hand 00 a stale list that reads as authoritative.
- **Did not triage the `failed/` entries into `rev-` fix prompts.** All six 401s share one
  non-code root cause, the two bodies of work landed anyway, and the station brief routes a
  burned-credential class to recording rather than restaging.
- **Did not run `check-breadcrumb.mjs`**, so this report does not claim `breadcrumb-clean`. It
  shells `git` and `gh`; running it was available on this sighted transport, but its `--freshness`
  verdict is the instrument F1 shows cannot answer the question I was asking, and the structure
  pass would have told me nothing I could act on from a report-only lane.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or any production data.**
- **Did not move or sweep the orphaned 2026-09-27 breadcrumb** sitting untracked at depth 1 in
  `docs/pr-prompts/`. Moving it is queue mutation, which is 00's. Flagging it: it and this file are
  both untracked, and once a PR lands either path on `main` the dev tree's fast-forward will refuse
  while all three of the usual `git diff` readings still print EMPTY.

---

**Station 00 — this breadcrumb is UNTRACKED in the dev tree** at
`C:\ProjectOperations2\docs\pr-prompts\`. Station 03 may not create a PR, so it stays untracked
until you commit it. The 2026-09-27 03 breadcrumb is sitting beside it, also untracked, for the same
reason — sweep both.
