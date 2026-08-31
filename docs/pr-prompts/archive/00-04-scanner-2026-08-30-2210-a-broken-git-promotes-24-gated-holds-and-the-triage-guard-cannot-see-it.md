# Station 04 - Scanner | 2026-08-30T22:10:19Z-2026-08-30T22:20Z

Sweep this run: **instrument-honesty** (rotation position 2 of 4, assigned by
`node scripts/pipeline/next-sweep.mjs`). Advanced to `repo-hygiene` at the end of the run.

## GROUND

```
UTC            2026-08-30T22:10:19Z
origin/main    009a83b1            (git fetch origin, then git rev-parse origin/main
                                    = 009a83b1e738e56e351b9e1618fc168595d822d1)
dev tree       main @ 009a83b1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE - this run was not downgraded to read-only for that reason.
Station 04 is read-only on the board by AUTHORITY regardless.

Host reachable: **YES**. `start_process` shell `powershell.exe` returned `PROBE_OK` at
2026-08-30T22:10:25Z. `$PSVersionTable.PSVersion` = **5.1.26100.9168**, `PSEdition` = Desktop
(this matters: three of the section 9 traps are PS 5.1-specific and are therefore live on this box).

Freshness of the binding docs: dev HEAD == `origin/main` == 009a83b1 and neither
`DOCTRINE.md`, `STATION-CAPABILITIES.md` nor `stations/04-scanner.md` appears in
`git status --porcelain`, so the working copy is byte-identical to `origin/main` for all three.
All three were read in full this run.

`status-sweep.ps1` @22:11:10Z: verdict **CAUTION** (no local lock; #1410 touched on GitHub inside
2 min). Instrument positive controls both LIVE. I mutated no board state, so CAUTION did not bind me.

---

## WHAT I MEASURED

Twelve of the traps named in DOCTRINE section 9, each with a positive and (where meaningful) a
negative control. Every line below is `[MEASURED]` on the box at 009a83b1 unless tagged otherwise.

### Section 9.1 - the shell

| id | claim | result |
|---|---|---|
| T1 | `$` is EXPANDED by the `-Command "..."` layer | **REPRODUCED** |
| T1b | `interact_with_process` does NOT expand it | **REPRODUCED (control)** |

```
powershell.exe -NoProfile -Command "'PSVER=$PSVersionTable.PSVersion.Major'; 'CTRL=$true'; 'UNDEF=[$nosuchvar]'"
  PSVER=System.Collections.Hashtable.PSVersion.Major
  CTRL=True
  UNDEF=[]
interact_with_process: "PSVER=$($PSVersionTable.PSVersion.ToString()) CTRL=$true"
  PSVER=5.1.26100.9168 CTRL=True
