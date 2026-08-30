# Station 00 — Supervisor | 2026-08-25T08:08:23Z–2026-08-25T08:19Z

## GROUND

```
UTC            2026-08-25T08:08:23Z
origin/main    c0d5d57b            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ c0d5d57b     C:\ProjectOperations2   behind=0 ahead=0 dirty=47
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE. Full read/write run. NOT blind — Desktop Commander reached
`LAPTOP-E6NHU4E4` on the first call.

## WHAT I MEASURED

- **[MEASURED] Watcher is LIVE and NOT frozen.** `pid=29024`, cmdline
  `node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`.
  Three `ts` samples from **`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`**:
  `08:08:03.302Z` → `08:13:03.237Z` → `08:18:03.265Z`. GAP = 5.00 min ×2, exactly
  `RESCAN_INTERVAL_MS`. A frozen node cannot produce an on-time tick.
  🔧 **Correction to the recorded path:** the file is NOT at the clone root
  (`C:\po-watcher\ProjectOperations\.queue-state.json` is MISSING). It is in
  `scripts\pr-watcher\`.
- **[MEASURED] Board: 1 open PR.** `#1316 CLEAN, labels=[], CI 12 pass / 0 fail / 0 pending`,
  branch `feat/ew-2a-capacity-service`. Review job `rev-1316` returned **MERGE**.
- **[MEASURED] #1316 is WATCHER-ROUTED TO MARCO.** In
  `processed/pr-ew-s2a-capacity-service-ready.md.log:19`:
  `[watcher] merge result for PR #1316: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/jest.config.ts"}`
- **[MEASURED] ARMED count 0 at 08:09Z** — the 07:16Z arm of `pr-ew-s2a-capacity-service`
  ran to completion (Started 07:16:19.814Z, Ended 07:37:20.658Z, Exit 0) and was consumed.
- **[MEASURED] Trunk is GREEN, and the sweep says otherwise.**
  `gh api repos/.../commits/c0d5d57b.../check-runs` → `total=12, success=11, skipped=1`,
  zero failures. `status-sweep.ps1` printed `main branch CI (last 3 runs): 1 success /
  1 not-success  <-- TRUNK IS RED`. Positive control: the API returned three named runs.
- **[MEASURED] `status-sweep.ps1` verdict at 08:12:24Z: `SAFE TO ACT`** — 0 in-progress
  prompts, 0 git processes, no index.lock in either tree, no PR touched in 2 min.
- **[MEASURED] No lock, no mid-merge.** `.git\index.lock` absent; no `MERGE_HEAD`,
  `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge` or `rebase-apply` in the dev tree.
- **[MEASURED] `check-breadcrumb.mjs --freshness` exit 2** — structure 6 checked, 0 malformed;
  freshness `03 last 2026-08-24T23:01:00Z 9.2h ago (cadence 4h) SILENT`. 00/04/05 ok.
  All 6 breadcrumbs `UNTRACKED`.
- **[MEASURED] `pr-e2e-container-s1-trial-workflow-HOLD.md` was armable and is UNTRACKED.**
  lint `ADMIT (size 1)`; body carries the exact literal
  `STANDING AUTHORITY to finish the work, commit, push`; no `<!-- watcher: do-not-arm -->`,
  no `DO NOT ARM` prose, no `docs/approvals/` gate; `escalates: false`, `gate_allow: none`.
  Premise ALIVE — no workflow references `mcr.microsoft.com/playwright` (control: the same
  grep DOES find `playwright` in `playwright.yml`, so the instrument is not simply blind).
  `done_when`'s external dependency (`playwright install --with-deps` in `playwright.yml`)
  is satisfied. `.github/workflows/playwright-container-trial.yml` is ABSENT — not shipped.
  `git ls-files --error-unmatch` → `fatal: not under version control`.
- **[MEASURED] Arm-to-pickup = 4 min 40 s**, not ~1 s. Armed 08:13:21Z (18 s after the
  08:13:03 tick); picked up at the NEXT tick — `processed/pr-e2e-container-s1-trial-workflow-ready.md.log`
  created 08:18:01.300Z; armed 1 → 0 by 08:18:18Z.
- **[MEASURED] The 08-20 dead gate is real and is in `no-pr-opened/`:**
  `pr-e2e-container-s1-trial-workflow-ready.md` (08-20 16:18) + `.log` (16:23).
- **[INFERRED] Clone refs are stale, not broken.** Clone `HEAD=74066ae9`, its
  `origin/main=5ec99150` vs the dev tree's `c0d5d57b`, `dirty=35`. The watcher fetches at
  job start, and the 07:16Z job completed normally, so this is unfetched remote-tracking
  refs, not drift that blocks work. I did not run `git fetch` in the watcher repo.
