# 03 Machine Minder — 2026-08-21 03:45Z — third stale index.lock, cleared, and the cause found

NOT A PROMPT. Breadcrumb / incident record. No `-ready` suffix, nothing armed, no board mutation.

Station: 03 machine-minder, dispatched by Station 00.
Host: LAPTOP-E6NHU4E4. Repair pre-approved by Marco (2026-08-21, identical defect).

## THIS IS OCCURRENCE THREE

| # | when created | age when cleared | cleared by |
|---|---|---|---|
| 1 | 2026-08-20 | ~242 min | station 03 |
| 2 | 2026-08-21 01:09Z | 894 min | station 03 |
| 3 | **2026-08-21 02:13:05Z** | **95.6 min** | this run |

The 02:13:05Z creation falls ~2 min 47 s inside the `00 supervisor (local)` scheduled
run that fired at **02:10:18Z**. That correlation was the lead Station 00 handed over.
It is now more than a correlation — see CAUSE below.

## MEASUREMENTS BEFORE DELETING (03:48:01Z)

```
LOCK_EXISTS=True   LOCK_BYTES=0
LOCK_MTIME_UTC=2026-08-21T02:13:05Z   LOCK_AGE_MIN=94.93
GIT_PROC_COUNT=0
MIDOP C:\ProjectOperations2            MERGE_HEAD/REBASE_HEAD/CHERRY_PICK_HEAD
                                       BISECT_LOG/rebase-merge/rebase-apply/sequencer = all False
MIDOP C:\po-watcher\ProjectOperations  same seven = all False
GATE=CLEAR_TO_DELETE
```

All four abort conditions (non-zero bytes / age < 30 min / any git process / any
mid-operation state) were checked and none held.

## CAUSE — what the evidence supports

**[MEASURED] The lock is not created by anything running on Windows. It is created by a
`git` invocation issued from a station session's Cowork *workspace VM*, against the same
`.git` directory reached through a connected-folder mount — and abandoned there.**

The chain, each link measured:

1. `mcp__remote-devices__get_device_info` reports `C:\ProjectOperations2` (and
   `C:\po-sup-fix-scripts`) among `connectedFolders`.
2. From this station's own workspace VM, the dev tree is mounted read-write at
   `$HOME/mnt/ProjectOperations2`, and the lock was directly visible there:
   `-rwx------ 1 rcw-01mxd… 0 Aug 21 02:13 /sessions/rcw-01mxd…/mnt/ProjectOperations2/.git/index.lock`
   A VM-side `git` therefore writes the *real Windows* `.git`, while leaving **no Windows
   process behind**. That is why "0 git processes" is always true and the lock never expires.
3. Desktop Commander's own tool-call history (300 most recent calls, continuous coverage
   from 2026-08-20 17:47:36 local to now) has a **hard gap from 01:48:56Z to 03:35:51Z** —
   zero DC calls. Yet in that window `C:\po-sup-fix-scripts` received
   `scan-0821-step0.ps1` (02:10:36Z), `step1` (02:10:52Z), `out-backlog.txt` (02:11:09Z),
   `step2` (02:11:38Z), `out-escalations/lessons/drift/openprs` (02:11:42–44Z),
   `scan-0821-lint.ps1` (02:22:18Z), `scan-0821-teardown.ps1` (02:27:01Z),
   `memsize.ps1` (02:33:01Z); and `docs/qa/qa-findings.md` + `qa-checklist.md` were
   rewritten (02:26:35Z / 02:26:54Z). Work reached the disk through a channel that is
   **not** Desktop Commander.
4. A session VM directory `/sessions/dreamy-magical-wright/` has mtime **02:09:58Z** —
   ~20 s before the 02:10:18Z supervisor fire — and its ownership has reverted to
   `nobody:nogroup` (de-provisioned). It is the 02:10 run's VM.
5. `.git/index` was rewritten at **02:12:56Z** (a git write that *completed*), then
   `index.lock` was created **9 s later at 02:13:05Z** and never completed — 0 bytes means
   git created the lock but never wrote index content into it.
6. The same failure signature exists elsewhere: worktree `po-scan-0CwZSs` is registered in
   `.git/worktrees` with gitdir `/tmp/po-scan-0CwZSs` — a **Linux** path belonging to a VM
   that no longer exists — and carries its own 0-byte `HEAD.lock` and `index.lock` from
   2026-08-20T22:12:00Z.

**[CANNOT MEASURE]** which exact git subcommand ran at 02:13:05Z, and whether it was cut
off by the 45 000 ms workspace-VM command cap or by an interrupted tool call. The 02:10
session's transcript and VM are gone (other `/sessions/*` dirs are `nobody:nogroup`, and
the VM is torn down at session end). The session kept working until at least 02:33:01Z, so
it did **not** die at 02:13 — a single git call was cut short and the session carried on
without noticing the orphan it left.

## HYPOTHESES RULED OUT (all [MEASURED])

- **A Windows-side git process leaked it.** Ruled out. `GIT_PROC_COUNT=0` at 03:38, 03:40
  and 03:48; and Desktop Commander logged **no `start_process` call at all** between
  01:48:56Z and 03:35:51Z, so nothing on the Windows side ran git in that window.
