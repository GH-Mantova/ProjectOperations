# Station 00 — Supervisor | 2026-10-06T23:14Z–2026-10-07T00:05Z

## GROUND

```
UTC            2026-10-06 23:14Z
origin/main    ed2543df            (git fetch origin --prune; git rev-parse origin/main)
dev tree       main @ ed2543df     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version: 1) — MATCH, full authority
```

Sighted run. `ToolSearch` keyword load for `desktop-commander` first, then `start_process`
shell `powershell.exe` returned on the first call. **NOT BLIND.**

Read in full from `git show origin/main:<path>` in the dev tree (never the working copy):
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` (core,
DOCTRINE_CORE_SPLIT_V1), `docs/pipeline/STATION-CAPABILITIES.md`.

## WHAT I MEASURED

**Git guard (PREFLIGHT 1).** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` —
headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Last line: `   PATH="/sessions/wonderful-awesome-bohr/.local/bin:$PATH" git <args>`.
**EXIT CODE 2**, read from the installer itself and not from a pipeline appended to it. This is the
expected station outcome per the three-outcome table — a FINDING, not a stop. No `git` ran through
the device bridge against any mount this run; every `git` call was made in the Windows shell.

**Sweep.** [MEASURED] `& C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1`, generated
2026-10-06 23:15:25Z, 181 report lines, `SWEEP_EXIT=10`. Section 0 positive controls both PASS
(`gh` reached GitHub and saw merged #2253; `node` runs). No `[BROKEN]` anywhere.
Section 7 verdict: **`SAFE TO ACT: no board mutation in progress, no recent remote activity, no
live station worktrees.`**

**Board — empty and green.** [MEASURED] from the sweep's section 1:
`OPEN PRs: 0` · `WAITING ON MARCO: 0 open PR(s) labelled do-not-merge` · `ALL OPEN (non-draft): 0`
· `main CI on ed2543df: 4 success / 0 failed / 0 running (trunk green)`.
MARCO_QUEUE_LINE_V1 figures for the record: **armed 0, waiting on Marco 0.**

**Board-busy gate, re-read immediately before the only mutation this run made.** [MEASURED]
`git index.lock interactive/clone: False / False`; git processes touching our trees: 0;
watcher build: `no build in flight (newest tick is 43.5 min old)`; `board lease: free`.
`Enter-BoardLease -Actor station-00` returned **True**.

**Live schedule, from the scheduled-tasks MCP (never from a doc).** [MEASURED]
2026-10-06T23:2xZ — four ENABLED tasks:

| task | cron | lastRunAt | age at read |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-06T23:14:02Z | this run |
| `03-machine-minder` | `0 9 * * *` | 2026-10-06T23:02:55Z | 20 min — on cadence |
| `04-scanner` | `0 */4 * * *` | 2026-10-06T22:09:40Z | 73 min — on cadence |
| `05-sot-keeper` | `10 0 * * *` | **2026-09-27T21:38:18Z** | **9.07 DAYS** |

`weekly-security-audit` remains `enabled: false` (lastRunAt 2026-09-06T21:32:44Z), so the live
enabled count is FOUR, as STATION-CAPABILITIES §1's 2026-09-15 correction records.
`05-sot-keeper` `nextRunAt: 2026-10-07T14:22:37Z`.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`
in the dev tree, **exit 2**:

```
structure: 9 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-06T22:14:00Z  1.1h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-06T23:03:00Z  0.3h ago  (cadence 24h + grace 3h)  ok
  04  last 2026-10-06T22:10:00Z  1.2h ago  (cadence 4h + grace 1h)   ok
  05  last 2026-09-24T14:23:00Z  297.0h ago (cadence 24h + grace 3h)  MISSED
MISSED: 1 station(s) past cadence + grace
```

It also printed `NOTE  00-03-machine-minder-2026-10-06-2303-...md is UNTRACKED — it reaches nobody
until a board PR commits it`. **breadcrumb-clean is claimed only for the `--freshness` and
structure passes quoted above**, which is what `check-breadcrumb.mjs` actually ran.

**Orphan-worktree classification — the 27 confirmations Station 03 could not gather.** [MEASURED]
`git worktree list --porcelain` in the dev tree (31 entries: dev tree + 3 detached + 27 branch
worktrees), then per branch `gh pr list --head <branch> --state all --json number,state,mergedAt`
and `git ls-remote --heads origin <branch>`. Every one of the 27 reads `remote-no`.

**17 of 27 have a MERGED PR — their work is on `main` and the local commits are pre-squash
residue. These are the safe ones:**

| branch | commits ahead | PR |
|---|---|---|
| `feat/marco-queue-line` | 1 | #2251 MERGED |
| `fix/pipeline-scripts-resolve-state-paths-from-module` | 4 | #2154 MERGED |
| `docs/board-lease-hold-wording` | 1 | #2241 MERGED |
| `feat/doctrine-core-split-v1` | 4 | #2246 MERGED |
| `feat/crm-interaction-channel-v1` | 3 | #2218 MERGED |
| `feat/retire-escalation-v1` | 4 | #2223 MERGED |
| `feat/review-priority-watcher-prs` | 2 | #2228 MERGED |
| `feat/s7c-2-personal-appearance` | 4 | #2231 MERGED |
| `feat/asb-enclosure-lines-s1` | 4 | #2236 MERGED |
| `feat/list-item-rename-v1` | 1 | #2242 MERGED |
| `chore/retire-1612-escalation` | 1 | #2250 MERGED |
| `chore/retire-spent-holds-1007` | 1 | #2252 MERGED |
| `docs/s7a-hold-arm-wording` | 1 | #2232 MERGED |
| `fix/s8i-travel-index-reset-and-tip-dailykm` | 1 | #2184 MERGED |
| `docs/stage-formrule-legacy-payload-retire` | 1 | #2176 MERGED |
| `docs/stage-watcher-pr-number-from-board` | 1 | #2197 MERGED |
| `feat/sweep-dirty-untracked-v1` | 1 | #2222 MERGED |

**10 of 27 have NO PR in any state and no remote branch — 75 commits that exist only on this
box:**

| branch | commits ahead | worktree |
|---|---|---|
| `wt-fv2-formrule-contract-drop` | **21** | `C:/po-wt/fv2drop` |
| `wt-s8h` | **16** | `C:/po-wt/s8h` |
| `rcpt-2183` | **15** | `C:/po-wt/rcpt-2183` |
| `rel-2246` | 6 | `C:/po-wt/rel-2246` |
| `rel-2239` | 4 | `C:/po-wt/rel-2239` |
| `wt-sec-a1` | 4 | `C:/po-wt/sec-a1` |
| `fix-2195` | 3 | `C:/po-wt/fix-2195` |
| `s7a-fix` | 2 | `C:/po-wt/fix-2237` |
| `fr-2247` | 2 | `C:/po-wt/fr` |
| `rel-2242` | 2 | `C:/po-wt/rel-2242` |

Controls: the probe's POSITIVE control is the 17 rows that returned a real PR number and state;
its NEGATIVE control is that the same command shape returned `NO_PR` for 10 branches on the same
run, so an empty answer is not the instrument failing globally. The two worktrees the sweep flags
as holding **uncommitted** work are both in the MERGED set — `C:/po-worktrees/sup-cwd-paths`
(#2154, 2 dirty files, 12.6 days) and `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (#2222,
1 dirty file, 4.1 days) — so for those two the commits are already on `main` and only the dirty
files need preserving. Plus `worktree-registry-escapees: 2`
(`C:\PR-Master\worktrees\bootstrap-check`, `C:\po-wt\dispatch-register-v1`, both 0 KB, no `.lock`).

**Queue census.** [MEASURED] armed (`*-ready.md`) at depth 1: **0**, by both
`git ls-files -- 'docs/pr-prompts/*-ready.md'` restricted to depth 1 and
`Get-ChildItem docs\pr-prompts -Filter '*-ready.md'` (the second is the one that matters —
DOCTRINE §9.2: `git status` is structurally blind to a gitignored `*-ready.md`).
`needs-marco/` 55 · `no-pr-opened/` 111 · `failed/` 80 · `blocked/` 201.
**13 `-HOLD.md` prompts remain at depth 1**, all tracked; frontmatter read for each:

| HOLD | escalates | hard stop / gate |
|---|---|---|
| `pr-524-rates-b-slice2-canonical` | true | destructive table drop — DOCTRINE §5.4 |
| `pr-rates-s11c-drop-legacy-tables` | true | destructive drop; blocked on the 11b2-c parity proof |
| `pr-retire-tenderclientnote-s2` | true | destructive drop |
| `pr-siteid-notnull-backfill` | true | migration + NOT NULL + FK change |
| `pr-tenant-mt4-s2-ownership-migration` | true | production data — Marco arms and merges |
| `pr-scopecards-s8b-azure-maps-travel` | true | **Azure** — absolute hard stop |
| `pr-sec-a2-email-codes-and-reset-links` | true | auth / credential delivery |
| `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | true | waits on the `map-locations-waste-rate-coupling` decision |
| `pr-fv2-output-channels` | true | escalating |
| `pr-queue-layout-sot-entry` | false | its `done_when` greps `sot/` — **Station 05's lane only**; CP-24 hard-fails a mixed PR |
| `pr-nav-jobs-projects-merge` | false | model-merge: the backlog item forbids auto-staging, Marco present, one at a time |
| `pr-fv2-ai-digests` | false | no `requires_on_main` — no gate to verify |
| `pr-vendor-invoice-ocr` | false | no `requires_on_main` — no gate to verify |

**Backlog gates.** [MEASURED] sweep section 6: `ready=1 needs-marco=2 blocked=4 broken=0`.
The one READY item is `rates-11c-blocked-consumers` [P2], which is a **staging** item (Station 06),
not an arming item, and its own note says 11c must not merge until the parity proof has RUN clean.

**Fast-forward readiness of the dev tree, all four readings the station doc prescribes.**
[MEASURED] `git rev-list --left-right --count HEAD...origin/main` → `0 0`;
`git diff --numstat` EMPTY; `git diff --cached --name-status` EMPTY;
`git status --porcelain` tracked-portion EMPTY (25 untracked paths, breadcrumbs and scratch).

**[CANNOT MEASURE]** whether `05-sot-keeper` fired and died, or was never fired, on each of the
nine occurrences between 2026-09-28 and 2026-10-06. The MCP exposes only `lastRunAt`, which still
reads 2026-09-27T21:38:18Z, so for the 2026-09-27 occurrence I can say it fired and wrote no
breadcrumb (newest 05 breadcrumb 2026-09-24T14:23Z); for the eight since, `lastRunAt` older than
one cadence classifies them **never fired**, and there is no per-occurrence run history on disk to
separate them individually.

## WHAT CHANGED

One mutation: the board PR carrying this breadcrumb plus Station 03's 2026-10-06T2303Z breadcrumb,
which was untracked in the dev tree. Branch `chore/st00-collect-20261007`, built in an
isolated worktree `C:\po-wt\st00-collect-1007` off `origin/main` at `ed2543df`, merged through
`Assert-SmokedOrEscalate` → `Merge-Pr`. Read-back of the PR state is recorded in the PR itself and
in the chat report for this run.

Nothing else. No prompt armed or disarmed. No label added or removed. No escalation retired. No
worktree pruned. No lock cleared. No watcher touched. No `/sot/` edit. No Azure / Entra /
SharePoint. No production data.

## FINDINGS

### F1 — `05-sot-keeper` is now the ONLY silent station, and its next real occurrence is 2026-10-07T14:22Z

Collected from Station 03's 2026-10-06T23:03Z breadcrumb, F1 (DISPATCHED to 00), and re-measured
live this run per DOCTRINE §7.1's re-read rule.

[MEASURED] scheduled-tasks MCP at 2026-10-06T23:2xZ: `05-sot-keeper`, `cronExpression "10 0 * * *"`,
`enabled: true`, `lastRunAt 2026-09-27T21:38:18.894Z` (9.07 days), `nextRunAt 2026-10-07T14:22:37Z`.
The other three enabled tasks read from the same instrument in the same call are all inside one
cadence, so `lastRunAt` is not globally stale — it is this one task.

**What is new since #2253, and it narrows the alarm by two thirds.** #2253 escalated *three* of four
stations silent nine to eleven days. 00 has now fired twice (22:14Z, 23:14Z), 03 once (23:02Z) and
04 once (22:09Z) — all four of those runs are after the recovery. So the scheduler is demonstrably
firing again, and the open escalation's premise is now true of **one** station, not three.

**And the honest reading of that one is weaker than "the scheduler is still dropping 05".**
`10 0 * * *` is evaluated in Brisbane local time, i.e. 14:1xZ. The last 05 occurrence was
2026-10-06T14:22Z, which falls BEFORE the earliest post-recovery run on the board (04 at 22:09Z).
**05 has not had an occurrence since the scheduler recovered.** Its `nextRunAt` is correctly
forward-dated. Declaring 05 broken today would be reasoning from a window in which no evidence
could exist — DOCTRINE §9.6, an empty result is not an empty world.

The falsifying probe is one call, and it has a date: read `lastRunAt` for `05-sot-keeper` from the
scheduled-tasks MCP **after 2026-10-07T14:23Z**. Within 24 h of that read → recovered, and the
escalation discharges. Still 2026-09-27 → the 2026-10-07 occurrence was dropped too, which is the
first post-recovery evidence that 05 specifically is being skipped, and it escalates on its own.

Second-order cost, unchanged either way: nine days of `/sot/` drift have gone unaudited, and
`05` is the only station that may edit `/sot/`. The `pr-queue-layout-sot-entry-HOLD` prompt in the
queue is stuck behind the same gap (see the HOLD table above).

**DEFERRED** — with an expiry, not an open end. The existing escalation
`docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
already carries this to Marco and is NOT retired: its premise is two-thirds resolved, not resolved.
What would make it urgent: the 2026-10-07T14:22Z occurrence leaving `lastRunAt` at 2026-09-27. The
Station 00 run after 17:30Z on 2026-10-07 (cadence + grace past that slot) is the one that must
make that call and escalate if it fails.

### F2 — 17 of the 27 orphan worktrees are provably safe to prune; 10 hold 75 commits that exist nowhere else; and no station has authority to prune either set

Collected from Station 03's 2026-10-06T23:03Z breadcrumb, F2 (DISPATCHED to 00, recommending
option 1: confirm-then-preserve-then-prune). 03 explicitly did not run the 27 confirmations because
*"a confirmation I gather now expires before whoever prunes reads it."* **I ran them this run** —
the tables under WHAT I MEASURED are that classification, and it is the piece of work the dispatch
was for.

