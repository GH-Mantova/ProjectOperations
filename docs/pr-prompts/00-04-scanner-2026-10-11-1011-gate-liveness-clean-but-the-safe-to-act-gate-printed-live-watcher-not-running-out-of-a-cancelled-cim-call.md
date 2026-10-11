# Station 04 — Scanner | 2026-10-11T10:11Z–2026-10-11T10:36Z

## GROUND

```
UTC            2026-10-11T10:11:00Z   (host shell; [DateTime]::UtcNow)
origin/main    bf245896               (git fetch origin exit 0, then git rev-parse origin/main)
dev tree       main @ bf245896        C:\ProjectOperations2   (HEAD == origin/main)
doc version    1                      (docs/pipeline/stations/04-scanner.md front matter, read from origin/main)
bootstrap      1                      (scheduled-task SKILL.md station_doc_version)
```

Version check: doc version 1 == bootstrap 1. **No mismatch — this run was NOT read-only on its own
account**, though Station 04 is read-only on the board by authority regardless.

**This run was SIGHTED.** Desktop Commander connected after two keyword `ToolSearch` calls for
`desktop-commander` (the first returned "still connecting" — an unloaded schema, not blindness;
BOOTSTRAP_PREFLIGHT_V1). All three preflight documents were read in full from
`git show origin/main:<path>` in the dev tree after `git fetch origin` (exit 0):
`04-scanner.md` (571 lines), `DOCTRINE.md` (508 lines), `STATION-CAPABILITIES.md` (740 lines).

**Sweep this run: `gate-liveness`** — assigned by `node scripts/pipeline/next-sweep.mjs`
(rotation position 1 of 4; previous run 2026-10-11T02:09:31Z), not chosen.

**Git guard: INSTALLED BUT INERT, exit 2.** Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/nifty-optimistic-carson/.local/bin:$PATH" git <args>
```

Exit code `2`, read from the installer itself and not from a pipeline appended to it. This is the
EXPECTED station outcome, a FINDING and not a STOP. Its headline was
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
**I ran zero VM-side `git` this run.** Every `git` call below was native `git.exe` on the Windows
host in the dev tree.

---

## WHAT I MEASURED

**1. The board is EMPTY of armed prompts, and the board trap is clean. [MEASURED]**

```
Get-ChildItem docs\pr-prompts\*-ready.md -File   ->  0 files
Get-ChildItem docs\pr-prompts\*-HOLD.md  -File   ->  16 files
git ls-tree --name-only origin/main -- docs/pr-prompts/ | Select-String '(-ready\.md|-HOLD\.md)$'
   ->  16 rows, every one a *-HOLD.md; ZERO tracked *-ready.md at depth 1
```

**No tracked `*-ready.md` at depth 1, so THE BOARD TRAP is not firing this run.** All 16 HOLDs are
tracked on `origin/main`, which is correct for the hold state.

**2. All 16 HOLDs linted by EXIT CODE, not by grepping stdout. [MEASURED]**
`node scripts/pipeline/lint-prompt.mjs <path>` per HOLD, `$LASTEXITCODE` captured per call:

```
EXIT=0  (ADMIT)  pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md
EXIT=0  (ADMIT)  pr-sweep-section5-dedupe-and-fast-switch-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-524-rates-b-slice2-canonical-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-nav-jobs-projects-merge-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-queue-layout-sot-entry-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-retire-tenderclientnote-s2-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-scopecards-s8b-azure-maps-travel-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-sec-a2-email-codes-and-reset-links-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-siteid-notnull-backfill-HOLD.md
EXIT=1  HUMAN_GATE_PRESENT        pr-vendor-invoice-ocr-HOLD.md
EXIT=1  FILE_GATE_NOT_RELEASED    pr-fv2-ai-digests-HOLD.md
EXIT=1  FILE_GATE_NOT_RELEASED    pr-fv2-output-channels-HOLD.md
EXIT=1  FILE_GATE_NOT_RELEASED    pr-rates-s11c-drop-legacy-tables-HOLD.md
EXIT=1  FILE_GATE_NOT_RELEASED    pr-tenant-mt4-s2-ownership-migration-HOLD.md
EXIT=1  GATE_NOT_RELEASED         pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md
EXIT=1  PR_GATE_NOT_RELEASED      pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md
```

**14 REJECT, 2 ADMIT, and ZERO exit-3 (SPENT).** So by this instrument no prompt on the board is
finished work. ADMIT is necessary and **not** sufficient — see F1.

**3. Every gate target absent from `origin/main`, re-measured after my first probe lied. [MEASURED]**
Controls first (§7), then the readings:

```
git rev-parse --verify --quiet origin/main:scripts/pipeline/lint-prompt.mjs
   -> blob=fe718c3d  POSITIVE_EXIT=0          <- the probe CAN produce a positive
