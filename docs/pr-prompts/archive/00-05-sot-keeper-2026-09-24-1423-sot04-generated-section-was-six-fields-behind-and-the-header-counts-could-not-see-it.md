# Station 05 — SoT Keeper | 2026-09-24T14:23Z–2026-09-24T15:0xZ

## GROUND

```
UTC            2026-09-24T14:23:42Z
origin/main    11c07025
dev tree       main @ 11c07025  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is READ-WRITE within Station 05's lane.

Sighted run. Desktop Commander reached the Windows host on the first call after the
`ToolSearch` load (`start_process`, shell `powershell.exe`, PID 42024) and answered
`2026-09-24T14:23:42.2556558Z` / `main` / `11c07025`. **This is not a blind run.**

**Catch-up check — nothing is owed.** `node scripts/pipeline/check-breadcrumb.mjs --freshness
--station 05` → `05  last 2026-09-23T14:23:00Z  24.1h ago  (cadence 24h)  ok`, `CLEAN`, exit 0.
Read as AGE and not as the `ok` verdict, per this station's own rule: 24.1 h is exactly ONE
cadence, so yesterday's occurrence ran and no day was missed. One unit of work today, not two.

## WHAT I MEASURED

### Preflight

| probe | result |
|---|---|
| `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` | last line `PATH="/sessions/blissful-busy-ride/.local/bin:$PATH" git <args>`, **EXIT 2** — `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.` [MEASURED] |
| freshness of the three binding docs | `git diff --numstat origin/main -- <path>` **EMPTY** for `docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md` and `docs/pipeline/stations/05-sot-keeper.md` — the working copies I read ARE `origin/main`'s [MEASURED] |
| `git rev-list --left-right --count HEAD...origin/main` | `0 0` [MEASURED] |
| `scripts/pipeline/status-sweep.ps1` (captured `*>`, decoded `utf16le` per §9.3) | exit 0; §7 verdict **`CAUTION: no local lock, but a PR was touched on GitHub in the last 2 min … if you must act, use an ISOLATED worktree and touch only NEW branches/PRs`** [MEASURED] |

Guard exit 2 is the expected station outcome, not an anomaly (station contract, PREFLIGHT step 1
table): the shell a station is given is non-interactive and non-login, so it sources neither
`~/.bashrc` nor `~/.profile` and resolves the real `git`. **The device-bridge git ban was
REMEMBERED, not mechanical, for this whole run — and it was kept: every `git` call in this run
went through Desktop Commander on the Windows host, never through the VM against the mount.**

I obeyed the CAUTION verdict literally: all work happened in a **disposable worktree**
(`C:\po-worktrees\sot05-20260924`) off `origin/main`, on a **new branch**, opening a **new PR**.
Nothing existing was touched. The sweep was re-run immediately before the push.

### AUDIT 1 — schema parse sanity

`node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (297 models, 70 enums, 498 edges).`, exit 0.
[MEASURED] **This is a parse check and NOT a drift gate** (station doc, 2026-08-25 correction), so
it is recorded and then ignored for the drift question, which audit 3 answers.

### AUDIT 2 — catalog validity

`node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`CATALOG_PARSE_OK keys=4`, exit 0. [MEASURED] Valid JSON. No finding.

### AUDIT 3 — sot/04 drift (the finding — see F1)

