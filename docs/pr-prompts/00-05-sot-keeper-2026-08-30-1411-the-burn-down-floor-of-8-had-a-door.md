# Station 05 — SoT Keeper | 2026-08-30T14:10Z–2026-08-30T14:4xZ

## GROUND

```
UTC            2026-08-30T14:11:11Z
origin/main    4461c8be  (at start; 757450b6 after #1404 merged mid-run)
dev tree       main @ 4461c8be     C:\ProjectOperations2   (left/right 0 0 — converged)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was read-write within station scope.

**SIGHTED.** `start_process` shell `powershell.exe` returned `BOX-OK` at 14:10:54Z. Desktop
Commander present. This was not a blind run.

**The three binding documents were read from a tree proved identical to `origin/main`.** The
contract says never read them from the working copy; rather than dump blobs (DOCTRINE §9.3: PS `>`
writes UTF-16LE and corrupts any comparison), I proved equivalence —
`git diff origin/main --stat -- <path>` returned EMPTY for all three of
`docs/pipeline/stations/05-sot-keeper.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`. [MEASURED]

**Sweep:** `scripts/pipeline/status-sweep.ps1` → **SAFE TO ACT**, exit 0, generated 14:11:28Z.
OPEN PRs 0 · armed 0 · in-progress prompts 0 · `index.lock` interactive/clone False/False · git
processes 0 · dev-tree staged index EMPTY at start and at end. [MEASURED]

## WHAT I MEASURED

**A1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges)`, exit 0.
[MEASURED] Per the 2026-08-25 correction this proves parse-clean only, not artifact freshness.

**A2 — catalog validity.** `JSON.parse` of `docs/data-model/metadata-catalog.json` →
`CATALOG-VALID bytes=678752`, exit 0. [MEASURED] The four-sweep unterminated-string defect is gone
and stayed gone.

**A3 — RULE ZERO part 1: the dev tree lies about sot-refs, and it reproduced.**
`node scripts/pipeline/check-sot-refs.mjs` at the SAME SHA `4461c8be`: dev tree
`C:\ProjectOperations2` printed **`baselined=17`**; a clean worktree off `origin/main`
(`C:\po-worktrees\sot-1411`) printed **`baselined=23`**. [MEASURED] Six entries read as "already
fixed" on the dev box purely because their targets are gitignored local artifacts. Every number in
this report is the **clean-worktree** number.

**A4 — RULE ZERO part 2: local and CI AGREE on the checker; the failure was elsewhere.**
On PR #1405's first push, `check-sot-refs.mjs` printed in CI
`total=274 dangling=0 exempt=10 baselined=13` and *"All sot/ references resolve"* — identical to
local. The red came from a **different step in the same job**. See F2. **This is explicitly NOT an
ENVIRONMENT DISAGREEMENT**, and I checked before saying so. [MEASURED, run 33316687892]

**A5 — main CI, per-commit, full 40-char SHA.**
`gh run list --commit 4461c8bef057e75f9f6385a85bfc2d10172de093` → 4 runs, **all `success`**:
Deploy · Tendering Browser Smoke · Push on main · CI. Inside CI: 8 jobs, 7 `success`, 1 `skipped`
(`PR gates — diff checks`, correct on a push). [MEASURED]
**Negative control, same minute:** the same query with the 8-char short SHA returned **0 rows, exit
0, no warning** — DOCTRINE §9.4's trap reproduces exactly as documented. [MEASURED]

**A6 — sot/04 generated-section drift: NONE.**
sot/04 header — `sha256 b26240cf69d9` · Models 292 | Enums 66 | FK edges 482 | Domains 23.
Freshly generated `docs/data-model/relationship-map.md` header — `sha256 b26240cf69d9` ·
Models 292 | Enums 66 | FK edges 482 | Domains 23. Identical on all five. [MEASURED]
**No re-merge was needed and none was performed.** Also measured: regenerating left tracked
`docs/data-model/metadata-catalog.json` **byte-identical** (absent from `git diff --numstat`). The
documented "regen shrinks the tracked catalog" hazard did not materialise at this SHA. [MEASURED]