git rev-parse --verify --quiet origin/main:docs/zz-needle-s04-20261011-1011.md
   -> NEGATIVE_EXIT=1                         <- minted needle path, correctly absent

exit=1   apps/api/src/modules/forms/ai-form-import.service.ts
exit=1   apps/api/src/modules/forms/form-digests.service.ts
exit=1   docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md
exit=1   docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md
exit=1   docs/audits/waste-map-location-backfill.md
```

All five absences are REAL (exit 1 against a calibrated 0/1 pair), not instrument failures.

**4. No dead gate has a LIVE producer, and the producers that exist are all retired. [MEASURED]**
`git grep -l -F <target> origin/main -- docs/pr-prompts/` per target, with controls:

```
POSITIVE control  git grep -c -F "requires_file_on_main" origin/main -- docs/pr-prompts/
                  -> 160+ rows across queue root, archive, needs-marco, superseded
NEGATIVE control  git grep -c -F "ZZNEEDLE-S04-20261011" origin/main -- docs/pr-prompts/
                  -> 0 rows, NEG_GREP_EXIT=1
```

Producers, per target (queue-root and `superseded/` rows only; archive rows are reports):

```
ai-form-import.service.ts   -> pr-fv2-ai-digests-HOLD.md (the consumer),
                               superseded/pr-fv2-ai-describe-HOLD.md, superseded/pr-fv2-ai-import-HOLD.md
form-digests.service.ts     -> pr-fv2-ai-digests-HOLD.md, pr-fv2-output-channels-HOLD.md (both consumers)
rates-s11c ...approved-by-marco.md      -> pr-rates-s11c-drop-legacy-tables-HOLD.md (the consumer) only
tenant-mt4-s2 ...approved-by-marco.md   -> pr-tenant-mt4-s2-ownership-migration-HOLD.md (the consumer) only
waste-map-location-backfill.md          -> pr-tipid-s3-...-HOLD.md (the consumer),
                                           superseded/pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md
```

```
gh pr list --state open --json files  ->  0 of the 5 targets is produced by any OPEN PR
```

**Every producer is either the consumer itself or a file in `superseded/`.** So nothing currently
on the board or in flight will create any of these five files. That is the definition of a dead
gate — and per the sweep's own brief I repaired none of them (see F3/F4).

**5. Premises evaluated INDEPENDENTLY of lint, because a dead gate masks the premise behind it.
[MEASURED]** Needle tested against `git show origin/main:<path>` bytes:

```
pr-lint-prompt-refuse-a-hold-whose-pr-is-open
   path=scripts/pipeline/lint-prompt.mjs   needle "SPENT_HOLD_PR_OPEN" present=False
   premise is '! grep -q ...'  ->  PREMISE_STILL_TRUE=True
pr-sweep-section5-dedupe-and-fast-switch
   path=scripts/pipeline/status-sweep.ps1  needle "SkipSection5" present=False
   premise is '! grep -q ...'  ->  PREMISE_STILL_TRUE=True
pr-tipid-s3-retire-the-name-guard
   path=apps/api/.../map-locations.service.ts  needle "Cannot rename facility from" present=True
   premise is 'grep -q ...'    ->  PREMISE_STILL_TRUE=True
