# Station 04 — Scanner | 2026-10-07T02:10:17Z–2026-10-07T02:16Z

## GROUND

```
UTC            2026-10-07T02:10:17Z
origin/main    500e07f3            (fetched, then rev-parse)
dev tree       main @ 500e07f3     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (04-scanner SKILL.md L4) — MATCH, run is read/write per lane
```

Sweep this run: **instruction-drift** (rotation position 4 of 4), as named by
`node scripts/pipeline/next-sweep.mjs`. Previous run of this sweep: 2026-09-24T18:18:23Z.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] `ToolSearch` keyword `desktop-commander` loaded the toolkit
in one call; `start_process` shell `powershell.exe` returned `2026-10-07T12:10:03.3551516+10:00`.
Not blind. No retry needed.

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
exit **2**. Last line:

```
   PATH="/sessions/determined-epic-dirac/.local/bin:$PATH" git <args>
```

headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
This is the station doc's expected exit-2 outcome: a finding, not a stop. No `git` was run through
the device bridge this run — every `git` call below ran through Desktop Commander on the Windows host.

**Binding reads.** [MEASURED] `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md`
and `docs/pipeline/STATION-CAPABILITIES.md` all read via
`git -C C:\ProjectOperations2 show origin/main:<path>` after `git fetch origin`, in the DEV TREE.
`git rev-parse origin/main` = `git rev-parse HEAD` = `500e07f3438eb58217bced5a3c3d7b474c6966cd`.
No piped `hash-object` comparison was made (DOCTRINE §9.2).

**Live task list (corpus = every `SKILL.md` behind an ENABLED task, never "the five").**
[MEASURED] scheduled-tasks MCP:

| task | cron | enabled | lastRunAt |
|---|---|---|---|
| 00-supervisor | `5 * * * *` | true | 2026-10-07T01:14:03Z |
| 03-machine-minder | `0 9 * * *` | true | 2026-10-06T23:02:55Z |
| 04-scanner | `0 */4 * * *` | true | 2026-10-07T02:09:42Z (this run) |
| 05-sot-keeper | `10 0 * * *` | true | **2026-09-27T21:38:18Z** |
| weekly-security-audit | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z |

Enabled count **four** — agrees with STATION-CAPABILITIES §1's 2026-09-15 correction.
[INFERRED] The MCP's human-readable `schedule` strings disagree with the cron by exactly
`jitterSeconds` (00: `5 * * * *` shown as "14 minutes past"; jitter 532 s. 05: `10 0 * * *` shown
as "12:23 AM"; jitter 757 s). **That is jitter folded into the display, not cadence drift** —
recorded so a later run does not file it as a finding.

**Bootstrap inventory.** [MEASURED] `C:\Users\Marco\Claude\Scheduled` holds **6** `SKILL.md` files
(00, 02-board-driver, 03, 04, 05, weekly-security-audit) plus four folders with none
(`_backup-2026-10-02`, `_backup-2026-10-03`, `_backup-2026-10-06`, `_retired-2026-08-18`).
`02-board-driver` has a bootstrap and **no live task** — STATION-CAPABILITIES §5 already records
that a folder is not a task. All five station bootstraps share one mtime,
**2026-10-06T05:59:29Z** — rewritten in a single batch.

**Version parity, both sides.** [MEASURED] every station bootstrap declares
`<!-- station_doc_version: 1 -->` at L4; every station doc on `origin/main`
(00, 01, 02, 03, 04, 05, 06) declares `station_doc_version: 1`. **Seven for seven, no mismatch.**
`weekly-security-audit` carries no version line and no STEP block — by design, it is not a station.

**`lint-station.mjs`.** [MEASURED] `node scripts/pipeline/lint-station.mjs` →
`ADMIT: all 10 docs clean`, plus `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`
and `ADMIT bootstraps/*/SKILL.md (5 bootstrap(s) checked, all clean)`, exit **0**. Its
`! names a Windows path outside the known folder map` notes are advisory and fire on documentation
examples (`C:\\Foo\\Bar`, `C:\po-scan-`, `e:\s`/`r:\s` regex fragments); none is a real path.