Two probes, both run, because the header-count probe is structurally blind to field-level drift
(DOCTRINE-side correction of 2026-09-14, restated in this station's doc):

| probe | before regen | after regen |
|---|---|---|
| `sot/04` header | `Models: 297 \| Enums: 70 \| FK edges: 498 \| Domains: 23` | unchanged |
| `relationship-map.md` header | `Models: 296 \| Enums: 70 \| FK edges: 493 \| Domains: 23` | `Models: 297 \| Enums: 70 \| FK edges: 498 \| Domains: 23` |
| headers match | **false** (the ARTIFACT was stale, not sot/04) | **true** |
| CONTENT comparison of the generated section | — | **false — 3 lines differ** |

🔴 **The header-count probe would have cleared this file.** Once the artifact was regenerated the
four header numbers agreed EXACTLY, and the generated bodies still differed — `ScopeWasteItem`
`Fields: 51` against `57`, `OperationsSettings` `Fields: 12` against `13`, plus one
`Suggested measures:` line missing `totalTripKm`. That is the 2026-09-14 correction's own
falsifying probe re-run at a new commit, and it **holds**: the four counts change only when a
model, enum, FK edge or domain is added or removed, and adding a field to an existing model moves
none of them.

Method notes, because two §9 traps sit directly in this probe's path: the comparison is of
CONTENT and never of sizes or lengths (§9.3 — sot/04 is CRLF on this host and the generated
artifact is written LF, so they differ by their line count before any content does); and the
naive line-index diff is only quoted because the two sides have **equal** line counts here
(3727 = 3727), so no insertion is offsetting anything.

Model-set diff, as a control that this is field-level and not structural:
`MODELS_IN_SOT_ONLY=0`, `MODELS_IN_MAP_ONLY=0`, `MODELS_TOTAL sot=297 map=297`. [MEASURED]

### AUDIT 4 — roadmap drift

`sot/02-roadmap-and-status.md` §2 reads **"In-PR — open right now (0)"** and, in prose,
**"The board is empty."**, carrying a snapshot stamped `2026-09-23T14:33Z`.
[MEASURED] `gh pr list -R GH-Mantova/ProjectOperations --state open --json number` → exit 0,
**6 open PRs**: `#2168 #2167 #2166 #2164 #2158 #2148`. NEGATIVE control `gh pr view 999997` →
exit 1. So the table is wrong again, **24 hours** after it was written. See F2 — this is already
an OPEN question with Marco and is deliberately NOT refreshed here.

### AUDIT 5 — automation health

| probe | result |
|---|---|
| watcher node | `[LIVE] RUNNING pid 42212`; auto-restart wrapper alive (2); heartbeat age 25 min (ticks only mid-run) [MEASURED, sweep §2] |
| watcher clone | `branch=main dirty=0` [MEASURED, sweep §2] |
| `docs/pr-prompts/processed/` | **4958** files, newest `2026-09-24T14:00:39Z` `rev-2167-ready.md.log` — under an hour old [MEASURED] |
| live scheduled tasks (scheduled-tasks MCP, never this document) | **4 enabled**: `00-supervisor` `5 * * * *` (last 14:14:09Z) · `03-machine-minder` `0 9 * * *` (last 2026-09-23T23:02:54Z) · `04-scanner` `0 */4 * * *` (last 14:09:48Z) · `05-sot-keeper` `10 0 * * *` (last 14:22:54Z — this run). `weekly-security-audit` **`enabled: false`**, last run 2026-09-06T21:32:44Z [MEASURED] |
| armed prompts | `0` [MEASURED, sweep §4] |

**Nothing is stalled.** The `weekly-security-audit` reading matches `STATION-CAPABILITIES.md` §1's
2026-09-15 correction exactly, so that correction is re-confirmed rather than drifted.

One machine-side item the sweep raised is recorded as F3 and handed to Station 03.

### AUDIT 6 — model ↔ migration ↔ code coherence

[MEASURED] over `apps/api/prisma/schema.prisma` (297 models, **0** without an `@@map`) and all
**266** migration directories:

| probe | result |
|---|---|
| models with no backing migration | **0** |
| tables created by a migration with no live model | 5 raw hits — `user_ai_providers`, `user_ai_preferences`, `subcontractor_contacts`, `leads`, and `IF` |
| of those, provably dropped by a later migration | **4 of 4 real ones** — each returns `DROP TABLE … <table>` |
| `IF` | a parser artefact of my own regex matching `CREATE TABLE IF NOT EXISTS` without quotes — **not a finding** |
| schema models missing from `sot/04` | **0** |

So audit 6 is CLEAN, and I am saying so with the false positive named rather than filtered out
silently.

### AUDIT 7 — registry (report only)

`apps/api/src/modules/` holds **81** directories. **24** are not named anywhere in
`sot/01-charter-and-architecture.md`: `access-requests`, `admin-imports`, `admin-settings`,
`admin-users`, `agreed-records`, `ai-settings`, `api-keys`, `bid-prioritisation`,
`client-quotes`, `comms-approvals`, `company-profile`, `correspondence`, `estimate-export`,
`global-lists`, `handover-templates`, `list-bindings`, `notification-preferences`,
`pilot-feedback`, `public-holidays`, `subcontractor-rates`, `tenants`,
`tender-clarifications`, `tender-clients`, `win-likelihood`. [MEASURED]
⚠️ That count is STATE — re-measure it, never quote it. This is report-only by the station
contract and is F4.

### SOT-REFS BURN-DOWN — the list is empty

`node scripts/pipeline/check-sot-refs.mjs` → exit 0,
`total=275  dangling=0  exempt=20  baselined=0  excluded=2`, and
`docs/qa/sot-refs-baseline.json` parses with **`entries.length = 0`**. [MEASURED]

**There is nothing left to burn down.** This station's primary housekeeping obligation is
DISCHARGED, and the correct action today was to add no entry and delete none. Re-run after the
sot/04 edit, inside the worktree: identical, exit 0 — the edit moved no line numbers (total lines
5328 before and after), so no baseline re-keying was needed either.

### RULE ZERO — local PASS cross-checked against real CI

A local pass is not evidence of health, so every local result above was crossed against the
actual CI conclusion for the corresponding job:

| where | `Data model — generator sanity (schema.prisma parses cleanly)` |
|---|---|
| `main` @ `11c07025fefd94ede50a76b1b5ef6f594ac73ee7` (full 40-char SHA, §9.4) | 4 runs, **all `success`** — `Deploy`, `CodeQL`, `CI`, `Tendering Browser Smoke`; the 4 `Claude Code` / `issue_comment` runs are `skipped` |
| `#2167` · `#2166` · `#2164` · `#2158` · `#2148` | **`SUCCESS` on all five** |
| `#2168` | `SKIPPED` (no schema in its diff) |

**NO ENVIRONMENT DISAGREEMENT.** Local `--check` and CI agree everywhere, in both directions.

⚠️ Separately and outside my lane: all five of `#2167 #2166 #2164 #2158 #2148` show
`Approval receipt (CP-26)=FAILURE` and `PR gates — diff checks=FAILURE`. Per §9.4 that pairing is
the signature of a PR carrying `do-not-merge` — **two reds, one cause, parked by design** — and
the discriminator is the CP-26 verdict TOKEN, not the counts. I did not pull the tokens: the board
is Station 00's, this is recorded as an observation and not as a finding, and I am explicitly NOT
asserting those five are parked rather than broken.

## WHAT CHANGED

**One unit of work, dated 2026-09-24. No catch-up day was owed and none was performed.**

One file edited, in a disposable worktree off `origin/main`, on the new branch
`sot/reconcile-04-datamodel-2026-09-24`:

**`sot/04-data-model.md` — 3 insertions / 3 deletions** (`git diff --numstat` → `3 3
sot/04-data-model.md`):

| line | before | after |
|---|---|---|
| 944 | `` `scope_waste_items` \| Domain: Estimating \| Fields: 51 `` | `Fields: 57` |
| 952 | `Suggested measures: … markupOverride` | `… markupOverride, totalTripKm` |
| 3028 | `` `operations_settings` \| Domain: Unclassified \| Fields: 12 `` | `Fields: 13` |

Every SAFEGUARD was asserted before the write and is quoted here, not summarised:

| safeguard | reading |
|---|---|
| **S1** never edit main, never merge | delivered as ONE doc-reconcile PR opened from a disposable worktree off `origin/main`. Nothing armed. Nothing merged. No `*-ready.md` created — this station may never arm |
| **S2** determinism | generator run TWICE, outputs compared with the `Last updated` stamp stripped: `DETERMINISTIC_MODULO_STAMP=true`, `LEN_A=168385 LEN_B=168385` |
| **S3** section-scoped | `S3_PREAMBLE_IDENTICAL=true` (sha `bd370dce6b704082` before and after), `S3_TAIL_IDENTICAL=true` (sha `d5f505615d88a806` before and after), `MERGED_SOURCES_PRESENT` true before and after. **Not one curated byte moved** |
| **S4** no content loss | curated line count `1598` → `1598`, `NOT_DECREASED=true`; total file `5328` → `5328` |
| **S5** scope cap | the PR touches `sot/` and `docs/` only. **CP-24 clear** — no `scripts/`, no `apps/` |
| **S6** post-fix validation | in the worktree: `build-relationship-map.mjs --check` → `OK … (297 models, 70 enums, 498 edges)`, exit 0; `check-sot-refs.mjs` → `dangling=0 … baselined=0`, exit 0 |
| **S7** one-and-done | no reconcile PR from a prior run is open — the 6 open PRs are `#2168 #2167 #2166 #2164 #2158 #2148`, none of them `sot/` |

CRLF was handled deliberately rather than by luck: the file is CRLF (`crlf=5327`, `totalNL=5327`),
the generated artifact is LF, and the re-merge re-emits the fresh body in the file's own EOL and
preserves the old block's exact leading and trailing whitespace. That is why a 3727-line section
swap produces a 3-line diff. The edit was made with **node** `writeFileSync`, never PowerShell
`Set-Content` / `Out-File` (§9.3), and never with a `String.replace` replacement STRING.

**The breadcrumb is inside this PR**, which is the contract's preferred home — it lands with the
change it describes and needs nobody to sweep it up.

**Dev tree left clean.** Regenerating the map also rewrites the TRACKED
`docs/data-model/metadata-catalog.json`. It shows ` M` in `git status --porcelain` while
`git diff --numstat` returns **EMPTY** for it — the LF/CRLF shrink this station's doc corrected on
2026-09-21, content-identical after the clean filter. It is NOT in this PR and the index was
refreshed rather than restored, because there is nothing to restore. **No `git checkout .`, no
`reset --hard`, no `git clean`** — consumed prompts come back armed (§9.2).

## FINDINGS

### F1 — sot/04's generated schema map was six fields behind `schema.prisma`, and the header counts could not see it

The generated section had not been re-merged after the fields landed on `main` (the
`totalTripKm` / Geoapify haulage work, `#2161`, merged 2026-09-24T09:41Z, is the obvious
candidate and I have not proved authorship — that half is `[INFERRED]`). The four header counts
agreed exactly once the artifact was regenerated, so the cheap probe cleared a file that was
stale; only the CONTENT comparison found it. Deterministic, regeneratable, judgement-free — squarely
inside the auto-fix allowlist.

**DISPOSITION: ACTIONED** — re-merged section-scoped in this PR, 3 lines, all seven safeguards
asserted above with their readings quoted. Verified by re-running the content comparison after the
write (`CONTENT_IDENTICAL` now true), `--check` exit 0 and `check-sot-refs.mjs` exit 0 inside the
worktree.

### F2 — sot/02 §2 is wrong again, 24 hours later, and this is the SIXTH data point on a question already open with Marco

`sot/02` §2 says **"In-PR — open right now (0)"** and **"The board is empty."** against a
snapshot stamped `2026-09-23T14:33Z`. Six PRs are open right now. The failure has merely changed
polarity: the first five instances named MERGED PRs as in-flight, this one denies open PRs exist.

`docs/pr-prompts/needs-marco/sot02-in-pr-table-is-on-its-fifth-refresh-and-rots-within-hours-2026-09-23.md`
already asks Marco the deciding question — generated table, or CI check — and explicitly names
*"keep refreshing it daily"* as option **(b)**, the one that **fails the future half of RULE 1**.
I re-verified its central claim against the live system rather than trusting the artifact: its
falsifying probe (`gh pr list --state open` against the PRs named in §2) reproduces today.

🔴 **So I deliberately did NOT refresh the table.** A sixth refresh would be the option the open
escalation has already measured as futile, and landing it would make the question look answered
while it is not. Restructuring §2 is also not mine: it is curated roadmap prose and a STATUS
judgement, which this station never auto-edits.

**DISPOSITION: DEFERRED** — the decision sits with Marco in the file named above and nothing
here changes it. What would make it urgent: a reader acting on §2 as a live board state. The
cheapest thing that would end it is Marco answering with one word — *generated* or *CI check* —
after which Station 00 stages the `scripts/` slice and Station 05 lands whatever `sot/` half it
needs.

### F3 — an orphaned worktree is holding two uncommitted files

`status-sweep.ps1` §2 `[LIVE]`: `C:/po-worktrees/sup-cwd-paths` `66ac4dcd`
`[fix/pipeline-scripts-resolve-state-paths-from-module]`, **dirty=2 files, age 410 min**, flagged
`HOLDS UNCOMMITTED WORK … 'git worktree remove' will refuse, and --force would discard it`. A
second, `C:/po-wt/fv2drop` `817339c3`, is clean at age 345 min.

I did not touch either. Worktree hygiene is Station 03's lane ("repair the machines"), and
discarding someone's uncommitted work is irreversible — a hard stop, not a chore.

**DISPOSITION: DISPATCHED → Station 03 (Machine Minder)**, handing over the two paths, the two
SHAs, the dirty count and the sweep's own warning that `--force` would destroy the work. Station 00
collects this breadcrumb and can route it.

### F4 — 24 of 81 API modules are absent from sot/01's module registry

`apps/api/src/modules/` holds 81 directories; 24 are named nowhere in
`sot/01-charter-and-architecture.md` (listed in full under AUDIT 7). The station contract makes
this audit **report only**, and rightly: deciding which of the 24 are first-class modules that
belong in the charter's registry and which are internal seams is a curated-prose judgement about
architecture, which is Marco's shape of question and not a deterministic re-merge.

**DISPOSITION: DEFERRED** — real, not now, and deliberately not auto-edited. It becomes urgent
the moment someone uses sot/01's registry as a completeness check rather than as a narrative;
the resolving move would be Marco naming the inclusion rule, after which the registry section
could be reconciled in a later doc-reconcile PR.

## WHAT I DID NOT DO

- **Did not arm anything and did not merge anything.** No `*-ready.md` was created; the queue's
  armed count was 0 at the sweep and this run did not change it. This station may never arm and
  never merge, and that is unconditional.
- **Did not refresh sot/02 §2** — see F2. The refresh is the option the open escalation measures
  as failing, and doing it anyway would disguise an unanswered question as a handled chore.
- **Did not restructure sot/02 §2, and did not touch sot/01's registry prose.** Both are curated
  roadmap/architecture semantics. The allowlist is deterministic regeneratable drift only;
  anything requiring judgement comes back as a finding, which is what F2 and F4 are.
- **Did not include `docs/data-model/metadata-catalog.json`** in the PR. Its ` M` is line endings,
  not content — `git diff --numstat` is EMPTY for it — and committing a CRLF/LF churn of a
  723 KB tracked artifact into a doc-reconcile PR is noise that would bury a 3-line diff.
- **Did not clear, prune or force anything in the two orphaned worktrees** (F3). One holds
  uncommitted work; `--force` would discard it. Irreversible, and Station 03's lane besides.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so
  it reports drift unconditionally and cries wolf. Skipped by standing instruction, and said so
  rather than silently dropped.
- **Did not pull the CP-26 verdict tokens** for the five red open PRs. The pairing looks like the
  `do-not-merge` signature, but the board is Station 00's and I am not asserting a verdict I did
  not measure.
- **Did not run any `git` from the VM against the Windows `.git`**, despite the guard reporting
  itself INERT (exit 2). An inert guard is not a licence; every `git` call went through Desktop
  Commander on the host.
- **Did not touch Azure, Entra or SharePoint.** Nothing in this run came near them.
