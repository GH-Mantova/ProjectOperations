# Station 00 — Supervisor | 2026-09-06T07:08:54Z–2026-09-06T07:5xZ

Sighted run — Desktop Commander reached the box on the first call. Board was EMPTY on arrival
(0 open PRs, 0 armed), so this run is a COLLECT plus one dispatched docs fix, not a merge run.

## GROUND

```
UTC            2026-09-06T07:08:54Z
origin/main    d5d6ad69            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 42aae6be     C:\ProjectOperations2   -> fast-forwarded to d5d6ad69 this run
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version: 1 in the inlined scheduled task)
```

Version check: **MATCH**. Run proceeded at full authority.

All three binding documents were read in full **from the working copy**, which the PREFLIGHT block
permits only on proof of currency. [MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY output**, taken *after* the fetch and *before* the fast-forward. Empty is the real answer
(PREFLIGHT step 2); no piped hash was taken or compared (§9.1).

## WHAT I MEASURED

**Board**, `scripts/pipeline/status-sweep.ps1`, generated 2026-09-06T07:09:34Z, exit 0, 263 lines.
Captured through `cmd /c "... > file 2>&1"` rather than PowerShell `>` so the capture is not
UTF-16LE (§9.3), and to a file rather than the stream because the script returns early and hides
its own section 7 verdict.

- [MEASURED] section 0 positive controls both `[LIVE]`: gh reached GitHub (saw merged #1693), node runs.
- [MEASURED] **OPEN PRs: 0. armed: 0.** needs-marco 28, no-pr-opened 109, failed 41, blocked 123.
- [MEASURED] watcher node RUNNING pid **17944**, wrapper alive (3), heartbeat age 1 min.
- [MEASURED] main CI on `d5d6ad69`: 0 success / 0 failed / **4 running** — the sweep tags this
  `[CANNOT MEASURE] ... NOT a green trunk`, correctly: `d5d6ad69` was three minutes old.
- [MEASURED] section 7 verdict: **CAUTION** — no local lock, but #1693 had merged 3 min earlier.
  That PR is my own predecessor's (the 06:08Z collect), and section 3 read 0 in-progress prompts,
  0 git processes, `index.lock` False/False. All work was done in an isolated worktree on a NEW
  branch, which is what CAUTION prescribes.
- [MEASURED] `C:/po-vg` still listed as an orphaned worktree, 1 uncommitted file, age 2836 min.
  Not re-investigated: project memory records its central claim as REFUTED (`23c91ba9`'s content is
  on main as `b42dcc36` via #1577). Left for 03.

**RULE 2 / lane classification: NOT APPLICABLE THIS RUN, and that is a measurement, not an omission.**
[MEASURED] `gh pr list --state open` → **0 rows** (status-sweep section 1, `[LIVE]`). There is no PR
to classify, so no `marco.:true` probe was run and none is quoted. I merged exactly one PR — this
run's own board PR, opened by this station in its own `docs/` lane (section 10.1 step 3, authority
matrix row "00 / Create a PR / board PRs").

**COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`:
`00` 1.1 h ago (ok) · `03` 8.2 h (ok) · `04` 1.0 h (ok) · `05` 17.0 h (ok) · `02` dispatch-only.
Crossed against the newest breadcrumb per station; all four align.
⚠️ That `ok` for `00` is the weak one `STATION-CAPABILITIES.md` section 6 warns about —
`check-breadcrumb.mjs`'s own `CADENCE` map still holds `'00': 2` against a live cron of `5 * * * *`.
Unchanged this run; it is a `scripts/` edit and outside 00's merge lane.

Three breadcrumbs were on disk. Two — the 0508 and its 0540 addendum — were **already collected and
archived by my predecessor** in #1693; [MEASURED] `git ls-tree -r origin/main` finds both under
`docs/pr-prompts/archive/`, and the loose depth-1 copy of the 0540 addendum hashed `ae4d55aa...`
against `git rev-parse origin/main:<archived path>` = `ae4d55aa...` — identical, so it was deleted
from the dev tree per the post-merge cure. **One was new: `00-04-scanner-2026-09-06-0610`.**

**Dev-tree fast-forward, and it needed the documented two-cause cure.** The FF refused twice:

| attempt | blocker | what it actually was |
|---|---|---|
| 1 | `.arming-log.txt` + `needs-marco/watcher-launcher-chain-...md` locally modified | #1693 had landed the *same* content; `git diff --numstat origin/main` on both → EMPTY |
| 2 | `needs-marco/watcher-launcher-chain-...md` alone, with `git diff --numstat` **EMPTY** | the LF/CRLF smudge, exactly as the station doc's step 2 predicts |

Cured in order: `git show HEAD:<path>` → node write (byte-exact, 7566 and 6426 bytes, read back and
asserted), then `git add --renormalize` + `git update-index --refresh` on the one file that still
refused. `--cached` stayed EMPTY throughout, so the `.arming-log.txt` false-staging trap did not fire
here and no `git restore --staged` was needed. Read-back after the FF, all three as the contract
requires: `git rev-list --left-right --count HEAD...origin/main` → **`0 0`**; `git diff --numstat` →
only `docs/pipeline/sweep-rotation.json` (04's deliberate hand-off, swept into this PR);
`git diff --cached --name-status` → **EMPTY**.

**Fresh needle, minted this run per section 9.6 and now spent by appearing here:**
`zzQq00Needle20260906T0728` → **0** files over `docs/pipeline/**`. Do not reuse it.

## WHAT CHANGED

- **22 `.gitignore:<N>` citations replaced with rule-text anchors** across 8 documents
  (7 station docs plus `STATION-CAPABILITIES.md`), plus `_canonical-blocks.json` re-recorded. F1, F2.
- `docs/pipeline/sweep-rotation.json` — 04's advance (`last_index=3`,
  `last_run_utc=2026-09-06T06:48:33Z`) committed here, because 04 may not commit to the shared dev tree.
- `docs/pr-prompts/archive/00-04-scanner-2026-09-06-0610-....md` — 04's breadcrumb, collected and
  archived in the same PR because every finding in it carries a disposition below.
- `docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` — the F3/F4
  escalation, **force-added** so it is tracked.
- This breadcrumb, written **inside the PR worktree** (REPORT CONTRACT cure 1), so no loose copy is
  left in the dev tree to block the next fast-forward.
- Dev tree fast-forwarded `42aae6be` → `d5d6ad69`; one byte-identical loose breadcrumb deleted.
- **Nothing else.** No prompt armed, disarmed, staged or renamed. No label touched. No `/sot/` edit.
  No watcher restart. No PR merged but this one.

## FINDINGS

### F1 — 04's F1 is ACTIONED, and the fix is deliberately NOT a renumber. **S2.**

Station 04 measured (`00-04-scanner-2026-09-06-0610`, F1) that `.gitignore:107-111` and
`.gitignore:108` had rotted by **+8** — #1573 (`27127f6f`, 2026-09-04) inserted a nine-line block
above the qa sinks and #1576 added one more. The cited lines now read `!Claude Design/assets/` and
friends, so a station checking its own citation finds a **negation** rule, and the available
conclusion is that `docs/qa/qa-findings.md` is *no longer ignored* — i.e. a safe place to report.
That is the failure the paragraph exists to prevent, and it cost this pipeline nine days once.

04's own words on why a renumber is the wrong fix: *"Renumbering is a fix with a half-life: it
re-arms the trap and bills the next run to find it again"* — which is exactly what happened between
2026-08-30 (the first fix, off by one) and today (off by eight).

**[MEASURED] 22 replacements across 8 files, every one byte-delta asserted** (section 9.3 — function
replacers only, never a `$` replacement string; the byte delta is the read-back that can see what a
`$`-spill would add):

| file | hits | bytes | delta | expected | MATCH |
|---|---|---|---|---|---|
| `docs/pipeline/STATION-CAPABILITIES.md` | 1 | 26367 to 26390 | 23 | 23 | yes |
| `docs/pipeline/stations/00-supervisor.md` | 3 | 74684 to 74770 | 86 | 86 | yes |
| `docs/pipeline/stations/01-code-writer.md` | 2 | 20947 to 21010 | 63 | 63 | yes |
| `docs/pipeline/stations/02-board-driver.md` | 2 | 49154 to 49217 | 63 | 63 | yes |
| `docs/pipeline/stations/03-machine-minder.md` | 2 | 24761 to 24824 | 63 | 63 | yes |
| `docs/pipeline/stations/04-scanner.md` | 7 | 40282 to 40461 | 179 | 179 | yes |
| `docs/pipeline/stations/05-sot-keeper.md` | 3 | 33213 to 33344 | 131 | 131 | yes |
| `docs/pipeline/stations/06-pr-master.md` | 2 | 25103 to 25166 | 63 | 63 | yes |

The anchors are now the **names**, which cannot drift when a block is inserted above them:
*"the five files listed under the `# Overnight-QA scheduled task` comment in `.gitignore`"* and, for
the single-file form, *"gitignored by its own literal line in `.gitignore`"*.

Six of the replaced citations sit inside the `station-contract v2` canonical block, so all seven
station docs ship in this one PR and the hash was re-recorded:
`node scripts/pipeline/lint-station.mjs --write-canonical` → `station-contract v2 14e00bdb19f74bef`.
**POSITIVE control that the gate was really doing its job:** before the re-record `lint-station.mjs`
exited **1** with `REJECT: 7 of 8 docs failed`, and all seven reported the *identical* new sha
`14e00bdb19f74bef` — which is itself the proof the block is still byte-identical across all seven.
After the re-record: exit **0**, `ADMIT: all 8 docs clean`.

⚠️ **`.gitignore:75`, `:76`, `:76-83` and `:28` were left alone deliberately.** 04 verified all nine
of those lines individually and they are still correct. Rewriting a correct citation is scope this PR
does not need, and the point of F4 below is that the *class* wants a gate, not a sweep.

**DISPOSITION: ACTIONED** — merged as this run's board PR; verified by `lint-station.mjs` exit 0 and
by re-running the citation inventory over the worktree, which now returns zero `107-111` / `108` /
`107` hits.

### F2 — a NINTH stale citation of the same class, which 04's own instrument could not see. **S3.**

[MEASURED] `docs/pipeline/stations/05-sot-keeper.md:328` cited `.gitignore:127-128` for where
`relationship-map.md` / `.json` are ignored. Lines 127-128 are **comment** lines of the
"Data-model artefacts" block. `git check-ignore -v` on the files themselves — the only form that
answers (section 9.2) — returns `.gitignore:136:docs/data-model/relationship-map.md` and
`.gitignore:135:docs/data-model/relationship-map.json`. Off by **8**: same insertion, same day, same
cause. NEGATIVE controls from the same probe on the same run: `CLAUDE.md` → exit 1, empty.

**Why 04 did not have it, and why that matters more than the line itself.** 04's blast-radius scan
keyed on the literal strings `107-111` / `108`. That is a *value* query, not a *class* query: it
finds the instances of the defect it already knows about and is blind to the same defect at any other
offset. **The instrument that found the class could not enumerate the class.** A grep for a rotted
number can only ever find the rot you have already seen. The class query is
`\.gitignore:\d+(?:-\d+)?` — which is what this run used, and which is why a ninth turned up on the
first re-measurement.

Replaced with rule text in the same PR:
*"(each on its own literal line in `.gitignore`, under the `# Data-model artefacts` comment)"*.

**DISPOSITION: ACTIONED** — same PR, same byte-delta assertion (05-sot-keeper, 3 hits, +131 bytes).

### F3 — the five scheduled bootstraps still carry the stale citation, and they are the layer that actually governs a run. **S3. Marco's.**

04's F1 dispatch had three parts. Part 1 (`docs/pipeline/**`) is F1 above. Part 3
(`sot/04-data-model.md`, 2 citations) is Station 05's alone under CP-24 and is untouched here.
**Part 2 is the bootstraps**: `C:\Users\Marco\Claude\Scheduled\{00,02,03,04,05}\SKILL.md`, one stale
citation each.

Those five files are outside the repo, outside CI, and versioned by nothing.
`STATION-CAPABILITIES.md` section 1 is explicit about which layer an agent fixes: *"prefer the repo
doc — it is the only layer an agent can change, and it is versioned. Then report the drift so Marco
can update the scheduled-task file."* An agent *can* write them (recorded 2026-08-29); doing so would
rewrite the governing layer of five stations in a place where the edit is unreviewable and has no
revert path.

RULE 1, both halves. **Complete-and-additive, and what I recommend: Marco pastes the one-line
replacement into each of the five** — it fixes the instances *and* removes the number, so the next
`.gitignore` insertion cannot re-rot them, and nothing about a run's data entry changes.
Alternative (a), *an agent edits the five directly*: passes "complete", **fails "without damaging"** —
an unreviewable write to the layer that governs every station, with no revert path if the write is
wrong. Alternative (b), *leave them*: fails **both** — the citations stay wrong and re-rot on the next
insertion above them.

The exact replacement, for all five. The sentence already names the five files inline, which is what
keeps this S3 rather than S2:

> `Never one of the five gitignored sinks listed under the "# Overnight-QA scheduled task" comment in .gitignore (docs/qa/qa-checklist.md, qa-findings.md, qa-test-data-registry.md, .qa-run.lock, qa-run-*.md)`

**DISPOSITION: ESCALATED** — written to `docs/pr-prompts/needs-marco/` and **force-added** so it is
tracked (that folder is gitignored by its own literal line in `.gitignore`, which is the 0508 run's
finding). One paste per file, five files, no command to run.

### F4 — 04's F2: the citation class has no gate. **S3.**

04 deferred it and I concur, with its reasoning intact: a gate built before the wording lands would
only assert the numbers. **What changed today is the trigger condition.** 04 wrote that F2 *"becomes
urgent the moment a renumber-style fix is chosen over the rule-text fix"* — F1 chose rule text, so
that trigger did not fire. But F2 above shows the class outran the value query on its **first**
re-measurement, in a file 04's scan had already passed over. So the urgency condition is now:
**the next time any station files a `.gitignore:<N>` finding at all.** A `lint-station.mjs` check
that fails any `<file>:<N>` citation whose cited line does not contain the token the sentence claims
would have caught #1573 in its own CI run.

**DISPOSITION: DEFERRED.** It is a `scripts/` change, outside 00's merge lane, and it is genuinely
better written after the wording fix has settled. It is named for Marco in the same needs-marco file
as F3, as a second item, so the two travel together.

### F5 — 04's F3: `02-board-driver.md` names a worktree root that does not exist. **S4.**

[MEASURED] by 04: the doc names `C:\ProjectOperations-Reference\worktrees`; the parent exists, the
`worktrees` child does not (`Test-Path` → False). 04 suggested folding a one-line fix into this PR
"if 00 is editing that file anyway", and I was.

**I did not take it**, and the reason is not laziness. [MEASURED] the reference is not one line — it
occurs four times inside a **single ~4 KB line** (`02-board-driver.md:376`) that also carries a
SAFETY paragraph about never touching the parent folder and an `rmdir` teardown instruction keyed to
the same path. Changing the worktree root is a **behavioural** change to a station lane, not a
citation fix, and folding it into a PR whose whole claim is "only the wording of citations changed"
would make that claim false. 02 has no schedule and its contract has been folded into 00 since
2026-09-02, so nothing reads this on a timer.

**DISPOSITION: DEFERRED.** It becomes urgent if 02 is ever re-scheduled, or if someone follows the
doc and creates `C:\ProjectOperations-Reference\worktrees` instead of using the mapped roots
(`C:\po-wt`, `C:\po-worktrees`, `C:\po-watcher-worktrees`). It wants its own small PR that moves the
root and the SAFETY wording together.

### F6 — the board was EMPTY, and that is the whole board report. **S4, informational.**

[MEASURED] 0 open PRs and 0 armed prompts at 07:09Z, with the watcher alive and its wrapper up. This
is the first sweep in this run of runs where there was nothing to drive: no DIRTY PR, no red, no
conflict, no behind-branch, nothing routed to Marco waiting, nothing armed and unprocessed.

- **Q1 (every open PR + mergeStateStatus):** the list is empty; **DIRTY count = 0.**
- **Q3 (count the armed prompts yourself):** `armed (*-ready.md): 0`, measured, not quoted.
- **Q6 (the one thing blocking progress):** nothing is blocking the board — **the constraint has
  moved from throughput to supply.** Four prompts were consumed or superseded in the previous two
  hours (#1687 / #1689 / #1690 / #1692), and the queue root's remaining depth-1 prompts are exactly
  the ones section 10.6 warns are duplicates of already-merged second-lane work. I deliberately armed
  nothing — see WHAT I DID NOT DO.

**DISPOSITION: ACTIONED** — reported; no board action was available or needed.

## WHAT I DID NOT DO

- **Did not arm anything, and this is a decision, not an oversight.** The board is empty, which is the
  moment arming looks most attractive. The arming standing block says ask first whether to arm at all,
  and section 10.6 makes a duplicate prompt the expensive failure here: my own predecessor's
  breadcrumb is titled *"four second-lane merges left four armable prompts behind"*, so the depth-1
  `ADMIT` bucket is known to contain prompts whose work is already on `main`. Arming one costs a whole
  watcher run and a PR to discover that. The correct next step is the `scope:`-list cross-check
  section 10.6 prescribes against `gh pr list --state merged` — a full sweep of its own, which did not
  fit inside this run alongside a 22-citation canonical-block change. **Named here so the next run can
  take it as its primary job.**
- **Did not touch `sot/04-data-model.md`** (part 3 of 04's dispatch, 2 citations) — Station 05's alone,
  and CP-24 hard-fails any PR mixing `sot/` with anything else. Surfaced, not touched.
- **Did not edit the five bootstraps** — F3, escalated with the exact text.
- **Did not renumber a single citation.** All 22 became rule text.
- **Did not touch `.gitignore:75` / `:76` / `:76-83` / `:28`** — verified correct by 04, individually.
- **Did not re-investigate `C:/po-vg`, the watcher clone's `dirty=4`, the 28 `needs-marco/` files the
  sweep tags `[STALE]`, or the poller-churn cadence question.** All on file, all 03's or Marco's.
- **Did not run a `marco.:true` probe** — with 0 open PRs there is nothing for it to classify, and a
  probe run against an empty board produces a POS/NEG pair that proves the instrument works and says
  nothing about anything. Stated rather than silently skipped.
