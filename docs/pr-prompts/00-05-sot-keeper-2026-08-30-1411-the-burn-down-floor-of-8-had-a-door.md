# Station 05 — SoT Keeper | 2026-08-30T14:10Z–2026-08-30T14:5xZ

## GROUND

```
UTC            2026-08-30T14:11:11Z
origin/main    4461c8be            (git fetch origin, then rev-parse)
dev tree       main @ 4461c8be     C:\ProjectOperations2   (left/right 0 0 — converged)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was read-write within station scope.

**SIGHTED.** `start_process` shell `powershell.exe` returned `BOX-OK` at 14:10:54Z. Desktop
Commander present. This was not a blind run.

**The three binding documents were read from a tree proved identical to `origin/main`.** The
station contract says never read them from the working copy; rather than dump blobs (DOCTRINE §9.3:
PS `>` writes UTF-16LE and corrupts any comparison), I proved equivalence instead —
`git diff origin/main --stat -- <path>` returned EMPTY for all three of
`docs/pipeline/stations/05-sot-keeper.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`. [MEASURED]

**Sweep:** `scripts/pipeline/status-sweep.ps1` → **SAFE TO ACT**, exit 0, generated 14:11:28Z.
OPEN PRs 0 · armed 0 · in-progress prompts 0 · `index.lock` interactive/clone False/False · git
processes 0 · staged index EMPTY at start and at end. [MEASURED]

## WHAT I MEASURED

**A1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges)`, exit 0.
[MEASURED] Per the 2026-08-25 correction this proves parse-clean only, not artifact freshness.

**A2 — catalog validity.** `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json'))"`
→ `CATALOG-VALID bytes=678752`, exit 0. [MEASURED] The four-sweep unterminated-string defect is
gone and stayed gone.

**A3 — RULE ZERO, and the instrument disagreement is REAL and REPRODUCED.**
`node scripts/pipeline/check-sot-refs.mjs` at the SAME SHA `4461c8be`:
dev tree `C:\ProjectOperations2` printed **`baselined=17`**; a clean worktree off `origin/main`
(`C:\po-worktrees\sot-1411`) printed **`baselined=23`**. [MEASURED] Six entries read as
"already fixed" on the dev box purely because their targets are gitignored local artifacts. Every
number below is the **clean-worktree** number. The dev-tree number is the lie.

**A3b — CI agrees with local.** `check-sot-refs.mjs` runs at `.github/workflows/ci.yml:193`, inside
the job `Pipeline — watcher + linter tests`, which is `success` on `4461c8be`. [MEASURED] No
ENVIRONMENT DISAGREEMENT this run.

**A4 — main CI, per-commit, full 40-char SHA.**
`gh run list --commit 4461c8bef057e75f9f6385a85bfc2d10172de093` → 4 runs, **all `success`**:
Deploy · Tendering Browser Smoke · Push on main · CI. Job level inside CI: 8 jobs, 7 `success`,
1 `skipped` (`PR gates — diff checks`, correct on a push). [MEASURED]
**Negative control, same minute:** the same query with the 8-char short SHA returned **0 rows,
exit 0, no warning** — DOCTRINE §9.4's trap reproduces exactly as written. [MEASURED]

**A5 — sot/04 generated-section drift: NONE.**
sot/04 header — `sha256 b26240cf69d9` · Models 292 | Enums 66 | FK edges 482 | Domains 23.
Freshly generated `docs/data-model/relationship-map.md` header — `sha256 b26240cf69d9` ·
Models 292 | Enums 66 | FK edges 482 | Domains 23. Identical on all five values. [MEASURED]
The generated section is current; **no re-merge was needed and none was performed.**
Also measured: regenerating left tracked `docs/data-model/metadata-catalog.json` **byte-identical**
(absent from `git diff --numstat`). The documented "regen shrinks the tracked catalog" hazard did
not materialise at this SHA. [MEASURED]

**A6 — model ↔ migration coherence: CLEAN.** 292 models, 228 migration files, 297 tables created
or renamed-to, 38 dropped. **Models with no backing migration: 0.** [MEASURED]
Positive control: model `Client` backed = true. Negative control: fake table `ZzzNotARealTable`
present = false. The single "orphan table" my script printed, `IF`, is **my own regex artifact**
(`CREATE TABLE IF NOT EXISTS` partially captured) — it is not a finding, and I am naming it rather
than letting it read as one (§7).

