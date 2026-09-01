# Station 00 — Supervisor | 2026-09-01T08:10Z–2026-09-01T08:35Z

## GROUND

```
UTC            2026-09-01T08:10:25Z
origin/main    515cb53e            (fetched, then rev-parse; 000de2d9 at run start)
dev tree       main @ 000de2d9  ->  main @ 515cb53e   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was read-write within station authority.

SIGHTED, not blind: `start_process` shell `powershell.exe` returned PID 31516 on the first call,
`hostname` = `LAPTOP-E6NHU4E4`. All three binding documents were read this run; `git diff --stat
000de2d9 origin/main -- docs/pipeline/` returned empty, so the working copies I read were
byte-current with `origin/main`.

## WHAT I MEASURED

### The safe-to-act gate was DO NOT ACT, and the cause was two stale locks

[MEASURED] `status-sweep.ps1` @08:10:55Z: section 3 `git index.lock interactive/clone: True / True`,
`git processes running: 0`, `in-progress prompts: 0`. Section 7: **DO NOT ACT**.

Calibrated before believing it (PREFLIGHT step 4, DOCTRINE §7):

| Probe | Dev tree | Watcher clone |
|---|---|---|
| lock bytes | **0** | **0** |
| lock mtime (UTC) | 07:14:34.569Z | 07:17:48.517Z |
| age at measurement | 57 min | 54 min |
| exclusive `File.Open(..., 'None')` | **succeeded — UNHELD** | **succeeded — UNHELD** |
| mtime re-read 3 min later | unchanged | unchanged |

[MEASURED] `Get-Process git` = **0**. [MEASURED] `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
`rebase-merge` / `rebase-apply` / `sequencer` — **absent from both** `.git` directories.
[MEASURED] in-progress prompts 0; armed 0; watcher idle; no PR touched in the previous 2 min.

Both locks predate this run by ~55 min, so neither is mine. This is the documented device-bridge
signature (DOCTRINE §9.2) — occurrences **five and six**, and the first time it has hit the
**watcher clone** as well as the dev tree.

### The machinery — two instruments disagreed, resolved by reading the command lines

[MEASURED] `restart-watcher-if-wedged.ps1` @08:11:53Z: `armed prompts waiting: 0`,
`watcher process: ALIVE (pid 2292)`, `restart churn: 0 cycle(s) in 20 min`,
**`VERDICT: OK - nothing armed and the watcher is alive.`**

[MEASURED] The ENSURE-UP probe printed in this station's own doc at §3b returned
`node=1 wrapper=0` — i.e. **ORPHANED NODE**, whose prescribed fix is to start another supervisor.

[MEASURED] Full command lines of every `powershell.exe` matching `watcher`:

```
PID=13464 :: powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden
             -File C:\ProjectOperations2\scripts\pr-watcher\watcher-launcher.ps1
PID=19200 :: powershell.exe -NoProfile -ExecutionPolicy Bypass
             -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
```

[MEASURED] `watcher-launcher.ps1` line 24 is `& "C:\po-watcher\ProjectOperations\scripts\pr-watcher\supervise-watcher.ps1"`.
It is a **call operator**, not `-File`, so `supervise-watcher.ps1` runs **inside PID 13464** and can
never appear in any process command line. The chain is intact and three deep:
**13464 (launcher + supervisor) -> 19200 (start-watcher) -> 2292 (node index.mjs)**.
The watcher is supervised. **The probe is wrong, not the machine.** I relaunched nothing.

### The trunk was reported RED. It is GREEN.

[MEASURED] `gh run list --commit 515cb53e47a25b851bac9e00046513237eb7218b` (full 40-char SHA per
DOCTRINE §9.4) -> four runs — Push on main, CI, Deploy, Tendering Browser Smoke — **all
`completed success`**.

[MEASURED] `git log --oneline 000de2d9..origin/main` shows `abbb2519` = **#1485**,
*"re-section 06's 05:35Z breadcrumb to the report contract - it took main red"*.

[MEASURED] `git show origin/main:docs/pr-prompts/00-06-pr-master-2026-09-01-0535-...md` contains all
five contract section headings (regex-matched one at a time, anchored). `check-breadcrumb.mjs` after
the dev-tree fast-forward: `structure: 14 checked, 0 malformed`, **CLEAN, exit 0**.

