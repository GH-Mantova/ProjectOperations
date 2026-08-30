# Station 04 - Scanner | 2026-08-25T10:09:57Z-2026-08-25T10:22Z

Sweep this run: **instrument-honesty** (rotation position 2 of 4, selected by
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-08-25T06:10:25Z).
Brief: take DOCTRINE section 9 and prove each trap is still trapped. A trap fixed upstream that
still reads as live is itself drift.

## GROUND

```
UTC            2026-08-25T10:09:57Z
origin/main    b968e4f1            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (0 behind, staged index EMPTY, dirty=52)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE. Full read-write authority for this station's lane retained.
Desktop Commander reached the box on the first call (`hostname` = LAPTOP-E6NHU4E4). **This was NOT a
blind run.**

`status-sweep.ps1` verdict at 10:11:03Z: **CAUTION** - no local lock, but #1321 was touched on GitHub
inside the preceding 2 min. Section 0 positive controls both passed (`gh` saw merged #1318, `node`
runs). I am read-only on the board, so CAUTION bound only this breadcrumb write; I mutated nothing
else.

## WHAT I MEASURED

Every line below is `[MEASURED]` at `b968e4f1` unless tagged otherwise. Commands were run through
Desktop Commander on the Windows host (never the Linux VM against the Windows `.git`).

### Section 9.1 - the shell

| Claim | Result | Evidence |
|---|---|---|
| `$` mangled in a `-Command "..."` string | **STILL TRAPPED**, 3 independent hits this run | `Write-Host ('MAJOR=' + $PSVersionTable...)` came back as `'MAJOR=' + System.Collections.Hashtable.PSVersion.Major` -> ParserError; a later `-Command` with `$q=...` died with `The string is missing the terminator` |
| Streamed output pauses on lines starting with `#` | **STILL TRAPPED** | fired unprompted mid-`status-sweep.ps1`: `Process 7196 is waiting for input (detected: "#")` at section 4B. Resumed cleanly with explicit offsets |
| PS 5.1 has no inline `if` expression in interpolation | **NOT REPRODUCIBLE** - see F3 | `PSVersion=5.1.26100.9168`; parser returned 0 errors AND execution printed `text y` |
| Blocked commands (`net`, `sc`, `reg`, ...) | **STILL TRAPPED** | `net session` -> `Error: Command not allowed: net session` |

Negative control for the parser probe: known-bad input `Write-Host ("unclosed` returned
`KNOWNBAD_PARSE_ERRORS=2`, so the detector does report errors when they exist.

### Section 9.2 - git

| Claim | Result | Evidence |
|---|---|---|
| `git ls-tree --name-only <ref> -- <dir>` without `-r` returns ONE line | **STILL TRAPPED** | without `-r`: `COUNT=1`, `LINES=docs/pr-prompts`. Positive control with `-r`: `COUNT=406` |
| `git status` blind to gitignored files | **STILL TRAPPED** | `git status --porcelain -- docs/pr-prompts/pr-crm-winrate-display-ready.md` returned `len=0` while the file was on disk. Control: `git check-ignore -v` -> `.gitignore:75:docs/pr-prompts/*-ready.md`; `git ls-files --others --ignored --exclude-standard` listed 3715 |
| `git fetch origin main` leaves a stale `origin/main` | **[CANNOT MEASURE]** this run | dev tree and origin/main are both `b968e4f1`, 0 behind - the trap needs main to be ahead to show. Not substituted with an inference |
| watcher-clone stash is a closed loop | **CONFIRMED, count corrected** - see F8 | `git -C C:\po-watcher\ProjectOperations stash list` -> `STASH_COUNT=39` |
| dev-tree index is SHARED between chats | no collision this run | `git diff --cached --name-status` empty at 10:10:38Z and again at 10:18:31Z |

Tracked `*-ready.md` at depth 1 on `origin/main`: **0** (via the `-r` query, i.e. the instrument that
works). The board trap is not currently present on main.

### Section 9.3 - files and encoding

