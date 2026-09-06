# Station 00 — Supervisor | 2026-09-06T19:08Z–2026-09-06T19:40Z

## GROUND

```
UTC            2026-09-06T19:08:40Z
origin/main    474aa869            (fetched, then rev-parse; no piped hash)
dev tree       main @ 474aa869     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Sighted run. Desktop Commander reached the box on the first call after a keyword `ToolSearch`
(`start_process`, `powershell.exe`, pid 2628). Version fields agree, so this run is not read-only.
⚠️ The bootstrap's prose still says *"Cadence: every 2 hours"* while the live cron is `5 * * * *`
— already recorded in `STATION-CAPABILITIES.md` §6 as a rotted state line, not a version mismatch.

**Device-bridge git guard, installed, last line quoted verbatim:**
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(`vm-git-guard installed at /sessions/.../.local/bin/git - refuses mounted paths, allows everything
else (both controls passed)`).

All three binding documents read in full this run. Read from the working copy, which is sound here
because `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
after the fast-forward — the sanctioned form, no pipe, no re-encode (PREFLIGHT step 2).

## WHAT I MEASURED

**Dev tree.** [MEASURED] `git fetch origin --prune` → `f0dfacfc..474aa869 main`; tree was `0 1`
behind and clean (`--numstat` EMPTY, `--cached --name-status` EMPTY); `git merge --ff-only
origin/main` → `474aa869`; read back `0 0`, `--numstat` EMPTY, `--cached` EMPTY. All three.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured to a file because it returns
early and hides its own §7 verdict. §0 both positive controls pass. §7: **`SAFE TO ACT` — no board
mutation in progress, no recent remote activity, no live station worktrees.** §3: in-progress
prompts 0, `index.lock` False/False, git processes 0, no PR touched in the last 2 min.

**Board.** [MEASURED] `gh pr list` via the sweep, then `gh pr view <n> --json
number,author,createdAt,headRefName,labels,files` per PR. **Four open, and every one of them is
Marco's:**

| PR | created | files that decide it | classification |
|---|---|---|---|
| `#1731` | 18:58:50Z | `scripts/pr-watcher/index.mjs` (+ a `__tests__/` file) | outside `tests\|docs` ⇒ **Marco's** |
| `#1730` | 18:58:41Z | `apps/api/src/modules/tendering/allocation.controller.ts` | outside `tests\|docs` ⇒ **Marco's** |
| `#1713` | 11:46:21Z | `apps/api/prisma/migrations/…/migration.sql` | migration clause ⇒ **Marco's** |
| `#1709` | 10:44:19Z | `apps/api/prisma/migrations/…/migration.sql` | migration clause ⇒ **Marco's** |

None carries a label. CI: `#1713` and `#1709` **15 pass / 0 fail / 0 pending (green)**; `#1731` and
`#1730` 14/0/1 still running. `main` CI on `474aa869`: 4 success / 0 failed (trunk green).

**RULE 2 probe, live tree only, with both controls.** [MEASURED] in
`C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE directory, never the clone's decoy):
**2010 logs, newest `2026-09-06T19:13:21Z`** — younger than every open PR, which is the control
that separates this directory from the 17-day-stale copy in the clone. POSITIVE
`Select-String -Pattern 'marco.:true'` → **617**. NEGATIVE, a freshly minted needle → **0**.
Per-PR discriminator over `pr-*.log` only (`rev-*` excluded): **#1731 → 0 · #1730 → 0 · #1713 → 0 ·
#1709 → 0**; NEGATIVE control `PR #999999` → 0. POSITIVE control that the per-PR form can answer:
`#1700` carries `[watcher] merge result for PR #1700: {"ok":false,"marco":true,…}` at 08:57:01Z.
So all four are `[NO LANE VERDICT — hand-classified]`, per §10.1 step 4.

**Arming.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **zero files**.
`.arming-log.txt` newest row: `2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver
actor=station-00-scheduled-0908Z`. **Nothing has been armed for ~10 hours**, which is consistent
with the daily clone log recording no `opened PR #` line since 10:33:20Z.

**Watcher, and it is healthy.** [MEASURED] node `pid 27236`, `StartTime 11:49:57Z` — **7.5 hours
of continuous uptime**, so the watchdog kill loop that built five duplicates this morning is not
currently reproducing. Live chain `24952 (launcher) → 28392 (start-watcher) → 27236 (node)`.
Heartbeat age 1 min. The daily clone log's last lines show it working now: `[review] verdict
mirrored to PR #1730 as a comment` (19:13:21Z) and `[update] PR #1731 branch updated (was BEHIND)`
(19:14:07Z).

**Watcher clone, still on pre-`#1704` code and drifting further.** [MEASURED] `HEAD 16ddb58b`,
branch `main`, `git rev-list --left-right --count HEAD...474aa869` → **`0 22`** (was 18 at 17:08Z,
19 at 18:28Z). `Select-String VERDICT_HOME_RESOLVER` in the clone's `index.mjs` → **0**, POSITIVE
control `classifyPolicyFiles` → **2**, NEGATIVE control → **0**. Stashes **69**. Dirty = **3
untracked review files**: `pr-1709-review.md`, `pr-1713-review.md` and — new since the 18:28Z run —
`pr-1731-review.md`. Read-only git only; I did not write in that repo.

