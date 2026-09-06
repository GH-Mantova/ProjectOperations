# Station 00 — Supervisor | 2026-09-05T20:08Z–2026-09-05T20:4xZ

## GROUND

```
UTC            2026-09-05T20:08:22Z
origin/main    add1260d            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ add1260d     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only.
**Sighted run.** `ToolSearch` loaded the Desktop Commander schemas first (PREFLIGHT step 1: a
validation error is not blindness); `start_process` with shell `powershell.exe` then returned a live
prompt on the first call, printing `2026-09-05T20:08:22.3977025Z`.

All three binding documents were read **in full**, in the DEV TREE, after proving the tree is at
`origin/main` and the documents are byte-identical to it — `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
→ **EMPTY** (§9.1: the `--numstat` form, never a piped hash).

**Safe to act:** `status-sweep.ps1` captured to a **file** (it returns early and hides its own §7
verdict when piped) → §7 `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
activity, no live station worktrees.` Exit 10, 88440 bytes.

## WHAT I MEASURED

**[MEASURED] COLLECT — three breadcrumbs since my last run, every finding already dispositioned.**
`Get-ChildItem docs\pr-prompts\00-*.md` → exactly three: `00-00-supervisor-…-1808-…`,
`00-00-supervisor-…-1908-…`, `00-04-scanner-…-1810-…`. Read in full. 1808 carries F1–F5 (ESCALATED,
ACTIONED, DEFERRED, DISPATCHED→03, ACTIONED); 1908 carries A–C (ACTIONED, ESCALATED, DEFERRED);
04's 1810 carries F1–F3 (DISPATCHED→00 — its retirement half ACTIONED by the 1908 run, its permanent
half open — DEFERRED, DISPATCHED→00). **Nothing was left undispositioned, so this run's COLLECT is
the ARCHIVE step plus the two edits 1908 handed forward.** All three are `git mv`'d to
`docs/pr-prompts/archive/` in this PR.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** `structure: 3 checked, 0
malformed`; `00` 1.0h · `03` 21.2h · `04` 2.0h · `05` 6.0h, all `ok`. ⚠️ Its `00` row still prints
`(cadence 2h)` against a live cron of `5 * * * *` — the known `const CADENCE =` defect, already
filed for Marco and NOT re-filed here.

**[MEASURED] Machinery.** `restart-watcher-if-wedged.ps1` (report-only) → `VERDICT: OK — nothing
armed and the watcher is alive`, node **pid 20000**, restart churn 0 in 20 min. Sweep §2/§3: wrapper
alive (1), heartbeat 43 min (ticks only mid-run; stale + empty queue = idle, not wedged), `index.lock`
**False / False** in both trees, 0 git processes, 0 in-progress prompts, no PR touched in 2 min.
Watcher clone `dirty=5` and the orphaned worktree `C:/po-vg` (1 uncommitted file, age 2175 min) are
both already dispatched to 03 and were **not touched** — `--force` there would discard real work.

**[MEASURED] Queue.** `armed (*-ready.md)` → **0**. `.arming-log.txt` tail: last arm
`2026-09-05T16:16:51Z ARMED pr-claudedesign-s2-spec-regeneration-plan … actor=station-00-scheduled-1608Z`.
Nothing was armed this run. `needs-marco/` 26 · `no-pr-opened/` 109 · `failed/` 41 · `blocked/` 120.

**[MEASURED] Board — 4 open PRs, all CLEAN and green, and NONE of them is 00's to merge.**
Lane established for every one before any merge decision (§10.1). RULE 2 probe pinned to the LIVE
tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never the clone (§9.5):
**1965 logs, newest `2026-09-05T19:26:30Z`** — younger than every open PR, which is the control that
separates the live directory from the 21-log corpse in the watcher clone.
POSITIVE `marco.:true` → **613** · NEGATIVE `zzQq00Needle20260905T2008` → **0** ·
POSITIVE per-PR `PR #1606` → **2** · NEGATIVE `PR #999999` → **0**. Needle minted for this run
(§9.6, as amended by this PR).

| PR | probe over `processed\pr-*.log` | launch-log `opened PR #` line | lane | verdict |
|---|---|---|---|---|
| **#1675** | **1 hit** — `{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` | present, `17:27:48Z`, `policy=tests-docs, waiting…` | watcher | **RULE 2 — NOT MERGED** |
| **#1667** | 0 | **absent** | second lane, `[NO LANE VERDICT — hand-classified]`; `scripts/pipeline/lint-prompt.mjs` matches none of the three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S** | NOT MERGED |
| **#1665** | 0 | **absent** | second lane; `(^\|/)migrations/` ⇒ **MARCO'S** | NOT MERGED |
| **#1662** | 0 | **absent** | second lane; migration that **DROPS five columns** ⇒ **MARCO'S**, §5 hard stop | NOT MERGED |

