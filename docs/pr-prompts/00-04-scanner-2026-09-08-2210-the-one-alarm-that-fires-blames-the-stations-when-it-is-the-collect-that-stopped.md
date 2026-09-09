# Station 04 — Scanner | 2026-09-08T22:10Z–2026-09-08T22:40Z

## GROUND

```
UTC            2026-09-08T22:10:46Z
origin/main    2279d2d9              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 533604dc       C:\ProjectOperations2   (BEHIND origin/main)
doc version    1                     docs/pipeline/stations/04-scanner.md
bootstrap      1                     C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

**Sighted run.** Desktop Commander loaded via keyword `ToolSearch` (not by hard-coded id), then
`start_process` shell `powershell.exe` → pid 28984. Not blind.

**Device-bridge git guard, quoted as the contract requires, pass:**
`vm-git-guard installed at /sessions/confident-cool-cray/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`

**Freshness of the three binding documents.** Read from the dev tree, which is the tree the contract
names. `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **EMPTY** — the sound form per §9.3, no piped hash. The dev tree is behind `origin/main`,
but not in these three files.

**Sweep taken.** `node scripts/pipeline/next-sweep.mjs` → `SWEEP: instruction-drift` (rotation
position 4 of 4; previous run 2026-09-08T18:11:10Z). Covered completely, per the one-sweep rule.

