# Is Marco's working copy of the sot/ files byte-damaged?
#
# Symptom seen: em-dashes, arrows and multiplication signs on origin/main have become
# nothing (deleted) or U+FFFD in the working tree - a Windows-1252 round-trip. Committing
# such a file would push mojibake AND silently revert clean text already on main.
# Same class as the ci.yml corruption that blocked #544 with all checks green.
$ErrorActionPreference = "Continue"
Set-Location "C:\ProjectOperations2"

$files = @("sot/README.md", "sot/01-charter-and-architecture.md", "sot/05-decisions-and-lessons.md")

foreach ($f in $files) {
    Write-Output ("=== " + $f)

    $tree = Get-Content $f -Raw
    $bad = [regex]::Matches($tree, "[�]")
    Write-Output ("  U+FFFD replacement chars in working tree: " + $bad.Count)

    # Lines that exist on main but were CHANGED in the tree. If the only delta is a vanished
    # dash/arrow, that is corruption, not an edit.
    $tmp = [System.IO.Path]::GetTempFileName()
    git show ("origin/main:" + $f) | Out-File -FilePath $tmp -Encoding utf8
    $diff = git diff --no-index --numstat $tmp $f 2>&1 | Out-String
    Write-Output ("  numstat vs main (added removed): " + $diff.Trim())
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

Write-Output ""
Write-Output "=== does main's sot/05 already end at LL-35 (i.e. is 36/37/38 a clean append)?"
$mainTail = (git show origin/main:sot/05-decisions-and-lessons.md | Select-String -Pattern "LL-3[5-9]").Count
Write-Output ("  LL-35..39 mentions on main: " + $mainTail)
