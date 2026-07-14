# Capture Marco's uncommitted sot/ edits as a PATCH (not a copy).
#
# WHY A PATCH, NOT A COPY: Marco's tree is ~14 commits behind origin/main. sot/05 has moved
# on main since (#543 added LL-35). Copying his file over main's would SILENTLY REVERT that.
# A patch + `git apply -3` does a real three-way merge and surfaces the collision instead.
$ErrorActionPreference = "Continue"

Set-Location "C:\ProjectOperations2"

Write-Output "=== Marco's tree HEAD:"
git rev-parse --short HEAD
git log -1 --format="  %h %s"

Write-Output ""
Write-Output "=== uncommitted sot/ changes vs his HEAD:"
git diff --stat HEAD -- sot/

Write-Output ""
Write-Output "=== writing patch"
git diff HEAD -- sot/ | Out-File -FilePath "C:\ProjectOperations2\sot-edits.patch" -Encoding ascii
$sz = (Get-Item "C:\ProjectOperations2\sot-edits.patch").Length
Write-Output ("  sot-edits.patch  " + $sz + " bytes")

Write-Output ""
Write-Output "=== does the runbook the prompt mentions exist?"
if (Test-Path "C:\ProjectOperations2\docs\runbooks\cowork-project-instructions.md") {
    Write-Output "  YES - docs/runbooks/cowork-project-instructions.md"
} else {
    Write-Output "  NO - it does not exist. The prompt's claim is FALSE."
}

Write-Output ""
Write-Output "=== what main already has in sot/05 (LL-3x entries):"
git fetch origin --quiet
git show origin/main:sot/05-decisions-and-lessons.md | Select-String -Pattern "^#+.*LL-3" | ForEach-Object { Write-Output ("  main: " + $_.Line.Trim()) }

Write-Output ""
Write-Output "=== what Marco's working copy of sot/05 has:"
Select-String -Path "C:\ProjectOperations2\sot\05-decisions-and-lessons.md" -Pattern "^#+.*LL-3" | ForEach-Object { Write-Output ("  tree: " + $_.Line.Trim()) }
