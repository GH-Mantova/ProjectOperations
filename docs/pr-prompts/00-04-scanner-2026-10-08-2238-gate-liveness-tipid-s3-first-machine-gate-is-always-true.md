# Station 04 — Scanner | 2026-10-08T22:38:44Z–2026-10-08T23:3xZ

## GROUND

```
UTC            2026-10-08T22:38:44Z
origin/main    375f4386            (git fetch origin --prune, then git rev-parse origin/main)
dev tree       main @ 375f4386     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task file claimed station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only by the mismatch
clause. It was read-only on the board anyway, by Station 04's own authority row.

Sweep this run: **gate-liveness** (rotation position 1 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`; previous run `2026-10-07T02:10:17Z`.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` →
`PROBE_OK 2026-10-08T22:38:44Z`. **NOT BLIND.** The first probe of the run died with a
`ParserError`, which is the §9.1 trap, not blindness — see the shell note below.

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit code read from the installer itself with no pipeline appended:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Exit 2 is the outcome the station doc records as EXPECTED for a station. No `git` was run
through the device bridge against the Windows `.git` at any point in this run; every `git`
call was a `powershell.exe` call on the host.

**Status sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, exit 0, runtime 188 s.
Section 0 positive controls both PASS (`gh` reached GitHub, saw merged #2264; `node` runs).
Section 7 verdict: **SAFE TO ACT** — no board mutation in progress, no recent remote activity,
no live station worktrees. Re-read immediately before anything that mutates; this run mutated
nothing on the board.

Relevant [LIVE] lines: 1 open PR (#2261, BEHIND, CI 13 pass / 2 fail, labelled `do-not-merge`,
open 43 h); `main` CI on `375f4386` → 4 success / 0 failed, trunk green; watcher node RUNNING
pid 8848, wrapper alive; armed (`*-ready.md`) = **0**; `needs-marco/` 54, `no-pr-opened/` 111,
`failed/` 80, `blocked/` 201; board lease free; no build in flight.

**Sweep corpus.** [MEASURED] 13 `-HOLD.md` at depth 1 of `docs/pr-prompts`, 0 `*-ready.md`.

**BOARD TRAP — clear.** [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
filtered to `^docs/pr-prompts/[^/]+\.md$`: **no `*-ready.md` tracked at depth 1.** POSITIVE
control on the same reading: all 14 `-HOLD.md` files ARE listed, so the glob is not blind.

**Gate corpus.** [MEASURED] `scripts/pipeline/triage-holds.ps1` (read-only, `--dequeue` never
passed). Its own controls PASSED — `GIT control: PASS` (read `origin/main:docs/pipeline/DOCTRINE.md`,
30282 chars) and `SPENT control: PASS` (lint exit 3 on the fixture). Result:
`spent=0 of 13  gates-satisfied=0  still-gated=13  unreadable=0`, and it re-probed all 13
premises directly — **0 spent behind a REJECT, 13 still needed, 0 UNMEASURABLE.** So no HOLD
on this board is finished work still sitting there.

Reject codes, which are NOT uniform: `HUMAN_GATE_PRESENT` ×8, `FILE_GATE_NOT_RELEASED` ×4,
`GATE_NOT_RELEASED` ×1.

**Independent gate probe — I did not take lint's word for it.** [MEASURED]
`C:\po-sup-fix-scripts\st04-gate-probe.mjs`, which resolves every `requires_file_on_main` and
`requires_on_main` entry with `git -C C:\ProjectOperations2 show origin/main:<path>` and tests
the token in the returned bytes. Controls: POSITIVE file `docs/pipeline/DOCTRINE.md` → PRESENT;
NEGATIVE file `docs/zz-needle-st04-1009.md` → ABSENT; POSITIVE token `THE READ-BACK RULE` in
DOCTRINE → HIT; NEGATIVE token `ZZQ4K7-ST04-1009` (minted this run) → MISS.

| prompt | gate | reading on `375f4386` |
|---|---|---|
| pr-524-rates-b-slice2-canonical | file `docs/approvals/rates-b-slice2-canonical-approved-by-marco.md` | ABSENT → HELD |
| pr-rates-s11c-drop-legacy-tables | file `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | ABSENT → HELD |
| pr-retire-tenderclientnote-s2 | file `docs/approvals/retire-tenderclientnote-s2-approved-by-marco.md` | ABSENT → HELD |
| pr-siteid-notnull-backfill | file `docs/approvals/siteid-notnull-backfill-approved-by-marco.md` | ABSENT → HELD |
| pr-tenant-mt4-s2-ownership-migration | file `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | ABSENT → HELD |
| pr-fv2-ai-digests | file `apps/api/src/modules/forms/ai-form-import.service.ts` | ABSENT → HELD |
| pr-fv2-output-channels | file `apps/api/src/modules/forms/form-digests.service.ts` | ABSENT → HELD |
| pr-queue-layout-sot-entry | `docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` | TOKEN HIT → **RELEASED** |
| pr-scopecards-s8b-azure-maps-travel | `apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1` | TOKEN HIT → **RELEASED** |
| pr-sec-a2-email-codes-and-reset-links | `apps/api/src/modules/auth/otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` | TOKEN HIT → **RELEASED** |
| pr-tipid-s3 | `scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH` | TOKEN HIT → **RELEASED (see F1)** |
| pr-tipid-s3 | `docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` | FILE ABSENT → HELD |
| pr-tipid-s3 | `docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED` | FILE ABSENT → HELD |
| pr-nav-jobs-projects-merge | (no `requires_*` key) | n/a |
| pr-vendor-invoice-ocr | (no `requires_*` key) | n/a |

**Human-gate instrument, proven before use.** [MEASURED] I read the actual anchors out of
`origin/main:scripts/pipeline/lint-prompt.mjs` rather than guessing them — three markers:
`<!-- watcher: do-not-arm -->`, a CASE-SENSITIVE `DO NOT ARM` line, and an `Arm ONLY` line.
My first pass used an invented pattern and matched only 4 of 8; recorded here because that
first pass would have produced a confident wrong finding. Re-run with the real anchors:

```
pr-524-rates-b-slice2-canonical-HOLD.md        comment=0 DO-NOT-ARM-caps=1 Arm-ONLY=1
pr-nav-jobs-projects-merge-HOLD.md             comment=1 DO-NOT-ARM-caps=0 Arm-ONLY=0
pr-queue-layout-sot-entry-HOLD.md              comment=1 DO-NOT-ARM-caps=0 Arm-ONLY=0
pr-retire-tenderclientnote-s2-HOLD.md          comment=0 DO-NOT-ARM-caps=1 Arm-ONLY=0
pr-scopecards-s8b-azure-maps-travel-HOLD.md    comment=1 DO-NOT-ARM-caps=0 Arm-ONLY=0
pr-sec-a2-email-codes-and-reset-links-HOLD.md  comment=1 DO-NOT-ARM-caps=0 Arm-ONLY=0
pr-siteid-notnull-backfill-HOLD.md             comment=1 DO-NOT-ARM-caps=0 Arm-ONLY=0
pr-vendor-invoice-ocr-HOLD.md                  comment=1 DO-NOT-ARM-caps=1 Arm-ONLY=0
```

POSITIVE control: `pr-fv2-ai-digests-HOLD.md`, which lint rejected on `FILE_GATE_NOT_RELEASED`
rather than a human gate → **0 markers**, as expected. NEGATIVE control: minted needle
`ZZQ4K7-ST04-1009` → 0 hits across all 9 files. All 8 `HUMAN_GATE_PRESENT` prompts carry a
real marker; the instrument is sound.

**Dev-tree fast-forward readings.** [MEASURED] all four the station doc names, in
`C:\ProjectOperations2`:

```
git rev-list --left-right --count HEAD...origin/main   -> 0	0
git diff --numstat                                     -> 1	0	docs/pr-prompts/.arming-log.txt
                                                          0	148	docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md
