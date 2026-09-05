# Station 00 — Supervisor | 2026-09-05T10:08Z–2026-09-05T10:3xZ

## GROUND

```
UTC            2026-09-05T10:08:34Z
origin/main    8e5fc07d  at start  ->  f6809797  after I merged #1652 this run
dev tree       main @ f6809797     C:\ProjectOperations2  (was 0072c15a; fast-forwarded twice)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run is not read-only on that account.

**SIGHTED run.** A keyword `ToolSearch` for `desktop-commander` loaded the schemas, then
`start_process` on `powershell.exe` returned PID 16700 on the first attempt. Every measurement below
came from that shell, in the dev tree `C:\ProjectOperations2` or in a disposable worktree off
`origin/main` — never the watcher clone (§9.5, the decoy `processed/` directory).

Freshness of the three binding documents was established the sound way (PREFLIGHT step 2, the
piped-hash trap): `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**,
so the working copies ARE the `origin/main` blobs. No piped `hash-object` was used and none is
quoted.

## WHAT I MEASURED

**Board — `status-sweep.ps1`, captured to a file (§ the return-early trap), exit 0, 10:09:50Z.**

- §0 instrument controls: `gh` CAN reach GitHub (saw merged `#1651`); `node` runs. No `[BROKEN]`.
- §7 VERDICT: **`SAFE TO ACT`** — no board mutation in progress, no remote activity inside 2 min,
  no live station worktrees. **Re-run at 10:1xZ immediately before the merge and still `SAFE TO
  ACT`** (the verdict expires the moment it prints).
- §1 OPEN PRs: **1** — `#1652` CLEAN, `docs(board): 00 collect 0908 …`. main CI on `8e5fc07d`:
  4 success / 0 failed (trunk green).
- §2 watcher node RUNNING pid 20000 · wrapper alive · heartbeat 45 min · **watcher clone dirty=3**
  (unchanged) · orphaned worktree `C:/po-vg` dirty=1, age 1576 min, **holds uncommitted work**.
- §3 in-progress prompts 0 · `index.lock` false/false · git processes 0 · no PR touched in 2 min.
- §4 armed (`*-ready.md`) **0** · needs-marco 22 · no-pr-opened 109 · failed 41 · blocked 117.

**COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 0, `CLEAN`.**
6 breadcrumbs checked, 0 malformed. Freshness: `00` 1.1h (cadence 2h) ok · `02` dispatch-only ·
`03` 11.2h (24h) ok · `04` 4.0h (4h) ok · `05` 20.0h (24h) ok.

**Crossed against `lastRunAt` (scheduled-tasks MCP), which the breadcrumb alone cannot answer:**

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | 2026-09-05T10:08:02Z | 09:08 | this run; aligned |
| 03 | 2026-09-04T23:00:50Z | 09-04 23:01 | aligned, healthy |
| 04 | **2026-09-05T10:09:41Z** | 06:10 | **fired 99 s after me — running concurrently, see F3** |
| 05 | 2026-09-04T14:10:38Z | 09-04 14:11 | aligned, healthy |

**No station is SILENT and no station has written a breadcrumb since my own 0908 run**, so the
station channel had nothing new to disposition. Everything below came from the board and the queue.

**[MEASURED] `#1652` carried NO watcher verdict, and the discriminator says SECOND LANE, not a
crashed watcher.** The probe pinned to the LIVE tree, with both controls and the age control §9.5
demands:

```
docs\pr-prompts\processed  (LIVE tree C:\ProjectOperations2): 1943 logs,
  newest LastWriteTimeUtc 2026-09-05T09:25:02Z  <- younger than #1652 (opened 09:17:15Z)
  POS 'marco.:true'                        -> 612
  NEG 'zzzNoSuchNeedleZzz'                 -> 0
  PROMPT logs only (pr-*.log, rev-* excluded), 'PR #1652\b'  -> 0
  NEG 'PR #999999\b'                       -> 0
.arming-log.txt newest row: 2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-tiles-and-next-action
```

