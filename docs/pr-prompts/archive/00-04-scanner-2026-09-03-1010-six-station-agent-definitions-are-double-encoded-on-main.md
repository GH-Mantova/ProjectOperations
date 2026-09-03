# Station 04 — Scanner | 2026-09-03T10:10:38Z–2026-09-03T10:17Z

Sweep taken: **instruction-drift** (rotation position 4 of 4, assigned by `next-sweep.mjs`).

## GROUND

```
UTC            2026-09-03T10:10:38Z
origin/main    a9e7e7d1            (git fetch origin --prune, then rev-parse)
dev tree       main @ a9e7e7d1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions AGREE, so this run was read/write within 04's authority (read-only on the board).
This run was **SIGHTED** — `start_process` shell `powershell.exe` returned PID 20120 on the first
call. Not a blind run.

`status-sweep.ps1` at 10:11:12Z: **SAFE TO ACT**, instrument positive controls both `[LIVE]`
(`gh CAN reach GitHub (saw merged PR #1540)`, `node runs`). Board = 2 open PRs (`#1541` green,
`#1536` Marco's, red on the label pair). I mutated nothing on the board.

## WHAT I MEASURED

**Freshness of my own binding documents.** [MEASURED]
`git diff --name-only origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **empty**. The dev tree copies I read are byte-identical to
`origin/main` at `a9e7e7d1`, so reading the working copy was safe this run. Control: the same command
with `docs/pipeline/sweep-rotation.json` returns `1 file changed`, so the query is not blind.

**A. Bootstrap vs repo station doc — all five agree.** [MEASURED]
`node C:\po-sup-fix-scripts\04-drift-2026-09-03.mjs`, section A:

| task | bootstrap ver | repo doc ver | match | bootstrap names its own doc path |
|---|---|---|---|---|
| 00-supervisor | 1 | 1 | ✅ | ✅ |
| 02-board-driver | 1 | 1 | ✅ | ✅ |
| 03-machine-minder | 1 | 1 | ✅ | ✅ |
| 04-scanner | 1 | 1 | ✅ | ✅ |
| 05-sot-keeper | 1 | 1 | ✅ | ✅ |

All five `SKILL.md` were last written **2026-09-01T00:07:44Z**, in one batch.
🔴 **`STATION-CAPABILITIES.md` §1 says that batch was `2026-08-24T22:54:22Z`.** That measurement is
now two batches stale — the `.bak-2026-09-01T00-07-44-730Z` siblings still carry the 08-24 mtime,
which is what the doc measured. The doc pre-emptively neutralises itself (*"Measure a bootstrap's
currency — never quote this file for it"*), so this is noted, not filed as a defect.

**B. The file that actually fired this run IS the on-box scheduled file.** [MEASURED]
The `<scheduled-task>` header named an `…\uploads\SKILL.md` path, not
`C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md`. Hashed both: **670 upload copies across all
sessions collapse to exactly 5 distinct sha256** — one per station bootstrap plus
`weekly-security-audit` — and the copy delivered to a 04 run is
`sha=20befa7d768f`, **byte-identical to `Scheduled\04-scanner\SKILL.md`**. So the upload path is a
delivery copy, not a sixth drifting layer. This closes an assumption no run had measured.

**C. Every repo path named by DOCTRINE + all seven station docs + SCRIPT-REGISTRY.** [MEASURED]
`resolved=68 dangling=1`. The one dangling path is
`docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, named in `04-scanner.md` **inside a sentence
that explicitly records it as deleted in the 2026-08-17 cleanup**. Deliberate historical mention, not
drift. Controls: `docs/pipeline/DOCTRINE.md` → exists; `docs/pipeline/NO-SUCH-FILE.md` → absent.

🔴 **My first pass reported a second dangling path,
`apps/web/src/components/SettingsShell.ts`, and it was my instrument lying** (§7). My extension
alternation was `(?:md|mjs|ps1|json|ts|tsx|…)`; ordered alternation matched `ts` and stopped, silently
truncating `SettingsShell.tsx`. Reordered to `tsx|ts` and it resolves. Recording it because the shape
is the recurring one: a confident, coherent, wrong finding produced by the query, not the world.

**D. Bootstrap content vs known-disproved advice — CLEAN, after reading context.** [MEASURED]
A needle grep over the five bootstraps for six strings this pipeline has disproved returned **10 hits
(2 per bootstrap)**. Reading each in place, **all 10 are the pipeline correctly warning against the
advice, not repeating it**: `"cloud-fired"` appears only inside *"the old 'in the listing ⇒
cloud-fired ⇒ blind' rule is REFUTED"*, and `"qa-findings.md"` only inside *"Never one of the five
gitignored sinks"*. **Zero disproved advice survives in any bootstrap.** Controls: needle `STEP 1` →
present; needle `zzzNoSuchNeedleZzz` → absent.

**E / F. Path resolution outside the repo docs.** [MEASURED]
Every repo path named by each of the five bootstraps resolves (`named=6 dangling=0`, each).
All 17 paths named by the Cowork project-instructions block resolve, including
`docs/pr-prompts/PROMPT-SCHEMA.md` (it is under `docs/pr-prompts/`, **not** `docs/pipeline/` —
`DOCTRINE.md:669` names it bare, with no path, which is a navigability nit only).

**G. `lint-station.mjs` — ADMIT all 8, exit 0, with a real positive control.** [MEASURED]
`node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs clean`, `LINT_STATION_EXIT=0`. The only
`!` note is 04's own `C:\po-scan-` mention.
Positive control, because a checker never seen to fail is not a checker (§7): I copied
`06-pr-master.md` **outside the repo**, changed one sentence **inside** the canonical block, and
linted the copy → `REJECT … x canonical block 'station-contract' has been EDITED (sha e0a83e378e22388a,
expected 73ad6cc7ef1a2dd5)`, exit 1. The untampered copy of the same file rejected **only** on the
filename mismatch and carried **no** canonical-block line. The hash gate discriminates; the ADMIT is real.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-03T10:10:38Z`. Read back:
  `last_index=3 last_run_utc=2026-09-03T10:10:38Z`, and the next run is assigned **gate-liveness**
  (position 1 of 4). **LEFT DIRTY IN THE DEV TREE — Station 00 must commit it, I may not.**
  ⚠️ This is now the **second consecutive uncommitted advance**: `origin/main` still records
  `last_run_utc: 2026-09-02T06:10:43Z`, while the worktree already carried `2026-09-03T06:10:32Z`
  from the 06:10Z run before I touched it. The rotation is turning on disk only.
- Three scratch files under `C:\po-sup-fix-scripts\` (probe scripts + lint controls). Outside the
  repo; they dirty nothing.
- **Nothing else.** No board mutation, no arm, no merge, no label, no prompt staged, no `/sot/` edit.

## FINDINGS

### F1 — 🔴 S2: six station agent definitions are DOUBLE-double-encoded ON `origin/main`, and PR #1465 did it

`.claude/agents/*.md` are the runtime configs that define what each station agent *is*. Six of the
seven carry mojibake, **on `origin/main` at `a9e7e7d1`, not merely in the working tree.**

[MEASURED] `node C:\po-sup-fix-scripts\04-encoding-scope-2026-09-03.mjs`, counting the CP1252
double-encode signature after decoding with **node**, never `Get-Content` (§9.3):

| file | worktree | origin/main | mtime |
|---|---|---|---|
| `.claude/agents/00-supervisor.md` | **33** | **33** | 2026-09-01T00:38:06Z |
| `.claude/agents/01-code-writer.md` | **25** | **25** | 2026-09-01T00:38:06Z |
| `.claude/agents/02-board-driver.md` | **64** | **64** | 2026-09-01T00:38:06Z |
| `.claude/agents/03-machine-minder.md` | **26** | **26** | 2026-09-01T00:38:06Z |
| `.claude/agents/04-scanner.md` | **33** | **33** | 2026-09-01T00:38:06Z |
| `.claude/agents/05-sot-keeper.md` | **22** | **22** | 2026-09-01T00:38:06Z |
| `.claude/agents/06-pr-master.md` | 0 | 0 | 2026-08-18T04:02:43Z |
| `.claude/agents/pr-fix-reviewer.md` | 0 | 0 | 2026-08-28T05:04:31Z |

**203 damaged sequences across six tracked files.** `U+FFFD = 0` and no BOM in every one of them —
this is *valid* UTF-8 carrying the wrong characters, the exact case §9.3 says a validity check
cannot see.

**It is worse than the 2026-08-24 incident: this is TWO passes of the damage, not one.** The H1 of
`01-code-writer.md`, node-decoded, is `# STATION 01 Ã¢â‚¬â€ CODE-WRITER`, code points
`U+00C3 U+00A2 U+00E2 U+201A U+00AC U+00E2 U+20AC U+009D`. An em dash `U+2014` → UTF-8 `E2 80 94` →
read as CP1252 → `â€"` → re-encoded → read as CP1252 again → `Ã¢â‚¬â€`. §9.3's recorded signature is
the single-pass `U+00E2 U+20AC U+201D`; this is that signature having been run through the encoder a
second time.

**Cause, named and dated.** [MEASURED] `git log --format='%h %cI %s' -- .claude/agents/`:
`e57fd6d4` · 2026-09-01T00:01:06Z · **`fix(agents): the stations carried two frozen doctrine copies -
point at the source and gate the ban (#1465)`**. `06-pr-master.md` and `pr-fix-reviewer.md` were not
in that PR and are the only clean station files — a natural control. The writer was almost certainly
`Set-Content -Encoding UTF8` / `Out-File -Encoding utf8`, which §9.3 names as *the* double-encoder.
Note the shape: **a doctrine-hygiene PR violated the doctrine bullet written to prevent exactly this.**

**Why it is S2 and not cosmetic.** These files carry `tools:`, `model:`, `isolation:` and
`maxTurns:` front matter and the prose limits each station agent runs under. Damage inside a fenced
command or a path is not visible as damage — it is a wrong instruction that reads as a right one.
The five *scheduled* bootstraps written 30 minutes earlier the same night are **clean** (`sig=0`,
`U+FFFD=0`, all five), so this is contained to the agent layer.

Controls: `DOCTRINE.md` returns `sig=2` and both hits are §9.3 **quoting** the signature on purpose;
`STATION-CAPABILITIES.md` returns 0; a synthetic `"\u00c3\u00a2"` returns 1.

**DISPOSITION: ESCALATED** — the repair itself is mechanical (re-decode CP1252 → write UTF-8 with
node, per §9.3), but it rewrites the runtime configs of every station while the board is live, and
04 is read-only. Options for Marco, RULE 1 applied:

- **(A) — complete and additive, RECOMMENDED.** Repair all six with a node script in one docs-scoped
  PR, *and* extend `scripts/pipeline/lint-station.mjs` to scan `.claude/agents/*.md` for `U+FFFD` and
  the double-encode signature so CI catches the third occurrence. Solves it now (the 203 sequences)
  and in future (the writer can never land undetected again), and touches no data-entry path.
  Passes both halves of RULE 1.
- **(B) — repair only, no guard.** One PR, fixes the 203 sequences, `lint-station.mjs` unchanged.
  Fails RULE 1's *future* half: this is the second occurrence of this exact writer bug in eight days
  and nothing would catch the third.
- **(C) — do nothing.** Fails both halves: the damage is live on `main` now, and it compounds every
  time any lane rewrites one of these files with the same tool.

### F2 — 🔴 S3: `STATION-CAPABILITIES.md` describes FOUR instruction layers; there are FIVE

§1 is titled *"Every station has FOUR layers. Know which one actually governs you."* and its table
lists the scheduled-task file, the Cowork account skill, the station doc, and itself. [MEASURED]
`git ls-files .claude` returns **eight tracked agent definitions** under `.claude/agents/`, and
`01-code-writer.md`'s own header reads *"The agent definition is a THIN RUNTIME CONFIG that reads
THIS. Edit here, not in `.claude/agents/01-code-writer.md`."* — so the station docs know about the
layer and the file that calls itself *"the one place the capability answer lives"* does not.

This is not academic: it is **why F1 went unseen**. Every encoding sweep this pipeline runs is
pointed at `sot/` and `docs/pipeline/`. A layer that is not in the map does not get swept.

Also [MEASURED]: `.claude/agents/pr-tester.md` exists on disk (6656 bytes, mtime 2026-06-09) and is
**gitignored** — `git check-ignore -v` returns `.gitignore:28:.claude/`, exit 0, against the positive
control `git ls-files --error-unmatch .claude/agents/pr-fix-reviewer.md` → found, exit 0. So the
`.claude/` directory is ignored wholesale and the eight tracked files are force-added exceptions;
anything added there in future is invisible by default.

**DISPOSITION: DISPATCHED → Station 06 (PR Master)** — stage a docs prompt that adds the agent-
definition layer to §1's table (who changes it, whether it governs a scheduled run, and that
`.claude/` is ignored except for force-added files), and adds Station 01 to §5/§6 per F3. I am
read-only on the board and did not stage it; 06 is the station that designs and stages.

### F3 — 🟡 S3: Station 01 has a contract-linted station doc and NO row in the authority matrix

[MEASURED] `docs/pipeline/stations/01-code-writer.md` exists (17946 bytes, front matter
`station: 01-code-writer`, `station_doc_version: 1`), is linted (`ADMIT … 01-code-writer.md (v1)`),
and is named on `origin/main` by `00-supervisor.md`, `sot/README.md`, `scripts/pr-watcher/index.mjs`
and two HOLD prompts. But `STATION-CAPABILITIES.md` **never contains the string `01-code-writer`**,
and neither does `DOCTRINE.md`. §5's authority matrix has six columns (00/02/03/04/05/06); §6's
cadence table has six rows. The canonical-block comment in every station doc says *"ship all seven
together"* — **seven docs, six columns.**

Consequence: whether 01 may merge, create a PR, or edit `/sot/` is stated only inside 01's own doc and
`.claude/settings.json` hooks — never in the file that is supposed to settle capability disputes. Its
answers are knowable; they are just not where the doctrine says to look.
Control: `git grep -ln 'zzzNoSuchStationZzz'` → exit 1, so the grep is not blind.

**DISPOSITION: DISPATCHED → Station 06 (PR Master)** — same prompt as F2; they are one edit to one file.

### F4 — 🟡 S3: `next-sweep.mjs` still prints an instruction its own station doc retired as forbidden

[MEASURED] `origin/main:scripts/pipeline/next-sweep.mjs:76` →
`console.log('COMMIT THIS FILE with your breadcrumb, or the next run repeats this sweep.')`. I saw
that line printed at 10:14Z when I ran `--advance`.

[MEASURED] `docs/pipeline/stations/04-scanner.md:162-164` → *"LEAVE IT DIRTY in the dev tree and NAME
IT IN YOUR BREADCRUMB — **Station 00 commits it, because you may not.** … This line used to read 'and
commit that file with your breadcrumb', which asked 04 to do the one thing 04 is forbidden to do."*

The doc was corrected; the script's output was not. **The tool now tells 04 to commit to `main` from
the shared dev tree at the exact moment 04 is most likely to comply** — it prints immediately after a
successful advance, and it is the last line on screen. This is a live instruction, not stale prose,
and it survives every re-read of the corrected doc because a run reads the doc once and the tool last.

**DISPOSITION: DISPATCHED → Station 06 (PR Master)** — one-line change: print
`LEFT DIRTY: Station 00 commits this file with the next board PR. Station 04 must not.` Fold it into
the same F2/F3 prompt if 06 prefers; it is a `scripts/` path, so that PR is Marco's by policy and
must not be auto-merged. I did not stage it: 04 is read-only and staging is 06's lane.

### F5 — 🟢 no finding: the disproved-advice sweep came back clean

Recorded because a clean result from this specific check has value — this sweep exists precisely
because four bootstraps once carried disproved advice. See **D** above: 10 needle hits, all 10 in
warning or REFUTED context, zero live disproved advice. **DISPOSITION: ACTIONED** — verified this
run against all five bootstraps with positive and negative controls; nothing to fix.

## WHAT I DID NOT DO

- **Did not repair the 203 damaged sequences.** 04 is read-only on the board and cannot create a PR
  (authority matrix). The repair also rewrites live runtime configs for every station; that is
  Marco's call under RULE 1, which is why F1 is ESCALATED rather than DISPATCHED.
- **Did not commit `sweep-rotation.json`.** The dev tree is on `main` and nobody commits to `main`
  directly. Named above for 00. I did not follow `next-sweep.mjs`'s own printed instruction to commit
  it — see F4.
- **Did not stage any prompt.** F2/F3/F4 are one coherent docs+scripts edit and belong to 06, which
  designs. Staging three near-duplicate prompts would have been worse than dispatching one.
- **Did not touch the board.** `#1541` (green, VS-S2) and `#1536` (Marco's) were read only. No arm, no
  merge, no label, no auto-merge.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief. The contract assigns **one**
  named sweep per run and `next-sweep.mjs` assigned instruction-drift; a shallow pass over everything
  is the failure the rotation exists to prevent.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Not my lane; the last three are absolute.
- **Did not clear the `[STALE]` lines** `status-sweep.ps1` §5 emitted for
  `tests-docs-lane-deadlock-2026-09-03.md`, `unattributed-arms-single-actor-2026-09-03.md` and
  `ruleset-requires-four-checks-…-2026-09-01.md`. Those files cite merged PRs as **evidence**, not as
  their subject, so §5's rule misclassifies them. Out of this sweep's scope and already a known
  defect; flagging only that I did not act on those lines.
