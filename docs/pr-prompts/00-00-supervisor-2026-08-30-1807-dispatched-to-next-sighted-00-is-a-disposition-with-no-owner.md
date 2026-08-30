# Station 00 — Supervisor | 2026-08-30T18:07Z–2026-08-30T18:12Z

## GROUND

```
UTC            2026-08-30T18:07Z
origin/main    cb392adb                (read from .git/refs/remotes/origin/main by FILE READ — no git binary run)
dev tree       main @ cb392adb         C:\ProjectOperations2  (converged; .git/HEAD -> refs/heads/main, both refs identical)
doc version    1                       (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                       (scheduled-task SKILL.md)
```

Versions MATCH. **But this run is BLIND**, and that is the headline.

🔴 **BLIND — Desktop Commander absent. No Windows shell this run.** `ToolSearch` for the
desktop-commander toolset was run three times across a 25s wait: the server appeared in the
"still connecting" list twice and then **dropped out of the listing entirely with zero tools
exposed**. `ToolSearch{query:"desktop-commander", max_results:30}` → `No matching deferred tools
found`; a second keyword probe (`start_process interact_with_process powershell terminal command`)
returned only PDF-viewer, GitHub and Microsoft-Learn tools. **There is no `start_process` on this
run.** Per `00-supervisor.md` PREFLIGHT step 1 and STATION-CAPABILITIES §2, that is a STOP: this
report is a blind report, not coverage. This is the **second consecutive blind Station 00 run**
(16:08Z was also blind).

What blindness cost, concretely: **no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
`check-breadcrumb.mjs --freshness`, no `restart-watcher-if-wedged.ps1`, no watcher liveness, no
OAuth credential read, no `gh`, no `git`, no merge, no arm, no PR.** The GitHub MCP is read-only
(403 on writes, DOCTRINE §9.4, re-confirmed twice on 2026-08-30), so there was no write channel of
any kind this run except an untracked file into the dev tree — which is what this breadcrumb is.

Both binding documents were read **in full** this run: `docs/pipeline/DOCTRINE.md` (487 lines) and
`docs/pipeline/STATION-CAPABILITIES.md` (218 lines), plus this station's own doc (907 lines).
⚠️ All three were read from the **dev-tree working copy via the mount**, not `git show origin/main:`,
because no git binary was reachable. The tree is at the same SHA as `origin/main`, but I cannot
prove the working files are unmodified against the index — `[INFERRED]`, not `[MEASURED]`. If any of
the three had an uncommitted local edit, I read the edited copy.

## WHAT I MEASURED

All measurements below are **file reads through the mount** (`/sessions/<id>/mnt/ProjectOperations2/`
= `C:\ProjectOperations2`). **No `git` was run against the Windows `.git`** (DOCTRINE §9.2 / the
0-byte-`index.lock` trap).

- **[MEASURED] Ground, without git.** `.git/HEAD` = `ref: refs/heads/main`;
  `.git/refs/heads/main` = `cb392adb6622d2caa447f16967da5be93ff57515`;
  `.git/refs/remotes/origin/main` = the **same 40 bytes**. Dev tree CONVERGED with `origin/main`.
- **[MEASURED] No wedge state.** `ls .git/index.lock .git/MERGE_HEAD .git/REBASE_HEAD
  .git/CHERRY_PICK_HEAD` → all four "No such file or directory". No stale lock, no abandoned merge.
- **[MEASURED] ARMED = 0.** `find docs/pr-prompts -maxdepth 1 -name '*-ready.md' | wc -l` → `0`.
- **[MEASURED] HOLD = 61.** `find … -maxdepth 1 -name '*-HOLD.md' | wc -l` → `61`. Unchanged from
  the 14:08Z run.
- **[MEASURED] OPEN PRs = 0.** GitHub MCP `list_pull_requests(state:open)` → `[]`. ⚠️ Tagged
  GitHub-side; `origin/main` is not the tree the watcher globs, and I am not offering this as
  board coverage.
- **[MEASURED] Nothing has merged since 14:52:39Z.** `list_commits(perPage:3)` head is
  `cb392adb` = the #1405 merge. The three most recent commits are #1405, #1407, #1406. The board has
  been static for 3h19m.
