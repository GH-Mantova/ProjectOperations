# Station 00 — Supervisor | 2026-09-03T10:08Z–2026-09-03T10:35Z

## GROUND

```
UTC            2026-09-03T10:08:57Z
origin/main    a9e7e7d1            (fetched 10:09Z, then rev-parse)
dev tree       main @ a9e7e7d1     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run. **SIGHTED**: `start_process`
(`powershell.exe`) returned PID 2464 on the first call. This was not a blind run.

All three preflight documents were read from the dev tree **after proving it is not stale**:
`git diff --name-only origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **empty**, and `git rev-parse HEAD` equals
`origin/main`. (The 09:09Z run found `00-supervisor.md` stale in this same tree; it is not stale now.)

## WHAT I MEASURED

- **[MEASURED] Sweep verdict: `SAFE TO ACT`.** `status-sweep.ps1` at 10:09:41Z — 0 in-progress
  prompts, 0 git processes, no `index.lock` in either tree, no PR touched in the last 2 min.
  Re-measured immediately before the arm (10:12Z): index clean, 0 git procs, no lock.
- **[MEASURED] The board is TWO PRs, and BOTH are Marco's.**
  `gh pr list --state open --json … --limit 100` → count 2.
  - `#1541` `CLEAN`, labels `[]`, **14/14 checks SUCCESS**. Files: `docs/pipeline/stations/00-supervisor.md`,
    `scripts/pipeline/visual-smoke.mjs`.
  - `#1536` `BLOCKED`, label `do-not-merge`, head `09e94d51`, **12 SUCCESS / 2 FAILURE** — and the two
    reds are exactly `Approval receipt (CP-26)` and `PR gates — diff checks`, i.e. the label pair.
    **Green on every real check.** This is a FRESH measurement taken after the 09:21:16Z
    `PR_WATCHER_AUTO_UPDATE` rebase; it supersedes the 07:56Z reading, which the 09:09Z run correctly
    flagged as stale.
- **[MEASURED] RULE 2 probe, with its positive control.** In `docs/pr-prompts/processed/`,
  `Select-String -Path *.log -Pattern 'marco.:true'` → **605** (control fires).
  - `#1541`: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs"}`
    — a **genuine policy routing**, not the §10.3 timeout shape.
  - `#1536`: `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
  - Both are watcher-opened and both carry a real verdict. **RULE 2 bars me from merging either.**
- **[MEASURED] Watcher healthy.** `node=1 pid=24744 wrapper=1 wrappid=33496`, parent chain resolved,
  `restart-watcher-if-wedged.ps1` → `BUSY` (heartbeat 45 min, 0 restart churn) → **DO NOT RESTART**,
  and I did not.
- **[MEASURED] Freshness CLEAN, but two stations cross 2× cadence TODAY.**
  `check-breadcrumb.mjs --freshness` exit **0**; `structure: 22 checked, 0 malformed`.
  `00` 1.0h · `03` **35.1h** (24h cadence) · `04` 4.0h · `05` **44.0h** (24h cadence).
  03 goes SILENT at **2026-09-03T23:02Z**, 05 at **2026-09-03T14:11Z**.
- **[MEASURED] Nothing new to COLLECT.** The newest breadcrumb of every station predates my last run
  at 09:09Z (04 → 06:10Z, 06 → 06:40Z, 03 → 09-01T23:02Z). All were dispositioned by prior runs.
- **[MEASURED] `pr-visualreview-s2-keep-the-screenshots-HOLD.md` was consumed at 09:20:21Z and is
  STILL TRACKED on `origin/main`.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
  lists it; the worktree shows ` D`. Sixth instance of the stays-armable-forever defect. (Its
  sibling VS-S1 *was* retired correctly to `superseded/`, which is the positive control that the
  retirement path works.)
- **[MEASURED] `status-sweep.ps1` §5 is still calling three OPEN escalations dead** —
  `tests-docs-lane-deadlock` (6 `[STALE]` hits), `unattributed-arms-single-actor` (3),
  `ruleset-requires-four-checks` (4). Unchanged from 09:09Z; already DISPATCHED to 06 that run. I did
  not act on any `[STALE]` line.

### The verdict-guard, measured end to end

- **[MEASURED] 26 review verdicts have been blocked since 2026-08-30**, six of them today.
  `Get-ChildItem docs/pr-prompts/blocked -Filter '*.guard-block.md'` → **26** (negative control on a
  pattern that cannot exist → 0). The list includes **`rev-1500`** — the very PR DOCTRINE §10.3 uses
  as its worked evidence for the tests-docs deadlock — and `rev-1540`, `rev-1541` today.
- **[MEASURED] The block note names "files" that are not files.** For `#1541`:
  `grep -q "MAX_PNG_BYTES" scripts/pipeline/visual-smoke.mjs` · `grep -q -- "--out" scripts/pipeline/visual-smoke.mjs`
  · `node scripts/pipeline/lint-station.mjs`. These are **shell commands**. The only real path inside
  the first two — `scripts/pipeline/visual-smoke.mjs` — **IS in PR #1541** (measured from
  `gh pr view 1541 --json files`).
