# Station 00 — Supervisor | 2026-09-05T14:08Z–2026-09-05T14:3xZ

## GROUND

```
UTC            2026-09-05T14:08:24Z
origin/main    2ba3a2b4            (git fetch origin --prune, then git rev-parse)
dev tree       main @ 2ba3a2b4     C:\ProjectOperations2  (already level; 0 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. **This run was SIGHTED.** Desktop Commander was loaded by keyword
`ToolSearch` (never by hard-coded id — PREFLIGHT step 1), then `start_process` shell
`powershell.exe` returned a live prompt, PID 16568, host `LAPTOP-E6NHU4E4`.

All three binding documents were read **in the dev tree** and proved current the sound way, no piped
hash: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` -> **EMPTY**, with `HEAD == origin/main == 2ba3a2b4`.

⚠️ **Clock note.** The scheduled-task harness stamps this session `2026-09-06`; the box reads
`2026-09-05T14:08:24Z`. Every timestamp in this report is the **box's**, which is the clock the logs,
the arming log and GitHub all share.

## WHAT I MEASURED

**[MEASURED] `status-sweep.ps1` at 14:09:10Z, captured to a FILE** (`*> C:\po-sup-fix-scripts\sweep-0605.txt`,
exit 0, 83 262 B) — never read from the stream, because the script returns early and hides its own
§7 verdict when piped.

