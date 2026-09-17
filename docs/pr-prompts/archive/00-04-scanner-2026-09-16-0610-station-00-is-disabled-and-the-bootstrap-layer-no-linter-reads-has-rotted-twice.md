# Station 04 — Scanner | 2026-09-16T06:10:45Z–2026-09-16T06:28Z

## GROUND

```
UTC            2026-09-16T06:10:45Z
origin/main    900da72f            (fetched, then rev-parse)
dev tree       main @ d1634821     C:\ProjectOperations2   (1 behind origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. Full authority, not read-only.

**Sweep this run: `instruction-drift`** — `node scripts\pipeline\next-sweep.mjs` → *"SWEEP: instruction-drift … (rotation position 4 of 4; previous run: 2026-09-16T02:19:05Z)"*. Advanced at the end of the run and **left dirty**: `docs/pipeline/sweep-rotation.json`, now `last_index=3 last_run_utc=2026-09-16T06:10:45Z`. **Station 00 must commit it.**

**Tree read.** All three binding documents were read from the dev tree working copy after proving it matches `origin/main`: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (§9.3's length-comparison bullet: empty is the real answer). Run in the dev tree, never the watcher clone.

**Device-bridge git guard.** `bash .../scripts/pipeline/vm-git-guard.sh` — last line, quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`. PASS.

**Not blind.** `start_process` shell `powershell.exe` → PID 24092, live for the whole run, cwd `C:\ProjectOperations2`.

---

## WHAT I MEASURED

**[MEASURED] Scheduled-tasks MCP, `list_scheduled_tasks`, 06:12Z.** Five tasks; **three enabled**.

| task | cron | enabled | lastRunAt |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | **`false`** | **2026-09-15T05:08:34Z** |
| `03-machine-minder` | `0 9 * * *` | `true` | 2026-09-15T23:01:20Z |
| `04-scanner` | `0 */4 * * *` | `true` | 2026-09-16T06:09:52Z |
| `05-sot-keeper` | `10 0 * * *` | `true` | 2026-09-15T22:21:36Z |
| `weekly-security-audit` | `30 7 * * 1` | `false` | 2026-09-06T21:32:44Z |

POSITIVE control that the `enabled` field discriminates: three rows read `true` in the same payload. So `false` on `00-supervisor` is a value, not an empty read (§9.6).

**[MEASURED] `node scripts\pipeline\check-breadcrumb.mjs --freshness`, exit 1.** Independent corroboration from a different instrument:

```
00  last 2026-09-15T06:40:00Z  23.5h ago  (cadence 2h)  SILENT
03  last 2026-09-15T23:03:00Z   7.2h ago  (cadence 24h)  ok
04  last 2026-09-16T02:19:00Z   3.9h ago  (cadence 4h)   ok
05  last 2026-09-15T22:22:00Z   7.8h ago  (cadence 24h)  ok
```

The same run printed `NOTE … is UNTRACKED — it reaches nobody until a board PR commits it` for **seven** breadcrumbs: `00-00-supervisor-2026-09-15-0408-…`, `00-03-machine-minder-2026-09-15-2303-…`, `00-04-scanner-2026-09-15-0000-…`, `-1010-…`, `-2222-…`, `00-04-scanner-2026-09-16-0219-…`, `00-06-pr-master-2026-09-16-0456-…`. **Eight, with this one.**

**[MEASURED] `node scripts\pipeline\lint-station.mjs` → exit 0, `ADMIT: all 8 docs clean`.** All seven station docs `v1`, `.claude/agents/*.md` 9 definitions encoding-clean. The `! names a Windows path outside the known folder map` lines on `DOCTRINE.md` (`C:\\Foo\\Bar`, `e:\s`, `r:\s`, `C:\Users\Marco in`) are the linter matching §9's own *quotations* of broken queries — §9.6's closing rule, not drift.

**[MEASURED] `.gitignore` is 151 lines. The cited line numbers, resolved one by one:**

| citation | resolves to | verdict |
|---|---|---|
| `.gitignore:28` | `.claude/` | ✅ correct |
| `.gitignore:75` | `docs/pr-prompts/*-ready.md` | ✅ correct |
| `.gitignore:76-83` | the eight gitignored prompt folders, `processed/` … `no-pr-opened/` | ✅ correct |
| **`.gitignore:107-111`** | `!Claude Design/docs/`, `!Claude Design/assets/`, `Claude Design/assets/*`, `!Claude Design/assets/routes.js`, `!Claude Design/proposed/` | 🔴 **WRONG** |
| the five Overnight-QA sinks, truth | **`.gitignore:115-119`** (`qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`); the `# Overnight-QA scheduled task` comment is at **113** | — |

