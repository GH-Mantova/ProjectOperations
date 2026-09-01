# Station 05 — SoT Keeper | 2026-09-01T14:11Z–2026-09-01T14:40Z

## GROUND

```
UTC            2026-09-01T14:11:54Z
origin/main    3f021384            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 3f021384     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run had write authority. SIGHTED: `start_process` on `powershell.exe`
returned a live shell on `LAPTOP-E6NHU4E4` on the first call. This was **not** a blind run.

## WHAT I MEASURED

**Reading my binding docs from the right copy.** The contract says read them from
`git show origin/main:<path>`, never the working copy. `[MEASURED]` — the working copy is
byte-identical to `origin/main` for all three, by blob hash:
`git diff --stat origin/main -- docs/pipeline/` → empty; `git hash-object` vs
`git rev-parse origin/main:<path>` → `47bab051…` / `03ec41f0…` / `eeaaf877…`, all `same=True`.
⚠️ **My first attempt at this comparison LIED.** A PowerShell `($a -eq $b)` over
`git show` output vs `Get-Content -Raw` returned **False for all three** — a CRLF/trailing-newline
artifact of the reader, not a difference in the files. DOCTRINE §7 exactly: had I stopped there I
would have opened this run by declaring my own instructions stale. **Compare blobs with
`git hash-object`, never with a PowerShell string equality over decoded text.**

**Sweep.** `[MEASURED]` `scripts/pipeline/status-sweep.ps1` @14:12:30Z → §0 both positive controls
`[LIVE]`; §7 **SAFE TO ACT**; no `index.lock` in either tree, 0 git processes, 0 in-progress prompts,
`armed: 0`. Board: 3 open (`#1494` CLEAN docs 9/0/0 · `#1483` 11/3 red · `#1477` 12/2 red);
`main CI on 3f021384: 4 success / 0 failed`.

**Automation health (audit step 5).** `[MEASURED]` by command line, never by image name:
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on `pr-watcher[\\/]index\.mjs`
→ **exactly 1**, pid 28400, ppid 34332, started 2026-09-01 22:25:08 local. Wrapper chain
`30600 (watcher-launcher-singlelane.ps1) -> 34332 (scripts\pr-watcher\…) -> 28400 (node)` —
**node=1, wrappers=2**, which is the healthy shape. `PO Watcher Keepalive`: `State=Ready`,
`LastRunTime=2026-09-02 00:15:01` local = **14:15:01Z, one minute before I measured it**,
`LastTaskResult=0`. Newest `docs/pr-prompts/processed/` mtime `2026-09-01 06:49Z`
(`rev-1489-ready.md.log`); 3744 files. Heartbeat 343 min stale **with `armed: 0`** = idle, not
wedged (DOCTRINE §9.5). **The 90-cycle crash loop 00 reported at 12:13Z has not recurred** — one
node, two wrappers, keepalive green, 2 h after the fix.

**Audit step 1 — schema parse sanity.** `[MEASURED]`
`node scripts/data-model/build-relationship-map.mjs --check` → `OK: generator ran cleanly against
schema.prisma (293 models, 68 enums, 488 edges)`, exit 0. **RULE ZERO cross-check against CI**, not
against my disk: `gh api repos/GH-Mantova/ProjectOperations/commits/<full 40-char sha>/check-runs`
(short SHAs answer `[]` — DOCTRINE §9.4) → `Data model — generator sanity (schema.prisma parses
cleanly) :: success`. Local PASS, CI PASS. **No ENVIRONMENT DISAGREEMENT this run.**

**Audit step 2 — catalog validity.** `[MEASURED]` `node -e JSON.parse(...metadata-catalog.json)` →
parses, exit 0.

