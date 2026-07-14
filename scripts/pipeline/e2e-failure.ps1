param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$checks = gh pr checks $PR --json name,state,link | ConvertFrom-Json
$link = $null
foreach ($c in $checks) { if ($c.state -eq "FAILURE" -and $c.name -like "*e2e*") { $link = $c.link } }
if (-not $link) { Write-Output "no failing e2e"; exit 0 }

Write-Output ("link: " + $link)
if ($link -match "runs/(\d+)/job/(\d+)") {
    $runId = $Matches[1]; $jobId = $Matches[2]
    $status = gh run view $runId --json status -q .status
    Write-Output ("run status: " + $status)
    if ($status -ne "completed") { Write-Output "STALE - still running."; exit 0 }

    $log = gh run view $runId --job $jobId --log 2>&1
    Write-Output ""
    Write-Output "=== test failures / errors:"
    $keep = $log | Select-String -Pattern "✕|×|failed|Error:|expect\(|Timed out|AssertionError|##\[error\]|passed|Expected"
    foreach ($h in ($keep | Select-Object -Last 30)) {
        $s = [string]$h.Line
        $i = $s.LastIndexOf("Z ")
        if ($i -gt 0 -and $i + 2 -lt $s.Length) { $s = $s.Substring($i + 2) }
        Write-Output ("  " + $s)
    }
}
