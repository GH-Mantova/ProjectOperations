# Station 04 - Scanner | 2026-08-26T22:09:45Z-2026-08-26T22:18:12Z

## GROUND

```
UTC            2026-08-26T22:09:45Z
origin/main    549537a4              (fetched with +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 7ad50697       C:\ProjectOperations2   (8 behind origin/main, NOT fast-forwarded)
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE. Full authority run.

Sweep taken this run, from `node scripts/pipeline/next-sweep.mjs`: **`instrument-honesty`**
(rotation position 2 of 4; previous run 2026-08-26T18:11:12Z). Advanced to `repo-hygiene` at
2026-08-26T22:18:12Z and read back.

`status-sweep.ps1` VERDICT at 2026-08-26T22:10:15Z: **SAFE TO ACT** - no board mutation in
progress, no recent remote activity. Backlog: `ready=1 needs-marco=2 blocked=4 broken=0`.

## WHAT I MEASURED

Every line below is `[MEASURED]` at origin/main `549537a4`, git **2.55.0.windows.3**, PowerShell
**5.1.26100.9168**, unless tagged otherwise. Probe scripts kept at
`C:\po-sup-fix-scripts\s04-instrument-honesty-{,b-,c-,d-}2026-08-26.ps1`.

### DOCTRINE section 9, claim by claim

| # | Claim | Verdict |
|---|---|---|
| 9.1 | `$` stripped from `-Command "..."` | **REPRODUCES** |
| 9.1 | streamed output pauses on `#` lines | **trigger NOT reproduced** (pause phenomenon is real) |
| 9.1 | PS 5.1 has no inline `if` expression | **FALSE** |
| 9.1 | blocked commands (`net`/`sc`/`reg`/`netsh`/...) | **REPRODUCES** |
| 9.2 | `ls-tree` without `-r` returns ONE line | **REPRODUCES, hard** |
| 9.2 | `git status` blind to gitignored files | **REPRODUCES** |
| 9.2 | plain `git fetch origin main` leaves the ref stale | **FALSE on git 2.55** |
| 9.2 | watcher-clone stash is a closed loop | **REPRODUCES** (39 vs 11) |
| 9.3 | `Get-Content` reports FALSE mojibake | **REPRODUCES, decisively** |
| 9.3 | edit docs with node, not PowerShell | **REPRODUCES** (both halves) |
| 9.4 | `--jq` quotes stripped, prints `labels=[]` silently | **wrong mechanism AND wrong failure mode** |
| 9.4 | `gh run list --branch main` can be days stale | **not reproduced this run** (conditional claim) |
| 9.4 | MCP token cannot merge (403) | `[CANNOT MEASURE]` - testing it means merging |
| 9.5 | `lint-prompt.mjs` REJECTs when `gh` is missing | **FALSE, and inverted** |
| 9.5 | `rev-<n>-ready.md` have no front matter | `[CANNOT MEASURE]` - zero on disk at depth 1 |
| 9.5 | `STOP-WATCHER-LANE2` present by design | **REPRODUCES** |
| 9.5 | never count/kill by image name | **REPRODUCES** (18 node.exe, 1 watcher) |

Not tested **by design**, because the test IS the damage: `git checkout .` / `reset --hard` /
`stash pop` / `git clean` in the dev tree (9.2), and VM-side git against the Windows `.git` (9.2).

### The four that failed, with their evidence

**9.5 - `lint-prompt.mjs` with `gh` off PATH.** Not a REJECT. A WARN and an **ADMIT, exit 0**:

```
gh present : ADMIT  pr-524-rates-b-slice2-canonical-HOLD.md  (size 8)   exit 0
gh absent  : WARN   ... could not probe origin/main:docs/approvals/
                    rates-b-slice2-canonical-approved-by-marco.md for file-gate probe; skipping.
             ADMIT  pr-524-rates-b-slice2-canonical-HOLD.md  (size 8)   exit 0
```

The doc warns of a false REJECT. The truth is a **false ADMIT with the approval file-gate silently
waived** - on a prompt that drops database tables. Control: `gh` restored, resolves again at
`C:\Program Files\GitHub CLI\gh.exe`.

**9.1 - inline `if` on PS 5.1.26100.9168.** Both forms work:
`$assigned = if ($true) { "ASSIGN-OK" }` -> `ASSIGN-OK`;
`"interp=$(if ($true) { 'SUBEXPR-OK' })"` -> `interp=SUBEXPR-OK`.

**9.2 - plain fetch DOES move the remote-tracking ref.** Probed on a second remote with the default
refspec so the config matches `origin` exactly; probe removed and removal verified:

```
refs/remotes/s04probe/main BEFORE plain fetch : []
git fetch s04probe main
refs/remotes/s04probe/main AFTER  plain fetch : 549537a407b8...
```

