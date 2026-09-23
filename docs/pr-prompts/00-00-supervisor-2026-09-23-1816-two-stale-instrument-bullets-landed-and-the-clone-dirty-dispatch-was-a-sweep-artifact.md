# Station 00 — Supervisor | 2026-09-23T18:13:58Z–2026-09-23T18:5xZ

## GROUND

```
UTC            2026-09-23T18:13:58Z
origin/main    dfea18ed            (fetched, then rev-parse)
dev tree       main @ dfea18ed     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was **not** read-only-by-mismatch.

**Read transport, and it was SIGHTED.** Desktop Commander `start_process` shell `powershell.exe`
answered on the first call: `[MEASURED]` `2026-09-24 04:14:25 +10:00` on the host, alongside
`origin/main` read through `git` on that same shell. Every `git`, `gh`, `node` and `.ps1` call in
this run went through Desktop Commander on the Windows host. **This was not a blind run** — stated
explicitly because a blind run and a healthy quiet run both produce "no news".

⚠️ **Clock note.** The host is Brisbane (UTC+10) and its LOCAL date is 2026-09-24. Every timestamp
in this report is **UTC**, so the run is stamped 2026-09-23.

**PREFLIGHT step 2 compliance — the working copy is provably identical to `origin/main`.** The
station doc requires reading the three binding documents from `origin/main`, never the working copy.
`[MEASURED]` `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/stations/00-supervisor.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` → `0	0`. Per PREFLIGHT step 2's own rule no
piped `hash-object` value was compared against anything; `--numstat` EMPTY is the sound form and is
the real answer. All three documents were read **in full** on that basis.

**vm-git-guard.** `[MEASURED]`, exit read from the INSTALLER and not from a pipeline appended to it:

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```
`GUARD_EXIT=2`

**Exit 2 is the EXPECTED station outcome** per the three-outcome table — a FINDING, not a STOP
(F7). **Zero `git` commands were run through the device bridge against the Windows `.git`** in this
run.

**Fresh negative needle minted for this run: `zzQq00Ndl20260923T1830`** → **0** over
`docs/pr-prompts/processed/pr-*.log`, against the POSITIVE control `PR #2040` → **1**. It is
**spent the moment this file is tracked**; the next run mints its own (§9.6).

---

## WHAT I MEASURED

### The sweep, and its verdict is the one I acted under

`scripts/pipeline/status-sweep.ps1`, captured to a file and decoded `utf16le` in node (§9.3 — `*>`
is the same UTF-16LE trap as `>`; the capture was **138,588 bytes / 397 lines** and its `====`
headers parsed only after the utf16le decode).

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 positive controls both PASS (`gh` reached GitHub, saw merged `#2128`; `node` runs), so
the report is usable. Section 3, the single-actor gate: `index.lock` **False / False**, git
processes touching our trees **0**, no PR touched in the last 2 min. Re-read immediately before the
only board mutation this run made (the PR), per the `[LIVE]`-expires rule.

### Q1–Q6, the mandatory answer sheet, answered from live state

| | answer |
|---|---|
| **Q1 open PRs / how many DIRTY** | **1** open: `#2127` `CLEAN`, 15 pass / 0 fail / 0 pending. **ZERO DIRTY.** No frozen CI anywhere on the board. |
| **Q2 is a conflict Marco's?** | N/A — no conflict exists, and no `pr-zzz-resolve-all-dirty-prs` prompt is armed or needed. |
| **Q3 armed prompts, counted myself** | `Get-ChildItem docs\pr-prompts -Filter *-ready.md` with a null guard → **0**. Not quoted from a note. |
| **Q4 every claim from a note re-verified** | Done, and it changed two of them — see F3 and F4 below. |
| **Q5 silent no-ops** | `no-pr-opened/` newest is `2026-09-22T17:25Z` (`pr-scopecards-s7-one-cutting-total-b`), i.e. nothing NEW since the 09-22 entry the preceding runs already dispositioned. No new silent no-op this cycle. |
| **Q6 the ONE thing blocking progress** | **Every path from the queue to `main` now terminates at Marco**: the only green PR is a genuine watcher `marco:true` routing, and all 14 HOLDs reject before their premise is ever reached. Agent-executable supply is **zero** (F5). |

### The board, and why I did not merge the one green PR

`[MEASURED]` `gh pr view 2127 -R <owner>/<repo> --json ...`:
`{"number":2127,"state":"OPEN","mergeStateStatus":"CLEAN","isDraft":false,"labels":[],`
`"headRefName":"fix/field-service-nul-separator","createdAt":"2026-09-23T16:36:48Z"}`.
Files: `apps/api/src/modules/field/field.service.ts` and one prompt retirement under
`docs/pr-prompts/superseded/`.