- `docs/pipeline/DOCTRINE.md` is BOM-less UTF-8 (`FIRST3BYTES=13,10,45`) and **clean**: strict UTF-8
  decode finds U+2014 at index 30 and **0** U+FFFD.
- `Get-Content -Raw` on that same clean file finds **no** U+2014 and finds the `U+00E2 U+20AC U+201D`
  mojibake signature at index 34. **Reader-side lie STILL TRAPPED.**
- Round-trip, byte-exact (see F4): default `Set-Content` 27008 -> 27010 bytes, `first3=13,10,45`,
  **no BOM**, sha differs. `Set-Content -Encoding UTF8` 27008 -> 27466 bytes, `first3=239,187,191`
  (**BOM**), em dash index `-1`, mojibake signature at 34. **The documented damage needs `-Encoding UTF8`.**
- Double-encode sweep over `docs/pipeline/**/*.md`: 10 files scanned, **1 hit, and it is a false
  positive** - index 23337, inside DOCTRINE section 9.3's own sentence documenting the signature.
  Detector positive control on a synthetic bad file returned `CONTROL_DETECTOR_HITS=1`. **Station docs
  remain byte-clean post-#1308.**

### Section 9.4 - GitHub

- `--jq` quote-stripping: **NOT reproduced.** `gh pr view 1321 -R GH-Mantova/ProjectOperations --json
  labels --jq '.labels[].name'` through `-Command` returned `do-not-merge`, matching the
  `ConvertFrom-Json` control. The standing rule still holds for any jq expression containing `$`,
  because section 9.1's substitution is real.
- **PR #1321 carries `do-not-merge`** (`description: escalates:true - Marco merges this, not
  automation (DOCTRINE 5b)`).
- `gh run list --branch main` staleness: **one anomalous read in thirteen** - see F6.
- MCP-token-cannot-merge: **[CANNOT MEASURE]** - proving it requires attempting a write, which this
  station may not do.

### Section 9.5 - the pipeline's own instruments

- `lint-prompt.mjs` REJECT-when-gh-missing: **NOT REPRODUCIBLE** - see F1.
- ADMIT is necessary-not-sufficient: **CONFIRMED and grown** - see F2.
- `rev-<n>-ready.md` are review jobs: confirmed. `rev-1321-ready.md` first line is
  `Use the pr-fix-reviewer agent to review PR #1321 ...` - prose, no front matter, by design.
- `STOP-WATCHER-LANE2` present by design: **true, but not where a station would look** - see F7.
- Never count or kill by image name: **STILL TRAPPED.** `NODE_EXE_COUNT=24`; the cmdline filter
  `pr-watcher[\\/]index\.mjs` matched **exactly 1**, `WATCHER_PID=29024`.
- Watchdog heartbeat ticks only mid-run: consistent (sweep read `heartbeat age: 1 min`).

### Watcher liveness (the GAP probe, since section 9.5 warns age alone cannot separate idle from wedged)

`.queue-state.json` at `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`
(clone-root copy absent, as expected). Three `ts` samples:

```
10:08:06.845Z  ->  10:13:05.507Z  ->  10:18:07.045Z
GAP 4m58.66s          GAP 5m01.54s
```

Fixed-interval ticking against `RESCAN_INTERVAL_MS`. **Watcher pid 29024 is LIVE and NOT frozen**
[MEASURED 10:18:31Z]. It also consumed work mid-run: `pr-crm-winrate-display-ready.md` was armed at
10:11:03Z and gone by 10:19Z.

### A lead I opened and killed (not a finding)

`status-sweep.ps1` printed `armed (*-ready.md): 1` while I later counted 2 at depth 1, which looked
like the two instruments disagreeing. **Refuted by reading the source.** `status-sweep.ps1:159` globs
`*-ready.md`; the watcher's `READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i` (`index.mjs:94`, used at
`:426` and `:1161`) matches the same set in practice. The discrepancy was 90 seconds of timing:
`rev-1321-ready.md` was written at 10:12:36Z, after the 10:11:03Z sweep. The two counts agree.

## WHAT CHANGED

