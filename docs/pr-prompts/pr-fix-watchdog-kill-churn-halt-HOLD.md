---
premise: '! grep -q "watchdogKillTimes" scripts/pr-watcher/supervise-watcher.ps1'
premise_means: Repeated watchdog kills escalate to nobody. The only churn halt in the repo lives in a script that nothing invokes, so a kill loop can run indefinitely in silence.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/supervise-watcher.tests.ps1
done_when: grep -q "watchdogKillTimes" scripts/pr-watcher/supervise-watcher.ps1 && node --test "scripts/pr-watcher/__tests__/*.mjs"
size: 2
gate_allow: none
seed_only: false
escalates: false
cluster: watchdog-runnable
cluster_order: 2
requires_on_main: scripts/pr-watcher/supervise-watcher.ps1 :: .queue-state.json
---

# Fix: repeated watchdog kills must escalate instead of running forever

## HELD — do not arm this by hand

This is slice 2 of the `watchdog-runnable` cluster. Its `requires_on_main` gate opens by itself once
slice 1 (`pr-fix-watchdog-runnable-count`) is on `main`. Arm it only after that, and only once the
watcher clone at `C:\po-watcher\ProjectOperations` has been brought back to `origin/main` — until
then no change to `scripts/pr-watcher/**` reaches the running watcher.

## The defect (measured on origin/main dc632446, 2026-08-18)

`supervise-watcher.ps1:373-376` says:

> *"See #1163's churn detector: the 'Watcher exited via watchdog kill' LogMessage below still
> matches its 'Watcher exited' regex, so a repeated hang still trips the churn halt at 4 kills in
> 20 min -- the two guards coexist."*

**That comment describes a guard nothing calls.** `Get-RestartChurn` and `Invoke-ChurnHalt` exist
only inside `scripts/restart-watcher-if-wedged.ps1`. Measured on `origin/main`:

- `git grep restart-watcher-if-wedged` returns hits **only** in station briefs, `DOCTRINE.md`,
  `SCRIPT-REGISTRY.md`, `sot/05` and the test suite. No launcher, no loop, no scheduler runs it.
- `Select-String` across `C:\po-watcher\*.ps1|*.bat|*.cmd` returns **zero** hits.
- No Windows scheduled task matches `watch|wedge|pr-`.

So the halt fires only when a human or a station agent runs that script by hand. The unit test at
`__tests__/supervise-watcher.tests.ps1:191` passes because it calls `Get-RestartChurn` **directly** —
it tests the function and never the wiring.

The proof is empirical: on 2026-08-18 the watchdog killed a healthy node 55+ times over roughly four
hours, ~4.5 minutes apart, and **escalated to nobody**. The supervisor's own crash-loop guard did not
fire either, because #1181 correctly reclassified a watchdog kill as *not* a failure — that
reclassification is right and must not be reverted. The gap is that the guard which was supposed to
cover the watchdog-kill path is simply never invoked.

## What to build

A churn counter for watchdog kills, inside the supervisor's own loop, using the escalation machinery
that already exists in this file. No new script, no dependency on a scheduler we cannot verify.

### `scripts/pr-watcher/supervise-watcher.ps1`

**1. State.** Next to `$lastReasonKey` / `$sameCount` (`:351-352`), add:

```powershell
$watchdogKillTimes    = New-Object 'System.Collections.Generic.List[datetime]'
$wdChurnWindowMin     = 20
$wdChurnThreshold     = 4
if ($env:PR_WATCHER_WD_CHURN_WINDOW_MIN) { $wdChurnWindowMin = [int]$env:PR_WATCHER_WD_CHURN_WINDOW_MIN }
if ($env:PR_WATCHER_WD_CHURN_THRESHOLD)  { $wdChurnThreshold = [int]$env:PR_WATCHER_WD_CHURN_THRESHOLD }
```

The 20-minute window and threshold of 4 deliberately mirror `restart-watcher-if-wedged.ps1`'s
`-ChurnWindowMinutes 20` / `-ChurnThreshold 4`, so the two guards agree rather than disagreeing.

**2. A pure, testable decision function**, defined alongside `Resolve-WatcherExitAction` so the
existing Pester suite can dot-source it without starting anything:

```powershell
function Resolve-WatchdogChurn {
    param(
        [datetime[]] $KillTimes,
        [datetime]   $Now,
        [int]        $WindowMinutes = 20,
        [int]        $Threshold     = 4
    )
    # returns [pscustomobject] @{ InWindow = <int>; Halt = <bool>; Kept = <datetime[]> }
}
```

Requirements — all of these must hold:

- `Kept` contains only the kill times within `WindowMinutes` of `Now`; older ones are pruned.
- `InWindow` equals `Kept.Count`.
- `Halt` is `$true` only when `InWindow -ge $Threshold`.
- An empty or `$null` `KillTimes` returns `InWindow = 0`, `Halt = $false`, and does not throw.
- A kill time in the future is kept, not discarded — a clock skew must not hide churn.
- The function performs no I/O, reads no globals, and calls `Get-Date` nowhere. `Now` is a
  parameter precisely so the test can control it.

**3. Wire it into the `'relaunch-watchdog'` branch** (`:395-401`), before the existing 5-second
sleep. Append `(Get-Date)` to `$watchdogKillTimes`, call `Resolve-WatchdogChurn`, assign `Kept` back
to `$watchdogKillTimes` so the list cannot grow without bound, and log the count every time:

```powershell
Sup-Log ("Watchdog kill {0} of {1} inside a {2} min window." -f $churn.InWindow, $wdChurnThreshold, $wdChurnWindowMin)
```

When `$churn.Halt` is `$true`, follow the shape the `'escalate-crash-loop'` branch already uses at
`:407-413` — do not invent a second escalation style:

```powershell
$escalationPath = Write-Escalation -Reason "watchdog-kill churn: $($churn.InWindow) kills in $wdChurnWindowMin min" -Count $churn.InWindow -Dir $escalationDir
Sup-Log "WATCHDOG-KILL CHURN GUARD TRIPPED: $($churn.InWindow) kills in $wdChurnWindowMin min. NOT restarting again."
Sup-Log "Escalation written to: $escalationPath"
Sup-Log "Supervisor exiting (exit 1). Fix the cause, then start the supervisor again."
exit 1
```

Halting is the correct outcome, not a regression: a node being killed four times in twenty minutes
is not being helped by a fifth restart, and the whole point is that a human finds out.

**4. Correct the false comment.** Rewrite `:373-376` and `:398-399` so they no longer claim the
external churn detector covers this path. State what is actually true: `restart-watcher-if-wedged.ps1`
holds the same logic but is invoked only on demand, and this in-loop guard is what covers the
automatic path.

### `scripts/pr-watcher/__tests__/supervise-watcher.tests.ps1`

Add a `Context` block for `Resolve-WatchdogChurn`, in the style of the existing blocks in that file,
with one `It` per requirement listed above — including the empty-input case, the boundary case at
exactly `Threshold - 1` kills (must NOT halt), the case at exactly `Threshold` (must halt), pruning
of an out-of-window kill, and the future-timestamp case.

**Known gap, state it in the PR body:** the CI job `pipeline-tests` runs only
`node --test "scripts/pr-watcher/__tests__/*.mjs"`. This `.ps1` suite is **not run by CI at all**, so
these cases are documentation and a local harness rather than a gate. Do not paper over that — say it
in the PR body and run the suite locally with Pester before opening the PR, reporting the result.

## Do NOT

- Do NOT revert or weaken #1181's classification of a watchdog kill as not-a-failure. It is correct.
- Do NOT change the watchdog job block, the sentinel-before-kill ordering, the kill, the 150 s sleep,
  or anything slice 1 touched.
- Do NOT alter `Get-RestartChurn` or `Invoke-ChurnHalt` in `scripts/restart-watcher-if-wedged.ps1`.
  That script stays as the on-demand check; this is the automatic path.
- Do NOT add the `.ps1` suite to `.github/workflows/ci.yml` in this PR. The file uses Pester v3-style
  `Should Be` assertions and migrating them is its own piece of work — raise it, do not bundle it.
- Do NOT touch `/sot/`, any prompt file, or anything outside the two files in `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure — never guess from the check name.
- ASCII only in the PowerShell file, and never write it with `Set-Content -Encoding UTF8` — that
  emits a BOM. Use `[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding($false)))`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
