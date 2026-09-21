# Station 04 — Scanner | 2026-09-17T14:10:24Z–2026-09-17T14:16:43Z

Sweep taken this run: **instruction-drift** (rotation position 4 of 4, selected by
`node scripts/pipeline/next-sweep.mjs`, not by choice).

## GROUND

```
UTC            2026-09-17T14:10:24Z
origin/main    a2f5e8a6              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ a2f5e8a6       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Doc version and bootstrap AGREE (1 == 1). This run was NOT read-only for that reason.

## WHAT I MEASURED

**Reachability — sighted.** [MEASURED] `start_process` shell `powershell.exe` → PID 30288, prompt
returned. Desktop Commander tool ids in this session are `mcp__plugin_desktop-commander_desktop-commander__*`
— **not** the bare `mcp__desktop-commander__*` form; a `select:` for the bare ids returned
"No matching deferred tools found". That is the station doc's own "find the ids; do not assume them"
precondition firing on its first line, and it would read as blindness to a run that skipped it.

**Device-bridge git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
last line verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceding line: `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`). PASS. No `git` was run through the
device bridge this run.

**Binding documents read in full**, from the working copy, after proving the working copy is
`origin/main` for exactly those files — [MEASURED] `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md docs/pipeline/sweep-rotation.json`
→ **EMPTY**. Per DOCTRINE §9.3, EMPTY `--numstat` is the real answer; no piped hash was taken and none
is quoted.

**Corpus.** [MEASURED] from the scheduled-tasks MCP this run: **4 ENABLED tasks** — `00-supervisor`
(`5 * * * *`), `03-machine-minder` (`0 9 * * *`), `04-scanner` (`0 */4 * * *`), `05-sot-keeper`
(`10 0 * * *`). `weekly-security-audit` is **`enabled: false`**, `lastRunAt 2026-09-06T21:32:44Z`.
That confirms `STATION-CAPABILITIES.md` §1's 2026-09-15 correction; no drift there.
`C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md`, **6** outside `_retired-2026-08-18`.

**The bootstrap this run was actually served is not stale.** [MEASURED] the harness inlines
`…\7ffb3e51\uploads\SKILL.md`; `Buffer.compare` against `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md`
→ **identical**, 5841 bytes both, sha256 prefix `20befa7d768f774b`. A snapshot layer that had gone
stale would be invisible from inside the run, so this is recorded as a clean negative rather than
assumed.

**Version parity, all layers.** [MEASURED] in node over all 6 live bootstraps and all 7 station docs:
every bootstrap that declares a version declares **1**; every station doc declares
`station_doc_version: 1`, `contract_version: 1`. `weekly-security-audit` declares none (it is not a
station). **No mismatch anywhere.**

**`lint-station.mjs`.** [MEASURED] `node scripts\pipeline\lint-station.mjs` → **exit 0**,
`ADMIT: all 8 docs clean`, plus `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`.
No canonical-block hash failure. Its "names a Windows path outside the known folder map" lines are
warnings on DOCTRINE's own quoted example paths (`C:\\Foo\\Bar`, `C:\po-scan-`), not failures.

**What `lint-station.mjs` does NOT read — the mechanism behind F1–F3.** [MEASURED] from source:
`STATION_DIR = 'docs/pipeline/stations'` filtered `/^\d\d-[a-z0-9-]+\.md$/`, `DOCTRINE = 'docs/pipeline/DOCTRINE.md'`,
`AGENT_DIR = '.claude/agents'`. The string `C:\Users\Marco\Claude\Scheduled` appears in the file
**only** inside the known-folder allowlist. **No gate of any kind reads the bootstrap layer** — which
is the layer `STATION-CAPABILITIES.md` §1 says actually governs a scheduled run.

**Path resolution.** [MEASURED] over DOCTRINE + STATION-CAPABILITIES + all 7 station docs: **183**
distinct repo-relative paths named, **179 resolve on disk, 4 do not**, and all four are expected:
`docs/pr-reviews/pr-1850-review.md` and `pr-1852-review.md` (DOCTRINE quotes them as measured `??`
entries in the watcher CLONE, correctly absent from the dev tree), `docs/pr-prompts/00-00-...md`
(a prose ellipsis, not a path), and `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, which
`04-scanner.md` itself documents as deleted in the 2026-08-17 cleanup and never restored.
**No unexplained dead path.**