The classification changes the shape of the job: it is not 26 unknowns, it is **17 certainties and
10 real decisions.** For the 17 the local commits are pre-squash residue of a merged PR; nothing is
lost by pruning them, and two of the three worktrees the sweep flags as dirty are in this set, so
only their uncommitted files need preserving. The 10 `NO_PR` branches are the genuine question, and
three of them are large — `wt-fv2-formrule-contract-drop` (21 commits, 12.6 days),
`wt-s8h` (16), `rcpt-2183` (15).

Then the authority problem, which is the actual blocker and is a gap in the matrix rather than in
anyone's diligence. STATION-CAPABILITIES §5 gives **00** `Repair the machines: ❌ dispatches 03`,
and gives **03** `⚠ report-only`. 00 may not prune; 03 may not prune; 03 correctly dispatched it to
00, and 00 can only dispatch it back. **A dispatch loop is not a remedy.** The count has grown, not
drained, across the 2026-09-21, 2026-10-06T23:03Z and this run's census, which is what a loop looks
like from outside.

**ESCALATED** — Marco. The question, with options, complete-and-additive first:

> 30 orphan worktrees are pinned on the box. 17 of the 27 branch-bearing ones are confirmed
> squash-merged (safe), 10 hold 75 commits that exist on no remote, 2 hold uncommitted files, and
> 2 registry escapees are 0 KB with no lock. STATION-CAPABILITIES §5 gives 00 "dispatches 03" and
> 03 "report-only", so neither may prune and the dispatch returns to 00. Who prunes?
>
> 1. **Give Station 03 prune authority, scoped and evidence-gated, and add the row to the matrix.**
>    03 may prune a worktree only when (a) its branch returns a MERGED PR from
>    `gh pr list --head <branch> --state merged` in the same run, and (b)
>    `git status --porcelain` in that worktree is EMPTY. Everything else it pushes to `origin`
>    first — additive, nothing destroyed, the work becomes reviewable — and only then prunes.
>    Solves it now (17 go immediately) and permanently (the gate keeps working as new worktrees
>    appear), and cannot destroy work: both halves of RULE 1 pass. It needs one matrix row and one
>    CI gate proving the lane's boundary, the way CP-24 proves 05's.
> 2. Leave it with Marco as a manual chore. Fails the *completely* half: nothing about the next 30
>    changes, and the 12.6-day pins in this census were 18-day pins under different names in the
>    2026-09-21 breadcrumb.
> 3. Let 00 prune the 17 confirmed-merged ones only. Fails the *completely* half — the 10 holding
>    75 unpushed commits and the 2 dirty trees stay pinned, which are exactly the ones that carry
>    risk — and it also contradicts §5 without changing it, which is how a matrix stops being the
>    thing that settles a dispute.

