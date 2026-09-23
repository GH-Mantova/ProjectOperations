# Station 05 — SoT Keeper | 2026-09-23T14:23Z–2026-09-23T14:40Z

## GROUND

```
UTC            2026-09-23T14:23Z
origin/main    7207606e            (fetched, then rev-parse; advanced from 4421531f mid-run when #2122 merged)
dev tree       main @ 7207606e     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run was READ-WRITE within Station 05's lane.

Tree read in: **the dev tree** `C:\ProjectOperations2`, never the watcher clone. Work done in a
disposable worktree `C:\po-wt\s05-20260923-1423` off `origin/main`, branch
`docs/sot04-remerge-20260923`.

**Not blind.** `start_process` shell `powershell.exe` answered on the first call and every
subsequent one. This was a sighted run.

## WHAT I MEASURED

**Device-bridge git guard — installed, INERT, exit 2 (the expected station outcome).**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
from the installer itself and not from a pipeline appended to it:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Per the contract this is a FINDING, not a STOP. Every `git` call in this run was made through
PowerShell on the Windows host; no `git` was run through the device bridge against the mount.

**The three binding documents are current in the working copy.** [MEASURED] per PREFLIGHT step 2,
using `git rev-parse origin/main:<path>` against `git hash-object <path>` and
`git diff --numstat origin/main -- <path>` — never a piped hash (§9.1):

| file | origin/main blob | worktree blob | numstat |
|---|---|---|---|
| `docs/pipeline/stations/05-sot-keeper.md` | `7c35df75…` | `7c35df75…` | EMPTY |
| `docs/pipeline/DOCTRINE.md` | `28aff566…` | `28aff566…` | EMPTY |
| `docs/pipeline/STATION-CAPABILITIES.md` | `f2ecfe0c…` | `f2ecfe0c…` | EMPTY |

All three read in full from the copy proved identical to `origin/main`.

**Sweep verdict: CAUTION.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured with `*>` and
decoded **utf16le** (§9.3 — the raw capture opens `FF FE`; read as utf8 it is structureless):

```
==================== 7. VERDICT ====================
  [LIVE] CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
  [LIVE]    C:/po-wt/bd-00-20260923-1420
```

A Station 00 board-driver worktree was live. CAUTION permits acting in an **isolated worktree on
NEW branches/PRs only**, which is exactly and only what this run did. `index.lock` False in both
trees; scoped git processes 0; no PR touched in the last 2 min.

**No missed occurrence.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness
--station 05` → `05 last 2026-09-22T14:23:00Z 24.1h ago (cadence 24h) ok`. Reading the AGE and not
the verdict, per the catch-up rule: 24.1 h is exactly one cadence, so this is a normal daily gap and
**no day is owed**. Cross-checked against the scheduled-tasks MCP: `05-sot-keeper` `enabled: true`,
`lastRunAt 2026-09-23T14:22:41Z` — this run.

**Automation is healthy.** [MEASURED] watcher resolved by PID **and command line**, never by image
name (§9.5):

```
WATCHER pid=9744  started=2026-09-20T21:14:06Z
   cmd="C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
node.exe total on box: 19
```

Nineteen `node.exe` running; exactly one is the watcher. Auto-restart wrapper alive. Clone
`branch=main dirty=0`. Newest `docs/pr-prompts/processed/*.log` is `rev-2122-ready.md.log` at
**14:31:09Z** — minutes old. Scheduled-tasks MCP: four tasks `enabled: true` (`00` `5 * * * *`,
`03` `0 9 * * *`, `04` `0 */4 * * *`, `05` `10 0 * * *`), `weekly-security-audit` `enabled: false`.
Live task list read from the MCP, not enumerated from any document. **Nothing is dead.**

**Rule Zero — no ENVIRONMENT DISAGREEMENT.** Every local check below was crossed against the real
CI conclusion. `gh run list --commit 7207606ef40aeff17f3593a984e2f1d476a8e00b` (full 40-char SHA,
`-R` passed, `$LASTEXITCODE` tested — §9.4) returns `CI`, `Deploy`, `CodeQL` and
`Tendering Browser Smoke` with **empty conclusions**, i.e. still running on a just-merged commit —
`[CANNOT MEASURE]` a conclusion, and specifically **not** a red. The sweep's own trunk read at
14:24Z on the predecessor `4421531f` was `4 success / 0 failed (trunk green)`. Board: **0 open PRs**.

