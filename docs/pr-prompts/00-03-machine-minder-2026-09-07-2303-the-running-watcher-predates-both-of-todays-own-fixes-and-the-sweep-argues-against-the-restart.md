# Station 03 — Machine Minder | 2026-09-07T23:01Z–2026-09-07T23:40Z

## GROUND

```
UTC            2026-09-07T23:01:42Z
origin/main    9be865ec            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse, in the DEV TREE)
dev tree       main @ 9be865ec     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

Sighted run. `start_process` (shell `powershell.exe`) succeeded on the first call after a keyword
`ToolSearch` for `desktop-commander`; the schema arrived deferred, exactly as the PREFLIGHT block
warns, and the load was the difference between a working tool and a false blindness report.

vm-git-guard installer last line, quoted verbatim (PREFLIGHT step 1 requires this pass or fail):
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
— followed by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`. INSTALLED.

Freshness of the three binding documents: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/03-machine-minder.md` returned **EMPTY**
in the dev tree, i.e. the working copies I read ARE `origin/main`'s. No piped `hash-object` was used
(§9.1). All three read in full.

## WHAT I MEASURED

**The chain is alive.** `[MEASURED]` Re-measured at **23:06:47Z**, immediately before writing:
watcher node **pid 31660**, `StartTime` **2026-09-06T23:05:03Z** (24.0 h), resolved by command line
(`Win32_Process` filtered on `*pr-watcher\index.mjs*`), never by image name — 17 `node.exe` were
running and exactly one is the watcher. Auto-restart wrapper alive (1). `PO Watcher Keepalive`
scheduled task **state=Ready, lastRun 22:55:02Z, lastResult 0, nextRun 23:05:00Z**.

**The rescan loop is ticking.** `[MEASURED]` Newest daily-shaped log selected by NAME SHAPE then
mtime (`BaseName -match '^\d{4}-\d{2}-\d{2}$'`, per §9.5's 2026-09-07 correction, so `supervisor.log`
cannot win): `2026-09-07.log`, mtimeUtc **23:05:08Z**, 122,335 B. Last content line
`[2026-09-07T23:05:08.796Z] [review] verdict-archive sweep: archived=0 kept=2 skipped=0 tracked=59`
— the sweep line fires every 5 minutes without a gap. `[start]` lines today **45**, `[FAIL]` **1**,
NEGATIVE control (freshly minted needle) **0**.

**Heartbeat 41 min at sweep time is IDLE, not wedged.** `[INFERRED]` The build heartbeat ticks only
mid-run (§9.5); armed count is 0 and no build is in flight, so a stale tick is the expected reading.
The freeze probe I trusted instead is the 5-minutely sweep line above, which has no gap.

**No locks.** `[MEASURED]` `index.lock` absent in BOTH trees at 23:06:47Z (dev `False`, clone
`False`). Git processes running: 1. No `MERGE_HEAD` / rebase state was reported by the sweep.

**Clone position.** `[MEASURED]` clone HEAD `1ddf3fb4` on `main`; dev-tree `origin/main` `9be865ec`.
`git rev-list --left-right --count 1ddf3fb4...origin/main` → **`0	27`** (0 ahead, 27 behind) and
`git merge-base --is-ancestor 1ddf3fb4 origin/main` → **exit 0**, so it is fast-forwardable, not
diverged. Measured in the DEV TREE, because the clone's own `origin/main` is pinned at launch
(§ my own 2026-09-03 finding); the clone's `origin/main` reads `1ddf3fb4`, i.e. its own HEAD.

**Two of those 27 commits are the watcher's own code.** `[MEASURED]`
`git log --oneline 1ddf3fb4..origin/main -- scripts/pr-watcher`:
`f9815d11 fix(pr-watcher): a gate path with a space is not two arguments (#1760)` — committed
**2026-09-07T14:05:13Z**; and `dc3f1d33 fix(pr-watcher): a fix-lane prompt can escalate, and its
verdict names Marco (FIXES_PR_ESCALATION) (#1790)` — committed **2026-09-07T20:40:29Z**.
`git diff --numstat 1ddf3fb4 origin/main -- scripts/pr-watcher` → `index.mjs` **+115 / −28**, plus
two new test files. Both commits are **after** the running process's `StartTime`. See F1.

**Clone dirt is untracked-only, and the two dirt tests disagree.** `[MEASURED]`
`git status --porcelain` in the clone → 3 entries, all `??`:
`docs/pr-reviews/pr-1767-review.md`, `docs/pr-reviews/pr-1775-review.md` (the live verdicts for the
two open PRs — the archive sweep's `kept=2`), and one junk file whose name is a mangled path,
`"C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"`.
`git status --porcelain --untracked-files=no` in the same tree → **EMPTY**. See F2.

**Stash closed loop: 69, unchanged.** `[MEASURED]` `git stash list` in the clone → **69**, identical
to my 2026-09-06 run's 69 (which was +3 on 66). `[INFERRED]` No growth because there has been no
relaunch since 2026-09-06T23:05:03Z and the preflight stashes only on a launch that meets tracked
dirt. Dev tree `git stash list` → **0**.

**Worktrees.** `[MEASURED]` `git worktree list` → two: the dev tree at `9be865ec [main]`, and
`C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`, age **5229 min** (3.6 days), holding exactly
one untracked file, `scripts/pipeline/check-pipeline-heartbeat.mjs`. Registry escapees: none under
known roots. Unchanged since my 2026-09-04 breadcrumb, which is titled after it.

**Queue.** `[MEASURED]` armed `*-ready.md` at TOP LEVEL ONLY → **0**. `needs-marco/` 41 ·
`no-pr-opened/` 109 · `failed/` 43 · `blocked/` 123. `.arming-log.txt` newest row is
`2026-09-07T07:20:53Z ARMED pr-triageholds-s2-env-os-is-empty-in-a-station-shell ... by=Marco@LAPTOP-E6NHU4E4`.

**Board.** `[MEASURED]` from `status-sweep.ps1` §1: 2 open PRs, **#1775** and **#1767**, both
`BLOCKED` with `13 pass / 2 fail`. `main` CI on `9be865ec`: 4 success / 0 failed. Instrument positive
controls in §0 both passed (`gh` reached GitHub; `node` runs). I did not act on any PR.

**Launcher chain on disk.** `[MEASURED]` `watcher-launcher-singlelane.ps1` PRESENT (2367 B) —
the real launcher; `ensure-watcher.ps1` PRESENT (5266 B); `C:\po-watcher\STOP-WATCHER-LANE2`
PRESENT (1090 B, by design, §9.5, and NOT a stop signal); `C:\po-watcher\STOP-WATCHER` **ABSENT**.

**failed/ triage — one NEW entry since my last run.** `[MEASURED]` `failed/` holds 43 files; the
newest are `rev-1746-ready.md` (00:26:08Z) and `rev-1746-ready.md.log` (00:29:13Z), both
2026-09-07. Everything else in the directory predates 2026-08-29. Diffed against my own tracked
breadcrumbs (12 in corpus, depth-1 + `archive/`): needle `rev-1746|PR #1746` → **0** hits,
POSITIVE control `machine-minder` → **48**, NEGATIVE control (minted this run) → **0**. So it is new
and untriaged. Triage in F3.

**Disk.** `[MEASURED]` `C:` used 772.8 GB / free **179.5 GB**. Not a constraint.

## WHAT CHANGED

**Nothing on any machine and nothing on the board.** Station 03 is REPORT-ONLY. No process was
started, killed or restarted; no clone fast-forwarded; no stash dropped or popped; no worktree
pruned or removed; no lock cleared; no prompt armed, disarmed, copied or moved; no PR merged,
labelled or commented; no `/sot/` file touched; no Azure / Entra / SharePoint call of any kind.

The only writes this run are **five scratch probe scripts** under `C:\po-sup-fix-scripts\`
(`st03-2026-09-07-2300{,b,c,d,e,f,g,h,i}.ps1` and two `_*.log` copies of the watcher log, copied
because the live file is held open by the watcher) and **this breadcrumb**. No `git` command that
writes was run in either tree — every git call was `fetch` (refspec form), `rev-parse`, `rev-list`,
`merge-base`, `log`, `diff`, `status`, `stash list` or `worktree list`. No `git` was run from the
VM against the Windows `.git` (§9.2); the guard from PREFLIGHT step 1 is installed and would have
refused it.

**This breadcrumb is UNTRACKED** in the dev tree at `docs/pr-prompts/` until a board PR commits it.
Station 00 sweeps it up. Its filename matches no watcher glob, so it arms nothing.

## FINDINGS

### F1 — S1 — The running watcher predates BOTH of today's `scripts/pr-watcher` fixes, and nothing will adopt them without a relaunch

`[MEASURED]` The watcher node (pid 31660) started **2026-09-06T23:05:03Z** and runs `index.mjs`
**from the clone**. The clone is `0 ahead / 27 behind` `origin/main` and fast-forwardable
(`merge-base --is-ancestor` exit 0). Two of the 27 commits are the watcher's own code, and both were
committed **today, after that start time**: `f9815d11` (#1760, `14:05:13Z`) and `dc3f1d33` (#1790,
`20:40:29Z`), together `index.mjs +115 / −28` plus `__tests__/gate-path-space.test.mjs` and
`__tests__/escalation-label.test.mjs`.

`[INFERRED]` DOCTRINE §9.5: *"A restart adopts nothing"* — the clone must be fast-forwarded first,
and only then does a relaunch change behaviour. Today the ordering matters more than usual, because
**#1790's whole subject is the merge verdict a fix-lane prompt produces**: the process currently
deciding `marco:true` on this board is the one that predates the fix to that decision. The board is
quiet right now (armed 0, no build in flight, 2 open PRs both red), which is the cheapest window
this will get.

`[CANNOT MEASURE]` whether either fix has actually mis-fired since it landed — no fix-lane prompt has
been built since 20:40Z, so the old code has not yet been asked the question the new code answers
differently. This is a latent exposure, not an observed failure, and I am not dressing it as one.

**DISPOSITION: DISPATCHED → Station 00.** 03 measures; 00 dispatches the repair, and a clone
fast-forward plus a relaunch is a clone write and a process action — neither is mine. Options in
RULE 1 order:

- **(a) COMPLETE AND ADDITIVE — fast-forward the clone to `9be865ec`, then relaunch DETACHED via
  `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` on
  `C:\po-watcher\watcher-launcher-singlelane.ps1`, and verify the chain survives 40 s+ and the clone
  reads 0-behind.** Solves it immediately (both fixes adopted) and in future (the clone is at main,
  so the next crash-restart also adopts them), and damages no data entry: the clone holds no tracked
  modifications (F2 measures the dirt as untracked-only), the two untracked review verdicts are for
  live PRs and must be **preserved across the restart — copy them out first**, and `Start-Process`
  alone must not be used because it does not escape the job object.
- **(b) Relaunch without fast-forwarding.** Fails the *complete* half outright: the process restarts
  on the same `1ddf3fb4` code and adopts nothing, which is the specific misconception §9.5 exists to
  stop. It also pays a restart's cost for no benefit.
- **(c) Leave it until the next crash-restart happens by itself.** Fails the *future* half: the
  restart would still run from an un-fast-forwarded clone, so the fixes stay unadopted for an
  unbounded time, and the exposure above is carried the whole while. Its only merit is that it costs
  nothing now.

### F2 — S2 — `status-sweep.ps1` says the clone is dirty and "the watcher may refuse to start"; the watcher's own test says the tree is clean, and the disagreement points against F1's restart

`[MEASURED]` Both dirt tests, run side by side in `C:\po-watcher\ProjectOperations` at 23:0xZ:

| instrument | command (anchor) | result |
|---|---|---|
| `status-sweep.ps1:155` | `@(git status --short).Count` | **3** → prints `dirty=3  <-- NOT clean-on-main; the watcher may refuse to start` |
| `start-watcher.ps1:52`, re-checked at `:86` and `:128` | `git status --porcelain --untracked-files=no` | **EMPTY** |

The launcher's own comment at `:48` states the intent in as many words: *"Only TRACKED
modified/staged files count as 'dirty' -- untracked files (e.g. ..."*. All three clone entries are
`??`. So on this state the launcher would **neither stash nor refuse**, and the sweep's warning is a
false alarm — a well-formed, confident line about a refusal that cannot happen. Nothing is empty and
nothing errors, so §9.6 never fires; this is §7's shape, a broken measurement of a working system.

`[INFERRED]` The direction is the dangerous one. A run holding F1 reads `NOT clean-on-main; the
watcher may refuse to start` and defers the very relaunch F1 asks for, or spends a turn "cleaning"
a clone that is clean by the only definition that governs the start. My own 2026-08-25 breadcrumb
made the mirror-image error from the same line and concluded a restart would swallow live verdicts.

`[MEASURED]` **The residual risk is real but conditional, and must not be dropped:** when the
preflight IS entered — i.e. when TRACKED dirt exists at launch — the stash it takes is
`git stash push --include-untracked` (`start-watcher.ps1:73`), so `pr-1767-review.md` and
`pr-1775-review.md` **would** be swept into `stash@{0}` along with it. That is why F1(a) says copy
them out first. "The preflight will not fire today" and "the preflight is harmless" are different
claims and only the first is measured.

**DISPOSITION: DISPATCHED → Station 00.** The one-line fix is in `scripts/pipeline/`, outside my
lane. Options in RULE 1 order:

- **(a) COMPLETE AND ADDITIVE — make the sweep count what the launcher counts** (`git status
  --porcelain --untracked-files=no` for the refuse-to-start verdict) **and print the untracked count
  separately as its own informational line**, naming the two review verdicts when they are present.
  Solves it now (no false alarm tonight) and in future (the two instruments can no longer drift),
  and loses no information: the untracked dirt is still reported, just no longer as a refusal.
- **(b) Delete the `<-- NOT clean-on-main` flag.** Fails the *complete* half: it removes the false
  alarm and the true one together, so a genuinely tracked-dirty clone would then start no warning at
  all.
- **(c) Add a prose caveat to the sweep's HOW-TO-READ header.** Fails the *future* half — DOCTRINE
  §9's own record is that a paraphrase in a header drifts away from the instrument it describes;
  this file has three measured instances of exactly that.

### F3 — S3 — `rev-1746` exited 0 having "scheduled a wakeup" nobody can deliver, wrote no verdict, and is the fourth instance of that signature

`[MEASURED]` The only new `failed/` entry since my last run. `rev-1746-ready.md.log` is 279 bytes in
full: `Started: 2026-09-07T00:26:10.042Z` · `Ended: 2026-09-07T00:29:12.017Z` · **`Exit: 0`**, and the
whole transcript body is two lines — *"Scheduled a wakeup in ~4 minutes to check on the CI and
continue the review."* followed by the `SessionEnd hook ... Hook cancelled` line. It reviewed for
three minutes and then deferred.

`[MEASURED]` The watcher handled it correctly, and said so:
`[2026-09-07T00:29:13.143Z] [review] verdict mirror skipped: docs/pr-reviews/pr-1746-review.md not
found in any home. Searched: C:\po-watcher\ProjectOperations\docs\pr-reviews\..., C:\po-watcher\
verdicts-archive\..., C:\ProjectOperations2\docs\pr-reviews\... Job will NOT be filed [ok] - re-queue
after the verdict file is located.` then `[FAIL] rev-1746-ready.md → failed/`. I confirmed the
absence independently in all three homes, with the POSITIVE control that `pr-1793-review.md` IS
present (in `verdicts-archive`).

`[MEASURED]` The signature is recurring, not a one-off: `Scheduled a wakeup` appears in
`failed/*.log` **1** time (this one) and in `processed/*.log` **3** times — `rev-1606`, `rev-791`,
`rev-957`. POSITIVE control `merge result for PR` over `processed/*.log` → **672**; NEGATIVE control
(minted this run) → **0**. Fourth occurrence.

`[MEASURED]` **No board consequence this time.** `gh pr view 1746` → `state MERGED`,
`mergedAt 2026-09-07T08:16:38Z`, labels `[]`. The PR merged eight hours after the review deferred, so
the missing verdict cost nothing on this instance and **the prompt's premise is dead** — restaging
`rev-1746` would review a merged PR.

`[INFERRED]` The defect is DOCTRINE §6 in the review lane: *"There is no human in a headless run …
Never ask a question. Decide, or escalate in writing and exit."* A wakeup is the same failure wearing
a scheduler's clothes — nothing wakes it, and the watcher's own remedy line (*"re-queue after the
verdict file is located"*) waits on a file that will never appear. The fix belongs in the reviewer
agent definition (`.claude/agents/pr-fix-reviewer.md`) or the `rev-` prompt template: on incomplete
CI, write the verdict `BLOCK` (or `FIX`) **with the reason**, never defer.

**DISPOSITION: DISPATCHED → Station 00.** Nothing to restage (premise dead), and the remedy is an
agent-definition change, which is neither report-only nor mine.

### F4 — 🟢 The verdict mirror is now tree-agnostic and archive-aware — my 2026-09-05 F1 dispatch has LANDED

`[MEASURED]` My 2026-09-05 breadcrumb dispatched an S1: `verdict mirror skipped` fired 68 times
because the mirror step read only the clone while nine of twelve verdicts had been written to the
dev tree. The line quoted in F3 above shows the mirror now **searching all three homes by name** —
clone, `C:\po-watcher\verdicts-archive`, dev tree — and it refused to file `[ok]` rather than
silently passing. That is the complete-and-additive form of the fix, and it behaved correctly on the
first case I could observe.

**DISPOSITION: DISPATCHED → Station 00** — to close my 2026-09-05 F1 and 2026-09-05 F2 rather than
carry them forward. The falsifying probe is the `Searched:` line itself: if it ever names fewer than
three paths, this retirement is wrong.

### F5 — S3 — `C:/po-vg` is still pinned live by one untracked file, unchanged for 3.6 days

`[MEASURED]` `git worktree list` → `C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`, age
**5229 min**, `git -C C:/po-vg status --porcelain` → exactly one line,
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`. Identical to my 2026-09-04 measurement, which is
what that breadcrumb was named after, and it is cross-referenced by the open escalation
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

`[INFERRED]` The sweep's liveness classifier calls it *orphaned … investigate/prune* and then
correctly refuses to recommend a prune, because `git worktree remove` will refuse and `--force`
would discard the file. One untracked file therefore pins a dead worktree in the registry forever,
and every station run pays a line of noise for it.

**DISPOSITION: DEFERRED.** Real, not now: it costs a registry entry and one sweep line, and the file
is a candidate fix that someone deliberately left there. It becomes urgent the moment a second
worktree accumulates the same way, or if anyone proposes a `--force` prune — at which point the
correct move is to **copy the file out, then remove the worktree**, never `--force` first. Not mine
either way: 03 does not prune.

### F6 — S4 — The preflight stash loop stands at 69 and did not move in 24 hours

`[MEASURED]` `git stash list` in the clone → **69**, against my 2026-09-06 run's 69 (itself +3 on
66). Dev tree → **0**. `[INFERRED]` Flat because there has been no relaunch since 2026-09-06T23:05Z
and, per F2, untracked-only dirt does not enter the preflight at all. The loop is intact, not
drained; its rate is "one per launch that meets tracked dirt", which is not a per-day figure.

**DISPOSITION: DEFERRED**, unchanged from my last three runs. 69 entries cost disk (179.5 GB free)
and not correctness. It becomes urgent if a preflight stash ever captures work someone needs back,
or if `git stash list` starts costing real time at launch. The sanctioned drain is `git stash drop`,
**never `pop`** (§9.2), and it is a clone write — 00's or 02's, not mine. ⚠️ **Note the ordering
against F1:** if 00 relaunches, do the copy-out in F1(a) first, because a relaunch that happens to
meet tracked dirt takes stash #70 `--include-untracked`.

## WHAT I DID NOT DO

- **Repaired nothing.** No fast-forward of the clone, no relaunch, no kill, no stash dropped, no
  worktree pruned, no lock cleared, no junk file deleted from the clone root. F1 and F2 both end in
  a dispatch precisely because performing them is Station 00's, and the contract's "report-only" line
  beats the older station brief's permission to stage a `rev-` fix.
- **Staged no prompt and restaged nothing.** `rev-1746`'s premise is dead (PR merged), and even a
  live one would be 00's call to arm.
- **Touched no PR.** #1775 and #1767 are open and red; I read their status from the sweep and left
  them alone. No label added or removed, no comment, no merge, no branch update.
- **Did not clear a single `[STALE]` line from sweep §5.** Eleven `needs-marco/` files are tagged
  dead (#1532, #1593, #1633, #1646, #1662, #1685, #1740, #1756, #1774, #1777×2). Discharging them is
  a queue mutation and has been dispatched to 03 before; it is still not something 03 may perform
  under the current contract. Left for 00 to route.
- **Did not run `git checkout .` / `reset --hard` / `stash pop` / `git clean`** in any tree, and ran
  no `git` from the VM against the Windows `.git`.
- **Did not touch `/sot/`**, Azure, Entra or SharePoint, and made no GitHub write of any kind
  (every `gh` call was `pr view --json`).
- **Did not act on `queue-watch-state.md`** or any other `[FILE]`-tagged snapshot the sweep surfaced;
  they are snapshots by whoever last ran and carry no current SHA.

<run-summary>The watcher chain is healthy and idle (pid 31660, 24 h, sweep line 100 s old, no locks, queue empty) but it is running code from before both of today's own `scripts/pr-watcher` fixes — the clone sits 27 commits behind and fast-forwardable, and `status-sweep.ps1` counts untracked files as dirt where `start-watcher.ps1` does not, so the sweep is warning against the very relaunch that would adopt them.</run-summary>
