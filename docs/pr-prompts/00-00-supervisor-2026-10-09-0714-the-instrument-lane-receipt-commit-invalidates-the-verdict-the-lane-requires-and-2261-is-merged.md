# Station 00 - Supervisor | 2026-10-09T07:14Z-2026-10-09T07:5xZ

## GROUND

```
UTC            2026-10-09T07:14:29Z
origin/main    e67663a6             (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 42c09453      C:\ProjectOperations2   (1 commit BEHIND origin/main)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                    (station_doc_version: 1)
```

Doc version and bootstrap **AGREE**, so this run is not read-only on that count.

**NOT BLIND.** Desktop Commander loaded on ONE keyword `ToolSearch` for `desktop-commander`
(BOOTSTRAP_PREFLIGHT_V1 - ids taken from what the search reported, never assumed).
`start_process` with shell `powershell.exe` returned on the first call. No
BOOTSTRAP_CONNECT_RETRY_V1 retry was needed.

**Git guard, quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` - headline:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/awesome-modest-fermat/.local/bin:$PATH" git <args>
```

**EXIT CODE 2.** The expected station outcome per the PREFLIGHT table - a FINDING, not a STOP. The
code read is the INSTALLER's own (nothing was piped into `tail` / `Select-Object`). The
device-bridge git ban was therefore REMEMBERED, not mechanical, and it was kept: **no `git` ran
through the Linux bridge against any mount.** Every `git`, `gh`, `node` and `.ps1` call below ran
in a `powershell.exe` shell on the Windows host.

**Three binding reads, from `origin/main`, in the dev tree** (never the watcher clone, never the
working copy at those paths): `docs/pipeline/stations/00-supervisor.md` 31,785 B /
`docs/pipeline/DOCTRINE.md` 30,719 B / `docs/pipeline/STATION-CAPABILITIES.md` 48,498 B, all three
in full via `git show origin/main:<path>`. **No piped `git show | git hash-object --stdin`
comparison was made anywhere in this run** (DOCTRINE 9.2).

---

## WHAT I MEASURED

### Freshness - CLEAN, no station MISSED

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, **exit 0**.
Structure pass: `3 checked, 0 malformed, 0 skipped as pre-contract`; all three ADMIT, with the
validator's own `NOTE ... is UNTRACKED` on the two from 06:1xZ.

```
00  last 2026-10-09T06:13:00Z  1.1h ago  (cadence 1h + grace 0.5h)   ok
02  dispatch-only - no cadence to miss
03  last 2026-10-08T23:06:00Z  8.2h ago  (cadence 24h + grace 3h)    ok
04  last 2026-10-09T06:10:00Z  1.1h ago  (cadence 4h + grace 1h)     ok
05  last 2026-10-08T22:38:00Z  8.7h ago  (cadence 24h + grace 3h)    ok
```

No station is MISSED, so no MISSED classification is owed and **no scheduled task was read,
disabled, enabled, re-run or edited** (FRESHNESS_ONE_CADENCE_V1 permits nothing on a healthy
reading). The previous cycle read the live crons from the scheduled-tasks MCP 60 minutes ago and
recorded four ENABLED tasks; nothing in this run turns on a cadence value, so that reading was not
re-taken - and it is **state, not instruction**, so a later run must re-measure it rather than quote
this line.

### The board, from `scripts/pipeline/status-sweep.ps1`

[MEASURED] `SWEEP COMPLETE 2026-10-09 07:15:18Z`, all seven sections, read streamed with repeated
`read_process_output` calls at explicit offsets until the process reported complete (a single read
is again not a finished sweep). Section 0 positive controls both `[LIVE]`:
`gh CAN reach GitHub (saw merged PR #2277)`, `node runs`. **No `[BROKEN]`.**

- **Section 7 VERDICT:** `SAFE TO ACT: no board mutation in progress, no recent remote activity, no
  live station worktrees.`
- **Section 1:** OPEN PRs **1** - `#2278 BLOCKED, CI: 14 pass / 0 fail / 1 pending`.
  **WAITING ON MARCO: 0** open PRs labelled `do-not-merge`. `main` CI on `e67663a6`:
  4 success / 0 failed / 0 running (**trunk green**). Merged since the last cycle: **#2261** at
  06:26:23Z.
