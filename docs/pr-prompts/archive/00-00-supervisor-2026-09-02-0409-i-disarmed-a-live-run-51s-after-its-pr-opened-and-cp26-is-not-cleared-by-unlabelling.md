# Station 00 — Supervisor | 2026-09-02T04:09Z–2026-09-02T04:25Z

## GROUND

```
UTC            2026-09-02T04:09:10Z
origin/main    3181cfba              (fetch --prune first, then rev-parse)
dev tree       main @ 45bbfa14 -> ff-only -> 3181cfba   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was READ-WRITE. **SIGHTED**, not blind: `start_process`
(`powershell.exe`) succeeded on the first attempt, PID 26916.

## WHAT I MEASURED

### 1. Dev tree was 1 commit behind at the top of the run [MEASURED]

`git rev-parse --short HEAD` = `45bbfa14`; `origin/main` = `3181cfba` after
`git fetch origin --prune`. Cured with `git merge --ff-only origin/main` BEFORE any triage or arm
(the stale-dev-tree trap: `lint-prompt.mjs` greps `premise:` against the WORKING TREE, so a stale
tree reports a SPENT prompt as ADMIT).

`--prune` deleted exactly one ref this run: `origin/board/00-2026-09-02-0335`. No phantom-ref
inflation — consistent with the prune-artifact finding from the 02:10 run.

### 2. Sweep verdict: SAFE TO ACT [MEASURED]

`scripts/pipeline/status-sweep.ps1`, complete 2026-09-02T04:10:42Z:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**This verdict was WRONG about the queue, and I acted on it — see F1.** A code-writer run was live
at that moment. The sweep's "no board mutation in progress" does not see an in-flight watcher run.

### 3. Watcher HEALTHY [MEASURED]

`scripts/restart-watcher-if-wedged.ps1` @04:11:34Z:
`armed prompts waiting: 1 / watcher process: ALIVE (pid 28400) / restart churn: 0 in 20 min /
queue last moved: 37 min ago (rev-1510-ready.md) / heartbeat last write: 0 min ago` → `HEALTHY`.

Chain confirmed still matching `SCRIPT-REGISTRY.md:97` (`node index.mjs` = pid **28400**).
No `index.lock` in either `C:\ProjectOperations2\.git` or `C:\po-watcher\ProjectOperations\.git`.

### 4. Breadcrumb freshness CLEAN, exit 0 [MEASURED]

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `3 checked, 0 malformed` / `CLEAN`.
`00` 2.0h (cadence 2h) ok · `03` 5.2h (24h) ok · `04` 2.0h (4h) ok · `05` 14.0h (24h) ok.
No station SILENT.

### 5. RULE-2 probe, with its positive control [MEASURED]

In `docs/pr-prompts/processed/`:
`Select-String -Path *.log -Pattern 'marco.:true'` → **604** hits (breadth control `marco` = **1289**).
The control is non-zero, so an empty per-PR result would mean something.

- **#1510 → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.**
  RULE 2 BARS IT.
- **#1511 → NO VERDICT FOUND.** Not because the watcher did not write one, but because **I removed
  the prompt file 51 s after its PR opened and took the log with it** (F1). Hand-classified per
  DOCTRINE §10.1: its two files are `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` and
  `apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx` — both **outside
  `^(tests|docs)/`** (a `__tests__` folder under `apps/` is NOT `tests/`; the rule is a path
  prefix, not a file kind) ⇒ **MARCO'S**. Corroborated: #1511 already carries `do-not-merge`.
  Recorded as `[NO LANE VERDICT — hand-classified]`.

### 6. CP-26 on #1510 — read from the job log, not the PR page [MEASURED]

`gh run view 33589145772 --job 100120520773 --log-failed`, job started **04:06:35Z**:

```
PASS - CP-11 … CP-25 (all)
FAIL - CP-26 do-not-merge [PR #1510 was labelled do-not-merge and released, but
  docs/decisions/merge-approvals/1510.md is not in this PR's diff against merge-base with
  origin/main. Commit the receipt on the PR branch so the approval leaves an authored,
  reviewable artefact.]
