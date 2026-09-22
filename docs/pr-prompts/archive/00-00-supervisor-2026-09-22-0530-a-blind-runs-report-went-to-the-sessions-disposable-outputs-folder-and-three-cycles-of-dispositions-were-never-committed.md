# Station 00 — Supervisor | 2026-09-22T05:14:36Z–2026-09-22T06:0xZ

## GROUND

```
UTC            2026-09-22T05:14:36Z
origin/main    cf8c87ac              (fetched, then rev-parse)
dev tree       main @ ef00df7c  C:\ProjectOperations2   — 0 ahead, 2 BEHIND at run start
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)  → MATCH, full authority
```

Read in the **dev tree**, per PREFLIGHT. The tree was 2 behind, so PREFLIGHT step 2's *"never the
working copy"* was at risk and was discharged by the sound form, never a piped hash (§9.1):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY on all three**. So every quotation below is a
statement about `origin/main`.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] Desktop Commander tool ids loaded by keyword `ToolSearch`
FIRST, per PREFLIGHT, so no validation error could be mistaken for blindness. `start_process`,
shell `powershell.exe`, PID 6644, first call: `2026-09-22T05:14:36.9286351+10:00` · `main` ·
`ef00df7c`.

**Device-bridge git guard — INSTALLED, PASS.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, last two lines verbatim:

```
vm-git-guard installed at /sessions/charming-epic-galileo/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

That is the **post-`#2065`** behaviour — the guard now certifies itself with live controls rather
than while inert, which is the defect `#2065` merged at 02:58Z to fix. No VM-side `git` was run
against the mount at any point in this run.

**Sweep, twice, and the verdict is real.** [MEASURED] `bring-up-to-speed.ps1` at 05:15:18Z and
`status-sweep.ps1` again at **05:19:30Z** immediately before the first mutation, because the verdict
expires the moment it prints. Section 0 positive controls both `[LIVE]`. Safe-to-act gate at
05:19:30Z, quoted:

```
[LIVE] git index.lock  interactive/clone: False / False
[LIVE] git processes touching our trees (scoped): 0
[LIVE] no PR touched on GitHub in the last 2 min
```

No `index.lock` in either tree, so the stale-lock discrimination (byte size × age × git processes ×
`MERGE_HEAD`/rebase state) had nothing to discriminate.

