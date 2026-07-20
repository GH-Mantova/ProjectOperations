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
# Test for .git, NOT the directory. `git worktree prune` removes the REGISTRATION but leaves the
# FILES behind, so a bare `Test-Path $Worktree` sees a directory, skips creation, and the script
# then Set-Location's into something git does not recognise. Every later git call dies with
# "fatal: not a git repository" and the run ends on the misleading
# "worktree is on '', not '<branch>'". Clear the orphan and rebuild it.
if ((Test-Path $Worktree) -and -not (Test-Path (Join-Path $Worktree ".git"))) {
    Step ("removing ORPHANED " + $Worktree + " (directory present, no .git - pruned registration)")
    Remove-Item $Worktree -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $Worktree) { Die ("could not remove orphaned worktree " + $Worktree + " - remove it by hand and re-run") 1 }
}
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

# --- provision .env into this fresh worktree. -------------------------------------------
# .env and apps/api/.env are untracked on purpose (secrets), so a fresh worktree receives
# NEITHER. Without DATABASE_URL, prisma dies P1012 and every smoke reports a branch defect
# when the real fault is a missing harness env. A tool that cannot run must fail LOUD, never
# fail quiet - so we copy the env files from the main tree and abort with SMOKE-ENV-MISSING
# if we cannot. See docs/pr-prompts/pr-fix-smoke-env-provisioning-ready.md.
$MainTree = "C:\ProjectOperations2"
$SrcRoot  = Join-Path $MainTree ".env"
$SrcApi   = Join-Path $MainTree "apps\api\.env"
$DstRoot  = Join-Path $Worktree ".env"
$DstApi   = Join-Path $Worktree "apps\api\.env"
$DstApiDir = Split-Path $DstApi -Parent
if (-not (Test-Path $DstApiDir)) { New-Item -ItemType Directory -Path $DstApiDir -Force | Out-Null }
if (Test-Path $SrcRoot) { Copy-Item -Path $SrcRoot -Destination $DstRoot -Force }
if (Test-Path $SrcApi)  { Copy-Item -Path $SrcApi  -Destination $DstApi  -Force }
$hasDbUrl = $false
if (Test-Path $DstApi)  { if (Select-String -Path $DstApi  -Pattern '^DATABASE_URL=' -Quiet) { $hasDbUrl = $true } }
if (Test-Path $DstRoot) { if (Select-String -Path $DstRoot -Pattern '^DATABASE_URL=' -Quiet) { $hasDbUrl = $true } }
if (-not (Test-Path $DstApi) -or -not $hasDbUrl) {
    Die "SMOKE-ENV-MISSING: could not provision .env into the smoke worktree from $MainTree - the smoke result would be meaningless, refusing to continue." 1
}
Step ("provisioned .env from " + $MainTree + " (root=" + (Test-Path $DstRoot) + ", apps/api=" + (Test-Path $DstApi) + ")")
# --- repoint this run at its OWN database. -----------------------------------------------
# The .env just copied points DATABASE_URL at the developer's LIVE dev database. Running
# migrate + seed against that mutates real local data, which is precisely why smoking a
# branch was a hard stop for every agent and why UI PRs piled up unsmoked. The smoke owns
# $SmokeDb outright: it may be migrated, seeded and truncated freely because nothing else
# reads it. If the rewrite cannot be proven, ABORT - never silently smoke the dev database.
$SmokeDb = if ($env:SMOKE_DATABASE_NAME) { $env:SMOKE_DATABASE_NAME } else { "project_operations_smoke" }
$repointed = $false
foreach ($envFile in @($DstRoot, $DstApi)) {
    if (-not (Test-Path $envFile)) { continue }
    $newLines = @()
    foreach ($line in (Get-Content $envFile)) {
        if ($line -match '^(DATABASE_URL=.*/)([^/?]+)(\?.*)?$') {
            $prefix = $Matches[1]
            $suffix = ""
            if ($Matches.Count -ge 4 -and $Matches[3]) { $suffix = $Matches[3] }
            $newLines += ($prefix + $SmokeDb + $suffix)
            $repointed = $true
        } else {
            $newLines += $line
        }
    }
    Set-Content -Path $envFile -Value $newLines -Encoding ASCII
}
if (-not $repointed) {
    Die "SMOKE-DB-REPOINT-FAILED: no DATABASE_URL line could be rewritten to $SmokeDb - refusing to smoke against the developer database." 1
}
Step ("smoke DB: " + $SmokeDb + " (developer database untouched)")

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
# Use `migrate deploy`, NOT `pnpm prisma:migrate` (which is `migrate dev`). `migrate dev` is
# INTERACTIVE: in a headless harness nobody answers its prompt, so it exits 130 and the run
# reads as "this branch is broken" when the truth is "the harness asked a question". deploy
# is forward-only and non-interactive.
#
# The exit code is checked HERE. It previously was not: the only check sat after `pnpm seed`,
# so `` referred to the seed and ANY migrate failure was silently swallowed.
Step "prisma migrate deploy (smoke DB)"
# `prisma` is a dependency of the API workspace ONLY - there is no prisma binary in the repo-root
# node_modules/.bin, so a bare `pnpm exec prisma` from the root dies with ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL
# ("'prisma' is not recognized"). Filter to the api workspace so pnpm resolves apps/api's own binary;
# the schema then resolves from that package and needs no --schema flag.
pnpm --filter @project-ops/api exec prisma migrate deploy 2>&1 | Select-Object -Last 5 | ForEach-Object { Write-Output ("    " + $_) }
if ($LASTEXITCODE -ne 0) { Die "SMOKE-MIGRATE-FAILED: prisma migrate deploy failed against $SmokeDb - fix the migration; do NOT re-run blind" 1 }

Step "seed"
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
