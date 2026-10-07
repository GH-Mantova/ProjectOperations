# Station 00 — Supervisor | 2026-10-07T05:14Z–2026-10-07T05:4xZ

## GROUND

```
UTC            2026-10-07T05:14:50Z
origin/main    7993d006            (fetch first, then rev-parse)
dev tree       main @ 7993d006      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`). Full-authority run, not read-only.

## WHAT I MEASURED

**Reachability — SIGHTED.** `ToolSearch` keyword `desktop-commander` loaded the toolset; the ids
the search reported were used, not assumed. `start_process` shell `powershell.exe` returned a live
prompt on the Windows host. No `CONNECT_TIMEOUT`, so no retry was needed and no blindness is claimed.

**Device-bridge git guard — exit 2, INERT (the expected station outcome).** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself with nothing appended:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
   PATH="/sessions/<session>/.local/bin:$PATH" git <args>
EXIT=2
```

Its controls, as printed: `bash -lc 'command -v git'` -> the shim;
`bash -c 'command -v git'` -> `/usr/bin/git`. So the device-bridge git ban is REMEMBERED, not
mechanical, in this run too. **It was obeyed:** every `git` call this run ran in a shell on the
Windows host through Desktop Commander, none against a `/sessions/.../mnt/` path.

**Binding reads.** `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` were read in full from
`git show origin/main:<path>`, run in the DEV TREE `C:\ProjectOperations2` after
`git fetch origin`, never from the working copy and never in the watcher clone. No piped
`hash-object` comparison was made (DOCTRINE section 9.2).

**Sweep — `scripts/pipeline/status-sweep.ps1`, completed 2026-10-07T05:15:13Z.** Section 0 positive
controls both `[LIVE]` (gh reached GitHub, saw merged #2263; node runs). Section 7 verdict:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Supporting `[LIVE]` lines: `git index.lock interactive/clone: False / False`; scoped git processes
touching our trees `0`; `board lease: free`; `no PR touched on GitHub in the last 2 min`; watcher
build `no build in flight (newest tick 97.7 min old)`.

**Board, from section 1 `[LIVE]`.**

| reading | value |
|---|---|
| OPEN PRs | **1** — #2261, BEHIND, CI **13 pass / 2 fail**, labelled `do-not-merge` |
| WAITING ON MARCO | **1** open PR labelled `do-not-merge`; oldest #2261, open 2h |
| armed (`*-ready.md`) | **0** |
| main CI on 7993d006 | 3 success / **1 failed** — **TRUNK IS RED** |
| watcher | node RUNNING pid 39052; wrapper alive; clone `branch=main tracked-dirty=0 untracked=3` |
| queue | `needs-marco/` 54 - `no-pr-opened/` 111 - `failed/` 80 - `blocked/` 201 |
| backlog gates | `ready=1 needs-marco=2 blocked=4 broken=0` |

MARCO_QUEUE_LINE_V1 figures, copied as the arming rule requires: **WAITING ON MARCO = 1** open PR
(`#2261`, 2h old); **ALL OPEN (non-draft) = 1**. Nothing was armed this run, so these are recorded
as the baseline rather than as the justification for an arm.

**COLLECT — breadcrumb corpus.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`,
exit **2**:

```
ADMIT   00-00-supervisor-2026-10-07-0414-third-red-on-2261-is-the-label-working-and-05-is-at-ten-missed-occurrences.md
structure: 1 checked, 0 malformed, 0 skipped as pre-contract

  00  last 2026-10-07T04:14:00Z    1.1h ago  (cadence 1h + grace 0.5h)   ok
  02  dispatch-only - no cadence to miss
  03  last 2026-10-06T23:03:00Z    6.3h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-07T02:10:00Z    3.1h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-09-24T14:23:00Z  302.9h ago  (cadence 24h + grace 3h)    MISSED
