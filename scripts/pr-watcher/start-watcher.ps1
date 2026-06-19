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

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "scripts\pr-watcher\logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log([string]$msg) {
    Add-Content -Path $LogFile -Value $msg
    Write-Host $msg
}

# --- Pre-flight: branch + clean tree ---
# Only TRACKED modified/staged files count as "dirty" -- untracked files (e.g.
# the watcher's own queue of -ready.md prompts under docs/pr-prompts/) must not
# block startup, but tracked changes still poison per-PR branch switches.
$branch = (git branch --show-current).Trim()
$dirty  = (git status --porcelain --untracked-files=no)

if ($branch -ne "main") {
    $msg = "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: current branch is '$branch', expected 'main'. The watcher branch-switches per PR; running from a feature branch poisons it. Switch to main and retry."
    Write-Log $msg
    exit 1
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

$banner = @"
============================================================
PR watcher (v2) -- daytime launcher
Started:        $(Get-Date -Format o)
Auto-review:    $($env:PR_WATCHER_AUTO_REVIEW)
Auto-update:    $($env:PR_WATCHER_AUTO_UPDATE)
Auto-merge:     $($env:PR_WATCHER_AUTO_MERGE_POLICY)
Max turns:      $($env:PR_WATCHER_MAX_TURNS)
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
    node --no-deprecation "$RepoRoot\scripts\pr-watcher\index.mjs" 2>&1 | Tee-Object -FilePath $LogFile -Append
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
