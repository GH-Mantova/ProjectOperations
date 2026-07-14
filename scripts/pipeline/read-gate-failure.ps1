param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$checks = gh pr checks $PR --json name,state,link | ConvertFrom-Json
$fail = $null
foreach ($c in $checks) { if ($c.state -in @("FAILURE","ERROR")) { $fail = $c; break } }
if (-not $fail) { Write-Output ("#" + $PR + ": no failing check."); exit 0 }

Write-Output ("=== #" + $PR + "  FAILING: " + $fail.name)
Write-Output ("=== " + $fail.link)
Write-Output ""

# link looks like .../actions/runs/<runId>/job/<jobId>
if ($fail.link -match "runs/(\d+)/job/(\d+)") {
    $runId = $Matches[1]
    $jobId = $Matches[2]
    Write-Output "--- log (gate lines only):"
    $log = gh run view $runId --job $jobId --log 2>&1
    $log | Select-String -Pattern "FAIL|PASS|CP-\d+|GATE-ALLOW|Error|error:" | Select-Object -Last 30 |
        ForEach-Object { Write-Output ("  " + $_.Line) }
} else {
    Write-Output "  (could not parse run/job id from link)"
}
