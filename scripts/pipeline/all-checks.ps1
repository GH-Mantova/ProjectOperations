param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$sha = gh pr view $PR --json headRefOid -q .headRefOid
Write-Output ("head sha: " + $sha)
Write-Output ""

Write-Output "=== ALL check-runs on that SHA (raw):"
$cr = gh api ("repos/GH-Mantova/ProjectOperations/commits/" + $sha + "/check-runs?per_page=50") | ConvertFrom-Json
foreach ($c in $cr.check_runs) {
    $concl = $c.conclusion
    if (-not $concl) { $concl = "-" }
    Write-Output ("  " + $c.status.PadRight(12) + " " + $concl.PadRight(10) + " " + $c.name)
}

Write-Output ""
Write-Output "=== combined STATUSES on that SHA (legacy status API):"
$st = gh api ("repos/GH-Mantova/ProjectOperations/commits/" + $sha + "/status") | ConvertFrom-Json
Write-Output ("  state: " + $st.state)
foreach ($s in $st.statuses) {
    Write-Output ("  " + $s.state.PadRight(10) + " " + $s.context)
}
