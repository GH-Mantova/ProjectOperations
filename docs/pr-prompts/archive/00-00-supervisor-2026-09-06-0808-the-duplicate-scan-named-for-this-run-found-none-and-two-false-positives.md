# Station 00 — Supervisor | 2026-09-06T08:08:20Z–2026-09-06T08:3xZ

Sighted run — Desktop Commander reached the box on the first call. The board was EMPTY on arrival
(0 open PRs, 0 armed) for the second hour running, so this run took the job my predecessor named for
it: the DOCTRINE §10.6 `scope:` cross-check. It found **no duplicates and two false positives**, and
the board then got supply — one prompt armed.

## GROUND

```
UTC            2026-09-06T08:08:20Z
origin/main    85e70f09            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 5ee55dad     C:\ProjectOperations2   -> fast-forwarded to 85e70f09 this run
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version: 1 in the inlined scheduled task)
```

Version check: **MATCH**. Run proceeded at full authority.

All three binding documents were read in full from the working copy, which PREFLIGHT step 2 permits
only on proof of currency. [MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**, taken after the fetch and before the fast-forward. Empty output is the real answer; no
piped hash was taken or compared (§9.1).

## WHAT I MEASURED

**Board** — `scripts/pipeline/status-sweep.ps1`, generated 2026-09-06T08:09:36Z, 266 lines, captured
through `cmd /c "... > file 2>&1"` so the capture is not UTF-16LE (§9.3) and to a file rather than the
stream, because the script returns early and hides its own §7 verdict.

- [MEASURED] §0 controls both `[LIVE]`: `gh` reached GitHub (saw merged #1695), `node` runs.
- [MEASURED] **OPEN PRs: 0. armed: 0.** needs-marco 29 · no-pr-opened 109 · failed 41 · blocked 123.
- [MEASURED] main CI on `85e70f09`: **4 success / 0 failed / 0 running — trunk green.**
- [MEASURED] watcher node RUNNING **pid 17944**, wrapper alive (3), heartbeat age 41 min. Heartbeat
  ticks only mid-run, and the queue was empty, so a stale heartbeat here is **idle, not wedged**
  (§9.5) — and `restart-watcher-if-wedged.ps1` was therefore not run and no restart was attempted.
- [MEASURED] §7 verdict **SAFE TO ACT**, and re-run immediately before the arm (08:1xZ) — still
  SAFE TO ACT, 0 in-progress prompts, `index.lock` False/False in both trees, 0 git processes, no PR
  touched in the last two minutes.
- [MEASURED] `C:/po-vg` still listed as an orphaned worktree (1 uncommitted file, age 2896 min). Not
  re-investigated: its central claim is on file as REFUTED (`23c91ba9`'s content reached `main` as
  `b42dcc36` via #1577). 03's.

**RULE 2 / lane classification: NOT APPLICABLE, and that is a measurement, not an omission.**
[MEASURED] `gh pr list --state open` → **0 rows** (status-sweep §1, `[LIVE]`). With no PR to classify
no `marco.:true` probe was run and none is quoted — a probe against an empty board returns a POS/NEG
pair that proves the instrument works and says nothing about anything. The only PR merged this run is
this run's own board PR, opened by this station in its own `docs/` lane (§10.1 step 3, authority
matrix row *00 / Create a PR / board PRs*).

**COLLECT — nothing new to collect, measured rather than assumed.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`, `structure: 1 checked,
0 malformed`. Newest per station: `00` 07:08Z (1.1 h) · `03` 2026-09-05T23:01Z (9.2 h) · `04`
06:10Z (2.0 h) · `05` 2026-09-05T14:11Z (18.0 h) · `02` dispatch-only. **Every one is at or older
than my predecessor's 07:08Z run**, so 03/04/05 have filed nothing since the last collect and the
queue root held exactly one breadcrumb — my predecessor's own, already merged as #1694.
⚠️ The `00` row's `ok` is the weak one `STATION-CAPABILITIES.md` §6 names: `check-breadcrumb.mjs`'s
`CADENCE` map still holds `'00': 2` against a live cron of `5 * * * *`. Unchanged — it is a
`scripts/` edit, outside 00's merge lane, and already filed as part of escalation #23.

**The §10.6 duplicate scan — the job my predecessor named for this run.** See F1 for the result.
Instrument: `triage-holds.ps1` (its own two controls PASS — `git` read `origin/main:DOCTRINE.md`,
94951 chars; the SPENT bucket proved reachable on a fixture) → `spent=0 gates-satisfied=36
still-gated=38 unreadable=0 of 74`. Then a purpose-written node scan crossed all 36 `ADMIT` prompts'
`scope:` lists against the file lists of the 60 most recently merged PRs (back to 2026-09-05T03:35Z),
all 60 carrying a file list. POSITIVE control: the `-HOLD.md` staged by #1695 appears in exactly 1
merged PR. NEGATIVE control, a minted path: **0**.

**RULE 4's arming detector, all three markers, correct case per marker, with controls.** Marker
sources read from `origin/main:scripts/pipeline/lint-prompt.mjs` **by symbol**, not line number
(§9.5): `DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i` · `DO_NOT_ARM_CAPS =
/DO NOT ARM/` (case-**sensitive**) · `ARM_ONLY = /Arm ONLY/i` (case-**in**sensitive since #1667).
Target `pr-scopesub-s6-the-bars-provisional-split-HOLD.md` → **0 / 0 / 0**.
POSITIVE controls, two of them, so that a single silent regex cannot pass unnoticed:
`pr-524-rates-b-slice2-canonical-HOLD.md` → 0 / **1** / **1**; `pr-siteid-notnull-backfill-HOLD.md`
→ **1** / 0 / 0. NEGATIVE control, minted this run: **0** everywhere, including over the linter
itself. Body read in full — the "Stop and report" section is scope limits and
`## STANDING AUTHORITY` is the boilerplate that sits on ~51 of 61 prompts; **no prose human gate**.

**Fresh needle, minted this run and now spent by appearing here:** `zzQq00Needle20260906T0820` → 0
over `scripts/pipeline/lint-prompt.mjs` and over all three prompts probed. Do not reuse it.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `5ee55dad` → `85e70f09` (one file, the s6 HOLD staged by #1695).
   Neither FF cure was needed — the tree was clean going in, because my predecessor used cure 1 and
   wrote its breadcrumb inside its own PR. Read back all three: `git rev-list --left-right --count
   HEAD...origin/main` → `0 0`; `git diff --numstat` → EMPTY; `git diff --cached --name-status` → EMPTY.
2. **ONE prompt armed** — `pr-scopesub-s6-the-bars-provisional-split`, via `arm-prompt.ps1`
   (`-WhatIf` first, exit 0, `PROMOTE` + `GATE_RELEASED`; then for real), **never a bare `git mv`**.
   Actor `station-00-scheduled-0808Z`. Read back: the queue holds exactly one `*-ready.md` and it is
   this one; `git diff --cached --name-status` EMPTY afterwards (the script releases its own staged
   rename by design); `.arming-log.txt` gained
   `2026-09-06T08:17:13Z ARMED pr-scopesub-s6-the-bars-provisional-split escalates=false
   actor=station-00-scheduled-0808Z by=Marco@LAPTOP-E6NHU4E4 pid=31980`.
3. **The arming log is committed in this PR**, per §9.5 — the bullet whose whole defect is that
   nothing commits it on purpose. Copied byte-exact (`Buffer.compare` → identical, 7939 B).
4. **DOCTRINE §10.6 gained one measured note** (F1), inserted by **concatenation**, never a
   `String.replace` replacement string (§9.3). Byte delta asserted: 94951 → 96480, `delta=1529`,
   `expected=1529`, **DELTA_MATCH=true**; anchor still present exactly once, head and tail intact,
   negative control absent. The edit is **after** `<!-- END-CANONICAL-BLOCK: instruments v2 -->`, so
   no canonical hash moved — confirmed by `node scripts/pipeline/lint-station.mjs` → exit **0**,
   `ADMIT: all 8 docs clean`.
5. **My predecessor's 07:08Z breadcrumb archived** — every finding in it carries a disposition.
6. **This breadcrumb written inside this PR's worktree** (REPORT CONTRACT cure 1), so no loose copy
   is left in the dev tree to block the next fast-forward.

**Not changed:** no label added or removed, no `/sot/` edit, no production data, no Azure / Entra /
SharePoint, no watcher restart, **no write of any kind in `C:\po-watcher`**, nothing in `C:\po-vg`,
no `scripts/` change, no prompt retired or moved, and no merge of anything but this station's own
docs-lane board PR.

## FINDINGS

### F1 — the `scope:` cross-check my predecessor named for this run is VACUOUS over merged PRs, and its two FULL matches are both false positives. **S2 — ACTIONED.**

My predecessor's 07:08Z breadcrumb closed with an instruction to this run: *"The correct next step is
the `scope:`-list cross-check section 10.6 prescribes against `gh pr list --state merged` — a full
sweep of its own … Named here so the next run can take it as its primary job."* I ran it. The result
is worth more than the zero it returned, because **§10.6 does not say `--state merged`** — it says
the premise *"dies on MERGE, not on OPEN"*, and prescribes the cross-check against **open** PRs.

[MEASURED] over all **36** `ADMIT` prompts against the **60** most recently merged PRs:

| overlap | prompt | matched against | why it is NOT a duplicate |
|---|---|---|---|
| **8 of 8** | `pr-vmguard-s2-preflight-installs-guard` | `#1694` (14 files) | #1694 is my own predecessor's citation sweep; it edited those same 8 station docs for an unrelated reason. Premise `! grep -q "vm-git-guard" docs/pipeline/stations/00-supervisor.md` is still **TRUE** — lint **ADMIT**, not exit 3 |
| **1 of 1** | `pr-ci-rerun-on-unlabel` | `#1689` (8 files) | #1689 touched `.github/workflows/ci.yml` among eight. Premise `! grep -q "unlabeled" .github/workflows/ci.yml` still **TRUE** |

Both prompts' scope blocks were read by eye afterwards to rule out a parser fault, and both parsed
correctly. **A merged PR's file list carries no information about *why* a file changed**, so over
merged work the file-overlap test has a false-positive rate that swamps it — and the two loudest
rows it produced would each have sent a run to retire a live prompt.

**What actually catches a merged duplicate is the PREMISE, and `lint-prompt.mjs` already runs it.**
That is the SPENT bucket, exit 3 — which caught all four instances unaided at 06:0xZ and reported
`spent=0` today. The scope cross-check earns its keep only where the linter cannot help: an **open**
PR, whose premise is still alive. Today `gh pr list --state open` → 0, so it had nothing to say.

**ACTIONED** — the correction is landed in `DOCTRINE.md` §10.6 in this PR, with the measurements and
both controls, so the next run inherits the result instead of re-deriving it. It is written as a
note *under* §10.6 rather than a rewrite of it, because the section's own text was never wrong; the
paraphrase in a breadcrumb was.

### F2 — the board was EMPTY for the second hour running; the constraint is SUPPLY, and I armed one. **S2 — ACTIONED.**

- **Q1 (every open PR + `mergeStateStatus`):** the list is empty. **DIRTY count = 0.** No red, no
  conflict, no behind-branch, nothing routed to Marco waiting.
- **Q3 (count the armed prompts yourself):** `armed (*-ready.md): 0`, measured on disk, not quoted.
- **Q5 (silent no-ops):** `no-pr-opened/` holds 109, newest **2026-09-02T13:47Z** — four days old, so
  nothing new was produced this cycle and none is a live failure of this run. Stated, not waved away.
- **Q6 (the one thing blocking progress):** nothing blocks the board. **The queue was starving it.**

My predecessor declined to arm and said why: it could not rule out that the `ADMIT` bucket held
duplicates of already-merged second-lane work. F1 rules that out — measured, with controls — so
the reason for the abstention is discharged and arming is the correct move.

Armed: **`pr-scopesub-s6-the-bars-provisional-split`**. Chosen because it is the freshest staged work
(#1695 merged 07:47Z, twenty minutes before this run), it is the next slice of a cluster the second
lane shipped through overnight (`cluster_order: 6`; s5 merged as #1690 at 05:46Z), it carries an
approved `design_ref`, its one `requires_on_main` gate reports `GATE_RELEASED` against `origin/main`,
and it is **web-only with `gate_allow: none`** — no migration, no API surface, no production data.
§10.6's own test is vacuous for it (0 open PRs to collide with), and it appears in no
`superseded/`, `blocked/`, `failed/`, `no-pr-opened/` or `needs-marco/` file.

⚠️ It touches `apps/web/**`, so `classifyPolicyFiles` will route its PR **to Marco** — that is
correct and expected, and it is the throughput constraint this board has had recorded against it
since 2026-08-31, not a defect in this arm.

**ACTIONED** — armed, read back, arming log committed here.

### F3 — 42 review verdicts sit UNTRACKED in the dev tree, which is the "three homes" defect still producing. **S3 — DISPATCHED → Station 03.**

[MEASURED] `git status --porcelain` in `C:\ProjectOperations2` lists **42** untracked
`docs/pr-reviews/pr-<N>-review.md` files, spanning `#1535` to `#1691`. §9.5 records the cause: the
`rev-<N>` review job runs in the watcher's clone but its verdict can land in any of three homes, and
the watcher's mirror step reads only the clone — `verdict mirror skipped` 68 times in
`watcher-launch.log`, twelve of them on 2026-09-05 alone. These 42 are the dev-tree half of that,
accumulated and never committed by anything.

They are not lost and nothing is blocked by them: `verdictApproves` reads the clone, and every one of
these PRs has already merged. What they are is **evidence a reviewer cannot re-open** — the review
happened, and the artifact exists only on one disk.

**DISPATCHED → Station 03.** It owns clone drift and the watcher's own lifecycle, and the fix is the
mirror step being made tree-agnostic and archive-aware, which §9.5 already names. I did **not** sweep
them into this PR: committing 42 review files under a board PR whose subject is a §10.6 note would
make that PR's claim about itself false, and choosing which home wins for each is exactly the
judgement 03's dispatch is for.

### F4 — `check-breadcrumb.mjs` still reads `'00': 2` against a live hourly cron. **S3 — DEFERRED.**

Unchanged from the previous three runs and re-measured this one (`--freshness` printed
`(cadence 2h)`). It means `--freshness` will not call `00` SILENT until **4 h**, i.e. after three
consecutive missed hourly runs — weak in escalation #23's exact direction. It is a one-character
`scripts/` change and outside 00's merge lane, and it is already filed for Marco alongside the
`lint-station.mjs` version-field question.

**DEFERRED** — it becomes urgent the moment a 00 run is actually missed and nothing says so; the
cross-check against `lastRunAt` that the COLLECT step already mandates is the standing mitigation,
and it was run this cycle.

## WHAT I DID NOT DO

- **Did not arm a second prompt.** RULE 4 is one at a time, and the watcher had not yet picked up the
  first when this run ended.
- **Did not arm `pr-vmguard-s2-preflight-installs-guard`**, though it was the tempting one — it is
  docs-only and would ride the `tests-docs` auto-merge lane with no human. That is exactly what the
  open escalation `needs-marco/tests-docs-lane-can-auto-merge-the-station-contracts-2026-09-05.md`
  is about, and this prompt rewrites the `station-contract` canonical block in all seven station
  docs. Arming it would let an unreviewed agent edit every station's binding contract. **Named here
  for Marco rather than acted on** — the prompt is sound, the merge path is the question.
- **Did not retire any prompt.** `spent=0`, and F1's two FULL matches are false positives; retiring
  on a file-overlap reading is a destructive action driven by an instrument §7 exists to distrust.
- **Did not commit the 42 untracked review files** — F3, dispatched.
- **Did not touch the HOLD→ready rename in the index.** `arm-prompt.ps1` releases it by design so a
  concurrent chat's commit cannot sweep it; the watcher's own build PR deletes the prompt.
- **Did not re-investigate `C:/po-vg`, the watcher clone's `dirty=2`, the 29 `needs-marco/` files the
  sweep tags `[STALE]`, or the poller-churn cadence.** All on file, all 03's or Marco's.
- **Did not restart the watcher.** It is alive with its wrapper up; a 41-minute heartbeat on an empty
  queue is idle, and §3a forbids restarting on BUSY or on quiet.
