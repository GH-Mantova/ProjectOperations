---
premise: '! grep -q PR_WATCHER_LANE scripts/pr-watcher/supervise-watcher.ps1'
premise_means: The heartbeat watchdog in supervise-watcher.ps1 has no concept of lanes. It counts every *-ready.md in the shared prompt dir as "armed", including prompts belonging to a lane this watcher will never dequeue. A prompt owned by an idle lane therefore makes a healthy node look hung, forever.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/watchdog-lane.test.mjs
done_when: grep -q PR_WATCHER_LANE scripts/pr-watcher/supervise-watcher.ps1 && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIX: the heartbeat watchdog counts armed prompts it will never run

## The incident (measured, 2026-08-18)

The watcher was restarted with lane 0 only. Two armed prompts
(`pr-tenant-mt4-sharing-slice0-ready.md`, `pr-theme-system-slice0-ready.md`) both hash to **lane
1**, whose launcher has been deliberately stopped since 2026-08-15 (sentinel
`C:\po-watcher\STOP-WATCHER-LANE2`). Lane 0 therefore had nothing to do — correctly.

`supervise-watcher.ps1` then killed it every ~4.5 minutes:

    12:22:19  WATCHDOG heartbeat stale 20 min with 2 armed and 0 in-progress -> node HUNG.
    12:26:49  WATCHDOG heartbeat stale 25 min with 2 armed and 0 in-progress -> node HUNG.
    12:31:19  WATCHDOG heartbeat stale 29 min with 2 armed and 0 in-progress -> node HUNG.
              Identical consecutive failures: 4 of 5.

One more and the supervisor escalates and stops.

**It is self-sustaining.** The heartbeat only ticks while a prompt is RUNNING, so a node that has
nothing it is allowed to run can never clear the staleness it is being killed for. It is killed,
restarts, spends ~30 s seeding, still has nothing to run, and is killed again.

## The defect

`scripts/pr-watcher/supervise-watcher.ps1:214`:

    $armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)

That is the **whole shared queue**. `PR_WATCHER_LANE` appears **zero times** in the entire file
(verified against `origin/main`). The watcher shards; its own watchdog does not. Meanwhile
`index.mjs` exports the routing rule as pure functions - `laneFor(name, {isFix, isReview, body,
lanes})` at :479, `laneHash` at :421, `bodyNeedsSerialLane` at :434 - so the rule is available and
simply is not consulted.

## What to build

**1. The watchdog counts only prompts THIS lane owns.**

Do not reimplement `laneFor` in PowerShell. Two implementations of one hashing rule will drift, and
a drift here means a silent kill-loop again. Shell out to node and call the exported function, so
`index.mjs` stays the single source of truth. Something along the lines of a one-shot
`node -e` (or a tiny helper module) that reads the queue, applies `laneFor` with the same
`isFix` / `isReview` / `body` / `lanes` inputs the watcher uses, and prints the count for
`PR_WATCHER_LANE`.

Mirror the watcher's own classification exactly, including that fix and review prompts pin to
lane 0 and that `bodyNeedsSerialLane` pins to lane 0.

**2. Preserve every existing guard.** These are all still correct and must not regress:

- no node running -> `continue` (the main loop is restarting it)
- zero armed **in my lane** -> `continue` (a stale heartbeat is legitimate idle)
- anything in `in-progress/` -> `continue` (a build is running, not hung)

**3. `PR_WATCHER_LANE` unset must behave exactly as today** — no filtering, count everything. That
is the documented single-lane default (`index.mjs:82-83`) and it is the configuration currently
running in production, via `C:\po-watcher\watcher-launcher-singlelane.ps1`. Do not break it.

**4. Report the orphan, do not just skip it.** This is the half of the incident that the kill-loop
was hiding: even with the watchdog fixed, those two prompts were **stranded** — owned by a lane
with no running watcher, invisible, indefinitely. Silence there is how a queue dies quietly.

When prompts are armed for a lane other than this one AND no watcher for that lane can be observed
running, log it plainly every cycle, and after a sustained period write a single escalation to
`needs-marco/` naming the orphaned prompts and the lane. Write it once, not once per poll —
1,248 duplicate autostashes on 2026-08-17 are the precedent for what per-cycle writes do.

## Tests

In `__tests__/watchdog-lane.test.mjs` (or the repo's established PowerShell test harness if one
exists — say which you used and why):

- lane 0 running, both armed prompts owned by lane 1 -> **no kill**.
- lane 0 running, one armed prompt owned by lane 0, heartbeat stale -> **kill** (unchanged).
- `PR_WATCHER_LANE` unset -> counts everything, behaviour byte-for-byte as today.
- a fix (`rev-*`) prompt is counted by lane 0 even when its hash says otherwise.
- a prompt whose `done_when` mentions `prisma migrate` pins to lane 0.
- orphaned-lane prompts produce exactly ONE `needs-marco/` file, not one per poll.

Do not weaken an existing assertion to go green.

## Verification

A unit test is necessary and not sufficient — the last three watcher outages all passed their unit
tests. Drive the real thing:

1. Set `PR_WATCHER_LANE=0`, `PR_WATCHER_LANES=2`.
2. Arm a prompt whose name hashes to lane 1.
3. Let the heartbeat go stale past `hungMin`.
4. Confirm from `supervisor.log` that the node is **still alive** and that the orphan was reported.

Quote the log lines in your output.

## Context you should know

Lane 2's clone (`C:\po-watcher\ProjectOperations-lane2`) is stale at `8a9dcebb` and its launcher is
sentinel-stopped. Do NOT start it, delete the sentinel, or "fix" the clone as part of this work —
whether lane 2 comes back is Marco's call. This prompt makes the watchdog correct whether or not
it ever does.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