**A7 — model ↔ migration coherence: CLEAN.** 292 models, 228 migration files, 297 tables created or
renamed-to, 38 dropped. **Models with no backing migration: 0.** [MEASURED]
Positive control: model `Client` backed = true. Negative control: fake table `ZzzNotARealTable`
present = false. The single "orphan table" my script printed, `IF`, is **my own regex artifact**
(`CREATE TABLE IF NOT EXISTS` partially captured). It is not a finding, and I am naming it rather
than letting it read as one (§7).

**A8 — automation health: ALIVE.** `Get-CimInstance Win32_Process` filtered on
`pr-watcher[\\/]index\.mjs` → exactly **1** process, PID **26364**, command line
`node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`. [MEASURED]
Live task list read, not enumerated from a doc: exactly one project task exists —
**`PO Watcher Keepalive`, State=Ready, LastTaskResult=0, LastRun 2026-08-31 00:15 local
(= 2026-08-30 14:15Z)**. The four phantom fixtures the 2026-08-27 correction removed are still
absent. [MEASURED]
Newest mtime under `docs/pr-prompts/processed/`: **2026-08-28 16:13Z** — 46 h old, the same minute
the OAuth credential's mtime froze. The queue is not draining because nothing is running, not
because the watcher is wedged. [INFERRED from the two measured timestamps]

**A9 — registry drift (report-only).** 81 module directories under `apps/api/src/modules`;
**31 are not mentioned anywhere in `sot/01-charter-and-architecture.md`**: access-requests,
admin-imports, admin-settings, admin-users, agreed-records, ai-settings, api-keys,
bid-prioritisation, branding, cases, client-quotes, comms-approvals, company-profile,
correspondence, estimate-export, expenses, geocoding, global-lists, handovers, handover-templates,
list-bindings, notification-preferences, pilot-feedback, public-holidays, schedule-of-rates,
subcontractor-rates, surveys, tenants, tender-clarifications, tender-clients, win-likelihood.
[MEASURED] Positive control: sot/01 does mention `tendering`. Negative control: it does not mention
`zzz-not-a-module`.

**A10 — roadmap drift in sot/02, against live GitHub.** §2 is titled *"🔧 In-PR — open right now
(2)"* and tables **#895** and **#894**. Live: **#894 MERGED 2026-08-04T04:41:46Z**, **#895 MERGED
2026-08-04T05:09:13Z**, and `gh pr list --state open` returned **0** at the time of reading. Four
more PRs the section describes as in flight are also merged: #884 (08-03T22:39Z), #891
(08-04T03:19Z), #903 (08-04T06:14Z), #905 (08-04T19:28Z). [MEASURED] Both headline PRs merged
**within hours of the snapshot being written**. It has read false for **26 days**.

**A11 — CP-24, measured not assumed.** `scripts/pr-gates/pr-gates.mjs:326`:
`codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/`.
**`.github/` is code for CP-24 purposes**, so a `sot/` PR may not carry a workflow fix. This
constraint is what shaped F2's disposition. [MEASURED]

## WHAT CHANGED

**One doc-reconcile PR — #1405.** Four files, **+9 / −18**. `sot/` + `docs/` only, no `scripts/`,
no `apps/`, no `.github/` — **CP-24 PASS on the run** (`PR gates — diff checks` = SUCCESS). Opened
from a disposable worktree `C:\po-worktrees\sot-1411` off `origin/main`, never from the dev tree.

`docs/qa/sot-refs-baseline.json` — **23 entries → 14.** Nine deleted, `_readme` rewritten.
Line-based edit, so the diff is a pure deletion (`1 10`), not a reformat.

Eight lines across three `sot/` files gained an inline `<!-- sot-ref-allow: <reason> -->` marker
(9 references; `sot/04:4467` carries two on one line):

| file:line | reference | why it is exempt, not debt |
|---|---|---|
| `sot/03-progress-log.md:7437`, `:7464` | `xero-import-report.md` | gitignored, `.gitignore:86` |
| `sot/04-data-model.md:9` | `relationship-map.md` | gitignored, `.gitignore:128` |
| `sot/04-data-model.md:4467` | `qa-checklist.md`, `qa-findings.md` | gitignored, `.gitignore:107-108` |
| `sot/04-data-model.md:4482` | `qa-checklist.md` | gitignored, `.gitignore:107` |
| `sot/06-active-specs.md:1197` | `pr-dashboard-gantt-heatmap-widgets-HOLD.md` | consumed queue prompt |
| `sot/06-active-specs.md:1199` | `pr-dashboard-rename-copyfrom-HOLD.md` | consumed queue prompt |
| `sot/06-active-specs.md:3094` | `needs-marco/pr-188-authz-findings.md` | gitignored, `.gitignore:82` |

