---
premise: '! grep -q "queue-state.json" scripts/pr-watcher/supervise-watcher.ps1'
premise_means: The heartbeat watchdog still counts every *-ready.md on disk, including prompts this node cannot dequeue, so one deferred or other-lane prompt makes a healthy idle node look hung and it is killed every ~4.5 minutes.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/queue-state.test.mjs
  - .gitignore
done_when: node --test "scripts/pr-watcher/__tests__/*.mjs" && grep -q "queue-state.json" scripts/pr-watcher/supervise-watcher.ps1
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: watchdog-runnable
cluster_order: 1
---

# Fix: the heartbeat watchdog counts prompts this node cannot run

## The defect (measured on origin/main dc632446, 2026-08-18)

`scripts/pr-watcher/supervise-watcher.ps1:323`:

```powershell
$armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)
if ($armed.Count -eq 0) { continue }   # :324 "empty queue: a stale heartbeat is legitimate idle"
```

It counts **every** `*-ready.md` on disk. The heartbeat (`heartbeat.log`) **only ticks while an
agent is running** (`index.mjs:1063`). So an armed prompt this node will never dequeue makes a
healthy idle node look hung at :342, and the watchdog kills it. It restarts, re-seeds the
reviewed-set with 744 PRs, still has nothing it can run, and is killed again. Poll is 120 s plus a
150 s post-kill sleep, so the cycle is 4.5 minutes.

There are exactly two ways a node cannot run an armed prompt, and the watchdog knows about neither:

1. **Lane ownership.** `index.mjs:664 enqueue()` filters through `laneFor()` (`:479`) when
   `PR_WATCHER_LANE` is set. `watcher-launcher.ps1` sets `PR_WATCHER_LANE=0` / `PR_WATCHER_LANES=2`,
   so lane-1 prompts are invisible to lane 0's node and fully visible to the watchdog.
2. **Dependency gates.** `index.mjs:1916-1924` defers a prompt whose `requires_merged` /
   `requires_file_on_main` / `requires_on_main` are unmet, leaves the file on disk, and re-checks it
   on the next rescan. This is the one that fired on 2026-08-18: 55+ kills over roughly four hours,
   caused by a single correctly-deferred prompt.

`grep -E "defer|requires_|lane" scripts/pr-watcher/supervise-watcher.ps1` returns one unrelated
comment. The watchdog has no concept of either.

## The design rule this fix follows

**The node is the only authority on what it can run.** Re-implementing lane routing or dependency
evaluation in PowerShell would create a second instrument that can disagree with the first — the
exact failure DOCTRINE section 7 exists to prevent. So the node **publishes** what it can run and
the watchdog **reads** it. All the decision logic stays in `index.mjs`, where CI can test it; the
PowerShell side is a file read and a fallback.

## What to build

### 1. `scripts/pr-watcher/index.mjs`

**a. A state-file path constant**, next to `HEARTBEAT_FILE` (~line 165). Dot-prefixed to match the
existing runtime-state convention (`.reviewed-prs.json`, `.watcher.lock`, `.watcher-children.json`):

```js
const QUEUE_STATE_FILE = path.join(__dirname, ".queue-state.json");
```

**b. A pure exported function** so the arithmetic is unit-testable without a filesystem or a clock:

```js
export function computeRunnable({ armed = [], owned = [], deferred = [] } = {}) { ... }
```

It returns `{ armed, owned, deferred, runnable }` as counts, where `runnable` is the number of
`owned` names that are NOT in `deferred`. Requirements:

- Names are compared as plain strings (basenames, e.g. `pr-foo-ready.md`).
- `runnable` is never negative and never exceeds `owned`.
- A name in `deferred` that is not in `owned` is ignored, not subtracted.
- Duplicate names in any input are counted once.
- Missing/undefined inputs behave as empty arrays.

**c. Track deferred prompts.** Add a module-level `const deferredNames = new Set()`. In `drain()`:

- at the defer branch (`:1918-1923`, immediately after the existing `log("deps", ...)` call) add
  `deferredNames.add(name)`;
- at the dependencies-met line (`:1925`) and wherever a prompt is consumed or removed from the
  queue, call `deferredNames.delete(name)`.

A prompt must not stay in `deferredNames` after its gate opens.

**d. Write the state file.** Add `async function writeQueueState()` that computes the three name
lists — every `*-ready.md` in the prompt directory (`armed`), the subset this node owns per the
same `laneFor()` call `enqueue()` uses (`owned`), and `[...deferredNames]` — and writes:

```json
{
  "ts": "<ISO-8601 UTC>",
  "lane": 0,
  "lanes": 2,
  "armed": 3,
  "owned": 2,
  "deferred": ["pr-foo-ready.md"],
  "runnable": 1
}
```

- When `PR_WATCHER_LANE` is unset, `owned` equals `armed` and `lane` is `null` — do not invent a
  lane number.
- Write to `.queue-state.json.tmp` then rename, mirroring the `.reviewed-prs.json.tmp` pattern
  already in this file, so the watchdog can never read a half-written file.
- Best-effort: wrap in try/catch, `log("queue-state", ...)` on failure, and **never throw**. Mirror
  how the heartbeat writer at `:1046-1056` handles its own errors. A state-file problem must never
  stop the watcher.

Call it from `rescan()` (`:2318`) after the walk, and once at startup after the initial scan, so a
healthy node refreshes the file at least every `RESCAN_INTERVAL_MS` (5 min). Also call it at the
defer branch so a fresh deferral is published immediately rather than up to 5 minutes later.

### 2. `scripts/pr-watcher/supervise-watcher.ps1`

Inside the watchdog `Start-Job` script block, replace lines 323-324 only. Do not touch the sentinel
write, the ordering comment at :329-333, the kill, or the 150 s sleep — that ordering is doctrine
and a previous outage came from changing it.

```powershell
$armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)
if ($armed.Count -eq 0) { continue }   # empty queue: a stale heartbeat is legitimate idle

# The NODE is the only authority on what it can dequeue (lane routing + dependency
# gates both live in index.mjs). It publishes that number; we read it. If the file
# is missing or stale the node has stopped rescanning, so fall back to the raw
# on-disk count -- the pre-2026-08-19 behaviour, which fails toward restarting.
$stateFile = Join-Path (Split-Path $Heartbeat) '.queue-state.json'
$runnable  = $armed.Count
$howKnown  = 'on-disk count (no fresh .queue-state.json)'
try {
    if (Test-Path $stateFile) {
        $stateAgeMin = ((Get-Date).ToUniversalTime() - (Get-Item $stateFile).LastWriteTimeUtc).TotalMinutes
        if ($stateAgeMin -le $StateMaxAgeMin) {
            $state = Get-Content $stateFile -Raw | ConvertFrom-Json
            if ($null -ne $state.runnable) {
                $runnable = [int]$state.runnable
                $howKnown = ("node-published (state age {0} min)" -f [int]$stateAgeMin)
            }
        }
    }
} catch { WD-Log ("queue-state read failed (" + $_.Exception.Message + "); using the on-disk count.") }

if ($runnable -le 0) {
    WD-Log ("armed={0} runnable=0 -- nothing this node can dequeue; a stale heartbeat is legitimate idle. Source: {1}." -f $armed.Count, $howKnown)
    continue
}
```

Then use `$runnable` — not `$armed.Count` — in the `:342` HUNG message and in the `:336` sentinel
line, and keep reporting both numbers so a human reading the log can still see how many prompts are
on disk. Add `$StateMaxAgeMin` as a new `param()` entry on the job script block and pass a new
`$wdStateMaxAgeMin` through `-ArgumentList`, defaulted next to `$wdHungMin`:

```powershell
$wdStateMaxAgeMin = 10
if ($env:PR_WATCHER_WD_STATE_MAX_MIN) { $wdStateMaxAgeMin = [int]$env:PR_WATCHER_WD_STATE_MAX_MIN }
```

10 minutes is deliberate: it is two rescan intervals, so a healthy node always looks fresh, and it
is below the 15-minute hung threshold, so a node that has stopped rescanning is still caught.

Update the `Sup-Log` startup banner at `:304` to say the watchdog restarts on a stale heartbeat with
**runnable > 0**, so the log stops describing behaviour the script no longer has.

### 3. `scripts/pr-watcher/__tests__/queue-state.test.mjs` (new)

Node's built-in test runner (`node:test` + `node:assert/strict`), matching the style of the existing
`*.mjs` suites in that directory. It must import `computeRunnable` from `../index.mjs` and cover:

- all armed, none owned by this lane, none deferred -> `runnable === 0`
- all armed and owned, one deferred -> `runnable === owned - 1`
- every owned prompt deferred -> `runnable === 0`
- nothing armed -> all four counts `0`
- a deferred name that is not owned -> does not reduce `runnable`
- duplicate names in `armed` / `owned` / `deferred` -> counted once
- empty and omitted arguments -> all zeros, no throw

**Two things already verified for you on `origin/main` — do not spend turns re-checking them:**

- **Importing `../index.mjs` is safe.** `index.mjs:2508` guards the startup path with
  `if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))`, so
  importing the module does not start the watcher. Seven suites in this directory already do it —
  `escalation-label.test.mjs`, `fix-lane.spec.mjs`, `resolve-prompt-dir.test.mjs`,
  `untracked-ready-prompts.test.mjs`, `verdict-archival.spec.mjs`,
  `watcher-frontmatter-deps.test.mjs`, `worktree-sweep.test.mjs`. Follow their import style.
- **The CI job `pipeline-tests` runs `node --test "scripts/pr-watcher/__tests__/*.mjs"`,
  unconditionally** (`.github/workflows/ci.yml:148-174`, no `needs: changes` gate). The quoted glob
  is load-bearing; the suite must be a `.mjs` file in that directory or CI will not run it. Both
  `*.test.mjs` and `*.spec.mjs` are matched.

### 4. `.gitignore`

Add to the "PR-watcher runtime state" block at lines 64-68, alongside `.reviewed-prs.json`:

```
scripts/pr-watcher/.queue-state.json
scripts/pr-watcher/.queue-state.json.tmp
```

Verified on main: `git check-ignore -v scripts/pr-watcher/queue-state.json` returns nothing today.
Without this the watcher's own clone gains a permanently-modified untracked file, which the
preflight then stashes every cycle — the clone already carries a stash problem and this must not add
to it.

## Do NOT

- Do NOT re-implement `laneFor()` or dependency evaluation in PowerShell. Read the node's number.
- Do NOT change the sentinel-before-kill ordering, the kill itself, the 150 s sleep, or
  `Resolve-WatcherExitAction`. A separate chained slice covers the churn guard.
- Do NOT change `$wdHungMin` (15) or `$wdPollSec` (120).
- Do NOT make a missing or stale state file mean "not hung". It must mean "fall back to the on-disk
  count", so a genuinely wedged node is still restarted.
- Do NOT let a state-file write error stop, slow, or crash the watcher.
- Do NOT touch `/sot/`, any prompt file, the `.github/` workflows, or anything outside the four
  files in `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure — never guess from the check name.
- `pipeline-tests` is unconditional in CI, so your new suite runs on this PR. Make it pass.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.

## For the PR body

State plainly that **merged is not deployed**: `watcher-launcher.ps1` runs the clone's copy of
`supervise-watcher.ps1` at `C:\po-watcher\ProjectOperations`, so this fix does nothing until that
clone is updated. Say so in the PR body so whoever merges knows the follow-up is required.
