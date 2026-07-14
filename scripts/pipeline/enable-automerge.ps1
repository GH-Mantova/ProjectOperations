# Enable GitHub AUTO-MERGE on every safe, non-conflicted PR.
#
# WHY --auto AND NOT A POLLING LOOP:
#   My hand-rolled loop polled `gh pr checks`, saw all-green, and tried to merge - while
#   `tendering-e2e` had not yet been QUEUED. It got refused. That is a race in the gate itself.
#   `--auto` hands the waiting to GitHub: it merges the instant every requirement is met, and it
#   serialises merges for us. No polling, no race, no abort-on-BEHIND.
#
# NEVER list is enforced TWICE: at selection, and again immediately before the irreversible call.
# A selection filter is always one bug away from being wrong - and mine WAS
# (PS 5.1 ConvertFrom-Json pipes an array as ONE object, silently voiding the filter).
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

#   552 = writes production data (INSERTs rate rows) -> Marco reviews the SQL himself
#   538 = needs a real Microsoft account on a real shared PC -> no agent can smoke it
$NEVER = @(552, 538)

function Assert-Mergeable([int]$n) {
    if ($NEVER -contains $n) {
        throw ("REFUSING #" + $n + " - NEVER list (production data / human smoke required).")
    }
}

# ASSIGN then foreach. Never pipe ConvertFrom-Json into Where-Object (see header).
$raw = gh pr list --state open --limit 40 --json number,title,mergeStateStatus | ConvertFrom-Json

$safe = @()
$dirty = @()
$held = @()

foreach ($p in $raw) {
    $n = [int]$p.number
    if ($NEVER -contains $n) { $held += $p; continue }
    if ($p.mergeStateStatus -eq "DIRTY") { $dirty += $p; continue }
    $safe += $p
}

Write-Output "=== AUTO-MERGE ENABLEMENT"
Write-Output ""
Write-Output ("HELD (never auto-merge)  : " + (($held  | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ("DIRTY (needs conflict fix): " + (($dirty | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ("SAFE  (enable auto-merge) : " + (($safe  | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ""

foreach ($p in ($safe | Sort-Object { [int]$_.number })) {
    $n = [int]$p.number
    Assert-Mergeable $n
    Write-Output ("--- #" + $n + " [" + $p.mergeStateStatus + "] " + $p.title)

    if (-not $Execute) { Write-Output "    DRY RUN - would enable auto-merge"; continue }

    # If it is behind, bring it up to date first. BEHIND is not a failure - it is a rebase.
    if ($p.mergeStateStatus -in @("BEHIND", "BLOCKED")) {
        gh pr update-branch $n 2>&1 | ForEach-Object { Write-Output ("    " + $_) }
    }

    Assert-Mergeable $n   # last line of defence, immediately before the irreversible call
    $out = gh pr merge $n --squash --auto --delete-branch 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output "    AUTO-MERGE ENABLED - GitHub will merge it as soon as checks pass."
    } else {
        $out | ForEach-Object { Write-Output ("    " + $_) }
    }
}

Write-Output ""
Write-Output "=== Nothing more to do here. GitHub merges each PR as its checks go green."
Write-Output "=== The 5 DIRTY PRs still need conflict resolution in a worktree."
