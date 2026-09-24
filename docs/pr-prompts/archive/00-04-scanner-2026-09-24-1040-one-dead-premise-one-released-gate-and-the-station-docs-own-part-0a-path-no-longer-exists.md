# Station 04 — Scanner | 2026-09-24T10:10:10Z–2026-09-24T10:24:17Z

⚠️ Both timestamps are MEASURED, not estimated — the start from the run's first host call, the end
from `(Get-Date).ToUniversalTime()` on the box in the run's last call. The filename's `1040` slug is
the minute the breadcrumb was drafted and is the only approximate number in this file.

## GROUND

```
UTC            2026-09-24T10:10:10Z
origin/main    0f13c399            (git fetch origin, then git rev-parse --short origin/main, in the dev tree)
dev tree       main @ 690d80dc     C:\ProjectOperations2   (0 ahead / 2 behind origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version) — MATCH, full authority
```

Named sweep this run: **gate-liveness** (`node scripts/pipeline/next-sweep.mjs` → rotation position 1 of 4;
previous run 2026-09-24T06:21:32Z). Advanced after the sweep with
`--advance --utc 2026-09-24T10:11:34Z`; **`docs/pipeline/sweep-rotation.json` is LEFT DIRTY in the dev
tree and Station 00 must commit it** (see WHAT CHANGED).

Reachability: **SIGHTED.** `start_process` shell `powershell.exe` answered `HOST_SHELL_OK` on the first
call. This was not a blind run.

vm-git-guard: `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
**EXIT 2**, last line
`To get the protection for one call, put the shim on PATH yourself:` /
`   PATH="/sessions/great-tender-volta/.local/bin:$PATH" git <args>`, headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
That is the documented EXPECTED station outcome (PREFLIGHT table): a FINDING, not a STOP. No `git`
was run through the device bridge at any point this run — every `git` call went through Desktop
Commander on the Windows host.

Binding documents read **in full** this run: `docs/pipeline/DOCTRINE.md` (2842 lines),
`docs/pipeline/STATION-CAPABILITIES.md` (580 lines), `docs/pipeline/stations/04-scanner.md` (568
lines). Freshness proved per PREFLIGHT step 2, without the unsound piped-hash form:
`git diff --numstat origin/main -- <path>` returned **EMPTY for all three**, so the working copies I
read are byte-identical to `origin/main` despite the tree being 2 behind.

Sweep verdict (`scripts/pipeline/status-sweep.ps1`, generated 2026-09-24T10:11:34Z, captured with
`*>` and decoded `utf16le` per §9.3): **`[LIVE] SAFE TO ACT`**. Section 0 positive controls both pass
(`gh` reached GitHub, `node` runs). No `[BROKEN]`.

## WHAT I MEASURED

Every needle below was minted fresh for this run: **`qQz7Needle04x20260924`** (§9.6 — it is spent the
moment this file is tracked). Every probe carries its own positive and negative control.

**Lock reality (PREFLIGHT step 4).** `[LIVE] git index.lock interactive/clone: False / False`;
`[LIVE] git processes touching our trees (scoped): 0`. **No lock exists, stale or otherwise** — there
was nothing to age or size. [MEASURED] from the sweep's section 3.

**Board state at `0f13c399`.** [MEASURED] sweep section 1: 2 open PRs, both watcher-opened and both
RED — `#2158` (FormRule column drop, 13 pass / 2 fail) and `#2148` (auth log scrubbing, 13 pass /
2 fail). `main` CI on `0f13c399`: 4 success / 0 failed — trunk green. Armed (`*-ready.md`) = **0**.

