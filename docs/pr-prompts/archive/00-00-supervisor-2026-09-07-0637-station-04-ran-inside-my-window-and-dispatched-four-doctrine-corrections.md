# Station 00 — Supervisor | 2026-09-07T06:36Z–2026-09-07T06:45Z

**ADDENDUM to `00-00-supervisor-2026-09-07-0608-*`, same run, same station, later measurement.**
Station 04 fired at `06:10:04Z` — inside my window, 99 seconds after my own `06:08:25Z` start — and
its breadcrumb did not exist when I collected. This is the collect for it, and for the
`sweep-rotation.json` advance that run left dirty in the shared dev tree.

## GROUND

```
UTC            2026-09-07T06:36Z
origin/main    f6bfbac4            (fetched, then rev-parse)
dev tree       main @ f6bfbac4     C:\ProjectOperations2   (0 0 against origin/main)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

| claim | how |
|---|---|
| Station 04 ran at **06:10:04Z**, 99 s after 00's 06:08:25Z start | [MEASURED] `docs/pipeline/sweep-rotation.json` advanced `last_index 0 -> 1`, `last_run_utc 02:21:48Z -> 2026-09-07T06:10:04Z`; and 04's own breadcrumb, untracked in the dev tree |
| that advance was **not** on `origin/main` | [MEASURED] `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` -> `2	2` **after** the dev tree reached `f6bfbac4` at `0 0`. Earlier in the same run the same probe was EMPTY, which is what dates the advance to mid-run |
| four stray untracked breadcrumb copies in the dev-tree queue root were byte-identical to their `archive/` blobs on `origin/main` and were deleted | [MEASURED] `git rev-parse origin/main:<archive path>` against `git hash-object <root path>` for each — `f2319202`, `d70f8e0d`, `8017d581`, `a6c71d8f`, equal on both sides in all four cases. No piped hash (§9.1) |
| PRs `#1764` (`e8b80a7e`) and `#1765` (`f6bfbac4`) merged, `06:26:17Z` and `06:30:23Z` | [MEASURED] `gh pr view --json state,mergedAt,mergeCommit`; both via `Assert-SmokedOrEscalate` -> `Merge-Pr`, both exit 0 |

## WHAT CHANGED

1. **Station 04's `06:10Z` breadcrumb is committed**, to `docs/pr-prompts/archive/`. Until this PR it
   existed on exactly one machine's disk.
2. **04's `sweep-rotation.json` advance is committed** — the hand-off 04's station doc requires and
   cannot perform itself.
3. **Four stray untracked breadcrumb copies deleted from the dev-tree queue root**, each proved
   byte-identical to its committed `archive/` blob first.
4. Nothing merged from the open board. Nothing armed. No label touched.

## FINDINGS

### F1 — 04 dispatched four DOCTRINE/CAPABILITIES corrections to me with exact proposed wording, and I am handing them to the next run rather than half-landing them

04's F1, F2, F3 and F7 are all `DISPATCHED -> Station 00` and all land in documents inside 00's
docs lane:

| 04's finding | target | the correction, in one line |
|---|---|---|
| **F1** [S2] | DOCTRINE **§9.1** | the `-Include` bullet's mechanism does **not** reproduce **with** `-Recurse` (measured three ways, incl. a purpose-built fixture). Narrow the bullet to the no-`-Recurse` form; retire nothing |
| **F2** [S2] | DOCTRINE **§9.5** | *"take the newest `*.log` by `LastWriteTimeUtc`"* can select `supervisor.log` — today the second-newest by 45 min, with `opened PR #` = 0 **and** its positive control = 0. Filter to the daily-log name shape first, then take the newest |
| **F3** [S3] | DOCTRINE **§9.4** | through `gh api` the `merged` key on a list entry is **ABSENT**, not `false`. A reader checking the bullet's stated symptom through the prescribed transport reads the trap as dead |
| **F7** [S3] | DOCTRINE **§9.6** | §9 contains a literal instance of every broken query it records, so any §9 probe run **against §9** measures the documentation and inverts the answer. 04 walked into this live and caught it with a control |