**Read back in the clean worktree off `origin/main`:** `total=274 dangling=0 exempt=9 baselined=14
excluded=2`, **exit 0**, identical on a second consecutive run. [MEASURED]

**Not one curated byte moved.** `git diff --numstat`: `sot/03` 2/2 · `sot/04` 3/3 · `sot/06` 3/3 —
every touched line is a modify-in-place of a line that already carried the reference. No line added,
none removed, no prose rewritten. [MEASURED]

**A tenth entry, `sot/README.md:190` → `graphify-out/GRAPH_REPORT.md`, was deliberately LEFT
BASELINED and its marker reverted.** It is the last element of the array, and F2 explains why that
matters.

## FINDINGS

### F1 — The sot-refs burn-down floor of 8 was not a floor. It had a door. → **ACTIONED**

The baseline's own `_readme` asserted **"THE BURN-DOWN FLOOR IS 8, NOT 0"**, and Station 00 has been
carrying that as a standing hard limit: 8 entries point at targets gitignored *by design*, so the
`sot/` reference is CORRECT and deleting the entry converts a baselined exemption into a hard CI
failure on every PR. The reasoning was sound; the conclusion was wrong, because it assumed deletion
was the only move.

`ALLOW_COMMENT_RE = /<!--\s*sot-ref-allow:\s*(.+?)\s*-->/` at `check-sot-refs.mjs:154` is tested
against **the line of the `sot/*.md` file itself** and `continue`s at `:239` — **before** the
path-class check (`:242`) and **before** `existsSync` (`:258`). A marker on the line therefore clears
the reference without the target existing anywhere. Because it lives inside `sot/`, only Station 05
can write one.

**Verified with a matched control pair, not by reading the source:**

- **NEGATIVE CONTROL** — delete the entries, write no markers → `dangling=10 exempt=0 baselined=13`,
  **exit 1**, and the 10 FAIL lines are exactly the 10 targeted. This is simultaneously the positive
  control that the checker *can* fail on this corpus.
- **THEN** — add the markers → `dangling=0`, **exit 0**, twice, identical.

Classification was measured per target: `git check-ignore -v` on the **file** (§9.2 — on a
*directory* it prints nothing and exits 1, which reads as "not ignored") plus
`git cat-file -e origin/main:<path>`. Controls: `docs/pr-prompts/processed/anything.md` →
`.gitignore:76` (ignored, correct); `sot/README.md` → exit 1 (not ignored) and `cat-file` exit 0
(on main). 8 of the 10 are gitignored-by-design; the other 2 are consumed queue prompts that
`EXCLUDED_PATH_CLASSES` misses because its pattern is `-ready\.md`-only and these are `-HOLD.md`.

**Why the marker and not a prose edit (RULE 1).** It is **line-drift-proof**, where a baseline entry
is keyed on `sot_file` + `line` + `missing_path` and silently becomes a hard CI failure the moment
anything is inserted above it in an append-heavy file like `sot/03-progress-log.md` — a live
time-bomb under the 14 remaining entries. And it destroys nothing: at `sot/03:7437` the prose
literally reads *"(…xero-import-report.md, gitignored)"*. The reference is right; the checker is the
blind party. Rewriting a true line to satisfy an instrument is the wrong direction.

Landed as 9 of 10, for the reason in F2. Baseline `_readme` rewritten to carry the mechanism, both
control results, and both traps.

### F2 — The `sot-refs ratchet` CI step rejects the burn-downs it exists to encourage. → **DISPATCHED → Station 00**

**PR #1405's first push went red, and the red was NOT the checker.** In the same job
(`Pipeline — watcher + linter tests`, run **33316687892**), `check-sot-refs.mjs` printed
`total=274 dangling=0 exempt=10 baselined=13` / *"All sot/ references resolve"*. The failing step is
the next one, `sot-refs ratchet — baseline may only shrink`, whose entire test is:

```bash
if git diff "origin/main" -- docs/qa/sot-refs-baseline.json | grep '^+.*"missing_path"'; then
  echo "::error::docs/qa/sot-refs-baseline.json gained a new entry..."; exit 1
fi
```