### F3 — Nothing was armed, and for the first time the reason is per-prompt rather than "nothing is ready"

[MEASURED] armed 0; 13 `-HOLD.md` at depth 1; frontmatter and hard-stop class for each in the table
under WHAT I MEASURED. Nine of the 13 carry `escalates: true` and sit on a DOCTRINE §5 hard stop
(destructive migration, production data, auth, or Azure). `pr-queue-layout-sot-entry` is Station
05's lane and CP-24 hard-fails any PR mixing code and `sot/`. `pr-nav-jobs-projects-merge` is a
model-merge slice the `model-merge-slices-rehomed` backlog item forbids auto-staging.

That leaves exactly two armable candidates — `pr-fv2-ai-digests` and `pr-vendor-invoice-ocr`.
Neither declares a `requires_on_main`, so there is **no gate to verify**: DOCTRINE §8.4 says a HOLD
is held only because a predecessor PR is unmerged, and these name no predecessor. Arming them is
therefore not a gate decision I can measure — it is a sequencing decision about which feature work
runs next, which is DOCTRINE §5.5, Marco's. Note also that `escalates: false` does not keep them
off his queue: both touch `apps/api/**`, outside `tests|docs`, so §10.1 step 2 routes the resulting
PR to him anyway.

**DEFERRED** — real, not now, and the question is in `## FOR MARCO` below rather than as a new
`needs-marco/` row, because it is one sequencing question and not a defect. What would make it
urgent: the board staying empty for another day. An idle board with 13 HOLDs and no armable gate is
the condition this finding exists to make visible, and it is new information — previous runs
recorded "nothing is ready", which read as a queue state rather than as a classification gap.

