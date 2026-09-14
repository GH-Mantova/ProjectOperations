# Station 00 — Supervisor | 2026-09-14T17:08Z–2026-09-14T17:4xZ

## GROUND

```
UTC            2026-09-14T17:08:27Z
origin/main    61b7cc20            (fetched first, then rev-parse)
dev tree       main @ 61b7cc20      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 = 1) — this run was not restricted to read-only.

SIGHTED run. A keyword `ToolSearch` for `desktop-commander` loaded the schemas; `start_process`
shell `powershell.exe` then returned PID 18784. A first `-Command` probe died with a ParserError
after `$env:COMPUTERNAME` was stripped before PowerShell parsed it — DOCTRINE §9.1's first bullet
firing, and a parser error **from the Windows host** is itself proof the box was reached. Every
later command went through `interact_with_process`, which does not expand.

Binding documents read from the working copy after proving the working copy IS `origin/main` for
each: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY**, which per §9.2 is the real answer. No piped
hash was taken and none is quoted (§9.1 — the piped form is unsound in `powershell.exe`).
`DOCTRINE.md` 2422 lines: §1–§9.4 and §9.6–§10.2.1 read line by line; §9.5 (lines 985–1607) and
§10.3–§10.6 read by heading index rather than in full, which I am recording as a shortfall against
the contract rather than claiming coverage I did not take.

## WHAT I MEASURED

**Device-bridge git guard — [CANNOT MEASURE]. Third week of the same outage.** PREFLIGHT step 1
requires the installer's last line quoted pass or fail. Quoted verbatim:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/... is under Plan9 share "c" which is not mounted;
create: RPC error -1: ensure user: user vigilant-affectionate-cerf already exists unexpectedly
A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

A failed install is a FINDING, not a STOP. **No hazard followed from its absence:** the guard exists
to refuse VM-side `git` against the mount, and with no VM no such call was possible. Carried as F5.

**Sweep — captured to a file and decoded `utf16le`** (§9.3: `*>` writes UTF-16LE, so the prescribed
cure for the early-return trap is a direct instance of the encoding trap). `status-sweep.ps1`
self-stamped `2026-09-14 17:10:18Z`, 859 lines, exit 10.

- Section 0 positive controls both PASS (`gh` reached GitHub, `node` runs) ⇒ the report is usable.
- Section 7: **SAFE TO ACT**. Section 3 at that moment: `index.lock` interactive/clone `False / False`;
  git processes touching our trees **0**; no PR touched on GitHub in the last 2 min; no build in flight.
- Section 5 produced **zero `[STALE]` rows**, against **268** `[FILE]` rows in the same 565-line
  section — so the section ran and parsed, and the zero is an answer rather than an empty read.
- Watcher node RUNNING pid 30976, wrapper alive, heartbeat 45 min on an **empty** queue: idle and
  correct, not WEDGED. Clone `dirty=2` (was 3). Three orphaned worktrees, one holding 1 uncommitted
  file at 14,957 min (10.4 days) — 03's lane, untouched.

**Board at 17:10Z — 2 open, both Marco's.** main CI on `61b7cc20`: 4 success / 0 failed.

| PR | mergeStateStatus | CI | labels |
|---|---|---|---|
| `#1923` | CLEAN | 15 pass / 0 fail / 0 pending | `[]` |
| `#1920` | BLOCKED | 13 pass / **2 fail** | `do-not-merge` |

### RULE 2 — re-taken this run, because a lane verdict is non-monotonic (§10.1)

Probe tree pinned to the LIVE one, `C:\ProjectOperations2\docs\pr-prompts\processed`:

```
logs    2221     newest 2026-09-14T16:26:14Z   (younger than both open PRs)
POS     Select-String -Pattern 'marco.:true'          -> 666
NEG     Select-String -Pattern 'zzQq00Needle20260914T1710' ->   0   (fresh needle, minted this run)
PR #999995 (negative PR control)                       ->   0
```

Written without a quote character. Counted with the null guard `@($x | Where-Object { $null -ne $_ }).Count`,
never a bare `@(...).Count` (§9.4, `NULL_COUNT_IS_IN_THE_COUNTER_V1`).

Both PRs return **2** hits, and per §10.1's `PRNUMBER_SCRAPED_FROM_PROSE_V1` guard I crossed each
verdict against its own log's prompt rather than accepting the number:

```
pr-ratescol-s0-column-api-hygiene-ready.md.log
  PR #1923 open and unmerged: https://github.com/.../pull/1923          <- the log's OWN opened-PR line
  [watcher] merge result for PR #1923: {"ok":false,"marco":true,
    "reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}

pr-ea-s2a-dashboard-preset-seed-ready.md.log
  EA-2a shipped as PR #1920, unmerged as required.                       <- the log's OWN opened-PR line
  [watcher] merge result for PR #1920: {"ok":false,"marco":true,"fixLane":false,
    "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

Both verdicts are genuine routings, not prose scrapes: each log carries its own opened-PR line for
the same number and its prompt's scope matches the PR's files. **RULE 2 BINDS on both.** Neither was
merged.

### Queue

`triage-holds.ps1`: **HOLD=37, ready=0, LOOPING=0**; `spent=0`, `gates-satisfied=4`, `still-gated=33`,
`unreadable=0`, `SPENT BEHIND A REJECT=0` with its fixture control proving the probe can emit it.
Two of the four are flagged POSSIBLE DUPLICATE of an open PR (2 of 2 scope entries each); the other
two were measured last run as outside all three `NESTED_TEST_PATHS` forms. **0 of 4 can enter the
`tests-docs` lane** — unchanged, carried as F7.

### COLLECT — nothing new since 16:08Z

`check-breadcrumb.mjs --freshness`: structure **6 checked, 0 malformed**, exit 2. The queue root holds
six breadcrumbs, newest mtime `2026-09-14T16:28:15Z`, and all six are already tracked on `origin/main`
(landed in `#1926`, `#1931`, `#1933`, `#1934`). **No station has written a breadcrumb since my own
16:08Z run**, so there was no new finding to disposition and nothing to sweep up. All six were
dispositioned by their own runs or by earlier collects, so all six are archived in this PR.

### Station freshness, crossed against `lastRunAt`

```
00  last 2026-09-14T16:08:00Z   1.0h ago  (cadence 2h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-10T23:10:00Z  90.0h ago  (cadence 24h)  SILENT
04  last 2026-09-14T14:16:00Z   2.9h ago  (cadence 4h)   ok
05  last 2026-09-14T14:11:00Z   3.0h ago  (cadence 24h)  ok
```

`list_scheduled_tasks` at 17:1xZ: `03-machine-minder` **enabled**, cron `0 9 * * *`, `lastRunAt`
**2026-09-10T23:01:10Z**, `nextRunAt` **2026-09-14T23:00:45Z** — byte-identical to the 16:08Z
reading. 00's own `lastRunAt` is `2026-09-14T17:08:27Z` against cron `5 * * * *`, i.e. **hourly**,
while `check-breadcrumb.mjs` carries `'00': 2` — so 00's `ok` is a weaker claim than any other row's
and is covered by this cross-check rather than by the breadcrumb instrument.

## WHAT CHANGED

**No board mutation.** Nothing merged, nothing armed, nothing disarmed, renamed, moved or staged in
the queue; armed **0** before and **0** after. No label added or removed. No receipt authored. No
`needs-marco/` file created, moved or cleared. `/sot/` untouched. The watcher clone was **read** and
not written — no `git` was run against it and no file in it was moved.

**One docs-only change, in this PR:** the six dispositioned breadcrumbs above `git mv`'d from the
queue root to `docs/pr-prompts/archive/` (six `R100` renames, nothing else staged — `git diff --cached
--name-status` read exactly six lines), plus this breadcrumb. Written **inside the PR worktree**
`C:\po-00-1708`, so no loose dev-tree copy exists for the post-merge fast-forward to trip on.

## FINDINGS

### F1 — 181 escalations exist only in the watcher clone, and every instrument this pipeline owns is blind to them

[MEASURED] 2026-09-14T17:2xZ, comparing the two `needs-marco/` folders by filename:

| tree | files |
|---|---|
| `C:\ProjectOperations2\docs\pr-prompts\needs-marco` (dev) | **53** |
| `C:\po-watcher\ProjectOperations\docs\pr-prompts\needs-marco` (clone) | **187** |
| present in **both** | **6** |
| **clone only** | **181** |