**Path resolution across DOCTRINE + DOCTRINE-REFERENCE + STATION-CAPABILITIES + all 8 station docs.**
[MEASURED] 162 distinct non-glob `docs|scripts|apps|sot` references extracted from `origin/main`
copies and probed with `git cat-file -e origin/main:<ref>`: **122 resolved, 40 dangling**.
POSITIVE control `docs/pipeline/DOCTRINE.md` → exit 0; NEGATIVE control, a needle minted this run
(`docs/pipeline/ZZNEEDLE-20261007-0215.md`) → exit 128.

[INFERRED] **All 40 are false positives of my own extractor, in three classes**, and I triaged every
one rather than reporting a count:

1. **Prefix stems my regex truncated** — `docs/pr-prompts/00-`, `docs/pr-reviews/pr-`,
   `docs/pr-prompts/needs-marco/resolved-`, `sot/01`, `sot/02`, `sot/04`, `sot/05`, `sot/-only`,
   `sot/01/02/03/05/06`, `docs//pipeline`. These are fragments of filename patterns and of prose
   like "sot/01-charter…", not citations.
2. **Gitignored by design** — `docs/qa/qa-findings.md`, `qa-checklist.md`,
   `qa-test-data-registry.md`, `.qa-run.lock`, `apps/api/.env`, `apps/web/.env.local`,
   `scripts/pr-watcher/.queue-state.json`, `scripts/pr-watcher/logs`,
   `docs/data-model/relationship-map.json` / `.md`, `apps/api/scripts/xero-import-report.md`.
   Verified for the map: `git check-ignore -v docs/data-model/relationship-map.json` →
   `.gitignore:135`, exit 0; and `scripts/data-model/build-relationship-map.mjs` names both paths as
   its own generated outputs. 05's station doc states this class explicitly ("all gitignored, all
   absent"), so the citations are correct and the targets are structurally absent.
3. **Folders git cannot hold while empty, or deleted docs the citing text already explains** —
   `docs/pr-prompts/{brainstorm,draft,merged,failed,reports}`,
   `docs/pr-prompts/needs-marco/discharged`, and
   `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, whose deletion is documented in the very
   paragraph of 04's own doc that cites it.

So the path-resolution half of this sweep is **CLEAN**. `docs/qa/sot-refs-baseline.json` on
`origin/main` reads `"entries": []` — the sot/ ratchet is fully burned down and nothing can be added
without CI rejecting it.

**§9.1 positive control, reproduced first-hand.** [MEASURED] DOCTRINE §9.1 says `$` is eaten by the
`-Command "..."` layer. It happened in my own first three calls: `'FETCH_EXIT='+$LASTEXITCODE`
arrived at PowerShell as `'FETCH_EXIT='+` (ParserError: *"You must provide a value expression
following the '+' operator"*), and `ForEach-Object { $_.Name }` arrived as `{ .Name }`. Every later
probe ran as a `.ps1` via `-File` and behaved correctly. The §9.1 cure is current and works.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-07T02:10:17Z`
  → `advanced: last_index=3 last_run_utc=2026-10-07T02:10:17Z`. Read back:
  `git status --porcelain -- docs/pipeline/sweep-rotation.json` → ` M docs/pipeline/sweep-rotation.json`.
  **LEFT DIRTY in the dev tree deliberately — Station 00 commits it; 04 may not.**
- This breadcrumb, written to `C:\ProjectOperations2\docs\pr-prompts\` (untracked).
- Nothing else. No prompt staged, armed, renamed or moved. No PR, no merge, no label.

⚠️ **Both files above are untracked/modified in the shared dev tree and will block the next
`git merge --ff-only` once this breadcrumb's path lands on `main`** (04-scanner.md, REPORT CONTRACT).
04 cannot take Cure 1 (its own PR worktree) because the authority matrix gives it *Create a PR: NO*.
Station 00: sweep both in one board PR.

## FINDINGS

### F1 — S2 — Station 05 has not reported for 12.5 days, and two independent instruments agree it is dead

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` (sighted run, so the §9.5 blind
ban does not apply), exit **2**:

```
  05  last 2026-09-24T14:23:00Z  299.8h ago  (cadence 24h + grace 3h)  MISSED
MISSED: 1 station(s) past cadence + grace
```

00, 03 and 04 all read `ok` in the same output — the validator can produce a positive, so the
negative is meaningful. [MEASURED] cross-checked against the **different** instrument the station
doc asks for: the scheduled-tasks MCP gives 05 `enabled: true`, cron `10 0 * * *`,
`lastRunAt 2026-09-27T21:38:18Z`, `nextRunAt 2026-10-07T14:22:37Z`.

The two readings disagree in an informative way: 05's newest breadcrumb anywhere on `origin/main` is
`docs/pr-prompts/archive/00-05-sot-keeper-2026-09-24-1423-sot04-generated-section-was-six-fields-behind-and-the-header-counts-could-not-see-it.md`,
so **the 09-27 fire produced no breadcrumb at all**, and nothing has fired in the nine days since
against a daily cron. That is not one missed run; it is roughly nine, plus one run that reached
turn one and died. 05 is the only station that may edit `/sot/`, so every `/sot/` drift,
`sot/04-data-model.md` regen and refs-baseline burn-down has been unattended for twelve days.

Blast radius: the whole `/sot/` lane. Nothing else can cover it — the authority matrix gives
*Edit `/sot/`* to 05 alone.

**DISPOSITION: ESCALATED.** The cause sits in a layer no station may touch (the scheduled-tasks
store is Marco's) and the diagnosis needs his decision, so per RULE 1, options for Marco,
complete-and-additive first:

1. **Re-arm 05 and add a missed-run alarm that fires on the absence of a run, not on a bad run.**
   Solves it immediately (05 runs again) and in future (a nine-day silence cannot repeat unseen).
   Does not touch data entry. *Fails neither half of RULE 1.* Needs Marco for the task store; the
   alarm half can be a station PR against `check-breadcrumb.mjs --freshness` wiring.
2. Re-arm 05 only. Fails the **future** half — this is the silence mode open escalation #23 already
   names, and `--freshness` already detected it; what is missing is something awake to read the
   detector.
3. Fold 05's `/sot/` duties into 00 temporarily. Fails the **future** half and strains the lane
   separation DOCTRINE §4 exists to protect; it also puts `/sot/` edits in a station the matrix
   forbids them to.

Also for Marco in the same breath, since it is the same store: `weekly-security-audit` is still
`enabled: false` (last run 2026-09-06), already filed as
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`.
That open item's title names the task store **reverting verified writes** — which is a plausible
mechanism for F1 and is worth testing before option 1 is assumed to have taken.

### F2 — S3 — STATION-CAPABILITIES.md tells a reader the bootstraps are pre-split; measured, all four enabled ones carry the split

[MEASURED] `git show origin/main:docs/pipeline/STATION-CAPABILITIES.md`, the
`DOCTRINE_CORE_SPLIT_V1 (2026-10-06)` paragraph:

> The scheduled-task bootstraps will be updated by Station 06 in a follow-up (noted in the PR body);
> until that lands they still say "read these three in full"

[MEASURED] against the live bootstraps: all four enabled ones
(`00-supervisor`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`) contain
`BOOTSTRAP_CORE_REFERENCE_V1` — **1 hit each** — and all five were rewritten at
`2026-10-06T05:59:29Z`. My own bootstrap's STEP 2 reads *"read these three every run: **the cores in
full, REFERENCE on demand**"* and carries the `Full detail: <file> §<n>` convention. Controls on the
probe: POSITIVE `"STATION 04"` → 2 hits in that file; NEGATIVE, needle minted this run
(`ZZNEEDLE-20261007-0220`) → 0 hits.