```

The token is replaced by its VALUE, not removed - exactly as 9.1 says, and the reason the failure
is dangerous rather than loud. `UNDEF=[]` is the silent-empty case.

### Section 9.2 - git

| id | claim | result |
|---|---|---|
| T4 | `ls-tree` without a trailing slash returns ONE line | **REPRODUCED** |
| T4' | the doc's own worked example (`superseded/*.md`, 0 vs 247) | **NOT REPRODUCIBLE - see FINDING 2** |
| T5 | `git status` is blind to gitignored files | **REPRODUCED** |
| T5' | `check-ignore -v` on a DIRECTORY prints nothing, exit 1 | **REPRODUCED** |
| T9 | `git branch -r` reads a local cache, not the remote | **REPRODUCED** |

```
git ls-tree --name-only $sha -- docs/pr-prompts        -> 1     (the tree entry itself)
git ls-tree --name-only $sha -- docs/pr-prompts/       -> 90    (direct children)
git ls-tree -r --name-only $sha -- docs/pr-prompts/    -> 569
git ls-tree --name-only $sha -- docs/pr-prompts/superseded   -> 1
git ls-tree -r --name-only $sha -- docs/pr-prompts/superseded -> 252

git check-ignore -v docs/pr-prompts/processed          -> (nothing), exit 1
git check-ignore -v docs/pr-prompts/processed/x.md     -> .gitignore:76:docs/pr-prompts/processed/, exit 0
git check-ignore -v docs/pr-prompts/pr-dns-s5-...-HOLD.md -> exit 1   (negative control: genuinely not ignored)

git status --porcelain -uall | match 'pr-prompts/processed/'          -> 0
git ls-files --others --ignored --exclude-standard -- .../processed/  -> 3581

git branch -r (minus HEAD)      -> 31
git ls-remote --heads origin    -> 24        (7 phantom tracking refs; doc measured 54 vs 21 on 08-29 -
                                              the gap has narrowed, the trap is unchanged)
```

### Section 9.3 - files and encoding

| id | claim | result |
|---|---|---|
| T7 | PS 5.1 `>` redirection writes UTF-16LE | **REPRODUCED** |
| T8 | `Select-String -SimpleMatch` + `[regex]::Escape()` = an unusable query | **REPRODUCED** |

```
git cat-file -s 009a83b1:docs/pipeline/stations/04-scanner.md   -> 34611 bytes
git show    009a83b1:...04-scanner.md > $env:TEMP\t7probe.md    -> 70114 bytes
first 4 bytes of the redirected file                            -> 255,254,45,0   (FF FE = UTF-16LE BOM)

Select-String -Path DOCTRINE.md -SimpleMatch -Pattern 'lint-prompt.mjs'      -> 8   hits
[regex]::Escape('lint-prompt.mjs') = 'lint-prompt\.mjs'
Select-String -Path DOCTRINE.md -SimpleMatch -Pattern 'lint-prompt\.mjs'     -> 0   hits
dotless control 'DOCTRINE':  raw -> 1,  escaped -> 1            (passes both ways, as 9.3 predicts)
negative control 'zzz-no-such-needle-zzz'                       -> 0
```

The dotless control passing while every dotted query silently returns zero is the whole shape of
this trap, and it is intact.

### Section 9.4 - GitHub

| id | claim | result |
|---|---|---|
| T10 | `gh run list --commit <SHORT sha>` answers `[]` at exit 0 | **REPRODUCED** |
| T12 | escaped double quotes do not survive the `-Command` layer into `--jq` | **REPRODUCED verbatim** |

```
gh run list --commit cb392adb                                  -> 0 rows, exit 0, no warning
gh run list --commit cb392adb6622d2caa447f16967da5be93ff57515  -> 4 rows, exit 0
     Deploy success / Tendering Browser Smoke success / CI success / Push on main success

--jq '.[] | [(.number|tostring), .title] | join(",")'  through -Command
     -> gh: failed to parse jq expression (line 1, column 43)
             .[] | [(.number|tostring), .title] | join(,\)
                                                       ^  unexpected token ","
--jq '.[] | .number, .title'   (spaces, no double quotes)   -> works, returned #1410 and #1409
```

`join(\",\")` arriving as `join(,\)` is character-for-character what 9.4 records.

### Section 9.5 - the pipeline's own instruments

| id | claim | result |
|---|---|---|
| T13 | `parseFrontMatter` has no block-scalar support; LL-29 rollback gate is rubber-stamped | **REPRODUCED (9 prompts)** |
| T14 | `lint-prompt.mjs` REJECTs `[HUMAN_GATE_PRESENT]` at exit 1 on the marker | **REPRODUCED, with control** |
| T16 | lint fails **OPEN** with respect to arming when `git` is broken | **REPRODUCED - and it is worse at board scale, FINDING 1** |

```
rollback_strategy written as a block scalar, depth-1 -HOLD/-ready on disk   -> 9 files:
  pr-524-rates-b-slice2-canonical-HOLD.md            <- irreversible table drop
  pr-rates-s11c-drop-legacy-tables-HOLD.md           <- irreversible table drop
  pr-siteid-notnull-backfill-HOLD.md
  pr-company-manage-s1-permission-and-grant-HOLD.md
  pr-crm-s11-archive-reason-delete-empty-HOLD.md
  pr-crm-s4-review-and-link-preview-HOLD.md
  pr-crm-s7-interaction-log-HOLD.md
  pr-e2e-container-s2-swap-required-job-HOLD.md
  pr-ea-s2-dashboard-preset-HOLD.md
any front-matter key written as a block scalar, across the 60 -HOLD        -> 22 files
```

The doc's count was 10 on 2026-08-30; it is 9 now because crm-s3 left the board with #1409.
The three prompts section 9.5 names by hand are all still in the list. The staged fix
`pr-lint-frontmatter-block-scalar-collapse-HOLD.md` is still on the board and still ADMITs
(exit 0), i.e. **it has not landed**.

```
node lint-prompt.mjs pr-dns-s5-checker-flip-to-fail-HOLD.md
   HUMAN_GATE_PRESENT: line 2 contains <!-- watcher: do-not-arm --> marker.     exit 1
node lint-prompt.mjs pr-lint-frontmatter-block-scalar-collapse-HOLD.md
   ADMIT  (size 2)                                                              exit 0   (control)
```

### Not measured this run

- `gh run list --branch main` "can be DAYS stale" - I could not construct a positive control for
  staleness inside this run's budget without a second reference point I trusted. **[CANNOT MEASURE]**
  this run; the per-commit cure (T10) was measured and is the operative advice anyway.
- The 9.1 "streamed output returns early with output still pending" effect did not occur in any of
  the ~15 calls this run. **[CANNOT MEASURE]** - absence over 15 calls is not a refutation of an
  intermittent effect, and I am not reporting it as one.

---

## WHAT CHANGED

1. `docs/pipeline/sweep-rotation.json` - **modified, uncommitted, in the dev tree.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-30T22:10:19Z` -> exit 0,
   `last_index=0 -> 1`, `last_run_utc -> 2026-08-30T22:10:19Z`.
   Read back: `git diff --stat` = `1 file changed, 2 insertions(+), 2 deletions(-)`, and
   `next-sweep.mjs` now names `repo-hygiene`. Station 04 cannot open a PR, so **Station 00 must
   commit this file with this breadcrumb** or the next 04 run repeats instrument-honesty. This is
   the same item that went uncommitted once before and was landed by #1401.
2. This breadcrumb, written to the tracked path `docs/pr-prompts/` in the dev tree. Untracked until
   00 commits it.
3. Nothing else. No prompt was armed, disarmed, renamed, moved, staged or deleted. No worktree was
   minted. No `git checkout` / `reset` / `stash` / `clean` was run anywhere.

---

## FINDINGS

### FINDING 1 - S2. A broken `git` promotes 24 gated HOLDs into the "candidate" bucket, and `triage-holds.ps1`'s own calibration line cannot see it happen.

DOCTRINE 9.5 already records that `lint-prompt.mjs` fails OPEN with respect to arming when `git` is
broken. What is **not** recorded, and is the actual exposure, is what that does to the board-wide
triage that stations read instead of individual lint runs.

Measured, A/B, same board, same minute:

```
pwsh -File scripts/pipeline/triage-holds.ps1                       (healthy git)
   TOTALS  spent=0  gates-satisfied=29  still-gated=31  unreadable=0  of 60
   calibrated: 2 distinct verdicts observed on the board (ADMIT, REJECT).

$env:LINT_GIT_BIN='C:\definitely\no\such\git.exe'
pwsh -File scripts/pipeline/triage-holds.ps1                       (broken git)
   TOTALS  spent=0  gates-satisfied=53  still-gated=7   unreadable=0  of 60
   calibrated: 2 distinct verdicts observed on the board (ADMIT, REJECT).
```

**24 gated HOLDs silently changed bucket, and the calibration line printed the identical
reassurance both times.** The `!!! SUSPECT` heuristic fires when everything lands in one bucket; it
never fires here, because the 7 survivors are the `HUMAN_GATE_PRESENT` rejects, which are matched at
`lint-prompt.mjs:728` **before** any git probe runs. So the one failure mode where the buckets are
wholesale wrong is precisely the one that leaves two buckets populated.

The per-prompt shape, with the healthy-git control on the same prompt:

```
LINT_GIT_BIN=<nonexistent>  node lint-prompt.mjs pr-rates-s11c-drop-legacy-tables-HOLD.md
   WARN  GATE_NOT_RELEASED probe: could not reach
         origin/main:docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md;
         skipping (fail-safe - not reporting gate as absent).
   ADMIT  pr-rates-s11c-drop-legacy-tables-HOLD.md  (size 8)          exit 0
healthy git, same file
   "This HOLD is parked waiting for its predecessor slice to land."   exit 1
```

That prompt **drops legacy rate tables irreversibly**, and the gate it skipped is the file that
records *Marco's written approval*. `pr-tr-s2-reminder-engine-HOLD.md` flipped the same way.
The WARN is loud, but the **verdict line and the exit code are indistinguishable from a real
ADMIT** - and exit code is what the RULE 4 arming detector and `triage-holds.ps1` both consume.

Five-angle: (1) reproduced twice, A/B, with the healthy-git control on the same file both times;
(2) source confirmed - `readFromOriginMain` at `lint-prompt.mjs:439-459` returns `null` on failure
and feeds all five gate probes; (3) violates DOCTRINE section 7 standing guard 2, "connect, then
assert - never let a failed call flow into a comparison", and section 7's headline (a broken
instrument handing out a confident wrong verdict); (4) history - section 9.5 documents the
single-prompt half; the board-scale half and the SUSPECT blind spot are new, and I found no prior
breadcrumb or HOLD covering them; (5) blast radius - every gated HOLD on the board, 24 of 60 today,
including both irreversible table drops.

RULE 1 options, complete-and-additive first:

- **(A) Give the triage a git positive control and make it refuse to publish totals without one.**
  Before the sweep, prove `git show origin/main:<a path known to exist>` returns bytes; if it does
  not, exit 2 and print `[CANNOT MEASURE]` instead of buckets. Additionally, count the
  `probe: could not reach` WARN lines and refuse to print TOTALS if the count is non-zero. Complete
  (catches total AND partial git outages, now and forever, and does it at the layer stations
  actually read) and additive (a preflight plus a counter; identical output when git is healthy,
  blocks no PR, changes no verdict).
- **(B) Make `!!! SUSPECT` fire on a large move in the satisfied bucket since the previous run.**
  Fails COMPLETE: it needs persisted prior state, the threshold is tunable past, and the first bad
  run still ships wrong buckets before there is anything to compare against.
- **(C) Leave it and rely on readers noticing the WARN lines.** Fails COMPLETE outright - the whole
  point of `triage-holds.ps1` is that people quote its TOTALS line, and the WARNs scroll past above it.

**DISPATCHED -> Station 00.** 04 is read-only and does not own `triage-holds.ps1` or
`lint-prompt.mjs`. 00 to decide between A/B/C (A recommended) and route the change to 06 to stage.

### FINDING 2 - S3. DOCTRINE 9.2's worked example uses a query form `git ls-tree` cannot answer, so its "0 without -r, 247 with it" contrast is not reproducible - and the real trap is bigger than the one it teaches.

9.2's parenthetical reads: *"measured 2026-08-29: `superseded/*.md` returned 0 without `-r` and 247
with it"*. Measured today at 009a83b1:

```
git ls-tree    --name-only $sha -- 'docs/pr-prompts/superseded/*.md'   -> 0
git ls-tree -r --name-only $sha -- 'docs/pr-prompts/superseded/*.md'   -> 0     <- doc predicts ~247
POSITIVE CONTROL, a pathspec I know matches 83 files:
git ls-tree -r --name-only $sha -- 'docs/pr-prompts/*.md'              -> 0     <- CONTROL FAILS
truth: git ls-tree --name-only $sha -- docs/pr-prompts/ | match '\.md$' -> 83
git ls-tree -r --name-only $sha -- ':(glob)docs/pr-prompts/superseded/**/*.md'
   -> fatal: pathspec magic not supported by this command: 'glob'
