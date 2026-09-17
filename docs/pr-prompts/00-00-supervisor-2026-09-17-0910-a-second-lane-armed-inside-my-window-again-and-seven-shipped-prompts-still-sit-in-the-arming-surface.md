# Station 00 - Supervisor | 2026-09-17T09:10Z-2026-09-17T09:4xZ

## GROUND

```
UTC            2026-09-17T09:10:11Z
origin/main    c084027b            (= PR #1995, merged 09:04Z by the other lane)
dev tree       main @ c084027b      C:\ProjectOperations2   (0 ahead, 0 behind at preflight)
doc version    1        (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1        (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run is SIGHTED: Desktop Commander answered after the
schema load, shell PID 16244, `powershell.exe` on the Windows host. Not a blind run.

The three binding documents were read in full from the working copy, which PREFLIGHT step 2 permits
only once it is proved equal to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **EMPTY**. No piped hash was used anywhere (PREFLIGHT step 2's `powershell.exe` unsoundness).

## WHAT I MEASURED

**Device-bridge git guard.** Installed first, before any VM-side call. Last line quoted verbatim,
as the contract requires: [MEASURED]

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS, exit 0. Its known non-interactive-shell bypass (Station 05 09-16 F1, Station 04 09-17 F2) is
ESCALATED and unresolved; nothing in this run relied on the guard, because every `git` call ran on
the Windows host through Desktop Commander and never through the bridge.

**`status-sweep.ps1`, section 7 verdict, verbatim.** [MEASURED] captured with `*>` and decoded
`utf16le` in node per DOCTRINE section 9.3, 422 lines:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 instrument positive controls both passed (`gh CAN reach GitHub (saw merged PR #1997)`,
`node runs`). **Section 5 printed ZERO rows of any kind this run** - not one `[STALE]` escalation and
not the two `[FILE]` rows the 08:09Z run met, so there was nothing on that line to clear or to refuse.

**Board, live.** [MEASURED]

```
#1998  do-not-merge  BEHIND  feat(crm): S5 - Follow-ups on the s7 kit (CRM_PARITY_FOLLOWUPS_V1)
       head fc76a707  created 2026-09-17T09:05:20Z  files: 3, all apps/web/src/pages/crm/**
main CI on c084027b: 1 success / 0 failed / 3 running   (no failure so far; not yet green)
armed *-ready.md at depth 1: 1   (rev-1998-ready.md at 09:10Z; see F2 for what replaced it)
```

**Mount enumeration.** [MEASURED] `/sessions/<id>/mnt/` holds **four** entries this session -
`ProjectOperations2`, `PR-Master`, `outputs`, `uploads`. `po-watcher` is **NOT** mounted, so
`STATION-CAPABILITIES.md` section 3's `BLIND_RUN_OTHER_MOUNTS_V1` eleven-mount reading does not
describe this session. It did not cost anything here because the run is sighted and Desktop Commander
is not restricted by the mapping, but a blind run in this session shape could not have reached
`verdicts-archive` at all.

**The sweep's `watcher clone: branch=main dirty=1` warning is the known false one, re-derived from
its own source in the same minute** per DOCTRINE section 9.5: [MEASURED]

```
git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no  -> 0   (tracked-dirty)
git -C C:\po-watcher\ProjectOperations status --short                           -> 2
   ?? docs/pr-reviews/pr-1998-review.md              <- the rev- lane's own output, by design
   ?? scripts/pr-watcher/.conflict-notified-prs.json
```

Tracked-dirty is **0**, and `start-watcher.ps1` ignores untracked files, so the *"the watcher may
refuse to start"* clause does not apply. This is the fourth consecutive run to re-derive it and it is
already filed as a `status-sweep.ps1` defect; **not re-filed here.** Worth one line only because one
of the two untracked files is the review verdict for the single open PR.

**Breadcrumb freshness, crossed against `lastRunAt`.** [MEASURED]

```
$ node scripts/pipeline/check-breadcrumb.mjs --freshness
  structure: 6 checked, 0 malformed, 0 skipped
  00  last 2026-09-17T08:38:00Z   0.6h ago  (cadence 2h)   ok
  02  dispatch-only - no cadence to miss
  03  last 2026-09-16T23:02:00Z  10.2h ago  (cadence 24h)  ok
  04  last 2026-09-17T06:11:00Z   3.1h ago  (cadence 4h)   ok
  05  last 2026-09-16T14:11:00Z  19.1h ago  (cadence 24h)  ok
  CLEAN   exit 0
```

