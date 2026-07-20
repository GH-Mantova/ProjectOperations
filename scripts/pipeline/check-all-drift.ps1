# Is the data-model map stale on ANY open PR? Report only. Pure ASCII.
$ErrorActionPreference = "Continue"

# Resolve the repo directory instead of assuming one. A bare Set-Location to a missing path
# does NOT stop this script (ErrorActionPreference is "Continue") - it falls through and runs
# every git/gh call below against the caller's directory, then prints a report that looks
# authoritative. A checker that cannot locate its repo must refuse to run, not guess.
$repoCandidates = @("C:\po-watcher\ProjectOperations", "C:\ProjectOperations2")
$repoDir = $null
foreach ($candidate in $repoCandidates) {
    if (Test-Path $candidate) { $repoDir = $candidate; break }
}
if (-not $repoDir) {
    Write-Host "FATAL: no repo directory found. Tried: C:\po-watcher\ProjectOperations, C:\ProjectOperations2"
    exit 1
}
Set-Location $repoDir
if ((Get-Location).Path -ne $repoDir) {
    Write-Host ("FATAL: Set-Location to " + $repoDir + " did not take; now at " + (Get-Location).Path)
    exit 1
}

git fetch origin --quiet 2>$null

$raw = gh pr list --state open --limit 40 --json number,headRefName | ConvertFrom-Json

foreach ($p in $raw) {
    $n = [int]$p.number
    $b = $p.headRefName

    # Does this PR even touch the schema?
    $touches = git diff --name-only origin/main ("origin/" + $b) -- apps/api/prisma/schema.prisma 2>$null
    if (-not $touches) { Write-Output ("#" + $n + "  (no schema change)"); continue }

    git checkout -B ("chk" + $n) ("origin/" + $b) --quiet 2>$null
    node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
    $changed = git status --short -- docs/data-model/ 2>$null

    if ($changed) {
        Write-Output ("#" + $n + "  *** MAP IS STALE - drift check will FAIL")
    } else {
        Write-Output ("#" + $n + "  map in sync")
    }
    git checkout -- docs/data-model/ 2>$null
}

git checkout --detach origin/main --quiet 2>$null
