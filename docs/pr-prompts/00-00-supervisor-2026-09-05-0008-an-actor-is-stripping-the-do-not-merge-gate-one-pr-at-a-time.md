# Station 00 — Supervisor | 2026-09-05T00:07:58Z–2026-09-05T00:22Z

## GROUND

```
UTC            2026-09-05T00:07:58Z
origin/main    39c186a5            (fetched, then rev-parse, in the dev tree)
dev tree       main @ 39c186a5     C:\ProjectOperations2   (was 83e5dfe0; FF'd this run)
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — this run is not read-only.

**SIGHTED run.** `start_process` shell `powershell.exe` reached the box on the second attempt. The
first attempt returned a PowerShell `ParserError` because `$env:COMPUTERNAME` was stripped from the
`-Command` string before it reached the shell — the documented "never put PowerShell logic in
`-Command`" trap. **That is a caller-side quoting failure, not blindness**, and it was resolved by
starting a persistent shell instead. Recording it because a parser error on the very first command of
the run looks exactly like an unreachable machine, and STEP 1 tells you to stop on one.

All three binding documents proved current against `origin/main` by
`git diff --numstat origin/main -- <path>` (the sanctioned form; no piped hash was taken):
`00-supervisor.md` EMPTY, `DOCTRINE.md` EMPTY, `STATION-CAPABILITIES.md` EMPTY.

## WHAT I MEASURED

- **[MEASURED] The dev tree was 1 commit behind and FF'd cleanly.** `83e5dfe0` → `39c186a5`.
  Index empty (`git diff --cached --name-status`), `git diff --numstat` empty, 25 untracked. No
  smudge, no staged change, no FF refusal.
- **[MEASURED] Freshness CLEAN, exit 0**, and it agrees with `lastRunAt` on every station —
  the cross-check escalation #23 demands, done in full:

  | station | newest breadcrumb | `lastRunAt` | verdict |
  |---|---|---|---|
  | 00 | 2026-09-04T23:08Z | 2026-09-05T00:07:58Z (this run) | aligned |
  | 03 | 2026-09-04T23:01Z | 2026-09-04T23:00:50Z | aligned |
  | 04 | 2026-09-04T22:10Z | 2026-09-04T22:09:35Z | aligned |
  | 05 | 2026-09-04T14:11Z | 2026-09-04T14:10:38Z | aligned |

  **No station is SILENT, so no transcript read was required.** 05 is 10.0 h into a 24 h cadence and
  is **not** a stopped station.
- **[MEASURED] RULE 2 probe, tree pinned, with both controls.** LIVE
  `C:\ProjectOperations2\docs\pr-prompts\processed` = **1918 logs, newest 2026-09-04T23:50:36Z,
  POS(`marco.:true`) = 612**. DECOY `C:\po-watcher\...\processed` = **21 logs, newest
  2026-08-17T14:28:09Z, POS = 10** — it still passes its own positive control while being 18 days
  stale, which is why **age is the discriminator, not POS > 0**. Negative control `PR #999999` → **0**.
- **[MEASURED] The only per-PR log hits are `rev-<N>-ready.md.log` — review jobs, which answer for
  BOTH lanes and are not lane verdicts.** So #1614, #1615, #1616, #1619, #1618 and #1620 all carry
  **NO LANE VERDICT**. Hand-classified by `classifyPolicyFiles` (three accepted forms:
  `^(tests|docs)/`, `(^|/)__tests__/`, `\.(test|spec)\.[cm]?[jt]sx?$`), every one of them has
  `apps/**` or `packages/**` source outside those forms ⇒ **MARCO'S**.
- **[MEASURED] Trunk is NOT green — it is unmeasured.** `main` CI on `39c186a5`:
  **0 success / 0 failed / 4 running.** `[CANNOT MEASURE]`, not a green trunk.
- **[MEASURED] Watcher chain intact.** node pid 20000, wrapper alive, heartbeat 20 min with armed=0
  and in-progress=0 ⇒ idle, not wedged. Armed prompts: **0**.
