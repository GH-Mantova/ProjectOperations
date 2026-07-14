$ErrorActionPreference = "Continue"
Set-Location "C:\ProjectOperations2"

Write-Output "=== every LL- mention on origin/main's sot/05:"
git show origin/main:sot/05-decisions-and-lessons.md | Select-String -Pattern "LL-\d+" -AllMatches | ForEach-Object {
    Write-Output ("  main | " + $_.Line.Trim())
}

Write-Output ""
Write-Output "=== every LL- mention in Marco's working sot/05:"
Select-String -Path "sot\05-decisions-and-lessons.md" -Pattern "LL-\d+" | ForEach-Object {
    Write-Output ("  tree | " + $_.Line.Trim())
}
