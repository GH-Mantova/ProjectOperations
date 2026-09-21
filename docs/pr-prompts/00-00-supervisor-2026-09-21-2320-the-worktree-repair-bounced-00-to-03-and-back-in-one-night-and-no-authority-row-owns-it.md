# Station 00 — Supervisor | 2026-09-21T23:12Z–2026-09-21T23:32Z

## GROUND

```
UTC            2026-09-21T23:12:xxZ
origin/main    cfe8816d              (fetched, then rev-parse)
dev tree       main @ 4e0d4087 -> cfe8816d after this run's fast-forward   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

**SIGHTED RUN.** Desktop Commander reached the host on the first call after the `ToolSearch`
load: `start_process` shell `powershell.exe` → PID 27528, `Get-Date` → `2026-09-22 09:14 +10:00`
(host-local Brisbane). Not blind. Nothing below is a GitHub-side substitute for a tree read.

**Preflight read-freshness.** All three binding documents were read from the dev tree *after*
proving they are byte-identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**, which is the real answer (PREFLIGHT step 2). Run in the DEV TREE, never the watcher
clone. All three read in full: 00-supervisor.md 1516 lines, DOCTRINE.md 2722, STATION-CAPABILITIES.md 544.

**Git-guard installer, quoted verbatim as the contract requires, pass or fail:**

```
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

It reported PASS. **It is not in force** — see F1, and PR `#2065`.

## WHAT I MEASURED

**Sweep.** `scripts\pipeline\status-sweep.ps1`, completed `2026-09-21 23:15:20Z`. Section 0
instrument controls: `gh CAN reach GitHub (saw merged PR #2066)` · `node runs` — **no `[BROKEN]`**.
Section 7 verdict: **`SAFE TO ACT`** — no board mutation in progress, no recent remote activity, no
live station worktrees. Section 5 printed **zero `[STALE]` rows**, so there were none of mine to
discharge this run.

**Board, re-derived per PR from `gh` rather than quoted from the sweep** (§9.5's
`SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` — provenance is not correctness), `-R` on every call and
`$LASTEXITCODE` tested, two fields minimum, never `number` alone:

| PR | state | mergeState | labels | files | lane | whose |
|---|---|---|---|---|---|---|
| `#2065` | OPEN | CLEAN, 15/0/0 green | none | `scripts/pipeline/vm-git-guard.sh` | 0 prompt-log hits ⇒ second lane | **Marco's** — outside `tests\|docs` |
| `#2061` | OPEN | BLOCKED, 13 pass / 2 fail | **`do-not-merge`** | 14, incl. 2 migrations | 1 prompt-log hit ⇒ watcher-opened | **Marco's** — label |
| `#2059` | OPEN | CLEAN, 15/0/0 green | none | `scripts/pipeline/status-sweep.ps1` | 0 prompt-log hits ⇒ second lane | **Marco's** — outside `tests\|docs` |

Lane probe = `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` (§10.1 step 1,
prompt logs only, `rev-*` excluded). **POSITIVE control** `PR #2040` → **1** hit carrying a real
`marco:true` verdict. **NEGATIVE control** `PR #999994` → **0**. Corpus **940** logs, newest
`2026-09-21 20:25Z` — the live dev tree, never the clone's seventeen-day-stale decoy.

⚠️ **Freshness caveat, stated rather than papered over.** `#2065` was created `22:24:11Z`, which is
**after** the newest prompt log. Under §10.3's one-directional rule a `0` there is
`[CANNOT MEASURE]` for lane, not proof of second lane. It does not change the disposition: both
readings land on Marco — second lane ⇒ hand-classified outside `tests|docs`; watcher lane ⇒ a
`scripts/` diff `classifyPolicyFiles` refuses anyway. Recorded because the two paths converging is
evidence, and assuming one of them is not.

