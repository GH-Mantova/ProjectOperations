# Station 00 — Supervisor | 2026-10-06T22:14Z–2026-10-06T22:30Z

## GROUND

```
UTC            2026-10-06 22:14:35Z
origin/main    9b7e1b8b  (at run start; ef8634d4 after #2252 merged mid-run)
dev tree       main @ 9b7e1b8b  C:\ProjectOperations2   (level with origin/main, 0 0)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

## WHAT I MEASURED

**[MEASURED] Not blind.** `start_process` shell `powershell.exe` after ONE keyword `ToolSearch` for
`desktop-commander` → PID 3260, prompt returned. The ids the search reported are
`mcp__plugin_desktop-commander_desktop-commander__*`; no id was assumed.

**[MEASURED] Git guard: exit 2, INSTALLED BUT INERT.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit status read from the installer itself and not from a pipeline appended to it. Last line:

> `To get the protection for one call, put the shim on PATH yourself:`
> `   PATH="/sessions/clever-compassionate-tesla/.local/bin:$PATH" git <args>`

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Controls it printed: `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`.
This is the expected station outcome, a finding and not a stop. No `git` was run against the mount
this run; every git call went through the Windows shell.

**[MEASURED] Binding documents read from `origin/main` in the DEV TREE**, after
`git fetch origin --prune`, via `git show origin/main:<path>` into `$env:TEMP\st00\` — never from the
working copy, never in the watcher clone. `00-supervisor.md` 363 lines, `DOCTRINE.md` 386,
`STATION-CAPABILITIES.md` 528; all three read in full. No piped `hash-object` comparison was made
(DOCTRINE §9.2).

**[MEASURED] Sweep.** `scripts/pipeline/status-sweep.ps1`, completed 2026-10-06T22:15:10Z.
Section 0 positive controls both `[LIVE]`: `gh` reached GitHub (saw merged #2251), `node` runs — no
`[BROKEN]`. Verdict **CAUTION**: one live station worktree `C:/po-wt/retire-spent`.
`[LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`. `[LIVE] armed (*-ready.md): 1`
(`rev-2252-ready.md`). `[LIVE] board lease: free`. `[LIVE] watcher node: RUNNING pid 39052`.
`[LIVE] main CI on 9b7e1b8b: 0 success / 0 failed / 4 running <-- [CANNOT MEASURE] … NOT a green trunk`.

**[MEASURED] The CAUTION was a concurrent human actor, not a mid-run station.**
`C:\po-wt\retire-spent` CreationTimeUtc 22:13:04Z, LastWriteTimeUtc 22:13:06Z — one minute before
this run started. `gh pr view 2252` at 22:21Z returned `state: MERGED`, author `GH-Mantova`,
`labels: []`, 31 renames all under `docs/pr-prompts/superseded/`. It was OPEN and CLEAN at 22:15Z
and merged by the other actor during this run. Re-measured at 22:22Z: open PRs `[]`,
`index.lock` False/False in both trees, `Get-Process git` count 0, no lease file. The other actor had
finished. **[LIVE] expires the moment it prints** — this is why the gate was re-read rather than
quoted from the sweep.

**[MEASURED] Freshness, exit 2.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
structure 7 checked, 0 malformed. `00` MISSED 282.1h · `03` MISSED 216.6h · `04` ok 0.2h ·
`05` MISSED 296.0h. Three untracked breadcrumbs named by the NOTE lines
(00's 2026-09-25-0415, 03's 2026-09-27-2144, 04's 2026-10-06-2210).

**[MEASURED] `lastRunAt` crossed against the freshness table** (scheduled-tasks MCP). All of
00/03/05 `enabled: true`. 00 `5 * * * *`, lastRunAt 22:14:01Z = this run. 03 `0 9 * * *`, lastRunAt
2026-09-27T21:42:40Z. 04 `0 */4 * * *`, lastRunAt 2026-10-06T22:09:40Z. 05 `10 0 * * *`, lastRunAt
2026-09-27T21:38:18Z. `weekly-security-audit` still `enabled: false` — STATION-CAPABILITIES §1's
2026-09-15 correction is confirmed current, not re-litigated.

**[MEASURED] Session-folder scan classifies all three as `never fired`.** Depth-3 scan of
`local-agent-mode-sessions`: 7460 directories, 2 station sessions inside 3 days — `3b3abd4d`
(22:14:01Z, this run) and `2712b3b4` (22:09:40Z, 04). A depth-1 scan of the same root first returned
`0 folders in 7 days`, which this run's own folder refutes: wrong corpus, a §9.6 false negative,
discarded rather than reported. Positive controls: both session folders found. Negative control: no
folder at any 00 hourly slot 2026-10-03 → 2026-10-06.

**[MEASURED] The five `[STALE]` rows are genuinely dead**, each asked individually with
`gh pr view <n> --json state,mergedAt` (never a LIST response's `merged` field — DOCTRINE §9.4):
#2228 MERGED 2026-10-03T01:44:22Z · #2243 MERGED 2026-10-06T04:19:02Z · #2247 MERGED
2026-10-06T07:19:37Z · #2249 MERGED 2026-10-06T07:48:10Z · #2250 MERGED 2026-10-06T07:51:39Z.
All five files were UNTRACKED (`git ls-files --error-unmatch` → 0 for each).

**[MEASURED] Nothing remains in 00's safe arming lane.** `git ls-tree -r --name-only origin/main`
filtered to depth-1 `*-HOLD.md` → 13 tracked HOLD prompts, after #2252 retired 31. Every one is a
feature, migration or production-data slice: `pr-scopecards-s8b-azure-maps-travel-HOLD.md` is behind
the absolute Azure hard stop; `pr-tenant-mt4-s2-ownership-migration-HOLD.md` is production data;
`pr-rates-s11c-drop-legacy-tables-HOLD.md` is a destructive migration; `pr-siteid-notnull-backfill-HOLD.md`
is a migration; `pr-queue-layout-sot-entry-HOLD.md` is marked STATION 05 ONLY by the sweep's own
register note. There is no docs-or-instrument HOLD left to arm.

**[MEASURED] `armed` fell to 0 without my involvement.** `rev-2252-ready.md` was `[LIVE] armed` at
22:15Z and absent from `docs/pr-prompts/*-ready.md` at 22:26Z — consumed when #2252 merged.

**[INFERRED] The eleven-day board was driven by hand.** #2244–#2252 all merged 2026-10-06 with no
00 breadcrumb in the window and no 00 session folder; the 22:13Z worktree and the mid-run merge are
the same actor. I did not confirm who, and did not need to.

**[CANNOT MEASURE] Whether 00 fired at all between 2026-09-25 and 2026-10-06.** `lastRunAt` holds
only the most recent run, and the session-folder scan only reaches back as far as folders survive.
Three days of absence is measured; the remaining eight are inferred from the breadcrumb gap.

**[CANNOT MEASURE] `Enter-BoardLease`'s exit status.** The function returned `True` (lease
acquired); the `$LASTEXITCODE` I printed alongside it read `1`, which is the residue of the previous
*native* command, not the function's status — DOCTRINE §7.6. The return value is the instrument
here; the exit code I quoted is not, and is reported rather than relied on.

## WHAT CHANGED

1. **Board lease taken** — `Enter-BoardLease -Actor 'station-00-scheduled-2026-10-06-2214'
   -Minutes 30` → `True`, before any mutation. The lease was free when taken.
2. **Isolated worktree** `C:\po-wt\st00-20261006-2214` on NEW branch
   `chore/st00-collect-20261006`, created off `origin/main` after a re-fetch, so it sits at
   ef8634d4 and not at the stale 9b7e1b8b this run started from. Read back:
   `HEAD` = `chore/st00-collect-20261006` @ ef8634d4.
3. **Five dead escalations retired** via `scripts/pipeline/retire-escalation.mjs`, one call each,
   `--actor station-00`, `--evidence` the individual `gh pr view` reading above,
   `--record-into C:\po-wt\st00-20261006-2214`. All five exit 0. Discharge notes written to
   `docs/pipeline/discharges/2026-10-06-2223Z-pr-{2228,2243,2247,2249,2250}-review-fix.md` in this
   PR. Read back per file: `needs-marco/pr-<n>-review-fix.md` present=**False**,
   `needs-marco/discharged/pr-<n>-review-fix.md` present=**True**, for all five. Nothing deleted.
4. **Three orphaned breadcrumbs swept** into this PR — 00's 2026-09-25-0415, 03's 2026-09-27-2144,
   04's 2026-10-06-2210. They were untracked in the dev tree and reached nobody.
5. **One escalation filed** at `docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`,
   **force-added** so it is tracked. `needs-marco/` is gitignored by rule, so a new file there is
   invisible by default — the finding is also stated in full under FINDINGS below, at this tracked
   breadcrumb path, so it does not depend on the force-add having worked.
6. **No scheduled task was enabled, disabled, run, re-run or edited.** **No prompt armed or
   disarmed.** **No PR merged** — the board held one PR this run and the other actor merged it.

## FINDINGS

### F1 — Three of the four live stations have not fired for nine to eleven days, and `--freshness` structurally cannot see it

00 (hourly), 03 (daily) and 05 (daily) are all `enabled: true` with valid `nextRunAt` values, and
none has executed an occurrence in nine days or more. 04 alone is healthy. Classified **`never
fired`** rather than `fired and died`: no session folder exists at any of those slots, against two
positive controls in the same scan.

The blast radius is eleven days of no supervisor, nine days of no `/sot/` keeper — 05 is the only
station that may edit it — and nine days of no machine-minder across seven `WATCHER-CRASH-LOOP-*`
snapshots dated 2026-10-03 to 2026-10-06 that nobody has read. 03's own final breadcrumb is titled
*"the keepalive was disabled one second before the watcher stopped and nothing has run since"*,
dated the same day 03 and 05 both stopped, four minutes apart — the obvious place to start.

The reason this hid for eleven days is circular and worth stating plainly: **`--freshness` compares
breadcrumb dates, so a station that never fires writes no breadcrumb and raises no alarm — and the
station that would notice is 00, which is one of the three that stopped.** The detector only runs
when the thing it detects is already working. Remedying it means watching `lastRunAt`, not
breadcrumbs.

The remedy is in the task store, which the station doc puts out of my reach on this reading:
*forbidden on a MISSED reading alone — disabling, enabling, running, re-running or editing any
scheduled task.* The escalation trigger is two consecutive never-fired occurrences; 03 and 05 are at
nine and 00 at roughly 280. Options with RULE 1 applied are in the escalation file, complete-and-
additive first.

**DISPOSITION: ESCALATED** — `docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
(force-added; also stated in full here). Three questions for Marco: was the silence deliberate; may
I open a read-only diagnostic prompt against the keepalive/scheduler chain; and the task store is
his alone to change.

### F2 — Five escalation rows were dead and were blocking the queue's signal

`pr-2228`, `pr-2243`, `pr-2247`, `pr-2249` and `pr-2250-review-fix.md` each named a PR that has
merged. The sweep tagged all five `[STALE] … escalation is DEAD, clear it. Do NOT report it as
pending.` Confirmed individually against `gh pr view <n> --json state,mergedAt`.

**DISPOSITION: ACTIONED** — retired through `retire-escalation.mjs`, all five exit 0, read back
present=False in `needs-marco/` and present=True in `needs-marco/discharged/`, discharge notes in
this PR. `needs-marco/` is now 54, down from 59.

### F3 — 04 ran blind four minutes before this run, which ran sighted

04's breadcrumb from 2026-10-06T22:10Z is titled `blind-desktop-commander-unreachable`. This run
reached the box at 22:14Z on the first attempt. Two scheduled Cowork sessions four minutes apart,
opposite outcomes — consistent with the known intermittent ~40% blindness whose cause
STATION-CAPABILITIES §2 records as unknown. 04's run was not defective; it reported correctly and
its breadcrumb was swept into this PR by change 4.

**DISPOSITION: DEFERRED** — one datapoint on a known open unknown, and nothing in this run changes
the diagnosis. It becomes urgent if the blind fraction rises to the point where a sighted 00 run
cannot be relied on to collect — at which point the fix is a transport question, not a station one.

### F4 — Nothing remains in 00's safe arming lane, so nothing was armed

`WAITING ON MARCO: 0` left room to arm, and the board is now empty, so the queue line was not the
constraint. The HOLD pool is: 13 tracked prompts after #2252 retired 31, every one of them a
feature, migration, production-data or `/sot/` slice. Three sit behind hard stops (Azure maps,
production data, destructive migration) and one is marked Station-05-only. Arming any of them would
be either a hard-stop breach or work outside what I can drive. The sweep's own register agrees from
the other side: `ready=1 needs-marco=2 blocked=4 broken=0`, with its one READY-TO-STAGE item
(`rates-11c-blocked-consumers`) being *staging* work, which is Station 06's lane and not arming.

**DISPOSITION: DEFERRED** — arm nothing until either Station 06 stages a prompt in 00's lane, or
Marco releases one of the three hard-stop slices himself. Also worth saying: with 00 firing once in
eleven days, arming work that needs a supervisor to drive it to merge would have manufactured
un-driven WIP on a board that currently has none. This becomes urgent the moment F1 is fixed and the
board is empty again.

### F5 — The git guard reports itself INERT, as designed, and the ban stayed remembered

Exit 2, shim byte-correct and off `PATH`, because a station's shell is non-interactive and
non-login. The device-bridge git ban was therefore **remembered, not mechanical**, for this entire
run — the condition DOCTRINE §9.2 records as having failed seven times. It held: every git call this
run went through the Windows shell on PID 3260, and none went through the mount.

**DISPOSITION: DEFERRED** — this is the documented expected outcome for a station and is already the
subject of the installer's own three-outcome table. It would become a finding worth acting on only
if a run reports exit 0 (ban actually mechanical) or if a station is caught running git against the
mount.

## WHAT I DID NOT DO

- **Did not touch the scheduled-task store.** No enable, disable, run, re-run or edit of 00, 03, 05,
  04 or `weekly-security-audit`, though F1 is squarely about three of them. Forbidden on a MISSED
  reading alone; it is Marco's layer.
- **Did not merge anything.** The board held exactly one PR, #2252, and the concurrent actor merged
  it mid-run. Nothing was left to merge and `Merge-Pr` was never called.
- **Did not arm or disarm any prompt** — F4.
- **Did not clear the `C:/po-wt/retire-spent` worktree or any of the other orphaned worktrees and
  REGISTRY-ESCAPEEs** the sweep listed (`board-lease-wording`, `fix-2228`, `stage-prnum`, two
  escapees aged 5689 and 5794 min). Several hold commits on no remote branch. Worktree and lock
  hygiene is Station 03's lane and 03 is one of the dead stations — so this is pending F1, not
  pending a dispatch I could usefully make now.
- **Did not clear any `[FILE]` escalation row.** Roughly 50 rows in `needs-marco/` cite only merged
  PRs *as evidence rather than as premise*, and the sweep says in terms that section 5 cannot decide
  staleness for them and that they must not be cleared on that line alone. Only the five
  unambiguous `[STALE]` rows were retired.
- **Did not read the seven `WATCHER-CRASH-LOOP-*` snapshots** (2026-10-03 → 2026-10-06). They are
  03's lane and they are real, but opening them would have produced a diagnosis I cannot dispatch to
  a station that does not fire. Named here and in F1 so they are not lost.
- **Did not touch `/sot/`** — Station 05 only, even though 05 has not run in nine days.
- **Did not dispatch 03, 04 or 05.** Dispatch is a note in a breadcrumb that the station reads when
  it wakes on its clock; two of the three do not wake. F1 is the prerequisite.
- **Did not run `smoke-pr.ps1`** — no PR to smoke.
- **Did not touch Azure, Entra or SharePoint.** `pr-scopecards-s8b-azure-maps-travel-HOLD.md` stays
  on hold untouched.
