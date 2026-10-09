# Station 00 — Supervisor | 2026-10-07T00:14Z–2026-10-07T00:3xZ

## GROUND

```
UTC            2026-10-07T00:14:47Z
origin/main    f88f8e37            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ f88f8e37     C:\ProjectOperations2  (== origin/main; 25 dirty paths, all untracked/CRLF noise)
doc version    1                   (docs/pipeline/stations/00-supervisor.md, read via git show origin/main:<path>)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE (1 == 1)** — no read-only clamp. **This run was SIGHTED**: Desktop
Commander loaded and `start_process` opened `powershell.exe` on the host at the first attempt, so no
retry was needed and no blindness is claimed.

Mutations were made in an isolated worktree off `origin/main`: `C:\po-wt\sup-0014`, branch
`board/collect-0014-retire-answered-escalations`, created clean at `f88f8e37`, `DIRTY=0` at creation.

## WHAT I MEASURED

**[MEASURED] The git guard installed INERT — exit code read from the installer, not from a pipeline.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → `EXIT=2`. Last line verbatim:

```
   PATH="/sessions/youthful-intelligent-heisenberg/.local/bin:$PATH" git <args>
```

Exit 2 is the EXPECTED station outcome (`INSTALLED BUT INERT`): the shim is byte-correct and off
`PATH` for a non-interactive non-login shell. **The ban was therefore remembered, not mechanical, and
it was kept** — every `git` and `gh` call in this run ran in `powershell.exe` on the Windows host
through Desktop Commander. No `git` was run against any mount, shimmed or otherwise.

**[MEASURED] `status-sweep.ps1` at 00:15:22Z.** Section 0 positive controls both pass (`gh` reached
GitHub and saw merged #2254; `node` runs). Section 7 verdict: `SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees.` Section 3: `index.lock
interactive/clone: False / False`, scoped git processes `0`, `board lease: free`, `no build in flight
(newest tick is 103.4 min old)`.

**[MEASURED] The board is empty on both axes.** `OPEN PRs: 0` · `WAITING ON MARCO: 0 open PR(s)
labelled do-not-merge` · `ALL OPEN (non-draft): 0` · `armed (*-ready.md): 0` · `main CI on f88f8e37:
4 success / 0 failed / 0 running (trunk green)`. Both MARCO_QUEUE_LINE_V1 figures are **zero** —
recorded here as the arming evidence that line exists for.

**[MEASURED] Freshness, exit 2.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
`structure: 10 checked, 0 malformed`; `00 … 1.0h ago ok` · `02 dispatch-only` · `03 … 1.2h ago ok` ·
`04 … 2.1h ago ok` · `05 last 2026-09-24T14:23:00Z 297.9h ago MISSED`; `MISSED: 1 station(s)`.

**[MEASURED] `list_scheduled_tasks` crossed against the above.** Four enabled tasks (not five —
`weekly-security-audit` is `enabled: false`, `lastRunAt 2026-09-06T21:32:44Z`, as
STATION-CAPABILITIES §1's 2026-09-15 correction records). `lastRunAt`: `00` 2026-10-07T00:14:02Z
(this run) · `03` 2026-10-06T23:02:55Z · `04` 2026-10-06T22:09:40Z · `05` **2026-09-27T21:38:18Z**.
`05`'s `nextRunAt` is **2026-10-07T14:22:37Z**, cron `10 0 * * *`.

**[MEASURED] The watcher is up and the crash loop has stopped.** `watcher node: RUNNING pid 39052`,
`auto-restart wrapper: alive (1)`. `Get-Process -Id 39052` → `StartTime 2026-10-06 17:52:53` local,
**UpMin 986** (~16.4 h). Newest `WATCHER-CRASH-LOOP-*` snapshot is `2026-10-06-061418.md`,
`LastWriteTimeUtc 2026-10-05T20:14:25Z` — **nothing new in ~28 h.**

**[MEASURED] Sweep section 5 produced ZERO `[STALE]` rows.** Every one of the 55 `needs-marco/` rows
came back either `cites #N (MERGED) as evidence -- not its premise; does not clear the escalation` /
`section 5 CANNOT decide` or `(no PR ref … read it as a SNAPSHOT)`. **No retirement was authorised on
the sweep's own evidence.** The three retired below were retired on independently measured Marco
rulings instead, not on a `[STALE]` tag.