- **Section 2:** watcher `node` RUNNING pid 8848, auto-restart wrapper alive, heartbeat age 47 min
  with **no build in flight** (ticks are 60 s apart only while a build runs, so a stale tick plus an
  empty queue is idle, not wedged). Clone `branch=main tracked-dirty=0 untracked=3`. 33 non-main
  worktrees, all classified orphaned, **no LIVE station worktree**, plus 2 registry escapees.
- **Section 3:** `git index.lock interactive/clone: False / False`; git processes touching our trees
  **0**; **board lease: free**; no PR touched on GitHub in the last 2 min.
- **Section 4:** armed (`*-ready.md`) **0**; `needs-marco/` 53, `no-pr-opened/` 111, `failed/` 80,
  `blocked/` 204. Section 6 backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.
- **Section 5:** exactly one `[STALE]` row, and it is actionable -
  `2261-...-2026-10-07.md references #2261 which is MERGED -- escalation is DEAD, clear it.`

**MARCO_QUEUE_LINE_V1, both figures, recorded because the contract asks for them on any run that
arms:** armed = **0**, WAITING ON MARCO = **0 open PRs labelled `do-not-merge`**. **This run armed
nothing**, so these are the state it inherited and left, not the consequence of a decision - see
WHAT I DID NOT DO for why there was nothing armable.

### Pre-mutation gate, re-measured immediately before acting (the verdict expires when it prints)

[MEASURED] at 07:2xZ, after the sweep and before any write: `index.lock dev=False`,
`git processes=0`, **no lease file present**. Then
`Enter-BoardLease -Reason 'collect:board-pr-2026-10-09-0725' -Actor 'station-00.scheduled'` ->
**`true`**. The previous cycle's lease (`station-00.interactive`, expiry 06:43:05Z) had been
released, which is what its own hand-forward told this run to re-measure rather than assume.

### #2278, classified before anything else was considered

[MEASURED] asked individually, never from a LIST response's `merged` field (DOCTRINE 9.4):
`gh pr view 2278 --json number,state,mergedAt,mergeStateStatus,headRefOid,labels,files,isDraft,autoMergeRequest`

| reading | value |
|---|---|
| state / mergedAt | `OPEN` / `null` |
| mergeStateStatus | `BLOCKED` |
| headRefOid | `cc4b8e90e0838eeea1a011daf651272fbdc08a95` |
| labels | `[]` - never carried `do-not-merge` |
| files | `docs/decisions/merge-approvals/2278.md`, `scripts/pipeline/status-sweep.ps1` |
| autoMergeRequest | **empty - auto-merge is NOT armed** |
| required checks on the head | **14 pass / 0 fail / 1 pending** (`tendering-e2e`, run 37896169422 `in_progress`) |
| `Approval receipt (CP-26)` | **pass** |

[MEASURED] **watcher-opened, and NOT routed to Marco.** `Select-String` over
`docs/pr-prompts/processed/*.log` for `heartbeat-alarm` returns only the prompt's own header line;
the log records `PR #2278 opened - https://github.com/GH-Mantova/ProjectOperations/pull/2278` and
**no `stays for Marco` line**. POSITIVE control, the same probe for the literal `stays for Marco`
across the same corpus -> **1** hit. NEGATIVE control, a needle minted this run
(`zqx9needle20261009`) -> **0**. So DOCTRINE 10.1 **case 1** applies and RULE 2 binds as written:
nothing routed it to Marco.

[MEASURED] the receipt already on the branch, `git show pr2278:docs/decisions/merge-approvals/2278.md`:
`pr: 2278`, `approved_by: station-00`, `approved_at: 2026-10-09T06:45:38Z`, `authority: standing`,
`lane: instrument`, authored by the **supervised interactive lane**. So no receipt was owed by this
run and none was written.

[MEASURED] the verdict, `docs/pr-reviews/pr-2278-review.md`, checked in all three homes (dev tree,
the clone's `docs/pr-reviews/`, `C:\po-watcher\verdicts-archive`; present in the first, **absent
from the other two**):

```
L1  VERDICT: MERGE
L2  REVIEWED-SHA: 05650340cef2d843cad9556df6b9a36a7c681105
```

[MEASURED] `git log --format='%h %s' origin/main..refs/remotes/pr2278` - the reviewed commit is the
FIRST of three:

```
cc4b8e90  Merge branch 'main' into feat/heartbeat-alarm-text-v1
e987397f  docs(decisions): CP-26 standing receipt for #2278 - instrument lane
05650340  feat(pipeline): quote the heartbeat alarm sentence in the sweep (HEARTBEAT_ALARM_TEXT_V1)
```

**`REVIEWED-SHA` != current head.** INSTRUMENT_LANE_V1 condition 4 fails. That, and the pending
`tendering-e2e`, are the two independent reasons this run did not merge #2278. See F31.

---

## WHAT CHANGED

**On the board: nothing was armed, merged, labelled, re-parked, branch-updated or dispatched to a
scheduled task.** No `/sot/` edit. No scheduled-task change. No Azure / Entra / SharePoint contact.
No worktree pruned, no ref deleted, no stash dropped, no lock cleared.

Every mutation below was made in an **isolated worktree off `origin/main` on the Windows FS**
(`C:\po-wt\bd-1009-0725`, branch `docs/board-2026-10-09-0725`) under the board lease, and is carried
by ONE board PR. All of it is **docs-only**, so CP-26 is not armed by this diff and no receipt is
owed.

1. **`docs/pipeline/sweep-rotation.json`** - 04's rotation advance (`last_index 1 -> 2`,
   `last_run_utc 2026-10-09T02:10:14Z -> 2026-10-09T06:09:53Z`), copied byte-for-byte out of the dev
   tree. **This was the one deadline-bearing item**: 04 may not commit it, and an uncommitted advance
   makes the next scanner run repeat `repo-hygiene` and the rotation silently stop - which has
   already happened twice. Next sweep key is `instruction-drift`.
2. **`docs/pr-prompts/.arming-log.txt`** and the deletion of
   **`docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md`** - the record of the 06:13:05Z arm
   that produced #2278. Both were left modified/deleted in the shared dev tree by the interactive
   00; the prompt itself is consumed and sits in the gitignored `processed/`, so **no other PR
   carries them**, and until they are committed they block the dev tree's next fast-forward.
3. **Three breadcrumbs collected and archived**: `git mv` of
   `00-00-supervisor-2026-10-09-0515-...` into `docs/pr-prompts/archive/`, plus
   `00-00-supervisor-2026-10-09-0613-...` and `00-04-scanner-2026-10-09-0610-...` added directly
   under `archive/` - every finding in all three carries a disposition in this file.
4. **`docs/pipeline/STATION-CAPABILITIES.md` section 1** - the Codex layer added as a row in the
   layer table, with a `CODEX_LAYER_MAPPED_V1` note and a falsifying probe (04-F2(a)).
5. **`docs/pr-prompts/needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`** - a measured
   addendum (F31). That file is **tracked** (`git ls-files --error-unmatch` exit 0), so the addendum
   reaches `main`.
6. **#2261's escalation retired.** `node scripts/pipeline/retire-escalation.mjs --file
   docs/pr-prompts/needs-marco/2261-...-2026-10-07.md --actor station-00 --evidence "<the merge
   reading>" --record-into C:\po-wt\bd-1009-0725 --repo C:\ProjectOperations2` -> **exit 0**, note
   written to `docs/pipeline/discharges/2026-10-09-0726Z-2261-...md`. Nothing deleted; the file was
   moved to `needs-marco/discharged/`. The rename is mirrored in the PR worktree so `main` carries
   it too.

**Outside the PR, one write to a gitignored path, declared as such:** 04-F1's three ref readings
were appended to the dev tree's
`docs/pr-prompts/needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`. **That
file is UNTRACKED** (`git ls-files --error-unmatch` exit 1, against 12 tracked files in the same
folder) - so per the REPORT CONTRACT the addendum alone is **not a report**, and F32 carries the
substance into this tracked breadcrumb instead.

---

## FINDINGS

### F31 - the CP-26 receipt commit the standing lanes REQUIRE is what invalidates the REVIEWED-SHA the lane requires, so every instrument-lane and sot-lane PR routes back to Marco

The anchor this pipeline asked for has landed: verdicts carry `REVIEWED-SHA`, and INSTRUMENT_LANE_V1
condition 4 requires it to equal the current head. **Measured on #2278, the two requirements cannot
both hold.** `REVIEWED-SHA` is `05650340`; the head is `cc4b8e90`; the two commits in between are
(a) the CP-26 standing receipt, which `scripts/pr-gates/standing-lanes.json` and the required
`Approval receipt (CP-26)` check both demand before an instrument-lane merge, and (b) a
`Merge branch 'main'` that `Merge-Pr` performs itself under UPDATE_AT_MERGE_TIME_V1. **Neither
touches the reviewed file**: `git diff --stat origin/main...pr2278` is
`docs/decisions/merge-approvals/2278.md | 18 +` and `scripts/pipeline/status-sweep.ps1 | 37 +-`.