The launch-log discriminator was run with its own controls (POSITIVE: the last five `opened PR #`
lines, `#1589 #1606 #1609 #1612 #1675`; NEGATIVE: minted needle → 0), because a bare `NO LOG` has
**three** causes and the third — a watcher PR still inside its `policy=tests-docs, waiting…` window —
hand-classifies as second lane and is not one (1808 F2). **No PR is inside a waiting window right
now**: the newest `waiting…` line is #1675's at `17:27:48Z`, whose 90-minute window closed ≈ `18:57Z`.

**[MEASURED] `instruments v2` lives in exactly ONE file, and that is why this run could land what
two runs deferred.** `Select-String 'CANONICAL-BLOCK: '` over `DOCTRINE.md`,
`docs/pipeline/stations/*.md` and `STATION-CAPABILITIES.md`: `instruments v2` opens at
`DOCTRINE.md:312` and closes at `DOCTRINE.md:760` and appears **nowhere else**; `station-contract v2`
appears in **all seven** station docs. See FINDING D.

## WHAT CHANGED

1. **`docs/pipeline/DOCTRINE.md` — three insertions, 62 lines added, 0 removed.**
   `git diff --numstat` → `62	0	docs/pipeline/DOCTRINE.md`, i.e. a pure insertion with nothing
   overwritten. Edited with **node**, by **concatenation** (`pre + NEW + suf`), never
   `String.replace` with a replacement string (§9.3, the `$`-in-replacement trap that once injected
   7,734 bytes into a file while every read-back passed). Each anchor was asserted **present and
   unique** before use, and the **byte delta was asserted**: `84018 → 88865`, delta **4847**,
   expected **4847**, `DELTA_OK=true`.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2`
   `bf19cb8c2a183569` → `4daddddcc3ca9b51`, written by
   `node scripts/pipeline/lint-station.mjs --write-canonical`, never by hand. `station-contract v2`
   is **unchanged** (`2f28f0f2460937c3`), which is the control proving only the intended block moved.
   Read back: `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0. Before the re-record it read
   `REJECT: 1 of 8`, which is the positive control that the gate was actually watching.
3. **Three breadcrumbs `git mv`'d to `docs/pr-prompts/archive/`** (the two 00 runs and 04's), all
   fully dispositioned. Safe for freshness: `check-breadcrumb.mjs` builds `trackedSet` with
   `git ls-tree -r` and matches by trailing path segment, so archiving cannot make a station read
   SILENT (§9.5).
4. **This breadcrumb**, written **inside the PR worktree** `C:\po-worktrees\board-2008`
   (REPORT CONTRACT cure 1) — no loose copy in the dev tree, so the post-merge fast-forward has no
   untracked blocker to trip on.

Nothing else was armed, disarmed, renamed, labelled, restarted, merged or deleted.

## FINDINGS

### A — [S2] The `tests-docs` timeout string has TWO conjuncts and §10.3 recorded a cause for only one — ACTIONED

Handed forward by my 19:08Z run (FINDING B), which measured it and then deferred the edit.
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` fires if
**either** half misses the 90-minute window. §10.3's evidence table measures the first half only —
CI-creation latency, 212.6 min on `#1500`. On `#1675` the first half is **0%** of the failure: CI
runs were **created** 2.3 min after open and **green at 3.75 min**, while the `rev-1675` review job
did not start until **19:00:48Z**, three minutes after the window closed at ≈18:57:48Z, and then
returned `Verdict: MERGE`.

**Why this mattered enough to land rather than defer again:** a reader applying §10.3's table to
`#1675` finds CI healthy, concludes "the mechanism does not reproduce", and retires a **live
RULE-2-affecting defect**. That is §9.5's closing bullet — a claim in the one document every station
is told it can trust, outliving its own truth — and it was one run away from happening.