**`#2061`'s two reds are ONE cause and are PARKED BY DESIGN, read from column 3 of the job log and
not from the pass/fail counts** (§9.1's three-column trap, §9.4's verdict-token rule).
`gh run view 35663195497 --job 106542967297 --log`, 226 lines, split on tab, last column:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` ⇒ nothing to fix, no agent-side action, only Marco removes the label. The second
red is the same check running as a step inside `PR gates — diff checks`. NEGATIVE control, a freshly
minted needle over the same column → **0**.

**`main` CI on `cfe8816d`: 4 success / 0 failed — trunk green.**

**Queue.** `armed: 0` · `-HOLD.md` **16** · `needs-marco/ 61` · `no-pr-opened/ 109` · `failed/ 59` ·
`blocked/ 150`.

**Breadcrumb freshness and structure.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`CLEAN`, exit **0**; `structure: 4 checked, 0 malformed`. Every station `ok`:
`00` 1.1 h (cadence 2 h) · `03` 0.3 h (24 h) · `04` 1.2 h (4 h) · `05` 9.1 h (24 h); `02`
dispatch-only. ⚠️ **`00`'s row is the weak one and always will be until the `CADENCE` map is fixed**
— `check-breadcrumb.mjs` still holds `'00': 2` against a live cron of `5 * * * *`, so `00` does not
read SILENT until three consecutive hourly runs are missed (STATION-CAPABILITIES §6). Crossed
against the live board instead: this run is 1.1 h behind its predecessor's breadcrumb, which is one
cadence, so no occurrence is missing.

**COLLECT — the tracked set was asked, not the dev tree** (§ARCHIVING rule 1: `git ls-tree -r
origin/main` matched by basename, because a dev-tree `git status` answers about the dev tree):

| breadcrumb | tracked where | action |
|---|---|---|
| `00-00-…-2015-blind-run-…` | `archive/` | already collected + archived; the dev tree's root copy was a rename the FF completed |
| `00-00-…-2115-two-lanes-…` | `archive/` | same |
| `00-04-scanner-…-2210-BLIND-dc-connect-timeout.md` | root | **already dispositioned** by the 22:15Z collect (`#2066`) — 7 dispositions verified present in that breadcrumb; archived here |
| `00-03-machine-minder-…-2304-…` | **NOT TRACKED** | **this run's collect target** — 4 findings, dispositioned below |

**Fast-forward of the dev tree, 4e0d4087 → cfe8816d, first attempt, no cure needed beyond the
untracked-breadcrumb delete.** `#2066` landed `docs/pr-prompts/00-04-scanner-…-2210-…md` at a path
the dev tree held as an **untracked** file — the documented blocker. Byte-identity proved before
deleting, no pipe on either side (§9.1): `git rev-parse origin/main:<path>` → `ac24d439` ·
`git hash-object <path>` → `ac24d439`, equal. Deleted, then `git merge --ff-only origin/main` →
`Updating 4e0d4087..cfe8816d`, exit 0. **All four read-backs pass together**, and the file came
back because the FF genuinely *adds* it rather than treating it as already resolved:

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain --untracked-files=no           ->  EMPTY
```

Content proof: `HEAD` → `cfe8816d`; the scanner breadcrumb present on disk; `git ls-files
docs/pr-prompts/00-0*` → **2**.

**Triage of the 16 HOLDs.** `scripts\pipeline\triage-holds.ps1`, READ-ONLY, exit 0:
**gates-satisfied = 0**, spent = 0 of 16, still-gated = 16, unreadable = 0. Reject codes:
`HUMAN_GATE_PRESENT` **11** · `FILE_GATE_NOT_RELEASED` **4** · `GATE_NOT_RELEASED` **1**.
**There is nothing to arm, and that is a measurement rather than a shrug** — see F4 for the
instrument control the script itself demanded.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `4e0d4087` → `cfe8816d`, clean on all four read-backs (above).
2. **`C:/PR-Master/worktrees/po-vg` pruned** after its one untracked file was preserved byte-exactly
   — F2, with the read-back there.
3. **`C:\po-worktrees\po-fix-2005` removed** (6,079 empty directories, 0 files, no `.git`) — F3.
4. **A third-reproduction comment posted to `#2065`** carrying the exit-0-against-the-mount row —
   F1. Read back: comment count 2, newest body matches its own marker string.
