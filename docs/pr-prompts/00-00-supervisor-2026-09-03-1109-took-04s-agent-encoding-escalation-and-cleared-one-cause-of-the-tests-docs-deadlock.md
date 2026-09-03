# Station 00 — Supervisor | 2026-09-03T11:09Z–2026-09-03T11:45Z

## GROUND

```
UTC            2026-09-03T11:09:16Z
origin/main    6c0012ea            (git fetch origin --prune, then rev-parse)
dev tree       main @ 6c0012ea     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (the scheduled-task file that fired this run)
```

Versions AGREE, so this run had full write authority.

This run was **SIGHTED** — `start_process` shell `powershell.exe` returned PID 19408 on the first
call, after loading the tool schema. Not a blind run.

**Binding-document freshness.** [MEASURED] `git diff --name-only origin/main --
docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **empty**, so the working copies I read are byte-identical
to `origin/main` at `6c0012ea` and reading them was safe. Control: the same command over
`docs/pipeline/sweep-rotation.json` returns that file, so the query is not blind.

`bring-up-to-speed.ps1` / `status-sweep.ps1` at 11:09:46Z: **SAFE TO ACT** — 0 in-progress prompts,
no `index.lock` in either tree, 0 git processes, no PR touched in the last 2 min. Instrument positive
controls both `[LIVE]` (`gh CAN reach GitHub (saw merged PR #1542)`, `node runs`).

## WHAT I MEASURED

**The board — 3 open PRs, and ALL THREE are genuinely Marco's.** [MEASURED]

| PR | state | CI | watcher verdict, verbatim from `processed/*.md.log` |
|---|---|---|---|
| `#1543` | CLEAN | 14 pass / 0 fail | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs"}` |
| `#1541` | CLEAN | 14 pass / 0 fail | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs"}` |
| `#1536` | BLOCKED | 12 pass / 2 fail | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

RULE 2 positive control: `Select-String -Path processed\*.log -Pattern 'marco.:true'` → **606**
(was 605 at 10:2xZ; the +1 is `#1543`'s own new verdict). Every reason above is **specific and
genuine** — none is the §10.3 timeout shape `"timeout waiting for green checks + MERGE verdict"`.
**So RULE 2 bars me from merging all three, correctly. I merged none.**

⚠️ `#1543`'s routing reason names a **unit-test file** — `scripts/pipeline/__tests__/…test.mjs` — as
*"outside tests/ or docs/"*. That is correct: `classifyPolicyFiles` is a **PATH PREFIX** test, not a
file-kind test, and this repo keeps pipeline unit tests under `scripts/pipeline/__tests__/`. The
consequence, stated plainly because it is new evidence on a live escalation: **no change to the
pipeline's own scripts can ever reach the `tests-docs` auto-merge lane, even when every non-docs file
it touches is a unit test.** Same shape as the recorded trap that a `.spec.ts` under `apps/api/` is
outside `tests/`.

**The machinery.** [MEASURED] watcher node RUNNING pid 24744; auto-restart wrapper alive (1);
heartbeat 34 min (ticks only mid-run — stale heartbeat with an empty queue is idle, **not** wedged);
`restart-watcher-if-wedged.ps1` not re-run because the sweep's three signals agree and nothing is
armed. armed (`*-ready.md`) = **0**, counted myself with
`Get-ChildItem docs\pr-prompts -Filter *-ready.md`, not quoted from a note (Q3).
needs-marco/ = 12 · no-pr-opened/ = 109 · failed/ = 41 · blocked/ = 84.

**Q1 — how many open PRs are DIRTY?** [MEASURED] **Zero.** Two are CLEAN and `#1536` is BLOCKED on
its label pair, not on a conflict. No PR on this board has frozen CI, so nothing needs conflict work
(Q2 therefore does not arise).

**The watcher clone is NOT corrupt.** [MEASURED] `git -C C:\po-watcher\ProjectOperations status
--short` → exactly two entries, both `??`; branch `main` @ `6c0012ea`; `MERGE_HEAD` absent;
`rebase-merge` absent. The sweep's `dirty=2 <-- NOT clean-on-main; the watcher may refuse to start`
is an **over-read**: two untracked files are the recorded untracked-file FF nuisance, not damage.
`rescue-watcher-repo.ps1` was NOT run and must not be. `git stash list` = **66** in the clone —
the closed-loop growth DOCTRINE §9.2 names; report and `drop`, never `pop`, and it is 03's.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`structure: 3 checked, 0 malformed`, **CLEAN, exit 0**. 00 = 0.9h (cadence 2h) · 03 = 36.2h (24h) ·
04 = 1.0h (4h) · 05 = 45.0h (24h) — **none SILENT yet.** 05 crosses 2× cadence at **14:11Z** and 03
at **23:02Z** today; the first 00 run after each must escalate if that station has not filed.

## WHAT CHANGED

- **PR #1544 opened** (branch `fix/agent-defs-double-encoded`, from a disposable worktree off
  `origin/main`, torn down at the end of this run): repairs the six damaged agent definitions, gates
  them in CI, and folds in 04's F2/F3/F4. Detail under F1–F4 below. **Hand-classified as MARCO'S and
  NOT merged** — see the lane note in F1.
- **This board PR**: commits 04's breadcrumb (which was **UNTRACKED** and therefore reaching nobody)
  and `docs/pipeline/sweep-rotation.json`, which 04 correctly left dirty and may not commit itself.
  ⚠️ That rotation advance had been sitting uncommitted for **two consecutive 04 runs** —
  `origin/main` still recorded `last_run_utc: 2026-09-02T06:10:43Z`. The rotation was turning on disk
  only, which silently narrows 04's coverage. Now committed.
- Scratch under `C:\po-sup-fix-scripts\` (repair tool, probe, PR body). Outside the repo.
- **Nothing else.** No arm (nothing was armable — 0 armed, and I staged nothing). No merge. No label
  added or removed. No `/sot/` edit. No watcher restart. No worktree pruned.

## FINDINGS

### F1 — ACTIONED: 04's escalated S2 was mine to take, and it is repaired and gated

04 escalated its F1 (203 damaged sequences across six `.claude/agents/*.md` **on `origin/main`**)
because *04* is read-only on the board — not because the fix needs Marco. That is the recorded
"an escalation can be wrong about *who* it needs" shape: the repair is mechanical, touches no
data-entry path, no `/sot/`, no production data and no hard stop. **So I took it**, and implemented
04's own recommended option **(A) — complete and additive** under RULE 1: repair now *and* gate in CI
so a third occurrence cannot land.

[MEASURED] `node 00-probe-agent-sig-2026-09-03.mjs origin/main HEAD` — `origin/main` **93**
(`00`=15 `01`=12 `02`=28 `03`=12 `04`=16 `05`=10), this branch **0**, with `06-pr-master` and
`pr-fix-reviewer` — the two files not in PR #1465 — reading **0 on both refs** as natural negative
controls. (My needle counts two signature forms; 04's broader needle set counted 203. Same damage,
different query — neither number should be quoted as "the" count.)

🔴 **A whole-file reverse decode was tried FIRST and correctly REFUSED on all six.** These files mix
genuine UTF-8 (emoji, surviving em dashes, `→`) with the damaged runs, so reversing the whole file
would have destroyed the good characters — the "almost repaired clean files into corruption" failure
DOCTRINE §7 already records once. The shipped repair is **run-by-run**: maximal runs drawn from the
non-ASCII Windows-1252 repertoire, each converted to bytes and decoded as **strict** UTF-8; a run
that is genuine text fails that decode and is left untouched. Eight controls pass, including
*"mixed file: damage repaired AND genuine UTF-8 untouched"* and *"emoji + real em dashes alone are
left byte-identical"*. The tool refuses to write unless a file reaches `sig=0` **and** `U+FFFD=0`.
Read-back: `Ã¢â‚¬â€` → `—` and `Ã¢â€ â€™` → `→`; 84 insertions against 84 deletions across the six
files — line-for-line, no structural change.

The CI gate is `lint-station.mjs` (already wired at `ci.yml:214`), now scanning `.claude/agents/*.md`.
Positive control, because a checker never seen to fail is not a checker: the **known-damaged**
`origin/main:.claude/agents/05-sot-keeper.md` planted into the directory produced
`REJECT: 1 of 9 agent definitions are encoding-damaged`, **exit 1**; with it removed,
`ADMIT .claude/agents/*.md (8 agent definitions, encoding clean)`, **exit 0**.

**Lane.** `#1544` was not opened by the watcher, so no `processed/*.md.log` verdict names it and that
absence proves nothing (§10.1). **`[NO LANE VERDICT — hand-classified]`**: it touches
`scripts/pipeline/**` and `.claude/agents/**`, both outside `^(tests|docs)/`, so by
`classifyPolicyFiles` **it is MARCO'S**. Opened and driven; **not merged.**

⚠️ One trap for whoever repeats this: **`git add .claude/agents` is REFUSED** — `.gitignore:28`
ignores `.claude/` wholesale and the eight agent files are force-added exceptions. The `add` printed
`The following paths are ignored`, and it would be easy to read the subsequent successful commit as
having included them. It did, because `git commit -- <pathspec>` commits tracked modifications
regardless of the index — but that was luck, not design. `git show --stat` confirmed all nine files
landed. **Read the commit back; do not trust the add.**

### F2 — ACTIONED: `STATION-CAPABILITIES.md` §1 now lists FIVE instruction layers, not four

04's F2, dispatched to 06. I folded it into `#1544` instead of dispatching, because it is the same
edit to the same file as F3 and because **06 has no cadence** — dispatching there is the black hole
that already cost seven weeks when dispatches went to 02. The new row names the agent-definition
layer, says it governs any Task-tool-spawned agent, and records that `.claude/` is gitignored
wholesale with the agent files as force-added exceptions. It also states why the row exists: **a
layer that is not in the map does not get swept**, which is exactly why F1 sat on `main` for two days
while every encoding sweep pointed at `sot/` and `docs/pipeline/`.

### F3 — ACTIONED: Station 01 added to the authority matrix and the cadence table

04's F3. Seven contract-linted station docs against six columns. While correcting it I found a second
error in the same table: **the 00 "Create a PR" cell read ❌ and has been wrong in practice for seven
weeks** — 00 opened `#1535`, `#1538`, `#1539`, `#1540` and `#1542`, and 02 was folded into 00 on
2026-09-02. Both corrected in `#1544`, with the correction dated in place rather than left to be
re-derived.

### F4 — ACTIONED: `next-sweep.mjs` no longer tells Station 04 to commit to the shared dev tree

04's F4. `04-scanner.md:162-164` was corrected to *"LEAVE IT DIRTY … Station 00 commits it, because
you may not"*; the script's output was not, and printed `COMMIT THIS FILE with your breadcrumb` as
the last line on screen immediately after a successful advance. A run reads the doc once and the tool
last. Replaced in `#1544` with the instruction that matches the doc, and the reason recorded in a
comment beside it so it cannot silently drift back.

### F5 — ACTIONED: 04's F5 (disproved-advice sweep clean) collected, nothing to do

10 needle hits across the five bootstraps, all 10 in warning-or-REFUTED context, zero live disproved
advice, with positive and negative controls. Recorded as collected so it is not re-derived.

### F6 — 🟢 ONE OF THE THREE OPEN CAUSES ON THE `tests-docs` DEADLOCK IS REFUTED

The standing escalation on the deadlocked lane carries three causes. Cause **(a)** was *"`:1826` needs
`verdictApproves` → `docs/pr-reviews/pr-<N>-review.md`, written by `rev-<N>`, which is queued BEHIND
the single-lane worker blocked in the 90-min wait"* — i.e. the reviewer is starved.

**[MEASURED] That is refuted. The reviews exist, and they say MERGE.**

| file | bytes | mtime | verdict |
|---|---|---|---|
| `C:\po-watcher\ProjectOperations\docs\pr-reviews\pr-1541-review.md` | 2905 | 2026-09-03T09:28:24Z | `VERDICT: MERGE` |
| `…\pr-1543-review.md` | 4195 | 2026-09-03T10:35:58Z | `## VERDICT: MERGE` |

Both are **untracked** in the clone and **absent from `origin/main`** (`git cat-file -e
origin/main:docs/pr-reviews/pr-1541-review.md` → exit 128, same for 1543; positive control
`origin/main:docs/pipeline/DOCTRINE.md` → exit 0).

That absence is **not** the blocker, and this is the part worth having measured: `verdictApproves`
(`index.mjs:1414-1415`) resolves `path.join(REPO_ROOT, "docs", "pr-reviews", …)` — **the local
working tree, not `origin/main`** — and `index.mjs:617` and `:628` say so in as many words
(*"the verdict file in docs/pr-reviews/ is local-only"*). So the reviewer is neither starved nor
stranded: its output is exactly where the consumer looks for it, and it approves.

**Consequence:** with (a) gone, the surviving explanation for `:1826` not firing is cause **(c)** —
the `verdict-guard.mjs:56-66` extractor asserting a backticked *command* is a *filename*, which this
station measured and dispatched at 10:20Z. This is independent confirmation of that diagnosis from a
different direction, and it should raise the priority of the dispatched fix.

🔴 **This changes nothing about RULE 2 for these two PRs, and must not be read as if it did.**
`#1541` and `#1543` are both outside `tests/` and `docs/`, so the policy lane routes them to Marco at
`:1774`/`:1776` for a reason that has nothing to do with `verdictApproves`. A `VERDICT: MERGE` from
the reviewer is not Marco's clearance. **They stay unmerged.**

**DISPOSITION: ESCALATED** — folded into the existing open `tests-docs` deadlock escalation as new
evidence rather than raised as a new item. Marco: cause (a) can be struck; the choice you were
offered is now between the distinct-timeout-reason change you already selected and the verdict-guard
extractor repair, and the second one is now carrying more of the weight than it was at 10:20Z.

### F7 — DEFERRED: my own instrument lied, and only the missing control let it through

While verifying the repair I ran a signature count against `origin/main` and `HEAD` inline, as
`node -e "… /â€[”“™œ]|Ã¢â‚¬/g …"`. It returned **0 for both refs** — which reads as *"main was
already clean"* and would have made the entire repair look unnecessary. The needle's non-ASCII
characters had been mangled in transit through the shell; the regex matched nothing anywhere. It had
**no positive control**, and the only reason it was caught is that a 0 on `origin/main` contradicted
a measurement taken twenty minutes earlier.

This is DOCTRINE §9.1's *"anything containing `$` goes in a `.ps1` file"* rule with a different
trigger: **anything containing a non-ASCII NEEDLE must go in a file too**, for the same reason and
with a worse failure mode, because a mangled needle fails silently at exit 0 in both directions. The
local cure is already applied — the probe is now a committed-shape file with the two clean files as
built-in negative controls.

**DEFERRED, not actioned:** the durable home for this is DOCTRINE §9.1, which sits inside the
hash-gated `instruments v2` canonical block. Editing it means re-recording the canonical hash and
is binding law that §10.3 says must be hand-landed exactly. That deserves its own PR rather than
being folded into a run that already carries three changes. **What would make it urgent:** a second
run losing time to a mangled needle, or any station quoting a non-ASCII inline grep as evidence.

### F8 — DISPATCHED → Station 03: worktrees, escapees, and 66 stashes

[MEASURED, from the 11:09:46Z sweep] Three non-main worktrees classified as orphaned —
`C:/po-1483-fix` (`fix1483`, dirty=0, age 1970 min), `C:/po-sa-fix`
(`pipeline/standing-authority-reject`, dirty=0, age 331 min), `C:/po-work/s2-e2e` (detached, dirty=0,
age 2098 min) — plus two registry escapees, `C:\po-worktrees\fix-1523` (0 KB, 333 min, no `.lock`)
and `C:\po-worktrees\vs-s2-durable-smoke` (0 KB, 109 min, no `.lock`). All dirty=0. Separately,
`git stash list` in the watcher clone = **66**, the closed loop the launcher's preflight feeds and
nothing ever drains.

03 owns machines and is **report-only**; it should confirm each is dead (`git status --short` in each
before proposing deletion — never delete unsupervised) and drop, never pop, the stashes. **Not mine
to prune**, and nothing here is blocking the board today. 03 is at 36.2h against a 24h cadence and
goes SILENT at 23:02Z.

### F9 — DEFERRED: the `#1544` PR itself now needs Marco, and nothing else on the board can move

The board is **three PRs, all three legitimately human-gated**, plus `#1544` which I hand-classified
into the same category. armed = 0 and I deliberately armed nothing (F10). So the single most
important thing blocking progress right now (Q6) is: **Marco is the only actor who can move any of
the four open PRs.** That is not a defect — three of the four routings are exactly what the policy is
for — but it means the board is fully drained of agent-actionable work until he looks.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs are Marco's: three by live watcher verdict with a
  positive control, one by hand classification. RULE 2 is not cleared by green, by CLEAN, by an
  absent label, or by a reviewer's `VERDICT: MERGE`.
- **Did not arm anything.** armed = 0 and the queue offered no gate-cleared candidate I would arm
  without asking; the two named never-arm-right-now prompts remain untouched. Arming one at a time
  means arming zero when zero are right.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is on `main`, no `MERGE_HEAD`, no rebase, no
  unmerged paths — two untracked review files is not corruption, and the rescue script does
  `git checkout main`.
- **Did not restart the watcher.** Node running, wrapper alive, nothing armed. An idle watcher with
  an empty queue is correct, not wedged.
- **Did not prune the worktrees or drop the stashes** — 03's lane (F8).
- **Did not edit DOCTRINE §9.1** for F7 — canonical block, binding law, deserves its own PR.
- **Did not touch `/sot/`** (05's lane, CP-24), Azure, Entra or SharePoint.
- **Did not repair `.claude/agents/pr-tester.md`** — untracked, gitignored, one machine only, reads 0.
- **Did not re-escalate the `tests-docs` deadlock as a new item.** F6 is new evidence on an escalation
  Marco already holds; a duplicate would split the thread.
