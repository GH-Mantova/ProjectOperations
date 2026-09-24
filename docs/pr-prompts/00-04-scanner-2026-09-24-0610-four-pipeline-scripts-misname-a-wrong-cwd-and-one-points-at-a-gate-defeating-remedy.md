# Station 04 - Scanner | 2026-09-24T06:10:39Z-2026-09-24T06:25Z

## GROUND

```
UTC            2026-09-24T06:10:39Z
origin/main    ffcc9506            (fetched, then rev-parse)
dev tree       main @ ffcc9506     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions AGREE - this run had full authority, not read-only.

**Sweep this run: `instruction-drift`** (rotation position 4 of 4; previous run
2026-09-24T02:20:05Z). Advanced to `last_index=3`, `last_run_utc=2026-09-24T06:21:32Z`.
Next sweep is `gate-liveness`.

## WHAT I MEASURED

**Host reachable.** [MEASURED] `start_process` shell `powershell.exe` ->
`HOSTPROOF ... 2026-09-24T16:10:12` (local, Brisbane UTC+10) and
`Test-Path C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` -> `True`. **This was a SIGHTED run.**

**vm-git-guard: exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself and not from a pipeline appended to it. Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/friendly-blissful-bell/.local/bin:$PATH" git <args>
```

This is the EXPECTED station outcome per the contract, not an anomaly. A FINDING, not a STOP.
No `git` was run against the mount at any point in this run.

**Binding documents read from `origin/main`, in the dev tree.** [MEASURED] blob identity, no pipe
(section 9.1 forbids the piped hash form in PowerShell):

| path | `git rev-parse origin/main:<path>` | `git hash-object <working copy>` |
|---|---|---|
| `docs/pipeline/DOCTRINE.md` | `49797da3` | `49797da3` |
| `docs/pipeline/STATION-CAPABILITIES.md` | `d9a02d88` | - |
| `docs/pipeline/stations/04-scanner.md` | `1dce3b9a` | `1dce3b9a` |

`git diff --numstat origin/main -- <all three>` EMPTY. All three read in full (DOCTRINE 2841 lines,
STATION-CAPABILITIES 579, 04-scanner 567).

**Tree clean.** [MEASURED] `git rev-list --left-right --count HEAD...origin/main` -> `0 0`;
`git diff --numstat origin/main` EMPTY; `git diff --cached --name-status` EMPTY;
`git status --porcelain --untracked-files=no` EMPTY.

**status-sweep.ps1 section 7 verdict:** `[LIVE] SAFE TO ACT: no board mutation in progress, no
recent remote activity, no live station worktrees.` Section 0 instrument positive controls PASSED
(`gh CAN reach GitHub (saw merged PR #2151)`). Trunk `[LIVE] main CI on ffcc9506: 4 success /
0 failed (trunk green)`. `armed (*-ready.md): 0`. Watcher node RUNNING pid 38776. No `index.lock`
in either tree. Captured through a `cmd` redirect, not PowerShell `>` - the file read back
**69,308 bytes, first two bytes `53 54`** (ASCII `ST`, not `FF FE`) and **0 U+FFFD**, so section
9.3's UTF-16LE redirection trap did not fire on this capture.

**The sweep's `watcher clone: branch=main dirty=2 <-- ... may refuse to start` line is the
DOCUMENTED false warning**, not a new finding - DOCTRINE section 9.5 records that `status-sweep.ps1`
counts untracked files while `start-watcher.ps1` does not, and that a tracked-dirty clone
auto-stashes rather than refusing. Recorded so the next run does not re-dispatch it to Station 03,
which archived runs have done 13 times.

**Live scheduled tasks, from the MCP (never from a document).** [MEASURED] four ENABLED -
`00-supervisor` `5 * * * *`, `03-machine-minder` `0 9 * * *`, `04-scanner` `0 */4 * * *`,
`05-sot-keeper` `10 0 * * *`; `weekly-security-audit` **`enabled: false`**, last run
2026-09-06T21:32:44Z. This MATCHES `STATION-CAPABILITIES.md` section 1's 2026-09-15 correction -
no drift in that row. Corpus stated as the RULE, not as a count: 11 `SKILL.md` exist under
`C:\Users\Marco\Claude\Scheduled`, 4 sit behind an enabled task.

