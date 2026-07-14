# Self-test for the evidence gate, against the LIVE board. A guard that has never been
# observed refusing anything is not a guard - it is a comment.
$ErrorActionPreference = "Continue"
. "C:\ProjectOperations2\scripts\pipeline\pipeline-lib.ps1"

$pass = 0
$fail = 0

function Should-Throw($name, $block) {
    try { & $block; Write-Output ("FAIL " + $name + " - did NOT throw"); $script:fail++ }
    catch { Write-Output ("PASS " + $name); Write-Output ("       -> " + $_.Exception.Message.Split([Environment]::NewLine)[0]); $script:pass++ }
}
function Should-Pass($name, $block) {
    try { & $block | Out-Null; Write-Output ("PASS " + $name); $script:pass++ }
    catch { Write-Output ("FAIL " + $name + " - threw: " + $_.Exception.Message); $script:fail++ }
}

Write-Output "=== the two PRs that must NEVER auto-merge"
Should-Throw "Assert-SmokedOrEscalate REFUSES #552 (production data)" { Assert-SmokedOrEscalate -PR 552 }
Should-Throw "Assert-SmokedOrEscalate REFUSES #538 (real human identity)" { Assert-SmokedOrEscalate -PR 538 }

Write-Output ""
Write-Output "=== a real merged PR should read as green (#557 - pipeline hardening)"
Should-Pass "Assert-SmokeGreen accepts #557 (all checks concluded SUCCESS)" { Assert-SmokeGreen -PR 557 }

Write-Output ""
Write-Output "=== over-claiming must be caught"
Should-Pass "Assert-BodyClaimsAreReal accepts a string that IS in #557's diff" {
    Assert-BodyClaimsAreReal -PR 557 -MustContain @("Assert-Mergeable")
}
Should-Throw "Assert-BodyClaimsAreReal REJECTS an artifact that is NOT in #557's diff" {
    Assert-BodyClaimsAreReal -PR 557 -MustContain @("ThisSymbolWasNeverWritten_XYZ")
}

Write-Output ""
Write-Output ("=== " + $pass + " passed, " + $fail + " failed")
if ($fail -gt 0) { exit 1 }
