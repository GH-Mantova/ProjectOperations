# Station 00 — Supervisor | 2026-09-21T11:08:19Z–2026-09-21T11:22Z

## GROUND

```
UTC            2026-09-21T11:08:19Z
origin/main    eff2af48            (fetched, then rev-parse)
dev tree       main @ 76ed975a     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`). Full authority this run; no read-only downgrade.

**NOT BLIND.** Stated loudly, because three Station 00 runs earlier today (04:10, 07:10, 10:09)
filed blind-run breadcrumbs and a blind run and a healthy quiet run produce the same "no news".

## WHAT I MEASURED

**Reachability.** `[MEASURED]` Desktop Commander `start_process`, shell `powershell.exe`, returned
`UTC 2026-09-21T11:08:19Z` on the first call. Windows shell reached. Every claim below was taken
through that transport with a literal `MARKER_*` echoed after each statement (§9.1 guard 1); every
chain in this run returned all of its markers, so no statement is being reported as "found nothing"
when it in fact never ran.

**VM git guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit 0. Last line quoted verbatim per the contract:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/adoring-upbeat-knuth/.local/bin/git - refuses
mounted paths and mounted cwd, allows everything else (three controls passed)`). **Install PASSED.**

**Binding-document freshness.** `[MEASURED]` `git diff --numstat origin/main -- <path>` in the DEV
TREE after `git fetch origin` — never the piped-hash form, which §9.1 records as unsound in
`powershell.exe`:

| path | `git diff --numstat origin/main` | reading |
|---|---|---|
| `docs/pipeline/stations/00-supervisor.md` | EMPTY | not different |
| `docs/pipeline/DOCTRINE.md` | EMPTY | not different |
| `docs/pipeline/STATION-CAPABILITIES.md` | EMPTY | not different |

All three working copies are byte-identical to `origin/main`, so reading them from disk was safe
this run. `[INFERRED]` That is a property of these three paths, not of the tree — the tree's HEAD
`76ed975a` is six commits behind `origin/main` `eff2af48`.

**Dev tree state.** `[MEASURED]` `git rev-list --left-right --count HEAD...origin/main` → `0 6`.
`git diff --cached --name-status` → EMPTY (nothing staged by another session). `git diff --numstat`
→ seven paths: `docs/pipeline/sweep-rotation.json`, `docs/pr-prompts/.arming-log.txt`, and five
`*-HOLD.md` showing as deleted. **Four of the five deletions match `origin/main`** (`git rev-parse
origin/main:<path>` → `does not exist in 'origin/main'`), i.e. they are the tree being six commits
behind, not a defect. The fifth, `pr-crmvis-s8-comms-threads-HOLD.md`, still resolves on
`origin/main` (blob `9f7164f8`) and was consumed by the 10:33Z arming that produced #2044.

**Watcher.** `[MEASURED]` `scripts\restart-watcher-if-wedged.ps1` (the only sanctioned liveness
probe, §3 / §7 guard 4), 2026-09-21 21:12:53 Brisbane:

```
armed prompts waiting: 1
watcher process:       ALIVE (pid 9744)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
queue last moved:      24 min ago  (rev-2042-ready.md)
heartbeat last write:  3 min ago
VERDICT: HEALTHY - no action.
```

The one "armed prompt" is `rev-2044-ready.md`, an auto-generated REVIEW JOB, not a prompt
(DOCTRINE §9.5). `[MEASURED]` `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'` at depth 1
returned that file alone. **Real armed count is 0.**

**Breadcrumb freshness.** `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness`,
exit 0, `structure: 14 checked, 0 malformed`, verdict `CLEAN`. No station SILENT:
`00` 1.1h (cadence 2h) ok · `03` 10.9h (24h) ok · `04` 1.0h (4h) ok · `05` 10.5h (24h) ok.

**The board, and the lane of every PR on it.** `[MEASURED]` `gh pr list --state open` → exactly two.
Both carry a REAL watcher verdict in `docs/pr-prompts/processed/*.md.log`, so §10.1 **step 1**
decides them and no hand-classification is needed:

| PR | labels | verdict line | lane |
|---|---|---|---|
| #2044 `feat/crmvis-s8-comms-threads` | `do-not-merge` | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | watcher-opened, **Marco's** |
| #2042 `feat/scopecards-s4b-push-panel-ui` | none | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}` | watcher-opened, **Marco's** |

POSITIVE CONTROL on that probe, same corpus: `PR #2040` → returns its own
`{"ok":false,"marco":true,...}` verdict plus a review line. The instrument discriminates, so the two
readings above are real verdicts and not §9.6 emptiness.

**So the supervisor merge lane is EMPTY this run.** RULE 2 binds on both. Neither was merged,
labelled, or touched.

**#2042 checks.** `[MEASURED]` `gh pr checks 2042` → 14 PASS, one PENDING (`tendering-e2e`). Its
`BLOCKED` rollup is checks-pending, **not** a red. There is no CI failure anywhere on the board, so
no job log to read and nothing to fix.