**§10.1 step 1 — the lane, established before anything else.** `Select-String -Path
docs\pr-prompts\processed\pr-*.log -Pattern 'PR #2127\b'` → **2** hits (POSITIVE control
`PR #2040` → 1 with a real verdict; NEGATIVE control, this run's fresh needle → 0). The verdict,
quoted from the log:

```
[watcher] merge result for PR #2127: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}
```

**Cross-checked against the log's OWN prompt, per the prose-scrape guard** — the same
`processed/pr-field-service-nul-separator-ready.md.log` carries its own PR URL for the **same**
number (`…/pull/2127`), so this is a routing and not a number scraped out of prose.

🔴 **And the reason string is the POLICY form, not the timeout form.** It names the offending path
(`outside tests/ or docs/: apps/api/…`), so it is unambiguously a policy decision rather than
`"timeout waiting for green checks + MERGE verdict"`. **RULE 2 binds absolutely; I did not merge
it and no station may.** It is already green, already mergeable, and already driven as far as an
agent can drive it.

### The queue: nothing armable, and the uniform bucket is real rather than an instrument fault

`scripts/pipeline/triage-holds.ps1` (read-only, `--dequeue` never passed): **14 HOLD, 0 ready,
0 LOOPING**; `spent=0  gates-satisfied=0  still-gated=14  unreadable=0`.

The script prints `!!! SUSPECT: every prompt landed in ONE bucket … the signature of a broken
probe`. **That warning is answered, not ignored:**

- its own two controls PASS in the same run — `GIT control: PASS -- git read
  origin/main:docs/pipeline/DOCTRINE.md (215487 chars)` (so DOCTRINE §9.5's *"a missing `git` makes
  every gate skip"* is excluded) and `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the
  fixture` (so the SPENT bucket is measurable and its zero is a real zero);
- the 14 rejects carry **two distinct codes**, not one: **10 `[HUMAN_GATE_PRESENT]`** and
  **4 `[FILE_GATE_NOT_RELEASED]`**. A broken probe returns one value; this returns two, split
  10/4.

So **0 of 14 are armable**, and arming is the one lever this station has that does not need Marco.

### The watcher and the machines

`[LIVE]` from the sweep: watcher node **RUNNING pid 9744**, auto-restart wrapper **alive (1)**,
heartbeat **92 min** — which with `armed: 0` is **idle-correct, NOT wedged**; the heartbeat ticks
only mid-run. I did **not** run `restart-watcher-if-wedged.ps1 -Fix` and there was no verdict that
would license it.

**The watcher clone is HEALTHY, and the sweep's `dirty=1` is the documented false warning** (F4).
`[MEASURED]` in `C:\po-watcher\ProjectOperations`, both forms in the same minute:

| probe | result |
|---|---|
| `git status --short` — what the sweep counts | **1**: `?? docs/pr-reviews/pr-2127-review.md` |
| `git status --porcelain --untracked-files=no` — what `start-watcher.ps1` counts | **EMPTY** |
| `MERGE_HEAD` / `rebase-merge` / `rebase-apply` | **False / False / False** |
| branch | `main` |

The one file is a review verdict the `rev-<N>` job writes into the clone **by design**.

---

## WHAT CHANGED

**One board mutation: PR opened and merged — a docs-only board PR carrying the two repairs Station
04 dispatched, plus the sweep.** Written in an isolated worktree off `origin/main`
(`C:\po-wt\collect1816`, branch `docs/station-00-collect-1816`), never in the dev tree and never in
the watcher clone.

1. **`docs/pipeline/STATION-CAPABILITIES.md` §6** — 04's F1, option (A). The stale
   `CADENCE`-map paragraph replaced by the landed measurement and its discharge; the
   *"weaker statement about `00`"* warning and the *"filed for Marco"* clause struck; the surviving
   RULE (read the live cron from the MCP, cross against `lastRunAt` anyway) kept with its reason
   restated. `[MEASURED]` byte delta **+624**, `expected=624`, `BYTE_DELTA_OK=true`.
2. **`docs/pipeline/DOCTRINE.md` §9.5** — 04's F2, option (A). The trunk row rewritten as a
   **discharged** instance with `#1852`'s merge evidence, the landed denylist line, the third
   `[CANNOT MEASURE]` verdict state the script now emits, and the finding that the bullet's own
   falsifying probe went thirteen days unrun. The clone row is named as the surviving live instance
   and the headline rule is untouched. `[MEASURED]` byte delta **+1742**, `expected=1742`,
   `BYTE_DELTA_OK=true`.
3. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments` v2 hash re-recorded
   `21240ab808fb7cf9` → `0975b1dd56b1ee8b` via `node scripts/pipeline/lint-station.mjs
   --write-canonical`. `station-contract` v5 `81ddf31ac807132b` **unchanged**, which is itself the
   read-back proving I did not touch that block.
4. **`docs/pipeline/sweep-rotation.json`** — Station 04's own advance, swept in. 04 may not commit
   to the shared dev tree and named it for me; `last_index=1`, `last_run_utc=2026-09-23T18:15:46Z`,
   copied in as a **raw Buffer** (`byteExact=true`, 2837 B).
5. **`docs/pr-prompts/00-04-scanner-2026-09-23-1810-…md`** — 04's breadcrumb, committed so it stops
   being untracked. Raw-Buffer copy, `byteExact=true`, 28640 B. Left at the ROOT: it is this
   cycle's collected input, and the next run archives it.
6. **`docs/pr-prompts/archive/00-00-supervisor-2026-09-23-1730-…md`** — `git mv` of my predecessor's
   breadcrumb, all **5 of 5** findings carrying a disposition (`Select-String 'DISPOSITION:'` → 5,
   `^### F` → 5). Safe for freshness: `check-breadcrumb.mjs` matches `trackedSet` by trailing path
   segment.
7. **This breadcrumb**, written INSIDE the PR worktree — cure 1 of the
   breadcrumb-blocks-the-fast-forward rule, so no loose untracked copy is ever left in the dev tree.

**Read-back after lint:** `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs clean`,
exit **0** (it exited **1** before the hash was re-recorded, which is the gate working).

**Nothing else was touched.** No prompt armed, disarmed, renamed, moved or deleted (`*-ready.md`
count **0** before and after). No label added or removed. No `/sot/` edit. No production data. No
`git` in the watcher clone beyond the read-only `status` / `rev-parse` above. No Azure, Entra or
SharePoint, in any form. Nothing written to any of the five gitignored `docs/qa/` sinks.

---

## FINDINGS

### F1 — `STATION-CAPABILITIES.md` §6 told every station the silence detector was weak for Station 00. The fix landed 26 hours earlier, and the paragraph said it was still filed for Marco.

Station 04's F1, re-verified here rather than taken on trust (DOCTRINE 7.1's re-read rule).
`[MEASURED]` at `dfea18ed`: `git show origin/main:scripts/pipeline/check-breadcrumb.mjs |
Select-String 'const CADENCE ='` → `{ '00': 1, '02': null, '03': 24, '04': 4, '05': 24 }`, and
`gh pr view 2090 --json number,state,mergedAt` → `{"mergedAt":"2026-09-22T16:44:04Z","number":2090,
"state":"MERGED"}`. Confirmed in behaviour too: `--freshness` printed `00 … (cadence 1h) ok`,
`CLEAN`, exit 0.

The expensive half was not the stale sentence but the clause saying the fix was *"filed for Marco
in the needs-marco queue"* — a run doing queue triage on that sentence re-surfaces a discharged item
to Marco, which is the exact cost `#2090` was merged to remove.

**DISPOSITION: ACTIONED.** Landed in this run's board PR as option (A). Verified: the new text is
present, the old headline is gone, byte delta `+624` equals the intended delta exactly, and
`lint-station.mjs` ADMITs the file.

### F2 — `DOCTRINE.md` §9.5 called `#1852` "OPEN and GREEN on the board" for thirteen days. It merged 2026-09-11.

Station 04's F2, re-verified: `gh pr view 1852 --json number,state,mergedAt` →
`{"mergedAt":"2026-09-11T02:11:13Z","number":1852,"state":"MERGED"}`, and the denylist is on
`origin/main` in `scripts/pipeline/status-sweep.ps1`:
`if ($r.workflowName -eq "Dependabot Updates" -or $r.event -eq "schedule") { $otherRuns += $r }`.

The finding underneath the stale sentence is the one worth keeping: **the bullet named the probe
that would kill it, and nobody ran that probe for thirteen days.** A falsifying probe nobody
executes is a comment.

**DISPOSITION: ACTIONED.** Landed as option (A), with the `instruments` canonical hash re-recorded
in the same PR. The clone row is preserved as the surviving live instance so the
*provenance-is-not-correctness* headline keeps a worked example, and the script's third
`[CANNOT MEASURE]` branch is now documented.

### F3 — 04 dispatched F2 as needing a seven-document ship. It did not, and the over-estimate is the kind that makes a cheap repair look expensive enough to defer.

04's F2 says the edit *"forces a canonical-block hash re-record plus a seven-document ship — a
doc-reconcile PR shape"*, and used that cost as its reason for dispatching rather than staging.
The hash re-record is real. **The seven-document ship is not.**

`[MEASURED]` `scripts/pipeline/lint-station.mjs`, anchor `const blocks = isDoctrine ?`:

```js
const blocks = isDoctrine ? ['instruments'] : ['station-contract'];
```

So the **`instruments` block is checked in `DOCTRINE.md` ONLY**; the seven station docs are checked
for `station-contract`, which this edit never touched. Confirmed by the read-back: after
`--write-canonical`, `station-contract v5 81ddf31ac807132b` is **byte-identical** to its recorded
value while `instruments` moved. The block's own comment says as much — *"Stations POINT here; they
do not copy it"* — and it is the `station-contract` comment, not this one, that carries
*"ship all seven together"*.

Cost of believing the over-estimate: 04's own option (C) was *"defer until the next canonical-block
edit rides along"*, and thirteen days is already the measured answer to how long "next time" takes.
**A repair priced as a seven-document reconcile gets deferred; the same repair priced as a
two-file docs PR gets done in the hour.** Nothing in 04's finding was wrong about the defect — only
about what it would cost to fix.

**DISPOSITION: ACTIONED.** Measured, recorded here, and the correct price paid in this PR (3 files,
one of them the hash record). No document change is proposed for this one: the anchor above is the
falsifying probe, and it lives in a script rather than in prose, which is where it belongs.

### F4 — my predecessor dispatched a "dirty watcher clone" to Station 03. The clone is clean, and DOCTRINE §9.5 records this exact mis-route.

`00-00-supervisor-2026-09-23-1730-…md` F4 dispatched to Station 03: *"Prune `C:/po-wt/s9hex` …"*
together with the sweep's `watcher clone: branch=main dirty=1  <-- NOT clean-on-main; the watcher
may refuse to start`.

**The clone half of that dispatch is a sweep instrument artifact, measured above:** `git status
--short` → 1 (`?? docs/pr-reviews/pr-2127-review.md`, an untracked review verdict the `rev-<N>` job
writes into the clone by design), while `git status --porcelain --untracked-files=no` — the form
`start-watcher.ps1` actually uses — is **EMPTY**, with no `MERGE_HEAD`, no rebase state and the
clone on `main`. Both of the sentence's conjuncts are false: an untracked file is not dirt
`start-watcher.ps1` counts, and a tracked-dirty clone auto-stashes rather than refusing.

DOCTRINE §9.5 records **13 verbatim quotations of that sweep line** in `archive/` and names the cost
as *"a MIS-ROUTED DISPATCH, repeatedly"*. This run is the fourteenth occurrence and the first to
catch it before dispatching.

**The worktree half is real and unchanged:** `[LIVE]` `C:/po-wt/s9hex  f878a0a1 (detached HEAD)
dirty=0  age=722 min`.

**DISPOSITION: DISPATCHED — to Station 03, NARROWED.** Prune the orphaned worktree
`C:\po-wt\s9hex` only (detached at `f878a0a1`, `dirty=0`, ~12 h old — re-confirm `git status
--short` in it is empty immediately before pruning; it is 03's call and 03's hands, not mine).
**Do NOT act on the clone-dirty line**: the clone is healthy and the sweep's `dirty=` number is
untracked-inclusive until that script is scoped. Station 03's cadence is daily and it last ran
2026-09-22T23:29Z, so this is the second consecutive run in which the worktree has been named.

### F5 — the board cannot move without Marco, and this is the fifth consecutive hour it has read that way.

Composite, measured this run: **1** open PR, green, carrying a genuine watcher `marco:true` policy
routing; **0** armed; **0 of 14** HOLDs armable (10 human gates, 4 unreleased file gates); `main`
trunk **green** on `dfea18ed`. There is no PR for an agent to fix, none to merge, and no prompt to
arm. The pipeline is working exactly as designed and is producing nothing, because every exit is a
gate only Marco opens.

**DISPOSITION: ESCALATED — deliberately NOT as a new file.** The channel already exists and already
says this, with numbers:
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` and
`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.
`needs-marco/` is already **46** files; a 47th restating the same throughput constraint makes the
queue Marco has to read longer without adding a fact, and the escalation queue's usefulness is
inversely proportional to its length. The escalation-worthy detail this run adds — that the single
green PR is `#2127` and that its routing is the **policy** form rather than the ambiguous timeout
form, so no RULE-2 clearance question arises about it — is recorded here rather than filed, because
it resolves a question rather than raising one.

### F6 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2) again, so the device-bridge `git` ban is remembered rather than mechanical.

`[MEASURED]` exit **2**, headline quoted verbatim in GROUND. Cause, printed by the installer
itself: a station's shell is non-interactive and non-login, so it sources neither `~/.bashrc` nor
`~/.profile` and resolves `/usr/bin/git`. **This is the EXPECTED outcome per the station doc's
three-outcome table — a FINDING to quote and carry on from, never a STOP.**

No action was needed: **zero** `git` commands were run through the device bridge in this run, and
every `git` call went through Desktop Commander on the Windows host, which the shim's reachability
does not affect.

**DISPOSITION: DEFERRED.** What would make it urgent: a run that genuinely needs VM-side `git` — at
which point the one-call form the installer prints is the prescribed cure. Making the ban mechanical
for a non-login shell is a `scripts/` change and therefore Marco's; it is not escalated because it
would be the fifth file saying so and the existing escalation surface already covers the guard.

### F7 — 04's F3 non-reproduction is correct and needs nothing from me.

04 recorded that `gh run list --branch main` did not reproduce its documented staleness, and
correctly declined to retire the bullet: the newest run's `headSha` equalled `origin/main` because
`main` had not moved in ~10.7 h, so the trap's precondition was absent rather than the trap being
dead. Its own probe **N** (short SHA → 0 runs against a truth of 4) reproduced in the same run, so
the per-commit cure is independently re-proved.

**DISPOSITION: DEFERRED**, with 04's own re-test condition adopted unchanged: re-run the pair on an
`instrument-honesty` rotation **after** a day on which `main` actually moved, so the listing has
something to lag behind. Recorded here so the disposition closes rather than being re-derived.

---

## WHAT I DID NOT DO

- **I did not merge `#2127`, and no argument reaches the other conclusion.** It carries a genuine
  watcher `marco:true` verdict, cross-checked against its own prompt log's PR URL, with the policy
  reason string naming the offending path. RULE 2 binds; only Marco merges it. I also did not
  comment on it, label it, or touch its branch — it is already green and already mergeable.
- **I did not arm anything.** 0 of 14 HOLDs are armable, measured, with the triage script's own
  SUSPECT warning answered by its two passing controls and by the 10/4 split across two distinct
  reject codes. Arming a gated prompt because the board is quiet is the failure mode
  `escalates: true`-sweeping already cost this pipeline once.
- **I did not retire or move any HOLD.** `spent=0 of 14` and `0 spent behind a REJECT`, so nothing
  in the queue is superseded work masquerading as pending.
- **I did not open a 47th `needs-marco/` file** for the throughput constraint (F5), and I did not
  clear any existing one. Section 5 of the sweep produced **no `[STALE]` rows at all** this run —
  every row is a `[FILE] cites #N (MERGED) as evidence — not its premise` line, which by the
  script's own wording does not clear anything. There was nothing discharge-able on the tag.
- **I did not prune `C:\po-wt\s9hex` myself.** Worktrees and locks are Station 03's lane; doing 03's
  job is the LL-38 incident. Dispatched.
- **I did not clear any lock.** None existed: `index.lock` False in both trees, 0 scoped git
  processes.
- **I did not restart the watcher.** It is RUNNING with a live wrapper and an idle-correct stale
  heartbeat against `armed: 0`. Restarting on quiet is the 2026-07-13 false emergency.
- **I did not touch `/sot/`.** Station 05's lane, CP-24. `needs-marco/sot02-in-pr-table-is-on-its-
  fifth-refresh-and-rots-within-hours-2026-09-23.md` is 05's and Marco's, not mine.
- **I did not touch Azure, Entra or SharePoint** in any form, read or write.
- **I left the dev tree's two untracked files alone** — `docs/pr-reviews/pr-2119-review.md` (a
  review-lane mirror artifact; the three-homes rule makes the dev tree a legitimate home) and
  `Claude Design/docs/index.html`. Neither is at a path this PR lands, so neither blocks the next
  fast-forward, and deleting another actor's artifact to tidy a `git status` is not a repair.
- **I did not run `smoke-pr.ps1`.** This PR is docs-only; there is no code path for an acceptance
  suite to exercise, and no `apps/web/**` change to capture visual acceptance screens for.