**A7 — automation health: ALIVE.** `Get-CimInstance Win32_Process` filtered on
`pr-watcher[\\/]index\.mjs` → exactly **1** process, PID **26364**, command line
`node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`. [MEASURED]
Live task list read, not enumerated from a doc: exactly one project task exists —
**`PO Watcher Keepalive`, State=Ready, LastTaskResult=0, LastRun 2026-08-31 00:15 local
(= 2026-08-30 14:15Z)**. The four phantom fixtures the 2026-08-27 correction removed are still
absent. [MEASURED]
Newest mtime under `docs/pr-prompts/processed/`: **2026-08-28 16:13Z** — 46 h old, and that is the
same minute the OAuth credential's mtime froze. The queue has not drained because nothing has run,
not because the watcher is wedged. [INFERRED from the two measured timestamps]

**A8 — registry drift (report-only).** 81 module directories under `apps/api/src/modules`;
**31 are not mentioned anywhere in `sot/01-charter-and-architecture.md`**: access-requests,
admin-imports, admin-settings, admin-users, agreed-records, ai-settings, api-keys,
bid-prioritisation, branding, cases, client-quotes, comms-approvals, company-profile,
correspondence, estimate-export, expenses, geocoding, global-lists, handovers, handover-templates,
list-bindings, notification-preferences, pilot-feedback, public-holidays, schedule-of-rates,
subcontractor-rates, surveys, tenants, tender-clarifications, tender-clients, win-likelihood.
[MEASURED] Positive control: sot/01 does mention `tendering`. Negative control: it does not mention
`zzz-not-a-module`.

**A9 — roadmap drift in sot/02, measured against live GitHub.** §2 is titled
*"🔧 In-PR — open right now (2)"* and tables **#895** and **#894**. Live: **#894 MERGED
2026-08-04T04:41:46Z**, **#895 MERGED 2026-08-04T05:09:13Z**, and `gh pr list --state open` returns
**0**. Four more PRs the section describes as in flight are also merged: #884 (08-03T22:39Z),
#891 (08-04T03:19Z), #903 (08-04T06:14Z), #905 (08-04T19:28Z). [MEASURED] The snapshot was taken
2026-08-04 and both its headline PRs merged **within hours of it being written**. It has read false
for **26 days**.

## WHAT CHANGED

**One doc-reconcile PR. Five files, +11 / −21 lines. No `scripts/`, no `apps/` — CP-24 clean
(`sot/` + `docs/` is the allowed pairing).** Opened from a disposable worktree
`C:\po-worktrees\sot-1411` off `origin/main`, never from the dev tree.

`docs/qa/sot-refs-baseline.json` — **23 entries → 13.** Ten entries deleted, `_readme` rewritten.
Line-based edit so the diff is a pure deletion (`2 12`), not a reformat.

Nine lines across four `sot/` files gained an inline `<!-- sot-ref-allow: <reason> -->` marker
(10 references; `sot/04:4467` carries two on one line):

| file:line | reference | why it is exempt, not debt |
|---|---|---|
| `sot/03-progress-log.md:7437`, `:7464` | `apps/api/scripts/xero-import-report.md` | gitignored, `.gitignore:86` |
| `sot/04-data-model.md:9` | `docs/data-model/relationship-map.md` | gitignored, `.gitignore:128` |
| `sot/04-data-model.md:4467` | `docs/qa/qa-checklist.md`, `docs/qa/qa-findings.md` | gitignored, `.gitignore:107-108` |
| `sot/04-data-model.md:4482` | `docs/qa/qa-checklist.md` | gitignored, `.gitignore:107` |
| `sot/06-active-specs.md:1197` | `pr-dashboard-gantt-heatmap-widgets-HOLD.md` | consumed queue prompt |
| `sot/06-active-specs.md:1199` | `pr-dashboard-rename-copyfrom-HOLD.md` | consumed queue prompt |
| `sot/06-active-specs.md:3094` | `needs-marco/pr-188-authz-findings.md` | gitignored, `.gitignore:82` |
| `sot/README.md:190` | `graphify-out/GRAPH_REPORT.md` | gitignored, `.gitignore:134` |

