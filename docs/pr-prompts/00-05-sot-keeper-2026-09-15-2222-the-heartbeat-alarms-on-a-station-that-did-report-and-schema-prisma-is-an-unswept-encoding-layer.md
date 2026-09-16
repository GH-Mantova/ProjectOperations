# Station 05 — SoT Keeper | 2026-09-15T22:22Z–2026-09-15T22:5xZ

## GROUND

```
UTC            2026-09-15T22:22:01Z
origin/main    64053600            (fetched, then rev-parse)
dev tree       main @ 09ce4ffc     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run is not read-only.

**CATCH-UP: this run owes a day, and it is an OFF-CRON run.** `05`'s cron is `10 0 * * *`
Brisbane = **14:10Z**. `check-breadcrumb.mjs --freshness --station 05` read
`last 2026-09-14T14:11:00Z  32.2h ago  (cadence 24h)  ok` — the AGE, not the verdict, per the
station doc. **The 2026-09-15T14:10Z occurrence produced no breadcrumb anywhere** (depth 1: none;
`archive/`: newest is `00-05-sot-keeper-2026-09-14-1411-…`). This run fired at 22:22Z, eight hours
off its slot, and covers **both** the missed 2026-09-15 occurrence and today's. One sweep was
performed, not two — the audit is idempotent over a 32-hour window and nothing in `sot/` changed
between them — and that is stated rather than dressed up as two units of work.

The dev tree is **09ce4ffc**, behind `origin/main` **64053600**. Every binding document was read
after proving the working copy is byte-identical to `origin/main` for the paths that matter:
`git diff --numstat origin/main -- docs/pipeline/stations/05-sot-keeper.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/qa/sot-refs-baseline.json sot/` returned **EMPTY**
(§9.2: empty output is the real answer, and §9.2's "a ` M` on a behind-HEAD tree is not uncommitted
work" is why the read is against `origin/main` and not `HEAD`).

## WHAT I MEASURED

**[MEASURED] Not blind.** `start_process` shell `powershell.exe` → PID 2020, second shell PID 11832.
Desktop Commander present. This was a SIGHTED run.

**[MEASURED] vm-git-guard installed, and its last line quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`. **PASS.** No `git` was run through
the VM bridge against the Windows `.git` at any point in this run.

**[MEASURED] Sweep verdict: SAFE TO ACT.** `status-sweep.ps1` captured with `*>` and decoded
`utf16le` per §9.3 (the file opens `FF FE`; read as utf8 it is structureless).
`SWEEP COMPLETE 2026-09-15 22:22:52Z`. Section 0 positive controls both pass
(`gh CAN reach GitHub (saw merged PR #1970)`, `node runs`). Section 7:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**[MEASURED] Automation health (audit step 5).** `watcher node: RUNNING pid 20948` ·
`auto-restart wrapper: alive (1)` · `armed (*-ready.md): 0` · `main CI on 64053600: 4 success /
0 failed (trunk green)`. Heartbeat age 562 min with an empty queue is idle, not wedged. Two
orphaned worktrees under `C:/PR-Master/worktrees/` persist (one holds 1 uncommitted file); that is
Station 03's lane and already carries an open escalation
(`two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md`).

**[MEASURED] Audit step 1 — schema parse sanity.**
`node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (296 models, 69 enums, 493 edges)`, exit 0. Per the
2026-08-25 correction this is a PARSE gate, not a drift gate, and proves nothing about sot/04's
currency.

**[MEASURED] Audit step 2 — catalog validity.** `JSON.parse` of
`docs/data-model/metadata-catalog.json` → **valid**. No finding.

**[MEASURED] Audit step 3 — sot/04 drift, BOTH probes, per the 2026-09-14 correction.**
Header counts: sot/04 reads `Models: 296 | Enums: 69 | FK edges: 493 | Domains: 23`; a freshly
generated `relationship-map.md` reads `Models: 296 | Enums: 69 | Edges: 493 | Domains: 23`.
**MATCH.** Content comparison (the probe the correction says actually answers): sot/04 sliced
between `<!-- SOT04-GENERATED:BEGIN -->` and `<!-- SOT04-GENERATED:END -->`, the generated file
sliced from `## Table of Contents`, line endings normalised, the two **strings** compared (never
their lengths — §9.3) → `sot04_generated_section_chars=166641`,
`fresh_generated_section_chars=166641`, **`IDENTICAL=true`**. **sot/04 is CURRENT. No re-merge.**