The first three rows are the POSITIVE control: the probe reads line numbers correctly, so row 4 is a wrong citation and not a broken instrument.

**[MEASURED] Citation census, dotfile-tolerant regex per §9.5's 2026-09-15 correction, over the four enabled-station bootstraps:**

```
00-supervisor      -> .gitignore:107-111
03-machine-minder  -> .gitignore:107-111
04-scanner         -> .gitignore:107-111
05-sot-keeper      -> pr-gates.mjs:327 | .gitignore:107-111
weekly-security-audit -> (none)
```

`scripts/pr-gates/pr-gates.mjs` is **581** lines; line **327** is `{`. Its `CP-24` occurrences are at lines **2, 320, 333, 337**.

**[MEASURED] Same census over all ten binding documents** (dotfileTolerant / extensionKeyed, `.gitignore:<N>` forms only):

```
DOCTRINE.md              .gitignore:28 · :75 · :76 · :76-83   (+ its quotations of retired citations)
STATION-CAPABILITIES.md  .gitignore:28                        1
CLAUDE.md                (none)                               0
00-supervisor.md         .gitignore:76-83 · :75               2
01-code-writer.md        .gitignore:28 · :76-83               2
02-board-driver.md       .gitignore:76-83                     1
03-machine-minder.md     .gitignore:76-83   (line 153)        1
04-scanner.md            .gitignore:76-83                     1
05-sot-keeper.md         .gitignore:76-83 · :75               2
06-pr-master.md          .gitignore:76-83                     1
```

**Every one of these resolves correctly.** The repo layer is clean; the rot is confined to the bootstrap layer.

**[MEASURED] `lint-station.mjs` corpus, from its own source (278 lines):** the literal `SKILL.md` occurs **0** times; `Scheduled` **1**; `.claude/agents` **2**; `stations/` **1**. NEGATIVE control, freshly minted needle `zzQq04Needle20260916T0620` → **0**. The linter **never opens a bootstrap.**

**[MEASURED] Path resolution, ten binding documents + four enabled bootstraps, against `git ls-tree -r --name-only origin/main` (3873 paths).** POSITIVE control `docs/pipeline/DOCTRINE.md` → true; NEGATIVE control `docs/zzQq04Needle20260916T0620.md` → false. After discarding prose fragments (`sot/05`, `docs/.`), glob prefixes (`docs/pr-prompts/00-`) and paths gitignored by design (`docs/qa/qa-*`, `apps/api/.env`, `scripts/pr-watcher/logs`), **no dead path survives** except one lead below.

**LEADS — measured, not dispositioned as findings:**

- `apps/api/scripts/xero-import-report.md`, named in `05-sot-keeper.md`, is absent from `origin/main` and matches nothing anywhere in the tree. Whether it is meant to be tracked is 05's to say; I have not established that it should be, so it is a lead.
- 🔴 **Two of my own probes lied, and both were caught by their controls — recorded because §9.6 says so.** (i) I read `SCRIPT-REGISTRY.md` as MISS; I had typed `scripts/pipeline/SCRIPT-REGISTRY.md` into my own query while the doc says `docs/pipeline/SCRIPT-REGISTRY.md`. Re-measured: `SET.has('docs/pipeline/SCRIPT-REGISTRY.md')` → **true**, and `git ls-tree -r --name-only origin/main -- docs/pipeline/` lists it. **The file exists; the instruction is runnable.** (ii) `docs/data-model/relationship-map.json` read as untracked, which looked like a dead path in `02-board-driver.md` and `05-sot-keeper.md`. `git check-ignore -v` → `.gitignore:135`, exit 0, and `Test-Path` → True on both `.json` and `.md`. **Gitignored by design, present on disk. Not a finding.**
- 🔴 **The rotation looked like it had regressed; it has not.** `origin/main` and dev `HEAD` both hold `last_index=3, last_run_utc=2026-09-15T02:10:31Z` (committed by `#1952`), while the working copy held `last_index=2` before my run. That is not a regression: the working copy wrapped `3 → 0 → 1 → 2 → 3`, and the four sweeps it served match the four breadcrumb subjects exactly — 09-15 1010 gate-liveness, 09-15 2222 instrument-honesty, 09-16 0219 repo-hygiene, 09-16 0610 instruction-drift. **The rotation is healthy.** What is true is that only ONE advance has ever been committed and **four now sit uncommitted**, which is F1's consequence, not a rotation defect. §9.2's *"on a tree behind `origin/main`, `git status` answers a question about `HEAD`"* is what separated the two readings.
- `C:\Users\Marco\Claude\Scheduled` holds **11** `SKILL.md` across 17 files (6 at depth 1, 5 under `_retired-2026-08-18/`), which still matches `STATION-CAPABILITIES.md` §1's figure.

