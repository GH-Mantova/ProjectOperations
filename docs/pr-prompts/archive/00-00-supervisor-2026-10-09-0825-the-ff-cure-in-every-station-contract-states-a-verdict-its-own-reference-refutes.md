# Station 00 - Supervisor | 2026-10-09T08:14Z-2026-10-09T08:5xZ

## GROUND

```
UTC            2026-10-09T08:14:07Z
origin/main    7430a967             (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 7430a967      C:\ProjectOperations2   (LEVEL with origin/main)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                    (station_doc_version: 1)
```

Doc version and bootstrap **AGREE**, so this run is not read-only on that count.

**NOT BLIND.** Desktop Commander loaded on ONE keyword `ToolSearch` for `desktop-commander`
(BOOTSTRAP_PREFLIGHT_V1 - ids taken from what the search reported, never assumed). `start_process`
with shell `powershell.exe` returned `PREFLIGHT_OK` on the first call; no
BOOTSTRAP_CONNECT_RETRY_V1 retry was needed.

**Git guard, quoted as the contract requires.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
- headline:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

last line:

```
   PATH="/sessions/happy-relaxed-meitner/.local/bin:$PATH" git <args>
```

**EXIT CODE 2** - the expected station outcome per the PREFLIGHT table, a FINDING not a STOP. The
code read is the INSTALLER's own; nothing was piped into `tail` or `Select-Object` ahead of the
status. The device-bridge git ban was therefore REMEMBERED, not mechanical, and it was kept: **no
`git` ran through the Linux bridge against any mount.** Every `git`, `gh`, `node` and `.ps1` call
below ran in a `powershell.exe` shell on the Windows host.

**Three binding reads, in full, from `git show origin/main:<path>` in the DEV TREE** (never the
watcher clone, never the working copy at those paths): `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`. The REFERENCE files were
opened on demand, as BOOTSTRAP_CORE_REFERENCE_V1 directs - `00-supervisor-REFERENCE.md` because F39
below is a change to it. **No piped `git show | git hash-object --stdin` comparison was made
anywhere in this run** (DOCTRINE 9.2).

---

## WHAT I MEASURED

### Freshness - CLEAN, no station MISSED

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, **exit 0**.
Structure pass: `1 checked, 0 malformed, 0 skipped as pre-contract`, the one being the 0714
breadcrumb, which ADMITs.

```
00  last 2026-10-09T07:14:00Z  1.0h ago  (cadence 1h + grace 0.5h)   ok
02  dispatch-only - no cadence to miss
03  last 2026-10-08T23:06:00Z  9.2h ago  (cadence 24h + grace 3h)    ok
04  last 2026-10-09T06:10:00Z  2.1h ago  (cadence 4h + grace 1h)     ok
05  last 2026-10-08T22:38:00Z  9.6h ago  (cadence 24h + grace 3h)    ok
```

No station is MISSED, so no MISSED classification is owed and **no scheduled task was read,
disabled, enabled, re-run or edited** (FRESHNESS_ONE_CADENCE_V1 permits nothing on a healthy
reading).

### The board, from `scripts/pipeline/status-sweep.ps1`

[MEASURED] `SWEEP COMPLETE 2026-10-09 08:14:39Z`, **exit 0**, all seven sections, read streamed with
repeated `read_process_output` calls at explicit offsets until the process reported complete (the
first read returned 74 of 469 lines - a single read is again not a finished sweep). Section 0
positive controls both `[LIVE]`: `gh CAN reach GitHub (saw merged PR #2280)`, `node runs`. **No
`[BROKEN]`.**

- **Section 7 VERDICT:** `SAFE TO ACT: no board mutation in progress, no recent remote activity, no
  live station worktrees.`
- **Section 1:** OPEN PRs **1** - `#2278 BEHIND, CI: 15 pass / 0 fail / 0 pending`.
  **WAITING ON MARCO: 0** open PRs labelled `do-not-merge`. `main` CI on `7430a967`:
  4 success / 0 failed / 0 running (**trunk green**). Merged since the last cycle: **#2280** at
  07:42Z.
