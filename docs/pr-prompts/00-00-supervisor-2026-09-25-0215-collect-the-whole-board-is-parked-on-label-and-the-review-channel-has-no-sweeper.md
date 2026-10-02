# Station 00 — Supervisor | 2026-09-25T02:14:42Z–02:5xZ

## GROUND

```
UTC            2026-09-25T02:14:42Z
origin/main    5045e81d              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 1e5f3f11       C:\ProjectOperations2   (0 ahead, 2 behind)
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run is read-write, not read-only.

Tree read in: the **dev tree** `C:\ProjectOperations2`, per PREFLIGHT step 2's "never the watcher
clone" rule. All three binding documents were verified identical to `origin/main` before being read
from the working copy — `git diff --numstat origin/main -- <path>` returned **EMPTY** for
`DOCTRINE.md`, `STATION-CAPABILITIES.md` and `stations/00-supervisor.md`, which is the sound form
(never a piped hash — PREFLIGHT step 2). So the 2-commit lag does not touch what I was bound by.

## WHAT I MEASURED

**1. Reachability — SIGHTED.** [MEASURED] `start_process` shell `powershell.exe` returned
`SHELL-OK` and `2026-09-25T02:14:42.0695551Z` on the first call. Desktop Commander tool ids were
loaded by keyword `ToolSearch` first and were **not** the ids a literal `select:` list would have
named (`mcp__plugin_desktop-commander_desktop-commander__*`), which is the environment-specific
prefix PREFLIGHT step 1 warns about.

**2. Device-bridge git guard — EXIT 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself and not from a pipeline appended to it: **`GUARD_EXIT=2`**. Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/eager-clever-bohr/.local/bin:$PATH" git <args>
```

Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` This is the EXPECTED station outcome, a finding and not a stop. No `git` was run
against the mount at any point this run; every `git` and `gh` call went through the Windows shell.

**3. Freshness — CLEAN, exit 0, and three of its four NOTEs are WRONG.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 4 checked, 0 malformed`,
`CLEAN`, `FRESHNESS_EXIT=0`; every station `ok` (00 0.3h/1h · 03 2.9h/24h · 04 0.1h/4h ·
05 11.9h/24h). It printed `is UNTRACKED — it reaches nobody` for four breadcrumbs. See F2.

**4. Sweep — SAFE TO ACT.** `bring-up-to-speed.ps1`, `SWEEP COMPLETE 2026-09-25 02:15:19Z`.
Reported only from its `[LIVE]` lines. Section 7 verdict, verbatim: `SAFE TO ACT: no board mutation
in progress, no recent remote activity, no live station worktrees.` Supporting `[LIVE]` lines:
`git index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`,
`no PR touched on GitHub in the last 2 min`, `armed (*-ready.md): 0`, `watcher node: RUNNING pid
42212`, `heartbeat age: 17 min`, `main CI on 5045e81d: 4 success / 0 failed (trunk green)`.
Section 5 printed **no `[STALE]` rows** this run — three `[FILE]` rows on
`verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`, which section 5 itself says it
**CANNOT decide**, so they are not mine to discharge on the tag.

**5. The board — five PRs, ten reds, ONE cause, read from the VERDICT TOKEN.** DOCTRINE §9.4
requires the CP-26 token, never the pass/fail counts. [MEASURED] for each of the five, by resolving
the failing `Approval receipt (CP-26)` check's run and job id out of `gh pr checks --json link`,
then splitting each log line on the TAB and reading the **last** column (§9.1 — column 1 is the job
name, so grepping the whole line matches every line):

| PR | labels | mergeState | CP-26 verdict token |
|---|---|---|---|
| `#2189` | `do-not-merge` | BLOCKED | **`[LABEL_PRESENT]`** |
| `#2184` | `do-not-merge` | BLOCKED | **`[LABEL_PRESENT]`** |
| `#2183` | `do-not-merge` | BLOCKED | **`[LABEL_PRESENT]`** |
| `#2167` | `do-not-merge` | BLOCKED | **`[LABEL_PRESENT]`** |
| `#2158` | `do-not-merge` | BLOCKED | **`[LABEL_PRESENT]`** |