**Audit step 3 — sot/04 drift.** `[MEASURED]` sot/04 header carried
`Models: 292 | Enums: 68 | FK edges: 482 | Domains: 23`, stamped `2026-08-31 14:14 UTC`, schema
sha `221a543f55ce`. Freshly generated `relationship-map.md` header:
`Models: 293 | Enums: 68 | FK edges: 488 | Domains: 23`, schema sha `2882e34a59f6`. **DRIFT.**
Cause named, not guessed: `git log 7fbbf121..origin/main -- apps/api/prisma/schema.prisma` returns
**three** schema-touching merges since 05's last re-merge (#1453) — `605aca10` (#1478),
`b05538eb` (#1471), `1efd079c` (#1464).

**S2 determinism.** `[MEASURED]` generator run twice in the dev tree; `Buffer.compare` in node over
both `.md` and `.json` → **raw byte-identical, stamp not even differing**. Run a third time inside
the disposable worktree: identical to the dev tree's modulo the `Last updated` line only.

**The catalog did NOT shrink.** `[MEASURED]` — the station doc warns that regenerating shrinks
tracked `metadata-catalog.json` and has aborted a slice before. It did not happen here:
`git hash-object -- docs/data-model/metadata-catalog.json` = `bb05c51b…` = the index hash, in
**both** trees; `git diff --numstat` empty. `git status` shows ` M` purely because the generator
writes LF into a CRLF checkout. **The content git would store is unchanged, so I staged nothing.**

**Audit step 6 — model ↔ migration coherence.** `[MEASURED]`, after my instrument was fixed:
235 migrations, 293 models, 298 tables CREATEd, 38 DROPped. **Models with no backing
`CREATE TABLE` = 0. Orphan tables = 0.** Controls: `scope_cards` → resolves to
`20260516120000_scope_card_foundation`; `scope_waste_items` → `20260425_feat_scope_redesign_v2`;
`zzz_no_such_table` → false. (The single reported "orphan" `"IF"` is my regex reading the words
`CREATE TABLE IF NOT EXISTS` out of a **comment** at `20260716130000_erp_haulage_dockets:16` — an
artifact, not a table.) See FINDING 6 for the version of this that was wrong.

**Audit step 7 — registry.** `[MEASURED]` 81 directories under `apps/api/src/modules/`;
**21** are not named anywhere in `sot/01-charter-and-architecture.md` under any spelling
(kebab, or separators stripped). Positive control `admin-settings` resolves; negative control
`zzz-no-such-module` false.

**Encoding.** `[MEASURED]` with **node**, never `Get-Content` (§7 lie #2), across all 2817 tracked
text files, with the positive control that the reader saw a real U+2014 em dash in **2015** of
them — so the reader is not the liar: **28 files carry damage, 411 `â€` double-encode sequences
and 12 U+FFFD.** Inside `sot/`: `01`=0 · `02`=0 · **`03`=9 U+FFFD** · `04`=0 · `05`=0 · `06`=0 ·
`README`=0, and zero double-encodes anywhere in `sot/`.

## WHAT CHANGED

One doc-reconcile PR, opened from a **disposable worktree** off `origin/main`
(`C:\po-worktrees\sot05-reconcile-20260901`, branch `sot05/reconcile-2026-09-01`). Nothing was
touched in the dev tree. I did not arm and I did not merge.

| File | numstat | What |
|---|---|---|
| `sot/04-data-model.md` | `41 / 16` | generated section re-merged; 3 header stat lines updated |
| `docs/qa/sot-refs-baseline.json` | `2 / 2` | two `sot/04` entries re-keyed 4144→4169, 4445→4470 |
| this breadcrumb | new | |

**CP-24:** `sot/` + `docs/` only. No `scripts/`, no `apps/`. Split before opening, not after.

**Safeguards, all read back:**

- **S2 determinism** — byte-identical across three runs, two trees. ✅
- **S3 section-scoped** — curated MERGED SOURCES region sha256 `fdf732d07ed701cafbe3ac47` **before,
  after, and again after read-back from disk.** Identical. ✅
- **S4 no content loss** — curated lines 1581 → 1581. ✅
- **Exactly 3 preamble lines changed** (the script `exit 5`s otherwise): `Last updated`,
  `Generated from` sha, and the counts line. ✅
- **S5 scope cap** — two files plus the breadcrumb. **No prompt staged** (see WHAT I DID NOT DO). ✅
- **S6 post-fix** — `build-relationship-map.mjs --check` exit 0; `check-sot-refs.mjs`
  `total=274 dangling=0 exempt=10 baselined=13 excluded=2`, exit 0. ✅
- **S7 one-and-done** — `git ls-remote --heads origin` matched no `sot`/`reconcile` branch and no
  open PR was a reconcile before I started. ✅

## FINDINGS

### FINDING 1 — sot/04's generated schema map was 3 merges stale

`[MEASURED]` above: 292→293 models, 482→488 FK edges, schema sha `221a543f55ce`→`2882e34a59f6`.

**ACTIONED.** Re-merged section-scoped in this PR and verified by read-back from disk: the written
file's counts line reads `- Models: 293 | Enums: 68 | FK edges: 488 | Domains: 23`, and the curated
tail sha is unchanged at `fdf732d07ed701cafbe3ac47`.

### FINDING 2 — the re-merge broke the sot-refs baseline, exactly where the station doc says it will

`[MEASURED]` The station doc's burn-down step 5 warns that the baseline is keyed by `line` and any
edit ABOVE a baselined reference breaks it. It did: immediately after the re-merge,
`check-sot-refs.mjs` went to **`dangling=2, baselined=11`, exit 1** — both entries being
`sot/04-data-model.md` → `docs/qa/Master-QA-and-Consolidation-Program-Plan.md`, whose lines had
moved by exactly the +25 the re-merge added (4144→4169, 4445→4470). Re-keyed; back to
`dangling=0 baselined=13`, exit 0. Ratchet-safe by construction — `check-sot-baseline-ratchet.mjs`
keys on `(sot_file, missing_path)` and ignores `line`.

🔧 **Method worth keeping.** My first re-key used `JSON.parse` → `JSON.stringify(j,null,2)`, which
was *correct* and produced a **`78 / 13` numstat** — a whole-file reformat of a 13-entry file, in a
PR whose entire point is a reviewable diff. Restored the file with `git show HEAD:<path>` piped
through node (never `git checkout`, never `>` — §9.3: PS 5.1 `>` writes UTF-16LE) and redid it as a
guarded literal replace that asserts each needle occurs exactly once. Result: **`2 / 2`.**
**A JSON round-trip is a lossless edit and a useless diff.**

**ACTIONED**, in the same PR as the edit that caused it, as the workflow requires.

### FINDING 3 — the sot encoding gate reads 3 of the 7 sot/ files, and is blind to the only damaged one

`[MEASURED]` `scripts/pipeline/check-sot-bytes.mjs:8-12` is a **hard-coded three-element array**:
`sot/README.md`, `sot/01-charter-and-architecture.md`, `sot/05-decisions-and-lessons.md`. It never
opens `sot/02`, `sot/03`, `sot/04` or `sot/06`. It is wired into CI at `ci.yml:284`, and it is green.

`[MEASURED]` The only `sot/` file carrying damage is **`sot/03-progress-log.md`, 9 U+FFFD** — one
of the four the gate cannot see. The gate is green *because* of what it does not look at. This is
Station 04's 2026-08-28 finding ("encoding gate blind to the only damaged file") still live 5 days
later; what is new here is the exact number: **3 of 7**, and the fix is a one-line change from a
literal array to a `readdirSync('sot')` filter — which would have caught this on the day it landed.

**DISPATCHED → Station 04** (it owns gate liveness) **or 00 to arm it.** `scripts/` only, so it is
a clean single-PR change and CP-24 does not touch it. RULE 1: widening the array to a directory
read solves it immediately *and* for every sot file added later, and damages nothing — a checker
reading more files cannot corrupt data. The alternative, adding the four names by hand, fails the
future half: the next `sot/07` is unwatched again.

### FINDING 4 — sot/03's 9 replacement characters are 6 days old, and CP-24 is why nobody fixed them

`[MEASURED]` The 9 U+FFFD sit in one block, `sot/03-progress-log.md:7327-7341`, in a 2026-05-26
log entry. They were reported by Station 05 on 2026-08-27 (breadcrumb
`00-05-sot-keeper-2026-08-27-1411-sot03-nine-replacement-chars-sot04-in-sync.md`, FINDING 1),
**DISPATCHED → Station 00**, and are still there.

`[INFERRED]` **Why it stalled, which no prior report says.** The 08-27 RULE-1 complete option was
"repair in a doc-reconcile PR *and* add a U+FFFD assertion to the sot checkers". Those two halves
are `sot/` and `scripts/` — **CP-24 hard-blocks any PR containing both** (`pr-gates.mjs:327`). The
complete option was, as written, unshippable, and the incomplete one was correctly declined. It has
been re-reported twice into the same wall.

**DISPATCHED → Station 00, with the sequence that actually fits the gate:** (1) land FINDING 3's
`scripts/` widening first — it is the "forever" half and it is already a standalone PR; (2) *then*
Station 05 repairs the 9 characters in a `sot/`-only doc-reconcile PR, with the now-live gate as
its proof. Two PRs, in that order, both green, neither mixing.

⚠️ **I did NOT repair them, and the reason is not caution for its own sake.** The station brief puts
curated prose in `sot/01/02/03/05/06` on the never-auto-fix list, and the substitutions are
**inference**: the context reads as em-dash ×4, `§` ×1 and `×` ×4, but `[MEASURED]` the byte
evidence is gone — the damage predates the earliest commit that touches those lines, and I looked
for an undamaged twin (`git grep -l IS-T100` → 9 files) and found none:
`docs/diagnostics/2026-05-26-tendering-smoke-test/REPORT.md` is a different document, 0 U+FFFD.
Writing a guess into source of truth is worse than leaving a visible scar.

### FINDING 5 — 411 double-encoded sequences across 28 files, none of them in sot/

`[MEASURED]`, node reader, positive control 2015/2817 files showing a real em dash. The heavy ones:

| File | `â€` | U+FFFD |
|---|---|---|
| `apps/api/prisma/schema.prisma` | 142 | 0 |
| `docs/pr-prompts/BACKLOG.yaml` | 81 | 0 |
| `docs/plans/cluster-chaining-plan.md` | 46 | 0 |
| `.claude/agents/{00,01,02,03,04,05}-*.md` | 110 total | 0 |
| `sot/03-progress-log.md` | 0 | 9 |

Two caveats I am stating rather than letting a reader trip over: `scripts/pipeline/check-sot-bytes.mjs`,
`scripts/pipeline/check-sot-encoding.ps1`, `docs/pipeline/DOCTRINE.md` and several 04 breadcrumbs
match **because they contain the signature as a literal needle** — those are not damage. The four
rows above are.

The `.claude/agents/*.md` row matters most: those six were **rewritten on 2026-08-31 at 00:38:06Z**
by the fix that discharged the shared-doctrine thread, and they came out of that rewrite carrying
110 double-encodes. `check-agent-doctrine.mjs` exits 0 — it checks that they *cite* DOCTRINE, not
that they are readable.

**DISPATCHED → Station 04 / 00.** Entirely outside 05's allowlist (`schema.prisma`, `.claude/`,
`docs/plans/`, `BACKLOG.yaml` are all explicit never-auto-fix). Unlike sot/03 this one is
**mechanically recoverable, not inferred** — `â€"`→`—`, `â€™`→`’` and friends are a fixed
byte-level table, and a repair can be proved by re-running the scan to 0 with the em-dash count
rising by the same number it fell.

### FINDING 6 — my own step-6 instrument produced a confident false finding

`[MEASURED]` v1 of my coherence script required **double-quoted** table identifiers and reported
`model ScopeCard -> table "scope_cards"` as having **no backing migration**. It is created at
`20260516120000_scope_card_foundation/migration.sql:8`, as `CREATE TABLE IF NOT EXISTS scope_cards (`
— **unquoted**. The negative control gave it away: `git grep -l 'CREATE TABLE "scope_waste_items"'`
returned **0** for a table that unquestionably exists, so the regex family was wrong, not the repo.

**ACTIONED** — regex widened to `"?ident"?`, controls added to the script itself, re-run: **0 models
missing a migration, 0 orphan tables**. Recorded here rather than quietly deleted because DOCTRINE §7
counts this as the failure mode: a broken instrument hands you a coherent wrong verdict, and four of
the six canonical lies were a failed query read as a meaningful answer. **Mine was the seventh.**

### FINDING 7 — sot/02 §2 "In-PR — open right now" is 28 days stale

`[MEASURED]` `sot/02-roadmap-and-status.md:61` claims 2 open PRs and names **#894** and **#895**.
`gh pr view` → both **MERGED, 2026-08-04**. The real open board is `#1494`, `#1483`, `#1477`.
`sot/02` was last touched at `549537a4` (#1342).

**DEFERRED.** Roadmap STATUS semantics are curated and explicitly outside 05's allowlist, and the
section labels itself a snapshot that `bring-up-to-speed.ps1`'s `[LIVE]` lines beat. It becomes
urgent the moment anyone answers *"what's open right now?"* from this file instead of from the
sweep — the file's own §1 invites exactly that. A one-paragraph replacement pointing at the sweep,
rather than a table that re-rots every week, would end it permanently; that is a wording change and
therefore Marco's or a doc-reconcile with a human reading the prose.

### FINDING 8 — 21 of 81 API modules are absent from sot/01's registry

`[MEASURED]`, controls passing: `access-requests · admin-imports · agreed-records · api-keys ·
bid-prioritisation · branding · cases · comms-approvals · company-profile · correspondence ·
expenses · geocoding · handovers · list-bindings · pilot-feedback · public-holidays ·
subcontractor-rates · surveys · tenants · tender-clients · win-likelihood`.

**DEFERRED.** Registry content is curated — which of these are first-class modules and which are
internal helpers is a judgement about the architecture, not deterministic drift, and guessing it
into `sot/01` is how a registry stops being trusted. It becomes urgent when an agent uses sot/01 to
decide whether a module exists. What would make it cheap: a generated appendix listing the
directories, kept beside the curated registry rather than merged into it — same shape as sot/04's
BEGIN/END seam, which is the pattern that already works here.

## WHAT I DID NOT DO

- **Did not repair the 9 U+FFFD in `sot/03`** — FINDING 4. Inference, and the brief forbids it.
- **Did not touch `schema.prisma`, `.claude/agents/*`, `BACKLOG.yaml` or `docs/plans/`** — FINDING 5
  is outside the allowlist in every direction. Reported, not attempted.
- **Did not edit `sot/01` or `sot/02`** — FINDINGS 7 and 8 are curated prose.
- **Did not stage a prompt.** The old S1 wording told 05 to stage
  `docs/pr-prompts/pr-sot-reconcile-<date>-ready.md`; that is now known to be dangerous — `.gitignore:75`
  ignores it and a loose `*-ready.md` **is an armed prompt** the watcher will run (DOCTRINE §5b),
  and 05 may never arm. Opening the PR myself is the sanctioned delivery.
- **Did not stage `docs/data-model/metadata-catalog.json`** — regenerated and proven byte-identical
  to the committed blob; the ` M` is a line-ending stat artifact only.
- **Did not merge, did not arm, did not remove a label, did not touch the queue**, and did not
  run any git write in `C:\ProjectOperations2` or `C:\po-watcher`.
- **Did not clear the [STALE] escalations the sweep flagged** (`pr-subbie-rate-cards-scope-pricing-HOLD`
  → #212/#213 merged; `ruleset-requires-four-checks…` → #1482/#1485/#1488 merged), nor the ~30
  `WATCHER-CRASH-LOOP-*` / `WATCHER-CHURN-*` files that took `needs-marco/` to 39 this run. That is
  `needs-marco/` hygiene and belongs to 00/03's standing dispatch, not to 05.
- **Did not touch Azure, Entra or SharePoint.** Absolute.

---

**This breadcrumb ships inside its own run's PR**, so it needs nobody to sweep it up.
Findings 3, 4 and 5 are the ones that need a station to pick them up.