```

**All three live premises are STILL TRUE, so none of these prompts is spent** — agreeing with the
zero exit-3s in §2 by a second, independent instrument.

⚠️ **My control for this harness was badly chosen and I am recording that rather than hiding it.**
I picked `SPENT_HOLD_PR_OPEN` in `lint-prompt.mjs` as the POSITIVE control; it is **genuinely
absent** from `main` (that string is the content of open PR #2303), so both controls read `False`
and the harness was UNCALIBRATED at that moment. It was calibrated a line later by the tipid-s3
row, which returned `present=True` from the same harness — that is the positive this run actually
relies on. A reader must not take the `False` pair above as a working negative control.

**6. tipid-s3 carries TWO `requires_on_main` gates and lint reports only the first. [MEASURED]**
Front matter, read from the file:

```
requires_on_main:
  - docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO
  - docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED

git rev-parse --verify --quiet origin/main:docs/data-model/rates-migration/STEP-11C-DONE.md
   -> exit=1  (absent)
```

Both are absent. Lint's message names only the first. See F4.

**7. `status-sweep.ps1` printed a POSITIVE FALSE CLAIM out of a cancelled call, and tagged it
`[LIVE]`. [MEASURED]** Verbatim, from my own run at 10:11:56Z:

```
==================== 2. WATCHER (running process, not a file) ====================
Get-CimInstance : Call was canceled by the message filter.
At C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1:263 char:8
+ $w = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Wher ...
    + FullyQualifiedErrorId : HRESULT 0x80010002,...GetCimInstanceCommand
  [LIVE] watcher node: NOT RUNNING  <-- the queue will not drain