The eight newest clone-only files are review-lane escalations from the last 36 hours —
`pr-1890-review-block.md`, `pr-1891-…`, `pr-1894-…`, `pr-1895-…`, `pr-1905-review-fix.md`,
`pr-1911-review-reject.md`, `qpdf-3-quote-ref-format-decision.md`, and `pr-1920-review-block.md`
(`2026-09-14T06:33:34Z`).

**Why nothing has ever seen them.** `needs-marco/` is gitignored (`.gitignore:76-83`), so a file
written there has no route to `main` from any tree. The review lane runs in the clone and writes
there. `status-sweep.ps1` section 5 reads the **dev** tree — this run's section 4 reported
`needs-marco/: 53`, which is the dev count — so the sweep is structurally blind to the other 181,
and its zero `[STALE]` rows this run is a statement about 53 files, not 187.

🔴 **The cost is that Station 00's COLLECT duty has been operating on 29% of the queue.** My station
doc makes discharging dead PR-scoped escalations a COLLECT obligation and records that eleven such
rows once survived ten days. That measurement, and every "needs-marco: 53" line in every station
report including six of my own today, understates Marco's queue by roughly 3.5×.

⚠️ **I nearly filed the inverse of this finding.** Searching the dev tree for
`pr-1920-review-block.md` returned **0** with a clean positive control (`pr-1612*` → 1) and a fresh
negative needle (→ 0), and the available conclusion was *"the review lane's own log cites a file it
never wrote"* — a confident, coherent, wrong finding about a lane that had worked perfectly. What
stopped it was `needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`, which records
in passing that `pr-1675-review.md` *"**was** written — into `C:\po-watcher\ProjectOperations\docs\pr-reviews\`,
the tree the watcher reads."* This is §9.6 in its exact shape: the instrument was sound, the corpus
was wrong, and only an already-filed escalation named the right tree.

🔧 **RULE 1 options, complete-and-additive first.**

**(a) Give the escalation queue a tracked home and have both trees write to it.** Un-ignore a
`docs/escalations/` directory, land the 181 as a one-off reconcile, and point the review lane and the
stations at it. **Complete** — the queue becomes reviewable, diffable and CI-visible, and the sweep's
section 5 can cross every entry against GitHub instead of 29% of them. **Additive** — it creates a
directory and moves copies; it deletes nothing, and `needs-marco/` can stay exactly where it is
during the transition. This is the only option that passes both halves of RULE 1.

**(b) Teach `status-sweep.ps1` section 5 to read both trees.** Cheap and it ends the blindness this
week. Fails the *completely* half: the files still cannot reach `main`, still cannot be reviewed in a
PR, and a clone rebuild still destroys 181 escalations with no trace.

**(c) Have Station 03 mirror clone → dev on its cadence.** Fails *completely* on two counts — 03 has
not run in 90 hours (F4), and the destination is itself gitignored, so it moves the blindness rather
than removing it.

**DISPOSITION: ESCALATED.** Filed as
`docs/pr-prompts/needs-marco/escalations-live-only-in-the-watcher-clone-2026-09-14.md` — ⚠️ **written
into the DEV tree deliberately**, because that is the folder every instrument does read, and writing
it into the clone would file this finding into the hole it describes. ⚠️ **Falsifying probe:**
re-count both folders by filename. If clone-only ever reads 0, the mirroring has started and this is
discharged; if `status-sweep.ps1` section 4 ever reports a number matching the clone, the sweep has
been widened and option (b) has landed.

### F2 — `#1920` passes every gate it can pass, its blocking escalation is answered, and it is waiting on one label Marco said he would remove

[MEASURED] the two reds have **one cause**, and it is not the one the escalation names. From column 3
of the `PR gates — diff checks` job log (run `34869756693`, job `104062442662`, 215 lines, split on
tab per §9.1 — grepping the whole line matches every row because column 1 is the job name):

```
ALLOWED - CP-11 migrations [apps/api/prisma/migrations/20260914063000_ea2a_estimating_analytics_preset/migration.sql]
PASS    - CP-23 seed-without-migration [migration added alongside seed: 20260914063000_ea2a_…]
PASS    - CP-12 / CP-13 / CP-17 / CP-22 / CP-24 / CP-25
FAIL    - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must
          review and REMOVE the label; removing it is what releases the merge.]
```

