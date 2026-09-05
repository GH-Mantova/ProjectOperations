# Station 00 — Supervisor | 2026-09-05T13:08Z–2026-09-05T13:5xZ

## GROUND

```
UTC            2026-09-05T13:08:54Z
origin/main    6437172c            (git fetch origin --prune, then git rev-parse)
dev tree       main @ 6437172c     C:\ProjectOperations2  (fast-forwarded from b0c61266 this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. **This run was SIGHTED** — Desktop Commander loaded by keyword
`ToolSearch`, then `start_process` shell `powershell.exe` returned a live prompt (PID 30872) and
`Test-Path C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` -> `True`.

All three binding documents were read **in the dev tree**, and the working copies were proved
current the sound way (PREFLIGHT step 2, no piped hash):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
-> **EMPTY**, run *before* the fast-forward as well as implied by it after.

## WHAT I MEASURED

**[MEASURED] The dev tree was 1 commit behind and is now level.** `git merge --ff-only origin/main`
-> `Updating b0c61266..6437172c`, 2 files. Read-back: `head=6437172c originmain=6437172c`,
`git diff --cached --name-status` EMPTY, `git diff --name-status` EMPTY. 180 untracked files, one of
which is the finding below (F4).

**[MEASURED] `status-sweep.ps1` at 13:19:55Z — captured to a FILE, not read from the stream**
(`Start-Process -RedirectStandardOutput C:\po-sup-fix-scripts\sweep-1308.txt`, exit 0, 41 369 B),
because the script returns early and hides its own §7 verdict when read from the pipe.

| section | [LIVE] reading |
|---|---|
| 0 controls | `gh` reached GitHub (saw merged #1664); `node` runs |
| 1 board | **2 open**: `#1665` CLEAN 14/0/0 green · `#1662` CLEAN 14/0/0 green. main CI on `6437172c` 4 success / 0 failed — **trunk green** |
| 2 watcher | node **RUNNING pid 20000**, auto-restart wrapper **alive (1)**, heartbeat 54 min (ticks only mid-run; stale + empty queue = idle, NOT wedged) |
| 2 trees | watcher clone `branch=main dirty=4`; orphaned worktree `C:/po-vg` **dirty=1, age 1766 min** |
| 3 safe-to-act | 0 in-progress prompts · no `index.lock` in either tree · 0 git processes · no PR touched in 2 min |
| 4 queue | **armed 0** · needs-marco 24 · no-pr-opened 109 · failed 41 · blocked 120 |
| 7 verdict | **SAFE TO ACT** |

**[MEASURED] RULE 2 lane probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
and restricted to `pr-*.log` (never `*.log` — `rev-<N>-ready.md.log` are REVIEW JOBS and carry zero
lane information).**

| query | result |
|---|---|
| `PR #1665` in `pr-*.log` | **0** |
| `PR #1662` in `pr-*.log` | **0** |
| `PR #1664` in `pr-*.log` | **0** |
| POSITIVE control `PR #600` | **1** |
| NEGATIVE control `PR #999999` | **0** |
| `marco.:true` census over `processed\*.log` | **612** (regex form) |
| NEGATIVE census control `zzzNoSuchNeedleZzz` | **0** |
| newest processed log | `rev-1665-ready.md.log` **2026-09-05 12:27:01Z** — younger than the oldest open PR (11:45:57Z), which is the control that separates the live directory from the watcher clone's 17-day-stale decoy |

**`[NO LANE VERDICT — hand-classified]` for all three.**

**[MEASURED] Hand-classification by `classifyPolicyFiles`' own clauses — both open PRs carry a
`migrations/` path, which is refused before anything else is examined.**

| PR | created | head branch | decisive path | classification |
|---|---|---|---|---|
| `#1665` operational cost lines get a table and per-card CRUD | 12:18:59Z | `pr-scopecosts-s1-operational-cost-lines-api` | `apps/api/prisma/migrations/20260905020000_scope_operational_cost_lines/migration.sql` | **MARCO'S** |
| `#1662` retire the legacy plant-days path and drop its five columns | 11:45:57Z | `pr-plantdays-retire-and-drop` | `apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/migration.sql` | **MARCO'S** |

