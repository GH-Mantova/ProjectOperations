# #544 is BLOCKED with all 8 checks GREEN. Cause: it RENAMED the CI job.
#
#   main's job name : "PR gates - diff checks (CP-09-13, CP-17, CP-22, CP-23)"
#   #544 renamed to : "PR gates - diff checks (CP-09-13, CP-17, CP-22, CP-23, CP-24, CP-25)"
#
# The branch RULESET requires a status check by its EXACT NAME. Rename the job and the required
# context NEVER REPORTS - so the PR is blocked forever no matter how green it is.
#
# THE LESSON: a required status check is keyed by its NAME. Renaming a CI job is a BREAKING
# change to branch protection. The job name is cosmetic; the gates are what matter.
#
# Fix: restore main's job name, keep CP-24 and CP-25 in the script.
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>$null

$f = ".github\workflows\ci.yml"
$ci = [System.IO.File]::ReadAllText((Join-Path (Get-Location) $f))

# What does main actually call it? Take that string verbatim - do not retype it.
$mainCi = git show origin/main:.github/workflows/ci.yml
$mainName = $null
foreach ($l in $mainCi) {
    if ($l -match '^\s*name:\s*(PR gates.*)$') { $mainName = $Matches[1].Trim(); break }
}
if (-not $mainName) { Write-Output "could not find main's PR-gates job name"; exit 1 }
Write-Output ("main's required check name: " + $mainName)

$ourName = $null
foreach ($l in ($ci -split "`r?`n")) {
    if ($l -match '^\s*name:\s*(PR gates.*)$') { $ourName = $Matches[1].Trim(); break }
}
Write-Output ("#544 currently calls it   : " + $ourName)

if ($ourName -eq $mainName) { Write-Output "already matches - nothing to do."; exit 0 }

$ci = $ci.Replace($ourName, $mainName)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $f), $ci, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "  restored main's job name (gates CP-24/CP-25 remain in pr-gates.mjs)"

# prove the gates themselves survived
$gates = Get-Content "scripts\pr-gates\pr-gates.mjs" -Raw
foreach ($needle in @('"CP-23", "seed-without-migration"', '"CP-24", "sot-purity"', '"CP-25", "failure-honesty"')) {
    if ($gates -match [regex]::Escape($needle)) { Write-Output ("  present: " + $needle) }
    else { Write-Output ("  *** MISSING: " + $needle); exit 1 }
}

if (-not $Execute) { git checkout -- $f 2>$null; Write-Output "DRY RUN - reverted."; exit 0 }

git add $f 2>$null
git commit -m "ci: restore the required PR-gates job name (renaming it breaks the branch ruleset)" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) { Write-Output ("PUSHED " + $head) }
git checkout --detach origin/main --quiet 2>$null
