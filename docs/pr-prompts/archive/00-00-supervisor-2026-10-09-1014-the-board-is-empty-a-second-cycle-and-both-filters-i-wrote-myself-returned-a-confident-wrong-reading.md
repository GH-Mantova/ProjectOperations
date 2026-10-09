# Station 00 — Supervisor | 2026-10-09T10:14Z–2026-10-09T10:3xZ

## GROUND

```
UTC            2026-10-09T10:14:22Z
origin/main    affb1f1b               (git fetch origin, then git rev-parse origin/main)
dev tree       main @ affb1f1b        C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                      (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      1                      (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] One keyword `ToolSearch` for `desktop-commander` loaded the
toolkit; `start_process` shell `powershell.exe` returned a prompt on the first call. No
`CONNECT_TIMEOUT`, no retry needed. This was **not** a blind run.

**Git guard — exit 2, INSTALLED BUT INERT, the expected station outcome.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` -> `EXIT=2`. Last line
quoted verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/determined-bold-lovelace/.local/bin:$PATH" git <args>
```

Its own controls, quoted from the installer: `bash -lc 'command -v git'` ->
`/sessions/determined-bold-lovelace/.local/bin/git` (the shim); `bash -c 'command -v git'` ->
`/usr/bin/git` (the real git -- the shell a station is given). Per the contract's three-outcome
table this is a FINDING, not a STOP. **No `git` ran through the device bridge at any point in this
run**; every git call was on the Windows host through Desktop Commander.

**Binding reads.** [MEASURED] All three read from `git show origin/main:<path>` in the **dev tree**
(`C:\ProjectOperations2`), never the working copy and never the watcher clone:
`docs/pipeline/stations/00-supervisor.md` (466 lines, `station_doc_version: 1`,
`contract_version: 5`), `docs/pipeline/DOCTRINE.md` (508 lines, core),
`docs/pipeline/STATION-CAPABILITIES.md` (687 lines). The cores were read in full; no REFERENCE
section was opened because no core line sent me to one and no section-9 trap was acted on beyond the
two named in F45, whose cures are in the core itself.

**Sweep — SAFE TO ACT, measured twice.** [MEASURED] `scripts/pipeline/status-sweep.ps1`,
`SWEEP COMPLETE 2026-10-09 10:14:55Z`, 470 lines; re-run immediately before the only mutation of
this run, `SWEEP COMPLETE 2026-10-09 10:21:42Z`, 468 lines. Section 0 positive control `[LIVE]` both
times (`gh CAN reach GitHub (saw merged PR #2282)`). Section 7 both times:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

First sweep (10:14:55Z):

- `[LIVE] OPEN PRs: 0` - `[LIVE] ALL OPEN (non-draft): 0`
- **`[LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`** (MARCO_QUEUE_LINE_V1 figure 1)
- `[LIVE] armed (*-ready.md): 0` (MARCO_QUEUE_LINE_V1 figure 2)
- `[LIVE] main CI on affb1f1b: 4 success / 0 failed / 0 running  (trunk green)`
- `[LIVE] watcher node: RUNNING pid 8848` - heartbeat age 44 min - `no build in flight`
- `[LIVE] board lease: free` - `[LIVE] git index.lock interactive/clone: False / False`
- `[LIVE] watcher clone: branch=main tracked-dirty=0 untracked=3`

Second sweep (10:21:42Z), the gate that actually licensed the mutation: `index.lock` False / False,
`no build in flight (newest tick is 51.3 min old)`, `board lease: free`, `armed: 0`, `OPEN PRs: 0`.

**No `[STALE]` escalation row to retire.** [MEASURED] The only `[STALE]` line in either sweep is
section 4C's `no station summary younger than 3 days -- freshest is queue-watch-state.md (09-23
06:09Z, 16.2 days old)`, plus the legend at the top of the report. Section 5 lists 52 `needs-marco/`
files as `[FILE]`, every one of them citing merged PRs **as evidence rather than as its premise**,
which the sweep itself says does not clear the escalation. Nothing is owed to
`retire-escalation.mjs` this cycle.

**COLLECT — one breadcrumb since my last run, and it had already dispositioned itself.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, exit **0**:

```
structure: 1 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
  00  last 2026-10-09T09:13:00Z   1.1h ago  (cadence 1h + grace 0.5h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z  11.2h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-09T06:10:00Z   4.2h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-10-08T22:38:00Z  11.7h ago  (cadence 24h + grace 3h)    ok
```

No MISSED row, so no FRESHNESS_ONE_CADENCE_V1 classification was owed and no scheduled task was
read, run or altered. The single depth-1 breadcrumb is my own previous cycle's
(`...-0913-the-board-is-empty-2278-merged-by-the-supervised-lane-...`), **tracked** on `origin/main`
(`git ls-files --` returns the path, exit 0) because it landed as #2282 at 09:37Z. Its four findings
each already carry a disposition written by their author: F40 ACTIONED (guard inert), F41 ACTIONED
(#2278 merged at 08:50Z by the supervised lane), **F42 DISPATCHED to Station 03** for the 33 stale
worktrees -- next occurrence `2026-10-09T23:02Z`, still pending, deliberately **not** re-dispatched
here -- and F43 DEFERRED (empty board). Nothing in it was left for me to disposition, so it is
archived in this run's PR per the REPORT CONTRACT. **No 03/04/05 finding arrived in the 61 minutes
since.**

**Nothing is armable, and every refusal names its own gate -- identical to the 09:13 reading.**
[MEASURED] `node scripts/pipeline/lint-prompt.mjs` run against all **13** depth-1 `*-HOLD.md`:
**13 of 13 exit 1**, codes `HUMAN_GATE_PRESENT` x8 (`pr-524-rates-b-slice2-canonical`,
`pr-nav-jobs-projects-merge`, `pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`,
`pr-scopecards-s8b-azure-maps-travel`, `pr-sec-a2-email-codes-and-reset-links`,
`pr-siteid-notnull-backfill`, `pr-vendor-invoice-ocr`), `FILE_GATE_NOT_RELEASED` x4
(`pr-fv2-ai-digests`, `pr-fv2-output-channels`, `pr-rates-s11c-drop-legacy-tables`,
`pr-tenant-mt4-s2-ownership-migration`), `GATE_NOT_RELEASED` x1
(`pr-tipid-s3-retire-the-name-guard-for-an-id-check`, whose `requires_on_main` needle
`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` is still absent from
`origin/main`). **Same thirteen, same code split, same one distinct gate as 61 minutes earlier.** So
`armed=0` is the measured state of the board, not an unmeasured one -- and with `OPEN PRs: 0` there
was nothing to merge either.

**Dev tree clean on all four readings the ff rule names.** [MEASURED] in `C:\ProjectOperations2`:
`git rev-list --left-right --count HEAD...origin/main` -> `0  0`; `git diff --numstat origin/main`
EMPTY; `git diff --cached --name-status` EMPTY; `git status --porcelain --untracked-files=no`
(tracked) **0 lines**. 41 untracked paths remain and none of them is a breadcrumb at a path a
fast-forward must create, because this run's breadcrumb was written **inside the PR worktree** --
cure 1 of the fast-forward rule, not the post-merge repair.

## WHAT CHANGED

1. **Board lease TAKEN** as `station-00.scheduled` (`Enter-BoardLease -Actor 'station-00.scheduled'`
   -> `LEASE_RAW=True`), read back against a sweep that reported `board lease: free` 90 seconds
   earlier. `$env:PO_ACTOR` was set to the same string for the whole shell, so the 2026-10-09 #2279
   trap -- a generated `pwsh-<pid>` actor being refused by the station's own lease -- was avoided by
   construction rather than by luck.
2. **Isolated worktree** `C:\po-wt\st00-1014` created off `origin/main` on the Windows FS
   (`WT_HEAD=affb1f1be68ba783c5eda63cf1955c65a76032c8`, `ORIGIN_MAIN` identical, branch
   `docs/board-collect-2026-10-09-1014`) -- not the dev tree, not the watcher clone, not the
   interactive tree.
3. **The 09:13 breadcrumb archived**: `git mv docs/pr-prompts/00-00-supervisor-2026-10-09-0913-....md
   docs/pr-prompts/archive/` inside that worktree, every finding in it already dispositioned.
   `check-breadcrumb.mjs` matches by basename, so it still counts for `--freshness` from `archive/`.
4. **This breadcrumb**, written inside the PR worktree.

Nothing else. No prompt armed, no PR merged, no label added or removed, no escalation retired, no
scheduled task enabled, disabled, run or edited, no worktree pruned.

## FINDINGS

### F44 — the device-bridge git guard reports INERT, which is the expected station outcome and still leaves the ban remembered rather than mechanical

[MEASURED] exit 2, last line and both of the installer's own controls quoted above. The shim is
byte-correct and not on the `PATH` of the non-interactive non-login shell a station is given. This is
the middle of the contract's three outcomes and the one a station actually gets; DOCTRINE section 9.2
records this class of remembered ban as having failed seven times. Exposure this run was zero in fact
as well as in intent: no VM-side git was needed or run.

**DISPOSITION: ACTIONED** — quoted with its exit code and its controls as the contract requires, and
honoured for the whole run.

### F45 — both filters I wrote myself in this run returned a confident, well-formed, WRONG reading, and neither one was empty so section 9.6 never fired

This is one finding with two measurements, because the shape is identical and the cure is the same
sentence in the core.

**(a) A sweep grep that dropped a section header turned three MERGED PRs into three apparent OPEN
PRs.** The sweep's output exceeded the tool's token ceiling, so I filtered it with a pattern of my
own (`'VERDICT|SAFE|...|PR #'`). That pattern matched the `[LIVE]` rows under section 1 but **not**
the `[LIVE] MERGED (most recent 8):` header immediately above them, so #2281, #2280 and #2277 arrived
in my context as indented rows directly beneath
`[LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge`. Read literally that says the board has
three open PRs and Marco's queue is empty -- a coherent contradiction I nearly carried into a merge
decision. [MEASURED] the correction, asking each PR individually per DOCTRINE section 9.4:
`gh pr view 2281/2280/2277 --json state,mergedAt` -> `MERGED 08:29:53Z`, `MERGED 07:42:10Z`,
`MERGED 05:39:07Z`. Then the unfiltered section re-read from the saved output:
`[LIVE] OPEN PRs: 0` / `[LIVE] ALL OPEN (non-draft): 0` / `[LIVE] MERGED (most recent 8):` followed
by eight rows, #2282 first. POSITIVE control: `gh pr view 2278` -> `MERGED 08:50:53Z`, the merge the
09:13 cycle had already recorded.

**(b) A substring match for `ADMIT` labelled 5 of 13 lint REJECTs as ADMIT.** My HOLD loop classified
each prompt by `if ($out -match 'ADMIT')`, and `lint-prompt.mjs` prints the word `ADMIT` inside its
rejection text. Five prompts came back tagged `ADMIT exit=1` on the same line as
`REJECT ... [FILE_GATE_NOT_RELEASED]`. [MEASURED] the exit code was 1 on all thirteen, and the exit
code is the answer: DOCTRINE section 2, *"the exit code decides. You report the exit code. You do not
report your impression of the exit code."*

Both readings were well-formed and non-empty, so section 9.6's *an empty result is not an empty
world* could not catch either. What catches them is cheaper and already written: **a station that
filters an instrument's output owns the filter, so quote the section header with the rows it governs,
and classify on the exit code rather than on text that may contain the verdict word for the opposite
reason.** I am deliberately NOT proposing a doc change: the two rules that cover this are DOCTRINE
section 2 and section 7's *"a broken instrument hands you a confident, coherent, WRONG verdict"*, both
already binding and both already read in full this run. The failure was mine in application, not a gap
in the doctrine, and adding a third account of it is the paraphrase drift
STATION-CAPABILITIES section 3 forbids.

**DISPOSITION: ACTIONED** — both caught before anything was acted on, both corrected by re-asking
with the sanctioned instrument (per-PR `gh pr view`; the exit code), and both recorded here with
their controls so the next cycle reading this breadcrumb inherits the measurement rather than the
mistake.

### F46 — the board is legitimately empty for a second consecutive cycle, and the two readings 61 minutes apart are identical

Not a defect, recorded so a later cycle can distinguish an empty board from an unmeasured one.
`OPEN PRs: 0`, `WAITING ON MARCO: 0`, `armed: 0`, trunk green on `affb1f1b` (4 success / 0 failed /
0 running), watcher `RUNNING pid 8848` with no build in flight, 13 of 13 HOLDs refusing with the same
code split as the 09:13 run. Marco's queue has now been clear across two cycles, so the
MARCO_QUEUE_LINE_V1 call ("there is no limit, the call is yours") did not arise in either.

**DISPOSITION: DEFERRED** — real, and not now. What would make it urgent: a HOLD whose named gate is
satisfied but which still refuses; `armed=0` persisting while `--freshness` shows a station reporting
work it expected to be armed; or the single `GATE_NOT_RELEASED` prompt staying blocked after
`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` reaches `main`. None holds.

## WHAT I DID NOT DO

- **Did not re-dispatch the 33 stale worktrees.** F42 of the 09:13 breadcrumb already dispatched them
  to Station 03 for tonight's `23:02Z` occurrence; re-dispatching an open handover would double-count
  it in the next COLLECT. The three the sweep names with unpushed commits
  (`C:/po-wt/board-lease-wording` 1, `C:/po-wt/fix-2228` 2, `C:/po-wt/stage-prnum` 1) are inside that
  set, and I pruned, force-removed and `git clean`ed none of them -- repairing the machines is 03's
  lane (authority matrix), and a supervisor pruning another station's trees is LL-38 reproduced.
- **Did not arm anything.** 13 of 13 refuse with a named gate; there was no ADMIT to weigh, and lint
  ADMIT would have been necessary rather than sufficient anyway (DOCTRINE section 9.5).
- **Did not merge anything.** `OPEN PRs: 0` on both sweeps -- there was nothing on the board.
- **Did not touch `/sot/`** (Station 05 only) and mixed no `sot/` path into this PR (CP-24).
- **Did not retire any escalation.** No `[STALE]` escalation row; all 52 `needs-marco/` files cite
  merged PRs as evidence, not as premise, which the sweep states does not clear them.
- **Did not enable, disable, run, re-run or edit any scheduled task**, and did not call
  `list_scheduled_tasks` to second-guess a freshness reading that was CLEAN with no MISSED row.
- **Did not call `gh pr update-branch`** on anything.
- **Did not edit DOCTRINE or STATION-CAPABILITIES** over F45 -- see that finding for why.
- **Touched nothing in Azure / Entra / SharePoint, no production data, no secrets.** Absolute.

---

### FOR MARCO

Nothing needs you this cycle, for the second hour running. The board is empty: **0 open PRs, 0
waiting on you, 0 armed**, trunk green on `affb1f1b`, watcher running, all four enabled stations
fresh and aligned.

Still open from earlier cycles, unchanged, both yours:

1. **Should the review verdict's `REVIEWED-SHA` anchor be made content-aware**, so a PR's own CP-26
   receipt commit and no-diff `main` merges do not invalidate the review they accompany? Full
   readings in `needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`.
2. **Who runs Codex against this repo?** It settles both whether `.codex/agents/*.toml` joins
   `lint-station.mjs`'s encoding sweep and whether `AGENTS.md` and `.codex/` should be tracked or
   gitignored. Both paths are still untracked and still not ignored.

And one note: **33 stale worktrees go to Station 03 tonight at 23:02Z**, three of them holding
unpushed commits. 03 is report-only on the machines, so if it reports that a prune would discard
work, that decision lands with you.