### The board, and the lane of every PR on it

[MEASURED] RULE-2 probe, correct regex form, with controls:
`Select-String -Path *.log -Pattern 'marco.:true'` -> **POS 602**, breadth `marco` -> **1284**.

| PR | Files | Lane verdict | Classification |
|---|---|---|---|
| 1477 | `apps/api/**` spec + `test-support/` | reviewer **BLOCK**, no watcher merge verdict | `[NO LANE VERDICT — hand-classified]` outside `^(tests\|docs)/` -> **MARCO'S** |
| 1478 | code | `{"ok":false,"marco":true,...}` | **MARCO'S** + `do-not-merge` label |
| 1483 | code | `{"ok":false,"marco":true,...}` | **MARCO'S** + `do-not-merge` label |
| 1487 | `scripts/pipeline/status-sweep.ps1` | none | `[NO LANE VERDICT — hand-classified]` outside `^(tests\|docs)/` -> **MARCO'S** |
| 1489 | one `docs/pr-prompts/*.md` | reviewer **MERGE** (`rev-1489`), no watcher merge verdict | `[NO LANE VERDICT — hand-classified]` inside `docs/`, no `migrations/` -> not Marco's |
| 1490 | one `docs/pr-prompts/*.md` | none | `[NO LANE VERDICT — hand-classified]` inside `docs/`, no `migrations/` -> not Marco's |

[MEASURED] `arm-prompt.ps1:194` runs `git ls-files --error-unmatch <HOLD>` and `exit 1` on failure.
`git status --porcelain` on `pr-fix-malformed-breadcrumb-1482-HOLD.md` -> `??`. The primitive
therefore **refuses** it, correctly.

[MEASURED] RULE 4 detector on that HOLD, both instruments: `lint-prompt.mjs` -> `ADMIT (size 1)`,
exit 0; case-sensitive grep of the three-marker union -> **0**, with positive control
`pr-524-rates-b-slice2-canonical-HOLD.md` -> **2**. Body read in full: no prose gate.

## WHAT CHANGED

1. **Cleared two proven-stale 0-byte `index.lock` files.** Dev tree via the sanctioned
   `scripts\clear-stale-index-lock.ps1` (`no git process running` / `lock age: 59.3 min` /
   `stale lock removed`). The watcher clone's by `Remove-Item` — **the sanctioned script hard-codes
   the dev-tree path only and cannot reach it**. Read back: both `Test-Path` -> `False`.
   `status-sweep.ps1` re-run: `index.lock interactive/clone: False / False`, verdict flipped to
   **SAFE TO ACT**. No git command was run in the clone; only an orphaned lock file was deleted.
2. **Fast-forwarded the dev tree** `000de2d9 -> 515cb53e` (`git merge --ff-only origin/main`).
   Read back: `git rev-parse --short HEAD` = `515cb53e`. `git diff --cached --name-status` was empty
   before and after — the shared index carried nothing of another chat's.
3. **Merged #1489** via `Assert-SmokedOrEscalate -PR 1489` (exit 0) then `Merge-Pr -PR 1489`.
   Read back: `state=MERGED`, `mergeCommit=75877122b9bcda804d026fb31196ef97a812e799`.
4. **Armed native auto-merge on #1490** via `Merge-Pr -PR 1490 -Auto`, after `Merge-Pr` refused the
   direct path with *"#1490 is 'OPEN', not MERGED. Do not report success."* — its base had just
   moved under #1489 and CodeQL was re-running (`mergeStateStatus=UNKNOWN`, both `Analyze` checks
   `pending`). Read back: `autoMergeEnabled=True`, `enabledBy=GH-Mantova`. **DECLARED HERE** so no
   later run finds an unexplained `autoMerge=ENABLED`. It is armed, **not merged** — the next 00
   confirms it reached `main`.
5. **Opened this board PR** carrying this breadcrumb, four uncommitted station breadcrumbs, the
   §3b probe correction, and the superseded HOLD parked in `superseded/`.