git diff --cached --name-status                         -> (EMPTY)
git status --porcelain (tracked)                        ->  M docs/pr-prompts/.arming-log.txt
                                                            D docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md
git update-index --refresh                              -> exit 1, both paths "needs update"
```

**The §9.1 `$` trap, reproduced twice this run, once SILENTLY.** [MEASURED] A `-Command` string
containing `$_` reached PowerShell as bare `_`: `git ls-files docs/pr-prompts | Where-Object
{ -not (_ -match '/') }` **exited without error and returned all 11,786 tracked paths** instead
of the ~21 at depth 1 — a plausible, well-formed, wrong answer. The earlier failure
(`$env:COMPUTERNAME` → ParserError) was loud. The quiet one is the dangerous shape §9.1 names.
Everything with a `$` after that point was put in a `.ps1` under `C:\po-sup-fix-scripts\` and
run with `-File`. [INFERRED] nothing new here — this is DOCTRINE §9.1 behaving exactly as
written; it is recorded only because the quiet variant is the one that produces findings.

## WHAT CHANGED

**On the board: nothing.** No prompt was armed, disarmed, renamed, moved, deleted or staged.
No PR was opened, labelled, updated or merged. No `/sot/` file was touched. Nothing was
committed or pushed.

Two writes outside the board, both named here so Station 00 can sweep them:

1. `docs/pipeline/sweep-rotation.json` — **left dirty in the dev tree.** [MEASURED]
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-08T22:38:44Z` →
   `advanced: last_index=0 last_run_utc=2026-10-08T22:38:44Z`, read back as
   ` M docs/pipeline/sweep-rotation.json`. The script itself prints "LEFT DIRTY: name this file
   in your breadcrumb. Station 00 commits it". Station 04 may not commit to the shared dev tree.