- **[CANNOT MEASURE] Station 03's schedule.** It is a desktop-app device task, invisible to
  `list_scheduled_tasks` and absent from Windows Task Scheduler. I can measure only its
  breadcrumb silence, not why.

## WHAT CHANGED

- **ARMED** `docs/pr-prompts/pr-e2e-container-s1-trial-workflow-HOLD.md` →
  `-ready.md` at **08:13:21Z**. Read back: armed 0 → 1, source gone, destination present,
  `git diff --cached --name-status` unchanged (still only the two pre-existing entries from
  other chats — `R100 pr-ew-s2a-capacity-service-HOLD→ready` and
  `D pr-watchdog-heartbeat-during-merge-wait-HOLD.md`; my rename added nothing to the index
  because the file is untracked). Consumed at 08:18:01Z.
- Nothing merged. Nothing labelled. No `/sot/` edit. No commit, no push.

## FINDINGS

### F1 — PR #1316 is green, reviewed MERGE, and I must not merge it
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/jest.config.ts"}`.
CLEAN, 12/12 green, zero labels, verdict MERGE. Every one of those is exactly the
false-clearance RULE 2 exists to survive. It is the fifth-plus consecutive PR routed this
way: the `tests-docs` auto-merge policy means **any PR touching application code lands on
Marco**, so the board drains at his rate and no faster.
**DISPOSITION: ESCALATED** — question and options in the section below.

### F2 — Station 03 has been SILENT 9.2 h against a 4 h cadence
Last breadcrumb `2026-08-24T23:01Z`. Flagged by the 07:20Z run at 8.3 h; nothing changed.
It is holding real work: watcher clone `dirty=35`, and **4 orphaned worktrees**
(`sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`, `po-wt-h`). 00 cannot start a
device task and 03 has no cloud trigger, so this cannot be dispatched from here.
**DISPOSITION: ESCALATED.**

### F3 — `status-sweep.ps1` prints a FALSE "TRUNK IS RED"
It reads `gh run list --branch main`, which DOCTRINE §9.4 already records as "can be DAYS
stale". Per-commit truth for `c0d5d57b` is 11 success / 1 skipped / **0 failures**. A
supervisor that believes this line stops merging on a healthy trunk. The fix is one query
change: read `commits/<sha>/check-runs`, not `run list --branch`.
**DISPOSITION: DISPATCHED → Station 06 (PR Master)** — stage a prompt fixing
`scripts/pipeline/status-sweep.ps1` section 1 to compute main CI per-commit. Joins the
existing 06 queue (`16 × Date.now()` in `index.mjs`; `00-supervisor.md` §3b ENSURE-UP;
emit the `GATE-ALLOW` body marker at PR-open; promote `MISSING_STANDING_AUTHORITY` from
WARN to REJECT at `lint-prompt.mjs:710`).

### F4 — a re-staged prompt could not be armed by `git mv`, because nothing can commit it
04-scanner re-staged `pr-e2e-container-s1-trial-workflow-HOLD.md` at 07:14:50Z and the
grant was repaired at 07:19Z, but **no scheduled station may create a PR**, so the file
never reached `main` and `git mv` refused it. I armed by filesystem rename. The prompt runs
correctly — the watcher globs the disk, not the index — but the arming left **no git audit
trail**, and if this run had gone wrong there is no tracked `-HOLD` to `git mv` back to.
Same root cause as the 47 untracked breadcrumbs.
**DISPOSITION: ESCALATED** (authority grant — folded into the question below).

### F5 — arm-to-pickup is 0–5 min, bounded by `RESCAN_INTERVAL_MS`, not "~1 s"
The recorded "~1 s" was one arm that happened to land just before a tick. Measured this run:
armed 18 s after a tick, picked up 4 min 40 s later at the next one. Treat 5 min as the
worst case when judging whether an arm "took".
**DISPOSITION: ACTIONED** — project memory corrected; recorded here so the next run does
not read a 4-minute silence as a dead watcher.

### F6 — the 08-20 dead gate is confirmed, and its repair is now under test
`no-pr-opened/pr-e2e-container-s1-trial-workflow-ready.md` (08-20 16:18) is the run that
asked a question instead of committing, which is why `pr-e2e-container-s2`'s gate could
never open. The missing STANDING AUTHORITY grant that predicted it is now present as the
exact literal, and the re-armed prompt was picked up at 08:18:01Z. If this run opens a PR
carrying `.github/workflows/playwright-container-trial.yml`, the WARN-only
`MISSING_STANDING_AUTHORITY` finding is proven causal.
**DISPOSITION: ACTIONED** (armed); verification passes to the next 00 run.

## FOR MARCO — one question, three options (RULE 1 applied)

**The board can only drain as fast as you merge.** #1316 is green, reviewed MERGE, and
watcher-routed to you; so were the four before it. Separately, staged prompts and station
breadcrumbs never reach `main`, because no scheduled station may open a PR.