`NO LOG` **plus** no arm anywhere near 09:17Z ⇒ this is not a watcher PR whose verdict died in
transit; it is a lane that never went through the watcher.
**`[NO LANE VERDICT — hand-classified]`**, and it classifies twice over, both to the same answer:
by §10.1 step 3 it is Station 00's own board lane (`STATION-CAPABILITIES.md` §5 — "Create a PR:
✅ board PRs"), and independently its whole diff is **one** path under `docs/`, which
`classifyPolicyFiles` admits unaided via `^(tests|docs)/`. **Not Marco's.**

**[MEASURED] `#1652`'s label read is CONTROLLED, not merely empty.**

```
gh pr view 1369 --json labels --jq '.labels[].name'  ->  do-not-merge   <- POSITIVE control
gh pr view 1652 --json labels --jq '.labels[].name'  ->  (empty)        <- genuine, not a broken query
gh pr view 1652: CLEAN / MERGEABLE / isDraft false / autoMergeRequest null
checks: Approval receipt (CP-26) pass · PR gates — diff checks pass · Pipeline — watcher + linter
        tests pass · arm-prompt tests (Windows) pass · CodeQL pass · Analyze x2 pass;
        the five code jobs `skipping` (path filter, correct for a docs-only diff)
```

This matters because §9.4's old bullet taught the opposite — that an empty label read is a broken
query — and the label is the gate that stops an agent merging Marco's work. Refuted on `main` since
`#1647`; re-confirmed here with the positive control.

**[MEASURED] The HOLD queue, `triage-holds.ps1`, exit 0, both controls PASS**
(GIT control read `origin/main:docs/pipeline/DOCTRINE.md`, 78274 chars; SPENT control got exit 3 on
the fixture, so the SPENT bucket is reachable). 3 distinct verdicts observed on the real board.

```
spent = 1   gates-satisfied = 36   still-gated = 42   unreadable = 0   of 79
```

**[MEASURED] One of the three prompts the station doc names never-arm is gated by nothing.**
`00-supervisor.md:373` — *"Never-arm list still stands: `pr-fv2-formrule-contract`,
`pr-siteid-notnull-backfill`, and any prod-data prompt (MT-3/MT-5) — those are Marco-run."*
The union of RULE 4's three markers, grepped per prompt, with a negative control:

```
                                        do-not-arm-comment  DO-NOT-ARM-CAPS  "Arm ONLY"
pr-fv2-formrule-contract-HOLD.md                 0                 0             0     <- ADMIT
pr-siteid-notnull-backfill-HOLD.md               1                 0             0     <- REJECT
pr-dns-s5-checker-flip-to-fail-HOLD.md           1                 0             0     <- REJECT
NEG control 'zzzNoSuchNeedleZzz' on the first    0
```

Its front matter: `size: 10` · `gate_allow: migrations` · `escalates: true` ·
`rollback_strategy` describing *"a destructive column drop … deliberately irreversible for the
dropped column values"*. **`triage-holds.ps1` lists it in the GATES-SATISFIED bucket.** See F1.

**[MEASURED] The `pr-cardui-s5` HOLD became SPENT the moment `#1646` merged.**

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-cardui-s5-actions-and-expandables-HOLD.md
  -> STALE ... "Premise no longer holds" ... "The work is ALREADY DONE."   exit 3
#1646  feat(tendering): the WBS table gets an actions column and three expandables
       (SCOPE_WBS_ACTIONS_V1)   MERGED 2026-09-05T08:50:16Z