This is structural, not one PR's bad luck: it recurs on every instrument-lane PR and on every 05
`sot`-lane doc-reconcile, because both lanes require a receipt commit and neither re-reviews after
it. The lane Marco opened on 2026-10-03 to take himself out of instrument fixes therefore currently
hands every one of them back to him. The watcher's own stale-verdict re-review path
(`scripts/pr-watcher/index.mjs:2838`, *"writes `rev-<N>-ready.md`"*) only fires while the watcher is
still inside `waitForPolicyMerge`; it was not for #2278, and `armed` is 0 with no `rev-2278` job
anywhere.

**One instrument lie caught inside this finding, and it pointed the dangerous way - at refusing a
merge the gate allows.** `node scripts/pipeline/check-instrument-lane.mjs --range
origin/main...refs/remotes/pr2278` returned `INSTRUMENT_LANE: OUT_OF_LANE`, offending path
`docs/decisions/merge-approvals/2278.md`, **exit 0 with both of its own controls passing** - a
well-formed verdict, so nothing warned. It is **not** the lane verdict the station doc means:
`standing-lanes.json`'s `_readme` defines the instrument lane as *"every diff path apart from the
receipt itself is in instrument-lane.json"*, and the gate that encodes that exclusion is the
required check `Approval receipt (CP-26)`, which **passed** on the current head. A bare `--range`
call counts the receipt and can never return IN_LANE for a receipted PR. Recorded here so the next
run does not read a hand-rolled range as the lane's answer.

**DISPOSITION: ESCALATED** - appended as a measured addendum to the existing tracked escalation
`docs/pr-prompts/needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`, whose own header
already asks Marco *"whether a stale verdict should block or re-review"*. **No new filing was
opened** (DOCTRINE 10.5). RULE 1, complete-and-additive FIRST: **(a) make the anchor
content-aware - a verdict stays fresh while the only commits above `REVIEWED-SHA` are the PR's own
CP-26 receipt under `docs/decisions/merge-approvals/` and a merge of `main` that adds no diff
outside the reviewed paths, both checkable mechanically with `git diff --numstat
<REVIEWED-SHA>..<head>`.** Immediate and permanent, CI-checkable, and a real code push above the
reviewed SHA still invalidates the verdict - passes both halves. **(b) re-review after the
receipt** solves it now but fails the future half on cost: a second review cycle on every
instrument and sot PR forever. **(c) drop condition 4 for the standing lanes** is cheapest and
**fails the no-damage half outright** - it is the only thing stopping a station merging a head no
reviewer looked at.

### F32 - the CONSOLIDATED stale-remote-heads escalation is UNTRACKED, so 04-F1's addendum cannot reach Marco through git and the readings are carried here instead

