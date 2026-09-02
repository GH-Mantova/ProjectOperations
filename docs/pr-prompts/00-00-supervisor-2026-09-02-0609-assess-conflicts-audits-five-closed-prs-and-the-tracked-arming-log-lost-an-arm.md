# Station 00 — Supervisor | 2026-09-02T06:09Z–2026-09-02T06:35Z

## GROUND

```
UTC            2026-09-02T06:09:19Z
origin/main    d3b603e4              (fetch --prune first, then rev-parse)
dev tree       main @ acaad4de -> ff-only -> d3b603e4   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, read AFTER the ff)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was READ-WRITE. **SIGHTED**, not blind.

🔴 **But "sighted" took two calls, and the first form of the check would have said BLIND.** The
Desktop Commander tools arrived **deferred**: `mcp__plugin_desktop-commander_desktop-commander__*`
were listed by name only, with no schema, so calling `start_process` cold fails with
`InputValidationError`. `ToolSearch` had to load the schemas first; `start_process` then succeeded on
the first attempt (PID 30072). **This is the exact failure #1519 exists to fix, reproduced
independently by the run that read it** — see F1.

## WHAT I MEASURED

### 1. Dev tree was 2 commits behind, and an untracked file blocked the fast-forward [MEASURED]

`HEAD acaad4de` vs `origin/main d3b603e4`; `git merge-base --is-ancestor HEAD origin/main` → exit 0,
`rev-list --count HEAD..origin/main` = **2**, `origin/main..HEAD` = **0**. Clean fast-forward available.

It did not run first time: **#1512 added `docs/pr-prompts/.arming-log.txt` as a TRACKED file while an
untracked file of that name already existed on the box.** I moved the local copy to
`.arming-log.txt.localbak-20260902`, then `git merge --ff-only origin/main` → `acaad4de → d3b603e4`.
That move is what preserved the evidence in F2.

### 2. Sweep verdict [MEASURED]

`status-sweep.ps1` @06:11:01Z → **CAUTION** ("a PR was touched on GitHub in the last 2 min").
Re-run @06:2xZ → **CAUTION** again, but for a different reason: `1 LIVE STATION WORKTREE`, which was
**`C:\po-fix` — my own**, created by `assess-conflicts.ps1` earlier in this run (F1). Per the
read-checklist, CAUTION means *do not stage / arm / merge*: **I armed nothing and merged nothing.**

### 3. Watcher HEALTHY [MEASURED]

`scripts/restart-watcher-if-wedged.ps1` @06:15:25Z: `armed prompts waiting: 0 / watcher process:
ALIVE (pid 28400) / restart churn: 0 in 20 min` → **`OK - nothing armed and the watcher is alive.`**
pid 28400 is unchanged since the 04:11Z run. Sweep §2: wrapper alive (1), heartbeat 1 min.

Watcher clone `C:\po-watcher\ProjectOperations` (read-only git only): `main @ eacf09ac`, no
`MERGE_HEAD`, no `index.lock`, 2 untracked files (`docs/pr-reviews/pr-1519-review.md`,
`scripts/pr-watcher/.conflict-notified-prs.json`). **`git stash list` = 64** — the closed-loop stash
growth DOCTRINE §9.5 names, up from the 11 last reported in the dev tree. Drop, never pop; not mine.
The clone is 3 commits behind main but carries #1510, and nothing under `scripts/pr-watcher/**` has
merged since, so **no restart is warranted**.

### 4. Breadcrumb freshness CLEAN, exit 0 [MEASURED]

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `2 checked, 0 malformed` / `CLEAN`.
`00` 1.8h (cadence 2h) · `03` 7.2h (24h) · `04` 4.0h (4h) · `05` 16.0h (24h) — **no station SILENT.**

### 5. RULE-2 probe, with both controls [MEASURED]

In `docs/pr-prompts/processed/`, `Select-String -Path *.log -Pattern 'marco.:true'` → **604** hits;
breadth control `marco` → **1295**. Live positive control: `merge result for PR #1510` returns its
line. So an empty per-PR result carries information.

- **#1519 → NO VERDICT.** **#1520 → NO VERDICT.** Both are **second lanes** (DOCTRINE §10.1).
- Hand-classified per `classifyPolicyFiles`: **#1519 is MARCO'S** (`scripts/pipeline/lint-station.mjs`,
  `scripts/pipeline/vm-git-guard.sh` are outside `^(tests|docs)/`); **#1520 is MARCO'S**
  (`scripts/pr-watcher/index.mjs`). Recorded as `[NO LANE VERDICT — hand-classified]`.
- Corroboration: #1519 carries `do-not-merge`. #1520 carries **no label** — see §6.

### 6. #1520 is being driven by Marco *in the GitHub web UI*, and that is now measurable [MEASURED]

`gh api …/pulls/1520/commits`, reading `committer.login`:

| sha | author | **committer** | UTC | what |
|---|---|---|---|---|
| `0e8579b8` | GH-Mantova | **GH-Mantova** | 05:16:53 | the code |
| `2dacd499` | GH-Mantova | **GH-Mantova** | 05:16:55 | the code (2 s apart ⇒ scripted push) |
| `b882401d` | GH-Mantova | **web-flow** | 05:35:18 | "Merge branch 'main' into …" |
| `2c576c20` | GH-Mantova | **web-flow** | 05:52:01 | **`Create 1520.md`** — the CP-26 receipt |
| `8c38af4e` | GH-Mantova | **web-flow** | 06:09:19 | "Merge branch 'main' into …" |

🟢 **`committer.login == "web-flow"` is GitHub's server-side committer for an edit made in a browser.
No agent on this box produces it** — `gh` and `git` both commit as `GH-Mantova`, as the first two rows
show. **Positive and negative control inside one PR.** This is the first instrument this pipeline has
that separates *a human at github.com* from *the shared `GH-Mantova` account* — see F3.

So: **a second lane wrote #1520's code; Marco authored its receipt and pressed the buttons.**
Auto-merge was enabled at **06:11:49Z** by `GH-Mantova`, one minute after his own web-flow
"Update branch". Checks at 06:1xZ: **12 SUCCESS** (including `Approval receipt (CP-26)` and
`PR gates — diff checks`), 2 IN_PROGRESS (`tendering-e2e`, `API — lint, test, compliance smoke`).
**It will merge itself. I did not touch it.**

### 7. #1519 is DIRTY, and the conflict is ONE file and mechanical [MEASURED]

Cause, from `gh api …/issues/1519/timeline`: #1519 was **stacked on #1512's branch**. When #1512
squash-merged at 06:06:51Z, GitHub fired `automatic_base_change_succeeded` and retargeted #1519 to
`main` — and a squash-merged parent leaves the child conflicting.

Real merge test, in the isolated worktree, aborted immediately, nothing pushed:

```
git checkout --detach origin/docs/preflight-load-the-schema-before-declaring-blindness   # 73bfde15
git merge origin/main --no-commit --no-ff
  CONFLICT (add/add): Merge conflict in docs/pipeline/stations/01-code-writer.md
git diff --name-only --diff-filter=U   ->   docs/pipeline/stations/01-code-writer.md   (1 file)
git merge --abort ; git status --porcelain -> 0 lines
```

And the two sides are a strict superset, not a disagreement:

```
git diff --numstat origin/main 73bfde15 -- docs/pipeline/stations/01-code-writer.md
17  5  docs/pipeline/stations/01-code-writer.md
```

The 17/5 is exactly the `station-contract v1 → v2` header/footer rename plus the new
*"load the tool schema first"* paragraph. **The resolution is "take the #1519 side of
`01-code-writer.md`", and nothing else in the merge conflicts.** I did not perform it — see
WHAT I DID NOT DO.

### 8. Trunk CI on `d3b603e4` [MEASURED]

`gh run list --commit d3b603e4ad7e8c5dd624e233eaea7661425780ef` (**full 40-char sha**) →
`CI success`, `Push on main success`, `Deploy in_progress`, `Tendering Browser Smoke in_progress`.
**No reds.** Negative control reproduced DOCTRINE §9.4 again: the same query with the short sha
`acaad4de` returned **0 rows at exit 0**.

### 9. The three prompts staged since my last run [MEASURED]

| prompt | lint | tracked on `origin/main` | do-not-arm markers |
|---|---|---|---|
| `pr-ci-rerun-on-unlabel-HOLD.md` | **ADMIT** (size 1) | yes | 0 / 0 / 0 |
| `pr-watcher-app-auth-switch-on-HOLD.md` | **ADMIT** (size 2) | yes | 0 / 0 / 0 |
| `pr-preflight-tool-names-are-environment-specific-HOLD.md` | **REJECT** `GATE_NOT_RELEASED` | yes | — |

Controls: `git ls-tree -r --name-only origin/main -- CLAUDE.md` returns `CLAUDE.md`; the marker grep
returns **1** on `pr-524-rates-b-slice2-canonical-HOLD.md` (`Arm ONLY`). The REJECT is *correct* —
that prompt is gated on #1519 landing (`requires_on_main: 00-supervisor.md :: mcp__remote-devices__`).

**Both ADMITs are genuinely armable and both were left unarmed** (CAUTION; and both are
`scripts/`-scoped, so both route to Marco, who already has two PRs in flight).

## WHAT CHANGED

1. Dev tree fast-forwarded `acaad4de` → `d3b603e4`; the pre-existing untracked
   `docs/pr-prompts/.arming-log.txt` moved aside to `.arming-log.txt.localbak-20260902`.
2. This PR: this breadcrumb, the two collected breadcrumbs archived, and the one missing line
   restored to the tracked arming log (F2).

**Nothing merged. Nothing armed. No label added or removed. No prompt moved. `/sot/` untouched.
No Azure/Entra/SharePoint. No `git` write in `C:\po-watcher\ProjectOperations`.**

## FINDINGS

### F1 — `assess-conflicts.ps1` audits a hard-coded list of five CLOSED PRs, takes no arguments, and reports "NO CONFLICT" at exit 0 [MEASURED]

I ran `assess-conflicts.ps1 -Pr 1519`. It printed a clean, confident, well-formatted report:

```
=== #541  feat/quote-estimate-traceability     NO CONFLICT - just needs a rebase/update-branch.
=== #544  fix/no-access-page-instead-of-redirect   NO CONFLICT ...
=== #546 ... === #549 ... === #538 ...   NO CONFLICT
=== Nothing was pushed. Nothing was resolved. Assessment only.
exit=0
```

**Not one of those five is open.** The board is `#1519` and `#1520`. The script has **no `param()`
block at all**, so `-Pr 1519` was silently discarded, and line 27 reads `$DIRTY = @(541, 544, 546,
549, 538)` — a July snapshot frozen into an instrument. Their branches still exist on `origin`, so
`gh pr view --json headRefName` succeeded and the merge tests genuinely *ran*. **This is a real
measurement of the wrong population, at exit 0** — DOCTRINE §7 exactly, and §9.6's *"check the
POPULATION you measured is the population your CLAIM is about"*. A station that quoted it would
report a conflict-free board while the one DIRTY PR froze its own CI.

It also creates `C:\po-fix` as a side effect and leaves it, which is what put the second sweep into
CAUTION (§2).

**RULE 1.** *Complete and additive, no risk to data entry:* give it a `param([int[]]$Pr)` and, when
`$Pr` is absent, **derive the list live** — `gh pr list --state open --json number,mergeStateStatus`
filtered to `DIRTY` — so it can never again audit a set that no longer exists; and have it print the
population it is about to test before testing it. That fixes this run and every future one, and
removes nothing. *(b)* "just update the hard-coded list" fails the *future* half — it is the same
snapshot, one day younger. *(c)* "delete the script" fails the *immediate* half: assessing a DIRTY
PR without resolving it is a real need and this is the only tool for it.

**DISPATCHED** → Station 06 (PR Master), to stage as a prompt. Scope: `scripts/pipeline/assess-conflicts.ps1`
plus a test asserting the derived list matches `gh pr list --state open`. It routes to Marco
(`scripts/`), so keep it size ≤ 2. ⚠️ **06 has no cadence** — if it is not staged by the next
supervisor cycle, 00 stages it directly.

### F2 — #1512 tracked the arming log as a SNAPSHOT, and the snapshot is one arm short [MEASURED]

`.arming-log.txt` is append-only and is written by `arm-prompt.ps1` on the box. #1512 committed a
copy of it. The copy was taken at ~04:15:5xZ; the previous 00 run armed
`pr-schema-label-removal-is-marcos` at **04:16:09Z**, thirteen seconds later.

```
tracked (origin/main)  34 lines, hash fbd7a3d8, last entry 2026-09-02T03:36:50Z
local (pre-ff)         35 lines, hash cbf5a64b, last entry 2026-09-02T04:16:09Z
Compare-Object -> exactly one line, present locally, absent on main:
  2026-09-02T04:16:09Z  ARMED  pr-schema-label-removal-is-marcos  escalates=false  by=Marco@ pid=2308
```

**The line survived only because the ff refused and I moved the file aside by hand.** DOCTRINE §9.5
says this log is *"the only clock that dates an arm"*. #1512 fixed the right problem — it existed on
one box only — but tracking an append-only file that a script keeps writing creates **two writers on
one path**: every future `merge --ff-only` either refuses (as it did) or, after a `checkout`, silently
replaces the longer local log with the shorter tracked one and the arm record is gone with no error.

**RULE 1.** *Complete and additive:* **`arm-prompt.ps1` should commit the line it just appended**, on
its own one-file commit, so the tracked log and the local log are never allowed to diverge in the
first place — it fixes this instance and every future one, adds a write rather than removing the
record, and cannot lose an arm. *(b)* a `.gitattributes` `merge=union` driver on that path is smaller
and fixes true merges, but **not** `--ff-only` and not `checkout` — it fails the *complete* half.
*(c)* "back it up before every ff", which is what I did by hand, is a convention that depends on a
station remembering — fails the *complete* half outright.

**ACTIONED (the data)** — this PR restores the missing 04:16:09Z line to the tracked log; read back in
this PR's diff. **DISPATCHED (the defect)** → Station 06, same caveat as F1. Until this PR lands, the
dev tree's live log is short by one line and `.arming-log.txt.localbak-20260902` holds it; the next
run should confirm the line is present after its ff and then delete the backup.

### F3 — `committer.login == "web-flow"` distinguishes Marco-at-github.com from the shared account [MEASURED]

Nine merges have been recorded as "unattributable" because every actor reads `GH-Mantova`, which is
the shared account and is never proof a human acted. §6 above measured a discriminator that costs one
API call: **GitHub sets `committer.login = "web-flow"` on any commit created through the web UI**, and
nothing on this box does. Both controls are inside one PR — the two scripted pushes commit as
`GH-Mantova`, the three browser actions as `web-flow`.

This does **not** answer everything: it says nothing about a merge performed by `gh` under the shared
token, and it is a *commit* property, so it cannot attribute a label change or an auto-merge toggle.
**The full answer is still the watcher GitHub App** (built, and #1510 is merged — the identity ships
switched OFF, which is what `pr-watcher-app-auth-switch-on-HOLD.md` turns on).

**ACTIONED** — recorded here as a method, with its limits stated, so the next run reaches for it
instead of re-deriving it. Not a substitute for the App.

### F4 — #1519 is the only DIRTY PR, its CI is therefore frozen, and its fix is one file [MEASURED]

Stated the way the answer sheet demands: **1 PR is DIRTY, therefore 1 PR has no working CI, therefore
that PR cannot move until the conflict is resolved.** #1519's rollup is `0 pass / 0 fail / 0 pending`
— not "green", *absent*, because GitHub cannot build the merge commit.

Conflicts are not Marco's to direct and normally this is mine to fix. **I did not fix it**, for three
reasons that stack:

1. The sweep verdict was **CAUTION** both times it ran, and the read-checklist makes CAUTION binding.
2. The one escape CAUTION allows is *"an ISOLATED worktree, touching only NEW branches/PRs"*.
   Resolving #1519 means pushing to an **existing** branch — the case the escape excludes.
3. **Marco is measurably live on this exact cluster**: web-flow commits on the sibling PR at
   05:35:18Z, 05:52:01Z and **06:09:19Z**, and auto-merge enabled at **06:11:49Z** — inside my window.
   BOARD-DRIVING condition 3 (*single actor*) says stop when something else is acting, and it is the
   load-bearing one.

**DEFERRED** — with the resolution pre-computed so it costs the next actor nothing (§7): merge
`origin/main` into `docs/preflight-load-the-schema-before-declaring-blindness`, take the branch side
of `docs/pipeline/stations/01-code-writer.md`, push. **What makes it urgent:** #1519 still DIRTY at
the next cadence with no `web-flow` commit on it in the interim — that means Marco has moved on and
it is unambiguously mine. Note also that #1521 already staged a prompt gated on #1519 landing, so the
DIRTY state is holding a small chain, not just one PR.

### F5 — the deferred-tool trap #1519 fixes is real, and this run hit it [MEASURED]

PREFLIGHT step 1 says *"start a shell; if the call fails, you are blind, STOP."* In this session the
Desktop Commander tools were **deferred** — advertised by name, no schema — so the first thing a
literal reading produces is an `InputValidationError`, which the contract tells you to read as
blindness and end the run on. `ToolSearch` loaded the schemas and the very next `start_process`
succeeded (PID 30072).

Memory records Station 00 blindness at *"roughly 40% of recent runs, cause unknown"* (escalation #17).
**This is a candidate cause for some fraction of those runs** — not a claim that it explains all of
them, and I have not re-measured the earlier ones. #1519 is the fix and it is already written.

**ACTIONED** — corroborating evidence recorded for #1519, from an independent run that was not
trying to test it. The remedy is #1519 landing (F4).

### F6 — collection since the 04:26Z run [MEASURED]

Two breadcrumbs in the queue root, both mine, every finding in them already dispositioned:

- `…-0409-i-disarmed-a-live-run-51s-after-its-pr-opened-…` — F1 ACTIONED, F2 DISPATCHED→06,
  F3 ACTIONED, F4 ESCALATED→Marco, F5 ACTIONED, F6 ACTIONED, F7 DISPATCHED→03.
  🟢 **Its F4 escalation is now CLOSED by events: #1510 and #1511 both merged** (`646770f9`,
  `acaad4de`), so *"neither can go green without him"* is spent. **Do not re-ask it.**
- `…-0426-addendum-a-second-lane-is-editing-my-station-doc-…` — A-F1 DEFERRED (to #1510, now
  **merged** ⇒ discharge), A-F2 DEFERRED (to #1512, now **merged at 06:06:51Z** ⇒ **escalation #18
  DISCHARGES; do not re-raise the three dangling state files**), A-F3 ACTIONED.

No other station filed since. 03/04/05 are all inside cadence.

**ACTIONED** — both archived to `docs/pr-prompts/archive/` by this PR. Safe for freshness:
`check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by basename.

### F7 — 64 stashes in the watcher clone, and the two orphaned worktrees are unchanged [MEASURED]

`git stash list` in `C:\po-watcher\ProjectOperations` → **64**. DOCTRINE §9.5: the launcher's
preflight stashes on every start and nothing ever pops, so this only grows. `git worktree list` still
shows `C:/po-1483-fix` and `C:/po-work/s2-e2e`, both orphaned, both `dirty=0`; the sweep still lists
**11 registry escapees** under `C:\po-worktrees` / `C:\po-wt`.

**DISPATCHED** → Station 03, folded into the existing clone-hygiene dispatch rather than opened as a
new one — third restatement. Use 04's option (A): annotated tag `abandoned/<branch>@<sha>`, push tags,
**then** delete, so the deletion is recoverable. Add the stash count to that dispatch: `git stash
drop`, **never `pop`**. I did not delete anything; deletion is irreversible and is 03's lane.

## WHAT I DID NOT DO

- **Did not merge anything.** #1520 has Marco's own auto-merge and receipt; #1519 is DIRTY, labelled
  `do-not-merge`, and hand-classified MARCO'S. Both are second lanes with **no** RULE-2 verdict, and
  an empty probe is never "checked, and not Marco's".
- **Did not author a `merge-approvals/<N>.md`.** Permanently forbidden to every agent.
- **Did not add or remove a label** on any PR.
- **Did not arm anything.** Both ADMITs (`pr-ci-rerun-on-unlabel` size 1,
  `pr-watcher-app-auth-switch-on` size 2) are tracked, marker-free and genuinely armable — they are
  the next arms once the board clears and the sweep reads SAFE.
- **Did not resolve #1519's conflict**, and did not push to any existing branch — F4 gives the three
  stacked reasons and the exact resolution.
- **Did not restart the watcher.** `OK`, pid 28400 unchanged, nothing under `scripts/pr-watcher/**`
  merged since the clone's head.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and ran no `git` write in the watcher clone.
- **Did not delete the two orphaned worktrees, the 11 registry escapees, or the 64 stashes** — 03's
  lane, and irreversible.
- **Did not bin `needs-marco/ruleset-requires-four-checks-…-2026-09-01.md`** despite four `[STALE]`
  tags: it still carries the open half of escalation #15. **Amend it, never bin it.**
- **Tore down my own worktree** `C:\po-fix` at the end of the run, so the next sweep's
  `LIVE STATION WORKTREE` count is not inflated by me.
