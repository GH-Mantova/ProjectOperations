# Station 04 — Scanner | 2026-09-07T14:10:38Z–2026-09-07T14:20:34Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, `next-sweep.mjs`).

## GROUND

```
UTC            2026-09-07T14:10:38Z
origin/main    f9815d11            (fetch --prune first, then rev-parse)
dev tree       main @ f9815d11     C:\ProjectOperations2   (fast-forwarded from f7f112f8 this run)
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   => MATCH, run is not read-only-by-mismatch
```

SIGHTED. `start_process` shell `powershell.exe` returned pid 35008 first try, after a keyword
`ToolSearch` for `desktop-commander` (schemas arrive deferred; a cold call is an unloaded schema,
not blindness).

Device-bridge git guard, quoted as the contract requires — last line of
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Binding documents read in full this run from the dev tree at `f9815d11`, where
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/04-scanner.md` returned **EMPTY** — i.e. the working copies ARE
`origin/main`'s blobs (the sound form; no piped hash was taken — §9.1).

Fresh needle minted for this run: `zzQq04Needle20260907T1415`. **It is spent the moment this file
is committed — the next run mints its own.**

## WHAT I MEASURED

**Sweep verdict.** `status-sweep.ps1` captured to a file (it returns early and hides its own §7
verdict otherwise): `[LIVE] SAFE TO ACT`, `SWEEP COMPLETE 2026-09-07 14:11:58Z`. 4 open PRs
(#1777 #1775 #1774 #1767), armed 0, watcher node RUNNING pid 31660, backlog `ready=1 needs-marco=2
blocked=4 broken=0`. [MEASURED] I mutated nothing on the board, so the verdict was not spent.

**Corpus.** Every `SKILL.md` behind an ENABLED task in the scheduled-tasks MCP — the rule
`STATION-CAPABILITIES.md` §1 now carries — not "the five". [MEASURED] the MCP returns **5 enabled
tasks** (`00-supervisor`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`,
`weekly-security-audit`) while `C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` files.

**Version parity — all four station bootstraps MATCH.** [MEASURED]
`C:\po-sup-fix-scripts\04-drift-bootstraps-20260907.mjs`:

| task | bootstrap `station_doc_version` | repo doc | verdict |
|---|---|---|---|
| 00-supervisor | 1 | `stations/00-supervisor.md` = 1 | MATCH |
| 03-machine-minder | 1 | `stations/03-machine-minder.md` = 1 | MATCH |
| 04-scanner | 1 | `stations/04-scanner.md` = 1 | MATCH |
| 05-sot-keeper | 1 | `stations/05-sot-keeper.md` = 1 | MATCH |
| weekly-security-audit | (none) | names no repo station doc | n/a — not a station |

All seven repo station docs declare `station_doc_version: 1` / `contract_version: 1`.