The `"read these three"` substring does still appear once per bootstrap — but as the *heading of the
split instruction*, not as the pre-split one. A reader grepping for that string confirms the stale
paragraph and generalises; a reader who opens the file sees the opposite. That is §1's own thesis —
a stale instruction reads exactly like a current one — occurring inside the file whose job is to
settle a capability dispute, for the second time (the 2026-08-31 "02-board-driver's file has not been
touched since 2026-07-14" line failed the same way, in the same paragraph).

Proposed correction, for the owning station to make: replace the two clauses with the measurement —
the follow-up **landed 2026-10-06**; the live bootstraps carry `BOOTSTRAP_CORE_REFERENCE_V1`; and
state the rule rather than the state: *read the bootstrap, do not quote this file for what it says*.
Falsifying probe to put in the text: `Select-String -Pattern BOOTSTRAP_CORE_REFERENCE_V1` over every
`SKILL.md` behind an enabled task; if it ever returns 0, the paragraph is right again.

**DISPOSITION: DISPATCHED** to Station 00. `docs/pipeline/` is outside 04's lane for writes (matrix:
*Create a PR: NO*, *Mutate the board: NO, read-only*), and this is a docs-only one-paragraph edit
that 00 merges the way it merges any docs PR. It is not 05's — the file is not under `/sot/`.

### F3 — note, no severity — the version-parity and path-resolution halves of this sweep are clean

[MEASURED] 7/7 `station_doc_version: 1` on both sides; `lint-station.mjs` exit 0 across 10 docs,
9 agent definitions and 5 bootstraps; 122/162 doc path references resolve and all 40 non-resolving
ones triaged to extractor artefacts, gitignored-by-design targets, or git's inability to hold an
empty folder.

**DISPOSITION: ACTIONED** — verified this run and recorded; nothing to fix. Carried as a finding
only so the next instruction-drift sweep has a baseline to diff against, and so a zero is not
mistaken for an unrun check (§9.6: a negative control written down is a positive).

### F4 — note, no severity — my own extractor's false-positive rate is 40/162 and a future run will re-file these unless it is told

[INFERRED] The `(?:docs|scripts|apps|sot)[/\\][A-Za-z0-9_./\\*-]+` extractor used in section F of
this run cannot distinguish a citation from a filename *stem* in prose, and resolves against
`origin/main` where three documented classes of target are legitimately absent. A later sweep running
the same probe without the triage will report "40 dangling references" as a defect.

**DISPOSITION: DEFERRED.** It becomes urgent the moment anyone proposes a CI gate on doc-path
resolution for `docs/pipeline/` — such a gate needs the three exclusion classes above plus an
allow-marker mechanism, exactly as `check-sot-refs.mjs` needed for `sot/`. `docs/qa/sot-refs-baseline.json`'s
`_readme` is the design to copy, not to re-derive.

## WHAT I DID NOT DO

- **Did not stage any prompt**, `-HOLD` or otherwise. Nothing this run needed one: F1 is Marco's
  layer, F2 is a one-paragraph docs edit cheaper for 00 to make than for me to specify, F3/F4 are
  notes. Budget was 2; used 0, deliberately, rather than manufacturing a prompt to fill it.
- **Did not commit anything**, including the rotation advance — the dev tree is on `main` and 04 is
  read-only on the board.
- **Did not run the other three sweeps** (gate liveness, instrument honesty, repo hygiene). The
  rotation named instruction-drift and the station doc forbids choosing; a shallow pass over all
  four is why findings rot.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** The rotation's named
  sweep is the run's scope and it filled the budget; both parts remain for a later run.
- **Did not clear or touch any lock**, worktree or watcher state — 03's lane.
- **Did not mint a worktree** (superseded 2026-08-24); every read was `git show origin/main:<path>`
  in the dev tree.
- **Did not run `git` through the device bridge**, the guard's exit-2 INERT report notwithstanding.
- **Did not write to `docs/qa/qa-findings.md`** or any other gitignored sink. This breadcrumb is the
  report.