04-F1 dispatched three measured readings with one explicit instruction: fold them into
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` and **do not open a fourth
filing**. [MEASURED] in the PR worktree, i.e. against `origin/main`:
`git ls-files --error-unmatch docs/pr-prompts/needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`
-> **exit 1 (NOT tracked)**, against POSITIVE controls in the same folder:
`verdict-is-not-anchored-to-a-head-sha-2026-09-09.md` -> exit 0 and
`2261-...-2026-10-07.md` -> exit 0, and `git ls-files -- docs/pr-prompts/needs-marco/` -> **12
tracked files** of the 53 on disk. So this is the station contract's own swallowed-finding shape:
**a finding that lives only in a gitignored path has not been reported**, and the file Marco is
meant to answer is one of the ones that does not travel.

04-F1's readings, carried here so they land on `main`: `git remote` -> `origin` **only**
(`remote.origin.url` exit 0 as the positive control, `remote.staleprobe.url` **exit 1**);
`git for-each-ref refs/remotes` -> **57** refs in four namespaces, `origin` 33, **`pr` 14,
`staleprobe` 9, `pr1273` 1 = 24 refs owned by no configured remote**; and the one that bites,
`git branch -r --merged origin/main` -> 3 lines, **one of them `staleprobe/main`** - a ref no remote
owns, presented as a merged remote branch. Any census built on `branch -r` therefore over-reports
live remote branches by 73% (57 against 33), and the CONSOLIDATED escalation asks its question over
a corpus that is 42% phantom. **Nothing was repaired**: deleting a remote-tracking ref whose remote
no longer exists is not recoverable by `git fetch`, which makes it irreversible and Marco's
(DOCTRINE 5.4).

**DISPOSITION: ACTIONED** - the addendum was appended to the untracked file for continuity on
Marco's own machine, and because that is not a report, the readings above are in this tracked
breadcrumb; no fourth filing was opened, as 04 instructed. Verified by the `ls-files` readings
quoted, with two positive controls and the 12-of-53 census. **What remains open and is not mine:
whether `needs-marco/` should be tracked at all.** That is already live with Marco as
`needs-marco/escalations-live-only-in-the-watcher-clone-2026-09-14.md`, and this finding is a second
measured instance of its cost rather than a new question.

### F33 - 31-of-33 orphaned worktrees holding ~130 unpushed commits, and two registry escapees, are Station 03's to preserve-then-prune and nobody has

Carried forward from 04-F3 with this run's own reading: [MEASURED] sweep at 07:15:18Z -
`non-main worktrees found: 33`, **every one classified orphaned** (the `rel-2261` worktree that was
LIVE an hour ago is now orphaned too, and `C:/po-wt/rel-2278` at age 30 min and `C:/po-wt/t2278` at
48 min have joined), `worktree-registry-escapees: 2 found -- Station 03 should review and prune if
confirmed dead`. Two hold **uncommitted** work that `--force` would destroy
(`C:/po-worktrees/sup-cwd-paths` 2 files, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 file),
and the largest unpushed holding is `C:/po-wt/fv2drop` at **21 commits**, age 21,516 min.

**DISPOSITION: DISPATCHED to Station 03**, which the sweep itself names and which is the only
station with a repair lane; 00 routes it and does not do it (LL-38). Two constraints travel with it,
RULE 1 in order: the complete-and-additive move is to **push or patch out the ~130 commits and the
two dirty worktrees BEFORE any removal** - that solves it now and keeps every future recovery
possible; a `git worktree remove --force` sweep is faster and **fails the no-data-loss half
outright**, discarding work that exists in exactly one place on one disk. The removal itself is
irreversible, so it stays Marco's until preservation is done and read back. 03's next occurrence is
its daily `0 9 * * *`.

### F34 - the #2261 escalation was the board's only [STALE] row and is now discharged

[MEASURED] `gh pr view 2261 --json state,mergedAt` asked individually (DOCTRINE 9.4, a LIST
response's `merged` field is unusable) -> **`state=MERGED`, `mergedAt=2026-10-09T06:26:23Z`**. The
sweep's section 5 had tagged it: `references #2261 which is MERGED -- escalation is DEAD, clear it.
Do NOT report it as pending.` The previous cycle, 47 minutes earlier, correctly reported it as
ESCALATED and open - #2261 merged **13 minutes after** that reading, which is `[LIVE]` meaning "true
when measured" in the only direction that is good news.

So Marco answered the 0613 cycle's question 1 by merging it, and the standing ask it carried - leave
the release word where a headless run can read it - is **answered in fact for this PR**: #2261's
merge means the receipt question for it is closed. The broader channel question remains open as
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`.

**DISPOSITION: ACTIONED** - retired through the sanctioned script, not by deletion:
`retire-escalation.mjs` exit **0**, the file moved to `needs-marco/discharged/`, and the tracked
note `docs/pipeline/discharges/2026-10-09-0726Z-2261-...md` (591 B) rides in this run's board PR so
any station can verify the retirement. Read back: the discharges folder now holds 11 notes plus its
README, and the rename is staged `R` in the PR worktree.

### F35 - 04's rotation advance survived a third cycle only because it was committed this run

