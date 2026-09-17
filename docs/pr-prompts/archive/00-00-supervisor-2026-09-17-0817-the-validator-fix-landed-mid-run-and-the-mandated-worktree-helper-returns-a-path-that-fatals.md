# Station 00 - Supervisor | 2026-09-17T08:09Z-2026-09-17T08:4xZ

## GROUND

```
UTC            2026-09-17T08:09:24Z
origin/main    11169191  at preflight   ->  7d9cbeb6 at 08:2xZ (#1994 merged MID-RUN, see F1)
dev tree       main @ 11169191          C:\ProjectOperations2   (0 behind, 0 ahead at preflight)
doc version    1        (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1        (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run is SIGHTED: Desktop Commander answered on the first
call, shell PID 28748, `powershell.exe` on the Windows host. Not a blind run.

The three binding documents were read in full. `git diff --numstat origin/main -- <each>` returned
EMPTY for `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`, so the working copies read are byte-equal to `origin/main`
and PREFLIGHT step 2 is satisfied without a `git show` dump. No piped hash was used anywhere.

## WHAT I MEASURED

**Device-bridge git guard.** Installed first, before any VM-side call. Last line quoted verbatim as
the contract requires: [MEASURED]

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS, exit 0. Station 04's 06:11Z F2 and Station 05's 09-16 F1 both record that this PASS is true
only of a login shell and that the shim is bypassed in the non-interactive one. That is ESCALATED
and unresolved; nothing in this run relied on the guard, because every `git` call this run made ran
on the Windows host through Desktop Commander, never through the bridge.

**`bring-up-to-speed.ps1` - the one status entry point.** Ran to completion, exit 0, 999 lines.
[MEASURED] Section 7 verdict, verbatim:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 instrument positive controls both passed (`gh CAN reach GitHub (saw merged PR #1993)`,
`node runs`). Section 5 printed **zero** `[STALE]` rows - the eleven dead PR-scoped escalations the
station doc warns about are not present today; two `[FILE]` rows say section 5 *cannot decide* about
`two-station-00s-on-one-board-...-2026-09-14.md` and `verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`
because neither names a subject PR. Those are not clearable on that line and were not cleared.

**Board, live.** [MEASURED] At preflight, 2 open PRs; after F1, 1.

```
#1995  do-not-merge  BLOCKED -> BEHIND  feat(tendering): scopecards S2b-c (SCOPE_QUOTE_DESTINATION_UI_V1)
#1994  no labels     CLEAN, 15/15 green -> MERGED 08:20:29Z  (F1)
main CI on 11169191: 4 success / 0 failed  (trunk green)
armed *-ready.md at depth 1: 0
```

**#1995's two reds are ONE cause and it is parked by design.** Read from column 3 of the CP-26 job
log per DOCTRINE section 9.1, never from the pass/fail counts: [MEASURED]

```
$ gh run view 35198198561 -R <owner>/<repo> --job 105126335404 --log   (223 lines, split on TAB, last column)
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.
NEGATIVE control, a freshly minted needle over the same column -> 0
```

`[LABEL_PRESENT]`, not `[RELEASED_NO_RECEIPT]`. The second red, `PR gates - diff checks`, is the same
check running as a step inside the gates job. Thirteen other checks pass; `tendering-e2e` was still
running. **Nothing to fix here** - only Marco removes the label.

**Watcher.** [MEASURED] The sanctioned probe, report-only, no `-Fix`:

```
$ restart-watcher-if-wedged.ps1
armed prompts waiting: 0
watcher process:       ALIVE (pid 30248)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

Parent chain resolved rather than inferred from a command-line probe, per the station doc's
`wrapper=0`-is-a-question rule: `30248 node index.mjs` -> `14704 start-watcher.ps1` ->
`14836 watcher-launcher-singlelane.ps1` (its own parent 5164 is GONE). See F4 for the second family.

**The sweep's `watcher clone: branch=main dirty=1` warning is the known false one.** Re-derived from
its own source in the same minute, per DOCTRINE section 9.5: [MEASURED]

```
git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no  -> 0
git -C C:\po-watcher\ProjectOperations status --short                           -> 1
   ?? scripts/pr-watcher/.conflict-notified-prs.json