**#2040 / #2044 identity.** `[MEASURED]` `gh pr view` → #2040 **MERGED** 2026-09-21T10:19:28Z.
#2044 **OPEN**, created 2026-09-21T11:09:14Z — fifty-five seconds after this run started.

**Second lane.** `[MEASURED]` `docs/pr-prompts/.arming-log.txt` records five armings today by
`actor=station-00.interactive-0004`, the last at `2026-09-21T10:33:00Z`
(`pr-crmvis-s8-comms-threads`, `escalates=true`). Nothing in that log after 10:33Z. `origin/main`
`eff2af48` is *"docs(pr-prompts): retire the spent crmvis S6 HOLD and publish the S8 arm (#2043)"*.
`[INFERRED]` The interactive lane armed S8, the watcher built it into #2044 during my preflight, and
that lane had gone quiet by the time I mutated anything.

**HOLD census, and a §7 shape worth recording.** `[MEASURED]` HOLDs tracked on `origin/main` = **21**;
HOLDs on disk at depth 1 = **21**. *The totals agree and the membership does not*: set-differencing
the two lists returns exactly one file on disk and not on `origin/main` —
`pr-crmvis-s6-bulk-link-HOLD.md`, the very prompt 04 reported as SPENT. An aggregate count that
matches while the members differ is §7's shape exactly, and comparing only the counts would have
returned a confident "board is in sync".

## WHAT CHANGED

1. **PR #2045 opened and set to auto-merge** —
   *"chore(pipeline): advance sweep-rotation to Station 04's 2026-09-21T10:10Z gate-liveness run"*.
   One file, `docs/pipeline/sweep-rotation.json`, `last_index` 3→0 and `last_run_utc`
   06:11:39Z→10:10:09Z. Built on a **disposable worktree** off `origin/main` at `eff2af48`
   (`C:\po-worktrees\board-00-1108`), never in the shared dev tree (§4, NO-DRIFT). Index read back
   EMPTY before staging; commit made with an explicit pathspec.
   **Read-backs:** `git show --stat HEAD` → `83af7c55`, 1 file, 2 insertions, 2 deletions.
   `gh pr view 2045 --json files` → exactly `docs/pipeline/sweep-rotation.json`, MODIFIED.
   `autoMergeRequest.enabledAt = 2026-09-21T11:16:38Z`, method SQUASH.
   Auto-merge is **enabled, not merged** — this breadcrumb does not claim it reached `main`.
2. **Breadcrumbs swept** — see FINDINGS F1 for the sweep PR and its read-back.

Nothing else. **No prompt was armed, disarmed, renamed or moved. No PR was merged, labelled or
unlabelled. No `do-not-merge` label was removed. No `sot/` file was touched.**

## FINDINGS

### F1 — 04's dispatch: the dev tree was holding four station reports that had reached nobody

Station 04's 10:10Z breadcrumb (F3) dispatched to me: two Station 00 blind-run breadcrumbs, 04's own
breadcrumb, and the advanced `sweep-rotation.json`, all sitting UNTRACKED/DIRTY in the dev tree
because 04's authority row is *Create a PR: NO*.

The rotation half is the one with teeth: uncommitted, `next-sweep.mjs` re-serves `gate-liveness`
every run and the other three sweeps — instruction drift among them — are never reached. That is a
silent, monotonic loss of coverage, and it is invisible because each individual run looks correct.

`[MEASURED]` `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` before I
acted, confirming 04's advance had not reached `main`.

**DISPOSITION: ACTIONED** — rotation landed as **PR #2045** (read-backs under WHAT CHANGED);
breadcrumbs batched by `scripts/pipeline/sweep-breadcrumbs.ps1` into a single PR, per NO-DRIFT.

### F2 — 04's SPENT-prompt dispatch was already discharged on `main`, and the dev tree is why it looked open

04's F4 dispatched me to retire `pr-crmvis-s6-bulk-link-HOLD.md` to `superseded/`.
`[MEASURED]` `git cat-file -e origin/main:docs/pr-prompts/pr-crmvis-s6-bulk-link-HOLD.md` → exit
**128**, *"exists on disk, but not in `origin/main`"*. `origin/main` `eff2af48` is titled
*"docs(pr-prompts): retire the spent crmvis S6 HOLD and publish the S8 arm (#2043)"*.

**It was already retired, by #2043, in the interactive lane.** There is nothing tracked left to move;
a `git mv` here would have been a local no-op that reached nobody, and committing it would have
manufactured a conflict with work already on `main`.

`[INFERRED]` 04 read the dev tree's disk, which is six commits behind `origin/main`, so a discharged
item read as live. This is not a fault in 04's measurement — its instrument is the queue on disk —
but it is the second finding this run that the dev tree's staleness produced.

**DISPOSITION: ACTIONED** — verified already discharged on `main` by #2043; nothing to do. Recorded
so the next run does not re-open it.

### F3 — The fv2 cluster question is now SIX DAYS old and is still the oldest unanswered thing on this board

