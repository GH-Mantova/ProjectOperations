# Station 05 — SoT Keeper | 2026-09-09T22:02Z–2026-09-09T23:30Z

## GROUND

```
UTC            2026-09-09T22:02Z
origin/main    f482d1a5            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ f482d1a5     C:\ProjectOperations2  (fast-forwarded 2279d2d9 -> f482d1a5 this run)
doc version    1                   (station_doc_version, docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE**. SIGHTED run — Desktop Commander reached the box on the first
call after the schema load.

🔴 **CATCH-UP RUN. I owed the 2026-09-09T14:10Z occurrence and did it in this run.**
`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05` →
`05  last 2026-09-08T14:11:00Z  32.1h ago  (cadence 24h)  ok`. **Read as the AGE, not as the `ok`** —
32.1 h is more than one cadence, which is this station's own threshold. The missed date is
**2026-09-09 (the 14:10Z slot)**; see F1, which is why it was missed.

`[MEASURED]` **The VM git guard could NOT be installed, and this is a FINDING, not a stop.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never ran: the Linux sandbox
itself failed to come up —
`bash failed on resume, create, and re-resume … source path … is under Plan9 share "c" which is not
mounted`. **No VM existed to install a guard into, and consequently no VM-side call was made at any
point in this run.** The hazard the guard exists to remove (a 0-byte `index.lock` with no owning
Windows process) is therefore not reachable this run by construction. Every `git` command below ran
on the Windows host through Desktop Commander.

## WHAT I MEASURED

### Preflight — the three binding documents, read from the tree that matches origin/main

`[MEASURED]` The dev tree was **1 behind, 0 ahead** at start (`git rev-list --count HEAD..origin/main`
→ 1) and was fast-forwarded with `git merge --ff-only origin/main` → `Updating 2279d2d9..f482d1a5`,
exit 0. `[MEASURED]` All three binding documents then matched `origin/main` byte-for-byte by the sound
probe — `git diff --numstat origin/main -- <path>` **EMPTY** for
`docs/pipeline/stations/05-sot-keeper.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`. The piped-hash form (DOCTRINE §9.2, unsound in PowerShell)
was not used.

`[MEASURED]` `status-sweep.ps1` captured to a file (it returns early and hides its own §7 verdict),
366 lines, exit 0. §0 controls both pass. **§7 verdict: `CAUTION` — 2 LIVE STATION WORKTREEs**
(`C:/po-worktrees/docs-ea-gate-class`, `C:/po-worktrees/pr1823`). I obeyed it in the form it
prescribes: an **isolated** worktree, a **new** branch, a **new** PR, and I touched neither of theirs.

### Rule Zero — local PASS and CI PASS agree. No ENVIRONMENT DISAGREEMENT.

`[MEASURED]` Local: `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (296 models, 69 enums, 493 edges).` exit 0.
`[MEASURED]` CI, main @ `f482d1a59323a9195e4a95b2bf701bca73e9bc99` (full 40-char SHA — the short form
returns `[]`, DOCTRINE §9.4), via `gh api repos/.../commits/<sha>/check-runs`:
**`Data model — generator sanity (schema.prisma parses cleanly)` = `success`.** Same direction as
local, on the exact reading that Rule Zero exists to take and that the 2026-09-08 blind run had to
stamp `[CANNOT MEASURE]`.

⚠️ **TRUNK IS RED, but not on anything in my lane and not newly.** The same check-run listing gives
4 × `failure  Pipeline heartbeat` and 1 × `failure  Dependabot`; every substantive build/test/gate job
is `success`. `[MEASURED]` `Pipeline heartbeat` is already reported — 2 hits across
`docs/pr-prompts/00-0*.md` and 1 in `docs/pr-prompts/needs-marco/` (POSITIVE control `heartbeat` → 32;
NEGATIVE control, freshly minted `zzQq05Needle20260909T2230` → 0). **Recorded as movement; deliberately
not re-filed.**

### The generator DOES normalise line endings before hashing — and that explains yesterday's sha

`[MEASURED]` `scripts/data-model/build-relationship-map.mjs:523-524` reads
`const normalized = text.replace(/\r\n/g, '\n');` then `createHash('sha256').update(normalized)`.
The station brief's CAUTION asks this to be verified before committing a regenerated artifact; it is
verified, so a Windows-side regeneration is CI-safe.

⚠️ **This also disposes of an apparent contradiction that would otherwise read as a schema change.**
`schema.prisma` on disk is CRLF. Its raw-bytes sha is `ad5bc3b0931c`; its LF-normalised sha is
`83ad3df361bd`. The 2026-09-08 blind run recorded `ad5bc3b0931c` and this run's generator stamped
`83ad3df361bd` — **the same file, two hashing conventions, not two schemas.** Model/enum/edge counts
were `296 | 69 | 493` on both days, which is the corroborating control.

### Audit 2 — catalog VALID, and it did not shrink this run

`[MEASURED]` `JSON.parse` → `CATALOG_OK bytes=690682 topkeys=4`, exit 0. After a full generator run in
the worktree, `git diff --numstat -- docs/data-model/metadata-catalog.json` is **EMPTY** — byte-identical
to `origin/main`. The station brief warns that regenerating shrinks this tracked file and has aborted a
slice before; **it did not happen today**, and it is deliberately not in the commit.

⚠️ The dev tree shows ` M docs/data-model/metadata-catalog.json` in `git status`. `[MEASURED]` that is a
**line-ending smudge only** — `git diff --numstat origin/main -- <path>` is EMPTY, with git's own
`LF will be replaced by CRLF` warning on the same line. DOCTRINE §9.2's status-vs-numstat bullet,
confirmed on a tree that is now level with `origin/main` rather than behind it.

### Audit 6 — model ↔ migration coherence: 0 mismatches, with both controls

`[MEASURED]` 296 models, 245 migration dirs, 301 distinct `CREATE TABLE` names.
`models_with_NO_backing_CREATE_TABLE=0`; `created_not_dropped_with_NO_live_model=0`.
POSITIVE control `tender_reminder_policy` present = **true**; NEGATIVE control
`zzQq05Table20260909` = **false**. (The `IF` artefact the 2026-09-08 run reported was its regex
capturing `CREATE TABLE IF NOT EXISTS`; filtered out here rather than re-reported as a table.)

### Audit 7 — module registry: unchanged at 30 of 81, deliberately not re-filed

`[MEASURED]` `apps/api/src` has 6 top-level dirs, **0** absent from `sot/01`. One level deeper,
**30 of 81** modules under `apps/api/src/modules/` are absent from `sot/01`. That was 32 on 09-05,
31 on 08-26, 30 on 09-08 — flat. POSITIVE/NEGATIVE controls both correct. Filed three times already
and DEFERRED; the number is movement, not a new finding.

### Primary housekeeping obligation — nothing left to burn down

`[MEASURED]` `docs/qa/sot-refs-baseline.json` `entries.length = 0`. `check-sot-refs.mjs` before my
edits: `total=276  dangling=0  exempt=20  baselined=0  excluded=2`, exit 0. **The baseline burn-down
is complete and stayed complete.** After my edits it reads `total=275` — one fewer reference, because
the `sot/01` fix removed a prompt citation (F3).

### Live schedule, read from the scheduled-tasks MCP (the prescribed source)

`[MEASURED]` `05-sot-keeper` cron `10 0 * * *`, `lastRunAt 2026-09-09T22:01:58.050Z`,
`nextRunAt 2026-09-10T14:10:37Z`, jitter 37 s. `04-scanner` cron `0 */4 * * *`,
`lastRunAt 2026-09-09T22:01:57.495Z`, jitter 571 s. `00-supervisor` `5 * * * *`, `lastRunAt
2026-09-09T23:08:49Z`. `03-machine-minder` `0 9 * * *`, `lastRunAt 2026-09-09T23:01:42Z`. Five enabled
tasks, `weekly-security-audit` among them. See F1.

## WHAT CHANGED

**Two dated units of work, in one run — the missed 2026-09-09 occurrence and this one — plus one
escalation file.**

1. **PR #1828 opened** — `docs(sot): re-merge the 296-model schema map and refresh the sot/01 NAV-5
   and sot/02 In-PR snapshots`, branch `docs/sot-reconcile-2026-09-09`, from a disposable worktree at
   `C:\po-worktrees\sot-reconcile-20260909` off `origin/main` @ `f482d1a5`. Commit `60d96dec`.
   `[MEASURED]` `git show --name-only --format="" HEAD` = exactly
   `sot/01-charter-and-architecture.md`, `sot/02-roadmap-and-status.md`, `sot/04-data-model.md` —
   **nothing else swept in from the shared index.** `sot/`-only, so CP-24 is satisfied by construction.
   `[MEASURED]` body read back from GitHub: 81 lines, backticks intact, the S3 sha present, negative
   control absent.
   - **S1** ✅ no commit on `main`, nothing armed, nothing merged.
   - **S2** ✅ generator run twice: `catalog_identical=true`, `map_identical_modulo_stamp=true`.
   - **S3** ✅ `MERGED SOURCES` region sha256 `d5f505615d88a806` before **and** after;
     `tail byte-identical=true`.
   - **S4** ✅ curated line count `1598` → `1598`.
   - **S5** ✅ scope cap held (see the file list above).
   - **S6** ✅ post-fix `--check` → OK exit 0; `check-sot-refs.mjs` → `dangling=0` exit 0.
   - **S7** ✅ no prior reconcile PR open (board was #1823–#1827; none is a reconcile).
2. **`docs/pr-prompts/needs-marco/github-projectops-mcp-auth-header-rejected-2026-09-08.md` written**
   — the second consecutive failure of that server, which is the bar the 2026-09-08 run set for
   escalating it. See F5.
3. **This breadcrumb**, at `C:\ProjectOperations2\docs\pr-prompts\`.

⚠️ **This breadcrumb is UNTRACKED and is deliberately NOT in PR #1828.** Keeping that PR `sot/`-only
is what keeps it unambiguously inside the one lane `STATION-CAPABILITIES.md` §5 grants Station 05 and
what keeps 00's *"docs-only and `sot/`-only"* merge authority applicable to it without argument. The
cost is that Station 00 must sweep this file up; that is the trade, stated rather than hidden.

**Nothing else changed anywhere.** No prompt was staged, retired, armed or moved. No PR was merged. No
label was touched. `sot/` was edited only inside the disposable worktree.

## FINDINGS

### F1 — a scheduler gap swallowed three occurrences, and the catch-up fired 04 and 05 **555 milliseconds** apart

`[MEASURED]` From the scheduled-tasks MCP: `04-scanner` `lastRunAt 2026-09-09T22:01:57.495Z` and
`05-sot-keeper` `lastRunAt 2026-09-09T22:01:58.050Z` — **0.555 s apart**, and neither at its own
jittered slot (04's is `:09:31`, 05's is `14:10:37Z`).

`[MEASURED]` The breadcrumb corpus dates the gap. Station 04 on 2026-09-08 filed at 02, 06, 10, 14, 18
and 22 — a complete set. On 2026-09-09 it filed at `02:22:50Z`, `06:21:13Z`, `10:21:21Z`, **then
nothing until `22:22:35Z`**: the `14:09Z` and `18:09Z` occurrences are absent. Station 05's `14:10Z`
occurrence is absent over the same window. **One outage window of roughly 10:30Z–22:00Z, three lost
occurrences across two stations, then both stations restarted inside the same second.**

🔴 **This is not the collision already on file, and it changes what the open cron-offset escalation
must ask for.** `STATION-CAPABILITIES.md` §6 records 00/04/05 landing within **165 seconds** and
prescribes *"an offset of at least ten minutes"*, later corrected to *"two offsets, not one"*. Both of
those reason about **cron minutes**. `[INFERRED]` What happened here did not come from a cron minute
at all — the two tasks fired together because they were both being caught up after a gap, and **a
catch-up burst is not something a cron offset can separate.** A ten-minute offset between 04 and 05
would have produced exactly the same 0.555 s collision today.

⚠️ **And the detector could not see it.** `check-breadcrumb.mjs --freshness --station 05` printed
**`ok`** at 32.1 h, because it alarms only past 2× cadence. That is open escalation #23's exact
failure mode, observed live on a day when a whole occurrence was genuinely lost.

**DISPOSITION: DISPATCHED → Station 00.** It owns COLLECT and it owns the cron-offset escalation this
amends; the remedy is Marco's (the schedule lives in the scheduled-tasks layer, not this repo), so 00
should fold *"an offset cannot de-collide a catch-up burst"* into that escalation rather than open a
new one. **Falsifying probe:** read `lastRunAt` for 04 and 05 from the MCP after any occurrence that
follows a missed one; if they are more than a few seconds apart, this finding is wrong.

### F2 — sot/04's generated section was two schema commits behind. **ACTIONED.**

`[MEASURED]` Header read `Models: 294 | Enums: 69 | FK edges: 491 | Domains: 23`, stamped
`2026-09-07 14:17 UTC` at schema sha `1c87e9c6ca95`. Live schema is **`296 | 69 | 493`** at
`83ad3df361bd`. The missing models are `TenderReminderPolicy` and `TenderReminderLog`, landed in
**#1767**; `schema.prisma` also moved in **#1796**. Re-merged section-scoped between the
`SOT04-GENERATED:BEGIN/END` markers; `git diff --numstat` = `31  12  sot/04-data-model.md`.
`[MEASURED]` read-back: `- Models: 296 | Enums: 69 | FK edges: 493 | Domains: 23`, both new models
present, `MERGED SOURCES` seam present and byte-identical.

⚠️ **A clean `--check` neither caught this nor could have** — it returns before writing and only proves
`schema.prisma` parses. It was green locally and green on main's push CI for the whole two days
`sot/04` was stale. That correction now holds for a third consecutive run.

**DISPOSITION: ACTIONED** — PR #1828, verified by the read-backs and safeguards quoted above. Carried
from the 2026-09-08 blind run's F2, which correctly DEFERRED it.

### F3 — the sot/01 NAV-5 paragraph asserted the opposite of its own file, and its citation was pinning a prompt retirement. **ACTIONED.**

`[MEASURED]` `sot/01-charter-and-architecture.md:454-458` read *"**Groups 1-6 and FIELD are NOT yet
reconciled** … there is no CRM group. That reconcile is NAV-5, staged at
`docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`"*. SECTION 9 of the same file, ninety
lines above, lists groups **1–8** including `TENDERING` and `CRM`. The reconcile shipped in **#1810**,
merged 2026-09-08T05:15Z.

🔴 **The falsifying probe the 2026-09-08 run named has been RUN, and it passes.** With the prompt file
renamed away, `check-sot-refs.mjs` on the reconcile branch prints
`total=275  dangling=0  exempt=20  baselined=0  excluded=2`, **exit 0** — where before the edit the
same removal is what made #1817 back out its retirement. The file was restored immediately;
`git status` in the worktree shows no deletion.

⚠️ **My own read-back tripped §9.6 and I am recording it.** The scripted check
`old_gone = !text.includes("Groups 1-6 and FIELD are NOT yet")` returned **false** — because my
replacement prose *quotes the old claim* in order to date it. The probe measured the documentation,
not the world; the diff (`11  4`) and the reference count (276 → 275) are the readings that answer.

🔴 **Reviewer-facing caveat, stated in the PR body too:** this is **curated `sot/01` prose**, which my
own brief classes report-only. It is shipped because every clause is refuted by the same document plus
a merged PR — no judgement is exercised — and because it arrived as an explicit dispatch into this lane
from #1817's author. It is the hunk to drop if Marco disagrees.

**DISPOSITION: ACTIONED** (the `sot/` edit) **+ DISPATCHED → Station 00 / 06** (the consequence):
`docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` is still at depth 1, still lints as a
candidate, and still describes work that shipped in #1810. **Retiring it is board mutation and is not
Station 05's** — but it is now unblocked, and the probe above is the proof. Do it once #1828 merges.

### F4 — sot/02's In-PR table rotted again inside 24 h. **ACTIONED; the loop stays DISPATCHED, not re-dispatched.**

`[MEASURED]` §2 was headed `In-PR — open right now (4)` naming `#1777 #1775 #1774 #1767` — **all four
merged**. The five genuinely open PRs (`#1823`–`#1827`) appeared nowhere. Provenance line read
`2026-09-07T14:21Z`. Refreshed live from `gh pr list`, snapshot only; no roadmap STATUS semantics
touched.