**RULE-2 lane probe**, run against the LIVE dev tree `C:\ProjectOperations2\docs\pr-prompts\processed`
and never the clone (§9.5), prompt logs only:
`PR #2158` → **2** hits, `PR #2148` → **2** hits — **both watcher-opened, so §10.1 step 1 applies to
both.** POSITIVE control `marco.:true` (regex form, §10.1's closing note) → **708**. NEGATIVE control
`PR #999997` → **0**. FRESHNESS control, the one that separates the live corpus from the clone's
17-day-stale decoy: newest prompt log `rev-2148-ready.md.log` at **2026-09-24T09:35:55Z**, younger
than either open PR.

**The board trap (tracked `*-ready.md` at depth 1).** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`, §9.2; result
FILTERED in PowerShell rather than globbed in the pathspec, because `ls-tree` has no glob):
**`READY_TRACKED_COUNT=0`**. POSITIVE control, total tracked under that prefix = **1389**. NEGATIVE
control, the minted needle over the same listing = **0**. `ARMED_ON_DISK` (`Get-ChildItem`, so
gitignored files are visible where `git status` is blind, §9.2) = **0**. **No board trap on this
board.**

**Gate liveness — all 17 `-HOLD.md` at depth 1 of `origin/main`.** Premises were NOT run as shell
one-liners: each was translated to `git grep -F` / `git cat-file -e` against `origin/main` and
evaluated in a `.mjs` file run from disk, so no needle crossed a PowerShell layer into `node -e`
(§9.1's backslash bullet) and nothing was read from the 2-behind working copy.
Controls, same run: `model Client` in `schema.prisma` → 5 hits / 1 file; `classifyPolicyFiles` in
`index.mjs` → 2 hits; minted needle over `schema.prisma` → 0; minted needle over `scripts/` → 0;
file-exists on `schema.prisma` → true; file-exists on a minted path → false.

**Result: 16 premises TRUE (work still needed), 1 FALSE (dead), 0 unmeasurable.**

| prompt | premise verdict | evidence at `0f13c399` |
|---|---|---|
| `pr-scopecards-s8g-geoapify-travel-and-time-index` | **FALSE — DEAD** | `GEOAPIFY_ROUTE_TRAVEL_V1` in `apps/api/src` → **5 files, 14 hits** (premise asserts zero) |
| `pr-524-rates-b-slice2-canonical` | TRUE | `^model EstimateLabourRate` in schema → 1 |
| `pr-rates-s11c-drop-legacy-tables` | TRUE | `model EstimateLabourRate` in schema → 1 |
| `pr-retire-tenderclientnote-s2` | TRUE | `model TenderClientNote` in schema → 1 |
| `pr-siteid-notnull-backfill` | TRUE | nullable `siteId` rows in schema → 4 |
| `pr-tenant-mt4-s2-ownership-migration` | TRUE | `model Client` block found, `tenantId String?` present |
| `pr-fv2-ai-digests` | TRUE | `form-digests.service.ts` on main → false |
| `pr-fv2-formrule-contract` | TRUE | migration dirs matching `fv2_formrule_contract` → 0 |
| `pr-fv2-output-channels` | TRUE | `FormOutputDelivery` in schema → 0 |
| `pr-nav-jobs-projects-merge` | TRUE | `path="/projects"` in `App.tsx` → 1 |
| `pr-queue-layout-sot-entry` | TRUE | `QUEUE_LAYOUT_V1` in `sot/` → 0 |
| `pr-scopecards-s8b-azure-maps-travel` | TRUE | `AZURE_MAPS_TRAVEL_V1` in `apps/api/src` → 0 |
| `pr-scopecards-s8h-traffic-index-ui` | TRUE | `WASTE_TRAVEL_INDEX_UI_V1` in `apps/web/src` → 0 |
| `pr-sec-a1-auth-secret-fail-fast` | TRUE | `replace-me-access` in `auth.service.ts` → 3 |
| `pr-sec-a2-email-codes-and-reset-links` | TRUE | `EmailOtpDelivery` in `otp-delivery.port.ts` → 0 |
| `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | TRUE | `Cannot rename facility from` in `map-locations.service.ts` → 1 |
| `pr-vendor-invoice-ocr` | TRUE | `vendorInvoiceOcr` 0 + `invoiceScan` 0 over 11 `procurement/` files on main |

**`lint-prompt.mjs` per HOLD, on the 15 present on disk.** `git` resolves
(`C:\Program Files\Git\cmd\git.exe`, `git rev-parse origin/main:docs/pipeline/DOCTRINE.md` → exit 0)
and `gh` resolves (`C:\Program Files\GitHub CLI\gh.exe`) — both confirmed before trusting any verdict,
per §9.5. **Exit 0 (ADMIT): 1. Exit 3 (SPENT): 0. Exit 1: 14** — 8 `HUMAN_GATE_PRESENT`,
4 `FILE_GATE_NOT_RELEASED`, 2 `GATE_NOT_RELEASED`.

⚠️ **`HUMAN_GATE_PRESENT` short-circuits before the premise is evaluated**, so for those 8 the linter
is silent about premise liveness. That is exactly the "a dead gate MASKS the premise behind it" shape,
reached through the human gate instead. **This is why the premise table above was computed
independently of the linter rather than read out of it** — and it is how the one dead premise was
found, since `pr-scopecards-s8g` is not even on disk to be linted.

**Every `requires_*` gate target, resolved against `origin/main`.**

| gate | target | on main? |
|---|---|---|
| `requires_on_main` | `docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` | ✅ file yes, needle 1 |
| `requires_on_main` | `apps/api/.../travel-time.ts :: TRAVEL_TIME_PORT_V1` (s8b, s8g) | ✅ file yes, needle 2 |
| `requires_on_main` | `apps/api/.../geoapify-route.provider.ts :: GEOAPIFY_ROUTE_TRAVEL_V1` (s8h) | ✅ **RELEASED**, needle 2 |
| `requires_on_main` | `apps/api/.../otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` (a1, a2) | file yes, needle **0** — live, waiting on open `#2148` |
| `requires_on_main` | `docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` | ❌ file absent |
| `requires_file_on_main` | `docs/approvals/rates-b-slice2-canonical-approved-by-marco.md` | ❌ absent |
| `requires_file_on_main` | `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | ❌ absent |
| `requires_file_on_main` | `docs/approvals/retire-tenderclientnote-s2-approved-by-marco.md` | ❌ absent |
| `requires_file_on_main` | `docs/approvals/siteid-notnull-backfill-approved-by-marco.md` | ❌ absent |
| `requires_file_on_main` | `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | ❌ absent |
| `requires_file_on_main` | `apps/api/src/modules/forms/ai-form-import.service.ts` | ❌ absent |
| `requires_file_on_main` | `apps/api/src/modules/forms/form-digests.service.ts` | ❌ absent |

`docs/approvals/` on `origin/main` holds exactly **two** files — `README.md` and
`watcher-identity-approved-by-marco.md`. NEGATIVE control, file-exists on a minted approvals path →
false. **None of these gates is dead.** Every one names a target that a real, identifiable piece of
work would create. **I repaired nothing.**

**Part 0(a) AUTHORIZATION PARITY — mandatory, run every time. ZERO new offenders, with the positive
control the station doc requires.** [MEASURED] over `origin/main:apps/web/src/`:
bare `permissions.includes(` call sites = **5**; of those, **5** carry `isSuperUser` within ±5 lines
(the POSITIVE control — a blind grep cannot be mistaken for a clean result); **0** without.
`<Navigate` occurrences = 44; of those, **18** are permission-bearing, and **18 of 18** route through
`can()` / `isAdminUser` / `RequirePermissions` or test `isSuperUser` directly; **0** do not.
NEGATIVE control, minted needle over `apps/web/src` → 0. Sanctioned helpers intact:
`apps/web/src/auth/permissions.ts` carries `isSuperUser` ×2, `can(` ×2, `isAdminUser` ×1;
`SettingsShell.tsx` carries `RequirePermissions` ×2.

**Part 0(e) MIGRATION ORDERING — clean.** 268 migration folders on main: **58** bare `YYYYMMDD_`,
189 full 14-digit, 21 other. All **58** bare-prefix folders are named inside
`apps/api/src/common/__tests__/migration-naming.guard.spec.ts` (149 lines). **NEW offenders the guard
does not cover: 0.** POSITIVE control, newest folder = `20260924000000_scopecards_s8g_geoapify_routing`
(14-digit, correct). NEGATIVE control, folders matching the minted needle = 0.

**Part 0(f) ENV DRIFT.** 51 distinct `process.env.X` names in `apps/api/src`; `.env.example` is
12,276 bytes. POSITIVE control `DATABASE_URL` present → true; NEGATIVE control minted needle → false.
**One name referenced in `apps/api` and absent from `.env.example`: `PORT`.**

**Sub-checks NOT run this cycle:** (b) permission-code integrity + route reachability, (c) destructive-
delete hazard, (d) enum/lookup drift. Next Part 0 run should take (b) and (c).

**The arming-log two-count comparison — DOCTRINE §9.5's own falsifying probe, and it FIRED.** See F8.
[MEASURED] `git show origin/main:docs/pr-prompts/.arming-log.txt` → **151** non-blank lines;
`readFileSync` of the working copy → **153**. Counted in node with `split('\n')`, never with
`Measure-Object -Line` (§9.3). A 2-line excess on a tree 2 behind `origin/main` is ambiguous on its
own — §9.2 records that a ` M` there can be a file already committed upstream — so it was settled with
the probe that answers rather than the one that hints:
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **`2  0`**. Two lines added in
the working copy, **zero** deleted: the arms are local and are on `origin/main` nowhere. POSITIVE
control, the same call on `sweep-rotation.json` (known modified) → `2  2`; NEGATIVE control, the same
call on `CLAUDE.md` (known unmodified) → **EMPTY**.

**Orphaned worktree holding uncommitted work.** [MEASURED] from the sweep's section 2 `[LIVE]` lines:
`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd` on `fix/pipeline-scripts-resolve-state-paths-from-module`
— **dirty=2 files, age 157 min** — and `C:/po-wt/fv2drop` @ `817339c3`, dirty=0, age 92 min. The
sweep's own note: *"HOLDS UNCOMMITTED WORK (2 file(s)). PRESERVE OR COMMIT BEFORE PRUNING; 'git
worktree remove' will refuse, and --force would discard it."* That branch's PR (`#2154`) merged at
08:35Z, so the branch is spent but the two uncommitted files are not accounted for anywhere.

**Sweep `[LIVE]` line I did NOT propagate.** `watcher clone: branch=main dirty=1 <-- NOT clean-on-main;
the watcher may refuse to start`. DOCTRINE §9.5 records this exact line as a measured
`status-sweep.ps1` defect whose second conjunct is false (a tracked-dirty clone auto-stashes; the
flag counts untracked files the watcher explicitly ignores), and names it the SURVIVING live instance.
Provenance is not correctness. I did not re-derive it from `git status --porcelain --untracked-files=no`
against the clone, so I am **not** reporting it as a watcher-health claim in either direction.

## WHAT CHANGED

**One file, and it is the one the rotation contract requires me to leave dirty.**

`docs/pipeline/sweep-rotation.json` — advanced with
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-24T10:11:34Z`, exit **0**.
Read back from the file itself, not from the script's own claim:
before `last_index=3 last_run_utc=2026-09-24T06:21:32Z`, after
`last_index=0 last_run_utc=2026-09-24T10:11:34Z last_station=04-scanner`.
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` (genuinely uncommitted,
not an artefact of the behind-HEAD read). `git diff --cached --name-status` → **EMPTY**, so no other
chat has staged anything that a commit of this path would carry (§9.2's shared-index rule).

🔴 **STATION 00 MUST COMMIT `docs/pipeline/sweep-rotation.json` WITH ITS NEXT BOARD PR.** I may not —
authority matrix: 04 *Create a PR: NO*, *Mutate the board: NO, read-only*, and the dev tree is on
`main`, which nobody commits to directly. If this advance is not committed, the next 04 run repeats
`gate-liveness` and the rotation silently stops turning. This has already happened twice
(measured 2026-09-02, 04's F6).

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No gate repaired. No PR
opened, updated or merged. No label touched. Nothing under `/sot/`. No Azure / Entra / SharePoint
contact of any kind. No `git` through the device bridge.

**This breadcrumb is UNTRACKED in the dev tree** at `docs/pr-prompts/` depth 1 (the live destination —
`docs/pr-prompts/reports/` is still absent from `origin/main`, per DOCTRINE §8.5's own probe). It
reaches nobody until Station 00's next board PR commits it. A breadcrumb filename matches no watcher
glob, so leaving it in the queue root arms nothing.

## FINDINGS

### F1 — `pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md` is finished work still tracked on `origin/main`

Its premise `! grep -rq "GEOAPIFY_ROUTE_TRAVEL_V1" apps/api/src` is **FALSE**: the marker is on main in
**5 files, 14 hits**. [MEASURED] `gh pr view 2161 -R GH-Mantova/ProjectOperations --json
number,state,title,mergedAt,headRefName`, exit 0 →
`{"headRefName":"feat/s8g-geoapify-road-routing","mergedAt":"2026-09-24T09:41:35Z","number":2161,
"state":"MERGED","title":"feat(tendering): S8g Geoapify road routing and editable traffic index"}`.
POSITIVE control, open `#2148` → exit 0 with `"state":"OPEN"`. NEGATIVE control, `#999997` asked for a
**server-supplied field** (`state`, not `number` alone — §9.4) → exit **1**, `GraphQL: Could not
resolve to a PullRequest`.

The prompt is deleted in the dev tree and **still tracked on `origin/main`**:
`git diff --numstat origin/main -- docs/pr-prompts/pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md`
→ `0 213`. Retiring it means committing that deletion (or moving it to `merged/` per §8.5) — a board
mutation I am forbidden from making.

⚠️ Do **not** generalise this to the other locally-deleted HOLD. `pr-fv2-formrule-contract-HOLD.md`
shows the same `0 103` shape, but its premise is still **TRUE** and its PR `#2158` is **OPEN and RED**.
§10.6: the premise dies on MERGE, not on OPEN. That one is correctly consumed-but-unfinished and must
be left exactly where it is.

**DISPATCHED** → Station 00: commit the deletion of
`docs/pr-prompts/pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md` in the next board PR,
alongside the rotation file. Re-run the premise first — it is one `git grep` — because a lane verdict
is only as of the minute it was taken (§10.1).

### F2 — one prompt on the whole board is ADMIT, and the board is armed=0

`pr-scopecards-s8h-traffic-index-ui-HOLD.md` — `lint-prompt.mjs` exit **0**:
`PROMOTE … (size 5)  GATE_RELEASED requires_on_main:
"apps/api/src/modules/tendering/providers/geoapify-route.provider.ts :: GEOAPIFY_ROUTE_TRAVEL_V1" is
now on origin/main — HOLD is ready to promote.` Its gate was released by the same `#2161` that killed
F1's premise, 90 minutes before this run. Its own premise is independently still **TRUE**
(`WASTE_TRAVEL_INDEX_UI_V1` in `apps/web/src` → 0 files, 0 hits), so this is real unfinished work, not
a duplicate. `escalates: true`, `gate_allow: none`, `size: 5`.

Duplicate check per §10.6, which is the test that runs before arming any ADMIT: the two open PRs are
`#2158` (forms) and `#2148` (auth); neither touches `apps/web/src` traffic-index UI, and s8h carries a
real marker token (`WASTE_TRAVEL_INDEX_UI_V1`) which appears **nowhere** on main — the marker test is
available here rather than the 4-of-40 fallback case.

ADMIT is necessary, not sufficient (§9.5): read the body before arming.

**DISPATCHED** → Station 00: arming is 00's alone, on Marco's authority. I staged nothing and renamed
nothing.

### F3 — the station doc's own Part 0(a) instruction names a backend path that does not exist on `origin/main`

`docs/pipeline/stations/04-scanner.md`, sub-check (a), asserts: *"Backend guards bypass on super-user:
`apps/api/src/common/auth/permissions.guard.ts` and `persona-permission.guard.ts` both `if
(request.user?.isSuperUser) return true;`"*.

[MEASURED] at `0f13c399`: `apps/api/src/common/auth/permissions.guard.ts` **EXISTS**, `isSuperUser` ×1.
`apps/api/src/common/auth/persona-permission.guard.ts` → `fatal: path … does not exist in
'origin/main'`. The file is real but lives at **`apps/api/src/modules/personas/persona-permission.guard.ts`**,
where `isSuperUser` = 1. POSITIVE control, `isSuperUser` across `apps/api/src` → **77 files, 208 hits**;
NEGATIVE control, minted needle → 0. Full guard census, all 8 `*.guard.ts` on main: super-aware are
`common/auth/permissions.guard.ts`, `common/auth/super-user.guard.ts`,
`modules/personas/persona-permission.guard.ts`, `modules/safety/realtime/safety-realtime.guard.ts`.

🔴 **The mechanism is intact; the citation is not — and the failure mode is §9.6 pointed at the auth
layer.** A run that probes the stated path with a counter that swallows git's non-zero exit gets a
silent **0** instead of an error. The available conclusion from `persona-permission.guard.ts
isSuperUser → 0` is *"the persona guard has lost its super-user bypass"* — a confident, coherent,
wrong S2 about authorization, filed against a file that is healthy and merely somewhere else. **This
run's first probe printed exactly that 0**, and it was caught only because a follow-up asked where the
file actually lives.

The same sub-check also leans on `apps/web/src/auth/__tests__/superuser-parity.guard.test.ts` as
*"automated enforcement"*. It is on main (42 lines) and it works — but it is a **hardcoded two-file
list**: `GUARDED_FILES = ["pages/directory/SubcontractorsPage.tsx",
"pages/projects/ProjectDetailPage.tsx"]`, with a positive control asserting each still uses `can()`.
It covers **2 of the 5** bare call sites measured above and cannot see a new offender in any other
file. That is a correctly-built regression guard, not codebase-wide enforcement, and the station doc's
*"report only NEW offenders it does not cover"* is doing more work than the reader is likely to notice.

Fixing this is a `docs/` edit — 00's recorded lane; 04 may not create a PR.

**DISPATCHED** → Station 00, two one-line corrections in one docs PR:
(i) re-point the path to `apps/api/src/modules/personas/persona-permission.guard.ts`, preferably as a
symbol anchor rather than a path (§9.5's opening rule);
(ii) state plainly that the parity guard covers a named two-file list, not `apps/web/src`.

### F4 — two destructive prompts are each held by a SINGLE gate, and it is a file only Marco can create

The rotation brief warns that repairing a Marco-approval gate can silently remove the only protection,
*"and two of those prompts DROP DATABASE TABLES"*. [MEASURED] which of the five approval-gated prompts
carry an independent human marker, by testing all three markers `lint-prompt.mjs` actually reads
(`watcher: do-not-arm` case-insensitive, `DO NOT ARM` case-sensitive, `Arm ONLY` case-insensitive):

| prompt | `do-not-arm` | `DO NOT ARM` | `Arm ONLY` | independent protections |
|---|---|---|---|---|
| `pr-524-rates-b-slice2-canonical` | false | **true** | **true** | 2 |
| `pr-retire-tenderclientnote-s2` | false | **true** | false | 2 |
| `pr-siteid-notnull-backfill` | **true** | false | false | 2 |
| **`pr-rates-s11c-drop-legacy-tables`** | false | false | false | **1 — the approval file alone** |
| **`pr-tenant-mt4-s2-ownership-migration`** | false | false | false | **1 — the approval file alone** |

`rates-s11c` drops the legacy rate tables; `tenant-mt4-s2` writes production data and adds three NOT
NULL constraints (its own `rollback_strategy` says the irreversible half is unrecoverable without a
CSV export taken in pre-flight). For both, `docs/approvals/<slug>-approved-by-marco.md` is the **only**
thing `lint-prompt.mjs` rejects on. **I repaired nothing and I am naming these so no future
gate-liveness run "repairs" them either** — the gate is not dead, it is unbuilt, and building it is
Marco writing the approval file.

**DEFERRED** — nothing to do while both approval files are absent. This becomes urgent the moment
either file appears on `origin/main` without a matching decision from Marco, or if a future run
proposes editing either prompt's `requires_file_on_main` key.

### F5 — the gate-liveness sweep brief instructs 04 to do something 04's authority matrix forbids

`docs/pipeline/sweep-rotation.json`, sweep `gate-liveness`, says: *"Repair dead requires_merged /
requires_file_on_main / requires_on_main gates."* Repairing a gate means editing a prompt file and
landing it. `STATION-CAPABILITIES.md` §5 gives 04 **Create a PR: ❌** and **Mutate the board: ❌
read-only**, and `04-scanner.md`'s AUTHORITY section says 04 *"stages a lint-clean prompt as `-HOLD`
and surfaces it … does not disarm, rename, move or delete any prompt either."*

It cost nothing this run — no gate was dead, so the instruction never fired. It is worth fixing before
one is: the brief's own escape hatch (*"If the prompt is destructive … REPORT IT AND REPAIR NOTHING"*)
reads as an exception to a general permission 04 does not have, which invites a future run to repair a
non-destructive one. This is the same shape as the line the AUTHORITY section already records fixing —
*"This line used to read 'and commit that file with your breadcrumb', which asked 04 to do the one
thing 04 is forbidden to do."*

**DISPATCHED** → Station 00: reword the `gate-liveness` brief to *"report dead gates and stage the
repair as a `-HOLD` prompt"*, in the same PR that commits the rotation advance.

### F6 — an orphaned worktree is holding two uncommitted files on a branch whose PR already merged

`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd`, branch
`fix/pipeline-scripts-resolve-state-paths-from-module`, **dirty=2 files, age 157 min** at sweep time.
That branch's PR `#2154` merged 2026-09-24T08:35Z, so the branch is spent — but two files in it are in
no commit anywhere. `git worktree remove` will refuse, and `--force` discards them silently. The sweep
names the safe first step: `git -C C:/po-worktrees/sup-cwd-paths status --porcelain`.
`C:/po-wt/fv2drop` @ `817339c3` is dirty=0 and carries no such risk.

Worktree teardown is *Repair the machines* — Station 03's row, and 03 is report-only without a dispatch
from 00. 04 is read-only on all of it.

**DISPATCHED** → Station 00, to dispatch 03: list the two files first, preserve or commit whatever they
are, and only then prune. ⚠️ The age is [LIVE] as of 10:11:34Z and `[LIVE]` means *true when measured*
— re-measure immediately before acting.

### F7 — `PORT` is read in `apps/api` and is absent from `.env.example`

Part 0(f), [MEASURED] at `0f13c399`: of 51 distinct `process.env.X` names in `apps/api/src`, exactly one
has no `NAME=` line in `.env.example` (12,276 bytes) — **`PORT`**. POSITIVE control `DATABASE_URL`
present → true; NEGATIVE control minted needle → false.

Almost certainly benign: `PORT` is supplied by the App Service host rather than by a developer's `.env`,
which is why nobody has missed it. But `.env.example` is what a new developer copies, and a silent
fallback port is the class of thing that is only ever noticed at 2am.

**DEFERRED** — one line in `.env.example` with a comment saying the platform supplies it. Becomes urgent
if a local-dev onboarding failure is ever traced to a port default, or if `PORT` acquires a
non-obvious fallback in code.

### F8 — the arming-log publication gap has RE-OPENED: two arms are recorded locally and on `origin/main` nowhere

DOCTRINE §9.5 records this gap as closed on 2026-09-04 (*"both sides are 50 lines"*) and names the
two-line-count comparison as the falsifying probe to re-run before quoting either half. **I re-ran it
and it fired.**

[MEASURED] at `0f13c399`: `origin/main` copy = **151** non-blank lines, working copy = **153**, and
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **`2  0`** — two lines added,
zero deleted, so this is not the behind-HEAD artefact §9.2 warns about. POSITIVE control
`sweep-rotation.json` → `2  2`; NEGATIVE control `CLAUDE.md` → EMPTY. Counted in node with
`split('\n')`, never `Measure-Object -Line` (§9.3, which notes that instrument under-reports **both**
sides of this very comparison and can therefore hide or manufacture the gap it is meant to police).

The underlying defect is the one §9.5 already states and is untouched: **nothing commits the arming
log on purpose.** The only commits that have ever carried it were board PRs that happened to sweep it
in, so the gap closes and re-opens by luck — and this is the re-open. While it is open, a clone, CI or
any second lane reads a **stale** arm history rather than an absent one, which is the more dangerous
shape: it answers, and its answer is wrong.

Consequences, stated as §9.5 does: **an arm age read from `origin/main` is a LOWER bound this run, not
the answer**, and any run that arms something must commit the log in its board PR.

**DISPATCHED** → Station 00: commit `docs/pr-prompts/.arming-log.txt` in the next board PR, alongside
the rotation advance (WHAT CHANGED) and F1's deletion — one PR discharges all three. Re-run the
numstat first; it is one call and it is this finding's own falsifying probe.

## WHAT I DID NOT DO

- **Repaired no gate.** Zero dead gates were found; F4 names the two whose only gate is an unbuilt
  Marco approval, and the brief's own rule is report-and-repair-nothing.
- **Armed, staged, renamed, moved or deleted no prompt.** F2 is a dispatch to 00, not an arm. 04 arms
  nothing, ever.
- **Committed nothing.** The rotation advance and this breadcrumb are both left dirty/untracked in the
  dev tree for 00 to sweep up. 04 has *Create a PR: NO*.
- **Minted no worktree** (AUTHORITY: an orphan's lock has no holding process by construction, forever).
  `origin/main` was read with `git show` / `git grep` / `git ls-tree` at a named SHA throughout.
- **Ran no `git` through the device bridge**, despite the guard reporting itself INERT (exit 2). Every
  `git` call went to the Windows host via Desktop Commander.
- **Did not re-derive the sweep's `watcher clone: dirty=1` line** from `git status --porcelain
  --untracked-files=no`, so I make no claim about watcher-clone health in either direction. DOCTRINE
  §9.5 records that line as a measured sweep defect and as the surviving live instance of
  *provenance is not correctness*; propagating it un-re-derived is what mis-routed three dispatches
  to 03 before.
- **Did not commit the arming log** (F8), the rotation advance, or F1's deletion, though all three
  belong in one board PR. 04 has *Create a PR: NO*; naming them here is the whole of my lane.
- **Did not run Part 0 sub-checks (b), (c) or (d)**, nor Part 1's Dependabot pass, nor Part 2's live-site
  visual patrol. The named sweep was gate-liveness and it was covered completely; a shallow pass over
  everything is what the rotation exists to prevent. Next Part 0 cycle should take (b) and (c).
- **Did not touch `/sot/`** (05's, CP-24), production data, any label, or Azure / Entra / SharePoint in
  any form.