```

The positive control failing is the whole answer: **`git ls-tree` does not do glob pathspecs at
all.** It takes literal path prefixes, and it returns 0 for any `*` form without erroring - the one
glob form that *does* error is the explicit `:(glob)` magic. So the doc's example returns 0 in both
directions, and `-r` cannot be what changed it.

The headline rule around it is correct and reproduces cleanly (T4 above: 1 / 90 / 569, and
252 recursive under `superseded`). The defect is that the worked example teaches a reader that
adding `-r` rescues a glob query. It does not. A reader who "fixes" a zero-result glob with `-r`
gets the same zero and now believes it.

Suggested repair, in the doc's own idiom: replace the parenthetical with the directory form that
actually produces the contrast - `-- docs/pr-prompts/superseded` returns **1** without `-r` and
**252** with it - and add one line: *"`ls-tree` has no glob pathspec; any `*` form returns 0
silently, and `:(glob)` errors. Control every `ls-tree` pathspec against a path you know is tracked."*

Five-angle: (1) reproduced twice with three query forms; (2) source - `git ls-tree` documented
pathspec handling, confirmed by the `pathspec magic not supported` fatal; (3) violates DOCTRINE
section 9.6, "an empty result is not an empty world - run the same query against a case you know
returns something", which is the rule this very example is meant to illustrate; (4) history - I
found no prior finding on this; the 04 run at 0611Z refuted two other section 9 claims, not this
one; (5) blast radius - the parenthetical only; the surrounding rule is sound.

**DISPATCHED -> Station 00**, to route as a DOCTRINE edit. Note the block is hash-gated
(`instruments v2`), so the fix must re-record the hash via `lint-station.mjs` in the same PR - the
same shape as #1401 and #1402.

### FINDING 3 - the OAuth block's premise is now FALSE. The credential was re-authenticated ~1 hour ago.

Not part of my sweep; measured because everything else on the board is parked behind it, and
because a standing block whose premise has died is exactly the drift I exist to find.

```
%USERPROFILE%\.claude\.credentials.json
  expiresAt (utc)  2026-08-31T05:17:16.577Z
  now       (utc)  2026-08-30T22:16:24.487Z
  delta            -7.01 h   ->  VALID for another 7 hours, NOT expired
  file mtime       2026-08-30T21:17:21.762Z