MISSED: 1 station(s) past cadence + grace
```

Three stations read `ok` in the same output, so the validator can produce a positive and the single
negative is meaningful (DOCTRINE section 7, positive control first). One breadcrumb in the queue
root — 00's own 0414 run, whose findings were landed by **#2263** (merged 04:25Z). It is archived in
this run's PR.

**COLLECT — `lastRunAt` cross-check, scheduled-tasks MCP, read 05:16Z.**

| task | cron | enabled | lastRunAt | vs newest breadcrumb |
|---|---|---|---|---|
| 00-supervisor | `5 * * * *` | true | 2026-10-07T05:14:05Z — this run | aligned |
| 03-machine-minder | `0 9 * * *` | true | 2026-10-06T23:02:55Z | aligned |
| 04-scanner | `0 */4 * * *` | true | 2026-10-07T02:09:42Z | aligned |
| 05-sot-keeper | `10 0 * * *` | **true** | **2026-09-27T21:38:18Z** | `lastRunAt` older than one cadence -> **never fired** |
| weekly-security-audit | `30 7 * * 1` | false | 2026-09-06T21:32:44Z | not a station |

Live enabled count: **four**, read from the MCP, not from `STATION-CAPABILITIES.md` section 6.

**Escalation `[STALE]` sweep.** Section 5 flagged no `[STALE]` escalation rows. The only `[LIVE]`
row is
`2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`
-> `#2261 = OPEN — genuinely open`. Nothing was retired, because nothing qualified.

## WHAT CHANGED

- Archived `00-00-supervisor-2026-10-07-0414-...md` to `docs/pr-prompts/archive/` (`git mv`), its
  findings having landed in #2263. `check-breadcrumb.mjs` matches by basename, so it still counts
  for `--freshness`.
- Wrote this breadcrumb.
- **No board mutation.** Nothing armed, nothing disarmed, nothing merged, no label added or removed,
  no scheduled task enabled, disabled, run or edited, no `/sot/` file touched, no worktree pruned.
- Board lease taken as `station-00` for this PR's commit and push, and released after it.

## FINDINGS

### F1 — Trunk is RED, and for the first time the FIRST DOMINO is named: the "Customise dashboard" dialog does not close. The nav-link failures are its symptom, not the fault.

