# Station 05 — SoT Keeper | 2026-08-27 14:11Z–14:20Z

## GROUND

```
UTC            2026-08-27T14:11:28Z
origin/main    01ad020e            (fetched with +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ cb9fce55     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run had write authority within its allowlist. NOT blind: Desktop Commander
reached the box on the first call (`PROBE_OK 2026-08-27T14:11:28Z`, `Test-Path 05-sot-keeper.md` =
True). `status-sweep.ps1` verdict at 14:11:52Z: **SAFE TO ACT**, 0 in-progress prompts, 0 git
processes, no `index.lock` in either tree.

## WHAT I MEASURED

**Rule Zero (local vs CI) — NO environment disagreement this run.** [MEASURED]
- Local: `node scripts/data-model/build-relationship-map.mjs --check` →
  `OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges).`
- CI on the same tree state: `gh api repos/GH-Mantova/ProjectOperations/commits/01ad020e015a887cb087551318b345fae0f57177/check-runs?per_page=100`
  → `success  Data model — generator sanity (schema.prisma parses cleanly)`.
  13 check-runs on main head: 12 success, 1 skipped (`PR gates — diff checks`, skipped by the
  changed-path filter). Trunk green **read per-commit**, not from `gh run list --branch main`.

**Audit 1 — schema parse sanity.** [MEASURED] OK, exit clean. As corrected 2026-08-25, this is a
*parse* gate, not a drift gate; it proves nothing about sot/04 currency. Drift was measured by
audit 3 below instead.

**Audit 2 — catalog validity.** [MEASURED] `docs/data-model/metadata-catalog.json` **parses as
valid JSON**, 678,752 bytes, top-level keys `_purpose,_generatedFrom,domains,models`. The
four-sweep unterminated-string defect is **not present**. Positive control: the same reader
successfully parsed and reported byte counts.

**Audit 3 — sot/04 drift. IN SYNC, exactly.** [MEASURED]
- sot/04 header: `Models: 292 | Enums: 66 | FK edges: 482 | Domains: 23`, `sha256 b26240cf69d9`,
  `Last updated: 2026-08-26 14:14 UTC`.
- Generator on live `schema.prisma`: 292 models / 66 enums / 482 edges. TOC lists 23 domains.
- Schema hash, computed the way the generator computes it (`build-relationship-map.mjs:524`
  hashes the **LF-normalised** text): `b26240cf69d9`. **Match.**
  🔧 Instrument note: the *raw* CRLF bytes hash to `d77585daef9d`. Hashing the file as-read on
  Windows would have reported drift against a file that is byte-current. Normalise first.
- `<!-- SOT04-GENERATED:BEGIN -->`, `:END`, and the `MERGED SOURCES` seam are all present.
- **Consequence: no reconcile PR is warranted this run.** S7 also clean — `git ls-remote --heads
  origin "*sot*reconcile*"` returns nothing; no reconcile branch or PR is pending.

**Audit 4 — roadmap drift. FOUND, see FINDING 2.** [MEASURED]

**Audit 5 — automation health.** [MEASURED]
- Watcher: node pid 28328 running, wrapper alive, `PO Watcher Keepalive` scheduled task = Ready.
- It is **doing work**: newest `docs/pr-prompts/processed/` mtimes are `rev-1353-ready.md.log`
  12:33:34Z and `pr-lessons-folder-s3-ref-checker-ready.md.log` 12:27:52Z, ~100 min before this
  run. 3,522 files in `processed/`. Armed count 0. Idle, not dead.
- 🔴 **The four scheduled tasks this station's own brief tells it to report on DO NOT EXIST.**
  `Get-ScheduledTask` over all 208 visible Windows tasks matched `PO Watcher Keepalive` and
  `\Microsoft\Windows\Windows Error Reporting\QueueReporting` — nothing named `pr-shepherd`,
  `night-qa`, `watcher-triage` or `feature-queue-watch`. See FINDING 3.

**Audit 6 — model ↔ migration ↔ code coherence.** [MEASURED]
- 292 models (with `@@map` resolved to table names) vs 228 migration directories: **0 models with
  no `CREATE TABLE` in any migration.**
- Reverse direction: 1 apparent orphan table, name `IF`. 🔧 **That was my instrument lying, and I
  caught it:** the regex backtracked over the *comment* line
  `-- Idempotent: guarded by CREATE TABLE IF NOT EXISTS / DO NOT EXISTS checks.` in
  `20260716130000_erp_haulage_dockets/migration.sql:16` and captured the literal `IF`. Verified by
  reading the file. **True orphan count = 0.** (38 tables are dropped/renamed away in migrations
  and were excluded correctly.)

**Audit 7 — module registry.** [MEASURED] See FINDING 4.

**sot/ encoding health, read with node (not `Get-Content`).** [MEASURED]
`01`=0 · `02`=0 · **`03`=9 U+FFFD** · `04`=0 · `05`=0 · `06`=0 · `README`=0. Zero double-encode
(`U+00E2 U+20AC …`) signatures anywhere. See FINDING 1.

**Board, for context only (not my lane).** [MEASURED at 14:14Z] Open PRs **#1353** and **#1354**
(#1354 opened *during* this run — it is not in the 14:11:52Z sweep). #1353 head `61bcd7ee`:
11 pass / 2 fail — `API — lint, test, compliance smoke` and `Pipeline — watcher + linter tests`.

## WHAT CHANGED

**Nothing in `/sot/` and nothing on the board.** No reconcile PR was opened, because the only thing
in this station's auto-fix allowlist — the sot/04 generated section — measured byte-current. I did
not run the generator in write mode: it rewrites the **tracked** `docs/data-model/metadata-catalog.json`
(`build-relationship-map.mjs:567`) in a tree whose git index is shared with other chats, and there
was no drift to justify it.

Files written this run: this breadcrumb, `docs/data-model/sweeps/2026-08-27.md`, and four scratch
scripts under `C:\po-sup-fix-scripts\`. Both repo files are **untracked** — Station 00 must sweep
them into a board PR or they are not reported.

## FINDINGS

### FINDING 1 — `sot/03-progress-log.md` carries 9 U+FFFD replacement characters, committed on `main`

[MEASURED] Read with node (`readFileSync(..., 'utf8')`), so this is not the `Get-Content` false-
mojibake trap of DOCTRINE §9.3. Confirmed present in **three** places: the working tree, the
`git show origin/main:` copy, and the raw bytes (`EF BF BD`, e.g. offset 378762). All 9 sit in one
2026-05-26 entry, lines 7327–7341:

| line | text as it stands | almost certainly was |
|---|---|---|
| 7327 | `## 2026-05-26 ? feat/seed-template-tender OPENED` | `—` |
| 7329 | `Type: Seed data (?5 Tendering)` | `§` |
| 7331 | `Detail: Additive seed ? IS-T100 full-feature template tender + ClientQuote.` | `—` |
| 7332 | `Tender: IS-T100 "TEMPLATE ? Full-Feature Reference Quote", status DRAFT.` | `—` |
| 7333 | `Scope: 18 items across 4 disciplines (DEM?4, CIV?3, ASB?4, Other?5 incl.` | `×` ×4 |
| 7341 | `Pre-PR checks: build, lint, 768 API tests, 193 web tests ? all pass.` | `—` |