**Why I did not land them this run, stated plainly rather than dressed up.** All four sit inside the
hash-gated `instruments v2` canonical block, so they are one document but one re-record
(`lint-station.mjs --write-canonical`) and one careful pass. My run began at `06:08:46Z`; the next
scheduled 00 fires at `07:05Z`. Starting a four-bullet surgical edit of the document every station
is told it can trust, at `06:40Z`, would either be rushed or would still be running when the next
run opens on the same board — which is BOARD-DRIVING condition 3, the one thing that makes a
single-actor design safe.

🔴 **A half-corrected §9 is worse than an uncorrected one**, because the next reader cannot tell
which bullets were reviewed. §10.3 says to hand-land when the content must be exact; it does not say
to hand-land it in the last five minutes of a run.

**DISPOSITION: DISPATCHED — to the next Station 00 run, as its FIRST board action.** This is not a
deferral into the dark: 04's breadcrumb is now **tracked on `main`** and carries the measurement,
the controls, the falsifying probe and the exact proposed wording for each of the four. The next run
does not need to re-derive anything, and if it reads only this table it still knows what to open.
⚠️ **Do not re-measure these from scratch** — 04's controls are quoted in its own file; re-running
them is the falsification step, not the discovery step.

### F2 — 04's F5 widens an open escalation's scope, and 04's F8 re-proves a one-character fix is still open; both are Marco's and neither gets a second file

- **F5** — the cron collision is **structural every four hours**, not the near-midnight triple that
  `needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` describes. `5 * * * *` and
  `0 */4 * * *` collide six times a day by construction; **this run is the live instance** — 00 at
  `06:08:25Z` and 04 at `06:10:04Z`, 99 seconds apart, at 16:08 local and nowhere near midnight. The
  escalation's remedy (move 05) does not touch it; the offset must be applied to **04**.
- **F8** — `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` at `9a905ec6`, so
  `--freshness` will not call 00 SILENT until **4 h**, i.e. after three consecutive missed hourly
  runs — escalation #23's exact failure direction. 04 puts RULE 1 options in order, **(a) derive
  `CADENCE` from the live schedule rather than hard-coding it** first.

Both are `scripts/`- or scheduled-tasks-layer changes, outside this station's merge lane, and both
already have a `needs-marco/` file. **I add no second file and open no second thread** — that is how
a dispatch turns into noise, and it is what 04 explicitly asked for.

**DISPOSITION: ESCALATED — carried, unanswered, to a tracked path.** Both live in a **gitignored**
folder (the 04:08Z run's F2), so this paragraph and 04's own committed breadcrumb are their first
appearance somewhere `origin/main` can see.

### F3 — 04's F6 is a correction to a reading I made in this same run, and it lands in my favour

04 measured, at the top of its run, ` M docs/pipeline/sweep-rotation.json` in `git status` while
`git diff --numstat origin/main -- <path>` returned **EMPTY**, and names the misreading: on a tree
that is behind `origin/main`, `git status` answers a question about **HEAD**, not about
`origin/main`. **My 06:08Z run made exactly that measurement and reached exactly that conclusion**
(WHAT CHANGED item 1 of the `-0608-` breadcrumb: *"7 commits of staleness wearing dirtiness's
clothes"*), independently and ninety minutes apart.

Recorded because agreement between two stations that could not read each other is the strongest
evidence this pipeline produces, and because 04's proposed §9.2 clause is the durable form of a
thing both of us worked out by hand.

**DISPOSITION: DISPATCHED**, folded into F1's DOCTRINE pass as a fifth bullet (§9.2). 04 filed its
own half **DEFERRED**; the difference is that it is now twice-measured.

## WHAT I DID NOT DO

- **Did not edit DOCTRINE or STATION-CAPABILITIES.** F1 says why, and says it as a decision rather
  than an omission.
- **Did not act on 04's F4** (STATION-CAPABILITIES §1, *"the five bootstraps"* should read *"every
  `SKILL.md` behind an ENABLED task in the MCP"*). It goes in the same pass as F1's four.
- **Merged nothing from the open board.** Unchanged from the `-0608-` breadcrumb: every open PR
  hand-classifies as Marco's, none carries a watcher verdict, and the lane that opened them is the
  supervised cloud lane.
- **Armed nothing.** `armed: 0` at the end of this run. The one candidate,
  `pr-triageholds-s2-env-os-is-empty-in-a-station-shell-HOLD.md`, is now tracked on `main` (`#1764`)
  and is armable by the next run.
- **Did not touch `/sot/`, the watcher, the watcher clone, `C:\po-vg`, Azure, production data, or
  any label.**
