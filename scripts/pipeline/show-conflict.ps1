param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet

$branch = gh pr view $PR --json headRefName -q .headRefName
git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null
git merge origin/main --no-commit --no-ff 2>&1 | Out-Null

$unmerged = @(git diff --name-only --diff-filter=U)
Write-Output ("=== #" + $PR + "  " + $branch + "  -- " + $unmerged.Count + " conflicting file(s)")
Write-Output ""

foreach ($f in $unmerged) {
    Write-Output ("########## " + $f)
    $lines = Get-Content (Join-Path "C:\po-fix" $f)
    $inConflict = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $l = $lines[$i]
        if ($l -match "^<<<<<<<") { $inConflict = $true }
        if ($inConflict) { Write-Output ("  " + ($i + 1).ToString().PadLeft(4) + " | " + $l) }
        if ($l -match "^>>>>>>>") { $inConflict = $false; Write-Output "" }
    }
}

git merge --abort 2>&1 | Out-Null
git checkout --detach origin/main --quiet 2>&1 | Out-Null
Write-Output "=== aborted. nothing changed."
