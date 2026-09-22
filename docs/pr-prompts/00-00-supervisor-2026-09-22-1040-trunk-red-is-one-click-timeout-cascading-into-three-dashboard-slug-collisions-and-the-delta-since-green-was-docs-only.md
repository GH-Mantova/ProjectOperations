# Station 00 — Supervisor | 2026-09-22T10:14Z–2026-09-22T10:42Z

## GROUND

```
UTC            2026-09-22T10:14:17Z
origin/main    eb3086fa            (fetched, then rev-parse)
dev tree       main @ 3be7587a -> eb3086fa  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not clamped read-only. The station
doc also declares `contract_version: 5`.

**Which tree I read my binding documents in:** the dev tree `C:\ProjectOperations2`, never the
watcher clone, and currency was **proved rather than assumed** (PREFLIGHT step 2). This run is
**SIGHTED** — Desktop Commander answered on the first call after a successful `ToolSearch` load.
Nothing below is a blind-run report.

## WHAT I MEASURED

**[MEASURED] Host reachable — this is a sighted run.** `start_process`, shell `powershell.exe`,
after loading the Desktop Commander schemas by keyword (never by hard-coded id):
`2026-09-22 20:14` local (Brisbane, UTC+10) and `main`. Every `git` and `gh` call in this run ran
in PowerShell **on the Windows host**; none went through the device bridge.

**[MEASURED] `vm-git-guard.sh` exit 2 — INSTALLED BUT INERT, the expected station outcome.**
Exit read off the **installer**, not off a pipeline appended to it: `GUARD_EXIT=2`. Headline,
verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Last line, verbatim: `PATH="/sessions/peaceful-festive-cray/.local/bin:$PATH" git <args>`. Both of
the installer's own controls printed as the station doc's table predicts —
`bash -lc 'command -v git'` -> the shim, `bash -c 'command -v git'` -> `/usr/bin/git`. Per
contract v5 this is a FINDING, not a STOP (F6). The ban was therefore **remembered**, and it was
kept: no `git` ran against the mount at any point this run.

**[MEASURED] The three binding documents are byte-current with `origin/main`.**
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — the real answer per PREFLIGHT step 2.
No piped hash was taken or compared (§9.1: the piped form is unsound in `powershell.exe`).

**[MEASURED] `status-sweep.ps1` streams NOTHING and must be captured to a file.** Two attempts to
read it as a stream returned `0 lines` repeatedly across ~12 minutes; the first call also exceeded
the 180 s MCP cap. Captured with `*>` it completed **exit 0 in 222 s, 151,744 bytes**, and the
capture is **UTF-16LE** exactly as §9.3 warns — decoded `utf16le` in node it is 431 lines with all
ten sections present. It was never read as UTF-8.

**[MEASURED] Board and machinery — two sweeps, and the second is the one that matters.**

| | sweep @ 10:21:48Z | sweep @ 10:30:37Z |
|---|---|---|
| OPEN PRs | **0** | **1** (`#2080`) |
| `main` CI on `eb3086fa` | 3 success / **1 failed** — TRUNK RED | 3 success / **3 failed** / 1 running — TRUNK RED |
| armed `*-ready.md` | **0** | **1** (`rev-2080-ready.md`) |
| watcher node | RUNNING pid **9744**, wrapper alive (1) | same |
| heartbeat age | 107 min | fresh — **1 min** at 10:28Z |
| `index.lock` dev / clone | False / False | False / False |
| `needs-marco/` | **62** | **61** (this run discharged one) |
| section 7 verdict | SAFE TO ACT | SAFE TO ACT |

**[MEASURED] Watcher liveness, from the ONLY sanctioned authority.**
`restart-watcher-if-wedged.ps1` (report-only, no `-Fix`), quoted verbatim:
`VERDICT: BUSY - queue idle 116 min BUT heartbeat is fresh (1 min). It is mid-run on a long prompt.
DO NOT restart.` — `armed prompts waiting: 1`, `watcher process: ALIVE (pid 9744)`,
`restart churn: 0 cycle(s) in 20 min`. **No restart was licensed and none was performed.**

**[MEASURED] The watcher clone is NOT corrupt.** In `C:\po-watcher\ProjectOperations`: branch
`main`; `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` all **False**; `git status --porcelain`
= 4, of which three are untracked (`?? .codex/`, `?? AGENTS.md`,
`?? scripts/pr-watcher/.conflict-notified-prs.json`) and one is the tracked modification
` M docs/data-model/metadata-catalog.json` the previous run already measured at `0 36`.
**`rescue-watcher-repo.ps1` was NOT run and must not be** — the sweep's `dirty=4` banner is the
documented false warning, and the corruption test is the one that decides.