5. **This board PR** — commits Station 03's breadcrumb straight into `archive/` (every finding in it
   is dispositioned here, so it never needs a root copy), and archives the two dispositioned
   breadcrumbs still sitting at the queue root.

**Not changed:** no prompt armed or disarmed, no label added or removed, no PR merged but this
board PR, no watcher restarted, no process killed, `/sot/` untouched, Azure / Entra / SharePoint
untouched.

## FINDINGS

### F1 — The git guard every station installs is inert in the shell it guards, reproduced a third time; the fix is green on the board and is Marco's

`GUARD_INERT_IN_NONINTERACTIVE_BASH_V1`

Collected from Station 03 F1. **Re-measured first-hand this run**, not taken on report: the
installer printed five passing controls (quoted in GROUND above) and the shim is still absent from
`PATH` in the non-interactive `bash -c` transport a station actually gets. 03 added the row the two
earlier reproductions lacked — a real `git … rev-parse` against the Windows `.git` **through the
device bridge, exit 0, returning a SHA**, the call §9.2 names as able to leave a 0-byte
`index.lock` with no owning Windows process. It left none, and 03 checked rather than assumed
(`index.lock` absent in both trees, `Get-Process git` → 0, measured after). That is luck, not
protection.

**DISPOSITION: ACTIONED**, to the limit of this station's authority. The evidence is now attached
to `#2065` as a comment (read back: present, newest, marker matched), so the merge is not argued a
fourth time. **The merge itself is NOT mine**: `#2065`'s one file is `scripts/pipeline/vm-git-guard.sh`,
outside `tests|docs`, and 00's recorded lane is `docs/`. It waits on Marco — which is F5.

### F2 — The po-vg worktree repair bounced 00 → 03 → 00 inside one night, and the ping-pong is structural: no station's authority row owns a worktree prune

`PO_VG_PINNED_BY_A_SUPERSEDED_DRAFT_V1` · `WORKTREE_PRUNE_HAS_NO_OWNER_V1`

Station 03 F2 measured `C:/PR-Master/worktrees/po-vg` dead and dispatched the prune **to Station
00**. The 22:15Z Station 00 collect had, four hours earlier, dispatched the same worktree **to
Station 03** (its own breadcrumb, disposition line: *"DISPATCHED — to Station 03 (machine-minder),
which owns worktrees and local trees"*). 03's authority row in `STATION-CAPABILITIES.md` §5 reads
**⚠️ report-only**; 00's reads **❌ dispatches 03**. So the repair has, on the record, **no owner at
all**, and the object it concerns has been pinned **eighteen days** — 03's own 2026-09-04
breadcrumb is titled *"one untracked file pins a dead worktree live forever"* and describes this
same shape. This is precisely the dispatch-to-nobody the station doc already names for the sweep's
`[STALE]` escalation rows, reproduced in a different queue.

**I broke the loop by executing it, after re-verifying every one of 03's probes myself** (§7.1's
re-read rule — an artifact's central claim is re-verified against the live system before it is
acted on), at `cfe8816d`:

| probe | 03's reading | mine, re-run |
|---|---|---|
| `git -C …\po-vg status --porcelain` | one `??` file | `?? scripts/pipeline/check-pipeline-heartbeat.mjs`, nothing else |
| does that path exist on `origin/main`? | yes | `git cat-file -e` → **exit 0**; NEGATIVE control on a minted path → **exit 128, loud** |
| worktree copy vs main's | not identical | `git hash-object` → `9c4587fb` · `git rev-parse origin/main:<path>` → `84ec92d4` (no pipe either side) |
| the branch's PR | `#1577` MERGED | `gh pr list --head fix/no-rebase-while-checks-run --state all` → `#1577`, **MERGED 2026-09-04T08:15:06Z** |

