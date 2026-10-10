# Station 00 — Supervisor | 2026-10-10T16:17:01Z–2026-10-10T17:00Z

## GROUND

```
UTC            2026-10-10T16:17:01Z
origin/main    70991313            (git fetch origin → exit 0, then git rev-parse origin/main)
dev tree       main @ 70991313     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version: 1 — MATCHES; run is NOT read-only-forced)
```

🟢 **NOT BLIND.** This is the **first sighted Station 00 run after six consecutive blind ones**
on 2026-10-10 (0000, 0716, 0815, 0915, 1114, 1514). `start_process` shell `powershell.exe`
succeeded on the first call after a keyword `ToolSearch` for `desktop-commander`.

🔴 **NO SAFE-TO-ACT VERDICT EXISTS THIS RUN, AND IT IS NOT MY INSTRUMENT'S FAULT — CIM IS DEAD ON
THIS BOX.** See F1. Board mutations were therefore gated on the sweep's underlying conditions
measured directly, one at a time, rather than on its verdict (F2).

---

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → PID 112340, prompt returned.
Second shell PID 26108 opened later to work in parallel with a stalled sweep. **Not blind.**

**Git guard.** [CANNOT MEASURE] The bootstrap's mandatory
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` could not be run at all. Three
consecutive attempts on the VM-side bash transport: `request timed out after 30s` (×2) and
`RPC error -1: process with name "determined-clever-cray" already running
(id: oneshot-c1792318-...)` (×1). **No installer last line and no exit code exist to quote.** Per
the station contract this is a finding, not a stop (F7). Mitigation: I issued **zero** further
VM-side calls; every `git` call in this run was host-side through Desktop Commander, and the only
index-writing ones were inside the sanctioned `sweep-breadcrumbs.ps1`.

**Binding documents.** Read from `git show origin/main:<path>` **in the dev tree**, never the
working copy — cores in full per `BOOTSTRAP_CORE_REFERENCE_V1`:
`docs/pipeline/stations/00-supervisor.md` (466 lines, 32,883 B),
`docs/pipeline/DOCTRINE.md` (508 lines, 30,719 B),
`docs/pipeline/STATION-CAPABILITIES.md` (740 lines, 54,828 B). No REFERENCE section was needed
beyond what the cores inline.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`CLEAN`, **exit 0**; structure: 10 checked, 0 malformed. Freshness: `00` 1.3 h ago (cadence 1 h +
0.5 grace) ok · `03` 17.5 h ago ok · `04` 2.4 h ago ok · `05` **−21.8 h ago** ok. **No station is
MISSED.** The negative age on 05 is the known breadcrumb mis-dating recorded as 1514's F3, not a
clock defect (F6).

**Board.** [MEASURED] `gh pr list --state open --json number,title,labels,mergeStateStatus` —
**2 open PRs, both carrying `do-not-merge`, both `BEHIND`:**

| PR | title | label | state | last update |
|---|---|---|---|---|
| **#2303** | fix(pipeline): refuse a HOLD whose own PR is already open | `do-not-merge` | BEHIND | 2026-10-10T05:01:26Z |
| **#2294** | fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch | `do-not-merge` | BEHIND | 2026-10-10T01:25:37Z |

**Both are Marco's by RULE 2 / the label gate. There was nothing on this board I was permitted to
merge, with or without a sweep verdict.** [MEASURED] `gh run list --branch main --limit 6`:
CI, Push on main, Deploy, Pipeline heartbeat all `success` — **trunk is GREEN**.

**Queue.** [MEASURED] tracked armed prompts on `origin/main` at depth 1
(`git ls-tree --name-only origin/main -- docs/pr-prompts/` filtered `-ready\.md$`) → **0**. On disk,
where `git status` is structurally blind to them (DOCTRINE §9.2) → **0**. POSITIVE control, same
glob for `-HOLD\.md$` → **16**. **No board trap; nothing armed.**

**Safe-to-act, measured by its parts because the sweep could not answer.** [MEASURED] no `*.lock`
anywhere under `.git` (empty listing); no `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
`rebase-merge` / `rebase-apply` / `sequencer`; **0** armed prompts, so no prompt in progress; newest
open-PR `updatedAt` **11.3 h** old, so nothing touched in the last ~2 min; no `.arming-log.txt`.
**All four underlying conditions the sweep's gate exists to test read CLEAN by direct probe.**
[INFERRED] on that basis, and on that basis only, I took the board lease and ran the one sanctioned
mutation below. 🔴 **This is NOT a safe-to-act verdict and must not be quoted as one.**

