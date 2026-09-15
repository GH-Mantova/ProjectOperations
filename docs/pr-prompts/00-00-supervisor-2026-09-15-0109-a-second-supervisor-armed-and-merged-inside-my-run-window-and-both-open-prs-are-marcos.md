# Station 00 — Supervisor | 2026-09-15T01:09:03Z–2026-09-15T01:22Z

## GROUND

```
UTC            2026-09-15T01:09:03Z
origin/main    0ad48855
dev tree       main @ 0ad48855  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only on that account. Sighted run:
`start_process` returned a live `powershell.exe` on the Windows host (PID 3416) and every
number below came from it.

## WHAT I MEASURED

**Binding documents read from a tree pinned to `origin/main`.** [MEASURED]
`git rev-list --left-right --count origin/main...HEAD` → `0  0`, and
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md`
returned EMPTY. Empty numstat is the real answer per the preflight, so the working-copy reads
are byte-identical to `origin/main`. No piped-hash comparison was made or quoted.

**VM git guard could not be installed.** [MEASURED] `bash .../scripts/pipeline/vm-git-guard.sh`
never reached the script:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
... is under Plan9 share "c" which is not mounted
A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

Per the contract a failed install is a FINDING, not a STOP. It is also moot this run in the
narrow sense that the guard exists to stop VM-side `git` against the mount and the mount does
not exist — no VM-side `git` was run, or could be.

**Sweep.** [MEASURED] `status-sweep.ps1` captured to a FILE (it returns early and hides its own
section 7 otherwise), 418 lines / 143,632 bytes, generated `2026-09-15 01:09:43Z`.
Section 0 positive controls both `[LIVE]`. Section 7: **`SAFE TO ACT`**.
**Section 5 carried ZERO genuine `[STALE]` rows** — the only `[STALE]` matches were the
legend line and a `[FILE]` quotation of an older report, so there is nothing for me to
discharge this run. The eleven PR-scoped dead escalations of 09-10 stay cleared.

**Freshness, crossed against `lastRunAt` as the contract requires.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`, 1 checked / 0
malformed. All four stations `ok`, and all four ALIGN with the scheduled-tasks MCP, so none of
the three failure modes in the contract's table is present:

| station | newest breadcrumb | `lastRunAt` (MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-15T00:08Z | 2026-09-15T01:08:31Z | this run; aligned |
| 03 | 2026-09-14T23:01Z | 2026-09-14T23:01:23Z | aligned |
| 04 | 2026-09-14T22:11Z | 2026-09-14T22:10:09Z | aligned |
| 05 | 2026-09-14T14:11Z | 2026-09-14T14:11:11Z | aligned |

No station is SILENT and none is the false-`ok` shape, so no transcript read was needed.

**Nothing uncollected.** [MEASURED] The queue root holds exactly one breadcrumb, my own
`…-0008-…`, and it is TRACKED (`git ls-files` returns it) — PR #1944 merged it at 00:25Z.
03's 23:01 and 04's 22:11 breadcrumbs were dispositioned by the 2308/2358/0008 lanes.
COLLECT therefore closes with no new findings inherited.

**The shared git index is CLEAN.** [MEASURED] `git diff --cached --name-status` returned
EMPTY — no other chat has staged anything, and the `RD` trap (a staged `R100 HOLD→ready`
with no file on disk) is ABSENT. The two ` D` rows in `docs/pr-prompts` are unstaged HOLD
deletions from arming, which is the expected shape, not the trap.

**RULE 2 probe, with both controls.** [MEASURED] Live tree
`C:\ProjectOperations2\docs\pr-prompts\processed` — 2228 logs, newest `09-15 01:12Z`, so this
is the live tree and not the `C:\po-watcher` decoy whose newest log is from August.
`Select-String -Pattern 'marco.:true'` (regex form; the `-SimpleMatch` form answers 0 to both
polarities) → **POS 667**, and a freshly minted needle → **NEG 0**. Matched by `PR #<n>` in the
log BODY, not by filename:

```
#1946  [watcher] merge result for PR #1946: {"ok":false,"marco":true,
       "reason":"outside tests/ or docs/: scripts/pipeline/render-artboards.mjs"}
#1923  [watcher] merge result for PR #1923: {"ok":false,"marco":true,
       "reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}
#1944  NO LOG          <- negative control: my own board docs PR, second lane, not watcher-opened
```

