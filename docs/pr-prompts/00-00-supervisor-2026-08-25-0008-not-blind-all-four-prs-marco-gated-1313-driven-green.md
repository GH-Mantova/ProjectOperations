# Station 00 — Supervisor | 2026-08-25T00:08:22Z–2026-08-25T00:21:17Z

## GROUND

```
UTC            2026-08-25T00:08:22Z
origin/main    5ec99150            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 5ec99150      C:\ProjectOperations2   (behind=0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — full run, not read-only-degraded.

**NOT BLIND.** `start_process` shell `powershell.exe` returned host clock `2026-08-25T00:08:22Z`.
Desktop Commander present. **This is the first non-blind supervisor run in four** — the previous
three (1811, 2010, 2220) all reported DC absent. Every claim below is a host measurement.

## WHAT I MEASURED

### 1. Board — 4 open PRs, and ALL FOUR are gated to Marco [MEASURED]

`status-sweep.ps1` verdict: **SAFE TO ACT** (0 in-progress prompts, 0 git processes, no `index.lock`
in either tree, no PR touched in 2 min). Instrument positive controls both passed.

| PR | state | CI | label | watcher routing |
|---|---|---|---|---|
| #1310 | UNSTABLE | 6/1 | `do-not-merge` | `stays for Marco (escalates:true)` |
| #1311 | CLEAN | 11/0 green | none | `stays for Marco (outside tests/ or docs/: CrmBoardPage.tsx)` |
| #1312 | CLEAN | 11/0 green | none | `stays for Marco (outside tests/ or docs/: CrmBoardPage.tsx)` |
| #1313 | BLOCKED | 10/1 | `do-not-merge` | `stays for Marco (escalates:true)` |

🔴 **#1311 and #1312 are the RULE 2 trap in its purest form.** Both are green, both unlabelled, and
**both carry a reviewer verdict of MERGE** (`watcher-launch.log:13503`, `:13508`). RULE 2 names this
exact case: *not when green, clean, unlabelled, nor when the review verdict says MERGE.* The watcher's
own merge result is authoritative and machine-written:

```
pr-crm-leads-page-title-ready.md.log:13
  [watcher] merge result for PR #1311: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: ..."}
pr-crm-triage-archive-entry-ready.md.log:20
  [watcher] merge result for PR #1312: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: ..."}
```

**MERGED THIS RUN: ZERO.** That is the correct outcome, not an idle one.

### 2. #1310's red is CP-26 firing BY DESIGN — not a defect [MEASURED]

Job log (run 32786394628 / job 97619095713). Every other gate passed:

```
PASS - CP-11 migrations · CP-12 env-vars · CP-13 dependencies · CP-17 dto-validation
PASS - CP-23 seed-without-migration · CP-24 sot-purity · CP-25 failure-honesty
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
```

⚠️ **Do not "fix" this red.** #1310 is docs-only (2 `.md` files) and its red *is* the hold. The same
CP-26 failure is the sole remaining red on #1313. Chasing either would be chasing the gate itself.

### 3. #1313 — real defect, root-caused from the job log, FIXED and PROVEN GREEN [MEASURED]

`Test Suites: 1 failed, 264 passed` but `Tests: 3553 passed, 0 failed` — **zero assertions failed;
one suite never compiled.** Log line 3294:

```
FAIL src/modules/crm/pipeline/__tests__/pipeline-dashboard.controller.spec.ts
  ● Test suite failed to run
    error TS2307: Cannot find module '../../../common/auth/permissions.guard'
    error TS2307: Cannot find module '../../../common/auth/jwt-auth.guard'
```

Cause: the spec sits **four** directories below `apps/api/src` (`modules/crm/pipeline/__tests__`) but
reached up only **three**, so `../../../common/auth` resolved to `apps/api/src/modules/common/auth`.

Controls run before touching anything (§7 guard 1):

```
POSITIVE  git ls-tree -r origin/<br> -- apps/api/src/common/auth        -> 8 files (both guards present)
NEGATIVE  git ls-tree -r origin/<br> -- apps/api/src/modules/common/auth -> 0 files (what the bad path resolves to)
CORROBORATION  the PASSING sibling spec apps/api/src/common/auth/__tests__/permissions.guard.spec.ts
               imports "../permissions.guard" — consistent with the guard living at src/common/auth
