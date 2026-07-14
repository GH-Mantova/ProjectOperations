param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"
$checks = gh pr checks $PR --json name,state,startedAt | ConvertFrom-Json
Write-Output ("=== #" + $PR)
foreach ($c in $checks) {
    Write-Output ("  " + $c.state.PadRight(12) + " " + $c.name)
}
$pr = gh pr view $PR --json mergeStateStatus,autoMergeRequest | ConvertFrom-Json
Write-Output ("  mergeState: " + $pr.mergeStateStatus + " | autoMerge: " + ($null -ne $pr.autoMergeRequest))