| section | [LIVE] reading |
|---|---|
| 0 controls | `gh` reached GitHub (saw merged #1666); `node` runs |
| 1 board | **2 open**: `#1665` CLEAN 14/0/0 · `#1662` CLEAN 14/0/0. main CI on `2ba3a2b4` **4 success / 0 failed — trunk green** |
| 2 watcher | node **RUNNING pid 20000**, auto-restart wrapper **alive (1)**, heartbeat **103 min** (ticks only mid-run; stale + empty queue = idle, NOT wedged) |
| 2 trees | watcher clone `branch=main dirty=4`; orphaned worktree `C:/po-vg` **dirty=1, age 1816 min** |
| 3 safe-to-act | 0 in-progress prompts · no `index.lock` in either tree · 0 git processes · no PR touched in 2 min |
| 4 queue | **armed 0** · needs-marco 24 · no-pr-opened 109 · failed 41 · blocked 120 |
| 7 verdict | **SAFE TO ACT** |

**[MEASURED] COLLECT — nothing new to collect.** `node scripts/pipeline/check-breadcrumb.mjs
--freshness`, exit 0, `CLEAN`: `00` 0.7 h (cadence 2 h) ok · `03` 15.2 h (24 h) ok · `04` 4.0 h
(4 h) ok · `05` 24.0 h (24 h) ok · `02` dispatch-only. `structure: 1 checked, 0 malformed` — the
queue root held exactly one breadcrumb, this station's own 13:30 report, whose findings all carried
dispositions and which is archived by this run's PR. **No 03/04/05 breadcrumb has appeared since the
13:30 collect**, so there is no finding from another station to disposition.

**[MEASURED] RULE 2 lane probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`
(never the watcher clone's 17-day-stale decoy), restricted to `pr-*.log` — `rev-<N>-ready.md.log`
are REVIEW JOBS and carry zero lane information.

| query | result |
|---|---|
| logs in the directory | **1953**, newest `2026-09-05T12:27:01Z` — younger than the oldest open PR (11:45:57Z), the control that separates the live directory from the decoy |
| `marco.:true` census (regex form, never `-SimpleMatch`) | **612** |
| NEGATIVE control `PR #999999` | **0** |
| `PR #1665` in `pr-*.log` | **0** |
| `PR #1662` in `pr-*.log` | **0** |

**`[NO LANE VERDICT — hand-classified]` for both.** `.arming-log.txt` is unchanged since
`2026-09-04T22:03:13Z`, so neither PR was armed — second lane, not a watcher PR whose verdict died
in transit. Hand-classified by `classifyPolicyFiles`' own clauses: **both carry
`apps/api/prisma/migrations/…/migration.sql`**, which is refused before anything else is examined
⇒ **both are MARCO'S**. Both `labels: []`, both `autoMergeRequest: null`. An empty label set is not
a clearance.

**[MEASURED] One HOLD is now SPENT.** `triage-holds.ps1` (read-only, exit 0) over the 83 depth-1
`*-HOLD.md`: `spent=1  gates-satisfied=40  still-gated=42  unreadable=0`, all three verdict classes
observed and the SPENT bucket additionally proved reachable by its own fixture control.
`pr-stages-s1-rollup-becomes-stage-aware-HOLD.md` -> `lint-prompt.mjs` **exit 3**, *"Premise no
longer holds … the work is ALREADY DONE"* — it shipped as **#1664** at 12:24Z. Retired by this run's
PR. Its successor `pr-stages-s2-cards-can-share-a-stage-HOLD.md` correctly reads **PROMOTE**
(`GATE_RELEASED requires_on_main: … SCOPE_STAGE_AWARE_V1 is now on origin/main`).

**[MEASURED] The two open PRs each left their own source HOLD alive and ADMIT.**
`pr-plantdays-retire-and-drop-HOLD.md` and `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md` are
both in the `gates-satisfied` bucket, and their basenames are the head branches of `#1662` and
`#1665`. Arming either would open a second PR for work already open. See F2.

## WHAT CHANGED

**On the board: nothing merged, nothing armed.** No merge, no auto-merge armed, no label applied or
removed, no arm, no branch update, no PR closed. **Two PRs opened by this run** — `#1667` (the fix in
F1, left for Marco) and this run's own board PR.

**In the dev tree:** nothing. It was already level with `origin/main` (`git rev-list --left-right
--count HEAD...origin/main` -> `0 0`), the index was empty before and after
(`git diff --cached --name-status` EMPTY, `git diff --numstat` EMPTY), and no tracked file was
touched. 179 untracked files, none of them created by this run.

**In isolated worktrees off `origin/main`:** `C:\po-wt\lintfix-1408` (branch
`fix/lint-arm-only-case-insensitive`, PR **#1667**) and `C:\po-wt\board-1408` (branch
`board/00-collect-2026-09-05-1408`) — one SPENT prompt retired to `superseded/`, the 13:30 breadcrumb
archived, and this breadcrumb written **inside the PR** rather than loose in the dev tree, which is
cure 1 of the post-merge fast-forward trap.

## FINDINGS

### F1 — the `Arm ONLY` human-gate marker was case-sensitive, and it admitted a prompt whose body says "Arm only after he answers"

`checkHumanGate()` in `scripts/pipeline/lint-prompt.mjs` tests three markers.
`DO_NOT_ARM_COMMENT` carries `/i`; `DO_NOT_ARM_CAPS` is deliberately CAPS-only; **`ARM_ONLY =
/Arm ONLY/` carried no flag at all.**

[MEASURED] `docs/pr-prompts/pr-devtree-sync-ff-only-guard-HOLD.md` line 45 reads *"Escalated by
Station 00 in its 2026-08-28T08:08Z breadcrumb. **Arm only after he answers.**"* and the linter
returned **`ADMIT`, exit 0, size 2**. That prompt was **this run's arm candidate**. The only thing
that stopped it being armed was RULE 4's second instrument — the independent, case-insensitive grep
of the three-marker union — which returned `'Arm ONLY' -> 1` against a positive control on
`pr-524-rates-b-slice2-canonical-HOLD.md` (`DO NOT ARM -> 2`). **This is the "ADMIT is necessary,
not sufficient" gap with a measured cost attached, and it was one letter wide.**

Blast radius, measured rather than estimated: of the 83 depth-1 prompts, **4** contain a
case-insensitive `arm only` and **1** contains the CAPS form; the other three already REJECT on
another marker. **Exactly one verdict changes**, in the fail-safe direction.

**DISPOSITION: ACTIONED** — `ARM_ONLY` is now `/Arm ONLY/i`, with a regression test for the
lowercase form, in **PR #1667**. Verified: the same file goes `ADMIT` -> `REJECT
[HUMAN_GATE_PRESENT]` naming line 45, `node --test …/lint-prompt.human-gate.test.mjs` is **23 pass /
0 fail**, and the control prompt `pr-stages-s2` still reads `PROMOTE`. **#1667 touches `scripts/`,
which is outside 00's recorded `docs/` lane and outside `NESTED_TEST_PATHS`, so it is Marco's under
§10.1 step 2 — this station opened it and will not merge it.**

### F2 — a second-lane PR never consumes the prompt it was built from, so every one leaves a live duplicate trap

The known defect *"an armed prompt whose PR does not delete it stays armable forever"* has a sharper
cause in the second lane: **the prompt is never armed at all**, so nothing renames it, and its HOLD
sits in the `gates-satisfied` bucket for as long as its PR is open.

[MEASURED] both of today's open PRs are in exactly this state — `#1662` / `pr-plantdays-retire-and-drop-HOLD.md`
and `#1665` / `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md`, basename equal to head branch,
both ADMIT. This is the same shape as the two already-recorded duplicate pairs (#1634/#1639,
#1611/#1637), and it now has a one-line detector: **an ADMIT prompt whose basename matches an open
PR's head branch must not be armed.**

**DISPOSITION: DEFERRED** — the general fix (a queue check that cross-references the ADMIT bucket
against open head branches) is already dispatched to 06 and is not a collect run's work to build.
What is new and belongs on the record is the *cause* — the second lane, not a consumed-but-undeleted
arm — and the detector above, which any run can apply in one query. It becomes urgent the first time
a station arms one of these and opens the duplicate PR.

### F3 — `#1662` and `#1665` are unchanged, still Marco's, still not merged by this run

Re-verified live rather than quoted: both still open, both CLEAN and green (14/0/0), both unlabelled,
neither armed, neither carrying a watcher verdict, both carrying a `migrations/` path. `#1662` drops
five columns — DOCTRINE §5.4 and §8.3 territory regardless of lane; `#1665`'s migration is additive
but §10.1 step 2 governs it and is unambiguous.

**DISPOSITION: ESCALATED** — already filed, nothing to add but the re-verification:
`needs-marco/pr-1662-destructive-migration-open-on-the-board-2026-09-05.md` and
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` (+ `#1635`).
**Do not merge either.** Green checks on an unlabelled second-lane PR are exactly the shape that
looks cleared and is not.

## WHAT I DID NOT DO

- **Armed nothing.** 40 prompts are in the `gates-satisfied` bucket and the queue is empty, so this
  was a live option. The candidate I worked up, `pr-devtree-sync-ff-only-guard-HOLD.md`, turned out
  to carry a written human gate (F1). The strongest remaining candidate,
  `pr-stages-s2-cards-can-share-a-stage-HOLD.md`, is **PROMOTE** and its gate genuinely released
  with `#1664` 100 minutes ago — but it carries `gate_allow: migrations`, `escalates: true` and a
  schema change, and the supervised lane is demonstrably walking this exact cluster right now
  (`#1664` was its s1). Arming it would race that lane for the same slice. **Left for Marco or for
  a run that can see his intent** — it is the top arm candidate on the board and this is the only
  thing standing in its way.
- **Merged nothing.** Both open PRs are Marco's by hand-classification (F3), and `#1667` is mine to
  open and drive, not to merge.
- **Touched neither the watcher clone (`dirty=4`) nor `C:\po-vg` (`dirty=1`, 1816 min, one
  uncommitted file).** Both are already dispatched to 03, both are read-only facts here, and
  `--force` on that worktree would discard real work.
- **Did not clear any `[STALE]` escalation** named by sweep §5. Those are file-level cleanups in
  `needs-marco/`, which is gitignored, and clearing them by hand is how a live escalation gets
  swept up with a dead one.