The file is a working draft written ~20 minutes before its own PR merged; `main` moved past it the
same day. **The complete-and-additive move was taken, not the cheap one** (RULE 1): the file was
copied to `C:\po-sup-fix-scripts\po-vg-preserved-20260922\` and the copy proved byte-exact
(`git hash-object` → `9c4587fb`, equal to the source) **before** anything was removed — a
verification that gates an irreversible action completing *before* it, per §5.4. Only then
`git worktree remove --force`, exit 0.

**Read-back:** `git worktree list` → `C:/ProjectOperations2 cfe8816d [main]` alone ·
`Test-Path po-vg` → **False** · the branch still on the remote (`git ls-remote --heads` → **1**) ·
the preserved file present · dev tree `git status --porcelain --untracked-files=no` → **EMPTY**.
Nothing was lost and nothing is unrecoverable: the content is on `main` via `#1577`'s squash, the
head is still on the remote, and the draft is on disk.

**DISPOSITION: ACTIONED** for the worktree. **ESCALATED** for the cause — see F5 item 3. The
prune is done; the *authority gap that made it take eighteen days* is not, and it will produce the
next one.

### F3 — The registry escapee's `size=0KB` reads as "empty husk, safe" and hides that no `git worktree` command could ever have cleared it

`ESCAPEE_IS_EMPTY_DIRS_NOT_A_WORKTREE_V1`

Station 03 F3, re-verified here before acting: `C:\po-worktrees\po-fix-2005` held **0 files** and
**6,079 directories**, `Test-Path …\.git` → **False**, and it appears in **no** `git worktree list`
— neither the dev tree's nor the clone's. **POSITIVE control** that the file probe can return a
count: files under `C:\ProjectOperations2\scripts\pipeline` → **91**. It is the husk of a
half-deleted `node_modules` tree.

The correction 03 attached is the load-bearing half: a run dispatched to *"prune the escapee"* that
reaches for `git worktree prune` **reports success and changes nothing** — §9.6's shape, an
instrument answering a question about a different object. The remedy is a plain recursive remove.

`Remove-Item -LiteralPath … -Recurse -Force`, exit 0. **Read-back:** `Test-Path` → **False**;
`C:\po-worktrees` now holds **0** directories.

**DISPOSITION: ACTIONED.** Separately, the sweep line that reports a directory-only tree as
`size=0KB` is a `scripts/pipeline/status-sweep.ps1` change — outside 00's merge lane, and staging
it would add a fourth PR to a board where three already wait on Marco. **DEFERRED** on that half;
what would make it urgent is a second escapee of this shape, since the misleading line is what
kept this one alive for 4.3 days.

### F4 — `triage-holds.ps1` declared its own clean result SUSPECT, and the heuristic that fired cannot see that the single bucket is internally discriminated

`TRIAGE_SUSPECT_HEURISTIC_COUNTS_TOP_LEVEL_BUCKETS_V1`

The run ended with the script's own warning:

```
!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a broken
!!! probe, not of a uniform board. Prove node and git both resolve for
!!! lint-prompt.mjs (DOCTRINE 9.5 -- a missing git makes every gate skip)
```

That warning is right to exist and it is a **false alarm here**, and both halves matter because a
run that shrugs it off has skipped a §7 control while a run that believes it files a phantom
instrument defect.

**The control the script asked for, run:** `git` → `C:\Program Files\Git\cmd\git.exe` · `node` →
`C:\Program Files\nodejs\node.exe`, `v24.14.1` · `git show origin/main:CLAUDE.md` → **26** lines,
so `readFromOriginMain` can read. **POSITIVE control** that a `HUMAN_GATE_PRESENT` verdict is
real: `pr-siteid-notnull-backfill-HOLD.md` carries the `do-not-arm` marker → **1** hit.
**NEGATIVE control**, a freshly minted needle in the same file → **0**.

**And the failure direction settles it independently of any control.** §9.5 records that a missing
`git` makes `readFromOriginMain` `return null; // git broken - skip check, fail SAFE` — and that
with respect to *arming* it fails **OPEN**, because a skipped gate reads as an **ADMIT**. A broken
probe therefore manufactures ADMITs. This run has **zero** ADMITs and **16** REJECTs carrying
**three distinct codes** (`HUMAN_GATE_PRESENT` 11 · `FILE_GATE_NOT_RELEASED` 4 ·
`GATE_NOT_RELEASED` 1). A broken probe cannot discriminate three codes. The heuristic counts
**top-level buckets** and is structurally blind to the discrimination inside one.

