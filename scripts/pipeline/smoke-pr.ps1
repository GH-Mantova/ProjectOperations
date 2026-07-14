# STATION 4 - SMOKE HARNESS.  A jig, not a worker.
#
# THE POINT: an agent must never be the judge of whether its own work passed. Twice a watcher
# agent wrote "done - verified" into a PR body while the diff did not contain the artifact it
# claimed (#476 createPortal, #478 managerId DTO). Prose is not evidence. An EXIT CODE is.
#
# So: the agent RUNS this. It does not INTERPRET it. Exit 0 = smoked. Anything else = not.
#
# This does NOT reinvent the acceptance suite - tests/e2e/pr-acceptance already has 24 specs
# and CI runs them on every PR. This is the LOCAL, pre-push copy: same specs, a real browser,
# a real seeded DB, screenshots on the way through.
#
#   .\smoke-pr.ps1 -Branch feat/foo                 # whole acceptance suite
#   .\smoke-pr.ps1 -Branch feat/foo -Spec batch4-quotes
#
# WHAT THIS CANNOT DO - and no amount of engineering will change it:
#   * a REAL Microsoft/Entra identity on a REAL shared PC   (#538)
#   * anything against PRODUCTION data                      (#552)
#   * any Azure / Entra / SharePoint tenant state           (absolute stop)
# Those escalate to Marco. Do not simulate them and call it smoked.

param(
    [Parameter(Mandatory = $true)][string]$Branch,
    [string]$Spec = "",
    [string]$Worktree = "C:\po-smoke"
)

$ErrorActionPreference = "Continue"   # git chats on stderr; "Stop" would abort on a warning
$started = Get-Date

function Step($msg) { Write-Output ("[" + ((Get-Date) - $started).ToString("mm\:ss") + "] " + $msg) }
function Die($msg, $code) { Write-Output ""; Write-Output ("SMOKE FAILED: " + $msg); exit $code }

Step ("smoking branch: " + $Branch)

# --- isolated worktree. NEVER smoke in Marco's tree or the watcher's clone. -------------
if (-not (Test-Path $Worktree)) {
    Step ("creating worktree " + $Worktree)
    git -C "C:\ProjectOperations2" worktree add $Worktree $Branch 2>&1 | ForEach-Object { Write-Output ("    " + $_) }
}
Set-Location $Worktree
git fetch origin --quiet
git switch $Branch 2>&1 | Out-Null
git reset --hard ("origin/" + $Branch) 2>&1 | Out-Null

$head = (git rev-parse --short HEAD).Trim()
$onBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($onBranch -ne $Branch) { Die ("worktree is on '" + $onBranch + "', not '" + $Branch + "'") 1 }
Step ("READBACK: " + $onBranch + " @ " + $head)

# --- build. A smoke against a stale dist/ proves nothing. --------------------------------
Step "pnpm install"
pnpm install --frozen-lockfile 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Output ("    " + $_) }
if ($LASTEXITCODE -ne 0) { Die "pnpm install failed" 1 }

Step "prisma generate"
pnpm prisma:generate 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Output ("    " + $_) }

Step "build (playwright boots the API from dist/ - it MUST be fresh)"
pnpm build 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Output ("    " + $_) }
if ($LASTEXITCODE -ne 0) { Die "pnpm build failed - not a smoke failure, a COMPILE failure" 1 }

Step "lint"
pnpm lint 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Output ("    " + $_) }
if ($LASTEXITCODE -ne 0) { Die "pnpm lint failed" 1 }

# --- migrate + seed. Seeded users are how we log in; there is no real identity here. -----
Step "prisma migrate + seed"
pnpm prisma:migrate 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Output ("    " + $_) }
pnpm seed 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Output ("    " + $_) }
if ($LASTEXITCODE -ne 0) { Die "seed failed - every e2e login depends on it" 1 }

# --- the actual smoke. Playwright boots API+web itself and polls /health. ----------------
$target = if ($Spec -ne "") { "tests/e2e/pr-acceptance/" + $Spec + ".spec.ts" } else { "tests/e2e/pr-acceptance" }
Step ("playwright: " + $target)

$env:PWTEST_SCREENSHOT_DIR = Join-Path $Worktree "smoke-artifacts"
pnpm exec playwright test $target --project=chromium --reporter=list 2>&1 | ForEach-Object { Write-Output ("    " + $_) }
$pw = $LASTEXITCODE

Write-Output ""
Write-Output "================ SMOKE VERDICT ================"
Write-Output ("  branch : " + $Branch + " @ " + $head)
Write-Output ("  suite  : " + $target)
Write-Output ("  elapsed: " + ((Get-Date) - $started).ToString("mm\:ss"))

if ($pw -ne 0) {
    Write-Output "  RESULT : FAIL"
    Write-Output ""
    Write-Output "  Read the failure above. Do NOT re-run hoping for green - flake is a diagnosis,"
    Write-Output "  not a default. #544's e2e 'flake' was two tests asserting the very bug the PR"
    Write-Output "  existed to remove. The tests encoded the bug."
    exit 1
}

Write-Output "  RESULT : PASS"
Write-Output ""
Write-Output "  This proves the seeded-user flows work. It does NOT prove anything about real"
Write-Output "  Entra identity, production data, or tenant state. Those still escalate to Marco."
exit 0
