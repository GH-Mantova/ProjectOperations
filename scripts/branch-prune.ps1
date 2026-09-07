#Requires -Version 5.1
<#
.SYNOPSIS
    Plan (and, only with -Apply, perform) a guarded prune of LOCAL git branches.

.DESCRIPTION
    WHY THIS SCRIPT EXISTS
    ----------------------
    Two callers invoked scripts/branch-prune.ps1 and the file did not exist: the "GH Branch
    Prune" scheduled task, and .vscode/tasks.json. Both failed silently, and the VS Code task
    did not stop there - it fell through to

        git branch -vv | Select-String ': gone]' | ForEach-Object { git branch -D ... }

    which force-deletes EVERY branch whose upstream reads [gone], with no check for unpushed
    commits, open PRs or worktrees. Measured 2026-09-03: branch fix1483 carried 28 commits that
    existed nowhere else and read [gone] until it was pushed that morning. One click on that
    task would have destroyed them.

    THE BAR THIS SCRIPT IS WRITTEN TO
    --------------------------------
    It must be INCAPABLE of removing a branch whose commits are not already upstream, and it
    must PROVE that per branch before acting rather than assume it. Every probe is fail-closed:
    a command that errors, returns nothing parseable, or that this script cannot interpret
    means KEEP. Refusing to prune is an annoyance; pruning wrongly is a catastrophe.

    WHY "MERGED INTO main" IS NOT THE TEST
    --------------------------------------
    This repo squash-merges. A squash collapses a branch's commits into one new commit with a
    new sha, so `git branch --merged main` finds almost nothing - the branch's own commits are
    genuinely unreachable from main even though the CONTENT landed. "Merged" is therefore both
    too weak (misses squashes) and the wrong question. The question this script actually asks
    is: IS EVERY COMMIT ON THIS BRANCH ALREADY REPRESENTED UPSTREAM? It answers with three
    independent, individually-sufficient proofs, all anchored on origin/main:

      A1 ANCESTOR   git merge-base --is-ancestor <tip> origin/main exits 0.
                    The commits are literally on main. Nothing can be lost.

      A2 PATCH-EQUIV  git cherry origin/main <branch> emits zero '+' lines.
                    Every commit on the branch has a patch-identical twin upstream. This is
                    the test that would have saved fix1483: 28 unique commits are 28 '+'
                    lines, so the branch is KEPT.

      A3 SQUASHED   the combined diff of <merge-base>..<branch> has the same patch-id as some
                    single commit in <merge-base>..origin/main. That single commit IS the
                    squash. A2 alone cannot see this, because a 3-commit branch squashed into
                    1 upstream commit has three patch-ids that match nothing - A2 keeps it
                    (safe, but useless). A3 is what makes the tool worth running.

    A3 is safe by construction: a patch-id match means a byte-identical combined diff exists as
    a commit on origin/main, i.e. the content landed. A miss keeps the branch.

    WHY origin/main AND NOT "any remote-tracking ref"
    -------------------------------------------------
    An earlier shape of this check asked `git branch -r --contains <tip>`. That is WRONG.
    Remote-tracking refs are a local cache: refs/remotes/origin/foo can still name a commit
    that GitHub deleted weeks ago, and "contained in origin/foo" would then be a proof of
    nothing. Every arm above is anchored on origin/main only. A STALE origin/main is fail-safe
    in the correct direction: an older origin/main contains fewer commits and fewer patches, so
    fewer branches qualify and MORE are kept.

    NOTHING IS DELETED, IT IS QUARANTINED
    -------------------------------------
    The house rule is that nothing gets deleted; things move to a dated quarantine that mirrors
    their original path, and emptying that quarantine is the owner's decision. A manifest file
    alone does not meet that bar: once `git branch -D` runs, the commits are unreachable and
    `git gc` may prune them within weeks, so a manifest sha can go dead. So before each
    deletion this script writes a QUARANTINE REF:

        refs/quarantine/branch-prune/<UTC stamp>/<original branch name>

    A ref keeps the objects reachable indefinitely - gc will never collect them - and the
    namespace mirrors the branch name exactly. Restoring is
    `git branch <name> refs/quarantine/branch-prune/<stamp>/<name>`. Quarantine refs live
    outside refs/heads/, so `git branch` stays clean. This script NEVER removes a quarantine
    ref; that is the owner's decision.

.PARAMETER Repo
    Repository to operate on. Default C:\ProjectOperations2. Never the watcher clone.