```

Tracked-dirty is **0**. The single file is untracked and `start-watcher.ps1` ignores untracked files,
so the *"the watcher may refuse to start"* clause does not apply. No dispatch. This is the third
consecutive run to re-derive it; it is already filed as a `status-sweep.ps1` defect.

**Breadcrumb freshness, and the collect surface.** [MEASURED] Before #1994 merged:

```
$ node scripts/pipeline/check-breadcrumb.mjs --freshness
  00  last 2026-09-17T07:45:00Z   0.5h ago  (cadence 2h)   ok
  03  last 2026-09-16T23:02:00Z   9.2h ago  (cadence 24h)  ok
  04  last 2026-09-17T06:11:00Z   2.1h ago  (cadence 4h)   ok
  05  last 2026-09-16T14:11:00Z  18.1h ago  (cadence 24h)  ok
  REJECT: 1 malformed breadcrumb(s)   exit 1
```

Crossed against `lastRunAt` from the scheduled-tasks MCP, which the breadcrumb instrument cannot see:
`00` 08:08:51Z, `04` 06:10:05Z, `05` 2026-09-16T14:11:02Z, `03` 2026-09-16T23:01:15Z - every station's
newest breadcrumb sits within minutes of its own last fire, so no station is in the
*"fresh `lastRunAt`, no breadcrumb"* row and no transcript read was needed. Four enabled tasks;
`weekly-security-audit` remains `enabled: false`, unchanged since 2026-09-06 and already with Marco.

The single REJECT was the held-back Station 04 report, and it is F1.

## WHAT CHANGED

- **One board PR opened** carrying this collect: the two untracked breadcrumbs landed, 24
  dispositioned breadcrumbs archived, and this report. Written inside the PR worktree (cure 1 of the
  station doc's fast-forward section), so no loose copy of it is ever left in the dev tree.
- **Nothing armed.** `armed *-ready.md` was 0 at preflight and 0 at the end; `.arming-log.txt` was
  not touched and needs no re-append.
- **No merge, no label, no `/sot/` edit, no prompt file moved, no watcher action, no worktree pruned.**
- **This run committed while the re-run sweep's section 7 read `CAUTION`**, and F6 is why: the single
  live station worktree it names is the one this run created two minutes earlier to satisfy the
  isolated-worktree rule. Section 3's four real mutation signals were clear in the same second.
  Stated here rather than only in F6, because a reader auditing mutations should meet it first.
- One scratch file written and removed from the dev tree root: `.buts-00-run.txt`, the
  `bring-up-to-speed.ps1` capture. Named here because an untracked file at the dev-tree root is
  exactly what refuses the next fast-forward.

## FINDINGS

### F1 - `#1994` merged mid-run, so the report Station 04 wrote at 06:11Z is landed this run instead of held back a second cycle

The 07:08Z run measured that `check-breadcrumb.mjs` bounded a findings body with `indexOf` and
therefore REJECTed a well-formed Station 04 report for quoting its own section headings on one line.
It deliberately **held that breadcrumb out of its PR**, because `check-breadcrumb.mjs` runs in CI
under `pipeline-tests` over the tracked set: committing the file would have reddened `main`'s gate
for every PR after it. The 07:45Z addendum opened the one-line cure as `#1994` with a 26-file A/B
control and left it unarmed for Marco.

[MEASURED] `#1994` merged at **2026-09-17T08:20:29Z**, merge commit `7d9cbeb6`, while this run was
creating its worktree - `new-worktree.ps1` fetched and reported `origin/main -> 7d9cbeb6` where the
preflight twenty minutes earlier had `11169191`. `gh pr view 1994 --json state,mergedAt,mergeCommit`
confirms `MERGED`.