- **[MEASURED] Root cause, at `scripts/pr-watcher/verdict-guard.mjs:56-66`.** Pass 1 walks
  ``/`([^`\n]+)`/g`` and, if the span merely *contains* `/` and *ends* with an extension, adds the
  **entire span** as a candidate path. A backticked command satisfies both tests, so the whole
  51-character command string is asserted to be a path and can never match `prFiles`. Pass 2's
  `PATH_TOKEN_RE` excludes whitespace and would extract the path correctly — but pass 2 **blanks out
  every backtick span first** (`:71`), so the correct extractor never sees the text pass 1 mangled.
- **[MEASURED] Reproduced with both controls** (`C:\po-sup-fix-scripts\guard-repro-2026-09-03.mjs`,
  importing the real `validateVerdict`, `prFiles` = #1541's actual two files):

  | case | expected | got |
  |---|---|---|
  | A. backticked **command**, path inside IS in the PR | ok | **ok=false**, `unmatched=["grep -q \"MAX_PNG_BYTES\" scripts/pipeline/visual-smoke.mjs"]` |
  | B. bare path in the PR — *positive control* | ok | ok=true |
  | C. backticked bare path in the PR — *positive control* | ok | ok=true |
  | D. genuine phantom path — **negative control, must still block** | block | ok=false, `["apps/api/src/totally/made-up.ts"]` |
  | E. backticked command citing a path really absent | block | ok=false (right answer, unreadable token) |

  B and C prove the matcher itself is sound; D proves the guard's **purpose** is intact. Only the
  extractor is wrong. This is a §7 instrument lie of the classic shape: a confident, coherent,
  wrong negative.
- **[MEASURED] It bites at TWO independent chokepoints, not one.**
  `index.mjs:2708` blocks the **mirror**, so the review never reaches `docs/pr-reviews/`
  (`Test-Path docs/pr-reviews/pr-1541-review.md` → **False** in the dev tree, **True** only in the
  watcher clone; positive control `pr-1537-review.md` → True). And `index.mjs:1419`, inside
  `verdictApproves`, calls `validateVerdict` **again** — so `:1826` (`allGreen && verdictApproves`)
  returns false and the tests-docs lane never enables auto-merge, **even for a verdict that reads
  `VERDICT: MERGE`**.

## WHAT CHANGED

1. **ARMED `pr-visualreview-s3-design-ref-frontmatter-HOLD.md`** — one prompt, via
   `arm-prompt.ps1` (never a bare `git mv`). Read back: `-ready.md` on disk, `-HOLD.md` shows ` D`,
   `.arming-log.txt` records `2026-09-03T10:12:47Z ARMED … pid=31528`. **Consumed 1 second later** —
   `watcher-launch.log`: `[10:12:48.064Z] [queue] …-ready.md` → `[10:12:48.232Z] [start]`.
   Pre-arm checks, all with controls: lint **ADMIT** (size 3); the three-marker union grep
   (`DO_NOT_ARM|do-not-arm|Arm ONLY`, case-sensitive) → **0** on the target, **1** on the positive
   control `pr-524-rates-b-slice2-canonical-HOLD.md` and **11** across the queue root, negative
   control 0; body read in full — no prose gate, only the boilerplate `## STANDING AUTHORITY`;
   premise re-executed by hand against `origin/main` — `design_ref` → **0** hits with the positive
   control `UNKNOWN_KEY` → **2** in the same file; `git` resolves (2.55.0); no duplicate on the
   merged board. Armed count before **0**, after **1**.
2. **Retired the consumed `pr-visualreview-s2-keep-the-screenshots-HOLD.md` to `superseded/`** in
   this PR (`R100`), so a `checkout .` or a fresh clone can no longer re-arm it.