.PARAMETER DryRun
    Explicitly request the default behaviour: plan only, delete nothing. Accepted so a caller
    can state the intent at the call site. Passing BOTH -DryRun and -Apply is contradictory
    intent and ABORTS - an ambiguous instruction to a destructive tool is refused, not guessed.

.PARAMETER Apply
    The ONLY switch that permits deletion. Dry run is the default because the caller is either
    a button a human clicks or an unattended scheduled task; with a destructive default the
    safe invocation and the dangerous one are textually identical and no reviewer of
    .vscode/tasks.json can tell them apart. With this shape the dangerous invocation is
    greppable: it has -Apply in it.

.PARAMETER Keep
    Glob(s) of branch names to protect unconditionally, e.g. -Keep 'release/*','wip-*'.

.PARAMETER MaxDelete
    Refuse the whole run (deleting nothing) if the plan exceeds this many branches. Default 50.
    Removing 190 branches at once should be a decision the operator states, not a side effect
    of a schedule. The run is REFUSED rather than truncated: silently pruning a plan would hide
    which branches were skipped and why.

.PARAMETER ManifestRoot
    Where the restore manifest is written. Default C:\_SWEEP-branch-prune.

.PARAMETER SquashScanDepth
    How many recent origin/main commits to fingerprint for the A3 squash proof. Default 500.
    Truncation is fail-safe: fewer fingerprints means fewer matches means more branches kept.

.EXAMPLE
    powershell -NoProfile -File scripts/branch-prune.ps1
    The control. Prints the plan, deletes nothing, exits 0.

.EXAMPLE
    powershell -NoProfile -File scripts/branch-prune.ps1 -Apply
    Quarantines and deletes only branches with a proof, and only if the sweep says SAFE TO ACT.

.NOTES
    Pure ASCII, deliberately. A BOM-less UTF-8 .ps1 containing non-ASCII bytes is decoded as
    Windows-1252 by Windows PowerShell 5.1 and fails to parse; pure ASCII is decoded identically
    with or without a BOM, so it cannot hit that trap at all.

    LOCAL BRANCHES ONLY. This script has no code path that contacts a remote to mutate it: no
    `git push`, no `git push --delete`, no `gh api` write. GitHub already deletes the remote
    branch on squash-merge; local refs are the only thing left to tidy.
#>

[CmdletBinding()]
param(
    [string]$Repo = "C:\ProjectOperations2",
    [switch]$DryRun,
    [switch]$Apply,
    [string[]]$Keep = @(),
    [int]$MaxDelete = 50,
    [string]$ManifestRoot = "C:\_SWEEP-branch-prune",
    [int]$SquashScanDepth = 500
)

# git writes progress and warnings to stderr on healthy runs. "Stop" would turn those into
# terminating errors, so exit codes are checked by hand instead, everywhere, without exception.
$ErrorActionPreference = "Continue"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# The watcher clone has its own branches and stashes and is not this script's business.
$WATCHER_CLONE   = "C:\po-watcher\ProjectOperations"
$UPSTREAM        = "origin/main"
$SWEEP_REL       = "scripts\pipeline\status-sweep.ps1"
$SWEEP_SAFE      = "SAFE TO ACT:"
$SWEEP_BLOCK     = "DO NOT ACT:"
$SWEEP_CAUTION   = "CAUTION:"
$QUARANTINE_ROOT = "refs/quarantine/branch-prune"
# Never eligible, whatever the proofs say.
$PROTECTED       = @("main", "master", "HEAD")
# Unit Separator. for-each-ref renders %1f as a raw 0x1F byte, which cannot occur in a git ref
# name, so field splitting stays correct even for a branch called "weird|name".
$SEP             = [char]0x1F

$EXIT_OK    = 0
$EXIT_ABORT = 2

$script:RepoPath = $Repo

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step([string]$msg) { Write-Host "[branch-prune] $msg" }
function Write-Fail([string]$msg) { Write-Host "[branch-prune] ABORT: $msg" }

# Run git in the target repo. Returns a PSCustomObject so the caller can inspect the exit code
# instead of guessing from empty output. NOTE: $Args is a reserved automatic variable in
# PowerShell; using it as a parameter name silently shadows it. Hence $GitArgs.
function Invoke-Git {
    param([string[]]$GitArgs)
    $raw = & git -C $script:RepoPath @GitArgs 2>&1
    $code = $LASTEXITCODE
    $out = @($raw |
        Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
        ForEach-Object { "$_".TrimEnd() })
    return [PSCustomObject]@{ Ok = ($code -eq 0); Code = $code; Lines = $out }
}

