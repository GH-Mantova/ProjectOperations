# batch-pr-smoke.ps1 -- local smoke test of every open PR
#
# For each open PR on GH-Mantova/ProjectOperations:
#   1. Checkout the PR branch
#   2. Install deps if pnpm-lock.yaml changed
#   3. Run: pnpm build, pnpm lint, pnpm compliance:smoke
#   4. Capture pass/fail and timing
#   5. Save individual logs under tmp-outputs/smoke-<pr#>/
#
# ISOLATION (2026-08-06): the ENTIRE run happens in a throwaway git worktree, never the dev
# tree. The dev tree's working dir is the pr-watcher queue (docs/pr-prompts); the previous
# version 'git reset --hard origin/main' there, resurrecting every -ready.md the watcher had
# already consumed and re-running shipped work. This version never touches the dev tree.
#
# At the end:
#   - Removes the throwaway worktree (the dev tree was never touched)
#   - Writes a markdown report to the repo root
#
# Usage:
#   pwsh scripts/batch-pr-smoke.ps1
#
# Optional env vars:
#   $env:SMOKE_SKIP = "build,lint"   skip those checks
#   $env:SMOKE_ONLY = "324,310"      only test specific PR numbers (comma-separated)
#   $env:SMOKE_DRY_RUN = "1"         checkout each branch but skip the actual test commands
#   $env:SMOKE_NO_UPDATE = "1"       skip the merge-from-main step
#   $env:SMOKE_NO_PUSH = "1"         after a green test, do NOT push the updated branch back
#   $env:SMOKE_AUTO_MERGE = "1"      after a successful push, enable GitHub auto-merge (squash). Needs merge queue for ordered batches.
#   $env:SMOKE_SEQUENTIAL = "1"      strict sequential: push -> wait for CI -> merge -> next. Works without merge queue but slow.
#   $env:SMOKE_WORKTREE = "C:\po-batch-smoke"                throwaway worktree location
#   $env:SMOKE_DATABASE_NAME = "project_operations_smoke"    disposable DB for compliance:smoke

[CmdletBinding()]
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'  # don't bail on a single PR failure
$scriptRoot = $PSScriptRoot
$repoRoot   = Split-Path $scriptRoot -Parent   # LIVE dev tree - hosts the pr-watcher queue. NEVER git-reset it.

$reportPath = Join-Path $repoRoot ("pr-smoke-report-" + (Get-Date -Format 'yyyy-MM-dd-HHmm') + ".md")
$logsDir    = Join-Path $repoRoot "tmp-outputs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

# --- Isolation: do ALL git/checkout/reset/build in a THROWAWAY worktree, never the dev tree. ---
# The dev tree's working dir IS the pr-watcher queue (docs/pr-prompts). Resetting it here
# restored every -ready.md the watcher had already consumed, starving newly armed slices.
# Smoke in a detached worktree instead; the queue is never touched. Mirrors scripts/pipeline/smoke-pr.ps1.
$smokeTree = if ($env:SMOKE_WORKTREE) { $env:SMOKE_WORKTREE } else { "C:\po-batch-smoke" }
git -C $repoRoot fetch origin --prune | Out-Null

# Clear any orphan from an interrupted run (a pruned registration leaves files with no .git).
if ((Test-Path $smokeTree) -and -not (Test-Path (Join-Path $smokeTree ".git"))) {
  Remove-Item $smokeTree -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path $smokeTree) { git -C $repoRoot worktree remove --force $smokeTree 2>&1 | Out-Null }
git -C $repoRoot worktree prune | Out-Null
if (Test-Path $smokeTree) { Remove-Item $smokeTree -Recurse -Force -ErrorAction SilentlyContinue }

# 'main' is checked out in the dev tree and cannot be checked out again -> detach at origin/main.
git -C $repoRoot worktree add --detach $smokeTree origin/main 2>&1 | Out-Null
if (-not (Test-Path (Join-Path $smokeTree ".git"))) {
  Write-Host "FATAL: could not create smoke worktree at $smokeTree -- aborting (dev tree untouched)." -ForegroundColor Red
  exit 1
}
Set-Location $smokeTree

