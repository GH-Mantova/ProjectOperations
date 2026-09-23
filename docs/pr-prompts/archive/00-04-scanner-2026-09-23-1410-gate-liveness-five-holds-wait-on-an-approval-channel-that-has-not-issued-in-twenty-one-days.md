# Station 04 — Scanner | 2026-09-23T14:10Z–2026-09-23T14:2xZ

Sweep this run: **gate-liveness** (rotation position 1 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Previous rotation run 2026-09-23T06:10:31Z.

🟢 **THIS RUN WAS SIGHTED.** Saying so loudly because the three 04 occurrences before it were not:
`…2026-09-23-1010-blind-device-bridge-down`, `…09-22-2211-blind-…`, `…09-22-1411-BLIND-…`. A blind
run and a healthy quiet run both produce "no news", and four of the last six 04 breadcrumbs are
blindness reports.

## GROUND

```
UTC            2026-09-23T14:10Z  (host is Brisbane UTC+10; local clock read 2026-09-24 00:10)
origin/main    4421531f            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4421531f     C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**. This run was not read-only on that account.

## WHAT I MEASURED

**Preflight.**

- [MEASURED] Desktop Commander reached the box. `start_process` shell `powershell.exe` → PID 16204,
  then PID 36448. Not blind.
- [MEASURED] **`vm-git-guard.sh` exit code = `2`**, headline verbatim:
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Its own controls, quoted from the installer: `bash -lc 'command -v git'` →
  `/sessions/laughing-relaxed-curie/.local/bin/git` (the shim); `bash -c 'command -v git'` →
  `/usr/bin/git` (the real git). This is the EXPECTED station outcome, a finding and not a stop.
  **Consequence honoured for the whole run: every `git` and `gh` call below ran in PowerShell on the
  Windows host, never through the device bridge.** Exit code read from the installer itself, not
  from a pipeline appended to it.
- [MEASURED] Freshness of the three binding documents, by the sound form (`git diff --numstat
  origin/main -- <path>`, EMPTY = not different), never by a piped hash:
  `docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`,
  `docs/pipeline/stations/04-scanner.md` → **EMPTY output for all three**, and
  `git rev-list --left-right --count HEAD...origin/main` → `0	0`. The dev tree IS `origin/main`, so
  reading these from disk is sound this run. All three were read in full.
- [MEASURED] Cross-check that the `git show` transport works, independent of me:
  `triage-holds.ps1`'s own GIT control reported reading `origin/main:docs/pipeline/DOCTRINE.md` as
  **215487 chars**, and `wc -c` on the working copy returns **215487**. Two transports, one number.

**Board state, from `scripts/pipeline/status-sweep.ps1`** (captured with `*>` and decoded
`utf16le` — the capture was 136,238 bytes opening `FF FE`, i.e. the §9.3 redirection trap, avoided):

- [MEASURED] section 0 instrument controls: `gh CAN reach GitHub (saw merged PR #2121)`, `node runs`.
  No `[BROKEN]`.
- [MEASURED] section 7 verdict: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.`
- [MEASURED] `[LIVE] OPEN PRs: 0`. `[LIVE] main CI on 4421531f: 4 success / 0 failed (trunk green)`.
- [MEASURED] `[LIVE] armed (*-ready.md): 0`. `[LIVE] git index.lock interactive/clone: False / False`.
- [MEASURED] watcher node RUNNING pid 9744, clone `branch=main dirty=0`, heartbeat 164 min
  (stale + empty queue = idle, not wedged).

**The sweep itself — gate liveness over the whole depth-1 corpus.**

- [MEASURED] corpus: **14 prompts at depth 1, HOLD=14, ready=0, LOOPING=0** (`rev-*` excluded).
- [MEASURED] `triage-holds.ps1` (read-only, `--dequeue` never passed), exit 0:
  `spent=0 of 14 · gates-satisfied=0 · still-gated=14 · unreadable=0`. Ten `[HUMAN_GATE_PRESENT]`,
  four `[FILE_GATE_NOT_RELEASED]`. Its SPENT control PASSED (lint emitted exit 3 on the fixture), so
  the spent bucket was measurable and genuinely empty. It re-probed all 14 REJECTs directly:
  **0 spent behind a REJECT, 14 still needed, 0 UNMEASURABLE.**
- ⚠️ [MEASURED] the script raised its own `!!! SUSPECT: every prompt landed in ONE bucket` warning.
  **Discharged, not ignored:** it asks that node and git both resolve for `lint-prompt.mjs`, and both
  positive controls above prove they do (GIT control read a 215,487-char blob; SPENT control produced
  an exit 3). The uniform bucket is the board's real shape, not a dead probe.

**Every dependency gate evaluated independently of lint**, because `lint-prompt.mjs` rejects on the
human gate BEFORE it reaches the dependency gates — so a lint exit of 1 says nothing at all about
whether a gate is live. Probe: `git show origin/main:<path>` per gate, needle tested in the returned
body. POSITIVE control `show('CLAUDE.md')` → non-null; NEGATIVE control
`show('zzQq04Needle20260924.md')` → null; POSITIVE `gh pr view 2121` → `MERGED 2026-09-23T13:25:46Z`;
NEGATIVE `gh pr view 999997` → exit 1. `-R GH-Mantova/ProjectOperations` passed on every `gh` call.

| prompt | gate | verdict |
|---|---|---|
| `pr-524-rates-b-slice2-canonical-HOLD.md` | `requires_file_on_main: docs/approvals/rates-b-slice2-canonical-approved-by-marco.md` | **NOT RELEASED** (file absent) |
| `pr-rates-s11c-drop-legacy-tables-HOLD.md` | `requires_file_on_main: docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | **NOT RELEASED** (file absent) |
| `pr-retire-tenderclientnote-s2-HOLD.md` | `requires_file_on_main: docs/approvals/retire-tenderclientnote-s2-approved-by-marco.md` | **NOT RELEASED** (file absent) |
| `pr-siteid-notnull-backfill-HOLD.md` | `requires_file_on_main: docs/approvals/siteid-notnull-backfill-approved-by-marco.md` | **NOT RELEASED** (file absent) |
| `pr-tenant-mt4-s2-ownership-migration-HOLD.md` | `requires_file_on_main: docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | **NOT RELEASED** (file absent) |
| `pr-fv2-ai-digests-HOLD.md` | `requires_file_on_main: apps/api/src/modules/forms/ai-form-import.service.ts` | **NOT RELEASED — and DEAD** (F1) |
| `pr-fv2-output-channels-HOLD.md` | `requires_file_on_main: apps/api/src/modules/forms/form-digests.service.ts` | **NOT RELEASED — and DEAD** (F1) |
| `pr-tipid-s3-retire-the-name-guard-…-HOLD.md` | `requires_on_main: scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH` | **SATISFIED** |
| `pr-tipid-s3-…-HOLD.md` | `requires_on_main: docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` | **NOT RELEASED** (file absent) |
| `pr-tipid-s3-…-HOLD.md` | `requires_on_main: docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED` | **NOT RELEASED** (file absent) |
| `pr-queue-layout-sot-entry-HOLD.md` | `requires_on_main: docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` | **SATISFIED** (F3) |
| `pr-scopecards-s8b-azure-maps-travel-HOLD.md` | `requires_on_main: apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1` | **SATISFIED** (F4) |

Four prompts carry **no dependency gate at all** and are held purely by a human gate:
`pr-devtree-sync-ff-only-guard-HOLD.md`, `pr-fv2-formrule-contract-HOLD.md`,
`pr-nav-jobs-projects-merge-HOLD.md`, `pr-vendor-invoice-ocr-HOLD.md`.

**TALLY: 12 dependency gates across 10 prompts — 3 SATISFIED, 9 NOT RELEASED. 0 prompts spent.**

- [MEASURED] the one gate that could plausibly have been a false SATISFIED was checked in its own
  right. `NO MATCH` is a two-word English phrase, so it was probed for accidental matching:
  `scripts/rates/backfill-waste-map-location-ids.mjs` (29,363 chars on `origin/main`) carries it on
  **4** lines, two of which are the literal values the script emits (`? "NO MATCH"`,
  `? "NO MATCH (ambiguous)"`). Lowercase control `no match` → 0; fresh negative needle → 0. It is a
  real marker and the gate is genuinely satisfied.

- ⚠️ [MEASURED] **my own first gate probe under-reported, and I caught it before writing it down.** A
  line filter anchored at `^requires_` printed the KEY line only and silently dropped indented YAML
  list values, so `pr-tipid-s3-…-HOLD.md` read as carrying an EMPTY `requires_on_main:` — which would
  have been filed as "a gate that asserts nothing". Reading the raw front matter shows a **three-item
  list**. The available wrong finding was a fabricated defect in the linter; the real answer is that
  `lint-prompt.mjs` validates empty gates explicitly (it carries both
  `requires_on_main is empty. Provide at least one path…` and
  `requires_on_main has an empty value…`). **A filter that answers about LINES cannot answer about
  VALUES.** The table above was rebuilt with a parser that handles scalar and list forms.

- [MEASURED] `git log origin/main -- docs/approvals/` — the approvals directory holds exactly two
  files on `origin/main` (`README.md`, `watcher-identity-approved-by-marco.md`) and its newest commit
  is **2026-09-02** (`#1502`, watcher identity). No approval artifact has been issued in **21 days**.

- [MEASURED] `git worktree list` → `C:/po-wt/s9hex f878a0a1 (detached HEAD)`; `Test-Path` → True;
  sweep section 2 reports `dirty=0 files age=477 min`, classified `orphaned worktree (aborted run
  leftover)`.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced with
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-23T14:10:00Z`, exit 0, which printed
  `advanced: last_index=0 last_run_utc=2026-09-23T14:10:00Z` and `LEFT DIRTY: name this file in your
  breadcrumb.` 🔴 **IT IS LEFT DIRTY IN THE DEV TREE AND STATION 00 MUST COMMIT IT — I may not.**
  Read back: `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`;
  `git diff --numstat origin/main` → `2	2	docs/pipeline/sweep-rotation.json`;
  `git diff --cached --name-status` → EMPTY (nothing of another chat's was staged, so no pathspec
  collision).
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked until a board PR
  commits it** — Station 00 sweeps it up. It is not in any of the five gitignored `docs/qa/` sinks.
- 🔴 **Both of the above are untracked-or-modified paths in the dev tree and WILL BLOCK the next
  `git merge --ff-only`** once a PR lands them on `main`. Station 00 should collect them rather than
  restore them. Two further untracked paths were already there and are **not mine**:
  `Claude Design/docs/index.html` and `docs/pr-reviews/pr-2119-review.md` (the review lane writing
  into the dev tree — DOCTRINE §9.5's three-homes behaviour).
- **Nothing else.** No prompt armed, disarmed, renamed, moved, staged or deleted. No gate repaired.
  No PR opened, merged or labelled. No `sot/` edit.

## FINDINGS

### F1 — the fv2 dead gate is now 5.8 days unanswered, and it is the ONLY genuinely dead gate on the board

Two prompts are parked behind files that **no producer on the board will ever create**:
`pr-fv2-ai-digests-HOLD.md` waits on `apps/api/src/modules/forms/ai-form-import.service.ts`, and
behind it `pr-fv2-output-channels-HOLD.md` waits on `form-digests.service.ts` — the artifact the
first prompt would have produced. [MEASURED] at `4421531f`, re-verified per §7.1's re-read rule
rather than quoted from the existing artifact: both files **ABSENT** from `origin/main`
(`git ls-tree -r --name-only origin/main | Select-String 'form-import'` → **0 hits**; POSITIVE
control `ai-form-describe` → 1 hit, the file is really there; NEGATIVE control, a fresh needle → 0).
The producers `superseded\pr-fv2-ai-import-HOLD.md`, `superseded\pr-fv2-ai-describe-HOLD.md` and
`superseded\pr-fv2-import-s1-docx-and-persona-HOLD.md` are all retired.

The question is **already filed** and does not need re-filing:
`docs/pr-prompts/needs-marco/fv2-ai-import-digests-output-channels-cluster-still-wanted-2026-09-17.md`
(mtime [MEASURED] `2026-09-17T18:34:40Z` → **5.8 days** at this run's start). It carries the RULE 1
options already, complete-and-additive first. What is new is only its **age**, and that 04 has now
re-found the same dead gate on 2026-09-15, 2026-09-17, 2026-09-21 and today — four sweeps, one
unanswered question. Filing a second artifact would be the collision the lane rules forbid.

**DISPOSITION: ESCALATED** — the artifact exists and the ask is unchanged; Station 00's collect
should surface it to Marco by age rather than let a fifth sweep re-derive it.

### F2 — five of fourteen HOLDs wait on an approval channel that has issued nothing in 21 days

[MEASURED] `docs/approvals/` on `origin/main` holds two files; newest commit **2026-09-02**. Five
HOLDs — `pr-524-rates-b-slice2-canonical`, `pr-rates-s11c-drop-legacy-tables`,
`pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`, `pr-tenant-mt4-s2-ownership-migration`
— each wait on a `docs/approvals/<slug>-approved-by-marco.md` that only Marco can create. That is
**36% of the parked board held by one artifact class with a 21-day empty queue.**

🔴 **I repaired none of them, deliberately, and the sweep brief is why:** `docs/approvals/README.md`
records that for this class the dependency gate being dead was *the only thing lint rejected on*, so
repairing the gate would silently remove the protection. Two of these are destructive —
`pr-rates-s11c-drop-legacy-tables` DROPS TABLES (`rollback_strategy: PERMANENT / NOT auto-revertable
once merged`) and `pr-tenant-mt4-s2-ownership-migration` writes PRODUCTION DATA. This is the gate
working exactly as designed, not a defect.

One consequence worth naming: `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` is
**transitively** behind this class — its third gate needs
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED`, which is
`pr-rates-s11c`'s own `done_when` artifact. So the approval on s11c releases two prompts, not one.

**DISPOSITION: DEFERRED** — real, correct, and not now. What makes it urgent: Marco wanting any of
these five slices to ship. The single action that unblocks the most board is the s11c approval.

### F3 — `pr-queue-layout-sot-entry-HOLD.md` is gate-released and parked on a reasonless human gate, in Station 05's lane

[MEASURED] its only dependency gate — `docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` — is
**SATISFIED** on `origin/main` (file present, needle present; controls as above). `lint-prompt.mjs`
rejects it `[HUMAN_GATE_PRESENT]` and never reaches that gate, so the triage bucket "still gated"
concealed a released gate. Its human gate is a **bare** `<!-- watcher: do-not-arm -->` at line 16
with no stated reason — unlike `pr-scopecards-s8b`, whose marker names its precondition inline.

Its `scope:` is a single entry: `sot/02-roadmap-and-status.md`. **That is Station 05's lane and
nobody else's** (CP-24; only 05 edits `sot/`), so I am surfacing it, not staging it.

**DISPOSITION: DISPATCHED to Station 05** — the dependency gate is released; what remains is a
`do-not-arm` marker carrying no reason on a prompt that touches only `sot/`. 05 should decide
whether the marker still means anything, and record the reason in the prompt if it does.

### F4 — `pr-scopecards-s8b-azure-maps-travel-HOLD.md` is gate-released but sits behind the absolute Azure hard stop

[MEASURED] `apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1` is **SATISFIED** on
`origin/main`. Its human gate at line 27 reads, quoted:
`<!-- watcher: do-not-arm | MARCO GATE: arm only after Marco has created the Azure Maps account and
told Station 06 how the API authenticates (key in the vault, …`

This is the one case where a satisfied gate must NOT be read as "nearly ready". The precondition is
an **Azure account and its auth configuration**, which is the absolute hard stop binding every
station — no portal, no Entra, no secrets, not once. The prompt is correctly and permanently parked
until Marco acts, and a future sweep meeting "gate satisfied, only a marker left" should not read it
as an arming candidate.

**DISPOSITION: DEFERRED** — what makes it actionable: Marco creating the Azure Maps account and
handing the auth method to Station 06. No agent may take a step toward it.

### F5 — one orphaned worktree, 8 hours old, clean

[MEASURED] `git worktree list` → `C:/po-wt/s9hex f878a0a1 (detached HEAD)`, confirmed on disk by
`Test-Path` → True; `status-sweep.ps1` section 2 classifies it `orphaned worktree (aborted run
leftover — investigate/prune)`, `dirty=0 files`, `age=477 min`. It holds no uncommitted work, and
`index.lock` is False in both trees, so it is freezing nothing today. Pruning a worktree is a
machine-repair action and 04 is report-only on those.

**DISPOSITION: DISPATCHED to Station 03** — prune or adopt `C:/po-wt/s9hex`; it is clean, so this is
hygiene rather than recovery.

## WHAT I DID NOT DO

- **Repaired no gate**, including the two genuinely dead fv2 ones. 04 is READ-ONLY on the board and
  cannot open the PR a repair would need; and the sweep brief forbids repairing the Marco-approval
  class outright.
- **Staged no prompt, not even as `-HOLD`.** Nothing in this run's findings is a prompt-shaped fix:
  F1 and F2 are Marco's decisions, F3 is 05's lane, F4 is an absolute hard stop, F5 is 03's.
- **Did not write into `docs/pr-prompts/needs-marco/`.** That channel is Station 00's; a second actor
  writing there is the collision the lane rules exist to prevent — which is exactly why F1's
  disposition points at the existing artifact instead of minting a rival one.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** The dev tree is on `main`, nobody commits
  to `main` directly, and 04's authority row is *Create a PR: NO*.
- **Did not run the other three rotation slots** (instrument-honesty, repo-hygiene,
  instruction-drift). `next-sweep.mjs` chose gate-liveness and one sweep covered completely beats
  four covered shallowly. Repo hygiene was last covered 2026-09-23T02:30Z and instruction drift
  2026-09-23T06:10Z, both inside a day.
- **Did not run Part 2 live-site work.** The rotation slot is a static sweep and the turn budget went
  to covering all 14 prompts' gates independently of the linter rather than to a partial live pass.
- **Did not touch Azure, Entra or SharePoint**, and did not act on F4 beyond quoting its marker.
- **Did not run `git` through the device bridge.** The guard reported itself INERT (exit 2), so the
  ban was remembered rather than mechanical, and it was honoured: every git call was host-side.