**AUDIT 1 — schema parse sanity.** [MEASURED] `node scripts/data-model/build-relationship-map.mjs
--check` → `OK: generator ran cleanly against schema.prisma (297 models, 70 enums, 498 edges)`,
exit 0. Per the 2026-08-25 correction this proves only that `schema.prisma` parses; it is **not**
a drift gate and is not treated as one below.

**AUDIT 2 — catalog validity.** [MEASURED] `docs/data-model/metadata-catalog.json` parses as valid
JSON, 731,322 bytes, 4 top-level keys. **Not** the four-sweep silent-corruption case.

**AUDIT 2b — the tracked catalog is CURRENT, and the byte shrink is line endings exactly.** This is
a clean live re-confirmation of the station doc's 2026-09-21 correction, taken by generating into a
throwaway tree so the dev tree was never touched. [MEASURED]: tracked **731,322** B vs regenerated
**702,251** B, delta **29,071** — and the tracked file's CRLF count is **29,071**, equal to the
delta to the byte. Parsed: **297 models → 297**, 0 added, 0 removed, **0 of 297 entries differing**,
and the two buffers are **identical after CRLF normalisation**. The correction's falsifying probe
was run and it did not fire. **The catalog was therefore left untouched** — judging it by byte count
is what the correction exists to prevent.

**AUDIT 3 — sot/04 drift. BOTH probes, not one.** The header-count check is structurally blind to
field-level drift (2026-09-14 correction), so the content comparison was run as well.

*Header counts* — freshly generated `297 | 70 | **498** | 23` against sot/04's header
`297 | 70 | **497** | 23`. **FK edges disagree by one.**

*Content* — sot/04 sliced between `<!-- SOT04-GENERATED:BEGIN -->` and `<!-- SOT04-GENERATED:END -->`,
the generated map sliced from `## Table of Contents`, both CRLF-normalised, **strings compared, never
their lengths** (§9.3):

```
sot generated section chars: 167735
gen body chars            : 167971
IDENTICAL: false
first divergence at char 16159
  sot: ... estimating --> tendering\n  forms --> assets ...
  gen: ... estimating --> tendering\n  estimating --> unclassified\n  forms --> assets ...
```

sot/04 was stamped `2026-09-22 14:29 UTC`, schema sha256 `f06a485c0fcb`; the live schema is
`765369a06fc8`. **One schema change stale** — `#2114` (scopecards S9 transport capacity matrix,
merged 2026-09-23T11:53Z) added the edge. Deterministic, regeneratable, allowlisted: FIXED, below.

**AUDIT 4 — roadmap drift, and it is total.** sot/02 §2 read *"In-PR — open right now (5)"* and
named five PRs from a snapshot taken 2026-09-21T14:25Z. [MEASURED] per-PR via `gh pr view <n>
--json number,state,mergedAt,closedAt` — reading `state`/`mergedAt`, **never the `merged` field of
a list response** (§9.4):

| PR | state | mergedAt |
|---|---|---|
| #2051 | MERGED | 2026-09-21T20:32:06Z |
| #2049 | MERGED | 2026-09-21T20:12:37Z |
| #2047 | MERGED | 2026-09-21T20:48:55Z |
| #2044 | MERGED | 2026-09-21T19:56:09Z |
| #2042 | MERGED | 2026-09-21T19:29:45Z |

NEGATIVE control `gh pr view 999997` → exit **1**. POSITIVE control `gh pr list --state open` →
exit 0, **OPEN_COUNT = 0**. **Five of five rows wrong, and the whole table wrong within six hours
of being written.**

**AUDIT 5 — automation health:** above. Healthy.

**AUDIT 6 — model ↔ migration ↔ code coherence. Three probes, and one of them lied.**

- *6a — every model has a backing migration.* [MEASURED] 297 models, all 297 carrying `@@map`;
  265 migration directories, 664,750 B of combined SQL, 302 tables CREATEd. Models with **no**
  backing `CREATE TABLE`: **0**.
