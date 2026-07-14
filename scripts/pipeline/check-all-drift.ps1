# Is the data-model map stale on ANY open PR? Report only. Pure ASCII.
$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$raw = gh pr list --state open --limit 40 --json number,headRefName | ConvertFrom-Json

foreach ($p in $raw) {
    $n = [int]$p.number
    $b = $p.headRefName

    # Does this PR even touch the schema?
    $touches = git diff --name-only origin/main ("origin/" + $b) -- apps/api/prisma/schema.prisma 2>$null
    if (-not $touches) { Write-Output ("#" + $n + "  (no schema change)"); continue }

    git checkout -B ("chk" + $n) ("origin/" + $b) --quiet 2>$null
    node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
    $changed = git status --short -- docs/data-model/ 2>$null

    if ($changed) {
        Write-Output ("#" + $n + "  *** MAP IS STALE - drift check will FAIL")
    } else {
        Write-Output ("#" + $n + "  map in sync")
    }
    git checkout -- docs/data-model/ 2>$null
}

git checkout --detach origin/main --quiet 2>$null
