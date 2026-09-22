# Station 00 — Supervisor | 2026-09-22T02:14:11Z–2026-09-22T02:31Z

## GROUND

```
UTC            2026-09-22T02:14:11Z
origin/main    ef00df7c              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ ef00df7c       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. Run was NOT read-only on that account.

**NOT a blind run.** Desktop Commander loaded via `ToolSearch` first, then `start_process` shell
`powershell.exe` returned `main` / `ef00df7c 2026-09-22 docs(pr-prompts): S6 carries Marco's
next-depth-up ruling` on the first call.

**Binding documents read from the working copy, and the working copy was PROVED level with
`origin/main` first** — `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** (no pipe, no
hash comparison — PREFLIGHT step 2). Read in the DEV TREE, never the watcher clone.

## WHAT I MEASURED

**[MEASURED] vm-git-guard installed, and its last line quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
vm-git-guard installed at /sessions/awesome-zen-turing/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

No `git` was run through the device bridge against the Windows `.git` at any point in this run.

**[MEASURED] Sweep — and the FIRST capture was TRUNCATED with no error.**
`.\scripts\pipeline\status-sweep.ps1 *> <file>` inside a `start_process` call hit the Desktop
Commander **180 s** tool timeout, which killed the sweep mid-section-5. The artefact left behind was
86,748 B / 548 lines, **well-formed, alphabetically ordered, and simply missing sections 6 and 7** —
i.e. missing the verdict every station is told to obey. Nothing warned; `MARKER_DECODE_DONE`
printed. Re-launched **detached** (`Start-Process -WindowStyle Hidden`) and polled the file: the
complete run is 158,692 B / 947 lines and took **~4 min**. Both captures decoded `utf16le` (§9.3 —
`*>` is the same UTF-16LE trap as `>`); node reported `UTF16=true` on both.

**[MEASURED] Sweep section 7 verdict, from the COMPLETE capture:**

```
SWEEP COMPLETE 2026-09-22 02:19:56Z
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**[MEASURED] Section 3 of that same complete capture, four lines above the verdict:**

```
[LIVE] watcher build (heartbeat -- reported, NOT a block signal): BUILD IN FLIGHT:
       pr-scopecards-s6-one-cutting-surface-ready.md  (tick 0.6 min old)
```

**[MEASURED] Section 5 — real `[STALE]` escalation rows: ZERO.** A node scan of the complete
capture for `[STALE]` returned **2** lines, both of which are the report's own legend and its
`SWEEP COMPLETE` footer; **no needs-marco file carried a `[STALE]` tag.** POSITIVE control `[LIVE]`
→ 51 lines; NEGATIVE control, a freshly minted needle → 0. The eleven-row dead-escalation backlog
the station doc records as COLLECT's standing work is **cleared** — there was nothing to discharge
this run.

**[MEASURED] Board, live, `-R GH-Mantova/ProjectOperations` on every call with `$LASTEXITCODE`
tested (§9.4 CWD bullet):** 2 open PRs.

| PR | mergeState | mergeable | labels | checks | non-success |
|---|---|---|---|---|---|
| `#2065` `fix/vm-git-guard-honest-reachability` | BLOCKED | MERGEABLE | 0 | 15 | **0** |
| `#2059` `fix/sweep-4c-stale-state-summary` | BLOCKED | MERGEABLE | 0 | 15 | **1 — `tendering-e2e` FAILURE** |

**[MEASURED] Trunk is GREEN, re-derived from its own source rather than quoted from the sweep.**
The sweep printed `main CI on ef00df7c: 0 success / 0 failed / 4 running <-- [CANNOT MEASURE]` at
02:15Z. `gh run list --commit ef00df7cdee49c7fd0d12b25aeec955baa90d557` (full 40-char SHA, §9.4) at
02:28Z returns **4 runs, all `success`** — CodeQL, CI, Deploy, Tendering Browser Smoke. Nothing was
wrong with the sweep; its reading had simply expired.

**[MEASURED] Existence-probe controls, per §9.4.** `gh pr view 2070 --json number,state` → exit 0
`MERGED` (POSITIVE); `gh pr view 999997 --json number,state` → **exit 1** (NEGATIVE — a server-side
field was requested, so the local-answer trap did not fire).

**[MEASURED] Freshness CLEAN, and crossed against `lastRunAt` from the scheduled-tasks MCP.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, `structure: 1 checked, 0
malformed`.