So the precondition the hold was waiting on is satisfied, and the second cost of holding - 04's two
findings readable only on this one machine's disk, invisible to a clone, to CI and to any cloud-fired
station - does not have to be paid again.

**DISPOSITION: ACTIONED.** `00-04-scanner-2026-09-17-0611-...md` is in this run's PR, and so is the
07:45Z addendum. Read-back is the PR's own file list plus `check-breadcrumb.mjs` over the worktree
corpus, whose result is quoted in the PR body: with the fix on `main` the file now ADMITs, so the
tracked set stays clean and CI stays green. The 07:08Z F2 and the 07:45Z F1 are both closed by this.

### F2 - `new-worktree.ps1` is now the ONE mandated way to make a worktree, and with `-Branch` it returns a value that makes every following `git -C` call fatal

`PO_WORKTREE_HELPER_V1` was added 2026-09-15 precisely so that stations stop hand-writing worktree
paths, and its header states the contract in as many words: *"The ONLY thing written to the success
stream is the absolute path, so `$wt = & ...` captures the path and nothing else; everything else
goes to the host."*

[MEASURED] 2026-09-17T08:2xZ, following that documented usage exactly:

```
$wt = & scripts\pipeline\new-worktree.ps1 -Slug sup-0817-collect -Branch docs/collect-2026-09-17-0817
$wt  ->  branch 'docs/collect-2026-09-17-0817' set up to track 'origin/main'. HEAD is now at 7d9cbeb6
         fix(pipeline): anchor check-breadcrumb ... (#1994) C:\PR-Master\worktrees\sup-0817-collect
git -C $wt rev-parse --short HEAD
  ->  fatal: cannot change to 'branch 'docs/collect-2026-09-17-0817' set up to track 'origin/main'.':
      No such file or directory
```

POSITIVE control, same run, same worktree, the path written by hand:
`git -C 'C:\PR-Master\worktrees\sup-0817-collect' rev-parse --short HEAD` -> `7d9cbeb6`, and every
later call in this run used that literal. So the worktree itself is correct; only the returned value
is not.

**Mechanism.** `git worktree add -b <branch>` writes its branch-tracking line to **stdout**, not to
stderr. Inside a PowerShell function or script that output joins the success stream, so the caller's
`$wt` becomes a two-element collection that stringifies with the path at the end. The `-Branch`-less
form is not exposed to it, which is why the helper's own usage examples read as correct: the
detached-HEAD example in the header is the one that works.

**Why this earns a finding rather than a note.** It is a section 7 shape in a brand-new instrument:
nothing is empty, nothing warns, the helper exits **0**, the worktree is created correctly, and the
failure surfaces one or two commands later as a `fatal` naming a path nobody wrote. A run that meets
it mid-task has every reason to suspect its own worktree, the drive root refusal, or the git
index - and the documented contract tells it the returned value cannot be the problem. Every station
is now told to route through this helper, and a station that needs a *branch* is exactly the station
that is about to open a PR.

**RULE 1 options, complete-and-additive first:**

1. **Complete and additive.** Send `git worktree add`'s own output to the host stream inside
   `new-worktree.ps1` - the same treatment the script already gives its other progress lines - so the
   success stream carries the path alone in **both** forms. No path changes, no caller changes, no
   behaviour removed; a caller that already works keeps working, and the documented contract becomes
   true. Add the `-Branch` form to the header's usage examples so the next reader can see it tested.
2. **Additive but incomplete.** Document the leak and tell callers to take the last element
   (`$wt = (& ... )[-1]`). Nothing breaks, but it is a convention with no gate behind it and the next
   caller will copy the header, not this note. Fails the "future" half.
3. **Complete but not additive.** Have the helper return nothing and require callers to recompute the
   path from the slug. That removes the leak by removing the feature, and re-opens the hand-written
   path problem the helper exists to close. Fails the "without damaging existing entry" half.