Crossed against `lastRunAt` from the scheduled-tasks MCP, which the breadcrumb instrument cannot see:
`00` 09:08:51Z (this run), `03` 2026-09-16T23:01:15Z, `04` 06:10:05Z, `05` 2026-09-16T14:11:02Z.
Every station's newest breadcrumb sits within ninety seconds of its own last fire, so **no station is
in the "fresh `lastRunAt`, no breadcrumb" row** and no transcript read was needed. Four enabled tasks;
`weekly-security-audit` is still `enabled: false`, unchanged since 2026-09-06 and already with Marco.

⚠️ The freshness line still reads `(cadence 2h)` for `00` against a live cron of `5 * * * *`. That is
`check-breadcrumb.mjs`'s own `CADENCE` map, already measured and filed for Marco
(`STATION-CAPABILITIES.md` section 6); **re-confirmed, not re-filed.** It is why the `lastRunAt`
cross-check above is the binding half of this step and not a formality.

**Watcher.** [MEASURED] From the sweep's live process reads, and cross-read against the queue state:

```
watcher node: RUNNING pid 30248        auto-restart wrapper: alive (2)
heartbeat age: 5 min                   .queue-state.json ts = 2026-09-17T09:15:25.346Z
git index.lock interactive/clone: False / False     git processes touching our trees: 0
```

The `ts` sample is inside the 5-minute `RESCAN_INTERVAL_MS` window, so the rescan loop is not frozen.
The `wrapper: alive (2)` count is the duplicate-launcher family Station 03 already holds
(09-16T23:02Z F1, re-measured by the 08:09Z run's F4); **not re-filed.**

**Worktrees.** [MEASURED] `git worktree list` returns **two**: the dev tree at `c084027b`, and
`C:/PR-Master/worktrees/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`, 13 days old, 1 dirty file.
The `sup-0003-*` worktree the 08:33Z addendum's A3 told Station 03 to **exclude** from pruning is
**gone** - that lane tore it down - so A3's exclusion clause is now moot and `po-vg` is the only
candidate left. Its content was measured by the 08:09Z run's F3 (a superseded earlier draft of
`check-pipeline-heartbeat.mjs`) and it remains DISPATCHED to 03.

## WHAT CHANGED

- **One board PR opened**, carrying exactly two files: this breadcrumb, and the one-row
  `DOCTRINE.md` section 10.2.1 addition the 08:33Z addendum's A4 explicitly left for the next run
  (F4). Both written inside the PR's own worktree - cure 1 of the station doc's fast-forward
  section - so no loose copy is left in the dev tree and no post-merge FF can be refused by one.
- **Nothing armed.** F2 is why: a second lane armed a prompt 122 seconds after this run's sweep read
  SAFE TO ACT, and BOARD DRIVING condition 3 is not satisfiable against an actor that acts in seconds.
  `.arming-log.txt` was not touched by this run and needs no re-append.
- **No prompt file moved, retired or renamed** - specifically not the seven SPENT prompts in F3.
- **`#1998` not touched**: not merged, not branch-updated, not labelled, not commented (F1).
- **No merge, no `/sot/` edit, no watcher action, no worktree pruned, no process killed.**

## FINDINGS

### F1 - `#1998` is a genuine watcher `marco:true`, its two reds are one cause, and both halves are parked by design

The board's only open PR reads as RED at 11 pass / 2 fail. Read as DOCTRINE section 9.4 requires -
the CP-26 **verdict token** from column 3 of the job log, never the pass/fail counts: [MEASURED]

```
$ gh run view 35203297712 -R <owner>/<repo> --job 105143025494 --log      (222 lines, split on TAB, last column)
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.
NEGATIVE control, a freshly minted needle over the same column -> 0

$ ... --job 105143025811 --log   (PR gates - diff checks, 215 lines)
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label ...]
POSITIVE control, PASS lines in the same column -> 7
```

`[LABEL_PRESENT]`, not `[RELEASED_NO_RECEIPT]`. The second red is the same check running as a step
inside the gates job, and **seven other gates in that job PASS** - so the two reds are one cause and
the cause is the label. The remaining thirteen checks are green; `tendering-e2e` was still running.