2. This breadcrumb, written to `C:\ProjectOperations2\docs\pr-prompts\` — untracked until a
   board PR commits it.

Scratch scripts were written to `C:\po-sup-fix-scripts\` (`st04-*.ps1`, `st04-*.mjs`), which is
outside the repo and dirties nothing.

## FINDINGS

### F1 — `pr-tipid-s3`'s FIRST machine gate is always-true, and its own body advertises three

The prompt's body says: *"ENFORCED BY THREE MACHINE GATES, NOT BY THIS PARAGRAPH"* and
*"The three `requires_on_main` gates below are untouched and are still checked even after
arming"*. [MEASURED] its front matter on `origin/main`:

```yaml
requires_on_main:
  - scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH
  - docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO
  - docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED
```

`NO MATCH` is not a release marker. [MEASURED] in that script on `origin/main` it is the
script's own human-readable FAILURE label:

```
  A near miss is reported as NO MATCH and is a finding, not something to guess at.
  "WARNING: not one active TIP carries a facility string. Every row below will
   report NO MATCH. MapLocation is seeded nowhere ..."
  p.status === "NO_MATCH" || p.status === "NO_FACILITY_CELL" ? "NO MATCH"
    : p.status === "AMBIGUOUS" ? "NO MATCH (ambiguous)" : p.mapLocationId;