> ⚠️ **This run does not exercise the 2026-09-14 correction's falsifying probe.** That probe asks
> for a commit where the header counts AGREE and the content DISAGREES. Here both agree, so the
> run is consistent with the correction and with its negation alike. It is neither evidence for
> nor against it, and must not be quoted as either.

**[MEASURED] Audit step 4 — ROADMAP DRIFT. See F1.**

**[MEASURED] Audit step 6 — model ↔ migration coherence, and my first instrument lied.**
A first pass reported `models_without_CREATE_TABLE=1  ScopeCard -> scope_cards`. **That was a false
positive in my own regex**, which demanded a double-quoted identifier: the real DDL is
`CREATE TABLE IF NOT EXISTS scope_cards (` — unquoted — at
`apps/api/prisma/migrations/20260516120000_scope_card_foundation/migration.sql:8`, with 14 files
naming `scope_cards`. POSITIVE control `CREATE TABLE "scope_waste_items"` resolved; NEGATIVE
control (a freshly minted needle) → 0. **Corrected result: 296 of 296 models have a backing
migration.** Recorded rather than quietly fixed, because the shape — a query that answered
confidently and wrongly about an absence — is §7's, and the available conclusion was a phantom
schema defect.

**[MEASURED] Audit step 7 — registry.** 81 API modules under `apps/api/src/modules/`; **28 are not
named anywhere in `sot/01-charter-and-architecture.md`** (`access-requests`, `admin-imports`,
`admin-settings`, `admin-users`, `agreed-records`, `ai-settings`, `api-keys`,
`bid-prioritisation`, `branding`, `client-quotes`, `comms-approvals`, `company-profile`,
`correspondence`, `estimate-export`, `geocoding`, `global-lists`, `handover-templates`,
`handovers`, `list-bindings`, `notification-preferences`, `pilot-feedback`, `public-holidays`,
`subcontractor-rates`, `surveys`, `tenants`, `tender-clarifications`, `tender-clients`,
`win-likelihood`). POSITIVE control `tendering` → present; NEGATIVE control → absent. **Report
only** — what the module registry is *for* is a spec judgement, not deterministic drift, so it is
not auto-edited. ⚠️ That count is STATE; re-measure it, never quote it.

**[MEASURED] RULE ZERO — local PASS vs the real CI conclusion. NO ENVIRONMENT DISAGREEMENT.**
`check-sot-refs.mjs` passes locally AND in CI. On `origin/main` `64053600` the job that carries it,
`Pipeline — watcher + linter tests`, is **success**. On `#1960`, where that same job is **red**, the
job log — read from **column 3** of the tab-separated output per §9.1, never by grepping whole lines
— shows `check-sot-refs` ran and `sot-refs ratchet: OK - 0 -> 0 baselined entries, no new
(sot_file, missing_path) pair. Self-test: 4 cases passed.` The red is a different step:
`##[error]apps/web/src gained a hard-coded colour literal` — the **hex ratchet**. That is
application code, outside this station's lane, and is reported, not touched.

**[MEASURED] The other two board reds are PARKED BY DESIGN, not work.** `#1971` and `#1967` each
show two failures — `Approval receipt (CP-26)` and `PR gates — diff checks` — and each carries
`labels=[do-not-merge]`. Per §9.4 that is CP-26 `[LABEL_PRESENT]`: two reds, one cause, only Marco
removes the label. Named here so the next reader does not chase them.

**[MEASURED] The `Process has finished execution` message fired once, and the §9.5 correction held.**
Shell 11832 reported termination mid-chain after a `gh run view --log` of 5286 lines. Guard (2) was
applied: the PID answered `PID11832-ALIVE` from `C:\ProjectOperations2` on the first try, and
draining the buffer with explicit offsets returned the chain's final marker `MARKER_JOBLOG` **and**
every line after it. **The statements ran; the READER returned early.** This is a confirming
instance of the 2026-09-14T20:3xZ correction (*"the output is pending, not absent"*), not of the
earlier unrun-statement reading — and my own first read of that buffer, taken before the download
finished, is exactly the premature read that manufactures the wrong conclusion.

