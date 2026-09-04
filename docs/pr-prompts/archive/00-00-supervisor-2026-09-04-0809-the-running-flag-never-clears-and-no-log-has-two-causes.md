# Station 00 — Supervisor | 2026-09-04T08:09Z–2026-09-04T08:4xZ

**SIGHTED, not blind.** `start_process` shell `powershell.exe` returned PID 19712 on the first call
(`Get-Date` → `2026-09-04T18:09:08.62+10:00`, `hostname` → `LAPTOP-E6NHU4E4`). Every reading below
was taken on the box.

## GROUND

```
UTC            2026-09-04T08:09:30Z
origin/main    99451d99            (git fetch origin --prune, then rev-parse)
dev tree       main @ b76ff07e -> 99451d99   C:\ProjectOperations2   (5 behind at start; ff'd, exit 0)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — full authority this run.
**Which tree I read in:** the dev tree `C:\ProjectOperations2`. Board work was built in an isolated
worktree `C:\po-fresh` off `origin/main`, torn down at the end.

⚠️ **My own preflight step 2 lied to me, exactly as Station 04 predicted 2 hours earlier.** The
mandated freshness probe reported all three binding documents as `DIFFER` from `origin/main` at a
commit where `git status` showed them clean. That is F1 below; it is why this run's first substantive
act was to fix the probe rather than to chase a phantom stale checkout.

## WHAT I MEASURED

**[MEASURED] The dev tree was 5 commits behind and fast-forwarded cleanly.** `b76ff07e..99451d99`,
`git merge --ff-only origin/main` exit 0. The `.gitattributes` FF failure recorded on 09-04 did
**not** recur. Two unstaged deletions were present and are the consumed HOLDs of F5;
`git diff --cached --name-status` was **EMPTY**, so nothing else was staged in the shared index.

**[MEASURED] `bring-up-to-speed.ps1` at 08:12:50Z.** Section 0 controls PASS (`gh` reached GitHub,
saw merged #1576; `node` runs). **VERDICT: CAUTION** — 1 LIVE STATION WORKTREE (`C:/po-vg`), which
binds me to an isolated worktree and new branches only. It does not bar action.

- `[LIVE]` OPEN PRs: **1** — `#1577` BLOCKED, CI 13 pass / 0 fail / 1 pending.
- `[LIVE]` armed `*-ready.md`: **0**. HOLDs: **76**. `needs-marco/`: 16. `no-pr-opened/`: 109.
- `[LIVE]` watcher node RUNNING pid 2572; wrapper alive; heartbeat 12 min.
  `restart-watcher-if-wedged.ps1` at 08:18:12Z → **`VERDICT: OK`**, churn 0 cycles in 20 min.
- `[LIVE]` single-actor gate, re-read immediately before mutating: in-progress prompts **0**,
  `index.lock` **False / False** in both trees, git processes **0**, no PR touched in the last 2 min.