- **The pr-watcher did it.** Ruled out. `watcher-launch.log` contains **zero** lines
  timestamped `2026-08-21T02:*` (`WATCHER_0200_LINE_COUNT=0`); its last write is 01:43:01Z.
  The watcher (node pid 13372, up since 01:42:34Z) works its own clone
  `C:\po-watcher\ProjectOperations`, whose `.git` has **no** `index.lock` and no
  mid-operation state.
- **An interrupted merge / rebase / cherry-pick / bisect / stash-apply.** Ruled out — all
  seven markers absent in **both** trees. `git reflog` shows nothing after
  `c1737312 … 2026-08-21 11:40:20 +1000: merge origin/main: Fast-forward` (= 01:40:20Z);
  no ref moved at 02:13, so the abandoned command was index-only, not ref-moving.
- **`docs/qa/.qa-run.lock` is involved / is holding things.** Ruled out — a recursive scan
  of `C:\ProjectOperations2` **and** `C:\po-watcher` found **no file named `.qa-run.lock`
  anywhere**. The earlier "epoch 0, undeletable from the Linux sandbox" report no longer
  describes anything on disk. Nothing was deleted by this station to make that true.
- **A Windows Scheduled Task fires the stations.** Ruled out — the only matching tasks are
  `OneDrive Per-Machine Standalone Update Task` and `RecommendedTroubleshootingScanner`.
  The station schedule is not Windows Task Scheduler.
- **A station session is still running and mid-git.** Ruled out — exactly one session VM
  besides this one carries an Aug-21 mtime (`dreamy-magical-wright`, frozen at 02:09:58Z,
  ownership reverted). No live station VM. Nothing was killed.
- **The 02:50:55Z `04 scanner (local)` run caused or is holding the lock.** Ruled out — the
  lock predates it by 38 minutes, and that run left **no** VM directory dated Aug 21 and
  **no** file footprint anywhere under the scanned roots (nothing written after 02:33:01Z
  until 03:35:51Z). It is **not** in flight.

## THE CLEAR (03:48:13Z)

Single explicit path, no wildcards, no `-Recurse`:
`Remove-Item -LiteralPath 'C:\ProjectOperations2\.git\index.lock' -Force`

Read-back proof:

```
DELETE_AT_UTC=2026-08-21T03:48:13Z
REMOVE_EXIT_OK=True
READBACK_TESTPATH=False
GIT_STATUS_EXIT=0        (git -C C:\ProjectOperations2 status --porcelain=v1 --untracked-files=no)
GIT_STATUS_LINES=9
RECHECK_AFTER_5S_TESTPATH=False
RECHECK_AFTER_20S_TESTPATH=False
HEAD_NOW=c1737312        (unchanged)
```

The 9 porcelain lines are the deliberately-absent `-ready.md` prompts and the two `HOLD`
renames. **Left exactly as found** — no `checkout`, no `reset`, no `stash pop`, no `clean`.

## SWEEP AFTER THE CLEAR — verbatim

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProjectOperations2\scripts\pipeline\status-sweep.ps1"`

§3 (IS THE BOARD BUSY?), the `git index.lock` line, verbatim:

```
  [LIVE] git index.lock  interactive/clone: False / False  (true = a git write is mid-flight)
```

§7 VERDICT, verbatim:

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity.
  [LIVE]    For any git WRITE, still prefer an ISOLATED worktree off origin/main. NEVER merge -- the supervisor drives the board.

SWEEP COMPLETE 2026-08-21 03:48:52Z -- report ONLY from [LIVE] lines; treat [FILE] as unverified; never repeat a [STALE] line as current.
```

The `DO NOT ACT` freeze is lifted. Stations are unblocked.

## LEFT ALONE ON PURPOSE (reported, not acted on)

- **`.git/worktrees/po-scan-0CwZSs`** — registered, `locked`, gitdir `/tmp/po-scan-0CwZSs`
  pointing into a destroyed VM, holding 0-byte `HEAD.lock` + `index.lock` from
  2026-08-20T22:12:00Z. Same failure class as this incident. **Not pruned** — pruning
  worktrees is outside this station's remit. Worth a decision by 00/05.
- `.git/objects/maintenance.lock`, 0 bytes, 2026-08-18T06:11:47Z. Untouched.
- Watcher clone, all worktrees, every prompt on the board. Untouched.
- Nothing was killed. ~14 node.exe are running; pid 13372 is the watcher and is alive.

## THE FIX THIS POINTS AT (for 00 / 05 — not done here)

Occurrence three has the same shape as one and two, and the mechanism is now identified:
station sessions run `git` against the dev tree through the workspace-VM mount, where a
cut-off command leaves a lock that **no Windows-side check can attribute to a live process**,
because there never was one. Two candidate durable fixes:

1. **Stations stop running git against `C:\ProjectOperations2` from the workspace VM.**
   Route every git write through Desktop Commander on the Windows side, where the process is
   visible, attributable and outlives a 45 s cap.
2. **Make `status-sweep.ps1` §7 not freeze the whole board on a lock that is provably stale.**
   A 0-byte `index.lock` older than N minutes with zero git processes and no mid-operation
   markers is an orphan, not a mid-flight write. Today its mere existence escalates to
   `DO NOT ACT`, which is what turns a stray file into a full board freeze three times over.

Recorded by station 03, 2026-08-21 03:49Z. Evidence over assertion — every claim above is
either tagged MEASURED with the command that produced it, or explicitly marked CANNOT MEASURE.