**`lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0**, plus `ADMIT .claude/agents/*.md
(9 agent definitions, encoding clean)`. Its only NOTE is the known contract-v3-vs-doc-v1 field
mismatch already filed as `needs-marco/lint-station-compares-the-wrong-version-field-2026-09-05.md`.

**Path resolution — CLEAN.** [MEASURED] `04-drift-paths-20260907.mjs` over DOCTRINE,
STATION-CAPABILITIES, all 7 station docs and the 5 enabled bootstraps: **459** repo-relative and
**162** Windows-absolute path mentions scanned. 28 + 6 raw non-resolving, **every one hand-checked
and every one a false positive**: filename *prefixes* from templates (`docs/pr-prompts/00-04-`,
`docs/pr-prompts/pr-qa-`), shorthand ranges (`sot/01/02/03/05/06`), brace forms my regex truncated
(`docs/data-model/relationship-map.{json,md}` — both files present), files a doc tells you to CREATE
(`apps/web/.env.local`, `C:\ProjectOperations-Reference\worktrees`; the parent
`C:\ProjectOperations-Reference` `Test-Path` → **True**), gitignored-by-design state
(`docs/qa/.qa-run.lock`), a deletion the doc itself documents
(`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`), and DOCTRINE's own deliberate absences
(`C:\Foo\Bar`, `C:\po-watcher\STOP-WATCHER`, `zzzNoSuchNeedleZzz`). Controls: POSITIVE
`docs/pipeline/DOCTRINE.md` tracked=true; NEGATIVE `docs/pipeline/zzQq04Needle20260907T1415.md`
tracked=false. **No binding document names a path that has gone away.**

**`.gitignore` line citations — repo side all correct, bootstrap side all wrong.** [MEASURED]
`04-drift-gitignore-20260907.mjs`, `.gitignore` = 151 lines:

| citation | who cites it | what that line actually holds | verdict |
|---|---|---|---|
| `.gitignore:28` | STATION-CAPABILITIES, 01 | `.claude/` | ✅ |
| `.gitignore:75` | DOCTRINE, 00, 05 | `docs/pr-prompts/*-ready.md` | ✅ |
| `.gitignore:76-83` | DOCTRINE(:76), 00–06 | the eight queue sinks, exactly | ✅ |
| `.gitignore:107-111` | **bootstraps 00, 03, 04, 05** | `!Claude Design/docs/` … `!Claude Design/proposed/` | 🔴 WRONG |

The five overnight-QA sinks are at **115–119**, under the `# Overnight-QA scheduled task` comment at
**113**. 19 citations of the class in total across the corpus.

**The general `<file>:<N>` class — nobody had queried it, and it is 22-of-23 clean.** [MEASURED]
`04-drift-linecites-20260907.mjs`. Verified landing on what their sentence claims:
`start-watcher.ps1:160` → the `PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs"` assignment ·
`pr-gates.mjs:327` → the CP-24 `sotRe`/`codeRe` block · `build-relationship-map.mjs:18-19` → the
"generated JSON/MD are gitignored" comment · `ensure-watcher.ps1:10` →
`$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'`. **One rots — see F2.**

**The four station bootstraps are ONE template.** [MEASURED] `04-drift-bootdiff-20260907.mjs`,
normalising away station identity: each is **76** non-blank lines, and each differs from
`00-supervisor` by exactly **4 lines in and 4 lines out** — the title, the cadence sentence, the
lane sentence and the one station-specific rule. **72 of 76 lines are common.** That is the
structural reason a single stale phrase reached four live stations at once, and it is why a fix
pasted into one file fixes nothing.

**Cadence, bootstrap vs live cron (MCP).** [MEASURED] 04 `0 */4 * * *` vs "every 4 hours" ✅ ·
05 `10 0 * * *` vs "daily" ✅ · 03 `0 9 * * *` vs "every 4 hours" 🔴 (already filed,
`needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`) ·
**00 `5 * * * *` = hourly vs `SKILL.md:8` "Cadence: every 2 hours" 🔴 — see F1.**

**`check-breadcrumb.mjs` CADENCE map re-measured** (it is state): `const CADENCE = { '00': 2,
'02': null, '03': 24, '04': 4, '05': 24 };`, NEGATIVE control 0. Still unfixed; already filed.

**Three stations inside 165 seconds, again.** [MEASURED] `lastRunAt`: 00 `14:08:30.188Z`,
04 `14:10:09.113Z`, 05 `14:11:15.657Z`. The open cron-offset escalation
(`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md`) reproduces on today's board.

**A rare controlled blind/sighted pair, ~100 seconds apart on one machine.** [MEASURED] 00's
14:09Z breadcrumb is titled `…-1409-blind-run-collect-only-…`; this run, starting 14:10:38Z on the
same host, reached PowerShell first try. `STATION-CAPABILITIES.md` §2's *"blindness is intermittent
and its cause is not known"* is confirmed by the tightest pair yet measured. **No action — recorded
so the next reader does not re-derive it.**

**Other instruments, run because they were cheap and this sweep is about rot.**
`check-lessons.mjs` → `holding=5 regressed=0 broken=0`, exit 0. `check-escalations.mjs` →
`open=0 resolved=3 broken=0`, exit 0.

**Escalation ITEM 2 probe (`gitignore-citations-…-2026-09-06.md`): the gate is still not built.**
[MEASURED] over `scripts/pipeline/lint-station.mjs`: `gitignore:` 0 · `citation` 0 ·
`lineCitation` 0 · `cited line` 0; POSITIVE control `station_doc_version` **4**; NEGATIVE control 0.

**`docs/qa/sot-refs-baseline.json` is tracked on `origin/main`** — `git cat-file -e` exit 0;
negative control absent. The station docs' claim that the `docs/qa/` *directory* is tracked stands.

## WHAT CHANGED

Nothing on the board. No prompt armed, staged, renamed, moved or deleted; no PR opened, labelled,
rebased or merged; no `sot/` file touched; nothing pushed.

Two writes, both intended and both named here:

1. **This breadcrumb**, untracked in the dev tree at `docs/pr-prompts/`. It reaches nobody until a
   board PR commits it — **Station 00, please sweep it up.**
2. **`docs/pipeline/sweep-rotation.json`, advanced and LEFT DIRTY** by
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-07T14:10:38Z`. 04 may not commit
   on `main`; **Station 00 commits it.** If it is not committed the next run repeats
   `instruction-drift` and the rotation stops.

