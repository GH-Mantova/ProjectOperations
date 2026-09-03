# Station 00 — Supervisor | 2026-09-03T04:08Z–2026-09-03T04:2xZ

## GROUND

```
UTC            2026-09-03T04:08:49Z
origin/main    34cb51bd
dev tree       main @ 34cb51bd            C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is read-write. SIGHTED: `start_process` returned a
PowerShell session on the Windows host on the first attempt (PID 27748). This was **not** a blind run.

## WHAT I MEASURED

- **[MEASURED] Dev tree is current.** `git fetch origin --prune` then `git rev-parse --short HEAD` /
  `origin/main` → both `34cb51bd`. `git hash-object` on all three binding docs equals
  `git rev-parse origin/main:<path>` for each (`00-supervisor.md` 4ff1a77f, `DOCTRINE.md` ea91409d,
  `STATION-CAPABILITIES.md` eeaaf877). The working copy I read IS `origin/main`.
- **[MEASURED] No locks, no mid-merge.** `.git/index.lock`, `.git/MERGE_HEAD` (dev tree) and
  `C:\po-watcher\ProjectOperations\.git\index.lock` all absent.
- **[MEASURED] Sweep verdict SAFE TO ACT** — `scripts/pipeline/status-sweep.ps1`,
  `SWEEP COMPLETE 2026-09-03 04:09:22Z`: "no board mutation in progress, no recent remote activity,
  no live station worktrees."
- **[MEASURED] Watcher healthy.** `restart-watcher-if-wedged.ps1` (no `-Fix`):
  `armed prompts waiting: 0 · watcher process ALIVE (pid 26656) · restart churn 0 cycle(s) in 20 min ·
  VERDICT: OK`. Parent-chain cross-check: `node index.mjs` count 1, wrapper count 2 — no false
  `wrapper=0`, nothing relaunched.
- **[MEASURED] Armed count is 0**, counted myself: `Get-ChildItem docs\pr-prompts -Filter *-ready.md`
  returned nothing.
- **[MEASURED] The open board is TWO PRs and BOTH are Marco's.**
  `gh pr list --state open` → `#1526` (`feat/vm-guard-s1-persist-and-repo-param`, BLOCKED, no labels)
  and `#1523` (`feat/scope-wbs-plant-columns`, BLOCKED, no labels). **Zero DIRTY.** Both carry a LIVE
  watcher verdict in `docs/pr-prompts/processed/*.log`:
  - `#1526` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/clear-stale-index-lock.ps1"}`
  - `#1523` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  Probe run in the measured form with controls on the same corpus:
  `Select-String -Path *.log -Pattern 'marco.:true'` → **POS 603**, negative control
  (`zzznotarealtoken`) → **0**. **RULE 2 bars me from merging either.** Both were opened by the
  watcher lane (each has a `[watcher] merge result for PR #N` line), so this is not a §10 second-lane
  case and no hand-classification was needed.
- **[MEASURED] `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.** 11 checked, 0 malformed. No
  station SILENT: 00 0.7 h (cadence 2 h), 03 29.1 h (24 h), 04 1.4 h (4 h), 05 38.0 h (24 h).
  It also flagged **six breadcrumbs UNTRACKED** — "reaches nobody until a board PR commits it".
- **[MEASURED] `pr-vmguard-s1` was armed at `2026-09-03T03:40:31Z`** — `docs/pr-prompts/.arming-log.txt`
  tail: `ARMED pr-vmguard-s1-persist-and-repo-param escalates=false by=Marco@ pid=26376`. My previous
  run ended ~03:30Z having recorded it as "armable NEXT run"; I did not arm it. `by=Marco@` is the
  shared OS user and is never proof a human acted.
- **[MEASURED] `#1526`'s red is transient, not a defect.** `gh pr diff 1526 --name-only` →
  exactly two files, `scripts/clear-stale-index-lock.ps1` and `scripts/pipeline/vm-git-guard.sh`.
  The failing job log (`gh run view 33712548462 --job 100514966959 --log`) shows
  `● Canonical CP-G2 — seeded admin can authenticate` and `● Test suite failed to run` with
  `thrown: "Exceeded timeout of 5000 ms for a hook."` at the `afterAll`/`app.close()` hook —
  a Nest bootstrap timeout, on a diff of two shell scripts. `main` is green at `34cb51bd`
  (`gh run list --branch main` → CI `success`, 03:21:33Z).
