# Manual daytime launcher for the PR-prompt watcher (v2).
#
# Wraps node scripts/pr-watcher/index.mjs with the same pre-flight checks as
# start-nightly.ps1, minus the STOP_AT cutoff. Designed to be the entry point
# for the VS Code "PR Watcher (v2)" task.
#
# Pure ASCII only -- PowerShell 5.1 reads UTF-8-without-BOM as Windows-1252,
# so non-ASCII characters (em-dashes, curly quotes, emoji) become parser
# errors at load time. Keep it ASCII (LL-22).
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pr-watcher/start-watcher.ps1

$ErrorActionPreference = "Stop"

# --- Log encoding: single-source everything as UTF-8 ---
# Without this the log file ends up with interleaved encodings (LL: seen
# 2026-07-02): Write-Log used Add-Content with the PS 5.1 default (ANSI)
# while the node output went through Tee-Object -FilePath, which writes
# UTF-16LE in PS 5.1. [Console]::OutputEncoding makes PowerShell decode
# node's UTF-8 stdout correctly; every file write below passes an explicit
# -Encoding UTF8.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

if ($env:PR_WATCHER_REPO_ROOT) {
    $RepoRoot = (Resolve-Path $env:PR_WATCHER_REPO_ROOT).Path
} else {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
# Guardrail: never let automation drive the interactive tree.
if ($RepoRoot -eq "C:\ProjectOperations2") {
    Write-Host "REFUSE: watcher must not run against the interactive tree C:\ProjectOperations2. Set PR_WATCHER_REPO_ROOT to a dedicated clone."
    exit 1
}
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "scripts\pr-watcher\logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log([string]$msg) {
    Add-Content -Path $LogFile -Value $msg -Encoding UTF8
    Write-Host $msg
}

# --- Pre-flight: branch + clean tree ---
# Only TRACKED modified/staged files count as "dirty" -- untracked files (e.g.
# the watcher's own queue of -ready.md prompts under docs/pr-prompts/) must not
# block startup, but tracked changes still poison per-PR branch switches.
$branch = (git branch --show-current).Trim()
$dirty  = (git status --porcelain --untracked-files=no)

if ($branch -ne "main") {
    if ($dirty) {
        $msg = "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: on branch '$branch' with uncommitted TRACKED changes; cannot safely auto-switch to main. Commit or stash, then retry."
        Write-Log $msg
        Write-Log $dirty
        exit 1
    }
    # Clean tree parked on a stray feature branch -- a build/smoke/worktree op left the
    # main working tree switched (recurring hazard). Auto-recover to main so the
    # supervisor does not loop forever on preflight and the prompt queue keeps draining.
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: on '$branch' but tree is clean; auto-checkout main to recover."
    git checkout main 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value "$_" -Encoding UTF8; Write-Host "$_" }
    $branch = (git branch --show-current).Trim()
    if ($branch -ne "main") {
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: auto-checkout to main did not take (still on '$branch'). Manual fix needed."
        exit 1
    }
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: recovered to main."
}

if ($dirty) {
    $msg = "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: uncommitted changes to tracked files. Commit, stash, or clean before starting the watcher (dirty trees poison per-PR branch switches)."
    Write-Log $msg
    Write-Log "git status --porcelain --untracked-files=no:"
    Write-Log $dirty
    exit 1
}

# --- Single-instance guard ---
$existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match "pr-watcher[\\/]index\.mjs" }
if ($existing) {
    $msg = "[$(Get-Date -Format o)] SINGLE-INSTANCE: watcher already running (PID $($existing.ProcessId)). Not starting another."
    Write-Log $msg
    exit 0
}

# --- Dependency check: gh + claude on PATH ---
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: 'gh' CLI is not on PATH. Install GitHub CLI and retry."
    exit 1
}
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: 'claude' CLI is not on PATH. Install Claude Code and retry."
    exit 1
}

# --- v2 env defaults (only set if not already set in the parent env) ---
if (-not $env:PR_WATCHER_AUTO_REVIEW)       { $env:PR_WATCHER_AUTO_REVIEW = "true" }
if (-not $env:PR_WATCHER_AUTO_UPDATE)       { $env:PR_WATCHER_AUTO_UPDATE = "true" }
if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs" }
if (-not $env:PR_WATCHER_MAX_TURNS)         { $env:PR_WATCHER_MAX_TURNS = "240" }
if (-not $env:PR_WATCHER_RUN_TIMEOUT_MIN)   { $env:PR_WATCHER_RUN_TIMEOUT_MIN = "75" }

if ($env:PR_WATCHER_PROMPT_DIR) {
    $PromptDir = (Resolve-Path $env:PR_WATCHER_PROMPT_DIR).Path
} else {
    $PromptDir = Join-Path $RepoRoot "docs\pr-prompts"
}

$banner = @"
============================================================
PR watcher (v2) -- daytime launcher
Started:        $(Get-Date -Format o)
Repo (git):     $RepoRoot
Prompt dir:     $PromptDir
Auto-review:    $($env:PR_WATCHER_AUTO_REVIEW)
Auto-update:    $($env:PR_WATCHER_AUTO_UPDATE)
Auto-merge:     $($env:PR_WATCHER_AUTO_MERGE_POLICY)
Max turns:      $($env:PR_WATCHER_MAX_TURNS)
Run timeout:    $($env:PR_WATCHER_RUN_TIMEOUT_MIN) min
Log file:       $LogFile
============================================================
"@
Write-Log $banner

# --- Run node ---
# Defence in depth (matches start-nightly.ps1):
#   - --no-deprecation silences DEP0190 to keep stderr quiet.
#   - Flip ErrorActionPreference to Continue around the node call so a stray
#     stderr line doesn't take down the wrapper (Stop treats stderr as a
#     terminating native-command error in PS 5.1).
$prevErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    # Tee-Object -FilePath writes UTF-16LE in PS 5.1 -- append UTF-8 per line
    # instead so the log stays single-encoding end to end.
    node --no-deprecation "$RepoRoot\scripts\pr-watcher\index.mjs" 2>&1 | ForEach-Object {
        $line = "$_"
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
        Write-Host $line
    }
    $exit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevErrorActionPreference
}

$footer = "[$(Get-Date -Format o)] Watcher exited with code $exit"
Write-Log $footer

# Exit codes:
#   0 = clean (queue empty or SIGINT)
#   1 = real failure
#   2 = soft halt (usage / rate limit hit)
exit $exit