The right-hand column is **[INFERRED]**, not measured — that is precisely why I did not apply it.
Support for the inference: `§` appears elsewhere in this same file (`Type: PR (chore — §5A.1 PR B: …)`),
and em dash is the file's house separator across 389 `Type:` lines.

**Recovery from history is exhausted** (two honest attempts): `git log -- sot/03-progress-log.md`
returns only `00d082d6` and `d5bd4f58`, and **both carry the identical 9 U+FFFD**. The damage
predates the file's current path — it came in with the 2026-07-08 consolidation.

Blast radius is small (one historical log entry, no gate reads it) but it is measured corruption in
a source-of-truth document, and `sot/03` is on this station's **never-auto-fix** list (curated
prose). I will not guess characters into `/sot/` on my own authority.

**DISPATCHED** → Station 00. Two ways to close it, RULE 1 order:
- **(A) complete + additive — recommended.** 00 authorises 05 to make this one character-scoped
  repair in a doc-reconcile PR *and* adds a `U+FFFD` count assertion to the sot checkers being wired
  up in #1353, so no future replacement char can land unnoticed. Solves it now and forever, touches
  no data-entry path. Cost: one extra check.
- **(B) repair only.** 05 fixes the 9 characters, no guard. Fails the *future* half of RULE 1 — the
  next bad-decoder round-trip lands silently, exactly as this one did for ~7 weeks.