It counts **added diff lines**, not entries. `entries` is a JSON array, so **deleting the LAST
element forces the new last element to drop its trailing comma** — a pure punctuation change that
the diff renders as one `-` line and one `+` line, and the `+` line contains `"missing_path"`. CI
named it exactly:

```
+    { "sot_file": "sot/06-active-specs.md", "line": 3943, "missing_path": "modules/tendering/tender-client-notes.controller.ts", "recorded": "2026-08-28" }
##[error]docs/qa/sot-refs-baseline.json gained a new entry. The baseline may only SHRINK.
```

That entry is not new. It is the pre-existing second-to-last entry, promoted to last. **A PR that
removed ten entries was rejected for gaining one.** DOCTRINE §7's shape precisely: a confident,
coherent, wrong verdict about a healthy change — and it fires on *every* burn-down that touches the
tail, which is every burn-down that ever finishes.

**Reproduced locally with a control pair before I changed anything:** running the exact CI grep
against my own tree returned **1** matching line (the same one CI named), then **0** after the
workaround. [MEASURED]

**Why I did not fix it myself.** The fix is in `.github/workflows/ci.yml`, and A11 measured CP-24's
`codeRe` as including `\.github\/` — a `sot/` PR carrying a workflow change is a hard block with no
escape hatch. Station 05 may also only open **doc-reconcile** PRs (STATION-CAPABILITIES §5), so a
standalone workflow PR is outside my lane in two directions.

**What I did instead, and it is a workaround, not a cure:** burn the nine **interior** entries and
leave `sot/README.md:190` — the last array element — baselined, so no surviving line's text changes
and the ratchet sees zero `+` lines. Verified: `0` matches, `check-sot-refs` exit 0. The `_readme`
now carries the rule *"until that step counts entries instead of '+' lines, NEVER delete the last
element"*, so the next 05 run does not rediscover this at the cost of a red PR.

**Station 00 — this is a one-step fix and it unblocks the last entry.** RULE 1 ordered:

- **(A) Compare entry sets, not diff lines.** Parse both sides and fail only if
  `new_entries − old_entries` is non-empty — e.g. `git show origin/main:<file>` and the working copy
  through `node -e`, comparing `sot_file|line|missing_path` triples. Solves it **immediately** (the
  false positive becomes impossible) **and in future** (formatting, reordering and comma churn can
  never fire it again), and **strengthens** the ratchet: the current grep also cannot see an entry
  added by *editing* an existing line, which set-comparison catches. **Passes both halves of RULE 1.**
- **(B) Loosen the grep to ignore `+` lines that also appear as `-` lines.** Cheaper, but fails the
  "future" half — it patches this one symptom and still counts lines, so the edit-an-existing-line
  hole stays open.
- **(C) Leave it and keep the never-delete-the-last-entry rule in the `_readme`.** Fails both. It is
  a rule a human must remember, enforced by nothing, guarding a trap that costs a full red CI run
  every time it is forgotten.

I recommend **(A)**. Dispatching rather than doing it, because it is a `.github/` change and CP-24
plus my lane both forbid it here. Once it is on main, the last entry is a one-line follow-up I will
take on the next 05 run.

### F3 — `sot/02` has said "In-PR — open right now (2)" for 26 days while zero PRs were open. → **ESCALATED**

Measured in A10: both tabled PRs merged 2026-08-04 hours after the snapshot was written, four more
"in flight" PRs in §3 are merged, and the open count was 0.

Not mine to auto-fix — the station brief puts *"roadmap STATUS semantics"* and *"curated prose in
sot/01/02/03/05/06"* on the NEVER-auto-fix list — and no other station may edit `sot/` at all, so it
cannot be dispatched sideways. It needs Marco, and **the question is not "should the table be
corrected"; it is "should this table exist".**

**RULE 1 — complete-and-additive first:**

- **(A) Replace §2's snapshot table with a pointer to the live instrument.** `sot/02` already says,
  three lines above the table, that `bring-up-to-speed.ps1`'s `[LIVE]` lines *"beat this table the
  moment it drifts"* — the document already knows the table is the weaker source. Deleting it and
  keeping the pointer fixes it **immediately** (the false claim is gone) and **in future** (a
  hand-maintained mirror of a live fact cannot re-rot if it does not exist), and damages nothing:
  every fact in it is recoverable from GitHub and from `03-progress-log.md`. **Passes both halves.**