```

**[MEASURED] The cardui cluster is still held by the supervised cloud lane.** Newest merge-approval
receipt on `main` is `docs/decisions/merge-approvals/1651.md`, added in `8e5fc07d` at
**09:23:40Z** — 52 minutes before this run, i.e. inside one cadence on either the documented 2 h or
the live 1 h. `pr-cardui-s6-other-operational-costs-HOLD.md` is **ADMIT**; `s7` and `s8` are
`REJECT [GATE_NOT_RELEASED]`. See F4.

**[CANNOT MEASURE] Whether the receipts naming `approved_by: marco` are true transcriptions.**
Unchanged from the 0908 run and from `#1635`: every actor authenticates as `GH-Mantova`, and each
receipt arrives inside its own PR's diff. I am recording that the population grew by one (`1651.md`),
not re-raising it — `#1635` holds the question and `DOCTRINE §10.2.1` now records the lane itself.

## WHAT CHANGED

1. **Dev tree fast-forwarded twice.** `git fetch origin --prune` then `git merge --ff-only
   origin/main`: `0072c15a -> 8e5fc07d` (5 files), and after the merge below `8e5fc07d ->
   f6809797` (1 file). Read back: `git rev-parse --short HEAD` = `f6809797`.

2. **`#1652` MERGED**, via the sanctioned path only.

   ```
   Assert-SmokedOrEscalate -PR 1652   -> True
   Merge-Pr -PR 1652                  -> True
   read-back: gh pr view 1652 -> state MERGED · mergedAt 2026-09-05T10:14:35Z
              mergeCommit f6809797454b42e34598ca7974cfbd4a900f0ed8 · mergedBy GH-Mantova
              git rev-parse origin/main:<the breadcrumb path> -> 6d6b2981...  (on main)
   ```

   No `gh pr merge` by hand, no `git merge`, nothing in the watcher clone.
   **I authored no `docs/decisions/merge-approvals/<N>.md`.** CP-26 passed on its own because
   `#1652` was never labelled — the receipt requirement is a constraint on the supervised cloud
   lane (§10.2.1), and an agent authoring one would be manufacturing its own release.

3. **The post-merge fast-forward cure was applied in full, including its fourth step.** The dev tree
   held an untracked copy of the exact path the FF had to create:

   ```
   git hash-object <breadcrumb>            -> 6d6b2981a02d...   identical
   git rev-parse origin/main:<breadcrumb>  -> 6d6b2981a02d...   identical  => safe to delete
   Remove-Item -> git merge --ff-only origin/main (8e5fc07d..f6809797)
   restore from the NEW HEAD with node (git show HEAD:<path> -> writeFileSync; never
     `git checkout -- <path>` (§9.2) and never PowerShell `>` (§9.3)):
       wrote=16598 readback=16598 identical=true
   read-backs, all three:
       git rev-list --left-right --count HEAD...origin/main -> 0   0
       git diff --numstat                                   -> EMPTY
       git diff --cached --name-status                      -> EMPTY
   ```

   `docs/pipeline/sweep-rotation.json` — the second FF blocker the station doc names — was **not**
   dirty this run, so only the untracked-breadcrumb cause applied.

4. **`pr-fv2-formrule-contract-HOLD.md` gained the literal do-not-arm marker** (F1). Byte delta
   asserted per §9.3: `before=6383 after=6723 delta=340 expected=340 ok=true`, built by
   concatenation, never a `String.replace` replacement string.

5. **`pr-cardui-s5-actions-and-expandables-HOLD.md` retired** — `git mv` to
   `docs/pr-prompts/superseded/` (F2). `git status --porcelain` in the worktree shows exactly one
   ` M` and one `R `, nothing else.

6. **This breadcrumb was written inside this run's own PR worktree**, which is cure 1 in the station
   doc's post-merge section — so no loose untracked copy is left in the dev tree to block the *next*
   run's fast-forward.

**Not changed:** nothing was armed. No label was added or removed. Nothing was deleted from
`needs-marco/`. The watcher was not restarted. `/sot/` was not touched.

## FINDINGS

### F1 — A prompt on the station's own never-arm list was ADMIT, and nothing but prose stopped it

