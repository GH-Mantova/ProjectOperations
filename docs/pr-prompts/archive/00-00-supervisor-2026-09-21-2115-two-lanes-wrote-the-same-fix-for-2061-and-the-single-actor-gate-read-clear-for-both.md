# Station 00 — Supervisor | 2026-09-21T21:15Z–2026-09-21T21:45Z

## GROUND

```
UTC            2026-09-21T21:15:00Z
origin/main    847840b4 -> 27930beb   (moved mid-run; #2062 merged at 21:23:59Z)
dev tree       main @ a138460e        C:\ProjectOperations2  (5 behind at run end, 0 ahead)
doc version    1                      (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1
```

Doc version and bootstrap **AGREE** (1 == 1). This run was **SIGHTED** — Desktop Commander
connected and a PowerShell shell (PID 23276) ran on the Windows host for the whole run.

## WHAT I MEASURED

**[MEASURED] VM git guard installed first, as PREFLIGHT step 1 requires. Last line quoted:**

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Every `git` call this run went through the Windows shell. No `git` was run against the mount.

**[MEASURED] Not blind — and the first call's error was NOT blindness.** `powershell.exe -Command
"$PSVersionTable..."` came back as `System.Collections.Hashtable.PSVersion.ToString()` — DOCTRINE
§9.1's `-Command`-layer expansion, firing exactly as recorded, through the nested form. A
persistent shell started on the next call and carried the run. **A parser error from an expanded
`$` is not an unreachable machine**, and treating it as one would have been a false blind report.

**[MEASURED] The binding documents were read from the working copy, which was 4 behind — and the
staleness was bounded before I acted on them.** `git diff --numstat origin/main -- <path>` per file:
`DOCTRINE.md` **EMPTY**, `STATION-CAPABILITIES.md` **EMPTY**, `00-supervisor.md` **`1 1`**. The one
differing line is `contract_version: 1` (working copy) vs `3` (`origin/main`), landed by #2049 —
`station_doc_version` is **1** on both sides and every canonical block is byte-identical. So the
body I acted on is current; the version match was not the proof, the per-file diff was. This is
the second consecutive run to record this (blind run F3 recorded the first).

**[MEASURED] Only FOUR mounts this session, not eleven.** `/sessions/<id>/mnt/` held
`PR-Master`, `ProjectOperations2`, `outputs`, `uploads` — **no `po-watcher`, no
`po-sup-fix-scripts`**. STATION-CAPABILITIES §3's `BLIND_RUN_OTHER_MOUNTS_V1` note says to
enumerate rather than assume, and enumerating is what caught it: a sweep capture written to
`C:\po-sup-fix-scripts\` was unreadable from the VM and had to be read back through Desktop
Commander. The mount list is a property of the session, and this session's is four.

**[MEASURED] `status-sweep.ps1` — captured with `*>`, decoded `utf16le` (the BOM was `FF FE`,
§9.3), 953 lines.** Section 0 both positive controls PASS. Section 7 verdict:

```
[LIVE] CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
[LIVE]    C:/po-wt/00i-0004-board4
[LIVE] A station may be mid-run. Prefer to wait and re-run; if you must act, use an ISOLATED
       worktree and touch only NEW branches/PRs.
```

**The CAUTION was correct and it was about a lane that was still working.** I obeyed it: every
mutation this run happened in an isolated worktree I created and tore down, and I merged nothing.

**[MEASURED] Station freshness — two instruments, crossed, as the contract requires.**
`check-breadcrumb.mjs --freshness` → **CLEAN**, exit **0**, 3 checked, 0 malformed, no station
SILENT. Crossed against `lastRunAt` from the scheduled-tasks MCP at 21:3xZ:

| station | cron | lastRunAt | read |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-09-21T21:13:59Z | **this run** |
| `04-scanner` | `0 */4 * * *` | 2026-09-21T18:09:36Z | ok (3.4 h) |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T00:20:35Z | ok (21.2 h) |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T14:10:40Z | ok (7.3 h) |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | **`enabled: false`** |

⚠️ `--freshness` still carries `'00': 2` in its own `CADENCE` map against a live hourly cron, so
its `ok` for `00` is the weaker of the two readings. The MCP row is the one that decided here.

**[MEASURED] The queue, by hand — not quoted from a note.** `armed (*-ready.md)`: **0**.
`needs-marco/`: **63** at run start, **61** at run end. The one arming this run had to account for
was `pr-scopecards-s5-charge-steps-price-cutting`, and it is **not** a lost prompt: it built.
`.arming-log.txt` records `2026-09-21T19:31:53Z ARMED … actor=station-00.interactive-0004`, and
`docs/pr-prompts/processed/` holds both
`pr-scopecards-s5-charge-steps-price-cutting-ready.md` and its `.log`. That log carries the
watcher's own routing verdict:

```
[watcher] merge result for PR #2061: {"ok":false,"marco":true,"fixLane":false,
                                      "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

