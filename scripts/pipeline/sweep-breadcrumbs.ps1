#Requires -Version 5.1
<#
.SYNOPSIS
    Batch every untracked breadcrumb onto a branch and open ONE PR for them.

.DESCRIPTION
    WHY THIS SCRIPT EXISTS
    ----------------------
    C:\ProjectOperations2 cannot push to `main`: the ruleset requires a pull request and
    forbids merge commits. A commit made there on `main` therefore has no route to origin.
    It moves local `main` permanently ahead of origin/main, and every route back
    (`git reset --hard`, a path-scoped `git checkout`) is on the forbidden-command list.

    MEASURED 2026-08-27T22:00Z: local `main` carried five commits absent from origin/main.
    Four of the five held content that had already reached `main` by another route, so the
    drift bought nothing and cost a reconciliation that needed both forbidden commands.
    Within twenty minutes of that cleanup a Station 04 run recreated the drift.

    The rule this script implements is NO-DRIFT: agents write, one job commits. Stations
    leave their breadcrumbs UNTRACKED. This script is the one job that lands them - on a
    branch, through a PR, exactly the shape PR #1357 already demonstrated when 29 untracked
    breadcrumbs went up as a single PR.

    The `.githooks/pre-commit` branch guard is the other half: it refuses a commit on `main`
    outright. That hook is TRACKED and `package.json` postinstall sets
    `core.hooksPath = .githooks`, so there is no manual install step for it.

    WHAT THIS SCRIPT WILL NOT DO
    ----------------------------
    - It never stages a tracked file. Only untracked paths are ever added, so a deletion
      cannot enter the commit by construction; the script asserts that afterwards anyway.
    - It never stages `*-ready.md` or `*-HOLD.md`. Arming is Station 00's, on Marco's
      authority, and a swept `-ready.md` would be an arming nobody authorised. `.gitignore:75`
      already ignores `docs/pr-prompts/*-ready.md`; this filter is the second line of
      defence against a `git add -f` habit, and it is the one that also covers `-HOLD.md`.
    - It never uses `git add -A`. Every path is passed explicitly.
    - It refuses to run when the index already holds staged changes, so it cannot sweep
      another session's work-in-progress into its own commit (the collision class that
      arm-prompt.ps1 was built to serialize).

.PARAMETER WhatIf
    Dry run. Print the exact file list that would be committed and touch nothing:
    no branch, no staging, no commit, no push, no PR. Exits 0.

.PARAMETER RepoRoot
    Repository to sweep. Defaults to the git top-level of the current directory.

.PARAMETER BranchPrefix
    Branch name prefix. The UTC timestamp is appended. Default `chore/sweep-breadcrumbs`.

.PARAMETER NoPr
    Push the branch but do not call `gh pr create`. For a caller that opens the PR itself.

.EXAMPLE
    pwsh -File scripts/pipeline/sweep-breadcrumbs.ps1 -WhatIf

.EXAMPLE
    pwsh -File scripts/pipeline/sweep-breadcrumbs.ps1
#>

[CmdletBinding()]
param(
    [switch]$WhatIf,

    [string]$RepoRoot = "",

    [string]$BranchPrefix = "chore/sweep-breadcrumbs",

    [switch]$NoPr
)

# DOCTRINE section 7, standing guard 7: "$ErrorActionPreference = 'Continue' in git scripts. Git
# warns on stderr; 'Stop' will abort you BEFORE your commit while the log still looks perfectly
# clean." Invoke-Git below merges stderr into the output stream with 2>&1, so under "Stop" every
# ordinary git notice - "Switched to a new branch", "set up to track" - is raised as a terminating
# NativeCommandError. MEASURED 2026-09-07T09:30Z by Station 00: this script created its branch, then
# died on git's own "Switched to a new branch" line. Nothing was staged, nothing committed, nothing
# pushed, no PR opened - and the dev tree was left OFF main, which is the drift this script exists to
# prevent.
#
# "Continue" alone would be worse, not better: Write-Error stops being terminating, so a failed
# `git add` would flow straight into the commit. Both halves are required, and they are:
#   (1) "Continue" here, so a native stderr line cannot throw; and
#   (2) `throw` instead of `Write-Error` in Invoke-Git, so a real non-zero exit still aborts
#       regardless of the preference.
$ErrorActionPreference = "Continue"