#1944 reading `NO LOG` while 667 logs carry the marker is what proves `NO LOG` means
"not watcher-opened" rather than "probe broken". **Both open PRs are MARCO'S. Zero merges
were available to me.**

**A false absence I caught before reporting it.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/merge-approvals` returned EMPTY, which reads
as "no receipt for #1945". The pathspec was wrong: receipts live at
**`docs/decisions/merge-approvals/`** — 106 of them on `main`, `1945.md` among them, NEG 0 on
a fresh needle. DOCTRINE §9.6 exactly: an empty result is not an empty world, and here the
empty result came from my own pathspec rather than from the world.

## WHAT CHANGED

**On the board: nothing. I made no board mutation this run** — no arm, no merge, no label, no
branch update, no worktree. The only write I made is this breadcrumb, plus a dated confirming
measurement appended to one existing `needs-marco/` file (named under FINDINGS). That restraint
is itself the decision this run turned on, and its reason is finding 1.

## FINDINGS

### 1. A SECOND STATION 00 ARMED TWICE AND MERGED A PR INSIDE MY RUN WINDOW, AND THE SAFE-TO-ACT GATE READ `SAFE` THROUGHOUT

[MEASURED] `docs/pr-prompts/.arming-log.txt` tail, and three consecutive reads of the armed set:

```
2026-09-15T01:03:10Z  ARMED  pr-crmvis-s0-visual-parity-tooling    actor=station-00.interactive-0003  pid=3956
2026-09-15T01:13:02Z  ARMED  pr-fv2-import-s2-review-route         actor=station-00.interactive-0003  pid=27764
```

My run started 01:09:03Z. The sweep at 01:09:43Z reported `armed: 1` and
`SAFE TO ACT`. Three minutes later the armed set was a DIFFERENT file
(`pr-fv2-import-s2-review-route-b-ready.md`), and #1945 had **merged at 01:12:32Z** — a merge
I did not perform. So inside one 10-minute window another actor armed twice and merged once
while my instrument reported the board safe and idle.

This is escalation #23 reproduced with fresh numbers, and it is the reason nothing above
changed: two actors sharing one git index and one queue is LL-38, and the board is exactly
where that bites. The sweep is not lying — `SAFE TO ACT` is true *at the instant it prints*,
and the contract's own warning that `[LIVE]` means "true when measured" is the whole failure
mode. **The gate cannot see a sibling supervisor, only a mid-flight git write.**

`#1945` itself is legitimate and must not be re-raised as an attack: its receipt
`docs/decisions/merge-approvals/1945.md` is on `main`, written by the supervised cloud lane
ahead of the merge, which is precisely Marco's 2026-09-07 ruling via `#1736`. Noted for the
record: its commits are authored **`PR Supervisor`** — a third identity alongside the watcher's
builds (authored `Marco`) and `%an` on `main` (`GH-Mantova`). Attribution on this board now has
three faces and none of them is a person.

**DISPOSITION: ESCALATED** — already filed, so I added to it rather than duplicating it.
`docs/pr-prompts/needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`
(09-14 06:11Z) states this finding, nuance included; I appended today's 01:03/01:12/01:13
measurement to it. ⚠️ That folder is gitignored, which is why the measurement is also written
out in full above — the file alone reaches nobody. The question for Marco is unchanged and is
his alone, because only he knows which actor he wants driving:
**(a)** make the scheduled 00 stand down whenever an interactive 00 holds the board — a real
lock in `arm-prompt.ps1`/`Merge-Pr` keyed on a lease file, refusing rather than racing
[complete-and-additive: fixes it now and for every future pair, and touches no data entry —
**FIRST** by RULE 1]; **(b)** offset or slow the scheduled 00 so overlap is less likely —
fails the *completely* half, since it narrows the window without closing it;
**(c)** leave it and rely on each run standing off — fails the *future* half outright, as it
depends on every future run repeating the judgement I made this run.

### 2. THE VM MOUNT IS GONE, SO THE SECOND TRANSPORT NO LONGER EXISTS AT ALL