# True only if the command succeeded AND matched. Any failure is a miss, never a pass.
function Test-GitOk {
    param([string[]]$GitArgs)
    $null = & git -C $script:RepoPath @GitArgs 2>&1
    return ($LASTEXITCODE -eq 0)
}

function Test-AnyGlob {
    param([string]$Name, [string[]]$Globs)
    foreach ($g in $Globs) {
        if ([string]::IsNullOrWhiteSpace($g)) { continue }
        if ($Name -like $g) { return $true }
    }
    return $false
}

# ---------------------------------------------------------------------------
# Step 0 - mode. Contradictory intent is refused, not resolved.
# ---------------------------------------------------------------------------

if ($DryRun -and $Apply) {
    Write-Fail "-DryRun and -Apply were both supplied. Refusing to guess which one you meant."
    exit $EXIT_ABORT
}
$applying = [bool]$Apply
$mode = if ($applying) { "APPLY" } else { "DRY RUN (default)" }

Write-Step "mode: $mode"
Write-Step "repo: $Repo"

# ---------------------------------------------------------------------------
# Step 1 - preflight. Everything that makes the run interpretable at all.
# ---------------------------------------------------------------------------

if (-not (Test-Path -LiteralPath $Repo)) {
    Write-Fail "repo path does not exist: $Repo"
    exit $EXIT_ABORT
}