**[MEASURED] `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0**, crossed against `lastRunAt`
from the scheduled-tasks MCP. Four enabled tasks, and every one is aligned:

| station | cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | `5 * * * *` | 2026-09-22T10:14:17Z | 09:30Z | this run, mid-run — healthy |
| 03 | `0 9 * * *` | 2026-09-21T23:02:53Z | 09-21 23:04Z | aligned |
| 04 | `0 */4 * * *` | 2026-09-22T10:09:55Z | 10:11Z | aligned |
| 05 | `10 0 * * *` | 2026-09-21T14:10:40Z | 09-21 14:11Z | aligned |

`weekly-security-audit` is **`enabled: false`**, last run 2026-09-06T21:32:44Z — the live enabled
count is **FOUR**, which re-confirms `STATION-CAPABILITIES.md` §1's 2026-09-15 correction rather
than the prose it corrects.

**[MEASURED] Main's red is FOUR failed acceptance tests with ONE root cause, and I read the job
log rather than the diff.** Run `35710623788` (`Tendering Browser Smoke`, push, `eb3086fa`),
**attempt 1 = failure**. Job `tendering-e2e` (`106690143462`): every step succeeded —
including `Run Tendering browser smoke` — through step 14; step 15 **`Run PR-acceptance E2E
suite`** failed after 11m47s. Tally from the log body: **`4 failed`, `162 passed (11.8m)`**,
`##[error]Process completed with exit code 1`.

All four are in one file, `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`:

| # | test | proximate error |
|---|---|---|
| SLICE 5 (`:262`) | dashboard-level filter bar | `Error: locator.click: Test timeout of 60000ms exceeded` |
| SLICE 7 (`:350`) | create dashboard from template | `expect(locator).toBeVisible() failed` — `element(s) not found` |
| SLICE 4 (`:398`) | add report chart widget | same |
| SLICE 6 (`:468`) | Export button triggers download | same |

**The three `element(s) not found` failures all assert the same locator**,
`nav.getByRole("link", { name: dashName })`, and the Postgres service log in the same job names
why the link is absent:

```
2026-09-22 09:36:36 UTC [298] ERROR:  duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"
2026-09-22 09:36:50 UTC [290] ERROR:  duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"
2026-09-22 09:37:05 UTC [300] ERROR:  duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"
```

**Three collisions, three cascaded failures.** SLICE 5 times out at `:345`, whose line is
`await expect(nav.getByRole("link", { name: dashName })).not.toBeVisible();` — its **teardown**.
A test that dies in teardown leaves its dashboard row behind, so each later test's create hits
`(user_id, slug, is_system)` and the dashboard is never made. **This is one defect with three
dependents, not four defects.**

**[MEASURED] The delta since the last GREEN run of this same suite is DOCS-ONLY, which is what
makes this a flake rather than a regression.** `Tendering Browser Smoke` on `3be7587a`
(08:35:25Z) = **success**; on `eb3086fa` (09:28:58Z, attempt 1) = **failure**. `3be7587a` ->
`eb3086fa` is PR **#2079**, `docs(pr-prompts): station 00 collect …` — a breadcrumb. A docs diff
cannot break a dashboards E2E test, and the same code passed 53 minutes earlier.

**[MEASURED] The three extra `failed` rows in the 10:30 sweep are a DIFFERENT workflow and a
REAL, deterministic defect.** Three `workflow_dispatch` runs of **`Tendering Browser Smoke
(container trial)`** (`35715826545` 10:24:45Z, `35715855804` 10:25:04Z, `35715859582` 10:25:06Z)
each failed in ~70 s at the **`Install dependencies`** step, with every later step `skipped`.
Cause, from the job log body:

```
. postinstall: fatal: not in a git directory
 ELIFECYCLE  Command failed with exit code 128.
##[error]Process completed with exit code 128.
```

`package.json`'s `postinstall` is `git config core.hooksPath .githooks`, read directly. Inside the
container job git refuses the checkout directory, so `postinstall` exits 128 and takes the install
with it. **Three identical failures in 21 seconds is deterministic, not flaky.**
**[CANNOT MEASURE] who dispatched them** — `actor` and `triggering_actor` both read `GH-Mantova`,
which is the shared identity for every actor on this board (§10.2.1) and discriminates nothing.

