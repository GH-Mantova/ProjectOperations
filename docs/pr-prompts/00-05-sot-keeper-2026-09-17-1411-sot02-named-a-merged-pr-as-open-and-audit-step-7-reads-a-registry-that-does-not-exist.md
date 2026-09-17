# Station 05 — SoT Keeper | 2026-09-17T14:11Z–2026-09-17T14:42Z

## GROUND

```
UTC            2026-09-17T14:11:15Z
origin/main    a2f5e8a6            (fetched, then rev-parse)
dev tree       main @ a2f5e8a6     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run was READ-WRITE within its lane.

**Not a blind run.** Desktop Commander loaded via `ToolSearch` (keyword `desktop-commander`, ids taken
from what the search reported, never assumed), then `start_process` shell `powershell.exe` returned
`main` and a working tree on the first call.

**No missed occurrence.** `node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05` →
`05  last 2026-09-16T14:11:00Z  24.0h ago  (cadence 24h)  ok`. Read as an AGE, not as the `ok`:
24.0h is exactly ONE cadence, so nothing is owed. One unit of work today, not two.

⚠️ **The host clock reads 2026-09-17T14:11Z while the Cowork session header reads 2026-09-18.** These
agree: cron is Brisbane (UTC+10), so `10 0 * * *` fires at 00:10 LOCAL on the 18th = 14:10Z on the
17th. This is DOCTRINE §9.5's date-naming trap wearing a different hat — every timestamp in this
report is UTC and none is constructed from a local date.

## WHAT I MEASURED

**Doc freshness — all three binding documents read from a tree proved equal to `origin/main`.**
`git diff --numstat origin/main -- docs/pipeline/stations/05-sot-keeper.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY** [MEASURED]. Empty output is the real answer (§9.3); no piped `hash-object` was used
anywhere in this run.

**Device-bridge git guard.** `bash .../scripts/pipeline/vm-git-guard.sh`, last line verbatim
[MEASURED]: `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
— preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`. **PASS.** No `git` was run through the
mount at any point in this run.

**PREFLIGHT 4 — sweep.** `status-sweep.ps1`, captured to a file and decoded in node (the `*>`
UTF-16LE trap, §9.3) [MEASURED]:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
and `[LIVE] git index.lock  interactive/clone: False / False`. No lock to age or size.

**Audit 1 — schema parse.** `node scripts/data-model/build-relationship-map.mjs --check` → exit 0,
`OK: generator ran cleanly against schema.prisma (296 models, 70 enums, 493 edges)` [MEASURED].
Recorded per the 2026-08-25 correction as a PARSE check only — it is not a drift gate.

**Audit 2 — catalog validity.** `JSON.parse` of `docs/data-model/metadata-catalog.json` → OK,
723,969 bytes, 4 top-level keys [MEASURED]. Valid.

**Audit 3 — sot/04 drift, BOTH probes.** Header counts: sot/04 reads
`Models: 296 | Enums: 70 | FK edges: 493 | Domains: 23`, a freshly generated map reads the identical
four [MEASURED]. Because a header match is structurally blind to field-level drift (the 2026-09-14
correction), the CONTENT comparison was also run: sot/04 sliced between `SOT04-GENERATED:BEGIN/END`
against `relationship-map.md` from `## Table of Contents`, line endings normalised, stamp lines
masked, **strings compared — never lengths or line counts** (§9.3) →
**`IDENTICAL=true`, 166,790 chars both sides** [MEASURED]. sot/04's generated section is CURRENT.
**This does not falsify the 2026-09-14 correction** — it is one commit where the two probes agree,
which that correction explicitly permits; falsification needs a commit where content disagrees while
the counts agree.

**S2 determinism.** The generator was run TWICE in a disposable worktree off `origin/main`; all three
artifacts byte-identical across runs, including the stamp [MEASURED]:
`relationship-map.json 2079599 / 9a1c96b2d245b0e7`, `relationship-map.md 167228 / 5f22e0d70891c2fd`,
`metadata-catalog.json 695182 / 979e6efebb9c4fc4`. **PASS.**

