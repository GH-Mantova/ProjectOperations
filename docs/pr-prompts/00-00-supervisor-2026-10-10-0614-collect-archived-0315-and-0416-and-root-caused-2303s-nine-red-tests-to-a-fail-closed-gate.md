# Station 00 — Supervisor | 2026-10-10T06:14Z–2026-10-10T07:0xZ

## GROUND

```
UTC            2026-10-10 06:14Z
origin/main    d197fc84            (fetched, then rev-parse)
dev tree       main @ d197fc84      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree**; this run was not read-only on that account.

## WHAT I MEASURED

**Not blind.** `ToolSearch` keyword `desktop-commander` loaded the toolkit in one call;
`start_process` (shell `powershell.exe`) returned on the first attempt, no retry needed.
Session: `/sessions/keen-fervent-lovelace`.

**[MEASURED] git guard, installer exit code read directly (not through a pipeline).**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` ->
**`GUARD_EXIT=2`**, last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/keen-fervent-lovelace/.local/bin:$PATH" git <args>
```

headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Exit 2 is the EXPECTED station outcome, a FINDING not a STOP. I ran no `git` against the mount.

**[MEASURED] the three binding documents were read from `origin/main` in the DEV TREE**, never
the working copy: `git -C C:\ProjectOperations2 show origin/main:<path>` for
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` (466 / 508 / 740 lines). Cores in full; no REFERENCE
section was needed this run, and none is quoted.

**[MEASURED] the dev tree is ATTACHED and clean — 0416's red follow-up is closed.**
0416 ended with *"the next run must re-measure `git rev-parse --abbrev-ref HEAD` in the dev tree
BEFORE anything else"*. My first call in the tree, 06:14Z:
`rev-parse --abbrev-ref HEAD` -> **`main`**; `rev-parse HEAD` -> `d197fc841a69…`;
`rev-parse origin/main` -> `d197fc841a69…`. Identical. The actor's detached checkout was
re-attached before I ran; nothing was left behind for me to restore.

**[MEASURED] sweep.** `scripts/pipeline/status-sweep.ps1`, `SWEEP_EXIT=0`, 473 lines,
`generated 2026-10-10 06:15:12Z`. Section 0 positive controls both pass (`gh CAN reach GitHub`,
`node runs`) — so the report is trustworthy. Section 7:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
Run as a detached process writing to a file; it took **≈6 min wall clock**, and an inline run
would have hit the 180 s tool ceiling with no output (see F5).

**[MEASURED] board, re-asked per-PR rather than from a list response (DOCTRINE §9.4).**

| PR | state | mergeState | head | labels | CI |
|---|---|---|---|---|---|
| #2303 | OPEN | BEHIND | `01b79c9e` | `do-not-merge` | 11 pass / **4 fail** |
| #2294 | OPEN | BEHIND | `191a6e2a` | `do-not-merge` | 13 pass / **2 fail** |

`WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 10h`.
`ALL OPEN (non-draft): 2`. **armed (`*-ready.md`): 0.** 16 `*-HOLD.md` in the queue root.
`main CI on d197fc84: 3 success / 1 failed` — **trunk is red** (F7).

**[MEASURED] safe-to-act, re-measured immediately before the only mutation this run made** (a
`[LIVE]` verdict expires the moment it prints): `index.lock=False`, `git-procs=0`,
`branch=main`, and `Enter-BoardLease -Actor 'station-00.scheduled'` returned **`True`**. I passed
`-Actor` explicitly, per the 2026-10-09 #2279 measurement — an unset actor generates `pwsh-<pid>`
and a station is then refused by its own lease.