04 re-measured on 2026-09-15 and again at 10:10Z today: `pr-fv2-ai-digests-HOLD.md` is gated on
`apps/api/src/modules/forms/ai-form-import.service.ts`, ABSENT from `origin/main`, and all three
prompts that could ever produce it are in `superseded/`. The gate cannot release, and it masks
`pr-fv2-output-channels-HOLD.md` behind it. `triage-holds` cannot see either, because lint REJECTs
both before reaching a premise — so they sit in `still-gated=17` looking healthy.

I did not repair the gate, and agree with 04's reasoning for not repairing it: for
`pr-fv2-ai-digests` the dead file gate is the **only** gate, so "repairing" it would immediately arm
a prompt whose cluster Marco has not confirmed is still wanted.

**DISPOSITION: ESCALATED** — Marco. One question, unchanged since 2026-09-15:
**is the fv2 AI-import / digests / output-channels cluster still wanted?**

- **(A) Retire all three to `superseded/` in a board PR.** *Complete and additive*: removes two
  permanently-parked prompts and the dead gate together, ends the masking, destroys nothing —
  `superseded/` is recoverable and the prompts stay readable on `main`. Passes both halves of
  RULE 1. **Recommended.**
- **(B) Re-stage a replacement producer for `ai-form-import.service.ts`, leave both gates as they
  are.** Complete only if the cluster is genuinely still wanted; fails the *immediate* half of
  RULE 1, since the board carries two dead prompts until the producer ships.
- **(C) Repoint the gate at a file that exists.** Fails the *future* half of RULE 1: it arms a
  prompt on the strength of an edit nobody asked for, against a cluster whose status is the open
  question. Not recommended.

### F4 — Both open PRs are Marco's, so arming faster cannot help; the board is human-gated end to end

Measured above: #2042 and #2044 both carry `marco:true`. #2042 is Marco's for the ordinary reason
(`apps/web/**` is outside `tests|docs`); #2044 for the explicit one (`escalates:true`,
`do-not-merge`). The automation can arm, build and green work, and then every PR stops.

This is the standing throughput constraint, already recorded on 2026-08-31 in almost these words. I
am not re-escalating it as new — but it is the reason this run's merge column is empty, and it
should not be mistaken for a quiet board.

**DISPOSITION: DEFERRED** — real, not now, and not mine to solve: the gate is policy, and changing
who may merge `apps/web/**` is a design decision only Marco makes. It becomes urgent if the open
board stops draining — the signal to watch is open-PR age, not open-PR count.

### F5 — Station 00 was blind for three of today's runs and is the only channel that closes a finding

`[MEASURED]` Blind-run breadcrumbs exist for 04:10Z, 07:10Z and 10:09Z; this 11:08Z run reached the
box on its first call. 04 bracketed it to sixty seconds on the 10:09/10:10 pair — same machine, same
Desktop Commander, one blind and one not.

The operational cost is exactly what F2 and F3 show: 00 is the only station that dispositions
anything, so when it is blind, findings queue. A six-day-old escalation and a discharged item that
read as live are both consistent with a degraded collector, and that is worth weighing before anyone
concludes a station is ignoring its breadcrumbs.

**DISPOSITION: DEFERRED** — cause is `[CANNOT MEASURE]` from inside a run that worked, and
`STATION-CAPABILITIES.md` §2 already records it as intermittent with unknown cause. It becomes
urgent the moment a blind run coincides with a WEDGED watcher, because nothing else restarts it.

## WHAT I DID NOT DO

- **Merged nothing.** Both open PRs carry a real `marco:true` watcher verdict; RULE 2 binds and
  #2044 additionally carries `do-not-merge`. I did not remove a label, did not enable auto-merge on
  either, and did not run `Assert-SmokedOrEscalate` / `Merge-Pr` against them.
- **Armed nothing, and disarmed nothing.** Real armed count was 0 and the watcher was HEALTHY, so
  there was no arming decision to make. The one remaining `*-ready.md` is a review job, not a prompt.
- **Did not restart or touch the watcher.** VERDICT was HEALTHY with a 3-minute-old heartbeat;
  restarting on anything short of WEDGED/DOWN is the LL-25 failure.
- **Did not fast-forward the dev tree**, though it is six commits behind and that staleness produced
  two of this run's findings. The untracked breadcrumbs sit at paths the sweep PR will create on
  `main`, which is precisely the documented `merge --ff-only` refusal; the FF is safe to do only
  after that PR lands, and doing it now would manufacture the trap. Named here so the next run
  inherits the reason rather than re-deriving it.
- **Did not repair the fv2 gates** (F3), or the two `docs/approvals/...-approved-by-marco.md` gates,
  which are Marco's signature working exactly as designed and are not dead gates.
- **Did not do 03/04/05's work.** No local-tree cleanup, no audit, no `sot/` edit.
- **Touched no Azure / Entra / SharePoint surface, and wrote no production data.**
- **Did not write to any gitignored sink.** Nothing was written to `docs/qa/qa-findings.md`,
  `qa-checklist.md`, `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md`. Every finding
  above lives only in this tracked-path breadcrumb.
- **Did not run `check-breadcrumb.mjs` against this file**, so this report carries no
  `breadcrumb-clean` claim — the sweep PR's CI `pipeline-tests` job is what validates it.