So blind-run **F2** — *"the one armed prompt whose gate cleared forty-five minutes ago"* — is
closed by events: it was armed, it built, it opened **#2061**, and the watcher routed it to Marco.

**[MEASURED] Lane classification per §10.1, with both controls.** POSITIVE control
`merge result for PR #` over `docs/pr-prompts/processed/*.log` → **754** lines. NEGATIVE control,
a needle minted this run → **0**.

| PR | verdict lines | lane |
|---|---|---|
| #2062 | 1 — a *review* verdict only (`rev-2062-ready.md.log`), no `[watcher] merge result` | no watcher routing ⇒ hand-classified; all 3 files under `docs/pr-prompts/` ⇒ inside `^(tests\|docs)/` |
| #2061 | 2 — including a genuine `{"ok":false,"marco":true}` routing line | **RULE 2 applies. Marco's.** |
| #2059 | **0** | `[NO LANE VERDICT — hand-classified]`: sole file `scripts/pipeline/status-sweep.ps1`, outside `tests\|docs` and outside 00's recorded `docs/` lane ⇒ **Marco's** |

**[MEASURED] #2061's three reds are two causes, not three.** CP-26's verdict token, read from
column 3 of the job log (§9.1's tab-column trap):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` = **parked by design, not work**, and it accounts for both `Approval receipt
(CP-26)` and `PR gates — diff checks`, which run the same check (§9.4). Only the API job is real.

**[MEASURED] DOCTRINE §7 guard 5 fired on me, live, and the error is what caught it.** I wrote
`$marcoDir`-style names everywhere except one loop, where `$n = $pair[1]` silently clobbered `$N`
(the `needs-marco` path) — PowerShell variables are case-insensitive. The first reading was
`pr-2042-review-reject.md exists=False`, i.e. *"the stale escalations aren't there"*. Re-run with
non-colliding names: **both files exist**, at
`docs/pr-prompts/needs-marco/`. **The wrong reading was the one that would have closed the finding
silently.** Recorded because guard 5 is scoped to *single-letter* names and `$N`/`$n` is exactly
that case — the guard is right and I still walked into it.

**[MEASURED] The dev tree's `.arming-log.txt` holds NO local-only content.** `git diff --numstat
origin/main` reads `2 2` — two lines changed, both byte-identical in content; the
`2026-09-21T19:31:53Z ARMED pr-scopecards-s5…` line is already on `origin/main`, landed by #2062.
This is a line-ending smudge, **not** the append-only superset shape (`N 0`) that the FF cure warns
is unrecoverable, so nothing another actor wrote is at risk here.

## WHAT CHANGED

1. **Re-ran #2059's failed `tendering-e2e`** (`gh run rerun 35653768414 --failed`, exit 0). Read
   back: #2059 went from `14 pass / 1 fail` to **`14 pass / 0 fail / 1 pending`**; the e2e was
   still running at run end.
2. **Posted one factual comment on #2061** with the measured root cause of its remaining API red —
   `issuecomment-5767804014`, read back from the returned URL. No push, no label, no merge.
3. **Discharged two dead escalations**, `Move-Item` into `needs-marco/discharged/`, **nothing
   deleted**: `pr-2042-review-reject.md` (#2042 MERGED 19:29:45Z) and `pr-2051-review-fix.md`
   (#2051 MERGED 20:32:06Z). Both re-asked individually with `gh pr view --json
   number,state,mergedAt`, against a NEGATIVE control (`#999997` → exit **1**, GraphQL
   not-resolved) so the probe could not answer locally. Read back: source gone `True`, destination
   present `True`, census **63 → 61**. A `_DISCHARGE-NOTE-2026-09-21-2140.md` sits beside them —
   ⚠️ **that folder is gitignored, so this paragraph is the only copy that reaches anyone.**