**DISPOSITION: ESCALATED.** The cure is one line in `scripts/pipeline/new-worktree.ps1`, which
`classifyPolicyFiles` routes outside `tests|docs`, so it is Marco's to merge and not Station 00's -
the same lane bar that `#1994` sat behind this morning. There is no design question attached: option
1 is the only one that passes both halves, and the falsifying probe is the two commands quoted above.

### F3 - The 13-day `po-vg` worktree holds a SUPERSEDED earlier draft, not unrescued work, and that is now measured rather than reasoned

`status-sweep.ps1` has parked `C:/PR-Master/worktrees/po-vg` for thirteen days behind
*"HOLDS UNCOMMITTED WORK (1 file(s)). PRESERVE OR COMMIT BEFORE PRUNING"*. Station 04's 09-16 02:19
F1 called that warning content-blind; Station 03's 09-15 F2 and 09-16 F4 read the file as *"already
rescued"*. Neither side had compared the bytes, and the two readings prescribe opposite actions.

[MEASURED] 2026-09-17T08:3xZ, both sides compared as **Buffers in node** so no size or
cross-boundary length comparison is involved (DOCTRINE section 9.3):

```
worktree file : C:\PR-Master\worktrees\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs
                6144 bytes, 130 lines, git hash-object -> 9c4587fb
origin/main   : scripts/pipeline/check-pipeline-heartbeat.mjs
                6746 bytes, 138 lines, git rev-parse origin/main:<path> -> 84ec92d4
Buffer.compare(worktree, main)                  -> 1   (differ)
Buffer.compare(worktree LF-normalised, main)    -> 1   (still differ; the worktree copy is already LF)
first differing line                            -> 43
   worktree : const DIR = "docs/pr-prompts";
   main     : // A pause may not exceed this. An UNBOUNDED pause is an off switch, and an off switch
POSITIVE control  Buffer.compare(main, main)               -> 0
NEGATIVE control  Buffer.compare(main + one byte, main)    -> 1
```

**Both earlier readings are half right, and the disposition follows from the halves.** The sweep is
correct that the bytes are not on `main` - so a blind `git worktree remove --force` does discard
something. The stations are correct that the work is not lost: `main` carries the same path at a
**later** revision, eight lines longer, diverging at line 43, which is the shape of a superseded
draft rather than of unmerged work. Nothing in the worktree copy is absent from `main` as a *change
someone still needs*; it is an earlier state of a file that shipped.

**DISPOSITION: DISPATCHED -> Station 03.** Worktrees and local trees are 03's lane and it has already
been dispatched here twice. What this adds is the one thing both prior dispatches lacked: a measured
answer to *what exactly gets discarded*, so 03 can prune `po-vg` deliberately rather than leave it
parked for a fourteenth day on a warning nobody could resolve. 00 does not prune it: that is machine
work, and the sweep's warning is not a defect I can clear by measuring around it.

### F4 - Two `watcher-launcher-singlelane.ps1` families are alive, only one owns the node, and the second has been resident for 34 hours

Station 03's 2026-09-16T23:02Z F1 reported two heartbeat watchdogs holding kill authority over one
node, and the 07:08Z run DISPATCHED it back to 03. It reproduces, and the parent chain now names
which family is which. [MEASURED] 2026-09-17T08:2xZ, from `Get-CimInstance Win32_Process`, resolved
by `ParentProcessId` rather than by a command-line name match:

```
node.exe                        pid 30248  start 2026-09-16T00:35:18Z  parent 14704
start-watcher.ps1               pid 14704  start 2026-09-16T00:35:17Z  parent 14836
watcher-launcher-singlelane.ps1 pid 14836  start 2026-09-15T22:21:21Z  parent 5164   (GONE)
watcher-launcher-singlelane.ps1 pid 25260  start 2026-09-15T23:15:02Z  parent 10852  (GONE)   <- NOT in the chain
node_count = 1
```

pid 25260 started **54 minutes after** the family that owns the live node, has no node of its own,
and is not an ancestor of pid 30248. The sweep reports this as `auto-restart wrapper: alive (2)` -
a count, which reads as redundancy rather than as a duplicate supervisor.