- **[MEASURED] All four orphaned worktrees `dirty=0` at the moment of removal**, re-measured
  immediately before acting (`[LIVE]` means true-when-measured). `C:/po-vg` `dirty=1`, newest write
  `2026-09-04T07:55:32Z`.
- **[MEASURED] The detached worktree held nothing unique.** `git branch -a --contains f85f11cf` →
  `fix1483` **and** `remotes/origin/fix1483`. It is on the remote; removing the worktree lost nothing.
- **[MEASURED] `C:\po-1483-fix` was an empty skeleton like the two registry escapees** — 0 files
  outside `node_modules`, no `.git`. **POSITIVE CONTROL:** the same enumerator returns **59** files for
  `C:\ProjectOperations2\scripts\pipeline`, so "0" is a real zero and not a broken counter.

## WHAT CHANGED

1. **Dev tree FF'd** `83e5dfe0` → `39c186a5`.
2. **Auto-merge disabled and `do-not-merge` applied to #1619.** Read back: `automerge=off`,
   `labels=[do-not-merge]`.
3. **`do-not-merge` re-applied to #1614 and #1615** after an actor stripped it (F1). Read back on all
   four: #1614 / #1615 / #1616 / #1619 all `labels=[do-not-merge]`, `automerge=off`.
4. **Preserved `po-vg`'s unpublished work** to
   `C:\po-preserve\check-pipeline-heartbeat.FROM-po-vg.2026-09-05.mjs`. SHA256 verified identical
   (`7427A6D0…6719`, 6144 bytes both sides). **`po-vg` itself was NOT pruned.**
5. **Removed four orphaned worktrees** (`po-guard`, `po-sa-fix`, `po-1483-fix`, `po-work/s2-e2e`) and
   pruned the registry. Read back: `git worktree list` now holds only the dev tree and `po-vg`, and
   all four branches survive (`fix1483` `9de07267`, `guard/never-arm-cd-s1` `dd954645`,
   `pipeline/standing-authority-reject` `12c20e90`, `fix/no-rebase-while-checks-run` `23c91ba9`).
6. **Removed the two registry escapees** after re-confirming 0 files each.
7. **Opened PR #1621** with the F1 fix to `status-sweep.ps1`, and applied `do-not-merge` to it —
   it is `scripts/`, therefore Marco's, and no station may merge it.
8. **Archived the breadcrumbs dispositioned below** to `docs/pr-prompts/archive/`.

## FINDINGS

### F1 — 🔴 AN ACTOR IS STRIPPING `do-not-merge` OFF MARCO-CLASSIFIED PRs, ONE AT A TIME, AND IT REACHED THE BOARD FOUR MINUTES BEFORE THIS RUN

At 23:11Z my previous run disabled auto-merge and applied `do-not-merge` to #1614, #1615 and #1616 —
three second-lane PRs that had been armed to merge themselves. The label events since:

```
#1614  2026-09-04T23:11:44Z  labeled    do-not-merge  by=GH-Mantova
#1614  2026-09-04T23:57:18Z  unlabeled  do-not-merge  by=GH-Mantova   <-- stripped
#1615  2026-09-04T23:11:48Z  labeled    do-not-merge  by=GH-Mantova
#1615  2026-09-05T00:01:22Z  unlabeled  do-not-merge  by=GH-Mantova   <-- stripped
#1616  2026-09-04T23:11:53Z  labeled    do-not-merge  by=GH-Mantova   (not yet reached)
```

**This is not one event, it is a pattern with a cadence** — 46 minutes apart, working down the list,
and #1616 is the obvious next one. `by=GH-Mantova` attributes nothing: the watcher and every agent
authenticate as that identity, which is the open watcher-identity escalation.

Meanwhile **#1619** (opened 23:39Z) was sitting `MERGEABLE` with **auto-merge ARMED**, blocked only by
two in-progress checks, carrying **five** non-test/doc files including `packages/config/src/charge-step-semantics.ts`
and `apps/api/src/modules/rates/rate-step-evaluator.ts`. It would have merged itself the moment CI
concluded. I disabled auto-merge and labelled it.