| station | newest breadcrumb | `lastRunAt` (MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-22T01:35Z | 2026-09-22T02:14:11Z | this run |
| 03 | 2026-09-21T23:04Z | 2026-09-21T23:02:53Z | aligned, healthy |
| 04 | 2026-09-21T22:10Z | **2026-09-22T02:09:49Z** | fresh `lastRunAt`, no breadcrumb yet — **04 is mid-run**, not silent |
| 05 | 2026-09-21T14:11Z | 2026-09-21T14:10:40Z | aligned, healthy |

`--freshness` still prints `00 … (cadence 2h)` against a live cron of `5 * * * *`. That is the
known `const CADENCE =` defect already filed for Marco; it is **not** re-filed here.

**[MEASURED] Who armed the prompt that is building.** `docs/pr-prompts/.arming-log.txt`, last row:

```
2026-09-22T02:13:25Z  ARMED  pr-scopecards-s6-one-cutting-surface  escalates=true
actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=19768  caller=powershell.exe:12816
```

**46 seconds before this run fired.** `#2070` (the docs-only PR that put Marco's next-depth-up
ruling into that prompt's HOLD file) merged at `02:12:54Z`, and the arm followed 31 s later.

**[MEASURED] Watcher, re-derived at 02:26:54Z — not quoted from the 02:19Z sweep.** One
`pr-watcher` node, `pid=9744 ppid=17688`. `.queue-state.json` `ts` = `2026-09-22T02:24:11.573Z`
(2.7 min old, inside the 5-min `RESCAN_INTERVAL_MS`), `armed: 1`, `owned: 1`, `runnable: 1` — the
S6 build is still in flight. Wrapper alive (1). No `index.lock` in either tree. No non-main
worktrees, no registry escapees.

**[MEASURED] Dev tree at 02:26:54Z.** `git rev-list --left-right --count HEAD...origin/main` →
`0	0`. `git status --porcelain --untracked-files=no`:

```
 M docs/pipeline/sweep-rotation.json
 M docs/pr-prompts/.arming-log.txt
 D docs/pr-prompts/pr-scopecards-s6-one-cutting-surface-HOLD.md
```

The `.arming-log.txt` modification and the ` D` of the HOLD are the 02:13:25Z arm. **The
`sweep-rotation.json` modification was NOT present at 02:16Z and WAS present at 02:26Z** — it is
Station 04's rotation advance, written by 04's still-running 02:09Z occurrence, left dirty for 00
to commit exactly as its station doc instructs. Nothing here is an FF blocker today: the tree is
already at `origin/main`.

**[MEASURED] Duplicate check before filing anything, with both controls.** POSITIVE control
`DISPOSITION` over `docs/pr-prompts/archive/*.md` → **484** files; NEGATIVE control, a freshly
minted needle over the whole breadcrumb + escalation corpus → **0** files.

## WHAT CHANGED

**One mutation, and it is CI-side only: `gh run rerun 35678866276 --failed` on `#2059`.**
Read back in the same call: `{"attempt":1,"conclusion":"failure","status":"completed"}` →
`{"attempt":2,"conclusion":"","status":"in_progress"}`.

**Nothing else changed.** No prompt armed or disarmed. No PR merged. No branch updated. No commit,
no board PR, no worktree created. `/sot/` untouched. No `git` run against the Windows `.git` from
the VM.

## FINDINGS

### F1 — `#2059`'s branch got a fresh head at 02:16Z and the new CI went RED on `tendering-e2e` six minutes after the sweep read the PR green; the diff is a PowerShell file no browser test can reach, and `main` passes the identical suite

The 02:15:54Z sweep printed `#2059 … CI: 15 pass / 0 fail / 0 pending (green)`. That was true of the
PREVIOUS head. [MEASURED] at 02:28Z: head is `4cc897e4808f960a5b8734ba9f86efe277b42516`, and the
three runs on it were **created 02:16:28–02:16:32Z**, all `attempt: 1` — fresh runs on a new head,
**not** re-runs of the ones my predecessor re-dispatched at 01:3xZ. `Tendering Browser Smoke`
(`35678866276`) failed at `02:22:20Z`.

**Read the job log, never the diff (YOUR LIMITS #6), and searched the LAST tab-column only (§9.1).**
`gh run view 35678866276 --job 106591202290 --log` → 2794 lines. POSITIVE control (`Run ` in the
body column) → **18**; NEGATIVE control, a freshly minted needle → **0**. The entire failure:

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
Error: locator.waitFor: Test timeout of 60000ms exceeded.
1 failed
##[error]Process completed with exit code 1.
```

**One test, and it died in a `beforeEach` setup hook on a 60 s `locator.waitFor` — not on an
assertion about anything this PR changed.** `#2059`'s diff is
`scripts/pipeline/status-sweep.ps1`, a PowerShell file no browser test can reach.

**The main-regression reading is REFUTED, and that matters because the station doc's rule 5 says a
code check failing under an unrelated diff is "instant proof of a MAIN regression".** It is not,
here: `main` at `ef00df7c` ran the **same** `Tendering Browser Smoke` workflow and it came back
`success` (measured above, full SHA). So authoring a `fixes_pr` against `main` would be chasing a
regression that does not exist.

That leaves the known-flake branch of rule 5, and this was **attempt 1**.

**DISPOSITION: ACTIONED** — `gh run rerun 35678866276 --failed` dispatched and read back to
`attempt: 2, status: in_progress` (evidence under WHAT CHANGED). **This is the first honest attempt
on this head.** If attempt 2 fails the same way, rule 5 is exhausted and it stops being a flake:
the next run must treat it as a real defect and root-cause the `beforeEach` hook rather than
re-running a third time. Stated here so the next run does not re-run it blind.

### F2 — THREE actors were live on this board inside my run window, and the safe-to-act gate printed `SAFE TO ACT` with the build-in-flight line four lines above it

[MEASURED] concurrently alive during this run:

1. **`station-00.interactive-0004`** — merged `#2070` at `02:12:54Z` and armed S6 at `02:13:25Z`,
   **46 s before this run fired** (arming-log row quoted above).
2. **The watcher build** it started — `owned: 1`, `runnable: 1`, `ts` 2.7 min old at 02:26:54Z.
3. **Station 04**, mid-run since `02:09:49Z` — proved by its `sweep-rotation.json` advance
   appearing in the dev tree between my 02:16Z and 02:26Z reads.

The station doc's BOARD DRIVING **condition 3** names *"in-progress prompt"* as a stop signal and
says plainly: *"If something else is acting, STOP: that is the LL-38 collision."* The sweep's
section 3 reports the same build and tags it *"reported, **NOT a block signal**"*, and section 7
then prints `SAFE TO ACT: no board mutation in progress`. **The binding document and the instrument
disagree, and the instrument is the permissive one.** I obeyed the document.

**This is a RECURRENCE, not a new finding, and I checked before writing it.** It is already open as
`docs/pr-prompts/needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`,
and already measured in at least four archived breadcrumbs —
`…2026-09-14-0508-the-safe-to-act-gate-printed-safe-six-minutes-after-an-arm-with-a-build-in-flight`,
`…2026-09-21-1814-station-04-was-live-mid-run-and-the-single-actor-instrument-reported-safe-to-act`,
`…2026-09-21-2115-two-lanes-wrote-the-same-fix-for-2061-and-the-single-actor-gate-read-clear-for-both`,
and 04's `…2026-09-10-0610-…-the-safe-to-act-gate-counts-every-git-on-the-box`.

What this instance adds is only that **three** actors, not two, were live at once, and that the
third (04) is invisible to the gate for a different reason from the first two: 04 mutates a
**tracked file** without ever holding a git process, so `git processes touching our trees
(scoped): 0` is a correct reading of the wrong quantity.

**DISPOSITION: ESCALATED** — folded onto the existing
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`
as a third-actor instance. **No new escalation file is created** and no re-derivation is offered;
the question for Marco is unchanged and already on his queue. I did not edit that file this run —
`needs-marco/` is gitignored, so an edit there would reach nobody, and this breadcrumb is the
channel that does.

### F3 — `status-sweep.ps1` runs ~4 minutes, which is longer than the Desktop Commander call timeout, and the truncated capture it leaves is a well-formed report with the verdict section simply absent

[MEASURED] this run: the inline `start_process` capture died at the **180 s** MCP timeout, leaving
86,748 B / 548 lines that end mid-alphabet inside section 5. **Sections 6 and 7 are not truncated —
they are absent**, so a reader who greps for the verdict finds nothing and a reader who does not
grep never notices. Nothing errors; the decode step printed its marker normally. The complete run
is 158,692 B / 947 lines.

This is §9.6's shape with the emptiness manufactured by the transport: an absent verdict reads
identically to a sweep that had no verdict to give. **It is already on file** —
`…2026-09-14-1815-the-expansion-trap-reproduces-on-the-nested-transport-and-a-truncated-capture-hid-the-sweep-verdict`
— so it is not re-filed as new.

The cure that worked, recorded here so the next run does not pay the ~8 minutes twice: **launch the
sweep DETACHED** (`Start-Process powershell.exe -WindowStyle Hidden -ArgumentList …`) and poll the
output file's `Length` until it stops growing, then decode `utf16le` with node. The falsifying probe
is the line count: a complete capture ends with `SWEEP COMPLETE <timestamp>` and contains a
`==================== 7. VERDICT` header; assert **both** before quoting any verdict.

**DISPOSITION: DEFERRED.** The durable fix is a sentence in the PREFLIGHT step-4 block of the
station docs telling every station to launch the sweep detached and to assert the section-7 header
before quoting a verdict. That is a canonical-block edit across all seven station docs, and
condition 3 forbade me opening any PR this run (F2). **It becomes urgent the first time a run
quotes a verdict from a truncated capture** — which is the one failure this finding predicts and
which has not happened yet, because both runs that met it noticed.

### F4 — the watcher's `.queue-state.json` names `#1960` under `conflictedPrs`, and `#1960` has been CLOSED unmerged

[MEASURED] 02:26:54Z, `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`:
`"conflictedPrs": [1960]`. [MEASURED] 02:28:02Z, `gh pr view 1960 --json number,state,mergedAt` →
exit 0, `{"state":"CLOSED","mergedAt":null}` — *"feat(rates): S2 — column settings, move and delete
from the grid header"*. POSITIVE control `#2070` → exit 0 `MERGED`; NEGATIVE control `#999997` with
a server-side field → exit 1.

So the watcher is carrying a conflict entry for a PR that no longer exists on the board. **Nothing
observable is currently blocked by it** — `armed: 1`, `owned: 1`, `runnable: 1`, and the S6 build
started normally — so this is reported, not treated as an incident.

**DISPOSITION: DEFERRED.** `scripts/pr-watcher/**` is the watcher's own lifecycle and outside this
station's hands; 03 is report-only on it. **It becomes urgent if `conflictedPrs` is ever observed
suppressing a runnable prompt** — the probe is `runnable` in `.queue-state.json` reading lower than
the armed count with a closed PR in that array. Today those numbers agree, so it is a stale entry
and not a defect with a victim.

### F5 — COLLECT: Station 04's 02:11Z breadcrumb landed mid-run, after my first freshness read, and all six of its findings are dispositioned here

04's 02:09Z occurrence finished while I was measuring and wrote
`00-04-scanner-2026-09-22-0211-lint-stations-own-neargitignore-guard-suppresses-all-thirty-gitignore-citations-the-item-2-check-would-validate.md`.
It was **absent** from my 02:2xZ `--freshness` read (`structure: 1 checked`) and **present** at
02:32Z (`structure: 3 checked`). Both are UNTRACKED. Nobody but 00 reads these, so each finding gets
a disposition here:

| 04's finding | 04's own call | **00's COLLECT disposition** |
|---|---|---|
| F1 `CITATION_CHECK_SUPPRESSED_BY_NEARGITIGNORE_V1` — `lint-station.mjs`'s own `nearGitignore` guard suppresses 30 of 30 `.gitignore:<N>` citations, so the ITEM 2 check is born inert | ESCALATED | **ESCALATED — confirmed, stands.** Against ITEM 2 of `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`. The cure is in `scripts/pipeline/lint-station.mjs`, outside this station's lane to merge. No new artifact. |
| F2 `LINT_STATION_CORPUS_EXCLUDES_BOOTSTRAPS_V1` — `lint-station.mjs` lints the repo layer only, so no check built there can reach the bootstraps ITEM 1 is about | ESCALATED | **ESCALATED — confirmed, stands.** Same escalation, ITEM 2. This one matters more than F1: it says the gate Marco is being asked to build cannot, by construction, cover the corpus that motivated it. |
| F3 — ITEM 1 unactioned at **day 16**: all four ENABLED bootstraps cite `.gitignore:107-111`; truth is **115–119**, off by exactly eight | ESCALATED | **ESCALATED — confirmed, and I can corroborate it from inside.** My own scheduled-task file carries that exact wrong citation (*"the five gitignored sinks named at `.gitignore:107-111`"*). No new artifact, per the four-identical-reports rule. |
| F4 `ANCHOR_RULE_NEVER_REACHED_THE_BOOTSTRAPS_V1` — the anchor-by-symbol rule landed in all seven station docs and never in the bootstrap layer; `05-sot-keeper`'s bootstrap still carries a raw `pr-gates.mjs:327` | DEFERRED | **DEFERRED — accepted.** It resolves correctly today, so nothing on the board is wrong. Same trigger 04 gives: it becomes urgent the first time one of those bootstrap citations resolves to the wrong line. |
| F5 `REPOPATHS_BLIND_TO_TRAILING_SLASH_V1` — `repoPathsIn`'s existence check is blind to trailing-slash paths, which is how `DOCTRINE.md` writes the queue-lifecycle folders; five do not exist | DEFERRED | **DEFERRED — accepted.** No reference is wrong at the measured SHA, and the cure is the same one-function change as F1, so it should land with it rather than separately. |
| F6 `NEEDS_MARCO_SINK_IS_PARTLY_TRACKED_V1` — `needs-marco/` is ignored by rule yet 6 of 61 files are TRACKED anyway, so "appending there is safe" is false for exactly the files stations write to | ACTIONED (04 reverted its own append same run) | **ACTIONED — verified by me.** `git status --porcelain --untracked-files=no` at 02:26:54Z showed only the three expected entries (the S6 arm ×2 and 04's own `sweep-rotation.json` advance) — **no `needs-marco/` path**, so the revert took and nothing leaked into another actor's commit. |

**Nothing in 04's report required a dispatch, and nothing in it is new work for 00.** Four of six
belong to one open escalation whose two ITEMs are Marco's; the other two are the same
`lint-station.mjs` function.

**DISPOSITION: ACTIONED** — the collect itself is complete: every one of 04's six findings now
carries a 00 disposition in the table above, which is the only channel that closes. ⚠️ **04's
breadcrumb is still UNTRACKED**, so this collect reaches nobody until a board PR commits both
files — see WHAT I DID NOT DO for why I did not open one.

## WHAT I DID NOT DO

- **Armed nothing.** One prompt is already armed and mid-build (`pr-scopecards-s6-one-cutting-surface`,
  armed 02:13:25Z by `station-00.interactive-0004`). ARM ONE AT A TIME, and condition 3 was not
  satisfied in any case.
- **Merged nothing, and did not update either branch.** `#2065` and `#2059` both touch
  `scripts/` — outside `tests|docs` and outside Station 00's recorded `docs/` lane — so under
  `STATION-CAPABILITIES.md` §5 as narrowed at 2026-09-22T00:4xZ (`#2068`,
  `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`) **both are Marco's**. Green-and-unlabelled is
  not authorisation. `#2065` is BLOCKED with 15/15 green, 0 labels and `mergeable: MERGEABLE`; I did
  not run `gh pr update-branch` on it, because that is a board mutation and condition 3 said stop.
- **Opened no board PR, so this breadcrumb is UNTRACKED in the dev tree.** Three actors were live
  (F2); opening a PR would have been the LL-38 collision condition 3 exists to prevent. The
  breadcrumb sits at `C:\ProjectOperations2\docs\pr-prompts\` for the next board PR or
  `sweep-breadcrumbs.ps1` to pick up — **it is not reported until that lands.** A breadcrumb
  filename matches no watcher glob, so leaving it there arms nothing.
- **Archived nothing.** My predecessor's `…-0135-…` breadcrumb has all three findings
  dispositioned and is ready for `archive/`, but the `git mv` needs the board PR I did not open.
  **Two breadcrumbs are therefore left UNTRACKED in the queue root — mine and 04's 02:11Z one
  (F5).** Both are ADMIT under the validator; neither reaches anybody until a board PR commits
  them. The next 00 run (next occurrence `2026-09-22T03:13:52Z`) should sweep both in the same PR
  along with `docs/pipeline/sweep-rotation.json` and the S6 arming artefacts, once 04's run has
  finished and the S6 build has landed.
- **Left `docs/pipeline/sweep-rotation.json` alone.** Station 04's 02:09Z occurrence was still
  running when I measured it; committing another station's advance mid-write is how a half-written
  rotation lands.
- **Discharged no `needs-marco/` file.** Section 5 produced **zero** real `[STALE]` rows, so there
  was nothing to clear — the standing eleven-row backlog is already gone.
- **Did not re-file F2 or F3 as new findings.** Both are open on Marco's queue or on file; the
  duplicate check (484 POSITIVE / 0 NEGATIVE) is what established that before writing.
- **Did not re-run `#2059` a second time**, and did not touch `#2065`'s checks — it has no failures.
- **`/sot/`, Azure / Entra / SharePoint, and production data: untouched.** No `az`, no
  `Connect-MgGraph`, no portal, no prod migration, no seed.