**CP-23 PASSES.** The verdict token is `[LABEL_PRESENT]`, which §9.4 records as **parked by design,
not a defect and not work** — and that one failure takes `PR gates — diff checks` down with it,
which is the standing coupling and why the board shows two reds.

🔴 **The clone-only `pr-1920-review-block.md` is therefore a lead, not a finding, by §7.1's re-read
rule.** Read verbatim, it asks Marco to choose between *(1) declare `SEED-ONLY: dev`*, *(2) require a
migration alongside the seed*, and *(3) a special ruling*. **Option 2 has already been executed:**
`20260914063000_ea2a_estimating_analytics_preset/migration.sql` is on the head `f9fecc8e`, one of the
PR's seven files. The review ran `06:29:02Z–06:33:51Z` and the migration is timestamped `06:30:00`,
so the reviewer read a head that predated its own answer. Its second paragraph — *"labeled
do-not-merge but carries no approval receipt"* — is also spent: `docs/decisions/merge-approvals/1920.md`
**is in the diff**, commit `7b257b2d`, authored `PR Supervisor <supervisor@local>` and self-declaring
*"Receipt written by station-00.interactive-0003 (DOCTRINE §10.2.1)"*, recording Marco's chat release
and, in its own words, *"Marco removes `do-not-merge` himself"*.

**So the whole of `#1920` reduces to one human action, and Marco has already said in chat he would
take it.** It has sat that way since `09:44Z`, 7.5 hours. 🔴 I did not remove the label: that is an
absolute hard stop and the removal is the release.

⚠️ One defect worth naming, minor and not blocking: that receipt's YAML front-matter block is
**duplicated** — the `pr: 1920 / approved_by: marco / approved_at:` fence appears twice, back to
back, before the heading. `approval-receipt-check.mjs` passed it, so nothing enforces single
front matter on a receipt.

**DISPOSITION: ESCALATED**, deliberately as a breadcrumb finding and **without a new `needs-marco/`
file** — the ask is one line and adding a 54th file to a queue this run has just shown is really 187
is how it would disappear. The line: **`#1920` needs only the `do-not-merge` label removed; every
gate it can pass, passes.** ⚠️ **Falsifying probe:** re-read the CP-26 verdict token. `[LABEL_PRESENT]`
⇒ still parked and this finding holds; `[RELEASED_NO_RECEIPT]` ⇒ the label came off without the
receipt reaching `main` and that is a real finding for the next run.

### F3 — `#1923` has no review at all, because its review job exited 0 announcing a wakeup that never came

[MEASURED] `rev-1923-ready.md` sits in `docs/pr-prompts/failed/` (09-14 08:31Z). Its log, entire:

```
Started: 2026-09-14T08:31:13.423Z
Ended:   2026-09-14T08:32:58.796Z
Exit:    0
---
Waiting on CI. Wakeup scheduled for ~4 min.
```

**The wakeup never fired.** 8.6 hours later there is no `pr-1923-review.md` in **either** tree — dev
0, clone 0, against a positive control of 115 review files in the clone and 5 `pr-19*` in the dev
tree (`pr-1908`, `1914`, `1917`, `1919`, `1921`). `verdictApproves` resolves
`docs/pr-reviews/pr-<N>-review.md`, so nothing anchors a verdict for `#1923`, and `#1923`'s CI has
been green 15/0/0 the entire time.

🔴 **The failure is silent in the direction that matters: exit 0 and a self-announced continuation.**
A job that parks itself and dies is indistinguishable from one still waiting, and the only record is
a two-line log inside a gitignored folder. `failed/` caught it, but nothing reads `failed/` except
the sweep's section 4B, which prints the filename and `(no reason captured — open the file)`.

**DISPOSITION: DISPATCHED → Marco's lane via the existing file.** The repair is in
`scripts/pr-watcher/**`, which §10.1 puts outside every station's lane, and the review lane already
has three open escalations — `tests-docs-lane-starves-its-own-review-job-2026-09-04.md`,
`tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md`, and
`rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`. This is a **fourth, distinct**
mode — not starvation and not an unread verdict, but a job that exits 0 mid-wait — and I have added
it as a measured section to the 09-04 file rather than opening a fifth. ⚠️ **Falsifying probe:** if
`docs/pr-reviews/pr-1923-review.md` appears in either tree, the wakeup did fire late and this is
discharged.