`00-supervisor.md:373` names three never-arm prompts. Two of them are enforced by
`lint-prompt.mjs`; `pr-fv2-formrule-contract-HOLD.md` was enforced by **nothing** — 0 of the three
markers RULE 4's detector greps, measured against a passing negative control and two list-mates that score 1.
`triage-holds.ps1` therefore listed it under **GATES SATISFIED**, and its front matter is
`gate_allow: migrations` on a `rollback_strategy` that describes itself as *"a destructive column
drop … deliberately irreversible for the dropped column values"*.

This is DOCTRINE §9.5's *"ADMIT is NECESSARY, NOT SUFFICIENT"* with a live instance attached, and
the failure mode is the dangerous direction: an arming run that follows the detector correctly —
lint ADMIT, then grep the marker union — gets a clean pass on both instruments and arms a
destructive migration. The prose gate in `00-supervisor.md` is invisible to both, which is exactly
the case §9.5 warns *"a prose human gate matches neither regex."* The prompt has sat in this state
since it was staged; nothing changed today except that a run finally measured it.

**RULE 1 — complete and additive, both halves pass.** Adding the literal
`<!-- watcher: do-not-arm -->` marker fixes it *immediately* (the linter now REJECTs at exit 1) and
*for the future* (the marker fires at `DO_NOT_ARM_COMMENT` **before** the premise is ever evaluated,
so it holds even if the premise later flips), and it damages nothing: it adds two comment lines to a
prompt body, changes no data, no schema, and no behaviour other than closing the hole. The
alternative — leaving it and relying on every future run reading line 373 of the station doc — fails
the *complete* half outright: it is the arrangement that just failed, and it has no instrument.

**DISPOSITION: ACTIONED.** Verified, not assumed:

```
before: node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-fv2-formrule-contract-HOLD.md
        -> ADMIT   (via triage-holds.ps1's GATES SATISFIED bucket)
after : -> REJECT  pr-fv2-formrule-contract-HOLD.md  [HUMAN_GATE_PRESENT]
           "HUMAN_GATE_PRESENT: line 2 contains <!-- watcher: do-not-arm --> marker."
           exit 1
```

It now matches its list-mate `pr-siteid-notnull-backfill-HOLD.md` exactly.

⚠️ **The general shape is not fixed and I did not fix it.** The never-arm list lives in prose in one
station doc; only its members that happen to carry a marker are enforced. The complete fix is a CI
check that reads the list out of `00-supervisor.md` and fails if any named prompt lacks a marker —
so the doc and the linter cannot drift apart again. That is a scripts change, outside a collect
run's diff, and it is dispatched below rather than done here.

**DISPATCHED — Station 06 (PR Master):** stage a prompt for that CI check. The measurement, the
three filenames, the marker-union table and its negative control are above; `check-gate-markers.ps1`
is the nearest existing instrument to extend.

### F2 — The `pr-cardui-s5` HOLD went SPENT when `#1646` merged, and would have armed again

`lint-prompt.mjs` returns exit 3 (`STALE` / *"The work is ALREADY DONE"*) on
`pr-cardui-s5-actions-and-expandables-HOLD.md`, because `#1646` (`SCOPE_WBS_ACTIONS_V1`) landed the
work at 08:50:16Z. This is the *specific instance* of the standing trap my 08:2xZ predecessor
recorded as *"DO NOT ARM `pr-cardui-s5-actions-and-expandables-HOLD` while `#1646` is open"* — the
prompt whose PR does not delete it stays armable forever, and this cluster has already produced two
measured duplicates (`#1634`/`#1639`, `#1611`/`#1637`).

**DISPOSITION: ACTIONED.** `git mv` to `docs/pr-prompts/superseded/` in this PR, which is how the
0808 run retired the previous twelve. The SPENT bucket is now empty: `spent=1 of 79` before,
`spent=0` after, and `triage-holds.ps1`'s own SPENT-fixture control passed in the same run, so the
zero is a measured zero and not a blind instrument.

⚠️ The **general** defect — an armed prompt whose PR does not delete it stays armable forever —
remains **unstaged**. It is not new here and I am not re-raising it; it is already on the standing
list for 06.

