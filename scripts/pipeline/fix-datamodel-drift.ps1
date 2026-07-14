# Regenerate the data-model map on a branch whose drift check is failing.
#
# ORDERING RULE (I got this wrong once): regenerate AFTER the final rebase.
# If you regenerate and THEN `gh pr update-branch`, the merge brings a newer schema.prisma and
# re-stales the map you just built. Rebase first, regenerate second, push.
#
# ERRORACTIONPREFERENCE: must be "Continue".
# git writes harmless CRLF warnings to STDERR. With "Stop", PowerShell treats those as TERMINATING
# errors and aborts the script BEFORE the commit - so the regenerated map is silently never pushed,
# and CI keeps failing with the same drift error. That cost a full cycle.
#
# NEVER hand-edit the map. Run the generator. (Hand-editing it is how the CRLF hash incident happened.)
# Pure ASCII.

param([int]$PR, [switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = gh pr view $PR --json headRefName -q .headRefName
Write-Output ("=== #" + $PR + "  " + $branch)

git checkout -B $branch ("origin/" + $branch) --quiet 2>$null

node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output "  generator FAILED"; exit 1 }

$changed = git status --short -- docs/data-model/ 2>$null
if (-not $changed) {
    Write-Output "  map already in sync - drift has another cause. Read the log."
    exit 0
}

Write-Output "  map was stale. Regenerated:"
foreach ($f in $changed) { Write-Output ("    " + $f) }

if (-not $Execute) {
    git checkout -- docs/data-model/ 2>$null
    Write-Output "  DRY RUN - reverted."
    exit 0
}

git add docs/data-model/ 2>$null
git commit -m "chore: regenerate data-model relationship map after merging main" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Output ("  PUSHED " + $head + " - drift check will re-run.")
} else {
    Write-Output "  PUSH FAILED."
}
git checkout --detach origin/main --quiet 2>$null
