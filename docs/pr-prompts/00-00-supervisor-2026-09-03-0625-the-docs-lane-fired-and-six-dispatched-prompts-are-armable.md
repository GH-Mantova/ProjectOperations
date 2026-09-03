# Station 00 — Supervisor | 2026-09-03T06:08Z–2026-09-03T06:4xZ

## GROUND

```
UTC            2026-09-03T06:08:50Z
origin/main    50662fdc            (fetch --prune first, then rev-parse)
dev tree       main @ 50662fdc     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run was READ-WRITE.

**This run was SIGHTED.** `start_process` (shell `powershell.exe`) returned PID 21548 on the first
call. Stated loudly because the immediately preceding run (05:37Z) was BLIND on a Desktop Commander
`CONNECT_TIMEOUT` — escalation #17 — and a blind run and a quiet healthy run produce the same "no
news".

**The three binding docs were read from a tree PROVED equal to `origin/main`,** not merely assumed:
`git hash-object` vs `git rev-parse origin/main:<path>` matched on all three
(`00-supervisor.md` `4ff1a77f`, `DOCTRINE.md` `ea91409d`, `STATION-CAPABILITIES.md` `eeaaf877`),
and the dev tree HEAD equals `origin/main` exactly. This satisfies the PREFLIGHT rule that the docs
be read from `origin/main` rather than a possibly-stale working copy.

## WHAT I MEASURED

| # | Claim | Evidence |
|---|---|---|
| 1 | No git locks; dev tree clean of staged content | `[MEASURED]` `Get-ChildItem .git\index.lock,.git\HEAD.lock,.git\config.lock` → empty. `git status --porcelain` shows 6 working-tree entries, **none staged**. |
| 2 | Sweep verdict was **CAUTION**, not SAFE | `[MEASURED]` `status-sweep.ps1` → *"CAUTION: no local lock, but a PR was touched on GitHub in the last 2 min … A station may be doing gh-only work."* Cause identified below (F1) — it was the watcher opening `#1531`. |
| 3 | Watcher HEALTHY, alive and SUPERVISED | `[MEASURED]` `restart-watcher-if-wedged.ps1` → `VERDICT: HEALTHY`, pid 26656, heartbeat 2 min old, churn 0/20 min. Parent chain resolved rather than trusting a name grep: `24492 → 8032 → 26656`, `wrapper=2 node=1`. No relaunch attempted. |
| 4 | Board is **ONE** open PR | `[MEASURED]` `gh pr list --state open --limit 100 --json …` → `OPEN COUNT = 1`, only `#1531`. Zero DIRTY. |
| 5 | `#1523` and `#1526` are **MERGED** | `[MEASURED]` `gh pr list --state merged --limit 12` → `#1526` 04:56:08Z, `#1523` 05:37:22Z. Both were ESCALATED to Marco by the 04:10Z/04:24Z runs; both are now discharged. |
| 6 | Breadcrumb freshness CLEAN, no SILENT station | `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`. 00 0.6h/2h · 03 31.1h/24h · 04 3.4h/4h · 05 40.0h/24h — all inside 2× cadence. `structure: 15 checked, 0 malformed`. |
| 7 | Exactly ONE breadcrumb was untracked | `[MEASURED]` `git ls-files --others --exclude-standard -- docs/pr-prompts` → the 05:37Z blind-run report only. The seven other 09-03 breadcrumbs confirmed TRACKED via `git ls-tree origin/main --name-only -- <path>`. |
| 8 | Six dispatched HOLDs lint armable; two are correctly gated | `[MEASURED]` `lint-prompt.mjs` per file — see F3 table. |
| 9 | None of the six carries a don't-arm marker, **with a positive control** | `[MEASURED]` `Select-String -Pattern 'watcher: do-not-arm','DO NOT ARM','Arm ONLY' -CaseSensitive` → 0 on all six; control `pr-524-rates-b-slice2-canonical-HOLD.md` → **2 hits** (L27 `DO NOT ARM`, L29 `Arm ONLY`). An all-zero result with no control would have proved nothing (§9.6). |
| 10 | `#1531`'s CI was created IMMEDIATELY, not 212 min late | `[MEASURED]` PR created `06:09:47Z`; by `06:11` 13 of 14 checks were `COMPLETED`, and by ~06:15 all 14 were terminal. Head `3d5ef0340c7740adda7034b5a51de0974f4e86bd`. |
| 11 | `mergeStateStatus` moved BLOCKED → CLEAN under observation | `[MEASURED]` 06:10Z `BLOCKED` (one check `IN_PROGRESS`) → 06:1xZ `CLEAN`, `pending=0`. A textbook `[LIVE]`-expires reading; the first value would have been a false finding if quoted as current. |