NEGATIVE control, a freshly minted needle over the same log bodies → **0** on all five. The verdict
line, verbatim from `#2158`: `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the
do-not-merge label (escalates:true). A human must review and REMOVE the label; removing it is what
releases the merge.` The `PR gates — diff checks` job carries the same verdict as its own step —
`#2158`'s gate transcript reads `ALLOWED - CP-11 migrations`, `PASS` on CP-12/13/17/23/24/25,
`SKIP` on CP-09/10/22/27, and **`FAIL - CP-26 do-not-merge`** as the only failure. So the "2 fail"
on every PR is one check counted twice, exactly as §9.4 records.

**6. Ten of the fifteen checks are not merely non-failing, they are GREEN.** `#2184`, `#2183`,
`#2167`, `#2158` each read 13 pass / 2 fail / 0 pending; `#2189` reads 12 / 2 / 1.

**7. `-ready.md` tracked at DEPTH 1 on `origin/main` — the board trap — is ZERO.**
`git ls-tree --name-only origin/main -- docs/pr-prompts/` (no `-r`, deliberately one level, §9.2)
filtered to `-ready.md$` → **0**; POSITIVE control, the same listing unfiltered → **34** entries;
NEGATIVE control, a minted needle → **0**.

**8. `.arming-log.txt` and `sweep-rotation.json` need no sweep.**
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **EMPTY**, and both sides are
**158** lines ending on the identical row `2026-09-25T01:29:14Z ARMED
pr-watcher-adopt-ancestry-and-watchdog-identity … actor=station-00.sched0114`. The dev tree's ` M`
on that path is §9.2's behind-HEAD reading, not local work. `sweep-rotation.json` is CLEAN at
`last_index: 2`, `last_run_utc 2026-09-24T18:18:23Z` — Station 04's blind run correctly did not
advance it.

**9. The spent HOLD is still on `main`.**
`git diff --numstat origin/main -- docs/pr-prompts/pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md`
→ **`0  111`**, i.e. present on `origin/main`, absent from the working tree. The 01:14Z run armed
it (`git mv` to `-ready.md`), the watcher consumed the ready file and opened `#2189` — whose title,
*"feat(watcher): adopt proves ancestry, WATCHDOG carries PID, sweep flags 2+ wrappers"*, is Station
03's F2+F3+F4 built. The HOLD is spent and its retirement had not landed.

**10. The orphaned worktree the sweep flags as holding uncommitted work holds NOTHING unlanded.**
The sweep's own `[LIVE]` line asks for preservation: `C:/po-worktrees/sup-cwd-paths … dirty=2
files age=1120 min … HOLDS UNCOMMITTED WORK (2 file(s)). PRESERVE OR COMMIT BEFORE PRUNING`.
[MEASURED] this run:

| probe | result |
|---|---|
| `git -C C:/po-worktrees/sup-cwd-paths status --porcelain` | ` M docs/data-model/metadata-catalog.json` · `?? pr-body.md` |
| `git log --oneline origin/main..HEAD` there | **4** commits, head `66ac4dcd` |
| `gh pr list --head fix/pipeline-scripts-resolve-state-paths-from-module --state all` | **PR 2154 MERGED** |
| that work on `main` | `a422970f fix(pipeline): resolve four pipeline scripts' state paths from the module, not the cwd (#2154)` |
| `git ls-remote --heads origin <that branch>` | **EMPTY** — the head branch was deleted on merge |
| the one breadcrumb its `da1bba86` commit adds | **on `origin/main`** at `docs/pr-prompts/archive/00-00-supervisor-2026-09-24-0714-built-04s-dispatched-cwd-repair-and-found-seven-constants-not-five.md` |

So the "4 unpushed commits" are the **pre-squash history of a merged PR**, and the one artifact
among them is already tracked. The ` M` is the `metadata-catalog.json` CRLF smudge this station
doc's newest correction names by file. Nothing there is stranded.