# A fresh worktree does not inherit untracked secrets (.env) or node_modules. Provision .env
# from the dev tree and repoint DATABASE_URL at a disposable smoke DB so compliance:smoke never
# mutates the developer database (same approach as scripts/pipeline/smoke-pr.ps1).
foreach ($rel in @('.env', 'apps\api\.env')) {
  $src = Join-Path $repoRoot $rel
  $dst = Join-Path $smokeTree $rel
  if (Test-Path $src) {
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item -Path $src -Destination $dst -Force
  }
}
$smokeDb = if ($env:SMOKE_DATABASE_NAME) { $env:SMOKE_DATABASE_NAME } else { "project_operations_smoke" }
foreach ($envFile in @((Join-Path $smokeTree '.env'), (Join-Path $smokeTree 'apps\api\.env'))) {
  if (-not (Test-Path $envFile)) { continue }
  $newLines = foreach ($line in (Get-Content $envFile)) {
    if ($line -match '^(DATABASE_URL=.*/)([^/?]+)(\?.*)?$') {
      $suffix = ''
      if ($Matches.Count -ge 4 -and $Matches[3]) { $suffix = $Matches[3] }
      $Matches[1] + $smokeDb + $suffix
    } else { $line }
  }
  Set-Content -Path $envFile -Value $newLines -Encoding ASCII
}

# Prime the fresh worktree (no node_modules / prisma client yet).
Write-Host "Priming smoke worktree deps (pnpm install + prisma generate)..." -ForegroundColor Cyan
pnpm install --frozen-lockfile 2>&1 | Out-File -FilePath (Join-Path $logsDir "worktree-prime-install.log")
pnpm prisma:generate 2>&1 | Out-File -FilePath (Join-Path $logsDir "worktree-prime-prisma.log")

# --- Resolve which PRs to test ---
$onlyList = if ($env:SMOKE_ONLY) { $env:SMOKE_ONLY -split ',' | ForEach-Object { $_.Trim() } } else { @() }
$skipChecks = if ($env:SMOKE_SKIP) { $env:SMOKE_SKIP -split ',' | ForEach-Object { $_.Trim().ToLower() } } else { @() }
$dryRun = $DryRun -or ($env:SMOKE_DRY_RUN -eq "1")

$prJson = gh pr list --state open --limit 100 --json number,title,headRefName,statusCheckRollup
$prs = $prJson | ConvertFrom-Json