**[MEASURED] freshness, and the MISSED reading classified before it was dispositioned.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` on the Windows host (never from the
mount — it shells `git ls-tree` / `git ls-files` / `gh pr list`): exit **2**,
`structure: 2 checked, 0 malformed`.

```
00  last 2026-10-10T04:16:00Z  2.1h ago  (cadence 1h + grace 0.5h)  MISSED
03  last 2026-10-09T23:03:00Z  7.3h ago  (cadence 24h + grace 3h)   ok
04  last 2026-10-10T02:10:00Z  4.2h ago  (cadence 4h + grace 1h)    ok
05  last 2026-10-09T14:22:00Z  16.0h ago (cadence 24h + grace 3h)   ok
```

Live cadences read from the scheduled-tasks MCP, never from a document: `00` `5 * * * *`
(`lastRunAt 2026-10-10T06:14:04Z` — this run), `03` `0 9 * * *`, `04` `0 */4 * * *`
(`lastRunAt 2026-10-10T06:09:44Z`, i.e. mid-run as I measured — the "fresh `lastRunAt`, no new
breadcrumb, session running" row, NOT a defect), `05` `10 0 * * *`,
`weekly-security-audit` `enabled: false` (unchanged).

**[MEASURED] the breadcrumb validator's own warning**, which is why this run opened a PR:
`NOTE  00-00-supervisor-2026-10-10-0416-….md is UNTRACKED — it reaches nobody until a board PR
commits it`.

## WHAT CHANGED

**One board PR, from an isolated worktree off `origin/main`** (`C:\po-wt\board-1010-0614b`,
branch `docs/board-2026-10-10-0614b`, created at `d197fc84`, read back:
`wt-exists=True wt-head=d197fc84 wt-branch=docs/board-2026-10-10-0614b`). It carries exactly:

1. `docs/pr-prompts/archive/` — the **0315** and **0416** breadcrumbs, both of which 0416
   explicitly left owed (*"the next run must archive it together with this one"*). Copy read back
   byte-for-byte, not assumed: `src=19622 dst=19622 same=True` and `src=35740 dst=35740 same=True`.
2. `docs/pr-prompts/` — **this** breadcrumb (current cycle stays in the root).
3. `docs/pr-prompts/needs-marco/` — **one new escalation**,
   `spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`
   (F3). No existing escalation was re-filed or duplicated (§10.5).

**Nothing else.** No arm, no merge, no label change, no branch update, no `/sot/` edit, no
scheduled-task change, no machine repair. The lease was taken for this PR and this PR only.

## FINDINGS

### F1 — the 05:14Z occurrence of Station 00 fired and died BLIND, and stopped before COLLECT although a blind run is allowed to collect

The `MISSED` above is a **lead**, and FRESHNESS_ONE_CADENCE_V1 requires classifying it as one of
*never fired* / *fired and died* / *reported, not merged* before dispositioning. It is the second.

**[MEASURED] it fired.** Scanning the local-agent-mode session tree at depth with no name filter
(DOCTRINE §9.5 — the directory name changed 2026-09-15), `CreationTimeUtc`:

```
10-10 03:14:03  …\fae0a45c
10-10 04:14:03  …\fa4efa35
10-10 05:14:05  …\0781709c   <- the MISSED occurrence
10-10 06:09:44  …\650fdffd   <- 04-scanner, mid-run
10-10 06:14:04  …\7c8e235d   <- this run
```

**[MEASURED] how it died**, from that session's own transcript (58 records, last assistant turn):

> `BLIND: MCP server plugin:desktop-commander:desktop-commander connection timed out after
> 30000ms (CONNECT_TIMEOUT)` … *"This run was blind and ended at STEP 1 … no breadcrumbs were
> collected, nothing was armed, nothing was dispatched, and nothing was merged."*

A `CONNECT_TIMEOUT` **after** a successful `ToolSearch` load is blindness, correctly called. It
reported loudly in chat, which is the required half. **That is the standing ~40% intermittent
blindness, not a new defect, and must not be inflated into one.**

🔴 **What IS a defect is the stop boundary.** `STATION-CAPABILITIES.md` §3 records, with controls
and a falsifying probe, that a blind run **can** collect: the Cowork mount *is* the live dev tree
(`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1` adds `Read`/`Glob`/`Grep` as a third transport, read-WRITE,
*"which is how a blind run leaves a report at a tracked path"*), and §3 states the standard in as
many words — *"a blind run therefore reports blindness as loudly as ever, and stops before acting
— but it COLLECTS first, and says which of the two it did."* **Neither CORE document a run reads
before stopping says this.** The bootstrap's STEP 1 says *"write one paragraph saying you are
blind … and END THE RUN"*; the station doc's PREFLIGHT step 1 says *"STOP. Write one paragraph …
end the run."* Both are read **before** §3, and a run obeying them literally never reaches the
correction. [INFERRED, from that ordering] this is why the 05:14Z run collected nothing.

**DISPOSITION: DEFERRED**, with the vehicle named, because it cannot be done in a board PR. The
sentence lives inside `<!-- CANONICAL-BLOCK: station-contract v5 -->`, which `lint-station.mjs`
requires byte-identical across all seven station docs — so the fix is one prompt that edits all
seven and re-records the hash, not a docs commit. The complete-and-additive wording (RULE 1) adds
a clause and removes nothing: *"…end the run — but COLLECT first through the mount or the native
file tools, write the breadcrumb, and say which of the two you did."*
**What would make it urgent:** a second blind occurrence in the same cycle, or a blind run landing
while a `needs-marco` item is live and unread. **The bootstrap half is Marco's layer, not this
repo's** — see FOR MARCO.

### F2 — 0416's F1 is closed: the dev tree was re-attached before this run, and nothing was left behind

**DISPOSITION: ACTIONED.** Verified by the three `rev-parse` readings under WHAT I MEASURED, not
by the absence of a complaint. `refs/heads/main == origin/main == d197fc84`, branch `main`,
`index.lock` absent, `git-procs=0`. I did not need to re-attach, fast-forward or restore anything,
and the EOL cure (0315's F2 / 0416's F7) therefore had **no blocker to clear** — `[CANNOT MEASURE]`
for a second consecutive cycle, which is a fact about this cycle and not a challenge to 0315's
reading.

Adjacent, and it explains 0416's observation rather than adding to it: `git diff --numstat
origin/main origin/pr-2303` shows pr-2303 **lacking** the 0315/0214/0210 breadcrumbs and holding
`0114` in the queue root where `main` has it under `archive/`. That is #2303 being `BEHIND`, which
is exactly what a detached checkout of its head would have put in the working copy. No action:
`Merge-Pr` updates a BEHIND branch at merge time, and nobody can merge this one anyway (F6).

### F3 — #2303's nine red tests are not a typo: its new gate fails CLOSED against the written contract that a broken instrument bins nothing

0416 recorded that #2303 went from one red to four and that nine `lint-prompt` tests regressed. It
did not have the cause. **I pulled the job log (§3 — never diagnose a CI failure from the diff)
and the cause is a collision between two rules this repo has both written down.**

**[MEASURED]** `gh run view 38022417243 --job 114126062937 --log` ends `# fail 9` /
`Process completed with exit code 1`, and all nine are HOLD fixtures flipping `expected: 0` ->
`actual: 1`, including the one that names the contract outright:

```
not ok 4 - gh binary absent -> exit 0 ADMIT with a WARN (fail-safe; a broken instrument bins nothing)
```

**[MEASURED] #2303 never touched the tests it broke.** `git diff --numstat origin/main
origin/pr-2303` lists one test file, the new `lint-prompt-spent-hold.test.mjs` (490 lines). The
nine live in `scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs`, **absent from
that numstat**; `git grep -n "gh binary absent" origin/main -- scripts/pipeline/__tests__` puts it
at line 265 on `main`. So the verdicts changed without the tests changing.

**[MEASURED] the mechanism, from #2303's own source.** `checkSpentHoldPrOpen` shells
`gh pr list --state open --limit 100 --json number,title,files` and returns
`SPENT_HOLD_PROBE_FAILED` on any probe error, with the reasoning written into the message:
*"The gate must NEVER silently ADMIT when the probe fails — DOCTRINE §7 + §9.6."* The suite runs
with no usable `gh`, so the probe fails, so every HOLD fixture rejects. **The author is quoting
DOCTRINE §7 correctly. The nine tests encode the opposite rule, equally explicitly.** Both are
real; they were never reconciled, and the collision was only ever visible as a red.

**DISPOSITION: ESCALATED.** Filed at
`docs/pr-prompts/needs-marco/spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`
in this PR, with three RULE 1 options, the complete-and-additive one first (make the probe
absence-aware: instrument missing -> ADMIT + loud WARN; instrument answered -> REJECT), and which
half each alternative fails. **I did not push a fix to #2303's branch** — see WHAT I DID NOT DO.

### F4 — #2303 is now an ABANDONED red, not a red being actively fixed

0416 declined to touch it on the ground that *"the fix lane pushed to it 20 minutes before I ran
and the watcher is mid-build on its review job."* Both halves have expired.

**[MEASURED]** head is **`01b79c9e`** — the same head 0416 measured at 04:2xZ, so **no push in
2 h 20 m**. The sweep's §3: `watcher build … no build in flight (newest tick is 66.4 min old;
ticks are 60 s apart while a build runs)`, `board lease: free`,
`no PR touched on GitHub in the last 2 min`. The `rev-2303` review build has landed and nothing is
working the branch.

This is the distinction 0416 asked the next run to draw — *"so the next run can tell 'being fixed'
from 'abandoned red'."* It is abandoned.

**DISPOSITION: DEFERRED**, deliberately and with the cost stated. Greening those nine tests
unblocks **no merge**: #2303 is separately un-mergeable by any station (F6), so the only thing a
fix buys is a cleaner board — and the fix itself is the design question in F3, which a station may
not decide (HARD STOP 5 / §10.4). Fixing it before Marco answers risks implementing the option he
rejects, into the instrument every prompt passes through. **What would make it urgent:** Marco
answering F3 (at which point the fix is mechanical and mine), or a *third* commit appearing on
that branch (which would mean the fix lane is live again and the lane question is moot).

### F5 — #2294 is unchanged at 10h, and a fifth consecutive supervisor run has paid its cost

**[MEASURED]** `state=OPEN mergeState=BEHIND head=191a6e2a labels=do-not-merge
created=2026-10-09T19:33:12Z`, CI 13 pass / 2 fail. Both reds are gate-class, not test-class:
`Approval receipt (CP-26)` and `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` — i.e.
the receipt/lane gates, which only Marco's release can satisfy for this PR. **Its tests are
green.** The sweep: `oldest #2294, open 10h`.