**11. `docs/pr-reviews/` is NOT gitignored, and 14 verdicts have never reached `main`.**
`git check-ignore -v docs/pr-reviews/pr-2180-review.md` → **exit 1, empty output** (read from
`$LASTEXITCODE` on the following line, never from a `cmd /c "… & echo %ERRORLEVEL%"` chain —
§9.1); POSITIVE control, `docs/qa/qa-findings.md` through the same form → exit 0 naming its rule.
`git ls-tree -r --name-only origin/main -- docs/pr-reviews/` → **171** tracked, newest
**`pr-2114-review.md`**. The dev tree holds 14 untracked `pr-<n>-review.md` for `#2119`–`#2180`,
none of them on `origin/main`. THREE HOMES were probed before landing any of them (§9.5): the
watcher clone holds **0** of the 14 (POSITIVE control — that directory holds 176 review files),
`C:\po-watcher\verdicts-archive\` holds **1** of the 14 (POSITIVE control — 845 files there), and
that one, `pr-2164-review.md`, is **NEWER and LARGER** in the archive (4568 B, 20:57:27Z) than in
the dev tree (3288 B, 12:55:23Z), so the archive copy is the one I took.

## WHAT CHANGED

One board PR, **entirely under `docs/`** — no code, no `sot/`, so CP-24 is not engaged and the diff
sits inside both `^(tests|docs)/` and Station 00's own recorded lane (`STATION-CAPABILITIES.md` §5).
All work was done in an **isolated worktree off `origin/main`** at `C:\po-wt\sup-0215`
(`5045e81d`, `git status --porcelain` → **0 lines** at creation), never in the dev tree and never
in the watcher clone. **This breadcrumb was written inside that worktree** — Cure 1 — so no loose
untracked copy is left in the dev tree to block the next fast-forward.

1. **Collected Station 04's 0211Z breadcrumb** — the only genuinely unreported one (F2). Copied
   with a raw-Buffer node write, `src=13433 dst=13433 byteExact=true`, never re-typed.
2. **Published 14 review verdicts** (`#2119`–`#2180`), all 15 copies verified `byteExact=true`,
   with `pr-2164-review.md` taken from `verdicts-archive` as the newest of its three homes.
3. **Retired the spent HOLD** `pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md`
   (`git rm`, staged `D`) — consumed by the 01:29:14Z arm that produced `#2189`.
4. **Archived two breadcrumbs** whose every finding carries a disposition — the 0114Z and 0155Z
   runs (`git mv`, both staged **`R100`**).
5. **Staged** `pr-sweep-collects-review-verdicts-HOLD.md` for F3. `lint-prompt.mjs` → **ADMIT
   (size 2), exit 0**, after one REJECT/repair cycle (`MISSING_STANDING_AUTHORITY`). Premise
   control: the marker `SWEEP_COLLECTS_REVIEW_VERDICTS_V1` occurs **0** times in
   `sweep-breadcrumbs.ps1` today, POSITIVE control `docs/pr-prompts` in the same file → **5**.
   **Staged, NOT armed** — see WHAT I DID NOT DO.
6. **Widened the blindness escalation** in the dev tree's `needs-marco/` (F4) with a dated section
   recording that the defect is pipeline-wide rather than Station-00-only. That folder is
   gitignored by rule and that file is **not** among the 10 tracked there, so the append reaches
   nobody on its own — which is why this breadcrumb states its content.

**Nothing was merged, nothing was armed, no label was touched, no process was killed or restarted,
no worktree was pruned, and no `git` ran against the mount.**

## FINDINGS

### F1 — The whole open board is parked on `do-not-merge`, and this run is the first to prove it from the VERDICT TOKEN rather than from the red counts.

All five open PRs carry the label; all five CP-26 verdicts read **`[LABEL_PRESENT]`**; none reads
`[RELEASED_NO_RECEIPT]`, which is the token that WOULD be a real finding. Ten reds on the board,
one cause, and §9.4 states the disposition for that token in as many words: *"only Marco removes
the label, so a run that meets `[LABEL_PRESENT]` has finished: there is no agent-side action behind
it."* Thirteen of fifteen checks pass on four of the five.

