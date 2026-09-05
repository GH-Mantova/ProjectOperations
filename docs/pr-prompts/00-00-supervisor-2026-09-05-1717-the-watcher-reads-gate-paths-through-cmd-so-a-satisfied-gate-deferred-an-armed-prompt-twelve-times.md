# Station 00 — Supervisor | 2026-09-05T17:08Z–2026-09-05T17:3xZ

## GROUND

```
UTC            2026-09-05T17:08:52Z
origin/main    35c62eb6            (fetched, then rev-parse)
dev tree       main @ 35c62eb6     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Run was **SIGHTED** — Desktop Commander reached the box on the
first call; `start_process` shell `powershell.exe` returned a live prompt. All three binding
documents read in full from the dev tree, which `git diff --numstat origin/main` proved
byte-identical to `origin/main` for all three (EMPTY output).

## WHAT I MEASURED

- **[MEASURED] Sweep.** `scripts/pipeline/status-sweep.ps1` (captured to a file — it returns early
  and hides its own §7 verdict when piped) at `17:09:25Z`: section 0 both controls PASS, §7
  **SAFE TO ACT**. Re-read immediately before the only queue mutation this run made.
- **[MEASURED] Board.** 3 open PRs, all `CLEAN`, all `14 pass / 0 fail / 0 pending`:
  **#1667** (`scripts/pipeline/lint-prompt.mjs` + `scripts/pipeline/__tests__/…`),
  **#1665** (`apps/api/prisma/migrations/…`, +7), **#1662** (`apps/api/prisma/migrations/…`, +5).
  `main` CI on `35c62eb6`: 4 success / 0 failed — trunk green.
- **[MEASURED] RULE 2 probe, live tree pinned** (`C:\ProjectOperations2\docs\pr-prompts\processed`,
  never the clone): 1960 logs, newest `2026-09-05T16:34:08Z` — inside the hour and younger than the
  oldest open PR; POSITIVE `marco.:true` → **612**; NEGATIVE `zzzNoSuchNeedleZzz` → **0**.
  Prompt-log probe excluding `rev-*`: **#1667 → 0**, **#1665 → 0**, **#1662 → 0**;
  NEGATIVE `PR #999999` → 0.
  ⇒ `[NO LANE VERDICT — hand-classified]` for all three. By `classifyPolicyFiles`:
  #1665 and #1662 each carry `apps/api/prisma/migrations/…` (refused on its own clause);
  #1667 carries `scripts/pipeline/lint-prompt.mjs`, outside all three `NESTED_TEST_PATHS` forms.
  §10.1 step 3's station-lane exception does not reach any of them — 00's lane is `docs/`.
  **All three are MARCO'S. I merged nothing.**
- **[MEASURED] Watcher.** `restart-watcher-if-wedged.ps1` → **HEALTHY**, pid 20000 (created
  2026-09-04T19:37Z), wrapper alive, restart churn 0. Not restarted.
- **[MEASURED] Freshness.** `check-breadcrumb.mjs --freshness` exit 0, CLEAN; 00 0.7h · 03 18.2h ·
  04 3.0h · 05 3.0h, all `ok`. ⚠️ 00's row is still computed against `cadence 2h` while its live
  cron is `5 * * * *` — the already-filed `const CADENCE =` defect, not re-raised here.
- **[MEASURED] Collect.** Two breadcrumbs in the queue root, both my own (16:08Z, 16:30Z), both
  already landed on `main` in #1672 / #1673 with every finding dispositioned in-file. No 03/04/05
  breadcrumb has arrived since; theirs were archived by earlier runs. Archived both in this PR.
- **[MEASURED] Dev tree.** `git diff --cached --name-status` EMPTY, `git diff --numstat` EMPTY,
  arming log `origin/main` 54 lines = working copy 54 lines. Nothing of mine left uncommitted.

## WHAT CHANGED

