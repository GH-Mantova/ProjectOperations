$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output "=== recent tendering-e2e runs (is it progressing, hung, or flaking?)"
$runs = gh run list --workflow "Tendering Browser Smoke" --limit 8 --json databaseId,status,conclusion,createdAt,headBranch | ConvertFrom-Json
foreach ($r in $runs) {
    $age = [math]::Round(((Get-Date) - [datetime]$r.createdAt).TotalMinutes, 0)
    $concl = $r.conclusion
    if (-not $concl) { $concl = "-" }
    Write-Output ("  " + ([string]$r.databaseId).PadRight(12) + " " + $r.status.PadRight(12) + " " + $concl.PadRight(10) + " " + $age.ToString().PadLeft(3) + "m  " + $r.headBranch)
}