### F4 — 03 has now missed four consecutive occurrences; its recovery slot is 5.8 hours out and the probe is not yet due

[MEASURED] `lastRunAt` for `03-machine-minder` is **still** `2026-09-10T23:01:10Z`, unchanged from the
16:08Z reading, with `nextRunAt 2026-09-14T23:00:45Z` and the task **enabled**. `lastRunAt` older
than one cadence is row 1 of the freshness table — *the occurrences never fired, nothing ran* — which
is neither the 529 trap (that updates `lastRunAt` and prints `ok`) nor "ran and did not report". The
missed slots sit inside the scheduler hole `#1931` records and that 04 and 05 both recovered from at
their first slot after it. **03 is not a stopped station**, and reporting it as one is the §7 false
alarm that licenses destructive action.

What it costs is unchanged: 03 is the only actor permitted to fast-forward the watcher clone
(`dirty=2` [LIVE]) and the only owner of worktree hygiene — `C:/PR-Master/worktrees/po-vg` now holds
1 uncommitted file at **14,957 min (10.4 days)**, where `git worktree remove` refuses and `--force`
would discard it — and the standing four-ask dispatch to 03 has sat unread for 90 hours. **F1 adds a
fifth ask to it: 03 is the only station that may touch the clone, and the clone is where 181
escalations are stranded.**

**DISPOSITION: DEFERRED**, with the trigger the 16:08Z run set and which is now 5.8 hours out: **if
`lastRunAt` for `03-machine-minder` is still `2026-09-10T23:01:10Z` after `2026-09-15T00:00Z`, the
scheduler hole is not the explanation, 03 has a defect of its own, and it escalates.** The run that
fires around `2026-09-15T00:08Z` owns that check and must not defer it again.

### F5 — the mandatory guard install is unreachable for a third week, and its escalation failed its own falsifying probe a sixth time

[MEASURED] the RPC mount error again at 17:0xZ, quoted verbatim above.
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` carries the probe *"next
scheduled run of any station: if the guard returns an installer line rather than an RPC mount error,
this escalation is discharged."* **The probe fired and failed for the sixth recorded time** — 04 at
09-10T02:1xZ, 00 at 09-10T03:1xZ, 04 at 09-14T14:1xZ, 00 at 09-14T15:09Z, 00 at 16:08Z and this run.
The escalation is LIVE and 4.6 days old. ⚠️ Naming it here is the only way this re-measurement reaches
anybody — and F1 is why: that file is one of the 53 the sweep can see, and 181 others get no such
mention from anyone.

**DISPOSITION: DEFERRED.** No duplicate filed. ⚠️ **What would make it urgent:** a station *stopping*
on a failed guard install, which the contract explicitly forbids and none has done.

### F6 — `#1920` was rebuilt four times today by a poller, on a PR no automation may merge

[MEASURED] `gh run list --branch feat/ea-2a-estimating-analytics-preset`: CI fired at `14:23:25Z`,
`15:25:30Z`, `16:21:24Z` and `16:37:24Z` — four full runs in 2h14m on a PR that has carried
`do-not-merge` since 06:0xZ. Each one lands 3–4 minutes after a board PR merged (`#1931` 14:20Z,
`#1933` 15:22Z, `#1932` 16:17Z, `#1934` 16:27Z), which is `pollForBehindPrs` firing on every open PR
after every board merge. Every one of those four runs failed on `[LABEL_PRESENT]` and could not
have done anything else.

**DISPOSITION: DEFERRED** — already escalated as
`needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md` with its three options, and this
run adds only today's count. ⚠️ **This run is itself a board PR and will trigger a fifth.** That is
the honest cost of the archive-and-report cycle, and it is the reason option (b) on that escalation —
*PR-only-when-something-to-land* — deserves more weight than it has been given: on a board with
nothing to merge and nothing to arm, a report that changes no state still burns two CI runs.

### F7 — the tests-docs lane is eligible on zero of four candidates, and two of the four must not be armed at all

[MEASURED] `gates-satisfied=4` of 37. Two are flagged POSSIBLE DUPLICATE at 2 of 2 scope entries:

🔴 **DO NOT ARM `pr-ratescol-s0-column-api-hygiene-HOLD.md` while `#1923` is open.**
🔴 **DO NOT ARM `pr-ea-s2a-dashboard-preset-seed-HOLD.md` while `#1920` is open.**

Both premises still evaluate TRUE against `origin/main` — where the work has not landed — so
`lint-prompt.mjs` reads ADMIT and arming either opens a second PR for work already on the board. Both
die on their own the moment their PR merges. The other two candidates were measured last run as
falling outside all three `NESTED_TEST_PATHS` forms (`scripts/pipeline/**` and `apps/**`), so
**every arm available today lands on Marco**, on a board where both open PRs are already his.

**DISPOSITION: DISPATCHED → Station 06 (PR Master)**, re-stating rather than replacing the 15:09Z and
16:08Z dispatches, because 06 has not run since. The general cure is already on `main` from `#1924`
— *a prompt's `scope:` must name its own `-HOLD.md` so its own PR retires it* — and what remains is
applying it to prompts authored before that rule.

## WHAT I DID NOT DO

- **Did not merge `#1923` or `#1920`.** Both carry a live watcher `marco:true` verdict, re-taken this
  run with a fresh needle, a positive control at 666 and a negative PR control at 0, and each
  cross-checked against its own log's opened-PR line per §10.1's prose-scrape guard. RULE 2 is not
  cleared by green, by CLEAN, by an unlabelled PR, or by my own reading of the diff.
- **Did not remove the `do-not-merge` label from `#1920`**, even though F2 shows every other gate
  passes and the receipt in its diff records Marco saying he removes it himself. Removing it IS the
  release; it is an absolute hard stop and it is his.
- **Did not author a receipt** for anything. A scheduled run may never author one. The receipt on
  `#1920` was written by the supervised interactive lane under §10.2.1 and is that lane's to own.
- **Did not write into the watcher clone.** I read it — `needs-marco/` (187), `docs/pr-reviews/` (115)
  — and moved nothing, including the now-answered `pr-1920-review-block.md` that F2 shows is spent.
  Clone hygiene is 03's, and a live agent may be working there.
- **Did not arm anything.** 0 before, 0 after. Two of four candidates are do-not-arm today; the other
  two land on Marco.
- **Did not re-run `#1920`'s CI.** Four runs today already said the same thing, and a fifth cannot
  change `[LABEL_PRESENT]`.
- **Did not file a `needs-marco/` file for F2, F3 or F6.** Each already has a home or reduces to one
  line, and F1 is the measured reason a new file is the worst available channel right now.
- **Did not prune the three orphaned worktrees**, and specifically did not go near
  `C:/PR-Master/worktrees/po-vg` — 1 uncommitted file at 10.4 days, where `--force` discards it.
- **Did not restart the watcher.** RUNNING pid 30976, wrapper alive, 45-minute heartbeat on an
  **empty** queue: idle is correct, not WEDGED.
- **Did not "repair" the ` M` on `docs/pr-prompts/00-04-scanner-…-1416-….md` in the dev tree.**
  `git diff --numstat origin/main` over it is EMPTY, so it is a line-ending smudge against a file
  whose content already matches `main` — §9.2's status-vs-`origin/main` bullet. Touching it is how
  the two-cause fast-forward trap starts. The archive `git mv` in this PR was done in a **clean
  worktree off `origin/main`**, not in the dev tree, so it does not interact with that smudge.
- **Did not discharge any escalation.** Section 5 produced zero `[STALE]` rows against 268 `[FILE]`
  rows, and the one PR-scoped file in the dev tree — `pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`
  — re-asked individually reads `{"number":1612,"state":"CLOSED","mergedAt":null}`, i.e. genuinely
  closed-unmerged and genuinely live. Nothing licensed a discharge.
- **Did not read `DOCTRINE.md` §9.5 or §10.3–§10.6 line by line** — recorded in GROUND as a shortfall
  rather than claimed as coverage.
- **Did not touch `/sot/`** (05's), Azure / Entra / SharePoint (absolute, Marco only), or production
  data.

---

Board PR: this file's own, together with six breadcrumb archives. Breadcrumb written **inside the PR
worktree** (`C:\po-00-1708`), so no untracked copy exists in the dev tree.

Stamped `2026-09-14T17:4xZ` at `origin/main` `61b7cc20`. **Every count above is STATE — re-measure,
never quote.**