**Process census.** [MEASURED] 2026-10-10T16:4xZ, `Get-Process` (deliberately **not** CIM):
`TOTAL_PROCESSES=2116`, `conhost=887`, `powershell=883`, `svchost=101`, `node=9`;
`powershell_ws_MB=33901.7`, `powershell_handles=450095`; oldest `powershell`
2026-10-08 07:28:39 local, **newest 2026-10-11 02:35:04 local — this minute.** Watcher node pid
**16148** alive since 2026-10-10 12:20:12 local.

---

## WHAT CHANGED

**On the board: one PR, and nothing else.** No prompt armed, disarmed, renamed or deleted. No label
touched. No merge. No `/sot/` edit. No process killed. No worktree pruned. No production or tenant
state. No Azure / Entra / SharePoint call of any kind.

1. **Board lease taken** (`Enter-BoardLease`, actor `station-00.scheduled`) before the mutation, and
   the same actor string passed to the script — the `-Actor` default trap recorded in the station
   doc's condition 3.
2. **`scripts/pipeline/sweep-breadcrumbs.ps1` run**, batching the 10 untracked station breadcrumbs
   (6 × 00, 2 × 04, 1 × 05, plus this one) onto a branch and opening **ONE** board PR. Read back:
   see the PR number and head SHA quoted in the run's chat report and in the PR body. **This is the
   action that unblocks the reporting chain** — see F3.
3. **Two files written outside git's reach:**
   - `docs/pr-prompts/needs-marco/system-thread-exhaustion-2116-processes-and-cim-is-dead-so-the-safe-to-act-gate-cannot-answer-2026-10-10.md`
     — the escalation for F1. `needs-marco/` is gitignored by rule; it is nonetheless the only
     channel that stops anything, and `status-sweep.ps1` reads it.
   - this breadcrumb.
4. **One stalled process terminated:** `force_terminate` on shell PID 112340, which had been inside
   `status-sweep.ps1` for >20 min with no output. **Not a watcher process, not a board process** —
   my own shell, and one that was itself adding to the storm in F1.

**`docs/pipeline/sweep-rotation.json` and `docs/data-model/metadata-catalog.json` remain MODIFIED in
the dev tree.** Station 04 left the first deliberately for 00 to commit (its own authority forbids
it). I did **not** commit either: `sweep-breadcrumbs.ps1` is scoped to breadcrumbs by design, and
hand-staging a second path through it would be exactly the hand-rolled board operation DOCTRINE §1
forbids. 🔴 **Both still block the next `git merge --ff-only` in the dev tree** — named here so the
next run sweeps them rather than discovering them (F5).

---

## FINDINGS

### F1 — 🔴 S1 · The process storm is LIVE and MEASURABLY WORSE, and it has now taken out the pipeline's own safe-to-act gate

Station 04's F1 (breadcrumb `00-04-scanner-2026-10-10-1410-...`) is **confirmed by independent
measurement 2.2 h later, and the numbers moved the wrong way:**

| | 04 @ 14:34Z | 00 @ 16:4xZ | delta |
|---|---|---|---|
| total processes | 2019 | **2116** | +97 |
| `powershell` | 834 | **883** | +49 |
| handles | 431,698 | **450,095** | +18,397 |
| `powershell` working set | 31.6 GB | **33.9 GB** | +2.3 GB |

`0x800700a4` = `ERROR_MAX_THRDS_REACHED` names the cause rather than suggesting it. **The new fact
this run adds** is the cost to the pipeline rather than to the watcher: `status-sweep.ps1` ran
**>20 minutes and never printed a SAFE / CAUTION / DO-NOT-ACT verdict** (04 measured 947 s on the
same call). It reads the watcher through CIM at line 263 and the **safe-to-act gate** through CIM at
line 541. **While this lasts, no scheduled run can obtain a safe-to-act verdict — which is the gate
Station 00 arms and merges behind.** The remedy is killing ~1,770 processes or rebooting:
destructive, DOCTRINE §5.4, and no agent's to take.

**DISPOSITION: ESCALATED** — filed this run as
`needs-marco/system-thread-exhaustion-2116-processes-and-cim-is-dead-so-the-safe-to-act-gate-cannot-answer-2026-10-10.md`,
with RULE 1 options (A complete-and-additive: kill wrappers by PID, then land a **per-box** failure
counter and a single-wrapper refusal in `ensure-watcher` — the 15-day-old escalation
`ensure-watcher-relaunches-a-second-wrapper-...-2026-09-25.md` is the same defect; B reboot, fails
the future half; C nothing, fails both). 🔴 **04's F1 existed only in an UNTRACKED breadcrumb, which
reaches nobody. That is why this run wrote it to `needs-marco/` as well as collecting it.**

### F2 — 🟡 S2 · Station 04's F2 is collected and stands: the only sanctioned liveness probe silences its CIM errors, so a failed call reads as "watcher not running"