##[error]Process completed with exit code 1.
```

Label timeline (`gh api …/issues/1510/timeline`, read through `node`, not `--jq`):
`labeled do-not-merge by GH-Mantova 03:31:39Z` → `unlabeled do-not-merge by GH-Mantova 04:06:19Z`.
The gate job started **16 s AFTER** the unlabel, so it ran against the released state and still
failed. `docs/decisions/merge-approvals/` on `origin/main` holds `1483.md` and `README.md` only.

### 7. Collected breadcrumbs since the 02:10 run [MEASURED]

Three in the queue root, all dispositioned below and archived by this PR.

## WHAT CHANGED

1. Dev tree fast-forwarded `45bbfa14` → `3181cfba`.
2. **Disarmed** `pr-cardui-s3-manpower-columns-b-ready.md` (attempt 2) → moved to
   `no-pr-opened/…-b-ready.md.disarmed`, its log to
   `no-pr-opened/pr-cardui-s3-manpower-columns-2026-09-02.log`; `git restore`d the tracked
   `…-HOLD.md`. **This was a mistake — see F1.** Read back: `armed_count=0`, index clean.
3. **Armed exactly one** prompt: `pr-schema-label-removal-is-marcos` (04:16:09Z, via
   `arm-prompt.ps1`, `-WhatIf` first). Read back from `.arming-log.txt`.
4. This PR: the breadcrumb, three breadcrumbs archived, and
   `pr-cardui-s3-manpower-columns-HOLD.md` retired to `superseded/`.

Nothing merged. Nothing unlabelled. `/sot/` untouched. No Azure/Entra/SharePoint.

## FINDINGS

### F1 — I disarmed a prompt 51 seconds after its own PR opened, and destroyed its lane verdict [MEASURED]

The failure and its cost, plainly. `status-sweep.ps1` said `SAFE TO ACT: no board mutation in
progress`; `restart-watcher-if-wedged.ps1` said `HEALTHY`; I probed for a `*.running` marker and
found none. **All three were consistent with an idle queue, and all three were blind to a live
code-writer run.** The heartbeat said `0 min ago` — I read that as "healthy" when it also reads as
"working right now".

Timeline, from file mtimes (local AEST = UTC+10) and the GitHub API:

| UTC | event |
|---|---|
| 03:40:01 → 03:47:22 | attempt 1 (`…-ready.md`) ran, **exit 0, opened NO PR** |
| 03:47:22 | watcher auto-restaged as attempt 2 `-b-` (`index.mjs`, `enqueue(…{source:"no-pr-restage"})`) and started it in-process |
| **04:12:31** | **attempt 2 opened PR #1511** |
| **04:13:22** | **I moved `-b-ready.md` out of the queue root** |
| 04:14:46 | watcher wrote `rev-1511-ready.md` (review job) — it continued healthily |

Attempt 2 had already succeeded. My move took the file mid-retire, so there is **no
`processed/*cardui-s3*` log** and therefore **no recorded watcher merge verdict for #1511** — the
exact SECOND-LANES blindness DOCTRINE §10.1 warns about, self-inflicted. Hand-classification (§5
above) closes it: #1511 is MARCO'S.

Why I acted: attempt 1's no-op report claimed the day rate is not on the item payload. I verified
that claim independently and it is TRUE on `origin/main` — `itemsWithTotals` at
`apps/api/src/modules/tendering/scope-of-works.service.ts:337` adds only `lineTotal` and
`lineTotalWithMarkup`. I inferred the no-op was therefore deterministic and that attempt 2 would
burn a run confirming it. **The inference was wrong**: attempt 2 solved it web-side (+460/−88 in
`ScopeQuantitiesTable.tsx`, +254 of tests) without needing the API slice.

Two instrument lies worth keeping, both measured here:

- **Attempt 1's own no-op report cited a path that does not exist.** It named
  `apps/api/src/modules/scope-of-works/scope-of-works.service.ts`; the real file is
  `apps/api/src/modules/tendering/scope-of-works.service.ts` (`git show origin/main:<the first>`
  → `fatal: path … does not exist`). The substantive claim was right and the citation was wrong —
  do not accept a code-writer's line-and-path citation without resolving it against `origin/main`.
- **`git show <ref>:<path> > file` in PowerShell writes UTF-16**, so a following `node` read as
  utf8 matches nothing and reports the symbol absent. My first premise check returned a false
  "not found" for `itemsWithTotals` this way. Use `execFileSync('git',['show',…])` inside node.

Net damage: none to the board (#1511 exists and is green except the expected CP-26). Damage to the
record: one lost lane verdict, recovered by hand-classification. Damage avoided: I did **not**
re-arm, and I did **not** touch #1511.

**ACTIONED.** The board state is correct and read back: `armed_count=0` before the deliberate arm,
#1511 open and untouched, watcher HEALTHY after (pid 28400, unchanged). The durable half — that no
station has an instrument for "is a watcher run in flight right now" — is F2.

### F2 — no station has a probe for "a watcher run is in flight" [MEASURED]

`status-sweep.ps1` §7 answers "is a *board* mutation in progress" and returned SAFE while a
code-writer was 25 minutes into a run. `restart-watcher-if-wedged.ps1` distinguishes
HEALTHY/BUSY/WEDGED/DOWN, but returned **HEALTHY** (not BUSY) at 04:11:34Z with the run live — its
BUSY arm requires `queue idle` AND a fresh heartbeat, and the queue had "moved" 37 min ago, so it
fell through to HEALTHY. There is no `*.running` marker on disk; my probe for one returned empty
and I read that as idle.

RULE 1 applied. **Complete and additive, and it damages no data entry: `index.mjs` writes a
`.watcher-current` file naming the prompt it is executing on run start and deletes it on retire;
`status-sweep.ps1` §7 downgrades SAFE → CAUTION while that file exists, and `arm-prompt.ps1`
refuses to touch the named prompt.** It fixes the immediate case (this run) and the future case
(any station reasoning about the queue), and adds a signal rather than removing one. The
alternatives both fail a half: (b) "always check the heartbeat age yourself" fixes nothing durably —
the heartbeat was fresh here and I still got it wrong, so it fails the *complete* test; (c) "make
`restart-watcher-if-wedged.ps1` report BUSY more eagerly" widens a heuristic on the same weak
signal and risks calling a genuinely-wedged watcher BUSY, which fails the *no damage* test by
suppressing a real restart.

**DISPATCHED** → Station 06 (PR Master), to stage as a prompt. Scope is `scripts/pr-watcher/index.mjs`
+ `scripts/pipeline/status-sweep.ps1` + `scripts/pipeline/arm-prompt.ps1` and a test; it routes to
Marco, so size it small and chain it rather than shipping one wide PR.

### F3 — CP-26 is NOT cleared by removing the label; the memory clause saying so is REFUTED [MEASURED]

The standing note "removing the label IS the documented clearance (`pr-gates.mjs:483`)" described
CP-26 as it was *before* #1492 shipped it as its own required check. Measured today (§6): the
unlabel at 04:06:19Z is what **ARMS** the receipt requirement — the gate then demands
`docs/decisions/merge-approvals/1510.md` in the PR's diff and fails without it. The job that ran
16 s after the unlabel still failed.

So the clearance path is exactly the one Marco used on #1483: **he authors the receipt on the PR
branch, and CI goes green.** The coupling also reproduced: one cause, two reds — the standalone
`Approval receipt (CP-26)` check and the CP-26 step inside `PR gates — diff checks`.

🔴 **The agent prohibition is unchanged and permanent: no agent may EVER author a
`merge-approvals/<N>.md`.** I did not, and #1510 stays.

**ACTIONED** as a correction to the record (this breadcrumb). The gate itself is behaving as
designed.

### F4 — #1510 and #1511 both wait on Marco, and neither can go green without him [MEASURED]

- **#1510** (watcher GitHub App identity, part 2): `marco:true` verdict live in `processed/`.
  RULE 2 bars every station regardless of the label having been removed at 04:06:19Z. Everything
  else is SUCCESS; only CP-26 and its coupled step are red. Blocked on the receipt.
- **#1511** (WBS manpower column group): `do-not-merge`, hand-classified MARCO'S, same CP-26 shape
  once released.

The throughput constraint is unchanged and worth restating with today's number: **of the four
prompts armed in the last 24 h, every one that touched anything outside `tests/` or `docs/` stopped
at Marco.** That is why I armed a `docs/`-only prompt this run (below) rather than another
`scripts/` guard.

**ESCALATED** → Marco. Two questions, both one-line, RULE 1 applied to each:

1. **#1510** — the complete-and-additive answer is: **author `docs/decisions/merge-approvals/1510.md`
   on branch `feat/watcher-identity-app-auth` and merge**, exactly as you did for #1483. It solves it
   now (CI goes green, the watcher gets its own identity, and the nine unattributable merges become
   answerable) and in future (the receipt is an authored artefact on the record). Alternative (b),
   re-adding `do-not-merge` and leaving it, fails the *immediate* half — the PR sits and the
   identity question stays unanswerable. Alternative (c), an agent writing the receipt, is
   forbidden outright.
2. **Did you unlabel #1510 at 04:06:19Z?** The actor reads `GH-Mantova`, which is the shared
   account and is never proof a human acted. **I treated it as NOT a RULE-2 clearance and did not
   merge.** If it was you, the receipt is the missing step; if it was not you, something removed a
   `do-not-merge` label autonomously and that is a much bigger finding than this PR.

### F5 — `pr-cardui-s3-manpower-columns-HOLD.md` is now a duplicate-arm hazard [MEASURED]

`git restore` (my F1 correction) put the tracked HOLD back on disk while **#1511 already carries
its work**. #1511's diff is two `apps/web` files and does **not** delete its own prompt — the
general "an armed prompt whose PR does not delete it stays armable forever" defect, the same one
that produced three duplicate builds in one day via `pr-gates-approval-receipt-HOLD.md`.

**ACTIONED** — this PR `git mv`s it to `docs/pr-prompts/superseded/`, the #1506/#1509 pattern.
Reversible: if #1511 closes unmerged, move it back. Read back in this PR's diff.

### F6 — collection of the three breadcrumbs since 02:10 [MEASURED]

- `00-04-scanner-2026-09-02-0210-instruction-drift-sweep.md`, 7 findings:
  - **F1 (SCRIPT-REGISTRY names the wrong launcher)** — **ACTIONED, verified on `origin/main`**:
    `SCRIPT-REGISTRY.md:127` now names `C:\po-watcher\watcher-launcher-singlelane.ps1` as *the live
    launcher* and `:128` marks `pr-watcher\watcher-launcher.ps1` SUPERSEDED. Landed in #1505.
  - **F6 (rotation advance never lands)** — **ACTIONED, verified both halves**:
    `04-scanner.md:150` now reads "**Station 00 commits it, because you may not**", and
    `docs/pipeline/sweep-rotation.json` is tracked on `origin/main` at `last_index: 3`,
    `last_run_utc: 2026-09-02T02:10:25Z`. `git diff origin/main -- docs/pipeline/sweep-rotation.json`
    is **empty**, so there is no pending advance for me to commit this run.
  - **F3 (05's bootstrap cites `pr-gates.mjs:327` with no directory)** — **DISPATCHED** → Station 05,
    still open; 05 last ran 14.0 h ago against a 24 h cadence, so it is not late.
  - **F2** → open escalation #19 (`ensure-watcher.ps1` not in the repo). **DEFERRED**, Marco's A/B/C.
  - **F4** → open escalation #18 (three untracked, un-gitignored state files). **DEFERRED**, Marco's.
  - **F5 (weekly security audit disabled 15 days)** — **ACTIONED as ANSWERED**: Marco ruled on
    2026-09-02 that `weekly-security-audit` is off deliberately; #1509 recorded it. It will keep
    *looking* like a finding to any schedule sweep — that is expected, not a defect.
  - **F7** — 04 deferred to its own next rotation. **DEFERRED**, 04's to carry.
- `00-00-supervisor-2026-09-02-0008-…` and `00-00-supervisor-2026-09-02-0210-…` — my own two prior
  runs; every finding in them already carries a disposition.

**ACTIONED** — all three archived to `docs/pr-prompts/archive/` by this PR. Archiving is safe for
freshness: `check-breadcrumb.mjs` builds its tracked set with `git ls-tree -r` and matches by
basename, so an archived breadcrumb still counts and can never make a station read SILENT.

### F7 — two orphaned worktrees are still present, a second run after being dispatched [MEASURED]

`git worktree list`:

```
C:/ProjectOperations2  3181cfba [main]
C:/po-1483-fix         9de07267 [fix1483]
C:/po-work/s2-e2e      f85f11cf (detached HEAD)
```

`C:/po-1483-fix` went orphan when #1483 merged and its remote branch was deleted; `C:/po-work/s2-e2e`
was already orphaned. Both measured `dirty=0` by the 02:10 run. Unchanged since.

**DISPATCHED** → Station 03, re-stating the existing clone-hygiene dispatch rather than opening a
second one. Use 04's option (A): annotated tag `abandoned/<branch>@<sha>`, push tags, **then**
delete — the tag makes the deletion recoverable, which a bare delete does not. Also still in that
dispatch: the 11 registry escapees and `origin/origin`. I did not delete them myself; branch and
worktree deletion is irreversible and is 03's lane, not mine.

## WHAT I DID NOT DO

- **Did not merge anything.** #1510 is barred by a live `marco:true` verdict; #1511 is
  hand-classified MARCO'S and carries `do-not-merge`. The 04:06:19Z unlabel on #1510 is **not** a
  RULE-2 clearance — that comes from Marco in chat, for that batch only.
- **Did not author a `merge-approvals/<N>.md`.** Permanently forbidden to every agent, and it is
  the one thing that would have made #1510 green.
- **Did not remove or add a `do-not-merge` label** on either PR.
- **Did not re-arm `pr-cardui-s3-manpower-columns`** after disarming it — #1511 carries the work,
  so re-arming would open a duplicate. Retired to `superseded/` instead.
- **Did not arm a second prompt.** RULE 4 is one at a time, and `pr-schema-label-removal-is-marcos`
  is now in flight. The three `scripts/`-scoped candidates
  (`pr-devtree-sync-ff-only-guard` size 2, `pr-queue-armed-tracked-detector` size 3,
  `pr-pipeline-nodrift-agents-write-sweep-commits` size 4) all lint ADMIT and are all tracked on
  `origin/main` — but all three route to Marco, and he already has two PRs waiting. They are the
  next arms when the board clears.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and did not run `git` in
  `C:\po-watcher\ProjectOperations`.
- **Did not delete the two orphaned worktrees or the 11 registry escapees** — irreversible, and
  Station 03's lane.
- **Did not chase the `[STALE]` tag on
  `needs-marco/ruleset-requires-four-checks-…-2026-09-01.md`.** The sweep now tags it stale on four
  merged PRs (#1482/#1485/#1488/#1504), but it carries the still-open half of escalation #15
  (`Pipeline — watcher + linter tests` is still advisory and was the job that took `main` red for
  32 minutes). **Amend it, never bin it.**