[MEASURED] `Tendering Browser Smoke` run `37571374467`, job `tendering-e2e` (112630588378), head
**7993d006** = current `origin/main`: **4 failed, 1 skipped, 162 passed (6.5m)**, exit 1. All four
are in `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — SLICE 5 (:266), SLICE 7 (:359),
SLICE 4 (:412), SLICE 6 (:487).

[MEASURED] the commit that produced that head changes **two files, both docs**:

```
git diff --name-only 4d46def4 7993d006
docs/pr-prompts/00-00-supervisor-2026-10-07-0414-...md
docs/pr-prompts/archive/00-00-supervisor-2026-10-07-0314-...md
```

[MEASURED] and nothing the suite can reach has changed in **14 commits**: a
`git log --name-only -14 origin/main` filtered to `^(apps|packages|prisma|tests|scripts|.github)/`
returns only `scripts/pipeline/*` and `scripts/pr-watcher/*` — no `apps/`, no `prisma/`, no
`tests/`. [MEASURED] the same workflow on main: **19 of the previous 20 runs `success`** (1
`cancelled`), including the immediately preceding head 4d46def4 at 03:36Z.

**The new part, and it contradicts the obvious reading.** The previous run's F2 recorded these
four as "four tests in `pr-acceptance-batch1-dashboards` failed" and left the cause open; the
visible error on three of them is `nav link <dashName> not visible within 10s`, which invites the
diagnosis "the nav is slow after Create dashboard". The Playwright report artifact
(`playwright-report`, 11461715757, downloaded and read this run) refutes that:

- **SLICE 5 failed on a DIFFERENT assertion** — `expect(getByRole('dialog', { name: 'Customise
  dashboard' })).not.toBeVisible()`, `Received: visible`, timeout 5000ms. The dialog **stayed open**.
- **SLICE 5's dashboard WAS created.** The page snapshot captured at SLICE 6's failure shows
  `navigation "Main navigation"` containing exactly one dashboard link,
  `link "e2e-slice5-1791347369082"`, plus `button "New dashboard"`.
- So at the moment SLICE 6 timed out waiting for *its* dashboard, SLICE 4's and SLICE 7's are
  **also absent**. Three creates produced nothing; the one dashboard present belongs to the test
  that failed on the dialog.

[INFERRED] One cause, four symptoms: the **"Customise dashboard" dialog not dismissing** after
`Create dashboard`. SLICE 5 asserts on the dialog directly and reports it; SLICE 4, 6 and 7 assert
on the nav link, so a create that never completed behind a stuck modal surfaces as "element(s) not
found" ten seconds later. A fix aimed at the nav assertion would be aimed at the wrong statement.

**[CANNOT MEASURE] whether the stuck dialog is an application defect or runner slowness**, and
that is exactly why nothing was changed. No `apps/web` code has moved in 14 commits, so it is not a
regression from any commit on main — but "not a regression" is not "not a defect", and the failure
has now been seen on **two different heads inside one hour** (#2261's head earlier, then main here)
after 19 consecutive greens. Hardening the four tests to wait for the dialog would be a **mask**,
which DOCTRINE section 8.2 forbids if a real defect is underneath.

Trunk red does **not** block the board: required checks are evaluated per-PR, and #2261 is held
by its `do-not-merge` label, not by main's status. No PR was re-driven — DOCTRINE section 2, never
re-run hoping for green, and a 13-minute e2e rebuild buys nothing.

**Falsifying probe, and it costs nothing: this run's own board PR is docs-only and
`Tendering Browser Smoke` runs on docs-only commits** (it ran and passed on 4d46def4, which is
docs-only, and ran and failed on 7993d006, which is also docs-only). So this PR is a free third
sample on code that has not changed.

- **Green** -> the two reds were transient; F1 is answered and the dialog lead is parked.
- **Red, same four tests** -> three observations on three heads with byte-identical app code. That
  is reproducible, not flaky, and the next run should open a prompt against the dialog's dismissal
  path rather than against the tests.

**The next Station 00 run must read this PR's `tendering-e2e` conclusion and record which way it
fell.** The PR number and its result are the whole probe.

**DISPOSITION: DEFERRED** — real, and deliberately not fixed this run because the only fix I could
write without knowing whether the dialog is an app defect would be a mask. What makes it urgent: a
red on this run's own docs-only PR (giving three-for-three on unchanged code), or any PR whose merge
is actually blocked by this suite.

### F2 — Station 05 is at eleven never-fired occurrences; `lastRunAt` is byte-identical for the fourth consecutive reading, and the escalation's own probe is still ~9h away.

[MEASURED] scheduled-tasks MCP, 05:16Z: `05-sot-keeper`, `enabled: true`, cron `10 0 * * *`,
**`lastRunAt 2026-09-27T21:38:18Z`**, `nextRunAt 2026-10-07T14:22:37Z`. That value is unchanged —
to the second — from the readings at 00:21Z (Station 00), 02:10Z (Station 04, independently) and
02:15Z (Station 00). [MEASURED] `--freshness` agrees from the other instrument: `05 last
2026-09-24T14:23:00Z 302.9h ago MISSED`, with 00/03/04 all `ok` in the same output.

Classification (FRESHNESS_ONE_CADENCE_V1): **never fired** — `lastRunAt` older than one cadence and
not advancing while `nextRunAt` keeps being recomputed. `/sot/` has now had no keeper for ten days,
and 05 is the only station that may edit it.

The open escalation
`docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
already carries this, narrowed to 05 alone in its 00:21Z update and independently confirmed in its
02:3xZ update. **Its named probe — read `lastRunAt` after 05's occurrence at 2026-10-07T14:22:37Z —
has not fired yet.** No fifth identical "still unchanged" update was added to that file: repeating a
measurement it already records would add noise to Marco's queue without adding information, and the
file is already explicit about what to read and when.

**DISPOSITION: ESCALATED** — open with Marco in the file named above, unchanged and unanswered. The
task store is his; a station may not enable, disable, run or edit a scheduled task on a MISSED
reading (DOCTRINE section 7). The run due at **14:22:37Z** either discharges the file or confirms
the silence for an eleventh day.

### F3 — 30 non-main worktrees and 2 registry escapees, several holding unpushed commits and uncommitted work.

[MEASURED] sweep section 2 `[LIVE]`: `non-main worktrees found: 30`, every one classified
`orphaned worktree (aborted run leftover -- investigate/prune)`, plus
`worktree-registry-escapees: 2 found` (`C:\PR-Master\worktrees\bootstrap-check` age 6109 min;
`C:\po-wt\dispatch-register-v1` age 6214 min, both `size=0KB .lock=False`).

Two hold work that a `--force` prune would destroy: `C:/po-worktrees/sup-cwd-paths`
(**4 commits on no remote branch** + **2 dirty files**, age 18580 min) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (**1 dirty file**, age 6265 min).
`C:/po-wt/fv2drop` holds **21 commits on no remote branch**, `C:/po-wt/s8h` **16**,
`C:/po-wt/rcpt-2183` **15**. #2254 recorded 17 of 27 as proved safe to prune; the count has grown
to 30 since.

Pruning worktrees is Station 03's lane ("Repair the machines" — 00 dispatches, does not do it:
LL-38). 03 is healthy and its next occurrence is **2026-10-07T23:02:45Z**.

**DISPOSITION: DISPATCHED to Station 03 — machine-minder.** Hand-over, in one line: classify all 30
by liveness, prune only those with **no** unpushed commits and **no** dirty files, and for
`sup-cwd-paths`, `fv2drop`, `s8h`, `rcpt-2183` and `sweep-dirty-untracked-v1` push or preserve the
commits first and report what you preserved. Never `--force`. The two registry escapees are
0 KB with no `.lock` and are the cheapest to confirm dead.

### F4 — Nothing is armed, and nothing was armed; the reason is the fix lane, not an oversight.

[MEASURED] `armed (*-ready.md): 0` (sweep section 4) and
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` returned nothing. Thirteen `*-HOLD.md` prompts
are staged. The never-list check the arming rule demands (`NEVER_LIST_BEFORE_ARMING_V1`) was not
reached, because no candidate survived the earlier filter:

- `pr-rates-s11c-drop-legacy-tables`, `pr-524-rates-b-slice2-canonical` — destructive drops, and
  the backlog gate for 11c still reads `>>> UNBLOCKED, BUT NEEDS MARCO` with an undecided design
  question (`map-locations-waste-rate-coupling`) that section 6 says must be settled **before** the
  drop.
- `pr-tenant-mt4-s2-ownership-migration` — production data. Its own gate note says Marco arms it,
  Marco takes the CSV export, Marco merges it.
- `pr-siteid-notnull-backfill`, `pr-retire-tenderclientnote-s2`,
  `pr-tipid-s3-retire-the-name-guard-for-an-id-check` — migrations.
- `pr-queue-layout-sot-entry` — a `/sot/` edit. **Station 05 only**, and CP-24 hard-fails any PR
  mixing code and `sot/`.
- the remainder (`pr-vendor-invoice-ocr`, `pr-nav-jobs-projects-merge`, `pr-fv2-output-channels`,
  `pr-fv2-ai-digests`, `pr-scopecards-s8b-azure-maps-travel`,
  `pr-sec-a2-email-codes-and-reset-links`) are feature slices that touch `apps/web`, i.e. precisely
  the tree whose acceptance suite is red on trunk (F1). Arming one now buys a PR whose e2e result
  cannot be distinguished from F1's failure.

Deliberate call, stated as the run's own choice: **the board gets fixed before it gets filled.**
There is no arming limit (Marco, 2026-10-03), so this is judgement, not a rule — and it is recorded
here with its figures so a future limit has evidence.

**DISPOSITION: DEFERRED** — arm once F1's probe has fallen one way or the other. What makes it
urgent: an empty board with a green trunk, which is one CI run away.

## WHAT I DID NOT DO

- **Did not re-run or re-drive any CI.** DOCTRINE section 2 — never re-run hoping for green. F1's
  probe is this PR's own run, which was going to happen anyway.
- **Did not touch #2261.** It carries `do-not-merge`; only Marco removes that label, and
  `Assert-SmokedOrEscalate` would refuse it anyway on 2 failing checks. No `gh pr update-branch`
  was called on it — the watcher's BEHIND timer is off and a stray update costs a full CI rebuild
  for a PR that cannot merge.
- **Did not write a receipt for #2261.** Neither form is open to a station: `authority: standing`
  has no lane admitting `scripts/pipeline/pipeline-lib.ps1` (it is the first entry on the
  `instrument-lane.json` never-list), and `authority: personal` requires Marco's release.
- **Did not arm anything** — see F4 for the per-prompt reason.
- **Did not prune a worktree, clear a lock, or restart the watcher.** Station 03's lane; dispatched
  in F3. No lock needed clearing: both `index.lock` readings were `False`.
- **Did not touch the scheduled-task store.** Not enabled, not disabled, not run, not edited.
- **Did not add a fifth identical update to the 05 escalation.** Its probe is ~9h out; a repeat of
  a measurement it already holds is noise in Marco's queue.
- **Did not retire any escalation.** No `[STALE]` row was flagged and the one `[LIVE]` row's PR is
  genuinely open.
- **Did not edit `/sot/`.** Station 05's lane, absolutely.
- **Did not touch Azure / Entra / SharePoint.** Nothing in this run came near them.

## FOR MARCO

Two things, both already in `needs-marco/` and neither needing a new file:

1. **#2261** is green on 13 of 15 and held by its `do-not-merge` label — which is the gate working,
   not a fault. Only you can release it, and the question is laid out in
   `needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`.
2. **Station 05 has not fired for ten days** and `/sot/` has had no keeper for that long. Its next
   occurrence is **14:22:37Z today**; if `lastRunAt` does not advance past `2026-09-27T21:38:18Z`
   after it, the task needs your hands.
   `needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`.

---

## CORRECTION 2026-10-07T05:4xZ — F1's falsifying probe as first written CANNOT FIRE, and the difference is push-trigger vs pull-request-trigger

Added by the same run, before this PR merged, after reading its own checks. F1 above says *"this
run's own board PR is docs-only and `Tendering Browser Smoke` runs on docs-only commits ... So this
PR is a free third sample."* **[MEASURED] that is false for the PR, and true only for the push to
`main`.**

`gh pr checks 2264` on head `82f2a559`:

```
Changed-path filter                     pass    5s
Changed-path filter                     pass    8s
tendering-e2e                           skipping   0
Web — lint, logic tests, vitest, build  skipping   0
API — lint, test, compliance smoke      skipping   0
```

Every other required check passed, including `Approval receipt (CP-26)` and
`PR gates — diff checks`. **`tendering-e2e` is SKIPPED on this PR** — the changed-path filter
correctly excludes a diff of two files under `docs/pr-prompts/`.

🔧 **Why the evidence F1 cited still stands, and why the conclusion drawn from it did not.** The two
samples F1 quotes — `success` on 4d46def4 and `failure` on 7993d006, both docs-only — are
**push-triggered runs on `main`**, which do execute the suite; the per-PR run does not. Both facts
are true and they are about two different workflows on the same name. This is DOCTRINE §7's exact
shape: a well-formed reading (`Tendering Browser Smoke` ran on a docs-only commit) used to support
a claim about a different trigger, with nothing warning that the corpus had changed.

⚠️ **Corrected probe, and it still costs nothing.** When this PR merges, the squash commit lands on
`main` and the **push-triggered** `Tendering Browser Smoke` runs against it, on app code that has
not changed in 14 commits. That is the third sample.

**The next Station 00 run reads the push-triggered run for this PR's merge commit on `main`, not
this PR's checks.** `gh run list --branch main --workflow "Tendering Browser Smoke" --limit 3`:

- **`success`** → the two reds were transient; F1 is answered and the `Customise dashboard` dialog
  lead is parked, not closed.
- **`failure` on the same four tests** → three observations on three heads with byte-identical app
  code. Reproducible, not flaky, and the fix belongs against the dialog's dismissal path rather than
  against the four tests.

Nothing else in F1 changes: the first-domino diagnosis comes from the Playwright artifact of run
`37571374467`, which is unaffected by which trigger started it.
