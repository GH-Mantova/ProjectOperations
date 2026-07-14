# Final pass: rebase the remaining PRs onto the settled main, regenerate the data-model map
# AFTER the rebase (ordering matters), and re-arm auto-merge.
#
# Held PRs are rebased too - so Marco can merge them cleanly - but NEVER auto-merged.
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
$NEVER = @(552, 538)

Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$raw = gh pr list --state open --limit 40 --json number,headRefName,mergeStateStatus | ConvertFrom-Json

foreach ($p in $raw) {
    $n = [int]$p.number
    $b = $p.headRefName
    $held = ($NEVER -contains $n)

    Write-Output ("=== #" + $n + "  " + $b + $(if ($held) { "   [HELD - will not auto-merge]" } else { "" }))

    if (-not $Execute) { Write-Output "    DRY RUN"; continue }

    # 1. bring the branch up to date with main
    git checkout -B $b ("origin/" + $b) --quiet 2>$null
    git merge origin/main --no-edit 2>$null | Out-Null

    $unmerged = @(git diff --name-only --diff-filter=U 2>$null)
    if ($unmerged.Count -gt 0) {
        $nonGen = @($unmerged | Where-Object { $_ -notmatch "docs/data-model/" })
        if ($nonGen.Count -gt 0) {
            Write-Output "    CONFLICT needing judgement:"
            foreach ($f in $nonGen) { Write-Output ("      " + $f) }
            git merge --abort 2>$null
            continue
        }
        foreach ($f in $unmerged) { git checkout --ours -- $f 2>$null; git add -- $f 2>$null }
    }

    # 2. regenerate AFTER the merge (this is the ordering that matters)
    node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
    git add docs/data-model/ 2>$null

    # 3. commit only if anything actually changed
    $staged = git diff --cached --name-only 2>$null
    if ($staged -or (Test-Path ".git\MERGE_HEAD")) {
        git commit -m "chore: merge main and regenerate data-model map" --quiet 2>$null
        $head = git rev-parse --short HEAD
        git push origin $b 2>$null
        if ($LASTEXITCODE -eq 0) { Write-Output ("    PUSHED " + $head) } else { Write-Output "    push failed" }
    } else {
        Write-Output "    already up to date with main"
    }

    # 4. re-arm auto-merge (never for held)
    if (-not $held) {
        gh pr merge $n --squash --auto --delete-branch 2>$null | Out-Null
        Write-Output "    auto-merge armed"
    }
}

git checkout --detach origin/main --quiet 2>$null
Write-Output "=== done"