**Board: ONE open PR, and it is parked by design, not red.** [MEASURED] `#2071`
(`feat/scopecards-s6-one-cutting-surface`), OPEN, `BLOCKED`, **13 pass / 2 fail**. The two reds are
one cause. Read from **column 3** of the CP-26 job log per §9.1's tab-column trap, never from the
pass/fail counts (`gh run view 35687977040 --job 106618777366 --log`, 224 lines), quoted verbatim:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
(escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` ⇒ **PARKED, not work** (§9.4). The same check runs twice — as the required check
and as a step inside `PR gates — diff checks` — which is why one cause shows as two reds. Its other
13 checks pass, including `tendering-e2e` (15m3s) and the web build. Only Marco removes the label.

**Every hourly occurrence fired — no cadence was lost.** [MEASURED] the session-directory
instrument, scanned for a directory of **any** name at that depth per the 2026-09-15 rename note,
with the rename's own falsifying probe run as a control:

| form | total | newest |
|---|---|---|
| **unfiltered** (the correct instrument) | **1609** | `2026-09-22T05:14:13Z  93ebdaec` |
| `-Filter 'local_*'` (the pre-rename form) | 1535 | `2026-09-15T23:01:20Z` |

The filtered form returns nothing after 2026-09-15T23:01:20Z, exactly as that note predicts, so the
rename holds and the unfiltered scan is the live instrument. 00's occurrences:
`23:14 · 00:14 · 01:14 · 02:14 · 03:14 · 04:14 · 05:14` — **unbroken hourly, no hole.**

**`lastRunAt` crossed against the newest breadcrumb, per station.** [MEASURED] scheduled-tasks MCP
(four enabled; `weekly-security-audit` still `enabled: false`, confirming
`STATION-CAPABILITIES.md` §1's falsifying probe):

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | `2026-09-22T05:14:13Z` (this run) | `03:15Z` | **04:14Z fired and did not report → F1** |
| `03` | `2026-09-21T23:02:53Z` | `23:04Z` | aligned ✅ |
| `04` | `2026-09-22T02:09:49Z` | `02:11Z` | aligned ✅ |
| `05` | `2026-09-21T14:10:40Z` | `14:11Z` | aligned ✅ |

⚠️ `check-breadcrumb.mjs --freshness` printed `CLEAN`, exit 0, `00 … 2.0h ago (cadence 2h) ok`. That
`ok` is the weaker statement `STATION-CAPABILITIES.md` §6 records: the instrument's `const CADENCE =`
map still holds `'00': 2` while the live cron is `5 * * * *`, so it cannot call 00 SILENT until three
consecutive hourly runs are missed. **The cross against `lastRunAt` is what found F1; `--freshness`
could not have.**

**Fresh needle minted this run, now SPENT** (§9.6 — a needle is spent the moment it lands in a
tracked file; do not reuse it): `zzQq00Needle` + `20260922T0530` → **0** files over
`needs-marco/*.md`. POSITIVE control over the same corpus, `Marco` → **54** files.

## WHAT CHANGED

**One board PR**, carrying three cycles of previously-unreported work plus this run's own. Built in a
**clean isolated worktree off `origin/main`** (`C:\po-wt\collect-0530` @ `cf8c87ac`,
`git status --porcelain` → 0 files at creation), never the dev tree, never the watcher clone. Torn
down at the end of the run.

Committed with a **pathspec**, per §9.2's shared-index rule and 04's explicit warning, after reading
`git diff --cached --name-status` → EMPTY.

| file | why | probe |
|---|---|---|
| `00-04-scanner-…-0211-…md` | 04's breadcrumb, untracked since 02:11Z | — |
| `00-00-supervisor-…-0214-…md` | untracked since 02:14Z; **carries the dispositions for all six of 04's findings** | — |
| `00-00-supervisor-…-0315-…md` | untracked since 03:16Z; the blind-run report that *did* reach the tracked path | — |
| this breadcrumb | this run | `check-breadcrumb.mjs` |
| `docs/pipeline/sweep-rotation.json` | 04's rotation advance, left dirty by its own instruction | `git diff --numstat origin/main` → `2 2` |
| `docs/pr-prompts/.arming-log.txt` | +1 line, **append-only superset** (`1 0`, zero deletions) | `git diff --numstat origin/main` → `1 0` |
| `docs/pr-prompts/pr-scopecards-s6-one-cutting-surface-HOLD.md` | **DELETED** — consumed by the watcher building `#2071` | `git diff --numstat origin/main` → `0 237` |

All three tracked changes were classified by `git diff --numstat origin/main -- <path>` and **never**
by `git status`, which on a tree 2 behind answers a question about `HEAD` (§9.2). The arming-log's
local-only line, quoted, is the S6 arm that produced `#2071`:

```
2026-09-22T02:13:25Z  ARMED  pr-scopecards-s6-one-cutting-surface  escalates=true
actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=19768
```

**An addendum under ITEM 2** of `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`,
which 04's F1 explicitly dispatched to this station. That file is **TRACKED**
(`git ls-files --error-unmatch` → exit 0; POSITIVE control `CLAUDE.md` → 0; NEGATIVE control, a
nonexistent path → 1) and byte-clean against `origin/main` (`--numstat` → EMPTY, i.e. 04's revert
took), so the addendum lands rather than being swallowed.

**Nothing armed** (`armed: 0` before and after). **Nothing merged but this run's own board PR.**
`#2071` untouched. No `sot/` edit. No Azure / Entra / SharePoint action. No production data.

## FINDINGS

### F1 — S2 — The 04:14Z run went blind, wrote its whole report into the Cowork session's **disposable `outputs` folder**, and reached nobody — on a false premise that the NO-DRIFT section explicitly refutes, while its own sibling blind run one hour earlier did it correctly. `BLIND_RUN_REPORT_WENT_TO_SESSION_OUTPUTS_V1`

The REPORT CONTRACT names two correct homes (*"inside your own run's PR"* or *"the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\`"*) and one forbidden one: *"**Never leave it in a disposable
worktree.** The worktree is torn down at the end of the run and the report dies with it, with no
error and no trace: a station that believes it reported is indistinguishable from one that did."*

**There is a third disposable location it does not name, and it is the working directory every
scheduled run starts in.** [MEASURED] 2026-09-22T05:2xZ, session `f48c5cff`
(`CreationTimeUtc 2026-09-22T04:14:12Z`), file listing by `LastWriteTimeUtc`:

| path | bytes | written |
|---|---|---|
| `…\f48c5cff\outputs\00-supervisor-2026-09-22-BLIND.md` | **3974** | `04:15:54Z` |
| `…\f48c5cff\.claude\projects\session\bace4551-….jsonl` | 880384 | `04:16:08Z` |

A complete, well-formed, correctly-dispositioned report — GROUND block, `[MEASURED]` provenance, the
verbatim `CONNECT_TIMEOUT` string, an ESCALATED disposition and a `## FOR MARCO` section — **at a
path no instrument in this pipeline reads.** The run then ended. Elapsed 04:14:12Z → 04:15:54Z, 102
seconds.

🔴 **Its stated reason is false, and the document that refutes it is the one it was reading.**
Quoted from the orphaned report:

> *"No breadcrumb was written into `C:\ProjectOperations2`. Committing one needs git, which I cannot
> run in the dev tree and must not run against the mount."*

`00-supervisor.md`'s **NO-DRIFT** section says the opposite in terms: *"Breadcrumbs, station notes
and scanner output are left UNTRACKED. **You do not commit them at all.**"* Committing is
`sweep-breadcrumbs.ps1`'s job, or the next board PR's. **A breadcrumb has never required git**, so
the premise that blocked the write was never true.

🔴 **POSITIVE CONTROL, and it is the whole finding: the correct behaviour was demonstrated on the
same station, on the same box, ONE HOUR EARLIER, under the same blindness.** [MEASURED] session
`bebac440` (`03:14:12Z`) wrote
`docs/pr-prompts/00-00-supervisor-2026-09-22-0315-blind-desktop-commander-connect-timeout-no-windows-shell-zero-board-coverage.md`,
**11,288 B at 03:16:47Z**, to the tracked path — through the native file tools, exactly as
`STATION-CAPABILITIES.md` §3's `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1` records (*"They are read-WRITE:
the same run wrote its own breadcrumb to `docs/pr-prompts/` through `Write`, which is how a blind run
leaves a report at a tracked path even though it cannot open the PR that tracks it"*). So this is a
**deviation, not a constraint** — the transport was available and proven.

🔴 **And the second half of its reasoning argues against the contract's own design.** It continues:
*"leaving an untracked file in a tree whose index is shared with other chats risks it being swept
into someone else's commit."* Being swept up **is the mechanism** — the contract says *"The
breadcrumb is untracked until the next board PR commits it — say so in your chat report so Station
00 sweeps it up."* A correct behaviour was read as a hazard and used to justify silence.

**The cost, precisely.** The blindness itself is already open and needs nothing from me —
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`, five recorded
occurrences, options A/B/C on file. What was lost is the **sample**: that file's own standing ask is
*"when a station reports blindness, check whether `Prisma-Local` failed in the same run"*, and the
04:14Z report carries exactly that pairing. ⚠️ **I did not append it to that escalation**, because
[MEASURED] `git ls-files --error-unmatch` on it → **exit 1, UNTRACKED** (POSITIVE control `CLAUDE.md`
→ 0; NEGATIVE control → 1). It is one of the 55 untracked of 61 that 04's F6 measured, so a write
there is swallowed — which is that finding working exactly as intended, in the other direction.
**This breadcrumb is the channel, and the occurrence is recorded here.**

**DISPOSITION: ACTIONED** — the orphaned report is recovered and its substance quoted above, so the
04:14Z cadence is no longer silent; and its one novel datum (the `Prisma-Local` pairing, sixth
occurrence) is on the tracked record. ⚠️ **The docs half is DEFERRED onto F5's queue, not dropped:**
the sentence that needs widening — *"Never leave it in a disposable worktree"* → *"…or in the
session's own `outputs` folder, which is disposable and is where your shell starts"* — sits inside
the **hash-gated `station-contract v3` canonical block**, so it cannot ship alone.

⚠️ **Falsifying probe: the two-session pair above.** Re-run the unfiltered session-directory scan on
any two consecutive blind 00 runs and look for a report under `…\<8-hex>\outputs\`. If a blind run's
report is ever absent from the session outputs folder **and** present at the tracked path, this
finding is spent.

### F2 — S2 — Three consecutive cycles of completed dispositions sat UNTRACKED, so 04's six findings had been correctly collected and had still reached nobody.

[MEASURED] `check-breadcrumb.mjs --freshness` at 05:1xZ: three of four depth-1 breadcrumbs carried
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it` — the 02:11Z (04), 02:14Z (00)
and 03:15Z (00) reports. The newest board PR on `origin/main` is `#2070` (02:12Z).

🔴 **The 02:14Z breadcrumb's F5 reads `COLLECT: Station 04's 02:11Z breadcrumb landed mid-run … and
all six of its findings are dispositioned here — DISPOSITION: ACTIONED`.** So the collect *happened*
and was complete. What did not happen is the commit, and a disposition nobody can read is
indistinguishable from a disposition nobody made. This is the REPORT CONTRACT's *"a station that
believes it reported is indistinguishable from one that did"* reached from the other side: the
report exists, at the right path, and is simply not on `main`.

**DISPOSITION: ACTIONED** — all three landed in this run's board PR, so 04's F1–F6 dispositions,
the 02:14Z run's five findings (including its ACTIONED `gh run rerun` on `#2059`, which subsequently
**merged** as `97880163`) and the 03:15Z blind run's escalation are now on `origin/main`. **04's six
findings are NOT re-dispositioned here** — they were correctly dispositioned at 02:14Z and
re-deciding them would be the double-action the station doc forbids.

### F3 — S3 — The dev tree was 2 commits behind, so the `status-sweep.ps1` this run executed was **pre-`#2059`** code, and its 4C section quoted a 22-day-old state summary that `#2059` merged specifically to refuse.

[MEASURED] `git rev-list --left-right --count HEAD...origin/main` → **`0  2`**. The two commits are
`97880163` (`#2059` — *"4C refuses to quote a state summary older than 3 days"*) and `cf8c87ac`
(`#2065` — the vm-git-guard fix). Both merged **after** `#2070`, which is why
`gh pr list --state merged --limit 4` does not show them: that list sorts by **creation**, so an
older PR merged later is invisible to it. `git log origin/main` is what found them.

The sweep run from the dev tree then printed
`[FILE] freshest station summary: queue-watch-state.md (08-31 20:26Z)` and quoted 14 lines of it —
a snapshot **22 days old**, which is exactly what `#2059`'s 3-day guard exists to suppress.

🔴 **The general shape is worth more than the instance: every `.ps1` a station runs is executed from
the dev tree's working copy, so a fix that merges is not in effect for any station until the dev
tree is fast-forwarded.** A run that merges an instrument repair and then reads that instrument in
the same run is reading the old one, and nothing warns.

**DISPOSITION: ACTIONED** — the dev tree was fast-forwarded to `origin/main` at the end of this run
(see WHAT CHANGED and the read-backs below), so the next station run executes post-`#2059`,
post-`#2065` code.

### F4 — S3 — Three separate findings now queue on the ONE hash-gated `station-contract v3` canonical block, and each has been deferred individually for the same reason.

The canonical block is byte-identical across all seven station docs and `lint-station.mjs` fails on
any edit without re-recording its hash, so a change must ship in all seven at once. Each of the
following was deferred **alone** as *"more than a collect run should carry"*:

| # | the change | deferred by | since |
|---|---|---|---|
| 1 | the post-merge FF-blocker rule belongs in the contract, not in 00's doc alone | `00-supervisor.md`'s own note | 2026-09-05 |
| 2 | `needs-marco/` is described as a uniformly gitignored sink; **6 of 61 files are TRACKED** | 04's F6, **DISPATCHED to 00** | 2026-09-22 |
| 3 | *"Never leave it in a disposable worktree"* omits the session `outputs` folder | F1, this run | 2026-09-22 |

🔴 **Three deferrals for one reason is no longer three deferrals; it is one piece of work that has
never been sized.** The marginal cost of the second and third items is near zero once the block is being
re-recorded at all — the hash re-record and the seven-file ship dominate, and they are paid once.

**DISPOSITION: DEFERRED** — deliberately, and for the last time on this reasoning. A canonical-block
edit botched at 05:5xZ breaks `lint-station.mjs` for every station doc simultaneously, and the board
is quiet (1 PR parked on Marco, 0 armed), so nothing is blocked by waiting one cadence. **What makes
it urgent, and it is now met:** a third item arriving on the same block. **The next collect run
should treat items 1–3 as a single named PR** — edit the block in all seven docs plus
`docs/pipeline/stations/_canonical-blocks.json`, re-record the hash, and gate on
`node scripts/pipeline/lint-station.mjs` exiting 0 before pushing. That is this finding's whole
content, and it is written here rather than in a fourth deferral note.

### F5 — S4 — `C:/po-wt/s6fix` is an orphaned worktree, 115 minutes old, and the authority to prune it is the one the last two runs bounced between 00 and 03.

[MEASURED] `status-sweep.ps1` §2 at 05:19:30Z:
`orphaned worktree (aborted run leftover -- investigate/prune): C:/po-wt/s6fix  5b6ab08c (detached
HEAD)  dirty=0 files  age=115 min`. `dirty=0`, so nothing is at risk in it. 04's 02:11Z run saw a
**different** worktree on the same slice (`C:/po-wt/s6ruling`) classified as *live*, so these are two
artefacts of the same S6 work an hour apart.

**DISPOSITION: DEFERRED** — `dirty=0` means no work can be lost, and the worktree-repair authority
question is already open on the record (`#2067`, *"the worktree repair bounced 00 to 03 and back in
one night, and no authority row owns it"*). Pruning it now, from the station that the open
escalation says may not own it, would add a third bounce to a question that needs an answer rather
than another precedent. **What would make it urgent:** `dirty` becoming non-zero, or its age
exceeding a full station cadence with a build in flight.

## WHAT I DID NOT DO

- **Did not touch `#2071`.** Its CP-26 verdict token is `[LABEL_PRESENT]` — parked by design, and
  **only Marco removes the label** (§9.4, and both merge gates in `STATION-CAPABILITIES.md` §5). I
  did not rerun its two reds, relabel it, or enable auto-merge. Three consecutive collect runs have
  historically listed such PRs "among the reds" as though they were work; this one does not.
- **Did not arm anything.** `armed: 0` at 05:15Z and at 05:19Z. With one PR open and parked, and the
  board's throughput constraint being Marco's merge queue rather than the arm rate, arming would
  lengthen the queue rather than shorten it.
- **Did not append to `needs-marco/station-00-blindness-…-2026-09-01.md`.** [MEASURED] UNTRACKED,
  with both controls — a write there is swallowed. F1 carries the occurrence instead.
- **Did not file a new escalation for the blindness.** It is already open with five occurrences and
  RULE 1 options; a second artifact asking the same question is how four identical one-clause
  `STOP-WATCHER` fixes went unlanded.
- **Did not re-disposition 04's six findings.** The 02:14Z run dispositioned them correctly; my job
  was to make that reach `main`, not to decide it again.
- **Did not edit the canonical block** (F4), **did not prune `C:/po-wt/s6fix`** (F5), **did not touch
  the watcher clone** (`dirty=4`, and `status-sweep.ps1`'s `dirty=` count is untracked-inclusive —
  §9.5 — so it is not the refusal signal its own sentence claims), and **did not restart the
  watcher** (RUNNING pid 9744, wrapper alive, 0 armed — an idle watcher with nothing armed is
  CORRECT, not wedged).
- **Did not edit `/sot/`** (Station 05's, CP-24), **did not commit to `main`**, and **did not
  hand-merge** — the board PR went through `Assert-SmokedOrEscalate` → `Merge-Pr`.
- **No Azure / Entra / SharePoint action of any kind.** No production data read or written.
- **Did not write to any of the five gitignored sinks.**