### F4 — Station 03's bootstrap says "every 4 hours" against a daily cron, and survived a rewrite yesterday with the drift intact

Collected from Station 03's 2026-10-06T23:03Z breadcrumb, F4, which 03 marked **ESCALATED** to
Marco. [MEASURED] by 03 the same run: bootstrap mtime `2026-10-06T05:59:29Z`; its first body line
reads *"Cadence: every 4 hours"*; MCP `cronExpression: "0 9 * * *"`. I re-read the cron live this
run and confirm `0 9 * * *` — 03's half of the premise holds at my SHA.

03's three options are sound and I am not re-deciding them. One addition from this run that bears
on option 1: a 4-hourly 03 would land inside ten minutes of 04's `0 */4 * * *` **by construction**,
which is the 00×04 collision STATION-CAPABILITIES §6 already records six times a day — so option 1
needs a minute offset specified with it, not after it.

**ESCALATED** — Marco, carried verbatim into `## FOR MARCO` below. 03 cannot escalate to him
directly; the escalation channel is 00's, which is what the dispatch is for.

### F5 — The watcher quarantined six prompts for one authentication outage; closed as an incident

Collected from Station 03's 2026-10-06T23:03Z breadcrumb, F3, which 03 marked **DEFERRED**.
Three `rev-*` prompts burned in 193 s on 2026-10-02 against an expired OAuth token and three more
on 2026-10-04 against a revoked one; the dequeue loop files each as a per-prompt code failure in
`failed/`. [MEASURED] this run from the sweep's section 4B, which shows the same signature in the
newest `failed/` entries, and the board is empty with armed 0, so nothing is mid-burn.

