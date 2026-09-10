# Station 04 — Scanner | 2026-09-10T18:10:08Z–2026-09-10T18:55Z

## GROUND

```
UTC            2026-09-10T18:10:08Z
origin/main    77137033            (fetch --prune, then rev-parse)
dev tree       main @ 77137033     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Version and bootstrap AGREE — this run was **not** read-only-gated.

Dev tree HEAD **equals** `origin/main` this run, and I did not rely on that alone:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/04-scanner.md` returned **EMPTY** — not different. Every repo read below that
mattered was taken with `git show origin/main:<path>`, in the dev tree, per PREFLIGHT.

**Sweep this run: `instruction-drift`** (`node scripts/pipeline/next-sweep.mjs` → rotation position
4 of 4; previous run 2026-09-10T14:10:11Z).

Needles minted and now SPENT (they are in a tracked file the moment this lands — do not reuse):
`zzQq04anchor20260910T18`, `zzQq04rot20260910T1830`, `zzQq04scope20260910T1845`,
`zzQq04home20260910T1850`.

## WHAT I MEASURED

**[MEASURED] Host reachable — NOT blind.** Desktop Commander schemas loaded via `ToolSearch` first
(a validation error is not blindness), then `start_process` shell `powershell.exe` →
`HOST_OK 02026-09-11T04:10:08.5093868+10:00` = `2026-09-10T18:10:08Z`.

**[CANNOT MEASURE] `scripts/pipeline/vm-git-guard.sh` was NOT installed this run.** PREFLIGHT step 1
requires it before any VM-side call. The Cowork Linux workspace refused to start on **both**
attempts with a byte-identical RPC error — `failed to mount … under Plan9 share "c" which is not
mounted; create: … user confident-pensive-turing already exists unexpectedly` (attempt 1 of 5, then
2 of 5). The installer's last line therefore cannot be quoted in either direction. **Exposure this
run is nil: with no VM there was no VM-side call to guard**, and every probe below ran through
Desktop Commander on the Windows host. See F3 — this is already open, filed by others.

**[MEASURED] `status-sweep.ps1` — captured to a file, not read from the early return.** Exit 10.
Section 0 instrument controls both `[LIVE]` PASS (`gh` saw merged `#1858`; `node` runs), so no
`[BROKEN]`. Section 7 verdict: **SAFE TO ACT** — no board mutation in progress, no remote activity
in 2 min, no live station worktrees. OPEN PRs **5** (`#1852 #1850 #1845 #1823` green, `#1832` RED),
armed **0**, watcher node RUNNING pid 18228, `index.lock` false/false, git processes 0, main CI on
`77137033` 4 success / 0 failed. Captured with `[System.IO.File]::WriteAllText` and a UTF-8 encoder,
not `*>` — §9.3 records `*>` writing UTF-16LE into exactly this cure.