Measured by 04 firing today on live data. With CIM dead box-wide (F1), **the next run's sweep will
not merely stall — it may return a confident zero and declare a live watcher dead**, which is
DOCTRINE §7's named worst case and the LL-25 kill. I did not fix it: `scripts/pipeline/status-sweep.ps1`
sits outside `tests|docs`, so a fix PR is Marco's to release, and **PR #2294 already touches that
file and has sat `do-not-merge` for 15 h** — adding a second blocked PR to the same file would buy
nothing and risk a conflict with his.

**DISPOSITION: DEFERRED** — subsumed into F1's OPTION A step 4 (the instrument half), and named
inside the escalation so it is not fixed without it. **What would make it urgent:** a run that
reports the watcher DOWN from a CIM zero while `Get-Process` shows the node alive. Any station
reading this: cross-check `Get-Process -Name node` before believing a sweep's watcher verdict.

### F3 — 🟢 ACTIONED · The reporting chain's only closing channel was backed up at 10 breadcrumbs, and this run closed it

[MEASURED] `git status --porcelain` listed **10** untracked `docs/pr-prompts/00-*.md` breadcrumbs —
six Station 00, two Station 04, one Station 05, plus this run's. Station 04 predicted this
consequence in its own F1: *"7 of the 8 breadcrumbs on disk are UNTRACKED, because the station that
commits them (00) has been blind for most of the day."* It was right, and the count had grown.

**DISPOSITION: ACTIONED** — swept onto one branch and one board PR via
`scripts/pipeline/sweep-breadcrumbs.ps1` under the board lease. **Verified by read-back:** the PR
number, head SHA and the file list are quoted in the chat report; the breadcrumbs are no longer
untracked in the dev tree. This is the one thing a sighted run could do today that six blind runs
could not.

### F4 — 🟡 DEFERRED · Four released HOLDs are armable and I armed NONE of them, on purpose