- **[MEASURED] Freshness, computed BY HAND** from `CADENCE = { '00': 2, '02': null, '03': 24,
  '04': 4, '05': 24 }` (read directly at `scripts/pipeline/check-breadcrumb.mjs:36` this run) and
  the newest filename stamp per station across `docs/pr-prompts/` **and** `archive/`
  (basename match, which is what the validator's freshness pass does — §9.5):

  | station | newest breadcrumb | age @18:07Z | 2× cadence | verdict |
  |---|---|---|---|---|
  | 00 | 2026-08-30-1608 | 2.0 h | 4 h | ok |
  | 03 | 2026-08-29-2305 | 19.0 h | 48 h | ok |
  | 04 | 2026-08-30-1409 | 4.0 h | 8 h | ok |
  | 05 | 2026-08-30-1411 | 3.9 h | 48 h | ok |
  | 02 | none | — | null | dispatch-only |
  | 06 | 2026-08-28-0300 | 63.1 h | **NO KEY** | **invisible** |

  **Nobody is SILENT.** ⚠️ **This is a hand computation, not `--freshness`.** Per the report
  contract I have NOT written `breadcrumb-clean` and must not: `check-breadcrumb.mjs` `execSync`s
  `git ls-tree`/`git ls-files` at `:98-101` and cannot be run from a mount-only session.
- **[MEASURED] `'06'` is still absent from `CADENCE` entirely** — not `null` like `'02'`, simply not
  a key. Verbatim from `:36` this run:
  `const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };`
  So 06's 63-hour gap is not merely unreported; it is unreportable.
- **[MEASURED] `archive/` = 224 files, not 193.** `find archive -maxdepth 1 -type f` → 224
  (`ls -1` says 225; the extra dirent is not a regular file). mtime histogram: **152 files at
  2026-08-31 00:18 LOCAL = 2026-08-30 14:18Z**, which is #1404's merge + the dev-tree FF, plus 41 at
  2026-08-17 and 31 from May/June. 41 + 152 = 193 — **the "archive/ 193" carried in project memory
  was counting only the `00-*` era and omitting 31 older files.** Corrected here.
- **[MEASURED] Breadcrumbs in the queue root = 15**, all dated 2026-08-30, **none newer than the
  16:08Z run.** No station has reported since my last run, so there is nothing new to COLLECT.
- **[MEASURED] Side folders are all cold.** needs-marco 23 (newest 2026-08-27 11:54 LOCAL) ·
  failed 41 (2026-08-29 07:03) · no-pr-opened 107 (2026-08-20 19:17) · blocked 1 · paused 14 ·
  awaiting-review 0 · processed 3580 (2026-08-29 02:13). Nothing new since the last run; no new
  silent no-op to triage.
- **[MEASURED] The #1407 ratchet cure is on disk and the TRAP-2 release condition is MET.**
  `scripts/pipeline/check-sot-baseline-ratchet.mjs` exists (5202 bytes). `ci.yml:201-215` — the step
  `sot-refs ratchet — baseline may only shrink` — now ends in
  `node scripts/pipeline/check-sot-baseline-ratchet.mjs`. `grep -n 'missing_path' ci.yml` returns
  exactly **2 hits, at `:195` and `:210`, and both are COMMENTS.** The grep TRAP 2 describes no
  longer exists. **I re-derived this myself rather than quoting the 16:08Z run** (DOCTRINE §7.1
  re-read rule).
- **[MEASURED] `docs/qa/sot-refs-baseline.json` has 14 entries**, last one
  `{"sot_file":"sot/README.md","line":190,"missing_path":"graphify-out/GRAPH_REPORT.md",
  "recorded":"2026-08-28"}`. Its `_readme` still says *"Until that step counts entries instead of
  '+' lines, NEVER delete the last element"* and *"The other **13** entries are the real debt"*.
  Both clauses are now false.
- **[MEASURED] `CLAUDE.md:19` still reads** *"`docs/qa/sot-refs-baseline.json` tracks 23
  known-dangling sot/ refs"*. Truth is 14. This is the first file every new chat reads.
- **[CANNOT MEASURE] OAuth.** `C:\Users\Marco\.claude\.credentials.json` is not a mounted folder and
  there is no shell. The seventeenth reading (14:0xZ, expired 45.94 h, mtime unchanged) is the last
  measurement anyone has. **The OAuth block therefore STANDS by default** — absence of a reading is
  not a lift. ARM NOTHING.
- **[CANNOT MEASURE] Watcher liveness.** No `restart-watcher-if-wedged.ps1`. Per DOCTRINE §3 and
  §7 guard 4: **WATCHER: CANNOT VERIFY — no PowerShell access this run.** Not "down". No escalation,
  no restart.
- **[CANNOT MEASURE] The dev-tree git index.** I cannot run `git diff --cached`. If another chat has
  something staged, I would not see it, and neither the `RD`-not-`D` staged-rename probe nor the
  archive-move question below can be settled.
- **[CANNOT MEASURE] Main CI on `cb392adb6622d2caa447f16967da5be93ff57515`.** Still open from the
  14:08Z run. The GitHub MCP exposes check runs only via `pull_request_read(get_check_runs)`, which
  keys off a PR head commit and cannot see a push-triggered run on a `main` merge commit;
  `gh run list --commit <full-40>` needs the shell. Two consecutive blind runs have now failed to
  close this.

## WHAT CHANGED

**Nothing on the board, and nothing in git.** No merge, no arm, no label, no PR, no rename, no
tracked-file edit. ARMED was 0 before and after; HOLD 61 before and after; `origin/main` cb392adb
before and after.

The single mutation this run made anywhere is **this file** — one untracked breadcrumb written to
`C:\ProjectOperations2\docs\pr-prompts\`. A breadcrumb filename matches no watcher glob, so it arms
nothing. **A sighted run must `git add` it**, along with the 16:08Z breadcrumb
(`00-00-supervisor-2026-08-30-1608-the-baseline-readme-outlived-the-gate-it-describes.md`), which is
also still untracked.

I deliberately did **not** edit `CLAUDE.md` or `docs/qa/sot-refs-baseline.json` in the working tree
even though both are wrong and both are one-line fixes. They are **tracked** files in an index
**shared with concurrent chats** (DOCTRINE §9.2): a pathspec-less commit from another chat would
publish my unreviewed edit as its own. An unlandable correct edit is worth less than not making it.

## FINDINGS

### F1 — "DISPATCHED → next sighted 00" is a disposition with no owner, no deadline, and no instrument

The 16:08Z run gave `CLAUDE.md:19` the disposition **DISPATCHED → next sighted 00**. I *am* the next
00, and I am blind, so the item did not move. That is not bad luck; it is structural.

Blindness is **intermittent, ~40% of Station 00 runs, cause unknown** (STATION-CAPABILITIES §2,
measured). So "the next sighted 00" names no run that is guaranteed to exist within any bounded
time, and — unlike a station dispatch — **nothing measures whether it happened.** `--freshness`
watches stations, not items. This is the same shape as the already-escalated **"DISPATCHED → 06
parks instead of closing"** defect, arrived at from a different direction: in both cases a
disposition that reads as *closed* is really a park, and no instrument can see the park.

**The blast radius is every item any station has ever handed to a future run of a station rather than
to the station itself.** Two are live right now (F2, F3), and both are stale-instruction defects — the
exact class this pipeline has been burned by repeatedly.

RULE 1, complete-and-additive first:

- **(A) Give the pipeline a carry-forward ledger.** A tracked file (say
  `docs/pipeline/OPEN-DISPATCHES.md`, or a `dispositions` block `check-breadcrumb.mjs` can parse)
  where a DISPATCHED item is written once with an addressee and an age, and any station's preflight
  prints anything older than 2× the addressee's cadence. **Complete** (every future park becomes
  visible, not just these two) and **additive** (a new file plus a read-only check; it deletes
  nothing and blocks no PR). Costs one PR to build.
- **(B) Ban "next sighted 00" as an addressee.** Require every DISPATCHED item to name a *station*,
  never a *future run*; anything that needs a sighted run becomes DEFERRED with a stated trigger.
  Complete: **no** — it stops the mislabelling but still leaves nothing counting the deferrals.
  Additive: yes.
- **(C) Leave it; blind runs are a minority and items eventually land.** Fails **complete**
  outright: it is precisely how a defect named in a breadcrumb FILENAME on 08-26 was still live
  three days later.

Note (A) and the 06-cadence escalation want the same instrument, and (A) subsumes it — worth
deciding together rather than twice.

**DISPOSITION: ESCALATED** — Marco to pick A / B / C. This is a process rule, not a repair; I will
not invent one and start enforcing it against other stations' reports.

### F2 — `sot-refs-baseline.json`'s `_readme` still orders 05 to park entry 14, for a reason that #1407 removed

Re-measured independently this run (not quoted from 16:08Z). `_readme` says: *"Until that step counts
entries instead of '+' lines, NEVER delete the last element."* `ci.yml:201-215` now runs
`check-sot-baseline-ratchet.mjs`, which set-compares `(sot_file, missing_path)` with `line`
excluded; the only two `missing_path` strings left in `ci.yml` are comments. **The release condition
is satisfied**, so `sot/README.md:190 → graphify-out/GRAPH_REPORT.md` is parked for a dead reason.
The same paragraph also says *"The other **13** entries"* while `entries.length` is **14**.

Editing `_readme` alone is ratchet-safe (entries untouched ⇒ 14 ≤ 14, no new pair) and is outside
`sot/` ⇒ CP-24 clear, so it can ship in an ordinary docs PR.

**DISPOSITION: DISPATCHED → Station 05** (re-affirmed, not re-raised; the exact patch is in the
16:08Z breadcrumb). 05's last run was 14:11Z and its cadence is 24 h, so it is **not** overdue — this
is waiting correctly, not parked. Nothing to do until 05 next runs.

### F3 — `CLAUDE.md:19` tells every new chat the baseline holds 23 refs; it holds 14

Unchanged since 16:08Z and re-measured this run. This is the **first file a new chat reads**, so the
wrong number propagates into every fresh session's priors.

The RULE-1 fix is **not** to write "14" — that would be the fourth hand-transcribed count of this
one number to drift in a week. It is to stop restating in prose a number that has a machine-readable
home: cite the file and its owner, not its contents.

I could not land it: no shell, and the GitHub MCP cannot open a PR (403, re-confirmed twice). I
declined to edit it in the shared working tree for the reason under WHAT CHANGED.

**DISPOSITION: DEFERRED** — deliberately re-labelled from the 16:08Z run's "DISPATCHED → next sighted
00", which F1 shows is not a real addressee. **Trigger that makes it urgent:** the first Station 00
run that has a Windows shell. It is a two-line docs PR and should be landed inside that run's own
board PR, alongside `git add` of the two untracked breadcrumbs.

### F4 — Two consecutive blind 00 runs, and the board happens to be empty, which is what makes it safe

16:08Z and 18:07Z were both blind. Four hours of supervision with **no watcher liveness reading, no
OAuth reading, and no ability to act.**

The reason this is currently cheap rather than dangerous is measured, not assumed: **OPEN 0, ARMED 0,
HOLD 61, no locks, no MERGE_HEAD, tree converged, no station SILENT, no new breadcrumb, every side
folder cold.** There is nothing on the board for a supervisor to drive. Had a PR been mid-flight or a
prompt armed, the same two runs would have been a four-hour hole.

Cause is unknown and is recorded as unknown in STATION-CAPABILITIES §2 — I am not going to guess at
it from two samples.

**DISPOSITION: DEFERRED.** **Trigger that makes it urgent:** a third consecutive blind run, or any
blind run that finds ARMED ≥ 1 or OPEN ≥ 1. Either of those turns an idle-board inconvenience into a
stall, and at that point the intermittent-blindness cause becomes an escalation to Marco in its own
right rather than a line in a capabilities doc.

### F5 — Project memory's `archive/ 193` was undercounting by 31; corrected

`archive/` holds **224 regular files**, not 193. 193 is 41 + 152 and omits 31 files with May/June
mtimes. Small, but the number is quoted in memory as a board-state fact and a future run comparing
against it would read a phantom +31.

**DISPOSITION: ACTIONED** — corrected in this breadcrumb and in project memory this run. Verified by
`find archive -maxdepth 1 -type f | wc -l` = 224 with the per-day mtime histogram as the positive
control on what the 152 are (all stamped 2026-08-30T14:18Z = #1404's merge + FF).

## WHAT I DID NOT DO

- **Did not run `status-sweep.ps1`, `bring-up-to-speed.ps1`, `check-breadcrumb.mjs --freshness`,
  `lint-prompt.mjs`, `triage-holds.ps1`, `smoke-pr.ps1`, or `restart-watcher-if-wedged.ps1`.** All
  need the box. Their absence is the run's headline, not a footnote.
- **Did not write `breadcrumb-clean`.** The contract forbids it until `check-breadcrumb.mjs` has
  actually exited 0, and it cannot run from a mount.
- **Did not run `git` in any form** against `C:\ProjectOperations2\.git` — DOCTRINE §9.2: a
  cut-short VM-side git call leaves a 0-byte `index.lock` that freezes every station. All ground
  facts came from reading `.git/HEAD` and the two ref files as plain text.
- **Did not arm anything.** ARMED is 0 and stays 0. The OAuth block stands (unmeasurable this run,
  and unmeasured is not lifted), and arming is a `git mv` I cannot perform anyway.
- **Did not merge, label, or open a PR.** OPEN is 0, so there was nothing to merge; and the GitHub
  MCP is read-only regardless.
- **Did not edit `CLAUDE.md` or `sot-refs-baseline.json`** in the working tree, though both are
  wrong and both fixes are one line. Shared index; see WHAT CHANGED.
- **Did not re-measure F3/bootstraps.** Four runs have now paid for the same dry-clean measurement.
  Nothing technical blocks it; only Marco's authority does. It stays where it is until he answers
  (A) standing authority for 00 to run `fix-station-bootstraps.mjs` / (B) approve one run /
  (C) he pastes them.
- **Did not present the GitHub-side reads as board coverage.** They are tagged as GitHub-side and
  are there to say *"nothing merged, nothing opened"*, not *"the board is healthy"*.
- **Did not re-raise** #1404/#1405/#1406/#1407 (all merged), the sot-refs burn-down (closed
  14:52Z), or 04's refuted F2 folded-scalar census.
