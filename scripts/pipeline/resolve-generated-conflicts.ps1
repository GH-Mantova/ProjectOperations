# Resolve the DIRTY PRs whose ONLY conflict is in a GENERATED artifact.
#
# DOCTRINE 1: never hand-merge a generated file - REGENERATE it.
# Hand-editing docs/data-model/relationship-map.* is precisely how the CRLF schema-hash
# incident happened. Take either side, re-run the generator, commit the true output.
#
# DOCTRINE 2: never delete the point of the PR. We grep for the PR's own artifact afterwards
# and refuse to push if it vanished.
#
# Runs in C:\po-fix - an ISOLATED worktree. NEVER in C:\po-watcher (a live agent works there).
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
$WT = "C:\po-fix"

# PR -> (branch, an artifact that MUST still exist after the merge)
$TARGETS = @(
    @{ n = 541; artifact = "TenderEstimate" },
    @{ n = 546; artifact = "permissions" },
    @{ n = 549; artifact = "CompanyProfile" }
)

Set-Location $WT
git fetch origin --quiet

foreach ($t in $TARGETS) {
    $n = $t.n

    # Skip anything already merged/closed. Pushing to a merged PR's branch RECREATES a dangling
    # remote branch - harmless but messy, and it means the target list has gone stale.
    $state = gh pr view $n --json state -q .state 2>$null
    if ($state -ne "OPEN") {
        Write-Output ("=== #" + $n + "  SKIP - already " + $state)
        Write-Output ""
        continue
    }

    $branch = gh pr view $n --json headRefName -q .headRefName
    Write-Output ("=== #" + $n + "  " + $branch)

    git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null
    git merge origin/main --no-commit --no-ff 2>&1 | Out-Null

    $unmerged = @(git diff --name-only --diff-filter=U)
    $nonGenerated = @($unmerged | Where-Object { $_ -notmatch "docs/data-model/relationship-map" })

    if ($nonGenerated.Count -gt 0) {
        Write-Output "    SKIP - has NON-generated conflicts, needs real judgement:"
        foreach ($f in $nonGenerated) { Write-Output ("      " + $f) }
        git merge --abort 2>&1 | Out-Null
        Write-Output ""
        continue
    }

    Write-Output ("    " + $unmerged.Count + " generated file(s) conflicting -> REGENERATING, not hand-merging.")

    # Take our side to get a clean tree, then let the generator produce the truth.
    foreach ($f in $unmerged) { git checkout --ours -- $f 2>&1 | Out-Null; git add -- $f 2>&1 | Out-Null }

    $gen = node scripts/data-model/build-relationship-map.mjs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Output "    GENERATOR FAILED - aborting this PR, touching nothing:"
        $gen | ForEach-Object { Write-Output ("      " + $_) }
        git merge --abort 2>&1 | Out-Null
        Write-Output ""
        continue
    }
    git add docs/data-model/ 2>&1 | Out-Null

    # DOCTRINE 2 - prove the PR's own contribution survived.
    $hits = (git grep -c $t.artifact -- apps/ 2>$null | Measure-Object).Count
    if ($hits -eq 0) {
        Write-Output ("    REFUSING TO PUSH - '" + $t.artifact + "' is GONE from apps/ after the merge.")
        Write-Output "    Never delete the point of the PR. Aborting."
        git merge --abort 2>&1 | Out-Null
        Write-Output ""
        continue
    }
    Write-Output ("    verified: '" + $t.artifact + "' still present in apps/ (" + $hits + " file(s))")

    if (-not $Execute) {
        Write-Output "    DRY RUN - would commit + push"
        git merge --abort 2>&1 | Out-Null
        Write-Output ""
        continue
    }

    git commit -m ("chore: merge main and regenerate data-model map (resolve conflict for #" + $n + ")") --quiet 2>&1 | Out-Null
    git push origin $branch 2>&1 | ForEach-Object { Write-Output ("    " + $_) }
    Write-Output ("    PUSHED - #" + $n + " conflict resolved. CI can finally run on it.")
    Write-Output ""
}

git checkout --detach origin/main --quiet 2>&1 | Out-Null
Write-Output "=== done"