**9.4 - the `--jq` trap.** Spaces survive; escaped double quotes do not, and the failure is LOUD:

```
--jq '.headRefName'                        -> feat/ew-2b-allocation-engine-core   (positive control)
--jq '.labels'                             -> []   (a TRUE empty; #1343 has no labels)
--jq '[.labels[].name] | join(\",\")'      -> failed to parse jq expression (col 25): join(,\)
--jq 'if .headRefName then \"X\" else ...' -> failed to parse jq expression (col 22): \X\
```

The pipe and the spaces reached column 25. Only the `"` characters were eaten, leaving orphaned
backslashes. **I could not reproduce the silent `labels=[]` form the doc describes.**

### The strong traps, with controls

- **`ls-tree` without `-r`:** 1 line (`docs/pr-prompts`) vs **440** with `-r`; **0** `*-ready.md`
  vs **167**. A filter over the no-`-r` result reports zero, exactly as documented.
- **`git status` blind:** wrote `docs/pr-prompts/zz-s04-probe-ready.md`; `git status --porcelain`
  returned **0 lines**; positive control `git check-ignore -v` named **`.gitignore:75`**. Probe
  removed, removal verified.
- **`Get-Content` false mojibake:** `Get-Content -Raw` reports **45** `a-hat-euro` sequences in
  `DOCTRINE.md`; node reading the same bytes as UTF-8 finds the signature on **1 line - line 362,
  which is the doc's own deliberate example of the signature.** So the file has **zero accidental
  double-encoding** and the reader invented 44 hits. Negative control: a known-ASCII file returned 0.
- **Encoding on write:** `Set-Content` (default) wrote an em dash as a single CP1252 byte -> `U+FFFD`
  on a UTF-8 read. `Out-File -Encoding utf8` wrote a **BOM** (`EF BB BF`). Both halves of 9.3 stand.
- **Image-name counting:** **18** `node.exe`; exactly **1** matches `pr-watcher[\\/]index\.mjs` -
  **pid 29024, started 2026-08-24T05:35:04Z**. Unchanged PID since the 20:09Z reading, so the
  watcher has not been relaunched and the clone's code is the running code. Corroborated
  independently: stash counts flat at clone **39** / dev **11**.
- **Sentinels:** `STOP-WATCHER-LANE2` present at `C:\po-watcher` only (by design). No
  `STOP-WATCHER` at any of the three paths.
- **Blocked commands:** `reg query "HKLM\..."` -> `Error: Command not allowed`.

### Board state, measured in passing

- **Open PRs: 1.** `#1343 feat(ew-2b): allocation engine core - AllocationService`,
  `labels=[]` (a TRUE empty - proven by the non-empty `headRefName`/`title` from the same query).
  That is the prompt Station 00 armed at 20:09Z; it ran and opened its PR.
- **Trunk GREEN [MEASURED] per-commit**, not from `gh run list`:
  `gh api repos/.../commits/549537a4.../check-runs` -> **13 check-runs, 0 non-success/skipped/neutral**.
- **Armed on disk at depth 1: exactly 1** - `pr-lessons-folder-s2-unfold-sot05-ready.md`.
  RULE 4 (one at a time) is being honoured.
- **Tracked `*-ready.md` on origin/main at DEPTH 1: ZERO.** The BOARD TRAP does not currently fire.
  All 167 tracked ready-files live under `docs/pr-prompts/processed/` and
  `docs/pr-prompts/superseded/cleared-*` - committed before those folders were ignored. Historical,
  not a live defect.

## WHAT CHANGED

Three things, all in the working tree, **nothing committed and nothing pushed**:

1. **Staged one prompt:** `docs/pr-prompts/pr-doctrine-s9-four-false-traps-HOLD.md`.
   Lints **ADMIT, exit 0, no WARN**. Encoding read back with node: `bytes=8909, BOM=false,
   U+FFFD=0, double-encoding=0`. Premise proven executable through the shell `gate-eval.mjs`
   actually uses (`C:\Program Files\Git\bin\bash.exe`, confirmed present): premise exits **0 =
   still needed**, and a negative control against an impossible string exits **1**. Carries the
   exact standing-authority literal. **It is HOLD. I armed nothing.**
2. **`git add` of that one file, pathspec-scoped.** Index read back before and after: the three
   pre-existing `R100` rename entries are untouched; my file appears as a single `A` row. Done so
   the HOLD is armable - an untracked HOLD cannot be armed, because `git mv` refuses an untracked
   path.
3. **Advanced the sweep rotation** to `repo-hygiene`
   (`next-sweep.mjs --advance --utc 2026-08-26T22:18:12Z`), read back. `docs/pipeline/sweep-rotation.json`
   is ` M` and **deliberately uncommitted** - `next-sweep.mjs` reads the working tree, so the next
   run gets the right answer, and Station 00 sweeps the file up with this breadcrumb.