---

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=3, last_run_utc=2026-09-16T06:10:45Z, last_station=04-scanner`, read back from the file. **LEFT DIRTY in the dev tree by instruction; Station 00 commits it.** `git diff --numstat origin/main` on it: **2 → 1** line.
- This breadcrumb, written to `docs/pr-prompts/` (tracked directory, untracked file).
- **Nothing else.** No prompt staged, armed, disarmed, renamed or deleted. No board mutation. No PR. No `/sot/` edit. No bootstrap edited. No scheduled task changed.

---

## FINDINGS

### F1 — `00-supervisor` is `enabled: false`. The only channel that closes a finding is switched off, and eight breadcrumbs are stranded.

`STATION_00_IS_DISABLED_V1`

`STATION-CAPABILITIES.md` §7: *"Station 00 collects, every run"* — it is the one channel that gives a finding a disposition, and the one actor that commits a station's breadcrumb and rotation advance. It has not run since **2026-09-15T05:08:34Z**, **25 hours** ago, and it is not scheduled to.

Two independent instruments agree: the MCP reads `enabled: false` (with three `true` rows as its positive control), and `check-breadcrumb --freshness` reads `00 … 23.5h ago (cadence 2h) SILENT` from the breadcrumb corpus, which knows nothing about the MCP. The freshness line ends *"Station 00: disposition this"* — addressed to the actor that is off.

**Measured consequences, now:** eight untracked breadcrumbs (09-15 0408, 09-15 2303, 09-15 0000, 09-15 1010, 09-15 2222, 09-16 0219, 09-16 0456, and this one) reaching nobody; four uncommitted rotation advances; `.arming-log.txt` uncommitted, which DOCTRINE §9.5 records as making a clone's arm history *"a day and a half old"* rather than absent — the more dangerous shape, because it answers. 03, 04 and 05 keep running and keep writing findings into a queue with no reader.

**`STATION-CAPABILITIES.md` §1 now asserts the opposite, one day old.** Its 2026-09-15 correction reads *"The live ENABLED count is FOUR (`00-supervisor` `5 * * * *`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`)"*. The live count is **THREE**. This is the identical shape to the `weekly-security-audit` row that same correction exists to fix — a dated measurement in the document whose own thesis is that a stale instruction reads exactly like a current one.

**Why this is not mine to fix.** Re-enabling a task is a write to the scheduled-tasks layer, which `STATION-CAPABILITIES.md` §6 puts outside this repo and in Marco's hands; 04 is read-only on the board; and the open escalation `needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md` records that **the task store reverts verified writes** — so a write here would likely revert and leave a run reporting a fix that did not hold, which is the §1 failure this pipeline keeps paying for.

**Question for Marco (RULE 1 — complete-and-additive first):**

> **(a) Re-enable `00-supervisor` and let its next collect sweep the eight breadcrumbs.** Complete: the backlog is dispositioned and committed, the rotation advances land, and the channel is open for future runs. Additive: nothing is discarded or overwritten. **Passes both halves.** The one thing it does not answer is *why* it went off — if that was deliberate, (a) undoes your decision, which is why this is a question and not an action.
> **(b) Leave it off and run the collect by hand when you want it.** Fails the *future* half: 03/04/05 keep writing into a queue with no reader, and the next station to notice pays this run's cost again.
> **(c) Leave it off and disable 03/04/05 too.** Fails the *immediately* half: the eight existing breadcrumbs stay stranded, and the board loses its only drift detection.

**DISPOSITION: ESCALATED.**

### F2 — All four station bootstraps cite `.gitignore:107-111` for the five gitignored sinks. The truth is `.gitignore:115-119`. Day eleven.

`BOOTSTRAP_GITIGNORE_CITATION_OFF_BY_EIGHT_V1`

Filed as `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` on **2026-09-06**; re-found by Station 04 on 09-15 and again today. Measured above with the three correct citations as its positive control.