**A near-miss I am recording because the next run will meet it.** The freshly generated
`metadata-catalog.json` is **695,182** bytes against the dev tree's tracked **723,969** — the
"regenerating shrinks the tracked catalog" effect my own station doc tells me to expect. It is NOT a
shrink: `git diff --numstat origin/main -- docs/data-model/metadata-catalog.json` is **EMPTY**
[MEASURED], and 723,969 − 695,182 = **28,787**, the file's line count. This is §9.3's LF-blob vs
CRLF-working-copy boundary exactly. Written up from the byte counts alone it reads as 28 KB of
content loss and aborts a slice. **Compare content, never size, across that boundary.**

**Audit 4 — roadmap drift.** sot/02 §2 read `In-PR — open right now (1)` naming **#1986**.
`gh pr view 1986 --json mergedAt,state` (never the `merged` field of a list response, §9.4) →
`{"state":"MERGED","mergedAt":"2026-09-17T03:43:16Z"}` [MEASURED]. Live board:
`gh pr list --state open` → **#2005, #2002, #1998**, all carrying `do-not-merge` [MEASURED].
Every `gh` call in this run passed `-R GH-Mantova/ProjectOperations` and tested `$LASTEXITCODE`
before parsing (§9.4 CWD trap).

**Audit 5 — automation health.** Watcher LIVE by command line, not image name [MEASURED]:
`Get-CimInstance Win32_Process` filtered on `pr-watcher[\\/]index\.mjs` → **pid 30248**, started
`2026-09-16 10:35:18` local. Newest `docs/pr-prompts/processed/` log
`2026-09-17T13:19:31Z pr-scopecards-s3-line-markup-all-types-ready.md.log` — 52 minutes before this
run. Queue depth-1: `ready=0`, `HOLD=27`. **Nothing is stalled.**

**Audit 6 — model ↔ migration ↔ code coherence. My first instrument was BROKEN and I am reporting
that, not its output.** Comparing PascalCase model names against quoted SQL identifiers returned
`MODELS_WITH_NO_MIGRATION_TABLE=296` and `ORPHAN_TABLES=299` — and its POSITIVE CONTROL
`POS_CONTROL_User=false` [MEASURED]. A check that cannot pass on a case I know is good is the bug
(§7 standing guard 1). Cause: **all 296 models carry `@@map`**, so the two sides were never naming
the same thing. Re-run with `@@map` resolved, controls first
(`POS_CONTROL_User_maps_to=users`, `POS_CONTROL_table_present=true`, minted
`NEG_CONTROL=false`) [MEASURED]: **`MODELS_WITH_NO_MIGRATION_TABLE=0`** across 254 migration
directories. Four CREATEd tables have no live model — `user_ai_providers`, `user_ai_preferences`,
`subcontractor_contacts`, `leads` — and **all four are explicitly DROPped by a later migration**
(`20260502101544_chore_remove_legacy_ai_provider_tables`, `20260426_feat_drop_deprecated_tables`,
`20260812140000_crm_s1_lead_collapse`) [MEASURED], against a positive control of `users` touched in
101 migrations. **Zero real orphans. Coherence is clean.** Had I filed the first instrument's output
it would have been 595 phantom findings.

**Encoding controls.** `sot/02` and `sot/01` read as BYTES in node [MEASURED]: `U+FFFD=0`,
double-encoding signature `U+00E2 U+20AC` = 0, no BOM. The `?`/`�` in the PowerShell console was
§9.1 lie #2 — the reader, not the file. Nothing was "repaired".

**RULE ZERO — local PASS cross-checked against real CI.** `gh run list --commit <full 40-char SHA>`
(never the short form, §9.4) on `a2f5e8a6` → **4 runs, all `success`**: CI, Deploy, Tendering Browser
Smoke, Push on main [MEASURED]. Local checks and CI AGREE. **No ENVIRONMENT DISAGREEMENT this run.**

