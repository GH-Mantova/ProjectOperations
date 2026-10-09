# Station 00 — Supervisor | 2026-10-09T01:15Z–2026-10-09T01:4xZ

## For Marco

Nothing is on fire and nothing in this run needs a decision from you.

All four enabled stations have fresh breadcrumbs and `check-breadcrumb.mjs --freshness` exits 0
`CLEAN`. The 41-hour outage that the 22:38Z runs headlined stays over: the catch-up burst has
drained and every station is inside one cadence.

**#2268, the previous run's collect PR, is MERGED** (00:45Z, read back from GitHub), so every
finding from the 22:38–00:15Z cycle is on `main` with a disposition against it. That cycle is now
closed, and this run **archived all seven of those breadcrumbs** into
`docs/pr-prompts/archive/` — the step the station contract asks for once every finding carries a
disposition, and the first time it has actually been done in this cycle.

**This run also merged its own PR rather than leaving it for the next occurrence** — #2269, MERGED
01:41:58Z, docs-only, 10 checks green — so the board is back to exactly one open PR and this
report is already on `main`. (Two paragraphs below were written before that merge and are corrected
in place, marked 🔴 CORRECTION; nothing has been deleted.)

**One PR is yours and unchanged: #2261**, labelled `do-not-merge`, CI 13 pass / 2 fail, open 46 h.
I removed no label and touched nothing on it.

**No question is re-asked here.** The three already open with you are carried unchanged on `main`
in the breadcrumbs #2267 and #2268 landed: the `sot`-lane / breadcrumb-home conflict, the "no
station can tell a dead occurrence from a blind one" gap, and Station 04's three HOLDs held only
by your `do-not-arm` marker. I did not re-word any of them and did not pre-clear any marker.

**Nothing on this board is armable**, and that is a measurement, not a shrug: `armed = 0`,
fourteen `-HOLD.md` prompts in the queue root, and the only three whose machine gates have all
released are the three your marker reserves.

## GROUND

```
UTC            2026-10-09T01:15:40Z
origin/main    70643bc6              (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 70643bc6       C:\ProjectOperations2   (rev-list --left-right --count HEAD...origin/main -> 0 0)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree** (1 == 1), so this run was not restricted to read-only by the
version-mismatch clause.

**SIGHTED run.** Desktop Commander's schemas were loaded with ONE keyword `ToolSearch` for
`desktop-commander` before any of its tools was called, and `start_process` with shell
`powershell.exe` answered on the **first** attempt — no `CONNECT_TIMEOUT`, no retry needed, so the
`BOOTSTRAP_CONNECT_RETRY_V1` 60-second retry did not arise. This is not a blind run, and no
GitHub-side read is presented here as coverage for one.

`DOCTRINE.md` (core) and `docs/pipeline/stations/00-supervisor.md` were read **in full**, and
`STATION-CAPABILITIES.md` in full, every one from
`git -C C:\ProjectOperations2 show origin/main:<path>` — in the **dev tree**, never the working
copy and never the watcher clone, after the explicit `+refs/heads/main` fetch above. The two
REFERENCE files were not opened: no core line sent me to one, and no §9 trap was acted on beyond
the ones whose cures are quoted in the core (§9.1 streamed output, §9.2 the sound hash forms and
the device-bridge git ban, §9.4 per-PR `gh pr view`).

## WHAT I MEASURED

**Device-bridge git guard — installed, INERT, exit 2.** [MEASURED]
`bash /sessions/zealous-loving-keller/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh`,
run at the top of the run, with the exit code read from the **installer itself** and no pipeline
appended to it. Last line and exit:

```
   PATH="/sessions/zealous-loving-keller/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` Its own controls printed `bash -lc 'command -v git'` →
`/sessions/zealous-loving-keller/.local/bin/git` (the shim) and `bash -c 'command -v git'` →
`/usr/bin/git` (the real one). Exit 2 is the station doc's EXPECTED station outcome — a FINDING,
not a stop (F5 below). **No `git` was run against the mount at any point this run**: every git
reading in this report came from `powershell.exe` on the Windows host.

**status-sweep.ps1, run TWICE — once to build the picture, once immediately before mutating.**
[MEASURED] run 1 `SWEEP COMPLETE 2026-10-09 01:16:06Z`; run 2 `SWEEP COMPLETE 2026-10-09
01:21:51Z`, this one redirected to a file rather than streamed, which sidesteps the §9.1
early-return trap that cost run 1 eight explicit `read_process_output` calls to drain. Section 0
positive controls PASSED in both (`gh CAN reach GitHub (saw merged PR #2268)`, `node runs`) —
**no `[BROKEN]`**. Both verdicts identical:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Run 2's gate inputs, which are what that verdict is computed from, and the reading I acted on:

```
git index.lock  interactive/clone: False / False
git processes touching our trees (scoped): 0
watcher build (heartbeat): no build in flight (newest tick 36.5 min old)
board lease: free
no PR touched on GitHub in the last 2 min
armed (*-ready.md): 0
```

⚠️ `[LIVE]` means "true when measured", so the lease was taken and the worktree created
**immediately** after run 2, not on run 1's verdict.

**Board state.** [MEASURED] sweep section 1, both runs: **1 open PR** — `#2261 BEHIND`,
`CI: 13 pass / 2 fail / 0 pending  <-- RED`, labelled `do-not-merge`, open 46 h.
`main` CI on `70643bc6`: `4 success / 0 failed / 0 running (trunk green)`.
**MARCO_QUEUE_LINE_V1 figures, copied as the contract requires:**
`WAITING ON MARCO: 1 open PR(s) labelled do-not-merge; oldest #2261, open 46h` and
`ALL OPEN (non-draft): 1; oldest #2261, open 46h`.
Most recent merges read back: `#2268 2026-10-09 00:45Z`, `#2267 00:29Z`, `#2266 2026-10-08 23:04Z`.
Queue census: `armed 0`, `needs-marco/ 53`, `no-pr-opened/ 111`, `failed/ 80`, `blocked/ 201`.
Backlog gates: `ready=1  needs-marco=2  blocked=4  broken=0`.

**COLLECT — every breadcrumb since my last run.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit read with no pipeline appended →
`FRESHNESS_EXIT=0`, `CLEAN`:

```
structure: 7 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

  00  last 2026-10-09T00:15:00Z  1.0h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-08T23:06:00Z  2.2h ago  (cadence 24h + grace 3h)  ok
  04  last 2026-10-08T22:38:00Z  2.6h ago  (cadence 4h + grace 1h)  ok
  05  last 2026-10-08T22:38:00Z  2.6h ago  (cadence 24h + grace 3h)  ok
```

So **`breadcrumb-clean`** is claimed on the authority of `check-breadcrumb.mjs` exit 0, with the
command quoted — not on `lint-prompt.mjs`, which was never run against a breadcrumb this run.
**No station is MISSED**, so FRESHNESS_ONE_CADENCE_V1's three-way classification did not arise and
no scheduled task was created, edited, enabled, disabled or re-run.

**Exactly ONE breadcrumb is new since my last run, and it was read in full:**
`00-00-supervisor-2026-10-09-0015-merge-pr-races-ci-on-every-behind-pr-and-tipid-s3s-dead-gate-is-repaired.md`
(498 lines). Its twelve findings are the whole of this run's COLLECT, and every one is
dispositioned in FINDINGS below. The other six breadcrumbs in the queue root were already read and
dispositioned by that 00:15Z run, which states so in writing and names each disposition — so they
are **cited, not re-derived**, and this run archives them rather than re-collecting them.

**#2268 is MERGED, asked individually.** [MEASURED]
`gh pr view 2268 --json number,state,mergedAt,labels` →
`{"labels":[],"mergedAt":"2026-10-09T00:45:27Z","number":2268,"state":"MERGED"}`. Asked per-PR
because a LIST response's `merged` field is unusable (§9.4). The previous run left #2268 open with
its breadcrumb inside it; it landed on its own, so the 00:15Z cycle needed no rescue from me.

**Nothing on this board is armable, and that is lint's reading, not mine.** [MEASURED]
`powershell.exe -File scripts/pipeline/triage-holds.ps1`:

```
=== TOTALS  spent=0 of 14 evaluated  gates-satisfied=0  still-gated=14  unreadable=0
            of 14 prompts (HOLD=14, ready=0, LOOPING=0)
```

**`gates-satisfied=0` of 14 is the arming answer**: there is no `-HOLD.md` whose gates have
released, so no `git mv` to `-ready.md` was available to me this run and the arming decision did
not arise. Cross-checked against the sweep's independent `armed (*-ready.md): 0` and against the
queue root on disk — 14 `-HOLD.md`, 0 `-ready.md`. ⚠️ The same run printed
`!!! SUSPECT: every prompt landed in ONE bucket` — that is 04's F4 / F6 false alarm firing exactly
as two previous breadcrumbs predicted on a correctly-gated board, and it is **not** evidence the
reading above is broken (F6 below).