**[MEASURED] #2248 and #2249, asked individually** (never a LIST response's `merged` field —
DOCTRINE §9.4): `#2248 MERGED 2026-10-06T07:33:54Z` *feat(pipeline): instrument lane — Station 00 may
merge narrow instrument fixes (INSTRUMENT_LANE_V1)*; `#2249 MERGED 2026-10-06T07:48:10Z`
*feat(watcher): retire tests-docs auto-merge lane (RETIRE_TESTS_DOCS_LANE_V1)*.

**[MEASURED] The tests-docs lane is OFF BY DEFAULT on `origin/main`.**
`git grep -n AUTO_MERGE_POLICY origin/main -- scripts/pr-watcher/index.mjs` →
`:150` unknown values fall back to `"off"`; `:4113` `if (AUTO_MERGE_POLICY === "off")`; `:3803`
`"Marco merges. Set PR_WATCHER_AUTO_MERGE_POLICY=tests-docs to restore the old lane."` The 18
surviving `tests-docs` string hits are the restore path, not a live lane — so string presence does
**not** refute the retirement.

**[MEASURED] `docs/approvals/` on `origin/main` still holds exactly two files** —
`git ls-tree --name-only origin/main docs/approvals/` → `README.md`,
`watcher-identity-approved-by-marco.md`. Newest commit there remains 2026-09-02 (#1502).
**Five** of the 13 depth-1 `-HOLD.md` prompts carry a `requires_file_on_main:
docs/approvals/<slug>-approved-by-marco.md` gate only Marco can satisfy: `pr-524-rates-b-slice2-canonical`,
`pr-rates-s11c-drop-legacy-tables`, `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`,
`pr-tenant-mt4-s2-ownership-migration`.

**[MEASURED] Station 06's 2026-10-02 handover is complete.** All three prompts it staged are in
`processed/`, their HOLDs in `superseded/`; `#2193 MERGED 2026-10-02T11:49:57Z`;
`#2215 MERGED 2026-10-02T19:07:33Z` (*SoR register — claim-once rule across months*, the
`escalates: true` one). The run log shows the first attempt was killed by the 75-minute watchdog
(`blocked/…run-timeout.md`, started 13:00:35Z, killed 14:15:39Z) and the second attempt exited 0.

**[MEASURED] Trackedness before editing, per `git ls-files` and never `git check-ignore`.**
`git ls-files -- docs/pr-prompts/needs-marco/` returns **11** tracked files. All three retirement
targets are **absent from it** (untracked), and
`stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md` **is** tracked — so that one
was edited **in the worktree**, not in the shared dev tree. `git diff --cached --name-status` in the
dev tree read EMPTY before and after.

**[MEASURED] Encoding read back with `node`, not `Get-Content`** (DOCTRINE §9.3), on the one tracked
file this run modified: `BOM=false`, `U+FFFD=false`, `mojibake=false`, `bytes=8605`.

## WHAT CHANGED

All in the worktree `C:\po-wt\sup-0014` unless stated.

1. **Three escalations retired** via `scripts/pipeline/retire-escalation.mjs` (exit 0 each), after a
   `--dry-run` that printed the exact source/destination/note triple. Read back: all three are
   `root=False discharged=True`, and `needs-marco/` went **55 → 52**. Three tracked notes now exist
   at `docs/pipeline/discharges/2026-10-07-0021Z-*.md`. **Nothing was deleted.**
2. **Six fully-dispositioned, out-of-cycle breadcrumbs archived** — `git mv` to
   `docs/pr-prompts/archive/`, each exit 0, all six staged as `R` (rename, not delete+add).
3. **One tracked escalation updated additively**:
   `needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md` gained an
   `## UPDATE 2026-10-07T00:21Z` section recording the result of **its own falsifying probe**. No
   existing line was changed or removed.
4. **Board lease taken** (`Enter-BoardLease -Actor station-00-scheduled` → `True`, exit 0) before any
   mutation, per BOARD_LEASE_V1 condition 3.
5. **Nothing armed, nothing merged, no label touched, no scheduled task touched, `/sot/` untouched.**

## FINDINGS

### F1 — Three escalations Marco had ALREADY answered were still sitting in his queue, and the sweep could not see it

The sweep tags `[STALE]` only when a row's *named subject PR* has merged. These three name no subject
PR in filename or heading, so section 5 returned `CANNOT decide` for all of them — while Marco's
2026-10-03 rulings, landed 2026-10-06, had already answered each one outright:

| retired file | its question | what answered it |
|---|---|---|
| `instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` | *"How should instrument-repair PRs reach `main`?"* | **INSTRUMENT_LANE_V1**, #2248 — Station 00 may now merge narrow instrument fixes. All four cited PRs (#1832 #1845 #1850 #1852) MERGED. |
| `tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md` | the lane enters its merge-wait 172× and merges 4× | **RETIRE_TESTS_DOCS_LANE_V1**, #2249 — lane retired, policy `off` by default, so the ratio has no mechanism. DOCTRINE §10.3 states the defect is retired with the lane. |
| `tests-docs-lane-starves-its-own-review-job-2026-09-04.md` | the 90-min merge wait occupies the single-lane worker | same ruling — with policy `off` the watcher opens the PR and moves on (`index.mjs:3803`). No wait, no starvation. |

**ACTIONED** — retired through `retire-escalation.mjs` with the evidence line quoted into each
discharge note, verified by read-back (`root=False discharged=True` ×3, census 55 → 52), nothing
deleted. **The generalisable half is the instrument gap, and it is worth more than the three files:**
section 5 can only detect staleness via a *subject PR*, so **an escalation answered by a RULING
rather than by a merge is invisible to it forever.** Recorded here rather than filed as a new row,
because the next COLLECT can act on it from this paragraph.

### F2 — The fourth tests-docs escalation is NOT retired, because its premise is now conditional rather than dead

`tests-docs-lane-can-auto-merge-the-station-contracts-2026-09-05.md` asks whether a PR editing
`DOCTRINE.md`, `docs/pipeline/stations/**` or `_canonical-blocks.json` should be able to auto-merge
with no human *"as it is today"*. The **"as it is today" clause is dead** — nothing auto-merges now.
But the guard it asks for does not exist either, so the hole reopens the instant
`PR_WATCHER_AUTO_MERGE_POLICY=tests-docs` is set, which #2249 deliberately kept as a supported
restore path (`index.mjs:3803`). Retiring it would discard a live latent question on the strength of
a default that one environment variable reverses.

**DEFERRED** — real, not now. **What makes it urgent, precisely:** `PR_WATCHER_AUTO_MERGE_POLICY`
being set to anything but `off`. I did not edit Marco's file to add that condition, because narrowing
someone's open question is not a measurement.

### F3 — Station 04 has now asked for the same blind-rate instrument twice, eleven days apart, and the second ask had never been collected

04's `2026-09-25-0211` F1 and its `2026-10-06-2210` F1 are the same escalation with the same three
RULE-1 options, both recommending option 1: an always-on probe that records every station run's
step-1 outcome to a tracked append-only file, so the blind rate is a measured series instead of
archaeology across breadcrumb filenames. The first reached Marco — 00's `2026-09-25-0215` run F4
escalated it through the existing `station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.
The **second had not been collected by anyone** until this run; 04 is report-only and cannot write to
`needs-marco/`, so without a COLLECT it reaches nobody.

**ESCALATED** — Marco, through the **existing** file rather than a fourth one (§10.5: one artifact,
one identity; a duplicate is how this queue grows a third copy of a question). The 2026-10-06 data
point was appended to that file in the dev tree, where the untracked `needs-marco/` corpus lives and
where he reads it, and is restated here because this breadcrumb is the tracked half of the channel.
**Corroborating measurement from this run, which strengthens 04's case rather than repeating it:**
Station 00 was *sighted* at 00:14Z while Station 04 was *blind* at 22:09Z the same night — the two
stations disagree about the same machine four hours apart, which is exactly the intermittency that no
instrument currently counts.

### F4 — The approval channel has now issued nothing in 35 days, not 21, and five HOLDs are still parked on it

`five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md` was a
retirement candidate on first inspection and **is not one**: re-measured against `origin/main` this
run, `docs/approvals/` still holds only `README.md` and `watcher-identity-approved-by-marco.md`, and
its newest commit is still 2026-09-02. **The escalation has not gone stale — it has got 14 days
worse**, and the five gated HOLDs are named under WHAT I MEASURED.

**DEFERRED** — the question it asks (*do you still want these five slices at all this quarter?*) is
`escalates`-class product scope and remains Marco's; the file already holds it and needs no second
copy. What would make it urgent: a sixth HOLD joining the same gate, or any of the five becoming a
dependency of armable work. ⚠️ **The "21 days" in the filename is now wrong by 14 days** — the
filename is the artifact's identity and must not be renamed (§10.5), so the number is corrected here
and in the file's body, never by renaming it.

### F5 — The seven WATCHER-CRASH-LOOP snapshots do not reproduce, and the root cause is already named inside them

Per DOCTRINE §7.1's re-read rule I re-verified the central claim before treating the snapshots as
current. The condition is **gone**: the watcher has been up 986 minutes, the auto-restart wrapper is
alive, and no new snapshot has been written in ~28 hours. The cause is stated in the snapshots
themselves — `FullyQualifiedErrorId : HRESULT 0x800700a4,…GetCimInstanceCommand`, i.e.
`ERROR_MAX_THRDS_REACHED` on a `Get-CimInstance` call inside `start-watcher.ps1`: a host
resource-exhaustion failure in a WMI query, not a repo or queue defect. The supervisor stopped after
5 identical failures, which is the designed behaviour and the reason the queue was never lost.

**DISPATCHED** — **Station 03**, which owns watcher health and local trees. Handed over: make that
`Get-CimInstance` call resilient (retry/fallback) so a transient thread-exhaustion cannot take down
the launcher five times and park the supervisor. I did not fix it myself: `scripts/pr-watcher/**` is
outside Station 00's recorded merge lane, 03 wakes on a daily clock and fired 1.2 h ago, and LL-38 is
specifically about 00 doing 03's work. ⚠️ **Not closed as resolved** — a condition that stopped is not
a condition that was fixed, and it fired three separate days (10-03, 10-04, 10-06).

### F6 — Nothing was armed, and the previous run's reason still holds one hour later

[MEASURED] `armed: 0`; 13 `-HOLD.md` at depth 1; both MARCO_QUEUE_LINE_V1 figures zero. The
2026-10-06T23:14Z run classified all 13 and found exactly two armable candidates
(`pr-fv2-ai-digests`, `pr-vendor-invoice-ocr`), then deferred both on the ground that neither
declares a `requires_on_main`, so arming them is not a gate decision any station can measure — it is
a **sequencing** decision about which feature work runs next, which is DOCTRINE §5.5, Marco's. I
re-checked the premise and it is unchanged: both still lack `requires_on_main`, and both still touch
`apps/api/**`, so §10.1 step 2 routes the resulting PR to Marco regardless of `escalates: false`.

**DEFERRED** — I am **not** overriding a one-hour-old §5.5 deferral by guessing his intent, which is
hard stop #5. Its stated expiry ("the board staying empty for another day") has **not** been reached.
**`NO-OP: nothing armed — the only two candidates are a §5.5 sequencing decision, not a gate.`** Said
loudly per DOCTRINE §6, because an idle board and a blocked board produce identical silence.

### F7 — Zero `[STALE]` rows, recorded so a clean result is distinguishable from a skipped step

The station doc requires clearing `[STALE]` escalation rows during COLLECT. The honest outcome is
that **the sweep produced none** across all 55 rows. Recorded explicitly because "no `[STALE]` rows
were cleared" and "the `[STALE]` sweep was skipped" are the same sentence from the outside, and the
2026-09-25T04:15Z blind run left exactly this step DEFERRED for want of a shell.

**ACTIONED** — the sweep ran, the result was empty, and the 2026-09-25T04:15Z run's deferred
`[STALE]`-sweep-and-archive item is closed by this run: the sweep is done and six breadcrumbs are
archived.

### F8 — The git guard reported INERT again, and the ban held by discipline

Exit 2, quoted verbatim under WHAT I MEASURED with the installer's own exit code, never a pipeline's.
This is the documented expected station outcome, not a regression, and it is the **sixth** consecutive
run to record it. No `git` ran against any mount.

**DEFERRED** — 04's trigger adopted unchanged: it becomes urgent on an eighth `index.lock` freeze, or
the moment any station report quotes a guard exit of `0` from a piped command (the 2026-09-22
false-pass shape). Neither holds — sweep section 3 read `index.lock interactive/clone: False / False`.

### F9 — A spent `blocked/` artifact survives for work that merged five days ago

`blocked/pr-sor-claim-s1-never-claim-an-item-twice-ready.md` plus its `.run-timeout.md` are the
remains of the first, watchdog-killed attempt; the second attempt opened #2215, which **MERGED
2026-10-02T19:07:33Z**. So `blocked/` advertises as blocked a piece of work that is on `main`.

**DEFERRED** — cosmetic and strictly additive to the queue's noise floor; `blocked/` is gitignored and
nothing reads it as a gate. It becomes urgent if any instrument ever counts `blocked/` as live work.
Not moved this run: QUEUE_LAYOUT_V1 grandfathers pre-existing files and nothing is ever deleted, so a
tidy-up is a deliberate batch like #2252, not a side effect of a COLLECT.

### F10 — `Invoke-GitPush` defaults to a worktree that does not exist, and still printed a SHA that looked like proof

⚠️ **Found AFTER this breadcrumb first merged (#2255), during this run's own push.** Recorded by
amendment rather than left for the next run, because a finding that lives only in a chat transcript
reaches nobody (STATION-CAPABILITIES §7).

[MEASURED] I called `Invoke-GitPush -RepoPath … -Branch …`. The parameter is `-WorkTree`, not
`-RepoPath`, so `-WorkTree` fell back to its default — `pipeline-lib.ps1:37`,
`$script:WORKTREE = "C:\po-fix"` — and `Test-Path C:\po-fix` → **False**. The function's first
statement, `Push-Location $WorkTree`, therefore failed:

```
Push-Location : Cannot find path 'C:\po-fix' because it does not exist.
    at C:\ProjectOperations2\scripts\pipeline\pipeline-lib.ps1:365 char:5
```

🔴 **Then it kept going and printed `f873b089`, and `$LASTEXITCODE` was `0`.** With
`$ErrorActionPreference = "Continue"` — which DOCTRINE §7 guard 7 *requires* in git scripts — the
failed `Push-Location` does not stop the function, so `git rev-parse HEAD`, `git push` and the
remote read-back all ran against the **ambient current directory** instead of `$WorkTree`. My cwd
happened to be the right worktree, so the push genuinely succeeded. **Had my cwd been anywhere else,
the function would have pushed the wrong tree, or nothing, and still returned a well-formed 40-hex
SHA and exit 0.**

This is DOCTRINE §1's own table entry — *"`git commit` succeeded / `$ErrorActionPreference="Stop"`
had aborted the script before the commit — the log looked clean"* — reproduced in the very helper
whose docstring says it exists to prevent it: *"Push, then READ BACK the remote SHA and prove it is
ours. BUG THIS PREVENTS: … git's harmless CRLF warnings on stderr abort the script BEFORE the push -
and the log still looks like it worked."* The read-back is real; what is unsound is that the
read-back can be performed on a **different tree than the caller named** without anything warning.

**What saved this run was not the instrument.** I did not accept the printed SHA. `git ls-remote
origin refs/heads/board/collect-0014-retire-answered-escalations` →
`f873b089c464175e9c1b41b11a77523204547ca5`, compared against `git rev-parse HEAD` →
the same 40 hex. Two different commands, same answer, which is the only reason "pushed" is claimed
here at all.

[MEASURED] Blast radius is small and it is agents, not scripts:
`Select-String -Path scripts/pipeline/*.ps1 -Pattern 'Invoke-GitPush'` returns **one** hit — the
function definition itself at `pipeline-lib.ps1:357`. No `.ps1` in that directory calls it, so every
caller is an agent typing it by hand, which is exactly the population that will get the parameter
name wrong.

**DISPATCHED** — **Station 06**, to stage it, because the fix is a `scripts/pipeline/` change and this
run is ending. The complete-and-additive fix, RULE 1 first: **make `-WorkTree` mandatory, and make the
function fail loud when the path is absent** — `[Parameter(Mandatory)]` plus an explicit
`Test-Path`/`throw` before `Push-Location`, so a missing or mistyped tree is an error instead of a
silent fallback to the ambient directory. *Solves it immediately* (this call shape can no longer
half-succeed) *and in future* (no caller can inherit a dead default), and it *damages no data entry* —
it only removes a default that resolves to a non-existent path, so no working invocation changes
behaviour. The alternative — point the default at a real directory — fails the *future* half: it keeps
a hidden default that silently pushes a tree the caller did not name, which is the actual defect.

⚠️ **I did not fix it myself**: `scripts/pipeline/**` is outside Station 00's docs/`sot`/queue merge
lane (STATION-CAPABILITIES §5), and INSTRUMENT_LANE_V1 governs *merging* a narrow instrument fix —
it is not authority to write one unsmoked at the end of a run.

## WHAT I DID NOT DO

- **Did not arm anything.** See F6 — a §5.5 sequencing decision, not mine, and not urgent yet.
- **Did not merge any other PR**: there were none. `OPEN PRs: 0`.
- **Did not touch any scheduled task** — not enabled, disabled, run, re-run or edited, including
  `05-sot-keeper`, which is the one station still silent. That is the station doc's forbidden list on
  a MISSED reading and DOCTRINE §7, and it is Marco's alone.
- **Did not retire the fourth tests-docs escalation** (F2), nor `five-holds-…` (F4). Both have live
  questions; a cautious-looking sweep that discards a real one is DOCTRINE §5b's named mistake.
- **Did not rename any escalation file** despite F4's filename now being 14 days wrong — §10.5, one
  identity for an artifact's whole life.
- **Did not fix the watcher's `Get-CimInstance` call** (F5) — 03's lane, and `scripts/pr-watcher/**`
  is outside 00's merge lane.
- **Did not prune any worktree.** The sweep lists 30 non-`main` worktrees, 10 holding commits on no
  remote branch and 2 registry escapees. The authority matrix gives 00 `❌ repair the machines`; the
  previous run already ESCALATED the prune decision with counts. Not re-escalated — one open question,
  one file.
- **Did not edit `/sot/`** — Station 05's lane, and CP-24 hard-fails any PR mixing code and `sot/`.
- **Did not commit on `main` in the dev tree.** Every mutation is in the isolated worktree
  `C:\po-wt\sup-0014` off `origin/main`.
- **Did not run `git` against a mount**, via the inert shim or the one-call `PATH=` form or at all.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing in this run came near them.
- **Did not write to any of the five gitignored `docs/qa/` sinks.**

## FOR MARCO

Nothing new is being asked. Three things you may want to know, shortest first:

1. **`05-sot-keeper` is the only station still silent** — `lastRunAt` still 2026-09-27T21:38Z. The
   other two from yesterday's escalation (00 and 03) have both resumed, so that escalation is now a
   third of its original size. Its next occurrence is **2026-10-07T14:22:37Z**; if it fires, the whole
   file can be discharged. **I cannot tell whether you restarted 00 and 03 or whether they resumed on
   their own** — `lastRunAt` records that a run happened, never who caused it. If you did not touch
   them, the cause is intermittent rather than fixed.
2. **Your queue is three rows shorter** (55 → 52) because three of its questions were ones you had
   already answered on 2026-10-03 and nothing had gone back to close them. The instrument reason is in
   F1: the sweep can only spot a stale escalation through a *subject PR*, so anything you settle by
   **ruling** stays in the queue until a human or a COLLECT notices.
3. **`docs/approvals/` has issued nothing in 35 days** and five HOLDs are parked on gates only you can
   satisfy. The existing escalation asks the right question — whether you still want that class of
   work this quarter — and it is now 14 days more overdue than its filename says.