Scratch scripts, all read-only, outside the repo in `C:\po-sup-fix-scripts\`:
`04-drift-bootstraps-20260907.mjs`, `04-drift-paths-20260907.mjs`,
`04-drift-gitignore-20260907.mjs`, `04-drift-linecites-20260907.mjs`,
`04-drift-bootdiff-20260907.mjs`, `sweep-04-20260907-1410.txt`.

Dev tree fast-forwarded `f7f112f8` → `f9815d11` before any triage (`git diff --numstat` and
`--cached` both EMPTY beforehand; `merge --ff-only`). Read-back: `HEAD` = `origin/main` =
`f9815d11`.

## FINDINGS

### F1 — Station 00's bootstrap still says "every 2 hours"; its cron is hourly, and this is the THIRD home of that stale number, not the second

[MEASURED] `C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md:8` reads *"You are Station 00 of
the ProjectOperations ERP pipeline. Cadence: every 2 hours."* The scheduled-tasks MCP returns
`cronExpression: "5 * * * *"`, `nextRunAt 2026-09-07T15:07:52Z` against `lastRunAt
2026-09-07T14:08:30Z` — **hourly**.

`STATION-CAPABILITIES.md` §6 corrected its own table in #1670 and named **two** homes for the wrong
number: that table and `check-breadcrumb.mjs`'s `CADENCE` map. It did not name the bootstrap. Today's
escalation `needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`
likewise names only the `CADENCE` map, and offers *"(b) move 00 to every 2 hours, **which is what its
own instruments already assume**"* — an argument that is stronger than its author knew, because the
layer §1 calls *"the one that governs a scheduled run"* assumes it too.

Why it matters in escalation #23's direction: the bootstrap is the opening user turn of every 00 run.
A run told it fires every 2 hours has no reason to notice a missing hourly occurrence, and the 12:08Z
occurrence that vanished today is exactly that failure. Both surviving homes are outside 00's own
merge lane — one is the scheduled-task layer (Marco's, unversioned, no CI), one is `scripts/`.

**S3.** It cannot corrupt data and it breaks nothing today; it removes the ability to notice a loss.

RULE 1 on the options, complete-and-additive FIRST:

- **(a) Fix the number in BOTH surviving homes and stop storing cadence in either.** The bootstrap
  sentence becomes *"Cadence: read it from the scheduled-tasks MCP"* — the rule
  `STATION-CAPABILITIES.md` §6 already states in red — and `check-breadcrumb.mjs` reads `lastRunAt`
  and the cron from the MCP rather than a hard-coded map. **Complete**: no home holds a number that
  can rot, so the next cadence change cannot re-open this. **Additive**: nothing about any run's
  data entry changes; the freshness check gets stricter, never looser. *Passes both halves.*
- **(b) Renumber both to `1` / hourly.** Passes *additive*; **fails *complete*** — it is the same
  fix with a half-life the `.gitignore` renumber already demonstrated, and it re-arms the trap.
- **(c) Move 00 to a 2-hour cron so the documents become true.** Fails *complete* — the 126-minute
  run recorded in that escalation still overruns a 2-hour slot — and it decides a live open question
  by side effect.

**DISPOSITION: ESCALATED** — to Marco, as an addendum to
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`, which
this measurement strengthens rather than replaces. The bootstrap edit is Marco's by
`STATION-CAPABILITIES.md` §1 (*"prefer the repo doc … then report the drift so Marco can update the
scheduled-task file"*); the `check-breadcrumb.mjs` half is a `scripts/` change already filed.
**Falsifying probe:** `Select-String -Path 'C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md'
-Pattern 'Cadence'` against `cronExpression` from the MCP. If they agree, this finding is dead.

### F2 — one repo-side line citation has rotted, and it is the only one in the whole corpus

[MEASURED] `docs/pipeline/stations/05-sot-keeper.md:245` reads:

> This paragraph said **26** until 2026-08-31, when the real figure was **14**; `CLAUDE.md:19`
> carried the same stale number and was fixed for the same reason in #1408.

`CLAUDE.md:19` today holds *"lanes**: a cloud session or any other actor that opens a PR without the
watcher. §10.1 is a safety"* — DOCTRINE §10 second-lane prose, with no number in it. The sentence
that once carried the count now lives at **`CLAUDE.md:26`** and correctly carries no number at all
(*"the count lives in that file, never here"*).

Blast radius: **1 of 23**. Every other `<file>:<N>` citation in DOCTRINE, STATION-CAPABILITIES and
the seven station docs lands on what its sentence claims (listed under WHAT I MEASURED, with the
four resolved by hand). So this is a single rotted anchor, not a class failure — but it sits inside
the paragraph whose whole point is *"the count lives in that file — never in this sentence"*, and it
is the same defect one clause later. It is also invisible to the value query
`gitignore:\d+` that the standing escalation prescribes, which is that escalation's ITEM 2 in
miniature.

I did not touch it: it is a `sot/`-adjacent station doc and 05's own, and §9.5's cure is to replace
the number with an anchor, not to renumber it (a renumber is true until the next insertion above it).
The correct replacement names no line: *"…`CLAUDE.md` carried the same stale number and was fixed
for the same reason in #1408."*

**S4** — it is a historical anecdote, not an operating instruction, so nothing acts on it; the cost
is a reader who checks the citation, finds §10 second-lane prose, and distrusts the paragraph.

**DISPOSITION: DISPATCHED → Station 05 (SoT-keeper)**, whose doc it is, to drop the `:19` in its next
doc-reconcile PR. It is one clause and needs no PR of its own. **Falsifying probe:**
`Select-String docs\pipeline\stations\05-sot-keeper.md -Pattern 'CLAUDE\.md:19'` — zero hits means it
landed.

### F3 — Station 00's 14:09Z breadcrumb is malformed and `check-breadcrumb.mjs` exits 1 on it right now

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **1**:

```
REJECT  00-00-supervisor-2026-09-07-1409-blind-run-collect-only-1760-merged-by-the-cloud-lane-on-its-own-receipt.md
          x missing section: ## WHAT I DID NOT DO
structure: 3 checked, 1 malformed, 0 skipped as pre-contract
REJECT: 1 malformed breadcrumb(s)
```

The same run also tags it `NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`, so
the file has not yet reached CI. It was written by a **blind** 00 run, which is the plausible cause:
a blind run collects and stops, and the section it omitted is the one that says what it deliberately
left alone — the section a blind run most needs.

This matters because `check-breadcrumb.mjs` runs in CI under `pipeline-tests`. If a board PR sweeps
that file up unfixed, the PR reds on its own breadcrumb, and the red will read as a CI problem rather
than a missing heading.

**S3.** Not urgent for five more minutes; urgent the moment a board PR commits it.

**DISPOSITION: DISPATCHED → Station 00.** Add `## WHAT I DID NOT DO` to that breadcrumb before it is
swept into a board PR — one heading, its own file, no lane question. I did not edit it: it is another
station's report and 04 does not rewrite other stations' artifacts.
**Falsifying probe:** re-run `check-breadcrumb.mjs --freshness`; exit 0 means it landed.

### F4 — the `.gitignore:107-111` escalation is re-measured and STILL TRUE at `f9815d11`, with two corrections to its corpus

`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` remains accurate: lines
107–111 are the `Claude Design` negation block; the five sinks are at 115–119. **Re-verified at a
commit six days newer than the filing.** Its ITEM 2 (a CI gate for the citation class) is
**still unbuilt** — the probe and its controls are under WHAT I MEASURED.

Two corrections to its corpus, neither of which weakens it:

1. **"The five bootstraps" is four live ones plus one dead folder.** The files carrying the stale
   citation are `00-supervisor`, `02-board-driver`, `03-machine-minder`, `04-scanner`,
   `05-sot-keeper`. `02-board-driver` has **no live task** (MCP: not in the enabled list;
   `STATION-CAPABILITIES.md` §5 records the folder-without-a-task). The fifth *live* task,
   `weekly-security-audit`, carries **no** `.gitignore` citation at all. So the paste Marco is asked
   for touches **four governing files and one inert one** — which is the same corpus error
   `STATION-CAPABILITIES.md` §1 flagged in its own F4 on 2026-09-07T06:1xZ, reappearing in an
   escalation's title.
2. **The template measurement makes the "paste it five times" ask concrete.** 72 of the 76 lines are
   common across the four live bootstraps (see WHAT I MEASURED), so the stale phrase is one template
   line and the five pastes are five copies of one edit, not five judgements.

**DISPOSITION: ESCALATED (already open — re-verified, not re-filed).** No new file written; this
block is the re-measurement that escalation's own re-read rule (DOCTRINE §7.1) requires before
anyone acts on it. **Falsifying probe:** the citation table under WHAT I MEASURED — if
`.gitignore:107-111` ever names the QA sinks again, both halves are dead.

### F5 — the instruction-drift sweep itself came back clean on its two hardest questions

Recorded as a finding because a clean result that is not written down is billed to the next run.
[MEASURED] this run, with controls: **every path** the binding documents and the enabled bootstraps
name still resolves (459 + 162 mentions, 0 genuine misses); **every repo-side `<file>:<N>` citation
but one** lands on what its sentence claims (22 of 23); `lint-station.mjs` `ADMIT: all 8 docs clean`;
`check-lessons.mjs` `regressed=0`; `check-escalations.mjs` `open=0`; all four station bootstraps at
`station_doc_version: 1`, matching their repo docs.

The two known instruction-drift defects that survive are both **outside the repo**, in the
scheduled-task layer: the `.gitignore:107-111` citation (F4) and 00's cadence sentence (F1). That is
the shape worth carrying forward — **the repo-side instruction layer is currently honest, and every
live instruction defect is in the one layer CI cannot see.**

**DISPOSITION: DEFERRED.** It becomes urgent when either escalation is actioned, at which point this
run's numbers are the before-state to compare against.

## WHAT I DID NOT DO

- **Armed, staged, disarmed, renamed or moved nothing.** 04 is READ-ONLY on the board and arms
  nothing; the queue read `armed: 0` before and after. I staged no `-HOLD` prompt this run — my
  sweep was instruction-drift and produced no code-shaped fix to stage.
- **Merged nothing and touched no label.** All four open PRs are Marco's or blocked; RULE 2 binds
  and 04 has no merge authority in any case, so I did not even run the `marco.:true` probe — a lane
  classification I cannot act on is a lead, not a finding.
- **Did not edit `docs/pipeline/stations/05-sot-keeper.md`** to fix F2. It is 05's document and the
  §9.5 cure is an anchor change inside its own doc-reconcile PR.
- **Did not edit Station 00's 14:09Z breadcrumb** (F3) or its bootstrap (F1). Another station's
  artifact, and a layer outside the repo, outside CI and with no revert path.
- **Did not renumber `.gitignore:107-111`** anywhere. Renumbering is a fix with a half-life; the
  filed fix is rule text, and the file is Marco's.
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and its
  last line is quoted under GROUND; every git call this run went through Desktop Commander.
- **Did not mint a throwaway worktree.** `origin/main` was read with `git show` / `rev-parse` in the
  dev tree, per the superseded-2026-08-24 note in this station's own CLEAN-TREE MANDATE.
- **Did not run Part 2 (live-site patrol) or the Dependabot pass.** The rotation gave this run ONE
  named sweep and the contract says cover it completely rather than skim everything; `next-sweep.mjs`
  rotates to `gate-liveness` next.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Advanced and left dirty for Station 00, as
  the AUTHORITY section requires.
- **Azure / Entra / SharePoint: not touched, not read, not reasoned about.** No production data, no
  migration, no secret, no permission.