**[MEASURED] RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`:
**1881** logs, newest `2026-09-04 08:01`, `marco.:true` → **608**, `marco.:false` → 0. Age control
passes (newest log is younger than the only open PR). **Negative control passes**: `#1573` returns
`pr-claudedesign-s1-track-the-written-half-ready.md.log` with a real verdict, so `NO LOG` is a real
absence and not a broken probe. `#1570`, `#1572`, `#1574`, `#1576`, `#1577` all read **NO LOG**.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** 5 breadcrumbs checked, 0
malformed; 00 `1.1h ago (cadence 2h) ok`, 03 `9.3h ok`, 04 `2.1h ok`, 05 `10.4h ok`. Crossed against
`list_scheduled_tasks`: 00 `lastRunAt 08:08:50Z` (this run) on cron `5 * * * *` — **hourly, while the
detector still records its cadence as 2h**; 04 `06:10:28Z` aligned with its 06:10Z breadcrumb;
03 `2026-09-03T23:01:39Z` on cron `0 9 * * *` (daily, bootstrap says 4h — the open escalation);
05 `lastRunAt 2026-09-03T14:11:26Z` while a 05 breadcrumb dated `21:54Z` exists, i.e. **that catch-up
was not a scheduled occurrence** (it is #1575, merged 07:42Z) and 05 has still not fired since
09-03T14:11Z. Next 05 occurrence `14:10:37Z` today.

**[MEASURED] Two `"00 supervisor"` sessions read `running` and neither was alive.** See F2 for the
numbers; this is the reading that decided whether this run was allowed to act at all.

## WHAT CHANGED

One PR, built in `C:\po-fresh` off `99451d99`, branch `docs/freshness-probe-not-piped`. Everything in
it is under `docs/`.

1. **The freshness probe in the `station-contract v2` canonical block, all 7 station docs** (+21 lines
   each, byte-identical). Pre-record control: `REJECT 7 of 8`, **all seven naming the same new sha
   `02e4c51cbc087b9a`** — the block did not fork. `lint-station.mjs --write-canonical`, then
   `lint-station.mjs` → **`ADMIT: all 8 docs clean`, exit 0**. `U+FFFD` = 0 and the new marker appears
   exactly once in each of the seven; CRLF preserved.
2. **DOCTRINE §9.5, two new bullets** (F2 and F3 below), inside the `instruments v2` block. Pre-record
   control: `REJECT: 1 of 8` — DOCTRINE alone, which is correct because `instruments v2` is
   DOCTRINE-only. Re-recorded (`instruments v2` → `d4bfbb125e122f8e`); `station-contract v2` unchanged
   at `02e4c51cbc087b9a`. `ADMIT: all 8 docs clean`, exit 0. `U+FFFD` = 0.
3. **`pr-preflight-tool-names-are-environment-specific-HOLD.md`** — Station 04's F2 missed caller
   closed *before* the arm, not after: `docs/pipeline/STATION-CAPABILITIES.md` added to `scope`,
   `done_when` extended with `! grep -q "device_bash" docs/pipeline/STATION-CAPABILITIES.md`, and a
   section added saying what to do there. Re-linted: **`ADMIT (size 3)`, exit 0.** Still a HOLD; not
   armed.
4. **Five breadcrumbs collected** into the PR (three 00, one 04, plus this one), and
   **`docs/pipeline/sweep-rotation.json`** committed — Station 04 left it dirty deliberately and said
   the rotation stops turning until 00 commits it.
5. **Two spent HOLDs deleted** (F5).

**Nothing else.** No arm, no merge, no label touched, no `do-not-merge` removed, no `/sot/` edit, no
git command in the watcher clone, no watcher restart.

## FINDINGS

### F1 — The freshness probe every station runs in step 2 is unsound in PowerShell, and it lied to me too. FIXED.

Station 04 measured this at 06:1xZ and **DISPATCHED it to me**. I reproduced it before fixing it:
`git show origin/main:<path> | git hash-object --stdin` returned values matching neither the blob nor
the disk for all three binding docs, at `HEAD == origin/main` with `git status` clean. PowerShell
decodes the native command's stdout to strings and re-emits it re-encoded; `--stdin` has no path, so
no `text=auto` filter undoes it. Both forms exit 0 and print a well-formed SHA, so nothing warns.

Three runs in three hours have now been misled by it: 00 at 05:40Z (right conclusion, wrong cause —
it blamed the CRLF smudge, and renormalising the tree would have been a no-op leaving the lie in
place), 04 at 06:1xZ (read all three of its own binding documents as stale), and this run at 08:11Z.

**DISPOSITION: ACTIONED.** RULE-1 option (a), 04's complete-and-additive one, is now in the canonical
block of all seven station docs: `git rev-parse origin/main:<path>` for *which blob*,
`git hash-object <path>` for *which blob the working copy is*, and
`git diff --numstat origin/main -- <path>` for *is it different* — none of which pipes or re-encodes,
and all of which agree across PowerShell, cmd, bash, node and CI. The paragraph explicitly preserves
Station 03's 09-03 tree-to-tree measurement, which compared the same transform on both sides and
still stands. Verified by the pre-record fork control and `ADMIT: all 8 docs clean`.

### F2 — `list_sessions`' `running` flag never clears, two runs have already stood down on it, and one made it a precondition for arming

[MEASURED] at 08:1xZ, two `"00 supervisor"` sessions read `running`:

| session | created | newest file write | idle at 08:1xZ | reported |
|---|---|---|---|---|
| `local_38901e4d` | `2026-09-04T04:08:48Z` | `05:15:26Z` | **2.9 h** | `running` |
| `local_a03e81fe` | `2026-09-03T21:08:45Z` | `03:59:32Z` | **4.2 h** | `running` |

A 00 run takes 15–25 minutes. Two independent instruments refute the flag: zero filesystem activity
for hours, and `38901e4d`'s own final report, whose header declares `04:09Z–04:25Z`.

Why this is not a curiosity. **The 07:11Z run measured `38901e4d` as `running` and cited it as one of
its two reasons to touch nothing**, and 00-0609 FINDING 3 wrote *"`list_sessions` shows no other
`00 supervisor` in `running` state"* into the arming trigger for the docs-only fix to PREFLIGHT step 1
— the defect that begins every station's every run. **A flag that never clears can never satisfy that
precondition.** The fix was gated behind a condition that is unreachable by construction, which is
why it has now sat unarmed for two days while every run trips over the thing it fixes.

**DISPOSITION: ACTIONED, and the trigger is restated.** The durable form is now in DOCTRINE §9.5.
The sound single-actor probe is `status-sweep.ps1` section 3 — in-progress prompts, `index.lock` in
both trees, running `git` processes, PR touched in the last two minutes — cross-checked against the
session directory's newest file write; `list_sessions` remains sound for *which* sessions exist and
as the route into `read_transcript`. **Restated arming trigger for the next 00:** (1) real armed = 0,
counting `*-ready.md` **excluding** the `rev-<N>-ready.md` review-job pattern; (2) `status-sweep.ps1`
section 3 clean, re-read immediately before the arm — **not** `list_sessions`; (3) re-run RULE 4's
three-marker detector with its positive control, because ADMIT expires. All three were true this run;
I still did not arm, for the reason in F4.

### F3 — `NO LOG` has two causes and the dangerous one is invisible: #1570 was a watcher PR from an `escalates: true` prompt and the probe cannot see it

DOCTRINE §9.5 currently ends by saying the negative control proves `NO LOG` means *second lane* and
not *probe broken*. [MEASURED] there is a third state, and it is the one RULE 2 exists for.

`#1570` was opened **by the watcher**, from `pr-watcher-merge-policy-nested-test-paths`, whose front
matter reads `escalates: true`. My probe — controlled three ways: 1881 logs, newest inside the hour,
POS 608, and `#1573` returning a real verdict as the negative control — returns **`NO LOG`** for it.
The cause is in the 06:19Z breadcrumb: the watcher exited `raw node exit: -1` between opening the PR
and writing the merge verdict, so the verdict line was never written. The same crash also meant the
`do-not-merge` label that `escalates: true` promises was never applied (that is 00-0619 FINDING 1).

So one reading, two opposite meanings: a benign second-lane PR that no human ever routed, and an
escalating watcher PR whose human gate died in transit. §10.1 step 2 sends both down hand-
classification. That is safe **today** only because `scripts/**` is outside `^(tests|docs)/` — and
#1570, now merged, is precisely the change that puts nested test paths **inside** the auto-merge lane.
After it, an escalating prompt scoped to nested tests whose watcher crashes would be unlabelled,
verdict-less, and auto-mergeable.

**DISPOSITION: ESCALATED — Marco, folded into OPEN escalation 00-0619 FINDING 1, deliberately not
raised separately.** Same defect, same cure, second mouth: that finding's RULE-1 option **(a)** —
apply `do-not-merge` before or in the same guarded step as opening the PR, or label from the prompt's
front matter at queue time — closes the detection half too, because a labelled PR needs no verdict to
be gated. **What this run adds to the escalation, and it strengthens (a) specifically: the gap is not
merely unlabelled, it is undetectable after the fact.** (b) a reconciler still fails the *immediately*
half; (c) rely on hand-classification now fails the *future* half outright, because #1570 has landed.
The §9.5 bullet added this run makes the ambiguity visible to the next reader in the meantime; it is
a warning, not the fix.

### F4 — The PREFLIGHT fix is now one step from arming, and I deliberately did not arm it

`pr-preflight-tool-names-are-environment-specific-HOLD.md` re-lints **`ADMIT (size 3)`, exit 0**; its
premise is alive (`mcp__remote-devices__` still present on `origin/main`); its scope, after this run's
edit, covers the one caller Station 04 found missing. Real armed is 0 and the single-actor gate is
clean.

I did not arm it because **its scope is the same eight files this run's PR is changing.** Arming now
would put the watcher to work against a canonical block that is about to move, and its `done_when`
runs `lint-station.mjs`, which would REJECT against the old recorded hash. Arming it *after* this PR
lands costs one cycle and removes the collision entirely; arming it now risks a red PR for a
first-step-of-every-run fix that has already failed to land twice.

**DISPOSITION: DISPATCHED → the next Station 00 run, with a one-step handover.** Preconditions, in
order: (1) this run's PR is merged and on `origin/main` — confirm with `git log origin/main`, not
with the PR page; (2) F2's restated trigger, all three parts, re-measured immediately before the arm;
(3) `arm-prompt.ps1 -Name pr-preflight-tool-names-are-environment-specific`, never a bare `git mv`.
Note for the agent that builds it: `_canonical-blocks.json` is in the prompt's scope, so re-recording
the hash on top of this run's change is inside its remit and its `done_when` will do it.

### F5 — Two spent HOLDs were still tracked on `main` and would have been armable again

[MEASURED] `pr-claudedesign-s1-track-the-written-half-HOLD.md` and
`pr-watcher-merge-policy-nested-test-paths-HOLD.md` were both armed today (06:19:49Z and 06:41:04Z per
`.arming-log.txt`), both consumed by the watcher, and both showed as **unstaged deletions** in the dev
tree while remaining tracked on `origin/main`. Their work has shipped — #1570/#1572 and #1573 are all
merged — so a future `triage-holds.ps1` pass would have offered both as live candidates again. This is
the known "an armed prompt whose PR does not delete it stays armable forever" defect, hitting twice in
one morning.

**DISPOSITION: ACTIONED for these two** — deleted in this run's PR, which is what makes the deletion
reach `main` rather than sit unstaged in one tree. **The general defect is unfixed and is not mine to
close by hand:** the cure is a queue check that fails when a prompt is armed while its `-HOLD.md`
remains tracked, and `pr-queue-armed-tracked-detector` was armed at 04:15:30Z today toward exactly
that. Whoever picks it up should confirm whether it shipped before writing a second one.

### F6 — `#1577` is a second-lane PR in Marco's lane. Not merged, and not mine to merge.

[MEASURED] `#1577` `fix(pr-watcher): never rebase a PR whose checks are still running`, opened
`07:53:44Z`, head `fix/no-rebase-while-checks-run`, 2 files —
`scripts/pr-watcher/__tests__/update-branch-guard.test.mjs` and `scripts/pr-watcher/index.mjs`.
`mergeStateStatus: BLOCKED`, 13 pass / 0 fail / 1 pending, `labels: []`. The RULE 2 probe returns
**NO LOG** with its controls passing.

`[NO LANE VERDICT — hand-classified]`: both paths are outside `^(tests|docs)/`; no station lane
covers `scripts/`; §10.1's one live exception is 05 → `sot/`. **Therefore MARCO'S.** Recorded so the
next run does not re-derive it — and note F3: with `NO LOG` I cannot distinguish "second lane" from
"watcher crashed before the verdict", which makes the hand-classification the only gate here.

**DISPOSITION: DEFERRED — it is Marco's to merge.** It becomes urgent only if its pending check goes
red, which would be a defect to fix rather than a merge to make.

### F7 — Escalation #23 recurrence: 00's recorded cadence is still 2h against an hourly cron

[MEASURED] `check-breadcrumb.mjs --freshness` printed `00 … (cadence 2h) ok` while
`list_scheduled_tasks` returns `cronExpression: "5 * * * *"` for `00-supervisor` — hourly. With the
detector alarming only past **2×** cadence, Station 00 must miss **four** consecutive occurrences
before it can read SILENT. Today's five 00 runs (05:40, 06:09, 06:19, 07:11, 08:09) are the hourly
cadence in evidence.

**DISPOSITION: ESCALATED — Marco, as recurrence evidence on OPEN escalation #23, not a new
escalation.** No new options; #23's RULE-1 option (a) — record each station's real cadence and alarm
at `1× cadence + grace` — is unchanged and still first. The one datum added: the discrepancy is now
observable in a single command pair, `--freshness` beside `list_scheduled_tasks`, with no inference.

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is `#1577`, hand-classified as Marco's (F6). No
  `do-not-merge` label was touched anywhere, and no RULE-2 clearance was claimed.
- **Did not arm.** F4 gives the reason, and it is a collision argument, not a caution: the candidate's
  scope is this PR's diff.
- **Did not restart or touch the watcher.** `VERDICT: OK`, alive, 0 churn — an idle watcher with 0
  armed is correct, not wedged.
- **Did not prune any worktree.** The sweep names three orphaned (`C:/po-1483-fix`, `C:/po-guard`,
  `C:/po-sa-fix`), one detached (`C:/po-work/s2-e2e`), two registry escapees under `C:\po-worktrees`,
  and one LIVE (`C:/po-vg`, which owns #1577). 00-0609 FINDING 5 deferred these deliberately and
  nothing has changed; pruning under a CAUTION verdict, next to a live worktree I do not own, is the
  shape of the incident this station is named for. **`C:\po-fresh` — my own — is torn down.**
- **Did not act on `C:/po-guard` / `guard/never-arm-cd-s1`.** 00-0619 FINDING 4 escalated the question
  *"was CD-S1 meant never to be armed?"* to Marco and it is unanswered; CD-S1 has since merged as
  #1573 under a `marco:true` verdict, which makes the question worth an answer but not urgent.
- **Did not touch** `/sot/`, Azure, Entra, SharePoint, production data, or `git` in the watcher clone.
- **Did not archive any breadcrumb.** All five collected here are today's cycle, and the station
  contract says the current cycle stays in the queue root.

---

## ADDENDUM 2026-09-04T08:4xZ — the PR landed, so F4's precondition was met inside this run; and four watcher fixes merged today are not running

### 1. F4 is SUPERSEDED: ACTIONED, not DISPATCHED

F4 above dispatched the arm to the next run because the candidate's scope was this run's diff. **That
collision ended when the PR merged**, so the handover's own precondition (1) was satisfied 18 minutes
later and there was no reason to bill another run for it.

[MEASURED] `#1578` MERGED `2026-09-04T08:27:04Z`, squash `d055c726`, read back on `origin/main`:
`d055c726 docs(pipeline): the freshness probe is unsound in PowerShell, and NO LOG has two causes (#1578)`.
Dev tree fast-forwarded to `d055c726`; the FF aborted first on four untracked breadcrumb copies and a
dirty `sweep-rotation.json`, each proved byte-identical to `origin/main` with the run's **new** probe
(`git rev-parse origin/main:<path>` vs `git hash-object <path>` → SAME on all five) before being
removed or restored by pathspec. The board was then **empty — 0 open PRs.**

F2's restated trigger, re-measured immediately before the arm: real armed **0** (`rev-1578-ready.md`
excluded as a review job); `status-sweep` section 3 clean — `index.lock` False/False, git processes 0,
no PR touched in 2 min; watcher `VERDICT: HEALTHY`. RULE 4's three-marker detector on the candidate:
**0 / 0 / 0**, with `pr-524-rates-b-slice2-canonical-HOLD.md` as the **positive control firing 0 / 1 / 1**.
Premise re-verified alive on `origin/main`. `lint-prompt.mjs` → **ADMIT (size 3), exit 0**.

**ARMED** via `arm-prompt.ps1` at **08:29:37Z**, exit 0. Read back: `-ready.md` present, `-HOLD.md` gone,
`git diff --cached` **empty**. The watcher took it 23 seconds later —
`[08:30:00.210Z] [start] pr-preflight-tool-names-are-environment-specific-ready.md` — and did **not**
crash, unlike the 06:19Z arm. **DISPOSITION OF F4, SUPERSEDING THE ONE ABOVE: ACTIONED.**

### 2. FINDING 8 (NEW) — four `scripts/pr-watcher/**` PRs merged today are not the code that is running, and one of them just failed visibly

[MEASURED] The live watcher is **pid 2572, started `2026-09-04T06:25:08Z`**. Merged after it started,
all touching `scripts/pr-watcher/**`: **#1570** (06:40:28Z), **#1572** (07:22:09Z), **#1574**
(07:59:33Z), **#1577** (08:15:06Z). A running watcher executes the code it was launched with, so
**none of those four fixes is in effect.**

This is not an inference. `#1574` is titled *"the verdict guard blocked reviews for showing their
work"*. At **08:29:58Z**, thirty minutes after it merged, the running watcher logged:

```
[2026-09-04T08:29:58.447Z] [verdict-guard] PR #1578: verdict cites files not in PR — blocking mirror, moving to blocked/
```

— the exact behaviour #1574 removes, on a review whose verdict was **MERGE** for an already-merged PR.
Harmless this time; not harmless in general. By the same token `#1577` (*never rebase a PR whose checks
are still running*) is also not live, so the `PR_WATCHER_AUTO_UPDATE` churn that cancels in-flight CI
is still armed.

**DISPOSITION: DEFERRED, with a trigger and an explicit bar.** The cure is the one the station brief
and the FIX LANE both name: an **idle-window** restart — kill the wrapper first, then the node, relaunch
DETACHED via `C:\po-watcher\watcher-launcher-singlelane.ps1`. **I did not do it, and no run may do it
until the queue is empty:** at the moment I measured this the watcher was mid-build on the prompt armed
above, and *"never restart mid-run"* is not a preference — killing a healthy agent mid-merge is worse
than the staleness it fixes. **Trigger: the next run that finds `armed = 0`, no in-progress prompt and a
`HEALTHY` verdict restarts it and reads back the new PID.** It becomes urgent sooner if any review is
seen blocked by `verdict-guard`, or if a PR's CI is cancelled by an auto-update rebase, since both are
fixed on `main` and only on `main`.

Worth recording as a pattern rather than an incident: **four watcher-code PRs merged in under two hours
and the restart that makes any of them real has no owner and no cadence.** Every one of those merges
read as "shipped" on the board while changing nothing about how the board actually behaves.
