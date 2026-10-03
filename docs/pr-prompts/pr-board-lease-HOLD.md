---
premise: '! grep -q "BOARD_LEASE_V1" scripts/pipeline/pipeline-lib.ps1'
premise_means: >-
  Two Station 00 lanes (the hourly scheduled task and the interactive chat lane, both authorised to
  drive the board by Marco's 2026-09-21 ruling) keep working one board and one git index at the same
  time. The only guard, status-sweep.ps1 section 7, says SAFE TO ACT unless a git index.lock is held,
  a git process is touching our trees, a PR was touched in the last 2 minutes, or a live station
  worktree exists. A lane that is between arms, or waiting on a build it just armed, produces none of
  those. MEASURED 2026-10-03 at origin/main 8ed747e0: section 7 has no lease or lane signal, and
  section 3 prints "BUILD IN FLIGHT" but tags it "reported, NOT a block signal". .arming-log.txt
  still shows scheduled and interactive actors arming on the same days (e.g. 2026-09-24:
  station-00.interactive-0004, station-00, station-06.g8). Source:
  needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md
  (five occurrences, each caught only by a run standing off on judgement).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  grep -q "BOARD_LEASE_V1" scripts/pipeline/pipeline-lib.ps1 &&
  grep -q "BOARD_LEASE_V1" scripts/pipeline/status-sweep.ps1 &&
  grep -q "BOARD_LEASE_V1" scripts/pipeline/arm-prompt.ps1 &&
  grep -q "BOARD_LEASE_V1" docs/pipeline/stations/00-supervisor.md &&
  test -f scripts/pipeline/__tests__/board-lease.test.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/pipeline-lib.ps1
  - scripts/pipeline/arm-prompt.ps1
  - scripts/pipeline/status-sweep.ps1
  - scripts/pipeline/__tests__/board-lease.test.mjs
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  A local lease file and the code that reads and writes it. Reverting removes the lease; the old
  lock-only gate returns. The lease file lives in .git/ and is never tracked.
escalates: true
module: pipeline
---

# One board, one holder: a lease every Station 00 lane must take before it mutates the board

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**A lease, held until the work lands.** Any lane that arms or merges takes a small lease naming
itself. It holds it until its build finishes or it releases it, and the lease expires on its own
after 30 minutes. Another lane's safe-to-act check then reads `CAUTION: <lane> holds the board` and
stands down. An in-flight build also blocks. Both Station 00 lanes still drive the board (the
2026-09-21 ruling stands); the lease only stops them doing it at the same moment.

Tag every new piece with `BOARD_LEASE_V1`.

## 1. The lease file

`<repo>\.git\po-board-lease.json`: inside `.git`, so it is shared by every lane working the dev
tree, never tracked, and never shows in `git status` or blocks a fast-forward. Shape:

```json
{ "actor": "station-00.sched", "reason": "arm:pr-foo", "pid": 1234,
  "acquiredAt": "2026-10-03T01:02:03Z", "expiresAt": "2026-10-03T01:32:03Z" }
```

Write it atomically: write a temp file, then rename. UTF-8, no BOM.

## 2. `scripts/pipeline/pipeline-lib.ps1`: three functions

- `Get-BoardLease`: returns the lease object, or `$null` when the file is absent, unreadable or
  expired. An unreadable file is reported once with `Write-Warning` and treated as **held by
  `unknown`** until it expires by its file time. Never treat a broken lease as free.
- `Enter-BoardLease -Actor <id> -Reason <text> [-Minutes 30]`: returns `$true` and writes the lease
  when it is absent, expired, or already held by the **same** actor (that renews it). Returns
  `$false` without writing when another actor holds a live lease, and prints who and since when.
- `Exit-BoardLease -Actor <id>`: removes the lease **only if** this actor holds it. Releasing
  someone else's lease is refused with a message.

Use the existing `$ACTOR_RE` rule from `arm-prompt.ps1` for actor names; move it into
`pipeline-lib.ps1` if that avoids a copy.

`Merge-Pr` gains an optional `-Actor`. It defaults to `$env:PO_ACTOR`, and if that is empty to
`pwsh-$PID` with a one-line warning. It stays optional because DOCTRINE, the station docs and
`why-blocked.ps1` show `Merge-Pr <n>` without it, and a mandatory parameter would break those
documented calls. `Merge-Pr` calls `Enter-BoardLease` with reason `merge:#<n>` before merging,
throws if refused, and calls `Exit-BoardLease` in a `finally` after the read-back.

## 3. `scripts/pipeline/arm-prompt.ps1`

Before the arm's first write, `Enter-BoardLease -Actor $Actor -Reason "arm:<name>"`. If refused,
exit with a **new, documented exit code** and print the holder; nothing is written. After a
successful arm, **leave the lease held**. It covers the gap until the watcher picks the prompt up,
after which the build heartbeat blocks (section 4). It expires after 30 minutes.
`-WhatIf` never takes the lease.

## 4. `scripts/pipeline/status-sweep.ps1`, section 7

Add a `-Actor` parameter, defaulting to `$env:PO_ACTOR`. Add two blockers to the verdict, after the
existing `DO NOT ACT` check and before the worktree CAUTION:

1. A live lease held by an actor **other than** the caller:
   `CAUTION: <actor> holds the board (<reason>, <n> min old, expires in <m> min). Stand down; COLLECT only.`
   If the caller is not known (no `-Actor`, no env), treat **every** live lease as someone else's.
2. `BUILD IN FLIGHT` from section 3:
   `CAUTION: a watcher build is in flight (<prompt>). Do not arm or merge until it lands.`
   Change section 3's tag from `NOT a block signal` to `blocks arming and merging (section 7)`.

Also print a section-3 `LIVE` line every run: `board lease: <actor> <reason> <age>` or
`board lease: free`. `SAFE TO ACT` may print only when neither blocker is present.

PowerShell rules (DOCTRINE 9.1): no single-letter variable names, and no automatic-variable names as
assignment or loop targets.

Three other staged prompts edit `status-sweep.ps1`: `pr-sweep-clone-dirty-and-unpushed` (#2206),
`pr-dispatched-register` (#2209), and section 3 here. If any has merged, rebase onto it and touch
only your own blocks.

## 5. `docs/pipeline/stations/00-supervisor.md`, BOARD DRIVING condition 3

Replace "first confirm nothing else is mid-mutation" with this rule: **take the board lease
(`Enter-BoardLease`) before any arm, merge, branch update or label change. If it is refused, COLLECT
only and say who held it.** Release it when the mutation lands. Keep the existing lock, process and
recent-activity checks; the lease adds to them. Run `node scripts/pipeline/lint-station.mjs` and
re-record canonical hashes with `--write-canonical` if it asks.

## Tests: `scripts/pipeline/__tests__/board-lease.test.mjs`

`node:test` driving `pwsh` against a temp repo. Skip with a reason when `pwsh` is absent; the
Windows `pipeline-tests-windows` job runs it for real.

1. A acquires; B is refused, and the message names A; A renews; A releases; B acquires.
2. An expired lease (back-dated `expiresAt`) lets B acquire.
3. B cannot release A's lease.
4. A corrupt lease file blocks until its file time is 30 minutes old, and warns once.
5. `status-sweep.ps1 -Actor B` prints `CAUTION: A holds the board` when A holds it, and
   `-Actor A` does not.
6. **Negative control:** with no lease and no build, the sweep's verdict is unchanged from today
   (`SAFE TO ACT` in an otherwise quiet temp repo).

`escalates: true`: it changes how every lane mutates the board. The PR opens labelled
`do-not-merge`, and Marco releases it.
