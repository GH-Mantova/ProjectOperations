# Station 05 — SoT Keeper | 2026-09-22T14:23Z–2026-09-22T15:0xZ

## GROUND

```
UTC            2026-09-22T14:23:24Z
origin/main    58a53a11  (at preflight; MOVED to 304e41b6 at 14:4xZ mid-run — see F5)
dev tree       main @ 58a53a11   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE** — this run was not read-only on that account.

**NOT BLIND.** Desktop Commander answered on the first call after `ToolSearch` loaded the schemas;
`start_process` shell `powershell.exe` returned `main / 58a53a11 / 2026-09-22T14:23:24Z`. Stated
explicitly because Station 04's occurrence 12 minutes earlier **was** blind — its breadcrumb is
`00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md` — so "no news" from this
station today is a healthy quiet run and not the other thing.

**Missed-occurrence check: NONE OWED.** `node scripts/pipeline/check-breadcrumb.mjs --freshness
--station 05` → `05 last 2026-09-21T14:11:00Z 24.2h ago (cadence 24h) ok`. Read as the AGE, not the
verdict: 24.2 h is one cadence, not two, so yesterday's occurrence fired and this is today's. One
dated unit of work in WHAT CHANGED, not two.

**Binding documents read in full from a tree proved current.** `git diff --numstat origin/main --
<path>` returned EMPTY for `DOCTRINE.md`, `STATION-CAPABILITIES.md` and
`stations/05-sot-keeper.md`, so the working copy is byte-identical to `origin/main` and reading it
locally is sound (DOCTRINE §9.3 — content comparison, never a piped hash, never a size).

## WHAT I MEASURED

**Device-bridge git guard — exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
installer itself and not from a pipeline appended to it:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

This is the EXPECTED station outcome per the contract, not an anomaly: a finding, not a stop. No
`git` was run against the mount at any point in this run; every git call went through PowerShell on
the Windows host.

**Preflight sweep — SAFE TO ACT.** `scripts/pipeline/status-sweep.ps1`, captured to a file and
decoded (the capture is UTF-16LE — DOCTRINE §9.3), `SWEEP_EXIT=10`, generated 2026-09-22 14:24:28Z:

| sweep line | value |
|---|---|
| §0 instrument controls | `gh CAN reach GitHub (saw merged PR #2086)` · `node runs` — both PASS |
| §1 open PRs | **0** |
| §1 main CI on `58a53a11` | 4 success / 0 failed — trunk green |
| §2 watcher node | RUNNING **pid 9744** |
| §3 `index.lock` dev/clone | False / False · git processes touching our trees: **0** |
| §4 armed (`*-ready.md`) | **0** |
| §7 VERDICT | **SAFE TO ACT** |

Watcher confirmed by PID **and command line**, never by image name (audit step 5):
`pid=9744  "C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`.

**Audit step 1 — schema parse sanity.** [MEASURED] `node scripts/data-model/build-relationship-map.mjs --check`
→ `OK: generator ran cleanly against schema.prisma (297 models, 70 enums, 497 edges)`, exit 0. Per
this station's own 2026-08-25 correction this is **not** a drift gate and proves only that
`schema.prisma` parses; it is recorded as such and carries no weight in F1 below.

**Audit step 2 — catalog validity.** [MEASURED]
`node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` → `CATALOG_JSON_OK`,
exit 0. Valid JSON. No finding.

**Audit step 3 — sot/04 drift. BOTH probes run, and both fired.** See F1.

**Audit step 4 — roadmap drift.** [MEASURED] `sot/02-roadmap-and-status.md` is 242 lines; its
`## 2. 🔧 In-PR — open right now (5)` heading claims **5** open PRs against a live board of **0**
(`gh pr list -R GH-Mantova/ProjectOperations --state open --json number` → `[]`, exit 0, `-R` passed
per DOCTRINE §9.4's CWD bullet). Line 107 already records that the 2026-07-27 In-PR set has merged.
This is curated status prose, which this station may not auto-edit. See F4.

**Audit step 5 — automation health.** Watcher alive (above). Live task list read from the box, not
enumerated from any document: the only task matching this project is **`PO Watcher Keepalive`**,
`state=Ready`, `lastRunTime=2026-09-23 00:25:01` (local), **`LastTaskResult=267014`**. [MEASURED]
`'{0:X}' -f 267014` → `0x41306` = `SCHED_S_TASK_TERMINATED`. See F3. Newest logs under
`docs/pr-prompts/processed/` (dev tree, never the clone — DOCTRINE §9.5): `rev-2087-ready.md.log`
2026-09-22T14:31:08Z, `rev-2084-ready.md.log` 12:35:54Z — minutes old, so the lane is producing.

**Audit step 6 — model ↔ migration ↔ code coherence. CLEAN.** [MEASURED] over
`apps/api/prisma/schema.prisma` and all **260** `migration.sql` files (662,016 bytes):

| probe | result |
|---|---|
| models in schema | **297**, of which **0** lack an `@@map` |
| distinct tables created in migrations | 302 |
| models with **no** backing `CREATE TABLE` | **0** |
| tables created with no live model | 5 raw → **0 real** (below) |
| POSITIVE control `"tenants"` present in migration SQL | true |
| NEGATIVE control, a freshly minted needle | false |

All five raw "orphans" were run down rather than reported: `user_ai_providers`,
`user_ai_preferences`, `subcontractor_contacts` and `leads` each measured `creates=1 drops=1` — a
later migration drops them, so they are not orphans; and the fifth, **`IF`**, was **my own regex**
matching `CREATE TABLE IF NOT EXISTS` (22 occurrences), i.e. an instrument artefact and not a fact
about the repo. Recorded here rather than in FINDINGS because a lead is not a finding.

**Audit step 7 — registry.** [MEASURED] `apps/api/src/modules` holds **81** directories; **24** are
not named anywhere in `sot/01-charter-and-architecture.md` (POSITIVE control `tendering` → present;
NEGATIVE control, a freshly minted needle → absent). See F2, and note the scoping there — this is a
candidate list, not 24 proven gaps.

**RULE ZERO — local PASS cross-checked against real CI, not asserted.** Every local check above
passed; the corresponding CI state was read from GitHub rather than inferred. With **0 open PRs**
there are no PR-side check runs to read, so the cross-check is trunk-side only:
`gh run list -R GH-Mantova/ProjectOperations --commit <full 40-char SHA>` (full SHA per DOCTRINE
§9.4 — the short form answers `[]` at exit 0). **No ENVIRONMENT DISAGREEMENT found.** At preflight,
`58a53a11` read 4 success / 0 failed. Re-derived at 14:4xZ the head had moved to `304e41b6` and its
five runs read `skipped` (Claude Code, `issue_comment`) plus four with `conclusion: ""` — **still
running, which is not red**; DOCTRINE §9.5 records that the sweep's own trunk verdict counts every
run attributed to the head and has flipped a green board to `TRUNK IS RED` on a Dependabot row, so
the aggregate is not quoted here.

## WHAT CHANGED

One dated unit of work: **2026-09-22 (today's occurrence)**. No catch-up day was owed.

**One doc-reconcile PR, section-scoped, `sot/` + `docs/` only (CP-24-clean).** Prepared in a
disposable worktree off `origin/main` at `C:\po-worktrees\sot05-20260922`, branch
`sot/reconcile-2026-09-23-sot04-regen`. The dev tree was never committed to and never edited.

Files changed: **`sot/04-data-model.md` only** — `git diff --numstat` → `12  9  sot/04-data-model.md`.

The safeguards, each asserted BEFORE the write and read back after it:

| safeguard | reading |
|---|---|
| S2 determinism — generator run TWICE | `.md`, `.json` and catalog all **identical** modulo the `Last updated` stamp |
| wrapper positive control | reconstructing the OLD generated block from its own trimmed body returned it **byte-exactly**, so the marker wrapper is proved, not assumed |
| S3 curated prose (lines 1–13) sha256 | unchanged |
| S3 MERGED SOURCES region sha256 | `d5f50561…` **before and after**, and the suffix slice is byte-identical |
| S4 curated line count | 1599 → **1599** |
| marker uniqueness | exactly one BEGIN, exactly one END, after the write |
| byte delta asserted, not just presence | `EXPECTED_CHAR_DELTA=207` == `ACTUAL_CHAR_DELTA=207`; file 292,010 → 292,217 B |
| read-back | `READBACK_EQUALS_INTENDED=true` · `READBACK_GEN_MATCHES_FRESH=true` · `READBACK_SUFFIX_BYTE_IDENTICAL=true` |
| S6 post-fix validation | `build-relationship-map.mjs --check` → OK, exit 0; `check-sot-refs.mjs` → `dangling=0`, exit 0 |

The edit was made in **node**, building the result by **concatenation** and never by
`String.replace` with a replacement string (DOCTRINE §9.3 — `$&` and `` $` `` are live in a
replacement string and once injected 7,734 bytes into one line), and the byte delta was asserted
rather than merely looking for what was written.

**`docs/data-model/metadata-catalog.json` was regenerated and NOT committed, because its CONTENT did
not change.** [MEASURED] 297 models → 297, 0 added, 0 removed, **0 of 297 model entries differing**,
and `EQUAL_AFTER_CRLF_NORMALISE=true`. `git diff --numstat` reports it as unchanged.

🔴 **AND MY FIRST READING OF THIS FILE WAS AN INSTRUMENT ERROR, CAUGHT MID-RUN — RECORDED BECAUSE
THE MISTAKE IS MORE USEFUL THAN THE RESULT.** I first compared `git show HEAD:<path>` (**699,946** B)
against the regenerated working copy (**699,946** B), read `delta=0` and `TRACKED_CRLF_COUNT=0`, and
wrote that this worktree's checkout is LF and that the AUTHORITY section's 2026-09-21 CRLF-shrink
correction *"did not reproduce here at all"*. **Both halves were wrong.** `git show` returns the
**blob**, which is LF by definition; the **checkout** is CRLF. I had compared LF against LF across
the very boundary DOCTRINE §9.3 forbids comparing across, and the agreeing number told me nothing —
that bullet's own warning, *"a size comparison that AGREES proves nothing either"*, describes it
exactly.

**What the sound measurement says.** [MEASURED] on the working copy itself, both sides of the same
boundary: regenerated **699,946** B with **28,981** LF and **0** CRLF; re-written as CRLF to match
the checkout, **728,927** B, delta **+28,981** — precisely the file's own line count. **So the
2026-09-21 correction reproduces exactly as written** (its figure was 28,787 at an older commit);
the shrink is line endings and not one byte of content, and nothing about it is worktree-specific.

⚠️ **The tell was not any of my read-backs — it was `git rebase` refusing on "unstaged changes"
for a file `git diff --numstat` called clean.** Three probes said clean (`--numstat` empty, content
equal after normalisation, model entries identical) and the fourth, `git status --porcelain`, said
` M`; only the fourth was answering the question I actually needed. That is the same asymmetry the
REPORT CONTRACT records for the dev-tree fast-forward — the first three pass on a tree the fourth
catches. Restored by writing the CRLF form back, then `git update-index --refresh`; read back **all
four**: `--numstat` EMPTY, `--cached` EMPTY, `status --porcelain` EMPTY, rebase then proceeded.

**Nothing was armed. Nothing was merged. No label was touched. No `*-ready.md` was created.**

## FINDINGS

### F1 — sot/04's generated section was one schema change stale, and the header count caught it this time while the 2026-09-14 correction predicts it usually will not

[MEASURED] 2026-09-22T14:3xZ at `58a53a11`, both prescribed probes run, **not one instead of the
other**:

| probe | sot/04 | freshly generated | agrees? |
|---|---|---|---|
| header counts | `Models: 297 \| Enums: 70 \| FK edges: **496** \| Domains: 23` | `Models: 297 \| Enums: 70 \| FK edges: **497** \| Domains: 23` | **NO** |
| content of the generated section (CRLF-normalised string compare) | 3,720 lines / 167,527 chars | 3,723 lines / 167,731 chars | **NO** |
| `--check` (NOT a drift gate) | — | `OK`, exit 0 | n/a — proves only that the schema parses |

The content diff is **6 lines only in sot/04, 7 only in the fresh map**, first divergence at line
2219 — `Tender` `Fields: 72` → `73`, `TenderRateSet` `10` → `11`, `MapLocation` `16` → `18`,
`TipRecommendationLog` `20` → `22`, a new `TipRecommendationLog` entry in `Tender`'s *Referenced by*
list, a new `Time fields:` line and a widened `Suggested dimensions:` line. One new FK edge
(`TipRecommendationLog → Tender`) is what moved the header from 496 to 497. Compared as **strings**,
never as lengths or line counts (sot/04 is CRLF, the artifact is LF), and never read as a naive
line-index diff.

⚠️ **Worth recording for the next run, because it cuts against the obvious reading of this
station's own doc.** The 2026-09-14 correction says the four header counts are *structurally blind
to field-level drift* and that a match is therefore not evidence. Today the header **did** fire —
because this particular schema change happened to add an FK edge as well as fields. Both halves hold
simultaneously: the header caught the edge, and only the content comparison caught the four
`Fields:` counts and the two list lines. **This is a positive instance of "run both, not instead",
and it must not be written up as evidence that the header check is sufficient.** Its falsifying
probe is unchanged and still stands.

**DISPOSITION: ACTIONED.** Re-merged section-scoped in the PR this breadcrumb ships inside, with
every safeguard above read back. Verified by `READBACK_GEN_MATCHES_FRESH=true`,
`READBACK_HEADER=- Models: 297 | Enums: 70 | FK edges: 497 | Domains: 23`, the MERGED SOURCES sha256
unchanged either side of the write, and `--check` + `check-sot-refs.mjs` both exit 0 afterwards.

### F2 — 24 of 81 API module directories are not named anywhere in sot/01, and §13 is the Module Registry

[MEASURED] 2026-09-22T14:5xZ: `apps/api/src/modules` holds **81** directories. Searching
`sot/01-charter-and-architecture.md` for each name (case-insensitive, whole file, not only §13)
leaves **24** with no mention at all: `access-requests`, `admin-imports`, `admin-settings`,
`admin-users`, `agreed-records`, `ai-settings`, `api-keys`, `bid-prioritisation`, `client-quotes`,
`comms-approvals`, `company-profile`, `correspondence`, `estimate-export`, `global-lists`,
`handover-templates`, `list-bindings`, `notification-preferences`, `pilot-feedback`,
`public-holidays`, `subcontractor-rates`, `tenants`, `tender-clarifications`, `tender-clients`,
`win-likelihood`. POSITIVE control `tendering` → present; NEGATIVE control, a freshly minted needle
→ absent, so the instrument is not matching everything or nothing.

⚠️ **Scope the claim honestly: this is a CANDIDATE list, not 24 proven registry gaps.** A directory
whose module is documented under a different display name in §13 would still land in this list —
the probe asks whether the *directory name* appears, which is a weaker question than whether the
*module* is registered. Confirming each one is curated judgement over §13's prose, which this
station's brief puts squarely in the never-auto-fix set.

**DISPOSITION: DEFERRED.** Real, not now. It is a slow-moving documentation gap on a board with 0
open PRs and nothing blocked on it, and the fix is curated prose in `sot/01` §13 — editable only by
this station, but only with the module-by-module judgement a headless run must not guess (RULE 3).
**What would make it urgent:** anyone reading §13 as a complete inventory — a new-joiner onboarding,
an access/permission review, or a roadmap slice scoped from the registry — because the failure mode
is a module that exists and is invisible to the document that claims to list them all. The
complete-and-additive fix is one doc-reconcile PR adding the confirmed modules to §13 with Marco or
a development chat confirming each name; it damages no data and leaves nothing to redo.

### F3 — `PO Watcher Keepalive` last ran TERMINATED (0x41306), while the watcher it guards is alive

[MEASURED] 2026-09-22T14:4xZ from the live Windows task list — read from the box, not enumerated
from any document (this step's 2026-08-27 correction exists because four named fixtures had not
existed for months, and `PO Watcher Keepalive` is still the only task matching this project):

```
TASK PO Watcher Keepalive  state=Ready  lastResult=267014  lastRun=09/23/2026 00:25:01
```

`267014` = `0x41306` = **`SCHED_S_TASK_TERMINATED`** — the last run was terminated rather than
completing. The watcher itself is **healthy**: `pid 9744` with the right command line, the
auto-restart wrapper alive, and `processed/` logs minutes old. So this is **not** a board stall and
must not be led with as one; what it means is that the restarter's own last invocation did not exit
cleanly, which is precisely the signal that stops being informative if it is normalised.

⚠️ **I did not diagnose this and deliberately did not try.** A restarter that terminates on a
timeout after confirming a live watcher is benign; one that terminates because it wedged is not, and
telling those apart needs the keepalive's own log and its execution-time-limit setting — both
machine-health instruments.

**DISPOSITION: DISPATCHED — Station 03 (Machine-minder).** Handing over: the task name, the exact
`LastTaskResult` and its decoded meaning, the local last-run time, and the measured fact that the
watcher is alive so this is a restarter-hygiene question and not a queue-freeze question. 03 owns
watcher health, locks and restarter presence; Station 05 is read-only on machines.

### F4 — sot/02 claims 5 In-PR items against a live board of 0

[MEASURED] `sot/02-roadmap-and-status.md` line 61: `## 2. 🔧 In-PR — open right now (5)`. Live
board at 14:4xZ: `gh pr list --state open` → `[]`, exit 0, `-R` passed. The document's own line 107
already records that the 2026-07-27 In-PR set has merged, so the heading count is the part that did
not follow.

This is **not** the deterministic drift this station may auto-fix. "In-PR" and "Staged" are curated
**status semantics** — the brief names roadmap STATUS semantics in the never-auto-fix list by name,
and rewriting a section heading to `(0)` would state that five items reached `main` when what this
run can actually prove is only that no PR is open for them now. Establishing which of the five
merged, which were superseded and which quietly died is exactly the judgement a headless run must
not guess.

**DISPOSITION: DEFERRED.** Real, not now, and small. **What would make it urgent:** a run using
sot/02 to decide what to arm or stage — a stale In-PR list is how the same work gets queued twice
(DOCTRINE §10.6, where a prompt outliving its PR produced an armable duplicate). The
complete-and-additive fix is one doc-reconcile PR that resolves each of the five against `gh pr
list --state merged` and rewrites the entries with their outcomes, rather than only correcting the
count — correcting the count alone fixes the symptom and leaves five unresolved entries behind,
which fails the "future" half of RULE 1.

### F5 — `origin/main` moved twice during this run, and the sweep's ground line expired inside it

[MEASURED] preflight `origin/main` = `58a53a11`; at 14:4xZ = **`304e41b6`** (`#2087`,
`docs(pipeline): sweep 2 breadcrumb(s) 20260922-1426`), which swept
`00-00-supervisor-2026-09-22-1414-*` and `00-04-scanner-2026-09-22-1411-BLIND-*` onto `main`.

🔴 **The live consequence, and it is the reportable half: the dev tree now holds an UNTRACKED file
at a path `main` has since created**, so `git merge --ff-only` in `C:\ProjectOperations2` will
refuse — while `git diff --numstat` and `git diff --cached --name-status` both read EMPTY, which is
the documented PASS reading. [MEASURED] `git status --porcelain` in the dev tree at 14:2xZ:
`?? docs/pr-prompts/00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md` (also
`?? docs/pr-prompts/queue-watch-state.md`, `?? docs/pr-prompts/.queue-sync-ledger.txt`,
`?? "Claude Design/docs/index.html"`). This is the exact condition the REPORT CONTRACT's red block
describes, met live.

**I did not clear it, and that is a decision rather than an omission.** The blocking file is another
station's breadcrumb in a SHARED tree; the prescribed cure (restore the path byte-exactly from
`HEAD`) does not apply, because the path is not in the dev tree's `HEAD` at all — it exists only on
`origin/main`. Removing another actor's untracked file from a shared tree on my own initiative is
the LL-38 shape, and `git clean` is a hard stop (consumed prompts come back armed).

**DISPOSITION: DISPATCHED — Station 00 (Supervisor).** 00 drives dev-tree convergence and owns the
fast-forward. Handing over: the blocking path, the measurement that the three usual cleanliness
probes read EMPTY and will not catch it, and the note that this was *caused* by 00's own breadcrumb
sweep landing a path the dev tree already held untracked — so it will recur on every sweep unless
the sweep also clears what it swept.

## WHAT I DID NOT DO

- **Did not touch `scripts/`, `apps/`, `.github/`, `packages/`, `package.json` or
  `pnpm-lock.yaml`.** CP-24 hard-blocks any PR mixing `sot/` with those and has no escape hatch;
  this PR is `sot/` + `docs/`, which is the allowed pairing. Split before opening, not after CI says
  so.
- **Did not burn down a sot-refs baseline entry, because there is nothing left to burn.**
  [MEASURED] `docs/qa/sot-refs-baseline.json` → `entries.length` = **0**, and
  `node scripts/pipeline/check-sot-refs.mjs` → `total=275  dangling=0  exempt=20  baselined=0
  excluded=2`, `All sot/ references resolve.` The list may only shrink and it has reached zero. The
  station doc still calls this "your primary housekeeping obligation" and describes a one-entry-per-run
  workflow; that instruction is now unreachable, which is worth the next run knowing so it does not
  hunt for an entry to delete or, worse, add one. **I did not edit the station doc to say so** —
  `station_doc_version` is 1 in both layers and rewriting a station's own standing instructions on
  the strength of one measurement is a change to binding law, which belongs to Station 00 with the
  count re-measured, not to a housekeeping run. The count is STATE and lives here, where it expires.
- **Did not run `build-toc.mjs --check` against `sot/`.** No `sot/` file carries TOC markers, so it
  reports drift unconditionally; the brief says ignore it and it was ignored rather than quoted.
- **Did not regenerate anything in the dev tree.** The generator writes
  `docs/data-model/metadata-catalog.json`, which is tracked; every generator run in this report
  happened inside the disposable worktree, so the shared tree was never dirtied.
- **Did not arm, merge, label, or stage a `*-ready.md`.** Station 05 never arms and never merges,
  and a loose `*-ready.md` IS an armed prompt (DOCTRINE §5b) — the 2026-08-25 correction to S1
  exists because the old wording told this station to stage exactly that.
- **Did not clear the dev tree's fast-forward blocker** (F5) or diagnose the keepalive's exit code
  (F3) — both dispatched, for the reasons given in their findings.
- **Did not touch Azure, Entra or SharePoint.** Absolute, and not reasoned past.

**This breadcrumb ships INSIDE this run's own PR**, at a tracked path under `docs/pr-prompts/`, so
it needs nobody to sweep it up and it does not leave an untracked file in the dev tree to block the
next fast-forward — which is F5's own failure mode, and the reason the REPORT CONTRACT calls this
the best of the two homes.