function Write-Step { param([string]$Message) Write-Output $Message }

function Invoke-Git {
    # Explicit argument array. Never a string that a shell might re-split.
    param([string[]]$GitArgs, [switch]$AllowFailure)
    $output = & git @GitArgs 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0 -and -not $AllowFailure) {
        # throw, not Write-Error: terminating regardless of $ErrorActionPreference.
        throw ("git " + ($GitArgs -join " ") + " failed with exit " + $code + ":`n" + ($output -join "`n"))
    }
    return @{ Output = $output; ExitCode = $code }
}

# ---------------------------------------------------------------------------
# 0. Locate the repository
# ---------------------------------------------------------------------------

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $top = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($top)) {
        # throw, not Write-Error: terminating regardless of $ErrorActionPreference.
        throw "not inside a git repository, and -RepoRoot was not supplied."
    }
    $RepoRoot = ([string]$top).Trim()
}
Set-Location -LiteralPath $RepoRoot

# ---------------------------------------------------------------------------
# 1. The index must be clean before we touch it
# ---------------------------------------------------------------------------
# Several sessions share this one working tree and one index. If something is
# already staged, adding to it would fold a stranger's work into the sweep
# commit -- the exact collision class recorded on 2026-08-24 (commit 488f138a
# swept two arming renames into an unrelated docs commit).

$staged = (Invoke-Git -GitArgs @("diff", "--cached", "--name-only")).Output |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