```

[MEASURED] the script's actual receipt markers come from `renderReceipt`:
`const token = counts.unmatched === 0 ? "BACKFILL_UNMATCHED_ZERO" : "BACKFILL_UNMATCHED_NONZERO";`
— and `BACKFILL_UNMATCHED_ZERO` is already what gate 2 names, in the audit file the script
writes. So gate 1 was almost certainly meant to be a bare "the backfill script exists on main"
file gate, and was written with a token copied out of the script's logging.

**Consequence:** gate 1 released the instant the script landed and can never hold. The prompt
has TWO effective gates, not three. It is `escalates: true` and it REMOVES A LIVE SAFETY CHECK
— the 409 rename guard in `map-locations.service.ts` that protects the legacy table which still
prices every job — and its human layer was already released by Marco on 2026-09-24. The two
remaining gates (both files ABSENT from `main`) are currently the whole of the protection.

**Blast radius / history (angles 4–5).** [MEASURED] `status-sweep.ps1` section 6 already
registers the family: *"the STEP-\*-DONE.md marker convention lets a ONE-LINE STUB arm a
destructive successor. Cousin of lint-reject-noop-file-gate — there the gated file always
existed; here the file was real but its CONTENT proved nothing. A landed-marker should carry a
verify-line the next slice can grep."* This is a measured instance of that systemic issue, one
step worse: the token is a string the file carries for an unrelated reason, so the gate is
true by construction rather than merely weak. I checked the other 12 HOLDs' tokens for the same
shape; no other token on this board resolves to a logging or prose literal.

**I REPAIRED NOTHING, deliberately.** My sweep brief is explicit: *"If the prompt is
destructive, or its other gates are already satisfied, REPORT IT AND REPAIR NOTHING."* This
prompt removes a live safety check, and a one-token edit to a gate on a prompt of that class is
not a Station 04 decision made unattended at 22:40Z.

**DISPOSITION: DISPATCHED** — to **Station 00**. What is handed over: replace the
`scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH` entry with the gate that was
intended (either a bare file gate on that path, or a `:: BACKFILL_UNMATCHED_ZERO`-class marker
the script actually emits as a verdict), and fix the body line that claims three enforced
gates. The prompt stays correctly held by gates 2 and 3 meanwhile, so this is not urgent — but
it must land BEFORE either of those two files appears on `main`, because at that moment the
prompt promotes with one of its three stated preconditions never having been checked.

### F2 — three HOLDs are machine-ready and held ONLY by Marco's `do-not-arm` marker

[MEASURED] `requires_on_main` RELEASED on `375f4386` for all three, and lint's sole rejection
reason for each is `HUMAN_GATE_PRESENT` from one `<!-- watcher: do-not-arm -->` comment:

| prompt | released gate | `escalates` | other gates |
|---|---|---|---|
| `pr-queue-layout-sot-entry-HOLD.md` | `QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` | false | none |
| `pr-scopecards-s8b-azure-maps-travel-HOLD.md` | `travel-time.ts :: TRAVEL_TIME_PORT_V1` | true | none |
| `pr-sec-a2-email-codes-and-reset-links-HOLD.md` | `otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` | true | none |

This is exactly the shape `docs/approvals/README.md` warns about, and the reason my brief says
to check it: for these three the dependency gate is **dead (released)** and the human marker is
the ONLY remaining protection. Repairing or removing the dead machine gate would leave the
prompt resting on one HTML comment. [MEASURED] all three premises were re-probed by
`triage-holds.ps1` and are still TRUE, so the work is genuinely outstanding, not spent.

**I REPAIRED NOTHING and STAGED NOTHING.** Removing a `do-not-arm` marker is a human act by
construction; Station 04 cannot arm and must not pre-clear a human gate.

**DISPOSITION: ESCALATED** — the question for Marco is in `## FOR MARCO` below.

### F3 — the dev tree is holding a DELETED tracked HOLD file, which will block the next fast-forward

[MEASURED] readings quoted above. `docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md` is
tracked on `origin/main` (148 lines) and **deleted in the dev tree working copy**;
`docs/pr-prompts/.arming-log.txt` is modified. `git diff --cached` is EMPTY and
`rev-list --left-right --count` is `0 0` — both documented PASS readings — so the only reading
that catches this is `git status --porcelain`, plus `git update-index --refresh` exit 1.

`HEAD == origin/main` right now, so nothing is blocked *today*. The moment `main` moves,
`git merge --ff-only` in the dev tree is at risk on that path, which is every station's problem.

[MEASURED] the matching open PR: `gh pr view 2261` → `fix/gitpush-worktree-mandatory-v1`, files
`["scripts/pipeline/pipeline-lib.ps1"]`, labels `["do-not-merge"]`, CI 13 pass / 2 fail. So the
work this HOLD describes is in flight and unmerged, and the local deletion is a consumed-prompt
artefact that was never committed. The prompt is a `-HOLD`, not armed, so nothing re-fires.

