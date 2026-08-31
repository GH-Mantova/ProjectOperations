#Requires -Version 5.1
<#
.SYNOPSIS
    Serialize arming of a HOLD prompt to a ready prompt.

.DESCRIPTION
    WHY THIS SCRIPT EXISTS
    ----------------------
    C:\ProjectOperations2 is a single git working tree with one shared index. Several Cowork chats
    and station agents operate in it concurrently. Before this script existed, arming was a bare
    `git mv <name>-HOLD.md <name>-ready.md` typed by whichever chat happened to be running at the
    time. That is a defect: any chat that commits afterwards picks up the staged rename silently.

    Three real collisions on 2026-08-24 proved this is not theoretical:
      - commit 488f138a swept HOLD->ready renames of pr-nopr-s1 and pr-nopr-s2 into a docs commit.
      - pr-lessons-folder-s1-restore was staged by another chat and had to be committed around.
      - Four CRM arming renames sat staged across three unrelated commits.

    This script serializes arming behind a real OS file lock, guards the index before and after the
    rename, and refuses if ANY unexpected path is staged during the window. A bare `git mv` without
    this wrapper is now a defect.

.PARAMETER Name
    The prompt slug (without suffix). The script expects docs/pr-prompts/<Name>-HOLD.md to exist.

.PARAMETER WhatIf
    Dry-run: check everything, print the plan, touch nothing. Exits 0 if all checks would pass.

.PARAMETER LockTimeoutSeconds
    How many seconds to retry acquiring the exclusive lock before giving up. Default 60.
    Exposed for testability so tests can use a short timeout without waiting 60 s.

.EXAMPLE
    arm-prompt.ps1 -Name pr-foo-bar
    arm-prompt.ps1 -Name pr-foo-bar -WhatIf
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [switch]$WhatIf,

    [int]$LockTimeoutSeconds = 60
)

$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

$REPO_ROOT   = "C:\ProjectOperations2"
$LOCK_PATH   = "$REPO_ROOT\.git\po-arm.lock"
$PROMPT_DIR  = "docs/pr-prompts"
$HOLD_REL    = "$PROMPT_DIR/$Name-HOLD.md"
$READY_REL   = "$PROMPT_DIR/$Name-ready.md"
$HOLD_ABS    = "$REPO_ROOT\$($HOLD_REL -replace '/', '\')"
$READY_ABS   = "$REPO_ROOT\$($READY_REL -replace '/', '\')"

$LINT_SCRIPT = "$REPO_ROOT\scripts\pipeline\lint-prompt.mjs"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step([string]$msg) {
    Write-Host "[arm-prompt] $msg"
}

function Write-Fail([string]$msg) {
    Write-Host "[arm-prompt] FAIL: $msg" -ForegroundColor Red
}

# Run a git command in the repo root; returns stdout as a string array (lines).
# git writes warnings to stderr — do not let "Stop" kill us on them.
# NOTE: $Args is a PowerShell reserved automatic variable; use $GitArgs to avoid shadowing it.
function Invoke-Git {
    param([string[]]$GitArgs)
    $result = & git -C $REPO_ROOT @GitArgs 2>&1
    # Keep only stdout lines (not ErrorRecord stderr entries). Trim each line to strip CRLF.
    $stdout = $result | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
              ForEach-Object { "$_".Trim() }
    return $stdout
}

# ---------------------------------------------------------------------------
# Step 1 — acquire exclusive lock
# ---------------------------------------------------------------------------

$lockStream = $null

function Acquire-Lock {
    $deadline   = [datetime]::UtcNow.AddSeconds($LockTimeoutSeconds)
    $currentPid = $PID

    while ($true) {
        try {
            # FileShare.Read = exclusive for WRITERS, readable by waiters. A second
            # arming attempt asks for ReadWrite+FileShare::None and is still refused,
            # but a waiter can now open the file read-only to name the holder.
            $lockStream = [System.IO.File]::Open(
                $LOCK_PATH,
                [System.IO.FileMode]::OpenOrCreate,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::Read
            )
            # Write our PID so a timeout message can name the holder.
            $lockStream.SetLength(0)
            $bytes = [System.Text.Encoding]::ASCII.GetBytes($currentPid.ToString())
            $lockStream.Write($bytes, 0, $bytes.Length)
            $lockStream.Flush()
            return $lockStream
        } catch [System.IO.IOException] {
            # Lock is held. Read the holder PID if we can.
            $holderPid = "(unknown)"
            try {
                # The holder's handle is FileAccess::ReadWrite. A reader must therefore
                # allow ReadWrite in ITS share mode or the open is refused - which is why
                # [System.IO.File]::ReadAllText (FileShare.Read) threw here every single
                # time and the timeout message always said '(unknown)'.
                $reader = [System.IO.File]::Open(
                    $LOCK_PATH,
                    [System.IO.FileMode]::Open,
                    [System.IO.FileAccess]::Read,
                    [System.IO.FileShare]::ReadWrite
                )
                try {
                    $sr  = New-Object System.IO.StreamReader($reader)
                    $raw = $sr.ReadToEnd()
                    if ($raw.Trim() -match '^\d+$') { $holderPid = $raw.Trim() }
                } finally { $reader.Close(); $reader.Dispose() }
            } catch { }

            if ([datetime]::UtcNow -ge $deadline) {
                Write-Fail "Could not acquire lock on $LOCK_PATH after ${LockTimeoutSeconds}s. Held by PID $holderPid."
                exit 1
            }

            Start-Sleep -Milliseconds 500
        }
    }
}