**[MEASURED] The sweep's `SAFE TO ACT` expired inside five minutes — the `[LIVE] means true when
measured` trap, reproduced.** At 10:21:48Z: `OPEN PRs: 0`, `armed: 0`, `heartbeat age 107 min`. By
10:28Z: `#2080` OPEN, `rev-2080-ready.md` armed (mtime **10:26:23Z**), heartbeat **1 min**. The
verdict I was handed was five minutes old and already false about the two facts that decide
whether a board mutation is safe.

**[MEASURED] `#2080` and its lane.** `gh pr list --state open --json number,title,mergeStateStatus,isDraft,headRefName,labels`:
`#2080`, `docs(pr-prompts): stage scopecards S7 - one cutting total (API) as HOLD`, head
`docs/stage-scopecards-s7-one-cutting-total`, **CLEAN**, not draft, **labels `[]`**. Its one file,
from the review prompt's own authoritative enqueue-time list, is
`docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md` — inside `^(tests|docs)/`, so
`classifyPolicyFiles` admits it to the **`tests-docs`** lane, which the watcher auto-merges itself.
`rev-2080-ready.md` shows the watcher auto-fired its own reviewer against it. **It is not mine to
merge, and merging it mid-review would be the LL-38 collision.**

**[MEASURED] Two instruments disagreed about the armed count and the disk settled it.**
`status-sweep.ps1` @10:21:48Z said `armed: 0`; `restart-watcher-if-wedged.ps1` @10:28Z said
`armed prompts waiting: 1`. Both were right when taken — `rev-2080-ready.md` was created at
10:26:23Z, between them. Counted directly at 10:31Z: `ARMED=1`.

**[MEASURED] The dev tree was fast-forwarded by ANOTHER ACTOR mid-run, and my own cure had to
change branch because of it.** At 10:15Z: `git rev-list --left-right --count HEAD...origin/main`
-> `0	1` (dev tree at `3be7587a`, one behind). At 10:36Z, after deleting the byte-proved
untracked breadcrumb, `git merge --ff-only origin/main` answered **`Already up to date.`** and
`git rev-parse --short HEAD` -> **`eb3086fa`**. Nobody in this run moved it. The full sequence,
with every read-back:

| step | probe | result |
|---|---|---|
| blob identity before deleting | `git rev-parse origin/main:<path>` vs `git hash-object <path>` | **`1c7cf3b6` both sides** — byte-proved, safe to delete |
| delete | `Remove-Item` | `REMOVED=True` |
| fast-forward | `git merge --ff-only origin/main` | `Already up to date.`, exit 0 — **the tree had moved without me** |
| state after | `git status --porcelain` | ` D <the breadcrumb>` — **a DELETED TRACKED file, the other FF blocker** |
| restore, raw Buffer first | `fs.writeFileSync(abs, git show HEAD:<rel>)` | 32838 B, `byteExact=true` |
| | `git update-index --refresh` | `needs update`, **exit 1** — the raw write was NOT enough here |
| discriminator | blob line endings | **`CRLF=0  bareLF=466`** — blob is pure **LF**, checkout is CRLF |
| restore, convert-on-write | `.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')` | **33304 B = 32838 + 466**, exactly the LF count |
| | `git update-index --refresh` | **exit 0** |

**All four read-backs then passed together:** `git rev-list --left-right --count HEAD...origin/main`
-> **`0	0`**; `git diff --numstat` -> **EMPTY**; `git diff --cached --name-status` -> **EMPTY**;
`git status --porcelain --untracked-files=no` -> **EMPTY**. The fourth is the one that would have
caught a dirty tree the first three call clean.

**[MEASURED] Every statement in every chain ran.** Each chain carried a literal marker after each
statement (§9.1 guard 1) and every one is present: `MARKER_A`, `MARKER_B1`–`B2`, `MARKER_C1`–`C3`,
`MARKER_D1`–`D2`, `MARKER_E1`–`E2`, `MARKER_F1`–`F4`, `MARKER_G1`–`G2`. **No read-back in this run
sits after a command that can fail without a marker between them.**

## WHAT CHANGED

Three things, all outside the board. **No PR was opened, merged, labelled, closed or commented on.
No prompt was armed, disarmed, renamed or retired. No watcher process was restarted.**