**DISPOSITION: DISPATCHED** — to **Station 00**, which is the only station that may commit to
the shared dev tree. Either commit the retirement properly (the queue layout says retiring means
MOVING, to `superseded/` naming #2261 inside it, per DOCTRINE §10.6), or restore the path
byte-exactly from `HEAD` with a raw-Buffer node write and `git update-index --refresh`. Station
04 must not use `git checkout -- <path>` or `git clean` here (DOCTRINE §9.2) and did not.

### F4 — `triage-holds.ps1`'s SUSPECT heuristic cries wolf on any legitimately all-gated board

[MEASURED] the script ended its run with:

```
!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a broken
!!! probe, not of a uniform board. Prove node and git both resolve for
!!! lint-prompt.mjs (DOCTRINE 9.5 ...) before believing this run.
```

But in the same output its OWN two positive controls PASSED (`GIT control: PASS` reading 30282
chars from `origin/main`, `SPENT control: PASS` with lint exit 3 on the fixture), and its 13
rejections carry **three distinct codes** (`HUMAN_GATE_PRESENT` ×8, `FILE_GATE_NOT_RELEASED` ×4,
`GATE_NOT_RELEASED` ×1) sourced from two different mechanisms. A broken probe does not produce
three codes from two mechanisms with both controls green.

[INFERRED] the heuristic keys on *bucket uniformity* and ignores two signals the script already
has in hand — whether its controls passed, and whether the reject codes are diverse. With
`armed=0` and every HOLD correctly gated, which is the normal resting state of a quiet board,
it fires every time. The cost is the §7 failure in reverse: a reader who obeys it discards a
sound run, and a reader who learns to ignore it has lost a real alarm.

**DISPOSITION: DISPATCHED** — to **Station 00**. Suggested narrowing: suppress the SUSPECT
banner when both positive controls PASSED **and** the single bucket contains more than one
distinct reject code; keep it when the controls failed or every reject carries the same code
(which IS the broken-probe signature it was written for). Station 04 is read-only on the board
and may not land a script change.

### F5 — `vm-git-guard.sh` is INSTALLED BUT INERT (exit 2)

[MEASURED] quoted verbatim under WHAT I MEASURED, with the exit code read from the installer
itself and no pipeline appended. The installer's own explanation: it writes its `PATH` export
into `~/.bashrc` and `~/.profile`, and a station's shell is non-interactive and non-login, so
it sources neither. `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` →
`/usr/bin/git`.

So the device-bridge git ban is REMEMBERED, not mechanical, for this run as for every run the
station doc records. This is the documented EXPECTED outcome, not an anomaly — filed because the
station doc requires it to be visible in the report, and because an install nobody can see in a
report is indistinguishable from one that never ran.

**DISPOSITION: DEFERRED** — real, already documented, and not actionable by Station 04. It
becomes urgent if the exit code ever changes: a **non-zero other than 2** means the shim was not
written at all, and a **0** means the protection genuinely became mechanical and the station
docs' "remembered, not mechanical" wording is then the stale instruction.

## FOR MARCO

**F2 — three prompts are machine-ready and waiting only on your `do-not-arm` marker.** Their
dependency gates have all released on `main`; nothing in the codebase is holding them. Two of
the three carry `escalates: true`.

- `pr-sec-a2-email-codes-and-reset-links` — field-worker sign-in codes and client-portal reset
  links have no delivery channel in production, so neither sign-in path can be used there.
- `pr-scopecards-s8b-azure-maps-travel` — real road travel time behind the travel-time port;
  travel is still a straight line times a factor. Additive migration (two nullable columns).
- `pr-queue-layout-sot-entry` — a 2-point docs slice putting `QUEUE_LAYOUT_V1` into `sot/`.

**RULE 1 — complete-and-additive option first:**

1. **Release them one at a time, in that order, and let the normal lane drive each PR.**
   Complete: each lands the real capability permanently, and `escalates: true` already blocks
   the merge so the PR stops for you anyway. Additive: s8b adds two nullable snapshot columns
   and is provider-selected at runtime, so unsetting configuration reverts it with no data
   change; sec-a2 adds a delivery port implementation; queue-layout is docs only. **Passes both
   halves.** Note that `sec-a2`'s delivery channel will need mail configuration, which is yours
   — no agent will touch it.
2. Release only `pr-queue-layout-sot-entry` now and leave the other two marked. Fails the
   *complete* half: the two production gaps stay open with nothing in the codebase holding them,
   which is the state that makes a released gate look like a blocked one on the next sweep.
3. Leave all three marked. Fails the *complete* half outright, and the dead machine gates mean
   every future gate-liveness sweep will re-surface them as released-but-held.

**Nothing in F2 was touched.** No marker was removed, nothing was armed or staged.

**F1 is not a question for you** — it is a one-token gate repair dispatched to Station 00, and
the prompt stays held meanwhile. It is named here only because the prompt it affects removes a
live safety check and was released by you on 2026-09-24.

## WHAT I DID NOT DO

- **One sweep only, covered completely.** `next-sweep.mjs` assigned **gate-liveness** and that
  is all I ran. Instrument honesty, repo hygiene and instruction drift were deliberately left
  for the next three rotations. F3/F4/F5 are inside gate-liveness' own blast radius (the queue's
  tracked state and the two instruments that read gates), not a second sweep.