**Safe-to-act.** `status-sweep.ps1` captured to a file so its own §7 verdict could not be swallowed
by an early return: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
station worktrees.` This run mutated no board state regardless.

## WHAT I MEASURED

### The corpus, expressed as the capabilities doc requires — enabled tasks, never "the five"

[MEASURED] from the scheduled-tasks MCP, cross-checked against
`...\local-agent-mode-sessions\...\scheduled-tasks.json` on disk (read with `node`, not
`ConvertFrom-Json`, after the PowerShell parse returned a single collapsed object — §9.4):

| task | enabled | cron | lastRunAt |
|---|---|---|---|
| `00-supervisor` | **false** | `5 * * * *` | 2026-09-08T05:08:37.966Z |
| `03-machine-minder` | true | `0 9 * * *` | 2026-09-07T23:01:27.917Z |
| `04-scanner` | true | `0 */4 * * *` | 2026-09-08T22:10:25.359Z |
| `05-sot-keeper` | true | `10 0 * * *` | 2026-09-08T14:11:27.457Z |
| `weekly-security-audit` | true | `30 7 * * 1` | 2026-09-06T21:32:44.637Z |

**Four enabled tasks today, not five.** `C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md`
files; five of them sit under `_retired-2026-08-18\` and have no task behind them, and
`02-board-driver` has a folder with no live task — both already documented.

### Bootstrap ↔ station-doc parity: CLEAN, with the control that makes the zero mean something

[MEASURED] every `SKILL.md` under `Scheduled\`, recursively:

- All five station bootstraps were rewritten in ONE batch at **2026-09-01T00:07:44Z**.
- All five declare `station_doc_version: 1`.
- All seven station docs on `origin/main` declare `station_doc_version: 1` and `contract_version: 1`
  (read with `git show origin/main:<path>`).
- **Every bootstrap points at its own station doc and no other** — `00`→`00-supervisor.md`,
  `02`→`02-board-driver.md`, `03`→`03-machine-minder.md`, `04`→`04-scanner.md`,
  `05`→`05-sot-keeper.md`. No cross-wiring.

**No version drift anywhere.** `node scripts/pipeline/lint-station.mjs` → **exit 0**,
`ADMIT: all 8 docs clean`, plus `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`.
Its `NOTE contract is v3; these declare a different station_doc_version` is the known
`lint-station-compares-the-wrong-version-field-2026-09-05.md` escalation, already on file.

### Disproved advice in the bootstrap layer: ZERO, and the positives prove the query works

[MEASURED] `Select-String -SimpleMatch` over `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`:

| needle | hits | reading |
|---|---|---|
| `raw CDN lags` | **0** | the disproved advice is gone from this layer |
| `web_fetch` | **0** | same |
| `blob URL` | **5** | present, and CORRECT — the current `?plain=1` form |
| `cloud-fired` | **5** | present, and CORRECT — each one REFUTES the old blindness rule |

The two non-zero rows are the positive control: the query can find these strings, so the two zeros
are an absence and not a broken instrument. **The bootstrap layer is clean.**

### Path resolution across 11 instruction files: 0 genuine dangling citations

[MEASURED] with a purpose-written node scanner over all 11 bootstraps, all 7 station docs,
`DOCTRINE.md` and `STATION-CAPABILITIES.md` — 264 distinct cited paths. **9 do not resolve, and all
9 are correct as written:**

- `C:\\Foo\\Bar`, `r:\s`, `C:\po-watcher\zzzNoSuchNeedleZzz` — DOCTRINE quoting its own broken
  needles and negative controls as documentation.
- `C:\po-watcher\STOP-WATCHER` — DOCTRINE's own MEASURED "absent" claim. Correct.
- `C:\po-scan-` — 04's explicitly SUPERSEDED worktree block, commented out.
- `C:\ProjectOperations-Reference\worktrees` (×2, `02-board-driver.md`) — the doc says
  *"mkdir … first if missing"*; the parent `C:\ProjectOperations-Reference` **exists** (`Test-Path`
  → True). Correct.
- `docs/pr-prompts/00-00-...md` — a prose ellipsis.
- `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` — 04's own tombstone for a file deleted in
  the 2026-08-17 cleanup, already recorded as not-a-defect on 2026-08-29.

POSITIVE control `docs/pipeline/DOCTRINE.md` → exists; NEGATIVE control, a freshly minted path →
absent.

### The sixth layer's paths, since nothing else sweeps them

[MEASURED] `Test-Path`, **13 of 13 True** for every path the Cowork project-instruction block names
(`bring-up-to-speed.ps1`, all seven `sot/*.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md`,
`pipeline-lib.ps1`, `PROMPT-SCHEMA.md`, `smoke-pr.ps1`); NEGATIVE control → False.

### Trunk is red, and the red is the alarm rather than a defect

[MEASURED] `gh run list --commit 2279d2d91ddd032217efbb77dabbb9a2177fb794` — the **full** 40-char
SHA, per §9.4 — returns 5 runs: `CI` success, `Deploy` success, `Tendering Browser Smoke` success,
`Push on main` success, **`Pipeline heartbeat` failure**. Verdict pulled from column 3 of the job
log (§9.1), one line out of 139:

> `[heartbeat] SILENT: NO station has reported for 14.0h (threshold 6h). Newest is station 00 at 2026-09-08T07:00:00Z. Either the scheduler is off, the machine is down, or the app is not running. If this was deliberate, declare it in docs/pipeline/pause.json.`

`docs/pipeline/pause.json` is absent from `origin/main` (`git cat-file -e` → exit 128; POSITIVE
control on `DOCTRINE.md` → exit 0) and absent from disk. The silence is not declared.

### Breadcrumb collection state

[MEASURED] 13 depth-1 `00-*.md` on disk; 9 tracked on `origin/main`; **4 untracked**, written 10:26Z,
14:22Z, 14:28Z and 18:23Z — all after the last collect landed.

### Carried forward, measured but out of this sweep

- `C:\po-vg` orphan worktree, **age 6625 min**, holding **1 uncommitted file** — already escalated
  by Station 03 (`po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`). Growing.
- Watcher node RUNNING pid 31660, heartbeat age 527 min against an empty queue — idle, not wedged.
  Watcher clone `dirty=6`.
- Board: **1 open PR**, `#1822`, CI 13 pass / 2 fail. `armed: 0`.
- **Five uncommitted HOLD deletions in the dev tree are REAL, not the behind-HEAD artefact.** The
  tree is behind `origin/main`, so a ` D` in `git status` is a statement about `HEAD` (§9.2) — I ran
  the sound probe instead. `git diff --numstat origin/main -- <path>` returns a non-empty deletion
  count for all five (`pr-brandtheme-s0` 158, `pr-brandtheme-s1` 261, `pr-rates-consumers-s3-persona-export`
  85, `pr-stationcaps-blind-run-names-one-mount` 103, `pr-tfm-s11-copy-recursive-preserve` 219), so
  the files are still on `main` and their removal is committed nowhere. This is Station 04's own
  18:11Z finding (`…-1811-five-consumed-holds-still-live-on-main-…`) confirmed by the correct probe
  rather than re-derived; it belongs to the repo-hygiene sweep and to whoever commits the queue.
  `docs/pipeline/sweep-rotation.json` reads `2 2` — my advance, and real.

## WHAT CHANGED

Two writes, both to **gitignored** `docs/pr-prompts/needs-marco/` (`.gitignore:76-83`), which is not
a tracked-file write and is inside 04's authority; plus this breadcrumb and the rotation advance,
both left dirty in the dev tree for Station 00 to commit.

1. **NEW** `needs-marco/the-cowork-project-instruction-block-is-a-sixth-layer-escalated-to-nobody-2026-09-08.md`
   — finding F3 below. Read back: file present, 101 lines.
2. **APPENDED** to `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md` — a dated
   `STILL TRUE AT` block, finding F2 below. Not a new escalation; the existing one re-measured.
   Read back: append succeeded, 49 lines added.
3. **THIS BREADCRUMB**, untracked in the dev tree at
   `docs/pr-prompts/00-04-scanner-2026-09-08-2210-the-one-alarm-that-fires-blames-the-stations-when-it-is-the-collect-that-stopped.md`.
4. **`docs/pipeline/sweep-rotation.json`** advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-08T22:10:46Z`. **Left dirty
   deliberately — Station 00 commits it, because 04 may not.** If it is not committed, the next run
   repeats `instruction-drift` and the rotation stops turning.

No board mutation. No arm, no disarm, no merge, no label, no rename, no prompt staged.

## FINDINGS

### F1 — The one alarm that survives a switched-off scheduler names the wrong subsystem, and it is red on trunk right now [S2] — NEW

**Evidence.** `.github/workflows/pipeline-heartbeat.yml` exists precisely because
`check-breadcrumb.mjs --freshness` has only one consumer, Station 00, so switching 00 off stops the
question being asked. It runs on GitHub's clock, where the act that disables a station cannot reach
it. That design is right, and today it worked: it is the only red on `main`.

Its message is wrong in a specific and costly direction. It says **"NO station has reported for
14.0h"** and offers three causes: *the scheduler is off, the machine is down, or the app is not
running.*

[MEASURED] against that claim: `04-scanner` reported at 10:26Z, 14:28Z and 18:23Z, and
`05-sot-keeper` at 14:22Z — four breadcrumbs written **after** the 07:00Z the alarm calls the
newest. The stations are alive, on cadence, and reporting. The workflow checks out `main` and reads
filenames on the checked-out tree (its own comment: *"depth 1 is enough: the check reads filenames
in docs/pr-prompts on the checked-out tree"*), so what it actually measures is **whether a
breadcrumb has reached `main`** — i.e. whether the COLLECT is running. It cannot see the dev tree,
by construction, and should not try to.

**Angle 5, blast radius.** The wording sends the reader to check three things — scheduler, machine,
app — none of which is the operative cause, and omits the one that is: *breadcrumbs exist on disk
and nothing is committing them.* On a board where `00` is disabled and Marco is hand-driving, that
is exactly the wrong triage. It is also the failure mode the workflow's own header comment guards
against for CI (*"A FAILING RUN HERE MEANS THE PIPELINE IS QUIET, NOT THAT CI IS BROKEN"*) — the
same care was not taken one level down, for the difference between *quiet* and *uncollected*.

**Angle 3, the violated rule.** DOCTRINE §7.1: a station artifact must say how it knows. This
message asserts a fact about stations from a measurement of `main`.

**RULE 1.** The complete-and-additive fix is **wording only**, in
`scripts/pipeline/check-pipeline-heartbeat.mjs` at the `NO station has reported for` template:
say *"no breadcrumb has reached `main`"*, and add *"or the collect has stopped"* to the cause list.
*Complete* — it fixes today's misdirection and every future one, since the alarm can only ever
measure `main`. *Additive* — a string change; no logic, no threshold, no new instrument, nothing
that can newly fail. The alternative, teaching it to read the dev tree, fails the immediate half
(it runs on GitHub and cannot) and the future half (it would re-couple the one detector that
deliberately lives off the machine).

**DISPOSITION: DISPATCHED** — to Station 00, to stage as a one-file prompt against
`scripts/pipeline/check-pipeline-heartbeat.mjs`. ⚠️ **`scripts/` is outside `tests|docs`, so
`classifyPolicyFiles` routes the resulting PR to Marco** — 00 stages it, Marco merges it. Do not
expect the tests-docs lane to take it.

### F2 — Station 00 is still disabled, 17.0 h and ~17 missed hourly runs on [S1] — re-verified, NOT re-raised

**Evidence.** `enabled: false`, confirmed by two independent instruments (the scheduled-tasks MCP
and the on-disk `scheduled-tasks.json`, read with node). `lastRunAt 2026-09-08T05:08:37.966Z`
against cron `5 * * * *`. Four breadcrumbs uncollected.

**Angle 4, history — this is already on file and I did not re-derive it.** Station 04's own 06:10Z
run today found it (F1 of `00-04-scanner-2026-09-08-0610-station-00-is-disabled-so-no-breadcrumb-collects.md`,
now tracked on `main`) and filed
`needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`. It is also a recurrence of
`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md`. **The
only thing this run adds is elapsed time and a countable blast radius**, and that is all I wrote:
a dated addendum to the existing file, not a second escalation. A new file here would have been
noise on a queue that is already 46 deep.

**DISPOSITION: ESCALATED** — appended to the existing
`needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`. The decision is unchanged
and is Marco's: re-enable `00-supervisor`, or declare the pause in `docs/pipeline/pause.json` with
an `until` inside 72 h so trunk stops being red for a state he chose.

### F3 — The Cowork project-instruction block is a SIXTH instruction layer, off the map, and its escalation was filed to nobody for eleven days [S2] — NEW

**Evidence.** The block inlined into every chat in this project says *"Use `web_fetch` on that blob
URL (the raw CDN lags)."* `STATION-CAPABILITIES.md` §1 records that exact string as advice this
pipeline disproved and removed from `sot/` in #1298/#1299. [MEASURED] in `sot/README.md` itself:
`raw CDN` **0**, `web_fetch` **0**, `plain=1` **10**, POSITIVE control `BOOT` **6**. The removal is
real; the block is a surviving copy of the retired form.

**Angle 4, history — and this is the finding.** Station 04 raised it on 2026-08-29 as F4 of
`archive/00-04-scanner-2026-08-29-2210-bootstraps-refuted-blindness-rule.md`, disposition
**ESCALATED**, with the note *"bundle with F1; do not spend a separate cycle on it."* F1 closed.
This did not, and **no `needs-marco/` file was ever written for it**. [MEASURED] over
`needs-marco/*.md` + `docs/pr-prompts/*.md`: `CDN lags` → **0**, `project instruction` → **0**,
`five-layer` → **0**, `sixth layer` → **0**; POSITIVE control `DISPOSITION` → **71**; NEGATIVE
control, a freshly minted needle → **0**. The query works, the corpus is not empty, and the finding
is in none of it. **An ESCALATED disposition with no `needs-marco/` file is escalated to nobody**,
and eleven days is the measured cost.

**Angle 5, blast radius — the layer, not the clause.** §1's table has five rows and the
project-instruction block is in none of them, though it issues the first instruction of every
interactive session in this project. §1's own standing rule is *"when a layer is added, add it here
first"*, and its own recorded lesson is *"a layer that is not in the map does not get swept"* —
written after `.claude/agents/` carried 203 double-encoded sequences onto `main` unnoticed. Same
shape, caught before it cost anything. **Everything else in the block checks out:** 13 of 13 cited
paths resolve, and its retirement of the `MAIN / OldMain# / Chat# / DR#` routing model agrees with
`sot/README.md`.

**RULE 1, in the escalation file:** (a) delete the clause **and** add the layer to §1's table —
complete and additive, both halves pass, and the §1 row is an ordinary docs PR an agent can do once
Marco says the layer is real; (b) delete the clause only — fails the future half; (c) leave it —
fails the immediate half.

**DISPOSITION: ESCALATED** — Marco, as
`needs-marco/the-cowork-project-instruction-block-is-a-sixth-layer-escalated-to-nobody-2026-09-08.md`.
Only he can edit that layer.

### F4 — My own path-resolution sweep lied first, and the mechanism is one a §9 reader would not predict [S3] — NEW

**Evidence.** The first run of this sweep's path scanner reported **29 dangling citations** across
the bootstraps and station docs, including `docs/qa/sot-refs-baseline.js` in **all five** bootstraps
and all seven station docs — a finding that reads as systemic drift in the exact layer this sweep
exists to audit. It is false. The extension alternation in the path regex was written
`(?:md|mjs|ps1|js|json|ts|tsx|…)`, and a JavaScript alternation matches **left to right, first
match wins** — so `.json` was truncated to `.js` and `.tsx` to `.ts` before the existence test ever
ran. **20 of the 29 were manufactured by that one ordering.** With the alternation reordered
longest-first and an `(?![A-Za-z0-9])` boundary added, the count is **9**, and all 9 are
documentation artefacts (listed under WHAT I MEASURED).

**Angle 3, the violated rule.** DOCTRINE §7 guard 1: prove the check can pass before believing it
failed. It did fail loudly enough to notice — five identical hits across five files is implausible —
but nothing in the tooling warned, both runs exited 0, and §9.6 does not fire because nothing was
empty. This is §7's shape exactly: a broken measurement of a working system, in the direction of
manufacturing a finding.

**Angle 5, blast radius.** Path-existence sweeps are run routinely here — this sweep's own
definition ends *"Check every path DOCTRINE and the station docs name still resolves"* — and this
repo's instruction layer cites `.json` and `.tsx` heavily (`sot-refs-baseline.json`,
`sweep-rotation.json`, `_canonical-blocks.json`, `relationship-map.json`, `metadata-catalog.json`,
`SettingsShell.tsx`). Any future run that writes its own scanner hits the same wall. [MEASURED]
`scripts/pipeline/lint-station.mjs` is **not** affected — its path checks use anchored per-shape
regexes, not an extension alternation, and it reported no missing repo path this run.

**DISPOSITION: DISPATCHED** — to Station 00, as a candidate bullet for DOCTRINE §9.3 (files and
encoding), sibling to the existing node-side traps: *"An extension alternation matches left to
right. `(?:js|json)` can never match `.json`; order longest-first and anchor the tail. Control any
path-existence sweep against a path you know is present AND one you know is not — the failure
manufactures dangling citations rather than hiding them."* §9 is a hash-gated canonical block and
04 may not edit it; the scanner that found it is preserved at
`C:\po-sup-fix-scripts\scan-instruction-drift-20260908.mjs` with both controls in it.

### F5 — Two state claims inside `STATION-CAPABILITIES.md` §1 have rotted again, inside the paragraph that warns state rots [S3]

**Evidence.** [MEASURED] §1 records *"all five bootstraps were rewritten in ONE batch at
`2026-08-24T22:54:22Z`"*; today all five read **2026-09-01T00:07:44Z**. §1 also records *"five
enabled tasks"* ([MEASURED] 2026-09-07); today there are **four**, because `00-supervisor` is
disabled.

**Why this is S3 and not higher.** The paragraph already carries its own cure — *"Measure a
bootstrap's currency — never quote this file for it"* — and prescribes the exact `Get-Item …
LastWriteTimeUtc` probe. A reader following the instruction is not misled. The rot is in the
worked example, not the rule, and this is the **second** time that same paragraph has gone stale
(the first was caught 2026-08-31, six weeks out). The general lesson is the one §1 states about
itself: *"Instructions live here; state does not."*

**DISPOSITION: DEFERRED** — real, cheap, and not urgent, because the rule above it is correct and
self-protecting. What would make it urgent: a run quoting either number instead of measuring it, or
a third rot in the same paragraph — at which point the worked example should be deleted rather than
re-measured, since a paragraph that has rotted three times is arguing for its own removal.

## WHAT I DID NOT DO

- **Did not re-file the disabled-00 escalation as new.** It was found by Station 04 at 06:10Z today
  and is on file. I appended a re-measurement and nothing else. Re-raising it would have added a
  47th file to the `needs-marco/` queue and taught the next run that the queue is noise.
- **Did not touch the board.** `armed: 0` before and after. No prompt staged, armed, disarmed,
  renamed or moved; no PR merged, labelled or updated; no `-HOLD` created. 04 is read-only and the
  sweep needed nothing.
- **Did not fast-forward the dev tree**, though it is behind `origin/main`. The three documents I
  had to read were verified byte-identical to `origin/main` by `git diff --numstat`, so the FF would
  have bought nothing, and a FF plus the board trap is a real risk for zero gain on a read-only run.
- **Did not commit the rotation advance or this breadcrumb.** Both are deliberately dirty in the dev
  tree. 04's authority matrix is *Create a PR: NO*, *Mutate the board: NO*, and the dev tree is on
  `main`, which nobody commits to directly. **Station 00 must sweep both.** With 00 disabled, that
  is not currently happening — which is F2, and this breadcrumb is now the fifth uncollected one.
- **Did not run the Part 1 GitHub reconciliation or the Part 2 live-site pass.** One named sweep per
  run, covered completely; `next-sweep.mjs` named `instruction-drift`. A shallow pass over
  everything is why findings rot.
- **Did not investigate `#1822`'s two failing checks**, `C:\po-vg`'s uncommitted file, or the
  watcher clone's `dirty=6`. All are measured above and all belong to other lanes — the first to
  whoever drives the board, the second and third to Station 03, which already has `po-vg` open.
- **Did not touch Azure, Entra or SharePoint**, and nothing in this sweep came near them.