if ($onlyList.Count -gt 0) {
  # Filter + reorder to match the user's input order in SMOKE_ONLY
  $prsByNum = @{}
  foreach ($pr in $prs) { $prsByNum["$($pr.number)"] = $pr }
  $prs = @()
  foreach ($num in $onlyList) {
    if ($prsByNum.ContainsKey($num)) {
      $prs += $prsByNum[$num]
    } else {
      Write-Host "WARNING: PR #$num not in open PR list -- skipping" -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "Testing $($prs.Count) open PR(s). Logs in tmp-outputs/. Report at $reportPath" -ForegroundColor Cyan
Write-Host ""

# --- Report header ---
@"
# PR Smoke Test Report

**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')
**Repo:** GH-Mantova/ProjectOperations
**Total PRs tested:** $($prs.Count)
**Dry run:** $dryRun
**Skipped checks:** $($skipChecks -join ', ')

| PR | Title | Branch | Build | Lint | Smoke | Duration | Notes |
|---|---|---|---|---|---|---|---|
"@ | Out-File -FilePath $reportPath -Encoding UTF8

$summary = @{ pass = 0; fail = 0; skipped = 0; checkout_failed = 0 }

foreach ($pr in $prs) {
  $prNum = $pr.number
  $title = ($pr.title -replace '\|', '\\|')
  $branch = $pr.headRefName
  $prLogDir = Join-Path $logsDir "smoke-$prNum"
  New-Item -ItemType Directory -Force -Path $prLogDir | Out-Null

  Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
  Write-Host "PR #$prNum  $title" -ForegroundColor White
  Write-Host "Branch: $branch"

  $start = Get-Date

  # --- Checkout PR branch ---
  git fetch origin $branch 2>&1 | Out-File -FilePath (Join-Path $prLogDir "checkout.log")
  git checkout $branch 2>&1 | Add-Content (Join-Path $prLogDir "checkout.log")
  if ($LASTEXITCODE -ne 0) {
    git checkout -b $branch "origin/$branch" 2>&1 | Add-Content (Join-Path $prLogDir "checkout.log")
  }
  git pull --rebase origin $branch 2>&1 | Add-Content (Join-Path $prLogDir "checkout.log")

  $current = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($current -ne $branch) {
    Write-Host "  CHECKOUT FAILED" -ForegroundColor Red
    "| #$prNum | $title | $branch | - | - | - | - | Checkout failed |" | Add-Content $reportPath
    $summary['checkout_failed'] += 1
    continue
  }

  if ($dryRun) {
    Write-Host "  DRY RUN -- skipping tests" -ForegroundColor Yellow
    "| #$prNum | $title | $branch | DRY | DRY | DRY | - | Dry run |" | Add-Content $reportPath
    $summary['skipped'] += 1
    continue
  }

  # --- Update branch from origin/main (equivalent to GitHub's "Update branch") ---
  $skipUpdate = $env:SMOKE_NO_UPDATE -eq "1"
  $branchBehind = $false
  if (-not $skipUpdate) {
    $mergeBase = (git merge-base HEAD origin/main).Trim()
    $mainTip = (git rev-parse origin/main).Trim()
    if ($mergeBase -ne $mainTip) {
      $branchBehind = $true
      Write-Host "  Branch is behind main -- merging origin/main..." -ForegroundColor Cyan
      git merge origin/main --no-ff --no-edit 2>&1 | Out-File -FilePath (Join-Path $prLogDir "merge.log")
      if ($LASTEXITCODE -ne 0) {
        git merge --abort 2>&1 | Out-Null
        Write-Host "  MERGE CONFLICT -- needs manual resolution" -ForegroundColor Red
        "| #$prNum | $title | $branch | - | - | - | - | Merge conflict with main -- see tmp-outputs/smoke-$prNum/merge.log |" | Add-Content $reportPath
        $summary['fail'] += 1
        continue
      }
    }
  }

  # --- Re-install if pnpm-lock changed vs main ---
  $lockChanged = git diff --name-only origin/main..HEAD | Select-String "pnpm-lock.yaml"
  if ($lockChanged) {
    Write-Host "  pnpm-lock changed -- running pnpm install..." -ForegroundColor Yellow
    pnpm install --frozen-lockfile 2>&1 | Out-File -FilePath (Join-Path $prLogDir "install.log")
  }

  # --- Run checks ---
  $results = @{}

  if ($skipChecks -notcontains 'build') {
    Write-Host "  build..."
    pnpm build 2>&1 | Out-File -FilePath (Join-Path $prLogDir "build.log")
    $results.build = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }
  } else { $results.build = "skip" }

  if ($skipChecks -notcontains 'lint') {
    Write-Host "  lint..."
    pnpm lint 2>&1 | Out-File -FilePath (Join-Path $prLogDir "lint.log")
    $results.lint = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }
  } else { $results.lint = "skip" }

  if ($skipChecks -notcontains 'smoke') {
    Write-Host ('  compliance smoke...')
    pnpm compliance:smoke 2>&1 | Out-File -FilePath (Join-Path $prLogDir "smoke.log")
    $results.smoke = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }
  } else { $results.smoke = "skip" }

  $duration = (Get-Date) - $start
  $durStr = "{0:mm}m{0:ss}s" -f $duration

  $allGreen = $results.build -ne "FAIL" -and $results.lint -ne "FAIL" -and $results.smoke -ne "FAIL"
  $notes = if ($allGreen) { "Ready to merge" } else {
    $failed = @()
    if ($results.build -eq "FAIL") { $failed += "build" }
    if ($results.lint  -eq "FAIL") { $failed += "lint" }
    if ($results.smoke -eq "FAIL") { $failed += "smoke" }
    "Failed: $($failed -join ', ') -- see tmp-outputs/smoke-$prNum/"
  }

  if ($allGreen) {
    $summary['pass'] += 1
    Write-Host "  ALL GREEN ($durStr)" -ForegroundColor Green

    # --- Push the updated branch back so GitHub CI re-runs against current main ---
    $pushOk = $false
    if (($env:SMOKE_NO_PUSH -ne "1") -and ($branchBehind -or ($env:SMOKE_AUTO_MERGE -eq "1") -or ($env:SMOKE_SEQUENTIAL -eq "1"))) {
      Write-Host "  Pushing updated branch to origin..." -ForegroundColor Cyan
      git push origin HEAD 2>&1 | Out-File -FilePath (Join-Path $prLogDir "push.log")
      if ($LASTEXITCODE -ne 0) {
        $notes = "Local green but push FAILED -- see tmp-outputs/smoke-$prNum/push.log"
        Write-Host "  PUSH FAILED -- branch updated locally but not on origin" -ForegroundColor Yellow
      } else {
        $pushOk = $true
        $notes = "Ready to merge (branch updated + pushed)"
        Write-Host "  Pushed -- CI will re-run on GitHub" -ForegroundColor Green
      }
    }

    # --- Sequential mode: wait for CI then merge before moving to next PR ---
    $sequentialHalt = $false
    if ($pushOk -and $env:SMOKE_SEQUENTIAL -eq "1") {
      Write-Host "  Sequential: waiting for CI on PR #$prNum..." -ForegroundColor Cyan
      gh pr checks $prNum --watch --fail-fast 2>&1 | Out-File -FilePath (Join-Path $prLogDir "ci-watch.log")
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  CI passed -- enabling auto-merge on PR #$prNum..." -ForegroundColor Green
        $mergeLog = Join-Path $prLogDir "merge-pr.log"

        # Enable auto-merge (GitHub handles waiting for code scanning / all requirements)
        $autoMergeOut = gh pr merge $prNum --squash --delete-branch --auto 2>&1
        ("--- enable auto-merge ---") | Out-File -FilePath $mergeLog
        $autoMergeOut | Out-String | Add-Content $mergeLog

        if ($LASTEXITCODE -ne 0) {
          $notes = "Auto-merge enable FAILED -- see merge-pr.log. HALTING."
          Write-Host "  AUTO-MERGE ENABLE FAILED -- HALTING" -ForegroundColor Red
          $sequentialHalt = $true
        } else {
          # Poll until PR is actually merged (or closed without merging)
          Write-Host "  Auto-merge queued -- polling for completion..." -ForegroundColor Yellow
          $pollMax = 40   # 40 polls x 30s = 20 minutes max wait
          $polls = 0
          $merged = $false
          $closedNoMerge = $false
          $behindRescues = 0
          $behindRescueMax = 3
          while ($polls -lt $pollMax -and -not $merged -and -not $closedNoMerge) {
            $polls++
            Start-Sleep -Seconds 30
            $state = "UNKNOWN"
            $mergeState = "UNKNOWN"
            try {
              $stateRaw = (& gh pr view $prNum --json state --jq .state 2>$null | Out-String).Trim()
              if (-not [string]::IsNullOrWhiteSpace($stateRaw)) { $state = $stateRaw }
              $mergeRaw = (& gh pr view $prNum --json mergeStateStatus --jq .mergeStateStatus 2>$null | Out-String).Trim()
              if (-not [string]::IsNullOrWhiteSpace($mergeRaw)) { $mergeState = $mergeRaw }
            } catch {
              Write-Host "    poll $polls/$pollMax -- gh CLI error, retrying" -ForegroundColor DarkGray
              continue
            }
            if ($state -eq "MERGED") {
              $merged = $true
            } elseif ($state -eq "CLOSED") {
              $closedNoMerge = $true
            } elseif ($mergeState -eq "BEHIND" -and $behindRescues -lt $behindRescueMax) {
              $behindRescues++
              Write-Host "    poll $polls/$pollMax -- state=$state mergeState=$mergeState -- updating branch (rescue $behindRescues/$behindRescueMax)" -ForegroundColor Yellow
              gh pr update-branch $prNum 2>&1 | Out-File -FilePath (Join-Path $prLogDir "update-branch.log") -Append
              # Give CI a moment to re-trigger after update
              Start-Sleep -Seconds 30
            } else {
              Write-Host "    poll $polls/$pollMax -- state=$state mergeState=$mergeState" -ForegroundColor DarkGray
            }
          }

          if ($merged) {
            $notes = "Merged (sequential, polled $polls, behind-rescues $behindRescues)"
            Write-Host "  MERGED" -ForegroundColor Green
          } elseif ($closedNoMerge) {
            $notes = "PR was closed without merging -- HALTING"
            Write-Host "  PR closed unexpectedly -- HALTING" -ForegroundColor Red
            $sequentialHalt = $true
          } else {
            $notes = "Timed out waiting for auto-merge after $polls polls -- HALTING"
            Write-Host "  AUTO-MERGE TIMEOUT -- HALTING (check PR state on GitHub)" -ForegroundColor Red
            $sequentialHalt = $true
          }
        }
      } else {
        $notes = "CI failed on GitHub -- see ci-watch.log. HALTING."
        Write-Host "  CI FAILED on GitHub -- HALTING further PRs" -ForegroundColor Red
        $sequentialHalt = $true
      }
    }

    # --- Auto-merge mode: enable GitHub's auto-merge and move on ---
    if ($pushOk -and $env:SMOKE_AUTO_MERGE -eq "1" -and $env:SMOKE_SEQUENTIAL -ne "1") {
      Write-Host "  Enabling auto-merge on PR #$prNum..." -ForegroundColor Cyan
      gh pr merge $prNum --squash --delete-branch --auto 2>&1 | Out-File -FilePath (Join-Path $prLogDir "automerge.log")
      if ($LASTEXITCODE -eq 0) {
        $notes = "Auto-merge enabled (queued)"
        Write-Host "  Auto-merge queued" -ForegroundColor Green
      } else {
        $notes = "Push ok but auto-merge enable FAILED -- see automerge.log"
        Write-Host "  AUTO-MERGE ENABLE FAILED" -ForegroundColor Yellow
      }
    }
  } else {
    $summary['fail'] += 1
    Write-Host "  FAILED: $notes ($durStr)" -ForegroundColor Red
  }

  "| #$prNum | $title | $branch | $($results.build) | $($results.lint) | $($results.smoke) | $durStr | $notes |" | Add-Content $reportPath

  # --- Actual halt for sequential mode failure ---
  if ($sequentialHalt) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "HALTING at PR #$prNum -- fix the issue, then resume with:" -ForegroundColor Red
    Write-Host "  `$env:SMOKE_ONLY = '<remaining PR numbers comma-separated>'" -ForegroundColor Yellow
    Write-Host "  `$env:SMOKE_SEQUENTIAL = '1'" -ForegroundColor Yellow
    Write-Host "  .\scripts\batch-pr-smoke.ps1" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Red
    break
  }
}