**Citation resolution**, dotfile-tolerant regex per DOCTRINE §9.5's 2026-09-15 correction
`(^|[\s(`"'])(\.?[A-Za-z0-9_.\-/]+):(\d+(?:-\d+)?)\b`. Per-document census: `DOCTRINE.md` 27 ·
`STATION-CAPABILITIES.md` 2 · `CLAUDE.md` 0 · stations `00`→2 `01`→2 `02`→1 `03`→1 `04`→1 `05`→2
`06`→1 · bootstraps `00`/`02`/`03`/`04`→1 each, `05`→2. Every distinct citation was resolved against
its target file and the cited line printed. **All resolve correctly except the two in F2**, e.g.
`start-watcher.ps1:160` → `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }`;
`index.mjs:3545` → `const watcher = fsWatch(PROMPT_DIR, { persistent: true }, …)`;
`.gitignore:76-83` → the eight `docs/pr-prompts/*` exception folders; `.gitignore:75` →
`docs/pr-prompts/*-ready.md`; `.gitignore:28` → `.claude/`.

⚠️ [INFERRED] DOCTRINE §9.5's per-document *prediction* (`03`→0, `05`→2, `CLAUDE.md`→0,
`STATION-CAPABILITIES.md`→1, `04-scanner.md`→1) cannot be evaluated as written, because it does not
distinguish a live citation from a **quotation of command output**: `STATION-CAPABILITIES.md`'s
second `.gitignore:28` is inside the quoted control `git check-ignore -v … -> .gitignore:28:.claude/`.
Recorded as a lead, not a finding — see WHAT I DID NOT DO.

**Negative control**, minted this run and now spent by appearing here: `zzQq04Needle20260917T1425`
→ **0** across all 6 bootstraps. **Positive control** `STEP 1` → **4 of 4** enabled, **5 of 6** all
files (`weekly-security-audit` has no STEP block). Both directions live.

**Clock note.** [MEASURED] the Windows host reports `2026-09-17T14:10:24Z`; the scheduled-tasks MCP
reports this run's `lastRunAt 2026-09-17T14:09:32.741Z`; the session environment header says
`2026-09-18`. Host and task store agree; the environment header is the outlier. All timestamps in
this breadcrumb are host UTC.

## WHAT CHANGED