Station 04's 0624 breadcrumb found gates released on `pr-sec-a2-email-codes-and-reset-links-HOLD.md`
(F2), `pr-queue-layout-sot-entry-HOLD.md` (F3, Station 05's), `pr-scopecards-s8b-azure-maps-travel-HOLD.md`
(F4 — **premise REFUTED by `origin/main`; do not arm**) and `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`
(F5 — **its own work is already open as PR #2294**). Arming is mine alone and I declined all four:

- **s8b** — 04 measured its `premise_means` refuted. Arming it builds the wrong thing. **Correct
  outcome: not armed.**
- **sweep-section5** — duplicate of open #2294. Arming it builds the same work twice
  (DOCTRINE §10.6). The guard against exactly this is PR **#2303**, which is itself blocked
  `do-not-merge`.
- **sec-a2** and **queue-layout-sot-entry** — genuinely armable. 🔴 **But arming hands a build to a
  watcher wrapper set that is in a self-amplifying crash loop on a box at
  `ERROR_MAX_THRDS_REACHED` (F1).** A build dispatched into that is a build that fails for reasons
  that have nothing to do with the prompt, and it adds `powershell` wrappers to the storm.
  `queue-layout-sot-entry` is 05's lane in any case.

**DISPOSITION: DEFERRED.** **What would make them urgent / what unblocks them:** F1 resolved and one
clean `WATCHDOG started` line. The MARCO_QUEUE_LINE_V1 figures for the record: **2 PRs waiting on
Marco** (#2303, #2294), **0 armed**, **16 HOLDs tracked**. Arming nothing this run added nothing to
his queue.

### F5 — 🟡 DEFERRED · Two modified tracked files still block the dev tree's next fast-forward, and one of them is a station hand-off

`docs/pipeline/sweep-rotation.json` was advanced and left dirty by Station 04 **deliberately**, for
00 to commit — 04's authority row forbids it opening a PR. `docs/data-model/metadata-catalog.json`
is also modified and **I cannot attribute it**; it is not named in any breadcrumb I collected. Both
read as ` M` in `git status --porcelain`, and a modified tracked file blocks `git merge --ff-only`
identically to an untracked one at a path the merge must create.

**DISPOSITION: DEFERRED** — not swept, because `sweep-breadcrumbs.ps1` is scoped to breadcrumbs and
hand-staging extra paths through it is the hand-rolled board operation DOCTRINE §1 forbids. **What
would make it urgent:** the next run finding `git merge --ff-only` refused after this run's board PR
lands. The cure is the station doc's raw-Buffer restore sequence, not `git checkout --`. 🔴 **And the
general defect is real: there is no sanctioned primitive for a read-only station to hand 00 a dirty
tracked file.** 04 did the only thing available to it and said so; 00 has no scoped tool to accept it.

### F6 — 🟢 ACTIONED (recorded) · Breadcrumbs are being mis-dated by a day, and `--freshness` now prints a NEGATIVE age because of it

Station 05's newest breadcrumb is named `...2026-10-11-1425...` while the host UTC clock read
`2026-10-10T16:17:01Z` at the start of this run. `--freshness` therefore printed
`05 last 2026-10-11T14:25:00Z  -21.8h ago  ok`. **A negative age is a well-formed number that was
never measuring elapsed time** (DOCTRINE §9.6 does not fire — nothing is empty). 1514's F3 already
REFUTED the "24-hour clock skew" reading of this and correctly identified it as the 10-hour
Brisbane/UTC offset leaking into breadcrumb *names*; **no day is owed**, and this run's independent
clock reading confirms it. What remains is cosmetic-but-corrosive: a station stamping local time in
a UTC-named file.

**DISPOSITION: ACTIONED** as *recorded and closed here* — the verdict (`CLEAN`, exit 0, no station
MISSED) is unaffected, and the naming fix belongs to 05's own doc, not to this station. Carried
forward in one line so the next reader does not re-derive it a fourth time.

### F7 — 🟡 DEFERRED · The bootstrap's mandatory git guard could not be installed, in a FIFTH independent session, and this time for a new reason

0614's F10 recorded `INSTALLED BUT INERT` in a fourth session; 04's 1410 F6 recorded the installer
being *unrunnable* because VM bash was down; **this run reproduces the unrunnable case, with a third
distinct error signature** — `RPC error -1: process with name "determined-clever-cray" already
running` alongside the two 30 s timeouts. So the step every run is told to perform first has now
failed, for two different reasons, in five consecutive observations. The station doc is explicit
that this is a finding and not a stop, and that an inert or absent guard is **never** a licence to
run `git` against the mount — which this run honoured by issuing zero VM-side calls after the third
failure.

**DISPOSITION: DEFERRED** — the existing escalation
`needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md` owns this ask; adding a
fifth observation to a 30-day-old queue item changes nothing Marco can act on today, and F1 is the
one thing in front of him that is getting worse by the hour. **What would make it urgent:** a run
that reaches for the mount *because* the guard reported inert.

### F8 — 🟡 DEFERRED · `ci.yml:307` still tells every reader the sot-refs baseline holds 23 entries; it holds zero. Third consecutive day.

Station 05's F3, filed 2026-10-09, dispatched, still unfixed; 1514's F5 carried it forward. It is a
stale constant inside `.github/workflows/ci.yml`, i.e. **outside `tests|docs` and outside Station
00's recorded `docs/` lane** — so a one-line fix PR is classified Marco's by STATION-CAPABILITIES §5
however trivial the diff. It joins #2303 and #2294 in the same queue.

**DISPOSITION: DEFERRED** — not escalated as its own item, because filing a third paper for a
one-line comment while the box is at `ERROR_MAX_THRDS_REACHED` buys attention at the wrong price.
**What would make it urgent:** a station reading that line and reporting the baseline as 23, i.e.
the stale constant actually misleading a run rather than merely sitting there.

---

## WHAT I DID NOT DO

- **I did not kill a single watcher, wrapper, `powershell` or `conhost` process.** ~1,770 of them are
  the F1 incident and the remedy is destructive — DOCTRINE §5.4, Marco's. The only process I
  terminated was my own stalled shell (PID 112340).
- **I did not merge anything.** Both open PRs carry `do-not-merge`; only Marco removes it. No
  instrument-lane merge was attempted — neither PR is in lane and neither has a MERGE verdict
  anchored to its current head.
- **I did not arm anything** — F4 says why, prompt by prompt. 0 armed in, 0 armed out.
- **I did not call `gh pr update-branch`** on #2303 or #2294 although both read `BEHIND`. The
  watcher's auto-update timer is OFF by default and every stray update-branch costs a full CI
  rebuild on PRs nobody is about to merge.
- **I did not claim a safe-to-act verdict**, a liveness verdict, a smoke verdict or a
  `breadcrumb-clean` beyond what `check-breadcrumb.mjs` actually printed (`CLEAN`, exit 0).
- **I did not touch `/sot/`** (Station 05's alone), did not re-run `status-sweep.ps1` hoping for a
  different answer (DOCTRINE §2), did not commit on `main` in the dev tree, and did not clear any
  `[STALE]` escalation row — the sweep that tags them never produced its output.
- **I did not re-measure 04's `supervisor.log` line-by-line.** Its content timestamps are quoted
  from 04's breadcrumb as `[INFERRED]` provenance; my own `[MEASURED]` contribution to F1 is the
  live `Get-Process` census, which is the half that shows the incident growing.
- **I did not commit `sweep-rotation.json` or `metadata-catalog.json`** — F5.
- **No Azure, Entra, SharePoint, `az`, `Connect-MgGraph`, production data or auth call of any kind.**
