# Commit Marco's uncommitted sot/ edits as a doc-reconcile PR.
#
# WHY FROM MARCO'S TREE: these edits exist ONLY in C:\ProjectOperations2. The watcher's clone
# cannot see them - which is why the HOLD prompt for this work could never have run headlessly.
#
# WHY A BRANCH AT HEAD (not a fresh checkout of origin/main): creating a branch at the CURRENT
# commit moves no files, so the working tree is never disturbed. We rebase onto origin/main
# AFTERWARDS, in the isolated worktree, where a conflict is safe to resolve.
#
# NO PATCH FILE. An earlier attempt wrote the diff with -Encoding ascii, which would have
# mangled every em-dash in sot/ - manufacturing the exact corruption class that blocked #544.
#
# CP-24: doc-reconcile purity. This commit must contain sot/** and/or docs/** only -
# NEVER apps/**, scripts/**, .github/**, packages/**, package.json, or pnpm-lock.yaml.
# Mirrors codeRe in scripts/pr-gates/pr-gates.mjs. Historically this script rejected
# ANY non-sot/ file and cited CP-24; that was stricter than the gate itself, and it
# blocked legitimate doc-reconcile PRs that carry a docs/ marker (runbook, audit,
# pr-prompt, review artifact) alongside the sot/ edit.
$ErrorActionPreference = "Continue"
Set-Location "C:\ProjectOperations2"

$branch = "docs/sot-reconcile-2026-07-14"

Write-Output "=== starting point"
$startBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Output ("  on branch: " + $startBranch)
if ($startBranch -ne "main") {
    Write-Output "  REFUSING: expected to start from main. Aborting so nothing is disturbed."
    exit 1
}

Write-Output ""
Write-Output "=== create branch at HEAD (moves no files)"
git switch -c $branch 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$now = (git rev-parse --abbrev-ref HEAD).Trim()
if ($now -ne $branch) {
    Write-Output ("  FAILED to switch. On: " + $now + ". Aborting.")
    exit 1
}
Write-Output ("  READBACK: on " + $now)

Write-Output ""
Write-Output "=== stage sot/ and docs/ ONLY"
git add sot/ docs/
$staged = @(git diff --cached --name-only)
foreach ($s in $staged) { Write-Output ("  staged: " + $s) }

# CP-24: sot/ and docs/ may ride together in a doc-reconcile PR. What CP-24 forbids
# is sot/ mixed with CODE. Predicate mirrors codeRe in scripts/pr-gates/pr-gates.mjs.
$codeRe = '^(?:apps/|scripts/|\.github/|packages/|package\.json$|pnpm-lock\.yaml$)'
$bad = @($staged | Where-Object { $_ -match $codeRe })
if ($bad.Count -gt 0) {
    Write-Output "  CP-24 VIOLATION - sot/ mixed with CODE (apps/, scripts/, .github/, packages/, package.json, pnpm-lock.yaml):"
    foreach ($b in $bad) { Write-Output ("    " + $b) }
    git reset | Out-Null
    git switch main | Out-Null
    exit 1
}
if ($staged.Count -eq 0) {
    Write-Output "  nothing staged - no sot/ or docs/ changes. Aborting."
    git switch main | Out-Null
    exit 1
}
Write-Output ("  CP-24 OK: " + $staged.Count + " file(s), all under sot/ or docs/")

Write-Output ""
Write-Output "=== commit"
git commit -q -m "docs(sot): retire chat routing, add boot sequence + concurrency rules, LL-36/37/38" -m "Doc-reconcile PR. sot/ and/or docs/ only (CP-24: no code)." 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$sha = (git rev-parse --short HEAD).Trim()
Write-Output ("  READBACK: committed " + $sha)

Write-Output ""
Write-Output "=== return Marco's tree to main (his edits are now safe on the branch)"
git switch main 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$back = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Output ("  READBACK: back on " + $back)

Write-Output ""
Write-Output ("=== branch " + $branch + " holds the sot/ edits at " + $sha)
Write-Output "    next: rebase it onto origin/main in the isolated worktree, then open the PR."