Both `labels: []`, both `autoMergeRequest: null`, both `author: GH-Mantova`, neither armed
(`armed: 0`, and `.arming-log.txt` unchanged since `2026-09-04T22:03:13Z`). **An empty label set is
not a clearance** — the watcher labels only prompts it builds, and it built neither of these.

**[MEASURED] `#1664` merged mid-cadence, and it left no signature.**
`mergedAt 2026-09-05T12:24:38Z`, `mergedBy GH-Mantova`, `labels []`. The 12:09Z run had written
*"`#1664` is Marco's; do not merge it"* fifteen minutes earlier.
`git ls-tree -r --name-only origin/main -- docs/decisions/merge-approvals/` returns **16 receipts +
README** (`1483 1510 1511 1512 1519 1520 1523 1536 1614 1615 1616 1619 1621 1646 1649 1651`);
NEGATIVE control on a nonexistent directory -> empty. **There is no `1664.md`.**

**[MEASURED] Station freshness — `check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.**
`00` 1.2 h (cadence 2 h) ok · `03` 14.4 h (24 h) ok · `04` 3.2 h (4 h) ok · `05` 23.2 h (24 h) ok ·
`02` dispatch-only. `structure: 3 checked, 0 malformed`. It also named the untracked breadcrumb
below by itself: `NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`.

## WHAT CHANGED

**On the board: nothing.** No merge, no auto-merge armed, no label applied or removed, no arm, no
branch update, no comment, no PR closed.

**In the dev tree:** fast-forwarded `b0c61266 -> 6437172c` (read back, above). Nothing else; the
index was empty before and after, and `docs/pipeline/sweep-rotation.json` was clean this run.

**In an isolated worktree off `origin/main`** (`C:\po-wt\board-1330`, branch
`board/00-collect-2026-09-05-1330`): three dispositioned breadcrumbs moved to
`docs/pr-prompts/archive/`, and this breadcrumb written. That is this run's board PR.

## FINDINGS

### F1 — `#1665` is a THIRD second-lane PR in one hour, and it carries a migration

Opened 12:18:59Z from `pr-scopecosts-s1-operational-cost-lines-api`, thirty-three minutes after
`#1662` and inside the same window that merged `#1664`. No watcher log names it, so no lane verdict
exists; hand-classified, its migration file refuses `classifyPolicyFiles` on that clause alone.
CI is green (14/0/0) and `mergeStateStatus: CLEAN` — **which is exactly the shape that makes this
dangerous: nothing on the PR shows that no gate has been applied to it.**

The migration is *additive* (a new table), which DOCTRINE §8.3 would allow to auto-merge after a
verified apitest **for a watcher-routed PR**. §10.1 step 2 governs this one instead, and it is
unambiguous: outside the three `NESTED_TEST_PATHS` forms, and carrying `migrations/`, it is Marco's.

**DISPOSITION: ESCALATED** — same file, same question as `#1662`/`#1664`:
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` and `#1635`.
**Do not merge `#1665`.** I did not, and no station should on the strength of green checks.

### F2 — `#1662` is unchanged: still open, still Marco's, still gated on a query never run in production

Re-verified live this run rather than quoted: still `-HOLD` on disk, still no arm, still no lane
verdict, `labels []`, CLEAN and green. The PR body's own caveat still stands — its five zero-row
counts are **dev-database** counts, and it asks Marco to confirm the same query in production before
merge. A destructive column drop is DOCTRINE §5.4 and §8.3 territory regardless of lane.

**DISPOSITION: ESCALATED.** Already filed at
`needs-marco/pr-1662-destructive-migration-open-on-the-board-2026-09-05.md`, which `status-sweep`
§5 confirms `[LIVE] … references #1662 = OPEN — genuinely open`. Nothing to add but the
re-verification. **Do not merge `#1662`.**

### F3 — `#1664` merged with no label, no receipt, and CP-26 never fired — the hole is upstream, measured again

`Approval receipt (CP-26)` fails `RELEASED_NO_RECEIPT` on a **released** PR — and "released" means a
label was removed. `#1664` never carried a label, so it was never released, so the required check
had nothing to assert, and a second-lane migration-free-but-out-of-policy PR reached `main` with no
human signature anywhere in the repo. That is precisely the already-escalated finding *"CP-26 is
armed by LABELLING, not by the DIFF"* — this is a fresh measured instance of it, fifteen minutes
after a station breadcrumb said the PR was Marco's.

