# Station 05 — SoT Keeper | 2026-09-21T14:11Z–2026-09-21T14:50Z

## GROUND

```
UTC            2026-09-21T14:11:14Z
origin/main    524158cd              (git fetch origin +refs/heads/main:... then rev-parse)
dev tree       main @ 524158cd        C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE**, so this run is READ-WRITE inside its lane.

**Not blind.** `start_process` shell `powershell.exe` returned PID 11148 on the first call, after a
keyword `ToolSearch` for `desktop-commander` loaded the tool schemas. Every measurement below was
taken on the Windows host through that shell.

**Device-bridge git guard installed, and here is its last line, verbatim:**
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/keen-lucid-babbage/.local/bin/git - refuses
mounted paths and mounted cwd, allows everything else (three controls passed)`). No `git` was run
through the VM mount at any point in this run.

**No missed occurrence — nothing owed.** `node scripts/pipeline/check-breadcrumb.mjs --freshness
--station 05` → `05 last 2026-09-21T00:45:00Z 13.4h ago (cadence 24h) ok`. The station's own
threshold is **one** cadence, not the detector's two; 13.4 h is inside it. This is today's cron
occurrence (`lastRunAt 2026-09-21T14:10:40Z` against cron `10 0 * * *`, jitter 37 s).

**Binding documents read from a copy proven identical to `origin/main`, in the dev tree.**
`git diff --numstat origin/main -- docs/pipeline/stations/05-sot-keeper.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — the sound form per this station's own
PREFLIGHT, never a piped `hash-object`. All three were then read in full from the working copy.

**Sweep verdict, re-read immediately before the only mutation:** `[LIVE] SAFE TO ACT: no board
mutation in progress, no recent remote activity, no live station worktrees.` Captured with `*>` and
decoded `utf16le` (`BYTES=159066 ENC=utf16le LINES=949`), per DOCTRINE §9.3 — the raw file is
UTF-16LE and reads as structureless if decoded as UTF-8. `git index.lock` interactive/clone:
**False / False**; git processes touching our trees: **0**.

## WHAT I MEASURED

### Audit step 1 — schema parse sanity
[MEASURED] `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (297 models, 70 enums, 496 edges).` exit **0**.
Per this station's own 2026-08-25 correction, a clean `--check` is **not** a drift gate and is not
evidence that sot/04's generated section is current — it only proves `schema.prisma` parses with no
unresolvable model/enum reference.

### Audit step 2 — catalog validity
[MEASURED] `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`CATALOG_JSON_OK`, exit **0**. Valid JSON.

### Audit step 3 — sot/04 drift: BOTH probes fired, and the content probe was not needed to find it
[MEASURED] at `524158cd`, in a disposable worktree off `origin/main`:

| probe | sot/04 as committed | freshly generated | agree? |
|---|---|---|---|
| header counts (Models / Enums / FK edges / Domains) | `296 / 70 / 493 / 23` | `297 / 70 / 496 / 23` | **NO** |
| `schema.prisma` sha256 in the header | `a351d01ca823` | `36383d3b651e` | **NO** |
| generated-section CONTENT (BEGIN→END vs `## Table of Contents`→EOF, CRLF-normalised, trimmed) | sha256 `c7a79e803a2e` | sha256 `88e11c7dbd77` | **NO** |
| first differing line (index 13) | `    9. [Estimating (16)](#domain-estimating)` | `    9. [Estimating (17)](#domain-estimating)` | — |

⚠️ **Compared as STRINGS, never as lengths or line counts** (DOCTRINE §9.3): sot/04 is pure CRLF on
this host (`CRLF=5305 LF=5305`) and the generated artifact is written LF (`CRLF=0 LF=3730`), so the
two differ by their line count before any content does.

**The new model is `QuoteCostGroup`** (table `quote_cost_groups`), the 17th in the Estimating domain.
[MEASURED] by diffing the model index of `HEAD:sot/04-data-model.md` against the regenerated one:
`added=["QuoteCostGroup"] removed=[]`.

