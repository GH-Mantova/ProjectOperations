# Rebase the sot-reconcile branch onto origin/main and open the PR.
# Runs in the ISOLATED worktree C:\po-fix so Marco's tree is never checked out or disturbed.
$ErrorActionPreference = "Continue"

$branch = "docs/sot-reconcile-2026-07-14"
$wt = "C:\po-fix"

Set-Location $wt
Write-Output "=== worktree"
git rev-parse --show-toplevel

git fetch origin --quiet
git switch $branch 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$now = (git rev-parse --abbrev-ref HEAD).Trim()
if ($now -ne $branch) { Write-Output ("  FAILED: on " + $now); exit 1 }

Write-Output ""
Write-Output "=== rebase onto origin/main"
git rebase origin/main 2>&1 | ForEach-Object { Write-Output ("  " + $_) }

# Did the rebase leave us mid-flight? That is the ONLY corruption signal that matters.
if (Test-Path (Join-Path (git rev-parse --git-dir) "rebase-merge")) {
    Write-Output "  *** CONFLICT - stopped mid-rebase. NOT aborting; leaving it for inspection."
    git diff --name-only --diff-filter=U | ForEach-Object { Write-Output ("    conflict: " + $_) }
    exit 2
}
Write-Output ("  READBACK: rebased cleanly onto " + (git rev-parse --short origin/main).Trim())

Write-Output ""
Write-Output "=== files in this branch vs main (must be sot/ only - CP-24)"
$files = @(git diff --name-only origin/main...HEAD)
foreach ($f in $files) { Write-Output ("  " + $f) }
$bad = @($files | Where-Object { $_ -notlike "sot/*" })
if ($bad.Count -gt 0) { Write-Output "  CP-24 VIOLATION. Aborting."; exit 1 }
Write-Output "  CP-24 OK"

Write-Output ""
Write-Output "=== push"
git push -u origin $branch --force-with-lease 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
$local = (git rev-parse HEAD).Trim()
$remote = (git ls-remote origin ("refs/heads/" + $branch)).Split()[0]
if ($local -ne $remote) { Write-Output ("  PUSH NOT VERIFIED. local=" + $local + " remote=" + $remote); exit 1 }
Write-Output ("  READBACK: origin has " + $local.Substring(0,8))

Write-Output ""
Write-Output "=== open PR"
$body = @"
Doc-reconcile PR. **sot/ only** - CP-24 sot-purity compliant (no `apps/**`, `scripts/**`, `.github/**`).

## What changed

**``sot/README.md``** - retires the MAIN/OldMain/Chat#/DR# chat-routing model (it no longer exists;
every chat has full development authority and multiple chats run concurrently). Replaces it with:
- a mandatory **BOOT SEQUENCE** - read 01+02, then verify LIVE state: open PRs, the prompt queue,
  and whether the scheduled tasks are actually enabled. A disabled shepherd means nothing is
  merging, and a chat must say so up front rather than planning into a void.
- **CONCURRENCY RULES** - claim-before-you-act; never re-stage without grepping ``main``; one SoT
  doc = one chat = one PR; trust code and CI over PR-body prose.
- the **Azure/Entra/SharePoint hard stop** - no agent touches tenant state, ever.
- graph-first navigation (Graphify), explicitly marked NOT source of truth.

**``sot/01-charter-and-architecture.md``** - adds **Failure honesty (MANDATORY)** to SECTION 6.
Never redirect, never blame, never fail silently - the UI must name what actually happened. Written
because two "the page is broken" pilot reports were both this rule being violated.

**``sot/05-decisions-and-lessons.md``** - appends LL-36/37/38:
- **LL-36** - an agent walked Marco through deleting a live production secret *before* verifying all
  its consumers. A verification step that gates an irreversible action must complete BEFORE it.
- **LL-37** - the supervisor declared "WATCHER IS DOWN" from a Linux ``ps`` in a sandbox (the watcher
  is a Windows process) and a UTC-vs-AEST clock error. "Cannot verify" is not "down".
- **LL-38** - the supervisor did the watcher's job, abandoned a merge mid-conflict, and reported
  "nominal". Killed the overnight queue.

## Notes

- ``main``'s ``sot/05`` ends at LL-35 (#543). 36/37/38 are a **clean append** - no dedup needed. The
  original HOLD prompt warned of a collision with LL-35; that warning is now out of date.
- Verified the sot/ files are clean UTF-8 on disk (0 replacement chars, 0 mojibake) before
  committing. A PowerShell reader had *displayed* them as damaged - a cp1252 decoding artifact, not
  real corruption.
- Docs-only: ``pnpm build`` / ``pnpm lint`` are N/A.

Do not auto-merge - SoT governance doc, Marco reviews the rendered diff.
"@
$bodyFile = Join-Path $env:TEMP "sot-reconcile-body.md"
[System.IO.File]::WriteAllText($bodyFile, $body, (New-Object System.Text.UTF8Encoding($false)))

gh pr create --base main --head $branch --title "docs(sot): retire chat routing, add boot sequence + concurrency rules, LL-36/37/38" --body-file $bodyFile 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
