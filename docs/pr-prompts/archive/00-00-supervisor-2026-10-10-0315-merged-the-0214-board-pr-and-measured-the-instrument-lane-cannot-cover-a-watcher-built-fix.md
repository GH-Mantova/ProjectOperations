# Station 00 — Supervisor | 2026-10-10T03:14Z–2026-10-10T03:35Z

## GROUND

```
UTC            2026-10-10 03:14 UTC
origin/main    1dfb705b  at run start  →  00726081  after I merged #2302
dev tree       main @ 00726081          C:\ProjectOperations2   (fast-forwarded this run)
doc version    1                        (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      1                        (station_doc_version: 1 in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE (1 == 1). Run proceeded at full authority.

## WHAT I MEASURED

**Reachability — NOT blind this run.**
- [MEASURED] keyword `ToolSearch` for `desktop-commander` resolved the toolkit under the
  `mcp__plugin_desktop-commander_desktop-commander__*` prefix. The first search returned
  "No matching deferred tools found. Some MCP servers are still connecting" — a **connecting
  server, not an unreachable machine**; a second search seconds later returned the full toolkit.
  Declaring blindness on that first answer would have been a §7 instrument lie.
- [MEASURED] `start_process` shell `powershell.exe` → `Process started with PID 49056`, printing
  `HOSTOK` and `2026-10-10T03:14:28Z`. No CONNECT_TIMEOUT, no retry needed.

**Git guard — exit 2, INSTALLED BUT INERT (the expected station outcome).**
- [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → **exit 2**.
  Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
  your shell.` Last line, verbatim:
  `   PATH="/sessions/kind-wizardly-goldberg/.local/bin:$PATH" git <args>`
  Controls it printed: `bash -lc 'command -v git'` → the shim;
  `bash -c 'command -v git'` → `/usr/bin/git`.
  A FINDING, not a stop. **No `git` ran through the device bridge against the mount at any point**
  — every git call in this run went through the Windows-host PowerShell shell.