1. **Removed one dead front-matter key** from the armed prompt
   `docs/pr-prompts/pr-claudedesign-s2-spec-regeneration-plan-ready.md`:
   `requires_file_on_main: Claude Design/docs/01-commercial.md`.
   Edited with node by concatenation (never a replacement string — §9.3), written to a temp file
   and renamed. **Byte delta asserted: expected −60, actual −60**; `premise`, `scope` and
   `done_when` all still present; NEGATIVE control absent. This file is gitignored
   (`.gitignore:75`) so the change is a queue mutation, not a commit.
2. Staged `docs/pr-prompts/pr-watcher-gate-path-space-HOLD.md` — **not armed** (see F2).
3. `git mv` of the two collected breadcrumbs into `docs/pr-prompts/archive/`.

Nothing else. **No merge, no arm, no label, no watcher restart, no `/sot/` edit.**

## FINDINGS

### F1 — a satisfied gate deferred an armed prompt twelve times in 59 minutes, and the log said the file was not on main

`C:\po-watcher\watcher-launch.log`, every rescan from `16:42:20Z` to `17:12:20Z`:

```
[deps] pr-claudedesign-s2-spec-regeneration-plan-ready.md deferred:
       file "Claude Design/docs/01-commercial.md" not on origin/main — re-check next rescan
```

The file **is** on `origin/main`, and has been since CD-S1 landed on 09-04.
[MEASURED] `git ls-tree -r --name-only origin/main -- "Claude Design/"` lists it; `git cat-file -e`
exits 0 in the dev tree **and in the watcher clone**, whose `origin/main` was `35c62eb6` — the same
commit as the dev tree, so the per-tree stale-ref explanation (§9.5) is **REFUTED**, not assumed.

**Cause.** `scripts/pr-watcher/index.mjs`, `runGit`:
`spawn("git", args, { cwd: REPO_ROOT, shell: true })`. On Windows `shell: true` concatenates the
argv array into one unquoted `cmd.exe` string, so `origin/main:Claude Design/docs/01-commercial.md`
is re-split at the space. Reproduced with the watcher's own spawn shape and both controls:

| call | `shell` | exit |
|---|---|---|
| `cat-file -e origin/main:Claude Design/docs/01-commercial.md` | `true` | **129** `fatal: too many arguments` |
| `cat-file -e origin/main:CLAUDE.md` | `true` | 0 — POSITIVE control |
| `cat-file -e origin/main:zzzNoSuchNeedleZzz.md` | `true` | 128 — NEGATIVE control |
| `cat-file -e origin/main:Claude Design/docs/01-commercial.md` | `false` | **0** |

`unmetDependencies` catches every non-zero exit and writes one sentence, so **129 (a usage error)
is reported byte-identically to 128 (a genuine absence)**. That is §7's shape exactly: a failed call
wearing an answer's clothes — and §9.6, an empty result read as an empty world.

