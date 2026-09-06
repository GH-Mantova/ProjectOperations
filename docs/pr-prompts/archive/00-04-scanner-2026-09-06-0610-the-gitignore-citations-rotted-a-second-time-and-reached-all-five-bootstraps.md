# Station 04 — Scanner | 2026-09-06T06:10:38Z–2026-09-06T06:52Z

Sweep this run: **instruction-drift** (`next-sweep.mjs`, rotation position 4 of 4; previous run
2026-09-06T02:17:55Z). Sighted run — Desktop Commander reached the box on the first call.

## GROUND

```
UTC            2026-09-06T06:10:38Z
origin/main    42aae6be            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 42aae6be     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (<!-- station_doc_version: 1 --> in the inlined scheduled task)
```

Version check: **MATCH**. Run proceeded at full authority (read-only on the board, as always for 04).

All three binding documents were read in full. [MEASURED] They did not need to be read through
`git show`, because the working copies are byte-identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md`
→ **EMPTY output**, which per the PREFLIGHT block is the real answer. Blob ids on `origin/main`
(`git rev-parse --short`, no pipe — §9.1): station doc `169a714f`, DOCTRINE `283099e9`,
STATION-CAPABILITIES `5645734f`.

## WHAT I MEASURED

**Board state**, `scripts/pipeline/status-sweep.ps1`, generated 2026-09-06T06:17:45Z, exit 0.
Captured to a file (`… *>&1 | Set-Content`) rather than read from the stream, because the script
returns early and hides its own §7 verdict — 268 lines captured, and `Set-Content` was used in place
of `>` so the capture is not UTF-16LE (§9.3).

- [MEASURED] section 0 positive controls both `[LIVE]`: gh reached GitHub (saw merged #1691), node runs.
- [MEASURED] **OPEN PRs: 0.** main CI on `42aae6be`: 4 success / 0 failed / 0 running.
- [MEASURED] watcher node RUNNING pid **17944**, wrapper alive (3), heartbeat age 1 min.
- [MEASURED] armed: **1** — `pr-artifactregister-s2-name-what-is-missing-ready.md`. needs-marco 28,
  no-pr-opened 109, failed 41, blocked 123.
- [MEASURED] section 7 verdict: **CAUTION** — one LIVE STATION WORKTREE, `C:/po-wt/board0608`
  @ `42aae6be` on `docs/board-0608-collect`, dirty 8, age 0 min. That is Station 00's 06:08Z collect,
  mid-run. I mutated nothing on the board, so CAUTION did not bind me.
- [MEASURED] `C:/po-vg` still listed as an orphaned worktree holding 1 uncommitted file, age 2784 min.
  Not re-investigated this run — the project memory records its central claim as already REFUTED
  (`23c91ba9`'s content is on main as `b42dcc36` via #1577), and re-deriving it is exactly the
  bill §7 warns about. Left for 03.

**Sweep proper — instruction drift.**

1. [MEASURED] **Bootstrap ↔ station-doc version parity: CLEAN, all five.** Read each
   `C:\Users\Marco\Claude\Scheduled\<task>\SKILL.md` with node and compared its
   `station_doc_version` against the front matter of the repo doc it names:

   | bootstrap | bytes | mtime (UTC) | declares | repo doc | repo declares | match |
   |---|---|---|---|---|---|---|
   | `00-supervisor` | 5905 | 2026-09-01T00:07:44.732Z | 1 | `00-supervisor.md` | 1 | ✅ |
   | `02-board-driver` | 5902 | 2026-09-01T00:07:44.735Z | 1 | `02-board-driver.md` | 1 | ✅ |
   | `03-machine-minder` | 5880 | 2026-09-01T00:07:44.737Z | 1 | `03-machine-minder.md` | 1 | ✅ |
   | `04-scanner` | 5841 | 2026-09-01T00:07:44.740Z | 1 | `04-scanner.md` | 1 | ✅ |
   | `05-sot-keeper` | 5816 | 2026-09-01T00:07:44.742Z | 1 | `05-sot-keeper.md` | 1 | ✅ |

   ⚠️ Those mtimes are STATE — re-measure, never quote. All five were rewritten in one batch, which is
   two days later than the batch `STATION-CAPABILITIES.md` §1 last recorded; that paragraph already
   warns it is state and tells you to measure it, and it does.

2. [MEASURED] **The bootstrap I was actually served is byte-faithful to the one on disk.** The
   scheduled task inlined its file from an uploads path, not from `Scheduled\04-scanner\SKILL.md`;
   read side by side, the two are the same document. No drift between the governing layer and the
   copy this run executed.

3. [MEASURED] `node scripts/pipeline/lint-station.mjs` → **exit 0, `ADMIT: all 8 docs clean`**, plus
   `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`. Its three advisory `!` lines
   (Windows paths outside the known folder map) and its `NOTE contract is v2; these declare
   station_doc_version 1` are both pre-existing and already filed for Marco per
   `STATION-CAPABILITIES.md` §6. Nothing new.

4. [MEASURED] **Path resolution across DOCTRINE + STATION-CAPABILITIES + all seven station docs.**
   274 repo-relative candidates and 69 Windows paths extracted with node and existence-checked;
   60 did not resolve, and **every one is a false positive of the extractor or already documented**:
   filename *templates* (`docs/pr-prompts/00-04-`, `docs/pr-reviews/pr-`, `docs/qa/qa-run-`),
   gitignored-by-design paths that only exist when in use (`docs/qa/.qa-run.lock`), section shorthand
   (`sot/05`, `sot/01/02/03/05/06`), brace forms my regex split (`relationship-map.{json,md}`),
   deliberate placeholders (`C:\po-scan-<rand>`, `C:\po-watcher\zzzNoSuchNeedleZzz`), and two absences
   DOCTRINE itself measures and states (`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`,
   `C:\po-watcher\STOP-WATCHER`). **One genuine miss survived — see F3.** No station doc names a
   script, gate or document that has gone missing.

5. [MEASURED] **Line-number citations into files outside the citing document.** This is the check that
   found F1. Positive control, proving the instrument can return a PASS: DOCTRINE §10.3 cites
   `start-watcher.ps1:160` for `PR_WATCHER_AUTO_MERGE_POLICY`; line 160 of
   `scripts/pr-watcher/start-watcher.ps1` (245 lines) reads
   `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }`
   and is the file's **first** occurrence of that symbol — **still correct.** `.gitignore:28`
   (`.claude/`) and `.gitignore:75-83` (the `*-ready.md` and eight queue folders) are **also still
   correct**, all nine lines verified individually. So the instrument distinguishes right citations
   from wrong ones, and F1 is not an artefact of a blind grep.

6. Fresh needles, minted this run per §9.6 and **now spent by appearing here**:
   `zzQq04Needle20260906T0620` → 0 over `.gitignore`; `zzQq04Cite20260906T0625` → 0 over the
   1,565-file corpus. Do not reuse either.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **advanced and LEFT DIRTY** (`last_index=3`,
  `last_run_utc=2026-09-06T06:48:33Z`), `git status` shows ` M`. **Station 00 must commit this with
  the next board PR**; 04 may not commit to the shared dev tree.
- This breadcrumb, untracked in `docs/pr-prompts/` until 00 sweeps it up.
- Scratch only, outside the repo: three `.mjs` probes and the sweep capture under
  `C:\po-sup-fix-scripts\`.
- **Nothing else.** No prompt staged, armed, disarmed, renamed or moved. No PR, no label, no merge,
  no `git` write in any tree.

## FINDINGS

### F1 — `.gitignore` line citations have rotted a SECOND time, now off by EIGHT, and this time they reached all five bootstraps. **S2.**

The Station 04 REPORT CONTRACT — the paragraph that exists to stop a finding being written into a
gitignored sink — names its five sinks by *line number*: "`.gitignore:107-111`". [MEASURED] those
lines do not name the sinks:

```
.gitignore:107 = "!Claude Design/docs/"
.gitignore:108 = "!Claude Design/assets/"
.gitignore:109 = "Claude Design/assets/*"
.gitignore:110 = "!Claude Design/assets/routes.js"
.gitignore:111 = "!Claude Design/proposed/"
```

The five sinks are at **115-119**. [MEASURED] by two independent instruments: reading the file with
node (115 `docs/qa/qa-checklist.md` · 116 `qa-findings.md` · 117 `qa-test-data-registry.md` ·
118 `.qa-run.lock` · 119 `qa-run-*.md`), and `git check-ignore -v` on **files**, never directories
(§9.2): `docs/qa/qa-findings.md` → exit 0 `.gitignore:116`, `qa-test-data-registry.md` → `:117`,
`.qa-run.lock` → `:118`, `qa-run-zz.md` → `:119` via the glob. POSITIVE control
`docs/pr-prompts/processed/zz.log` → exit 0 `.gitignore:76`. NEGATIVE controls `CLAUDE.md` → exit 1
empty and `docs/qa/sot-refs-baseline.json` → exit 1 empty, which also re-confirms that the
`docs/qa/` **directory** is tracked and it is those five *files* that swallow findings.

**The rules are intact. Only the numbers are wrong.** Nothing is newly committable and nothing newly
leaks; the defect is entirely in the instruction layer.

**Cause, dated.** [MEASURED] `git log -S 'Claude Design/assets/*' -- .gitignore` → **`27127f6f`,
2026-09-04T07:39Z UTC, #1573** *"CD-S1 — un-ignore the written half of Claude Design/"*, which
inserted a nine-line block above the qa block; `99451d99` (#1576) added one more. Net shift **+8**.
The citations have been wrong for about two days.

**Blast radius — [MEASURED] 72 stale `.gitignore:107-111` citations across 1,565 scanned files, in
every layer that governs a run** (NEGATIVE control `zzQq04Cite20260906T0625` → 0 files; POSITIVE
control: the same scan found 4 *correct* `115-119` citations, so the query can return either answer):

| layer | files | stale citations |
|---|---|---|
| scheduled bootstraps (`Scheduled\{00,02,03,04,05}\SKILL.md`) | 5 | 5 |
| `docs/pipeline/STATION-CAPABILITIES.md` | 1 | 1 |
| `docs/pipeline/stations/0{0,1,2,3,4,5,6}-*.md` | 7 | 20 (7 of them in 04-scanner.md alone) |
| `sot/04-data-model.md` | 1 | 2 |
| live queue: `docs/pr-prompts/pr-watcher-idle-tick-liveness-HOLD.md` | 1 | 1 |
| archive / superseded (historical, leave alone) | 28 | 43 |

**Why S2 and not cosmetic.** Both wrong lines are *negation* rules. A station that follows the
instruction and checks its citation reads `!Claude Design/assets/` under a claim that says
"`docs/qa/qa-findings.md` is GITIGNORED (`.gitignore:108`)", and the available conclusion is that the
file is **no longer ignored** — i.e. that it is a safe, tracked place to write. That is precisely the
failure the paragraph was written to prevent, and it cost this pipeline nine days once already. It is
also §9.6's shape with the polarity inverted: not an empty result read as an empty world, but a
well-formed line that answers a different question than the one asked.

**This is a REPEAT, and the previous fix is why.** `docs/pr-prompts/archive/00-04-scanner-2026-08-30-1409-instruction-drift-every-transcribed-gitignore-citation-is-off-by-one.md`
found the same class off by ONE and dispatched, in its own words, *"Correct the three canonical-block
citations to `.gitignore:107-111`…"*. That landed and was true for five days. **Renumbering is a fix
with a half-life**: it re-arms the trap and bills the next run to find it again — which is exactly
what happened, and what this run just spent its sweep on.

**DISPOSITION: DISPATCHED → Station 00**, in three parts, because they are three different lanes:

1. **`docs/pipeline/**` (7 station docs + STATION-CAPABILITIES, 21 citations)** — 00's own
   `docs/` lane, one docs-only PR. Do **not** renumber. Cite the **rule text**: *"the five sinks
   listed under the `# Overnight-QA scheduled task` comment in `.gitignore` — `qa-checklist.md`,
   `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`"*, and for the
   single-file form *"`docs/qa/qa-findings.md`, gitignored by its own literal line in `.gitignore`"*.
   The names are the anchor; they cannot drift when a block is inserted above them.
   ⚠️ Six of these citations live inside the `station-contract v2` canonical block, so all seven
   station docs ship together and `lint-station.mjs --write-canonical` re-records the hash.
2. **The five bootstraps** — outside the repo, outside CI, gated by nothing. They are writable by an
   agent (recorded 2026-08-29), but rewriting the governing layer of five stations is not 04's lane.
   Same one-line replacement, same wording.
3. **`sot/04-data-model.md` (2 citations)** — **Station 05's alone**, and CP-24 hard-fails any PR
   mixing `sot/` with anything else. It must be a separate doc-reconcile PR. Surfaced here, not
   touched.

The one live queue file (`pr-watcher-idle-tick-liveness-HOLD.md`) carries the stale citation in its
prose; it is a HOLD, it is not armed, and correcting a prompt under critique is forbidden to 04
(ADVERSARIAL PROMPT CRITIQUE, report-not-run). Flagged for its owner.

### F2 — the citation class has no gate, and nothing but a scanner sweep will catch the third recurrence. **S3.**

DOCTRINE §9.5's opening bullet already rules it: *"a line number into a file outside this document is
invalidated by any edit above it — if you find yourself writing one, write the symbol instead."* That
rule was applied to `lint-prompt.mjs` citations (16 of 17 wrong, one insertion), then swept
document-wide through §10.3 (4 of 4 wrong, one insertion). **`.gitignore` was never swept**, and it
is the softest target of the three: it is edited by ordinary feature PRs like #1573 that have no
reason to look at `docs/pipeline/`.

`lint-station.mjs` already parses every station doc and every agent definition. A check that fails
any `<file>:<N>` citation whose cited line does not contain the token the sentence claims is a small
addition to an existing gate, and it would have caught this on 2026-09-04 in #1573's own CI run.

**DISPOSITION: DEFERRED.** Real, not now: F1's wording fix removes the live instances, and a gate
built before the wording lands would only assert the numbers. It becomes urgent the moment a
renumber-style fix is chosen over the rule-text fix in F1 — because then the numbers are load-bearing
again and the third recurrence is scheduled rather than possible. `scripts/` is outside 00's merge
lane in any case, so this is Marco's to release when it is written.

### F3 — `docs/pipeline/stations/02-board-driver.md` names a worktree root that does not exist. **S4.**

[MEASURED] the doc names `C:\ProjectOperations-Reference\worktrees` (and a `\po-` child of it).
`C:\ProjectOperations-Reference` **exists**; the `worktrees` subdirectory does **not** (`Test-Path`
→ False, against a positive control listing 17 real `C:\` roots including `po-worktrees`,
`po-watcher-worktrees` and `po-wt`, which are where worktrees actually live per
`STATION-CAPABILITIES.md` §4). It is the only genuine unresolved path in the whole doc set.

**DISPOSITION: DEFERRED.** 02 has no schedule of its own and its contract has been folded into 00
since 2026-09-02, so nothing reads this line on a timer. It becomes urgent if 02 is ever re-scheduled,
or if someone follows the doc and creates the directory rather than using the mapped roots. Worth one
line in the same docs PR as F1 if 00 is editing that file anyway.

## WHAT I DID NOT DO

- **Did not correct any of the 72 citations.** All 72 live in layers 04 is read-only on: the station
  docs and STATION-CAPABILITIES are 00's docs lane, `sot/` is 05's under CP-24, the bootstraps are
  outside the repo, and the HOLD is under adversarial critique, which is report-not-run.
- **Did not stage a prompt.** 04 may stage two per run and I staged zero, deliberately: the board has
  0 open PRs and 61 depth-1 prompts, F1's edit is small and fully specified above, and the same class
  of fix was DISPATCHED on 2026-08-30 and landed without a prompt. §10.6 also makes a duplicate
  prompt the expensive failure here, not the missing one.
- **Did not commit the rotation advance**, per the AUTHORITY block. It is dirty in the dev tree and
  named under WHAT CHANGED.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** One named sweep per
  run, covered completely, is the standing instruction; a shallow pass over everything is why
  findings rot. The `github-projectops` MCP is also reporting `Authorization header is badly
  formatted` in this session, so Part 1's connector would have been `[CANNOT MEASURE]` regardless.
- **Did not re-investigate `C:/po-vg`, the watcher clone's `dirty=2`, the 28 `needs-marco/` files the
  sweep tags `[STALE]`, or the poller-churn cadence question.** All are 03's or 00's, all are already
  on file, and none is instruction drift.
