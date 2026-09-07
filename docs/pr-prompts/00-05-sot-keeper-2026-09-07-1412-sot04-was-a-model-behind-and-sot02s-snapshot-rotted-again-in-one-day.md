# Station 05 — SoT Keeper | 2026-09-07T14:12Z–2026-09-07T14:3xZ

## GROUND

```
UTC            2026-09-07T14:12:10Z
origin/main    f9815d11            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ f9815d11     C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run is read-write within its lane.

`[MEASURED]` **Sighted run.** `start_process`, shell `powershell.exe`, succeeded — PID 24016, and a
second shell PID 28452 after the first was left in a PowerShell here-string continuation by a
multi-line `node -e` (DOCTRINE §9.1's *"anything containing `$`/multi-line goes in a file"* rule,
met from the other side: the continuation swallowed three consecutive commands and answered `>` to
all of them, at no error).

`[MEASURED]` **VM git guard installed.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
last line: `vm-git-guard installed at /sessions/beautiful-kind-shannon/.local/bin/git - refuses
mounted paths, allows everything else (both controls passed)`. PASS.

`[MEASURED]` **The three binding documents were read from `origin/main`'s content**, verified by the
sound form (DOCTRINE §9.2 — never a piped hash):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/05-sot-keeper.md` → **EMPTY output**, in the dev tree `C:\ProjectOperations2`,
at `HEAD == origin/main == f9815d11`. All three read in full (DOCTRINE 1638 lines in six chunks).

`[MEASURED]` **No missed occurrence — nothing is owed.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05` →
`05 last 2026-09-06T14:11:00Z 24.0h ago (cadence 24h) ok`. Read as the AGE, not the `ok` — the age is
exactly ONE cadence, not more (the `ok` would not alarm until 48 h; escalation #23).

## WHAT I MEASURED

### Preflight sweep — SAFE TO ACT

`[MEASURED]` `scripts/pipeline/status-sweep.ps1`, captured to a FILE (111,098 bytes,
`C:\po-sup-fix-scripts\05-sweep-20260907.txt`) because it returns early and hides its own §7 verdict.
Section 0 controls both passed (`gh CAN reach GitHub`, `node runs`). Section 7 at 14:13:15Z:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 3's inputs: `index.lock interactive/clone: False / False` · `git processes running: 0` ·
`no PR touched on GitHub in the last 2 min`.

### Automation health — nothing to lead with

`[MEASURED]` Watcher resolved **by command line, never by image name** (DOCTRINE §9.5):
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on `pr-watcher[\\/]index\.mjs` →
**pid 31660**, started `2026-09-06 23:05:03Z`, running
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`. Auto-restart wrapper alive (1).
`Get-ScheduledTask` across all visible tasks → the only one matching this project is
**`PO Watcher Keepalive`, state=Ready, LastTaskResult=0, lastRun 2026-09-08 00:15:02 local
(= 14:15Z, three minutes before this line)**. The four fixtures older revisions of this brief named
(`pr-shepherd`, `night-qa`, `watcher-triage`, `feature-queue-watch`) remain absent — the 2026-08-27
correction still holds.

`[MEASURED]` `docs/pr-prompts/processed/` = **2055** logs; newest `rev-1782-ready.md.log` at
**2026-09-07T13:36:25Z**, 36 minutes old. The board is moving. Nothing here leads the report.

### Rule Zero — local PASS **and** CI PASS, on main and on every open PR

`[MEASURED]` Local: `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (294 models, 69 enums, 491 edges)`, exit 0.

`[MEASURED]` CI, read per-commit with the **full 40-char SHA** (DOCTRINE §9.4 — the short form
answers `[]` at exit 0): `gh api repos/GH-Mantova/ProjectOperations/commits/
f9815d1116de2f283e05294ac6238f7041df0ee8/check-runs?per_page=100` → 15 check-runs, of which
`Data model — generator sanity (schema.prisma parses cleanly)` = **success**.

`[MEASURED]` Same job on all four open PRs, via `gh pr view <n> --json statusCheckRollup`:
`#1767` **SUCCESS** · `#1774` **SUCCESS** · `#1775` **SUCCESS** · `#1777` **SUCCESS**.

**No ENVIRONMENT DISAGREEMENT.** Local and CI agree in the same direction on all five commits.

### Audit 2 — catalog validity: VALID