**Read back, in the clean worktree off `origin/main`:**
`total=274 dangling=0 exempt=10 baselined=13 excluded=2`, **exit 0**, and identical on a second
consecutive run (deterministic). [MEASURED]

**Not one curated byte moved.** `git diff --numstat`: `sot/03` 2/2 · `sot/04` 3/3 · `sot/06` 3/3 ·
`sot/README` 1/1 — every touched line is a modify-in-place of a line that already carried the
reference. No line added, none removed, no prose rewritten. [MEASURED]

## FINDINGS

### F1 — The sot-refs burn-down floor of 8 was not a floor. It had a door, and the door is now used. → **ACTIONED**

The baseline's own `_readme` asserted **"THE BURN-DOWN FLOOR IS 8, NOT 0"**, and Station 00 has been
carrying that as a standing hard limit: 8 entries point at targets that are gitignored *by design*,
so the `sot/` reference is CORRECT and deleting the entry converts a baselined exemption into a hard
CI failure on every PR. That reasoning was sound and the conclusion was wrong, because it assumed
deletion was the only move.

`ALLOW_COMMENT_RE = /<!--\s*sot-ref-allow:\s*(.+?)\s*-->/` at `check-sot-refs.mjs:154` is tested
against **the line of the `sot/*.md` file itself** and `continue`s at `:239` — **before** the
path-class check (`:242`) and **before** `existsSync` (`:258`). So a marker on the line clears the
reference without the target needing to exist anywhere. Because the marker lives inside `sot/`, only
Station 05 can write one.

**Verified with a matched control pair, not by reading the source:**

- **NEGATIVE CONTROL** — delete the 10 entries, write no markers →
  `dangling=10 exempt=0 baselined=13`, **exit 1**, and the 10 FAIL lines are exactly the 10 I
  targeted. This is also the positive control that the checker *can* fail on this corpus.
- **THEN** — add the 10 markers → `dangling=0 exempt=10 baselined=13`, **exit 0**. Twice, identical.

Classification was measured per target, not assumed: `git check-ignore -v` on the **file** (§9.2 —
on a *directory* it prints nothing and exits 1, which reads as "not ignored") plus
`git cat-file -e origin/main:<path>`. Controls: `docs/pr-prompts/processed/anything.md` →
`.gitignore:76` (ignored, correct); `sot/README.md` → exit 1 (not ignored, correct) and
`cat-file` exit 0 (on main, correct). 8 of the 10 are gitignored-by-design; the other 2 are consumed
queue prompts that `EXCLUDED_PATH_CLASSES` misses because its pattern is `-ready\.md`-only and these
are `-HOLD.md`.

**Why the marker and not a prose edit (RULE 1).** The marker solves it completely and additively:
it is **line-drift-proof**, where a baseline entry is keyed on `sot_file` + `line` + `missing_path`
and silently converts to a hard CI failure the moment anything is inserted above it in an
append-heavy file like `sot/03-progress-log.md` — a live time-bomb under 13 remaining entries. And
it destroys no information: at `sot/03:7437` the prose literally reads *"(…xero-import-report.md,
gitignored)"*. The reference is correct; the checker is the blind party. Deleting or rewriting that
line to satisfy an instrument would damage true content to flatter a tool.

Baseline `_readme` updated to record the mechanism, the control pair, and that the floor is now 0.

### F2 — `sot/02` has said "In-PR — open right now (2)" for 26 days while zero PRs were open. → **ESCALATED**

Measured above: both tabled PRs merged on 2026-08-04, hours after the snapshot was written, and four
more "in flight" PRs in §3 are merged too. Open PR count is 0.

This is not mine to auto-fix — the station brief puts *"roadmap STATUS semantics"* and *"curated
prose in sot/01/02/03/05/06"* on the NEVER-auto-fix list — and no other station may edit `sot/` at
all, so it cannot be dispatched sideways either. It needs Marco. **The question is not "should the
table be corrected"; it is "should this table exist".**

**RULE 1 — complete-and-additive first:**

- **(A) Replace §2's snapshot table with a pointer to the live instrument.** `sot/02` already says,
  three lines above the table, that `bring-up-to-speed.ps1`'s `[LIVE]` lines *"beat this table the
  moment it drifts"* — so the document already knows the table is the weaker source. Deleting the
  table and keeping the pointer solves it **immediately** (the false claim is gone) **and in future**
  (a hand-maintained mirror of a live fact cannot re-rot if it does not exist), and damages nothing:
  every fact in it is recoverable from GitHub and from `03-progress-log.md`. **Passes both halves.**