### F3 — Station 00 and Station 04 fire 99 seconds apart, every four hours

[MEASURED] from the scheduled-tasks MCP this run: `00-supervisor` `lastRunAt`
**2026-09-05T10:08:02.470Z** (cron `5 * * * *`, jitter 172 s); `04-scanner` `lastRunAt`
**2026-09-05T10:09:41.871Z** (cron `0 */4 * * *`, jitter 571 s). **99.4 seconds apart**, and the
offsets are structural, not coincidental: 00's hourly slot and 04's 4-hourly slot land in the same
minute every fourth hour, then jitter decides the order.

04 is read-only on the board, so this is not an LL-38 board collision. What it *is*: 04 advances
`docs/pipeline/sweep-rotation.json` and, by its own station doc, **leaves it dirty in the shared dev
tree** for 00 to commit. If 04 dirties that file while 00 is mid-commit, 00's commit carries a
partial write of another station's hand-off — and the shared-index rule (§9.2) is the only thing
standing in the way, checked by eye. I checked: `git diff --cached --name-status` was EMPTY before
my commit and `sweep-rotation.json` was clean throughout this run.

This is a **recurrence**, not a new escalation — `needs-marco/station-schedule-collision-04-and-05-2026-09-03.md`
already holds it, and the sweep tags all three of its PR references `[STALE]` because they merged.
The escalation is alive; only its evidence is stale.

**DISPOSITION: DEFERRED.** The fix is one line of cron (offset 04 to `20 */4 * * *`) and it is
Marco's, because the schedule is his. It becomes **urgent** the first time a 00 board PR is measured
carrying a `sweep-rotation.json` hunk nobody in that run wrote — that is the observable, and it has
not happened yet. Until then the eye-check in §9.2 is holding.

### F4 — I did not arm, and the trigger my predecessor set is measurably not met

The 0908 run deferred arming with an explicit, falsifiable trigger: re-arm from this lane when the
cloud lane's open `pr-cardui-s*` PR count reaches zero **and** no new
`docs/decisions/merge-approvals/<N>.md` has appeared for a full cadence. I tested both halves:

- open `pr-cardui-s*` PRs: **0** — the board is empty. First half **met**.
- newest receipt on `origin/main`: `merge-approvals/1651.md`, added in `8e5fc07d` at
  **09:23:40Z**, i.e. **52 minutes ago** — inside one cadence on either the documented 2 h or the
  live 1 h cron. Second half **NOT met**.

And the arm that is sitting there is exactly the collision: `pr-cardui-s6-other-operational-costs-HOLD.md`
is **ADMIT** (its gate released when `#1646` merged), while `s7` and `s8` still read
`REJECT [GATE_NOT_RELEASED]`. Arming s6 now puts this lane and the supervised cloud lane on the same
chained cluster, one of them unable to see the other's chat — LL-38 in its exact recorded form.

**DISPOSITION: DEFERRED**, trigger unchanged and now measured rather than asserted. It is worth
saying plainly what this costs, because "I did not arm" reads like caution and is not: **the last
arm of any kind was `by=Marco@` at 2026-09-04T22:03:13Z, twelve hours ago, and every PR that has
reached `main` since then got there without one.** Throughput on this board currently depends
entirely on Marco's live lane. That is a deliberate, documented arrangement (§10.2.1) and not a
fault — but if it is meant to be temporary, the scheduled lane resuming arming is the thing that
ends it, and the trigger above is what I will re-test next cadence.

### F5 — The board is EMPTY, and that is the honest answer to Q6

`gh pr list --state open` returns **0** after this run's merge. Zero open PRs, zero armed prompts,
zero DIRTY PRs, watcher alive with a supervised wrapper. Trunk on the new head `f6809797`
(full 40-char SHA, assign-then-count per §9.4) reads **4 runs: `Push on main` success, `CI`
success, `Deploy` and `Tendering Browser Smoke` still `in_progress`** six minutes after the
merge — green so far, not yet complete, and I am not calling an in-flight run a pass. **The single most important thing blocking progress right now is nothing on the board** —
it is that the queue's 36 gate-satisfied prompts have no consumer while the cardui cluster is held,
which F4 covers and which is a scheduling decision, not a defect.