## WHAT CHANGED

**Unit 1 — the missed 2026-09-15T14:10Z occurrence, and Unit 2 — today's, performed as one sweep.**

- `sot/02-roadmap-and-status.md` — section 2's **live snapshot only** refreshed
  (7 insertions / 7 deletions, one file, `git diff --numstat`). Verified before writing:
  `byte_delta_actual=179  expected=179  BYTE_DELTA_OK=true` (§9.3 — a read-back that only looks for
  what you wrote cannot see what you spilled); the replacement was built by **concatenation**, never
  `String.replace` with a replacement string; prefix and suffix asserted byte-identical either side
  of the replaced block (S3/S4); CRLF preserved; `READBACK_curated_note_intact=true`.
  **No roadmap STATUS semantics were changed.**
- This breadcrumb, committed **inside the PR that carries the change** — the preferred home, so
  nobody has to sweep it up.
- `docs/data-model/sweeps/2026-09-15.md` — the sweep report (tracked; `git check-ignore` exits 1 on
  it, against a POSITIVE control where `docs/qa/qa-findings.md` returns `.gitignore:116`).

**NOT changed, deliberately:** `docs/data-model/relationship-map.{md,json}` and
`metadata-catalog.json` were regenerated only inside the **disposable worktree**, to run the content
probe. `git diff --numstat` in that worktree lists **only** `sot/02-roadmap-and-status.md`, so no
generated artifact and no catalog shrink enters this PR. The station doc's standing warning about
`metadata-catalog.json` shrinking is therefore not triggered this run — and it is named here because
a silent non-occurrence reads the same as never having checked.

## FINDINGS

### F1 — sot/02's In-PR snapshot named five PRs, all five merged, and two of them merged INSIDE half an hour of the snapshot being taken

`sot/02` section 2 read *"In-PR — open right now (5)"* naming `#1823 #1824 #1825 #1826 #1827`,
stamped `2026-09-09T23:03Z`. **[MEASURED]** all five by `state` and `mergedAt` — never the `merged`
field of a list response (§9.4) — with a NEGATIVE control (`#999997` → `GraphQL: Could not resolve
to a PullRequest`, i.e. it fails loudly, so the probe is not fabricating rows):

| PR | state | mergedAt |
|---|---|---|
| #1823 | MERGED | 2026-09-11T02:57:48Z |
| #1824 | MERGED | 2026-09-10T02:20:31Z |
| #1825 | MERGED | **2026-09-09T23:13:23Z** |
| #1826 | MERGED | **2026-09-09T23:27:36Z** |
| #1827 | MERGED | 2026-09-10T00:00:44Z |

The live board at `2026-09-15T22:35Z` is `#1973 #1972 #1971 #1967 #1960` — **no overlap at all**.

🔴 **The number worth keeping is not "the table was six days stale". It is that `#1825` and `#1826`
merged 10 and 24 minutes after the snapshot was taken.** This table cannot be made correct by
refreshing it more often; it was wrong before the PR that refreshed it could merge. Its own curated
note already says a dated snapshot *"is still read as current by anyone who does not check the
date"*, and a prior 05 run titled its breadcrumb *"sot02's snapshot rotted again in one day"*. The
section's own pointer to `bring-up-to-speed.ps1` is the honest instrument; the table is a
convenience that has now been re-established as stale three times. **Whether section 2 should hold a
PR table at all is a roadmap-semantics question, i.e. Marco's, not this station's** — so the table
is refreshed (deterministic, snapshot-only) and the question is raised rather than answered.

**DISPOSITION: ACTIONED** (snapshot refreshed in this PR, verified by byte delta and read-back)
**and ESCALATED** (the design question below).

> **For Marco — should `sot/02` section 2 keep a live PR table?** RULE 1, complete-and-additive
> first:
> **(a)** Replace the table with the one-line pointer to `bring-up-to-speed.ps1` that already sits
> above it, and keep section 2 as *roadmap* state (which programs are in flight) rather than *board*
> state. Solves it immediately **and** in future — a table that cannot be stale — and damages no
> existing or future data entry, since the live answer stays one command away. **Passes both halves.**
> **(b)** Keep the table and refresh it every 05 run. Fails the *future* half: measured above, it can
> rot within ten minutes of the reconcile PR being written, so it is permanently wrong between runs.
> **(c)** Keep the table but stamp each row with its own `mergedAt`-checked date. Fails the *future*
> half more weakly than (b) and adds per-row work to every reconcile.