- *6b — migration tables with no live model.* First reading: **5** —
  `user_ai_providers`, `user_ai_preferences`, `subcontractor_contacts`, `leads`, and `IF`.
  🔴 **That reading was my instrument, not the world, and all five are false.** `IF` came from my
  own regex mis-capturing `CREATE TABLE IF NOT EXISTS scope_cards` (unquoted identifier + CRLF), and
  the other four were each CREATEd once and **DROPped once** by a later migration — retired by
  design. [MEASURED] per table: `user_ai_providers CREATE=1 DROP=1` · `user_ai_preferences
  CREATE=1 DROP=1` · `subcontractor_contacts CREATE=1 DROP=1` · `leads CREATE=1 DROP=1`.
  **The true answer is 0.** Written down because §7's whole thesis is that this is the expensive
  shape: five confident, coherent, wrong findings were one write-up away.
- *6c — models referenced by `apps/api/src` that do not resolve.* [MEASURED] 279 distinct
  `prisma.<prop>` references; 8 unresolved, and on inspection all eight are ordinary identifiers
  (`_state`, `_tx`, `delete`, `module`, `service`, `store`, `update`, `where`), not model
  references. **Genuine unresolved model references: 0.**

**AUDIT 7 — module registry.** [MEASURED] `apps/api/src/modules` holds **81** directories;
**16** are not named anywhere in `sot/01-charter-and-architecture.md`: `access-requests`,
`admin-imports`, `agreed-records`, `api-keys`, `bid-prioritisation`, `comms-approvals`,
`company-profile`, `correspondence`, `estimate-export`, `handover-templates`, `list-bindings`,
`pilot-feedback`, `subcontractor-rates`, `tenants`, `tender-clients`, `win-likelihood`.
POSITIVE control `tendering` → present; NEGATIVE control, a freshly minted needle → absent.
⚠️ That count is STATE — re-measure it, never quote it.

**sot-refs baseline: fully burned down.** [MEASURED] `docs/qa/sot-refs-baseline.json`
`entries.length` = **0**. `node scripts/pipeline/check-sot-refs.mjs` → exit 0,
`total=275 dangling=0 exempt=20 baselined=0 excluded=2`, *"All sot/ references resolve. This is the
boring, correct outcome."* This station's primary housekeeping obligation has **nothing left to
burn down**; the count is read from `entries.length` and is not written into any instruction.

**A `build-toc` reading that was the documentation, not the world.** `grep -l "TOC:START" sot/*.md`
returned **1** file, which reads as *"the station doc's claim that no sot/ file carries TOC markers
is now false"*. It is not: the single hit is `sot/05-decisions-and-lessons.md` **quoting the rule
itself** — §9.6's closing rule, that a document describing a marker contains a literal instance of
it. No sot/ file carries real markers and the station doc's instruction stands. Separately,
`scripts/pipeline/build-toc.mjs` does not exist at that path (`MODULE_NOT_FOUND`), so the
instruction names a script that is not there — noted, not filed.

## WHAT CHANGED

**One doc-reconcile PR, from a disposable worktree off `origin/main`. Two files, both under
`sot/`. Nothing armed, nothing merged, no label touched.**

Worktree `C:\po-wt\s05-20260923-1423`, branch `docs/sot04-remerge-20260923`, created off
`origin/main` at `7207606e`. `schema.prisma` blob verified **identical** across `origin/main`, the
dev tree working copy and the worktree (`fac875ff…` on all four reads), so the map generated in the
throwaway tree is valid for the worktree.

**1. `sot/04-data-model.md` — generated section re-merged.** `+16 / −12`.

Safeguards, all satisfied and all read back:

| | result |
|---|---|
| **S1** never on main, never merged; PR opened from a disposable worktree | ✅ |
| **S2** generator run TWICE, outputs byte-identical modulo `Last updated` | ✅ `deterministic: true` |
| **S3** curated MERGED SOURCES region sha256 before/after | ✅ `d5f505615d88a806` = `d5f505615d88a806` |
| **S4** curated line count must not decrease | ✅ 1581 → 1581 |
| **S5** scope cap — only `sot/` touched | ✅ 2 files, both `sot/` |
| **S6** post-fix `build-relationship-map.mjs --check` | ✅ exit 0 |
| **S7** no reconcile PR pending from a prior run | ✅ board was 0 open PRs |