**There is no red on this board an agent can fix**, and the throughput constraint is the label, not
the queue. The channel already exists —
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` and
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`, the
latter citing `#2167` and `#2158` by number — plus
`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.
Re-filing would be noise.

**What is genuinely added this run:** the three predecessor runs at 00:14Z, 01:14Z and 01:55Z each
read this board from the pass/fail COUNTS and spent themselves diagnosing the e2e suite behind
them. Read from the token, four of the five were never diagnosable work at all.

**What would make it urgent:** a CP-26 verdict reading `[RELEASED_NO_RECEIPT]` — a released PR with
no receipt, which IS a finding and IS mine — or the open count climbing while every PR stays
labelled.

**DISPOSITION: DEFERRED**

### F2 — `check-breadcrumb.mjs` called four breadcrumbs UNTRACKED and three of them were landed and archived hours ago; the cure for this is written down and it is the dev tree that defeats it.

The validator printed `is UNTRACKED — it reaches nobody until a board PR commits it` for the 2315Z,
0014Z, 2320Z and 0211Z breadcrumbs. [MEASURED] against `origin/main` rather than against the dev
tree's index — `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`, trailing slash AND
`-r` (§9.2), matched by basename, which is the same set the validator itself builds:

| breadcrumb | validator says | `origin/main` says |
|---|---|---|
| `00-00-supervisor-…-2315-blind-…` | UNTRACKED | **`archive/`** |
| `00-00-supervisor-…-0014-collect-…` | UNTRACKED | **`archive/`** |
| `00-03-machine-minder-…-2320-…` | UNTRACKED | **`archive/`** |
| `00-04-scanner-…-0211-blind-…` | UNTRACKED | **NOT ON ORIGIN/MAIN** — genuinely unreported |

The cause is `TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`, already in this station doc: the dev tree
is 2 behind, the validator builds its tracked set from that tree, and three files landed in `#2187`
and `#2188` after the dev tree's HEAD. **The available wrong action is the one that correction
exists to prevent** — committing a SECOND tracked copy of three breadcrumbs at the root path, which
is the 2026-09-07 duplication. I landed **one** file, not four.

**DISPOSITION: ACTIONED** — verified by asking `origin/main` explicitly before committing anything,
and only 04's breadcrumb is in this PR.

### F3 — The reviewer-verdict channel has no sweeper, and this is the THIRD hand-backfill of the same backlog. NEW — not on file anywhere.

`00-supervisor.md` PHASE 1b names `docs/pr-reviews/*.md` as a source every collect run must read.
The directory is tracked (171 files on `origin/main`) and **not** gitignored (measurement 11, with
both controls). But `scripts/pipeline/sweep-breadcrumbs.ps1` — the one job that exists to batch
agent-written artifacts out of the shared dev tree, because NO-DRIFT forbids a station committing
them itself — scans exactly two roots, `"docs/pr-prompts", "docs/pipeline"`, and admits only
`docs/pr-prompts/00-*.md` plus `docs/pipeline/*`. **`docs/pr-reviews/` is in neither.**

So verdicts reach `main` only when a Station 00 run notices the pile by eye. [MEASURED]
`git log --oneline origin/main -- docs/pr-reviews/`:

| backfill | landed by | what it published |
|---|---|---|
| `a111a591` | `#2026` | 33 verdicts, `#1869`–`#2011`, *"that sat untracked in the dev tree"* |
| `3be7587a` | `#2078` | 18 verdicts, in a PR whose title records they *"were never published"* |
| `c6f0040e` | `#2118` | `pr-2114-review.md`, swept in by an ordinary collect PR |
| this run | (this PR) | **14 verdicts, `#2119`–`#2180`** |

This is the `qa-findings.md` failure in a different costume — the nine-day swallow — except the
path is not ignored and 171 predecessors ARE tracked, so the tracked state is plainly the intended
one and what is missing is only the mechanism that maintains it. A run that reads
`docs/pr-reviews/` from a clone, from CI, or from a cloud-fired station sees the lane stop at
`#2114`.

The complete-and-additive repair is one scan root plus a `pr-<digits>-review.md` leaf filter, with
every existing refusal untouched. It is explicitly scoped NOT to reach across the other two homes
(§9.5) — that is the mirror step's job and duplicating it would give two actors one job.