**Lane established before anything else, per section 10.1 step 1, and it is a routing rather than a
scrape.** [MEASURED] The prompt logs alone, `processed\pr-*.log`, `rev-*` excluded:

```
pr-crmvis-s5-followups-ready.md.log ::  "PR #1998 opened and left unmerged per standing authority"
pr-crmvis-s5-followups-ready.md.log ::  [watcher] merge result for PR #1998:
        {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
POSITIVE control  PR #1995 over the same corpus -> 2      NEGATIVE control  PR #999997 -> 0
newest prompt log 2026-09-17T09:13:09Z, younger than #1998's createdAt 09:05:20Z
```

The **same** log carries that prompt's own `opened PR #1998` line and the verdict for the **same**
number, which is exactly the cross-check `PRNUMBER_SCRAPED_FROM_PROSE_V1` demands before a verdict
may be believed. This is a real watcher routing, not a number scraped out of prose.

So every gate points one way: section 10.1 step 1 runs first and wins, `STATION-CAPABILITIES.md`
section 5 gate 1 says only Marco removes the label, and gate 2 says the routing is *"not overridden
by green, unlabelled, or a verified diff"*. **There is nothing here for any station to fix.**

I also left it `BEHIND` rather than running `gh pr update-branch`. The reason is the same one the
08:09Z run gave for `#1995`: updating restarts a 14-minute `tendering-e2e` on a PR no human has
looked at, and `c084027b` is a tendering UI change that cannot affect a CRM page diff. One
`gh pr update-branch 1998` does it whenever Marco wants it current.

**DISPOSITION: DEFERRED.** It is already with Marco by the only mechanism that puts it there. What
would make it urgent: the `do-not-merge` label removed and the PR then sitting green and untouched
for a full cadence - at that point it is a released PR nobody is driving, and the next run should say
so rather than inherit this deferral silently.

### F2 - The second lane armed a prompt 122 seconds after this run's sweep read SAFE TO ACT, and this is the first pair where the other lane's mutation is a QUEUE mutation

The 08:33Z addendum's A1 supplied the first timestamped pair for
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`:
a sweep reading at 08:24:54Z and the other lane's push to `#1995` at 08:26:58Z, **124 seconds** apart.
This run supplies a second, and it is a different class of mutation. [MEASURED]

```
09:10:11Z  status-sweep.ps1 section 7:  "SAFE TO ACT: no board mutation in progress,
                                         no recent remote activity, no live station worktrees"
09:12:13Z  docs/pr-prompts/.arming-log.txt:
           2026-09-17T09:12:13Z  ARMED  pr-queue-layout-s1-the-standard  escalates=false
             actor=station-00.interactive-0003  by=Marco@LAPTOP-E6NHU4E4  pid=12780  caller=powershell.exe:15364
```

**122 seconds.** The same log shows the same actor armed `pr-crmvis-s5-followups` at 08:48:33Z, which
is `#1998`, so the lane has armed twice in the 25 minutes around this run.

**Why the second pair is worth recording rather than being a duplicate of A1.** A1's mutation was a
push to a PR - visible to the sweep's section 3 *"no PR touched on GitHub in the last 2 min"* row,
which is a GitHub read with a two-minute window. This one is an **arm**: a `git mv` inside
`docs/pr-prompts/`, on the local disk, which that row cannot see **at all**, in either direction and
at any window width. Section 3's local signals are `index.lock`, scoped `git` processes and
in-progress prompts, and an arm completes in well under one sampling interval. So the two pairs are
not two samples of one phenomenon: **A1 shows the window is too wide, and this one shows there is no
window for a whole class of the other lane's mutations.**