# ---------------------------------------------------------------------------
# Helper — get all staged paths (handles renames: shows both old and new names)
# ---------------------------------------------------------------------------
#
# `git diff --cached --name-only` shows only the NEW name for renamed files.
# We need BOTH the old (HOLD) and new (ready) names to verify the index correctly.
# `--name-status` emits lines like: "R100\told-path\tnew-path" — we extract all paths.
function Get-StagedPaths {
    $lines = @(Invoke-Git @("diff", "--cached", "--name-status") | Where-Object { $_ -and $_.Trim() -ne "" })
    $paths = @()
    foreach ($line in $lines) {
        $parts = $line -split "`t"
        # First part is the status code (A, D, M, R100, etc.); rest are paths.
        for ($i = 1; $i -lt $parts.Length; $i++) {
            $pth = $parts[$i].Trim()
            if ($pth) { $paths += $pth }
        }
    }
    return $paths
}

# ---------------------------------------------------------------------------
# Step 2 — index-guard (check for pre-existing staged files)
# ---------------------------------------------------------------------------

function Assert-CleanIndex {
    $staged = Get-StagedPaths
    if ($staged.Count -gt 0) {
        Write-Fail "Index is not clean. The following paths are already staged:"
        foreach ($path in $staged) { Write-Host "  $path" }
        Write-Host ""
        Write-Host "Arming requires a clean index. Commit or unstage the above before arming."
        exit 2
    }
}

# ---------------------------------------------------------------------------
# Step 3 — verify the target
# ---------------------------------------------------------------------------

function Assert-TargetValid {
    # 3a. HOLD file must exist on disk at depth 1.
    if (-not (Test-Path $HOLD_ABS -PathType Leaf)) {
        Write-Fail "HOLD file not found: $HOLD_REL"
        exit 1
    }

    # 3b. HOLD file must be tracked by git.
    $lsFiles = Invoke-Git @("ls-files", "--error-unmatch", $HOLD_REL) 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "HOLD file is not tracked by git: $HOLD_REL"
        exit 1
    }

    # 3c. ready file must not already exist.
    if (Test-Path $READY_ABS -PathType Leaf) {
        Write-Fail "Ready file already exists: $READY_REL — prompt may already be armed."
        exit 1
    }

    # 3d. Run the linter; exit 0 = ADMIT.
    if (-not (Test-Path $LINT_SCRIPT -PathType Leaf)) {
        Write-Fail "Lint script not found: $LINT_SCRIPT"
        exit 1
    }

    Write-Step "Running lint-prompt.mjs on $HOLD_REL ..."
    $lintArgs = @($LINT_SCRIPT, $HOLD_ABS)
    & node @lintArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "lint-prompt.mjs rejected the HOLD file (exit $LASTEXITCODE). Not arming."
        exit 1
    }

    # 3e. Body must not contain do-not-arm markers.
    $body = Get-Content $HOLD_ABS -Raw -Encoding UTF8
    if ($body -match '<!--\s*watcher:\s*do-not-arm\s*-->') {
        Write-Fail "HOLD file body contains <!-- watcher: do-not-arm --> marker. Not arming."
        exit 1
    }
    # Check line-by-line for DO NOT ARM so partial-line matches don't count.
    $lines = $body -split "`r?`n"
    foreach ($line in $lines) {
        if ($line -match 'DO NOT ARM') {
            Write-Fail "HOLD file body contains 'DO NOT ARM' on a line. Not arming."
            exit 1
        }
    }
}

# ---------------------------------------------------------------------------
# Step 5 — index-guard after rename: ensure exactly two expected paths staged
# ---------------------------------------------------------------------------

function Assert-IndexExactlyTwoPaths {
    # Get all staged paths (uses --name-status to capture both names of a rename).
    $staged = Get-StagedPaths

    # Normalise slashes for comparison (git always returns forward-slash paths).
    $expectedHold  = $HOLD_REL  -replace '\\', '/'
    $expectedReady = $READY_REL -replace '\\', '/'

    $hasHold  = $staged -contains $expectedHold
    $hasReady = $staged -contains $expectedReady
    $extras   = $staged | Where-Object { $_ -ne $expectedHold -and $_ -ne $expectedReady }

    if ($extras -and $extras.Count -gt 0) {
        return @{ ok = $false; extras = @($extras) }
    }
    if (-not $hasHold -or -not $hasReady) {
        return @{ ok = $false; missing = $true }
    }
    return @{ ok = $true }
}

