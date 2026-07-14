# #544: restore .github/workflows/ci.yml to main's version, BYTE-FOR-BYTE, via git.
#
# WHAT I BROKE (2026-07-14):
#   fix-544-jobname.ps1 read main's ci.yml through PowerShell (`git show | ...`), which decoded
#   the UTF-8 EM DASHES incorrectly, then wrote the file back as UTF-8 - DOUBLE-ENCODING them.
#   The job names "API - lint, test, compliance smoke" and "Web - lint, logic tests, build" no
#   longer byte-matched the ruleset's required contexts, so GitHub reported:
#       "2 of 4 required status checks are expected"
#   ...while every check on the PR was green. A required status check is matched by its EXACT
#   NAME - and a mangled character is a different name.
#
# THE RULE: never round-trip a file through a shell's string encoding when only git needs to
#   move it. `git checkout <ref> -- <path>` copies BYTES. PowerShell copies its GUESS at the text.
#
# #544 does not need ci.yml at all: CP-24 and CP-25 live in scripts/pr-gates/pr-gates.mjs and run
# under main's existing job name.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>$null

# BYTES, not text.
git checkout origin/main -- .github/workflows/ci.yml 2>$null

$diff = git diff --cached --name-only 2>$null
if (-not $diff) {
    $diff = git status --short -- .github/workflows/ci.yml 2>$null
}
if (-not $diff) { Write-Output "ci.yml already identical to main - nothing to do."; exit 0 }

Write-Output "restored ci.yml from main (byte-for-byte)."

# Prove #544 no longer differs from main on ci.yml.
$still = git diff origin/main -- .github/workflows/ci.yml 2>$null
if ($still) { Write-Output "  *** ci.yml STILL differs from main - aborting."; git checkout HEAD -- .github/workflows/ci.yml 2>$null; exit 1 }
Write-Output "  verified: ci.yml is now identical to main."

# Prove the gates still exist (they live in pr-gates.mjs, not the workflow).
$gates = Get-Content "scripts\pr-gates\pr-gates.mjs" -Raw
foreach ($needle in @('"CP-23", "seed-without-migration"', '"CP-24", "sot-purity"', '"CP-25", "failure-honesty"')) {
    if ($gates -match [regex]::Escape($needle)) { Write-Output ("  present: " + $needle) }
    else { Write-Output ("  *** MISSING: " + $needle); exit 1 }
}

if (-not $Execute) { git checkout HEAD -- .github/workflows/ci.yml 2>$null; Write-Output "DRY RUN - reverted."; exit 0 }

git add .github/workflows/ci.yml 2>$null
git commit -m "ci: restore ci.yml from main verbatim (a shell round-trip had double-encoded the em dashes in the required job names, so 2 required checks never matched)" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) { Write-Output ("PUSHED " + $head) }
git checkout --detach origin/main --quiet 2>$null