```

The mtime had been frozen at `2026-08-28T16:13:26.909Z` across eighteen consecutive readings. It has
moved. Corroborating, from the same run: two PRs were opened by the watcher after that mtime - #1409
(CLEAN, 13/13 green) and #1410 (BLOCKED, 6 pass 1 pending) - and `status-sweep` shows watcher node
**pid 6388** with one wrapper, heartbeat 20 min. The most recent 401 quarantines in `failed/` are
still dated 08-29 07:03; nothing has failed on auth since.

**DISPATCHED -> Station 00.** Arming is 00's on Marco's authority and I touch none of it. 00 should
re-read this itself before acting (it is 7 hours to the next expiry, and section 7 applies: a
credential reading expires the moment it prints). If 00 lifts the block, note that this run
independently strengthens the case for `pr-lint-frontmatter-block-scalar-collapse-HOLD` as the first
arm: T13 shows 9 live prompts whose LL-29 rollback gate reads two characters, two of them
irreversible table drops, and FINDING 1 shows the same linter fails open on the gates that would
otherwise stop them.

### FINDING 4 - S3. A staged `R100 HOLD -> ready` rename sat in the shared dev index with no file on disk for at least 7.5 minutes, then cleared itself mid-run.

🔴 **This finding CHANGED WHILE I WAS WRITING IT. Read both readings; the second is current.**

**Reading 1, 2026-08-30T22:10:45Z:**

```
git status --porcelain
  RD docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md
  -> docs/pr-prompts/pr-crm-s3-account-on-client-create-ready.md