### Audit step 4 — roadmap drift: sot/02 §2 was wrong about 5 of 5 open PRs, 14 hours after its own refresh
[MEASURED] `gh pr list -R GH-Mantova/ProjectOperations --state open --json number,title,mergeStateStatus,createdAt`,
exit **0** — five open PRs: **#2051 · #2049 · #2047 · #2044 · #2042**. sot/02 §2 read
`open right now (1)` and named **#2017**, which
[MEASURED] `gh pr view 2017 --json number,state,mergedAt,closedAt` →
`{"state":"MERGED","mergedAt":"2026-09-21T06:09:36Z"}` — read from `state`/`mergedAt`, never from the
`merged` field of a list response (DOCTRINE §9.4). **NEGATIVE control** `gh pr view 999997 --json
number,state` → exit **1** (two fields, so the server must answer — never `--json number` alone,
which fabricates a row at exit 0). Every `gh` call carried `-R` and had `$LASTEXITCODE` tested before
its output was read (§9.4's CWD bullet).

That snapshot was written by **this station's own run 14 hours earlier** (09-21T00:20Z) and is the
**fourth** consecutive refresh of the same table (09-06, 09-17, 09-21T00:20Z, and now).

### Audit step 5 — automation health: everything enabled is alive
[MEASURED] from the sweep and the scheduled-tasks MCP (never from a document's cadence table):

| | [MEASURED] |
|---|---|
| watcher node | **RUNNING pid 9744**, by command line, not image name |
| auto-restart wrapper | alive (1) |
| heartbeat age | 0 min; build in flight `rev-2050-ready.md`, tick 0.2 min old |
| newest `docs/pr-prompts/processed/*.log` | `rev-2051-ready.md.log` **14:18:58Z** — two minutes old at measure |
| enabled tasks | **4** — `00-supervisor` `5 * * * *` (last 14:07:55Z) · `03-machine-minder` `0 9 * * *` (last 00:20:35Z) · `04-scanner` `0 */4 * * *` (last 14:09:34Z) · `05-sot-keeper` `10 0 * * *` (last 14:10:40Z, this run) |
| `weekly-security-audit` | **`enabled: false`**, last run 2026-09-06T21:32:44Z — unchanged, already Marco's |
| main CI on `524158cd` | 4 success / 0 failed / 0 running — trunk green |

`docs/pr-prompts/merged/` does not exist on disk; DOCTRINE §8.5 says that standard is written in S1
and enforced in S4, so this is expected and is **not** filed as a finding.

### Audit step 6 — model ↔ migration ↔ code coherence for the delta
[MEASURED] `git grep -l quote_cost_groups HEAD -- apps/api/prisma/migrations` →
`HEAD:apps/api/prisma/migrations/20260921000000_scopecards_s4a_push_by_destination/migration.sql`.
The one new model has a backing migration already on `main`. Coherent.

### Audit step 7 — registry
[MEASURED] the `THIS REGISTRY IS KNOWN INCOMPLETE` gap-declaration block landed by the 09-21T00:45Z
addendum is present in `sot/01-charter-and-architecture.md` at `524158cd`. Marco's ruling (option
**b** — a development chat writes the ten §13 entries, not this station deriving them) is recorded
there with its HANDOVER brief. **Nothing to do here this run**; it remains DISPATCHED.

### The sot-refs baseline is EMPTY — the burn-down is finished
[MEASURED] `node -e "JSON.parse(...sot-refs-baseline.json).entries.length"` → **0**, and
`node scripts/pipeline/check-sot-refs.mjs` → `total=275 dangling=0 exempt=20 baselined=0 excluded=2`,
exit **0**, `All sot/ references resolve.` Re-run after both edits: **identical**. No entry was
deleted this run because there is none left to delete. ⚠️ **That count is STATE — re-measure it.**

### Safeguards S1–S7, each measured
| | result |
|---|---|
| **S1** never `main`, never merge; deliver as one doc-reconcile PR from a disposable worktree off `origin/main` | worktree `C:\po-worktrees\po-sot05-20260921` @ `524158cd`, branch `docs/sot-reconcile-2026-09-21-sot04-regen`. Nothing armed, nothing merged, no label touched, no auto-merge |
| **S2** generator run TWICE, outputs byte-identical modulo the stamp | `relationship-map.md` **identical=true** (167930/167930) · `relationship-map.json` **true** (2091202) · `metadata-catalog.json` **true** (699025) |
| **S3** curated region byte-identical | sha256 from the `END` marker onward `d5f505615d88a806…` **before and after**, re-asserted on read-back |
| **S4** curated line count did not decrease | **1581 → 1581** |
| **S5** scope cap | `git diff --numstat` in the worktree: `15 6 sot/02-roadmap-and-status.md` · `36 21 sot/04-data-model.md`. Nothing else |
| **S6** post-fix validation | `--check` → OK (297/70/496) exit 0; `check-sot-refs.mjs` → dangling=0 exit 0 |
| **S7** one-and-done | no reconcile PR from a prior run is open — the last one, **#2019**, MERGED `2026-09-21T00:45:56Z` |

**Every doc edit was made with node by concatenation, never `String.replace` with a replacement
string** (DOCTRINE §9.3's `$`-substitution trap), with the byte delta asserted per splice —
sot/04 `290533 → 291285` chars across four splices, sot/02 `22064 → 22879` across five — and line
endings detected per file rather than assumed. Both files re-read after writing:
`matchesIntended=true`.

### An instrument note worth one line
`git status` in the worktree reports `M docs/data-model/metadata-catalog.json` while
`git diff --numstat` reports **nothing** for it — the regenerator rewrote it LF-for-CRLF with
**zero** content change (`Buffer.compare` after CRLF normalisation → **0**, model keys 297 → 297,
added `[]`, removed `[]`). This is exactly the line-ending shrink this station's doc records; the
file is therefore **not** in the PR, and `git status` is the wrong instrument for the question
(DOCTRINE §9.2).

## WHAT CHANGED

**One doc-reconcile PR, off `origin/main` `524158cd`, from a disposable worktree. Two files, plus
this breadcrumb. CP-24 clean: `sot/` + `docs/` only, no `scripts/`, no `apps/`.**

1. **`sot/04-data-model.md` — the generated section re-merged.** The body between
   `<!-- SOT04-GENERATED:BEGIN -->` and `<!-- SOT04-GENERATED:END -->` replaced with the freshly
   generated `relationship-map.md` from its `## Table of Contents` heading, converted to CRLF; plus
   the three header metadata lines (`Last updated`, schema sha256, the four counts). The curated
   `MERGED SOURCES` region from the `END` marker onward is byte-identical (S3), its line count
   unchanged (S4), and all five inline `sot-ref-allow` markers survive.
2. **`sot/02-roadmap-and-status.md` §2 — the live snapshot refreshed only.** Heading count 1 → 5,
   snapshot stamp and SHA updated, the single stale #2017 row replaced with the five PRs actually
   open, and the existing "THIRD consecutive refresh" note amended to FOURTH with the 14-hour
   measurement. **Proved section-scoped:** sha256 of everything before `## 2.` and of everything
   from `## 3.` onward is identical before and after. **No roadmap STATUS semantics were changed.**

**No module registry entries were written** — that is Marco's ruling (b) and belongs to a
development chat.

## FINDINGS

### F1 — sot/04's generated section was a model and three FK edges behind, and the header counts caught it this time
`QuoteCostGroup` (table `quote_cost_groups`) landed with migration
`20260921000000_scopecards_s4a_push_by_destination`, and sot/04 still described a 296-model schema
under an old `schema.prisma` sha. Both the cheap header-count probe and the content comparison
disagreed, which is the easy case — this station's 2026-09-14 correction exists because the counts
are structurally blind to field-level drift and can agree while the bodies differ. Running both, as
that correction requires, cost nothing here and is what will catch the next one.
**DISPOSITION: ACTIONED** — re-merged in this PR. Verified by: S2 determinism true on all three
artifacts; S3 curated sha256 unchanged; S4 curated lines 1581 → 1581; per-splice byte-delta
assertions; read-back `matchesIntended=true` with `READBACK counts line: - Models: 297 | Enums: 70 |
FK edges: 496 | Domains: 23`; `--check` exit 0 and `check-sot-refs.mjs` exit 0 afterwards.

### F2 — sot/02 §2 cannot be kept true by a daily station, and four refreshes in sixteen days is the proof
The 09-21T00:20Z refresh — this station's own, from this station's own run — was wrong **14 hours**
later, and wrong about **5 of 5** PRs now open. The refresh interval needed is shorter than the
cadence of the only station allowed to edit the file. Refreshing is the additive half of RULE 1 and
it does not solve the future half. The complete-and-additive fix is a **generated** table, or a CI
check that fails when a PR named in §2 is no longer open — and the reason it is not done here is
that both are `scripts/` changes, which CP-24 hard-blocks from a `sot/` PR and which are outside
Station 05's lane in `STATION-CAPABILITIES.md` §5 either way.
**DISPOSITION: DISPATCHED** — to Station 00. The 09-21T00:20Z run already filed this; it is re-filed
with the new measurement rather than silently repeated, because the interval is the new evidence.
Two shapes, complete-and-additive first:
**(a)** a `scripts/pipeline/` generator that rewrites §2 from `gh pr list` and a CI check that fails
when §2 names a PR that is not open — solves it immediately and permanently, damages no existing or
future content, and the table stops being hand-maintained;
**(b)** replace the table with a one-line pointer to `bring-up-to-speed.ps1` — solves the future half
but **fails the immediate half** for anyone who wants the roadmap to carry board state at all, and
loses the per-PR blocker prose §2 currently supplies.

### F3 — the sot-refs burn-down has reached zero, so this station's stated "primary housekeeping obligation" now has an empty work queue
`entries.length` is **0** and `check-sot-refs.mjs` prints `baselined=0`. The station doc's SOT-REFS
BURN-DOWN section still describes a per-run "pick an entry, fix it, delete it" workflow as the
primary obligation. It is correct that the count lives in the file and never in the prose — it does,
and the prose does not quote one. But a run following that section literally now finds nothing to do
and has no instruction for what that means.
**DISPOSITION: DEFERRED** — real, and not urgent. It costs nothing today: the section's own
verification step (`N must be lower than before your PR, never higher`) is satisfiable at 0, and the
`Never add an entry` rule still binds and is the half that matters. It becomes urgent the first time
a run reads the section as an instruction to *find* work in `sot/` and goes looking outside the
allowlist. The one-line fix — say that an empty baseline means the obligation is discharged and the
run proceeds to the audit — is a station-doc edit and belongs in a `docs/` PR, not bundled into a
`sot/` reconcile.

## WHAT I DID NOT DO

- **Did not commit `docs/data-model/metadata-catalog.json`.** It is tracked, it is 700 KB, and the
  regenerator's only change to it is CRLF → LF: `Buffer.compare` after normalisation returns 0 and
  `git diff --numstat` reports nothing for it. Landing it would churn every open PR for no content.
- **Did not commit `relationship-map.{json,md}`.** Gitignored by design (`.gitignore:128`).
- **Did not write the ten `sot/01` §13 module entries.** Marco ruled option (b); that work is
  DISPATCHED and unchanged. Deriving them from route names is the option he declined.
- **Did not change any roadmap STATUS semantics, or any curated prose in sot/01/02/03/05/06** beyond
  the §2 snapshot and its own refresh note — proved by the before/after sha256 of everything outside
  §2.
- **Did not stage a prompt, arm anything, merge anything, or remove a label.** Station 05 never arms
  and never merges. #2051/#2047/#2044 are red and none of them is mine.
- **Did not clear or re-key a baseline entry.** There are none.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and every git call went through the Windows shell.
- **Did not touch Azure, Entra or SharePoint.** Absolute.
- **Did not prune the two worktrees the sweep flagged** (`C:/PR-Master/worktrees/po-vg`, holding one
  uncommitted file, and registry-escapee `C:\po-worktrees\po-fix-2005`). That is Station 03's lane
  and the sweep already names it.