- **Staged no prompt.** My brief authorises staging a gate repair as `-HOLD`; both candidate
  repairs (F1, F4) were withheld — F1 because the prompt removes a live safety check and the
  brief says REPAIR NOTHING in that case, F4 because it is a script change and Station 04 may
  not land one. Budget used: 0 of 2.
- **No live-site pass, no visual pass, no Part 0 static audit, no GitHub reconciliation audit.**
  The station contract's rotation gives this run ONE named sweep; a shallow pass over everything
  is what the rotation exists to prevent. Not blocked — not in this run's lane.
- **Did not clear, prune or touch any worktree.** `status-sweep.ps1` reported 30 non-main
  worktrees, ~27 classified orphaned, several holding unpushed commits and two holding
  uncommitted work (`C:/po-worktrees/sup-cwd-paths`, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1`),
  plus 2 registry escapees. That is **Station 03's** lane and 03 is report-only on it; I am
  recording the count here only so it is not lost, not diagnosing it.
- **Did not act on the backlog.** `status-sweep.ps1` section 6 reports `ready=1`
  (`rates-11c-blocked-consumers`), `needs-marco=2`, `blocked=4`. Its own note says that item's
  slices are already staged and it stays registered until its gate dies. Arming is Station 00's.
- **Did not touch `#2261`.** Open, BEHIND, CI 2 fail, labelled `do-not-merge`. Station 04 never
  merges and never removes that label.
- **Did not run `check-breadcrumb.mjs` before writing this file**, obviously; it is run below.
- **Did not write to any of the five gitignored `docs/qa/` sinks.** Everything is here, at a
  tracked path. This file is UNTRACKED until a board PR commits it — Station 00 must sweep it.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or `C:\po-watcher\`.**

## VALIDATOR

[MEASURED] exit code read with NO pipeline appended (`node ... > file 2>&1` then
`$LASTEXITCODE`), because `| Select-Object -Last N` would have reported the pipeline's status
instead — the same trap the PREFLIGHT block records for the guard installer:

```
cd C:\ProjectOperations2
node scripts\pipeline\check-breadcrumb.mjs
-> check-breadcrumb.mjs TRUE EXIT = 0
-> NOTE  00-04-scanner-2026-10-08-2238-...md is UNTRACKED — it reaches nobody until a board PR commits it
-> ADMIT 00-04-scanner-2026-10-08-2238-...md
-> structure: 2 checked, 0 malformed, 0 skipped as pre-contract
-> CLEAN
```

**breadcrumb-clean**, on the authority of `check-breadcrumb.mjs` exit 0 — not of `lint-prompt.mjs`,
which was never run against this file and returns no meaningful verdict on a breadcrumb.

Both files this run leaves behind, for Station 00's COLLECT:

- `docs/pr-prompts/00-04-scanner-2026-10-08-2238-gate-liveness-tipid-s3-first-machine-gate-is-always-true.md` (this file, UNTRACKED)
- `docs/pipeline/sweep-rotation.json` (MODIFIED, rotation advanced to `last_index=0`)