[MEASURED] The `bash` workspace fails to mount `C:` (quoted verbatim above) and names a
Windows update of **September 8** as the cause. `STATION-CAPABILITIES.md` §3 "No second
transport" already records that the mount is not a substitute for Desktop Commander; what is
new in degree is that the mount is not available for *anything*. A run that loses Desktop
Commander today has **no fallback at all** and is fully blind — where the §3 ceiling at least
allowed COLLECT to proceed over the mount.

**DISPOSITION: ESCALATED** — already filed at
`docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`
(touched 09-14 15:23Z), which is the same subject; I did not open a duplicate. It is outside
the repo (a host/platform fault), so no station can fix it and no PR can close it.

### 3. BOTH OPEN PRs WENT `BEHIND` WITHIN MINUTES OF THE #1945 MERGE

[MEASURED] `#1946` (`feat/crmvis-s0-artboard-render`) and `#1923`
(`fix/ratescol-s0-column-server-messages`) both read `mergeStateStatus=BEHIND`, labels `[]`,
measured after #1945 merged at 01:12:32Z. This is `pollForBehindPrs` behaving exactly as the
already-escalated defect predicts: it fires on every open PR a few minutes after every board
merge and rebuilds PRs that no automation is permitted to merge.

Both are Marco's by finding-0's probe, so driving them is permitted but merging is not —
and with a sibling supervisor live on the same index, pushing a rebase would be the collision
in finding 1 rather than a fix.

**DISPOSITION: DEFERRED** — real, not now. What would make it urgent: a `BEHIND` PR that is
*not* Marco's, where `BEHIND` is then the only thing between it and `main`. Neither of these
is. The underlying `pollForBehindPrs` defect is already escalated with its three options
(skip PRs `classifyPolicyFiles` refuses, first) and needs no second filing.

### 4. THREE ORPHANED WORKTREES, ONE HOLDING UNCOMMITTED WORK FOR ELEVEN DAYS

[MEASURED] From the sweep, section 2:

```
C:/po-fix1891                          1dc31858 (detached)   dirty=0  age=1435 min
C:/PR-Master/worktrees/po-vg           23c91ba9              dirty=1  age=15436 min
C:/PR-Master/worktrees/pr1823          9664f95a              dirty=0  age=7378 min
```

`po-vg` is the same orphan Station 03 escalated previously; it is now **~10.7 days** old and
still holds one uncommitted file. The watcher clone also reads `dirty=1`, which the sweep warns
may make the watcher refuse to start.

**DISPOSITION: DISPATCHED → Station 03.** Worktree pruning and clone hygiene are 03's lane and
not mine; 03 last ran 23:01Z and wakes daily. Handing over: prune `po-fix1891` and `pr1823`
(both `dirty=0`, safe), and for `po-vg` **list the file before touching it** —
`git -C C:/PR-Master/worktrees/po-vg status --porcelain` — since `worktree remove` will refuse
and `--force` would discard the work. Preserve any untracked `pr-*-review.md`. I did not do
this myself: LL-38, and doing 03's work is the thing this station is told not to do.

## WHAT I DID NOT DO

- **I did not arm.** One prompt is armed (`pr-fv2-import-s2-review-route-b-ready.md`) and RULE 4
  is one at a time, so the slot was full before I looked. I also did not ask whether to arm at
  all, because a sibling supervisor was arming concurrently and a second arm from me would have
  been the RULE 4 breach rather than a race I lost.
- **I did not merge anything.** Both open PRs carry `"marco":true`. RULE 2 is a human gate that
  green CI, empty labels and a clean diff do not clear.
- **I did not update or rebase either BEHIND branch**, for finding 1's reason.
- **I did not clear any `needs-marco/` file.** Section 5 produced no genuine `[STALE]` row, so
  there was nothing to discharge, and discharging on anything less than a per-PR
  `gh pr view` with a negative control is what left eleven dead files standing for ten days.
- **I did not prune a worktree or touch the watcher clone** — 03's lane (finding 4).
- **I did not run `git` against the VM mount**, nor substitute GitHub-side reads for host reads.
- **I did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
- **I did not archive the one breadcrumb in the root**, since it is the current cycle rather
  than something already dispositioned.

This breadcrumb is UNTRACKED at
`docs/pr-prompts/00-00-supervisor-2026-09-15-0109-a-second-supervisor-armed-and-merged-inside-my-run-window-and-both-open-prs-are-marcos.md`
— the next board PR should sweep it up.