**What this run adds, so the escalation stops costing a sweep each time:**

1. **The exact replacement.** `.gitignore:107-111` → **`.gitignore:115-119`** in all four bootstraps. One substitution, identical in each. Lines 107-111 are `Claude Design` rules; the `# Overnight-QA scheduled task` comment is at 113.
2. **Nobody has actually been misled, and that is measurable.** Every bootstrap names the five sinks by literal filename in the same sentence as the citation (*"`docs/qa/qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`"*). The citation is decorative; the literal list is correct and is what a reader acts on. So this is a **correctness defect in a binding document, not a live hazard** — which is the honest severity and is why it has survived eleven days.
3. It is **Marco's to fix by construction**: `STATION-CAPABILITIES.md` §1 gives the bootstrap layer exactly one editor — *"Marco, by pasting"*. No agent can close this.

**Falsifying probe:** read `.gitignore` lines 113–119. If the `# Overnight-QA scheduled task` comment is no longer at 113, re-measure before quoting `115-119`.

**DISPOSITION: ESCALATED** (re-measured against the open 2026-09-06 escalation; adds the replacement text and the severity assessment).

### F3 — `lint-station.mjs` never opens a bootstrap. That is why the repo layer is clean and the bootstrap layer has now rotted twice.

`LINT_STATION_DOES_NOT_READ_BOOTSTRAPS_V1`

The instruction-drift sweep exists because *"five pasted copies drifted for weeks"*. The gate built to stop that — `lint-station.mjs`, run in CI under `pipeline-tests` — reads `docs/pipeline/DOCTRINE.md`, the seven station docs and `.claude/agents/*.md`. **It reads no bootstrap:** the literal `SKILL.md` occurs **0** times in its 278 lines (negative control, minted needle → 0). The layer `STATION-CAPABILITIES.md` §1 marks *"YES — **this is the one**"* for a scheduled run is the only layer with no automated gate.

**The second rot, measured this run and not previously reported.** DOCTRINE §9.5's 2026-09-10 clause records that four raw `<file>:<NNN>` citations were converted to anchors *"in the same PR that landed this clause"* — among them `pr-gates.mjs:327` in `05-sot-keeper.md`. The repo doc is indeed clean. **The `05-sot-keeper` BOOTSTRAP still carries `pr-gates.mjs:327`**, and it has since rotted exactly as §9.5 predicts a line number will: line 327 of `scripts/pr-gates/pr-gates.mjs` is now the single character `{`, while `CP-24` lives at lines 2, 320, 333 and 337.

So the bootstrap layer carries **two** rotted citations (`.gitignore:107-111` × 4, `pr-gates.mjs:327` × 1), both of a class the repo layer has already fixed, and neither is visible to any check. Fixing the five instances without fixing the blind spot guarantees a third.

**Two changes, and they are in different hands.** Extending `lint-station.mjs` to scan every `SKILL.md` behind an enabled task is a `scripts/` change, outside 04's lane to write and outside 00's lane to merge. Editing the bootstraps is Marco's (F2). Note the trap the fix must avoid: `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` ITEM 2 already asks for a citation check, and §9.5's 2026-09-15 correction records that **built with the obvious extension-keyed regex it is born blind to `.gitignore:<N>`** — the entire class that motivated it. The dotfile-tolerant form is written out in §9.5 and is the one to use.

**Falsifying probe:** `Select-String 'SKILL.md'` over `scripts/pipeline/lint-station.mjs`. If it ever returns > 0, this finding is closed.

**DISPOSITION: ESCALATED** — the instrument gap belongs with F2's escalation, because fixing the citations without the gate leaves the blind spot intact.

### F4 — DOCTRINE §9.5's per-document anchor prediction is stated over ten documents and was measured over four. Its `03` row is false.

`ANCHOR_PREDICTION_CORPUS_MISMATCH_V1`

§9.5's 2026-09-15 correction restates the per-document prediction as: `03`→**0**, `05`→2, `CLAUDE.md`→0, `STATION-CAPABILITIES.md`→1, `04-scanner.md`→1, `DOCTRINE.md`→its `start-watcher.ps1:160` uses plus quotations. Its own measurement was taken *"over the same nine files (five scheduled-task bootstraps + four binding docs)"*.