**Bootstrap-vs-station-doc parity: CLEAN, all four.** [MEASURED]

| task | bootstrap `station_doc_version` | repo doc | points at | bootstrap mtime |
|---|---|---|---|---|
| `00-supervisor` | 1 | 1 | `00-supervisor` | 2026-09-22T20:26:23Z |
| `03-machine-minder` | 1 | 1 | `03-machine-minder` | 2026-09-01T00:07:44Z |
| `04-scanner` | 1 | 1 | `04-scanner` | 2026-09-01T00:07:44Z |
| `05-sot-keeper` | 1 | 1 | `05-sot-keeper` | 2026-09-01T00:07:44Z |

All seven station docs carry `station_doc_version=1`, `contract_version=5`.

**`lint-station.mjs`: `ADMIT: all 8 docs clean`, exit 0**, run from the repo root.

**Citation resolution over the corpus as the RULE states it** (4 enabled bootstraps + 7 station docs
+ `DOCTRINE.md` + `STATION-CAPABILITIES.md` + `CLAUDE.md` = **14 files**), dotfile-tolerant regex with
the 2026-09-21 time-of-day guard: **26 citations**. NEGATIVE control, freshly minted needle
`zzQq04Needle20260924T0620` -> **0 of 14**; POSITIVE control `DOCTRINE` -> **14 of 14**.

**The first pass was wrong in the documented direction and was caught by the documented cure.**
A line-EXISTENCE probe printed 4 `FILE-NOT-FOUND` (`pr-gates.mjs:327`, `ensure-watcher.ps1:10`,
`build-relationship-map.mjs:18-19`, one duplicate) and 22 `ok`. **All four were my resolver's search
path being too narrow, not rotted citations** - a wide basename search found
`scripts/pr-gates/pr-gates.mjs` (657 lines), `scripts/data-model/build-relationship-map.mjs` (578),
and `C:\po-watcher\ensure-watcher.ps1` (108, outside the repo entirely, which is why a repo-only
resolver missed it). Equally, the escalation's own warning - *"`IN RANGE` is not `RESOLVES`"* - applies
to the 22 `ok`: I re-ran asking what each cited line **says**.

**Cited line CONTENT, measured:**

| citation | line content | verdict |
|---|---|---|
| `.gitignore:28` | `.claude/` | correct |
| `.gitignore:75` | `docs/pr-prompts/*-ready.md` | correct |
| `.gitignore:76-83` | the 8 gitignored queue folders | correct |
| `.gitignore:107-111` | `!Claude Design/docs/` ... `!Claude Design/proposed/` | **WRONG - see F2** |
| `start-watcher.ps1:160` | `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { ... "tests-docs" }` | correct |
| `CLAUDE.md:19` | the section 10 second-lanes sentence | correct |
| `ensure-watcher.ps1:10` | `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'` | correct |
| `pr-gates.mjs:327` | `// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).` | **WRONG - see F2** |

True location of the five QA sinks: **`.gitignore:115-119`**, under the `# Overnight-QA scheduled
task` comment at **113**. CP-24's load-bearing lines in the dev tree's 657-line `pr-gates.mjs`:
comment opens **321**, `const sotRe` **329**, `const codeRe` **330**, the FAIL report **338**.

**cwd-relative state paths in `scripts/pipeline`** (the F1 measurement). 23 `.mjs`/`.js` scanned;
**5 constants** are string literals rooted at a repo directory and passed straight to an `fs` call:

| script | line | constant |
|---|---|---|
| `check-breadcrumb.mjs` | 22 | `DIR = 'docs/pr-prompts'` |
| `check-pipeline-heartbeat.mjs` | 42 | `PAUSE_FILE = 'docs/pipeline/pause.json'` |
| `check-pipeline-heartbeat.mjs` | 47 | `DIR = 'docs/pr-prompts'` |
| `lint-station.mjs` | 20 | `STATION_DIR = 'docs/pipeline/stations'` |
| `next-sweep.mjs` | 18 | `FILE = 'docs/pipeline/sweep-rotation.json'` |

**Behaviour from a non-repo cwd vs the repo root, both measured in the same minute:**

| script | from `%TEMP%` | exit | from repo root | exit |
|---|---|---|---|---|
| `next-sweep.mjs` | `REJECT docs/pipeline/sweep-rotation.json is missing - the rotation has no state` | 1 | prints the sweep | 0 |
| `check-breadcrumb.mjs` | `REJECT docs/pr-prompts does not exist` | 1 | `CLEAN`, `structure: 2 checked` | 0 |
| `lint-station.mjs` | `REJECT docs\pipeline\stations\_canonical-blocks.json is missing - run: node scripts/pipeline/lint-station.mjs --write-canonical` | 1 | `ADMIT: all 8 docs clean` | 0 |
| `check-pipeline-heartbeat.mjs` | `SKIP: docs/pr-prompts not found - run from the repo root.` | **2** | `[heartbeat] ALIVE` | 0 |

**Nothing fails silently** - every wrong-cwd call exits non-zero. The defect is in what the messages
SAY, and `check-pipeline-heartbeat.mjs` is the positive control proving the repo already knows how
to word it.

**`lint-station.mjs` has a silent-empty path behind that guard.** [MEASURED] from source, line 105:
`if (!existsSync(STATION_DIR)) return [];` - a missing station directory yields **zero docs to lint**
rather than an error. Today it is masked by the `CANON_FILE` existence check at line 203, which fires
first and exits 1. That ordering is what makes the observable failure loud; it is not a designed
guard on the empty path. The in-repo run prints a count (`all 8 docs clean`), which is the read-back
that would expose a 0.

**`lint-station.mjs` advisory noise, measured** (the F3 evidence): `[A-Za-z]:\\[sdwSDWbB]` over
`DOCTRINE.md` returns **exactly 2** - line 928 `e:\s` (from the regex `/^scope:\s*\n.../m`) and
line 1477 `r:\s` (from `watcher:\s*do-not-arm`). Both are regex literals being read as drive paths.

## WHAT CHANGED

**On the board: nothing.** Station 04 is read-only on the board. Nothing was armed, disarmed,
renamed, moved, deleted, merged, labelled or pushed. No PR was opened. No prompt was staged this
run - I found no ready work needing one, and the two live findings are `scripts/` repairs that are
outside my lane to author as arming-ready work.

**In the dev tree, two files are left DIRTY and Station 00 must commit them:**