# ---------------------------------------------------------------------------
# WHATIF path
# ---------------------------------------------------------------------------

if ($WhatIf) {
    Write-Step "WhatIf mode — checking without touching anything."

    Write-Step "Checking index is clean ..."
    Assert-CleanIndex

    Write-Step "Verifying target ..."
    Assert-TargetValid

    $expectedHold  = $HOLD_REL  -replace '\\', '/'
    $expectedReady = $READY_REL -replace '\\', '/'

    Write-Host ""
    Write-Host "[arm-prompt] PLAN — would stage exactly:"
    Write-Host "  D  $expectedHold"
    Write-Host "  A  $expectedReady"
    Write-Host ""
    Write-Host "[arm-prompt] WhatIf: all checks pass. No files touched."
    exit 0
}

# ---------------------------------------------------------------------------
# LIVE path — wrapped in try/finally so the lock is always released
# ---------------------------------------------------------------------------

Write-Step "Acquiring exclusive lock on $LOCK_PATH ..."
$lockStream = Acquire-Lock
Write-Step "Lock acquired (PID $PID)."

try {
    # Step 2: index-guard before.
    Write-Step "Checking index is clean (before) ..."
    Assert-CleanIndex

    # Step 3: verify target.
    Write-Step "Verifying target: $HOLD_REL ..."
    Assert-TargetValid

    # Step 4: perform the rename.
    Write-Step "Renaming $HOLD_REL -> $READY_REL ..."
    Invoke-Git @("mv", $HOLD_REL, $READY_REL)
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "git mv failed (exit $LASTEXITCODE)."
        exit 1
    }

    # Step 5: index-guard after.
    Write-Step "Verifying index contains exactly the two expected paths ..."
    $check = Assert-IndexExactlyTwoPaths

    if (-not $check.ok) {
        if ($check.missing) {
            Write-Fail "After git mv, expected staged paths were not found. Undoing."
        } else {
            $extraList = $check.extras -join ", "
            Write-Fail "Unexpected staged paths detected: $extraList"
            Write-Host "Another chat staged something during the arming window."
            Write-Host "Restoring those extra paths to un-staged state and undoing the rename."

            foreach ($extra in $check.extras) {
                Write-Step "  git restore --staged $extra"
                Invoke-Git @("restore", "--staged", $extra)
            }
        }

        # Undo the rename by reversing the git mv.
        Write-Step "Undoing rename: git mv $READY_REL $HOLD_REL ..."
        Invoke-Git @("mv", $READY_REL, $HOLD_REL)
        $undoExit = $LASTEXITCODE

        # Exit 3 tells the caller 'I changed nothing'. That is only true if the reverse
        # rename actually happened. Read the index back and PROVE it before saying so -
        # a silently-failed rollback leaves the rename staged in a tree several chats
        # share, which is the exact defect this script exists to prevent.
        $residual = @(Get-StagedPaths)
        if ($undoExit -ne 0 -or $residual.Count -gt 0) {
            Write-Fail "ROLLBACK FAILED. The index is NOT clean and this run DID change state."
            Write-Host "  reverse git mv exit: $undoExit"
            Write-Host "  still staged ($($residual.Count)): $($residual -join ', ')"
            Write-Host ""
            Write-Host "  A human must clear this before anything else commits in ${REPO_ROOT}:"
            foreach ($stuck in $residual) {
                Write-Host "    git -C $REPO_ROOT restore --staged $stuck"
            }
            exit 4
        }

        Write-Step "Rollback verified: index is clean."
        exit 3
    }

    Write-Host ""
    Write-Host "[arm-prompt] SUCCESS: $HOLD_REL -> $READY_REL" -ForegroundColor Green
    Write-Host "[arm-prompt] Index contains exactly the two expected paths. Ready to commit."

    # ---------------------------------------------------------------------
    # AUDIT: arming is a state change and must leave a trace.
    #
    # Added 2026-08-27. Twice that day a prompt was found armed that nobody in
    # the session had armed - pr-dns-s3 (escalates, sot-touching, became #1349)
    # and pr-crm-wincount-s2 (escalates). Both were legitimate work, but "who
    # armed this, and when" was unanswerable: queue-sync was ruled out (zero
    # -ready.md on origin/main) and no scheduled task arms anything, yet this
    # script - the one place arming actually happens - wrote no record.
    #
    # The parent process is the part that matters: git mv preserves the HOLD's
    # mtime, so the file itself carries no evidence of when it was armed, and
    # several chats share this tree. Capturing the caller is what turns "some
    # chat did this" into a name.
    #
    # Best-effort by design: a logging failure must never fail an arming that
    # already succeeded, and must never touch the index (the file is untracked,
    # like .queue-sync-ledger.txt beside it).
    # ---------------------------------------------------------------------
    try {
        $armLog = "$REPO_ROOT\docs\pr-prompts\.arming-log.txt"
        $stamp  = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
        $caller = "unknown"
        try {
            $me = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop
            $pp = Get-CimInstance Win32_Process -Filter "ProcessId=$($me.ParentProcessId)" -ErrorAction Stop
            $caller = "$($pp.Name):$($pp.ProcessId)"
        } catch { }
        $esc = "?"
        try {
            $fm = Get-Content -LiteralPath $READY_ABS -TotalCount 30 -ErrorAction Stop
            $hit = $fm | Where-Object { $_ -match '^escalates:' } | Select-Object -First 1
            if ($hit) { $esc = ($hit -replace '^escalates:\s*', '').Trim() }
        } catch { }
        # Add a header when the log is first created. This is NOT an arm census:
        # a bare `git mv` writes nothing here; the only sound census is the filesystem.
        # Station 00's F10 is precisely that this log gets read as the census.
        if (-not (Test-Path -LiteralPath $armLog)) {
            $header = @(
                "# WRAPPER ARMS ONLY - this file is NOT an arm census. A bare ``git mv`` writes nothing here.",
                "# The only sound census is the filesystem: docs/pr-prompts/*-ready.md"
            ) -join "`n"
            Set-Content -LiteralPath $armLog -Value $header -Encoding ASCII -NoNewline
            Add-Content -LiteralPath $armLog -Value "" -Encoding ASCII
        }
        $line = "$stamp  ARMED  $Name  escalates=$esc  by=$env:USERNAME@$env:COMPUTERNAME  pid=$PID  caller=$caller"
        Add-Content -LiteralPath $armLog -Value $line -Encoding ASCII
        Write-Step "Audit line written to .arming-log.txt"
    } catch {
        Write-Host "[arm-prompt] WARN: could not write .arming-log.txt ($($_.Exception.Message)). Arming stands."
    }

    # -------------------------------------------------------------------------
    # Step 7 — ARM_INDEX_RELEASED: un-stage the rename so no subsequent commit
    # in this shared working tree can sweep it up silently.
    #
    # This is the defect the script exists to prevent: a bare `git mv` leaves
    # the rename staged and any chat that commits next picks it up. We staged the
    # rename only to verify exactly two expected paths; once verified and logged
    # we must release it. The watcher consumes the ready file from the filesystem,
    # not from the index, so un-staging does not affect dispatch.
    #
    # Order: AFTER Assert-IndexExactlyTwoPaths (Step 5) and AFTER the audit line,
    # BEFORE the finally that drops the lock. Doing it inside the lock means no
    # other actor can stage into the window between the check and the release.
    # -------------------------------------------------------------------------
    Write-Step "Releasing staged rename from index (ARM_INDEX_RELEASED) ..."
    $releaseExit = 0
    Invoke-Git @("restore", "--staged", $HOLD_REL, $READY_REL)
    $releaseExit = $LASTEXITCODE

    # Verify the release by reading the index back. The rollback path at lines
    # 335-350 sets this precedent: prove the index state before reporting it.
    $residualAfterRelease = @(Get-StagedPaths)
    if ($releaseExit -ne 0 -or $residualAfterRelease.Count -gt 0) {
        # Arming STANDS: the rename is on disk, the audit line is written, the
        # watcher will consume it. This WARN does not fail the run (exit 0).
        # Name the residual paths and the exact commands a human needs to clear them.
        Write-Host "[arm-prompt] WARN: ARM_INDEX_RELEASED — restore --staged did not fully clean the index." -ForegroundColor Yellow
        Write-Host "[arm-prompt] WARN: Arming is complete (ready file on disk, audit logged) but these paths remain staged:"
        foreach ($stuck in $residualAfterRelease) {
            Write-Host "  $stuck"
            Write-Host "    git -C $REPO_ROOT restore --staged $stuck"
        }
        Write-Host "[arm-prompt] WARN: A human must clear the above before the next arm."
    } else {
        Write-Step "Index clean after release — no staged paths remain."
    }

} finally {
    # Step 6: release lock — always, on every path.
    if ($lockStream -ne $null) {
        $lockStream.Close()
        $lockStream.Dispose()
        $lockStream = $null
        # Remove the lock file so the next caller doesn't see a stale PID.
        try { Remove-Item $LOCK_PATH -Force -ErrorAction SilentlyContinue } catch { }
    }
    Write-Step "Lock released."
}