### F2 — the Pipeline heartbeat alarmed SILENT while Station 04 had reported three and a half hours later than the station it named

`Pipeline heartbeat` is **failure** twice on `origin/main` `64053600` (started `2026-09-15T16:41:54Z`
and `21:06:14Z`). The 21:06Z job log reads, verbatim:

```
[heartbeat] SILENT: NO station has reported for 14.4h (threshold 6h). Newest is station 00 at
2026-09-15T06:40:00Z. Either the scheduler is off, the machine is down, or the app is not running.
```

**[MEASURED]** `2026-09-15` breadcrumbs **on disk at depth 1: 12**. Tracked on `origin/main`:
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` filtered to `2026-09-15` → **8**. The
four untracked are `00-00-supervisor-…-0408-…`, `00-00-supervisor-…-blind-no-shell`,
`00-04-scanner-…-0000-blind-run-no-windows-shell` and **`00-04-scanner-…-1010-a-file-gate-outlived-
the-prompt-that-was-retired-for-being-stale`**. The newest **tracked** one is 00's `0640` — exactly
the file the alarm named. `check-pipeline-heartbeat.mjs` reads `const DIR = "docs/pr-prompts"` from
a fresh Actions checkout of `main`, so an uncommitted breadcrumb is invisible to it by construction.

⚠️ **The VERDICT was right and only the EVIDENCE was wrong, and saying otherwise would be the more
comfortable error.** Station 04 reported at **10:10Z**, so the true silence at 21:06Z was ~10.9h —
still well over the 6h threshold. The alarm should have fired. What is defective is its
`Newest is station 00 at 06:40Z` line, and the general property behind it: **a station that reports
into an uncommitted file is indistinguishable, to this alarm, from a station that did not run.**
That is the same shape DOCTRINE §9.5 already records for `.arming-log.txt` — *"NOTHING COMMITS THE
LOG ON PURPOSE"* — reached from a second direction, and the station contract's own line
(*"the breadcrumb is untracked until the next board PR commits it"*) is the mechanism.

This is Station 00's to close: `scripts/` and the board are its lane, not 05's.
**DISPOSITION: DISPATCHED → Station 00.** Handed over: the four untracked filenames above, the
tracked-vs-on-disk counts, the `const DIR` anchor, and the reading that the fix is *committing
breadcrumbs*, not loosening the threshold.

### F3 — `apps/api/prisma/schema.prisma` has carried 86 double-encoded sequences since 2026-08-12, and it is a layer no encoding sweep covers

**[MEASURED]** on BUFFERS, via `execFileSync` from node so no shell re-encodes the needle
(a first attempt with `git log -S` through PowerShell returned **0** against a POSITIVE control of
63 commits touching the file — the needle was mangled in argument transit, §9.1/§9.3):

- `origin/main` today: **86** instances of the double-encoded em dash `U+00E2 U+20AC U+201D`, the
  exact signature §9.3 names. **`U+FFFD` = 0** — so the file is *valid* UTF-8 with the wrong
  characters faithfully encoded, which is §9.3's *"invisible to a validity check"* case.
- **57 clean `U+2014` em dashes coexist** in the same file, so this is partial damage, not a
  whole-file misread.
- Introduced at **`7d655aa5`, 2026-08-12**; `d5bd4f58` (2026-07-24) and everything before it read
  **0**. On `main` for **34 days**.
- NEGATIVE control (a minted needle over the same buffer) → 0.

🔴 **And my own reader lied about the severity first.** An initial pass reported *96 triple-encoded*
sequences. Measured on buffers, `triple = 0` at `origin/main`: reading already-double-encoded bytes
and re-rendering them produced the `Ã¢â‚¬` form. **The file holds the double-encoded form only.**
Recorded because the available write-up was *"the schema is triple-encoded"*, which overstates a
real defect — and §7 costs are symmetric.

**Blast radius, bounded by measurement: 86 lines, 85 of them pure `//` comments and the 86th
(`schema.prisma` line 4173) a trailing comment after `method String?`. ZERO identifiers, `@map`
names, `@default` strings or enum values are affected**, which is why Prisma parses and CI's
`Data model — generator sanity` is green. It is documentation damage, not a schema defect.