The evidence that the queue changed under this run, rather than being inferred from the log alone:
[MEASURED] the sweep at 09:10:11Z listed `armed (*-ready.md): 1  ->  rev-1998-ready.md`, while
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` at 09:2xZ returns **one** file and it is a
**different** one, `pr-queue-layout-s1-the-standard-ready.md`. Its mtime is `2026-09-17T07:26:33Z`,
which dates its AUTHORSHIP and not its arming - DOCTRINE section 9.5, and the arming log above is the
only clock that answers.

**What it cost this run, stated plainly rather than left for a reader to infer:** nothing was armed
and no prompt file was moved (F3), because BOARD DRIVING condition 3 requires confirming nothing else
is mid-mutation and this measurement is a direct demonstration that the confirmation is not available
for queue mutations.

**DISPOSITION: DEFERRED - tracked in `needs-marco/`.** The escalation is open, it is Marco's, and
re-filing it is how this pipeline manufactures duplicates. What this adds is the class distinction
above, which that file does not have: it was written about PR-level collisions and the queue-level
case has no instrument at all. What would make it urgent: the two lanes arming **different** prompts
inside one watcher build window, or either lane moving a file the other has already staged - at that
point it is LL-38 rather than two actors running past each other.

### F3 - Seven prompts whose work has already SHIPPED are still sitting at depth 1 of the queue, inside the arming surface the other lane is choosing from

[MEASURED] `scripts/pipeline/triage-holds.ps1`, read-only, exit 0, both of its own instrument
controls passing first (`GIT control: PASS ... 201130 chars`; `SPENT control: PASS -- lint-prompt.mjs
emitted exit 3 on the fixture, so the SPENT bucket is measurable`):

```
=== queue triage -- 37 prompt(s) at depth 1: HOLD=36, ready=1, LOOPING=0   (rev-* excluded)
SPENT -- premise already satisfied, the work has SHIPPED (lint exit 3)     7
    pr-crmvis-s2-relationships-HOLD.md              pr-ratescol-s4-import-creates-columns-HOLD.md
    pr-crmvis-s3-account-360-HOLD.md                pr-scopecards-s1-operational-costs-priced-HOLD.md
    pr-crmvis-s4-register-HOLD.md                   pr-scopecards-s2a-quote-destination-api-HOLD.md
    pr-ratescol-s3-add-in-grid-HOLD.md