**Binding reads — all from `origin/main`, in the dev tree.**
- [MEASURED] `git -C C:\ProjectOperations2 show origin/main:docs/pipeline/stations/00-supervisor.md`,
  `:docs/pipeline/DOCTRINE.md` — both read in full. `:docs/pipeline/STATION-CAPABILITIES.md` read
  §2, §5 and its heading index in full from a dump of the same `git show` (52 KB; the §5 authority
  matrix, the two merge gates and CP26_ARMED_BY_DIFF_V1 receipt forms are the parts that bind this
  run's actions).
- No piped `git show … | git hash-object --stdin` comparison was made anywhere (DOCTRINE §9.2 —
  unsound in `powershell.exe`).

**Board state — `scripts/pipeline/status-sweep.ps1`, generated 2026-10-10 03:15:23Z.**
- [MEASURED] §0 positive controls both pass: `gh CAN reach GitHub (saw merged PR #2301)`,
  `node runs`.
- [MEASURED] `OPEN PRs: 3` — **#2303** BLOCKED (14 pass / 1 fail), **#2302** CLEAN (10/0/0 green),
  **#2294** BEHIND (13 pass / 2 fail, `do-not-merge`, open 7h).
- [MEASURED] `WAITING ON MARCO: 1 open PR(s) labelled do-not-merge; oldest #2294, open 7h`.
  `ALL OPEN (non-draft): 3`. **MARCO_QUEUE_LINE_V1: both figures copied here; I armed nothing this
  run, so neither figure moved by my hand. #2303 gains the label below, which takes the
  WAITING ON MARCO count to 2 at the next sweep.**
- [MEASURED] `main CI on 1dfb705b: 4 success / 0 failed / 0 running (trunk green)`.
- [MEASURED] `watcher node: RUNNING pid 16148`, `heartbeat age: 0 min`,
  `watcher clone: branch=main tracked-dirty=0 untracked=3`.
- [MEASURED] `auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1).
  WRAPPER_COUNT_ANOMALY_V1` — pids 2068 (started 10-08 07:28 local) and 35512 (10-10 11:35 local).
- [MEASURED] `non-main worktrees found: 33`, several holding commits on no remote branch and two
  holding uncommitted work (`C:/po-worktrees/sup-cwd-paths`, dirty=2, age 22780 min).
- [CANNOT MEASURE] the sweep's sections 3–7 in this run's transcript: section 5 crawls every PR
  one at a time and the run was still emitting worktree rows when I moved on. **#2294 — the
  dedupe-and-fast-switch fix that removes exactly this cost — is the PR Marco has not released.**
  I measured the queue, freshness and escalation facts directly instead, below, rather than
  quote a section I did not see.

**Queue — measured directly.**
- [MEASURED] loose armed files in `docs/pr-prompts/`:
  `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-ready.md`, `rev-2302-ready.md`, `rev-2303-ready.md`.
  The two `rev-*` are auto-generated review jobs, not prompts (DOCTRINE §9.5).
- [MEASURED] the one real armed prompt is **consumed**: its PR is **#2303**, open since 02:5xZ.

**Collection — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.**
- [MEASURED] `structure: 2 checked, 0 malformed, 0 skipped`.
- [MEASURED] freshness: `00 last 02:14Z 1.0h ago ok` · `02 dispatch-only` ·
  `03 last 2026-10-09T23:03Z 4.2h ago ok` · `04 last 02:10Z 1.1h ago ok` ·
  `05 last 2026-10-09T14:22Z 12.9h ago ok`. **No station MISSED, so no MISSED classification was
  required this run.**
- [MEASURED] the two breadcrumbs it checked are the 0214 supervisor run and
  `00-04-scanner-2026-10-10-0210-instruction-drift.md`. Both were already committed on #2302 by
  the 0214 run; the scanner file read UNTRACKED in the dev tree only because that PR had not
  merged yet. It has now.

## WHAT CHANGED

**1. #2302 MERGED.** [MEASURED] via `pipeline-lib` only:
`Enter-BoardLease -Actor 'station-00.scheduled'` → `True`; `Assert-SmokedOrEscalate -PR 2302` →
`True`; `Merge-Pr -PR 2302 -Actor 'station-00.scheduled'` → `State : MERGED`.
Readback: `gh pr view 2302 --json state,mergedAt,mergeCommit` →
`state=MERGED mergedAt=2026-10-10T03:17:55Z commit=007260813e9fe5f9512c207f2d40d074deb459ae`,
and `git rev-parse --short origin/main` → `00726081`.
`-Actor` was passed explicitly on both calls, per the 2026-10-09 #2279 measurement that an unset
`-Actor` makes a station's own lease refuse it as "another lane".
Files: 7, **every one under `docs/`** — CP-26 `Approval receipt` passed on the head without a
receipt, so no receipt was required or written.

**2. The dev tree fast-forwarded `1dfb705b → 00726081`.** Three paths blocked
`git merge --ff-only` and were cleared with raw-Buffer node writes — never `git checkout --`,
never `git clean`:
- `docs/pr-prompts/00-04-scanner-2026-10-10-0210-instruction-drift.md` — untracked locally at a
  path the FF had to create. Proved byte-identical to `origin/main`'s copy first
  (`local bytes=14951 originmain bytes=14951 identical=true`), then removed.
- `docs/pipeline/sweep-rotation.json` and
  `docs/pr-prompts/needs-marco/stations-00-03-05-…-2026-10-06.md` — restored from **HEAD**, not
  from `origin/main` (see F2).
Readback, all four controls: `git rev-list --left-right --count HEAD...origin/main` → `0 0`;
`git diff --numstat origin/main` → EMPTY; `git diff --cached --name-status` → EMPTY;
`git status --porcelain --untracked-files=no` → EMPTY.

**3. `do-not-merge` applied to #2303**, so Marco's queue counts it (see F1). No label was removed
from anything, and no watcher-routed PR was merged.

**4. This breadcrumb and one escalation file**, committed inside this run's own PR worktree
(`C:\po-wt\st00-0315`, branch `docs/board-0315-collect`) — not in the dev tree, so it plants no
fast-forward blocker for the next run.

**5. The two collected breadcrumbs archived** to `docs/pr-prompts/archive/` in the same PR, every
finding in them dispositioned below.

## FINDINGS

### F1 — INSTRUMENT_LANE_V1 cannot cover a watcher-built instrument fix, because the watcher's own prompt retirement is on the never-list

[MEASURED] `node scripts/pipeline/check-instrument-lane.mjs --range 1dfb705b...origin/pr-2303`:

```
controls: positive(in-lane path classifies as in-lane)=true  negative(out-of-lane path classifies as out-of-lane)=true
1 path(s) are outside the instrument lane:
  OUT_OF_LANE: docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md
2 path(s) are in the instrument lane:
  IN_LANE: scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs
  IN_LANE: scripts/pipeline/lint-prompt.mjs
INSTRUMENT_LANE: OUT_OF_LANE
```

[MEASURED] the only failing check on #2303 is CP-26, and its log names the cause exactly:
`FAIL - CP-26 approval-receipt [RECEIPT_REQUIRED_BY_DIFF] PR #2303 touches files that require an
approval receipt (outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs), but
docs/decisions/merge-approvals/2303.md is not in this PR's diff`.

So the code change itself is squarely in the lane — `lint-prompt.mjs` is the **third entry** in
`instrument-lane.json`'s `files`, and the test matches its `tests` glob. What pushes the PR out is
the *third* file: the watcher moved the consumed prompt to `docs/pr-prompts/superseded/`, and
`instrument-lane.json`'s never-list carries **"Everything under `docs/`"**. `standing-lanes.json`
defines the `instrument` lane as *"every diff path apart from the receipt is in
instrument-lane.json"*, so one docs path is enough.

[INFERRED, from those two files' own text] this is not specific to #2303: **every** instrument fix
the watcher builds from a prompt retires that prompt under `docs/pr-prompts/`, so every such PR is
OUT_OF_LANE by construction. The lane can only ever fire for a PR authored without a prompt — which
DOCTRINE §10.3 tells stations to prefer *against*. The 0214 run predicted this before the PR
existed ("its PR will need Marco because the prompt's own retirement path is on the never-list");
this run has the lane checker's own verdict for it.

**DISPOSITION: ESCALATED.** Filed at
`docs/pr-prompts/needs-marco/instrument-lane-cannot-cover-a-watcher-built-fix-2026-10-10.md`, with
the two options and which half of RULE 1 each fails. #2303 is labelled `do-not-merge` and stays for
Marco; I did not write a receipt of either kind for it (`authority: standing` is not available
outside a lane, and `authority: personal` would require Marco's own release).

### F2 — a raw-Buffer write of a blob reads as MODIFIED in this repo, and the CRLF fallback is what clears the fast-forward

[MEASURED] both blocking tracked files hold **pure LF** on `HEAD`
(`sweep-rotation.json: blob bytes=3838 lf=28 crlf=0 mixed=false`;
`stations-00-03-05-…md: blob bytes=20153 lf=338 crlf=0 mixed=false`), and the dev tree checks them
out **CRLF**. `git` said so itself:
`warning: in the working copy of 'docs/pipeline/sweep-rotation.json', LF will be replaced by CRLF
the next time Git touches it`.

So the station doc's **first** cure — `fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`
— writes LF into a CRLF working tree and the path still reads ` M`, and `ff-only` still refuses:
`error: Your local changes to the following files would be overwritten by merge`. Two FF attempts
failed that way before the fallback branch cleared it. Writing the same blob **with CRLF endings**
took `git status --porcelain --untracked-files=no` to EMPTY in one call, and the FF then ran clean.

A second trap sits next to it, and it is the one that cost the first attempt: I first wrote those
two files from **`origin/main`**, reasoning that the FF's destination is what the tree should hold.
That is wrong — `git status` compares the worktree to the **INDEX**, which still holds `HEAD`, so
writing the destination content makes the path *more* modified, not less. The restore source must
be `HEAD`; the FF moves index and worktree to `origin/main` together.

**DISPOSITION: DEFERRED.** Real, reproduced twice this run, and a documentation fix rather than a
code one: `00-supervisor.md`'s §POST-MERGE-FF-CURE pointer already lists "both EOL branches as
fallbacks", so the doc is not wrong — it is ordered wrong for this repo, where the CRLF branch is
the one that works and the raw-Buffer branch never does for a text file. What would make it urgent:
a third run spending attempts on the same ordering. The complete-and-additive fix (RULE 1) is to
make the cure a script — one `scripts/pipeline/ff-dev-tree.ps1` that measures the attribute,
picks the branch, and reads back all four controls — rather than prose each station re-derives;
I did not stage that prompt, see WHAT I DID NOT DO.

### F3 — 04's F1 (git guard INSTALLED BUT INERT), independently reproduced

[MEASURED] 04 recorded exit 2 at 02:1xZ on session path `/sessions/laughing-wonderful-gauss`; I
recorded exit 2 at 03:14Z on `/sessions/kind-wizardly-goldberg`. Same headline, same controls, a
different session — so this is the standing station condition the three-outcome table documents,
not a per-session accident.

**DISPOSITION: DEFERRED**, unchanged from 04's own disposition. The cure is how a station's shell
is invoked (a login shell, or an installer target a non-login shell sources), which is 03's or
Marco's call. What would make it urgent: a run that actually needs git against the mount, or a
fresh 0-byte `index.lock` with no owning process in a sweep. Neither happened: `git index.lock
interactive/clone: False / False` at 02:1xZ, and no lock appeared in my 03:15Z sweep either.

### F4 — 04's F2 (station 03's bootstrap says 4h, its cron says daily)

Already open with Marco at
`docs/pr-prompts/needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`,
and 04 re-verified its central claim against the live MCP this cycle rather than re-filing it.

**DISPOSITION: DEFERRED.** Marco's to rule on. I did not re-measure the MCP cadence myself — 04's
reading is 65 minutes old and its own §7.1 re-read is recorded — and I did not duplicate the file
(§10.5). What would make it urgent: 03 reasoning about heartbeat age from the 4-hour figure and
calling a healthy machine wedged.

### F5 — 04's F3 (a spent escalation still filed as live) is ALREADY RETIRED

[MEASURED] the 0214 run retired it before I ran: `docs/pipeline/discharges/2026-10-10-0226Z-stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`
and `docs/pr-prompts/needs-marco/discharged/stations-00-03-05-…-2026-10-06.md` are both on
`origin/main` as of `00726081`, which I merged this run. Nothing was deleted; the file moved.

**DISPOSITION: ACTIONED** (by the 0214 run, verified by me on `origin/main` and by the rename
appearing in this run's fast-forward output:
`rename docs/pr-prompts/needs-marco/{ => discharged}/stations-00-03-05-…md (100%)`).

### F6 — 04's F4 (2 auto-restart wrappers, 33 worktrees, 3 registry escapees) is still live

[MEASURED] re-measured at 03:15:23Z, not quoted from 04: `auto-restart wrapper: ANOMALY -- 2
wrappers alive (expected 1)`, pids **2068 and 35512 — the same two pids 04 saw**, so neither has
turned over in 65 minutes. 33 non-main worktrees, several holding commits on no remote branch,
two holding uncommitted work. Watcher node RUNNING pid 16148, heartbeat 0 min — **idle, not
wedged**, and nothing here says otherwise.

**DISPOSITION: DISPATCHED to Station 03.** Machine repair is 03's lane (§5 authority matrix: 00
dispatches, does not repair). 03: re-measure before acting — a wrapper count and a worktree's
dirtiness both expire — and note that `C:/po-worktrees/sup-cwd-paths` holds **4 commits on no
remote branch and 2 uncommitted files**, so `git worktree remove` will refuse it and `--force`
would discard real work. 03's next occurrence is its daily cron.

### F7 — #2294 is unchanged and is still the one biggest blocker

[MEASURED] `#2294 OPEN BEHIND head=fix/sweep-section5-dedupe-and-fast-switch@191a6e2a
labels=do-not-merge`, CI 13 pass / 2 fail, open 7h. It is the fix that makes the sweep's section 5
cheap — and this run is the third consecutive one to pay the cost it removes (my sweep never
reached section 5).

**DISPOSITION: ESCALATED**, carried forward from the 0114 and 0214 runs rather than re-filed: it
carries `do-not-merge`, and **only Marco removes that label**. I did not call
`gh pr update-branch` on it — the watcher's auto-update timer is OFF and a stray update-branch
costs a full CI rebuild on a PR nobody can merge.

## WHAT I DID NOT DO

- **Did not arm anything.** The one armed prompt is consumed into #2303, and no `-HOLD.md` is
  admissible while that PR is open — which is precisely the defect #2303 fixes. Arming a second
  prompt would also have added to a Marco queue I was about to grow by one with the #2303 label.
- **Did not stage the `ff-dev-tree.ps1` prompt F2 argues for.** It touches
  `scripts/pipeline/**`, so its PR would land OUT_OF_LANE for the same reason F1 names, and I
  would be arming work that can only queue behind Marco while the lane question is open in front
  of him. It belongs in the same decision.
- **Did not write a receipt for #2303** of either authority. Out of lane means `standing` is not
  available; `personal` requires Marco's own release, and inventing one would forge his approval.
- **Did not merge #2303 or #2294**, did not remove any label, and merged no watcher-routed PR.
- **Did not clear a lock, prune a worktree, or kill a wrapper** — 03's lane, dispatched at F6. No
  lock existed to judge.
- **Did not re-run a red check hoping for green** on #2303: its red is a diagnosis
  (RECEIPT_REQUIRED_BY_DIFF), not a flake.
- **Did not touch `/sot/`** — that is 05's alone.
- **Did not go near Azure, Entra or SharePoint.** Nothing this run approached them.
- **Did not run `git` through the device bridge against the mount**, the guard being inert (F3).
- **Did not quote sections 3–7 of my own status sweep**, having not seen them render.

## FOR MARCO

**One decision, and it is in front of the pipeline's own repair lane.**

INSTRUMENT_LANE_V1 was meant to let Station 00 merge instrument fixes without you. [MEASURED] it
cannot fire for any fix the watcher builds, because the watcher retires the prompt under
`docs/pr-prompts/` and "everything under `docs/`" is on the lane's never-list. #2303 — green but
for CP-26, three files, two of them in the lane — is the first to demonstrate it.

**RULE 1, complete-and-additive first:**

1. **Exempt the prompt-retirement paths from the lane boundary** — teach
   `check-instrument-lane.mjs` that a move under `docs/pr-prompts/` to `superseded/`, `merged/` or
   `archive/` is queue bookkeeping, not a docs change. Complete: it fixes every future
   watcher-built instrument PR, not just this one. Additive: it narrows nothing, deletes nothing,
   and every other never-list entry — `pipeline-lib.ps1`, `pr-gates/`, `.github/`, `sot/`,
   `apps/`, `prisma/` — keeps its veto. The whole of `docs/` other than that bookkeeping stays
   yours.
2. **Release #2303 by hand and leave the lane as it is.** Fails the *future* half of RULE 1: the
   next instrument fix arrives in exactly the same state, and the lane stays a rule that has never
   once fired. Damages no data.
3. **Retire INSTRUMENT_LANE_V1 as unreachable.** Also fails the future half, and loses the
   capability you asked for on 2026-10-03 rather than fixing it.

I recommend 1, with 2 alongside it for #2303 today. Either way #2303 needs you: it now carries
`do-not-merge`, so it shows on the sweep's WAITING ON MARCO line next to #2294.

**Still waiting, unchanged:** #2294 (`do-not-merge`, 7h) — the sweep section-5 fix. Three
consecutive supervisor runs have now paid the cost it removes.