```

Fix: `../../../common/auth/` → `../../../../common/auth/`, edited with **node** (§9.3), in a
**disposable worktree** off the PR head (§4), never in a shared tree. Read-back and `--numstat`:

```
occurrences replaced = 2 · bad-remaining = 0 · good-present = 2
git diff --numstat -> 2  2  apps/api/src/modules/crm/pipeline/__tests__/pipeline-dashboard.controller.spec.ts
push b9e02488..a403f2a6 ; remote re-read confirms both lines carry ../../../../
```

**CI decided, not I:** `API — lint, test, compliance smoke` **FAILURE → SUCCESS** on `a403f2a6`.
Web, Pipeline, Data-model, CodeQL all SUCCESS. Only CP-26 (§2 above) remains red. Worktree torn down;
`git worktree list` read back — `fix-1313` gone, dev tree clean on `main`, staged=0, armed=0.

### 4. Station docs are CLEAN post-#1308 — Station 04's corruption warning did not land [MEASURED]

04's 2216Z report warned that #1308's blanket re-encode would corrupt the mixed-encoding 00/04 docs,
and #1308 was hand-merged two minutes later with nobody re-decoding them. Decoded all six with node:

```
00-supervisor.md 48294 B · 02-board-driver.md 41075 B · 03-machine-minder.md 18049 B
04-scanner.md    31593 B · 05-sot-keeper.md   18669 B · 06-pr-master.md      18723 B
   every file: doubleEncodeSig(U+00E2 U+20AC)=0 · U+FFFD=0
CONTROL (string known bad) -> doubleEncodeSig=1   (detector provably fires)
```

### 5. F5 CORROBORATED — the blindness heuristic is falsified a SECOND time [MEASURED]

`STATION-CAPABILITIES.md` §2 and every station bootstrap say: *"if a station appears in the
scheduled-task listing, it is cloud-fired and will be blind."*

```
list_scheduled_tasks -> 00-supervisor  cron "5 */2 * * *"  lastRunAt 2026-08-25T00:07:58Z  (THIS RUN)
same run -> start_process powershell.exe SUCCEEDED on the first probe
```

Station 03 falsified it yesterday; **this run falsifies it again, for Station 00 itself.** Taken
literally, the heuristic would have made this run STOP and report blindness on a healthy machine —
§7's signature failure: a confident, coherent, wrong verdict from a broken instrument.

### 6. Machinery [MEASURED]

```
watcher node RUNNING pid 29024 · wrapper alive (1) · heartbeat age 33 min (idle, queue empty — not wedged)
clone C:\po-watcher\ProjectOperations  head=74066ae9  behind=5  ahead=0
   git diff --name-only HEAD origin/main -- scripts/pr-watcher  ->  0 files