- **[MEASURED] `#1523`'s `tendering-e2e` is IN_PROGRESS** on a NEW head `dd8317eb`
  (was `17b0d7d5` when my 03:25Z addendum diagnosed the plant-pill regression). 13 of its 14 checks
  are already non-failing. Someone pushed to that branch after my dispatch; I did not.

## WHAT CHANGED

1. **Re-ran `#1526`'s failed job.** `gh run rerun 33712548462 --failed`. Read back:
   `gh run view 33712548462` → `status in_progress`, `updatedAt 2026-09-03T04:12:02Z`. This is the
   sanctioned response to a transient (station doc, ACTIVE DRIVE MANDATE §5) and was done BEFORE any
   other board action, because merging cancels in-flight CI (measured 2026-09-03T03:01Z).
2. **Opened this board PR** from an isolated worktree off `origin/main`
   (`C:\po-worktrees\board-00-0410`, branch `docs/board-00-2026-09-03-0410`), committing the eight
   untracked HOLD prompts, the six untracked breadcrumbs, `pr-1526-review.md`, the `.arming-log.txt`
   line for the 03:40Z arm, and the deletion of the consumed `pr-vmguard-s1-…-HOLD.md`. Worktree torn
   down after push.
3. **Nothing merged. Nothing armed. No label touched. No watcher restarted.**

## FINDINGS

### F1 — EIGHT prompts Station 06 dispatched to me are UNTRACKED, and an untracked HOLD cannot be armed

`git status --porcelain` in the dev tree lists as `??`:
`pr-visualreview-s1-restore-vision-review-to-00-HOLD.md`, `pr-visualreview-s2-keep-the-screenshots-HOLD.md`,
`pr-visualreview-s3-design-ref-frontmatter-HOLD.md`, `pr-hygiene-s1-guarded-branch-prune-HOLD.md`,
`pr-claudedesign-s1-track-the-written-half-HOLD.md`, `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md`,
`pr-tfm-s10-guard-site-fallback-HOLD.md`, `pr-tfm-s11-copy-recursive-preserve-HOLD.md`.

Six of those eight are the literal deliverables of Station 06's 03:20Z, 03:35Z and 03:45Z breadcrumbs,
each ending `**DISPOSITION: DISPATCHED** — Station 00`. Arming is a `git mv` of a **tracked**
`-HOLD.md` (station doc, AUTHORITY). **A dispatch whose artifact is untracked dispatches nothing** —
00 cannot act on it, CI cannot see it, and a clone reads an empty queue. This is the same defect that
already cost a run on 2026-09-02, recorded in `#1504` as "the identity HOLD was untracked and
therefore unarmable". It has now recurred with eight files instead of one, which makes it a pattern,
not an accident: **a station that stages a prompt and does not commit it believes it handed work over
and did not.**

**DISPOSITION: ACTIONED** — all eight are committed in this run's board PR, which makes them armable
from the next run. Verified by `git status` in the worktree showing them as `A` before commit.

### F2 — The recurrence itself needs a gate, not another manual sweep

F1 is the second occurrence in two days and the cure both times was a human noticing `??` in
`git status`. Nothing in CI or in `lint-prompt.mjs` fails when a `-HOLD.md` exists on disk and not in
`git ls-tree`, because the linter globs the filesystem. The complete-and-additive fix (RULE 1) is a
queue check that compares the on-disk `*-HOLD.md` set against `git ls-tree -r origin/main` and fails
on any file present in the first and absent from the second — additive, breaks no existing prompt,
and closes the class rather than this instance. The alternative — "stations must remember to commit"
— fails the *future* half of RULE 1: it has already been tried twice and failed twice.

**DISPOSITION: DISPATCHED** → Station 06, as a new prompt (`pr-queue-untracked-hold-check`). This is
the same family as the already-unstaged "prompt still tracked on main after arming" check, and the two
belong in one queue-integrity slice.

### F3 — Something other than Station 00 armed a prompt at 03:40Z

