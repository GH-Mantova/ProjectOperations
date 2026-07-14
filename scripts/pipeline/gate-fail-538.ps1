$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$sha = gh pr view 538 --json headRefOid -q .headRefOid
$cr = gh api ("repos/GH-Mantova/ProjectOperations/commits/" + $sha + "/check-runs?per_page=50") | ConvertFrom-Json
$gate = $null
foreach ($c in $cr.check_runs) { if ($c.name -like "PR gates*") { $gate = $c } }
if (-not $gate) { Write-Output "no gate check-run"; exit 0 }

Write-Output ("gate check: " + $gate.conclusion + "  " + $gate.html_url)
if ($gate.html_url -match "runs/(\d+)/job/(\d+)") {
    $log = gh run view $Matches[1] --job $Matches[2] --log 2>&1
    Write-Output ""
    $hits = $log | Select-String -Pattern "FAIL|PASS|SKIP|##\[error\]"
    foreach ($h in $hits) {
        $s = [string]$h.Line
        $i = $s.LastIndexOf("Z ")
        if ($i -gt 0 -and $i + 2 -lt $s.Length) { $s = $s.Substring($i + 2) }
        Write-Output ("  " + $s)
    }
}