[MEASURED] `docs/pipeline/sweep-rotation.json` was still modified-and-uncommitted in the dev tree at
07:1xZ, 65 minutes after 04 wrote it: `last_index 1 -> 2`,
`last_run_utc 2026-10-09T02:10:14Z -> 2026-10-09T06:09:53Z`, `last_station` unchanged at
`04-scanner`. 04 is forbidden to commit it and said so; the previous 00 could not open a PR because
another actor held the lease. **The same advance has been lost twice before** (04's F6 on
2026-09-02, and again on 2026-10-09 per #2272), each time making the scanner repeat its sweep and
silently stopping the rotation.

**DISPOSITION: ACTIONED** - copied byte-for-byte from the dev tree into the PR worktree and
committed there, with the file named explicitly in a **pathspec** `git add`, never `git commit -a`:
the shared dev-tree index also held the interactive 00's in-flight arm, and a bare `-a` would have
swept it into this board PR (DOCTRINE 9.2). Read back from the worktree copy after the commit:
`last_index=2`, `last_run_utc=2026-10-09T06:09:53Z`, next sweep key `instruction-drift`.

### F36 - the dev tree is one commit behind with three tracked paths dirty, and this board PR is what clears them

[MEASURED] all four readings the report contract names, at 07:1xZ:

```
git rev-list --left-right --count HEAD...origin/main  -> 0  1      (BEHIND by #2261)
git diff --cached --name-status                       -> EMPTY
git diff --numstat / git status --porcelain (tracked) -> 3 paths
   M docs/pipeline/sweep-rotation.json
   M docs/pr-prompts/.arming-log.txt
   D docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md
```

A fast-forward **is** due and those three paths are what would refuse it. All three are carried by
this board PR with content identical to what the dev tree holds, so once it merges the dev tree's
local content equals the new `HEAD` content and the ff should proceed. **This run did not attempt
the fast-forward** - it would have had to run while its own PR was unmerged, i.e. against a `main`
that does not yet contain the fix.

**DISPOSITION: DISPATCHED to the next Station 00 cycle.** After this board PR merges: take all four
readings, not two; if any path still refuses the ff, restore it **byte-exactly from `HEAD` with a
raw-Buffer node write** (`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`) then
`git update-index --refresh` - **never `git checkout -- <path>`, never `git clean`** (DOCTRINE 9.2,
consumed prompts come back armed). The 25 untracked `docs/pr-reviews/pr-<N>-review.md` verdicts
04-F4 measured are unchanged and still collide with nothing on `main`; that stays **DEFERRED** on
04's own terms, urgent only when a PR adds one of those exact paths or an ff refuses with
`--numstat` EMPTY.

---

## WHAT I DID NOT DO

- **I did not merge #2278, did not arm auto-merge on it, did not update its branch, did not label
  or comment on it, and wrote no receipt for it.** Two independent blockers, either sufficient:
  `tendering-e2e` is **pending** on the current head and pending is not pass (DOCTRINE 2), and
  INSTRUMENT_LANE_V1 condition 4 fails because the MERGE verdict's `REVIEWED-SHA` (`05650340`) is
  not the current head (`cc4b8e90`) - and the station doc is explicit that **any** condition failing
  leaves the PR for Marco. I did not reason past condition 4 on the grounds that the two intervening
  commits look harmless; that judgement is exactly what the anchor exists to replace. A receipt
  already exists on the branch and is not mine to re-author.
- **I did not arm anything.** `armed` is 0 and the queue holds no armable candidate this cycle: the
  one prompt that was armable was consumed at 06:13:05Z into #2278, and the backlog's single
  `READY TO STAGE` item (`rates-11c-blocked-consumers`) is staging work, which is Station 06's, not
  an arm.
- **I did not write or create any `*-ready.md`**, including a `rev-2278-ready.md` to refresh the
  stale verdict. Arming is a `git mv` of a tracked `-HOLD.md` and nothing else; hand-writing a
  watcher-internal review job is not in this station's recorded authority and would collide with the
  watcher's own re-review path.
- **I did not run `gh pr update-branch` on anything.** The watcher's auto-update timer is OFF and a
  stray update-branch costs a full CI rebuild.
- **I did not touch `scripts/**`, `instrument-lane.json`, `standing-lanes.json` or any CI
  workflow**, and I did not run `lint-station.mjs --write-canonical`. Every path in this PR is under
  `docs/`.
- **I did not edit `/sot/`** - Station 05's exclusively, and CP-24 hard-fails any PR mixing code and
  `sot/`. The `docs/sot-reconcile-2026-10-09` branch and `C:/po-worktrees/st05-sot-2026-10-09`
  worktree are 05's and were left alone, including in F33's census where the sweep lists the latter
  as an orphan - **that call is 05's, so it is flagged rather than classified.**
- **I did not prune a worktree, delete a ref, `git remote prune`, or drop a stash.** All
  irreversible, all Marco's (DOCTRINE 5.4); F33 routes the worktree half to 03 for preservation
  first.
- **I did not clear a lock.** There were none: `index.lock interactive/clone: False / False`.
- **I did not open a fourth filing on stale remote heads** (04-F1's explicit instruction), and I did
  not open a second artefact for F31 - it went into the existing tracked escalation as an addendum
  (DOCTRINE 10.5).
- **I did not read, disable, enable, re-run or edit any scheduled task.** No station was MISSED, and
  FRESHNESS_ONE_CADENCE_V1 permits nothing on a healthy reading.
- **I did not dispatch 04 or 05.** Both measured `ok` and both have findings already in hand; F33 is
  the only dispatch, and it is 03's, taken on its own daily cadence rather than by my re-running
  anything.
- **I did not run `git` through the Linux device bridge** against any mount, although the guard
  reported itself INERT (exit 2) and the ban was therefore remembered rather than mechanical. I did
  not treat the inert guard as a licence.
- **I did not compare a piped `git show | git hash-object --stdin` hash against anything.**
- **I did not write to any gitignored sink.** Nothing of this run went to `docs/qa/qa-findings.md`,
  `qa-checklist.md`, `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md` (the five files
  under the `# Overnight-QA scheduled task` comment in `.gitignore`), nor to a disposable worktree
  that gets torn down, nor to the Cowork session's `outputs` folder. The one gitignored write this
  run made - the addendum to the untracked CONSOLIDATED escalation - is declared in WHAT CHANGED and
  its substance is carried in F32 so that it is actually reported.
- **No Azure / Entra / SharePoint contact of any kind.** No portal, no App Service settings, no
  Entra registration, secret, permission or consent, no SharePoint anything, no `az`, no
  `Connect-MgGraph`. Absolute, and not approached. **No production data written.**

---

## FOR MARCO

Two questions. Neither is answerable by a headless run, and the first one is now blocking a lane you
opened six days ago to save yourself this exact traffic.

1. **The standing lanes cannot satisfy their own two gates at once (F31).** A PR in the
   `instrument` or `sot` lane must carry a CP-26 receipt commit, and committing it moves the head
   past the `REVIEWED-SHA` that INSTRUMENT_LANE_V1 requires the verdict to match. Measured live on
   **#2278**: green but for one pending check, unlabelled, receipted at 06:45:38Z, verdict MERGE for
   `05650340`, head `cc4b8e90`, and the only commits in between are the receipt itself and a
   `Merge branch 'main'`. So this run left it for you - and so will every future one, for every
   instrument fix and every 05 doc-reconcile. **Complete-and-additive option FIRST: make the anchor
   content-aware** - a verdict stays fresh while the only commits above `REVIEWED-SHA` are the PR's
   own receipt under `docs/decisions/merge-approvals/` and a merge of `main` adding no diff outside
   the reviewed paths, both mechanically checkable with `git diff --numstat <REVIEWED-SHA>..<head>`.
   That fixes it now and permanently, is CI-checkable, and still invalidates a verdict on any real
   code push. **(b) re-review after the receipt** works today but costs a second review cycle on
   every such PR forever. **(c) drop condition 4 for the standing lanes** is cheapest and **fails
   the no-damage half** - it is the only thing stopping a station merging a head nobody reviewed.
   Full addendum with all readings and the falsifying probe is in
   `docs/pr-prompts/needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`.
2. **Who runs Codex against this repo?** (04-F2, carried.) Root `AGENTS.md` and `.codex/agents/`
   (9 `.toml` definitions) have been in the dev tree **untracked and not gitignored** for 17 days,
   in no map and no linter. They are **byte-clean** - read as bytes with `node` against a synthetic
   positive control - so nothing is broken, and the layer is now a row in
   `STATION-CAPABILITIES.md` section 1 as of this PR. But that one answer settles both remaining
   halves: whether `.codex/agents/*.toml` joins `lint-station.mjs`'s encoding sweep (its corpus is
   still exactly `.claude/agents`), and whether either path should be tracked or gitignored. Neither
   is guessable, and PR #1465 is what it costs to leave an instruction layer unswept.

And one thing you have already answered without being asked: **#2261 merged at 06:26:23Z**, so its
escalation is discharged this run (F34).