# --- Append summary footer ---
@"

---

## Summary

- Passed:           $($summary.pass)
- Failed:           $($summary.fail)
- Checkout failed:  $($summary.checkout_failed)
- Skipped:          $($summary.skipped)

Logs for each PR are in ``tmp-outputs/smoke-<pr#>/``.

## Next steps

For each failing PR:
1. Open the branch in VS Code: ``git checkout <branch> && code .``
2. Open ``tmp-outputs/smoke-<pr#>/`` to see which check failed
3. Use Claude Code sidebar to diagnose and fix
4. Commit the fix, push, re-run smoke

For passing PRs, batch-merge with:
``````powershell
gh pr merge <number> --squash --delete-branch
``````
"@ | Add-Content $reportPath

# --- Tear down the throwaway worktree. The dev tree was NEVER touched. ---
Set-Location $repoRoot
git worktree remove --force $smokeTree 2>&1 | Out-Null
git worktree prune | Out-Null
if (Test-Path $smokeTree) { Remove-Item $smokeTree -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "Report:    $reportPath" -ForegroundColor Cyan
Write-Host "Pass:      $($summary.pass)" -ForegroundColor Green
Write-Host "Fail:      $($summary.fail)" -ForegroundColor Red
Write-Host "Skip/CO:   $($summary.skipped + $summary.checkout_failed)" -ForegroundColor Yellow
Write-Host "============================================================"
