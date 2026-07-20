<#
    marco.ps1 - the launcher for scripts that ONLY Marco runs.

    Everything in here is deliberately kept out of every agent's hands, for one of three reasons:

      HARD STOP   the script touches SharePoint - a shared company system where a wrong move
                  locks real staff out of real documents. No agent, ever, under any framing.
      YOUR TREE   the script operates on C:\ProjectOperations2 itself, where your uncommitted
                  edits live and nowhere else. An agent working there would destroy them.
      YOUR CALL   the script changes what future agents ARE, or performs irreversible repo
                  surgery. A human decides that.

    Agents MAY write these scripts and hand you the steps. They may not run them.

    Registry of every other script (and who owns it):  docs\pipeline\SCRIPT-REGISTRY.md
#>

$ErrorActionPreference = 'Stop'
$Repo = 'C:\ProjectOperations2'

$Menu = @(
  @{ Key='1'; Class='YOUR TREE'; Name='Capture sot/ edits as a patch'
     Path="$Repo\scripts\pipeline\make-sot-patch.ps1"
     Desc='Captures your uncommitted sot/ edits as a PATCH (not a copy - your tree is behind main, so a copy would drag stale content with it). Safe: writes a patch file, changes nothing.' }
  @{ Key='2'; Class='YOUR TREE'; Name='Commit sot/ edits as a doc-reconcile PR'
     Path="$Repo\scripts\pipeline\commit-sot-reconcile.ps1"
     Desc='Commits those edits on a docs-only branch. Run AFTER option 1. CP-24 hard-fails any PR mixing sot/ with code, so this must stay sot-only.' }
  @{ Key='3'; Class='YOUR TREE'; Name='Rebase the sot branch and open its PR'
     Path="$Repo\scripts\pipeline\rebase-and-open-sot-pr.ps1"
     Desc='Rebases the sot-reconcile branch onto origin/main in an isolated worktree, then opens the PR. Run AFTER option 2.' }
  @{ Key='4'; Class='YOUR CALL'; Name='Install/refresh the station agents'
     Path="$Repo\scripts\pipeline\install-agents.ps1"
     Desc='Installs the numbered stations into .claude/agents with shared doctrine appended. This changes what every future agent IS - re-run after editing a station brief.' }
  @{ Key='5'; Class='YOUR CALL'; Name='Start the PR watcher (detached)'
     Path="$Repo\scripts\pr-watcher\watcher-launcher.ps1"
     Desc='Starts the watcher via Win32_Process.Create so it does NOT die with Claude Desktop. Launched any other way it dies when Claude does - that has bitten twice (2026-07-14, 2026-07-20).' }
  @{ Key='6'; Class='YOUR CALL'; Name='Rescue the watcher repo from a half-finished merge'
     Path="$Repo\scripts\rescue-watcher-repo.ps1"
     Desc='Repo surgery on C:\po-watcher when an agent abandoned a merge mid-conflict (MERGE_HEAD left behind). Irreversible if pointed at the wrong tree - read it before running.' }
  @{ Key='7'; Class='HARD STOP'; Name='Push docs TO SharePoint'
     Path="$Repo\scripts\sync-to-sharepoint.ps1"
     Desc='SHARED COMPANY SYSTEM. No agent may run this, ever. Know what you are overwriting before you confirm.' }
  @{ Key='8'; Class='HARD STOP'; Name='Pull docs FROM SharePoint'
     Path="$Repo\scripts\sync-from-sharepoint.ps1"
     Desc='SHARED COMPANY SYSTEM. Read-direction, but still yours alone.' }
)

function Show-Menu {
  Write-Host ''
  Write-Host '  MARCO-ONLY SCRIPTS' -ForegroundColor Cyan
  Write-Host '  Everything here is withheld from agents on purpose.' -ForegroundColor DarkGray
  Write-Host ''
  foreach ($i in $Menu) {
    $colour = switch ($i.Class) { 'HARD STOP' {'Red'} 'YOUR TREE' {'Yellow'} default {'Green'} }
    Write-Host ("  [{0}] " -f $i.Key) -NoNewline
    Write-Host ("{0,-9}" -f $i.Class) -ForegroundColor $colour -NoNewline
    Write-Host (" {0}" -f $i.Name)
    Write-Host ("        {0}" -f $i.Desc) -ForegroundColor DarkGray
    if (-not (Test-Path $i.Path)) { Write-Host '        !! script not found at its registry path' -ForegroundColor Red }
    Write-Host ''
  }
  Write-Host '  [r] Open the full script registry (who owns what)'
  Write-Host '  [q] Quit'
  Write-Host ''
}

while ($true) {
  Show-Menu
  $sel = Read-Host '  Choose'
  if ($sel -eq 'q') { break }
  if ($sel -eq 'r') {
    $reg = "$Repo\docs\pipeline\SCRIPT-REGISTRY.md"
    if (Test-Path $reg) { Get-Content $reg | more } else { Write-Host '  registry not found - has the PR merged?' -ForegroundColor Red }
    continue
  }
  $item = $Menu | Where-Object { $_.Key -eq $sel }
  if (-not $item) { Write-Host '  no such option' -ForegroundColor Red; continue }
  if (-not (Test-Path $item.Path)) { Write-Host "  missing: $($item.Path)" -ForegroundColor Red; continue }

  Write-Host ''
  Write-Host "  $($item.Name)" -ForegroundColor Cyan
  Write-Host "  $($item.Desc)" -ForegroundColor DarkGray
  Write-Host "  -> $($item.Path)"
  if ($item.Class -eq 'HARD STOP') {
    Write-Host ''
    Write-Host '  THIS TOUCHES A SHARED COMPANY SYSTEM (SharePoint).' -ForegroundColor Red
    Write-Host '  A wrong move here locks real staff out of real documents.' -ForegroundColor Red
    $c = Read-Host '  Type SHAREPOINT to proceed'
    if ($c -ne 'SHAREPOINT') { Write-Host '  cancelled' -ForegroundColor Yellow; continue }
  } else {
    $c = Read-Host '  Run it? (y/N)'
    if ($c -ne 'y') { Write-Host '  cancelled' -ForegroundColor Yellow; continue }
  }
  Write-Host ''
  & $item.Path
  Write-Host ''
  Write-Host "  --- finished (exit $LASTEXITCODE) ---" -ForegroundColor Cyan
}
