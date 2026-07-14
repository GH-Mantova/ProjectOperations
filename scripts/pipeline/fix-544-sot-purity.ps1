# #544 fails CP-24 (sot-purity): it mixes a sot/ edit with code changes.
#
#   FAIL - CP-24 sot-purity [sot/ + code in same PR
#          (sot: sot/01-charter-and-architecture.md; code: ci.yml, NoAccess.tsx, ...)]
#
# The gate is CORRECT and is doing exactly its job (it shipped in #545).
# The fix it prescribes: remove sot/ from the code PR. The SoT prose lands separately via a
# doc-reconcile PR - which is already pending in Marco's working tree.
#
# We do NOT discard the lesson: CP-24's own message says "a lesson dropped to make CI green is a
# worse outcome than the conflict this gate prevents." The sot/01 failure-honesty section stays
# in Marco's tree and ships in the SoT PR.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Stop"
Set-Location "C:\po-fix"
git fetch origin --quiet

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null

$sotFiles = git diff --name-only origin/main HEAD -- sot/
if (-not $sotFiles) { Write-Output "No sot/ files in #544. Nothing to do."; exit 0 }

Write-Output "sot/ files currently in #544 (must be removed):"
foreach ($f in $sotFiles) { Write-Output ("  " + $f) }
Write-Output ""

# Restore every sot/ file to main's version -> the PR no longer touches sot/.
foreach ($f in $sotFiles) {
    git checkout origin/main -- $f 2>&1 | Out-Null
}

$still = git diff --name-only origin/main HEAD -- sot/
$staged = git diff --cached --name-only -- sot/
Write-Output ("after reset, sot/ files still differing from main: " + $(if ($staged) { ($staged -join ", ") } else { "none (good)" }))

# Prove the PR's actual point survived.
$code = git diff --name-only origin/main HEAD -- apps/ scripts/ .github/
Write-Output ""
Write-Output "code files still in the PR (its real contribution):"
foreach ($f in $code) { Write-Output ("  " + $f) }

if (-not $code) { throw "The PR has no code left. Something went wrong. Aborting." }

if (-not $Execute) {
    git checkout HEAD -- sot/ 2>&1 | Out-Null
    Write-Output ""
    Write-Output "DRY RUN - reverted, nothing pushed."
    exit 0
}

git add sot/ 2>&1 | Out-Null
git commit -m "chore: drop sot/ changes from this code PR (CP-24 sot-purity); the SoT prose lands via a doc-reconcile PR" --quiet
git push origin $branch 2>&1 | Out-Null
Write-Output ""
Write-Output "PUSHED - #544 no longer mixes sot/ with code. CP-24 should now pass."
git checkout --detach origin/main --quiet 2>&1 | Out-Null