`pr-vmguard-s1` went `HOLD → ready` at `2026-09-03T03:40:31Z`, ten minutes after my previous run ended
and inside Station 06's run window (its breadcrumbs run 02:50Z → 03:45Z). The station doc is
unambiguous — **"You ARM, you DRIVE, and you MERGE"** — and BOARD DRIVING condition 3 (single actor)
is the load-bearing one. No damage resulted: the watcher consumed it, `#1526` opened cleanly, and the
routing verdict is correct. But the outcome was luck, not design; a second actor arming while 00 is
mid-run is exactly the LL-38 shape.

Note the arming log is not itself trustworthy evidence of *who*: `by=Marco@` is the shared OS account,
and the file is a snapshot with two writers that has already lost an arm (`#1522`).

**DISPOSITION: DISPATCHED** → Station 06, to confirm in its next breadcrumb whether it performed the
03:40Z arm and, if so, to stop arming and dispatch instead. If 06 says it did not, this becomes a
second-lane question and escalates to Marco.

### F4 — `#1526` failed a canonical auth test on a two-shell-script diff

`Exceeded timeout of 5000 ms for a hook` in `CP-G2-seeded-admin-login.spec.ts` at `afterAll`, on a diff
containing `scripts/clear-stale-index-lock.ps1` and `scripts/pipeline/vm-git-guard.sh` and nothing else,
while `main` is green. A PowerShell script cannot break `POST /api/v1/auth/login`. Per the mandate this
is transient and is re-run, not diagnosed as a defect.

**DISPOSITION: ACTIONED** — `gh run rerun 33712548462 --failed`, read back `in_progress` at 04:12:02Z.
If the re-run reds again on the same hook, the honest next step is a MAIN-side flake investigation of
the 5000 ms Nest-bootstrap budget, not a change to `#1526`.

### F5 — The board cannot move, and arming more would only make the queue longer

Zero armed prompts, zero DIRTY PRs, watcher healthy, 76 tracked HOLDs waiting — and both open PRs
stopped at RULE 2. Every prompt Station 06 dispatched this cycle (`visualreview`, `hygiene`,
`claudedesign`) touches `scripts/`, so each would open a third, fourth and fifth PR that also routes
to Marco. The constraint is not throughput and it is not the queue; it is the human gate, exactly as
recorded on 2026-08-31. Arming into it converts a two-PR backlog into a five-PR backlog and buys
nothing.

**DISPOSITION: DEFERRED** — arm nothing this run. This becomes urgent the moment `#1526` or `#1523`
lands: at that point arm exactly one, `pr-visualreview-s1` first (it is the smallest and 06 records
Marco as having already approved the design intent behind it), and never `pr-vmguard-s2`, whose gate
is `#1526` being ON `origin/main` and which is therefore not armable today.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live `marco:true` verdict. RULE 2 is not cleared
  by green, by an empty label set, or by my own reading of the diff.
- **Did not arm.** See F5. In particular `pr-vmguard-s2-preflight-installs-guard-HOLD.md` stays HELD:
  its predecessor `#1526` is open, not on `origin/main`.
- **Did not touch `#1523`'s branch.** Its `tendering-e2e` is IN_PROGRESS on a head that moved after my
  dispatch; acting now would be a second actor on someone else's in-flight run, and would risk the
  same cancellation I recorded at 03:01Z.
- **Did not clear the `[STALE]` escalations the sweep names.** `ruleset-requires-four-checks-…` is
  tagged STALE on merged PR refs but carries the surviving half of open escalation #15 — it is to be
  AMENDED, never binned. `pr-subbie-rate-cards-scope-pricing-HOLD` is genuinely dead on `#212`/`#213`;
  that clearance belongs to the 03 clone-hygiene dispatch already open.
- **Did not commit** `docs/housekeeping/REPO-MAP-2026-09-02.md`, `queue-watch-state.md`,
  `.queue-sync-ledger.txt`, `archive/review-escalations-516-1346/`, or the modified
  `metadata-catalog.json` / `sweep-rotation.json` / two HOLD bodies. They are other stations' working
  state, one of them (`pr-cardui-s8-waste-section-HOLD.md`) is known to be dirty MID-EDIT by 06, and
  sweeping them into a board PR would be exactly the shared-index collision LL-38 records.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