And two more landed unattended while this was happening: **#1620 at 23:49:56Z** (`apps/web/src/pages/crm/*`)
and **#1618 at 00:06:42Z — two minutes before this run started** (`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`).
Neither has a lane verdict; both are hand-classified **Marco's**. That is **seven** Marco-classified
releases this evening without his gate (#1589, #1606, #1593, #1609, #1613, #1620, #1618).

Removing `do-not-merge` does **not** clear RULE 2, and no agent may author a clearance — that is
already a standing rule. What is new and worse is that the gate is now being **actively removed** by
something that keeps running between my runs. I re-apply it hourly; it is stripped within the hour.
**I cannot win this with labels**, and I will not escalate by fighting it — a second actor and I
flipping the same label is the LL-38 collision, not a control.

**ESCALATED → Marco.** The question: *what should hold a Marco-classified PR when the label does not?*

- **(a) A required status check that fails whenever the PR is Marco-classified and no in-chat
  clearance exists — a branch-protection gate, not a label.** RULE 1 **complete-and-additive**: it
  cannot be removed by anything with PR-write scope (labels can), it holds for *every* lane including
  ones we have not discovered, it needs no station to be awake, and it damages no data or existing
  entry — a blocked PR is simply not merged. **This is the only option that survives an actor with
  write access.** It is also the only one that closes the "second lane merges while 00 is blind" hole.
- **(b) Find and stop the actor first.** Fails the *immediate* half — it is unbounded work, and the
  stripping continues meanwhile. Worth doing, but not instead of (a).
- **(c) Keep re-applying the label each run.** Fails both halves: it demonstrably does not hold, and
  it burns a run an hour to lose the race.

**Do NOT remove `do-not-merge` from #1614, #1615, #1616, #1619 or #1621.**

### F2 — a dirty worktree pinned LIVE forever and froze the board's safe-to-act gate — FIXED

Station 03's F1, dispatched to me. `status-sweep.ps1:177` read
`$isLive = ($dirtyCount -gt 0) -or (age < 30)`. Dirtiness pinned LIVE with **no expiry**, because the
recency test was reachable only for a clean tree. One untracked file from an aborted run made section 7
emit board-wide `CAUTION ... prefer to wait and re-run` on **every** sweep, forever. `C:/po-vg` had been
doing exactly that for 15.2 hours.

Fixed in **#1621**: recency decides liveness; dirtiness is re-aimed from *blocking the board* to
*warning before a prune*. Verified on the patched script with **both** controls in one run — `po-vg`
(16 h silent, dirty) now reads `orphaned` **plus** a new `HOLDS UNCOMMITTED WORK ... PRESERVE OR COMMIT
BEFORE PRUNING` line, while a worktree created minutes earlier still reads `LIVE STATION WORKTREE`. The
positive control matters: without it this change is indistinguishable from disabling liveness detection.

**ACTIONED** — PR #1621 open, labelled `do-not-merge`. It is `scripts/`, so it is **Marco's**; I opened
it, I do not merge it.

### F3 — six abandoned worktrees and two registry escapees, all proved to hold nothing unique — REMOVED

Station 03's F2 and F3, dispatched to me, F3 on its second run without action. All four orphans
re-measured `dirty=0` immediately before removal; the detached one proved contained in
`origin/fix1483`; both escapees and `po-1483-fix` proved to be empty directory skeletons against a
working positive control. Branches all survive.

**ACTIONED** — read back: `git worktree list` holds only the dev tree and `po-vg`; sweep now reports
`worktree-registry-escapees: none found`.

### F4 — `po-vg`'s untracked file is unpublished work, and it is now safe

`scripts/pipeline/check-pipeline-heartbeat.mjs` does not exist on `origin/main`. Preserved to
`C:\po-preserve\` with a verified matching SHA256 **before** any pruning decision, and `po-vg` was
deliberately left in place. Once #1621 lands, `po-vg` will correctly classify as orphaned-but-dirty and
the sweep will name the file rather than silently blocking the board.

**ACTIONED** (preserved). The worktree itself is **DEFERRED** — it belongs to an in-flight fix branch
(`fix/no-rebase-while-checks-run`) and Station 03 explicitly said not to touch it.

### F5 — Station 03's F4/F5/F7 and Station 04's F4: no action, and that is the right answer

- 03-F4 (clone `dirty=2` is a CRLF touch plus watcher runtime state; the sweep's "may refuse to start"
  is a warning about nothing — the watcher has been up 13.4 h): **DEFERRED**, agreed. Do not dispatch a
  restart on that sweep line.
- 03-F5 (66 preflight stashes, static; accrues per *dirty launch*, not per day): **DEFERRED**. The drain
  is `git stash drop`, never `pop`.
- 03-F7 (disk 18.3 % free): **DEFERRED**. Six trees removed this run will have improved it; becomes a
  finding below ~10 %.
- 04-F4 / 03's clean instrument results: no defect, recorded.

### F6 — Station 03's cadence disagreement now has an interval measurement

03's last two runs were **23 h 59 m** apart with none in between, which settles the direction: the cron
is daily, the bootstrap and `STATION-CAPABILITIES.md` §6 say 4-hourly.

**ESCALATED → Marco** (existing escalation, `needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`,
now with 03's interval evidence). Not a second escalation. RULE 1: the complete-and-additive answer is
**set the cron to 4 h and leave the docs alone** — it satisfies the documented contract immediately, more
frequent measurement of a report-only station cannot damage data entry, and it removes the disagreement
permanently. Editing the docs down to daily is also complete but fails the *immediate* half: a crash at
23:05Z currently goes unseen for a full day.

### F7 — Station 04's launcher-chain and doctrine-citation findings

04-2210 F1 (the live watcher's top two launcher links are not in the repo and the concern has no
file-backed stop) is already open as `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`.
**ESCALATED → Marco** (existing). F2 and F3 are documentation-citation defects inside
`DOCTRINE`/`STATION-CAPABILITIES`/`pr-gates.mjs:327`. 04-1810 F3 (DOCTRINE §10.1 describing
`classifyPolicyFiles` more narrowly than the code) was **already corrected on main in #1604** — dead,
do not re-raise. 04-1810 F1 is discharged by F3 above.

**DISPATCHED → Station 05 (SoT Keeper)** for the remaining citation corrections; they are documentation
accuracy, which is 05's lane, and they must not be folded into a code PR (CP-24).

### F8 — the sweep's ten `[STALE]` rows on the agent-authored clearance must NOT be cleared

Sweep §5 lists `agent-authored-rule-2-clearance-2026-09-04.md` as referencing eleven merged PRs and
advises clearing it. **Do not.** Those PRs are the escalation's *subject*, not its blockers — the file
exists precisely because they merged. It also still references #1614, #1615 and #1616 as genuinely
open. F1 above is new evidence for it, so it is **amended, not discharged**.

**ESCALATED → Marco** (existing, unanswered, now widened by F1).

## WHAT I DID NOT DO

- **Merged nothing.** Every open PR is hand-classified Marco's; `armed=0`, so there was nothing in my
  lane to merge. #1619 was minutes from merging *itself* and I stopped it rather than helping it.
- **Removed no `do-not-merge` label**, and authored no approval or clearance file.
- **Armed nothing.** In particular **not** `pr-crmui-{chrome,comms,relationships}-s1-*-HOLD` — #1614/15/16
  already carry that work — and not `pr-cardui-s2-wbs-table-shell-HOLD.md` or
  `pr-tr-s1-reminder-policy-HOLD.md`, both on the standing never-arm-now list.
- **Did not touch `po-vg`** beyond copying its untracked file out, and did not `--force` any worktree removal.
- **Did not clear the `[STALE]` escalation rows** (see F8) — clearing them would delete the only written
  record of tonight's incident.
- **Did not chase the stripping actor.** Identifying it needs process-level attribution the board does
  not currently have; fighting it with labels is the LL-38 collision. It is F1's option (b), and it is
  Marco's call whether to spend a run on it.
- **Did not run `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere**, and ran no git
  through a device bridge against the Windows `.git`.
- **Azure / Entra / SharePoint: not touched, not read, not enumerated.** No production data written.