**DISPOSITION: ACTIONED** — both halves. The immediate loss is closed: the 14 verdicts are in this
PR (`byteExact=true` on all 15 copies, `pr-2164` taken from the newest of its three homes). The
future half is staged as `pr-sweep-collects-review-verdicts-HOLD.md`, `lint-prompt.mjs` **ADMIT,
exit 0**, marker `SWEEP_COLLECTS_REVIEW_VERDICTS_V1` with its premise control at 0 and its positive
control at 5.

### F4 — Station 04's F1: the Windows-shell blindness is pipeline-wide, and the escalation that holds it is named for Station 00 alone.

04's 0211Z run was blind (`CONNECT_TIMEOUT`, 30 000 ms) and escalated it here as *"a pipeline-wide
intermittent outage, not a Station 04 defect"*, with a three-option RULE 1 ask whose
complete-and-additive option (a) is a tracked per-run shell-reachability record. **I re-verified the
scope independently rather than repeating 04's reading:** 00's own 2315Z run is blind by its
filename, 04's 0211Z run is blind by its filename, and 00's 0014Z / 0114Z / 0155Z runs and this one
were all SIGHTED — so it is intermittent, not a standing outage, and no station is down right now.

The channel exists — `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`,
open 24 days, already carrying a measured instance of it costing a real release window on 09-23.
Its **title** is the gap: a reader triaging 48 escalation files by filename reads a Station 00
problem. I appended a dated section widening the scope and carrying 04's option (a) verbatim rather
than paraphrased. Nothing in the original ask is retired and no new ask is added.

**DISPOSITION: ESCALATED** — to Marco, through the existing file, with its scope corrected. ⚠️ That
folder is gitignored and the file is not among the 10 tracked there, so the append reaches nobody on
its own: its content is stated in WHAT CHANGED item 6 and here, which is the tracked half.

### F5 — Station 04's F2: the vm-git-guard reports INERT, and this run reproduced it independently.

04 measured exit 2 from a blind session; I measured exit 2 from a sighted one, on a different
session id, and quoted the installer's own last line (measurement 2). The device-bridge git ban is
therefore **remembered, not mechanical**, which DOCTRINE §9.2 records as having failed seven times.
This matches the station doc's documented expected outcome exactly, so it is a standing structural
gap rather than a regression.

04 deferred it with the trigger *"it becomes urgent the moment a station is observed running `git`
against the mount, or if a 0-byte `index.lock` appears in the dev tree."* Neither holds: the
sweep's `[LIVE]` line reads `git index.lock interactive/clone: False / False`, and no `git` ran
against the mount this run.

**DISPOSITION: DEFERRED** — 04's trigger adopted unchanged, now with a second independent
measurement behind it.

### F6 — Station 04's F3: `instruction-drift` is the one rotation slot with zero blind-run coverage, and the rotation is correctly still parked on it.

`sweep-rotation.json` is CLEAN at `last_index: 2`, `last_run_utc 2026-09-24T18:18:23Z`,
`last_station 04-scanner` — so 04's blind run did not advance past `repo-hygiene`, which is what
keeps the gap detectable. 04's trigger is *"a second consecutive run finds `last_index: 2` with
`instruction-drift` still unperformed."*

**I am sighted and `C:\Users\Marco\Claude\Scheduled` is reachable from here, so I could have run
that sweep — and did not.** It is Station 04's rotation slot, and doing 04's work myself is LL-38,
the incident this station is named in. The right move is the dispatch, not the shortcut.

**DISPOSITION: DEFERRED** — 04's own trigger, unchanged. Its next occurrence is ~06:10Z; if that
one is sighted the slot is covered, and if it is blind again the trigger has fired and F4's ask
gains a second concrete cost.

### F7 — The spent HOLD behind `#2189` was still tracked on `main`.

`git diff --numstat origin/main -- …adopt-ancestry-and-watchdog-identity-HOLD.md` → `0 111`. The
01:29:14Z arm consumed it, the watcher built it, `#2189` carries the work. A spent HOLD left on the
board is an armable duplicate — §10.6's shape, reached from the arming side rather than the
second-lane side.

**DISPOSITION: ACTIONED** — `git rm` in this PR, staged `D`, verified in
`git diff --cached --name-status`.

### F8 — The worktree the sweep asks a human to preserve holds nothing unlanded, which strengthens the 01:14Z run's F3 rather than adding to it.