## WHAT CHANGED

1. **This breadcrumb**, plus the previously-UNTRACKED 05:37Z blind-run breadcrumb, are committed to a
   board PR. Until that PR merges the 05:37Z report reached nobody — it was written on a run that
   could not commit it, and an untracked breadcrumb is not a report (REPORT CONTRACT).
2. **Nothing else.** No arm, no merge, no label change, no watcher restart, no queue rename.
   The board mutation this run is one docs-only PR carrying two reports.

## FINDINGS

### F1 — The `tests-docs` auto-merge lane is LIVE and fired for the first time since `#1301`, and the CI-latency cause of escalation #21 did NOT reproduce

The sweep's CAUTION was not a mystery actor: it was the watcher opening `#1531` 3 seconds before the
sweep sampled GitHub. `[MEASURED]` from the watcher's own log:

```
[2026-09-03T06:05:18.901Z] [queue] pr-plandocs-s1-prod-runs-legacy-not-ratetable-ready.md
[2026-09-03T06:05:19.065Z] [start] …
PR #1531 opened: https://github.com/GH-Mantova/ProjectOperations/pull/1531
[2026-09-03T06:10:12.837Z] [merge] pr-plandocs-s1-…-ready.md: opened PR #1531, policy=tests-docs, waiting.
```

`policy=tests-docs, waiting` is the lane DOCTRINE §10.3 says has not fired since `#1301`. The PR is
docs-only (`docs/plans/rates-migration-plan.md`, `docs/plans/settings-restructure-plan.md`), so
`classifyPolicyFiles` admits it and **no human is required**.

**This is the falsifying probe §10.3 asks for, and it comes back against the measured cause.** The
`#1500` incident was CI created **212.6 min** after the PR, outrunning the 90-min `MERGE_TIMEOUT_MS`.
Here CI creation latency was **≈0 min** and all 14 checks were terminal within ~6 minutes. So the
lane's precondition (`checks.length > 0 && checks.every(SUCCESS|NEUTRAL|SKIPPED)`, `index.mjs:1753`)
was satisfiable with ~84 minutes of window to spare.

🔴 **But at 06:2xZ, with `mergeStateStatus: CLEAN` and `pending=0`, `#1531` was still OPEN with
auto-merge NOT enabled.** The watcher was simultaneously BUSY — it had enqueued `rev-1531-ready.md`
(a review job) at `06:12:49Z` marked `busy`. **The single-lane watcher cannot poll its merge window
while an agent occupies the lane.** That is a *second, distinct* mechanism that can burn the same
90-minute window, and it is not the one §10.3 documents. The window on `#1531` expires ≈`07:40Z`.

**DISPOSITION: DEFERRED** — deliberately left to the watcher rather than hand-merged, because
hand-merging it would have destroyed the only clean measurement of whether this lane still works,
and because the watcher had declared itself mid-merge on that exact PR (BOARD DRIVING condition 3:
if something else is acting, STOP). **What makes this urgent:** if `#1531` is still open after
`07:40Z`, the lane will write `{"ok":false,"marco":true,"reason":"timeout waiting for green checks"}`
on a PR that was green the whole time — escalation #21's defect reproducing through a *new* cause
(lane occupancy, not CI latency). The next 00 run must check `#1531` FIRST and, if that happened,
add the occupancy mechanism to #21's file rather than opening a new escalation.

### F2 — Both PRs the last two runs escalated to Marco are MERGED; the board is empty for the first time in days

`[MEASURED]` `#1526` merged `04:56:08Z` (vm-git-guard persists onto PATH), `#1523` merged
`05:37:22Z` (SCOPE_WBS_PLANT_V1). The 04:10Z run's F5 recorded *"the board cannot move, and arming
more would only make the queue longer"*, and the 04:24Z run's F8 escalated `#1526` to Marco as the
single blocker. **Marco cleared both.** The throughput constraint that shaped the last four runs —
*"every PR that touches anything outside `tests/` or `docs/` then stops"* — is, right now, not
binding, because there is nothing queued behind it.

**DISPOSITION: ACTIONED** — verified merged and recorded; the two escalations are discharged. No
further action, and **do not re-raise `#1523`/`#1526` as pending** — a later reader finding the
04:10Z/04:24Z escalation text will otherwise repeat it.

### F3 — Six prompts dispatched at Station 00 are armable RIGHT NOW, and I armed none of them