**Watcher-family processes.** [MEASURED] `Get-CimInstance Win32_Process` on command line, not image
name: **8** (the sweep's narrower regex says 7 — same set, different vocabulary, no growth since
17:08Z). Five `watcher-launcher-singlelane.ps1` — `35328` (2026-09-04T09:37Z), `24952`, `23740`,
`25664`, `34940`; two `supervise-watcher.ps1` — `28632`, `23680`; one `start-watcher.ps1` — `28392`.
One node. **Reported, not killed.**

**`#1699` merged while the 18:28Z run was writing its report.** [MEASURED] `gh pr view 1699` →
`MERGED 18:52:07Z`, `mergedBy GH-Mantova`, no labels, four files including
`docs/decisions/merge-approvals/1699.md` — the receipt arrived **inside its own PR's diff**, the
same shape as the five receipts escalation `#1635` is about.

## WHAT CHANGED

One board PR, everything in it under `docs/`:

1. **`docs/pipeline/DOCTRINE.md` §9.5 corrected** — the `opened PR #<n>` test is incomplete, not
   merely stale (F1 below). +38 lines, 0 deletions; the node edit asserted its own byte delta
   (`before=104305 after=106891 delta=2586 expectedDelta=2586 match=true`) and the anchor count
   before and after.
2. **`docs/pipeline/stations/_canonical-blocks.json` re-recorded** — the edit is inside
   `instruments v2`. `lint-station.mjs` went `REJECT: 1 of 8 docs failed` (exit 1, the positive
   control that the gate is live) → `--write-canonical` (`instruments v2 0395194eca839b45`) →
   `ADMIT: all 8 docs clean` (exit 0).
3. **This breadcrumb**, written inside the PR worktree — cure 1 of the post-merge fast-forward trap,
   so no loose untracked copy is left in the dev tree.

**Armed: 0 before, 0 after. Merged: this PR only. No label touched, no clone write, no process
killed or started, no branch pruned.**

## FINDINGS

### F1 — the `opened PR #<n>` test is INCOMPLETE, not stale, and it goes blind exactly where lane classification matters: ACTIONED

DOCTRINE §9.5 was corrected 90 minutes before this run to point the lane discriminator at the daily
clone log instead of the frozen launcher transcript. That fixed the file. It left the *test* intact:
*"no `opened PR #<n>` line ⇒ second lane."*