⚠️ **The datum that is new is the count: this is the fourteenth consecutive 05 run to spend time on
this table.** Yesterday's run could not refresh it at all because it was blind, and today's refresh was
already stale-by-construction the moment `#1828` itself opened — the table cannot name the PR that
edits it. A generated block with a CI check is correct with nobody present; a hand-refresh is correct
for a few hours and only when this station is sighted.

**DISPOSITION: ACTIONED** (today's rot). **The loop remains DISPATCHED → Station 00 from 2026-09-07 —
markers `SOT02-INPR:BEGIN/END`, generate from `gh pr list`, `--check` in `pipeline-tests` — and is
deliberately NOT re-dispatched here.** This is explicitly not a reopening of the roadmap-semantics
escalation Marco ruled on 2026-09-06.

### F5 — the `github-projectops` MCP failed to connect for the second consecutive scheduled run. **ESCALATED.**

`[MEASURED]` This session:
`plugin:github-projectops:github-projectops (400): "Error POSTing to endpoint: bad request:
Authorization header is badly formatted"` — the identical string the 2026-09-08 run recorded. The
generic GitHub MCP and `gh` both worked throughout, so GitHub access as such is healthy and nothing in
this run was blocked by it.

The 2026-09-08 run set the bar explicitly: *"If it fails twice, it needs
`needs-marco/github-projectops-mcp-auth-header-rejected-2026-09-08.md` and Marco's eyes."* It has
failed twice. ⚠️ **I am NOT claiming this is the `cowork-projectops` PAT expiry** — that is dated
2026-09-30 and this is a header-format rejection, not an expiry — only that a credential question is
category 4 on DOCTRINE §5's list and belongs with Marco before the two get confused.

**DISPOSITION: ESCALATED.** `docs/pr-prompts/needs-marco/github-projectops-mcp-auth-header-rejected-2026-09-08.md`
written this run, keeping the filename the prior run named so the two entries join up. A finding whose
subject is outside the repo and has no `needs-marco/` file is escalated to nobody.

## WHAT I DID NOT DO

- **I did not merge anything, arm anything, or remove any label.** Station 05 never arms and never
  merges. PR #1828 was opened without auto-merge and waits for a human.
- **I did not touch the two live station worktrees** the sweep's §7 CAUTION named, nor the two open
  PRs behind them (`#1823`, `#1824`), nor any of `#1825`–`#1827`. None is a `sot/` reconcile and none
  is mine.
- **I did not retire `pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`**, although this run is what
  unblocks it. Moving a prompt is board mutation and sits outside my authority row.
- **I did not commit `docs/data-model/metadata-catalog.json`.** It regenerated byte-identical, so
  there was nothing to commit; the ` M` in the dev tree is a line-ending smudge, measured.
- **I did not run the RULE 2 `marco:true` probe.** This run merges nothing, so there is no merge
  decision for it to gate. Saying so rather than quoting a number I had no use for.
- **I did not re-file `Pipeline heartbeat`** (already in 2 breadcrumbs + 1 `needs-marco/` file) **or
  the 30-of-81 module-registry gap** (three prior filings, DEFERRED). Both recorded as movement only.
- **I did not run `build-toc.mjs --check` against `sot/`.** No `sot/` file carries TOC markers, so it
  reports drift unconditionally.
- **I did not write `docs/data-model/sweeps/2026-09-09.md`.** The station brief still orders it and the
  canonical contract above it in the same file replaced it with this breadcrumb; writing both would
  resolve that conflict by duplication. It is the 2026-09-07 run's F3, still DEFERRED.
- **I did not run any `git` command against a mounted path from a VM.** There was no VM this run —
  the Linux sandbox failed to start, which is recorded in `## GROUND` rather than passed over.