if ($staged.Count -gt 0) {
    Write-Output "REFUSED: the index already holds staged changes. The sweep will not commit"
    Write-Output "around another session's work. Staged paths:"
    foreach ($p in $staged) { Write-Output ("    " + $p) }
    Write-Output ""
    Write-Output "Land or unstage those first, then re-run the sweep."
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Collect candidates: UNTRACKED files only
# ---------------------------------------------------------------------------
# `--others` lists untracked paths; `--exclude-standard` honours .gitignore, so
# docs/pr-prompts/*-ready.md and the processed|failed|... sinks are excluded
# before our own filter even runs. Tracked files never appear here, which is why
# a deletion cannot reach the commit.

$candidates = (Invoke-Git -GitArgs @(
        "ls-files", "--others", "--exclude-standard", "--",
        "docs/pr-prompts", "docs/pipeline"
    )).Output |
    ForEach-Object { ([string]$_).Trim() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

# ---------------------------------------------------------------------------
# 3. Filter to breadcrumbs, and refuse arming files
# ---------------------------------------------------------------------------

$sweepable = @()
$refused = @()

foreach ($path in $candidates) {
    $leaf = Split-Path -Path $path -Leaf

    # NEVER sweep an arming file. Not a -ready.md (that IS an armed prompt: the
    # watcher globs the dev tree and will run it, DOCTRINE section 5b), and not a
    # -HOLD.md (staging one is Station 00's call, not a sweep's).
    if ($leaf -like "*-ready.md" -or $leaf -like "*-HOLD.md") {
        $refused += $path
        continue
    }

    $isPromptBreadcrumb = ($path -like "docs/pr-prompts/00-*.md")
    $isPipelineDoc = ($path -like "docs/pipeline/*")

    if ($isPromptBreadcrumb -or $isPipelineDoc) {
        $sweepable += $path
    }
}

$sweepable = @($sweepable | Sort-Object)
$refused = @($refused | Sort-Object)

if ($refused.Count -gt 0) {
    Write-Output "SKIPPED (arming files are never swept):"
    foreach ($p in $refused) { Write-Output ("    " + $p) }
    Write-Output ""
}

# ---------------------------------------------------------------------------
# 4. Nothing to sweep is a success, not a failure
# ---------------------------------------------------------------------------

if ($sweepable.Count -eq 0) {
    Write-Output "nothing to sweep: no untracked breadcrumbs under docs/pr-prompts/ or docs/pipeline/."
    exit 0
}

Write-Output ("Breadcrumbs to sweep (" + $sweepable.Count + "):")
foreach ($p in $sweepable) { Write-Output ("    " + $p) }
Write-Output ""

# ---------------------------------------------------------------------------
# 5. -WhatIf stops here, having touched nothing
# ---------------------------------------------------------------------------

if ($WhatIf) {
    Write-Output "-WhatIf: no branch created, nothing staged, nothing committed, nothing pushed."
    exit 0
}

# ---------------------------------------------------------------------------
# 6. Branch, stage explicitly, verify, commit
# ---------------------------------------------------------------------------

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmm")
$branch = $BranchPrefix + "-" + $stamp

Write-Step ("Creating branch " + $branch)
$null = Invoke-Git -GitArgs @("switch", "-c", $branch)

# Explicit paths only. `git add -A` would take everything in the tree.
$addArgs = @("add", "--") + $sweepable
$null = Invoke-Git -GitArgs $addArgs

# Verify what actually landed in the index. Two properties must hold:
#   (a) no deletion is staged -- consumed-HOLD removals are never smuggled in;
#   (b) the staged set is exactly the set we chose -- nothing raced in beside us.
$nameStatus = (Invoke-Git -GitArgs @("diff", "--cached", "--name-status")).Output |
    ForEach-Object { ([string]$_).TrimEnd() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$stagedPaths = @()
$deletions = @()
foreach ($line in $nameStatus) {
    $parts = $line -split "`t"
    $status = $parts[0]
    $path = $parts[$parts.Count - 1]
    if ($status -like "D*") { $deletions += $path }
    $stagedPaths += $path
}

if ($deletions.Count -gt 0) {
    Write-Output "ABORT: a deletion is staged. The sweep adds untracked files only, so this"
    Write-Output "means something else staged it. Nothing has been committed. Deleted paths:"
    foreach ($p in $deletions) { Write-Output ("    " + $p) }
    $null = Invoke-Git -GitArgs (@("restore", "--staged", "--") + $sweepable) -AllowFailure
    exit 1
}

$unexpected = @($stagedPaths | Where-Object { $sweepable -notcontains $_ })
if ($unexpected.Count -gt 0) {
    Write-Output "ABORT: the index holds paths the sweep did not choose. Nothing has been"
    Write-Output "committed. Unexpected paths:"
    foreach ($p in $unexpected) { Write-Output ("    " + $p) }
    $null = Invoke-Git -GitArgs (@("restore", "--staged", "--") + $sweepable) -AllowFailure
    exit 1
}

$subject = "docs(pipeline): sweep " + $sweepable.Count + " breadcrumb(s) " + $stamp
$body = @(
    "Batched by scripts/pipeline/sweep-breadcrumbs.ps1.",
    "",
    "Stations leave breadcrumbs untracked (NO-DRIFT); this job is the one actor",
    "that commits them, on a branch, through a PR. No file here was armed:",
    "-ready.md and -HOLD.md are refused by the sweep.",
    "",
    "Files:"
) + ($sweepable | ForEach-Object { "  " + $_ })

$commitArgs = @("commit", "-m", $subject)
foreach ($line in $body) { $commitArgs += @("-m", $line) }
$null = Invoke-Git -GitArgs $commitArgs
Write-Step ("Committed " + $sweepable.Count + " file(s) on " + $branch)

# ---------------------------------------------------------------------------
# 7. Push and open the PR
# ---------------------------------------------------------------------------

$push = Invoke-Git -GitArgs @("push", "-u", "origin", $branch) -AllowFailure
if ($push.ExitCode -ne 0) {
    Write-Output "PUSH FAILED. The commit is safe on branch '$branch' in this tree."
    Write-Output ($push.Output -join "`n")
    exit 1
}
Write-Step ("Pushed " + $branch)

if ($NoPr) {
    Write-Output ("-NoPr: branch pushed, PR not opened. Open it with: gh pr create --head " + $branch)
    exit 0
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Output "gh is not on PATH. The branch is pushed; open the PR by hand:"
    Write-Output ("    gh pr create --head " + $branch + " --title '" + $subject + "'")
    exit 1
}

& gh pr create --head $branch --title $subject --body ($body -join "`n")
if ($LASTEXITCODE -ne 0) {
    Write-Output ("gh pr create failed. The branch '" + $branch + "' is pushed; open the PR by hand.")
    exit 1
}

Write-Step "PR opened."
exit 0
