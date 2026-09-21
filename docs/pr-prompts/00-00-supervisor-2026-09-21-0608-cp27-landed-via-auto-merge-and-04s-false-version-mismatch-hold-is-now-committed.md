# Station 00 — Supervisor | 2026-09-21T06:08:51Z–2026-09-21T06:40Z

## GROUND

```
UTC            2026-09-21T06:09:53Z
origin/main    f885dc04  (at start)  ->  bf9f42a3  (after #2028 merged this run)
dev tree       main @ 29abf8d4   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

**Versions MATCH. This run was READ-WRITE.**

**NOT BLIND.** Desktop Commander loaded via keyword `ToolSearch` (`desktop-commander`), then
`start_process` on `powershell.exe` succeeded. The previous 00 occurrence (0410Z) was blind with a
connect timeout and mutated nothing; this one reached the box on the first call. Saying so loudly
because a blind run and a healthy quiet run produce the same silence.

VM git guard, last line quoted verbatim, **pass**:

```
vm-git-guard installed at /sessions/elegant-youthful-albattani/.local/bin/git - refuses mounted
paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Binding docs read in the **dev tree** after `git fetch origin`, freshness proved with
`git diff --numstat origin/main -- <path>` (EMPTY = identical), never a piped hash:

| doc | `git diff --numstat origin/main` |
|---|---|
| `docs/pipeline/stations/00-supervisor.md` | EMPTY — identical |
| `docs/pipeline/DOCTRINE.md` | EMPTY — identical |
| `docs/pipeline/STATION-CAPABILITIES.md` | EMPTY — identical |

The dev tree is 6 behind `origin/main`, so `HEAD` is NOT a safe read for anything else.

## WHAT I MEASURED