**Armed nothing.** `*-ready.md` count 0 before and 0 after. Relaunched no process, killed no
process, removed no label, touched no `/sot/`, no Azure/Entra/SharePoint, no production data.

## FINDINGS

### F1 — S1. Station 00's own ENSURE-UP probe reports a healthy watcher as an ORPHANED NODE.

The probe at §3b matches `-File.*(supervise-watcher|watcher-launcher-singlelane)\.ps1` against
process command lines. On this box the live supervisor is invoked by `watcher-launcher.ps1` with the
**call operator** — `& "...supervise-watcher.ps1"` — so it executes inside the launcher's process and
appears in **no** command line, by construction. The probe returns `wrapper=0` against a fully
supervised, three-deep chain, and its prescribed remedy is to start a fourth supervisor family.

This is the second iteration of the same defect. The 🔴 note beside the probe records fixing exactly
this on 2026-08-29 by widening the alternation to a second launcher name. Widening a name list
cannot fix it: **a command-line regex cannot see a script invoked with `&`.** The cure has to change
instrument, not vocabulary — resolve the node's parent chain, or accept
`restart-watcher-if-wedged.ps1`'s verdict, which was `OK` the same minute.

**ACTIONED** — corrected in this PR: the probe now also matches `watcher-launcher`, and the note
beside it states plainly that an `&`-invoked supervisor is invisible to any command-line probe and
that the authoritative test is the parent chain of the node PID. Verified with
`node scripts/pipeline/lint-station.mjs` (the edit is outside every canonical block) and by
re-running the corrected probe on the live box.

### F2 — S1. The device bridge left 0-byte locks in BOTH trees, and the sanctioned cure covers one.

Occurrences five and six of a failure DOCTRINE §9.2 documented after three. 06's 05:35Z breadcrumb
reported number four at 05:24Z and asked for a guard. This pair, at 07:14:34Z and 07:17:48Z, froze
every station for **56 minutes** — the whole 00 cycle between the 06:09Z run and this one — and the
07:14 timestamps sit inside the same 15-second window in which all six open PRs were touched, so
whatever ran then was doing board work and was cut short mid-call.

`scripts\clear-stale-index-lock.ps1` hard-codes `C:\ProjectOperations2\.git\index.lock`. The clone's
lock is the more damaging of the two — the watcher's every build starts with `git checkout` — and no
sanctioned script clears it.

**ESCALATED** -> Marco. `docs/pr-prompts/needs-marco/device-bridge-index-lock-guard-2026-09-01.md`.
RULE 1, complete-and-additive first:

- **(A) A refusing wrapper on the VM side plus a two-tree cure.** Make the bridge-side `git` a shim
  that refuses any invocation whose repo resolves under `C:\ProjectOperations2\.git` or
  `C:\po-watcher\ProjectOperations\.git`, and give `clear-stale-index-lock.ps1` a `-Repo` parameter
  covering both trees. Stops the cause immediately, stops it for every future actor including ones
  that have never read DOCTRINE, and damages no data entry — it refuses one call path and deletes
  only proven-stale orphan files. **Passes both halves of RULE 1.**
- **(B) Extend `clear-stale-index-lock.ps1` to both trees and leave the cause alone.** Fails the
  *future* half: six occurrences in two weeks say documentation does not stop this, and a faster
  cure makes the freeze cheaper rather than rarer.
- **(C) Let `status-sweep.ps1` auto-clear a 0-byte, unheld, process-free lock.** Fails the *safety*
  half — a read-only diagnostic that silently deletes lock files is exactly the instrument nobody
  can trust when a lock is real.

### F3 — S1. Station 04's 06:35Z dispatch was superseded before it was written.

04's FINDING 1 dispatched `pr-fix-malformed-breadcrumb-1482-HOLD.md` to me to arm, on the premise
that the malformed breadcrumb was still on `main` and reddening all six PRs. It was not: **#1485
landed the repair at `abbb2519`**, and the trunk has been green since. 04 stamped `origin/main =
000de2d9` at 06:10:41Z, ran a 25-minute sweep, and filed at 06:35Z **without re-fetching**; #1485
merged inside that window. The prompt's own premise —
`! grep -q "^## FINDINGS" <the 0535 breadcrumb>` — is now **FALSE**, so `lint-prompt.mjs` would
reject it on any arm attempt. Nothing was armed. This is DOCTRINE §7's `[LIVE]` rule and the station
doc's Q4 rule catching a dispatch, not a defect in 04's method beyond the missing re-fetch.