This breadcrumb and the staged prompt are **untracked/uncommitted until Station 00 commits them.**

## FINDINGS

### F1 - DOCTRINE 9.5's lint-prompt claim is INVERTED: a false ADMIT, not a false REJECT. S2.

A missing `gh` does not produce the safe, loud failure the doctrine promises. It produces an ADMIT
identical to a healthy one, with every `origin/main:` file-gate silently skipped. The measured case
is `pr-524-rates-b-slice2-canonical-HOLD.md`, whose skipped gate is its **Marco-approval file** and
whose payload is **dropping database tables**. Any station that reads section 9, sees "a REJECT may
be the instrument", and therefore treats ADMIT as trustworthy has the risk exactly backwards.

**DISPATCHED** to Station 00: arm `docs/pr-prompts/pr-doctrine-s9-four-false-traps-HOLD.md` (already
`git add`ed, lint ADMIT, premise live with controls, no `do-not-arm` marker, no approvals gate, docs
-only so CP-24 is not engaged). It carries the replacement wording for this bullet and for F2-F4.

### F2 - Three further section 9 claims are measured FALSE. S3.

PS 5.1 inline `if` (works), plain `git fetch <remote> <branch>` (does move the ref on git 2.55), and
the `--jq` bullet (right that something breaks, wrong about both the mechanism and the failure mode).
A false bullet is not merely useless: it costs every station a workaround, and it discredits the true
bullets beside it - and section 9 is the document stations are told to read *before trusting any
output*. **DISPATCHED** to Station 00, folded into the same prompt as F1.

### F3 - Two of these were measured false 20 hours ago and never landed. S2, process.

Station 04's 2026-08-26T02:10Z run already refuted the inline-`if` and lint-`gh` claims. Both are
still in `DOCTRINE.md` at `549537a4`. The correction was written into a breadcrumb and project
memory, and neither channel edits the repo - a DOCTRINE fix needs a PR, and no run staged one.
This is the reporting chain closing at "reported" instead of "corrected".
**ACTIONED this run** by staging the PR-shaped fix rather than re-reporting the measurement.

### F4 - The shared index holds two rename entries for prompts already consumed off disk. S3.

`git diff --cached --name-status` carries three `R100` HOLD->ready renames. Two of them -
`pr-ew-s2b-alloc-engine-core` and `pr-sot-02-reconcile-2026-08-19` - have **no file on disk under
either name**: the watcher consumed them (`#1343` is `ew-s2b`'s PR). A commit taken without a
pathspec would land those renames as **tracked `*-ready.md` at depth 1**, which is precisely the
BOARD TRAP: any later checkout re-arms executed work.

**DISPATCHED** to Station 00, which owns the index and the commit: commit with an explicit pathspec,
and clear the two dead rename entries rather than carrying them forward. Do **not** `git checkout`
the deletions - that resurrects consumed prompts.

### F5 - Two section 9 claims could not be exercised this run. S4.

`rev-<n>-ready.md` front matter (zero on disk at depth 1) and the GitHub MCP 403-on-merge (testing
it means attempting a merge). Neither is evidence of anything. **DEFERRED** - they become urgent only
if a station reports behaviour contradicting them.

### F6 - The `#`-pause trigger in 9.1 did not reproduce. S4.

A five-line script whose output includes `# heading` and `## heading` streamed through complete,
sentinel and all. The *phenomenon* is real - output paused mid-stream during my own batch D on a line
that was not a heading - so the operational advice ("keep calling `read_process_output` with explicit
offsets until `0 remaining`") is correct and I needed it. Only the stated trigger is wrong.
**DEFERRED** - not folded into the F1 prompt, because I have the counter-example but not the true
trigger, and replacing one wrong mechanism with another is how section 9 got here.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, moved nothing.** One HOLD staged; `pr-lessons-folder-s2-unfold-sot05-ready.md`
  left exactly as found.
- **Did not commit or push.** The staged prompt, this breadcrumb and `sweep-rotation.json` are all
  working-tree only, by design - Station 00 owns the commit.
- **Did not fast-forward the dev tree** (8 behind `origin/main`). FF is a board mutation and requires
  the watcher stopped; the watcher is alive (pid 29024) and mid-lane on `#1343`.
- **Did not run `restart-watcher-if-wedged.ps1`.** Station 03's lane, and the cheaper working probe -
  PID identity across runs - already answered the question.
- **Did not test the destructive section 9 traps** (`checkout .`, `reset --hard`, `stash pop`,
  `clean`, VM-side git against the Windows `.git`). Reproducing them IS the damage they document.
- **Did not run Part 0 static audit or Part 2 live-site patrol.** The station doc's one-named-sweep
  rule governs, and the rotation named `instrument-honesty`; a shallow pass over everything is the
  failure that rule exists to prevent.
- **Did not touch `sot/`, Azure, Entra or SharePoint.**
