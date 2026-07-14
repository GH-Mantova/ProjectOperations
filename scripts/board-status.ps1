# Live board. Read-only. Pure ASCII.
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"
git fetch origin --quiet 2>$null

$prs = gh pr list --state open --limit 40 --json number,title,mergeStateStatus,headRefName,isDraft | ConvertFrom-Json
Write-Output ("OPEN PRs: " + $prs.Count)
Write-Output ""

$rows = foreach ($p in ($prs | Sort-Object number)) {
    $t = $p.title
    if ($t.Length -gt 46) { $t = $t.Substring(0, 46) }
    [pscustomobject]@{
        PR     = $p.number
        State  = $p.mergeStateStatus
        Draft  = $p.isDraft
        Branch = $p.headRefName
        Title  = $t
    }
}
$rows | Format-Table -AutoSize | Out-String -Width 170 | Write-Output

$dirty = @($prs | Where-Object { $_.mergeStateStatus -eq "DIRTY" })
$clean = @($prs | Where-Object { $_.mergeStateStatus -eq "CLEAN" })
$behind = @($prs | Where-Object { $_.mergeStateStatus -eq "BEHIND" })
$blocked = @($prs | Where-Object { $_.mergeStateStatus -eq "BLOCKED" })

Write-Output ("DIRTY (conflict, CI frozen): " + $dirty.Count + "  -> " + (($dirty | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ("BEHIND (just needs rebase):  " + $behind.Count + "  -> " + (($behind | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ("BLOCKED (checks/review):     " + $blocked.Count + "  -> " + (($blocked | ForEach-Object { "#" + $_.number }) -join " "))
Write-Output ("CLEAN (mergeable now):       " + $clean.Count + "  -> " + (($clean | ForEach-Object { "#" + $_.number }) -join " "))