**ACTIONED** — the HOLD is parked in `docs/pr-prompts/superseded/` in this PR with the reason in this
breadcrumb, per the station doc's "close/bin the superseded prompt; never arm it". 04 needs no
further action.

### F4 — S2. Four station breadcrumbs had reached nobody.

`check-breadcrumb.mjs --freshness` tagged four as UNTRACKED: 00's own 00:37Z, 04's 02:10Z and
06:10Z, and 06's 05:25Z. An untracked breadcrumb is invisible to a clone, to CI and to every
cloud-fired station — the report contract's own definition of not having reported.

**ACTIONED** — all four are committed in this PR. Freshness itself is healthy: 00 2.1h (cadence 2h),
03 9.2h (24h), 04 2.1h (4h), 05 18.1h (24h) — **no station SILENT**.

### F5 — S3. Nothing is armed, and arming code work would only lengthen Marco's queue.

`*-ready.md` = 0; the watcher is alive and idle; `restart-watcher-if-wedged.ps1` says an idle
watcher with nothing armed is correct, not wedged. Of the four PRs left open after this run, **all
four are Marco's** by the classification table above. The `tests-docs` auto-merge lane is live and
works; it is starved because docs work keeps being hand-landed (DOCTRINE §10.3).

**DEFERRED** — deliberately arming nothing this cycle. It becomes urgent the moment a `docs/`- or
`tests/`-only HOLD exists that is *tracked* and gate-clear, because that one can reach `main` with no
human at all. The two prompts landed by #1489 and #1490 are not that: both target code paths and
would route straight back to Marco.

### F6 — method, keep. `Merge-Pr`'s read-back earned its keep this run.

`Merge-Pr -PR 1490` was called on a PR that had read `CLEAN` sixty seconds earlier and refused with
*"is 'OPEN', not MERGED. Do not report success."* The merge of #1489 had moved its base and CodeQL
had gone back to `pending`. A hand-rolled `gh pr merge` would have exited 0 and I would have
reported two merges. `mergeStateStatus` is a cached rollup; the primitive re-read the state.

**ACTIONED** — no defect; recorded because this is the exact failure the read-back rule exists for,
and it fired on a real call, not a drill.

## WHAT I DID NOT DO

- **Did not relaunch the watcher wrapper**, despite this station's own doc telling me to. F1
  explains why; the machine is healthy and starting a fourth supervisor family is the damage.
- **Did not arm anything.** F5. And I did not arm 04's dispatched HOLD — F3, superseded, and
  `arm-prompt.ps1` refuses an untracked HOLD anyway.
- **Did not merge #1477, #1478, #1483 or #1487.** All four are Marco's; #1478 and #1483 also carry
  `do-not-merge`, which only Marco removes.
- **Did not remove any label, and did not use `--admin` or a hand `git merge`.**
- **Did not retire the four measured-dead `needs-marco/` files 06 handed me at 05:35Z**, nor the two
  `WATCHER-CRASH-LOOP-2026-08-18-*.md` it could not judge. The sweep still tags them `[STALE]` every
  run. This run's budget went to the frozen board; it is one `git mv` into a dated `resolved-` folder
  and is the obvious first item next cycle. **DEFERRED**, and named here so it is not rediscovered.
- **Did not touch the 9 registry-escapee worktrees or the clone-hygiene dispatch** — Station 03's,
  already open.
- **Did not run `git` through the device bridge**, and did not run `checkout .` / `reset --hard` /
  `stash pop` / `clean` anywhere. The only git that touched the dev tree was `fetch`, `show`,
  `merge --ff-only`, and read-only queries.
- **Did not touch `/sot/`, Azure / Entra / SharePoint, or production data.**
- **Did not archive the dispositioned breadcrumbs into `archive/`** this run — the queue root holds
  13 and the contract wants them moved once dispositioned. Deferred with the `needs-marco/` sweep
  above so both land in one board PR rather than two.