Read-back: `READBACK_IDENTICAL_TO_GENERATED=true`; header now
`- Models: 297 | Enums: 70 | FK edges: 498 | Domains: 23`; stamp now `2026-09-23 14:28 UTC`, schema
sha256 `765369a06fc8`. Bytes 292,217 → 292,460. CRLF preserved — the `+16/−12` numstat is the
content change and not a line-ending rewrite.

**2. `sot/02-roadmap-and-status.md` — §2 snapshot refreshed.** `+5 / −10`. The five-row table naming
five merged PRs was replaced with the measured state: the board is empty. Read-backs: new heading
present, old heading gone, and each of `#2051 #2049 #2047 #2044 #2042` confirmed **absent** from the
section. Curated tail after the table byte-identical (`20ff615e737579f3` both sides). **No roadmap
STATUS semantics were changed** — only the snapshot.

**CP-24:** the PR is `sot/` + `docs/` only. No `scripts/`, no `apps/`. Split before opening, not
after CI said so.

This breadcrumb is written **inside the PR's own worktree**, so it lands with the change it
describes and needs nobody to sweep it up (report-contract cure 1). Nothing was left in the dev tree
and nothing in the session's `outputs` folder.

## FINDINGS

**F1 — sot/04's generated section goes stale on every schema change, and a daily station is the
only thing repairing it.** Measured above: one schema change (`#2114`) behind, FK edges 497 against
a true 498. This is the third consecutive 05 run to find and fix the same class — the 2026-09-21
and 2026-09-22 breadcrumbs both carry it in their titles. The repair is deterministic and
allowlisted, so fixing it is correct; but the *recurrence* is the observation, and the additive
half of RULE 1 would be a CI check that fails when sot/04's generated section does not match a
fresh generation. That is a `scripts/` change and therefore outside this station's lane.
**DISPOSITION: ACTIONED** (the drift, this run, verified by S2–S6 and a read-back) **and
DISPATCHED → Station 00** (the recurrence: a `scripts/` gate is 00's to stage, not 05's to write).

**F2 — sot/02's In-PR table named five MERGED PRs against an empty board, and this is the FIFTH
consecutive refresh by this station.** Measured above: 5 of 5 rows wrong, the whole table falsified
within six hours of the snapshot it carried. The table's own prose already records the previous
four refreshes (09-06, 09-17, 09-21T00:20Z, 09-21T14:25Z) and already states the conclusion:
*"this table cannot be kept true by a daily station."* That finding was filed for Station 00 on
2026-09-21 and the structural fix has not landed. RULE 1, applied:

- **Complete and additive — a generated table or a CI check that fails when a PR named in sot/02 is
  no longer open.** Solves it immediately and permanently, and damages no existing or future data
  entry — the roadmap's curated STATUS semantics are untouched, only the live-board rows become
  machine-maintained. **This is the option to take.** It is `scripts/` and therefore **not
  Station 05's to write**.
- *Refresh the snapshot again* (what this run did). Passes the immediate half, **fails the future
  half** — it was wrong 14 hours after the 09-21 refresh and will rot again on the next merge.
  Taken only so that sot/ does not sit asserting five open PRs against an empty board in the
  meantime.
- *Delete the table and point at `bring-up-to-speed.ps1`.* Passes the future half, **fails the
  immediate half** — it removes a reader's at-a-glance answer to *"what's next on the pipeline?"*,
  which §2 exists to give, and it is a judgement about roadmap semantics, which this station never
  auto-edits.

**DISPOSITION: ACTIONED** (snapshot refreshed, this run) **and ESCALATED → Marco**, because after
five refreshes the evidence that refreshing does not work is conclusive and the choice between a
generated table and a CI gate is a design decision. The question for him is one line: *should sot/02
§2 become generated, or should a CI check fail the PR when it names a PR that is no longer open?*