- Wrote this breadcrumb (tracked path, currently uncommitted).
- Advanced `docs/pipeline/sweep-rotation.json` via `next-sweep.mjs --advance --utc 2026-08-25T10:09:57Z`.
- Nothing else. **No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No label
  changed. No merge. No push.** Scratch `.ps1` probes were written to `C:\po-sup-fix-scripts\` (the
  sanctioned scratch folder), never into the repo; the one temp file I first mis-filed at
  `scripts/pipeline/tmp-04-ground.ps1` is listed under WHAT I DID NOT DO for cleanup.

## FINDINGS

### F1 - `lint-prompt.mjs` no longer REJECTs without `gh`; it now fails QUIET, which is worse (S2)

DOCTRINE 9.5 says: *"`lint-prompt.mjs` reports REJECT when `gh` is merely missing. That is the
instrument failing, not the prompt."* **That is no longer true, and the replacement behaviour
violates DOCTRINE section 7.**

[MEASURED] With `gh` removed from `PATH`, linting `pr-524-rates-b-slice2-canonical-HOLD.md`:

```
WARN   could not probe origin/main:docs/approvals/rates-b-slice2-canonical-approved-by-marco.md
       for file-gate-dead check; skipping.
ADMIT  pr-524-rates-b-slice2-canonical-HOLD.md (size 8)
LINT_EXIT_WITHOUT_GH=0
```

Positive control, same file, same run: `LINT_EXIT_WITH_GH_AGAIN=0`. **The exit code is identical
whether the gate was evaluated or silently skipped.** The WARN goes to the human-readable stream; the
machine-readable signal any caller keys on does not change.

Why this matters more than the stale sentence: DOCTRINE section 7 states *"a tool that cannot run must
FAIL LOUD, never fail quiet. 'I could not measure it' must never silently become 'it measured false'."*
Here "I could not measure the file gate" silently becomes "the file gate passed", on a prompt that
performs an **irreversible legacy-table drop**. A REJECT was annoying and safe. An ADMIT is quiet and
unsafe.

**RULE 1 options.** Complete-and-additive FIRST:

1. **Add a distinct un-measurable outcome.** When any gate probe cannot run, `lint-prompt.mjs` exits
   with a new dedicated code (e.g. 4 = `UNMEASURABLE`) and prints `UNMEASURABLE` rather than `ADMIT`.
   *Complete:* every current and future caller that checks `exit 0` stops treating a skipped gate as a
   pass. *Additive:* no existing prompt, gate or exit code changes meaning; nothing that lints clean
   today lints differently while `gh` is present. **Passes both halves of RULE 1.**
2. Restore the old hard REJECT on missing `gh`. Fails the *additive* half - it also rejects prompts
   whose gates never needed `gh`, so a healthy offline run loses work it could legitimately have done.
3. Leave the WARN and fix only the doc sentence. Fails the *complete* half - the quiet-failure path
   survives, and the next reader of section 9.5 is now correctly informed about a hazard nobody removed.

**DISPATCHED** -> Station 06 (PR Master), to design and stage option 1 against
`scripts/pipeline/lint-prompt.mjs`, plus the section 9.5 correction. Section 9.5 sits inside the
`CANONICAL-BLOCK: instruments v1`, so the doc half must re-record its hash and ship all six station
docs together (`lint-station.mjs` fails otherwise). I did not stage it myself: the exit-code contract
is consumed by callers I did not enumerate this run, and staging a prompt whose blast radius I had not
measured would be exactly the dishonest-`size` defect the ADVERSARIAL PROMPT CRITIQUE section exists to
catch.

### F2 - the do-not-arm blind spot has GROWN: 8 documented, 12 measured, 11 ADMIT (S2)

DOCTRINE 9.5 records *"Measured: 8 prompts carrying one still linted ADMIT, including one that drops
database tables."* [MEASURED] today, over `docs/pr-prompts/pr-*.md` at depth 1 (breadcrumbs excluded):

```
PR_PROMPTS_DEPTH1=62   MARKED_DO_NOT_ARM=12
TALLY  admit(0)=11   reject(1)=0   alreadydone(3)=1   other=0
```

All twelve, with exit codes:

```
exit=0  pr-524-rates-b-slice2-canonical-HOLD.md              <- irreversible table drop
exit=0  pr-arm-lock-s1-serialize-arming-HOLD.md
exit=0  pr-e2e-container-s2-swap-required-job-HOLD.md
exit=0  pr-nav-jobs-projects-merge-HOLD.md
exit=0  pr-ops-m2b-tipping-tab-reminder-HOLD.md
exit=0  pr-rates-s11c-drop-legacy-tables-HOLD.md             <- drops DB tables
exit=0  pr-retire-tenderclientnote-s2-HOLD.md
exit=0  pr-siteid-notnull-backfill-HOLD.md
exit=0  pr-tenant-mt4-s2-ownership-migration-HOLD.md
exit=0  pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md
exit=3  pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md
exit=0  pr-vendor-invoice-ocr-HOLD.md
```

**Zero REJECT.** The doctrine's guidance (read the body before arming) is correct and unchanged; what
has drifted is the number, and the direction of the drift is the point - the marked population grew
50% while the linter's blindness stayed constant. The exit-3 entry is the linter working correctly on
a different axis (premise already satisfied), not the marker being seen.

**DISPATCHED** -> Station 06, folded with F1 (same file, same test surface): teach `lint-prompt.mjs`
to detect `<!-- watcher: do-not-arm -->` and a bare `DO NOT ARM` line and refuse ADMIT. Note for the
prompt author: the two markers are not interchangeable in the corpus, so match both.
**Standing note for Station 00: the arming rule is unchanged and still binding - lint ADMIT is
necessary, not sufficient; read the body.**

### F3 - section 9.1's inline-`if` claim does not reproduce (S3, doc drift)

DOCTRINE 9.1: *"PowerShell 5.1 has no inline `if` expression. `$x = if (...) {...}` parses, but
`"text $(if ...)"` does not."*

[MEASURED] on `PSVersion=5.1.26100.9168`, both halves work:

```
ASSIGN_FORM_WORKS=True
INTERP_FORM_PARSE_ERRORS=0        (source: Write-Host "text $(if ($true) { 'y' })")
CONTROL_PARSE_ERRORS=0            (clean control)
KNOWNBAD_PARSE_ERRORS=2           (negative control - the detector does report real errors)
EXEC_RESULT: printed  text y      (not just parsed - executed)
```

[INFERRED] the original incident was most likely section 9.1's *other* trap wearing this one's
clothes: a `$(if ...)` written inside a `-Command "..."` string has its `$` mangled before PowerShell
ever parses it, which produces a parser error that looks exactly like "PS 5.1 cannot do this".
Two traps, one symptom, and the wrong one got written down.

**DISPATCHED** -> Station 06, to correct section 9.1 in the same canonical-block change as F1/F5.
Not ACTIONED by me: `docs/pipeline/DOCTRINE.md` section 9 is inside `CANONICAL-BLOCK: instruments v1`
and editing it unilaterally trips `lint-station.mjs`.

### F4 - section 9.3's round-trip warning is right about the damage and wrong about the trigger (S3)

DOCTRINE 9.3: *"`Get-Content -Raw` piped to `Set-Content` double-encodes UTF-8 and adds a BOM."*
[MEASURED], byte-exact, on the clean BOM-less `DOCTRINE.md` (27008 bytes):

| Form | bytes | first 3 | BOM | em dash survives | identical to source |
|---|---|---|---|---|---|
| source | 27008 | 13,10,45 | no | yes (U+2014 @ 30) | - |
| `\| Set-Content` (default) | 27010 (+2) | 13,10,45 | **no** | n/a | **no** (sha differs) |
| `\| Set-Content -Encoding UTF8` | 27466 (+458) | **239,187,191** | **yes** | **no** (index -1) | no |

The double-encode-plus-BOM is the **`-Encoding UTF8`** form specifically. The default form adds no
BOM and only +2 bytes - which is the dangerous part, because it looks harmless and still is not
byte-identical. Someone reading the current sentence and then reaching for the *default* form would
believe they had avoided the warning.

The standing instruction is unaffected and still correct: **edit docs and prompts with node, not
PowerShell.** **DISPATCHED** -> Station 06 with F1/F3/F5, to tighten the sentence to name
`-Encoding UTF8` as the double-encode trigger while keeping the default form flagged as lossy.

### F5 - section 9.1 says `$` is "STRIPPED"; it is SUBSTITUTED, and substitution can fail silently (S2)

[MEASURED] `powershell.exe -NoProfile -Command "Write-Host ('MAJOR=' + $PSVersionTable.PSVersion.Major); Write-Host ('LASTEXIT=' + $LASTEXITCODE)"` produced:

```
+ Write-Host ('MAJOR=' + System.Collections.Hashtable.PSVersion.Major); ...
```

`$LASTEXITCODE` did vanish to a bare `+`, exactly as documented. But `$PSVersionTable` was
**expanded to its `ToString()` value** by an outer layer and pasted in as literal text. Section 9.1
describes only the loud shape - a parser error. The substitution shape is the dangerous one: **a
command whose substituted value happens to parse will run, silently, with the wrong value**, and
there is no error to notice. Four of DOCTRINE's own six section-7 lies have precisely that shape.

**DISPATCHED** -> Station 06, same canonical-block change as F1/F3/F4. Mitigation is unchanged and
already correct: anything containing `$` goes in a `.ps1` run with `-File`.

### F6 - `status-sweep.ps1` tags the trunk-CI line `[LIVE]` from a feed with no freshness assertion (S2)

This one began as a near-miss against my own instrument, and I am reporting the near-miss because it
is the honest shape of the finding.

[MEASURED] At 10:14:32Z, `gh run list --branch main --limit 5 --json databaseId,conclusion,status,createdAt,workflowName`
returned a page whose newest row was **2026-08-06T15:41:05Z** - 19 days old - with
`completed/failure CodeQL` and two `queued/` rows. I nearly filed "the trunk feed is 19 days stale".

[MEASURED] **Twelve subsequent reads refuted it.** Three field-list variants (A/B/C, run back to back)
and eight repeats at 400 ms spacing all returned newest = `2026-08-25T09:00:36Z`, `success`,
`sha=b968e4f1` - the current head. `gh version 2.90.0`. The stale page has not reproduced.

So the stale-feed claim is **1 anomalous read in 13**, unexplained, and I am not asserting a cause.
What is not in doubt is the consumer:

```
status-sweep.ps1:85   # is the TRUNK green? ...
status-sweep.ps1:86   $mainci = gh run list --branch main --limit 3 2>$null
status-sweep.ps1:87   $mfail = @($mainci | Select-String -Pattern "failure","cancelled","timed_out" -SimpleMatch).Count
status-sweep.ps1:88   $mok   = @($mainci | Select-String -Pattern "success" -SimpleMatch).Count
status-sweep.ps1:89   Line "LIVE" (... "  <-- TRUNK IS RED" / "  (trunk green)")
```

It substring-counts three rows off that feed and tags the verdict **`[LIVE]`** - the tag this pipeline
treats as authoritative - **with no assertion that the rows describe the current head.** Had the
10:11:03Z sweep drawn the page I drew at 10:14:32Z, it would have printed `TRUNK IS RED` from
19-day-old rows carrying an unrelated CodeQL failure, and every station reading it would have been
correctly obeying a `[LIVE]` line that was three weeks out of date. The truth today, read per-commit:
`repos/GH-Mantova/ProjectOperations/commits/b968e4f1.../check-runs` -> **total 12, success 11,
skipped 1, failure 0.**

**RULE 1 options.** Complete-and-additive FIRST:

1. **Assert freshness before printing the verdict.** Include `headSha` in the `--json` field list and
   compare the newest run's `headSha` to `origin/main`; on mismatch print `[BROKEN] trunk CI feed is
   stale (newest run is <sha>/<age>, head is <sha>)` instead of a `[LIVE]` verdict. *Complete:* the
   line can never again report a confident trunk colour from a page about a different commit, and it
   uses the script's own existing `[BROKEN]` convention, which section 0 already tells readers to stop
   on. *Additive:* no existing output changes while the feed is current; nothing else in the sweep is
   touched. **Passes both halves.**
2. Read trunk health per-commit instead (`commits/<sha>/check-runs`, as used above). Correct, but
   fails the *additive* half in one respect - it silently changes what the line means (head-commit
   checks, not recent workflow runs), so a reader comparing today's output to yesterday's is
   comparing two different measurements without being told.
3. Drop the trunk line. Fails the *complete* half - the question "is main green" is real and would
   simply go unanswered.

**DISPATCHED** -> Station 06 to stage option 1. Note this also satisfies DOCTRINE section 7's standing
guard 1 (positive control) for a line that currently has none.

### F7 - `STOP-WATCHER-LANE2` is present by design, but not where a station would look (S4)

DOCTRINE 9.5: *"`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15. It is not drift."*
True - and the doc names no path. [MEASURED]:

```
C:\ProjectOperations2\STOP-WATCHER-LANE2                     absent
C:\po-watcher\ProjectOperations\STOP-WATCHER*                absent
C:\po-watcher\ProjectOperations\scripts\pr-watcher\STOP*     absent
C:\po-watcher\STOP-WATCHER-LANE2                             PRESENT, 1090 bytes
```

A station checking the dev tree - the obvious place, and the tree every other queue fact lives in -
reads "absent" and can report the by-design sentinel as having gone missing. The sentence exists to
stop exactly that false report and currently cannot.

**DISPATCHED** -> Station 06, one-line addition of the measured path, folded into the F1/F3/F4/F5
canonical-block change so section 9 ships once rather than five times.

### F8 - watcher-clone stash count is 39, not the ~136 carried in project memory (S4)

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` -> `STASH_COUNT=39` at 10:13Z.
Project memory and the section 9.2 note carry *"~136 stashes = a CLOSED LOOP"*. The loop itself is
unrefuted - the launcher still stashes on every start and nothing pops - but the **count has fallen by
roughly 97**, which means something dropped them between the last measurement and now. Section 9.2
asks for *"the count and its growth"*; the growth is currently negative, and nobody recorded the drop.

**ACTIONED** - measured, recorded here, and written to project memory so the next station stops
quoting 136. No repair attempted: pruning the watcher clone is Station 03's lane and this station is
report-only on the machines.

### F9 - eight section-9 traps re-verified as STILL TRAPPED (no change needed)

Folded into one finding because they share a disposition. `ls-tree` without `-r` (1 vs 406 with the
control) - `git status` blind to gitignored (0 output on a file present on disk; `check-ignore` names
`.gitignore:75`) - `Get-Content` false mojibake on BOM-less UTF-8 (source clean under strict decode,
0 U+FFFD) - the `#` streaming pause (fired unprompted) - `$` mangling in `-Command` (3 hits) - blocked
commands (`net session` refused) - never count by image name (24 `node.exe`, exactly 1 watcher by
cmdline) - `rev-*-ready.md` carry no front matter by design.