1. **`docs/pr-prompts/needs-marco/pr-2071-review-fix.md` -> `needs-marco/discharged/`** (F5), with
   `_DISCHARGE-NOTE-2026-09-22-1030.md` beside it. Read back: `MOVED_OK=True`, `SOURCE_GONE=True`,
   census 62 -> 61, and the 10:30:37Z sweep no longer carries that `[STALE]` row.
2. **The dev tree was converged to `eb3086fa` and left clean**, by the sequence measured above.
3. **This breadcrumb**, written to `C:\ProjectOperations2\docs\pr-prompts\`. It is **UNTRACKED**
   until a board PR commits it — see WHAT I DID NOT DO.

## FINDINGS

### F1 — trunk is RED on a FLAKE, not a regression: one teardown timeout cascades into three `user_dashboards` slug collisions, and the delta since green is docs-only. `BATCH1_DASHBOARDS_TEARDOWN_CASCADE_V1`

**Evidence:** quoted in full under WHAT I MEASURED — `4 failed / 162 passed`, all four in
`batch1-dashboards.spec.ts`, three of them asserting the same absent nav link, with three
`duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"`
rows in the job's own Postgres log; SLICE 5's timeout is at its teardown line `:345`. The same
suite passed on `3be7587a` 53 minutes earlier and the only delta is PR **#2079**, a breadcrumb.

**Why this is worth a finding rather than a shrug.** The station doc's rule 5 permits calling a
red transient, but only *after* the cause is named — and the cause here is not "flaky CI", it is
**a test that leaks state when it dies**. The unique constraint is doing its job; the suite has no
isolation between these four cases, so any failure in SLICE 5 converts into three more. That makes
the observed failure count a function of *where* the first timeout lands, which is why this suite
will keep producing 1-, 2- or 4-failure runs that look like different defects.

**A re-run was already in flight before this run started** — attempt 2 of `35710623788`, created
~10:24Z, still `in_progress` at 10:36Z. I did not trigger it and could not attribute it
(`[CANNOT MEASURE]`, see the actor note above).

**RESOLVED AT 10:41Z, BEFORE THIS RUN ENDED — THE RE-RUN CAME BACK GREEN AND THE FLAKE READING HOLDS.**
[MEASURED] `gh api .../actions/runs/35710623788` -> `status: completed`, `conclusion: success` on
attempt 2. Re-derived across the whole commit, `gh run list --commit eb3086faca9d4d646321eafaba556098c7c74f2a`
(full 40-char SHA per §9.4, `-R` passed, `GHEXIT=0`, 8 rows): **Deploy success, CI success,
Tendering Browser Smoke success, CodeQL success** — every push/dynamic workflow GREEN. The only
remaining `failure` rows are the three `workflow_dispatch` container-trial runs of F2, which are
not a required check on `main`. **Trunk is green; the same code and the same suite passed on the
re-run with no change to the tree.** That is the clean-diff re-run the station doc requires before
calling a red transient, and it passed — so this was a flake, and the docs-only-delta argument is
confirmed rather than merely argued.

**DISPOSITION: ACTIONED** (the red is cleared and verified green) **with the underlying test-isolation
defect DEFERRED.** Real, named, and not urgent: main's **required** checks (CI,
Deploy, CodeQL) are all green on `eb3086fa`, the board holds exactly one PR and it is docs-only,
and a re-run is already running that will settle the transient half. It becomes **urgent** the
moment attempt 2 comes back red on the same four tests — that would refute the docs-only-delta
argument and make it a genuine main regression needing a `fixes_pr`. The permanent fix is test
isolation in `batch1-dashboards.spec.ts` (unique slug per test, or teardown in `afterEach` so a
timeout cannot skip it), which is `tests/` — outside 00's `docs/` lane to merge, and properly a
prompt rather than a hand-edit.

### F2 — the container-trial workflow fails deterministically at `postinstall`, and it is the gate `pr-e2e-container-s2-swap-required-job-HOLD.md` is waiting on. `CONTAINER_TRIAL_POSTINSTALL_NOT_A_GIT_DIR_V1`

**Evidence:** three `workflow_dispatch` runs, 21 seconds apart, each failing at `Install
dependencies` with `postinstall: fatal: not in a git directory` / `ELIFECYCLE … exit code 128`,
every later step `skipped`. `package.json`'s `postinstall` is `git config core.hooksPath .githooks`
— read from the file, not inferred.

**Blast radius.** The queue holds `pr-e2e-container-s2-swap-required-job-HOLD.md`, whose whole
purpose is to swap the required job over to the container variant. **That swap cannot be armed
while the container job cannot install dependencies**, and its failure mode is not subtle — it
never reaches a test. Three identical failures in 21 seconds is not flake.