**An instrument I suspected and cleared.** `check-breadcrumb.mjs --freshness --station 05` prints
`structure: 0 checked` against 3 breadcrumbs on disk. Not a defect: line 240 applies the `--station`
filter before the structural pass, and no `00-05-*` breadcrumb is currently on disk. POSITIVE
CONTROL, same command without `--station`: **`structure: 3 checked, 0 malformed`** [MEASURED].

## WHAT CHANGED

**One doc-reconcile PR, opened from a disposable worktree off `origin/main`
(`C:\po-worktrees\sot05-20260917`, detached at `a2f5e8a6`). I did not arm, did not merge, and did not
commit on `main` in the dev tree.**

**`sot/02-roadmap-and-status.md` — §2's LIVE SNAPSHOT only.** `(1)` → `(3)`; the snapshot stamp
`2026-09-16T14:20Z / bdc5d05b` → `2026-09-17T14:25Z / a2f5e8a6`; the #1986 row replaced by the three
PRs actually open; and a dated note recording why, mirroring the file's own 2026-09-06 precedent.
**No roadmap STATUS semantics were touched.**

Read back [MEASURED]: `BYTE_DELTA_OK=true` (20,451 → 21,492, exactly the arithmetic of the two
substitutions — the assertion that catches a `String.replace` `$`-spill, §9.3; the edit was built by
CONCATENATION, in node, never a replacement string), `OLD_GONE=true`, `NEW_PRESENT=true`,
`U+FFFD=0`, `DBLENC=0`, `BOM=false`. `git diff --numstat` → **`11  4  sot/02-roadmap-and-status.md`**,
and `git diff --stat` lists **that file only** — S3/S4/S5 satisfied, curated prose byte-unchanged.

**Post-fix validation** [MEASURED]: `node scripts/pipeline/check-sot-refs.mjs` in the worktree →
`total=275  dangling=0  exempt=20  baselined=0  excluded=2`, exit 0 — unchanged by the edit, and
`N` did not rise.

Nothing else was changed anywhere. The dev tree working copy is untouched by this run.

## FINDINGS

**F1 — sot/02 §2 named a PR that had merged eleven hours earlier, and the table said "open right now".**
#1986 merged `2026-09-17T03:43:16Z`; the table presented it as the single open PR, BLOCKED. This is the
identical rot the file's own 2026-09-06 note was written about, recurring at the same place. It is
deterministic drift — the content is a mechanical read of the live board — and it is the only drift
this sweep found.
**DISPOSITION: ACTIONED** — refreshed in this run's doc-reconcile PR; verified by the byte-delta,
`--numstat` and `--stat` read-backs quoted above, and by `check-sot-refs.mjs` exit 0.

**F2 — #2005 carries a THIRD red that the `do-not-merge` label does not explain, and the parked-PR
reading hides it.** #2002 and #1998 each show exactly the CP-26 pair
(`Approval receipt (CP-26)` + `PR gates — diff checks`), which §9.4 records as parked-by-design.
**#2005 shows those two PLUS `API — lint, test, compliance smoke` FAILURE** [MEASURED via
`statusCheckRollup`]. A run that reads "do-not-merge ⇒ both reds are CP-26 ⇒ nothing to do" — which is
the documented and normally correct shortcut — files this PR as parked and never sees the API red.
I did not pull the job log: diagnosing an `apps/api` failure is outside Station 05's lane, and §3
forbids diagnosing CI from anything but the log.
**DISPOSITION: DISPATCHED to Station 00** — pull the `API — lint, test, compliance smoke` job log for
#2005 and read column 3 (§9.1). The count shortcut is sound for 2 reds and unsound for 3.

