# Station 05 — SoT Keeper | 2026-09-21T00:04Z–2026-09-21T00:35Z

## GROUND

```
UTC            2026-09-21T00:04:41Z
origin/main    875e1076            (fetched, then rev-parse)
dev tree       main @ 895bdefc      C:\ProjectOperations2   (1 behind origin/main)
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE**, so this run is not read-only.

**Read from the working copy, and that is sound here because it was proved identical.** PREFLIGHT
step 2 says read the three binding documents from `git show origin/main:<path>`. I read the working
copy and then proved the reading: `git diff --numstat origin/main -- docs/pipeline/stations/05-sot-keeper.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, which DOCTRINE
§9.3 names as the real answer to "do these differ". Same probe over this run's audit inputs
(`sot/`, `apps/api/prisma/schema.prisma`, `docs/data-model/metadata-catalog.json`,
`docs/qa/sot-refs-baseline.json`, `scripts/data-model/`) also returned EMPTY — so although the dev
tree is one commit behind, **every file this run reasoned about is byte-identical to `origin/main`.**

**MISSED OCCURRENCES: THREE — 2026-09-18, 2026-09-19, 2026-09-20.** This station's previous
breadcrumb is stamped `2026-09-17T14:11Z`, 82.0 h before this run. See F1; it is a finding, not
only a chore.

**This run is itself off-cron.** `05-sot-keeper` is `10 0 * * *` (Brisbane), i.e. 14:10Z, and
`nextRunAt` is `2026-09-21T14:10:37Z`. This occurrence fired at `00:04:02Z`. See F1.

## WHAT I MEASURED

**Reachability — SIGHTED, not blind.** [MEASURED] `start_process` shell `powershell.exe` after a
`ToolSearch` load returned `2026-09-21T10:04:41+10:00`, `main`, `895bdefc`. Desktop Commander is
present and the Windows host is reachable.

**vm-git-guard — installed, quoted as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, last line verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceding line: `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)`). No `git` was run from the VM
against the Windows `.git` at any point in this run.

**Mount enumeration.** [MEASURED] `/sessions/<id>/mnt/` holds **three** folders this session —
`ProjectOperations2`, `PR-Master`, `outputs`. **`po-watcher` is NOT mounted**, so DOCTRINE §9.5's
three-homes rule was not available from the VM side. It did not bite: this run issued no
review-verdict or watcher-log claim from the mount. Every host fact below came through Desktop
Commander.