**DISPOSITION: DEFERRED.** The cure is a workflow or `package.json` change (make `postinstall`
tolerate a non-git checkout — e.g. `git config core.hooksPath .githooks || true`, or mark the
container checkout a safe directory), which is `.github/` or root `package.json`: **outside
Station 00's recorded `docs/` lane** under `STATION-CAPABILITIES.md` §5, so not mine to merge and
not something to hand-patch into a shared tree. It becomes urgent when someone tries to arm the
S2 swap. ⚠️ **Falsifying probe:** dispatch the container trial once more and read the
`Install dependencies` step. If it ever gets past `postinstall`, this is environmental and must be
re-measured.

### F3 — the safe-to-act verdict expired in five minutes, and the board became busy while I was reading it

**Evidence:** the two-sweep table above. `OPEN PRs` 0 -> 1, `armed` 0 -> 1, heartbeat 107 min ->
1 min, all between 10:21:48Z and 10:28Z. `restart-watcher-if-wedged.ps1` then returned **BUSY**.

This is the station doc's own red rule reproduced exactly — *"`[LIVE]` means true when measured,
not true now"* — on the one verdict a run is most tempted to carry forward, and within a single
station run rather than across runs.

**DISPOSITION: ACTIONED.** I re-measured before acting rather than after, and the re-measurement
changed the decision: BOARD DRIVING condition 3 (single actor) was **not** satisfied, so no board
mutation was performed. The cost was one extra sweep; the alternative was arming or merging
against a watcher that is mid-review.

### F4 — COLLECT: Station 04's 10:11Z run was BLIND, and its escalation is a recurrence of one already open with Marco

**Evidence:** `docs/pr-prompts/00-04-scanner-2026-09-22-1011-blind-run-desktop-commander-connect-timeout.md`,
read in full. Its three findings and my disposition of each:

| 04's finding | 04's disposition | mine |
|---|---|---|
| F1 — Desktop Commander `CONNECT_TIMEOUT` 30 s after the loads; no sweep covered | ESCALATED | **ESCALATED — already open, recurrence recorded.** `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already exists, so a second file would split one question across two. POSITIVE control for that search: 54 of 61 `needs-marco/` files match `Marco`; NEGATIVE control, a freshly minted needle, **0**. |
| F2 — `vm-git-guard` INERT exit 2, as documented | DEFERRED | **DEFERRED — reproduced independently this run** (`GUARD_EXIT=2`, same headline, both controls). Two stations, two sessions, same reading: the documented mechanism is unchanged. |
| F3 — rotation deliberately NOT advanced; `instrument-honesty` (index 1) still owed | DISPATCHED to next 04 | **ACTIONED — nothing for me to do, and I confirmed that.** 04 changed no file, so there is no dirty `sweep-rotation.json` for me to sweep this run; `git status --porcelain --untracked-files=no` is EMPTY. |

⚠️ **This run is itself evidence on 04's F1:** Desktop Commander answered on the first call here,
25 minutes after it timed out for 04. That is consistent with the recorded *intermittent, cause
unknown* characterisation and inconsistent with a hard outage.

**DISPOSITION: ACTIONED** (the collect itself). Every finding in 04's breadcrumb now carries a
disposition, and the previous 00 breadcrumb (09:30Z) was already fully dispositioned when I read
it — its F1/F3/F6 ACTIONED, F2/F4/F5/F7/F8 DEFERRED with owners named. Nothing in either was left
open for me to re-derive.

### F5 — the sweep's one PR-scoped `[STALE]` escalation was dead and is now discharged

**Evidence:** section 5 @10:21:48Z tagged `pr-2071-review-fix.md` `[STALE]`. Not trusted on the
tag: `gh pr view 2071 --json number,state,mergedAt` -> `MERGED`, `2026-09-22T08:22:07Z`; NEGATIVE
control `gh pr view 999997` failed **loudly** with `Could not resolve to a PullRequest`. The file's
body is entirely PR-scoped (CP-09-13 / CP-22 / CP-26 gates on #2071) — **nothing GENERAL survives**.
Tracked-set check first, per the `needs-marco/` warning: `git ls-files --error-unmatch <path>` ->
exit 1 (untracked), POSITIVE control listing the **6** files under `needs-marco/` that genuinely
are tracked. `git diff --cached --name-status` EMPTY before and after.

**⚠️ Falsifying probe run, and it passed:** the 10:30:37Z sweep's section 5 no longer carries that
row. The one surviving `[STALE]` is the *non*-PR-scoped `no station summary younger than 3 days`
row, which the 09:30Z run's F8 correctly ruled is not mine to discharge — so I read it rather than
discharging it, and left it.

**DISPOSITION: ACTIONED** — moved to `needs-marco/discharged/`, never deleted, with a discharge
note naming what was measured. Marco's escalation queue is 62 -> 61 and one fewer of his files is
dead.

### F6 — the device-bridge git ban is still REMEMBERED, not mechanical

**Evidence:** `GUARD_EXIT=2`, headline and both installer controls quoted verbatim above.

**DISPOSITION: DEFERRED.** Unchanged owner and unchanged cure — the residual fix is how the VM
shell is launched (a login shell would source the `PATH` export), which is Cowork session
configuration rather than a repo change. It becomes urgent the day the installer reports exit 0 or
non-zero on a station shell instead of 2, either of which would mean the documented mechanism
moved underneath the doc.

### F7 — `check-breadcrumb.mjs` still calls Station 00's cadence 2 h against a live cron of 1 h

**Evidence:** `--freshness` printed `00  last 2026-09-22T09:30:00Z  0.9h ago  (cadence 2h)  ok`
this run, against `cronExpression: "5 * * * *"` from the scheduled-tasks MCP. The instrument will
not call 00 SILENT until 4 h, i.e. only after **three** consecutive missed hourly runs.

**DISPOSITION: DEFERRED.** Already recorded in `STATION-CAPABILITIES.md` §6 and already filed for
Marco; the one-character fix (`'00': 1`) is in `scripts/`, outside 00's lane to merge. Re-measured
rather than re-filed, because the row is state and the paragraph recording it says so. It stays
survivable only because the COLLECT step already crosses `lastRunAt` from the MCP, which this
defect does not touch — and that cross-check is what I ran.

## WHAT I DID NOT DO

- **Did not mutate the board — deliberately, and this is the run's main decision.**
  `restart-watcher-if-wedged.ps1` returned **BUSY** with a 1-minute heartbeat and `#2080`'s own
  reviewer armed, so BOARD DRIVING condition 3 (*single actor — if something else is acting,
  STOP*) was not satisfied. No merge, no arm, no label, no PR.