**[MEASURED] `status-sweep.ps1` at 06:09:53Z — VERDICT: SAFE TO ACT.** 1 open PR (#2028), watcher
node RUNNING pid 9744, wrapper alive, heartbeat 0 min, build in flight, `index.lock` false in both
trees, 0 scoped git processes.

**[MEASURED] Section 5 held ZERO `[STALE]` rows.** Every row was either *"cites #N as evidence — not
its premise"* or *"section 5 CANNOT decide"*. The eleven dead PR-scoped escalation files measured on
2026-09-10 are gone. **Nothing to discharge this cycle** — I opened no `needs-marco/` file and moved
none.

**[MEASURED] `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.** 5 breadcrumbs checked, 0
malformed. No station SILENT: 00 1.1h (cadence 2h), 03 5.9h (24h), 04 4.1h (4h), 05 5.5h (24h).

**[MEASURED] Cross-checked against `lastRunAt` (scheduled-tasks MCP), because `ok` is not an
all-clear.** All four enabled stations fresh and aligned with their newest breadcrumb; no
fired-but-silent run, no missed occurrence. `weekly-security-audit` remains **disabled**,
`lastRunAt 2026-09-06T21:32Z` — 15 days — already escalated in
`weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`; not re-filed.

**[MEASURED] #2028 preconditions, each read per-PR, not from a board listing (LL-47):**
`labels: []` (no `do-not-merge`/`needs-marco`/`hold`), `mergeable: MERGEABLE`, not draft, no
migration or `prisma` path in its three files, not in `NEVER_MERGE` (#552/#538), and the watcher's
own PRE-MERGE comment at 04:38:02Z reads **`VERDICT: MERGE`**. No `needs-marco/` file names 2028,
`cp27` or `sot-inpr`.

**[MEASURED] The e2e-versus-main-cadence race, and it is tight.** `Tendering Browser Smoke` took
14m29s (05:54:21→06:08:50) and 14m00s (05:36:02→05:50:02). `main` moved four times in the 98
minutes before the merge, each move producing a `Merge branch 'main'` commit on #2028 that restarted
the full suite: intervals **46, 20, 16 minutes**. Each merge brought real content (56, 5, 23, 4
files, from four distinct main tips), so none was gratuitous. With the interval converging on the
runtime, the window in which #2028 was green and current had narrowed to under two minutes.

> 🔴 **THREE HYPOTHESES I FORMED ABOUT #2028's CI WERE ALL REFUTED BY MEASUREMENT. Recording the
> refutations so nobody re-files them as findings.**
>
> 1. *"`status-sweep` miscounts in-progress checks as passes."* The sweep printed
>    `CI: 15 pass / 0 fail / 0 pending (green)` while `gh` showed 2 checks IN_PROGRESS on the same
>    unchanged head SHA, which looked like a false green on the only open PR. **REFUTED:**
>    `tendering-e2e` has `startedAt 2026-09-21T06:10:31Z` — **38 seconds AFTER the sweep finished at
>    06:09:53Z.** The sweep was true when measured. This is §7's `[LIVE]` rule exactly, and I nearly
>    filed a defect against a healthy instrument.
> 2. *"Five full CI suites ran on one unchanged commit."* **REFUTED:** I had verified the head SHA on
>    only the newest run pair and inferred the rest. The five runs carry five distinct heads —
>    `a5457950, 8c08b4a3, 55baed1b, 303079bc, ff67983e` — one per push. Normal `synchronize`.
> 3. *"The branch is being updated gratuitously, creating empty merge commits."* **REFUTED:**
>    `git diff --numstat <m>^1 <m>` returns 56, 5, 23 and 4 changed files for the four merges.
>    Every one brought real content from a distinct main tip.
>
> The instrument was honest in all three cases and my reading was not. `[LIVE]` means *true when
> measured*, and an inference about four objects taken from a measurement of one is not a measurement.

**[MEASURED] What keeps updating the PR branches is NOT in `.github/workflows/`.** No workflow
matches `update-branch`/`update_branch`/`updateBranch`, and the four merge commits predate the
auto-merge I enabled at 06:20:13Z, so auto-merge did not author them. **[CANNOT MEASURE]** the
cause from here; the behaviour is correct and benign, so this is a lead, not a finding.

**[MEASURED] Station 00's cadence disagrees across two instruments.** The live cron is
`5 * * * *` — **hourly** — while my bootstrap says *"Cadence: every 2 hours"* and
`check-breadcrumb.mjs` scores station 00 at `cadence 2h`. Since SILENT fires at twice the cadence,
00 must be quiet for **four hours** before the detector notices, i.e. three consecutive missed
hourly occurrences are invisible. Same class as the already-escalated
`station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`, different station.

## WHAT CHANGED

1. **Armed native squash auto-merge on #2028** (`gh pr merge 2028 --auto --squash --delete-branch`,
   exit 0), read back as `autoMergeRequest.enabledAt 2026-09-21T06:20:13Z`, method `SQUASH`.
   **It then merged itself at 06:22:13Z.** Verified it reached `main`, not just the PR page:
   `git fetch` moved `origin/main` **f885dc04 → bf9f42a3**, the tip is the #2028 squash, and
   `git ls-tree -r origin/main scripts/pr-gates/` now lists `sot-inpr.mjs` and
   `__tests__/sot-inpr.test.mjs`. `tendering-e2e` concluded **success** — auto-merge waited for it.
   **CP-27 is live on main.**
2. **Opened #2032** carrying Station 04's two dispatched artifacts (below). Built in a disposable
   worktree off `origin/main` bf9f42a3, never in a shared tree. Auto-merge armed and read back.
3. **This breadcrumb**, left untracked for `sweep-breadcrumbs.ps1`.

No arming. No label added or removed. No `sot/` edit. No `git commit` on `main`. Nothing merged by
hand. The watcher was not touched.

## FINDINGS

### F1 — The board's only PR was green four times over and had no auto-merge armed (S2) — ACTIONED

#2028 (CP-27) had passed its full suite on four separate heads, carried a watcher `VERDICT: MERGE`,
had no hold label and no `needs-marco` file — and was still sitting open 109 minutes after it was
opened, because **nothing had armed auto-merge on it**. Meanwhile `main` was moving every 16–20
minutes and each move restarted a 14.5-minute e2e, so the interval a human or a station would have
to hit by hand had shrunk to under two minutes.

That is why the fix is auto-merge and not a merge. DOCTRINE §8.3 prescribes native auto-merge for
non-migration PRs precisely because it fires the instant the required checks go green, which no
measure-then-act cycle can reliably do against a moving trunk. It is also the complete-and-additive
option under RULE 1: it solves this PR and every future one in the same position, and it damages
nothing — `--disable-auto` reverses it, and it cannot merge anything that is not green.

**DISPOSITION: ACTIONED.** Merged at 06:22:13Z, on `main` as `bf9f42a3`, verified by `git ls-tree`
against `origin/main` rather than by the PR's own state.

### F2 — Station 04's F1: `lint-station.mjs` prints a false version mismatch (S2) — ACTIONED

04's 06:11Z sweep found that `lint-station.mjs` compares each station doc's `station_doc_version`
against the canonical `station-contract` version — different quantities that have never been equal —
so it prints a NOTE on every run telling the reader the bootstrap must declare `3`. All five live
bootstraps correctly declare `1`. The canonical PREFLIGHT block orders a station that sees a
version mismatch to **run READ-ONLY for the rest of the run**, so a station obeying the printed NOTE
surrenders write authority on a mismatch that does not exist — and it is silent, because the linter
exits 0 and prints `ADMIT: all 8 docs clean` on the same run while CI stays green.

04 dispatched this to 00 and stated the consequence plainly: *"The HOLD is untracked — if 00 does
not commit it, it does not exist."*

**DISPOSITION: ACTIONED.** Committed in **#2032**. I re-ran the lint myself rather than taking 04's
word (DOCTRINE §2): `node scripts/pipeline/lint-prompt.mjs …` → `ADMIT (size 4)`, exit 0. Staged as
`-HOLD.md` only — **this arms nothing.**

### F3 — Station 04's sweep rotation could not advance without 00 (S3) — ACTIONED

04 ran `next-sweep.mjs --advance` and, having no authority to commit in the dev tree, left
`docs/pipeline/sweep-rotation.json` dirty for 00. Uncommitted, the rotation never moves and 04
re-runs instruction-drift forever while gate-liveness is never swept. It is also a recorded cause of
refused fast-forwards in the dev tree.

**DISPOSITION: ACTIONED.** Committed in **#2032**; `git diff` confirms only `last_index` (2→3) and
`last_run_utc` (`2026-09-21T06:11:39Z`) moved. Next 04 sweep is **gate-liveness**.

### F4 — Station 04's F2: DOCTRINE cites two review files that no longer exist (S4) — DEFERRED

`DOCTRINE.md` cites `docs/pr-reviews/pr-1850-review.md` and `pr-1852-review.md` as a worked example
of untracked review files; both are now absent from `origin/main` and from disk. The citation is
past-tense, so nothing breaks today.

**DISPOSITION: DEFERRED** — I accept 04's disposition unchanged. It becomes urgent if anyone
rewrites that passage and needs the example to hold, or if a station is ever told to *read* those
paths rather than recognise their shape. It should ride along with the next DOCTRINE edit.

### F5 — The SILENT detector cannot see three consecutive missed 00 occurrences (S3) — DISPATCHED

The live cron for `00-supervisor` is `5 * * * *` (hourly); the bootstrap prose and
`check-breadcrumb.mjs` both score it at `cadence 2h`. SILENT fires at twice the cadence, so 00 must
be quiet four hours before anything notices — three missed hourly runs, invisible. 00 is the station
that collects every other station's findings, so its silence is the one silence nobody else reports.

**DISPOSITION: DISPATCHED** → **Station 04**, for its instruction-drift sweep (cadence-vs-cron
parity across all five bootstraps, not just 00). This is the same class as the already-escalated
`station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`; 04 should decide whether the
two are one finding. I am not filing a second escalation for a class Marco already has open.

### F6 — `weekly-security-audit` has been disabled for 15 days (S3) — DEFERRED

`lastRunAt 2026-09-06T21:32Z`, `enabled: false`. Already escalated in
`weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`, which
records that the task store reverts verified writes — so re-enabling it is not a thing I can make
stick, and re-filing it would add noise to an open question of Marco's.

**DISPOSITION: DEFERRED** — it becomes urgent on the next Dependabot alert or security finding, for
which the companion escalation
`dependabot-updater-has-failed-nine-times-and-fifteen-alerts-are-open-2026-09-10.md` is already open.

## WHAT I DID NOT DO

- **Armed nothing.** One real prompt was already armed and building
  (`pr-scopecards-s4a-push-by-destination-api-b-ready.md`, watcher heartbeat 0 min). ARM ONE AT A
  TIME. `rev-2031-ready.md` is an auto-generated review job, not a prompt (DOCTRINE §9.5), and is
  not counted as armed.
- **Did not arm the lint-station HOLD I just committed.** 04 said 00 arms it on Marco's authority, a
  build was already in flight, and the fix touches `scripts/pipeline/**` so it will need him at the
  merge regardless. It is staged and lints ADMIT; a later run arms it against a quiet board.
- **Did not touch the backlog's one READY-TO-STAGE item,** `rates-11c-blocked-consumers`.
  `rates-s11c` is on the forbidden never-arm denylist enforced in `queue-sync.ps1` (DOCTRINE §8.4),
  and its own note says 11c must not merge until the parity proof has RUN clean. Nothing about a
  gate opening makes it armable.
- **Left #2031 alone.** The watcher opened it 4 minutes before I looked, its CI was still pending,
  and its review job `rev-2031-ready.md` was armed at 06:24:43Z and had not run. It reads BEHIND,
  which is normally mine to fix — but fixing a PR mid-way through another lane's review cycle is the
  LL-38 shape, and BEHIND on a docs-only PR costs nothing to leave. **Next 00 run: if rev-2031 has
  produced a verdict and #2031 is still BEHIND, update it and drive it.**
- **Did not commit the two deleted `-HOLD.md` files or `.arming-log.txt`** that sit dirty in the dev
  tree. They are the arming record of a prompt the watcher is building **right now**; they are
  tracked, `sweep-breadcrumbs.ps1` refuses them by construction, and touching arming state under a
  live build is how consumed prompts come back armed. `sweep-rotation.json` was different — 04
  explicitly handed it over and it blocks the fast-forward.
- **Did not discharge any `needs-marco/` file.** Section 5 produced zero `[STALE]` rows; the
  discharge path is for rows the sweep proves dead, and clearing on anything less is how a live
  escalation gets thrown away.
- **Did not clear the orphaned worktrees or the registry escapee.** `C:/PR-Master/worktrees/po-vg`
  holds **1 uncommitted file** at age ~24,400 min and `--force` would discard it; `po-fix-2005` is a
  registry escapee. Machine hygiene is **Station 03's** lane. The two fresh `C:/po-wt/00i-0004-*`
  worktrees (54 min, dirty=0) are the previous interactive 00 run's and I left them.
- **Did not claim `main` was green.** At sweep time `f885dc04` had 4 checks running and nothing
  concluded — `[CANNOT MEASURE]`. I merged #2028 on **its own** required checks, which did conclude.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and every `git` ran in the Windows PowerShell shell.
- **Did not touch Azure, Entra or SharePoint.** Nothing in this run went near them.
- **Did not write production data, and did not edit `sot/`.**

## FOR THE NEXT RUN

`#2032` is open with auto-merge armed — confirm it reached `main`, then this breadcrumb and the
three swept with it can be archived to `docs/pr-prompts/archive/`. The dev tree was 6 behind
`origin/main` at 06:09Z and is now further behind; expect the post-merge fast-forward to need the
documented cure if a breadcrumb copy is left loose.

---

## ADDENDUM 2026-09-21T06:32Z — same station, same run, later measurement

### F7 — `sweep-breadcrumbs.ps1` leaves the SHARED dev tree off `main` on its SUCCESS path (S2) — ACTIONED (state) / DISPATCHED (fix)

Found by read-back, not by reasoning: immediately after the sweep opened **#2033** I checked
`git rev-parse --abbrev-ref HEAD` in `C:\ProjectOperations2` and got
**`chore/sweep-breadcrumbs-20260921-0628`**, not `main`.

The script creates its branch at line 216 (`git switch -c $branch`) and **never switches back**. The
success path ends `Write-Step "PR opened."` / `exit 0` with the tree still on the feature branch.

**Why this is S2 and not cosmetic.** The script's own header already names this exact state as the
thing it exists to prevent — lines 75–78 record a 2026-09-07 incident where a git notice raised as a
terminating error killed the run and *"the dev tree was left OFF main, which is the drift this
script exists to prevent."* That crash path was fixed. **The success path was not, so the drift now
happens on every successful sweep instead of on rare failures.** Consequences, in order of severity:

1. `arm-prompt.ps1` does a `git mv` in this tree. An arm performed while the tree sits on a stale
   sweep branch stages the rename onto that branch, not `main` — an arming that reaches nobody.
2. Every station's PREFLIGHT stamps `dev tree <branch> @ <sha>`. The next station to run would have
   stamped a sweep branch and, reading the four-line GROUND block back, had no reason to doubt it.
3. The documented post-merge fast-forward cure (`git merge --ff-only origin/main`) assumes `main` is
   checked out.

The binding-doc freshness check is **not** affected: `git diff --numstat origin/main -- <path>`
compares against `origin/main` regardless of the checked-out branch, so this run's GROUND table
stands.

**DISPOSITION: ACTIONED** for the state — I switched the dev tree back to `main` and read it back
(below). **DISPATCHED** for the fix → **Station 03** (`scripts/pipeline/**` and local-tree hygiene
are its lane): the repair is a `try/finally` returning to the original branch, so it holds on the
failure path too. No prompt staged; this addendum is the hand-over.

⚠️ **Any run that swept breadcrumbs since this script last changed left the tree the same way.** A
station reading `dev tree main @ …` in an earlier breadcrumb should not assume the tree was on
`main` when that line was written.

### F8 — the dev tree carries BOTH documented fast-forward blockers, and the cure's own precondition does not hold — DEFERRED

After restoring the tree to `main` I read `git status --porcelain` rather than assuming, and it
holds every blocker the station doc describes, simultaneously:

```
 M docs/data-model/metadata-catalog.json                        <- known, deliberately left alone
 M docs/pipeline/sweep-rotation.json                            <- modified-tracked FF blocker
 D docs/pr-prompts/pr-scopecards-s4a-push-by-destination-api-HOLD.md
 D docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md
?? docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md  <- untracked-at-a-now-tracked-path
```

`main` is **8 behind** `origin/main`. Both failure modes are armed at once: `sweep-rotation.json` is
locally modified at a path the fast-forward must update (*"Your local changes … would be
overwritten"*), and `pr-lintstation-…-HOLD.md` is untracked on disk at a path `origin/main` now
carries, because **#2032 merged it during this run** (*"untracked working tree files would be
overwritten"*).

**I did not attempt the cure, and the reason is its own precondition.** The documented procedure
requires `git diff --numstat` to be EMPTY before it starts; here it is not, and two of the entries
are ` D` deletions of tracked `-HOLD.md` files that are the **live arming record of the prompt the
watcher is building right now** (`pr-scopecards-s4a-push-by-destination-api`). Restoring a deleted
tracked file is how a consumed prompt comes back armed (DOCTRINE §9.2), and doing it under a live
build is the LL-38 shape. A cure whose precondition is false is not a cure; running it anyway is
exactly the "re-diagnosed from first principles every run" loop the station doc says has already
been paid for four times.

**DISPOSITION: DEFERRED** — not now, and specifically **not while a build is in flight**. It becomes
safe the moment the watcher's current build has finished and its `-ready.md` has been consumed, at
which point the two ` D` entries are settled and the tree can be brought to `origin/main` with the
documented steps. It becomes **urgent** if a station actually needs a fast-forwarded dev tree —
nothing this run did required one, because every mutation went through a disposable worktree or a
branch, which is why this cost nothing today.