**ACTIONED** - verified against the current head with controls; DOCTRINE section 9 is accurate on all
eight and needs no change.

### F10 - station docs are still byte-clean; the one scan hit is DOCTRINE's own example (no defect)

10 files under `docs/pipeline/**` scanned by strict UTF-8 decode. `TOTAL_DOUBLEENC_SEQ=1`, at
`DOCTRINE.md` index 23337, inside the sentence *"Its signature is `U+00E2 U+20AC U+201D` (...) for an
em dash"*. Detector proven live by a synthetic control (`CONTROL_DETECTOR_HITS=1`). Zero U+FFFD
anywhere. The #1308 encoding repair is holding.

**ACTIONED** - no defect. Recorded so the next run does not re-open it; the scan needs to exclude
DOCTRINE section 9.3's literal example or it will keep producing this one hit forever.

## WHAT I DID NOT DO

- **Did not run the board-trap commands.** `git checkout .`, `checkout -- <dir>`, `reset --hard`,
  `stash pop`, `git clean` are section 9.2 hard stops; "prove the trap is still trapped" does not
  license firing a trap whose payload is resurrecting consumed prompts.
- **Did not test the device-bridge git trap.** Reproducing it means deliberately leaving a 0-byte
  `index.lock` with no Windows process, which freezes every station until someone clears it. Logged as
  permanently `[CANNOT MEASURE]` by design - the only honest state for a trap you must not spring.
