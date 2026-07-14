# Commit Marco's uncommitted sot/ edits as a doc-reconcile PR.
#
# WHY FROM MARCO'S TREE: these edits exist ONLY in C:\ProjectOperations2. The watcher's clone
# cannot see them - which is why the HOLD prompt for this work could never have run headlessly.
#
# WHY A BRANCH AT HEAD (not a fresh checkout of origin/main): creating a branch at the CURRENT
# commit moves no files, so the working tree is never disturbed. We rebase onto origin/main
# AFTERWARDS, in the isolated worktree, where a conflict is safe to resolve.
#
# NO PATCH FILE. An earlier attempt wrote the diff with -Encoding ascii, which would have
# mangled every em-dash in sot/ - manufacturing the exact corruption class that blocked #544.
#
# CP-24: sot-purity. This commit must contain sot/** and NOTHING else.
$ErrorActionPreference = "Continue"
Set-Location "C:\ProjectOperations2"

$branch = "docs/sot-reconcile-2026-07-14"

Write-Output "=== starting point"
$startBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Output ("  on branch: " + $startBranch)
if ($startBranch -ne "main") {
    Write-Output "  REFUSING: expected to start from main. Aborting so nothing is disturbed."
    exit 1
}

Write-Output ""
Write-Output "=== create branch at HEAD (moves no files)"
git switch -c $branch 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$now = (git rev-parse --abbrev-ref HEAD).Trim()
if ($now -ne $branch) {
    Write-Output ("  FAILED to switch. On: " + $now + ". Aborting.")
    exit 1
}
Write-Output ("  READBACK: on " + $now)

Write-Output ""
Write-Output "=== stage sot/ ONLY"
git add sot/
$staged = @(git diff --cached --name-only)
foreach ($s in $staged) { Write-Output ("  staged: " + $s) }

# CP-24 sot-purity: assert nothing outside sot/ crept in.
$bad = @($staged | Where-Object { $_ -notlike "sot/*" })
if ($bad.Count -gt 0) {
    Write-Output "  CP-24 VIOLATION - non-sot files staged:"
    foreach ($b in $bad) { Write-Output ("    " + $b) }
    git reset | Out-Null
    git switch main | Out-Null
    exit 1
}
if ($staged.Count -eq 0) {
    Write-Output "  nothing staged - no sot/ changes. Aborting."
    git switch main | Out-Null
    exit 1
}
Write-Output ("  CP-24 OK: " + $staged.Count + " file(s), all under sot/")

Write-Output ""
Write-Output "=== commit"
git commit -q -m "docs(sot): retire chat routing, add boot sequence + concurrency rules, LL-36/37/38" -m "Doc-reconcile PR. sot/ only (CP-24 sot-purity)." 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$sha = (git rev-parse --short HEAD).Trim()
Write-Output ("  READBACK: committed " + $sha)

Write-Output ""
Write-Output "=== return Marco's tree to main (his edits are now safe on the branch)"
git switch main 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$back = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Output ("  READBACK: back on " + $back)

Write-Output ""
Write-Output ("=== branch " + $branch + " holds the sot/ edits at " + $sha)
Write-Output "    next: rebase it onto origin/main in the isolated worktree, then open the PR."