Stations 04 and 06 dispatched nine prompts at me across seven breadcrumbs this morning. `[MEASURED]`
per-file `lint-prompt.mjs`, all tracked on `origin/main`:

| Prompt | Verdict | Size | Scope | Lane if built |
|---|---|---|---|---|
| `pr-visualreview-s1-restore-vision-review-to-00` | **ADMIT** | 1 | `docs/pipeline/stations/00-supervisor.md` | docs-only ⇒ auto-merge |
| `pr-artifactregister-s1-track-the-brief-index` | **ADMIT** | 1 | `docs/design/ARTIFACT-REGISTER.md` | docs-only ⇒ auto-merge |
| `pr-visualreview-s3-design-ref-frontmatter` | **ADMIT** | 3 | — | — |
| `pr-hygiene-s1-guarded-branch-prune` | **ADMIT** | 3 | `scripts/branch-prune.ps1`, `.vscode/tasks.json`, a test | outside `tests/`+`docs/` ⇒ **Marco's** |
| `pr-claudedesign-s1-track-the-written-half` | **ADMIT** | 10 | — | — |
| `pr-vmguard-s2-preflight-installs-guard` | **PROMOTE** `GATE_RELEASED` | 8 | — | outside ⇒ **Marco's** |
| `pr-visualreview-s2-keep-the-screenshots` | `GATE_NOT_RELEASED` | — | needle `VISION REVIEW` absent from `00-supervisor.md` | correctly parked |
| `pr-claudedesign-s2-spec-regeneration-plan` | `FILE_GATE_NOT_RELEASED` | — | `Claude Design/docs/01-commercial.md` not on main | correctly parked |

`pr-vmguard-s2`'s gate opened the moment `#1526` merged at 04:56Z — project memory carried it as
`REJECT [GATE_NOT_RELEASED]`, which was true when measured and is **now false.** Re-linted, not
inherited.

**The one to arm next is `pr-visualreview-s1`,** and the reason is chain leverage, not size: its
`done_when` writes `VISION REVIEW` into `00-supervisor.md`, which is the exact needle
`pr-visualreview-s2` is gated on. Arming s1 unblocks s2; arming anything else unblocks nothing. It
is also docs-only, so it merges without consuming Marco.

**DISPOSITION: DEFERRED — armed nothing this run, on RULE 4.** `pr-plandocs-s1-…-ready.md` was still
armed and unconsumed at the moment of decision (`[MEASURED]` twice, 06:1xZ and 06:2xZ), and its PR
`#1531` was open in the watcher's merge window. RULE 4 is *arm ONE AT A TIME*; arming a second while
the first is in flight is the thing that rule names. **What makes this urgent:** the moment `#1531`
merges and `pr-plandocs-s1` moves to `processed/`, the queue is free — the next run should arm
`pr-visualreview-s1` immediately and needs no re-derivation, because the lint verdicts, the
tracked-ness check and the marker grep with its positive control are all recorded above.

### F4 — The 05:37Z blind run's breadcrumb was UNTRACKED, so its one finding had reached nobody

`[MEASURED]` `git ls-files --others --exclude-standard -- docs/pr-prompts` returned exactly one
breadcrumb: `00-00-supervisor-2026-09-03-0537-blind-run-desktop-commander-connect-timeout.md`.
`check-breadcrumb.mjs` flagged it itself: *"is UNTRACKED — it reaches nobody until a board PR commits
it"*. Its content matters — it records another occurrence of escalation #17 (Desktop Commander
`CONNECT_TIMEOUT`) and states that the sessions it could see were listed by filename only and never
dispositioned. A blind run cannot commit its own report, by construction, so this is a structural
hand-off to the next sighted run and not a mistake by that run.

**DISPOSITION: ACTIONED** — committed in this run's board PR, alongside this breadcrumb. Verified by
the PR's own file list.

### F5 — Escalation #17 recurred at 05:37Z; the blindness rate is now measurable against a soak Station 06 already started

The 05:37Z run was blind on `CONNECT_TIMEOUT`; this 06:08Z run reached the box on the first call.
Station 06's 03:00Z breadcrumb DEFERRED this with an explicit plan — *"soak it. 00 now runs ~24×/day.
Against the 14% baseline, 48 hours…"* — and separately ESCALATED to Marco to **close two refuted
diagnostics** rather than to ask a new question.

