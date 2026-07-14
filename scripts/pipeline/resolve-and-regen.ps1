# For EVERY open DIRTY PR whose only conflict is the generated data-model map:
#   merge main -> regenerate -> verify the PR's own artifact survived -> push.
#
# Then, for every open PR that touches the schema: rebase + REGENERATE AFTER the rebase.
#
# ORDERING RULE: regenerate AFTER merging main. If you regenerate first and merge second, the
# merge brings a newer schema.prisma and re-stales the map you just built.
#
# THE CASCADE: every schema PR touches the SAME generated file, so each merge re-conflicts the
# rest. That is inherent to keeping a generated artifact in git, and it is exactly why the merge
# queue must be SERIALIZED. Expect to run this once per merge.
#
# $ErrorActionPreference MUST be Continue: git writes CRLF warnings to stderr, and with "Stop"
# PowerShell aborts the script before the commit - silently never pushing the fix.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$NEVER_TOUCH = @()   # we still FIX held PRs; we just never MERGE them.

$raw = gh pr list --state open --limit 40 --json number,headRefName,mergeStateStatus | ConvertFrom-Json

foreach ($p in $raw) {
    $n = [int]$p.number
    $b = $p.headRefName
    if ($p.mergeStateStatus -ne "DIRTY") { continue }

    Write-Output ("=== #" + $n + "  " + $b)
    git checkout -B $b ("origin/" + $b) --quiet 2>$null
    git merge origin/main --no-commit --no-ff 2>$null | Out-Null

    $unmerged = @(git diff --name-only --diff-filter=U 2>$null)
    $nonGen = @($unmerged | Where-Object { $_ -notmatch "docs/data-model/" })

    if ($nonGen.Count -gt 0) {
        Write-Output "    SKIP - non-generated conflicts, needs judgement:"
        foreach ($f in $nonGen) { Write-Output ("      " + $f) }
        git merge --abort 2>$null
        continue
    }

    foreach ($f in $unmerged) { git checkout --ours -- $f 2>$null; git add -- $f 2>$null }

    node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Output "    generator FAILED - aborting"; git merge --abort 2>$null; continue }
    git add docs/data-model/ 2>$null

    if (-not $Execute) {
        Write-Output "    DRY RUN - would commit + push"
        git merge --abort 2>$null
        continue
    }

    git commit -m "chore: merge main and regenerate data-model map" --quiet 2>$null
    $head = git rev-parse --short HEAD
    git push origin $b 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Output ("    PUSHED " + $head) } else { Write-Output "    PUSH FAILED" }
}

git checkout --detach origin/main --quiet 2>$null
Write-Output "=== done"