**No `[STALE]` escalation row to clear this run.** [MEASURED] sweep section 5 ran over all 53
`needs-marco/` files in both runs and produced **zero** `[STALE]` lines: every line is
`[FILE] "... cites #N (MERGED) as evidence -- not its premise; does not clear the escalation"` or
`"names no subject PR ... section 5 CANNOT decide"`, which the sweep itself says clears nothing.
The one genuinely dead escalation on this board (`pr-2260-review-fix.md`) was retired by the
00:15Z run and is in `needs-marco/discharged/`. **So `retire-escalation.mjs` was not called this
run, and 53 escalations remain, none of them cleared by me.** The sweep's only `[STALE]` line is
section 4C's `no station summary younger than 3 days` — a note about the legacy state files, not
an escalation row, and its body is deliberately not quoted.

**Seven breadcrumbs archived, as pure renames, read back from the index.** [MEASURED] in this
run's PR worktree, each file confirmed TRACKED with
`git ls-files --error-unmatch -- <path>` **before** `git mv` (the station contract's warning about
appending to partly-tracked gitignored folders applies to writes, and I wanted the same proof for
a move):

```
ARCHIVE_COUNT_BEFORE=724   ROOT_BEFORE=7
7 x  MV_EXIT=0             (no SKIP_UNTRACKED line printed - all seven were tracked)
ARCHIVE_COUNT_AFTER=731    ROOT_AFTER=0
git diff --cached --name-status  ->  7 x  R100  docs/pr-prompts/<name>  ->  docs/pr-prompts/archive/<name>
```

**`R100` on all seven is the proof that nothing was rewritten**: 100% similarity, a rename and
nothing else, so no breadcrumb's content changed on its way to `archive/`. `check-breadcrumb.mjs`
matches by basename and its freshness scan sees `archive/`, so all seven still count for
`--freshness` — which is why archiving does not reintroduce a MISSED reading.

**The worktree.** [MEASURED] `git -C C:\ProjectOperations2 worktree add -b docs/collect-0115
C:\po-wt\sup00-0115 origin/main` → `WT_ADD_EXIT=0`, `WT_HEAD=70643bc6`,
`WT_BRANCH=docs/collect-0115`, `WT_PORCELAIN_EMPTY=True`. Off `origin/main` on the Windows FS,
isolated, **not** the dev tree, **not** `C:\po-watcher`, **not** the sandbox tree — board-driving
condition 2. ⚠️ git printed `Preparing worktree ...` on **stderr**, which PowerShell surfaced as a
`NativeCommandError` record; `$ErrorActionPreference='Continue'` was set, so it did not abort the
script before the work (§9.1 / standing guard 7). The exit code, not the red text, is the answer.

**Board lease taken before any mutation.** [MEASURED]
`Enter-BoardLease -Actor station-00.sched0115 -Reason 'collect: archive dispositioned breadcrumbs
+ open board PR'` → `LEASE_TAKEN=True`, immediately after sweep run 2 reported `board lease: free`.
Board-driving condition 3. Nothing was mutated before it returned `True`.

## WHAT CHANGED

🔴 **CORRECTION 2026-10-09T01:4xZ, by Station 00 `station-00.sched0115c`, in a follow-up PR.**
This section and the first two bullets of WHAT I DID NOT DO were written **before** the end of the
run, and they said *"No PR was merged"* and *"this run's own PR is left OPEN"*. Both became FALSE
within the same run: **#2269 (this breadcrumb's own PR) was merged at 2026-10-09T01:41:58Z** and
the dev tree was fast-forwarded afterwards. The wrong lines are struck below rather than deleted
(§10.5 — an artifact keeps one identity for its whole life), and the real mutation count is
**four**. Recorded here because a report that outlives its own truth is the failure DOCTRINE §7.1
exists to prevent, and because the next run must not read "nothing merged" as this run's verdict.

Four mutations, the first two inside this run's own PR worktree, all read back:

1. **Seven dispositioned breadcrumbs `git mv`'d to `docs/pr-prompts/archive/`** — the three 00
   breadcrumbs (2238, 2307, 0015), both 03 breadcrumbs (2251, 2306), 04's 2238 and 05's 2238. Read
   back from the index as **seven `R100` renames**, `ROOT_AFTER=0`, `ARCHIVE_COUNT_AFTER=731`.
   Every finding in all seven carries a disposition on `main` — six by the 00:15Z run, the seventh
   (the 00:15Z breadcrumb itself) by this one, below.
