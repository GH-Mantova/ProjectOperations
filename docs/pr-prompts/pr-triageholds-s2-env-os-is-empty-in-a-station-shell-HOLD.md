---
premise: '! grep -q BASH_PLATFORM_PROBE_V1 scripts/pipeline/triage-holds.ps1'
premise_means: >-
  triage-holds.ps1 decides where bash lives by reading the INHERITED environment variable
  $env:OS, and in the shell every scheduled station actually runs in, that variable is EMPTY.
  MEASURED 2026-09-07T06:2xZ at origin/main 9a905ec6, from inside a live scheduled Station 00
  run, in the PowerShell 5.1 process Desktop Commander starts. scripts/pipeline/triage-holds.ps1
  line 244 reads `if ($env:OS -eq "Windows_NT") {` and its else branch sets
  `$bashBin = "/bin/bash"`. In that shell `$env:OS` is the empty string, so the else branch is
  taken on a Windows box, and every premise probe then fails with
  `could not execute /bin/bash - The term '/bin/bash' is not recognized`. Measured the same run
  `$env:OS` -> [] while `$env:ProgramFiles` -> [C:\Program Files] and
  `Test-Path 'C:\Program Files\Git\bin\bash.exe'` -> True, so bash IS present and the candidate
  scan would have found it had the branch been reached. Blast radius, measured on the same board
  the same minute - `triage-holds.ps1` reported `spent=5 of 26 evaluated ... of 57 HOLDs` with
  31 prompts tagged PREMISE UNMEASURABLE and its own fixture control FAILING, i.e. the whole
  SPENT_BEHIND_A_REJECT_V1 bucket that shipped in #1754 is inert on this host. lint-prompt.mjs
  does the same job correctly with `process.platform !== "win32"` (function findBash), which is
  why lint evaluated 26 premises in the same run that the probe could evaluate none.
  This is the only `$env:OS` branch in scripts/**.ps1 - measured with a POSITIVE control
  (`Test-Path` -> 58 hits) and a freshly minted NEGATIVE control (-> 0).
scope:
  - scripts/pipeline/triage-holds.ps1
done_when: >-
  grep -q BASH_PLATFORM_PROBE_V1 scripts/pipeline/triage-holds.ps1 && ! grep -q 'env:OS' scripts/pipeline/triage-holds.ps1 && pnpm build && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# TRIAGEHOLDS-S2: `$env:OS` is empty in a station shell, so the SPENT probe never runs

## The defect, stated exactly

`scripts/pipeline/triage-holds.ps1:243-252` resolves bash like this:

```powershell
$bashBin = $null
if ($env:OS -eq "Windows_NT") {
    $bashCandidates = @("C:\Program Files\Git\bin\bash.exe", "C:\Program Files (x86)\Git\bin\bash.exe")
    if ($env:ProgramFiles) { $bashCandidates += (Join-Path $env:ProgramFiles "Git\bin\bash.exe") }
    foreach ($candidate in $bashCandidates) {
        if (Test-Path -LiteralPath $candidate) { $bashBin = $candidate; break }
    }
} else {
    $bashBin = "/bin/bash"
}
```

`$env:OS` is not a property of the operating system. It is an ordinary environment variable that
Windows sets for an interactive session and that any process in the tree can fail to pass on. In
the PowerShell 5.1 process a scheduled station gets — the one Desktop Commander's `start_process`
starts, which is the only shell any station has — **it is the empty string.**

So on a Windows box with Git bash installed, the else branch runs, `$bashBin` becomes `/bin/bash`,
and all 31 premise probes return

    UNMEASURABLE - could not execute /bin/bash: The term '/bin/bash' is not recognized ...

## Why this matters, and why it is only S2

`SPENT_BEHIND_A_REJECT_V1` shipped in **#1754** at 04:05:40Z to close a real gap: `lint-prompt.mjs`
runs the premise LAST, so a prompt REJECTed for any other reason never has its premise evaluated
and can never be reported SPENT however completely its work has landed. The new bucket re-probes
those prompts directly. **On the only host it runs on, it has never been able to probe one.**

It fails **SAFE**, and loudly — that is the whole reason this is S2 and not S1. The script tags
every one of the 31 `PREMISE UNMEASURABLE`, excludes them from the denominator, prints
`!!! SUSPECT: this bucket is UNMEASURABLE this run -- fixture probe returned UNMEASURABLE
(expected SPENT)` and `!!! An empty bucket above proves NOTHING`. Its own fixture positive control
is what caught this. Nothing was mis-binned and no prompt was wrongly cleared for arming.

But the gap #1754 was written to close is still open, silently, behind a banner that reads like a
transient. And a run that skims TOTALS sees `spent=5 of 26 evaluated ... of 57 HOLDs` and has no
reason to look further.

## The fix — complete and additive

**Ask the platform, not the environment.** `[System.Environment]::OSVersion.Platform` is answered
by .NET, exists in PowerShell 5.1 and in PowerShell 7, and cannot be unset by a parent process:

```powershell
# BASH_PLATFORM_PROBE_V1 - $env:OS is an INHERITED variable and is EMPTY in the PowerShell 5.1
# process Desktop Commander starts for a scheduled station, so branching on it put a Windows box
# down the /bin/bash path and made every premise probe UNMEASURABLE (measured 2026-09-07 at
# 9a905ec6). .NET answers this one and no parent can clear it. lint-prompt.mjs's findBash uses
# process.platform for the same reason.
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$bashBin = $null
if ($isWindowsHost) {
    ...unchanged candidate scan...
} else {
    $bashBin = "/bin/bash"
}
```

Keep everything else exactly as it is: the candidate list, the `Test-Path` scan, the `$null`
result when no bash is found, and the `UNMEASURABLE` verdict that follows from it. **A box with
genuinely no bash must still read UNMEASURABLE** — that behaviour is correct and is not what this
prompt changes.

**Additive half.** Extend the existing fixture control so that a failing fixture names the resolved
`$bashBin` in its SUSPECT line. Today the banner says the bucket is unmeasurable but not *which*
binary it tried, and the binary is the whole answer. One string, no new logic.

## Verify

1. `grep -q BASH_PLATFORM_PROBE_V1 scripts/pipeline/triage-holds.ps1` — the marker is present.
2. `! grep -q 'env:OS' scripts/pipeline/triage-holds.ps1` — the inherited-variable branch is gone.
   This is the load-bearing assertion: adding the marker while leaving the old test in place fixes
   nothing.
3. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/triage-holds.ps1` and
   confirm the fixture control **passes** (`spent` reachable, no `!!! SUSPECT` line) and that
   `PREMISE UNMEASURABLE` no longer lists every rejected prompt with a `/bin/bash` detail.
4. `pnpm build && pnpm lint`.

## What this prompt does NOT do

It does not change `lint-prompt.mjs`, which already resolves bash correctly, and it does not touch
the ordering of lint's own checks — `#1754`'s header explains why the premise runs last and that is
deliberate.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
