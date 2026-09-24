# Station 00 — Supervisor | 2026-09-24T12:14Z–2026-09-24T12:40Z

## GROUND

```
UTC            2026-09-24T12:14:55Z
origin/main    5bfd3dd7            (git fetch origin +refs/heads/main:refs/remotes/origin/main, then git rev-parse --short origin/main)
dev tree       main @ 690d80dc     C:\ProjectOperations2   (0 ahead, 3 behind at run start)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

**Version check: MATCH.** This run is SIGHTED — a Windows host shell was reached and every claim
below that is tagged `[MEASURED]` came from it.

## WHAT I MEASURED

**Host reach (PREFLIGHT step 1).** `[MEASURED]` `start_process` shell `powershell.exe` →
`HOSTPROOF=…2026-09-24T22:14:31.4319101+10:00` and `git log --oneline -1` → `690d80dc`. Desktop
Commander connected on the first keyword `ToolSearch` (`select:` on five ids). **Not blind.**

**vm-git-guard installer (PREFLIGHT step 1).** `[MEASURED]`
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line:
`PATH="/sessions/compassionate-focused-bohr/.local/bin:$PATH" git <args>`; headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
**EXIT CODE 2**, read directly from the installer (`echo "GUARD_EXIT=$?"` on the installer itself, no
pipeline appended). That is the documented middle outcome and a FINDING, not a STOP. **No `git` was
run through the device bridge against the mount at any point this run** — every git call went to the
Windows host.

**Freshness of the binding documents (PREFLIGHT step 2).** `[MEASURED]`
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ one row only: `0	13	docs/pipeline/STATION-CAPABILITIES.md`. So `DOCTRINE.md` and
`00-supervisor.md` in the dev tree are byte-equal to `origin/main` and were read there;
`STATION-CAPABILITIES.md` is 13 lines behind and was **not** relied on from the working copy. No
piped hash was taken (§9.1 forbids `git show | git hash-object --stdin` under `powershell.exe`).

**Sweep (PREFLIGHT step 4).** `[MEASURED]` `status-sweep.ps1` captured to a file and read back
(339 lines). Section 0 positive controls both `[LIVE]`: `gh CAN reach GitHub (saw merged PR #2162)`,
`node runs`. No `[BROKEN]`. Verdict rows relied on below:

| sweep line | value |
|---|---|
| OPEN PRs | **2** — `#2158` BLOCKED 13/2, `#2148` BLOCKED 13/2 |
| main CI on `5bfd3dd7` | 4 success / 0 failed / 0 running — **trunk green** |
| watcher node | RUNNING pid 42212; wrapper alive (2); heartbeat 104 min (idle queue ⇒ not wedged) |
| watcher clone | `branch=main dirty=1` |
| armed (`*-ready.md`) | **0** at run start |
| `git index.lock` dev/clone | False / False |
| git processes touching our trees | **0** |
| PR touched in the last 2 min | none |

**Safe-to-act gate, re-measured immediately before the one mutation I made.** `[MEASURED]`
2026-09-24T12:22:23Z: `indexlock_dev=False`, `indexlock_clone=False`, `gitprocs=0`,
`git diff --cached --name-status` **EMPTY**. BOARD-DRIVING condition 3 satisfied at the moment of
acting, not at sweep time.

**Tracked-set probe — asked `origin/main`, not the dev tree** (`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`,
which fires here because the dev tree was 3 behind). `[MEASURED]`
`node scripts/pipeline/check-breadcrumb.mjs --freshness` in the dev tree flagged **four** breadcrumbs
`UNTRACKED — it reaches nobody`. `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered
to `2026-09-24` shows **three of those four are already tracked under `archive/`** and only one is
genuinely absent:

| breadcrumb | dev-tree verdict | `origin/main` truth |
|---|---|---|
| `00-00-supervisor-…-0514-blind-desktop-commander-connect-timeout.md` | UNTRACKED | **tracked, `archive/`** |
| `00-00-supervisor-…-0614-rule-2s-verdict-was-always-readable….md` | UNTRACKED | **tracked, `archive/`** |
| `00-04-scanner-…-0610-four-pipeline-scripts-misname-a-wrong-cwd….md` | UNTRACKED | **tracked, `archive/`** |
| `00-04-scanner-…-1040-one-dead-premise-one-released-gate….md` | UNTRACKED | **absent — genuinely unreported** |

POSITIVE control on the same tree listing: `686` tracked breadcrumbs matching `/00-`. **Committing a
second root copy of any of the first three is the 2026-09-07 duplicate this probe exists to prevent,
and this run did not.**

**`check-breadcrumb.mjs --freshness`, exit 2.** `[MEASURED]`

```
00  last 2026-09-24T10:15:00Z  2.1h ago  (cadence 1h)  SILENT
02  dispatch-only — no cadence to miss
03  last 2026-09-23T23:04:00Z  13.2h ago (cadence 24h)  ok
04  last 2026-09-24T10:40:00Z  1.6h ago  (cadence 4h)   ok
05  last 2026-09-23T14:23:00Z  21.9h ago (cadence 24h)  ok
structure: 6 checked, 0 malformed, 0 skipped
```

**The `lastRunAt` cross-check.** `[MEASURED]` `list_scheduled_tasks`: `00-supervisor` cron `5 * * * *`,
`enabled: true`, `jitterSeconds: 532`, `lastRunAt: 2026-09-24T12:14:08.286Z` — **which is this run**,
so `lastRunAt` cannot answer whether the 11:0x occurrence fired (it holds only the most recent).
`04-scanner` `lastRunAt 2026-09-24T10:09:46Z`; `03` `2026-09-23T23:02:54Z`; `05` `2026-09-23T14:22:41Z`;
`weekly-security-audit` `enabled: false`.

**The third instrument: the session directory.** `[MEASURED]` a scan of
`…\local-agent-mode-sessions` at depth 2 with **no name filter** (the 2026-09-15 rename makes
`-Filter 'local_*'` blind) returned, in creation order:
`10:09:46.392Z 6b017a63` · `10:14:07.294Z 9ede326a` · **`11:14:08.016Z 7e14a296`** · `12:14:08.287Z 18c23df9`
(this run — my own session path ends `18c23df9`, which is the positive control that the scan sees the
right tree). **So the 11:14Z occurrence DID fire.** ⚠️ `[MEASURED]` the same query's date filter is
wrong and I am saying so rather than quoting its total: `$_.CreationTimeUtc -ge [datetime]'2026-09-24T00:00:00Z'`
parses the literal to a **Local**-kind DateTime (Brisbane, UTC+10) and the comparison then silently
means `>= 10:00Z`, so its `TOTAL_TODAY=4` is really "today after 10:00Z". `list_sessions` shows
`1140` sessions and older `"00 supervisor"` directories (`cea50e35`, `e4e9cffb`, `de67d105`,
`03c59b97`) that the filtered count excluded. **The presence of `7e14a296` is what settles the
question and it is unaffected by that bug; the absence of anything is not claimed.**

**The transcript of `7e14a296`** — the only channel that names the cause. `[MEASURED]`
`read_transcript(local_7e14a296-…)`: *"STATION 00 — SUPERVISOR · BLIND RUN · STOPPED AT PREFLIGHT
STEP 1"*, cause `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out
after 30000ms`, three keyword `ToolSearch` probes attempted before declaring it, and *"No breadcrumb
was written, and that is deliberate"* — on the ground that an untracked dev-tree breadcrumb it could
not open a PR for would block the next fast-forward.

**Both open PRs, per-PR, not from a listing.** `[MEASURED]`
`gh pr view <n> -R GH-Mantova/ProjectOperations --json number,state,title,mergeStateStatus,isDraft,labels`,
exit 0 on both:

| PR | state | mergeStateStatus | labels | failing checks |
|---|---|---|---|---|
| `#2158` feat(forms): drop five legacy FormRule flat columns | OPEN | BLOCKED | **`do-not-merge`** — *"escalates:true - Marco merges this, not automation (DOCTRINE 5b)"* | `Approval receipt (CP-26)`, `PR gates — diff checks` |
| `#2148` feat(auth): stop writing sign-in codes and reset links to the production log | OPEN | BLOCKED | **`do-not-merge`** — same description | `Approval receipt (CP-26)`, `PR gates — diff checks` |

That is exactly the §9.4 signature: *a PR carrying `do-not-merge` can never be green, and it shows as
two reds with one cause* — CP-26 runs both as the required check and as a step inside the diff-checks
job. **Parked by design. Only Marco removes the label. There is no agent-side action behind either.**

**F1's premise, re-run before acting on it.** `[MEASURED]`
`git grep -c "GEOAPIFY_ROUTE_TRAVEL_V1" origin/main -- apps/api/src` → **5 files**; NEGATIVE control, a
freshly minted needle `ZZQQ_NOT_A_REAL_MARKER_20260924` over the same tree → **0**. The premise
`! grep -rq …` is therefore **FALSE** and `pr-scopecards-s8g-…-HOLD.md` is finished work.

**s8h, before arming.** `[MEASURED]` `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-scopecards-s8h-traffic-index-ui-HOLD.md`
exit **0**, `PROMOTE … GATE_RELEASED requires_on_main: "…geoapify-route.provider.ts :: GEOAPIFY_ROUTE_TRAVEL_V1"
is now on origin/main`. ADMIT is necessary, not sufficient (§9.5), so I read the body: all three
markers the linter reads are absent (`watcher: do-not-arm` false, `DO NOT ARM` false, `Arm ONLY`
false), and both `Marco` mentions are benign — L29 *"(approved by Marco 2026-09-24)"* naming the
mock-up, L115 *"label the PR `do-not-merge` for Marco"*, which is the escalates handling, not a gate.
It is on no never-arm denylist (`pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, prod-data
MT-3/MT-5, `rates-s11c`, `site-dissolution`, `B-P0a-4-ii..8`, `B-SD`).

**Dev-tree state at run start.** `[MEASURED]` `git status --porcelain --untracked-files=no`:
` M docs/pipeline/sweep-rotation.json` · ` M docs/pr-prompts/.arming-log.txt` ·
` D docs/pr-prompts/pr-fv2-formrule-contract-HOLD.md` ·
` D docs/pr-prompts/pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md`. Staged: **EMPTY**.

## WHAT CHANGED

**1. Armed `pr-scopecards-s8h-traffic-index-ui`.** `[MEASURED]` `arm-prompt.ps1 -Name
pr-scopecards-s8h-traffic-index-ui -Actor station-00`, **exit 0**, through the serialising lock:
`Lock acquired (PID 31636)` → index clean before → RULE 4 no other prompt armed → lint PROMOTE →
rename → `Index contains exactly the two expected paths` → `Audit line written to .arming-log.txt` →
`ARM_INDEX_RELEASED` → `Index clean after release` → lock released. **Read back:**
`Test-Path …-ready.md` → **True**, `Test-Path …-HOLD.md` → **False**, and the log's last line is
`2026-09-24T12:22:24Z  ARMED  pr-scopecards-s8h-traffic-index-ui  escalates=true  actor=station-00`.
The board went from **armed=0 to armed=1** with a live watcher (pid 42212) to consume it.

**2. Board PR — everything below landed in one docs-only PR, built in a disposable worktree**
(`C:\po-worktrees\board-00-1214`, branch `board/00-collect-2026-09-24-1214`, created off
`origin/main` at `5bfd3dd7`; never the dev tree, never `C:\po-watcher`):

- `docs/pr-prompts/.arming-log.txt` — **04's F8 discharged.** Copied byte-exact from the dev tree
  (`bytes=25615 byteExact=true`) **after** my arm, so it carries all three of today's arms, including
  the two 04 measured as published nowhere.
- `docs/pipeline/sweep-rotation.json` — 04's rotation advance, copied byte-exact (`bytes=2837`), then
  reworded per F5.
- **F5 reword** of the `gate-liveness` brief: *"Repair dead … gates"* → *"REPORT dead … gates and
  STAGE the repair as a `-HOLD` prompt for Station 00 to arm — Station 04 is read-only on the board
  and may not create a PR (STATION-CAPABILITIES.md §5)…"*. Byte delta asserted:
  `before=2837 after=3039 expectedDelta=202 actualDelta=202 MATCH=true`, and the file still
  `JSON.parse`s.
- **F3 correction** to `docs/pipeline/stations/04-scanner.md` sub-check (a): the persona guard is
  re-pointed by **symbol anchor** (`PersonaPermissionGuard`, under `apps/api/src/modules/personas/`,
  explicitly *not* `common/auth/`), and the parity test is restated as a hardcoded `GUARDED_FILES`
  two-file list rather than *"automated enforcement"*. Byte delta asserted:
  `before=45946 after=46245 expectedDelta=299 actualDelta=299 MATCH=true`; all four readbacks true.
- **F1 deletion** of `docs/pr-prompts/pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md`
  (premise re-run FALSE this run, with a negative control).
- **The arm** committed as a `git mv` of the tracked `-HOLD.md` to `-ready.md`, never a creation
  (`.gitignore` swallows a created `*-ready.md`).
- `00-04-scanner-2026-09-24-1040-…md` landed at depth 1 — **04's report reached nobody until this
  commit**, and it is the only one of the four flagged UNTRACKED that was genuinely so.
- This breadcrumb, written **inside the PR worktree** (cure 1), so no loose copy exists in the dev
  tree and the post-merge fast-forward cannot trip on it.
- Archived, after dispositioning: `00-00-supervisor-2026-09-24-0814`, `-0915`, `-1015`.

**Nothing else was mutated.** No PR was merged, no label touched, no watcher restarted, no worktree
pruned, no prompt disarmed, renamed or moved except the one arm above.

## FINDINGS

### F1 — the SILENT hour was a blind run that deliberately withheld its breadcrumb, not a station that stopped

`--freshness` reads `00 … SILENT` because there is no breadcrumb between `10:15Z` and this run. All
three instruments were crossed, as the contract's table requires, and they agree: the occurrence
**fired** (session directory `7e14a296` at `11:14:08Z`), `lastRunAt` cannot speak to it (it holds
only this run), and the transcript names the cause — Desktop Commander `CONNECT_TIMEOUT` after
30,000 ms, declared only after three keyword `ToolSearch` probes, i.e. blindness after a load
attempt, which the contract defines as real. That run then chose to write **no** breadcrumb, on the
stated ground that an untracked dev-tree file it could not open a PR for would block the next
fast-forward.

That reasoning is sound under the report contract as written, and it is also why `--freshness` cannot
distinguish a blind hour from a dead station. **This is the fourth blind 00 run today** (`05:14`,
`08:14`, `11:14`, against sighted runs at `00:14`–`04:14`, `06:14`, `07:14`, `09:15`, `10:15` and
this one) — roughly 3 of 12 occurrences, consistent with the ~40% blindness rate the bootstrap
records and with no known cause. `#2162` (merged 10:30Z) already *"extend[s] the blind-run ceiling"*,
so the standing escalation exists and this run adds one more datum rather than a new question.

**DISPOSITION: ACTIONED.** The silence is explained, the hour is accounted for, and nothing was lost:
a blind run performs no board work by construction, and the board it could not see was unchanged
(armed=0, the same two parked PRs) when this run measured it an hour later. Verified by reading the
`7e14a296` transcript end to end rather than inferring from the gap.

### F2 — 04's F2: the only ADMIT-clean prompt on a board with armed=0 — armed

`pr-scopecards-s8h-traffic-index-ui-HOLD.md`, gate released by `#2161` at 09:41Z, premise independently
still true, no duplicate among the two open PRs, no human-gate marker and no prose gate in the body.
The board had been at **armed=0 with a live idle watcher** (heartbeat 104 min) while an armable
prompt sat on the shelf.

**DISPOSITION: ACTIONED.** Armed at `12:22:24Z` via `arm-prompt.ps1` (exit 0, both read-backs true,
audit line written), and the rename committed in this run's board PR. `escalates: true`, so the
watcher will apply `do-not-merge` and the merge is Marco's — that gates the merge, never the run
(DOCTRINE §5b).

### F3 — 04's F1: `pr-scopecards-s8g-…-HOLD.md` is finished work still tracked on `origin/main`

Premise re-run this run and FALSE (5 files on `origin/main`, negative control 0); its PR `#2161`
merged 09:41Z.

**DISPOSITION: ACTIONED.** The deletion is committed in this run's board PR. ⚠️ 04's warning was
obeyed and **not** generalised: `pr-fv2-formrule-contract-HOLD.md` shows the same locally-deleted
shape but its PR `#2158` is OPEN and RED, so its premise is alive; I restored that path to `HEAD`
rather than committing its deletion.

### F4 — 04's F3: the station doc's own Part 0(a) cites a backend path that does not exist on `origin/main`

`persona-permission.guard.ts` is not under `common/auth/`; it is under `modules/personas/`. A probe of
the stated path returns a silent `0`, whose available reading — *"the persona guard has lost its
super-user bypass"* — is a confident, coherent, wrong S2 about authorization.

**DISPOSITION: ACTIONED.** Both of 04's one-line corrections landed in this run's board PR, and the
path was replaced by a **symbol anchor** rather than another path, per §9.5's opening rule, so the
same citation cannot rot again when the file moves.

### F5 — 04's F5: the `gate-liveness` brief instructs 04 to do what 04's authority matrix forbids

*"Repair dead … gates"* against `Create a PR: NO / Mutate the board: NO, read-only`.

**DISPOSITION: ACTIONED.** Reworded in this run's board PR to report-and-stage, with the
`STATION-CAPABILITIES.md` §5 citation inline so the next reader does not have to rediscover why.

### F6 — 04's F8: the arming-log publication gap had re-opened, and this run widened it before closing it

04 measured `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → `2 0` — a strict
superset, two arms recorded locally and on `origin/main` nowhere. **My own arm made it three.** The
underlying defect is unchanged and is §9.5's: nothing commits the log on purpose, so the gap closes
and re-opens by luck.

**DISPOSITION: ACTIONED** for the current gap — the log is committed in this run's board PR, copied
**after** the arm so all three lines ride together, and copied as a raw Buffer (`byteExact=true`)
rather than restored from `HEAD`, which on an append-only file would have destroyed the local-only
lines (the 2026-09-06 `actor=marco-delegated` loss). **The standing defect is DEFERRED** and is not
mine to close in a collect run: the durable fix is `arm-prompt.ps1` itself committing the line, which
is a script change needing its own PR and a decision about arming inside a shared index.

### F7 — 04's F6: an orphaned worktree holds two uncommitted files on a branch whose PR already merged

`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd`, branch `fix/pipeline-scripts-resolve-state-paths-from-module`,
**dirty=2 files**, age 283 min at this run's sweep (`[LIVE]` 12:18Z). PR `#2154` merged 08:35Z, so the
branch is spent, but two files in it are in no commit anywhere. `git worktree remove` will refuse and
`--force` discards them silently. `C:/po-wt/fv2drop` @ `817339c3` is dirty=0 and carries no such risk.

**DISPOSITION: DISPATCHED → Station 03 (machine-minder, next cadence 2026-09-24T23:02Z).** Worktree
teardown is *Repair the machines*, 03's row; 00 does not do 03's work (LL-38). The hand-over, in
order: (1) `git -C C:/po-worktrees/sup-cwd-paths status --porcelain` and **list the two files in your
breadcrumb before touching anything**; (2) if they hold real work, commit them to a branch and open a
PR, or copy them out — they are unrecoverable otherwise; (3) only then prune, and **never with
`--force`** while dirty. ⚠️ `[LIVE]` means true when measured: re-measure the dirty count and the age
immediately before acting, not from this line. `C:/po-wt/fv2drop` may be pruned without ceremony.

### F8 — the watcher clone reads `dirty=1` and I did not re-derive it, so I am claiming nothing about it

The sweep's section 2 prints `watcher clone: branch=main dirty=1  <-- NOT clean-on-main; the watcher
may refuse to start`. DOCTRINE §9.5 records that line as a measured sweep defect and as the surviving
live instance of *provenance is not correctness*; propagating it un-re-derived is what mis-routed
three dispatches to 03 before. 04's run declined it for the same reason on the same day.

Falsifying context, and it is why this is not urgent: the watcher **is** running (pid 42212, wrapper
alive x2) and has been consuming work today, so whatever the flag means it is not currently stopping
the machine.

**DISPOSITION: DEFERRED.** This becomes urgent the moment the watcher fails to start, or refuses a
prompt with a dirty-tree message — and the armed s8h prompt is the probe that will answer it within
the hour. The sound measurement is `git -C C:\po-watcher\ProjectOperations status --porcelain
--untracked-files=no` **read-only** (git mutation in the watcher clone is an absolute stop), and it
belongs to whoever next has a reason to act on the answer. I did not run it because a reading I
cannot act on is a lead, not a finding.

### F9 — 04's F4 and F7, carried forward unchanged

**F4** — `pr-rates-s11c-drop-legacy-tables` and `pr-tenant-mt4-s2-ownership-migration` are each held by
a **single** gate, an approval file only Marco can write, and both are destructive (dropping legacy
rate tables; a production-data write with three NOT NULL constraints whose rollback is unrecoverable
without a pre-flight CSV export). The other three approval-gated prompts each carry two independent
protections. **DISPOSITION: DEFERRED** — there is nothing to do while both approval files are absent,
and *"repairing"* either gate would remove the only protection. It becomes urgent the moment either
`docs/approvals/<slug>-approved-by-marco.md` appears on `origin/main` without a matching decision from
Marco, or a run proposes editing either prompt's `requires_file_on_main` key. **No station may arm
either prompt.**

**F7** — `PORT` is the one of 51 `process.env.X` names in `apps/api/src` with no line in
`.env.example`. **DISPOSITION: DEFERRED** — benign today (App Service supplies it), one line plus a
comment when someone is next editing that file; urgent only if a local-dev onboarding failure is ever
traced to a port default.

### F10 — the board's one real constraint is unchanged and is not an agent's to clear

Both open PRs carry `do-not-merge` with the description *"escalates:true - Marco merges this, not
automation (DOCTRINE 5b)"*, and both show exactly two reds from that one cause. There is no CI defect
to fix, no conflict to resolve, no check to re-run. **DISPOSITION: ESCALATED — for Marco, and the
question is in `## FOR MARCO` below.**

## WHAT I DID NOT DO

- **Did not touch either open PR.** No label removed, no check re-run, no merge attempted, no
  `why-blocked.ps1` (it is MUTATING — it issues a REST squash-merge attempt — and both PRs carry a
  hold label, which it now refuses anyway).
- **Did not re-derive the watcher clone's `dirty=1`** (F8) and make no claim about it in either
  direction; and **ran no git mutation in `C:\po-watcher\ProjectOperations`**, which is an absolute
  stop.
- **Did not prune, enter or `--force` either orphaned worktree.** That is 03's lane and 03 has been
  dispatched (F7). Doing it myself is LL-38.
- **Did not commit the deletion of `pr-fv2-formrule-contract-HOLD.md`.** Its premise is still TRUE and
  `#2158` is OPEN — the premise dies on MERGE, not on OPEN. I restored that path to `HEAD` instead, so
  the dev tree stops carrying an unstaged ` D` that blocks the next fast-forward.
- **Did not commit a second root copy** of the three breadcrumbs the dev tree called UNTRACKED and
  `origin/main` already holds under `archive/`.
- **Did not edit `/sot/`** (05's, and CP-24 hard-fails any PR mixing code and `sot/`), production data,
  or Azure / Entra / SharePoint in any form.
- **Did not run `git` through the device bridge against the mount**, despite the guard reporting
  INERT (exit 2) — an inert guard is never a licence.
- **Did not restart the watcher.** It is RUNNING with its wrapper alive; a 104-minute heartbeat with
  an empty queue is idle, not wedged, and restarting on that reading is the 2026-07-13 false
  emergency.
- **Did not clear any `needs-marco/` `[STALE]` row this run.** Section 5 of the sweep reports its rows
  as `[FILE]` and explicitly says *"section 5 CANNOT decide whether it is stale — read the file"*; the
  46 files there need a per-file `gh pr view --json state,mergedAt` with a negative control, which is
  a substantial pass of its own. **DEFERRED to the next collect run with budget for it**, and named
  here so it is not silently dropped: 46 files, and the sweep's own line says the oldest citations
  resolve to PRs merged weeks ago.

## FOR MARCO

**Two PRs are finished work waiting only on you, and nothing else on the board is blocked.**

- `#2148` — *feat(auth): stop writing sign-in codes and reset links to the production log.* 13 checks
  pass; the only two reds are CP-26 firing on the `do-not-merge` label itself.
- `#2158` — *feat(forms): drop five legacy FormRule flat columns (F-2c contract).* Same shape. This one
  is a **destructive migration** (column drops), which DOCTRINE §8.3 routes to you by design.

Both are green on the merits and red only because they are labelled for you. Removing the label is the
whole of the action, and it is yours alone.

**RULE 1 on the throughput question behind this** — *always lean towards what solves the issue
completely (immediately and future) without damaging existing and/or future data entry*:

1. **Complete and additive — review and release these two, and keep the label for the destructive
   class only.** `#2148` stops secrets reaching a production log and touches no data; `#2158` drops
   columns and genuinely needs your eyes. Both tests pass. This fixes today's board and, by narrowing
   what `escalates: true` is used for, stops the queue re-filling with PRs that only ever needed a
   glance. **Passes both halves: nothing is merged that you have not seen, and no data entry is
   touched by the class that gets released.**
2. Release `#2148` only and leave `#2158` for a slower look. Fails the *future* half — the board
   refills with the same shape next week.
3. Grant an agent authority to remove the label. **Fails the data-entry half outright** and is not
   something I would take even if offered: the label is the only stop between an agent and a
   destructive migration.

**Nothing in this run needed a decision from you, and nothing was blocked waiting for one.**