**DEFERRED** — I agree with 03's disposition and am not re-opening it. What would make it urgent is
unchanged: a 401 in `scripts/pr-watcher/logs/<today>.log` while the queue holds armed prompts. The
fix belongs in `scripts/pr-watcher/index.mjs` (treat an auth 401 as a stop-the-loop condition, not
a prompt failure) and needs a watcher restart to adopt — DOCTRINE §9.5.

### F6 — The 2026-09-27 keepalive finding does not reproduce

Collected from `00-03-machine-minder-2026-09-27-2144-the-keepalive-was-disabled-one-second-before-
the-watcher-stopped-and-nothing-has-run-since.md`.

[MEASURED] by Station 03 at 2026-10-06T23:03Z: `PO Watcher Keepalive` scheduled task
**State = Ready**; `watcher node: RUNNING pid 39052`; `auto-restart wrapper: alive (1)`; restarter
chain all `Test-Path` True. Confirmed in my own sweep at 23:15Z: same pid, wrapper alive, heartbeat
43 min with armed 0 — idle, not wedged (DOCTRINE §9.5: the heartbeat ticks only mid-run).

**ACTIONED** — the condition is gone, verified twice by two stations an hour apart from the live
process table and `Get-ScheduledTask`, not from a file.

Correcting one claim in 03's own report while I am here, because it is the §7.1 re-read rule
working as intended. 03's closing line says this 09-27 breadcrumb *"is sitting beside it, also
untracked"* and asks 00 to sweep both. It was already tracked when 03 wrote that. [MEASURED] this
run: `git log --oneline -1 origin/main -- <that path>` → `ed2543df docs(board): collect - three of
four stations silent nine to eleven days; retire 5 dead escalations (#2253)`, and #2253 merged
**2026-10-06T22:31Z** — 32 minutes before 03's run started. `git ls-tree -r --name-only origin/main`
lists the path; `git diff --numstat origin/main -- <path>` is EMPTY, so the dev-tree copy is
identical to the committed blob. My own `git add` of it staged nothing, which is how I noticed.
Most likely cause: 03 read its tracked-set before fetching, so its `origin/main` predated #2253 —
the per-tree remote-tracking-ref trap in DOCTRINE §9.2. Harmless here, but it is the shape that
costs a run when the stale side is a gate rather than a sweep request.