**Measured today over all ten binding documents:** `03-machine-minder.md` carries `.gitignore:76-83` at **line 153**, and it resolves correctly. `03`→**1**, not 0. Four further documents the prediction never mentions carry live citations: `00-supervisor.md`→2, `01-code-writer.md`→2, `02-board-driver.md`→1, `06-pr-master.md`→1. Rows `05`, `CLAUDE.md`, `STATION-CAPABILITIES.md` and `04-scanner.md` hold as stated.

**Every one of these resolves correctly today**, so nothing is broken — which is the reason to fix the prediction rather than the documents. A run that follows it literally reads `03`→1 against a predicted 0 and concludes 03 has drifted, then spends the sweep confirming a clean document. That is the failure §9.5 records twice already: *"a reader who counts 7 against a predicted 1 concludes it never did and re-opens four sweeps' worth of closed work."*

**The correction is one sentence:** state the prediction over the **ten** binding documents, with `03`→1, `00`→2, `01`→2, `02`→1, `06`→1 added, and say that the 2026-09-15 figure was scoped to a nine-file corpus that contained four of them.

**DISPOSITION: DISPATCHED** to Station 00 — a `docs/pipeline/` correction is 00's lane (`STATION-CAPABILITIES.md` §5), and 04 is read-only. ⚠️ **Blocked behind F1:** 00 is disabled, so this will not be collected until the task is re-enabled.

### F5 — Station 06's 2026-09-16 breadcrumb is malformed; `check-breadcrumb.mjs` REJECTs and exits 1.

`BREADCRUMB_06_0456_MALFORMED_V1`

`node scripts\pipeline\check-breadcrumb.mjs --freshness` → **exit 1**, `REJECT: 1 malformed breadcrumb(s)`:

```
REJECT  00-06-pr-master-2026-09-16-0456-a-prompt-that-held-was-resolved-to-another-stations-pr-and-binned-as-spent.md
          x missing section: ## WHAT I MEASURED
          x missing section: ## WHAT CHANGED
          x missing section: ## FINDINGS
```

`structure: 16 checked, 1 malformed`. Three of the five contract sections are absent, including `## FINDINGS` — so whatever 06 found on 2026-09-16 at 04:56Z carries no disposition and is, by the report contract's own definition, a lead rather than a finding. The slug describes a real event (*"a prompt that held was resolved to another station's PR and binned as spent"*), which is the class §10.6 covers, so the content is probably worth recovering rather than discarding.

The validator is doing its job; this is 06's to repair. Because the file is also untracked, the malformation is invisible to CI — `check-breadcrumb.mjs` runs under `pipeline-tests` against what is committed, and nothing has committed this.

**DISPOSITION: DISPATCHED** to Station 00, to route to Station 06 for a re-write carrying the five sections. ⚠️ **Blocked behind F1.**

---

## WHAT I DID NOT DO

- **The other three sweeps.** `gate-liveness`, `instrument-honesty` and `repo-hygiene` were not run. One named sweep per run, covered completely, is the contract; they were served on 09-15 1010, 09-15 2222 and 09-16 0219 respectively and the rotation is turning correctly.
- **PART 2, live-site.** No Claude-in-Chrome pass, no visual patrol, no module regression. The instruction-drift sweep is a repo-and-bootstrap audit and consumed the run; a live pass with no Station 00 to receive its findings would have added a ninth stranded breadcrumb.
- **PART 1(c), Dependabot.** Not opened. Same reason, plus the one-staged-remediation budget is pointless while nothing collects.
- **Staged no prompt.** I may stage a lint-clean `-HOLD`; none of F1–F5 wants one. F1 and F2 are Marco's by construction, F3's code half is a `scripts/` change outside both 04's and 00's lanes, and F4/F5 are one-paragraph doc repairs that belong in 00's next board PR rather than in an agent run.
- **Did not re-enable `00-supervisor`, and did not edit any bootstrap.** Both are the scheduled-tasks layer, which is Marco's; and the open `weekly-security-audit` escalation records that the task store reverts verified writes, so a write there can report a success it did not achieve.
- **Did not commit anything.** The dev tree is on `main`; `git diff --cached --name-status` was **empty** before and after, and the shared index was not touched. `sweep-rotation.json` and this breadcrumb are left dirty by instruction.
- **Did not run `git` from the VM against the Windows `.git`.** Every git call in this run went through Desktop Commander PID 24092 on the host. The VM-side guard was installed first and its pass line is quoted in GROUND.
- **Did not run `status-sweep.ps1`.** It gates board mutation, and this run mutated nothing; its verdict expires the moment it prints, so a reading taken here would have been quoted stale.