[MEASURED] over a byte-for-byte copy of `…\logs\2026-09-06.log` (129,381 B — the live file is held
open by the watcher, and `Select-String` against it fails *"because it is being used by another
process"*, which is itself worth knowing):

```
#1703 mentions=2  openedPRline=0      #1707 mentions=14 openedPRline=1
#1704 mentions=6  openedPRline=0      #1692 mentions=7  openedPRline=1   (POS)
#1705 mentions=0  openedPRline=0      #1698 mentions=12 openedPRline=1   (POS)
#1708 mentions=4  openedPRline=0      #1700 mentions=21 openedPRline=1   (POS)
NEGATIVE control (freshly minted needle) = 0
```

All five of `#1703 #1704 #1705 #1707 #1708` are **watcher-opened** — that is the paragraph
immediately above this one in §9.5, measured from `gh` and the `VERDICT_HOME_RESOLVER_V1` marker.
**Four of the five hand-classify as SECOND LANE on this test**, at exit 0, while its positive
control passes on three other PRs in the same file. `#1705` leaves no trace in the log at all.

The mechanism: the line is written by the MERGE step, *after* the build. A build the watchdog kills
before that step has already opened its PR and never logs the line — so the instrument is blind
precisely during a kill loop, which is the condition that produces duplicate PRs in the first place.
Waiting for a fresher log cannot cure it.

**ACTIONED** — landed in this PR as an unconditional one-directional rule: `opened PR #<n>` PRESENT
⇒ watcher-opened; ABSENT ⇒ `[CANNOT MEASURE]`, never ⇒ second lane. With the falsifying probe (the
table above) and two corroborating instruments the kill loop cannot erase.

### F2 — two new second-lane PRs opened at 18:58Z; the whole open board is Marco's: ACTIONED as classified, NOT merged

`#1730` and `#1731` were created **nine seconds apart** (18:58:41Z / 18:58:50Z). The single-lane
watcher cannot do that, and `.arming-log.txt` records no arm since 09:20:50Z, so no watcher build
could have started — two instruments, neither of which F1's defect touches. Their `opened PR #`
absence is `[CANNOT MEASURE]` and was not used.

Hand-classified under §10.1 step 2: `#1731` touches `scripts/pr-watcher/index.mjs` and `#1730`
touches `apps/api/src/modules/tendering/**` — both outside all three `NESTED_TEST_PATHS` forms, so
both are **Marco's**. `#1730` already carries a review-lane `Verdict: MERGE` mirrored as a PR
comment; **a MERGE verdict is not a release** and does not touch the hand-classification.

**ACTIONED** — classified and recorded as `[NO LANE VERDICT — hand-classified]`. **Merged nothing.**
With `#1713` and `#1709` green and blocked on the migration clause, the throughput constraint is
stated exactly: four open PRs, four waiting on Marco, and arming more cannot shorten that queue.

### F3 — `#1699`'s receipt answers half of escalation #1635, and the unanswered half is unchanged: ACTIONED as recorded, ESCALATED unchanged

`#1635` asks how a run tells Marco's receipt from an agent's. `docs/decisions/merge-approvals/1699.md`
does something the five earlier receipts did not: it **names its own lane** (the supervised cloud
lane, §10.2.1), states why the label timeline cannot answer (*"both authenticate as the same
account"*), and quotes Marco's confirming reply verbatim — *"label removed"* — flagging that it is a
two-word answer and scoping the approval narrowly because of it. It also names what it deliberately
does **not** approve (`other-rates` / `Rate`, a live production defect left for a product decision).

**ACTIONED** as a recorded improvement in the receipt's own form. The escalation itself is unchanged
and stays open: the receipt still arrives **inside the diff of the PR it approves**, so it is
authored by the same actor whose merge it authorises, and nothing in the repo independently
corroborates the quotation. **RULE 1 (a) remains the complete-and-additive answer** — a *signed*
receipt verified by `approval-receipt-check.mjs`, triggered off `classifyPolicyFiles` rather than
off labelling, so mere file presence stops being the gate. Not mine to build; it is `scripts/`.

### F4 — the clone is now 22 behind, still without `#1704`, with a third untracked review file: DISPATCHED → Station 03

Unchanged in kind from the 18:28Z dispatch, sharpened with this run's numbers: **22 behind** (was
19), `VERDICT_HOME_RESOLVER` → **0** with a passing positive control, **69 stashes**, and **three**
untracked review files now — `pr-1709-review.md`, `pr-1713-review.md` and the new
`pr-1731-review.md`, which exists in no other home.

**DISPATCHED** → Station 03, next occurrence `2026-09-06T23:00:45Z`. The sequence is unchanged:
report each of the 8 watcher-family processes before killing any, leave one family, preserve the
three review files, `stash drop` never `pop`, fast-forward the clone, restart in an idle window, and
read back `VERDICT_HOME_RESOLVER` in the clone's `index.mjs` as the proof. **Not mine to do**: the
fast-forward is a `git` write in `C:\po-watcher\ProjectOperations`, which this station may never
perform, and a restart without it changes nothing (§9.5, *"a restart adopts nothing"*).

### F5 — armed 0 for ten hours, and I deliberately armed nothing: DEFERRED

Not a stall to fix by arming. Every open PR is Marco's, so an arm cannot move the board — and the
only lane that merges without him, `tests-docs`, would be driven by a watcher running 22 commits of
stale code, including the verdict-home resolver whose absence turns an auto-mergeable docs PR into a
permanent `marco:true` (§10.3). **Arming now manufactures the human work the lane exists to remove.**

**DEFERRED. What makes it act-able, precisely:** F4 landed — the clone fast-forwarded and the
watcher restarted on `#1704`'s code. At that point arm exactly one `tests|docs`-only prompt and let
the policy lane prove itself. The watcher's own 7.5-hour uptime says the kill-loop objection carried
by the two previous runs no longer holds on its own; the stale-code objection does.

### F6 — `C:\po-vg` still holds the only copy of one file: DEFERRED

[MEASURED] by the sweep: orphaned worktree, `dirty=1`, age **3557 min**, branch
`fix/no-rebase-while-checks-run`. Unchanged; already escalated. **DEFERRED** — it becomes urgent the
moment the branch-prune prompt is armed, which is itself gated on F1's sweep fix landing.

## WHAT I DID NOT DO

- **Merged nothing but my own board PR.** All four open PRs hand-classify as Marco's; two are green
  and would merge cleanly, and that is exactly the case RULE 2 and the migration clause exist for.
- **Armed nothing** (F5), and did not arm `pr-sweep-stale-check-retires-live-escalations-HOLD.md` or
  `pr-hygiene-s1-guarded-branch-prune-HOLD.md` — both still gated for the reasons the 18:28Z run
  recorded.
- **Did not clear any `[STALE]` line or any `needs-marco/` file.** §5 printed the same wrong
  "escalation is DEAD, clear it" advice against 26 of 29 live escalations; the fix for that is
  published as a `-HOLD.md` and is not mine to arm.
- **Did not touch the clone, the 69 stashes, the three untracked review files, `C:\po-vg`, or any
  watcher process.** All Station 03's, and all named above so 03 does not have to rediscover them.
- **Did not archive the three current-cycle breadcrumbs** (04's 18:10Z, and 00's 18:10Z and 18:30Z).
  Their F5/F4 dispatch to 03 is still open, and archive is for what has already been discharged.
- **Did not re-open escalation #1635** on the strength of `#1699`'s receipt, and did not treat that
  receipt as an unattributable actor — §10.2.1 and `STATION-CAPABILITIES.md` §5 both say a merge by
  the supervised lane that leaves a signature is the documented path, not an anomaly.