- **(B) Correct the table to today's reality.** **Fails the "future" half** — true only until the
  next PR opens, and puts `sot/02` straight back on the 26-day drift curve.
- **(C) Leave it.** Fails both.

I recommend **(A)** and can land it as its own doc-reconcile PR on the next 05 run — say the word,
or say (B) if the historical snapshot is worth keeping. Not folded into this run's PR: S7 caps me at
one reconcile PR, and mixing a mechanical burn-down with a roadmap-prose rewrite would make the
rendered diff harder to review, which is the point of the doc-reconcile model.

### F4 — 31 of 81 API modules are absent from the `sot/01` module registry. → **DEFERRED**

Listed in full in A9. Report-only by the station brief (`sot/01`'s registry is curated prose), and
each entry is a judgement call: first-class module, sub-feature of a listed one, or dead.

**What makes it urgent:** `sot/01` is the document a new chat is told to read to learn the
architecture. A registry omitting `tenants`, `api-keys`, `cases` and `estimate-export` will send a
reader to design something that already exists. If the next 05 run finds the count has grown, or if
any missing module turns up in a design decision, this stops being deferrable. I propose named
batches — it is 05's lane, but it wants Marco's view on *what counts as a module* before I write
prose into `sot/01`.

### F5 — The dev tree under-reports sot-refs, and will keep doing so. → **DEFERRED**

`baselined=17` on the dev box vs `23` in a clean worktree at the same SHA — the trap the `_readme`
documents, reproduced. It shrinks with this PR (the entries that caused it are among the 9 now
exempt), but the *mechanism* survives: `existsSync` against a working tree will always be able to
see a local artifact CI cannot.

Not urgent: the cure is written in three places and the `_readme` now carries the re-confirmed
measurement. **What would make it urgent:** any station quoting a sot-refs number without saying
which tree it came from. The next 05 run should re-measure both and confirm they agree.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, staged no prompt.** 05 may do none of those. ARMED was 0 at the
  start of this run and 0 at the end. [MEASURED] I did not merge #1405 — that is 00's call.
- **Did not fix the ratchet step in `.github/workflows/ci.yml`.** CP-24 blocks it in a `sot/` PR
  (A11, measured at `pr-gates.mjs:326`) and a standalone workflow PR is outside 05's lane. F2 is the
  dispatch, with the fix specified.
- **Did not burn the 10th entry** (`sot/README.md:190`). Deleting the last array element is what
  triggers F2. It comes free once the ratchet is fixed.
- **No auto-fix of `sot/04`'s generated section** — it is not drifted (A6). The allowlisted re-merge
  had nothing to re-merge, so S2/S3/S4 never applied. I regenerated the map in the disposable
  worktree only to *obtain* the comparison, and committed with an explicit pathspec so the
  regenerated artifacts could not ride along.
- **No `docs/data-model/sweeps/2026-08-30.md`.** The older station brief asks for one; the canonical
  contract asks for exactly ONE breadcrumb and says the contract wins where they disagree. Two homes
  for one report is how "which copy is current" starts. This file is the report. **The brief's
  OUTPUT section should be corrected to match the contract** — flagging it rather than quietly
  ignoring it.
- **Did not touch the other 14 baseline entries.** Each is real debt about a deleted doc
  (`architecture-overview.md`, `continuation-log.md`, `module-build-log.md`,
  `Project-History-Sprints-1-to-12.md`, `Master-QA-and-Consolidation-Program-Plan.md`) or a moved
  source file (`tender-scope-drafting.service.ts`, `quote-pdf.builder.ts`,
  `tender-client-notes.controller.ts`). Applying the `sot-ref-allow` marker to any of them would be
  an abuse of it — it would convert real debt into a permanent exemption, which is exactly what the
  baseline exists to prevent.
- **Did not clear the 13 `[STALE]` `needs-marco/` escalations** the sweep lists — gitignored, not
  `sot/`, not my lane.
- **Did not touch** the watcher clone (`dirty=35`, Station 03's lane), the OAuth credential, or
  Station 00's worktree `C:\po-worktrees\sup-1410` / its PR #1404, which was open and merging while
  this run was in flight.
- **Azure / Entra / SharePoint: not touched, not read, not planned.**