```

The CIM call **failed**, and `@( ... )` turned the failure into an empty array, which the next line
compared against zero and reported as a measured fact under the `[LIVE]` tag — the tag this tool's
own header defines as *"GitHub or a running process (authoritative)"*. This is DOCTRINE §7 standing
guard 2 verbatim — *"never let a failed call flow into a comparison"* — inside the pipeline's own
safe-to-act gate. See F2.

**8. Sections 0 and 1 DID complete and are quotable; sections 2 onward did not. [MEASURED]**

```
[LIVE] gh CAN reach GitHub (saw merged PR #2311)       <- instrument positive control
[LIVE] node runs
[LIVE] OPEN PRs: 2
[LIVE]    #2303  BEHIND  CI: 11 pass / 4 fail / 0 pending   labels=[do-not-merge]
[LIVE]    #2294  BEHIND  CI: 13 pass / 2 fail / 0 pending   labels=[do-not-merge]
[LIVE] WAITING ON MARCO: 2 open PRs labelled do-not-merge; oldest #2294, open 38h
[LIVE] main CI on bf245896: 4 success / 0 failed / 0 running  (trunk green)
```

My sweep shell then sat `Blocked: true` for **1054 seconds** with no further output and was
terminated. **I quote no SAFE / CAUTION / DO-NOT-ACT verdict**, so I mutated nothing on the board.

**9. The host condition behind §7 and §8 is Station 00's F1, already measured this morning, and I
did not re-measure it. [INFERRED from 00's breadcrumbs, not from my own probe]**
00's uncollected `...2026-10-11-0943-...` breadcrumb records 1017 `powershell` + 1017 `conhost`
processes, 21,175 threads, 993 of 1017 shells sharing one `-EncodedCommand` session-host command
line behind 26 parent PIDs, and its own `status-sweep.ps1` *"started 09:51Z, still running at
10:25Z (>34 min, incomplete)"*. **My wedge at 10:11Z and my cancelled CIM call are the same
condition, not independent defects** — and I deliberately did not re-run the CIM census, because
00's 0943 run spent >20 minutes on exactly that and adding shells to a thread-starved box is the
one thing this run must not do.

⚠️ **Watcher liveness: [CANNOT MEASURE] by me.** The only reading I obtained was the false-positive
one in §7, which I discard. 00's F2 reports the watcher node and its restart wrapper both down with
a 415-minute heartbeat, measured properly. **I make no liveness claim of my own**; with 0 armed
prompts nothing is starving regardless.

---

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json` was advanced and LEFT DIRTY.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-11T10:11:00Z` -> exit 0,
   `advanced: last_index=0 last_run_utc=2026-10-11T10:11:00Z`, read back as
   `last_index=0 last_run_utc=2026-10-11T10:11:00Z last_station=04-scanner`.
   **Station 00 must commit this file** — Station 04 may not commit to the shared dev tree.
   `git diff --cached --name-status` was **EMPTY** before and after, so nothing of another chat's
   is staged alongside it.
2. **This breadcrumb was written** to `C:\ProjectOperations2\docs\pr-prompts\`, untracked. It
   reaches nobody until a board PR commits it, and it is named here so `sweep-breadcrumbs.ps1`
   finds it.
3. **Six read-only diagnostic `.ps1` were written to `C:\po-sup-fix-scripts\`** (the sanctioned
   scratch location, STATION-CAPABILITIES §4): `s04-2026-10-11-nextsweep.ps1`,
   `-statussweep.ps1`, `-board-census.ps1`, `-deadgate.ps1`, `-deadgate2.ps1`, `-premises.ps1`,
   `-tipid.ps1`, `-advance.ps1`, `-read00.ps1`. None mutates anything.
4. **One stray process terminated: PID 74340** — my own wedged `status-sweep.ps1` shell, started by
   this run, command line written by me, 1054 s old with no output. **Not a kill under 00's F1**:
   one identified process of my own, not a member of the orphan cohort.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened, merged,
updated, closed or labelled. No `/sot/` file touched. No escalation retired. No breadcrumb archived
or `git mv`'d. No board lease taken. No worktree created or removed. No lock cleared. No commit on
`main`. No VM-side `git`. No scheduled task touched. No Azure / Entra / SharePoint contact of any
kind.

---

## FINDINGS

### F1 — The only two armable prompts on the board are the two whose own work is already sitting in an OPEN PR, and the gate that would catch it is the content of one of those very PRs.

[MEASURED] The two exit-0 ADMITs cross-referenced against `gh pr list --state open --json
number,title,headRefName,labels,files`:

```
pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md  (ADMIT)
   -> PR #2303 "fix(pipeline): refuse a HOLD whose own PR is already open"
      head=fix/pipeline-spent-hold-pr-open  labels=[do-not-merge]  CI 11 pass / 4 FAIL
      files include: scripts/pipeline/lint-prompt.mjs,
                     scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs,
                     docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md

pr-sweep-section5-dedupe-and-fast-switch-HOLD.md       (ADMIT)
   -> PR #2294 "fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch"
      head=fix/sweep-section5-dedupe-and-fast-switch  labels=[do-not-merge]  CI 13 pass / 2 FAIL
      files include: scripts/pipeline/status-sweep.ps1,
                     docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md,
                     docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md
```

Each PR's file list contains the `superseded/` destination for its own prompt — i.e. each PR is the
thing that retires the prompt that still lints ADMIT. Arming either would send the watcher to
rebuild work already in flight (DOCTRINE §10.6 arriving from the opposite direction: here the
prompt's OWN PR came first and the prompt stayed armable).

**The self-reference is the whole difficulty.** The guard that closes this hole is the
`SPENT_HOLD_PR_OPEN` check, and §5 measured that string **absent from `lint-prompt.mjs` on
`origin/main`** — because it is the content of #2303, which is RED and `do-not-merge`. So the hole
stays open for exactly as long as its own fix is parked, and the window is precisely when a station
looking for something to arm finds a board with two parked PRs and nothing else. This is at least
the **fourth consecutive** reproduction: the prompt body records 2026-10-10T01:2xZ plus the two
preceding 00 runs on 2026-10-09.

Already filed with Marco as
`docs/pr-prompts/needs-marco/spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`
([MEASURED] still on `origin/main`, `git rev-parse --verify` exit 0), so I am **not** asking a
second time.

**DISPOSITION: DEFERRED** — real, already with Marco, and not urgent only because no station has
armed either prompt. **What would make it urgent:** any `*-ready.md` appearing at depth 1 that
matches one of those two slugs, or #2303 merging while its own prompt stays in the queue root. The
cheap interim protection costs nobody a decision: while both PRs are `do-not-merge`, neither prompt
should be armed by anyone, and a station that reads ADMIT here must cross it against
`gh pr list --state open --json files` before arming — which is what this finding records so the
next run does not have to rediscover it.

### F2 — `status-sweep.ps1` turns a FAILED `Get-CimInstance` into `[LIVE] watcher node: NOT RUNNING`. The safe-to-act gate violates DOCTRINE §7 standing guard 2 in its own section 2.

[MEASURED] Full transcript in §7 above. The mechanism is three lines at
`scripts/pipeline/status-sweep.ps1:263`: the `Get-CimInstance Win32_Process` call fails
(`HRESULT 0x80010002`, *"Call was canceled by the message filter"*), `@( ... )` coerces the failure
to an empty array, and the count-against-zero test downstream reports **NOT RUNNING** as a fact
tagged `[LIVE]`.

This is not the same defect as "section 5 never finishes" (#2294) and not the same as 00's F5
("did not finish in 34 minutes") or its §12 note that section 3 *"printed its header and never its
body"*. Those are **absences**, and an absence is honest — a reader gets nothing and knows it.
**This is a positive false claim**, and DOCTRINE §7 is explicit that it is the worse failure:
*"a broken instrument hands you a confident, coherent, WRONG verdict, and then you act on it."*
The tool's own header instructs the reader *"Report ONLY from `[LIVE]` lines"*, so a station
obeying the header is told to trust exactly this line.

⚠️ **And today it printed the truth, which is why nobody has caught it.** 00's F2 independently
measured the watcher down with a 415-minute heartbeat. So on 2026-10-11 the fail-open and reality
agree — the lie is invisible in this hour and would be believed in an hour when it is wrong. That
coincidence is the finding, not a mitigation. It also means the ONE case this matters most is the
one the host condition makes most likely: whenever threads are starved, CIM fails, and the gate
reports the watcher dead whether or not it is.

**Interaction with §9:** the trigger (thread exhaustion, 21,175 threads) is 00's F1 and is Marco's
to resolve. The **fail-open is a separate, standing code defect** that outlives the storm: once
threads recover, this line still reports NOT RUNNING on any future CIM failure.

**DISPOSITION: ESCALATED.** I did not stage a `-HOLD` repair, and the reason is a collision I must
not create: open PR #2294 already edits `scripts/pipeline/status-sweep.ps1`, and the staging rules
forbid staging anything already covered by an open PR. Two prompts editing one parked file is how a
conflicted branch loses its CI entirely. Options for Marco, RULE 1 ordered:

- **(a) COMPLETE AND ADDITIVE — fold a connect-then-assert guard into #2294 before it merges.**
  Passes both halves of RULE 1: it fixes the fail-open permanently and immediately, it damages no
  existing or future data entry (the change is `if ($? -eq $false) { report CANNOT MEASURE }` in
  place of a silent empty array), it adds no new file and no new PR, and #2294 is already the open
  PR that owns this file. It needs #2294's 2 red checks greened and the `do-not-merge` label
  removed, both of which are yours.
- **(b) Stage a follow-up `-HOLD` that lands AFTER #2294 merges, gated `requires_merged: 2294`.**
  Fails the *immediately* half of RULE 1: #2294 is RED and parked, so the fail-open stays live for
  as long as that PR does — which, at 38 hours and counting, is the status quo this finding exists
  to end. Damages nothing.
- **(c) Leave it and rely on readers noticing the error text above the `[LIVE]` line.**
  Fails the *completely* half: it is the arrangement that has already survived at least two runs
  unreported, and §7 records six prior instrument lies that each got through on the same reasoning.

I am not choosing between these — (a) requires removing a `do-not-merge` label, which only you do.

### F3 — Five dead gates, no live producer for any of them, and I repaired none — two of the five are the Marco-approval class the sweep brief forbids repairing.

[MEASURED] §3 and §4. The five absent gate targets, and why each is dead rather than merely waiting:

| consumer HOLD | gate target | only producer | verdict |
|---|---|---|---|
| `pr-fv2-ai-digests` | `.../forms/ai-form-import.service.ts` | `superseded/pr-fv2-ai-describe-HOLD.md`, `superseded/pr-fv2-ai-import-HOLD.md` | DEAD — both producers retired |
| `pr-fv2-output-channels` | `.../forms/form-digests.service.ts` | none but consumers | DEAD — no producer at all |
| `pr-rates-s11c-drop-legacy-tables` | `docs/approvals/rates-s11c-...-approved-by-marco.md` | Marco only | WAITING on Marco — **DROPS TABLES** |
| `pr-tenant-mt4-s2-ownership-migration` | `docs/approvals/tenant-mt4-s2-...-approved-by-marco.md` | Marco only | WAITING on Marco |
| `pr-tipid-s3-retire-the-name-guard` | `docs/audits/waste-map-location-backfill.md` | `superseded/pr-tipid-s2-...-HOLD.md` | DEAD — producer retired |

**I repaired nothing, and the brief is why.** `docs/approvals/README.md` records that for the
Marco-approval class the dependency gate being dead was *the only thing lint rejected on*, so
repairing it would silently remove the protection — and `pr-rates-s11c-drop-legacy-tables` **drops
database tables**. Repairing either approval gate would convert a human stop into an armable
prompt. That is the trap, and it is exactly the shape of DOCTRINE §5b: location and gate are the
contract, and a cautious-looking repair is not free.

The two fv2 gates and the tipid-s3 gate are not destructive, but they are **not repairable into
life** either: there is no producer to wait for, so a repaired gate would release a prompt whose
predecessor work does not exist. That is a design question about whether the fv2 chain is still
wanted at all — §5's hard stop 5, Marco's intent, which I will not guess.

Already filed as
`docs/pr-prompts/needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`
([MEASURED] still on `origin/main`, exit 0). That file is now **18 days old** and the channel has
issued nothing since.

**DISPOSITION: DEFERRED** — all five are already with Marco in one escalation; re-asking would be
the fourth time. **What would make it urgent:** any attempt to repair an approval gate (that is the
data-loss path), or the fv2 chain being needed for roadmap work, in which case the question changes
from *"issue the approval"* to *"is this chain retired?"* and should be asked as that.

### F4 — tipid-s3's SECOND gate is masked by its first, and the second is two levels behind the table-dropping approval — so repairing gate one would look like progress and release nothing.

[MEASURED] §6. `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` declares two
`requires_on_main` gates; `lint-prompt.mjs` names only the first:

```
gate 1  docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO        absent (exit 1)
gate 2  docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED  absent (exit 1)
```

Gate 2's target can only be produced by **rates-s11c** completing — the prompt in F3 that is itself
blocked on a Marco approval and that **drops `estimateWasteRate`**. So tipid-s3 sits behind a chain
that terminates in the single most destructive decision on the board. Its own front matter says as
much: *"It is deliberately the LAST slice — the guard protects the legacy table that still prices
every job."*

**Why this is worth recording rather than filing as new:** the archive shows prior runs worked
gate 1 in isolation — 00's `...2026-10-09-0015-...` breadcrumb is titled *"tipid-s3's dead gate is
repaired"* and 04's `...2026-10-08-2238-...` is titled *"tipid-s3 first machine gate is always
true"*. Gate 1 is the one that gets attention because it is the one lint prints. **A future run
repairing gate 1 will see the prompt still REJECT and may read that as a failed repair rather than
as a second gate doing its job.** The masking is the hazard, not either gate.

**DISPOSITION: DEFERRED** — the blocking decision is already F3's escalation, and nothing here
needs a separate ask. **What would make it urgent:** gate 1 being repaired or released, at which
point the next run must be told gate 2 exists or it will misdiagnose the continuing REJECT. That is
the sentence this finding exists to leave behind.

### F5 — Two of my own probes returned confident wrong answers before I calibrated them. Recording both, because the sweep I was running is the one that exists to catch this.

[MEASURED], twice each.

**(a) `git cat-file -e origin/main:<path>` returned exit 128 for all five targets**, not the
documented exit 1 for absent. Exit 128 is a git *error*, and I had written the probe to print the
exit code beside the word *"on origin/main?"* — so the output read as five clean absences when the
command had actually failed five times. Cured by `git rev-parse --verify --quiet`, with the 0/1
control pair in §3.

**(b) `Select-String -Path docs\pr-prompts\*.md -SimpleMatch <target>` returned EMPTY for all five
targets** — including for HOLD files whose front matter I had just read naming that exact path.
`git grep -l -F` over the same corpus returned 11–21 rows per target. A textbook DOCTRINE §9.6
*"an empty result is not an empty world"* in my own instrument, and had I reported from it I would
have written *"no prompt anywhere references these paths"*, which is the opposite of the truth and
would have made five dead gates look like five orphaned files.

**(c) And my premise harness ran uncalibrated for one reading** — see the ⚠️ note in §5. Both
controls read `False` because I chose a positive-control needle that is genuinely absent from
`main`.

All three share DOCTRINE §7's shape: **a failed or mis-scoped call read as a meaningful answer.**
Three in one run, in the hands of the station whose job is finding exactly this, is the useful
datum — not a reason for anyone to re-verify my §3/§4 numbers, which were re-measured with controls
after each failure and are the ones reported.

**DISPOSITION: ACTIONED** — each probe was replaced with a control-bracketed form in the same run,
and every number in WHAT I MEASURED comes from the corrected probe, never the broken one. Verified
by the control pairs quoted inline at §3 and §4. Nothing carried forward.

---

## WHAT I DID NOT DO

- **I did not stage any `-HOLD` prompt**, though the sweep brief authorises staging a gate repair
  and F2 is a defect I could have written. Two reasons, both binding: the F2 fix edits
  `scripts/pipeline/status-sweep.ps1`, which **open PR #2294 already edits** (staging rules forbid
  anything already covered by an open PR), and every gate repair F3 identifies is either
  destructive-class or has no producer to release it to. Staging into a parked file is how a branch
  goes conflicted and loses CI entirely.
- **I did not repair any dead gate.** Two of the five are the Marco-approval class, and
  `pr-rates-s11c-drop-legacy-tables` drops database tables. The sweep brief's own instruction is
  *"If the prompt is destructive, or its other gates are already satisfied, REPORT IT AND REPAIR
  NOTHING."*
- **I did not re-measure the host thread-exhaustion census.** 00's 0943 run spent >20 minutes on
  that exact CIM call and already identified the cohort (993/1017, 26 parent PIDs). Adding probe
  shells to a box at 21,175 threads would worsen the condition I would be measuring. Taken from
  00's breadcrumb and tagged `[INFERRED]` accordingly.
- **I claimed no watcher liveness verdict.** The only reading I obtained was F2's false positive,
  which I discarded. `restart-watcher-if-wedged.ps1` is the sole sanctioned probe and it is not
  Station 04's to run — the authority matrix gives 04 *"Repair the machines: ❌"*.
- **I quoted no SAFE / CAUTION / DO-NOT-ACT verdict and mutated nothing on the board**, because
  `status-sweep.ps1` never reached its verdict (§8). No prompt armed, disarmed, renamed or moved;
  no PR opened, merged or labelled; no lease taken.
- **I did not commit `sweep-rotation.json`**, or anything else. The dev tree is on `main` and
  Station 04 may not commit there — the advance is left dirty and named in WHAT CHANGED for 00.
- **I wrote no `breadcrumb-clean` claim.** `check-breadcrumb.mjs` is the only validator for this
  artifact; see the note below for whether it was run.
- **I did not run Part 0, Part 1 or Part 2** of the station brief (static cross-layer audit, GitHub
  reconciliation, live-site patrol). The contract is ONE named sweep per run, covered completely,
  and `next-sweep.mjs` assigned `gate-liveness`. A shallow pass over everything is the failure that
  rotation exists to prevent.
- **I touched nothing in Azure, Entra or SharePoint**, ran no `az` and no `Connect-MgGraph`, and
  wrote no production data.
- **I ran no VM-side `git`**, the guard having reported itself INERT (exit 2). An inert guard is
  not a licence.

---

## FOR MARCO

Two things need you, and only one is new.

**New — the pipeline's own safe-to-act gate can report the watcher dead out of a failed call.**
`status-sweep.ps1:263` coerces a failed `Get-CimInstance` into an empty array and prints
`[LIVE] watcher node: NOT RUNNING`, under the tag its own header calls authoritative. Today that
line happened to be *true* (the watcher is genuinely down per Station 00), which is exactly why it
has gone unnoticed. The complete-and-additive fix is one connect-then-assert guard folded into
**#2294 before it merges** — that PR already owns the file. It needs its 2 red checks green and its
`do-not-merge` label removed, and the label is yours. Full options, RULE 1 ordered, in F2.

**Not new, named so you can see it compound — the board is deadlocked on two parked PRs.**
#2303 and #2294 are both RED and both `do-not-merge` (oldest 38h). #2303 *is* the fix for the
"a spent HOLD is still armable" hole, so while it sits parked the hole it closes stays open — and
the only two armable prompts on the board are the two these PRs would retire. Nothing is starving
(0 armed prompts) and nothing is at risk while no station arms them, but the board cannot move
without you either greening those two or saying they are abandoned.

Everything else this run found is already in your queue: the five dead gates sit behind
`five-holds-wait-on-an-approval-channel-...-2026-09-23.md` (18 days, nothing issued), and the spent-HOLD
contract sits behind `spent-hold-gate-fails-closed-...-2026-10-10.md`. I did not re-ask either.

---

## ADDENDUM — F2 NARROWS yesterday's proposed fix, and the narrowing is the point

Written after the body above, on reading the prior 04 breadcrumb
`00-04-scanner-2026-10-10-1410-cim-exhaustion-crash-loop-and-a-silenced-cim-call-in-the-sanctioned-liveness-probe.md`
(tracked on `origin/main`). **F2 is not a new discovery of this family and must not be read as
one** — yesterday's run surveyed every silenced CIM call in the pipeline:

```
scripts/restart-watcher-if-wedged.ps1     cim=3 silenced=3   <-- the sanctioned liveness probe
scripts/pipeline/status-sweep.ps1         cim=4 silenced=1   <-- line 541, the safe-to-act gate
```

and proposed, at its line 309: *"Drop `-ErrorAction SilentlyContinue`, wrap in [a check] … so a
failed call is reported rather than silently become `false`."*

🔴 **That fix, applied to the line I measured today, would change nothing — and yesterday's own
run is what tells us why.** Its line 307 records that there is *"one call in that file **without**
`-ErrorAction SilentlyContinue`"*, and that call is **line 263**, the watcher read. Yesterday it
**succeeded** and correctly printed `[LIVE] watcher node: RUNNING pid 16148`, so the unsilenced
call looked like the healthy counter-example to the silenced ones.

[MEASURED] today at 10:11:56Z, the same unsilenced line 263 **failed** — and it failed **loudly**,
printing the full `HRESULT 0x80010002` error I quoted in §7 — **and still produced
`[LIVE] watcher node: NOT RUNNING`.** The loud error and the false verdict were emitted by the same
call, three lines apart.

**So `-ErrorAction SilentlyContinue` is not the mechanism, or not the only one.** The mechanism is
the `@( ... )` array-subexpression wrapper: a terminating-but-non-fatal CIM failure yields no
objects, `@()` makes that an empty array, and the downstream count-against-zero test cannot
distinguish *"no node.exe is running"* from *"the question was never answered"*. Removing
`SilentlyContinue` restores the error **text** without repairing the **verdict**. This is DOCTRINE
§7's *"a tool that cannot run must FAIL LOUD, never fail quiet"* satisfied in the letter and
defeated in the substance: it failed loud **and** reported a confident wrong answer anyway.

**What this changes for whoever implements the fix:** the guard must assert on the call's *success*,
not on its *output count*, and at **every** CIM site in both files — the four in `status-sweep.ps1`
including the already-unsilenced line 263, and the three in `restart-watcher-if-wedged.ps1`. A patch
that only strips `SilentlyContinue` from the silenced six will leave the watcher verdict, the one
line stations are told to trust, exactly as wrong as it was this morning. Yesterday's own prescribed
output string is the right target and still stands:
`[BROKEN] CIM unavailable — safe-to-act UNMEASURED`.

**DISPOSITION: ESCALATED** — same escalation as F2, same RULE 1 options, with the scope corrected
from *"drop `SilentlyContinue`"* to *"assert call success at all seven CIM sites, line 263
included"*. ⚠️ **Falsifying probe:** make `Get-CimInstance Win32_Process` fail at
`status-sweep.ps1:263` (a thread-starved box does it for you) and read the next line. If it ever
prints `[BROKEN]` or declines to render a verdict, this addendum is discharged.