**F3 — a raw NUL byte in `apps/api/src/modules/field/field.service.ts` makes that file invisible to
every `grep -r` over the API source.** [MEASURED] the file holds exactly **one** `0x00` byte, at
offset 50,780, inside a template literal used as a composite sort key:
`` `${workerName.toLowerCase()}\0${row.date.toISOString()}` ``. It is a **real NUL in the source
bytes**, not the two-character escape. Consequences measured: `grep` reports
`binary file matches` and `grep -rIL "" apps/api/src --include=*.ts` returns this file and **only**
this file — 1 of the entire tree. Verified clean otherwise: **0** `U+FFFD`, **0** occurrences of the
CP1252 double-encode signature, so this is **not** the §9.3 encoder damage; it is deliberate code
with an undeliberate side effect. The cost is a §9.6-shaped blind spot in the instrument this
pipeline uses most: any station sweeping `apps/api/src` with `grep` silently omits a 52 KB service
file, at exit 0, with nothing warning. The one-line fix is to write the separator as an escape
(`\u0000`) rather than a literal byte, which changes no runtime behaviour. `apps/api` is outside
Station 05's lane and CP-24 forbids shipping it beside `sot/`.
**DISPOSITION: DISPATCHED → Station 00**, to stage as its own non-`sot/` PR.

**F4 — sixteen of eighty-one API modules are absent from sot/01's module registry.** Listed under
WHAT I MEASURED, with both controls. Registry completeness is curated prose and a judgement about
what belongs in the charter — never auto-edited by this station. It is real: a registry that omits
20% of the modules is not a registry a reader can trust. It is not urgent: nothing is broken and no
gate depends on it. **What would make it urgent:** anyone using sot/01 to answer *"does this system
have a module for X?"* and getting a false negative.
**DISPOSITION: DEFERRED.**

**F5 — the device-bridge git guard installs INERT (exit 2), so the ban is remembered, not
mechanical.** Quoted verbatim under WHAT I MEASURED. This is the contract's documented expected
outcome for a station shell, and the contract says it is a finding rather than a stop. Recorded so
the count of occurrences stays visible: DOCTRINE §9.2 records this ban having failed seven times
while it was remembered. No station-side action exists — the installer writes its `PATH` export to
`~/.bashrc` and `~/.profile`, and a station's shell is non-interactive and non-login, so it sources
neither. **DISPOSITION: DEFERRED** (it would become urgent the moment a run leaves a 0-byte
`index.lock` in either tree, which freezes every station).

**F6 — the sot-refs baseline is fully burned down and this station's primary housekeeping
obligation is now empty.** `entries.length` = 0, `check-sot-refs.mjs` exit 0 with `dangling=0
baselined=0`. Nothing to fix and nothing to escalate; recorded because the station doc calls this
*"your primary housekeeping obligation"* and the next reader should know the list is at zero rather
than assume a run skipped it. The `exempt=20` inline `sot-ref-allow` markers remain and are correct
— each was placed for a target that is structurally absent from `origin/main` by design.
**DISPOSITION: ACTIONED** (verified complete; no work required).

## WHAT I DID NOT DO

- **Did not merge, did not arm, did not touch a label.** Station 05 never arms and never merges,
  and the PR opened by this run is left for the board.
- **Did not regenerate `docs/data-model/metadata-catalog.json`.** Measured current — byte-identical
  to a fresh generation after CRLF normalisation, 0 of 297 entries differing. Touching it would have
  put a 29,071-byte line-ending-only diff on the board, which is the precise mistake the station
  doc's 2026-09-21 correction records as having aborted a slice.
- **Did not touch `docs/data-model/relationship-map.{json,md}`.** Gitignored by design; the fresh
  generation was done in a throwaway tree and the dev tree's copies were never written.
- **Did not fix `field.service.ts` (F3) or the sot/02 structural rot (F2).** Both are `apps/` or
  `scripts/` changes. CP-24 hard-blocks a PR mixing `sot/` with either, with no escape hatch, and
  neither is in Station 05's authority row. Split before opening, not after CI says so.
- **Did not edit sot/01's module registry (F4).** Curated prose and a judgement call; this station
  reports those rather than auto-editing them.
- **Did not clear the orphaned worktree `C:/po-wt/s9hex`** (detached HEAD, 490 min old, dirty=0)
  that the sweep flags. Worktree hygiene is Station 03's and only on 00's dispatch.
- **Did not act on the live Station 00 worktree** `C:/po-wt/bd-00-20260923-1420`. The sweep's
  CAUTION was obeyed: isolated worktree, new branch, new PR, nothing shared touched.
- **Did not run `build-toc.mjs --check` against `sot/`**, per the standing instruction — and did not
  file the one `TOC:START` hit as drift, because it is the rule quoting itself.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing this run needed came near them.
