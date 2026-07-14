# Assess (do NOT resolve) the conflicts on every DIRTY PR, in an ISOLATED worktree.
#
# Never in C:\po-watcher - the watcher has a live agent in that tree. Two writers, one git index.
# That is exactly how the queue got killed (sot/05 LL-38).
#
# Read-only with respect to the PRs: merges are attempted then ABORTED. Nothing is pushed.
# Pure ASCII.

$ErrorActionPreference = "Continue"

$WT = "C:\po-fix"
$SRC = "C:\ProjectOperations2"

# Create the isolated worktree if absent.
if (-not (Test-Path $WT)) {
    Set-Location $SRC
    git fetch origin --quiet
    git worktree add $WT origin/main --detach 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
}

Set-Location $WT
git fetch origin --quiet
git checkout --detach origin/main --quiet 2>&1 | Out-Null
Write-Output ("worktree: " + $WT + "  @ " + (git log --oneline -1))
Write-Output ""

$DIRTY = @(541, 544, 546, 549, 538)

foreach ($n in $DIRTY) {
    $branch = gh pr view $n --json headRefName -q .headRefName 2>$null
    if (-not $branch) { Write-Output ("#" + $n + "  (could not read branch)"); continue }

    Write-Output ("=== #" + $n + "  " + $branch)

    git checkout --detach ("origin/" + $branch) --quiet 2>&1 | Out-Null
    $mergeOut = git merge origin/main --no-commit --no-ff 2>&1

    $unmerged = @(git diff --name-only --diff-filter=U)
    if ($unmerged.Count -eq 0) {
        Write-Output "    NO CONFLICT - just needs a rebase/update-branch."
    } else {
        Write-Output ("    " + $unmerged.Count + " conflicting file(s):")
        foreach ($f in $unmerged) {
            $markers = (Select-String -Path (Join-Path $WT $f) -Pattern "^<<<<<<<" -ErrorAction SilentlyContinue).Count
            Write-Output ("      " + $f + "   (" + $markers + " conflict hunk(s))")
        }
    }

    git merge --abort 2>&1 | Out-Null
    git checkout --detach origin/main --quiet 2>&1 | Out-Null
    Write-Output ""
}

Write-Output "=== Nothing was pushed. Nothing was resolved. Assessment only."