1. `docs/pipeline/sweep-rotation.json` - advanced to `last_index=3`,
   `last_run_utc=2026-09-24T06:21:32Z`, via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-24T06:21:32Z`, exit 0. Read back
   with `--status`: `last_index=3 | last_run=2026-09-24T06:21:32Z`, `-> NEXT [0] gate-liveness`.
   **If this is not committed, the next run repeats `instruction-drift` and the rotation stops.**
2. **This breadcrumb**, at
   `docs/pr-prompts/00-04-scanner-2026-09-24-0610-four-pipeline-scripts-misname-a-wrong-cwd-and-one-points-at-a-gate-defeating-remedy.md`
   - UNTRACKED until a board PR commits it. Its filename matches no watcher glob, so leaving it in
   the queue root arms nothing.

Nothing else in the dev tree was written. All scratch scripts for this run were written to `%TEMP%`,
never into the repo.

## FINDINGS

### F1 - Four of the five cwd-relative state paths in `scripts/pipeline` name the WRONG CAUSE when a station runs them from the shell it is actually given, and `lint-station.mjs`'s message points at a remedy that DEFEATS the canonical-block hash gate. The 2026-08-28 deferral's own stated trigger has now fired. S3.

**Angle 1 - reproduced twice.** Both wrong-cwd and repo-root columns of the table above were run in
the same minute, and `next-sweep.mjs` was independently hit live at the very top of this run before
I was looking for it.

**Angle 2 - the defect is in code, read from source.** `next-sweep.mjs:18`
`const FILE = 'docs/pipeline/sweep-rotation.json'` resolved against `process.cwd()`; the header
comment says *"Run from the repo root"* but the failure message does not repeat it and instead
asserts a fact about the world: *"is missing - the rotation has no state, so 'rotate' cannot mean
anything"*. Same shape at `check-breadcrumb.mjs:22`, `lint-station.mjs:20`,
`check-pipeline-heartbeat.mjs:42,47`.

**Angle 3 - the violated rule.** DOCTRINE section 9.4's CWD bullet measured that Desktop Commander
opens its shell in the Cowork session's `outputs` folder, which is not a git repository, and that
following section 9.1's `-File` cure moves a script out of the repo and arms the trap. That bullet is
scoped to `gh`. **Its generalisation to this pipeline's own scripts is not written down anywhere**,
and `04-scanner.md` orders `node scripts/pipeline/next-sweep.mjs` with no cwd precondition attached.

**Angle 4 - history, and this is the load-bearing angle.** This is **not new**. It is F3 of
`docs/pr-prompts/archive/00-04-scanner-2026-08-28-1410-instruction-drift-the-governing-layer-carries-the-false-claim.md`,
dispositioned **DEFERRED** with an explicit trigger, quoted verbatim:

> *"It becomes urgent the moment `next-sweep.mjs` is called from a wrapper or a scheduled action
> rather than typed by an agent that happened to be in the repo root."*

**That trigger fired today, 27 days later.** My first call was
`node C:\ProjectOperations2\scripts\pipeline\next-sweep.mjs` from a `cmd /c` whose cwd was the
Cowork session's outputs folder - a scheduled action, not an agent standing in the repo root - and
it returned `REJECT ... is missing`. A run that believed that message would conclude the rotation
has no state and would then either pick its own sweep, which `04-scanner.md` explicitly forbids
(*"Which one is NOT your choice"*), or skip the sweep - and the rotation stops silently either way.
**A deferral whose named trigger has occurred is no longer deferred; that is why this is filed
rather than left.**

**Angle 5 - blast radius.** 5 constants across 4 scripts, listed in the table above. Two of the four
scripts are ones the station contract names as authorities: `check-breadcrumb.mjs` is *"the one
validator"* for breadcrumbs, and `lint-station.mjs` gates the canonical blocks in CI.

**The specific hazard that makes this worth more than a message tidy-up.** `lint-station.mjs`'s
wrong-cwd message is `... _canonical-blocks.json is missing - run: node scripts/pipeline/lint-station.mjs --write-canonical`.
A reader who takes that at face value, `cd`s into the repo and runs `--write-canonical` would
**re-record the canonical block hashes** (line 196, `writeFileSync(CANON_FILE, ...)`) over whatever
the station docs currently contain - silently blessing any drift in the hash-gated blocks, for a
fault that was only a wrong working directory. The file's own internal message elsewhere says
*"run --write-canonical **deliberately**"* (line 138); the wrong-cwd message drops that word.

**RULE 1, both halves, on the three options:**

1. **Resolve all five from the module's own location** -
   `fileURLToPath(new URL('../../docs/...', import.meta.url))`. **Complete and additive:** the
   scripts work from any cwd, no caller changes, no state file touched, no station instruction has
   to be rewritten, and the class cannot recur when the next script is added with the same habit.
   `check-breadcrumb.mjs` and `check-pipeline-heartbeat.mjs` already import
   `fileURLToPath`/`import.meta.url` for other purposes, so the pattern is in-repo already.
2. *(fails the "future" half)* **Fix only the four messages** to name the cwd, the way
   `check-pipeline-heartbeat.mjs` already does. Honest and cheap, but the next script written with a
   relative constant re-arms the class, and `lint-station.mjs`'s `--write-canonical` suggestion needs
   removing on its own merits either way.
3. *(fails both halves)* **Leave them.** The citations stay misleading, the rotation stays one
   wrong-cwd call away from stopping, and the deferral's trigger has already fired once.

**DISPATCHED - Station 00.** The repair is `scripts/pipeline/**`, which is outside Station 04's
read-only lane *and* outside Station 00's recorded `docs/` lane per `STATION-CAPABILITIES.md`
section 5's 2026-09-22 narrowing, so 00 cannot merge it either - it needs Marco. What I am handing
over is the diagnosis, the five exact sites, the measured wrong-cwd behaviour of each, the
positive-control wording already in the repo, and option 1 as the complete-and-additive form.
**Falsifying probe: the two-column table above.** Re-run all four scripts from a non-repo cwd and
from the repo root; if any of them ever names the cwd as the cause without being changed, this
finding is spent.

### F2 - The four ENABLED bootstraps still cite `.gitignore:107-111` for the QA sinks, which are at 115-119; and the `05-sot-keeper` bootstrap still carries `pr-gates.mjs:327`, which the repo doc retired to a symbol anchor on 2026-09-10 and which now lands on CP-24's carve-out comment rather than its block. Already open with Marco, day 18. S3.

**Angle 1/2 - measured, twice, and the content checked rather than the range.**
`.gitignore:107-111` holds the `Claude Design` negation block; the five sinks are at **115-119**
under the `# Overnight-QA scheduled task` comment at **113** - off by exactly eight, exactly as the
escalation recorded on 2026-09-06 and re-confirmed on 2026-09-22. All four enabled bootstraps carry
it at their line 87; `05-sot-keeper`'s bootstrap line 63 additionally carries `pr-gates.mjs:327`.

**What is NEW in this run is the second half's drift.** `docs/pipeline/stations/05-sot-keeper.md`
no longer contains `pr-gates.mjs:327` at all - it carries the symbol anchor
`` `const sotRe = /^sot\//` `` instead, so DOCTRINE section 9.5's 2026-09-10 discharge is TRUE of the
repo layer. **The bootstrap copy never got that fix**, and the bootstrap is the layer that actually
governs a scheduled run (`STATION-CAPABILITIES.md` section 1). Meanwhile the citation has drifted
underneath it: in the dev tree's 657-line `pr-gates.mjs`, line **327** is
`// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).` - the comment explaining that
`docs/**` is deliberately **NOT** treated as code, i.e. the CARVE-OUT - while the sentence citing it
claims *"CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or `apps/` fails"*, whose actual
lines are 329/330/338. In ten of the eleven `pr-gates.mjs` copies on this machine (worktrees at 473
and 515 lines) line 327 is `const codeRe = ...`, which is what the citation was true against.
**So the citation is not merely stale, it now points at the exception to the rule it is cited for.**

**Angle 4 - history.** Both halves are inside
`docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, which is
live, actively maintained, and whose own tail records *"ITEM 1 status at 2026-09-22: still entirely
unactioned, day 16"*. **Today is day 18.** ITEM 1 is the five pastes; ITEM 2 asks for a
`lint-station.mjs` citation check and already names the `pr-gates.mjs:327` class among its
"30 suppressed citations". That file also carries the exact warning my first probe walked into -
*"`IN RANGE` is not `RESOLVES`, and any check built on range alone certifies this class as
healthy"* - and it was right: my range-only pass printed `ok` for all four bootstrap citations.

**DEFERRED - already with Marco, nothing for a station to do.** The bootstraps are outside the repo,
outside CI and versioned by nothing; `STATION-CAPABILITIES.md` section 1 rules that an agent reports
this drift rather than rewriting that layer, and the escalation's own RULE-1 analysis reaches the
same place. What this run adds, and what Station 00 should fold into the escalation rather than
re-file: **the true target is `.gitignore:115-119`** (unchanged since 09-06, so the +8 has not moved
again), and **`pr-gates.mjs:327` has now rotted past its region**, which strengthens ITEM 2 from
"tidy the citations" to "one of them inverts its own sentence". It becomes urgent if a station ever
acts on the `.gitignore` citation instead of the inline filenames beside it.

### F3 - `lint-station.mjs`'s Windows-path advisory fires on regex literals, so its clean run prints warnings that cannot be actioned. S4.

[MEASURED] the exit-0 `ADMIT` run emits `! names a Windows path outside the known folder map:` for
`e:\s` and `r:\s`. Those are not paths: `[A-Za-z]:\\[sdwSDWbB]` over `DOCTRINE.md` returns exactly
**2** hits - line 928 `/^scope:\s*\n((?:\s*-\s*.+\n)+)/m` and line 1477 `watcher:\s*do-not-arm`.
The detector reads `<letter>:\` as a drive root, and a regex of the shape `word:\s` satisfies it.
Three further warnings on that run (`C:\\Foo\\Bar`, `C:\\ProjectOperations2\\docs\\pipeline`,
`C:\po-scan-`, `C:\po-`) are DOCTRINE and the station docs quoting path patterns as documentation -
the same *"a probe pointed at section 9 measures the documentation"* shape section 9.6 closes with.

**Why it is worth a line at all rather than nothing:** the escalation above (ITEM 2) is asking Marco
to build a citation check **into this same script**, and its own stated risk is that *"a gate that
fails scores of times on its first run is disabled by its first reader"*. This advisory is already
training readers to skim past `!` lines in `lint-station.mjs` output. Excluding a match whose
preceding character is a word character, or requiring a path separator run, removes both classes.

**DEFERRED** - real, cosmetic today, and it costs nothing until ITEM 2 is built. It becomes worth
doing **in the same change as ITEM 2**, not before, and it should be handed to whoever writes that
check rather than shipped on its own.

## WHAT I DID NOT DO

- **Did not commit or push anything.** The rotation advance and this breadcrumb are left dirty in
  the dev tree, named above, for Station 00. Station 04 is read-only on the board and the dev tree
  is on `main`, which nobody commits to directly.
- **Did not stage a prompt.** My budget is 2; I used 0. F1 and F3 are `scripts/pipeline/**` repairs
  that need Marco to land, so staging a `-HOLD` would put work in the queue that no lane can merge.
- **Did not run `git` through the device bridge against the Windows `.git`** at any point. The guard
  reported INERT (exit 2), so the ban was remembered rather than mechanical; every `git` call in this
  run went through Desktop Commander on the Windows host.
- **Did not mint a worktree.** `origin/main` was read with `git show` / `git rev-parse` in the dev
  tree, per the AUTHORITY section's supersession of the 2026-07-15 clean-tree recipe.
- **Did not touch Azure / Entra / SharePoint**, production data, `/sot/`, any label, or any
  `*-ready.md`.
- **Did not run the live-site pass (Part 2) or the Dependabot pass (Part 1c).** The rotation gives
  one named sweep per run and this run's was `instruction-drift`; covering it completely is the
  instruction, and a shallow pass over everything else is what the rotation exists to prevent.
- **Did not re-file the sweep's `watcher clone dirty=2` line** as a Station 03 dispatch - it is the
  documented false warning in DOCTRINE section 9.5 and is recorded under WHAT I MEASURED instead.
- **Did not re-file F2 as a new escalation.** It is 18 days open with Marco; adding a second file
  for the same subject is the duplication section 10.5 and the collect channel both warn about.
- **Did not use `Measure-Object -Line`, `git ls-tree` without `-r`, `--json number` alone,
  `Filename -Unique`, or a backslash-bearing needle crossing PowerShell into `node -e`.** Every
  count in this report was taken in node from a script on disk, with a freshly minted negative
  control per probe - `zzQq04Needle20260924T0620`, `...B...T0625`, `...C...T0632`, `...D...T0638`,
  `...E...T0645`, all 0 - and a positive control that passed. **Those five needles are now spent.**