`[MEASURED]` `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`CATALOG_OK bytes=715339 topkeys=4`, exit 0. The 2026-08 unterminated-string defect has not returned.

### Audit 6 — model ↔ migration ↔ code: 0 real mismatches, and my own probe lied first

`[MEASURED]` 294 models against 243 migration files: `created-not-dropped tables with NO live model`
→ **0**. `models with NO backing CREATE TABLE` → **1: ScopeCard** — **and that is a false positive
from my own regex, not a defect.** My pattern required a *quoted* identifier
(`CREATE TABLE "..."`); the migration writes it bare:

```
Select-String -Path apps\api\prisma\migrations\*\migration.sql -Pattern 'scope_cards'
  -> CREATE TABLE IF NOT EXISTS scope_cards (
POSITIVE control (quoted form, scope_waste_items) -> 1
NEGATIVE control zzQq05Needle20260907T1418        -> 0
```

Positive control passes, negative control is 0, so the instrument works and the *needle* was wrong.
**Audit 6 result: 0 mismatches.** Recording it because a run that stopped at the first reading would
have filed *"a model on `main` has no migration"* — a confident, coherent, wrong finding of exactly
the shape DOCTRINE §7 exists to catch.

### Audit 7 — module registry: clean at this granularity

`[MEASURED]` `apps/api/src` holds **6** top-level directories, **0** of them unnamed in
`sot/01-charter-and-architecture.md`. ⚠️ This is a **weaker** probe than 2026-09-05's, which walked
the 81 *feature* modules one level deeper and found 32 absent (that run's FINDING 2, DEFERRED). It is
not a refutation of that finding and must not be read as one — different corpus, different depth.

### Not a finding — `sot/02` and `sot/04` are NOT corrupted

`[MEASURED]` The PowerShell `Select-String` render of `sot/02` shows `?` where the state-legend
emoji are. That is DOCTRINE §9.3's reader, not the file. Decoded in node:
`sot/02` **U+FFFD=0, cp1252 double-encode signature=0**; `sot/04` after my edit **U+FFFD=0, sig=0**.

### The primary housekeeping obligation is already discharged

`[MEASURED]` `node scripts/pipeline/check-sot-refs.mjs` →
`total=276  dangling=0  exempt=20  baselined=0  excluded=2` · *"All sot/ references resolve."* exit 0.
`docs/qa/sot-refs-baseline.json` → **`entries.length = 0`**. There is nothing left to burn down; the
last entry went on 2026-09-06. The ratchet still earns its keep by refusing NEW entries.

## WHAT CHANGED

One doc-reconcile PR, opened from a disposable worktree off `origin/main`
(`C:\po-worktrees\sot05-20260907`, branch `sot/04-remerge-20260907`). **Two files, both under
`sot/`** — CP-24 satisfied by construction (`git status --porcelain` in the worktree returns exactly
` M sot/02-roadmap-and-status.md` and ` M sot/04-data-model.md`; no `scripts/`, no `apps/`).

**1. `sot/04-data-model.md` — the generated section re-merged** (F1). `+32 −17`.
Header `293 | 68 | 488` → `294 | 69 | 491`; schema sha `c54776fc0cc6` → `1c87e9c6ca95`;
stamp `2026-09-05 14:16 UTC` → `2026-09-07 14:17 UTC`. The body gained the `ScopeOperationalCostLine`
model and its five inbound/outbound edges, and lost five retired `scope_of_works_items` measures.

**2. `sot/02-roadmap-and-status.md` §2 — the live snapshot refreshed** (F2). `+6 −6`.

Safeguards, all measured, none inferred:

| | result |
|---|---|
| **S1** never on `main`, disposable worktree off `origin/main`, PR opened by me, never armed, never merged | ✅ |
| **S2** determinism — generator run TWICE, outputs compared modulo the `Last updated` stamp | ✅ `S2_DETERMINISTIC=true`, `lenA=lenB=165924` |
| **S3** section-scoped — sha256 of everything from `SOT04-GENERATED:END` onward, before vs after | ✅ `d5f505615d88a806` → `d5f505615d88a806`, `CURATED_BYTE_IDENTICAL=true` |
| **S4** no content loss — curated line count | ✅ 1581 → 1581 |
| **S5** scope cap — only `sot/` touched | ✅ two files, both `sot/` |
| **S6** post-fix `--check` re-run **in the worktree** | ✅ `OK: … (294 models, 69 enums, 491 edges)`, exit 0; `check-sot-refs.mjs` exit 0, `dangling=0` |
| **S7** one-and-done — no prior reconcile PR unmerged | ✅ the four open PRs are `#1767 #1774 #1775 #1777`, none a `sot/` reconcile |

`[MEASURED]` Read-back on both writes: `READBACK identical=true` (289,226 B and 20,419 B), and the
S3 curated sha re-hashed **from disk after the write**, not from the in-memory string.

`[MEASURED]` **The generator dirtied a tracked file in the dev tree and I cleaned it up.**
`build-relationship-map.mjs` rewrites `docs/data-model/metadata-catalog.json` with LF endings, so
`git status` showed ` M`. It is **not a content change**: `git diff --numstat` on it returned
**EMPTY**, and old-vs-new were `686892` bytes and `294` models on both sides — a line-ending smudge,
the shape memory records as *"`--numstat` EMPTY ⇒ smudge, not drift"*. Cured with the single-file
form `git checkout -- docs/data-model/metadata-catalog.json` (never `checkout .`, never a directory —
DOCTRINE §9.2's board trap), read back: `git status --porcelain -- docs/data-model` → **empty**.

## FINDINGS

### FINDING 1 — `sot/04`'s generated section was a model, an enum and three edges behind `main`

`[MEASURED]` `sot/04-data-model.md:15` read `- Models: 293 | Enums: 68 | FK edges: 488 | Domains: 23`
stamped `2026-09-05 14:16 UTC` against schema sha `c54776fc0cc6`, while a fresh generator run on
`origin/main`'s `schema.prisma` reports `294 | 69 | 491 | 23` at sha `1c87e9c6ca95`. The missing
model is **`ScopeOperationalCostLine`** (`scope_operational_cost_lines`, Estimating, 16 fields),
which reached `main` in `#1665`.

⚠️ **A clean `--check` did not and could not catch this.** `--check` `return`s before writing and
only proves `schema.prisma` parses — the correction recorded in this station's own doc, and it held:
`--check` was green locally and on all five commits above while `sot/04` was two days stale.

**DISPOSITION: ACTIONED.** Re-merged section-scoped, S1–S7 all green above, curated region proved
byte-identical by sha256 read back from disk. Shipped in this PR.

### FINDING 2 — `sot/02` §2's "open right now" table rotted again in **one day**, and refreshing it by hand is a treadmill

`[MEASURED]` §2 was headed `In-PR — open right now (4)` and named `#1719 #1713 #1709 #1699`.
`gh pr view <n> --json state,mergedAt` on all four: **all MERGED, all on 2026-09-06** —
`14:20:06Z`, `22:58:57Z`, `20:01:45Z`, `18:52:07Z`. The four genuinely open PRs (`#1777 #1775 #1774
#1767`) appeared nowhere in the file. The table's own provenance line said
`2026-09-06T14:20Z, origin/main d1467428` — it was stamped **fourteen seconds before the first of
its own four entries merged.**

**The refresh itself is settled ground and I have not re-opened it.** 2026-09-05's FINDING 1
escalated this to Marco after ten breadcrumbs had filed it report-only; 2026-09-06 ACTIONED it on the
reasoning *"the refreshable part is a **live snapshot**, not a semantic"*, recorded that reasoning in
`sot/02` itself, and no roadmap escalation remains open in `needs-marco/`. I followed that precedent
exactly: membership, the `(4)` count and the provenance line only.

🔴 **The new half is the half that matters: a hand-refreshed snapshot has a useful life of about one
board-day.** Yesterday's refresh was correct when written and false within six hours. Twelve
breadcrumbs have now spent a run on this table.

**Options, RULE 1 order** — complete-and-additive first:

**(a)** Put the table inside `<!-- SOT02-INPR:BEGIN/END -->` markers and generate it, the way
`sot/04` already works: a small `scripts/pipeline/build-sot02-inpr.mjs` reading `gh pr list`, plus a
`--check` mode wired into the existing `pipeline-tests` job so CI fails when the block drifts.
**Passes both halves** — it fixes today and every future day, and it damages nothing, because the
markers fence the generated block off from the curated prose exactly as `SOT04-GENERATED` does.
Cost: it is a `scripts/` + `.github/` change, so it is **not mine to write into a `sot/` PR** (CP-24
hard-blocks the mix, with no escape hatch).

**(b)** Delete the table and leave §2 pointing at `bring-up-to-speed.ps1`. Cheap, honest, never
stale. **Fails the "completely" half** — the SoT stops answering *"what is open?"* at all for anyone
reading it outside a shell, which is the question §2 exists for.

**(c)** Keep hand-refreshing it daily. **Fails both halves** — it is false for most of each day and
bills a station run every day forever.

**DISPOSITION: ACTIONED for today's rot (snapshot refreshed, semantics untouched); the loop itself
is DISPATCHED → Station 00.** (a) is a `scripts/` + `.github/` change and CP-24 forbids me shipping
it beside `sot/`; it needs a prompt staged in 00's or 06's lane. It is **not** a Marco question —
he already ruled on the boundary on 2026-09-06 and (a) stays inside it.

### FINDING 3 — this station's brief still orders a `docs/data-model/sweeps/<date>.md` report that the binding contract replaced

`[MEASURED]` `docs/pipeline/stations/05-sot-keeper.md`'s `=== OUTPUT ===` section says *"Write a
timestamped report to `docs/data-model/sweeps/<YYYY-MM-DD>.md`"*. The canonical
`station-contract v3` block **above it in the same file** says *"Every run writes ONE breadcrumb"* at
`docs/pr-prompts/00-<NN>-…`, and that block wins by its own terms.

`[MEASURED]` The directory is tracked and holds **11** files, newest `2026-09-05.md`. **Neither the
09-06 run nor this one wrote to it** — so the instruction is already being silently dropped, which is
the worst of the three states: a reader of the brief expects a file that stops appearing, and a
reader of `sweeps/` reads a gap as a missed run. 2026-09-05's FINDING 5 flagged the conflict and
DEFERRED it rather than bundle an unasked doc change.

**DISPOSITION: DEFERRED.** Real, not urgent, and deliberately not bundled: this PR is a `sot/`
doc-reconcile and the fix is a `docs/pipeline/` edit that belongs with whoever takes FINDING 2(a).
**It becomes urgent the moment anyone treats `sweeps/` as a liveness signal for this station** — the
freshness detector reads breadcrumbs, not `sweeps/`, so today nothing does. Falsifying probe: if a
`sweeps/2026-09-06.md` or later appears, a run is writing both and the conflict is being resolved by
duplication instead of by decision.

### FINDING 4 — `C:\po-vg` still holds one uncommitted file, and its age has doubled

`[MEASURED]` `status-sweep.ps1` §2: `orphaned worktree (aborted run leftover): C:/po-vg 23c91ba9
[fix/no-rebase-while-checks-run] dirty=1 files age=4700 min` — **78 hours**, against the 63 h the
project memory records. `git worktree remove` will refuse and `--force` would discard the file.
Separately, `watcher clone: branch=main dirty=5`.

**DISPOSITION: DEFERRED → already DISPATCHED to Station 03 and still open.** Both are machine state
in 03's lane, not mine; 2026-09-05's FINDING 4 dispatched the same worktree and 03 has since
escalated it. I am recording the **age** because it is the only thing that changed, and it is
changing in the direction of the file being lost to a routine prune.

## WHAT I DID NOT DO

- **I did not arm and I did not merge.** Not my lane, in either mode, ever.
- **I did not touch the four open PRs.** All four are `BLOCKED`; three are RED. Not `sot/`, not mine,
  and DOCTRINE §10.1 step 1's probe says nothing about a PR this station did not open.
- **I did not run the RULE 2 `marco:true` probe.** This run opens one PR of its own and merges
  nothing, so there is no merge decision for it to gate. Saying so rather than reporting a number I
  had no use for.
- **I did not commit `docs/data-model/relationship-map.{md,json}` or the graph HTML.** They are
  gitignored by design (`.gitignore`, `# Data-model artefacts`) because committing them churned every
  open PR. They were regenerated in the dev tree and left there.
- **I did not commit `docs/data-model/metadata-catalog.json`.** The generator touched it, `--numstat`
  proved the change was line-endings only, and I restored it rather than ship a no-op diff.
- **I did not fix FINDING 2(a) or FINDING 3.** Both are `scripts/`, `.github/` or `docs/pipeline/`
  changes and CP-24 hard-blocks mixing any of them with `sot/`. Splitting before opening, as the
  station doc says, rather than after CI says so.
- **I did not write `docs/data-model/sweeps/2026-09-07.md`** — see FINDING 3. The contract mandates
  the breadcrumb; writing both would resolve the conflict by duplication.
- **I did not re-file the 32-modules-absent-from-`sot/01` finding.** My probe today was one level
  shallower and clean at that depth; a shallower clean is not a refutation of a deeper finding.

---

**This breadcrumb ships inside its own run's PR**, which is the contract's preferred home — it lands
with the change it describes and needs nobody to sweep it up. Validated with
`node scripts/pipeline/check-breadcrumb.mjs` before commit.