**(a) Complete and additive — grant ONE station PR-create authority for `docs/` only, and
say in chat which code-PRs I may merge.** Station 06 (or 02 on dispatch) opens a
docs-only PR that commits staged `-HOLD` prompts and station breadcrumbs; CP-24 already
hard-blocks any PR mixing `sot/` with code, and a `docs/`-only PR cannot touch application
behaviour. Nothing existing is removed, no data-entry path is touched, and RULE 2 stays
intact because merging still needs your word. **Passes both halves of RULE 1.**

**(b) Widen the watcher's auto-merge policy beyond `tests/ or docs/`.** Drains the board
without you. **Fails the "without damaging future data entry" half** — the policy is the
only thing standing between an unreviewed code PR and `main`, and #1316 was routed to you
by a *one-line jest config change*, which is exactly the kind of small edit that would slip
through a widened rule.

**(c) Change nothing; you merge on your own schedule.** **Fails the "solves it for the
future" half** — every finding above recurs next run, breadcrumbs keep accumulating
untracked (47 now), and re-staged prompts stay unarmable by `git mv`.

Also needing you, unchanged from the 07:20Z run: **Station 03's device task is not
firing** (9.2 h silent, 4 h cadence). Nothing in this pipeline can restart it.

## WHAT I DID NOT DO

- **Did not merge #1316.** RULE 2. Green + unlabelled + a MERGE verdict do not override a
  `"marco":true` routing.
- **Did not arm a second prompt.** ONE AT A TIME; armed reached 1, then 0 on pickup.
  The chain successor EW-2b is gated on #1316 reaching `main`, so it is not armable anyway.
- **Did not touch the watcher repo's git** beyond `rev-parse` / `status`. No fetch, no
  checkout. Clone drift is Station 03's lane.
- **Did not clear the 4 orphaned worktrees or the stale escalation files** the sweep flagged
  `[STALE]` (#1135, #1134, #213, #212, #1158, #727 all merged). Station 03 / a hygiene PR.
- **Did not restart anything.** Verdict was neither WEDGED nor DOWN; three on-time 5-minute
  ticks say the watcher is healthy.
- **Did not commit.** The dev-tree index carries two other chats' staged entries; a commit
  here would have carried them.

---

## ADDENDUM 08:20Z — F6 CLOSED, and a second Marco-gated PR

**[MEASURED] The dead gate is repaired and the causal claim is proven.** The re-armed
`pr-e2e-container-s1-trial-workflow` ran to completion and **opened PR #1317**
(`ci(e2e): dispatch-only Playwright container trial (slice 1/2)`, branch
`feat/e2e-container-trial-slice-1` @ `18c8bb1c`, one file `+102/-0`:
`.github/workflows/playwright-container-trial.yml`, `workflow_dispatch`-only, job
`tendering-e2e-container` on `mcr.microsoft.com/playwright:v1.59.1-noble`;
`.github/workflows/playwright.yml` untouched).

The 08-20 run of this same prompt **asked a question and opened nothing** — it landed in
`no-pr-opened/`. The only material change between the two runs is the exact literal
`STANDING AUTHORITY to finish the work, commit, push`, added 07:19Z. **F6's prediction held:
the WARN-only `MISSING_STANDING_AUTHORITY` lint result is causal, not cosmetic.** That
strengthens the Station 06 dispatch to promote it from WARN to REJECT
(`lint-prompt.mjs:710`) — a WARN that silently costs a whole run is not a warning.

**[MEASURED] #1317 is ALSO routed to Marco:**
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/playwright-container-trial.yml"}`.
Board is now **2 open PRs, both Marco-gated**: `#1316 CLEAN`, `#1317 BLOCKED` (CI still
settling at 08:20Z; re-check before reading BLOCKED as a defect). ARMED = 0.

This is F1's pattern arriving twice in one run. `pr-e2e-container-s2` remains held and
cannot open until #1317 is on `main`, so the container work is now stopped at the same
human gate.

**DISPOSITION: F6 → ACTIONED (verified this run).** Board state above supersedes the
1-open-PR reading in WHAT I MEASURED.

**[MEASURED] 08:23:02Z — #1317's `BLOCKED` is PENDING, not FAILING.** `statusCheckRollup`:
**10 SUCCESS, 2 IN_PROGRESS** (`tendering-e2e`, `API — lint, test, compliance smoke`),
**0 FAILURE**, `labels=[]`. No fix is owed under the ACTIVE DRIVE MANDATE. It will go CLEAN
on its own and then sit, like #1316, on the `"marco":true` gate.

**Run ends 08:23Z.** ARMED = 0, 2 open PRs, watcher pid 29024 live, nothing merged,
nothing committed.