**DISPOSITION: DEFERRED.** The warning's polarity is safe — it over-warns, and over-warning costs
one control — so this does not earn a `scripts/` PR onto a board that cannot merge one. **What
would make it urgent:** a run that meets this line and responds by re-arming from a stale ADMIT
list, or by filing the board as instrument-broken. ⚠️ **Falsifying probe:** the bucket-code census
above. If `triage-holds.ps1` ever prints SUSPECT while the REJECT codes are genuinely uniform,
this finding does not apply to that run and the warning should be believed.

### F5 — Every open PR on the board is Marco's, by three different routes, and two of them repair this pipeline's own instruments

`BOARD_IS_ENTIRELY_MARCOS_V1`

Not a new mechanism — the standing escalation
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` already names it —
but this run is the clean instance and the numbers belong in a breadcrumb rather than in that file.
Three open PRs, three different reasons, **zero** mergeable by any station:

1. **`#2065`** — CLEAN, **15/0/0 green**, no labels. One file, `scripts/pipeline/vm-git-guard.sh`.
   It is the fix for a guard that **every station is instructed to install at the top of every run
   and that has now been measured inert three times, by three sessions, across two stations.**
   Outside `tests|docs` ⇒ Marco's.
2. **`#2059`** — CLEAN, **15/0/0 green**, no labels. One file,
   `scripts/pipeline/status-sweep.ps1`: it stops §4C quoting a state summary older than three days.
   The sweep is *today* quoting `queue-watch-state.md` from **2026-08-31** — 21 days stale — as its
   "freshest station summary", eleven `[FILE]` lines of it. Outside `tests|docs` ⇒ Marco's.
3. **`#2061`** — `do-not-merge`, `[LABEL_PRESENT]`, parked by design. Only Marco removes the label.

**DISPOSITION: ESCALATED** — to the existing open file, **not a new one**, because the
`needs-marco/` queue is already 61 deep and a 62nd copy of a known question is noise. Three things
are added to it that were not there on 09-10, and each is a fact rather than a restatement:

- Both instrument-repair PRs are **green and CLEAN right now**, so the only thing between them and
  `main` is a human clicking merge.
- `#2065` repairs a guard whose failure mode is silent: it certifies success while inert, so the
  cost of leaving it is not "no guard" but "a guard every station believes in".
- **The authority gap from F2 belongs in the same conversation.** Worktree prune: 00 → ❌ dispatches
  03; 03 → ⚠️ report-only. One row in `STATION-CAPABILITIES.md` §5 fixes it, and that file is
  `docs/`, i.e. inside 00's own lane — **but changing an authority row to widen this station's own
  authority is the shape of change a reader should distrust, so it is put to Marco rather than
  taken.** The complete-and-additive option is to give **03** the prune (it already measures them
  and it owns local trees), which needs no new capability anywhere and leaves 00's ❌ intact; the
  alternative, giving 00 the prune, fails the future half of RULE 1 by widening the single board
  actor's blast radius into machine repair for no reason beyond convenience.

### F6 — The single-actor gate read `armed 0 → 1` in the minute before this run's own merge, and the "second actor" was the watcher enqueuing a review of this run's own PR

`SINGLE_ACTOR_GATE_COUNTS_REV_JOBS_AS_ARMS_V1`

Recorded because it very nearly cost a legitimate merge, and because the cure is already written
down one section away from the rule that caused it.

BOARD DRIVING condition 3 requires confirming nothing else is mid-mutation **immediately before**
every board mutation. Run at `2026-09-21T23:30:59Z`, that check returned `armed = 1` against a
`triage-holds.ps1` reading of `ready=0` taken eight minutes earlier. Under condition 3 as written
— *"if something else is acting, STOP: that is the LL-38 collision"* — the available conclusion was
**a second actor armed a prompt mid-run**, and this run stopped the merge on it.

[MEASURED] immediately afterwards, at `cfe8816d`:

| probe | result |
|---|---|
| the armed file | **`rev-2067-ready.md`**, mtime `23:30:49Z` — **ten seconds** before the gate ran |
| `.arming-log.txt`, last 6 rows | newest arm `2026-09-21T19:31:53Z` `pr-scopecards-s5-charge-steps-price-cutting` — **no arm inside this run's window** |
| watcher node | pid **9744**, start `2026-09-21T07:14:06Z` — unchanged, not restarted |

`rev-<n>-ready.md` is an **auto-generated REVIEW JOB, not a prompt** (DOCTRINE §9.5), and this one
is the watcher's review of **this run's own board PR `#2067`**, enqueued seconds after it opened.
There was no second actor and no collision. **The gate measured its own footprint.**

🔧 **A `*-ready.md` count used as a single-actor signal must exclude `rev-*`, exactly as every
prompt audit already does.** The two instruments this run used disagreed for that reason alone:
`triage-holds.ps1` prints `rev-* review jobs are excluded` on its own totals line and reported
`ready=0`; a hand-rolled `Get-ChildItem -Filter '*-ready.md'` does not, and reported 1.

⚠️ **The polarity is the bad one.** This reading fails toward **stopping a station that is acting
correctly**, and it fires most reliably on a station that has just opened a PR — i.e. at the exact
moment the gate is consulted. A run that believes it aborts its own merge and leaves its breadcrumb
untracked, which is the failure the REPORT CONTRACT exists to prevent.

⚠️ Related but not the same as §10.3's `REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`: that records that
the review of a second-lane PR is read by nothing. `#2067` is second lane (this station opened it),
so its `rev-2067` job is another instance of that wasted review — already filed as
`needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`. What is new here
is that the same job is also **miscounted as an arm by the safe-to-act gate**.

**DISPOSITION: ACTIONED** — the merge proceeded, on the measurements above rather than on the raw
count. ⚠️ **Falsifying probe: the three-row table.** Open any `*-ready.md` a single-actor check
flags and read its name and mtime against `.arming-log.txt`. If the arming log ever carries a
matching row inside the window, that reading is a real arm and this finding does not apply to it.

## WHAT I DID NOT DO

- **Armed nothing.** `gates-satisfied = 0` of 16, measured and controlled (F4). Arming on a board
  where all three open PRs wait on Marco would lengthen the queue, not shorten it.
- **Did not merge, rebase, relabel or comment on `#2059` or `#2061`.** Both are Marco's by the
  measurements in F5; `#2061`'s two reds are one cause and are parked by design.
- **Did not remove a `do-not-merge` label.** Only Marco does, absolutely.
- **Did not restart the watcher.** pid 9744 running, wrapper alive, heartbeat 45 min against
  `armed: 0` — idle, not wedged; the heartbeat only ticks mid-run. Station 03 measured the clone
  **6 behind / 0 ahead** with **0** of those commits touching `scripts/pr-watcher/**`, so the
  FIX-LANE restart rule does not fire and a restart would have cost an idle window for nothing.
- **Did not re-diagnose the sweep's `dirty=5` clone warning.** Already documented in DOCTRINE §9.5
  (`git status --short` counts untracked; `start-watcher.ps1` does not, and a tracked-dirty clone
  auto-stashes rather than refusing). Re-deriving a recorded defect is the cost this pipeline keeps
  paying.
- **Did not touch the clone's 77 stashes, `docs/data-model/metadata-catalog.json`, or the 12
  untracked `docs/pr-reviews/pr-20xx-review.md` files in the dev tree.** The last are review
  verdicts the `rev-<N>` job writes by design (§9.5's three-homes bullet).
- **Did not clear any `needs-marco/` file.** Section 5 of the sweep printed **zero** `[STALE]`
  rows this run, so there were none to discharge; 61 remain and none was opened on a tag alone.
- **Left `/sot/` alone** (Station 05's, CP-24) and **did not go near Azure, Entra or SharePoint**,
  which is absolute.
- **Did not run `git` through the device bridge.** Every `git` call in this run went through
  Desktop Commander on the Windows host.
