# Station 00 — Supervisor | 2026-09-10T01:09:14Z–2026-09-10T01:3xZ

## GROUND

```
UTC            2026-09-10T01:09:14Z   (first probe on the box; run start)
origin/main    ed7dc38f               (git fetch origin --prune, then git rev-parse --short — no pipe)
dev tree       main @ 640dbdd3        C:\ProjectOperations2   (0 ahead, 2 behind)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run is not read-only by the version rule.

All three binding documents were read **in full**, from the working copy, which is sound this run
because `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
(PREFLIGHT step 2's sanctioned form; no piped hash taken). Read in the DEV TREE, never the clone.

Fresh needle minted for this run: `zzQq00N20260910T0110Zv` — 0 hits on every corpus probed below.
It is spent the moment this file lands.

## WHAT I MEASURED

**Reachability.** [MEASURED] Tool ids resolved by a keyword `ToolSearch` for `desktop-commander`,
not assumed — they resolved under the prefix `mcp__plugin_desktop-commander_desktop-commander__`,
which is *not* the bare `mcp__desktop-commander__` form a literal `select:` would have named.
`start_process` shell `powershell.exe` returned a live shell. **This run was SIGHTED.**

**The device-bridge git guard could NOT be installed — FOURTH consecutive report.** [MEASURED]
`bash …/scripts/pipeline/vm-git-guard.sh` → `bash failed on resume, create, and re-resume …
source path … is under Plan9 share "c" which is not mounted`. Two honest attempts, identical
failure. Per PREFLIGHT this is a FINDING, not a STOP. See F4 — the threshold my predecessor named
has now been crossed, so this run wrote the escalation file rather than mentioning it a fourth time.

**Watcher.** [MEASURED] node pid **13352**, `StartTime 2026-09-09T22:01:02Z`, supervised **three
deep** by parent chain, not by name-matching: `7536 watcher-launcher-singlelane.ps1` →
`19716 start-watcher.ps1` → `13352 node index.mjs`. `status-sweep.ps1` §2 concurs: `watcher node:
RUNNING pid 13352 · auto-restart wrapper: alive (1) · heartbeat age: 1 min`. Idle with 0 armed is
correct, not wedged. **`restart-watcher-if-wedged.ps1 -Fix` was NOT run and no restart condition
existed.**

**Sweep.** [MEASURED] `status-sweep.ps1` captured to a **file**
(`C:\po-sup-fix-scripts\sweep-20260910-0110.txt`, 386 lines) rather than read from the stream,
because it returns early and hides its own §7 verdict. §0 instrument controls both PASS
(`gh CAN reach GitHub`, `node runs`). Verdict: **`CAUTION: 1 LIVE STATION WORKTREE`**.

**Board, live.** [MEASURED] `gh pr list --state open` — **4 open, 0 DIRTY.**

| PR | mergeState | scope | lane | CI |
|---|---|---|---|---|
| `#1834` | CLEAN | `docs/decisions/merge-approvals/1827.md` | receipt for #1827 | 10 pass / 0 fail |
| `#1832` | BLOCKED | `scripts/pipeline/vm-git-guard.sh` (1 file) | watcher-built, **Marco's** | 14 pass / **1 fail** |
| `#1824` | CLEAN | 3 files, all `docs/pr-prompts/` | no log — hand-classified `docs/` | 10 pass / 0 fail |
| `#1823` | CLEAN | `apps/**` EA-GATE permission | watcher, **`marco:true`** | 15 pass / 0 fail |

**Q1 answer: ZERO PRs are DIRTY.** No PR on this board has frozen CI; the board is not
conflict-blocked. **Q3 answer: armed prompts = 0** — `Get-ChildItem docs\pr-prompts -Filter
*-ready.md` returned **`rev-1834-ready.md`** at 01:11Z, an auto-generated REVIEW JOB and not a
prompt (DOCTRINE §9.5); the names were read, not the count. Re-probed at 01:18Z it returned
**nothing at all** — the review build had finished between the two probes, which is the `[LIVE]`
rule in miniature. **Real armed count: 0, at both readings.**

**Q6 answer — the single most important thing:** F1 below. A Station 00 safety hold that stops a
superseded, CP-23-unsatisfiable prompt from being armed exists on exactly one disk, and
`origin/main` still lints that prompt **ADMIT**.

**Collect.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0,
`CLEAN`**, `structure: 24 checked, 0 malformed`:

```
00  last 2026-09-10T00:08:00Z  1.1h ago  (cadence 2h)  ok
03  last 2026-09-09T23:01:00Z  2.2h ago  (cadence 24h) ok
04  last 2026-09-09T22:02:00Z  3.2h ago  (cadence 4h)  ok
05  last 2026-09-09T22:02:00Z  3.2h ago  (cadence 24h) ok
```

`00`'s cadence still reads `2` in that script's own `CADENCE` map against a live hourly cron, so
its `ok` remains a weaker statement than any other row — unchanged, already on file, not re-filed.

**Nothing is uncollected.** [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
gives **25** depth-1 breadcrumbs; every `00-*.md` on disk matches a tracked basename, so
`git ls-files --others` reported **zero** genuinely-unreported artifacts. No station has written a
breadcrumb since `00`'s own 00:08Z run. The 09-09T22:02Z and 23:01Z breadcrumbs from 04 and 03 were
dispositioned by the 23:08Z collect (its F6/F7), and 05's 22:02Z one by the 00:08Z collect (its F3)
— confirmed by reading both breadcrumbs from `origin/main`, not inferred. **This is the first
Station 00 occurrence since the 42-hour hole with an empty collect queue.**

## WHAT CHANGED

**Merged nothing. Armed nothing. Removed no label. Moved, renamed or retired no prompt. Touched no
watcher, no clone, no `/sot/` file, and no worktree but my own.**

Two changes, neither a merge and neither an arm:

1. **`gh run rerun 34423181820 --failed` on `#1832`** — exit **0**, read back `status=in_progress`
   on the *same* head `ba4c4f04`. See F2 for why this is a proven transient and why it cannot
   cause a merge.
2. **This board PR**, built in a disposable worktree off `origin/main`
   (`C:\po-worktrees\collect-20260910-0110`, branch `docs/collect-2026-09-10-0110`) — **never the
   dev tree, never the clone.** The shared dev-tree index was confirmed EMPTY
   (`git diff --cached --name-status`) before anything was touched. It carries the published
   safety hold (F1) and this breadcrumb, written inside the worktree per cure 1 so no loose
   untracked copy is left in the dev tree for the next run to trip on.

**Auto-merge was deliberately NOT enabled on this PR.** Merging is a board mutation and condition 3
is not satisfied (F3).

One write outside the PR: the `needs-marco/` escalation in F4. That folder is gitignored, so it is
dev-tree only — it is the prescribed stop channel, not a reporting channel.

## FINDINGS

### F1 — A Station 00 safety hold exists on exactly one disk, and `origin/main` still lints the prompt it protects as ADMIT

[MEASURED] `docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md` differs from `origin/main` by
`git diff --numstat origin/main` = **`52  0`** — insertions with **zero** deletions, i.e. the
working copy is a strict **superset** of `main` and those 52 lines exist nowhere else.

Those 52 lines are not a draft. They are a `<!-- watcher: do-not-arm -->` marker placed by
**Station 00 on 2026-09-09**, plus the two measured reasons for it, in the file's own words: the
prompt is **superseded** by `pr-ea-s2a-dashboard-preset-seed-HOLD.md` and
`pr-ea-s2b-dashboard-filter-surface-HOLD.md` (arming it would duplicate a 9-file `escalates: true`
slice), and it carries the **CP-23 unsatisfiable shape** — the only one of 6 seed-touching HOLDs on
which that rule fires.

**Both sides measured, and they disagree in the arming direction:**

| tree | marker present | `lint-prompt.mjs` |
|---|---|---|
| dev tree (`C:\ProjectOperations2`) | **true** | `REJECT [HUMAN_GATE_PRESENT]`, **exit 1** |
| `origin/main` (`git show`, linted as a copy) | **false** | `ADMIT`, **exit 0** |

⚠️ The `origin/main` copy was linted under a different filename, so its `ADMIT` is evidence about
the **human-gate check** specifically; the primary evidence is the marker-presence pair, which is a
direct byte test on both blobs.

**Why this is worse than the recorded "dev tree is ahead" trap.** That trap says an arming decision
can be computed against prompt text no clone can see. Here the invisible text is a **safety
marker**, so the error runs in the ARMING direction: every actor that computes arming from
`origin/main` — CI, a clone, a fresh checkout, and **the supervised cloud lane, which DOCTRINE
§10.2's own last bullet says "sees only what is committed to the repo"** — sees `ADMIT` on a prompt
Station 00 has already measured as superseded and unsatisfiable. That lane is live on this board
right now (F3), which is what makes this urgent rather than tidy.

**ACTIONED** — the file is committed **whole** in this PR (Buffer copy, `Buffer.compare` → **0**,
20991 bytes, marker asserted present in the destination after the write). RULE 1: this is the
complete-and-additive option and the only one that passes both halves — publishing a `-HOLD.md`
**cannot start work**, it deletes nothing, and it makes the marker true for every actor at once.
Re-placing the marker per-tree fails the future half; leaving it and warning in prose fails both,
and is exactly how it survived a day. **Falsifying probe:** `git show
origin/main:docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md | Select-String 'watcher: do-not-arm'`
— once this PR merges it must return a hit; if it does not, the publish did not take.

### F2 — The board's only red is a WebKit engine crash, and a sibling PR ran the same job green four minutes earlier

[MEASURED] from the **job log**, never the diff or the PR page (YOUR LIMITS 6). `#1832`'s single
failing check is `tendering-e2e`, run `34423181820`, job `102702832354`. Reading **column 3** of the
tab-separated log per §9.1 — 2694 lines, POS control `Run ` → 15, NEG control the minted needle → 0:

```
1) [webkit] > tests/e2e/tendering.spec.ts:73:7 > Pipeline view shows the IS kanban stage columns
   Error: page.goto: WebKit encountered an internal error
1 failed
##[error]Process completed with exit code 1.
```

**This is a browser-engine crash on `page.goto`, not an assertion failure.** `#1832`'s entire diff
is **one bash file**, `scripts/pipeline/vm-git-guard.sh`, which the e2e suite never executes.

**It is not a main regression, and that was checked rather than assumed** — the rule that a
non-code PR failing a code check proves a MAIN regression is real, so it was tested and refuted:

- `#1823` ran the **same `tendering-e2e` job** and it reads **SUCCESS**, updated `00:53:17Z` —
  four minutes from `#1832`'s failure at `00:57:44Z`, on the same board.
- `Tendering Browser Smoke` on `origin/main` `ed7dc38f` reads **success** (full 40-char SHA passed
  to `gh run list --commit`, per §9.4's short-SHA trap).
- On `#1832`'s own head, `CI` and `CodeQL` both read **success**. Only the WebKit job died.

**The run was confirmed NOT superseded before rerunning** (§9.4): PR head
`ba4c4f04429f9b8dc6e0f197191a97c7add70b81` **equals** the failing run's `headSha`, so a rerun could
not return `cancelled` for that reason.

**ACTIONED** — `gh run rerun 34423181820 --failed`, exit **0**, read back `in_progress` on the same
head at `01:19:02Z`. This is the doctrine-sanctioned action for a proven transient, and it is
squarely this station's lane: the ACTIVE DRIVE MANDATE's rule 2 makes a failed PR mine to fix and
its rule 5 says re-run a transient *before* diagnosing a defect. **It cannot cause a merge** —
`autoMergeRequest` on `#1832` is measured **off**, and `#1832` hand-classifies as **Marco's**
(`scripts/`, outside all three `NESTED_TEST_PATHS` forms), so driving it green is the job and
merging it is not.
⚠️ **The outcome is recorded in WHAT I DID NOT DO, not asserted here** — the rerun had not
completed when this file was written, and a rerun I fired is not a rerun I have seen pass.

### F3 — Condition 3 is cooling but not clear, so `#1824` is deferred a second time — with the test sharpened

My predecessor DEFERRED `#1824` and named the condition for me: *"it becomes urgent only if it is
still open with no live actor."* Both halves measured, twice, seven minutes apart:

| signal | 01:11:44Z (sweep) | 01:18:19Z (re-probe) |
|---|---|---|
| live station worktree `docs-receipt1827` | present, newest file **7 min** old | present, newest file **13 min** old |
| watcher build in flight | `rev-1834-ready.md`, tick 1.3 min | **none** — `*-ready.md` empty |
| remote board activity < 2 min | **yes** (`#1834` OPEN) | no (`#1832` last touched 4.3 min prior) |
| `index.lock` dev / clone | False / False | False / False |
| running `git` processes | 0 | 0 |
| newest `.arming-log.txt` row | `00:07:52Z` | unchanged |

**`#1824` is still open, and the actor is cooling but has not left** — its worktree is still
mounted and it opened `#1834` seven minutes before I looked. Merging `#1824` also fires
`pollForBehindPrs` across the other three open PRs, which would rebase `#1832` *while its rerun is
in flight* and discard the very evidence F2 just produced.

**DEFERRED** — and the test is now sharper than "no live actor", which is unfalsifiable while a
worktree lingers. **The next run should merge `#1824` when all three hold: (a) `C:\po-worktrees\
docs-receipt1827` is GONE or its newest file is older than 60 min; (b) no `*-ready.md` in the queue;
(c) no open PR updated in the last 10 min.** Two of those three were already true at 01:18Z.
Nothing about `#1824` expires, and it is green.

### F4 — The Linux sandbox has now failed on FOUR consecutive station runs, which is the threshold my predecessor named

[MEASURED] this run (two attempts, identical), and by `00` at 23:08Z, `00` at 00:08Z and `05` at
2026-09-09T22:02Z — the same `Plan9 share "c" which is not mounted` string each time.

The 00:08Z run DEFERRED it and set an explicit trigger: *"a fourth consecutive occurrence, or one
coinciding with a blind run, is the point at which it stops being noise and starts being an
outage."* **This run is the fourth.** Deferring again would make that threshold decorative, which is
the failure mode the disposition was written to prevent.

The consequence is bounded and worth stating precisely: the guard exists to stop a VM-side `git`
call leaving a 0-byte `index.lock` with no owning Windows process, and **with no VM there is no such
call to make** — `index.lock` was measured absent in both trees, twice. What it actually costs is
the blind-run COLLECT path in `STATION-CAPABILITIES.md` §3: a future **blind** run has no Desktop
Commander *and* no mount, so its ceiling drops from "can read everything, can mutate nothing" to
genuinely nothing — no breadcrumbs, no RULE 2 probe, no arming log.

**ESCALATED** — `docs/pr-prompts/needs-marco/linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`.
It is infrastructure **outside the repo**, so a breadcrumb mention escalates it to nobody; the file
is what makes it an ask. RULE 1: the complete-and-additive option is to fix the mount so blind runs
keep their documented COLLECT ceiling — it costs no data and closes the future case. Removing the
guard-install step from PREFLIGHT would silence the symptom and fail the future half outright.

### F5 — Three consumed HOLDs are still tracked on `main`, and `git status` cannot tell you which of its own ` D` lines matter

[MEASURED] The dev tree shows four dirty prompt paths. Asking the **right** instrument —
`git diff --numstat origin/main -- <path>`, where EMPTY is the real answer (§9.2) — splits them
cleanly, and `git status` alone would have got **two of the four backwards**:

| path | `git status` | vs `origin/main` | truth |
|---|---|---|---|
| `.arming-log.txt` | ` M` | **EMPTY** | already published by `#1833`. **Not** unpublished work |
| `pr-brandtheme-s5-…-HOLD.md` | ` D` | `0 155`, still tracked | consumed; its PR did not delete it |
| `pr-ea-gate-report-self-filter-HOLD.md` | ` D` | `0 171`, still tracked | consumed; its PR did not delete it |
| `pr-vmgitguard-selftest-…-HOLD.md` | ` D` | `0 116`, still tracked | consumed by `#1832`, still open |
| `pr-ea-s2-dashboard-preset-HOLD.md` | ` M` | **`52 0`** | F1 — a superset, and a safety marker |

The `.arming-log.txt` row is the live instance: reading its ` M` as unpublished work would have
re-committed an arm already on `main`, and restoring it to HEAD — the cure the fast-forward rule
prescribes — would have **silently deleted a line that was not actually local**. The three ` D`
rows are the known stays-armable-forever defect: a consumed prompt whose PR does not delete it
stays tracked, and `pr-vmgitguard-…` is attached to an **open** PR so retiring it now would race
`#1832`.

**DEFERRED** — retiring the two whose PRs have merged is board housekeeping for a run that holds the
board, and this run does not (F3). It becomes urgent if either lints `ADMIT` rather than `STALE`;
neither was armable this run because the real armed count was 0 at both readings. Named here so the
next run does not re-derive the four-way split from `git status` for the sixth time.

### F6 — DOCTRINE §9.1's non-ASCII trap fired inside this run's own instrument, and it ate the line naming the failing test

[MEASURED], by accident and then deliberately. Scanning `#1832`'s job log for failures with a
`node -e` one-liner whose regex contained a non-ASCII `✘` returned **3** matches. The identical
logic moved into a `.mjs` **file** and run with `node <file>` returned **4**. Same log, same
patterns, same machine, seconds apart.

**The dropped line was the one that names which test failed** — `1) [webkit] > tests/e2e/
tendering.spec.ts:73:7 > Pipeline view shows the IS kanban stage columns`. The three survivors were
the generic `Error:`, `1 failed` and `##[error]` lines, i.e. exactly enough to conclude *"the e2e
suite is red"* and not enough to see it was one WebKit crash in one spec. Nothing warned, nothing
was empty, and both forms exited 0 — §7's shape, not §9.6's.

**ACTIONED for this run** (the diagnosis in F2 was taken from the file-based scan, not the
one-liner) and **DEFERRED as a doc edit**: §9.1 already says anything containing `$` goes in a
`.ps1` run with `-File`; the same containment applies to a **non-ASCII needle in `node -e`**, and
that bullet sits inside the `instruments v2` canonical block, which needs its hash re-recorded with
`lint-station.mjs --write-canonical` and shipped on its own. It does not belong in a collect PR.
**Falsifying probe:** re-run both forms against the same log; if the counts ever agree, this is
wrong.

## WHAT I DID NOT DO

- **Merged nothing.** `#1823` carries a live watcher `marco:true` verdict — RULE 2 binds, and its
  `labels=[]` does not clear it. `#1832` hand-classifies as Marco's. `#1824` is mine and green, and
  was left for condition 3 (F3). `#1834` is a receipt PR opened by the live lane.
- **Did not confirm `#1832` went green.** The rerun was `in_progress` at `01:23:29Z`, four minutes
  in, against an original wall time of ~4.5 min. **A rerun I fired is not a rerun I have seen
  pass** — the next run must read `gh run view 34423181820 --json conclusion` before treating
  `#1832` as anything but red, and if it failed again on the same WebKit error, that is a second
  occurrence and the transient reading is dead.
- **Armed nothing**, and did not run `triage-holds.ps1` for arming candidates. Real armed count 0 at
  the start and 0 at the end. Station 04's 09-09T22:02Z F1 — the arming linter giving two opposite
  verdicts on one unchanged prompt eight minutes apart, erring toward ARM — remains unreproduced and
  unrefuted, so arming on a single ADMIT is still acting on an instrument under active suspicion.
- **Did not remove the `do-not-arm` marker** from `pr-ea-s2-dashboard-preset-HOLD.md`, or act on
  either reason behind it. The file itself says deleting that one line clears the hold and that the
  call is Marco's. Publishing the hold and ruling on it are different acts; this run did only the
  first.
- **Did not fast-forward the dev tree** (2 behind) and did not delete its redundant breadcrumb
  copies. That cure ends in a fast-forward of the shared tree another actor is working in.
- **Did not touch the watcher, the clone, `C:\po-vg`, or any worktree but my own**, and did not run
  `restart-watcher-if-wedged.ps1 -Fix`. The watcher verdict was healthy, which is not a restart
  condition. `C:\po-vg` still holds 1 uncommitted file at 8238 min and is already 03's, escalated.
- **Did not prune the six orphaned worktrees** the sweep lists. Pruning is 03's lane and one of them
  holds uncommitted work.
- **Did not commit `docs/data-model/metadata-catalog.json` or `docs/pipeline/sweep-rotation.json`.**
  Neither was measured this run and neither belongs in a PR built off `origin/main` without one.
- **Did not edit DOCTRINE §9** for F6, or any other canonical-block bullet, for the reason F6 gives.