**DISPOSITION: ESCALATED** — amendment to the existing item, not a new one. The RULE 1 option that
passes both halves is unchanged and is the one Marco has not yet ruled on: **(a) trigger CP-26 off
`classifyPolicyFiles` over the DIFF rather than off a label event**, so every PR outside the policy
set needs a signed receipt whether or not anyone ever labelled it. (b) *"ask the lane to label
first"* fails the future half — it is a convention, and a convention is not a gate.

### F4 — COLLECT: the 12:09Z blind run's breadcrumb was untracked; it is now swept and dispositioned

`00-00-supervisor-2026-09-05-1209-blind-run-collected-and-both-open-prs-hand-classify-to-marco.md`
sat untracked in the dev tree, exactly as it said it would. Read in full; its six findings are
re-dispositioned here, each against a probe I re-ran myself rather than against its sentences:

| its finding | my disposition |
|---|---|
| F1 blind at 12:08Z, sighted at 11:08Z | **DEFERRED** — this run was sighted, so the alternation continues and its own urgency trigger (two consecutive blind runs) has not fired |
| F2 `#1662` still Marco's, gate is dev-only | **ESCALATED** — carried into my F2, re-verified live |
| F3 `#1664` is second lane, do not merge | **ESCALATED** — overtaken by events; it merged 15 min later. Carried into my F3 |
| F4 never-retired-HOLD; do not arm two named prompts | **DEFERRED** — restated below, and now THREE named prompts |
| F5 `sot/04-data-model.md:906` after `#1662` merges | **DISPATCHED → 05** (re-dispatched below; 05's 14:10Z occurrence has not yet run) |
| F6 arming stays stopped | **DEFERRED** — trigger re-measured below, still fails |

**DISPOSITION: ACTIONED.** Committed into `docs/pr-prompts/archive/` in this run's board PR, with
the 11:08Z and 11:55Z breadcrumbs alongside it. Verification: `git diff --cached --name-status`
shows `A` for the 12:09Z file and `R100` for the other two. The untracked dev-tree copy must be
deleted only after this PR merges and its blob is proved identical — otherwise it blocks the next
fast-forward (00-supervisor.md, "AFTER YOUR BOARD PR MERGES").

### F5 — Arming stays stopped, and a third prompt joins the do-not-arm list

The standing trigger — *no commit on `origin/main` from a lane other than your own within the last
cadence, **and** open `pr-cardui-s*` at zero* — **still fails its first half**: the other lane merged
`#1664` at 12:24:38Z and opened `#1665` at 12:18:59Z, both inside this cadence. `armed: 0`;
`.arming-log.txt` newest row is still `2026-09-04T22:03:13Z ARMED pr-lint-gate-path-space`, now
15 h old. Every PR that reached `main` today did so without an arm.

🔴 **Do not arm, while its PR is open:** `pr-plantdays-retire-and-drop-HOLD.md` (`#1662`),
`pr-stages-s1-rollup-becomes-stage-aware-HOLD.md` (`#1664` — merged, but the HOLD was never
retired, so arming it re-does landed work), and
`pr-scopecosts-s1-operational-cost-lines-api-HOLD.md` (`#1665`). [MEASURED] all three are present in
the queue root as `-HOLD.md` right now, against `armed: 0` counted by hand
(`Get-ChildItem docs\pr-prompts -Filter *-ready.md` -> **0**). The general test
costs two seconds and catches the whole class: **before arming any prompt, check whether an open or
recently-merged head branch equals its slug.**

**DISPOSITION: DEFERRED** — starvation with a live, named cause, not blockage. The permanent fix (a
queue check that fails a prompt whose slug matches an open head branch) remains unstaged and belongs
with 06's queue-check work. **What would make it urgent:** the other lane going quiet for a full
cadence while the queue's 83 `-HOLD` prompts stay at zero armed.

### F6 — `C:\po-vg` holds one uncommitted file, and the watcher clone is not clean on main

`status-sweep` §2 [LIVE]: orphaned worktree `C:/po-vg` at `23c91ba9 [fix/no-rebase-while-checks-run]`,
**dirty=1, age 1766 min**; watcher clone `branch=main dirty=4`. `git worktree remove` will refuse and
`--force` would **discard** the uncommitted file. Neither is mine to touch: trees and clone hygiene
are Station 03's lane, and 00 doing 03's work is LL-38.

**DISPOSITION: DISPATCHED → 03 Machine-minder** (next occurrence 23:00Z). Handover: list
`git -C C:/po-vg status --porcelain` FIRST and preserve or commit the file before any prune; then
reconcile the four dirty paths in `C:\po-watcher\ProjectOperations`. This repeats a dispatch that
has not yet been consumed — 03's cadence has not come round since it was filed.

### F7 — `sot/04-data-model.md:906` still lists the five columns `#1662` would drop

Carried forward from the 12:09Z run's F5, unconsumed because 05's 14:10Z occurrence has not run yet.
`#1662` correctly refused to touch `/sot/` itself (CP-24 hard-blocks any PR mixing `sot/` with code).

**DISPOSITION: DISPATCHED → 05 SoT-keeper.** Burn down the five
`excavator_days` / `bobcat_days` / `ewp_days` / `hook_truck_days` / `semi_tipper_days` entries at
`sot/04-data-model.md` line 906 **only after `#1662` merges** — doing it first makes `/sot/` describe
a schema that still has the columns. Doc-reconcile PR, per CP-24.

## WHAT I DID NOT DO

- **I did not merge, auto-merge, label, unlabel, update or comment on `#1662` or `#1665`.** Both
  hand-classify to Marco under §10.1 step 2 on their `migrations/` clause. Green checks and a CLEAN
  merge state are not a lane verdict.
- **I did not arm anything** (F5), and did not touch the three named do-not-arm prompts.
- **I did not clear or reinterpret the `[STALE]` lines in `status-sweep` §5.** The dead-escalation
  burn-down in `needs-marco/` is 03's dispatched clean-up; `needs-marco/` is gitignored, so nothing
  in it can be cleared from a board PR anyway.
- **I did not touch `C:\po-vg`, the watcher clone, or any worktree but my own disposable one** (F6).
- **I did not restart the watcher.** pid 20000 running, wrapper alive, `armed: 0` — an idle watcher
  with an empty queue is CORRECT, not wedged, and `restart-watcher-if-wedged.ps1 -Fix` acts only on
  WEDGED/DOWN.
- **I did not touch `/sot/`, Azure / Entra / SharePoint, or production data**, and did not run the
  `#1662` row-count query anywhere.
- **I did not edit the project-memory index.** It is at its measured read limit and carries the
  `$`-in-replacement corruption trap; board state belongs here, where it expires.
- **I did not write a `docs/decisions/merge-approvals/*.md` receipt.** No agent may author one.

## HANDOVER

- **Marco — three PRs in one hour arrived through a path with no gate on it, and one of them has
  already merged.** `#1662` (destructive: drops five columns, zero-count gate never run against
  production) and `#1665` (additive migration + new API surface) are both open, both green, both
  yours. `#1664` merged at 12:24:38Z with no label and no receipt. The ruling still wanted is F3(a):
  **arm CP-26 off the DIFF (`classifyPolicyFiles`) instead of off a label event**, so an unlabelled
  out-of-policy PR cannot reach `main` without a signed receipt.
- **Station 03 (23:00Z):** F6 — `C:\po-vg` (preserve the file first) and the 4 dirty paths in the
  watcher clone.
- **Station 05 (14:10Z):** F7 — `sot/04-data-model.md:906`, **after** `#1662` merges, not before.
- **The next 00 run:** once this PR merges, prove the dev-tree copy of the 12:09Z breadcrumb is
  byte-identical to its committed blob (`git rev-parse origin/main:<path>` vs `git hash-object <path>`,
  never a piped hash) and delete it, then fast-forward and read back all three of
  `rev-list --left-right --count` = `0 0`, `diff --numstat` EMPTY, `diff --cached --name-status` EMPTY.
  Re-run the lane probes yourself before believing any line above.