- **Did not merge `#2080`.** It is CLEAN, unlabelled and docs-only, so it would classify into the
  `tests-docs` lane — but the **watcher auto-merges that lane itself**, its reviewer was mid-run
  against it, and `STATION-CAPABILITIES.md` §5's 2026-09-22 correction is explicit that *not
  watcher-routed* is a necessary and never a sufficient condition. Taking it would have been a
  merge into a live review.
- **Did not arm anything.** `ARMED=1` is the watcher's own `rev-2080`, not mine. The 09:30Z run
  measured **15 of 15** HOLDs `STILL GATED` (11 `[HUMAN_GATE_PRESENT]`, 4
  `[FILE_GATE_NOT_RELEASED]`) with `GATES SATISFIED` = none, 50 minutes earlier and at a commit
  whose only delta since is docs. Nothing became armable in that window, so I did not re-run
  `triage-holds.ps1` against a busy board to re-derive a verdict that could not have changed.
- **Did not restart the watcher.** BUSY is the one verdict that explicitly forbids it, and killing
  a healthy agent mid-review is worse than the stall it would pretend to fix.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is `dirty=4` but on `main` with no
  `MERGE_HEAD` and no unmerged paths — *not* the `*** CORRUPT` verdict that script requires.
- **Did not chase the container-trial failures as a main regression** (F2). They are
  `workflow_dispatch` runs of a **trial** workflow, not a required check on `main`; treating them
  as trunk-red would have manufactured an emergency out of somebody's experiment.
- **Did not re-run the failing smoke myself.** Attempt 2 was already in flight when I found
  attempt 1's failure; a second concurrent re-run would only have burned a runner.
- **Did not write to any gitignored sink** — no `docs/qa/qa-findings.md`, no `qa-checklist.md`, no
  `.qa-run.lock` — and **did not leave this report in the session's `outputs` folder**, which is
  the disposable location that swallowed a blind run's entire report on 2026-09-22.
- **Did not `git checkout -- <path>`, `git clean`, `reset --hard` or `stash pop`** anywhere. The
  one file I restored went back via a node write of `git show HEAD:<rel>` (§9.2).
- **Did not commit to `main`** and did not run `git` against the mount through the device bridge.