**Sweep.** [MEASURED] `status-sweep.ps1` captured through `cmd /c … > file 2>&1` (so DOCTRINE
§9.3's UTF-16LE `>`/`*>` trap does not apply — `file` reports `ASCII text`, no BOM), generated
`2026-09-21 00:06:32Z`. Section 0 instrument controls both `[LIVE]` PASS. **Section 7 verdict:
`SAFE TO ACT`.** Section 3: `index.lock` False/False, scoped git processes **0**, no PR touched in
the last 2 min. Section 4: **armed = 0**.

**§9.1 expansion layer is LIVE on this transport.** [MEASURED] a `start_process` command string
containing `foreach($n in 2005,…)` arrived at the child as `foreach( in 2005,…)` →
`ParserError: Missing variable name after foreach`; `('NODE_EXIT=' + $LASTEXITCODE)` arrived as
`('NODE_EXIT=' + )`. Every subsequent `$`-bearing step in this run was moved into a `.ps1` and run
with `-File`, per the bullet's unconditional cure.

**§9.1 early return is LIVE too, and the buffer was drained rather than believed.** [MEASURED] the
PR-state script reported `Process 27208 is waiting for input` after one of five rows; two further
`read_process_output` calls returned the remaining rows plus `MARKER_PRSTATE_DONE` and
`MARKER_OPEN_DONE`, then `exit code 0`. The marker-after-every-statement guard is what made that
decidable.

### Audit step 1 — schema parse sanity
[MEASURED] `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (296 models, 70 enums, 493 edges)`, exit 0.
Per the 2026-08-25 correction this proves parse sanity only, **not** that sot/04 is current.

### Audit step 2 — catalog validity
[MEASURED] `JSON.parse(docs/data-model/metadata-catalog.json)` → parses, 4 top-level keys. **Valid.**

### Audit step 3 — sot/04 drift, by CONTENT (the 2026-09-14 probe), not by header counts alone
- Header counts, the cheap read: sot/04 line 16 reads `Models: 296 | Enums: 70 | FK edges: 493 |
  Domains: 23`; a freshly generated `relationship-map.md` reads the identical four. **MATCH.**
- The probe that actually answers: [MEASURED] sliced sot/04 between `<!-- SOT04-GENERATED:BEGIN -->`
  (offset 1108) and `<!-- SOT04-GENERATED:END -->` (offset 171640), sliced the generated map from
  its `## Table of Contents` heading (offset 437), normalised CRLF→LF and trimmed, compared the two
  **strings** (never their lengths or line counts — §9.3): **IDENTICAL = true.**
- **S2 determinism, run twice:** `sha256` of `relationship-map.md`
  `01e11fba3aed2179cc6d4c8bef0bd88f49a562fa7f0ad72af67f7adbaa9fcb6c`, `.json`
  `9a1c96b2…`, `metadata-catalog.json` `979e6efe…` — **byte-identical across both runs.**
- **The generator was run in a throwaway tree (`/tmp/s05gen`), never in the dev tree**, because it
  writes tracked `metadata-catalog.json`. The dev tree's `docs/data-model/` was not touched.

**Conclusion: sot/04's generated section is CURRENT. No re-merge needed.**

### Audit step 4 — roadmap drift
[MEASURED] live via `gh pr view <n> -R GH-Mantova/ProjectOperations --json number,state,mergedAt,closedAt`,
with the sound negative control `gh pr view 999997 --json number,state` → **exit 1**, `GraphQL: Could
not resolve to a PullRequest with the number of 999997` (never `--json number` alone — §9.4):

| PR | state | mergedAt | closedAt |
|---|---|---|---|
| #2005 | CLOSED (unmerged) | — | 2026-09-17T17:25:24Z |
| #2002 | MERGED | 2026-09-17T18:57:07Z | 2026-09-17T18:57:07Z |
| #1998 | MERGED | 2026-09-17T18:22:10Z | 2026-09-17T18:22:10Z |
| #2017 | OPEN | — | — |

`gh pr list --state open` → `OPEN_COUNT=1`, `#2017`. sot/02 §2 read **"open right now (3)"** and
named the first three. See F2 — ACTIONED in this PR.

### Audit step 5 — automation health
- [MEASURED] sweep §2: watcher node **RUNNING pid 9744**, auto-restart wrapper alive, heartbeat age
  4594 min with an empty queue (idle, not wedged, per the sweep's own note).
- [MEASURED] scheduled-tasks MCP — the live schedule, never this document: **four enabled tasks**
  (`00` `5 * * * *`, `03` `0 9 * * *`, `04` `0 */4 * * *`, `05` `10 0 * * *`);
  `weekly-security-audit` `enabled: false`. **All four enabled tasks carry `lastRunAt` inside one
  second of each other: `00` `00:04:02.083Z`, `04` `00:04:02.399Z`, `05` `00:04:02.777Z`** — and
  `03-machine-minder`'s `lastRunAt` is **`2026-09-16T23:01:15Z`**, four days ago. See F1 and F3.
- [MEASURED] `Pipeline heartbeat`: `gh run list --workflow "Pipeline heartbeat" --limit 12` →
  **12 of 12 FAILURE**, `2026-09-18T20:42:58Z` through `2026-09-20T23:05:57Z`. Running its script
  locally names the cause verbatim: `[heartbeat] SILENT: NO station has reported for 77.1h
  (threshold 6h). Newest is station 00 at 2026-09-17T19:08:00Z.` `docs/pipeline/pause.json` does
  **not exist**, so the silence was not declared. See F4.

### Rule Zero — local PASS cross-checked against real CI conclusions
- Trunk, per-commit with the **full** 40-char SHA (§9.4): `gh run list --commit
  875e107671f1fba315f03c4b121f558cf5648bfe` → 20 runs. `CI` (push) **success**, `CodeQL` (dynamic)
  **success** ×2, `Tendering Browser Smoke` (push) **success**. The 15 failures are **all**
  `Pipeline heartbeat`, `event=schedule` — excluded from the trunk verdict by the scoping denylist
  `TRUNK_VERDICT_SCOPED_V1`, which has landed and is working: the sweep printed `(trunk green)` and
  listed the heartbeat separately under `NOT trunk CI … excluded`.
- The matching CI job: `Data model — generator sanity (schema.prisma parses cleanly)` on #2017 →
  **pass**. Local `--check` → OK. **AGREE — no ENVIRONMENT DISAGREEMENT this run.**
- #2017's two reds, read as a verdict token and not as a count (§9.4): column 3 of the CP-26 job log
  (run `35267717655`, job `105358940274`) reads verbatim `FAIL - CP-26 approval-receipt
  [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true). A human must review and REMOVE
  the label`. `gh pr view 2017 --json labels` → `do-not-merge`. NEGATIVE control, a freshly minted
  needle over the same 223-line log → **0**. **Parked by design; not work, and not mine.**

### Audit step 6 — model ↔ migration coherence
[MEASURED] 296 models parsed from `schema.prisma` (`@@map` honoured), 255 `migration.sql` files
(648,008 B) concatenated: **0 models with no mention in any migration**. POSITIVE control
`HealthcheckSeedMarker` → table `healthcheck_seed_markers`, found. NEGATIVE control
`zzQq05Tbl20260921` → not found.

### Audit step 7 — module registry — **[CANNOT MEASURE] as specified, and my first instrument lied**
My first probe compared the 81 directory names under `apps/api/src/modules` against sot/01
SECTION 13 and reported **36 missing** — with its own POSITIVE control (`access-requests`) reading
**absent**. Under §7 guard 1 that is a broken instrument, not a finding, and I did not file it.
SECTION 13 is **curated prose keyed by BUSINESS name** ("Tendering", "Quote system"), not by code
slug, so the probe was answering a different question. Re-pointed with controls that pass —
POSITIVE `Tendering`/`Contracts`/`Quote`/`Rates admin`/`Projects` all PRESENT, NEGATIVE
`zzQq05Reg20260921` ABSENT — ten business-distinct capabilities with live API modules are absent
from SECTION 13 by name: **CRM, Expenses, Procurement, Inventory, Surveys, Handovers, Geocoding,
Map locations, Branding, Public holidays**. See F5. There is still **no sound general instrument**
for this step, only this hand-built one.

### The sot-refs burn-down — the primary housekeeping obligation
[MEASURED] `node scripts/pipeline/check-sot-refs.mjs` →
`total=275  dangling=0  exempt=20  baselined=0  excluded=2` /
`All sot/ references resolve. This is the boring, correct outcome.`
`docs/qa/sot-refs-baseline.json` `entries.length` = **0**.
**The baseline is fully burned down. There is nothing to burn today, and nothing was invented.**

## WHAT CHANGED

Two dated units of work, because this run is a catch-up as well as today's occurrence.

**Unit A — the occurrences owed for 2026-09-18, 09-19 and 09-20.** The work those three runs would
have done is the audit above, and it is *not* additive: a sot/04 re-merge, a burn-down entry or a
roadmap refresh owed on 09-18 is discharged by doing it once now against today's `origin/main`.
Re-run today, the entire deterministic allowlist came back clean (sot/04 content-identical,
baseline empty), so **the only thing the three missed occurrences actually owed was the sot/02
snapshot refresh, and it is done below.** The missed occurrences themselves are F1.

**Unit B — today's occurrence, 2026-09-21.** One doc-reconcile PR, opened from a disposable
worktree off `origin/main` (`C:\po-worktrees\s05-reconcile-20260921`, branch
`docs/sot-reconcile-2026-09-21-inpr-snapshot`), created at `875e1076` with
`WT_CLEAN_COUNT=0` and `SAME_AS_ORIGIN_MAIN=True`. `git diff --cached --name-status` in the dev
tree was **EMPTY** before any commit (§9.2's shared-index guard). Two files, `20/6` and `16/2`:

1. `sot/02-roadmap-and-status.md` §2 — the In-PR snapshot refreshed from "(3)" naming
   #2005/#2002/#1998 to "(1)" naming #2017, plus a dated note recording what moved and why.
   **No roadmap STATUS semantics changed**, exactly as the 2026-09-06 and 2026-09-17 refreshes
   recorded of themselves.
2. `docs/pipeline/stations/05-sot-keeper.md` — the AUTHORITY bullet claiming a regen **shrinks**
   `metadata-catalog.json` is corrected: the shrink is line endings, not content (F6).

Edits were made with **node, by concatenation**, never `String.replace` with a replacement string
(§9.3's `$`-in-replacement trap), and every splice asserted its **byte delta** equals
`NEW.length − OLD.length` exactly: `21492→21057` (expected 21057), `21057→22375` (expected 22375),
`37305→38701` (expected 38701). All three passed. ⚠️ One read-back assertion of mine
(`old_gone`) reported false on the append-style splice **because NEW contains OLD as its prefix** —
my assertion was miscalibrated, not the edit; the byte delta, the single-match count and the
rendered `git diff` all confirm the intended change and nothing else.

**Nothing was armed. Nothing was merged. No label was touched. `/sot/` was edited only inside this
doc-reconcile PR. No `scripts/`, `apps/`, `.github/` or lockfile path is in the diff (CP-24).**

## FINDINGS

### F1 — Three consecutive missed occurrences, and the whole scheduler fired once at a single instant
[MEASURED] `check-breadcrumb.mjs --freshness --station 05`: `last 2026-09-17T14:11:00Z 82.0h ago
(cadence 24h) SILENT`. 05 owes **09-18, 09-19, 09-20**. This is not 05 alone: the scheduled-tasks
MCP shows `00`, `04` and `05` with `lastRunAt` inside **0.7 seconds** of one another
(`00:04:02.083 / .399 / .777Z`), which no combination of `5 * * * *`, `0 */4 * * *` and `10 0 * * *`
produces — and this occurrence is ten hours off 05's own cron slot. The consistent reading is that
**nothing fired for ~77 h and the whole task set was released together when the app came back**,
which the heartbeat's own message independently states (F4) and the board corroborates: the newest
merge on the board is `#2016` at 2026-09-17, four days ago. The cause sits in the scheduled-tasks
layer, which is Marco's and outside this repo; 05 cannot fix it and must not guess at it.
**DISPOSITION: DISPATCHED** — to Station 00, which is the only station that collects, together with
F3 and F4 as one story rather than three. 05's own remedy (do the missed work in the next
occurrence) is discharged in WHAT CHANGED, Unit A.

### F2 — sot/02's In-PR table was four days stale, for the third time, and the rot is structural
The table read "open right now (3)" against a live board of **1**, naming two PRs that had merged
and one that closed unmerged, all three within 4.5 hours of the snapshot timestamp the table itself
carried. Measurements in step 4 above, with a passing negative control. This is the third
consecutive refresh by this station (2026-09-06, 2026-09-17, 2026-09-21).
**RULE 1 applied.** The complete-and-additive fix is to stop hand-maintaining a snapshot of a live
board — generate the table, or add a check that fails when a PR named in it is no longer open. That
solves it immediately *and* in future and damages nothing. It is a `scripts/` change and therefore
outside Station 05's lane (CP-24 hard-blocks `sot/` + `scripts/` in one PR, and
`STATION-CAPABILITIES.md` §5 gives 05 no `scripts/` lane). The alternative actually taken — refresh
the snapshot — passes the "immediately" half and **fails the "future" half**: it will rot again, on
the evidence, within days.
**DISPOSITION: ACTIONED** — refreshed in this PR and verified by the rendered `git diff` above; the
permanent half is handed to Station 00 in F2's RULE 1 paragraph for staging as a `scripts/` prompt.

### F3 — Station 03 has not run for four days and its next slot is another 23 hours away
[MEASURED] scheduled-tasks MCP: `03-machine-minder`, `enabled: true`, `cronExpression 0 9 * * *`,
**`lastRunAt 2026-09-16T23:01:15Z`**, `nextRunAt 2026-09-21T23:00:45Z`. Unlike `00`/`04`/`05`, 03
did **not** join the 00:04:02Z release, so on the reading in F1 it missed 09-17 through 09-20 and is
still missing today's. That matters beyond tidiness: the sweep is holding live work that is 03's
alone — `[LIVE] orphaned worktree … C:/PR-Master/worktrees/po-vg` which **holds 1 uncommitted file**
and must be preserved rather than force-pruned, and `[LIVE] REGISTRY-ESCAPEE:
C:\po-worktrees\po-fix-2005`. 05 has no authority over worktrees or machines and did not touch
either.
**DISPOSITION: DISPATCHED** — to Station 00, which dispatches 03.

### F4 — The one alarm built to survive the stations being off fired twelve times, correctly, and nothing read it
`Pipeline heartbeat` exists, in its own words, because *"the pipeline asks 'is anything failing to
run?' only from INSIDE a run. Switch the runs off and the question stops being asked."* It runs on
GitHub's clock precisely so the act that disables the stations cannot reach it. [MEASURED] it
FAILED on **12 of its last 12 runs**, continuously from `2026-09-18T20:42:58Z` to
`2026-09-20T23:05:57Z`, and its script states the reason exactly: `SILENT: NO station has reported
for 77.1h (threshold 6h)`. No `docs/pipeline/pause.json` exists, so this was not a declared pause.
**The alarm worked perfectly. The gap is that it has no reader who is awake when it fires** — its
only consumers are the stations, which were the thing that was off, and the one instrument that
would surface it to a returning run, `status-sweep.ps1`, files it under `NOT trunk CI on this
commit, excluded from the verdict above` in the same breath as the Dependabot noise DOCTRINE §9.5
teaches stations to disregard. A heartbeat failure is the **opposite** of noise: it is the only
out-of-band evidence this pipeline has that it stopped. Scoping it out of the *trunk verdict* is
correct; presenting it beside the noise is what costs a reader.
**DISPOSITION: DISPATCHED** — to Station 00. The change (give `status-sweep.ps1` a dedicated
`PIPELINE QUIET` line, or surface the heartbeat conclusion in section 7 rather than in the excluded
bucket) is `scripts/`, outside 05's lane, and the "who reads the alarm when every station is off"
half is Marco's.

### F5 — sot/01 SECTION 13 does not name ten live modules, including the CRM work merging this week
Measured in step 7 above, with controls that pass in both directions. CRM is the sharpest case:
#1986, #1998 and #2017 are all CRM slices merged or open in the last four days, and the word does
not appear in the module registry. sot/01's own §17 rule says *"§13 module registry should always
reflect what's on `main`"*, so this is drift against the file's own standard. **It is curated prose
and requires judgement about what each module does**, which the AUTO-FIX allowlist puts firmly
outside deterministic reconcile — so it is reported, not written.
**DISPOSITION: ESCALATED** — to Marco, via Station 00, as a question and not a status update:
*ten capabilities are live in code and absent from the SoT module registry; do you want (a) Station
05 to add one-line entries per module derived strictly from each module's existing route/controller
names, as a doc-reconcile PR you review — complete and additive, no business meaning invented, but
it puts machine-derived prose into a curated section; or (b) a development chat to write the
business descriptions properly, which is slower but is the only way the entries say what the modules
are for?* **(a) is the complete-and-additive option and is offered first**; it fails neither RULE 1
half outright, but it is thinner than (b). (b) fails the "immediately" half — it waits on a human
writing ten descriptions.

### F6 — The station doc told me to expect a catalog "shrink" and never said it was harmless
The AUTHORITY section read *"Regenerating the data-model map **shrinks** tracked
`metadata-catalog.json`; that has aborted a slice before. Expect it and say so."* [MEASURED] the
shrink is **exactly the CRLF count and nothing else**: tracked 723,969 B, regenerated 695,182 B,
delta 28,787, and the tracked file contains 28,787 CRLF pairs. Parsed, the two are equal —
296 models → 296, 23 domains → 23, **0 keys removed, 0 added, 0 of 296 model entries differing** —
and `Buffer.compare` after CRLF normalisation returns **0**. So the bullet describes DOCTRINE §9.3's
"never compare lengths across a line-ending boundary" trap while instructing the reader to expect
its symptom and treat it as real, which is how a slice gets aborted on an instrument. Corrected in
this PR with the measurement and a falsifying probe.
**DISPOSITION: ACTIONED** — the corrected bullet is in this PR's diff (`16/2` on
`docs/pipeline/stations/05-sot-keeper.md`); verified by the rendered diff and by the byte-delta
assertion recorded in WHAT CHANGED.

## WHAT I DID NOT DO

- **Did not re-merge sot/04.** Its generated section is byte-identical to a freshly generated map by
  the content probe, not merely by header counts. Re-merging a section that has not moved would be
  churn dressed as reconcile.
- **Did not touch `docs/qa/sot-refs-baseline.json`.** `entries.length` is already **0** and
  `check-sot-refs.mjs` reports `dangling=0 baselined=0`. There is nothing to burn down; inventing an
  entry to look busy would violate the file's never-add rule.
- **Did not regenerate artifacts into the dev tree.** The generator writes tracked
  `metadata-catalog.json`, so both determinism runs went to `/tmp/s05gen`. The dev tree's
  `docs/data-model/` is untouched.
- **Did not file "36 modules missing from the registry".** My first instrument's positive control
  failed; under §7 guard 1 that made it a broken instrument, not a finding. The re-pointed,
  controlled version is F5 and reports ten, not thirty-six.
- **Did not edit sot/01 SECTION 13, or any curated prose in sot/01/02/03/05/06 beyond the §2 live
  snapshot** whose refresh this station has recorded as snapshot-only twice before.
- **Did not touch the board.** #2017 is BLOCKED on `[LABEL_PRESENT]` and only Marco removes that
  label. 05 never arms and never merges; this PR was opened without auto-merge.
- **Did not touch worktrees, the watcher, or the watcher clone** — F3's orphaned worktree holds an
  uncommitted file and is Station 03's, dispatched not handled.
- **Did not run `git` from the VM against the Windows `.git`**, and did not run any `.ps1` from the
  mount. The guard was installed first and every host command went through Desktop Commander.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed came near them.