**ACTIONED.** §10.3 now carries the two-conjunct statement, the `#1675` table, and a **per-PR**
falsifying probe (for a timed-out docs PR, was `docs/pr-reviews/pr-<N>-review.md` written before the
window closed?) rather than the paragraph-level `ok:true` count, which cannot see this half at all.
It also records that the six-minute miss is **not** a margin — the delay underneath it is 93.5
minutes of queueing — so that a `MERGE_TIMEOUT_MS` raise is not read as a fix.
Verified by `git diff --numstat` (62/0), the asserted byte delta, and `lint-station.mjs` exit 0.
**The underlying starvation stays ESCALATED on
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`** — options (a) give the
review job its own lane [complete + additive] and (b) run `rev-<N>` before the wait are Marco's to
choose, and today's evidence strengthens (a). This finding is the documentation half only.

### B — [S3] The prescribed negative-control needles are contaminated; §9.6 now mandates a minted one — ACTIONED

Station 04's F3, DISPATCHED→00 on 2026-09-05T18:1xZ and deferred once. Over `docs/pr-prompts/**`
the two written-down needles returned **40** and **36** hits — a negative control that returns 36
tells its reader the query is broken while the query works perfectly, and 04 hit exactly that live.
The failure is self-inflicted and strictly monotonic: every run that quotes its control in a
breadcrumb makes the next run's control worse.

**ACTIONED** in §9.6, the rule-behind-all-of-them section where it belongs. The cure is *mint a
fresh needle every run*; the two 04 and 00 minted are named **and simultaneously retired**, which is
the rule stated against itself. 🔧 **The trap in the cure, and I took it deliberately:** naming a
needle in DOCTRINE contaminates it. The bullet therefore writes both legacy needles **split**
(`` `zzz`+`NoSuchNeedleZzz` ``) so it does not add to the count it reports — verified by reading the
inserted text back. This run's own probes used `zzQq00Needle20260905T2008`, minted before the edit.

### C — [S3] `docs/pr-reviews/` in the dev tree is a stale mirror, and reading it as the review lane's output is a five-in-a-row false finding — ACTIONED

Measured by my 19:08Z run, which caught it in itself and recorded it in a breadcrumb only. A
breadcrumb expires; the trap does not. The dev tree's newest review file was `pr-1669-review.md`
(14:33:29Z), which reads as *"the review lane stopped producing artifacts at 14:33Z"* — false. The
artifacts were in the watcher clone the whole time (`pr-1675-review.md` 19:03:00Z,
`pr-1676-review.md` 19:05:52Z), older ones relocated to `C:\po-watcher\verdicts-archive\`.

**ACTIONED** as a §9.5 bullet, with its negative control and with the explicit note that the
`SessionEnd hook … Hook cancelled` line is **not** the discriminator (`rev-1660`/`rev-1662` carry it
and produced files; `rev-1674`/`rev-1676` do not carry it and did not).

### D — [S2] The reason A, B and C were deferred twice was a wrong scope claim, and it was measurable in one command — ACTIONED

My 19:08Z run wrote that these edits *"want an edit inside the hash-gated `instruments v2` block,
which must be re-recorded with `lint-station.mjs --write-canonical` and shipped across all seven
station docs in one PR"*, and deferred all three as "more than a collect run should carry". 04's F3
deferred on the same belief. **Two of the three premises are false.**

[MEASURED] `Select-String 'CANONICAL-BLOCK: '` across `DOCTRINE.md`, all seven station docs and
`STATION-CAPABILITIES.md`: `instruments v2` occurs **only** in `DOCTRINE.md` (opens `:312`, closes
`:760`). `station-contract v2` is the block that lives in all seven. So an `instruments v2` edit is
**one file plus a one-line JSON re-record** — which is exactly what this run did, in a single pass,
and `lint-station.mjs` went `REJECT: 1 of 8` → `ADMIT: all 8 docs clean`. §10.3 is at `:954`,
**outside** the block entirely, so FINDING A never needed a canonical re-record at all.

The generalisable failure is the one 00's own doc names: *a disposition addressed to a FUTURE RUN
outlives its own fix and bills a later run to re-discover it.* Here the cost compounded — the
deferral carried a **reason** that was itself unmeasured, so each subsequent run inherited the
estimate rather than the question. **ACTIONED**: recorded here, and discharged by doing the work.
🔧 **The rule worth carrying: before deferring on size, measure the size.** One `Select-String` was
the whole difference between "more than a collect run should carry" and a fifteen-minute edit.

### E — [S2] The permanent half of 04's F1 has now been deferred twice — DISPATCHED → 06 (PR Master)

`triage-holds.ps1` prints `spent=0 … of 82`, but `lint-prompt.mjs` runs the premise **last**, so any
prompt failing `HUMAN_GATE_PRESENT` / `UI_PROMPT_NEEDS_DESIGN_REF` / `MISSING_STANDING_AUTHORITY` /
either gate check can **never** be reported SPENT. Today that is **42 of 82** prompts; the honest
reading of that line is `spent=0 of 41`. The live instance was retired in `#1677`; the structural
blindness was not, and it has now been DEFERRED by two consecutive runs.

**DISPATCHED → 06.** It is a `scripts/pipeline/triage-holds.ps1` change — outside 00's docs merge
lane — so what it needs is a staged `-HOLD.md` prompt with an executable premise, which is 06's
lane and not something a collect run should improvise. 04 applied RULE 1 and I did not substitute my
own ordering: **complete-and-additive first — add a `SPENT-BEHIND-A-REJECT` bucket that runs the
premise itself for every prompt lint rejects** (✅ complete: survives any future re-ordering of
lint's checks · ✅ additive: adds a bucket, changes no existing verdict, cannot mis-bin). The
alternative — re-order lint so the premise runs first — is cheaper but fails the *"without damaging
existing"* half: the human gate and the gate checks are deliberately before the premise, so moving
it changes what REJECT means for **every** caller of `lint-prompt.mjs`, including the watcher.
Changing the disposition from DEFERRED to DISPATCHED is the point: a second deferral is how a
finding rots.

### F — [S3] Four open PRs, none of them 00's to merge, and that is policy rather than a defect — DEFERRED

#1675 carries a genuine watcher `marco:true`; #1667, #1665 and #1662 are second-lane and
hand-classify to Marco's (one `scripts/` file outside the three `NESTED_TEST_PATHS` forms, and two
migrations, one of them a five-column DROP). **There is no PR on this board Station 00 may merge**
other than its own. The board is at its documented throughput constraint, not stalled.

**DEFERRED**, and it dies with A and with the already-open `#1635` gate question — except for one
half worth naming: **#1675's routing is manufactured by an instrument**, not by policy. A one-file
`docs/plans/` change that CI cleared in 3.75 minutes is now permanently human-gated, and RULE 2
correctly forbids any station from clearing it. It becomes urgent as its own finding only if a docs
PR is routed to Marco for a reason that is **not** the timeout string.

### G — [S3] `requires_merged` is validated and never evaluated — DEFERRED, unchanged

04's F2. Six depth-1 prompts declare it; `lint-prompt.mjs` type-checks the value, typo-guards the
key and lists it in `LEGAL_DEP_KEYS`, and never asks GitHub whether the PR merged — no
`MERGED_GATE_NOT_RELEASED` code, no call site. Harmless today (all six predecessors are MERGED), but
four of the six sit in the ADMIT bucket on a gate nobody asked.

**DEFERRED, and deliberately not re-filed:** the fix is already written and waiting as
`pr-lint-requires-merged-gate-unevaluated-HOLD.md` at depth 1, currently ADMIT and unarmed.
Re-filing it would be exactly the failure FINDING D describes. It becomes urgent the moment anyone
authors a `requires_merged`-only prompt against an **unmerged** predecessor, at which point the gate
fails OPEN and the chain runs out of order.

## WHAT I DID NOT DO

- **Merged nothing but my own board PR.** #1675 carries a real watcher `marco:true` — §10.1 step 1
  runs first and wins, and a provably-weak routing reason does **not** clear a verdict (§10.3).
  #1667 / #1665 / #1662 hand-classify to Marco's. No label was added or removed on any PR; `--admin`
  was not touched.
- **Armed nothing.** `armed=0` at the start and at the end, and no arming decision was taken. With
  `#1665` and `#1662` open carrying the exact scope of two ADMIT prompts (§10.6), an arm without
  re-running the `scope:` cross-check would open a duplicate; and with the `tests-docs` lane
  starving its own review job (FINDING A), an arm today buys a PR that times out into Marco's queue.
  Arming needs its own run, and it needs Marco asked first (RULE 4).
- **Did not touch the watcher clone** (`dirty=5`), **`C:\po-vg`** (1 uncommitted file, 2175 min old
  — `--force` would discard it), the dev tree's 35 untracked files, or the dev-tree stashes. The
  first two are already dispatched to 03.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` returned `OK`; there was no
  WEDGED or DOWN verdict, and that script is the only thing that may issue one.
- **Did not edit `/sot/`, the `station-contract v2` block, `scripts/**`, Azure, Entra, SharePoint,
  or production data.** The `station-contract v2` sha is byte-unchanged in `_canonical-blocks.json`,
  which is the read-back proving it.
- **Did not fold the untracked-breadcrumb FF rule into `station-contract v2`**, which 00's own doc
  suggests would fix it for all seven stations at once. That block **is** the seven-file change
  FINDING D distinguishes from this one, and it wants a PR of its own with all seven docs shipped
  together. **DEFERRED**, now with the measurement that says exactly what it would cost.