### F7 — The git guard reports itself INERT, as designed, and the ban stayed remembered

[MEASURED] exit 2, headline quoted under WHAT I MEASURED. `bash -c 'command -v git'` resolves
`/usr/bin/git`, not the shim, because the shell a station is given is non-interactive and
non-login, so it sources neither `~/.bashrc` nor `~/.profile`. This is the EXPECTED station
outcome, recorded in the station doc's three-outcome table.

**ACTIONED** — the only protection available was honoured by discipline: every `git` and `gh` call
this run was made through Desktop Commander in the Windows shell, and nothing ran `git` against a
mount. Recorded rather than dispositioned away, because an install nobody can see in a report is
indistinguishable from one that never ran.

## WHAT I DID NOT DO

- **Armed nothing.** Per-prompt reasons in F3. Nine of 13 HOLDs sit on a §5 hard stop, two are
  another station's or Marco's lane, two have no gate to measure.
- **Merged nothing but this run's own board PR.** OPEN PRs was 0 at both reads, so there was no
  other PR to drive. No `do-not-merge` label was touched and no watcher-routed PR exists.
- **Retired no escalation.** The sweep tagged nothing `[STALE]` this run; its section 5 lines are
  `[FILE] ... cites #N (MERGED) as evidence -- not its premise`, which the tool itself says does
  not clear the row. The `stations-00-03-05-...-2026-10-06` row is two-thirds resolved and stays
  (F1). I did not call `retire-escalation.mjs` at all.