3. **Archived 21 dispositioned breadcrumbs** to `docs/pr-prompts/archive/`. Safe for freshness by
   DOCTRINE §9.5: `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by
   basename, so archiving cannot make a station read SILENT. The 09:09Z breadcrumb stays in the root
   as the current cycle.
4. **Nothing merged.** Both open PRs are Marco's under RULE 2. No label touched.

## FINDINGS

### F1. The verdict-guard reads a backticked COMMAND as a file path — a third, deterministic cause of the tests-docs deadlock

Measured above. `verdict-guard.mjs:56-66` treats an entire backtick span as a path whenever it
contains `/` and ends in an extension, so any verdict that quotes a command like
`` `node scripts/pipeline/lint-station.mjs` `` is rejected as citing a phantom file. **26 verdicts
blocked since 2026-08-30.** It fires at both `index.mjs:2708` (mirror) and `index.mjs:1419`
(`verdictApproves`), so it independently prevents the tests-docs lane from ever auto-merging a PR
whose reviewer wrote a normal, correct, command-quoting review.

This matters beyond the guard: escalation **#21** attributes the lane deadlock to CI-creation
latency outrunning the 90-minute window, plus the single-lane worker blocking `rev-<N>`. **This is a
third cause, it is deterministic rather than a race, and no prior run has named it.** It also means
the block note's own advice — *"this usually means the review agent ran against a stale local main"*
— is wrong in at least these cases and has been sending readers to re-queue reviews that were
correct.

**The fix (specified, not guessed).** In `extractPaths` pass 1: when a backtick span contains
whitespace, run `PATH_TOKEN_RE` **over the span** and add the tokens it yields, instead of adding the
span whole. Keep the existing whole-span branch for spans with no whitespace (case C). This is
complete-and-additive under RULE 1: it fixes every present and future occurrence, and it cannot
weaken the guard — case D must still block, and that is the required regression test. Do **not**
"fix" it by deleting the guard; D proves it catches real phantoms.

**DISPATCHED → 06 (PR Master).** Stage a prompt against `scripts/pr-watcher/verdict-guard.mjs` plus a
test suite carrying cases A–E above verbatim as the acceptance set. `scripts/pr-watcher/**` internals
are not 00's to rewrite (STATION-CAPABILITIES §3), and this is new work, not a red PR. It is small
(size ~3) and it unblocks a lane, so it should lead 06's next batch. **Do not fold it into
`pr-gates.mjs`** — the CP-26 coupling rule applies.

### F2. Both open PRs are Marco's, both are as green as I can make them

`#1541` is 14/14 green and `CLEAN`; `#1536` is green on every real check, its only two reds being the
`do-not-merge` label pair. There is no work left on either that does not require Marco: `#1536` needs
him to remove the label **and** author the receipt (no agent may author an approval file), and
`#1541` is a genuine policy routing to him.

**DEFERRED.** Nothing to do until Marco acts. Named here so the next run does not re-derive it.
Re-measure before quoting — `PR_WATCHER_AUTO_UPDATE` rebased `#1536` out from under its verdict once
already today, at 09:21:16Z.

### F3. A consumed prompt stayed tracked on `main` for a sixth time

`pr-visualreview-s2-keep-the-screenshots-HOLD.md` was consumed at 09:20:21Z and `#1541` did not
retire it. Its sibling VS-S1 *was* retired, so the fault is per-PR, not structural to the path.

**ACTIONED this run** — retired to `superseded/` in this PR, verified as `R100` in
`git diff --cached --name-status`. **The general defect remains DISPATCHED → 06** (a queue check that
fails any PR consuming a prompt without retiring its `-HOLD`); this is the sixth hand-retirement and
the sixth is not a fix. Note that **VS-S3, armed this run, will land in the same trap** — whoever
runs next should expect to retire `pr-visualreview-s3-design-ref-frontmatter-HOLD.md` by hand.

### F4. Stations 03 and 05 cross their silence threshold later today

03 last reported 2026-09-01T23:02Z (35.1h, cadence 24h); 05 last reported 2026-09-01T14:11Z (44.0h).
`--freshness` reads `ok` **only because it flags at 2×**. 05 goes SILENT at **14:11Z**, 03 at
**23:02Z**, both today. Each has already missed one run inside the 16.6h period when all four station
tasks were disabled.

**DEFERRED — with a trigger, not a hope.** The first Station 00 run after **14:11Z** escalates if 05
has not filed; the first after **23:02Z** escalates if 03 has not. A silent station is not a quiet
one.

### F5. `status-sweep.ps1` §5 still tags three OPEN escalations `[STALE]`

Unchanged from 09:09Z: 6 hits on `tests-docs-lane-deadlock`, 3 on `unattributed-arms-single-actor`, 4
on `ruleset-requires-four-checks`. Its rule — *names a MERGED PR ⇒ discharged* — is wrong by
construction for any escalation that cites PRs as **evidence** rather than as its subject.

**DISPATCHED → 06 (already open from 09:09Z; re-affirmed, not duplicated).** Require the PR to be the
escalation's subject (front matter / `blocked_on:`) before tagging `[STALE]`, else downgrade to
`[FILE]`. Standing rule meanwhile: **no station acts on a §5 `[STALE]` line without reading the
file.** F1 sharpens the stakes — `tests-docs-lane-deadlock` is not only open, it now has a third
cause.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live `marco:true` verdict, verified with a
  positive control. RULE 2 is not cleared by green, by `CLEAN`, or by an empty label list.
- **Did not remove the `do-not-merge` label on `#1536`**, and did not author its approval receipt.
  Only Marco does either.
- **Did not restart the watcher.** Verdict was `BUSY` with a fresh heartbeat and zero restart churn.
- **Did not fix `verdict-guard.mjs` myself.** It is watcher internals and new work; 06 stages, 00
  arms. Acting on it in the shared tree is the LL-38 shape.
- **Did not arm a second prompt.** RULE 4 — one at a time; VS-S3 is now in flight.
- **Did not clear any `[STALE]` escalation**, and did not touch `needs-marco/` contents beyond
  reading them.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, production data, or the watcher clone's git.**
- **Left alone:** the two `worktree-registry-escapees` (03's), the modified
  `pr-cardui-s8-waste-section-HOLD.md` (dirty mid-edit by 06 — do not commit or discard),
  `metadata-catalog.json`, `sweep-rotation.json`, and the three long-lived worktrees
  `po-1483-fix` / `po-sa-fix` / `po-work/s2-e2e`.