2. **This breadcrumb written** at a tracked path **inside this run's own PR** (the contract's
   Cure 1), so it needs no later sweep to rescue it and leaves nothing untracked in the dev tree
   to block the next fast-forward.
3. **#2269 MERGED** at `2026-10-09T01:41:58Z` via `Assert-SmokedOrEscalate` → `Merge-Pr`, read back
   from GitHub as `{"mergedAt":"2026-10-09T01:41:58Z","number":2269,"state":"MERGED"}` — not from
   the primitive's return value and not from a `QUEUED` state (UPDATE_AT_MERGE_TIME_V1). Checks on
   head `ad3a35ce` before the merge: `pass=10 skip=5 fail=0 pending=0`, `mss=CLEAN`, polled until
   settled. CP-26 required no receipt: every path in the diff is under `docs/`, so the diff-armed
   rule does not fire. Classification before merging: Station 00's own board PR, **no** labels at
   all, all eight files under `docs/pr-prompts/` and therefore inside 00's recorded `docs/` lane
   (DOCTRINE §10.1 step 3, classified by STATION-CAPABILITIES §5's authority matrix) — and "not
   watcher-routed" was treated as necessary, **not** sufficient.
4. **The dev tree fast-forwarded** `70643bc6` → `647a6dc2`, `FF_EXIT=0`, and **all four** readings
   clean afterwards: `rev-list --left-right --count HEAD...origin/main` → `0 0`,
   `diff --numstat origin/main` EMPTY, `diff --cached --name-status` EMPTY, and
   `status --porcelain --untracked-files=no` EMPTY — the fourth being the one that catches a dirty
   tree the first three pass. `ROOT_BREADCRUMBS_AFTER_FF=1` (this file alone). No untracked
   breadcrumb blocked it, because this one was written inside the PR worktree instead of the dev
   tree. The run's worktree was then removed (`WT_REMOVE_EXIT=0`, `WT_STILL_THERE=False`), so this
   run adds nothing to the orphan pile in F8.

**Nothing else.** No prompt was armed, disarmed, renamed or moved (`armed = 0` on arrival and on
exit, and `gates-satisfied = 0 of 14`, so the arming decision did not arise).
~~No PR was merged.~~ **CORRECTED: #2269 was merged — mutation 3 above. No OTHER PR was merged,
and #2261 was not touched.** No
label was added or removed. No `/sot/` file was touched. No escalation was retired or appended to.
No worktree was pruned **other than this run's own two**. No lock was cleared — none existed. No
watcher was stopped, started,
restarted or probed for liveness beyond the sweep's own reading. No scheduled task was created,
edited, enabled, disabled or re-run. Nothing was committed to `main` in the dev tree.
~~the dev tree was not fast-forwarded (it was already `0 0` against `origin/main` on arrival).~~
**CORRECTED: it was `0 0` on arrival and was fast-forwarded after #2269 merged — mutation 4.**
No `git` ran against the mount.

The board lease was held as `station-00.sched0115` from 01:2xZ, renewed before the merge, and
found already released afterwards — `Exit-BoardLease` returned `False` and `Get-BoardLease`
returned nothing, i.e. `Merge-Pr` had released it on a successful merge, so the end state is
**lease free**, reported as measured rather than as intended. A second lease
(`station-00.sched0115c`) was taken for this correction PR and released with it.
On the original run; `arm-prompt.ps1` was never called, so the hold-past-arm rule did not apply. Scratch went to
`C:\po-sup-fix-scripts\` (`sup00-0115-*.ps1`, `sweep2-0115.txt`), outside the repo.

## FINDINGS

### F1 — the 22:38–00:15Z cycle was fully dispositioned but never ARCHIVED, and seven breadcrumbs were still sitting in the queue root

[MEASURED] `--freshness` listed **seven** breadcrumbs under `structure:` at depth 1 in
`docs/pr-prompts/`, and `Get-ChildItem -Filter '00-*.md'` on the queue root returned the same
seven. [MEASURED] the 00:15Z breadcrumb (read in full) carries an explicit disposition for every
finding in six of them, and #2268 merged at 00:45:27Z, so all six were on `main` with their
dispositions attached. **The contract's ARCHIVE step had simply not run** — understandably, since
each of the last three runs was spending its occurrence merging the previous run's collect PR and
handling a `Merge-Pr` throw.

**Why this is worth a finding rather than a silent tidy-up.** The queue root is where the next
run's COLLECT looks, and a dispositioned breadcrumb left there is indistinguishable at a glance
from an uncollected one — so each run inherits a growing pile it must re-read or risk skipping.
Seven is still cheap; it compounds at one to three per hour. [MEASURED] `archive/` already holds
**731** breadcrumbs, which is the same contract working correctly over months, so the mechanism is
sound and only this cycle's step was missed.

RULE 1 on the action taken: *complete* — it clears the whole backlog of dispositioned breadcrumbs
in one move, and the next run's COLLECT now sees only genuinely new reports; *additive* — a `git mv`
within a tracked tree, proved `R100` on all seven, with `check-breadcrumb.mjs`'s freshness scan
reading `archive/`, so no disposition, no finding and no freshness reading is lost. **Passes both
halves.** The alternative — leave them and let each run re-read seven files — fails the complete
half, and fails it a little worse every hour.

**DISPOSITION: ACTIONED** — in this PR, verified by `git diff --cached --name-status` showing seven
`R100` renames and nothing else, `ROOT_AFTER=0`, `ARCHIVE_COUNT_AFTER=731`, and by each file being
confirmed tracked with `git ls-files --error-unmatch` before it was moved.

### F2 — `Merge-Pr` throws on its FIRST call for every BEHIND PR (00's 00:15Z F1), carried forward

Two consecutive runs measured `Merge-Pr` do its UPDATE_AT_MERGE_TIME_V1 job correctly — update the
BEHIND branch — and then throw `could not queue auto-merge after update-branch -- exit 1` because
the update had just restarted CI and the queue attempt raced it. Both times the second call merged.
The reason it matters is not the exception: the run before last answered it by typing
`gh pr merge` by hand, the one command DOCTRINE §1 names, and **a primitive that throws on its own
happy path trains its callers out of using it.**

**DISPOSITION: DEFERRED**, unchanged — but the probe was run, and the result NARROWS the finding
rather than confirming or refuting it. 🔴 **CORRECTION 01:4xZ: this paragraph originally said "no
PR was merged this run, so the falsifying probe is still open". #2269 was then merged.**
[MEASURED] #2269 was CLEAN (branched off `70643bc6`, which was `origin/main` at 01:15Z, and `main`
did not move), `mss=CLEAN` with `pending=0` before the call, and **`Merge-Pr` returned
`State=MERGED` on its FIRST call with no throw.** So the throw is **specific to the BEHIND path**,
exactly as both earlier occurrences described it: `update-branch` restarts CI, and the queue
attempt races it. **A CLEAN PR never enters that path**, which is why this is not urgent and why
one clean merge is not evidence the defect is gone. ⚠️ The probe still wants a **BEHIND** PR: if a
later run merges one and the first call does not throw, the finding is wrong; if it throws, that is
the third occurrence and the recommended fix (poll checks after `update-branch`, then queue) stops
being deferrable. The fix itself is a `scripts/pipeline/pipeline-lib.ps1` change —
**the first entry on `instrument-lane.json`'s NEVER-LIST**, which is precisely why #2261 sits red
and un-mergeable by any station (NEVER_LIST_BEFORE_ARMING_V1). Staging a second prompt into that
same dead end this run would have added a PR Marco must release to no purpose.

### F3 — 53 escalations remain and section 5 cannot clear any of them; the `[STALE]` channel produced nothing this run

[MEASURED] `needs-marco/ 53` (down from 54 after the 00:15Z retirement), and section 5's output
across both sweep runs contains **zero** `[STALE]` rows. Every line is either `cites #N (MERGED) as
evidence -- not its premise` or `names no subject PR ... section 5 CANNOT decide whether it is
stale. Read the file; do not clear it on this line alone.` **So the instrument that exists to find
dead escalations is working and is telling me there are none to find** — the negative is reported
rather than treated as silence (§9.6).

**DISPOSITION: DEFERRED** — and deliberately not converted into a bulk triage. Clearing an
escalation on a `[FILE]` line the sweep itself says clears nothing is the exact error the
`CADENCE_THIRD_LOCATION_LANDED_V1` note records as expensive: it re-surfaces discharged work to
Marco. It becomes urgent if the count climbs without any run retiring anything, which would mean
the discharge path has stopped working rather than that nothing is dead.

### F4 — the watcher's unguarded `Get-CimInstance` crash loop and its missing reporter (03's F2/F3), carried forward unchanged

Seven `WATCHER-CRASH-LOOP` escalations share one named cause at
`scripts/pr-watcher/start-watcher.ps1:137`, and `supervise-watcher.ps1`, the component that writes
those escalations, is not in the live chain — so the next crash loop produces silence.

**DISPOSITION: DEFERRED**, unchanged from both previous runs', and I am not re-deciding it. The
reasons still hold and I re-read them rather than re-deriving them: `scripts/pr-watcher/**` is the
path §9.5 says needs a **watcher restart** before the running `index.mjs` picks it up, and the
null-vs-empty question 03 raised (`-ErrorAction SilentlyContinue` alone turns "WMI is down" into
"no node is running", inviting a duplicate launch) is an unsettled design decision — §10.4 puts
those **before** the prompt, not inside it, and §5 stop 5 forbids guessing Marco's intent.
[MEASURED] this run's own reading of the machine, from the sweep and nothing more:
`watcher node: RUNNING pid 8848`, `auto-restart wrapper: alive (1)`, `heartbeat age: 30 min`,
`watcher clone: branch=main tracked-dirty=0 untracked=3`. Machines are 03's lane; I did not probe
further. The silence half is already ESCALATED to Marco inside the 23:07Z run's Question 2, on
`main`. It becomes urgent on the next crash-loop escalation — and F4's second half is why that
escalation may never arrive.

### F5 — the device-bridge git guard is INERT (exit 2): the ban is remembered, not mechanical

[MEASURED] quoted verbatim under WHAT I MEASURED, exit read from the installer with no pipeline
appended. This is now the sixth independent station measurement of exit 2 in 24 hours.

**DISPOSITION: DEFERRED** — the station doc declares exit 2 the EXPECTED station outcome and
explicitly refuses to widen the stop contract for it, because turning an inert shell script into a
frozen board is the outcome the guard exists to prevent. Recorded, obeyed, not repaired: no `git`
touched the mount this run. It becomes urgent if the exit code **changes** — non-zero other than 2
means the shim was never written, and **0** means the protection became mechanical, at which point
every station doc's "remembered, not mechanical" wording is itself the stale instruction.

### F6 — `triage-holds.ps1` cried SUSPECT again on a correctly-gated board, and this run is the third written contradiction

[MEASURED] this run: `!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a
broken ...` printed alongside `still-gated=14` of 14 — i.e. the banner fired **because** the board
is uniformly and correctly gated, which is 04's F4 reproduced for the third consecutive cycle.
The reading it decorates is sound and I acted on it: `gates-satisfied=0` is why nothing was armed.

**DISPOSITION: DEFERRED**, unchanged. 04's narrowing is the right one — suppress the banner when
both positive controls PASSED **and** the single bucket holds more than one distinct reject code —
and it is a `scripts/pipeline/**` change wanting its own PR and a test. It costs nothing per run
beyond a misleading line that three breadcrumbs now contradict in writing. ⚠️ Its real cost is the
§7 one: a station that trusts the banner distrusts a correct arming answer, and a station that
learns to ignore the banner will ignore it on the day the instrument genuinely is broken.

### F7 — three HOLDs are held ONLY by Marco's `do-not-arm` marker (04's F2)

`pr-queue-layout-sot-entry`, `pr-scopecards-s8b-azure-maps-travel`,
`pr-sec-a2-email-codes-and-reset-links`. Their dependency gates have released on `main`; the human
marker is the only remaining protection, and `triage-holds.ps1` counts that marker as a live gate,
which is why this run's `still-gated=14` and 04's finding are both true at once.

**DISPOSITION: ESCALATED — already, by 04, in its own words, and that breadcrumb is on `main`
where Marco reads it** (#2267). I deliberately did **not** re-ask it in my own words, did **not**
pre-clear any marker, and did **not** arm any of the three. Removing a `do-not-arm` marker is a
human act by construction: arming these is the decision the marker exists to reserve.

### F8 — orphan worktrees at 31, plus 2 registry escapees, four of them holding work `--force` would destroy

[MEASURED] sweep section 2 this run: `non-main worktrees found: 31`,
`worktree-registry-escapees: 2 found -- Station 03 should review and prune if confirmed dead`.
The dangerous ones, unchanged: `C:/po-wt/fv2drop` holds **21 commits on no remote branch**;
`C:/po-worktrees/sup-cwd-paths` 4 commits **plus 2 uncommitted files**;
`C:/po-worktrees/marco-queue-line` 1 commit + 1 dirty file;
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 commit + 1 uncommitted file.
Also present: `C:/po-worktrees/st05-sot-2026-10-09` at age 151 min, dirty=0 — Station 05's leftover
from its own 22:38Z run, named here so 03 does not have to guess whose it is.

**DISPOSITION: DEFERRED**, unchanged and for the same reason: §5 stop 4 requires the verification
step to **complete before** the destructive one, never alongside it, and the verification is
per-worktree (`gh pr list --head <branch> --state merged`, then `git -C <path> status --porcelain`
to list and preserve). ⚠️ **I added one of my own this run** (`C:\po-wt\sup00-0115`) and it is torn
down below, so this run does not add to the pile. The trend — 27 → 32 → 31 → 31 across six days —
is the thing worth watching, and the cause is that most runs leave their worktree behind. Pruning
is 03's lane.

### F9 — #2261 is Marco's, red, and 46 hours old, and nothing a station can do moves it

[MEASURED] `#2261 BEHIND`, `CI: 13 pass / 2 fail / 0 pending`, labelled `do-not-merge`, open 46 h,
and it is the whole of `WAITING ON MARCO: 1`. [MEASURED] its target is
`scripts/pipeline/pipeline-lib.ps1` — the **first entry on `instrument-lane.json`'s NEVER-LIST** —
so CP-26 fails `RECEIPT_REQUIRED_BY_DIFF` and **no receipt form is open to any station**. The
2026-10-07 runs diagnosed its two reds as the `do-not-merge` label working rather than a
regression, and nothing this run changes that.

**DISPOSITION: ESCALATED — already open with Marco and NOT re-asked.** It is in the queue as
`needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`,
which sweep section 5 confirms `[LIVE] references #2261 = OPEN -- genuinely open`. I removed no
label, added none, and did **not** call `gh pr update-branch` on it: §8.3 says never update a
branch you are not about to merge, and every stray update costs a full CI rebuild. ⚠️ The standing
question underneath it — whether never-listed targets should be refused at `lint-prompt.mjs`
admission time rather than discovered at 13/15 green — is already in that same file; I did not
re-word it.

### F10 — the backlog's one READY item is not an arming decision

[MEASURED] sweep section 6: `ready=1  needs-marco=2  blocked=4  broken=0`, and the READY entries
printed are `[P2] web-raw-error-envelope-migration` (ready *while* any web file still feeds a raw
response body into an error message — a gate that dies only when the migration finishes) and
`[P2] tenant-mt4-slices-3-4-5`, whose slices are already staged. **A registered backlog item whose
gate is deliberately still alive is not something to arm**; the arming question is answered by
`gates-satisfied=0 of 14` above, and the only board-level way to arm anything today would be to
clear one of F7's markers, which is Marco's.

**DISPOSITION: DEFERRED.**

### F11 — the three `failed/` entries from the revoked token are still correctly a no-op

Two of the three are auto-generated watcher **review jobs** (`rev-<n>-ready.md`, no front matter by
design — §9.5), so restaging one is not a repair; the third, `pr-doctrine-core-and-reference`,
*looks* spent only on an `[INFERRED]` reading. Naming the PR that landed the DOCTRINE core/reference
split needs a `gh` search over merged PRs touching `docs/pipeline/DOCTRINE-REFERENCE.md`, and
**I did not run it this run** — I am saying so rather than implying I looked, because moving a
prompt on an inference is the mistake two previous breadcrumbs exist to record.
[MEASURED] `failed/` holds 80 files and the newest write across all of them is
`2026-10-06 05:47:39Z` (sweep section 4B), so **nothing in it is new and nothing is degrading**
while this waits.

**DISPOSITION: DEFERRED.**

### F12 — the cron collisions and 03's cadence disagreement: re-measured, no new ask

[MEASURED] `--freshness` shows all four stations inside one cadence with no doubled fire, so the
post-outage catch-up burst that 03 measured is drained and stays drained. The 00×04 six-times-daily
overlap, the 00/04/05 midnight-local three-way, and 03's bootstrap claiming a 4-hour cadence
against a `0 9 * * *` cron are all already open with Marco in the **scheduled-tasks layer**, which
no station may edit.

**DISPOSITION: DEFERRED** — no new ask, and deliberately not re-raised as one.

## WHAT I DID NOT DO

- **Did not touch #2261.** Open, BEHIND, `CI: 13 pass / 2 fail`, labelled `do-not-merge`, open 46 h.
  Station 00 never merges a PR carrying that label and never removes it — **only Marco removes it**.
  I did not update its branch either (§8.3 UPDATE_AT_MERGE_TIME_V1: never `gh pr update-branch` on
  a PR you are not about to merge).
- **Did not arm, disarm, rename or move any prompt.** `armed = 0` on arrival and on exit;
  `gates-satisfied = 0 of 14`. The only queue-root files this PR touches are the seven breadcrumbs
  moved to `archive/`, which are reports, not prompts, and whose filenames are unchanged (§10.5).
- 🔴 **CORRECTED.** This bullet read: *"Did not merge anything, and did not call `Merge-Pr` or
  `Assert-SmokedOrEscalate` at all. The one open PR is Marco's; this run's own PR is left for the
  next occurrence to drive... **It is left OPEN, not QUEUED**."* **That was true when written and
  false by the end of the run.** What actually happened: CI on #2269 was polled until settled
  (`pass=10 skip=5 fail=0 pending=0`, `mss=CLEAN`), the lease was renewed,
  `Assert-SmokedOrEscalate -PR 2269` returned `True`, and `Merge-Pr -PR 2269` returned
  `State=MERGED` on its **first** call, read back from GitHub as `state=MERGED
  mergedAt=2026-10-09T01:41:58Z`. **MERGED, not QUEUED.** The only PR left open is **#2261**, which
  is Marco's and was not touched.
- **Did not type `gh pr merge`, `gh pr update-branch`, or any raw `git merge` against a PR.**
- **Did not add or remove any label, on any PR.**
- **Did not pre-clear a `do-not-arm` marker** (F7), and did not re-ask 04's question in my words.
- **Did not retire any escalation, and did not append to any file under `needs-marco/`.** There was
  no `[STALE]` row to act on (F3), and 6 of 61 files in that gitignored folder are tracked in fact,
  so an append there can ride into another actor's commit.
- **Did not stage the watcher `Get-CimInstance` prompt** (F4) — it carries an unsettled design
  decision, and §10.4 puts that before the prompt, not inside it.
- **Did not stage the `Merge-Pr` retry fix** (F2) — `pipeline-lib.ps1` is the first entry on the
  NEVER-LIST, so the PR would arrive un-mergeable by any station and add to Marco's queue, which is
  what #2261 already demonstrates.
- **Did not touch `/sot/`.** Station 05's lane only. No `sot/` path appears in this PR's diff,
  which also keeps it inside 00's `docs/` lane and clear of the `sot`-lane receipt trap.
- **Did not prune any worktree other than my own**, including the two registry escapees and 05's
  leftover (F8). Pruning is 03's lane and the per-worktree verification must complete first.
- **Did not restart, stop or probe the watcher for liveness beyond the sweep's own reading**, and
  did not dispatch a restart. 03 measured 0 files under `scripts/pr-watcher/` in the clone's drift,
  so §9.5's restart rule does not fire.
- **Did not run `git` against the mount**, in any form, the guard being inert (F5). Every git
  reading here came from `powershell.exe` on the Windows host.
- **Did not use `git checkout -- <path>`, `git clean`, `reset --hard` or `stash pop`** anywhere
  (§9.2 — consumed prompts come back armed). The seven archive moves were `git mv` on files proved
  tracked first.
- **Did not compare a piped hash against anything.** No
  `git show <ref>:<path> | git hash-object --stdin` was run; the archive moves were verified by
  `R100` in `git diff --cached --name-status`, which is the index's own similarity reading.
- **Did not create, edit, enable, disable or re-run any scheduled task.** `--freshness` was CLEAN,
  so no MISSED reading arose — and a MISSED reading would not have authorised it anyway.
- **Did not clear any lock.** None existed: `index.lock interactive/clone: False / False`, no git
  process touching our trees, and no `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
  rebase-merge / rebase-apply / sequencer in either tree per the sweep.
- **Did not write to any of the five gitignored `docs/qa/` sinks**, and did not write this report to
  the session's `outputs` folder or leave it in a disposable worktree's untracked state. It is at a
  tracked path **inside this run's own PR** (Cure 1).
- **Did not quote a `lint-prompt.mjs` result as a breadcrumb verdict.** `breadcrumb-clean` here
  rests on `check-breadcrumb.mjs` exit 0 only.
- **Did not touch Azure, Entra, SharePoint, production data, or any secret.** Absolute, every
  station, every run.