- **Pruned no worktree and cleared no registry escapee**, including the 17 I just proved safe.
  §5 does not give 00 that authority and F2 escalates the gap rather than reasoning past it.
- **Did not archive the four 2026-09-25 breadcrumbs or the 2026-10-02 Station 06 breadcrumb.**
  I did not disposition their findings this run, and the contract archives a breadcrumb only once
  every finding in it carries a disposition. They stay in the queue root for a later COLLECT.
- **Did not run `smoke-pr.ps1`.** This PR is `docs/pr-prompts/**` only; `Assert-SmokedOrEscalate`
  decides, and its exit code is what the merge used — not my reading of the diff.
- **Did not write an approval receipt.** CP26_ARMED_BY_DIFF_V1 arms on a migration file or a file
  outside `tests/` or `docs/`; this diff is `docs/` only, so no receipt is required. I did not
  write a standing receipt it does not call for.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, any production data, or any scheduled task.**
  `05-sot-keeper` was not disabled, enabled, edited or re-run — DOCTRINE §7 forbids all four on a
  MISSED reading alone, and F1's reading is MISSED.

## FOR MARCO

Two questions and one expiring watch. Both questions come from Station 03 and this run's
measurements; neither is a status update.

**1. Who prunes the orphan worktrees?** F2 above has the three options with the measured census.
The complete-and-additive one is to give Station 03 a scoped, evidence-gated prune authority
(MERGED PR + clean `git status` in the same run, push-before-prune otherwise) and add the row to
STATION-CAPABILITIES §5. 17 worktrees go immediately on that rule and nothing can be destroyed.

**2. What is Station 03's intended cadence?** Its bootstrap says every 4 hours, the live cron says
daily (`0 9 * * *`). F4 above carries 03's three options verbatim. If you pick 4-hourly, it needs a
minute offset away from `:00` and `:05` in the same change, or it joins the 00×04 collision six
times a day.

**3. One sequencing question, not an escalation.** The board is empty and green with 13 HOLD
prompts left. Eleven are blocked by a hard stop or another station's lane. The two that are not —
`pr-fv2-ai-digests` and `pr-vendor-invoice-ocr` — declare no gate, so which (if either) runs next
is yours. Say the word and the next run arms one.

**And one watch with a date on it:** `05-sot-keeper` has not fired since 2026-09-27, but it has had
no occurrence since the scheduler recovered on 2026-10-06. Its next slot is 2026-10-07T14:22Z. The
Station 00 run after 17:30Z tomorrow reads `lastRunAt` once: fresh means recovered and the
escalation discharges; still 2026-09-27 means 05 specifically is being skipped and that is the
first evidence of it.

---

**Station 00 — this breadcrumb and Station 03's 2026-10-06T2303Z breadcrumb are committed in this
run's own PR**, so neither is left untracked waiting for a sweep. 03's 2026-09-27 breadcrumb needed
no sweep: #2253 had already tracked it (F6).