**DISPOSITION: DISPATCHED -> Station 03**, as evidence attached to its own open finding, not as a new
one. 03 owns the watcher lifecycle; 00 does not kill processes it did not start, and
`restart-watcher-if-wedged.ps1` returns `OK` - so there is nothing here that licenses action from me.
The single fact worth carrying forward is that the sweep's wrapper line is a COUNT and a count cannot
distinguish two supervisors from one supervisor with a helper.

### F5 - The board is one parked PR and the backlog is closed; this is a real quiet

Stated so that a later reader does not mistake it for the blind kind. [MEASURED] one open PR
(`#1995`, `do-not-merge`, parked by design per the CP-26 verdict token above), zero armed prompts,
trunk green on `11169191` and again on `7d9cbeb6`, the watcher alive and correctly idle, and every
breadcrumb since 2026-09-15T06:40Z now dispositioned - the 07:08Z run closed the 48-hour backlog and
this run closes the two reports written after it.

**DISPOSITION: ACTIONED** (stated, nothing to fix).

### F6 - The sweep's section 7 CAUTION fires on the acting station's OWN worktree, so obeying the doctrine manufactures the verdict that forbids finishing

The station contract says re-run `status-sweep.ps1` immediately before every board mutation and obey
it. The BOARD DRIVING conditions say mutate only from a clean isolated worktree. Run in that order,
the second makes the first refuse. [MEASURED] 2026-09-17T08:24:54Z, the re-run taken immediately
before this run's commit, with the worktree three minutes old:

```
==================== 7. VERDICT ====================
  [LIVE] CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
  [LIVE]    C:/PR-Master/worktrees/sup-0817-collect          <- created by THIS run, 08:2xZ
  [LIVE] A station may be mid-run. Prefer to wait and re-run; ...
```

The same sweep's section 3 - the gate the header itself calls *"the safe-to-act gate -- REAL mutation
signals"* - is entirely clear in the same second: [MEASURED]

```
[LIVE] git index.lock  interactive/clone: False / False
[LIVE] git processes touching our trees (scoped): 0
[LIVE] no PR touched on GitHub in the last 2 min
[INFO] headless claude-code sessions: 1  (INCLUDES this chat -- informational, NOT a blocker)
```

The preflight sweep 12 minutes earlier, before the worktree existed, read
`SAFE TO ACT: ... no live station worktrees`. **The only input that changed between the two verdicts
is a worktree this run created.**

This is DOCTRINE section 9.5's *"a sweep `[LIVE]` line is subject to section 7"* rule with a new
instance: the line's provenance is impeccable and the derivation counts the reader. It is also
self-limiting in the dangerous direction - the project-level instruction is *"if the sweep says
CAUTION, do not stage/arm/merge"*, so a run that follows every rule in order reaches a state where
it may not commit the work it has already done, and the available next move is to abandon a finished
worktree or to ignore a CAUTION on principle. Neither is a good habit to teach.

**The discriminator is cheap and unambiguous, and it is what I used to proceed:** the named worktree
is at a slug this session minted, on a branch this session created, at an age measured in minutes,
and `git worktree list` resolves it in this run's own tree. A LIVE worktree belonging to *another*
actor would satisfy none of those. Section 3's four real signals were clear throughout.

**RULE 1 options, complete-and-additive first:**

1. **Complete and additive.** Have section 2 record each worktree's branch and age and have section 7
   exclude a worktree whose branch head is not on `origin/main` **and** whose age is under a few
   minutes only when the caller identifies it - simplest form: an optional `-SelfWorktree <path>`
   argument the caller passes, printed in section 2 as `(SELF, excluded)`. Nothing is removed, no
   other actor's worktree is ever hidden, and the CAUTION keeps its whole meaning for everything the
   caller did not create.
2. **Additive but incomplete.** Document that a self-worktree CAUTION may be crossed against
   section 3. True, but it is a convention with no gate, and it teaches every future run to reason
   past a CAUTION - which is the habit that turns a real second actor into a collision. Fails the
   "future" half.