4. **This board PR**: collected the blind run's breadcrumb into tracked state, retired the spent
   `pr-scopecards-s5-charge-steps-price-cutting-HOLD.md` (its consumed copy is preserved in
   `docs/pr-prompts/processed/`, so nothing is destroyed), archived the two dispositioned
   breadcrumbs, and added this one.
5. **Created and tore down two isolated worktrees** (`00s-2061-fix`, removed and pruned;
   `00s-board-2140`, this PR's). Neither the dev tree nor the watcher clone was mutated.

**Not changed:** no merge, no arm, no label, no `sot/` edit, no watcher restart, no branch deleted.

## FINDINGS

### F1 — Two Station 00 lanes independently wrote the SAME fix for #2061, and only the read-back before pushing stopped the collision

`[MEASURED]`. I diagnosed #2061's API red from the job log (`TS2554: Expected 4 arguments, but got
3` — the PR added a 4th ctor param `chargeStepPricing` to `TenderRateSetService` and did not update
the pre-existing spec's `makeService` factory), wrote the fix in an isolated worktree, verified it
with a byte-delta assertion (`DELTA_ACTUAL=188 DELTA_EXPECTED=188`), and then — per the read-back
rule — re-asked the remote tip before pushing:

```
remote head = afbf78ae99f28116a4001581db39c29fafb4e99b
local  head = 6e2b1843d74bfcecd8101b533ca72a027d37ac15   <- my fetch, 6 minutes earlier
afbf78ae  test(tendering): pass the 4th TenderRateSetService ctor arg in its spec
          station-00.interactive-0004 <marco@initialservices.net>  Tue Sep 22 07:25:04 2026 +1000
```

**The other lane had pushed the identical fix while I was writing mine.** `git merge-base
--is-ancestor 6e2b1843 afbf78ae` → exit **0**, so its commit sat directly on the tip I had fetched.
I discarded my edit and removed the worktree rather than pushing a competing commit.

This is LL-38's shape without LL-38's cost: two actors, one branch, caught by one probe. The cost
paid was one wasted diagnosis; the cost avoided was a racing push onto a branch a human-directed
lane was actively iterating on.

**DISPOSITION: ACTIONED** — stood down, worktree removed (`remove exit=0`, `still exists=False`),
nothing pushed. The surviving work is F2.

### F2 — #2061 is still red, and the commit message's premise for why it wouldn't be is refuted

`[MEASURED]` run `35657059461`, job `106523245315`, **after** `afbf78ae`: the suite now compiles
and **2 tests fail at runtime** instead — `Test Suites: 1 failed, 311 passed`, `Tests: 2 failed,
4682 passed`:

```
TypeError: Cannot read properties of undefined (reading 'in')
  > 119 |       const ids = new Set(where.id.in);
  at TenderRateSetService.buildChargeStepsSnapshot (tender-rate-set.service.ts:190:48)
  at TenderRateSetService.lock (tender-rate-set.service.ts:37:44)
```

`buildChargeStepsSnapshot` queries `prisma.rateTable.findMany({ where: { chargeSteps: { not:
Prisma.JsonNull } }, select: {…} })` — **no `where.id.in`, and `select` rather than `include`** —
while the spec's shared `rateTableFindMany` mock is written for exactly one call shape and
dereferences `where.id.in` unconditionally. So `afbf78ae`'s stated premise, *"buildChargeStepsSnapshot
reads prisma.rateTable, already mocked, so an empty stub is sufficient"*, is **refuted by its own
CI run**: `rateTable` is mocked, but not for this query shape. The fix belongs in the mock — an
additive `if (!where.id?.in) return tableStore.filter(t => t.chargeSteps != null)` branch that
leaves the existing id path untouched; `tableStore` defaults to `[]`, so no existing test moves.

**DISPOSITION: DISPATCHED** — to the live `station-00.interactive-0004` lane, via a comment on the
PR itself (`issuecomment-5767804014`), because stations do not read each other's chats and that
lane is demonstrably watching this PR. Handing it over rather than pushing is F1's conclusion
applied. #2061 carries `do-not-merge` **and** a genuine watcher `marco:true`, so it stays for Marco
regardless of who lands the fix.

### F3 — The single-actor gate read CLEAR through a lane that was live the entire time. Second measured instance, different lane.

`[MEASURED]`, three readings, all taken while the interactive lane was actively working:

| moment (UTC) | what the gate said | what was actually true |
|---|---|---|
| 21:16Z sweep §3 | `git index.lock False/False`, `git processes touching our trees: 0`, `no PR touched in the last 2 min` | lane mid-run; §2 flagged its worktree, §7 raised CAUTION |
| 21:28Z, my pre-mutation re-check | `index.lock False/False`, `git procs 0`, **`00i worktree gone`** | the lane had pushed `afbf78ae` at **21:25:04Z** and merged **#2062** at **21:23:59Z** |
| 21:31Z | — | lane still the most recent writer on #2061 |

**The worktree's disappearance read as "the lane finished", and it did not mean that.** A lane can
tear down its worktree and keep acting through `gh`, which touches no local tree and holds no lock,
so every instrument in section 3 is structurally blind to it. This is §9.6's shape — an empty
result read as an empty world — against the one gate that stands between this design and LL-38.

It is the **second** instance: merged PR **#2057** records *"station 04 was live mid-run while the
single-actor gate read SAFE TO ACT"* on 2026-09-21. That one was a station with a worktree; this
one is a lane **without** one, which is the harder case, because the section-2 worktree signal that
produced the CAUTION here would not have fired ten minutes later.

What would make it urgent: a run that acts on `git procs 0` **alone** after the worktree signal has
cleared. The cheap mitigation, and the one that worked here, is already written down — re-ask the
remote tip immediately before every push, and treat a PR's `updatedAt` as the liveness signal
rather than the local tree.

**DISPOSITION: DEFERRED** — a real second instance, recorded with its measurements. Not actioned
this run because the candidate cure (teach section 3 to read `updatedAt` across the open board) is
a `scripts/pipeline/` change, outside 00's recorded merge lane, and #2059 is already open against
that same file; stacking a second change on it while a second actor is live is the collision this
finding is about.

### F4 — #2059's `tendering-e2e` red is not attributable to its diff; re-run issued, not yet resolved

`[MEASURED]`. #2059 changes exactly one file, `scripts/pipeline/status-sweep.ps1` (+30/-5). Its
e2e failure was `4 failed`, all in `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`, with a
Postgres line in the same log: `duplicate key value violates unique constraint
"user_dashboards_user_id_slug_is_system_key"`. **A PowerShell script cannot cause a dashboard
unique-constraint violation**, and `main` CI on `847840b4` was `4 success / 0 failed`. Per the
transient-CI rule I re-ran before diagnosing a defect: `gh run rerun 35653768414 --failed`, exit 0.
Read back at 21:34Z: **`14 pass / 0 fail / 1 pending`** — the e2e was still running when this run
ended, so **whether it is a flake or a seed collision on `main` is not yet measured.**

⚠️ I am deliberately not calling this "a flake resolved". The predecessor's breadcrumb called
#2042's e2e red a flake on 2026-09-21; if this re-run fails the same way, two independent PRs with
unrelated diffs have now failed the same dashboards spec, and that is a `main` seed defect to
author a `fixes_pr` for — not a PR to chase.

**DISPOSITION: DEFERRED** — to the next occurrence, with one probe: read
`gh pr checks 2059` for `tendering-e2e`. Green ⇒ flake, close this. Red on
`batch1-dashboards.spec.ts` again ⇒ promote to a `main` regression and author the fix prompt.

### F5 — Blind-run F1 (Desktop Commander `CONNECT_TIMEOUT`) — already open with Marco, not re-filed

The 20:15Z occurrence ran blind and escalated this with three RULE-1 options. `[MEASURED]`
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already exists
(mtime 2026-09-06), so the escalation is open and **I did not file a duplicate**. This occurrence
adds one data point on the other side: **21:13Z fired SIGHTED**, Desktop Commander connected
normally. Consecutive occurrences 20:15Z blind → 21:13Z sighted is consistent with the recorded
~40% intermittency and with a startup-latency cause rather than a configuration one.

**DISPOSITION: ESCALATED** — carried, not re-raised. The decision (raise the MCP connect timeout
and add a bounded retry) is Marco's and touches session/app configuration, not this repo.

### F6 — Blind-run F4: COLLECT is now done, and its own breadcrumb is landed here

The blind occurrence could not collect. Its two named breadcrumbs (`…-1914-…`, `…-04-scanner-…-1810-…`)
were in fact already tracked and dispositioned by **#2060**; `git ls-files` returns **1** tracked
path for each and **0** for the blind run's own, so the only genuinely uncollected report was the
blind one. Checked by basename against the tracked set rather than by dev-tree `git status`,
because the 2026-09-07 duplicate-breadcrumb incident was caused by asking the wrong instrument.
All five of its findings are dispositioned in this file; its breadcrumb is added as tracked here,
and the two older ones are archived.

**DISPOSITION: ACTIONED.**

### F7 — Blind-run F3 (dev tree behind; a superseded station doc served to its own run) — second instance, same day

`[MEASURED]` this run: 4 behind at start, 5 behind at end, **0 ahead** (no NO-DRIFT violation), and
the working copy again served a `00-supervisor.md` whose `contract_version` was one revision old.
Benign again, and again established by diffing rather than by the version field. The standing fix,
`pr-devtree-sync-ff-only-guard-HOLD.md`, has been queued since 2026-08-28.

**DISPOSITION: DEFERRED** — fix already queued; this adds a second dated instance in one day to its
evidence. It becomes urgent the moment a station doc changes *substantively* without a
`station_doc_version` bump, which nothing in the current preflight would catch from a stale tree.

### F8 — Blind-run F5 (`weekly-security-audit` disabled) — already open with Marco

`[MEASURED]` from the scheduled-tasks MCP this run: `enabled: false`, `lastRunAt
2026-09-06T21:32:44Z`, no `nextRunAt`. Already filed as
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`,
and `STATION-CAPABILITIES.md` §1 and §5 both already carry the correction. **Not re-filed.**

**DISPOSITION: DEFERRED** — open with Marco; no station should re-raise it.

## WHAT I DID NOT DO

- **Did not merge anything.** #2062 was CLEAN, green, reviewed MERGE and inside 00's `docs/` lane —
  I ran `Assert-SmokedOrEscalate -PR 2062` and the pre-merge read-back came back
  `state=MERGED`: the interactive lane merged it at **21:23:59Z**, 22 seconds before I looked.
  #2061 and #2059 are both Marco's (a genuine watcher `marco:true` plus `do-not-merge` on one, a
  `scripts/` diff outside 00's lane on the other), so neither was merged or auto-merged.
- **Did not push my fix to #2061**, having measured that another lane had already landed it.
  Handed the remaining diagnosis over by PR comment instead (F1, F2).
- **Did not remove a `do-not-merge` label.** Absolute — only Marco. CP-26 reading
  `[LABEL_PRESENT]` is the gate working, not a failure.
- **Did not update either PR's branch out of BEHIND.** Both are Marco's and neither can merge
  tonight; a branch update would have been a second write onto a branch a live lane owns, and a
  rebase would have needed a force-push (irreversible, §5.4).
- **Did not arm anything.** `armed: 0`, and nothing in the queue had a cleared gate this run —
  the one prompt that did (`scopecards-s5`) was armed at 19:31Z by the interactive lane and has
  already built into #2061.
- **Did not clear a `[STALE]` row on the tag alone.** Each PR was re-asked individually with a
  negative control, and each file was read in full to confirm nothing GENERAL survived (F6/§5).
- **Did not delete anything.** The discharged escalations were moved; the retired HOLD's consumed
  copy is preserved in `docs/pr-prompts/processed/`.
- **Did not prune the orphaned worktree `C:/PR-Master/worktrees/po-vg`** (dirty=1, age ~17.6 d) or
  the registry escapee `C:\po-worktrees\po-fix-2005`. Both are Station 03's lane, `po-vg` holds
  uncommitted work, and branch/worktree deletion is irreversible.
- **Did not restart or touch the watcher.** `node pid 9744` RUNNING, wrapper alive, heartbeat
  14 min, `armed: 0` — an idle watcher with nothing armed is CORRECT, not wedged. No `-Fix` was
  contemplated.
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and
  its last line is quoted above.
- **Did not touch `/sot/`, the watcher clone, production data, or Azure / Entra / SharePoint.**
- **Did not fast-forward the dev tree.** It is 5 behind with a line-ending smudge on
  `.arming-log.txt` and a `D` on the HOLD this PR retires; the FF is left until this PR merges, at
  which point the convert-on-write cure applies (blob LF / checkout CRLF).
