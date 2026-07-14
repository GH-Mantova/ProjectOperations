param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$checks = gh pr checks $PR --json name,state,link | ConvertFrom-Json
$link = $null
foreach ($c in $checks) {
    if ($c.state -eq "FAILURE" -and $c.name -like "*drift*") { $link = $c.link; break }
}
if (-not $link) { Write-Output "no failing drift check on this PR."; exit 0 }

Write-Output ("link: " + $link)
if ($link -match "runs/(\d+)/job/(\d+)") {
    $runId = $Matches[1]
    $jobId = $Matches[2]
    $status = gh run view $runId --json status -q .status
    Write-Output ("run status: " + $status)
    if ($status -ne "completed") { Write-Output "still running - not a real failure yet."; exit 0 }

    $log = gh run view $runId --job $jobId --log 2>&1
    Write-Output ""
    Write-Output "=== last 25 meaningful lines:"
    $keep = $log | Select-String -Pattern "drift|DRIFT|sha|Wrote|Models|error|Error|##\[error\]|differ|regenerate"
    foreach ($h in ($keep | Select-Object -Last 25)) {
        $s = [string]$h.Line
        $i = $s.LastIndexOf("Z ")
        if ($i -gt 0 -and $i + 2 -lt $s.Length) { $s = $s.Substring($i + 2) }
        Write-Output ("  " + $s)
    }
}
