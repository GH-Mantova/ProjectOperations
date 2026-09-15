<#
  PO_WORKTREE_HELPER_V1 - the ONE way a station, lane or chat creates a worktree.

  Why this exists: before 2026-09-15 every station, lane and chat wrote its own
  `git worktree add C:\<something>` by hand. PR-MASTER.md has named
  C:\PR-Master\worktrees\<slug> as the only root since 2026-09-11, but a convention no
  instrument enforces is a preference: supervised lane 0003 alone hard-coded 25 distinct
  paths, most of them at the drive root, and Marco's C: filled with po-* folders. The
  path is now computed here, from a slug, and a caller cannot write a path at all.

  USE:
    $wt = & scripts\pipeline\new-worktree.ps1 -Slug rcpt-1964 -Branch po/receipt-1964
    $wt = & scripts\pipeline\new-worktree.ps1 -Slug smoke-0712            # detached at origin/main
    & scripts\pipeline\new-worktree.ps1 -Slug rcpt-1964 -Remove

  The ONLY thing written to the success stream is the absolute path, so `$wt = & ...`
  captures the path and nothing else; everything else goes to the host.

  EXIT: 0 ok | 2 bad slug | 3 refused root | 4 path occupied by a non-worktree | 5 git failed
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Slug,
  [string]$Ref = "origin/main",
  [string]$Branch = "",
  [string]$Repo = "",
  [string]$Root = "",
  [switch]$Remove,
  [switch]$Force,
  [switch]$NoFetch
)

$ErrorActionPreference = "Continue"

if (-not $Repo) { $Repo = if ($env:PO_REPO_ROOT) { $env:PO_REPO_ROOT } else { "C:\ProjectOperations2" } }
if (-not $Root) { $Root = if ($env:PO_WORKTREE_ROOT) { $env:PO_WORKTREE_ROOT } else { "C:\PR-Master\worktrees" } }

# --- slug: the caller supplies a NAME, never a path -------------------------------------
if ($Slug -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') {
  Write-Host "REFUSED: slug '$Slug' is not a bare name. Allowed: [A-Za-z0-9._-], 1-64 chars, no separators."
  Write-Host "         A slug is a name, not a path - the root is this script's business."
  exit 2
}
if ($Slug -match '\.\.') { Write-Host "REFUSED: slug contains '..'"; exit 2 }

# --- root: never the drive root, never the repo itself ----------------------------------
$Root = $Root.TrimEnd('\')
if ($Root -match '^[A-Za-z]:$' -or $Root -match '^[A-Za-z]:\\?$') {
  Write-Host "REFUSED: root '$Root' is a drive root. This is the defect this script exists to prevent."
  exit 3
}
if ((Split-Path $Root -Parent) -eq "") { Write-Host "REFUSED: root '$Root' has no parent."; exit 3 }

$wt = Join-Path $Root $Slug
if ((Split-Path $wt -Parent).TrimEnd('\') -ne $Root) {
  Write-Host "REFUSED: '$wt' does not sit directly under '$Root'."
  exit 3
}

function Test-IsWorktree([string]$p) {
  # A worktree's .git is a FILE (gitdir: ...); a clone's is a DIRECTORY.
  $g = Join-Path $p ".git"
  return (Test-Path $g -PathType Leaf)
}

# --- teardown ----------------------------------------------------------------------------
if ($Remove) {
  if (-not (Test-Path $wt)) {
    Write-Host "not present: $wt"
    & git -C $Repo worktree prune
    exit 0
  }
  if (-not (Test-IsWorktree $wt)) {
    Write-Host "REFUSED: $wt exists but is not a worktree (.git is not a file). Not touching it."
    Write-Host "         Quarantine it by hand: move it to C:\PR-Master\_retired-<yyyy-MM-dd>\. Never delete."
    exit 4
  }
  & git -C $Repo worktree remove --force $wt
  if ($LASTEXITCODE -ne 0) { Write-Host "git worktree remove failed ($LASTEXITCODE)"; exit 5 }
  & git -C $Repo worktree prune
  Write-Host "removed: $wt"
  exit 0
}

# --- create ------------------------------------------------------------------------------
if (-not (Test-Path $Root)) { New-Item -ItemType Directory -Path $Root -Force | Out-Null }

& git -C $Repo worktree prune

if (Test-Path $wt) {
  if (-not (Test-IsWorktree $wt)) {
    Write-Host "REFUSED: $wt already exists and is not a worktree. Not touching it."
    Write-Host "         Pick another slug, or quarantine that folder to C:\PR-Master\_retired-<yyyy-MM-dd>\."
    exit 4
  }
  if (-not $Force) {
    Write-Host "REFUSED: worktree $wt already exists. Re-run with -Force to replace it, or -Remove first."
    exit 4
  }
  Write-Host "replacing existing worktree $wt (-Force)"
  & git -C $Repo worktree remove --force $wt
  if ($LASTEXITCODE -ne 0) { Write-Host "git worktree remove failed ($LASTEXITCODE)"; exit 5 }
  & git -C $Repo worktree prune
}

if (-not $NoFetch) { & git -C $Repo fetch origin --quiet }

if ($Branch) {
  & git -C $Repo branch -D $Branch 2>&1 | Out-Null
  & git -C $Repo worktree add -b $Branch $wt $Ref
} else {
  & git -C $Repo worktree add --detach $wt $Ref
}
if ($LASTEXITCODE -ne 0) { Write-Host "git worktree add failed ($LASTEXITCODE)"; exit 5 }

if (-not (Test-IsWorktree $wt)) {
  Write-Host "git reported success but $wt\.git is not a file - refusing to hand back a path that is not a worktree."
  exit 5
}

$head = (& git -C $wt rev-parse HEAD).Trim()
Write-Host "worktree: $wt"
Write-Host "ref:      $Ref -> $head"
if ($Branch) { Write-Host "branch:   $Branch" } else { Write-Host "branch:   (detached)" }

# The ONLY success-stream output: the path.
Write-Output $wt
exit 0
