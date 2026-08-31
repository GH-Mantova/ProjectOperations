# Station 05 — SoT Keeper | 2026-08-31T14:11Z–2026-08-31T14:40Z

## GROUND

```
UTC            2026-08-31T14:11:52Z
origin/main    6e105076            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 6e105076     C:\ProjectOperations2   (index clean, 9 untracked, 0 staged)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.
SIGHTED: `start_process` shell `powershell.exe` succeeded on the first call. This was **not** a blind run.

Working copy currency: `git diff --stat origin/main -- docs/pipeline/` returned **empty** at `6e105076`,
so the three binding documents read from disk are byte-identical to `origin/main`. [MEASURED]

Sweep: `scripts/pipeline/status-sweep.ps1` @14:12:09Z → **SAFE TO ACT**, armed=0, watcher RUNNING,
0 git processes, no index.lock, no PR touched in the last 2 min. Section 0 positive controls both
`[LIVE]`. Re-run at 14:36Z immediately before the push (see WHAT CHANGED).

---

## WHAT I MEASURED

**Instrument controls first (DOCTRINE §7 guard 1).** Every negative result below has a matching
positive control, named inline.

| # | Claim | Provenance |
|---|---|---|
| 1 | `build-relationship-map.mjs --check` → `OK: 292 models, 68 enums, 482 edges`, exit 0 | [MEASURED] |
| 2 | `metadata-catalog.json` parses as valid JSON → `CATALOG_JSON_OK`, exit 0 | [MEASURED] |
| 3 | Generator is deterministic: run twice, `relationship-map.md` / `.json` / `metadata-catalog.json` all identical modulo `- Last updated:` (S2) | [MEASURED] |
| 4 | `metadata-catalog.json` did **not** shrink — `Buffer.compare(HEAD blob, disk) === 0`, 679192 bytes both sides. Not staged. | [MEASURED] |
| 5 | **sot/04 DRIFT**: header said `Enums: 66`, sha256 `b26240cf69d9`, last updated 2026-08-26. Fresh generator: `Enums: 68`, sha256 `221a543f55ce`. Two enums added since the last re-merge. | [MEASURED] |
| 6 | `check-sot-refs.mjs` before: `total=274 dangling=0 exempt=9 baselined=14 excluded=2`, exit 0 | [MEASURED] |
| 7 | CI ratchet is **no longer a grep** — `ci.yml:201-217` calls `scripts/pipeline/check-sot-baseline-ratchet.mjs`, which compares the SET of `(sot_file, missing_path)` pairs plus the entry COUNT and self-tests 4 cases every invocation | [MEASURED] |
| 8 | `graphify-out/` has **never been tracked** — `git log --oneline --all -- graphify-out` = **0** commits. POSITIVE CONTROL: same query on `sot/README.md` = **2**. Ignored at `.gitignore:134`; `git cat-file -e origin/main:graphify-out/GRAPH_REPORT.md` → exit 128 | [MEASURED] |
| 9 | **STEP 6 coherence CLEAN**: 292 models, all 292 carry `@@map`; 232 `migration.sql` files, 581333 bytes; models whose table never appears in any migration = **0**. CONTROLS: `present("users")=true`, `absent("zzz_no_such_table")=false` | [MEASURED] |
| 10 | **STEP 7 registry drift**: 81 dirs under `apps/api/src/modules`, **32** named nowhere in `sot/01`. CONTROLS: charter mentions `tendering`=true, `zzz-not-a-module`=false | [MEASURED] |
| 11 | **STEP 4 roadmap drift**: `sot/02` §2 "In-PR — open right now (2)" lists **#894** and **#895**; both **MERGED 2026-08-04**. Actual open PRs: **#1450**, **#1443**. `sot/02` stamps `Last updated: 2026-08-04` — 27 days stale | [MEASURED] |
| 12 | **STEP 5 automation health GREEN**: watcher `PID 32916`, command line `...\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs` (resolved via `Get-CimInstance Win32_Process`, never by image name); auto-restart wrapper alive; newest `processed/` write `2026-08-31 13:45Z` (`rev-1451-ready.md.log`), 3682 files | [MEASURED] |
| 13 | LIVE schedule (scheduled-tasks MCP, **not** the `Scheduled\` folders): 00 every 2 h · 04 every 4 h · 05 daily · 03 daily 09:01 · `weekly-security-audit` **DISABLED**, last ran 2026-08-18. **No `02-board-driver` and no `06-pr-master` task exists.** | [MEASURED] |
| 14 | **RULE ZERO — no ENVIRONMENT DISAGREEMENT.** Local passes (`check-sot-refs`, ratchet, `lint-station`, generator `--check`) match CI: main trunk `3 success / 0 not-success`; #1450 and #1443 each `13 pass / 0 fail / 0 pending` | [MEASURED] |
| 15 | Modules registry / roadmap drift are **judgement calls**, explicitly outside the auto-fix allowlist | [INFERRED] from `05-sot-keeper.md` "NEVER auto-fix" list |

**Not measured, and why:** the 32 unregistered modules were not individually assessed for whether each
*should* be in `sot/01` — that is curated content and outside my allowlist. `[CANNOT MEASURE]` in this
run: whether `weekly-security-audit` is disabled deliberately; only Marco knows.

---

## WHAT CHANGED

One doc-reconcile PR, opened from a disposable worktree off `origin/main`
(`C:\po-worktrees\sot-05-20260831` @ `6e105076`, torn down at end of run). **Nothing armed, nothing
merged.** CP-24: the PR touches `sot/` + `docs/` only — no `scripts/`, no `apps/`.

1. **`sot/04-data-model.md` — generated section re-merged.** `+10 / -8`.
   Header bullets refreshed (`Enums: 66 → 68`, sha `b26240cf69d9 → 221a543f55ce`), and the region
   between `<!-- SOT04-GENERATED:BEGIN -->` and `:END` replaced from a freshly generated
   `relationship-map.md`. Content delta: two new enums (`CommThreadKind`, `InteractionChannel`) and
   three field-count/dimension updates (`RateTable` 16→17, `CommThread` 11→12, `RelationshipNote` 10→11).
   - **S2** determinism: PASS (row 3 above).
   - **S3** section-scoped: curated region sha256(16) `4833c436f1c142f5` → `4833c436f1c142f5`, **IDENTICAL**.
   - **S4** no content loss: curated line count 1581 → 1581.
   - **S6** post-fix `--check`: exit 0.
   - Read back after write: `lines=5245`, `- Models: 292 | Enums: 68 | FK edges: 482 | Domains: 23`,
     curated sha unchanged.

2. **`sot/README.md` — two corrections at the graphify block.**
   - Line 185 claimed *"The repo ships a **committed** knowledge graph in `graphify-out/`"*. That is
     false against the repo (row 8). Rewritten to say the graph is **built locally**, is not committed,
     and is gitignored.
   - Line 190's `graphify-out/GRAPH_REPORT.md` reference now carries an inline
     `<!-- sot-ref-allow: ... -->` marker recording why the target can never resolve in CI.

3. **`docs/qa/sot-refs-baseline.json` — burned down 14 → 13, and retired a dead trap.**
   - The `sot/README.md:190` entry deleted (now `exempt=`, not `baselined=`).
   - The two `sot/04-data-model.md` entries **re-keyed** 4142→4144 and 4443→4445, because change (1)
     shifted every line below it by +2. See FINDING 2.
   - `_readme` **TRAP 2 retired**. It forbade deleting the last array element; its stated cause — a
     `grep '^+.*missing_path'` ratchet — was replaced by PR #1407 and no longer exists (row 7).
   - Verified after: `check-sot-refs.mjs` → `total=274 dangling=0 exempt=10 baselined=13 excluded=2`,
     exit 0. Ratchet against `origin/main`: `OK - 14 -> 13 baselined entries, no new pair. Self-test:
     4 cases passed`, exit 0.

4. **`docs/pipeline/stations/05-sot-keeper.md` — two edits, both outside the hash-gated canonical block.**
   - Dropped the hard-coded *"records 26 dangling references"* (real figure was 14).
   - Burn-down workflow now documents the `sot-ref-allow` alternative and adds the line-number re-key
     step (FINDING 2).
   - `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 7 docs clean`, exit 0.

5. **This breadcrumb**, committed inside the same PR (contract: best home).

**Not written:** `docs/data-model/relationship-map.{md,json}`, `relationship-graph.html` (gitignored)
and `metadata-catalog.json` (byte-identical to HEAD — deliberately not staged).

Sweep re-run immediately before the push, and `git diff --cached --name-status` inspected before the
commit (the dev tree's index is shared; the worktree's is not, but the check is cheap).

---

## FINDINGS

### FINDING 1 — `sot/04`'s generated section was 5 days and 2 enums stale
`Enums: 66` in the SoT master against `68` in the schema, since 2026-08-26. Exactly the deterministic,
regeneratable drift the allowlist exists for.
**ACTIONED** — re-merged under S2/S3/S4/S6, all four safeguards recorded above with their measurements,
and read back after write.

### FINDING 2 — `check-sot-refs.mjs` and its own ratchet disagree about whether a line number matters
`docs/qa/sot-refs-baseline.json` is keyed by `line`, and `check-sot-refs.mjs` matches it **exactly**.
`check-sot-baseline-ratchet.mjs` deliberately **excludes** `line` from its key. So any `sot/` edit above
a baselined reference silently invalidates the baseline while passing the ratchet.
**MEASURED this run:** the +2-line re-merge in FINDING 1 turned entries 4142/4443 into
`dangling=2, exit 1` instantly. Bumping them to 4144/4445 restored `dangling=0`. Nothing warns you, and
the failure surfaces only as a red CI check on a docs PR — the shape DOCTRINE §7 exists to catch.
**ACTIONED** — re-keyed this run, and the trap is now step 5 of the burn-down workflow in the station
doc so the next run does not pay for it again. (A structural cure — keying the baseline on
`(sot_file, missing_path)` like the ratchet already does — is `scripts/`-side and would break CP-24 in
this PR. Left for Station 06 to stage; see WHAT I DID NOT DO.)

### FINDING 3 — TRAP 2 in the baseline `_readme` outlived its cause by two days
The `_readme` forbade deleting the last baseline entry because the CI ratchet grepped diff `+` lines.
PR #1407 replaced that grep with a set-and-count comparison. The prohibition survived the fix and
parked entry 14 for a reason that no longer existed — and the same prose then miscounted itself
("the other 13" against `entries.length` 14). Third instance this week of a true statement of state
pasted into an instruction document.
**ACTIONED** — TRAP 2 rewritten to record what it *was*, what killed it, and an explicit
"do not write a count into this prose" rule. Entry 14 cleared with a marker, not a bare deletion,
because its target is structurally absent from `main`. Verified with both instruments, exit 0.

### FINDING 4 — `sot/02` §2 "In-PR — open right now" has been wrong for 27 days
It names #894 and #895, both merged 2026-08-04. The live board is #1450 and #1443. This same drift was
reported by this station on 2026-08-26 and is still here, because the section is a **hand-maintained
snapshot of live state inside a source-of-truth document** — it is structurally guaranteed to be stale
between reconciles, and re-typing today's two PR numbers would just restart the clock.
**ESCALATED** — Marco's call, because it changes what `sot/02` is for. RULE 1, complete-and-additive first:

- **(A) Replace the §2 table with a pointer to the live instrument.** `sot/02` §2 becomes one line:
  "open PRs are live state — run `scripts/pipeline/status-sweep.ps1` §1". Passes **both** RULE 1 halves:
  it fixes it immediately *and* forever (no snapshot can go stale if there is no snapshot), and it
  destroys no roadmap content — §3 Staged and the phase sections are untouched, and the header already
  points at `bring-up-to-speed.ps1` for exactly this reason.
- **(B) Re-type the current two PRs and re-stamp the date.** Fails the *future* half of RULE 1: it is
  wrong again the next time a PR opens, and it is the option that produced the 27-day gap.
- **(C) Leave it and rely on the "lags reality — verify live PRs" warning already in the project
  instructions.** Fails the *immediate* half: a reader who trusts the table is still misled today.

I did not act because roadmap STATUS semantics are on the station's explicit NEVER-auto-fix list.

### FINDING 5 — 32 of 81 API modules are named nowhere in `sot/01`'s registry
`access-requests, admin-imports, admin-settings, admin-users, agreed-records, ai-settings, api-keys,
authorization, bid-prioritisation, branding, cases, client-quotes, comms-approvals, company-profile,
correspondence, estimate-export, expenses, geocoding, global-lists, handover-templates, handovers,
list-bindings, notification-preferences, pilot-feedback, public-holidays, schedule-of-rates,
subcontractor-rates, surveys, tenants, tender-clarifications, tender-clients, win-likelihood`
(controls in row 10). Report-only: deciding which of these belong in a charter-level registry, and
under which module group, is curated judgement.
**DEFERRED** — becomes urgent the moment someone uses `sot/01`'s registry as an authority for what the
API contains; it is currently ~40% incomplete. The cheap complete-and-additive move is a single
doc-reconcile PR that appends the missing 32 under their existing groups, but it needs a human to
assign the groups. Also reported 2026-08-26 and unactioned since.

### FINDING 6 — `weekly-security-audit` is DISABLED on the live schedule
`enabled: false`, `lastRunAt 2026-08-18T08:18:52Z` — 13 days without a run, read from the
scheduled-tasks MCP (the only authority; the `Scheduled\` folder proves nothing).
**DEFERRED** — I cannot tell a deliberate pause from an accident, and re-enabling a task is not this
station's lane. Urgent if it turns out nobody disabled it on purpose.

### FINDING 7 — re-measurement, not new: `06-pr-master` still has no scheduled task
Fifth measurement. Already an open escalation; recorded here only so the count is honest.
Separately, `STATION-CAPABILITIES.md` §6 gives Station 03 a cadence of "4 h or manual" while the live
task is **daily at 09:01**.
**DEFERRED** — the 06 half is already with Marco; the 03 cadence line is a one-word docs fix that
belongs with whoever next edits that file, and bundling it here would widen a PR that is already
touching four areas.

---

## WHAT I DID NOT DO

- **Did not arm, did not merge, did not touch the board.** armed stayed `0`. #1450 and #1443 are both
  the watcher's/Marco's and are not this station's to touch under any circumstances.
- **Did not commit `metadata-catalog.json`.** It regenerated byte-identical to `HEAD`; the ` M` in
  `git status` is a line-ending stat artifact, proved by `Buffer.compare === 0`. The station doc warns
  this file *shrinks* on regen — this run it did not, and I checked rather than assumed.
- **Did not fix the roadmap or the module registry.** Both are curated prose on the NEVER-auto-fix
  list. FINDING 4 is escalated with options; FINDING 5 is deferred with the cheap fix named.
- **Did not touch `.github/workflows/ci.yml`**, whose comment at line 190 still says *"the 23
  pre-existing dangling references"* — a third stale copy of the same count. Editing it would mix
  `sot/` with workflow config in one PR; and `pr-gates.mjs:327` is the authority on CP-24, not my
  reading of it. **DISPATCHED → Station 06**, together with the structural cure for FINDING 2
  (re-key the baseline on `(sot_file, missing_path)` so `check-sot-refs.mjs` stops caring about line
  numbers). Both are `scripts/`/`.github/`-side and need their own non-`sot/` PR.
- **Did not convert the two `Master-QA-and-Consolidation-Program-Plan.md` entries to `sot-ref-allow`
  markers**, though the target is absent from `origin/main` and they are the obvious next burn-down.
  They sit in `sot/04`'s **curated** region, and touching it would have broken S3 for this run's
  re-merge. Next run, as a standalone PR.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so it
  reports drift unconditionally. The station doc says to ignore it and it was ignored.
- **Did not clear the 13 `[STALE]` escalation files** the sweep §5 flagged. Not this station's lane.