**F3 — the sot-refs burn-down, this station's stated primary housekeeping obligation, is COMPLETE, and
the station doc has no terminal state for that.** `docs/qa/sot-refs-baseline.json` holds
**`entries.length = 0`**; `check-sot-refs.mjs` reports `dangling=0 exempt=20 baselined=0` [MEASURED].
The doc's workflow is written entirely as "pick an entry, fix it, delete it, re-key the line numbers"
and its verification rule is "N must be lower than it was before your PR" — which no longer has a
satisfiable reading, since N is 0 and may not go lower. A future run following it literally looks for
an entry to burn, finds none, and has no instruction telling it that this is the finished state rather
than a broken probe. The re-keying hazard is also now moot while the list stays empty.
**DISPOSITION: DEFERRED** — the fix is a correction to `docs/pipeline/stations/05-sot-keeper.md`, and
safeguard S5 caps this run's scope at `sot/` + `docs/data-model/`, so folding a station-doc edit into
this PR would break my own scope cap. **What would make it urgent:** any run that reads the empty list
as an instrument fault, or any PR that adds an entry back (the ratchet forbids it, but the doc should
say what to do if one appears).

**F4 — audit step 7 tells me to check "sot/01's module registry" and sot/01 has no such section.**
Every `##`/`###` heading in `sot/01-charter-and-architecture.md` was enumerated [MEASURED]: SECTIONS
1–10+ cover COMPANY, VISION, ENVIRONMENT, TECH STACK, BRAND, ARCHITECTURE RULES, ENV VARS, USER TYPES,
SIDEBAR NAVIGATION, ESTIMATING DOMAIN. There is **no module registry**, under that name or an obvious
synonym. So step 7 of the brief has been unrunnable for as long as the heading has been absent, and a
run that reports "registry: nothing to report" is reporting the absence of a probe as the absence of
drift — §9.6's exact shape, sitting in my own instructions.
**DISPOSITION: DEFERRED** — same reason as F3 (station-doc change, outside this run's S5 scope cap).
**What would make it urgent:** a run quoting step 7 as evidence that the module registry is in sync.

**F5 — my own coherence instrument returned 595 confident, coherent, wrong findings, and only the
positive control caught it.** Recorded under WHAT I MEASURED above. It is filed as a finding because
the shape is the one §7 exists for: the broken form produced a *plausible* answer (296 models with no
migration is exactly what a real catastrophe would look like), and nothing was empty, so §9.6 would
not have fired either. The `@@map` mismatch will meet the next station that compares a Prisma model
name to anything in SQL.
**DISPOSITION: ACTIONED** — instrument corrected and re-run with controls in this same run; the
corrected result (0 missing, 0 real orphans) is what this report carries. No claim from the broken
form survives anywhere in this document.

## WHAT I DID NOT DO

- **Did not merge anything, did not arm anything, did not remove a label.** Three PRs are open and all
  three carry `do-not-merge`; only Marco removes it. Station 05 never arms and never merges.
- **Did not touch `scripts/`, `apps/`, `.github/`, `packages/`, `package.json` or `pnpm-lock.yaml`** —
  CP-24 hard-blocks any PR mixing those with `sot/`, so this PR is `sot/` + `docs/` only, split before
  opening rather than after CI said so.
- **Did not commit the regenerated `docs/data-model/` artifacts.** `relationship-map.{md,json}` are
  gitignored by design, and the regenerated `metadata-catalog.json` proved identical to `origin/main`
  (`--numstat` EMPTY), so there was nothing to land. No auto-fix of sot/04 was needed or attempted:
  its generated section is already byte-identical to a fresh generation.
- **Did not diagnose #2005's API failure** — outside this station's lane, and §3 forbids diagnosing a
  CI red from anything but the job log. Dispatched instead (F2).
- **Did not edit `docs/pipeline/stations/05-sot-keeper.md`** to fix F3 and F4, despite being the layer
  an agent can change, because safeguard S5 caps this run at one reconcile PR scoped to `sot/` +
  `docs/data-model/`. Both are dispositioned DEFERRED with their urgency conditions stated rather than
  left as leads.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so it
  reports drift unconditionally.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed went near them.

**This breadcrumb lands inside its own run's PR**, which is the contract's preferred home — it needs
nobody to sweep it up. Station 00 collects; my job ends here.