$repoFull    = (Resolve-Path -LiteralPath $Repo).ProviderPath
$watcherFull = $null
if (Test-Path -LiteralPath $WATCHER_CLONE) {
    $watcherFull = (Resolve-Path -LiteralPath $WATCHER_CLONE).ProviderPath
}
if ($watcherFull -and ($repoFull.TrimEnd('\') -ieq $watcherFull.TrimEnd('\'))) {
    Write-Fail "refusing to run in the watcher clone ($WATCHER_CLONE). It owns its own branches."
    exit $EXIT_ABORT
}
$script:RepoPath = $repoFull

$topLevel = Invoke-Git @("rev-parse", "--show-toplevel")
if (-not $topLevel.Ok) {
    Write-Fail "not a git repository: $repoFull"
    exit $EXIT_ABORT
}

# origin/main is the anchor for all three proofs. Without it nothing can be proven, so nothing
# may be deleted.
if (-not (Test-GitOk @("rev-parse", "--verify", "--quiet", "$UPSTREAM^{commit}"))) {
    Write-Fail "$UPSTREAM does not resolve. Every safety proof is anchored on it; refusing to run."
    exit $EXIT_ABORT
}
$upstreamSha = (Invoke-Git @("rev-parse", $UPSTREAM)).Lines | Select-Object -First 1
$upstreamAge = (Invoke-Git @("log", "-1", "--format=%cI", $UPSTREAM)).Lines | Select-Object -First 1
Write-Step "$UPSTREAM = $upstreamSha (committed $upstreamAge)"
Write-Step "NOTE: a stale $UPSTREAM is fail-safe - it can only cause branches to be KEPT."

# ---------------------------------------------------------------------------
# Step 2 - open PRs, from GitHub, in BOTH modes.
# ---------------------------------------------------------------------------
# Only GitHub knows which branches have an open PR; local state cannot be asked. A prune that
# cannot see the open PRs is exactly the prune that eats one, so failure aborts.
#
# This also aborts in dry run, deliberately. The dry-run plan is a decision input a human acts
# on; a plan that says "would delete X" while X has an open PR is a lie, and a lie in the safe
# mode is how the unsafe mode gets trusted.
#
# --limit is load-bearing: `gh pr list` defaults to THIRTY results. On a board with more open
# PRs than that, the heads past the limit are invisible and would be pruned. We ask for far
# more than the board can plausibly hold and then refuse if the answer came back exactly at the
# limit, because at the limit we cannot prove we saw them all.

$PR_LIMIT = 500
$openPrHeads = @()
$ghCode = 1
$ghRaw = @()
$pushed = $false
try {
    Push-Location -LiteralPath $repoFull -ErrorAction Stop
    $pushed = $true
    $ghRaw = @(& gh pr list --state open --limit $PR_LIMIT --json headRefName 2>&1)
    $ghCode = $LASTEXITCODE
} catch {
    $ghCode = 1
    $ghRaw = @("$_")
} finally {
    if ($pushed) { Pop-Location }
}

if ($ghCode -ne 0) {
    Write-Fail "gh pr list failed (exit $ghCode). Cannot see open PRs, so cannot prune safely."
    Write-Host ($ghRaw | Out-String)
    exit $EXIT_ABORT
}

# stdout only. gh is entitled to write progress and auth notices to stderr on a SUCCESSFUL
# call, and folding those into the payload would turn a healthy run into a parse failure.
$ghJson = ($ghRaw |
    Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
    ForEach-Object { "$_" }) -join "`n"
try {
    $prs = @($ghJson | ConvertFrom-Json)
} catch {
    Write-Fail "gh pr list returned output that is not JSON. Refusing to prune blind."
    exit $EXIT_ABORT
}
foreach ($p in $prs) {
    if ($p -and $p.headRefName) { $openPrHeads += [string]$p.headRefName }
}
if ($openPrHeads.Count -ge $PR_LIMIT) {
    Write-Fail "gh returned $($openPrHeads.Count) open PRs, at the --limit of $PR_LIMIT. Cannot prove the list is complete."
    exit $EXIT_ABORT
}
Write-Step "open PR head branches on GitHub: $($openPrHeads.Count)"

# ---------------------------------------------------------------------------
# Step 3 - worktrees and HEAD, read rather than guessed.
# ---------------------------------------------------------------------------

$wtRes = Invoke-Git @("worktree", "list", "--porcelain")
if (-not $wtRes.Ok) {
    Write-Fail "git worktree list failed. A branch checked out in a worktree must never be pruned."
    exit $EXIT_ABORT
}
$worktreeBranches = @()
foreach ($line in $wtRes.Lines) {
    if ($line -match '^branch\s+refs/heads/(.+)$') { $worktreeBranches += $Matches[1] }
}

$headRes = Invoke-Git @("rev-parse", "--abbrev-ref", "HEAD")
$currentBranch = if ($headRes.Ok) { $headRes.Lines | Select-Object -First 1 } else { $null }
if (-not $headRes.Ok) {
    Write-Fail "cannot read HEAD. Refusing to run without knowing what is checked out."
    exit $EXIT_ABORT
}
Write-Step "branches held by a worktree: $($worktreeBranches.Count); HEAD: $currentBranch"

# ---------------------------------------------------------------------------
# Step 4 - enumerate local branches.
# ---------------------------------------------------------------------------

$fmt = "%(refname:short)%1f%(objectname)%1f%(upstream)%1f%(upstream:track)%1f%(committerdate:iso8601-strict)"
$refRes = Invoke-Git @("for-each-ref", "--format=$fmt", "refs/heads/")
if (-not $refRes.Ok) {
    Write-Fail "git for-each-ref failed. Refusing to run on an unreadable ref list."
    exit $EXIT_ABORT
}

$branches = @()
foreach ($line in $refRes.Lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $f = "$line".Split($SEP)
    if ($f.Count -lt 5) { continue }
    $branches += [PSCustomObject]@{
        Name     = $f[0]
        Sha      = $f[1]
        Upstream = $f[2]
        Track    = $f[3]
        Date     = $f[4]
    }
}
Write-Step "local branches: $($branches.Count)"

# ---------------------------------------------------------------------------
# Step 5 - the A3 squash fingerprint map, built once and lazily.
# ---------------------------------------------------------------------------
# Fingerprints the newest $SquashScanDepth non-merge commits on origin/main by patch-id. A
# squash-merge of a branch appears here as exactly one entry whose id equals the patch-id of
# the branch's whole merge-base..tip range.

$script:SquashMap = $null

function Get-SquashMap {
    if ($null -ne $script:SquashMap) { return $script:SquashMap }
    $map = @{}
    $listRes = Invoke-Git @("rev-list", "--no-merges", "--max-count=$SquashScanDepth", $UPSTREAM)
    if (-not $listRes.Ok) {
        # Fail-closed: an empty map matches nothing, so every branch relying on A3 is kept.
        Write-Step "WARN: could not list $UPSTREAM commits; the squash proof is disabled this run."
        $script:SquashMap = $map
        return $map
    }
    foreach ($c in $listRes.Lines) {
        if ([string]::IsNullOrWhiteSpace($c)) { continue }
        # diff-tree --root, not "diff $c~1 $c": the latter throws on the repository's
        # very first commit, which has no parent. The hunk text is identical either way.
        $id = Get-PatchId @("diff-tree", "-p", "--root", "--no-color", "--no-ext-diff", $c)
        if ($id) { $map[$id] = $c }
    }
    $script:SquashMap = $map
    return $map
}

# Both sides of the A3 comparison go through this one function with the same flags, so any
# encoding the shell applies to the piped diff is applied identically to both.
function Get-PatchId {
    param([string[]]$DiffArgs)
    $id = $null
    try {
        $out = & git -C $script:RepoPath @DiffArgs 2>$null | & git -C $script:RepoPath patch-id --stable 2>$null
        if ($LASTEXITCODE -eq 0 -and $out) {
            $first = @($out)[0]
            if ("$first" -match '^([0-9a-f]{40,64})\b') { $id = $Matches[1] }
        }
    } catch {
        $id = $null
    }
    return $id
}

# ---------------------------------------------------------------------------
# Step 6 - classify. Every branch gets a decision AND a stated reason.
# ---------------------------------------------------------------------------
# Exclusions are evaluated first and are absolute. Only a branch that survives all of them is
# even asked for a proof, and it needs exactly one of the three to qualify.

function Get-BranchVerdict {
    param([PSCustomObject]$B)

    if ($PROTECTED -contains $B.Name) {
        return [PSCustomObject]@{ Delete = $false; Reason = "protected branch name" }
    }
    # The restore manifest is written as ASCII. A name outside ASCII would be recorded
    # mangled, i.e. an audit trail that misnames the thing it is meant to protect, so such a
    # branch is simply never eligible.
    if ($B.Name -notmatch '^[\x20-\x7E]+$') {
        return [PSCustomObject]@{ Delete = $false; Reason = "branch name is not pure ASCII - not recordable in the manifest" }
    }
    if ($B.Name -eq $currentBranch) {
        return [PSCustomObject]@{ Delete = $false; Reason = "currently checked out" }
    }
    if ($worktreeBranches -contains $B.Name) {
        return [PSCustomObject]@{ Delete = $false; Reason = "checked out in a worktree" }
    }
    if ($openPrHeads -contains $B.Name) {
        return [PSCustomObject]@{ Delete = $false; Reason = "head of an OPEN PR on GitHub" }
    }
    if (Test-AnyGlob -Name $B.Name -Globs $Keep) {
        return [PSCustomObject]@{ Delete = $false; Reason = "matched -Keep" }
    }
    # An upstream that still exists means the remote still holds this branch. Only [gone] - the
    # remote branch having been deleted, normally by squash-merge - makes a branch a candidate.
    if ($B.Upstream -and ($B.Track -notlike "*gone*")) {
        return [PSCustomObject]@{ Delete = $false; Reason = "upstream $($B.Upstream) still exists (track '$($B.Track)')" }
    }

    # ---- proofs ----
    if (Test-GitOk @("merge-base", "--is-ancestor", $B.Sha, $UPSTREAM)) {
        return [PSCustomObject]@{ Delete = $true; Reason = "A1 ancestor of $UPSTREAM" }
    }

    $cherry = Invoke-Git @("cherry", $UPSTREAM, $B.Name)
    if (-not $cherry.Ok) {
        return [PSCustomObject]@{ Delete = $false; Reason = "git cherry failed (exit $($cherry.Code)) - unproven, so kept" }
    }
    $ahead = @($cherry.Lines | Where-Object { $_ -like "+*" })
    if ($ahead.Count -eq 0) {
        return [PSCustomObject]@{ Delete = $true; Reason = "A2 every commit is patch-identical to one on $UPSTREAM" }
    }

    $mbRes = Invoke-Git @("merge-base", $UPSTREAM, $B.Sha)
    if (-not $mbRes.Ok) {
        return [PSCustomObject]@{ Delete = $false; Reason = "no merge-base with $UPSTREAM - unproven, so kept" }
    }
    $mb = $mbRes.Lines | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($mb)) {
        return [PSCustomObject]@{ Delete = $false; Reason = "empty merge-base with $UPSTREAM - unproven, so kept" }
    }
    $combined = Get-PatchId @("diff", "--no-color", "--no-ext-diff", $mb, $B.Sha)
    if ($combined) {
        $map = Get-SquashMap
        if ($map.ContainsKey($combined)) {
            return [PSCustomObject]@{ Delete = $true; Reason = "A3 squash-merged as $($map[$combined]) on $UPSTREAM" }
        }
    }

    return [PSCustomObject]@{
        Delete = $false
        Reason = "$($ahead.Count) commit(s) exist ONLY here - not on $UPSTREAM by sha or by patch"
    }
}

$plan = @()
foreach ($b in $branches) {
    $v = Get-BranchVerdict -B $b
    $plan += [PSCustomObject]@{
        Name = $b.Name; Sha = $b.Sha; Date = $b.Date
        Delete = $v.Delete; Reason = $v.Reason
    }
}

$toDelete = @($plan | Where-Object { $_.Delete } | Sort-Object Name)
$toKeep   = @($plan | Where-Object { -not $_.Delete } | Sort-Object Name)

Write-Host ""
Write-Host "==================== KEPT ($($toKeep.Count)) ===================="
foreach ($k in $toKeep) { Write-Host ("  KEEP    " + $k.Name + "  --  " + $k.Reason) }
Write-Host ""
Write-Host "==================== ELIGIBLE ($($toDelete.Count)) ===================="
foreach ($d in $toDelete) { Write-Host ("  DELETE  " + $d.Name + "  " + $d.Sha.Substring(0, 8) + "  --  " + $d.Reason) }
Write-Host ""

if (-not $applying) {
    Write-Step "DRY RUN: nothing was deleted. Re-run with -Apply to act on the ELIGIBLE list."
    exit $EXIT_OK
}

# ---------------------------------------------------------------------------
# Step 7 - APPLY. Everything below this line can change refs.
# ---------------------------------------------------------------------------

if ($toDelete.Count -eq 0) {
    Write-Step "nothing eligible. Done."
    exit $EXIT_OK
}

if ($toDelete.Count -gt $MaxDelete) {
    Write-Fail "$($toDelete.Count) branches are eligible, over -MaxDelete $MaxDelete. Nothing deleted."
    Write-Step "Re-run with an explicit -MaxDelete $($toDelete.Count) if that list is what you intend."
    exit $EXIT_ABORT
}

# The sweep gate. Deleting refs takes the same lock the watcher checks out against, and a prune
# racing a checkout is how a 0-byte .git/index.lock gets made (DOCTRINE 9.2, seven occurrences).
# Gated on -Apply only: a dry run takes no lock and writes nothing, and making the SAFE mode
# depend on a live GitHub sweep would push operators toward -Apply, which is backwards.
#
# The verdict strings below are copied from status-sweep.ps1 section 7, not assumed.
$sweep = Join-Path $repoFull $SWEEP_REL
if (-not (Test-Path -LiteralPath $sweep)) {
    Write-Fail "status-sweep.ps1 not found at $sweep. The safe-to-act gate cannot be evaluated."
    exit $EXIT_ABORT
}
Write-Step "running the safe-to-act gate: $SWEEP_REL"
$sweepOut = "" + (& powershell -NoProfile -ExecutionPolicy Bypass -File $sweep 2>&1 | Out-String)
$sawSafe    = $sweepOut.Contains($SWEEP_SAFE)
$sawBlock   = $sweepOut.Contains($SWEEP_BLOCK)
$sawCaution = $sweepOut.Contains($SWEEP_CAUTION)
if ((-not $sawSafe) -or $sawBlock -or $sawCaution) {
    Write-Step "sweep verdict is not the safe one. Deleting nothing."
    foreach ($l in ($sweepOut -split '\r?\n')) {
        if ($l -match 'DO NOT ACT|CAUTION|SAFE TO ACT') { Write-Host "  $l" }
    }
    exit $EXIT_OK
}
Write-Step "sweep says SAFE TO ACT."

# The manifest is written BEFORE anything is touched. If it cannot be written, nothing happens.
$utcNow = (Get-Date).ToUniversalTime()
$stamp = $utcNow.ToString("yyyyMMdd") + "T" + $utcNow.ToString("HHmmss")
$manifest = Join-Path $ManifestRoot "$stamp.txt"
try {
    if (-not (Test-Path -LiteralPath $ManifestRoot)) {
        $null = New-Item -ItemType Directory -Path $ManifestRoot -Force -ErrorAction Stop
    }
    $header = @(
        "# branch-prune restore manifest",
        "# generated (UTC): $stamp",
        "# repo: $repoFull",
        "# $UPSTREAM at plan time: $upstreamSha",
        "#",
        "# NOTHING HERE WAS DESTROYED. Every branch below was copied to a quarantine ref before",
        "# its refs/heads/ entry was removed, so its commits stay reachable and git gc will",
        "# never collect them. Emptying the quarantine is the owner's decision, never the tool's.",
        "#",
        "# To restore one branch, either of these works:",
        "#   git branch <name> <sha>",
        "#   git branch <name> $QUARANTINE_ROOT/$stamp/<name>",
        "#",
        "# <sha>  <committerdate>  <name>"
    )
    Set-Content -LiteralPath $manifest -Value $header -Encoding ASCII -ErrorAction Stop
} catch {
    Write-Fail "cannot write the restore manifest at $manifest - $($_.Exception.Message)"
    exit $EXIT_ABORT
}
foreach ($d in $toDelete) {
    Add-Content -LiteralPath $manifest -Value ("{0}  {1}  {2}" -f $d.Sha, $d.Date, $d.Name) -Encoding ASCII
}
Write-Step "manifest written: $manifest"

$deleted = 0
$skipped = 0
foreach ($d in $toDelete) {
    # RE-PROVE, immediately before acting. The plan was computed minutes ago; the sweep and the
    # manifest took time, and a station may have advanced this branch in between. If the tip
    # moved even by one commit, the proof no longer covers what is there now.
    $nowSha = (Invoke-Git @("rev-parse", "--verify", "--quiet", "refs/heads/$($d.Name)")).Lines | Select-Object -First 1
    if ("$nowSha" -ne $d.Sha) {
        Write-Host "  SKIP    $($d.Name) -- tip moved since the plan was computed ($($d.Sha) -> $nowSha)"
        $skipped++
        continue
    }
    # Re-read the branch's real record rather than reconstructing one. A fabricated record
    # would decide the upstream exclusion for itself, which is the one thing a re-check must
    # not do.
    $freshRes = Invoke-Git @("for-each-ref", "--format=$fmt", "refs/heads/$($d.Name)")
    $freshLine = @($freshRes.Lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })[0]
    if ((-not $freshRes.Ok) -or (-not $freshLine)) {
        Write-Host "  SKIP    $($d.Name) -- could not re-read its ref; refusing to delete unproven."
        $skipped++
        continue
    }
    $ff = "$freshLine".Split($SEP)
    if ($ff.Count -lt 5) {
        Write-Host "  SKIP    $($d.Name) -- unparseable ref record on re-read; refusing to delete."
        $skipped++
        continue
    }
    $again = Get-BranchVerdict -B ([PSCustomObject]@{
        Name = $ff[0]; Sha = $ff[1]; Upstream = $ff[2]; Track = $ff[3]; Date = $ff[4] })
    if (-not $again.Delete) {
        Write-Host "  SKIP    $($d.Name) -- re-check no longer proves it: $($again.Reason)"
        $skipped++
        continue
    }

    # Quarantine BEFORE deletion, and verify the quarantine ref actually landed on the same sha.
    $qref = "$QUARANTINE_ROOT/$stamp/$($d.Name)"
    if (-not (Test-GitOk @("check-ref-format", $qref))) {
        Write-Host "  SKIP    $($d.Name) -- cannot form a valid quarantine ref name; refusing to delete."
        $skipped++
        continue
    }
    if (-not (Test-GitOk @("update-ref", $qref, $d.Sha))) {
        Write-Host "  SKIP    $($d.Name) -- quarantine ref could not be written; refusing to delete."
        $skipped++
        continue
    }
    $qsha = (Invoke-Git @("rev-parse", "--verify", "--quiet", $qref)).Lines | Select-Object -First 1
    if ("$qsha" -ne $d.Sha) {
        Write-Host "  SKIP    $($d.Name) -- quarantine ref does not read back as $($d.Sha); refusing to delete."
        $skipped++
        continue
    }

    $del = Invoke-Git @("branch", "-D", $d.Name)
    if ($del.Ok) {
        Write-Host "  PRUNED  $($d.Name) -> $qref"
        $deleted++
    } else {
        Write-Host "  SKIP    $($d.Name) -- git branch -D failed (exit $($del.Code)); quarantine ref left in place."
        $skipped++
    }
}

Write-Host ""
Write-Step "pruned $deleted, skipped $skipped. Manifest: $manifest"
Write-Step "restore: git branch <name> $QUARANTINE_ROOT/$stamp/<name>"
exit $EXIT_OK
