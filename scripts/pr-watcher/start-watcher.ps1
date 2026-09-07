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

# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---
# A dirty tracked tree used to be a hard PRE-FLIGHT FAIL (exit 1). The supervisor
# restarts on exit 1, so that turned into an infinite 60-second crash loop that ate
# the whole queue for hours -- three times (2026-07-07 13:36, 2026-07-14 07:43,
# 2026-07-14 16:09) -- and nobody diagnosed it, because the reason only ever landed
# in the clone's daily log.
#
# Nothing is destroyed: we 'git stash push --include-untracked' with a labelled
# message, which is fully reversible ('git stash apply'). We deliberately do NOT
# 'git reset --hard'. If the stash itself fails we fall back to the old behaviour
# and exit 1, because at that point we genuinely cannot make the tree safe.
if ($dirty) {
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: uncommitted TRACKED changes on branch '$branch'. Self-healing by stashing them (nothing is discarded)."
    Write-Log "git status --porcelain --untracked-files=no:"
    Write-Log $dirty

    $stashLabel = "watcher-preflight-autostash on '$branch' at $(Get-Date -Format o)"
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    git stash push --include-untracked -m $stashLabel 2>&1 | ForEach-Object {
        Add-Content -Path $LogFile -Value "$_" -Encoding UTF8
        Write-Host "$_"
    }
    $stashExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    if ($stashExit -ne 0) {
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: 'git stash push' exited $stashExit; cannot make the tree safe. Commit or stash by hand, then retry."
        exit 1
    }

    # Read back (LL: 'the command exited 0' is not proof). The tree must now be clean.
    $dirty = (git status --porcelain --untracked-files=no)
    if ($dirty) {
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: tree is STILL dirty after 'git stash push'. Refusing to start."
        Write-Log $dirty
        exit 1
    }

    $stashTop = (git stash list --max-count=1 | Select-Object -First 1)
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: SELF-HEALED. Your work is NOT lost -- it is stashed, not deleted."
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: stash entry: $stashTop"
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: RECOVER WITH:  git -C `"$RepoRoot`" stash list   then   git -C `"$RepoRoot`" stash apply stash@{0}"
}

if ($branch -ne "main") {
    # Clean tree parked on a stray feature branch -- a build/smoke/worktree op left the
    # main working tree switched (recurring hazard). Auto-recover to main so the
    # supervisor does not loop forever on preflight and the prompt queue keeps draining.
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: on '$branch' but tree is clean; auto-checkout main to recover."
    # LL-23: 'git checkout main' writes "Switched to branch 'main'" to stderr on
    # success. Under $ErrorActionPreference='Stop' PS 5.1 turns that benign
    # stderr line into a terminating NativeCommandError and the launcher dies
    # (exit 1) even though recovery worked. Flip to Continue around the call
    # and rely on $LASTEXITCODE to detect a real failure.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    git checkout main 2>&1 | ForEach-Object { Add-Content -Path $LogFile -Value "$_" -Encoding UTF8; Write-Host "$_" }
    $checkoutExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($checkoutExit -ne 0) {
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: 'git checkout main' exited $checkoutExit."
        exit 1
    }
    $branch = (git branch --show-current).Trim()
    if ($branch -ne "main") {
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: auto-checkout to main did not take (still on '$branch'). Manual fix needed."
        exit 1
    }
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT: recovered to main."
}

# Final assertion: whatever path we took above, the tree the watcher is about to
# drive must be clean and on main. Re-read rather than trusting $dirty/$branch.
$dirty  = (git status --porcelain --untracked-files=no)
$branch = (git branch --show-current).Trim()
if ($dirty -or $branch -ne "main") {
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: post-recovery check failed -- branch='$branch' (want main), dirty tracked files present: $([bool]$dirty). Commit, stash, or clean before starting the watcher (dirty trees poison per-PR branch switches)."
    if ($dirty) { Write-Log $dirty }
    exit 1
}

# --- Single-instance guard ---
$existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match ([regex]::Escape((Join-Path $RepoRoot "scripts\pr-watcher\index.mjs"))) }
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

# --- App identity (WATCHER_APP_AUTH_V1) -- OPTIONAL, and OFF until Marco configures it ---
#
# scripts/pr-watcher/app-auth.mjs reads exactly three environment variables:
#
#   PO_WATCHER_APP_ID           the GitHub App's numeric id       (a public identifier)
#   PO_WATCHER_INSTALLATION_ID  the installation's numeric id     (a public identifier)
#   PO_WATCHER_APP_KEY          a filesystem PATH to the private-key .pem
#
# None of those three values is itself a secret. The FILE that PO_WATCHER_APP_KEY
# names is, and it must never exist inside any working tree -- a key committed once
# is a key rotated forever. Nothing in this script reads that file; it only checks
# that it exists.
#
# The two ids are not hard-coded here either. They are machine-and-account facts, so
# they live beside the key path in a machine-local config that is NOT in this
# repository and never will be:
#
#   C:\po-secrets\watcher-app-auth.ps1
#
# That file is Marco's to write (docs/runbooks/watcher-identity-github-app.md, PART 1
# step 5). No agent can create it, and this PR does not create it.
# It is dot-sourced, i.e. EXECUTED, so it must contain the three $env: assignments and
# nothing else.
#
# ABSENT FILE => nothing is set => index.mjs's APP_AUTH_ENABLED is false => the watcher
# behaves EXACTLY as it did before this block existed, running as ambient GH-Mantova.
# That silence is deliberate and load-bearing: CI, a fresh clone and any second machine
# have no key, and making App auth mandatory would fail the watcher closed on every one
# of them. This block is additive, not a migration.
$AppAuthConfig = "C:\po-secrets\watcher-app-auth.ps1"
$AppAuthConfigLoaded = $false
if (Test-Path -LiteralPath $AppAuthConfig) {
    try {
        . $AppAuthConfig
        $AppAuthConfigLoaded = $true
    } catch {
        Write-Log "[$(Get-Date -Format o)] app-auth: '$AppAuthConfig' exists but could not be loaded. It must contain only the three PO_WATCHER_* assignments."
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: app-auth config failed to load: $($_.Exception.Message)"
        exit 1
    }
}

# --- Half-configured App auth is a LOUD failure, never a silent downgrade ---
#
# index.mjs keys APP_AUTH_ENABLED on PO_WATCHER_APP_KEY ALONE. So a config that sets
# the two ids but not the key path leaves App auth OFF, and the watcher goes on
# labelling and merging as ambient GH-Mantova while the operator believes the switch
# is on. node cannot catch that case: by the time it runs, "the variable was never
# set" and "the variable was meant to be set and isn't" look identical. This wrapper
# is the only place that can tell them apart, so it does.
#
# The existence of the config file is itself a declaration of intent, so it counts as
# "App auth was wanted here" even if the file sets nothing at all (a typo'd variable
# name, a commented-out line). Otherwise that case would be the one remaining silent
# downgrade: a file present, the operator satisfied, and the watcher merging as
# GH-Mantova anyway.
#
#   config file absent AND nothing set  -> OFF, byte-for-byte today's behaviour
#   wanted AND all three set            -> hand off to node, which mints the token and
#                                          fails CLOSED itself if the key is rejected
#   wanted AND anything missing         -> REFUSE, because that is precisely the state
#                                          in which the audit trail lies about who acted
$AppAuthSet     = @()
$AppAuthMissing = @()
foreach ($AppAuthVar in @("PO_WATCHER_APP_ID", "PO_WATCHER_INSTALLATION_ID", "PO_WATCHER_APP_KEY")) {
    $AppAuthValue = [Environment]::GetEnvironmentVariable($AppAuthVar, "Process")
    if ([string]::IsNullOrWhiteSpace($AppAuthValue)) {
        $AppAuthMissing += $AppAuthVar
    } else {
        $AppAuthSet += $AppAuthVar
    }
}

$AppAuthWanted = ($AppAuthConfigLoaded -or $AppAuthSet.Count -gt 0)

if ($AppAuthWanted -and $AppAuthMissing.Count -gt 0) {
    $AppAuthSetLabel = if ($AppAuthSet.Count -gt 0) { $AppAuthSet -join ', ' } else { "(none)" }
    Write-Log "[$(Get-Date -Format o)] app-auth: config loaded = $AppAuthConfigLoaded; set = $AppAuthSetLabel; missing = $($AppAuthMissing -join ', ')."
    Write-Log "[$(Get-Date -Format o)] app-auth: fix '$AppAuthConfig' so it sets all three, or rename it away to go back to ambient auth. Runbook: docs/runbooks/watcher-identity-github-app.md"
    Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: app-auth is HALF-CONFIGURED (missing: $($AppAuthMissing -join ', ')). Refusing to start, because a half-configured watcher merges as ambient GH-Mantova while looking switched on."
    exit 1
}

$AppAuthOn = ($AppAuthSet.Count -eq 3)

if ($AppAuthOn) {
    # Existence check ONLY. This script never opens the key, never prints its contents,
    # and prints only its basename -- the same redaction app-auth.mjs applies to its own
    # error messages. Catching a missing key here turns node's later failed-closed exit
    # into a diagnosis the operator can act on without reading a stack.
    $AppAuthKeyPresent = $false
    try {
        $AppAuthKeyPresent = Test-Path -LiteralPath $env:PO_WATCHER_APP_KEY -PathType Leaf
    } catch {
        $AppAuthKeyPresent = $false
    }
    if (-not $AppAuthKeyPresent) {
        $AppAuthKeyName = ($env:PO_WATCHER_APP_KEY -replace '^.*[\\/]', '')
        Write-Log "[$(Get-Date -Format o)] app-auth: PO_WATCHER_APP_KEY is set but names no readable file. Correct the path in '$AppAuthConfig'."
        Write-Log "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: app-auth private key not found ($AppAuthKeyName). Refusing to start rather than falling back to ambient GH-Mantova."
        exit 1
    }
}

# Banner text. "configured" means the three variables are present and the key file
# exists -- it is NOT proof that auth is live. Only node can prove that, by logging
# "app-auth:    gh[installation] (projectops-watcher[bot], WATCHER_APP_AUTH_V1)"
# a few lines further down the same log.
$AppAuthBanner = if ($AppAuthOn) {
    "configured (App id $($env:PO_WATCHER_APP_ID), installation $($env:PO_WATCHER_INSTALLATION_ID)) -- see node's app-auth line below"
} else {
    "OFF - ambient GH-Mantova"
}

if ($env:PR_WATCHER_PROMPT_DIR) {
    $PromptDir = (Resolve-Path $env:PR_WATCHER_PROMPT_DIR).Path
} else {
    # The QUEUE always lives in the MAIN interactive tree, never the clone (LL-35).
    # Deriving it from $RepoRoot (the clone) silently strands every armed prompt that
    # was staged in the main tree, so default to the main tree explicitly.
    $PromptDir = "C:\ProjectOperations2\docs\pr-prompts"
}

# Guardrail: the queue must NOT resolve to inside the clone / $RepoRoot. If it does, the
# armed prompts staged in the main tree are invisible and the watcher runs a stale clone
# queue instead. Refuse loudly rather than silently draining the wrong folder.
if ($PromptDir.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "REFUSE: prompt dir '$PromptDir' is inside the clone '$RepoRoot'. The queue must be the main tree C:\ProjectOperations2\docs\pr-prompts. Unset PR_WATCHER_PROMPT_DIR (it will default correctly) or point it at the main tree."
    exit 1
}
if (-not (Test-Path $PromptDir)) {
    Write-Host "REFUSE: prompt dir '$PromptDir' does not exist. Cannot start the watcher against a missing queue."
    exit 1
}

$banner = @"
============================================================
PR watcher (v2) -- daytime launcher
Started:        $(Get-Date -Format o)
Repo (git):     $RepoRoot
Prompt dir:     $PromptDir
App auth:       $AppAuthBanner
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

# 2026-08-18: normalize to the documented protocol before both the footer AND
# the exit. Node can exit with values outside the {0,1,2} set (e.g. -1 when a
# Stop-Process kill terminates it, which is what the heartbeat watchdog does),
# and `powershell -File` does not reliably propagate negatives or large codes
# to its caller. Without this normalization the child's footer log ("Watcher
# exited with code -1") disagreed with the supervisor's log ("exit 0") for the
# same event, 0.2s apart -- the DOCTRINE 7.1 lie the 2026-08-18 incident quote
# called out. One event, one authoritative code, both places.
$rawExit = $exit
if ($exit -ne 0 -and $exit -ne 2) { $exit = 1 }

$footer = if ($exit -eq $rawExit) {
    "[$(Get-Date -Format o)] Watcher exited with code $exit"
} else {
    "[$(Get-Date -Format o)] Watcher exited with code $exit (raw node exit: $rawExit)"
}
Write-Log $footer

# Exit codes:
#   0 = clean (queue empty or SIGINT)
#   1 = real failure (also: any non-{0,2} node exit, normalized above)
#   2 = soft halt (usage / rate limit hit)
exit $exit