**DISPOSITION: DEFERRED** — I am not re-escalating. #17 already sits in
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` with options
(A) raise timeout + pre-warm and (B) retry once after 60 s, which are **not exclusive**, and the
soak that would size the problem is deliberately mid-flight. Re-raising it now would add a data point
to a question already asked and make Marco read it twice. **What would make it urgent:** two
consecutive blind runs, or a blind run that coincides with a wedged watcher — at that point the
detector and the recovery are down together.

### F6 — Station 04's five DOCTRINE §9 drift findings are still unlanded, and four of them need a hash re-record

Station 04's 02:46Z breadcrumb dispatched five findings at me, each `DISPOSITION: DISPATCHED — 00`:
`| Select-Object -First N` makes a successful native command report `$LASTEXITCODE = -1` (new, not in
§9); §9.4 blames the `-Command` layer for the `--jq` quote loss when it fires under
`interact_with_process` too; §9.1's blocked-commands list is unconditional but does not hold in an
interactive session; `next-sweep.mjs --advance` prints an instruction the station doc removed as
forbidden; and the dev tree was behind `origin/main`.

The last of those is **already discharged** — `[MEASURED]` this run, the dev tree is at `50662fdc`
= `origin/main` exactly, and all three binding docs hash-match. I re-verified rather than inheriting
it, per the re-read rule.

The other four are real. Three of them edit `§9`, which lives inside the hash-gated
`instruments v2` canonical block, so they cannot be a casual docs edit: they need
`node scripts/pipeline/lint-station.mjs --write-canonical` in the same PR, and DOCTRINE's own
warning applies — a hash-gated block is protected against being EDITED, not against going STALE.

**DISPOSITION: DEFERRED to a single dedicated §9 doc-reconcile prompt** — not actioned piecemeal this
run. Landing four separate one-line §9 edits means four canonical re-records and four chances to ship
a mismatched hash; they belong in one prompt, staged by Station 06 (which owns staging) and armed by
00. **What would make it urgent:** any station acting on the stale §9.4 wording and mis-diagnosing a
quote-loss as `-Command`-only — the F1-style `$LASTEXITCODE = -1` trap is the one most likely to bite
next, because it makes a *successful* command look failed.

### F7 — Machinery is healthy, and the ENSURE-UP probe was resolved by parent chain rather than believed

`[MEASURED]` `restart-watcher-if-wedged.ps1` → `HEALTHY`, pid 26656, heartbeat 2 min, churn 0 in
20 min, queue moved 27 min ago. The command-line probe returned `wrapper=2 node=1`, and I resolved
the parent chain anyway (`24492 → 8032 → 26656`) rather than treating a wrapper count as a verdict —
DOCTRINE records that this probe read `wrapper=0` on a fully-supervised watcher because
`watcher-launcher.ps1` invokes the supervisor with the call operator `&`, which appears in no
command line. Nothing was restarted.

**DISPOSITION: ACTIONED** — measured and recorded; nothing to fix.

## WHAT I DID NOT DO

- **Did not merge `#1531`**, though it was `CLEAN` with all 14 checks terminal and I have the
  authority. The watcher had logged `policy=tests-docs, waiting` on that exact PR, which makes it
  mid-mutation under BOARD DRIVING condition 3, and merging it would have destroyed the first clean
  measurement in weeks of whether that lane still works. Recorded as a timed, falsifiable finding
  (F1) instead of a merge.
- **Did not arm anything**, on RULE 4 — one prompt was still armed and in flight. Six are armable and
  the next one is named, with its evidence, in F3.
- **Did not archive the dispositioned breadcrumbs** into `docs/pr-prompts/archive/`. The queue root is
  the current cycle and archiving today's reports in the same PR that first commits one of them adds
  churn and rename noise to a two-file docs PR. This is the second run to defer it; it is becoming a
  real backlog and should be one dedicated PR.
- **Did not touch the five unrelated dirty working-tree entries** — `docs/data-model/metadata-catalog.json`,
  `docs/pipeline/sweep-rotation.json`, `docs/pr-prompts/.arming-log.txt`,
  `pr-cardui-s8-waste-section-HOLD.md` (Station 06 is mid-edit on it) and
  `pr-rates-s11c-drop-legacy-tables-HOLD.md`. The dev-tree index is shared between concurrent chats,
  so this PR is committed with an explicit pathspec and carries only the two breadcrumbs.
- **Did not clear or re-run any `[STALE]` line** the sweep printed, and did not repeat one as current.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or any `do-not-merge` label.**
- **Did not act on `pr-524-rates-b-slice2-canonical-HOLD.md`** beyond using it as the positive control
  for the marker grep. It is an irreversible table drop and forbids batch arming in its own body.