- **(C) leave it.** Fails both halves. Listed only so the option set is honest.

### FINDING 2 — `sot/02` §2 "In-PR — open right now (2)" names two PRs merged 2026-08-04

[MEASURED] sot/02 line 61 heads a table listing **#895** and **#894**. Live:
`gh pr view` → #894 MERGED `2026-08-04T04:41:46Z`, #895 MERGED `2026-08-04T05:09:13Z`. The real open
set at 14:14Z is **#1353** and **#1354**. `Last updated: 2026-08-04` — the file is 23 days stale and
its own §2 header caveats itself ("Live snapshot read from GitHub at reconcile time (2026-08-04)").

This is roadmap **STATUS semantics** — explicitly on this station's never-auto-fix list, so it is not
mine to rewrite even though the mechanical part (swap the table) looks deterministic. The judgement
call is what §3/§4 should now say, and that is Marco's roadmap, not a regeneration.

**DEFERRED.** It becomes urgent the moment anyone answers "what's next?" from this file instead of
from `bring-up-to-speed.ps1` — which the file itself warns against, on line 63. If 00 wants it closed,
the honest fix is a curated reconcile pass over §2–§4 by a development chat, not a table swap.

### FINDING 3 — this station's own brief audits four scheduled tasks that do not exist

[MEASURED] Audit step 5 of `docs/pipeline/stations/05-sot-keeper.md` says: *"report whether the four
ProjectOps scheduled tasks (pr-shepherd, night-qa, watcher-triage, feature-queue-watch) are
ENABLED."* `Get-ScheduledTask` across all **208** visible Windows tasks returns **none of the four**.
The only live one is `PO Watcher Keepalive` (State: Ready). Positive control: the same query does
return `PO Watcher Keepalive` and `QueueReporting`, so the instrument works.

This is a **permanently-false probe** in a binding station doc — the same shape as the `docs/design`
gate Station 04 reported on 2026-08-27 06:17Z. Every run either reports four phantom tasks as
"missing" (alarming, wrong) or quietly skips the step (silent, wrong).

⚠️ **This is a REPEAT, and saying so is the point.** Station 05's 2026-08-26 14:11Z run already
recorded "audit step 5 names 4 tasks that do not exist". It is still there 24 hours later, which
means the finding was reported and not closed — so the escalation is no longer "here is a defect",
it is **"the reporting channel returned this and nothing moved."** If option (A) below is not taken
this run, the honest expectation is that Station 05 reports it a third time tomorrow.

Repairing it means editing `docs/pipeline/stations/` — outside safeguard **S5**, which caps a fix run
at `sot/` plus `docs/data-model/` generated artifacts. So I am not taking it unilaterally.

**DISPATCHED** → Station 00. Proposed replacement text for audit step 5, RULE 1 complete-and-additive:
*"Report watcher liveness by PID + command line, the `PO Watcher Keepalive` task state and last
result, and the newest mtimes under `docs/pr-prompts/processed/`. Do not enumerate task names from
this document — read the live task list."* That is additive (it names an instrument, not a fixture)
and cannot go stale the way a hard-coded list of four names did.

### FINDING 4 — `sot/01` SECTION 13 MODULE REGISTRY covers 36 of 81 API modules

[MEASURED] `apps/api/src/modules` holds **81** directories. Restricting the search to SECTION 13
(lines 709–1268, 560 lines), **45** are never named:

`access-requests, admin-imports, admin-settings, admin-users, agreed-records, ai-settings, api-keys,
archive, audit, authorization, bid-prioritisation, branding, cases, client-quotes, client-versions,
comms-approvals, company-profile, correspondence, crm, estimate-export, expenses, field-definitions,
geocoding, global-lists, handover-templates, handovers, inventory, job-roles, list-bindings,
map-locations, master-data, notification-preferences, pilot-feedback, procurement, public-holidays,
resources, roles, schedule-of-rates, subcontractor-rates, surveys, tenants, tender-clarifications,
tender-clients, tender-documents, win-likelihood`