- **(B) Correct the table to today's reality** (0 open, mark #894/#895/#884/#891/#903/#905 merged).
  **Fails the "future" half.** It is true for as long as it takes the next PR to open, and puts
  `sot/02` straight back on the 26-day drift curve. It is a one-run fix to a standing defect.
- **(C) Leave it.** Fails both halves.

I recommend **(A)** and can land it as its own doc-reconcile PR on the next 05 run — say the word,
or say (B) if the historical snapshot is worth keeping. I did **not** fold it into this run's PR:
S7 caps me at one reconcile PR, and mixing a mechanical burn-down with a roadmap-prose rewrite would
make the rendered diff harder to review, which is the whole point of the doc-reconcile model.

### F3 — 31 of 81 API modules are absent from the `sot/01` module registry. → **DEFERRED**

Listed in full under A8. Report-only by the station brief (`sot/01` registry is curated prose), and
each entry is a judgement call about whether the module is a first-class module, a sub-feature of a
listed one, or dead. Roughly 40% coverage loss is not a one-run mechanical fix.

**What makes it urgent:** `sot/01` is the document a new chat is told to read to learn the
architecture. A registry that omits `tenants`, `api-keys`, `cases` and `estimate-export` will send a
reader to design something that already exists. If the next 05 run finds the count has grown, or if
any of the missing modules turns up in a design decision, this stops being deferrable. I propose
taking it in named batches — it is 05's lane, but it wants Marco's view on *what counts as a module*
before I start writing prose into `sot/01`.

### F4 — The dev tree under-reports sot-refs by 6 and will keep doing so. → **DEFERRED**

`baselined=17` on the dev box vs `23` on a clean worktree at the same SHA — the trap the baseline
`_readme` documents, reproduced. It is now smaller (the 6 gitignored-target entries that caused it
are among the 10 I just exempted, so the two counts should converge), but the *mechanism* survives:
`existsSync` against a working tree will always be able to see a local artifact that CI cannot.

Not urgent because the cure is already written down in three places and the `_readme` now carries the
re-confirmed measurement. **What would make it urgent:** any station reporting a sot-refs number
without saying which tree it came from. The next 05 run should re-measure both and confirm they now
agree at 13.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, staged no prompt.** 05 may do none of those. ARMED was 0 at the
  start of this run and 0 at the end. [MEASURED]
- **No auto-fix of `sot/04`'s generated section** — it is not drifted (A5). The allowlisted re-merge
  had nothing to re-merge, so S2/S3/S4 never applied. I did regenerate the map in the disposable
  worktree to *obtain* the comparison, and committed with an explicit pathspec so the regenerated
  artifacts could not ride along.
- **No `docs/data-model/sweeps/2026-08-30.md`.** The old station brief asks for one; the canonical
  station contract asks for exactly ONE breadcrumb and says the contract wins where they disagree.
  Two homes for one report is how "which copy is current" starts. This file is the report.
  **The brief's OUTPUT section should be corrected to match the contract** — flagging it rather than
  quietly ignoring it.
- **Did not touch the other 13 baseline entries.** Each is real debt about a deleted doc
  (`architecture-overview.md`, `continuation-log.md`, `module-build-log.md`,
  `Project-History-Sprints-1-to-12.md`, `Master-QA-and-Consolidation-Program-Plan.md`) or a moved
  source file (`tender-scope-drafting.service.ts`, `quote-pdf.builder.ts`,
  `tender-client-notes.controller.ts`), and every one needs a judgement call. Applying the
  `sot-ref-allow` marker to any of them would be an abuse of it — it would convert real debt into a
  permanent exemption, which is precisely the failure the baseline exists to prevent.
- **Did not clear the 13 `[STALE]` `needs-marco/` escalations** the sweep lists — gitignored, not
  `sot/`, not my lane.
- **Did not touch the watcher clone** (`dirty=35`, Station 03's lane), the OAuth credential, the
  orphaned worktree `C:\po-worktrees\sup-1410` (Station 00's, created 1 minute before this run
  started and presumed live), or `/sot/` beyond the nine marker lines.
- **Azure / Entra / SharePoint: not touched, not read, not planned.**