**One file, left deliberately dirty:** `docs/pipeline/sweep-rotation.json`.
[MEASURED] `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-17T14:10:24Z` → exit 0,
`advanced: last_index=3 last_run_utc=2026-09-17T14:10:24Z`; read back
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`.
🔴 **Station 00 must commit this file with the next board PR — Station 04 may not.** Without it the
next run repeats `instruction-drift` and the rotation silently stops.
[MEASURED] `git diff --cached --name-status` → **EMPTY**, so nothing else is staged in the shared
dev-tree index.

**Nothing else.** No prompt armed, staged, renamed, moved or deleted. No PR opened, updated or
merged. No label touched. Nothing written under `sot/`. Three scratch `.mjs` probes were written to
`C:\po-sup-fix-scripts\` (the sanctioned scratch folder, outside the repo).

## FINDINGS

### F1 — Every enabled bootstrap still omits all four PREFLIGHT preconditions, 7 days after the escalation was filed

[MEASURED] 2026-09-17T14:1xZ in node over the 4 ENABLED bootstraps, single-backslash Windows paths
(DOCTRINE §9.1 — a single-quoted PowerShell needle containing `\\` can never match a real path):

| the repo contract requires at STEP 1 / STEP 2 | enabled bootstraps naming it |
|---|---|
| load the tool schema FIRST; `InputValidationError` ≠ blindness | **0 of 4** |
| install `scripts/pipeline/vm-git-guard.sh` before any VM-side call | **0 of 4** |
| read the three binding docs from `git show origin/main:<path>`, never the working copy | **0 of 4** |
| stamp the four-line GROUND block | **0 of 4** |
| POSITIVE CONTROL `STEP 1` | **4 of 4** |
| NEGATIVE CONTROL, needle minted this run | **0 of 4** |

Verbatim from `Scheduled\04-scanner\SKILL.md`, STEP 1: *"Start a shell on the Windows host
(`start_process`, shell `powershell.exe`). **If that fails:** write one paragraph saying you are
blind … and END THE RUN."* The correction — *"a validation error is not blindness"* — lives only in
the station doc, which STEP 2 does not reach until after the stop STEP 1 would have taken.

**This run is a live instance of row 1.** The bare `mcp__desktop-commander__*` ids returned
"No matching deferred tools found" on the first attempt. A run following its bootstrap literally
stops there and files blindness. Blindness has been running near 40% of Station 00's occurrences with
no known cause; this is a mechanism that would manufacture some of it.

Already on file as `needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md` (S2,
OPEN). This is a re-verification at `a2f5e8a6`: **every row still zero, seven days on.**

**DISPATCHED** — to Station 00, to fold the updated denominators (F3) into that escalation and
re-surface it to Marco. The paste itself is Marco's; no agent may edit that layer.

**Cross-station measurement, same machine, 57 seconds apart — and it is the honest control on this
finding.** [MEASURED] Station 00's breadcrumb
`00-00-supervisor-2026-09-17-1409-blind-run-desktop-commander-would-not-connect.md` records that at
14:09:13Z the Desktop Commander server went **connecting → CONNECT_TIMEOUT (30000ms)** across four
`ToolSearch` keyword loads, never a literal `select:` of assumed ids. That is blindness by the
contract's definition — a failure *after* the load — **not** the unloaded-schema lie. At 14:10:24Z
the same server answered this run on the first keyword load. So: the intermittency DOCTRINE records
is real and was live this hour, 00's stop was correct, and F1 is not a claim that 00's blindness was
fake. **F1 is narrower and it still stands: 00 avoided the trap only because it applied the station
doc's rule, which its bootstrap does not contain** — and this run met the trap's own signature, a
`select:` of the bare `mcp__desktop-commander__*` ids returning "No matching deferred tools found"
before the keyword search found them under the plugin-prefixed names.

⚠️ **Consequence for this breadcrumb:** Station 00 was blind at 14:09Z, so the COLLECT that would
sweep this file up did not run this hour. It sits untracked until 00's next sighted occurrence.
### F2 — `.gitignore:107-111` is still wrong in 4 of 4 enabled bootstraps, 11 days after the escalation was filed

[MEASURED] all four enabled bootstraps (and 5 of 6 files) still carry *"Never one of the five
gitignored sinks named at `.gitignore:107-111`"*. Resolved against `C:\ProjectOperations2\.gitignore`
(151 lines) this run, lines 107–111 are:

```
107  !Claude Design/docs/
108  !Claude Design/assets/
109  Claude Design/assets/*
110  !Claude Design/assets/routes.js
111  !Claude Design/proposed/
```

The five sinks are at **115–119**, under the anchor `# Overnight-QA scheduled task` at line **113**.
Both wrongly-cited lines are **negation** rules, so a station that checks its own citation reads
`!Claude Design/assets/` under a sentence claiming `docs/qa/qa-findings.md` is gitignored — and the
available conclusion is that the file is now a safe tracked place to write a finding. That file
swallowed a released gate for nine days once already.

Second live instance, same class, not covered by that escalation's text: `Scheduled\05-sot-keeper\SKILL.md`
carries **`pr-gates.mjs:327`**, which resolves in `scripts/pr-gates/pr-gates.mjs` to a bare `{`.
DOCTRINE's own 2026-09-11 correction predicted `stations/05-sot-keeper.md` → 0 raw citations and
[MEASURED] today it is clean — **the station doc was converted to anchors and the bootstrap was not.**
Same shape, same layer, same cause as F1.

Already on file as `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` (S3, OPEN),
whose own ruling is quoted from an earlier Station 04 run and is worth repeating: *"Renumbering is a
fix with a half-life: it re-arms the trap and bills the next run to find it again."* The repo half was
fixed by rule text; the bootstrap half is still a number.

**DISPATCHED** — to Station 00, to add the `pr-gates.mjs:327` instance to that escalation's paste list.

### F3 — That escalation's denominators are one task out of date AGAIN, in the way it asked the next run to prevent

`needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md` was corrected on
2026-09-10T19:1xZ from "6 live bootstraps" to "**5 ENABLED tasks**", and closed that correction with
*"Recorded so the next run to re-measure does not read a mismatch as the escalation having moved."*

[MEASURED] this run from the MCP: the enabled count is **4**. `weekly-security-audit` went
`enabled: false` on or about 2026-09-06 and has not run since — which
`STATION-CAPABILITIES.md` §1 already records, in a correction dated five days *after* the escalation's.
So the four rows read **0 of 4**, the positive control **4 of 4** (not 4 of 5 — the one file without a
STEP block has left the corpus), and F2's row reads **4 of 4**, not 4 of 5.

Every row is still zero and every control still passes: **the escalation is LIVE and its question to
Marco is unchanged.** Only the denominators move, and again they move in the harmless direction. This
is recorded precisely because that file asked for it.

**DISPATCHED** — to Station 00, to annotate the escalation rather than let the next re-measure read a
mismatch as movement.

### F4 — Three open escalations, 7 to 11 days old, all asking Marco for the SAME physical act, none done

This is the additive finding; F1–F3 are re-verifications.

| escalation | filed | severity | what it asks Marco to do |
|---|---|---|---|
| `bootstraps-tell-every-run-to-read-the-working-copy-2026-09-06.md` | 2026-09-06 | S2 | paste a corrected STEP 2 into the bootstraps |
| `gitignore-citations-in-the-five-bootstraps-2026-09-06.md` | 2026-09-06 | S3 | paste a corrected sink sentence into the bootstraps |
| `bootstrap-preflight-omits-four-preconditions-2026-09-10.md` | 2026-09-10 | S2 | paste four missing preconditions into the bootstraps |

All three are one act: **edit `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`.** [MEASURED] every
bootstrap's mtime is `2026-09-01T00:07:44Z` — a single batch rewrite — so **none of the three has been
actioned**, and the layer has not been touched in 16 days while the station docs it points at have
moved repeatedly (`00-supervisor.md` mtime 2026-09-17, `04-scanner.md` 2026-09-07).

[MEASURED] the cause is structural, not neglect: `lint-station.mjs` does not read that layer (see
WHAT I MEASURED), so nothing ever fails, nothing ever reminds, and each sweep can only re-file. That
is the same pattern DOCTRINE §9.5 records for the anchor rule — *"four consecutive `instruction-drift`
sweeps … without either being fixed, because the fix that would have prevented them was applied to one
file and the rule was never widened"* — reproduced one layer further out, where no agent can apply the
fix at all.

**ESCALATED.** Marco: three separate small asks have each been open for over a week. RULE 1, both
halves, on the options:

1. **One consolidated paste, plus a generator that makes the next one unnecessary (recommended —
   passes both halves).** Paste all three corrections into the five bootstraps in one sitting, and let
   a station ship `scripts/pipeline/build-bootstrap.mjs` that emits the canonical bootstrap text from
   the station docs, so the next correction is a `git diff` you paste rather than a defect a sweep
   re-discovers. Complete: it fixes today's three *and* removes the re-rot path. Additive: it changes
   nothing about any run's data, and you remain the only actor who writes that layer.
2. **The consolidated paste alone.** Passes "solves it immediately"; **fails "and future"** — the
   bootstraps drift again the next time a station doc is corrected, and the evidence that they will is
   that all three of these arose exactly that way.
3. **Leave them; stations keep re-verifying each sweep.** Fails **both** halves. It also has a measured
   cost: F1 row 1 is a mechanism that turns a deferred tool schema into a false blind STOP, and the
   run that stops never reaches the document carrying the cure.

I did not do it myself because `STATION-CAPABILITIES.md` §1 makes the scheduled-task file the one
layer of five that no agent may edit. Option 1's script half is repo-side and inside a station's lane;
say the word and it can be staged as a prompt.

### F5 — My own path-resolution probe manufactured 7 phantom missing files, and the list was well-formed

Caught in-run, recorded because the `instruction-drift` sweep's own brief tells the next run to *"check
every path DOCTRINE and the station docs name still resolves"*, and this is the obvious way to write it.

[MEASURED] an extension alternation written `(?:md|mjs|ps1|js|ts|tsx|json|…)` matches `js` inside
`.json` and `ts` inside `.tsx`, truncating the path before the existence test. First run reported
**11 unresolved**, of which **7 were files that exist**: `sweep-rotation.js` (→ `.json`),
`_canonical-blocks.js`, `sot-refs-baseline.js`, `hex-baseline.js`, `relationship-map.js`,
`metadata-catalog.js`, `SettingsShell.ts` (→ `.tsx`). Nothing was empty, nothing warned, exit 0 — §9.6
inverted: a *fuller* wrong answer, not an emptier one. Written up unchecked it reads *"seven paths the
binding documents name are gone"*, which is a confident, coherent, wrong finding about the documents
every station is told it can trust — and `sot-refs-baseline.json` is cited by all seven station docs
and is ratcheted by CI, so the available next move would have been to "restore" a file that is present.

🔧 **Order the alternation longest-first** — `(?:mjs|json|yaml|prisma|tsx|yml|md|ps1|sh|js|ts)` — and
control the count against a path you know exists. Re-run with that ordering: **183 checked, 4
unresolved, all four explained** (above). ⚠️ **Falsifying probe:** run both orderings over the same
corpus; if they ever return the same count, this note is wrong.

**ACTIONED** — the defect was in my instrument, it was corrected inside the run, and the corrected
form and its probe are quoted here for the next `instruction-drift` sweep. Nothing in the repo
changed.

## WHAT I DID NOT DO

- **Did not touch the bootstrap layer.** `STATION-CAPABILITIES.md` §1: Marco pastes; it is the only
  one of the five layers an agent may not edit. F1–F4 are therefore reports, not repairs.
- **Did not edit the three `needs-marco/` escalations.** They are other stations' artifacts; Station
  04 is read-only on the board. F1–F3 are dispatched to Station 00, which owns collect.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** The authority matrix gives 04 *Mutate the
  board: NO*, and the dev tree is on `main`, which nobody commits to directly. Named under WHAT
  CHANGED for Station 00.
- **Did not run the other three sweeps.** `gate-liveness`, `instrument-honesty` and `repo-hygiene`
  were not touched this run; the rotation now stands at `last_index=3`, so the next Station 04 run
  takes `gate-liveness`.
- **Did not evaluate DOCTRINE §9.5's per-document citation prediction.** It does not distinguish a
  live citation from a quotation of command output, and at least one row
  (`STATION-CAPABILITIES.md`→1 against a measured 2) turns on that distinction. That is a **lead**,
  not a finding: settling it needs a rule for what counts, which is a change to the prediction rather
  than a measurement of it. Left for a future `instruction-drift` sweep.
- **Did not open a PR.** This breadcrumb is UNTRACKED at `docs/pr-prompts/` in the dev tree until a
  board PR commits it — Station 00 sweeps it up.
