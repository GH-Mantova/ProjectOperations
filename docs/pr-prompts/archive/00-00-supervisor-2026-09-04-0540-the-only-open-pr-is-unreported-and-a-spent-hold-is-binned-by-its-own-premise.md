# Station 00 - Supervisor | 2026-09-04T05:40:36Z-2026-09-04T05:58Z

## GROUND

```
UTC            2026-09-04T05:40:36Z
origin/main    fe5b8ca8            (fetch first, then rev-parse)
dev tree       main @ fe5b8ca8      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Read in the DEV TREE (`C:\ProjectOperations2`), never the watcher clone. Doc version and bootstrap
AGREE, so this run had full authority. SIGHTED, not blind: `start_process` shell `powershell.exe`
returned PID 24416 on the first call.

Preflight note, worth keeping: `git hash-object <path>` disagreed with
`git show origin/main:<path> | git hash-object --stdin` on all THREE binding docs at a commit where
`HEAD == origin/main`. That reads exactly like "three binding documents are locally modified". It is
the CRLF smudge, not a content diff - `git diff --numstat` over the same three paths returned EMPTY,
and `git diff --cached --name-status` returned empty too. **`--numstat` is the authoritative probe
here; a hash comparison across the smudge boundary is not.**

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1` at 05:41:32Z. Section 0 controls both PASS
(`gh` reached GitHub, saw merged #1567; `node` runs). VERDICT: **CAUTION** - 1 "LIVE STATION
WORKTREE" (`C:/po-queue`). See FINDING 3: that classification is wrong, and I did not act on it.

**Board.** [MEASURED] `gh pr list --state open` -> **ONE** open PR, re-confirmed at 05:5xZ
immediately before deciding.

| | |
|---|---|
| #1568 | `fix(pipeline): freshness must see a breadcrumb that is still inside an open PR` |
| state | CLEAN, not draft, labels `[]`, author `GH-Mantova`, head `fresh/union-open-pr-heads` |
| created | 2026-09-04T05:14:45Z |
| checks | `gh pr checks 1568` -> **14 pass / 0 fail / 0 pending**, incl. `tendering-e2e` 12m53s |
| files | `scripts/pipeline/check-breadcrumb.mjs`, `scripts/pipeline/__tests__/check-breadcrumb.open-prs.test.mjs` |

**DIRTY count: ZERO.** No PR has frozen CI. (Q1/Q2 of the answer sheet: nothing to fix, nothing to
escalate as a conflict.)

**Armed prompts, counted myself** (Q3): `armed (*-ready.md): 0` from the sweep, and
`Get-ChildItem docs\pr-prompts -Filter *-HOLD.md` -> **78** on disk at depth 1 (223 tracked on
`origin/main`, which includes `archive/` and `superseded/`).

**Machinery.** [MEASURED] watcher node RUNNING pid 24744; auto-restart wrapper alive (1); heartbeat
19 min (ticks only mid-run - stale + empty queue is idle, NOT wedged). I did **not** run
`restart-watcher-if-wedged.ps1 -Fix`: nothing returned WEDGED or DOWN, and 0 prompts are armed.

**Single-actor gate (BOARD DRIVING condition 3).** in-progress prompts 0 · `index.lock`
interactive/clone False/False · git processes 0 · no PR touched in the last 2 min.

**Freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **0**, `CLEAN`,
`structure: 6 checked, 0 malformed`. No station SILENT: 00 1.6h · 03 6.7h · 04 3.5h · 05 7.8h.
Crossed against `list_scheduled_tasks` `lastRunAt` as the contract requires - all five tasks
`enabled: true`, and **05 has recovered** (it had lost two of its last three occurrences).

**RULE 2 / DOCTRINE 10.1 lane probe, fully controlled.** Pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (§9.5: the watcher clone holds a decoy that passes
the mandated POS control and then clears every PR since 17 August).

| tree | logs | newest | `marco.:true` | `marco.:zzzNoSuchZzz` |
|---|---|---|---|---|
| **LIVE** `C:\ProjectOperations2\...\processed` | **1876** | `rev-1568-ready.md.log` @ 2026-09-04T05:23:26Z | **607** | 0 |
| decoy `C:\po-watcher\ProjectOperations\...\processed` | 21 | 2026-08-17T14:28:09Z | 10 | 0 |

The age discriminator did its job: the live tree's newest log (05:23:26Z) is **younger** than the
oldest open PR (05:14:45Z); the decoy is 17 days stale. Per-PR, matching `PR #<n>` in the log BODY:

- **POS control** `#1563` -> `{"ok":true}` (a real watcher verdict exists and is readable)
- **POS-marco control** `#1567` -> `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}`
- **NEG control** `#1566` (00's own hand-opened docs PR) -> **NO LOG**
- **#1568 -> NO LOG**

The NEG control passing is what makes `NO LOG` mean *second lane* rather than *broken probe*.

**`PR_WATCHER_AUTO_UPDATE` is still `"true"` by default** -
`start-watcher.ps1`: `if (-not $env:PR_WATCHER_AUTO_UPDATE) { $env:PR_WATCHER_AUTO_UPDATE = "true" }`.
Unchanged, already dispatched to 03, re-measured here only because it governs FINDING 2.

**COLLECT.** Six breadcrumbs in the queue root. Every finding in every one already carries a
disposition: 04's `0210` was collected and dispositioned by the `0309` run (verified by reading
`0409`, which states it did not re-disposition them and why), and each 00 breadcrumb dispositions its
own. **Nothing was left uncollected - with one exception, which is FINDING 1.**

## WHAT CHANGED

**Nothing on the board.** No merge, no arm, no label, no rename, no worktree pruned, no watcher
restart. The only file this run created is this breadcrumb. That is a deliberate choice, argued in
FINDING 2.

## FINDINGS

### FINDING 1 - The board's only open PR was opened AFTER its own run's breadcrumb, so no breadcrumb reports it

[MEASURED] The session-directory census (the third instrument the contract names) shows exactly
three scheduled sessions in the last 3 hours: `03:08:48Z`, `04:08:48Z`, and `05:39:57Z` (mine -
`00-supervisor.lastRunAt = 2026-09-04T05:39:57Z` confirms it). **There is no 05:0x session.** So the
04:08 run was still working long after it wrote breadcrumb `0409`: it merged #1567 at 05:02Z, opened
**#1568 at 05:14:45Z**, and its review job `rev-1568-ready.md.log` was processed at 05:23:26Z.

Its breadcrumb was written before all of that and names none of it. `#1568` carries no breadcrumb of
its own (its diff is two `scripts/` files). **The single open item on the board is therefore
unreported by any station artifact** - and 00 is the only reader of that channel. A later run
reconstructing "what happened at 05:0x" from breadcrumbs alone finds a gap, not a PR.

This is the same shape as the defect #1568 itself fixes, one layer up: #1568 makes freshness see a
breadcrumb still inside an open PR; the gap here is a mutation made *after* the breadcrumb, which no
amount of breadcrumb-finding recovers. **A breadcrumb dates the moment it was written, not the run.**
Cheap general cure, for whoever stages it: a run that mutates the board after writing its breadcrumb
must append to it (it is untracked in the dev tree until swept, so appending costs nothing).

**DISPOSITION: ACTIONED.** Collected here, which is the channel that closes. #1568 is now reported,
classified (FINDING 2) and its evidence recorded. No further action needed for this instance.

### FINDING 2 - #1568 is green, is MARCO'S by hand-classification, and I deliberately left the board untouched to keep it that way

`#1568` has **NO LOG** (probe and controls above), so it is a second lane - 00's own previous run,
built in worktree `C:/po-queue` whose HEAD is `fd93aee8`, byte-for-byte #1568's head commit.
`[NO LANE VERDICT - hand-classified]`:

- **DOCTRINE 10.1 step 2**, `classifyPolicyFiles`: both files are `scripts/pipeline/...`, which is
  **outside `^(tests|docs)/`**. No `migrations/` path. => **Marco's.**
  Note the trap deliberately: `scripts/pipeline/__tests__/check-breadcrumb.open-prs.test.mjs` **is a
  test file and is NOT under `tests/`.** The rule is a PATH PREFIX, not a file kind.
- **Step 3 exception** (a station acting inside its own recorded lane is classified by the authority
  matrix): **does not apply.** `STATION-CAPABILITIES.md` §5 records 00's lane as `docs/`, and states
  in terms that the only lane step 2 rejects is 05 -> `sot/`. A `scripts/` change is outside 00's
  recorded lane, and adding a new lane outside `tests|docs` requires a CI gate proving its boundary
  (the way CP-24 proves 05's). There is none for `scripts/`. Self-declaration is not classification.

=> **RULE 2 binds. I did not merge it, and no station may.** It is green and mergeable for Marco now.

**Why I opened no board PR at all this run.** `PR_WATCHER_AUTO_UPDATE` is `"true"`, so
`pollForBehindPrs()` rebases every BEHIND PR on a timer. Merging *anything* to `main` makes #1568
behind, moves its head, and cancels the CI that is green this minute - a ~13-minute `tendering-e2e`
re-run on the one item waiting on Marco, mid-afternoon Brisbane, for housekeeping that has no
deadline. Under RULE 1 the complete-and-additive option is the one that does not damage existing
state: report durably, disturb nothing. So this breadcrumb goes to the **dev tree**
(`C:\ProjectOperations2\docs\pr-prompts\`), the second home the REPORT CONTRACT sanctions, where it
is untracked until a board PR sweeps it up.

**DISPOSITION: ESCALATED - #1568 is Marco's to merge.** It is green, CLEAN, unlabelled, 14/14
checks passing, and no station has authority over `scripts/`. Nothing is blocked behind it.

### FINDING 3 - The sweep's "LIVE STATION WORKTREE" is an ORPHAN, and the CAUTION verdict was a false positive

The sweep returned `CAUTION: 1 LIVE STATION WORKTREE - C:/po-queue ... do NOT prune; a station is
working here`, on the strength of `age=26 min`. [MEASURED] It is not live:

- `git -C C:\po-queue log -1` -> `fd93aee8 2026-09-04 15:14:39 +1000` = #1568's head. It is the
  worktree that BUILT #1568.
- Its owning run is the `04:08:48Z` session, and the session census shows **no session started after
  it except mine**. Its last observable act was 05:23:26Z, ~18 min before the sweep.
- Corroborating: in-progress prompts 0, git processes 0, no `index.lock`, no PR touched in 2 min.

So the classifier reads *recent* as *live*. That is the safe direction to be wrong in - it stands a
station down rather than tearing a branch out from under a working agent (the 2026-07-13 near-miss) -
but it is still a false positive, and CAUTION is the verdict that stops the next run acting.

I did **not** prune it. Worktrees are Station 03's lane (`Repair the machines: 00 dispatches 03`),
and DOCTRINE 5.4 makes a deletion irreversible-adjacent. The sweep also names two
registry-escapees, `C:\po-worktrees\fix-1523` (age 1445 min) and `...\vs-s2-durable-smoke` (1221
min), both `size=0KB .lock=False`, plus four older orphans (`po-1483-fix`, `po-guard`, `po-sa-fix`,
`po-work/s2-e2e`), all `dirty=0`.

**DISPOSITION: DISPATCHED -> Station 03 (machine-minder).** Two items, and they are different:
(1) prune `C:/po-queue` and the six other orphans after re-confirming each is dead - `git status
--short` in each first, never unsupervised; (2) the liveness classifier itself calls a worktree LIVE
on age alone. The cheap discriminator is the one used above and it costs one command: a worktree
whose HEAD equals a **merged or open PR head that its owning session has finished with** is an
orphan regardless of age. 03's next occurrence is 2026-09-04T23:00:45Z.

### FINDING 4 - A spent HOLD is still tracked on main, and the premise gate correctly refuses it

[MEASURED] `docs/pr-prompts/pr-queue-armed-tracked-detector-HOLD.md` is **still tracked on
`origin/main`** (control: 223 `-HOLD.md` tracked, so the query works) and **absent from disk** -
`git status` shows it as an unstaged ` D`, the residue of the `git mv` that armed it. Its work
SHIPPED: the prompt produced #1567, merged 05:02Z.

This is the shape recorded as *"any armed prompt whose PR does not delete it stays armable forever"*.
**Measured here, that is too strong, and the correction matters more than the instance.** I copied
the blob out of `origin/main` and linted it:

```
STALE   _spent-probe-HOLD.md
        Premise no longer holds: "Nothing detects a docs/pr-prompts/*-ready.md ... untracked
        because .gitignore:75 swallowed it."
        The work is ALREADY DONE. Binned before spawning an agent.
        This is the lint working.   [exit 3]
```

Its premise is `! test -f scripts/pipeline/check-armed-tracked.mjs`, and that file is now on `main`.
**A spent prompt whose own PR falsifies its premise cannot be re-armed** - the gate kills it before
an agent is spawned. The defect therefore bites only where the premise does NOT become false when
the work lands (a premise that tests something the PR does not create). That is a much narrower and
more findable class than "every undeleted HOLD", and it is the version worth staging a queue check
for.

Residual harm here is clutter, not risk. Left on the board deliberately (FINDING 2's argument).

**DISPOSITION: DEFERRED.** It becomes worth acting on the moment a spent HOLD is found whose premise
is still TRUE - that one really is re-armable, and it is the only member of the class that is. The
falsifying probe is the lint above: re-run it on any suspect HOLD and read the exit code (3 = STALE
= safe; 0 = ADMIT on shipped work = the real defect). Deleting this one file is housekeeping for the
next board PR, listed under WHAT I DID NOT DO.

### FINDING 5 - 00's recorded cadence is still 2h against an hourly cron; re-measured, unchanged, already with Marco

[MEASURED] `list_scheduled_tasks` -> `00-supervisor` `cronExpression: "5 * * * *"` = **hourly**,
while `check-breadcrumb.mjs` prints `00 ... (cadence 2h)`. With the detector alarming only past
`2x cadence`, 00 needs **four** consecutive misses before it reads SILENT. Unchanged this run and
already open with Marco as escalation #23
(`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`, and the full
evidence chain is versioned in the freshness block of `docs/pipeline/stations/00-supervisor.md`).

Recorded here only so the next run does not re-derive it, and because this run is a small positive
control for it: the 04:08 occurrence fired, worked for over an hour, and the detector read `ok`
throughout - which is correct, and would have read `ok` equally if it had never fired at all.

Also unchanged and already filed: **03's cron is `0 9 * * *` (DAILY) against a bootstrap that says
every 4 hours** (`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`).

**DISPOSITION: DEFERRED - already escalated, no new evidence.** Do not re-escalate; it competes with
the open question rather than adding to it. It becomes urgent the moment a station is reported SILENT
or a missed occurrence is argued about, because the detector cannot settle either.

### FINDING 6 - An instrument lied to me this run: a process probe that fails its own positive control

I ran `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match
'claude' }` to ask whether another station was concurrently mid-run. It returned **empty** - while I
was demonstrably running. **The probe cannot see the session executing it**, so its zero carries no
information, in either direction (DOCTRINE 9.6).

Had I believed it, "no other station is running" would have been a confident, coherent, wrong
clearance for a board mutation - which is exactly the class 7 exists for, and the answer would have
happened to be right, which is worse. I substituted the instruments that do answer: the session
directory census, `lastRunAt`, and the sweep's four mutation signals.

**DISPOSITION: ACTIONED - discarded the reading and re-derived the answer from three working
instruments.** Recorded so the next run does not reach for it. **Concurrency is answered by the
session-directory census crossed with `lastRunAt`, never by a command-line grep for `claude`.**

## WHAT I DID NOT DO

- **Did not merge #1568.** Not mine (FINDING 2). Green and waiting for Marco.
- **Did not open a board PR**, so: did not archive the five dispositioned breadcrumbs now in the
  queue root, and did not delete the spent `pr-queue-armed-tracked-detector-HOLD.md` from `main`.
  Both are pure housekeeping and both cost #1568 its green CI via the auto-update rebase.
  **Concrete hand-off, not a note to a future run:** when `gh pr list --state open` no longer
  contains #1568, the next 00 run should open ONE `docs/`-lane board PR carrying (a) this breadcrumb
  plus the five dated `2026-09-04-00xx/01xx/02xx/03xx/04xx` and 04's `0210`, `git mv`'d to
  `docs/pr-prompts/archive/`, and (b) `git rm` of that spent HOLD. That PR is inside 00's own lane
  and 00 may merge it via `Assert-SmokedOrEscalate` -> `Merge-Pr`.
- **Did not arm anything.** 0 armed, 78 HOLDs on disk. The board's constraint is not the arm rate -
  it is that everything outside `tests|docs` stops at Marco, so arming non-docs work lengthens his
  queue rather than shortening it. Arming a docs/tests-only prompt would flow through the
  `tests-docs` auto-merge lane (measured live and healthy: #1563 merged with no human at 03:10Z),
  and that is the right next arm - but it needs RULE 4's full detector per candidate over 78 files,
  which is its own run's work, not a tail-end decision.
- **Did not prune any worktree** - Station 03's lane, dispatched (FINDING 3).
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, production data, the watcher clone's git, or
  any `do-not-merge` label. Did not run `restart-watcher-if-wedged.ps1 -Fix` - nothing was WEDGED or
  DOWN and 0 prompts are armed.
- **Did not act on the 30-odd `[STALE]` lines** the sweep prints for `needs-marco/`. They are dead
  escalation refs, already dispatched to 03 as a batch on 2026-08-31, and clearing them is a MOVE to
  `needs-marco/discharged/`, never a delete.

**Q6, the one most important thing blocking progress right now:** nothing is blocked. The board is
one green PR that only Marco can merge, 0 armed prompts, 0 DIRTY, trunk green on `fe5b8ca8`, and a
healthy watcher. The standing constraint is unchanged and is not a defect to fix here: work outside
`tests|docs` accumulates until Marco merges it.

---

## ADDENDUM 2026-09-04T05:5xZ - the board moved under me, and the deferral above is now DISCHARGED by this run, not by a future one

Everything above was true when measured. **Six minutes after I recorded #1568 as CLEAN and waiting,
it merged.** [MEASURED] `gh pr view 1568` -> `state: MERGED`, `mergedAt: 2026-09-04T05:47:23Z`,
`mergedBy: GH-Mantova`, merge commit `7fb49655`. `gh pr list --state open` -> **0**.
`origin/main` moved `fe5b8ca8` -> `7fb49655`.

**How it merged, stated exactly.** The issue timeline holds **no `auto_merge_enabled` event** - only
`merged | 2026-09-04T05:47:23Z | GH-Mantova`. So no station had armed native auto-merge on a PR that
hand-classification says is Marco's; it was merged directly by the `GH-Mantova` identity. That is
consistent with Marco merging it himself, and I cannot distinguish him from an interactive chat
using the same identity - the same attribution limit already recorded for unattributable arms. What
I CAN say is the part that mattered: **no automation merged it, and no station overrode RULE 2.**

**This is the `[LIVE]` rule paying for itself.** A verdict expires the moment it prints. Had I merged
a board PR on the strength of the 05:41Z sweep without re-reading the board immediately before
acting, I would have rebased a PR that was already gone.

**And it discharges FINDING 2's hand-off.** I wrote that the archive-and-cleanup should happen "when
`gh pr list --state open` no longer contains #1568". That became true DURING this run, so billing a
later run to re-discover it would be exactly the failure the record already names: a disposition
addressed to a future run outlives its own fix. **I did it here instead.** This PR carries:

- the five dated 00 breadcrumbs and 04's `0210`, `git mv`'d to `docs/pr-prompts/archive/` - every
  finding in each already carries a disposition. Safe for freshness: `check-breadcrumb.mjs` builds
  its tracked set with `git ls-tree -r` and matches by **basename** (DOCTRINE 9.5), so an archived
  breadcrumb still counts and cannot make a station read SILENT. Re-verified after the merge.
- `git rm` of the spent `pr-queue-armed-tracked-detector-HOLD.md` (FINDING 4) - its work shipped in
  #1567 and its own premise gate now bins it `STALE`, exit 3. Removing it is clutter reduction, not
  a safety fix, and the breadcrumb says so.
- this breadcrumb, in the queue root as the current cycle.

**Revised dispositions.** FINDING 2: **ACTIONED, not ESCALATED** - #1568 needed no station action and
got none; it is merged and on `main`. FINDING 4: **ACTIONED** - the spent HOLD is deleted here; the
DEFERRED half that survives is the narrow class named in that finding (a spent HOLD whose premise is
still TRUE), which has no instance today and whose falsifying probe is the lint exit code.

**Still standing after the merge:** FINDING 1 (a mutation made after a breadcrumb is written is
unreported - this addendum is the cure applied to my own run), FINDING 3 (dispatched to 03),
FINDING 5 (with Marco), FINDING 6 (instrument discarded).