3. **Complete but not additive.** Drop live-worktree detection from section 7. It would remove the
   false CAUTION and the true one together; the LL-38 collision this pipeline exists to avoid is
   exactly what that line is for. Fails the "without damaging existing entry" half.

**DISPOSITION: ESCALATED.** `scripts/pipeline/status-sweep.ps1` is outside `tests|docs` and so is
Marco's to merge, the same lane bar as F2. The falsifying probe is the pair of sweeps quoted above:
run it once with no station worktree present and once immediately after `new-worktree.ps1`, changing
nothing else. If section 7 ever returns `SAFE TO ACT` with a freshly minted self-worktree present,
this finding is wrong and must be re-measured.

## COLLECT-LEDGER

The 07:08Z run dispositioned all fifteen breadcrumbs written between 2026-09-15T06:40Z and
2026-09-17T06:11Z, including Station 04's 06:11Z report. Only one breadcrumb has been written since,
and it is this station's own.

| Source breadcrumb | Findings | Disposition |
|---|---|---|
| 00 - 09-17 07:45 (addendum) | F1 the 07:08Z F2 cure is open as `#1994`, driven and controlled; F2 the refused fast-forward has a third cause and `git checkout-index -f -- <path>` clears it | F1 **ACTIONED** - `#1994` merged 08:20:29Z, see F1 above; the ESCALATED state it was left in is discharged by the merge. F2 **DEFERRED, unchanged** - it is a durable note for the station doc's fast-forward section, landable in an ordinary docs PR; what would make it urgent is a second run meeting a refused FF with `--numstat` EMPTY and reaching for a forbidden command because nothing told it about `checkout-index` |

Twenty-four breadcrumbs dated 2026-09-16 and earlier, every finding in them dispositioned by the
07:08Z run, are archived into `docs/pr-prompts/archive/` in this run's PR. Archiving is safe for
freshness: `check-breadcrumb.mjs` builds its tracked set with `git ls-tree -r` and matches by trailing
path segment, so an archived breadcrumb still counts and cannot make a station read SILENT. The
2026-09-17 breadcrumbs stay in the queue root as the current cycle.

## WHAT I DID NOT DO

- **Did not merge `#1995`, and did not touch its label.** Its CP-26 verdict is `[LABEL_PRESENT]`;
  only Marco removes a `do-not-merge` label, and that removal is what releases the merge. Its
  `mergeStateStatus` went `BLOCKED -> BEHIND` when `#1994` landed; I left the branch un-updated
  rather than restart a 14-minute `tendering-e2e` on a PR no human has looked at yet, and because
  `#1994` is a pipeline-script change that cannot affect a tendering UI diff. If Marco wants it
  up-to-date before he reads it, one `gh pr update-branch 1995` does it.
- **Did not clear the two `[FILE]` rows in sweep section 5.** Neither escalation names a subject PR,
  so the sweep says in as many words that it cannot decide staleness from that line, and clearing on
  the tag alone is what left eleven dead escalations standing for ten days in an earlier cycle.
- **Did not prune any worktree and did not kill the second launcher family.** Both are Station 03's
  lane; both are dispatched with the measurements they were missing.
- **Did not repair `new-worktree.ps1`.** `scripts/` is outside this station's merge lane; escalated
  with the cure and its falsifying probe instead.
- **Did not run `git` through the device bridge.** Every command this run made ran on the Windows
  host through Desktop Commander. The bridge guard was installed anyway, because the preflight
  requires it and its own failure mode is now two stations' open escalation.
- **Did not re-file findings other stations own** and which reproduced here: the guard's
  non-interactive PATH bypass (Station 05 09-16 F1, Station 04 09-17 F2, both ESCALATED), the
  `status-sweep.ps1` clone-dirty false warning, and the intermittent Desktop Commander outage.
- **Did not touch `/sot/`, source, any prompt file, any label, or the arming log.**