**ACTIONED.** Removed the dead key (WHAT CHANGED 1). `lint-prompt.mjs` itself names this as one of
its two legal fixes for `FILE_GATE_DEAD` — *"drop the key entirely if the dependency is genuinely
satisfied"* — and it genuinely is. **Read back:** at `17:15:53Z`, one second after the write, the
watcher's file-watch fired and `[start] pr-claudedesign-s2-spec-regeneration-plan-ready.md
(max-turns=240)` — the first time it had got past `[deps]` in 59 minutes.

### F2 — the same defect was already fixed once, in the other copy, eight hours earlier

**PR #1589**, `fix/lint-gate-path-space`, merged `2026-09-04T20:48:58Z`, titled *"read origin/main
gate paths without a shell so paths with spaces work"* — and it changed
`scripts/pipeline/lint-prompt.mjs` only. The watcher's own copy of the identical defect was never
touched. The result is two instruments giving opposite answers about one gate, **and the arming
instrument is the one that says go**: lint ADMITs the prompt for arming, the watcher then defers it
forever, and the run that armed it has no reason to look at the watcher log.

[MEASURED] blast radius: 3136 tracked files on `origin/main`, of which **11** contain whitespace,
under exactly two top-level directories — `Claude Design/` and `docs/`. Every remaining slice of the
CD cluster gates on a `Claude Design/**` path and will deadlock the same way. Of the 89 prompt files
and 37 dep-gate lines live in the queue right now, **0** carry a spaced git path (a first, sloppier
count said 24 — that regex was matching the ` :: ` separator, which `splitRequiresOnMainValue`
strips before git ever sees it; refuted before it was written down). So this is **latent, not
currently firing.**

**DISPATCHED → Station 01, via the queue.** Staged as
`docs/pr-prompts/pr-watcher-gate-path-space-HOLD.md`: remove `shell: true` from all four
`spawn("git", …)` sites in `index.mjs`, plus a `node:test` regression test alongside the eleven
siblings in `scripts/pr-watcher/__tests__/`. **Deliberately NOT armed this run** — RULE 4 is one at
a time and CD-S2 went into `[start]` at 17:15:54Z. The next run arms it once the queue is idle.
Its premise (`grep -q "cwd: REPO_ROOT, shell: true" scripts/pr-watcher/index.mjs`) is TRUE today and
dies on the fix.

### F3 — for a clustered prompt, neither of the two fixes `lint-prompt.mjs` offers is legal

`FILE_GATE_DEAD` prints exactly two legal fixes: re-point at `requires_on_main`, or drop the key.
For `pr-claudedesign-s2` (`cluster_order: 2`), **both are refused**:

- `requires_on_main` reaches git through the *same* `runGit(["show", …])` at the same `shell: true`
  spawn (F1), so lint's first suggestion deadlocks the watcher exactly as `requires_file_on_main`
  did — the suggestion is unusable for any spaced path.
- dropping the key is what I did, and [MEASURED] re-linting immediately afterwards returns
  `REJECT … [CLUSTER_NO_DEP] — cluster_order=2 declares this slice is not first in the chain, but
  no dependency key is set`.

So a clustered slice whose predecessor has already landed, gated on a path containing a space, has
**no lint-clean state at all**. It cost this prompt nothing — the watcher had already started it,
and `cluster_order` has nothing left to order against once CD-S1 is on `main` — but the next author
in that cluster meets the same wall.

**DEFERRED.** F2's fix removes the first horn, which is the one that stalls the machine; the
`CLUSTER_NO_DEP`-vs-`FILE_GATE_DEAD` contradiction is an authoring-time annoyance with no runtime
effect. It becomes urgent the moment a *live* chain needs ordering and cannot express it —
falsifying probe: lint any prompt with `cluster_order > 1` whose only dep key has been dropped.

### F4 — the board is three PRs and all three are Marco's

Not new, and not re-escalated: #1662 and #1665 are the two second-lane PRs whose duplicate `ADMIT`
prompts were recorded by the 15:2xZ run, and #1667 is the code half of the `Arm ONLY` case-
sensitivity finding this station filed at 14:36Z (#1668). All three are green, `CLEAN`, unlabelled,
and carry no watcher verdict. **Nothing on any of them is mine to merge.**

**DEFERRED** — they wait on Marco, which is the correct state, and the standing throughput
escalation already names it.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs hand-classify to Marco (F4). No label touched.
- **Armed nothing.** One prompt was already in flight from `[start]` at 17:15:54Z; RULE 4 is one at
  a time. `pr-watcher-gate-path-space-HOLD.md` is staged and stays HOLD.
- **Did not restart the watcher** — verdict was HEALTHY, and never restart on anything but
  WEDGED/DOWN.
- **Did not touch `C:\po-vg`**, the orphaned worktree the sweep reports holding one uncommitted
  file (`check-pipeline-heartbeat.mjs`, age 1996 min). `--force` would discard it. Still
  dispatched to 03, unchanged.
- **Did not fix `index.mjs` directly.** It is `scripts/pr-watcher/**` — the watcher's own
  lifecycle, outside this station's hands, and outside `tests|docs` so 00 could not merge it
  anyway. It goes through the queue like any other build (F2).
- **Did not clear the 15 `[STALE]` lines** the sweep raises against
  `agent-authored-rule-2-clearance-2026-09-04.md` — that file is the agent-authored blanket RULE 2
  clearance, which standing memory says do not honour and do not revert.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
