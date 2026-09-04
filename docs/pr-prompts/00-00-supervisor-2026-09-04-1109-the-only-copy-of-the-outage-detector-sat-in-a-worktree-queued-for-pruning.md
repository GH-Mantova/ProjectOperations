# Station 00 — Supervisor | 2026-09-04T11:09Z–2026-09-04T11:4xZ

## GROUND

```
UTC            2026-09-04T11:09:24Z
origin/main    58e660c0            (fetched, then rev-parse)
dev tree       main @ 58e660c0     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (both 1) — full authority, not read-only.

**NOT BLIND.** Desktop Commander ids found by keyword `ToolSearch` (never named literally, per the
PREFLIGHT correction that landed as #1580); `start_process` shell `powershell.exe` → **PID 27268** on
the first call. Every measurement below came off that shell.

All three binding documents — `00-supervisor.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md` — read in
full from the dev tree **after proving them identical to `origin/main`** with the sound probe:
`git diff --numstat origin/main -- <the three>` → **EMPTY**. No piped hash was used anywhere in this
run (#1578's correction).

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` 11:10:17Z. Section 0 controls both PASS (`gh` saw merged #1584;
  `node` runs). **OPEN PRs 0 · armed `*-ready.md` 0 · main CI on `58e660c0` 4 success / 0 failed
  (trunk green) · watcher node RUNNING pid 20000 · auto-restart wrapper alive (1) · heartbeat 32 min
  (ticks only mid-run; empty queue ⇒ idle, not wedged)**. Section 3 — the real single-actor gate —
  in-progress prompts **0**, `index.lock` dev/clone **False/False**, git processes **0**, no PR
  touched in the last 2 min. **VERDICT: CAUTION**, on one cause only: `C:/po-vg` classified LIVE
  STATION WORKTREE. Re-measured immediately before every mutation below (§7's `[LIVE]` rule).
- [MEASURED] Board census answered myself, not quoted: `gh pr list --state open` → **0**. **Q1: zero
  open PRs, therefore zero DIRTY.** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**
  (Q3, counted, not quoted). `git diff --cached --name-status` → **EMPTY**, so a pathspec commit was
  not forced on me; I used one anyway.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**;
  `structure: 5 checked, 0 malformed`. 00 1.0h · 03 12.1h · 04 1.0h · 05 13.3h, all `ok`.
  It flagged `00-04-scanner-…-1011-…md` as **UNTRACKED — it reaches nobody until a board PR commits
  it.** That is this run's job and it is done below.
- [MEASURED] Freshness crossed against `lastRunAt` (scheduled-tasks MCP), as the contract requires:
  00 `11:08:51Z` (this run) · 03 `2026-09-03T23:01:39Z`, next `23:00:45Z` today · 04 `10:10:30Z`,
  next `14:09:31Z` · 05 `2026-09-03T14:11:26Z`, next `14:10:37Z` today. **No station has missed a
  scheduled occurrence** — 03 and 05 are daily and both are inside one cadence. One row does not fit
  the table; see F3.
- [MEASURED] Third instrument, the session directory: **1323** `local_*` directories retained.
  Positive control — 05's `lastRunAt` of `2026-09-03T14:11:26Z` matches a directory created at
  exactly `2026-09-03T14:11:26Z`. The instrument works and dates a fire to the second.
- [MEASURED] `C:/po-vg` is **not live**: `git ls-remote --heads origin fix/no-rebase-while-checks-run`
  → **empty** (branch deleted when #1577 merged at 08:15Z); newest file write anywhere in the tree
  `2026-09-04T07:55:32Z`, i.e. **3h15m of zero activity**; 0 git processes; 0 in-progress prompts.
- [MEASURED] I re-linted 04's staged fix myself rather than quoting its verdict:
  `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-lint-gate-path-space-HOLD.md` →
  **ADMIT (size 2), exit 0**.
- [MEASURED] RULE 2 probe, run in the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
  and never the clone: no verdict names #1585, because the watcher did not open it — I did.
  Recorded as `[NO LANE VERDICT — hand-classified]`; see F1's lane paragraph.

## WHAT CHANGED

1. **Opened PR #1585** — `chore(pipeline): preserve check-pipeline-heartbeat.mjs rescued from an
   orphaned worktree`. One file, `ADDED`, 129 lines, from an isolated worktree
   `C:\po-wt\hb-preserve` cut off `origin/main` (never the dev tree, never the clone).
   **Read back:** `git rev-parse origin/preserve/pipeline-heartbeat:scripts/pipeline/check-pipeline-heartbeat.mjs`
   → `9c4587fbf4e906fca096941f014de8ef4671ebee`, byte-identical to the source in `C:\po-vg`.
   `gh pr view 1585` → `state OPEN · isDraft false · autoMergeRequest null · labels []`.
   **Auto-merge deliberately NOT enabled.** The file is now on the remote, so it survives whatever
   happens to the worktree — which was the entire point, and it was achieved at `git push`, not at merge.
2. **Committed 04's untracked output** into this run's board PR: its breadcrumb
   `00-04-scanner-2026-09-04-1011-gate-path-space-false-absent.md`, its staged fix prompt
   `pr-lint-gate-path-space-HOLD.md`, and `docs/pipeline/sweep-rotation.json`, which 04 left dirty on
   purpose because it may not commit to the shared dev tree.
3. **Archived three dispositioned breadcrumbs** into `docs/pr-prompts/archive/` — `00-0809`,
   `00-0908`, `00-04-scanner-0610`. Safe for freshness: `check-breadcrumb.mjs` builds `trackedSet`
   with `git ls-tree -r` and matches by **basename**, so an archived breadcrumb still counts.
4. **Tore down** `C:\po-wt\hb-preserve`.
5. Nothing else. **No prompt armed, disarmed, renamed or deleted. No merge. No label added or
   removed. No `/sot/` edit. No git command run in `C:\po-watcher\ProjectOperations`.**

## FINDINGS

### F1 — S1 — The only copy of the pipeline's own outage detector was sitting in a worktree three runs had queued for pruning

`C:/po-vg` has produced the sweep's standing `CAUTION` for four consecutive runs and has been
DEFERRED to Station 03 each time. Each of those runs named the trigger that would make it urgent —
`00-1009` F5, verbatim: *"it becomes urgent … if `git status --short` inside any of them shows
uncommitted work that is not already on `main`."* **Nobody had run that probe.** I ran it.

[MEASURED] `git -C C:\po-vg status --porcelain` →
`?? scripts/pipeline/check-pipeline-heartbeat.mjs` — 6144 bytes, written `2026-09-04T07:55:32Z`, two
minutes after the commit that shipped as #1577. Absent from `origin/main`
(`git cat-file -e` → exit **128**; positive control `CLAUDE.md` → exit **0**). Absent from the remote
entirely — the branch that carried it was deleted on merge. Absent from the board's own record:
`Select-String 'check-pipeline-heartbeat'` across `docs/pr-prompts/*.md` → **0 hits**, negative
control `zzzNoSuchTokenZzz` → 1 (this run's own note). `node --check` → exit **0**, so it is not a
fragment.

**What the file is makes this worse, not better.** Its own header states the hole it fills: on
2026-09-02 all four scheduled stations were disabled for 16.6 hours, and the only detector of that
condition — `check-breadcrumb.mjs --freshness` — has exactly one consumer, Station 00, which was
itself one of the disabled tasks. The script is an **external** heartbeat, designed to run as a
GitHub Actions scheduled workflow on GitHub's clock, where the act that disables the stations cannot
reach it. That is the cure for the open escalation
`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`.

So the shape of this finding is: **the pipeline built the fix for its worst measured outage, then
left the only copy in a directory it was preparing to delete, and no instrument on the board could
see it.** The sweep's worktree classifier reported `dirty=1` — it saw the file's existence — and
translated that into *"a station is working here, do NOT prune"*, which is the opposite of the truth
and, by accident, the only thing that kept it alive.

**Lane.** `[NO LANE VERDICT — hand-classified.]` The probe is well controlled but returns nothing for
#1585 because the watcher did not open it. Hand-classified under DOCTRINE §10.1 step 2: the diff is
`scripts/`, outside `^(tests|docs)/`, so it is **Marco's to merge**. §10.1 step 3's station-lane
exception does not apply — 00's recorded lane in `STATION-CAPABILITIES.md` §5 is `docs/`.

**DISPOSITION: ACTIONED.** Preserved in **#1585**, verified by blob hash on the remote. The file is
inert on `main` if merged — nothing imports it, no workflow references it — so merging costs nothing
and closing destroys the only copy. That trade-off is stated in the PR body for Marco.

### F1a — RULE 1 options for what happens to #1585

- **(a) Merge #1585 as-is, then build the companion workflow as its own prompt.** COMPLETE and
  ADDITIVE, and therefore first. Complete: the artifact is durable on `main` where every clone, CI
  and cloud lane can see it, and the escalation it answers stays open with its answer attached rather
  than lost. Additive: nothing invokes it, so `main` behaves identically before and after; it cannot
  damage existing or future data entry because it touches neither.
- **(b) Merge it and wire the workflow in the same PR.** Fails the *without damaging* half — an
  unreviewed 129-line script going straight onto a schedule is exactly the "quick fix as a mask"
  §8.2 forbids, and a broken external heartbeat is worse than none because it teaches the reader to
  ignore it.
- **(c) Close #1585 and re-stage the work as a fresh prompt.** Fails *complete*: the branch is the
  only copy, so closing discards a measured, syntax-valid implementation and pays to rewrite it from
  the escalation text. This is the option that was one `git worktree prune` away from happening by
  itself.

### F2 — S2 — A gate path containing a SPACE reads ABSENT, and it fails in BOTH directions (collected from Station 04, 10:11Z)

04 measured that `readFromOriginMain()` in `lint-prompt.mjs` passes `shell: process.platform === "win32"`
to `execFileSync`, so a gate path with a space is split into two shell words; git's stderr
(`fatal: path 'Claude' does not exist in 'origin/main'`) then MATCHES the file-absent regex, and the
function returns *file-is-not-on-main* instead of *git-is-broken, fail-safe*. Controls in 04's own
report: spaced real path ABSENT under `shell:true` / **PRESENT, 23637 bytes** under `shell:false`;
`CLAUDE.md` PRESENT both ways; `docs/zzz-no-such-file-zzz.md` ABSENT both ways.

I verified the fix prompt myself rather than quoting 04's verdict: `lint-prompt.mjs
pr-lint-gate-path-space-HOLD.md` → **ADMIT (size 2), exit 0**. It is Windows-only, so CI is
structurally blind to it (`process.platform === "win32"` is false on the Linux runner) — no green
check anywhere would ever have caught it.

**DISPOSITION: ACTIONED in part, DEFERRED in part.** ACTIONED: the prompt is **committed to `main`
in this run's board PR**, so it exists for every clone, CI and cloud lane instead of only on this
box. **DEFERRED to the next 00 run for the arm**, and the reason is mechanical, not cautious:
**arming is a `git mv` of a TRACKED `-HOLD.md`** (a created `-ready.md` is swallowed by
`.gitignore:75`), and the prompt was untracked until this run. It becomes armable the moment the
board PR lands. It is the highest-value arm on the board and should be the next one taken.

### F2a — the prompt masked behind F2's gate is LIVE work, not spent work (collected from 04)

`pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` has been parked since 07:39:35Z today by F2's
false ABSENT. Its gate `requires_file_on_main: Claude Design/docs/01-commercial.md` is in fact
**satisfied** (#1573 un-ignored that directory), and its own premise is still alive — 04 measured
`git cat-file -e origin/main:docs/plans/claude-design-spec-regeneration-plan.md` → exit 128, control
`CLAUDE.md` → exit 0. **DISPOSITION: DEFERRED**, dependent on F2. Re-lint it once F2's fix is on
`main`; **do not hand-promote it in the meantime** — that substitutes a reading for the instrument
the fix exists to repair.

### F3 — S3 — A breadcrumb can be NEWER than its station's `lastRunAt`, and the contract's cross-check table has no row for it

The contract's freshness table has three rows: `lastRunAt` older than one cadence ⇒ never fired;
`lastRunAt` fresh with no breadcrumb ⇒ started and died; both fresh and aligned ⇒ healthy. **05 fits
none of them today.**

[MEASURED] 05's newest breadcrumb is `00-05-sot-keeper-2026-09-03-2154-sot-refs-provenance-burndown.md`
— the run it reports began `2026-09-03T21:54:23Z`. 05's `lastRunAt` in the scheduled-tasks MCP is
`2026-09-03T14:11:26Z`, **7h43m EARLIER**. The third instrument agrees with the MCP and not with the
breadcrumb: over 1323 retained session directories there is **no `local_*` directory created at
21:54Z** — the window `19:00Z–01:00Z` holds eight, at `19:08:44 · 20:08:45 · 21:08:45 · 22:10:24 ·
22:37:53 · 23:01:39 · 23:08:46 · 00:08:46`, and the positive control (05's 14:11:26Z run has a
directory created at exactly `14:11:26Z`) proves the instrument can see a 05 fire when there is one.

The run is nonetheless **real and consequential**: `git log --diff-filter=A` shows its breadcrumb was
added by `44dd974b`, the squash of **#1554** — the `sot/` doc-reconcile PR whose merge authority Marco
personally ruled on. So a Station 05 run happened, edited `/sot/`, opened a PR and filed a breadcrumb,
and **two of the three instruments the contract names have no record of it.**

**Why this matters beyond one row.** Escalation #23 records that `lastRunAt` can OVER-report — a 529
on turn one consumes a cadence and updates `lastRunAt` having executed nothing. This is the mirror:
`lastRunAt` can **UNDER-report** — a run can happen that it never records. Both directions are now
measured, and the consequence is that **`--freshness` reading `ok` is not evidence the schedule
fired**; it is evidence only that *some* actor filed under that station's name. A station could be
silently descheduled and read `ok` indefinitely on breadcrumbs from unscheduled runs.

I am **not** asserting which actor ran 05 at 21:54Z. Two explanations survive the evidence and I
cannot separate them from here: a surface that creates no `local_*` directory and does not update
`lastRunAt` (an interactive or CLI invocation of the station's own contract — benign), or a
differently-titled scheduled session executing 05's contract (not benign: 00 is forbidden to edit
`/sot/`). Naming one without measuring it is the §7 mistake this pipeline is named for.

**DISPOSITION: ESCALATED — as an AMENDMENT to the existing `#23` file, never a new thread and never a
discharge.** The question for Marco is one line: **is `--freshness` allowed to accept a breadcrumb
that no recorded occurrence produced?** RULE 1 options:

- **(a) Make the cross-check three-way and require agreement — breadcrumb, `lastRunAt` AND the
  session directory — reporting DISAGREEMENT as its own state.** COMPLETE and ADDITIVE, therefore
  first. Complete: it catches both measured directions (the 529 over-report and this under-report)
  and the third state neither instrument alone can express. Additive: it adds a state, changes no
  existing verdict, and touches no data.
- **(b) Add a fourth row to the table saying "breadcrumb newer than `lastRunAt` ⇒ unscheduled run,
  investigate".** Fails *complete*: it documents the case for a human and leaves the detector still
  reading `ok` on it.
- **(c) Do nothing — 05 is demonstrably not stopped.** Fails *future*: the next time this shape
  appears it will be a genuinely descheduled station reading `ok`, and nothing will say so.

### F4 — INFO — Board idle, machinery healthy, and that is a real answer this time

**Q6, the one most important blocker: there isn't one on the board — the constraint has moved off it.**
Zero open PRs, zero armed prompts, trunk green on `58e660c0`, watcher alive on pid 20000 running
today's code, wrapper alive, no locks, no in-progress prompts. Q1 answers zero DIRTY because it
answers zero open. The work this run found was not on the board at all; it was in a directory the
board does not look at.

**DISPOSITION: ACTIONED** — recorded so the next run can diff against it rather than re-derive it.

### F5 — S3 — `C:/po-vg` is NOT live, and the classifier that says it is has produced four consecutive unread CAUTIONs

[MEASURED] above: branch deleted from the remote, 3h15m of zero writes, no git process, no
in-progress prompt. The classifier keys on `dirty>0`, which cannot separate *a station is working
here* from *a station finished and left a file* — `00-1009` F5 already said exactly this. What is new
is that the file it was dirty on turned out to be F1.

**DISPOSITION: DISPATCHED → Station 03** (next run `2026-09-04T23:00:45Z`), whose lane worktree
hygiene is. Handing over, precisely:

1. **`C:/po-vg` is now safe to prune** — its only unique content is preserved on `origin` in
   `preserve/pipeline-heartbeat` (#1585). Verify that branch still exists before pruning; if #1585
   has been closed without merging, **stop and re-escalate rather than prune.**
2. Four other non-main worktrees, unchanged and all `dirty=0`: `C:/po-1483-fix` (3410 min),
   `C:/po-guard` (665 min), `C:/po-sa-fix` (1772 min), detached `C:/po-work/s2-e2e` (3538 min); plus
   registry escapees `C:\po-worktrees\fix-1523` and `…\vs-s2-durable-smoke`, both 0 KB, no `.lock`.
3. **Run `git status --porcelain` inside every one of them before pruning any of them.** That probe
   is the whole of F1. Three runs deferred it and the fourth found a rescue in it.
4. The `dirty>0` liveness heuristic itself wants fixing — a verdict that is always CAUTION is a
   verdict nobody reads, and this run proves the reverse error is expensive too.

### F6 — S2 — The sweep's `[STALE]` rule marks LIVE escalations dead, so the standing "discharge the stale needs-marco files" dispatch must NOT be executed as written

04 handed over the 30-odd `[STALE]` lines section 5 printed, and an older dispatch (still carried in
project memory) tells Station 03 to move every such file to `needs-marco/discharged/`. **Do not run
that sweep.** [MEASURED] this run, section 5 prints:

`[STALE] station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md references #1524 which is
MERGED -- escalation is DEAD, clear it.`

That is escalation **#23**, which is **OPEN and unanswered** — it is the file F3 above amends, and
its own body cites those merged PRs as *evidence*, which is exactly why they are merged. The rule
behind the tag is "this file names a PR that is now merged", and it is being reported as "this
escalation is dead". Those are different claims. The same misreading covers
`tests-docs-lane-starves-its-own-review-job-2026-09-04.md` (references #1583/#1580/#1500/#1574, all
merged, all cited as evidence) and `unattributed-arms-single-actor-2026-09-03.md` (#22, open).

A file that cites its evidence gets marked dead **because** it cited its evidence. Executed as a
batch, that dispatch would have discharged at least three live escalations, including the one this
run is amending — and `needs-marco/` is gitignored, so nothing outside this box would ever have
shown it happened.

**DISPOSITION: ESCALATED — and the escalation is against the dispatch itself, not the files.**
The narrow question for Marco: **should `status-sweep.ps1` §5 distinguish "cites a merged PR" from
"is resolved by a merged PR"?** RULE 1 options:

- **(a) Require an explicit discharge marker in the file — a `discharged:` line or a move performed
  by a human — and have §5 report merged references as `[REFS-MERGED]`, an observation, never a
  verdict.** COMPLETE and ADDITIVE, therefore first. Complete: no escalation can ever be
  auto-classified dead by the shape of its citations, in either direction. Additive: it renames a
  tag and adds a marker; it discharges nothing, deletes nothing, and cannot lose an escalation.
- **(b) Keep the tag and put a warning next to it.** Fails *future* — the tag reads as a verdict, the
  warning does not travel with it into a dispatch, and this run is the proof: the dispatch already
  exists and already says "clear it".
- **(c) Discharge them by hand each run.** Fails *complete*: it is the same judgement re-made every
  two hours by a different run, which is how the wrong one eventually gets made.

**Until Marco rules: no `needs-marco/` file is discharged by any station on the strength of a
`[STALE]` line alone.** I discharged none this run. Moving them is a local-only, gitignored change
whose reversal nobody can review, which is exactly the shape §5 hard stop 4 is about.

## WHAT I DID NOT DO

- **Did not merge anything.** The board held **0 open PRs** for the whole run; there was nothing to
  drive. #1585 is mine-opened and `scripts/`-scoped, so it is Marco's — I did not enable auto-merge
  on it and did not label it.
- **Did not arm anything.** RULE 4 is one at a time, and the highest-value arm on the board —
  `pr-lint-gate-path-space-HOLD.md` — **cannot** be armed until this run's board PR lands, because
  arming is a `git mv` of a *tracked* HOLD and it was untracked. Arming a different prompt now would
  have spent the one-at-a-time slot ahead of it. **Next run: arm that one.**
- **Did not hand-promote** `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` (F2a) even though 04
  measured its gate satisfied. The gate is what is broken; substituting my reading for it is the
  error the fix exists to remove.
- **Did not prune `C:/po-vg` or any other worktree**, and did not touch the two registry escapees.
  That is 03's lane (F5) — I only measured, and preserved what the measurement found.
- **Did not discharge any `needs-marco/` file** (F6), and did not act on any `[STALE]` line.
- **Did not touch the named never-arm prompts**: `pr-fv2-formrule-contract`,
  `pr-siteid-notnull-backfill`, any prod-data prompt, `pr-tr-s1-reminder-policy` (size 9,
  `gate_allow: migrations`), `pr-cardui-s2-wbs-table-shell`, `pr-verdict-anchor-heading-form`
  (staged, not armed — it opens a `scripts/` PR), `pr-hygiene-s1-guarded-branch-prune`
  (irreversible), `pr-watcher-app-auth-switch-on` (production auth config — hard stop 4).
- **Did not restart the watcher.** pid 20000 is alive with its wrapper, running today's code after
  the 09:37:14Z restart; heartbeat staleness with an empty queue is idle, not wedged.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`.** Every clone read this run was
  `Test-Path` only. The watcher clone reads `dirty=1` on `main` — noted, not touched; it is 03's.
- **Did not drain or re-queue `blocked/` (117) or `no-pr-opened/` (109).** Q5 obliges me to say why:
  the newest `no-pr-opened/` entry is 09-02 and the newest `failed/` entry is 08-29 (six 401
  OAuth-expiry quarantines from one window) — **no NEW silent no-op occurred this cycle**, which is
  the only claim this run is entitled to make about them. Replaying the backlog has a blast radius
  nobody has measured.
- **Did not touch** `/sot/`, Azure, Entra, SharePoint, or production data.
- **Did not read `docs/qa/qa-findings.md` as evidence of anything** — it is gitignored
  (`.gitignore:108`) and its silence proves nothing.