**[MEASURED] `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0.** All seven station docs `v1`,
`.claude/agents/*.md` nine definitions encoding-clean, every canonical block hash intact. Its
`NOTE contract is v3; these declare v1` is the known open item
(`needs-marco/lint-station-compares-the-wrong-version-field-2026-09-05.md`) — not re-raised.

**[MEASURED] Bootstrap corpus, expressed as the live task list and not as "the five".**
`Scheduled\` holds **7** folders and **11** `SKILL.md` (5 of them under `_retired-2026-08-18`);
the scheduled-tasks MCP reports **5 ENABLED** tasks. `02-board-driver` has a bootstrap and no live
task, exactly as STATION-CAPABILITIES §5 records.

| enabled task | bootstrap mtime (UTC) | boot ver | points at | repo ver | verdict |
|---|---|---|---|---|---|
| 00-supervisor | 2026-09-01T00:07:44.732Z | 1 | 00-supervisor.md | 1 | MATCH |
| 03-machine-minder | 2026-09-01T00:07:44.737Z | 1 | 03-machine-minder.md | 1 | MATCH |
| 04-scanner | 2026-09-01T00:07:44.740Z | 1 | 04-scanner.md | 1 | MATCH |
| 05-sot-keeper | 2026-09-01T00:07:44.742Z | 1 | 05-sot-keeper.md | 1 | MATCH |
| weekly-security-audit | 2026-08-17T06:37:17.884Z | (none) | (no station doc) | n/a | N/A |

All **8** distinct Windows absolute paths named by those bootstraps resolve on disk; **0 missing**.

**[MEASURED] All three open bootstrap-layer escalations SURVIVE their own falsifying probes.**
Counted in node against single-backslash needles (§9.1 — a single-quoted PowerShell `\\` needle
returns a guaranteed zero here):

| enabled bootstrap | `C:\ProjectOperations2\docs\pipeline` | `git show` | `ToolSearch` | `vm-git-guard` | `.gitignore:107-111` |
|---|---|---|---|---|---|
| 00-supervisor | 3 | 0 | 0 | 0 | 1 |
| 03-machine-minder | 3 | 0 | 0 | 0 | 1 |
| 04-scanner | 3 | 0 | 0 | 0 | 1 |
| 05-sot-keeper | 3 | 0 | 0 | 0 | 1 |
| weekly-security-audit | 0 | 0 | 0 | 0 | 0 |

POSITIVE control `STEP 1` → 1 on 4 of 5 (0 on `weekly-security-audit`, which has no STEP block).
NEGATIVE control → 0 on all five. So:
`bootstraps-tell-every-run-to-read-the-working-copy-2026-09-06.md` is **LIVE** (its discharge
condition is working-copy 0 and `git show` ≥ 3; today it is 3 and 0);
`bootstrap-preflight-omits-four-preconditions-2026-09-10.md` is **LIVE** (all four rows still 0);
`gitignore-citations-in-the-five-bootstraps-2026-09-06.md` is **LIVE**.

**[MEASURED] `.gitignore` truth at `77137033`.** 151 lines. The `# Overnight-QA` comment is at 113
and the five sinks at **115–119** (`qa-checklist.md` 115, `qa-findings.md` 116,
`qa-test-data-registry.md` 117, `.qa-run.lock` 118, `qa-run-*.md` 119). Lines **107–111** hold
`!Claude Design/docs/`, `!Claude Design/assets/`, `Claude Design/assets/*`,
`!Claude Design/assets/routes.js`, `!Claude Design/proposed/` — negation rules, precisely the
inversion that escalation describes. **The repo half is confirmed fixed**: every `.gitignore:<N>`
citation surviving in the binding docs is CORRECT — `:75` = `docs/pr-prompts/*-ready.md`, `:76-83` =
the eight ignored prompt folders (cited by six station docs, all correct), `:28` = `.claude/`.
Only the bootstrap layer, which no agent may write, still cites 107-111.

**[MEASURED] Symbol anchors in the binding docs — 19 of 19 resolve, 0 dead.** Nobody had swept
these. Extracted every `` (anchor: `X`) `` token from DOCTRINE, STATION-CAPABILITIES, the seven
station docs and CLAUDE.md read at `origin/main`, then `git grep -F -c <token> origin/main`:
`$LogFile = Join-Path $LogDir` 7 · `ARM_ONLY =` 23 · `Add-Content -Path $LogFile` 9 ·
`DO_NOT_ARM_CAPS =` 18 · `DO_NOT_ARM_COMMENT =` 20 · `HUMAN_GATE_PRESENT: line` 15 · `LINT_GH_BIN` 48
· `Tee-Object` 5 · `async function waitForPolicyMerge` 7 · `const MERGE_TIMEOUT_MS` 6 ·
`const NESTED_TEST_PATHS` 6 · `const allGreen` 6 · `export function checkHumanGate` 4 ·
`function readFromOriginMain` 10 · `index.mjs` 571 · `ls-tree -r` 222 · `readFromOriginMain(` 20 ·
`runVerdictArchiveSweep` 17 · `scripts/pr-watcher/index.mjs` 240. POSITIVE control
`classifyPolicyFiles` → 270. NEGATIVE control → 0. **§9.5's symbol-anchor migration has held.**

**[MEASURED] Every surviving `<file>:<N>` citation in the binding docs, checked for CONTENT and not
merely for existence.** There are exactly **five**, in three files:

| citation | cited in | line actually holds | verdict |
|---|---|---|---|
| `start-watcher.ps1:160` | DOCTRINE.md | `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }` | **CORRECT** |
| `build-relationship-map.mjs:18-19` | 05-sot-keeper.md | `// The --check mode does NOT compare against a committed output file …` | **CORRECT** |
| `build-relationship-map.mjs` "line 561" (bare form) | 05-sot-keeper.md | `return;` in the `--check` branch | **CORRECT** |
| `ensure-watcher.ps1:10` | 03-machine-minder.md | `$Launcher = 'C:\po-watcher\watcher-launcher-singlelane.ps1'` | correct, but the target is **not in the repo** |
| `CLAUDE.md:19` | 05-sot-keeper.md | `lanes**: a cloud session or any other actor that opens a PR without the watcher. §10.1 is a safety` | **ROTTED** |
| `pr-gates.mjs:327` | 05-sot-keeper.md | `{` (the CP-24 comment is 320-326; the assertions are 328-345) | **weak — a bare brace** |

Read twice, from two sources: `origin/main` and the working copy agree line-for-line, and
`git diff --numstat origin/main` is EMPTY for both `scripts/pr-gates/pr-gates.mjs` (581 lines) and
`CLAUDE.md` (27 lines). The sot-refs sentence `CLAUDE.md:19` is trying to cite now lives at
**`CLAUDE.md:26`**. `DOCTRINE.md` line 27's bare `watcher-launcher-singlelane.ps1 line 27` claim was
also re-verified on the box and is **correct** (`Start-Transcript -Path "C:\po-watcher\watcher-launch.log"`).

**[MEASURED] ANGLE 4 — neither rotted citation is new, and that is the finding.** Over 607 files at
`docs/pr-prompts` depth 1 + `needs-marco/` + `archive/`, POSITIVE control `CP-24` → 9 / 4 / 99,
NEGATIVE control → 0 / 0 / 0:

| item | depth 1 | needs-marco | archive | first found | last dispatched |
|---|---|---|---|---|---|
| `pr-gates.mjs:327` | 0 | **1** (as a sub-item of the launcher-chain file, not its subject) | 12 | 2026-08-25 (04) | 2026-09-02 → Station 05 |
| `CLAUDE.md:19` | 1 (`queue-watch-state.md`) | **0** | 8 | 2026-08-29 (05) | 2026-09-07 → Station 05 |

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened,
merged, labelled or updated. No `sot/` file touched. No `git` command that changes a branch, an
index or a ref (only `fetch --prune`, `rev-parse`, `show`, `grep`, `ls-tree`, `diff --numstat`,
`status`). Nothing staged: `git diff --cached --name-status` is EMPTY.

Two writes, both permitted:

1. **This breadcrumb**, at the tracked path `docs/pr-prompts/`, in the dev tree. **Untracked until a
   board PR commits it — Station 00 sweeps it up.**
2. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-10T18:10:08Z` →
   `advanced: last_index=3 last_run_utc=2026-09-10T18:10:08Z`. **LEFT DIRTY DELIBERATELY**
   (`git diff --numstat origin/main` → `2 2`). **Station 00 must commit it; 04 may not commit to
   `main`.** If it is not committed the next 04 run repeats `instruction-drift` and the rotation
   stops turning.

Scratch scripts were written under `C:\po-sup-fix-scripts\` (`s04-*-20260910.*`) — outside the repo,
nothing tracked, nothing executed against the board.

## FINDINGS

### F1 — S2 · A `DISPATCHED` DISPOSITION HAS NO INSTRUMENT, AND THE SAME TWO CITATIONS HAVE NOW BEEN RE-FOUND BY FOUR CONSECUTIVE `instruction-drift` SWEEPS

Four sweeps — 2026-09-02, 09-04, 09-07 and this one — have each independently re-discovered
`pr-gates.mjs:327` and/or `CLAUDE.md:19` in `docs/pipeline/stations/05-sot-keeper.md`. Each gave the
correct disposition. Neither has been fixed. `CLAUDE.md:19` was measured as rotted by 04 on
2026-09-07T14:10Z and dispatched to 05 by 00 at 15:16Z as *"one clause in its next doc-reconcile"*;
`pr-gates.mjs:327` was dispatched to 05 on 2026-09-02T04:09Z. Both are still there at `77137033`.
05's cadence is `10 0 * * *` — **daily**, MEASURED from the scheduled-tasks MCP this run — so eight
and three of its occurrences have passed over them.

**The cause is not 05 being slow. It is that nothing surfaces an outstanding DISPATCH.**
`status-sweep.ps1` section 5 reads `needs-marco/` and does **not** read `archive/` — that is
recorded, in those words, inside
`needs-marco/bootstraps-tell-every-run-to-read-the-working-copy-2026-09-06.md`, which exists
*because* an ESCALATED finding was invisible for two days for exactly this reason. The same hole is
open one disposition to the left: measured above, `CLAUDE.md:19` appears in **0** `needs-marco/`
files and **8** archived breadcrumbs; `pr-gates.mjs:327` appears in **1** `needs-marco/` file and
only as a passing sub-item of a different subject, plus **12** archived breadcrumbs. **Both
dispatches live only where no instrument looks.** ESCALATED got a folder; DISPATCHED got nothing,
and a station cannot read another station's chat (STATION-CAPABILITIES §7).

**And the routing is the aggravating half.** Both items are one-clause edits to
`docs/pipeline/stations/05-sot-keeper.md` — a `docs/` file, not a `sot/` file. `docs/` is Station
00's own lane (§10.1 step 3; authority matrix "00 · Create a PR: board PRs"), and 00 runs
**hourly**. Routing a `docs/` edit to the daily station whose lane is `sot/`, because the *subject
matter* is 05's, put a sixty-second fix behind the slowest queue on the board and then lost the
ticket.

**RULE 1 options, complete-and-additive first.**

- **(a) 00 lands both clauses in its next board PR, and files one `needs-marco/` item asking Marco
  for a dispatch register that `status-sweep.ps1` section 5 can read.** *Complete:* fixes today's two
  and gives every future DISPATCH the same file-backed home ESCALATED already has, so the fifth
  re-discovery cannot happen. *Additive:* it adds a folder and an assertion, removes no instruction,
  changes no run's behaviour, and touches no data. **Passes both halves — this is the
  recommendation.** The register is a `scripts/` change and therefore outside 00's merge lane, which
  is why that half is a question for Marco rather than a repair.
- **(b) 00 lands both clauses and stops there.** Passes "without damaging"; **fails the future
  half** — the next DISPATCH is invisible again, and this class has now recurred four times in nine
  days.
- **(c) Re-dispatch to 05 and wait.** Fails both halves: it is what has been done three times.

**DISPOSITION: DISPATCHED → Station 00.** Both clauses are inside 00's lane and 00 is the station
that collects; the register question is 00's to put to Marco. 04 is read-only on the board and may
not open a PR.

### F2 — S3 · THE "ANCHOR BY SYMBOL, NEVER BY LINE NUMBER" RULE IS SCOPED TO ONE DOCUMENT, AND EVERY SURVIVING RAW LINE CITATION IS OUTSIDE IT

DOCTRINE §9.5 opens with *"ANCHOR BY SYMBOL, NEVER BY LINE NUMBER"*, and §10.3 carries the
document-wide restatement *"Every citation into another file in THIS DOCUMENT is a symbol or
fixed-comment anchor, not a line number."* **THIS DOCUMENT is doing the load-bearing work in that
sentence, and nobody has read it as a limit.** [MEASURED] across the ten binding docs at
`origin/main`, NEGATIVE control 0 in every row:

| doc | `(anchor: …)` forms | the word "anchor" (POS) | surviving `file:NNN` citations |
|---|---|---|---|
| DOCTRINE.md | 18 | 28 | 1 (`start-watcher.ps1:160`, correct) |
| STATION-CAPABILITIES.md | 0 | 1 | 0 |
| 03-machine-minder.md | 0 | 0 | 1 (`ensure-watcher.ps1:10`) |
| 05-sot-keeper.md | 0 | 0 | 3 (`CLAUDE.md:19`, `pr-gates.mjs:327`, `build-relationship-map.mjs:18`) |
| 00, 01, 02, 04, 06, CLAUDE.md | 0 | 0 | 0 |

DOCTRINE swept itself and its 19 anchors are 19/19 live. The nine documents that did **not** get the
rule are where all four non-DOCTRINE citations live, and two of those four are F1's recurring pair.
This is the structural cause behind F1: the fix that would have prevented both was applied to one
file and the rule was never widened.

The complete-and-additive move is to **state §9.5's opening bullet as binding on every station doc,
not only on DOCTRINE**, and convert the four survivors to symbol anchors in the same pass — three of
them have obvious symbols (`const sotRe = /^sot\//` for CP-24; `SOT reference baseline:` for
CLAUDE.md; `$Launcher  =` for the launcher). It removes no instruction and adds an anchor form that
cannot rot when a file moves underneath it. It also composes with the CI check
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` ITEM 2 already asks Marco
for — that check catches rot after the fact; this removes the surface it rots on. **Neither replaces
the other, and both are additive.**

⚠️ `ensure-watcher.ps1:10` is the one survivor no rule and no CI check can reach: its target is not
in the repository. That is already ESCALATED as
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` and is **not re-raised here** — this
run only re-verified that line 10 still reads what 03's doc says it reads.

**DISPOSITION: DISPATCHED → Station 00**, to fold into the same doc-reconcile as F1's two clauses,
and to carry the ITEM 2 composition note when it next touches that escalation.

### F3 — S3 · THE VM-GIT-GUARD PREFLIGHT STEP COULD NOT RUN, FOR THE FOURTH-PLUS CONSECUTIVE STATION RUN

The Cowork Linux workspace failed to start on both attempts with a byte-identical RPC error naming a
Plan9 share that is not mounted and a session user that "already exists unexpectedly". PREFLIGHT
step 1 requires `scripts/pipeline/vm-git-guard.sh` to be installed before any VM-side call, and asks
for its last line to be quoted pass or fail. **It cannot be quoted: the installer never ran.** The
contract is explicit that this is a finding and not a stop, and it did not cost this run any
coverage — with no VM there is no VM-side `git` to guard, and every probe above ran through Desktop
Commander on the Windows host.

This is **already open and is not being re-filed**:
`needs-marco/linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md` and
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`, and Station 00's untracked
18:08Z breadcrumb in the dev tree names both transports down in the same hour.

What this run adds is one datum: the failure is **not** intermittent across transports within a
session — two calls thirty seconds apart returned the identical error, and the retry counter
advanced 1 → 2 of 5, so the workspace itself is counting the failures.

**DISPOSITION: DEFERRED.** It becomes urgent the moment a station's coverage actually depends on the
mount — specifically a **blind** run, for which STATION-CAPABILITIES §3 makes the mount the whole of
COLLECT. A blind run during this outage can do neither, and would have to report no coverage at all.

### F4 — S4 · AN OPEN ESCALATION'S CORPUS ARITHMETIC IS ONE TASK OUT OF DATE

`needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md` measures over *"the **6**
live bootstrap `SKILL.md`"* and notes *"**5 of 6** bootstraps still cite 107-111"*. Its own
falsifying probe prescribes the right corpus — *"every `SKILL.md` behind an **enabled** task in the
scheduled-tasks MCP (never 'the five')"*. [MEASURED] this run from the MCP: **5** enabled tasks, and
over that corpus the figures are **4 of 5** citing 107-111 and 5 of 5 scoring zero on all four
omitted preconditions. The sixth file it counted is `02-board-driver`, which has a bootstrap folder
and **no live task** — STATION-CAPABILITIES §5's own *"a folder is not a task"*.

**The escalation's substance is untouched** — all four rows still read 0 of 5, and it remains LIVE.
Only the denominators drift, and they drift in the harmless direction. Recorded so that the next run
to quote them does not read a mismatch as the escalation having moved.

**DISPOSITION: DISPATCHED → Station 00**, to correct the two denominators when it next edits that
file. Not worth a PR of its own.

## WHAT I DID NOT DO

- **Did not commit anything, and did not open a PR.** 04 is read-only on the board. `sweep-rotation.json`
  is left dirty on purpose and is named above so 00 sweeps it.
- **Did not fix the two rotted citations myself**, although both are one-line docs edits. They are
  tracked-file writes outside the two exceptions 04 is allowed, and the dev tree is on `main`, which
  nobody commits to directly.
- **Did not stage a prompt.** The whole residue of this sweep is one docs clause set already inside
  00's lane; a `-HOLD` would add a queue entry for work that is faster to land than to arm, and the
  `tests-docs` lane is starved besides.
- **Did not touch `needs-marco/`.** Three escalations were re-verified against their own falsifying
  probes and all three SURVIVED, so none is discharged and none is mine to move.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station doc
  says take ONE named sweep and cover it completely; `next-sweep.mjs` named `instruction-drift` and
  the rotation was advanced for it.
- **Did not re-raise** `ensure-watcher.ps1:10` (open as the launcher-chain escalation), the
  `lint-station.mjs` contract-version NOTE, the `.gitignore:107-111` bootstrap pastes, the
  working-copy bootstrap instruction, or the Linux-workspace outage. All are open with a named owner;
  each was re-verified and left where it is.
- **Did not touch Azure, Entra or SharePoint**, production data, the watcher clone, any worktree, or
  any `git` command that changes a branch, an index or a ref.
