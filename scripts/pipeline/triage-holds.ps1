# Triage the HOLD queue. Read-only. Proves which HOLDs are already satisfied.
#
# LESSON (cost 3 runs): do NOT pass `-q '<jq>'` to gh from PowerShell 5.1. PS re-splits
# the quoted expression on spaces and gh sees several args. Ask for raw --json and parse
# with ConvertFrom-Json. And always ASSIGN THEN FOREACH - piping a JSON array straight
# into Where-Object collapses it to ONE object (this is the bug that once let the merge
# queue select #552, the production-data PR).
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output "=== PRs referenced by the shepherd-merge HOLDs"
foreach ($n in 545, 548) {
    $raw = gh pr view $n --json "state,title" 2>&1 | Out-String
    try {
        $o = $raw | ConvertFrom-Json
        Write-Output ("  #" + $n + "  " + $o.state + "  " + $o.title)
    } catch {
        Write-Output ("  #" + $n + "  UNREADABLE: " + $raw.Trim())
    }
}

Write-Output ""
Write-Output "=== open PRs (is there anything left for pr-zzz-resolve-all-dirty-prs?)"
$raw = gh pr list --state open --json "number,mergeable,title" 2>&1 | Out-String
$board = $raw | ConvertFrom-Json
foreach ($p in $board) {
    Write-Output ("  #" + $p.number + "  " + $p.mergeable + "  " + $p.title)
}
Write-Output ("  open count: " + @($board).Count)