- **Section 2:** watcher `node` RUNNING pid 8848, auto-restart wrapper alive (1), heartbeat age
  107 min with **no build in flight** (ticks are 60 s apart only while a build runs, so a stale tick
  plus an empty queue is idle, not wedged). Clone `branch=main tracked-dirty=0 untracked=3`. 33
  non-main worktrees, **all classified orphaned, no LIVE station worktree**, plus 2 registry
  escapees. Guard hook `.claude/hooks/guard.mjs` present.
- **Section 3:** `git index.lock interactive/clone: False / False`; git processes touching our trees
  **0**; **board lease: free**; no PR touched on GitHub in the last 2 min.
- **Section 4:** armed (`*-ready.md`) **0**; `needs-marco/` **52** (53 last cycle, one discharged);
  `no-pr-opened/` 111, `failed/` 80, `blocked/` 204. Section 6 backlog gates:
  `ready=1 needs-marco=2 blocked=4 broken=0` - the single `ready` is
  `rates-11c-blocked-consumers`, staging work and therefore Station 06's, not an arm.
- **Section 5:** **no `[STALE]` row that names a dead escalation.** Every line is the
  `cites #N (MERGED) as evidence -- not its premise; does not clear the escalation` /
  `section 5 CANNOT decide` shape, which the sweep itself says must not be cleared on that line
  alone. The one actionable `[STALE]` row the last cycle found (#2261) was discharged by it.
- **Section 4C:** `[STALE] no station summary younger than 3 days` - freshest is
  `queue-watch-state.md` at 16.1 days. Body deliberately not quoted by the sweep and not quoted
  here.

**MARCO_QUEUE_LINE_V1, both figures:** armed = **0**, WAITING ON MARCO = **0** open PRs labelled
`do-not-merge`. **This run armed nothing** (see WHAT I DID NOT DO), so these are the state it
inherited and left.

### Pre-mutation gate, re-measured immediately before acting

[MEASURED] at 08:2xZ, after the sweep and before any write: `index.lock dev=False`,
`git procs=0`. Then
`Enter-BoardLease -Reason 'collect:board-pr-2026-10-09-0825' -Actor 'station-00.scheduled'` ->
**`True`**.

### #2278, re-classified from scratch - the head moved again since the last cycle

[MEASURED] asked individually, never from a LIST response's `merged` field (DOCTRINE 9.4):
`gh pr view 2278 --json number,state,mergedAt,mergeStateStatus,headRefOid,headRefName,labels,files,isDraft,autoMergeRequest`

| reading | value |
|---|---|
| state / mergedAt | `OPEN` / `null` |
| mergeStateStatus | `BEHIND` |
| headRefOid | `08883affadf622ea0f9e6f3817422bfa6466eb0c` (was `cc4b8e90` an hour ago) |
| labels | `[]` - has never carried `do-not-merge` |
| files | `docs/decisions/merge-approvals/2278.md`, `scripts/pipeline/status-sweep.ps1` |
| **autoMergeRequest** | **SQUASH, enabledAt `2026-10-09T07:35:54Z`, enabledBy `GH-Mantova`** |
| required checks on the head | **15 pass / 0 fail / 0 pending** - `tendering-e2e` pass 12m40s |
| `Approval receipt (CP-26)` | **pass** |

[MEASURED] `git log --format='%h %an %s' origin/main..refs/remotes/pr2278` - FOUR commits now:

```
08883aff  GH-Mantova     Merge branch 'main' into feat/heartbeat-alarm-text-v1
cc4b8e90  GH-Mantova     Merge branch 'main' into feat/heartbeat-alarm-text-v1
e987397f  PR Supervisor  docs(decisions): CP-26 standing receipt for #2278 - instrument lane
05650340  Marco          feat(pipeline): quote the heartbeat alarm sentence in the sweep
```

[MEASURED] `docs/pr-reviews/pr-2278-review.md` first two lines: `VERDICT: MERGE`,
`REVIEWED-SHA: 05650340cef2d843cad9556df6b9a36a7c681105`. **`REVIEWED-SHA` != current head**, by one
receipt commit and now TWO `Merge branch 'main'` commits. INSTRUMENT_LANE_V1 condition 4 fails, so
the PR stays for Marco - unchanged from the last cycle and for the same structural reason (F31,
already escalated). See F40 for what is new.

### The canonical station contract against its own REFERENCE

[MEASURED] the contract sentence, present **exactly once in each of the seven station docs** and
byte-identical across them, as the hash-gated block requires:

```
--refresh`; exit 0 means fast-forward now. Never `git checkout -- <path>`, never `git clean`
```

[MEASURED] what `00-supervisor-REFERENCE.md` already says about that same step, by heading and
anchor name: `FF_RESTORE_MUST_WRITE_THE_WORKING_COPY_EOL_V1`,
`FF_RESTORE_MIXED_EOL_BLOB_NEEDS_RAW_BUFFER_V1`,
`FF_RESTORE_OF_A_NEWLY_TRACKED_PATH_NEEDS_THE_EOL_V1`, and a later correction whose own headline is
that **`git update-index --refresh` is a whole-index operation and its exit code is not a per-file
verdict**, with a measured case where acting on the non-zero exit routed a run into a
convert-on-write branch the same section measures as **corrupting** a mixed-EOL blob.

**One instrument lie of my own, caught by its own control, and worth recording because it is
DOCTRINE 9.1 in the one place I would not have looked.** My first probe for that sentence ran as
`node -e "..."` through `-Command` and returned `hits=0` in all seven files - a clean, well-formed
negative that would have made me conclude the sentence was not there. **PowerShell's own escape
character is the backtick**, and the needle is full of them, so the double-quoted `-e` string had
every backtick stripped before node ever saw it. The identical script written to a `.mjs` file and
run by path returned `hits=1` in all seven. §9.1's rule is written for `$`; it holds for the
backtick for the same reason, and the failure is the worse shape - a valid command carrying a
needle I never wrote, exit 0, nothing empty, so §9.6 does not fire either.

---

## WHAT CHANGED

**On the board: nothing was armed, merged, labelled, re-parked, branch-updated or dispatched to a
scheduled task.** No `/sot/` edit. No scheduled-task change. No Azure / Entra / SharePoint contact.
No worktree pruned, no ref deleted, no stash dropped, no lock cleared. Auto-merge on #2278 was
neither armed nor disarmed by this run.

Every mutation below was made in an **isolated worktree off `origin/main` on the Windows FS**
(`C:\po-wt\bd-1009-0825`, branch `docs/board-2026-10-09-0825`, created at `7430a967`) under the
board lease, and is carried by ONE board PR. All of it is **docs-only**, so CP-26 is not armed by
this diff and no receipt is owed.

1. **The canonical `station-contract` block, in all seven station docs** - the refuted
   `exit 0 means fast-forward now` verdict replaced with the per-path reading and a `Full detail:`
   pointer to the REFERENCE. Written by one script, byte-identically, then proved: each file
   `newHits=1 oldHits=0`, `+4` CRLF each, `loneLF=0`, `U+FFFD=0`, `cp1252sig=0`, `bom=false`
   (F39).
2. **`docs/pipeline/stations/_canonical-blocks.json`** - `station-contract` v5 sha re-recorded
   `81ddf31ac807132b` -> `3c4ff268d0aa7cfc` via `lint-station.mjs --write-canonical`, **deliberately
   and once**, as the block's own comment requires. The `instruments` v2 hash is **unchanged** - the
   JSON diff is exactly one line.
3. **`docs/pipeline/stations/00-supervisor-REFERENCE.md`** - a real `### §POST-MERGE-FF-CURE`
   heading, so the new pointer resolves. The REFERENCE's index already labelled that section
   `->POST-MERGE-FF-CURE`; there was no heading behind the label, and `lint-station.mjs` rejected
   the pointer until there was (F39).
4. **`docs/pipeline/stations/00-supervisor.md`, BOARD DRIVING condition 3** (outside the canonical
   block) - the `Merge-Pr` / `arm-prompt.ps1` actor-string requirement, with the measured #2279
   refusal and the warning that reading it at face value is a false LL-38 stand-down. This is F38's
   dispatched docs half, ACTIONED.
5. **One breadcrumb collected and archived** - `git mv` of
   `00-00-supervisor-2026-10-09-0714-...` into `docs/pr-prompts/archive/`; every finding in it
   carries a disposition in this file.

**Read back after all four edits:** `node scripts/pipeline/lint-station.mjs` ->
**`ADMIT: all 10 docs clean`, exit 0**, with `ADMIT` on every one of the seven station docs, on
`00-supervisor-REFERENCE.md`, on `.claude/agents/*.md` (8 definitions, encoding clean) and on the
five bootstraps. `git diff --stat` = 9 files, 49 insertions, 9 deletions, all under
`docs/pipeline/stations/`.

---

## FINDINGS

### F39 - the fast-forward cure inside every station's canonical contract states a verdict its own REFERENCE measured as unsound, and the pointer that would have corrected it had no heading to resolve to

The contract's REPORT CONTRACT block tells every station to restore a blocking path with a
raw-Buffer node write *"then `git update-index --refresh`; exit 0 means fast-forward now."* [MEASURED]
that sentence is present exactly once in all seven station docs and is byte-identical across them.
[MEASURED] `00-supervisor-REFERENCE.md` already carries three measured EOL findings about that exact
step **plus** a correction headlined that `update-index --refresh` is a **whole-index** operation
whose exit code is not a per-file verdict - and a case where obeying the non-zero exit sent a run
into a convert-on-write branch the same section measures as **corrupting** a mixed-EOL blob.

So the core said "exit 0 means done" where the reference says "read the per-path output; the exit
code can be about an unrelated file, and acting on it can make things worse." **The last cycle's F37
is what that costs**: it followed the core sentence literally, took three attempts, and proposed as
its fix the convert-LF-to-CRLF-on-write form that the REFERENCE had already measured as the
corrupting branch. A station that reads only the core cannot know; a station that reads the
REFERENCE finds the right answer four layers down and no pointer from the core.

**The pointer was not addable as written, and that is the second half of the finding.**
`lint-station.mjs` validates every `Full detail: <file> §<anchor>` against a real `##`/`###` heading
(`^#{1,6}\s+(?:§)?<anchor>([.\s]|$)`). The REFERENCE's own index line already read
`- **AFTER YOUR BOARD PR MERGES** (the fast-forward cure)  ->POST-MERGE-FF-CURE`, but **no heading
carried that anchor**, so the linter rejected the pointer in all seven docs: `Full detail pointer
§POST-MERGE-FF-CURE does not resolve to a heading`. The label had been a dead reference since the
core/reference split.

**DISPOSITION: ACTIONED.** The sentence is replaced in all seven docs by one script, byte-identically
(`newHits=1 oldHits=0` each, `loneLF=0`, `U+FFFD=0`, `cp1252sig=0`, no BOM), the anchor heading is
real, the canonical sha is re-recorded once and deliberately, and `lint-station.mjs` returns
**`ADMIT: all 10 docs clean`, exit 0** - which is the positive control that the linter CAN pass on
this corpus, taken after it had already failed loudly on both defects. RULE 1, and this is why the
canonical edit was taken rather than filed: **(a) correct the sentence in all seven and make the
anchor real** - immediate, permanent, mechanically gated by the linter, and it damages nothing
because the REFERENCE's measured branches are unchanged and merely pointed at. **(b) add the rule to
the REFERENCE only and leave the core** fails the future half outright: the core is the layer every
station reads in full, and it is the one that misled F37. **(c) delete the sentence** fails the
no-damage half - a station with no restore instruction at all reaches for `git checkout -- <path>`,
which DOCTRINE 9.2 records as resurrecting consumed prompts.

### F40 - #2278 is green, unlabelled, un-mergeable by any station, and has auto-merge armed, so the only thing holding it is a BEHIND branch nobody may update

Carried forward from F31 with this run's own readings, because one fact is new and it changes the
shape of the wait. #2278 is now **15/15 green on head `08883aff`** (was 14/1 pending), still
unlabelled, still receipted, and its `REVIEWED-SHA` is still `05650340` - so INSTRUMENT_LANE_V1
condition 4 fails and the station doc is explicit that **any** condition failing leaves it for
Marco. What is new: [MEASURED] **auto-merge is armed**, SQUASH, `enabledAt 2026-10-09T07:35:54Z`.
The last cycle recorded that it did not arm it, and `enabledBy` reads `GH-Mantova` for every actor
on this board, so **who armed it is not measurable from the API** - the same non-discrimination
STATION-CAPABILITIES records for `mergedBy`.

The consequence is a stalemate with no actor in it. GitHub will not complete an armed auto-merge
while the branch is `BEHIND`; `PR_WATCHER_AUTO_UPDATE` is OFF by default, so nothing updates it; and
the station doc forbids `gh pr update-branch` on a PR I am not about to merge - which I am not,
because condition 4 fails. So the PR sits green and armed and still, and every board PR that merges
puts it one commit further behind.

**DISPOSITION: ESCALATED** - on the existing tracked filing
`docs/pr-prompts/needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`, which the last
cycle appended F31's addendum to. **No new filing was opened** (DOCTRINE 10.5) and no second
artefact was created: F31's question is unchanged and this is its second measured instance, now with
the auto-merge state attached. The question for Marco is in FOR MARCO below. **I did not disarm the
auto-merge**: it is a release decision I cannot attribute, disarming it would override an actor I
cannot identify, and leaving it costs nothing while the branch is BEHIND.

### F41 - the three-attempt cost of F37 was a documented trap, and the general lesson is that a core sentence must point at its reference or it will be followed literally

This is the generalisation of F39 and it is recorded separately because the next core/reference
split will reproduce it. DOCTRINE_CORE_SPLIT_V1 moved the evidence out of the cores and left the
rules behind, with the convention `Full detail: <file> §<n>` to bridge them. **F39 measured the
bridge broken in both directions at once**: a core sentence that contradicted its own reference, and
an index label in the reference that pointed at a heading that did not exist. Neither is visible
to a reader of one file, and the linter only catches the second once someone tries to write the
first.

**DISPOSITION: DEFERRED.** Real, not now: the complete fix is a linter pass that flags any
`CANONICAL-BLOCK` paragraph prescribing a command verdict with no `Full detail:` pointer, and any
`->ANCHOR` index label with no matching heading. The second half is three lines and cheap; the first
half needs a definition of "prescribes a verdict" that will not fire on every sentence, and that is
design work, not a tail-end item in a collect run. **What would make it urgent:** a third occurrence,
or any station doc rejected by `lint-station.mjs` for an unresolvable pointer. The anchor half is
now one real heading better than it was, so the same bug cannot recur at that one label.

### F42 - 31-of-33 orphaned worktrees holding unpushed commits, and two registry escapees, are still Station 03's and have not moved

Carried from the last cycle's F33 with this run's own reading: [MEASURED] sweep at 08:14:39Z -
`non-main worktrees found: 33`, **every one classified orphaned**, `worktree-registry-escapees: 2
found -- Station 03 should review and prune if confirmed dead`. Two hold **uncommitted** work that
`--force` would destroy (`C:/po-worktrees/sup-cwd-paths` 2 files, age 21,640 min;
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 file, age 9,325 min), and the largest unpushed
holdings are `C:/po-wt/s8h` at **16 commits** and `C:/po-wt/rcpt-2183` at **15**. My own worktree
from this run is additional to the 33 and is torn down below.

**DISPOSITION: DISPATCHED to Station 03**, unchanged and un-escalated because 03 is `ok` on its own
cadence (`0 9 * * *`, last 2026-10-08T23:06Z) and this breadcrumb is the channel. 00 routes it and
does not do it (LL-38). The two constraints travel with it, RULE 1 in order: **push or patch out the
unpushed commits and the two dirty worktrees BEFORE any removal** - complete and additive, keeps
every future recovery possible; a `git worktree remove --force` sweep is faster and **fails the
no-data-loss half outright**, discarding work that exists in exactly one place on one disk. The
removal itself is irreversible and stays Marco's until preservation is done and read back.

### F43 - the dev tree was found LEVEL and clean, so the last cycle's correction holds and no ff cure was needed

[MEASURED] all four readings the report contract names, on `C:\ProjectOperations2` at 08:14Z, before
anything was written:

```
git rev-list --left-right --count HEAD...origin/main  -> 0  0
git diff --numstat                                    -> EMPTY
git diff --cached --name-status                        -> EMPTY
git status --porcelain --untracked-files=no (tracked)  -> EMPTY
dev HEAD = origin/main = 7430a967
```

The last cycle's CORRECTION reported the fast-forward taken and the tree level; this run confirms it
independently an hour later. The untracked set is unchanged and collides with nothing on `main`:
`.codex/`, `AGENTS.md`, three `Claude Design/` paths, and the `docs/pr-reviews/pr-<N>-review.md`
verdicts 04-F4 measured.

**DISPOSITION: ACTIONED** - nothing to repair, and the four readings are recorded so the next run
does not have to assume. This run's own breadcrumb is written **inside its PR worktree**, which is
cure 1 and the reason F39's cure was never needed here.

---

## WHAT I DID NOT DO

- **I did not merge #2278, did not disarm or re-arm its auto-merge, did not update its branch, did
  not label or comment on it, and wrote no receipt for it.** INSTRUMENT_LANE_V1 condition 4 fails -
  the MERGE verdict's `REVIEWED-SHA` (`05650340`) is not the current head (`08883aff`) - and the
  station doc is explicit that any condition failing leaves the PR for Marco. I did not reason past
  condition 4 on the grounds that the three intervening commits are a receipt and two main-merges
  that touch no reviewed file; that judgement is exactly what the anchor exists to replace, and it
  is the question already in front of Marco.
- **I did not arm anything.** `armed` is 0, the backlog's single `ready` item
  (`rates-11c-blocked-consumers`) is staging work and therefore Station 06's, and I did not open any
  of the 13 `-HOLD.md` gates to look for a promotable one: the heartbeat is 107 min old with no
  build in flight, which permits arming, but with WAITING ON MARCO at 0 and one green PR already
  stalled on a gate Marco has not yet ruled on, adding a build is not the useful move this cycle.
  **Stated as a choice, not a finding** (NEVER_LIST_BEFORE_ARMING_V1 was therefore not reached).
- **I did not write or create any `*-ready.md`**, including a `rev-2278-ready.md` to refresh the
  stale verdict. Arming is a `git mv` of a tracked `-HOLD.md` and nothing else; hand-writing a
  watcher-internal review job is not in this station's recorded authority.
- **I did not run `gh pr update-branch` on anything.**
- **I did not touch `scripts/**`, `instrument-lane.json`, `standing-lanes.json` or any CI
  workflow.** `lint-station.mjs --write-canonical` was RUN but writes only
  `docs/pipeline/stations/_canonical-blocks.json`; the script itself is unchanged. Every path in
  this PR is under `docs/pipeline/stations/` or `docs/pr-prompts/`.
- **I did not edit `/sot/`** - Station 05's exclusively, and CP-24 hard-fails any PR mixing code and
  `sot/`. The `docs/sot-reconcile-2026-10-09` branch and `C:/po-worktrees/st05-sot-2026-10-09`
  worktree are 05's and were left alone, including in F42's census where the sweep lists the latter
  as an orphan - **that call is 05's, so it is flagged rather than classified.**
- **I did not clear a `[STALE]` escalation row or retire any escalation.** Section 5 produced no row
  naming a merged subject PR this run; every line was the `cites #N as evidence` /
  `section 5 CANNOT decide` shape, which the sweep itself says must not be cleared on that line
  alone. `docs/pipeline/discharges/` was not written to.
- **I did not prune a worktree, delete a ref, `git remote prune`, or drop a stash.** All
  irreversible, all Marco's (DOCTRINE 5.4); F42 routes the worktree half to 03 for preservation
  first.
- **I did not clear a lock.** There were none: `index.lock interactive/clone: False / False`.
- **I did not open a new filing for F40.** It went onto the existing tracked escalation as F31's
  second instance (DOCTRINE 10.5).
- **I did not read, disable, enable, re-run or edit any scheduled task,** and I did not call
  `list_scheduled_tasks`: no station was MISSED, so FRESHNESS_ONE_CADENCE_V1's `lastRunAt` cross-check
  was not reached, and nothing in this run turns on a cadence value. The cadence figures in this
  report come from `--freshness`, which reads the validator's own map - **state, to be re-measured,
  never quoted.**
- **I did not dispatch 04 or 05,** and I did not re-run anything. Both measured `ok`. F42 is the only
  dispatch and 03 takes it on its own daily cadence.
- **I did not run `git` through the Linux device bridge** against any mount, although the guard
  reported itself INERT (exit 2) and the ban was therefore remembered rather than mechanical. I did
  not treat the inert guard as a licence.
- **I did not compare a piped `git show | git hash-object --stdin` hash against anything.**
- **I did not trust my own first probe.** The backtick-stripped `node -e` negative in WHAT I
  MEASURED was discarded and re-run from a script file before any edit was made, not after.
- **I did not write to any gitignored sink.** Nothing of this run went to `docs/qa/qa-findings.md`,
  `qa-checklist.md`, `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md` (the five files
  under the `# Overnight-QA scheduled task` comment in `.gitignore`), nor to a disposable worktree
  that gets torn down, nor to the Cowork session's `outputs` folder. The three scratch `.mjs` probes
  live in `C:\po-sup-fix-scripts\`, which is the sanctioned scratch folder and carries no report.
- **No Azure / Entra / SharePoint contact of any kind.** No portal, no App Service settings, no
  Entra registration, secret, permission or consent, no SharePoint anything, no `az`, no
  `Connect-MgGraph`. Absolute, and not approached. **No production data written.**

---

## FOR MARCO

One question, and it is the same one the last cycle asked - now with the measurement that makes it
concrete rather than predicted.

1. **The standing lanes still cannot satisfy their own two gates at once, and #2278 is now the
   worked example of the stalemate it produces (F40, F31).** A PR in the `instrument` or `sot` lane
   must carry a CP-26 receipt commit, and committing it moves the head past the `REVIEWED-SHA` that
   INSTRUMENT_LANE_V1 requires the verdict to match. **#2278 right now:** 15/15 green, unlabelled,
   receipted at 06:45:38Z, verdict MERGE for `05650340`, head `08883aff`, and the only commits in
   between are the receipt and two `Merge branch 'main'` commits that touch no reviewed file.
   Auto-merge is armed on it. It cannot complete because the branch is `BEHIND`, nothing updates a
   BEHIND branch any more, and no station may update a branch it is not about to merge - which no
   station may be, because condition 4 fails. **So it will sit green and armed and still, getting
   further behind with every board PR.** Complete-and-additive option FIRST: **make the anchor
   content-aware** - a verdict stays fresh while the only commits above `REVIEWED-SHA` are the PR's
   own receipt under `docs/decisions/merge-approvals/` and merges of `main` that add no diff outside
   the reviewed paths, both mechanically checkable with `git diff --numstat <REVIEWED-SHA>..<head>`.
   Immediate and permanent, CI-checkable, and a real code push above the reviewed SHA still
   invalidates the verdict. **(b) re-review after the receipt** works today but costs a second review
   cycle on every instrument and sot PR forever. **(c) drop condition 4 for the standing lanes** is
   cheapest and **fails the no-damage half** - it is the only thing stopping a station merging a head
   nobody reviewed. The full addendum with all readings and the falsifying probe is in
   `docs/pr-prompts/needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`.
   **In the meantime, if you want #2278 in, the one-move release is to say so and let the next
   scheduled run merge it with a personal receipt** - the way you released #2261 at 02:47Z, which
   worked cleanly and is the precedent this run would follow.

And one thing closed without being asked: **last cycle's F37 and F38 are both ACTIONED in this PR**
(F39 and WHAT CHANGED item 4). The CRLF rule F37 wanted written down turned out to be already in
the REFERENCE, in a stronger form than F37 proposed - and the reason F37 could not find it is the
broken pointer this PR repairs. Your Codex question from the 0714 cycle is unchanged and still open.