The cost it removes, measured again rather than quoted: `status-sweep.ps1` took **≈6 minutes** of
wall clock this run and had to be run as a detached process writing to a file; the obvious inline
form exceeds the 180 s tool ceiling and returns **nothing**. #2294 is the PR that dedupes that
section-5 crawl and adds `-SkipSection5`. Runs 0114 / 0214 / 0315 / 0416 / **this one** have now
each paid it.

**DISPOSITION: ESCALATED**, carried from four prior runs and **not re-filed** (§10.5 — one
identity per artifact). It carries `do-not-merge` and **only Marco removes that label.** I did not
call `gh pr update-branch` on it: the watcher's auto-update timer is OFF by default and a stray
update-branch costs a full CI rebuild on a PR nobody can merge.

### F6 — the INSTRUMENT_LANE_V1 escalation stands, and nothing further is owed on it

**[MEASURED]** `docs/pr-prompts/needs-marco/instrument-lane-cannot-cover-a-watcher-built-fix-2026-10-10.md`
is on `origin/main` at `d197fc84` — the same SHA 0416 verified it at, and the SHA I am running on,
so the claim is current rather than re-asserted. #2303 still carries `do-not-merge`; I removed no
label and wrote **no receipt** of either authority for it (`standing` is unavailable outside a
lane; `personal` would forge Marco's release).

**DISPOSITION: ESCALATED**, carried. Restated once under FOR MARCO, not duplicated as a file.

### F7 — the trunk red is the SAME browser-smoke occurrence 0416 saw, not a second one

**[MEASURED]** `gh run list --commit d197fc84…` -> one `failure`:
**`Tendering Browser Smoke`**, run `38020770228`, alongside `CI` / `Push on main` / `Deploy`, all
three `success`. `gh run view 38020770228 --log-failed` -> `1 failed`, a single spec:

```
pr-acceptance-batch4-tende-55dc0-toast-instead-of-navigating-chromium
Error: expect(locator).toBeVisible() failed — Expected: visible — element(s) not found
  - Expect "toBeVisible" with timeout 10000ms
```

The run is timestamped **03:44Z**, which is *before* 0416 started — so this is 0416's F3, read
again at the same SHA, **not a recurrence**. The "what would make it urgent" condition it set (a
*second* trunk red on the same spec line) has **not** been met.

**DISPOSITION: DEFERRED**, unchanged and not re-filed. **What would make it urgent:** the same
spec failing on a PR head where it blocks a merge, or a second trunk occurrence after the next
merge. I did not re-run it hoping for green, and did not weaken, skip or quarantine the assertion.

### F8 — two spent HOLDs sit in the queue root with their own PRs open; nothing is armed, so nothing has gone wrong

**[MEASURED]** `armed (*-ready.md): 0`; 16 `*-HOLD.md` in `docs/pr-prompts/`. Two of them name
work that is already in an open PR: `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md`
(#2303 — the prompt is in `superseded/` **in #2303's diff**, not on `main`) and
`pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` (#2294). This is precisely the condition F3's
gate exists to catch, sitting in the queue while the gate that would catch it is red.

**DISPOSITION: DEFERRED.** **I armed nothing, and would not have**: `lint-prompt.mjs` is the
admission instrument every prompt passes through and it is mid-change in #2303, so an ADMIT taken
today is an ADMIT from a contested instrument (DOCTRINE §9.5 — lint ADMIT is necessary, never
sufficient). MARCO_QUEUE_LINE_V1 figures for the record, since I would have had to copy them if I
had armed: `WAITING ON MARCO: 2`, `ALL OPEN (non-draft): 2`. **What would make it urgent:** a
station or a chat arming either prompt, which would build the same work twice (§10.6).

### F9 — the machine findings are unchanged and still live, for a fourth consecutive observation

**[MEASURED]** re-measured from my own 06:15:12Z sweep, not carried:
`auto-restart wrapper: ANOMALY -- 2 wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1`, pids
**2068** (10-08 07:28 local) and **35512** (10-10 11:35 local) — **the same two pids across
02:1x -> 03:15 -> 04:25 -> 06:15Z**, so neither has turned over in four hours.
`watcher node: RUNNING pid 16148`. `non-main worktrees found: 33`.
`worktree-registry-escapees: 3 found` — `C:\PR-Master\worktrees\bootstrap-check` (10489 min),
`C:\PR-Master\worktrees\sweep-section5` (642 min), `C:\po-wt\dispatch-register-v1` (10594 min),
all `size=0KB .lock=False`. Heartbeat 66 min old with **no build in flight** — idle, **not
wedged**, and nothing here says otherwise.

**DISPOSITION: DISPATCHED to Station 03.** Machine repair is 03's lane, not mine
(STATION-CAPABILITIES §5: 00 dispatches, 03 repairs). **03, before acting:** re-measure — a
wrapper count and a worktree's dirtiness both expire — and note the two prunes that will refuse,
because `--force` on either discards real work: `C:/po-worktrees/sup-cwd-paths` (**4 commits on no
remote branch, 2 uncommitted files**) and `C:/PR-Master/worktrees/sweep-dirty-untracked-v1`
(**1 commit on no remote branch, 1 uncommitted file**). Also note that **unlike 0416's cycle, the
dev tree is NOT in the detached-worktree list this time** — it is attached at `main` (F2), so the
warning not to prune it no longer applies, but `C:\po-wt\board-1010-0614b` **is mine and live** as
of this run; tear-down is noted under WHAT I DID NOT DO. 03's next occurrence is its daily cron,
`0 9 * * *`, `nextRunAt 2026-10-10T23:02:45Z`.

### F10 — the git guard reads INSTALLED BUT INERT in a FOURTH independent session

**[MEASURED]** 04 at 02:1xZ on `/sessions/laughing-wonderful-gauss`; 0315 at 03:14Z on
`/sessions/kind-wizardly-goldberg`; 0416 at 04:17Z on `/sessions/happy-practical-ritchie`; me at
06:14Z on `/sessions/keen-fervent-lovelace`. Same headline, same two controls
(`bash -lc 'command -v git'` -> the shim; `bash -c 'command -v git'` -> `/usr/bin/git`), four
different sessions. **This is the standing station condition the three-outcome table documents,
and the table is right that exit 2 is EXPECTED.**

**DISPOSITION: DEFERRED**, unchanged from 04's own disposition. The cure is how a station's shell
is invoked (a login shell, or an installer target a non-login shell sources) — 03's or Marco's
call. **What would make it urgent:** a run that actually needs `git` against the mount, or a fresh
0-byte `.git/index.lock` with no owning process. Neither happened: `git index.lock
interactive/clone: False / False` in the 06:15Z sweep, and `index.lock=False` re-measured at
mutation time.

### F11 — station 03's bootstrap says 4 h, its live cron says daily

**[MEASURED]** from the scheduled-tasks MCP this run rather than carried:
`03-machine-minder cronExpression "0 9 * * *" enabled true lastRunAt 2026-10-09T23:02:54Z
nextRunAt 2026-10-10T23:02:45Z` — **daily**. Already open with Marco at
`docs/pr-prompts/needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`.

**DISPOSITION: DEFERRED.** Marco's to rule on; the scheduled-tasks layer is not in this repo. Not
re-filed, not duplicated (§10.5). **What would make it urgent:** 03 reasoning about heartbeat age
from the 4-hour figure and calling a healthy machine wedged — note that F9 hands 03 a live
heartbeat reading precisely so it does not have to.

### F12 — two instrument lies of my own this run, both caught by read-back, both worth writing down

**(a) `Enter-BoardLease -Reason` is MANDATORY, and omitting it HANGS the run for nine minutes
reading exactly like a busy board.** [MEASURED] my first call passed only `-Actor`. PowerShell
prompted for the missing mandatory parameter; `list_sessions` reported
`PID 47816, Blocked: true, Runtime: 539s`, and the only output ever produced was `=== LEASE ===`.
**A station reading `Blocked: true` at the lease step will conclude another actor holds the board
and stand down — the expensive direction.** The tell is that `Get-BoardLease` had not been reached
at all. Cure, measured: re-run with `-Reason '<text>'` **and** `powershell -NonInteractive`, which
converts a missing mandatory parameter from a silent prompt into a loud error. Returned `True`
immediately.

**(b) `$ErrorActionPreference = "Continue"` made my own script certify work it had not done.**
[MEASURED] the first worktree script failed at
`fatal: a branch named 'docs/board-2026-10-10-0614' already exists`, every later `git -C $wt` call
failed with `cannot change to … No such file or directory`, `Copy-Item` threw
`DirectoryNotFoundException` — and the script still printed **`archived: 00-00-supervisor-…`**
for both files, because the `Write-Host` sat after the copy with no success test between them.
That is DOCTRINE §1 in miniature, inside a run reading §1 the same hour. `"Continue"` is itself a
§7 standing guard (git warns on stderr), so the cure is not to change it but to **test the result**:
the re-run prints `COPIED src=19622 dst=19622 same=True` per file, and `wt-exists=True` before it
touches the tree.

**DISPOSITION: ACTIONED.** Both were caught and corrected inside this run; the board PR's contents
are the read-back, not the claim. Recorded here rather than filed, because neither is a defect in
a shared instrument — they are the two shapes a station's own script takes when it skips read-back,
and the next run inherits them from this breadcrumb.

## WHAT I DID NOT DO

- **Did not arm anything** (F8). `armed: 0` before and after. `lint-prompt.mjs` is mid-change in
  #2303, so every ADMIT today comes from a contested instrument, and two of the 16 HOLDs are spent
  with their PRs already open. Nothing in the queue justified spending Marco's release queue.
- **Did not merge anything, and had nothing mergeable.** Both open PRs are red **and** carry
  `do-not-merge`, which only Marco removes. No `Assert-SmokedOrEscalate` / `Merge-Pr` call was
  made against either.
- **Did not push a fix to #2303's branch** (F3, F4), although §8.2 would normally make an
  abandoned red mine to fix and the branch is now quiet. The fix *is* the design question: the
  gate's author cites DOCTRINE §7 for fail-closed and nine pre-existing tests cite *"a broken
  instrument bins nothing"* for fail-safe. Choosing between two written rules, inside the
  admission instrument every prompt passes through, is HARD STOP 5 / §10.4 — and greening it
  unblocks no merge, because #2303 is out-of-lane regardless (F6). Escalated with options instead.
- **Did not weaken, skip or quarantine any failing assertion** — not the nine `lint-prompt` tests
  (F3), not the browser-smoke spec (F7) — and staged no prompt to do so. A quick fix is only ever
  an unblock, never a mask.
- **Did not re-run any red check hoping for green.** F3's red is root-caused; F7's is 0416's
  demonstrated flake, re-read at the same SHA and labelled as the same occurrence.
- **Did not remove any label, and merged no watcher-routed PR.**
- **Did not call `gh pr update-branch`** on either BEHIND PR (F5). `Merge-Pr` does that itself at
  merge time; a stray update-branch costs a full CI rebuild on a PR nobody can merge.
- **Did not repair the machine** (F9): no wrapper killed, no worktree pruned, no lock cleared —
  none existed to judge, and all of it is 03's lane.
- **Did not touch, enable, disable or re-run any scheduled task** (F1, F11), on a MISSED reading
  or on a cadence mismatch. Both are forbidden on that reading alone (DOCTRINE §7).
- **Did not stage the canonical-block fix for F1**, the `ff-dev-tree.ps1` script for 0315's F2, or
  a prompt for F7. All three touch either the hash-gated station contract or `scripts/pipeline/**`,
  and both routes are blocked behind questions already in front of Marco (F3, F6). Staging against
  a contested `lint-prompt.mjs` is building on sand.
- **Did not touch `/sot/`** — 05's alone.
- **Did not go near Azure, Entra or SharePoint.** Nothing this run approached them.
- **Did not run `git` through the device bridge against the mount** (F10), and did not run
  `check-breadcrumb.mjs` from the mount — it shells `git` and `gh`. Both ran on the Windows host.
- **Did not tear down `C:\po-wt\board-1010-0614b`.** It holds the commit this PR is made of, and
  removing it before the PR merges would be the disposable-worktree trap in reverse. 🔴 **The next
  run should remove it once this PR is MERGED** (`git -C C:\ProjectOperations2 worktree remove
  C:\po-wt\board-1010-0614b`), and should also delete the stale local branch
  `docs/board-2026-10-10-0614` — created empty by the failed first attempt in F12(b), with no
  worktree and no commits.
- **Did not delete the dev tree's untracked copies** of the 0315 / 0416 breadcrumbs. Their content
  is preserved under `archive/` by this PR; removing the originals is a tidy-up for after it
  merges, not a deletion to make while the PR is open.

## FOR MARCO

**Three decisions are in front of the pipeline. Two are unchanged; one is new and it is the
reason #2303 has nine red tests rather than one.**

**NEW (F3). #2303's SPENT_HOLD gate fails CLOSED, and nine pre-existing tests say a broken
instrument must bin nothing.** The gate shells `gh pr list`; the suite has no usable `gh`; so every
HOLD fixture rejects. The gate's author quotes DOCTRINE §7 (*fail loud*) and is right; the nine
tests quote *"a broken instrument bins nothing"* and are also right. Nobody reconciled them. Filed
at `needs-marco/spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`.
RULE 1, complete-and-additive first:

1. **Make the probe absence-aware.** `gh` missing/unauthenticated/unreachable -> **ADMIT with a
   loud WARN** naming the unchecked gate; `gh` answered and names a PR carrying this HOLD's work ->
   **REJECT**. Complete: both rules hold, the nine tests go green *unchanged*, and the gate still
   fires on every real arming call (which runs with authenticated `gh`). Additive: changes no
   existing behaviour. **Recommended.**
2. **Change the nine tests to expect REJECT.** Fails the future half — any `gh` outage or auth
   lapse then makes all 16 HOLDs un-armable and freezes the board on an instrument failure.
   `failed/` already holds two `401 OAuth access token has been revoked` entries this month.
3. **Drop the gate.** Fails the immediate half — two HOLDs in the queue right now have their own
   PRs open (#2303, #2294); the gate is what stops that being armed twice.

**UNCHANGED (F6). INSTRUMENT_LANE_V1 cannot fire for any instrument fix the watcher builds**,
because the watcher retires the prompt under `docs/pr-prompts/` and *"everything under `docs/`"* is
on the lane's never-list. Filed 2026-10-10, on `origin/main`. Recommended option remains:
exempt the prompt-retirement moves (`superseded/`, `merged/`, `archive/`) from the lane boundary.
**#2303 is blocked on this and on F3 together** — F3 greens its tests, F6 lets a station merge it.

**UNCHANGED (F5). #2294, 10 h, `do-not-merge`.** Its tests are **green**; both reds are the
receipt/lane gates your release clears. Five consecutive supervisor runs have now each paid the
≈6 minutes it removes from `status-sweep.ps1`.

**One piece of information, not a question (F1).** The 05:14Z supervisor occurrence fired and died
blind (`CONNECT_TIMEOUT` after the tool load) — the known intermittent blindness, correctly
reported. But it collected nothing, because the scheduled-task bootstrap's STEP 1 and the station
doc's PREFLIGHT both say *"end the run"*, while `STATION-CAPABILITIES.md` §3 records that a blind
run **can** read everything through the mount and should collect first. The repo half needs a
prompt (the sentence is inside the hash-gated seven-doc canonical block). **The bootstrap half is
your layer** — `C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md`, the paragraph beginning
*"If that fails: write one paragraph saying you are blind"*. One clause would close it: *"COLLECT
first through the mount or the native file tools, write the breadcrumb, then end the run."*