Measurement 10 in full: `C:/po-worktrees/sup-cwd-paths`'s four "unpushed" commits are the
pre-squash history of **MERGED `#2154`**, its head branch is deleted on the remote, its one
breadcrumb is already tracked in `archive/`, and its two dirty files are a CRLF smudge on a
generated file plus a scratch `pr-body.md`. The 01:14Z run measured the *label* as wrong on one of
six worktrees and staged `pr-sweep-orphan-worktree-asks-the-board-HOLD.md` for it; what is added
here is that the sweep's **second** claim on that row — `HOLDS UNCOMMITTED WORK … PRESERVE OR
COMMIT BEFORE PRUNING` — is also wrong, and it is the one that demands human time.

**DISPOSITION: DISPATCHED** — to **Station 03**, which owns local trees and worktrees. The prune
itself is 03's and I did not perform it. The instrument half is already staged for 00 to arm.

## WHAT I DID NOT DO

**I did not remove a `do-not-merge` label, and I did not merge any of the five open PRs.** Only
Marco removes it (CP-26 gate 1, `STATION-CAPABILITIES.md` §5, absolute). All five read
`[LABEL_PRESENT]`, which §9.4 says has no agent-side action behind it.

**I did not arm anything.** Two gate-clear, lint-ADMIT prompts are staged and I left both:
`pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices-HOLD.md` (the 01:55Z run's dispatch for
`#2183`'s reproducible e2e flake) and `pr-sweep-orphan-worktree-asks-the-board-HOLD.md` (the 01:14Z
run's F3), plus my own new one. **ARM ONE AT A TIME was exercised 45 minutes before this run** —
`2026-09-25T01:29:14Z`, producing `#2189`, which is open and parked. Five PRs are already waiting
on a label only Marco can remove; a sixth moves nothing Marco-side and adds a tree to prune.

**What would make me arm the e2e prompt instead of deferring it: any label coming off any of the
five**, because from that moment the flake is a live merge blocker rather than a red on a parked
PR — and it is the highest-leverage item staged, since it taxes every future PR and has already
consumed two consecutive runs' diagnostic time.

**I did not touch the backlog's one READY TO STAGE item**, `[P2] rates-11c-blocked-consumers`. Its
own denylist entry (`queue-sync.ps1`: `rates-s11c`) is in the forbidden never-arm set, and
`pr-rates-s11c-drop-legacy-tables-HOLD.md` drops database tables — Marco-run, never armed by a
station. `[P1] model-merge-slices-rehomed` and `[P2] map-locations-waste-rate-coupling` are both
tagged `do NOT auto-stage`.

**I did not discharge any escalation.** The sweep's section 5 printed **no `[STALE]` rows** this
run; its three `[FILE]` rows on `verdict-is-not-anchored-to-a-head-sha-2026-09-09.md` carry the
sweep's own admission that section 5 **CANNOT decide** whether that file is spent, and the station
doc forbids discharging on the tag alone.

**I did not prune a worktree, restart the watcher, or kill a process.** The sweep reads the watcher
node RUNNING at pid 42212 with a 17-minute heartbeat and `armed: 0` — an idle watcher with nothing
armed is CORRECT, not wedged, and I did not run `restart-watcher-if-wedged.ps1 -Fix` because
nothing asked for it. The `auto-restart wrapper: alive (2)` duplicate is Station 03's F1, already
a tracked `needs-marco/` file opened by the 00:14Z run; I neither re-filed it nor killed pid 30116,
which is a mutation this station may not perform against a launcher outside every repo.

**I did not run Station 04's `instruction-drift` sweep** (F6), did not touch `/sot/`, did not run
`git` against the mount, and did not commit anything in the dev tree — the only dev-tree write this
run was the append to a gitignored `needs-marco/` file.

**I did not fast-forward the dev tree.** It is 2 behind with a ` D` on the HOLD this PR retires and
a pre-existing ` M` on `docs/data-model/metadata-catalog.json` that predates this run by a day. The
FF belongs after this PR merges, and the next run should expect the restore sequence this station
doc documents — raw-Buffer first, then read the NAMES `git update-index --refresh` prints rather
than its exit code, because that unrelated smudge will make the whole-index exit non-zero.