Positive control: the same query finds `tendering` in the registry, so the search is not simply
missing everything. The registry's newest sub-heading still reads *"LIVE (merged to main through
PR #102)"* against a board at #1354 — it is a Phase-5A-era artifact.

Audit step 7 says **report only**, and this is curated prose in sot/01. It is also not a small edit:
45 modules is a genuine authoring job, not a regeneration.

**DEFERRED.** What would make it urgent: any agent using SECTION 13 to decide whether a module
exists. Right now nothing does — the live answer is the directory listing — which is exactly why it
has been allowed to rot. If 00 wants it closed, it is a scoped development-chat task; naming the
45 above is the whole input.

### FINDING 5 — the one backlog item reserved to Station 05 has already discharged

[MEASURED] Backlog item `settings-restructure-sot-nav-reconcile` (sweep §6, marked *"STATION 05
SoT-KEEPER ONLY"*) gates on: SLICE 14 landed **AND** the reconcile not yet shipped, discharging when
`docs/audits/settings-restructure-sot-reconcile.md` exists.
- `git ls-tree -r origin/main -- apps/web/src` → `apps/web/src/pages/administration/MapLocationsPage.tsx` **exists**.
- `git ls-tree -r origin/main -- docs/audits` → `docs/audits/settings-restructure-sot-reconcile.md` **exists**.

Both halves are true, so the gate correctly evaluates not-ready — but the sweep prints it under
*"still blocked (gate not yet satisfied)"*, which reads as work still owed to this station. It is
not: **the reconcile has shipped and the item should be discharged out of the register**, not left
looking blocked. Register maintenance is not my lane.

**DISPATCHED** → Station 00 (or 04, which owns gate liveness): discharge the item, and note in the
discharge that its successor artifact is `docs/audits/settings-restructure-sot-reconcile.md` — the
register's own standing instruction after the model-merge item was lost for a month.

## WHAT I DID NOT DO

- **Did not open a doc-reconcile PR.** sot/04 measured byte-current; there was nothing in the
  allowlist to reconcile. Opening an empty one to look busy is worse than a NO-OP.
- **Did not run the generator in write mode.** It rewrites tracked `metadata-catalog.json`, and the
  dev tree's git index is shared with concurrent chats (DOCTRINE §9.2). No drift, no justification.
- **Did not repair the 9 U+FFFD.** The replacement characters are inferred, `sot/03` is on the
  never-auto-fix list, and DOCTRINE §7 case #2 is an agent nearly turning clean files into corrupt
  ones with exactly this kind of confident repair.
- **Did not touch `sot/01` §13 or `sot/02` §2.** Curated prose and roadmap status semantics, both
  explicitly excluded from the allowlist.
- **Did not touch, arm, disarm, label or merge anything on the board.** #1353's two red checks and
  #1354 are Station 00/02's, not mine. I never arm and I never merge.
- **Did not run `build-toc.mjs --check` against `sot/`** — no sot/ file carries TOC markers, so it
  reports drift unconditionally.
- **Did not clear the 5 orphan worktrees or the 36 dirty files in the watcher clone** reported by the
  sweep. Station 03's lane.
- **Did not touch the staged `R100` rename sitting in the shared index**
  (`pr-guard-s1-verdict-file-list-HOLD.md` → `-ready.md`), left by a concurrent chat's arming. I
  committed nothing, so it could not ride along; a later committer must use a pathspec.

## LATE MEASUREMENT — 14:19Z, after the report above was written

The 14:11:52Z sweep reported `armed (*-ready.md): 0`; a read-back at 14:18:50Z counted **1**. Not an
instrument disagreement — **`rev-1354-ready.md` was created at 14:17:14Z, six minutes after the
sweep.** It is an auto-generated *review job*, not a prompt (DOCTRINE §9.5), and the watcher is
actively executing it: the clone heartbeat's newest line is
`[2026-08-27T14:18:15.781Z] rev-1354-ready.md elapsed=60s`.

**This supersedes "idle, not dead" in audit 5 above:** as of 14:19Z the watcher is *working*, on a
review of #1354, which itself did not exist when this run started. Both readings were true when
taken — which is the whole point of `[LIVE]` meaning "true when measured". Anyone acting on the
armed count must re-measure; mine is already stale.
