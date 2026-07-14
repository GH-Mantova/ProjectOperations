# Commit the 2026-07-14 pipeline work: evidence gate, smoke harness, lint fix, agents, doctrine.
#
# Branch at HEAD in Marco's tree (moves no files), stage ONLY what we intend, commit, then rebase
# onto origin/main and push from the ISOLATED worktree. Marco's tree is never checked out onto a
# different commit.
#
# CP-24: this commit must contain NO sot/ files. Code + sot in one PR is a hard CI failure.
$ErrorActionPreference = "Continue"

$branch = "feat/pipeline-evidence-gate"
Set-Location "C:\ProjectOperations2"

$start = (git rev-parse --abbrev-ref HEAD).Trim()
if ($start -ne "main") { Write-Output ("REFUSING: on '" + $start + "', expected main."); exit 1 }

git switch -c $branch 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
if ((git rev-parse --abbrev-ref HEAD).Trim() -ne $branch) { Write-Output "  switch failed"; exit 1 }

# Stage only these. Explicit beats `git add -A`, which would sweep up the whole untracked mess.
$paths = @(
    "scripts/pipeline",
    "docs/pipeline/DOCTRINE.md",
    "docs/architecture/drafts/pipeline-staged/SHARED-DOCTRINE.md",
    ".claude/agents"
)
foreach ($p in $paths) { git add -- $p 2>&1 | Out-Null }

$staged = @(git diff --cached --name-only)
Write-Output ("  staged " + $staged.Count + " file(s)")

# CP-24 sot-purity, asserted rather than assumed.
$sot = @($staged | Where-Object { $_ -like "sot/*" })
if ($sot.Count -gt 0) {
    Write-Output "  CP-24 VIOLATION: sot/ files staged. Aborting."
    git reset | Out-Null; git switch main | Out-Null; exit 1
}
Write-Output "  CP-24 OK: no sot/ files staged"

if ($staged.Count -eq 0) { Write-Output "  nothing to commit"; git switch main | Out-Null; exit 1 }

git commit -q -m "feat(pipeline): evidence gate, smoke harness, intake-lint fix, numbered agent stations" -m "Agents may no longer be the judge of their own work." 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$sha = (git rev-parse --short HEAD).Trim()
Write-Output ("  READBACK: committed " + $sha)

git switch main 2>&1 | Out-Null
Write-Output ("  Marco's tree back on: " + (git rev-parse --abbrev-ref HEAD).Trim())

# --- rebase + push from the isolated worktree ------------------------------------------------
Set-Location "C:\po-fix"
git fetch origin --quiet
git switch $branch 2>&1 | Out-Null
git rebase origin/main 2>&1 | ForEach-Object { Write-Output ("  " + $_) }

if (Test-Path (Join-Path (git rev-parse --git-dir) "rebase-merge")) {
    Write-Output "  *** CONFLICT mid-rebase - stopping for inspection, NOT aborting."
    exit 2
}

git push -u origin $branch --force-with-lease 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Output ("  " + $_) }
$local = (git rev-parse HEAD).Trim()
$remote = (git ls-remote origin ("refs/heads/" + $branch)).Split()[0]
if ($local -ne $remote) { Write-Output "  PUSH NOT VERIFIED"; exit 1 }
Write-Output ("  READBACK: origin has " + $local.Substring(0, 8))