clone stash list = 39 · queue: armed 0 · needs-marco 9 · no-pr-opened 107 · failed 20 (newest 08-13) · blocked 0
```

## WHAT CHANGED

1. **Pushed one commit to PR #1313's branch** (`b9e02488` → `a403f2a6`): the 2-line import-depth fix
   in §3. Verified by remote re-read **and** by the API job flipping to SUCCESS.
2. **Drained 5 stale staged renames from the dev-tree shared index** (Station 03's F3). Index-only
   `git restore --staged`; **no worktree verb** — none of `checkout .`, `reset --hard`, `stash pop`,
   `clean` was used, so nothing was resurrected.
3. Created and **removed** the disposable worktree `C:\po-worktrees\fix-1313`.

Nothing else. No merge, no label touched, no prompt armed or disarmed, no `/sot/` edit, no watcher
restart, no power setting, no Azure/Entra/SharePoint action.

## FINDINGS

### F-A — All four open PRs are watcher-routed to Marco; two are green with MERGE verdicts

#1311 and #1312 are green, unlabelled, reviewed MERGE, and **still gated** — the watcher wrote
`"marco":true` for both. Nothing on this board can move without Marco.

**ESCALATED — Marco.** Question, not a status update: **#1311 (H1 rename) and #1312 (triage Archive +
Restore) are green with MERGE verdicts and are held only by the "outside tests/ or docs/" routing
rule. Do you want to release these two, and if so by which channel?**

RULE 1 applied to the standing shape of this gate:

1. **Complete + additive — name the PRs explicitly when you release them.** Marco replies with the PR
   numbers; the supervisor merges only those. Solves it now and in future, adds an audit trail, and
   damages no data entry. Passes both halves.
2. **Additive but incomplete — widen the watcher's auto-merge policy** beyond `tests/`+`docs/`. Fewer
   stops, but it discards the human review this gate exists to force. Fails the *complete* half.
3. **Neither — leave them.** Green reviewed work rots on the board indefinitely. Fails *complete*.

⚠️ Carried from the 2010Z run and still true: **RULE 2 has no audit trail** — everything merges as
`GH-Mantova`, so a released merge is indistinguishable from a violated one. Option 1 is the only one
that fixes that too.

### F-B — #1313's suite-failure is fixed; the PR is green but correctly unmerged

**ACTIONED.** Root cause named from the job log (never the diff), fix proven by CI flipping
FAILURE→SUCCESS on `a403f2a6`. Left unmerged: `do-not-merge` + `escalates:true`. This is the mandate
working — *driven green, handed over.*

### F-C — Dev-tree shared index held 5 consumed prompts staged for re-arming

Station 03's F3, dispatched to 00, still live 80 minutes later. All five `RD` (staged rename, target
already consumed into `processed/`). A pathspec-less commit would have landed consumed `*-ready.md` on
`main`, where `queue-sync` can re-arm them — including `pr-pipeline-fold-s1-any-permission`, which has
**already shipped as #1313**. That is a duplicate-work trap, not housekeeping.

**ACTIONED.** Each target confirmed present in `processed/` **before** acting (positive control), then
index-only unstage. Read back: `staged=0`, `armed_depth1=0`, head unmoved at `5ec99150`. Reversible —
a `git mv` restages. The residual ` D` on the five `-HOLD.md` files is the honest truth (consumed) and
is unstaged, so no future commit carries it accidentally.

### F-D — `STATION-CAPABILITIES.md` §2's blindness heuristic is wrong, now twice-measured

Falsified by 03 (2026-08-24) and by 00 (this run, §5). The listing is not evidence either way; the
direct `start_process` probe is.

**DISPATCHED — Station 05/doc-reconcile lane** (docs PR to `STATION-CAPABILITIES.md` §2 and the five
station bootstraps): replace the listing-based inference with the direct test. 00 cannot author this
itself — it may not create PRs (LL-38 / authority matrix).

### F-E — Watcher clone 5 behind, docs-only; a fast-forward is NOT mine to run

Corroborated 03's F1 by re-measurement: `behind=5`, and `git diff HEAD origin/main -- scripts/pr-watcher`
is **empty**, so the running watcher executes current behaviour and "a restart adopts nothing" does not
bite.

⚠️ **Doc conflict worth recording:** 03 proposed the repair as `git -C C:\po-watcher\ProjectOperations
merge --ff-only origin/main` for 00 to dispatch — but 00's own station doc forbids `merge` in the
watcher repo absolutely, and the materialise sequence requires the watcher **STOPPED** first.

**DEFERRED.** Becomes urgent the moment any PR touching `scripts/pr-watcher/**` merges to `main`; at
that point it must run in an idle window with the watcher stopped, not as a live `merge`.

### F-F — Clone stash closed loop at 39, +4 in one day

Confirmed 39 entries; the preflight stashes on every start and nothing pops. A `stash drop` is
**irreversible** (DOCTRINE §5.4) and `stash@{4}` is a machine-minder entry, not an autostash.

**DEFERRED** — and it needs an explicit decision because of the irreversibility, not a routine sweep.
Urgent when the clone's disk or `git status` legibility actually degrades.

### F-G — Station 03's "no restarter" claim is dead; do not carry it forward

**ACTIONED** (discharged by 03's own re-measurement: "PO Watcher Keepalive" ran 22:58:15Z rc=0).
Recorded here so 00's successors stop re-reporting it.

### F-H — 8 of the 9 breadcrumbs written since 2026-08-24 22:00 are UNTRACKED

Including Station 03's 16.4 KB report and Station 04's 2216Z report. `#1300` made the *path* tracked;
it did not make individual files tracked, and nobody has committed them. A clone, CI, and any
cloud-fired station see none of them.

**DEFERRED** — needs a hygiene/board PR to commit the breadcrumb set, which 00 may not author. Named
here so the next PR-authoring station sweeps them up. Project memory remains the primary channel.

### F-I — Standby: the box sleeps ~hourly and drops scheduled fires

03's F4, unchanged and not re-measured this run. 16 × Kernel-Power id-507 in 24 h; the watcher node
survives; what is lost is scheduled-task fires.

**ESCALATED — Marco** (carried, unchanged): **do you want this box exempted from standby, or is a
missed hourly cron acceptable?** Complete-and-additive option first: exempt from sleep **and** set
`-WakeToRun` on the keepalive task — cost is a machine that never sleeps, which is Marco's call.

### F-J — Station 04's dispatches, dispositioned

- *Unconditional archive-tick log (`index.mjs:734`)* — **DISPATCHED, Station 06.** One line; restores
  the gap-based freeze instrument. Joins the 16 × `Date.now()` freeze-blind deadline item.
- *"#1308 touches 5 docs, 2 of them mixed — a blanket re-encode corrupts them"* — **ACTIONED.**
  Measured clean post-merge (§4). No corruption landed; the warning can be retired.
- *`MEMORY.md` is 20.1 KB against a 24.4 KB read limit* — **DEFERRED**, and it is now more urgent:
  this run adds material. Needs a deliberate compaction pass, not an incremental append.
- *"Freeze-check blocker on arming is discharged"* — **noted, no arming performed** (see below).

## WHAT I DID NOT DO

- **Did not merge anything.** All four PRs are watcher-routed to Marco (RULE 2), two of them despite
  green CI and MERGE verdicts. Zero merges is the correct read of this board.
- **Did not remove a `do-not-merge` label** from #1310 or #1313 — only Marco does that, and the label
  is what CP-26 reads.
- **Did not arm any prompt.** RULE 4 requires one-at-a-time arming with a body-read for
  `do-not-arm` / prose `DO NOT ARM` / a `docs/approvals/` gate — lint ADMIT is necessary, not
  sufficient (10 of 10 marked prompts lint ADMIT, one drops DB tables). With four PRs already parked
  on Marco and the box sleeping hourly, adding queue depth would create work nobody can land.
- **Did not chase #1310's red.** It is CP-26, the hold itself (§2).
- **Did not fast-forward the clone, drop a stash, or prune the 4 side worktrees** — F-E/F-F above; the
  first is forbidden to me in that repo, the second is irreversible.
- **Did not touch `/sot/`** (Station 05 only), **Azure/Entra/SharePoint** (absolute, all stations),
  production data, or any power setting.
- **Did not commit in the dev tree.** The only dev-tree mutation was an index-only unstage; the #1313
  fix was committed in a disposable worktree and pushed from there.

---

*Provenance: every line tagged `[MEASURED]` was probed on the Windows host via Desktop Commander
PowerShell between 2026-08-25T00:08:22Z and 2026-08-25T00:21:17Z, true at `origin/main = 5ec99150`,
PR #1313 head `a403f2a6`, watcher clone `74066ae9`, watcher pid 29024. F-I is carried from Station
03's 2301Z breadcrumb and was NOT re-measured this run. Probe scripts retained at
`C:\po-sup-fix-scripts\00-*-2026-08-25.ps1`. This breadcrumb is UNTRACKED until a board PR commits it
— see F-H.*