GATES SATISFIED (ADMIT) 3   STILL GATED (lint exit 1) 27   SPENT BEHIND A REJECT 0
POSSIBLE DUPLICATES OF AN OPEN PR: (none)   -- 1 open PR read from the board, 3 admitted prompts scanned
TOTALS  spent=7 of 37 evaluated   unreadable=0
```

The tool's own instruction for that bucket is *"Retire them to `docs/pr-prompts/superseded/` in a
board PR. Do NOT arm."* Retiring is a board mutation and therefore this station's lane. I did not do
it, and the reason is F2: a `git mv` of seven files out of `docs/pr-prompts/` is a mutation of the
exact directory the other lane armed from 122 seconds after my safe-to-act reading, and condition 3
cannot be satisfied against it. That is the LL-38 surface, not a hypothetical one.

**This is DEFERRED rather than ESCALATED because the work is genuinely not urgent, and that is
measured rather than assumed.** A SPENT prompt cannot be armed by accident: `lint-prompt.mjs` returns
**exit 3** on it, `arm-prompt.ps1` gates on the linter, and the triage run above reached that verdict
by actually executing each premise. The cost of the delay is therefore queue legibility - seven dead
files in a 37-file board that a human reads by eye - and not a risk of building shipped work twice.

**DISPOSITION: DEFERRED.** The list above is complete and every name is measured, so the next run that
finds the board genuinely single-actor can retire all seven in one `git mv` batch inside its own
worktree with no re-measurement. What would make it urgent: an eighth spent prompt appearing before
the seven are cleared, or `lint-prompt.mjs`'s exit-3 path regressing - at that point the linter is no
longer the guard this deferral rests on, and the retirement becomes the fix rather than the tidy-up.

### F4 - The sixth git-identity pairing is now a row in `DOCTRINE.md` section 10.2.1, which is what the 08:33Z addendum's A4 deferred to this run

A4 measured `station-00.interactive-0003 <marco@initialservices.net>` against a five-row table that
closes with *"The identity SET is state - re-measure it, never quote it; a sixth pairing is invisible
until it appears."* It had appeared, and A4 deliberately did not land it - *"not in the same run that
is already carrying two board PRs while a second supervisor is active on the board"* - and wrote the
row out for the next run to land in one edit. This is that run, and the row is landed verbatim in
intent.

The edit was made in node by **concatenation**, never `String.replace` with a replacement string
(DOCTRINE section 9.3's `$`-substitution trap), and the read-back is the byte delta rather than a
presence check, because a presence check cannot see what a replacement spills: [MEASURED]

```
anchor occurrences before edit     1   (aborts on anything but exactly 1)
before_bytes 201130   after_bytes 201507   actual_delta 377   expected_delta 377   BYTE_DELTA_ASSERT=PASS
new_row_present 1     anchor_still_present 1
line_count  2546 -> 2547     eol detected "\r\n", matched to its neighbours
```

The row sits in section 10.2.1, **outside** the `instruments v2` canonical block (which ends at the
`END-CANONICAL-BLOCK` marker well above it), so `lint-station.mjs`'s hash gate is not involved and
this is an ordinary docs edit inside 00's lane.

**DISPOSITION: ACTIONED.** Read-back is the assertion block above plus this PR's own diff, which is a
**one-line insertion** and nothing else. The falsifying probe is unchanged and inherited from the
block it extends: re-read the authoring identity of any commit by that lane; if it ever authors as
`PR Supervisor <supervisor@local>` or as the watcher clone's identity, the new row is wrong and must
be re-measured.

## COLLECT-LEDGER

Every breadcrumb at depth 1 of `docs/pr-prompts` is tracked on `main` (`git ls-files` matched all six
by basename, so the dev-tree `git status` view was not used for this - DOCTRINE section 9.5's
de-duplication rule). Five of the six were dispositioned by the 07:08Z and 08:09Z runs. One is new
since the last collect, and it is this station's own addendum.

| Source breadcrumb | Finding | Disposition this run |
|---|---|---|
| 00 - 09-17 08:33 (addendum) | A1 the safe-to-act gate read clear 124 s before the other lane pushed to `#1995` | **DEFERRED, unchanged** - and F2 above attaches a second pair to the same open escalation, this one a queue mutation the gate has no row for at all |
| | A2 `#1995` released and driven by lane 0003; not mine, on two independent grounds | **ACTIONED - closed by the board.** `#1995` MERGED 2026-09-17T09:04Z and is `origin/main` at `c084027b`, this run's own preflight SHA. The deferral's stated trigger (*"still open and released with no further activity for a full cadence"*) can no longer fire |
| | A3 the sweep reports a LIVE lane's worktree as an orphan; `sup-0003-*` must not be pruned | **DISPATCHED -> Station 03, narrowed again.** `git worktree list` now returns two entries and `sup-0003-*` is **gone**, so the exclusion clause is moot and `po-vg` is the single remaining candidate, with its content already measured by the 08:09Z F3 |
| | A4 a sixth git-identity pairing exists and the section 10.2.1 table has five rows | **ACTIONED** - landed this run, see F4 |

## WHAT I DID NOT DO

- **Did not arm anything, and did not retire the seven SPENT prompts.** F2 and F3 give the measured
  reason: the other lane armed from that directory 122 seconds after my safe-to-act reading, and
  condition 3's confirmation does not exist for queue mutations. The seven are listed by name so the
  next single-actor run needs no re-measurement.
- **Did not merge, update, label or comment on `#1998`.** Its CP-26 token is `[LABEL_PRESENT]` and
  its watcher verdict is a genuine `marco:true`; both say the same thing and only Marco moves it.
- **Did not prune `po-vg`, did not kill the second launcher family, did not touch the watcher.**
  All three are Station 03's lane, all three are already dispatched with their measurements, and
  `restart-watcher-if-wedged.ps1`'s sanctioned verdict is not in play - nothing here licenses action
  from me.
- **Did not re-file four findings that reproduced here and belong to someone else already:** the
  `status-sweep.ps1` clone-dirty false warning, `check-breadcrumb.mjs`'s `'00': 2` cadence row, the
  duplicate launcher family, and the git guard's non-interactive PATH bypass.
- **Did not edit any file outside `docs/`.** `new-worktree.ps1` and `status-sweep.ps1` both still
  carry the defects the 08:09Z run escalated (F2 and F6 there); `scripts/` is outside this station's
  merge lane and re-escalating them would add noise to an open ask rather than signal.
- **Did not touch `/sot/`, source, any prompt file, any label, or the arming log.**
- **Did not run `git` through the device bridge.** Every `git` and `gh` call ran on the Windows host
  through Desktop Commander.