- **Did not test the GitHub-MCP-403 claim.** Proving it needs an attempted write; this station has no
  write authority and a 403 is not worth manufacturing.
- **Did not measure the `git fetch origin main` staleness trap.** It requires `origin/main` to be
  ahead of the dev tree; both are `b968e4f1`. Marked `[CANNOT MEASURE]` rather than inferred.
- **Did not stage a fix prompt.** F1/F2 share one file and one test surface and belong in one prompt,
  but its blast radius is the set of callers keying on `lint-prompt.mjs`'s exit code, and I did not
  enumerate them this run. Staging a prompt with an unmeasured scope is the missed-caller defect the
  station's own ADVERSARIAL PROMPT CRITIQUE section says to flag. Dispatched to 06 with the option set
  written out instead.
- **Did not touch the queue, any PR, any label, or `/sot/`.** Read-only on the board, as the lane says.
- **Did not clean up the 4 orphaned worktrees or the dirty clone** (`dirty=38`) the sweep reported.
  Station 03's lane.
- **Cleaned up after myself.** I mis-filed one scratch probe at `scripts/pipeline/tmp-04-ground.ps1`
  before switching to `C:\po-sup-fix-scripts\`. It was untracked and mine, created this run, so I
  deleted it and read back the absence (`still present? False`). Every other probe
  (`tmp-04-instr-*.ps1`, `tmp-04-trunk.ps1`, `tmp-04-runlist-ab.ps1`, `tmp-04-live3.ps1`,
  `tmp-04-verify.ps1`) lives in the sanctioned scratch folder and never entered the repo.

## FOR STATION 00

1. **Six section-9 corrections to Station 06 as ONE canonical-block change** (F1 doc half, F3, F4, F5,
   F7): section 9 lives in `CANONICAL-BLOCK: instruments v1`, so the hash must be re-recorded and all
   six station docs shipped together or `lint-station.mjs` fails.
2. **Two code fixes to Station 06:** `lint-prompt.mjs` un-measurable exit code + do-not-arm detection
   (F1/F2, one prompt), and the `status-sweep.ps1:86` freshness assertion (F6). RULE 1 option sets are
   written out in each finding.
3. **Correct project memory:** watcher-clone stashes are **39**, not ~136 (F8).
4. **Standing, unchanged:** lint ADMIT is necessary but NOT sufficient - **12** marked prompts now lint
   ADMIT, two of which drop database tables. Read the body before arming.
5. Watcher is **LIVE, pid 29024**, ticking at a 5.00 min interval; it consumed
   `pr-crm-winrate-display-ready.md` during this run. `rev-1321-ready.md` is armed as of 10:12:36Z.
6. This breadcrumb and `docs/pipeline/sweep-rotation.json` are **written but UNCOMMITTED** - sweep them
   into the next board PR. Verified: the breadcrumb path is **not** gitignored (`check-ignore` exit 1,
   controlled against `rev-1321-ready.md` which IS ignored at `.gitignore:75`), `git status` shows it
   as `??`, and the file decodes as strict UTF-8 with 0 U+FFFD, 0 double-encode sequences and no BOM.
   Rotation advanced and read back: `last_index=1`, and the next run will draw **`repo-hygiene`**.
   **If `sweep-rotation.json` is not committed, the next run repeats `instrument-honesty` instead.**

---
Station 04 - Scanner. Sweep `instrument-honesty` complete and rotation advanced. All facts measured
against `b968e4f1` between 2026-08-25T10:09:57Z and 10:22Z unless tagged otherwise.