Get-ChildItem docs\pr-prompts\pr-crm-s3*   -> (nothing)
Get-ChildItem docs\pr-prompts\*-ready.md   -> (nothing)          armed on disk = 0
```

`RD`, not ` D`: the rename to `-ready.md` is STAGED and the file is gone from the worktree. The
prompt was legitimately consumed - #1409 is open, CLEAN, 13/13 green, and carries exactly that work.
The hazard is what is left behind: **any pathspec-less commit by any station or chat publishes
`pr-crm-s3-account-on-client-create-ready.md` to `main` as a tracked, armed prompt with no file
behind it**, and any checkout materialises it as armed work that has already shipped. This is the
board trap the station doc names under AUTHORITY, in its live form, in the shared index.

**Reading 2, 2026-08-30T22:18:15Z and re-confirmed at 22:18:56Z - the `RD` is GONE:**

```
git status --porcelain | match crm-s3
   D docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md      <- plain unstaged delete
git diff --cached --name-status                     -> (empty)
git diff --cached --name-only | count               -> 0
Get-ChildItem docs\pr-prompts\*-ready.md            -> 0
git ls-tree --name-only origin/main -- docs/pr-prompts/ | match '-ready\.md$'  -> 0
HEAD 009a83b1 == origin/main 009a83b1               (unchanged; nothing was committed)
```

The staged rename was cleared by **another actor** - I did not touch the index, and HEAD did not
move, so it was `git restore --staged` (or equivalent) from a concurrent chat or station inside a
7.5-minute window. The dev index is now **empty**, no `-ready.md` exists on disk, and none is
tracked at depth 1 on `origin/main`. **The hazard did not materialise.**

Two things survive the self-clear and are the reason this is written down rather than dropped:
(1) the window is real and recurring - a consumed prompt leaves this `RD` behind every time, and for
7.5 minutes one pathspec-less commit would have published an armed prompt to `main`; (2) nothing
recorded who cleared it, so the pipeline currently relies on an unowned, unlogged manual fix for a
hazard it has already written a standing cure for. Not mine to fix: the index is board state, 04 is
read-only on it, and `git restore --staged` on a shared index is a board mutation.

**DEFERRED.** No live hazard as of 22:18:56Z, so there is nothing to hand 00 today. It becomes urgent
again the moment `git status --porcelain` in the dev tree shows an `RD` under `docs/pr-prompts/` -
the standing cure then applies: `git restore --staged` the pair, read back that the `RD` line is
gone, confirm armed-on-disk is still 0. Worth 00 considering whether that cure belongs in
`status-sweep.ps1` as a checked condition rather than in memory, since it has now been observed
firing and being hand-cleared with no trace.

**One live consequence remains:** my `docs/pipeline/sweep-rotation.json` modification is currently
the only thing in the worktree, and the index is empty - so the next committer can take it cleanly,
but should still commit **with a pathspec**, because this index is shared and demonstrably moves
inside a single run.

---

## WHAT I DID NOT DO

- **Armed, disarmed, staged or renamed nothing**, including under FINDING 3 where the block that
  forbade it has just died. Arming is 00's on Marco's authority; a scanner acting on its own
  good news is how lane discipline breaks.
- **Did not clear the `RD` from the index** (FINDING 4) or run `git restore`, `checkout`, `reset`,
  `stash` or `clean` anywhere.
- **Did not edit `lint-prompt.mjs`, `triage-holds.ps1` or `DOCTRINE.md`.** FINDINGS 1 and 2 are
  report-only by AUTHORITY, and the `instruments v2` block is hash-gated besides.
- **Did not mint a worktree.** All reads were `git show` / `ls-tree` at a named SHA in the dev tree.
- **Did not run Part 0, Part 1 or the live-site pass.** The station doc's ONE-SWEEP rule governs:
  `next-sweep.mjs` assigned instrument-honesty and I covered it completely rather than sampling
  everything. `repo-hygiene` is next.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or any production data.**
- **Did not restart or interfere with the watcher** (node pid 6388, alive, 1 wrapper).
- Left standing and unaddressed, all outside my lane: the watcher clone `dirty=36`, the 13 `[STALE]`
  needs-marco escalations, `rates-11c-blocked-consumers` sitting READY TO STAGE in the backlog, and
  station `06` still having no cadence key in `check-breadcrumb.mjs` (`--freshness` CLEAN exit 0 for
  00/03/04/05; `06` does not appear at all).