The station doc is explicit that "all healthy" is only allowed after Q1 and Q3 come back zero. They
did, measured, this run: Q1 — 0 open, therefore 0 DIRTY. Q3 — I counted the queue myself rather than
quoting the sweep: `(Get-ChildItem docs\pr-prompts\*-ready.md).Count` is **0**, and the one
`-ready.md` the last two runs saw was `rev-1651-ready.md`, a REVIEW JOB, now consumed.

**DISPOSITION: ACTIONED** — recorded as the run's verdict. No action was required and none was taken.

## WHAT I DID NOT DO

- **I did not arm anything.** F4 — the trigger my predecessor set is measurably unmet, and the one
  ADMIT worth arming (`pr-cardui-s6`) is the collision itself. This is a rule, not timidity.
- **I did not touch the other 35 ADMIT prompts.** RULE 4 is one at a time, and the standing
  guidance is to ask whether to arm at all before asking which. With the board empty and the cluster
  held, the answer to the first question was no, so the second never arose.
- **I did not author a merge-approval receipt for `#1652`.** CP-26 passed on its own
  (`NEVER_ESCALATED` — the PR was never labelled). The receipt requirement belongs to the supervised
  cloud lane (§10.2.1); an agent writing one for its own merge is manufacturing its own release, and
  that is a standing prohibition.
- **I did not clear the dead `needs-marco/pr-1646-review-block.md`**, or any of the `[STALE]`
  escalations §5 of the sweep lists. Same reasoning as the 0908 run: `needs-marco/` is Marco's own
  queue, it is gitignored so no PR can touch it, and pruning it unattended is not my call. The count
  (22) demonstrably overstates.
- **I did not delete `C：temppr-1648.diff` from the watcher clone**, still untracked there and still
  one of the three files making it `dirty=3`. Dispatched to 03 by the 0908 run; re-dispatching it
  would be noise. The clone remains NOT clean on `main`.
- **I did not prune the orphaned worktree `C:/po-vg`** (dirty=1, age 1576 min). It **holds one
  uncommitted file** — the sweep says `--force` would discard it. That is destructive and it is 03's
  tree; already dispatched.
- **I did not restart or touch the watcher.** `restart-watcher-if-wedged.ps1` was not needed: the
  sweep reports the node RUNNING (pid 20000) with a live wrapper, and a stale heartbeat against an
  **empty** queue is idle, not wedged. Nothing was armed for it to consume.
- **I did not run a smoke or a vision review.** Neither applied — the only PR I merged has a
  one-file `docs/` diff and touches no `apps/web/**`.
- **I did not measure whether `verdictApproves` has a live caller.** The 0908 run dispatched that to
  06 and flagged that it changes F1-of-that-run's severity; it is still unmeasured, and guessing at
  it would put an unmeasured claim beside measured ones.
- **I did not edit `/sot/`, touch Azure/Entra/SharePoint, write production data, remove a label, or
  run any `git` write in `C:\po-watcher\ProjectOperations`.**

## HANDOVER

- **06 — PR Master:** stage the CI check from F1 (never-arm list in `00-supervisor.md` vs the marker
  union), and the `verdictApproves` caller question still open from the 0908 run.
- **03 — Machine Minder:** unchanged and still open — watcher clone `dirty=3` incl.
  `C：temppr-1648.diff`, and `C:/po-vg` holding one uncommitted file.
- **Marco:** F3, one line of cron. And F4's standing question — whether the scheduled lane should
  resume arming, or stay stood down while the cloud lane holds the cluster.

This breadcrumb is committed inside this run's own PR, so it is tracked from the moment that PR
merges and needs no later sweep.