⚠️ **The finding is the unswept LAYER, not the 86 characters.** `STATION-CAPABILITIES.md` §1 records
that PR #1465 put 203 damaged sequences into `.claude/agents/` and every encoding sweep missed them
*"because those are the layers this table named"*, concluding: **a layer that is not in the map does
not get swept.** `schema.prisma` is the next such layer. Controls run this same pass:
`sot/01` **0**, `sot/04` **0**, `sot/06` **0**, `CLAUDE.md` **0** — **`sot/` is clean**, which is the
only part of this that is mine.

`schema.prisma` is on this station's explicit NEVER-auto-fix list. **DISPOSITION: DISPATCHED →
Station 00**, to route to a development chat. Handed over: the commit `7d655aa5`, the count 86, the
comment-only blast radius, the buffer-based probe that works and the `git log -S` form that does
not, and the recommendation that the sweep corpus be widened rather than these 86 characters fixed
in isolation.

### F4 — this station missed its 2026-09-15T14:10Z occurrence, and the freshness detector said `ok`

Covered in GROUND. `--freshness` printed **`32.2h ago (cadence 24h) ok`** because it alarms only
past **2×** cadence — open escalation #23, and exactly the direction that hides a single missed
daily run. Nothing retries a lost occurrence; `lastRunAt` updates even when a run dies on turn one.
The station doc's own catch-up section records 2026-09-02 and 2026-09-03 dying on
`API Error: 529 Overloaded` before any instruction ran, and **two of 09-15's four untracked
breadcrumbs are titled `blind-no-shell` and `blind-run-no-windows-shell`** — so 09-15 was a bad day
across stations, not only for 05.

I cannot measure *why* my own occurrence did not fire: the failure would precede anything in this
file executing. **[CANNOT MEASURE]** the cause. What is measurable and is recorded: the occurrence
produced no breadcrumb in any home, this run covered it, and the detector reported `ok` throughout.

**DISPOSITION: DISPATCHED → Station 00**, as evidence for escalation #23 (the 2× rule) and
alongside F2, with which it shares a root: the pipeline's ability to notice its own silence depends
on artifacts nothing reliably commits.

## WHAT I DID NOT DO

- **Did not burn down a `sot-refs` baseline entry — there are none left.**
  `docs/qa/sot-refs-baseline.json` holds `entries.length = 0`, and
  `node scripts/pipeline/check-sot-refs.mjs` exits **0** with
  `total=275  dangling=0  exempt=20  baselined=0  excluded=2` /
  *"All sot/ references resolve. This is the boring, correct outcome."* Per the file's own TRAP 1, a
  local pass is not the CI answer, so this was re-run in a **clean worktree off `origin/main`** and
  returned the identical five numbers — and CI's own `sot-refs ratchet: OK - 0 -> 0 baselined
  entries` on `#1960` agrees from the third side. **The burn-down that has been this station's
  primary housekeeping obligation is COMPLETE.** `NO-OP: nothing to burn down.`
- **Did not re-merge sot/04's generated section** — the content comparison says it is already
  byte-identical to a fresh generation. Re-merging would have produced a no-op PR.
- **Did not touch `schema.prisma`, migrations, seeds, application code, the hex-ratchet violation on
  `#1960`, `metadata-catalog.json`'s business meaning, or curated prose in `sot/01/03/05/06`** — all
  on the NEVER-auto-fix list. Reported instead.
- **Did not arm and did not merge.** Not this station's authority, in any mode.
- **Did not touch the two orphaned worktrees under `C:/PR-Master/worktrees/`**, one of which holds
  an uncommitted file. Station 03's lane, and an open escalation already names them.
- **Did not clear, discharge or edit anything under `needs-marco/`.** The sweep tags many of them
  `[FILE]` and says outright that section 5 *cannot* decide staleness from a citation line.
- **Did not touch Azure, Entra or SharePoint.** Absolute.
