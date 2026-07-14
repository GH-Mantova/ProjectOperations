$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output "=== merging #544"
$out = gh pr merge 544 --squash --delete-branch 2>&1
foreach ($l in $out) { Write-Output ("  " + $l) }

Write-Output ""
Write-Output "=== board now:"
$raw = gh pr list --state open --limit 20 --json number,mergeStateStatus | ConvertFrom-Json
foreach ($p in $raw) { Write-Output ("  #" + $p.number + "  " + $p.mergeStateStatus) }
