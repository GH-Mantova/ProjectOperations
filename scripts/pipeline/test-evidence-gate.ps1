# Self-test for the evidence gate, against the LIVE board. A guard that has never been
# observed refusing anything is not a guard - it is a comment.
$ErrorActionPreference = "Continue"
# Load the library NEXT TO THIS TEST, not from a hardcoded absolute path.
#
# BUG THIS FIXES (caught 2026-07-14): the path was hardcoded to C:\ProjectOperations2\... . When
# that tree did not have scripts/pipeline checked out, the dot-source FAILED, every function was
# undefined - and the test still printed PASS, because Should-Throw accepted ANY exception,
# including "the term Assert-Mergeable is not recognized".
#
# A guard test that passes while the guard does not exist is worse than no test. DOCTRINE 7.
$libPath = Join-Path $PSScriptRoot "pipeline-lib.ps1"
if (-not (Test-Path $libPath)) { Write-Output ("FATAL: cannot find " + $libPath); exit 1 }
. $libPath

# Positive control: the library must actually be loaded before any assertion is trusted.
if (-not (Get-Command Assert-Mergeable -ErrorAction SilentlyContinue)) {
    Write-Output "FATAL: pipeline-lib loaded but Assert-Mergeable is undefined. Aborting - a green"
    Write-Output "       result from here would be meaningless."
    exit 1
}
Write-Output ("library loaded: " + $libPath)

$pass = 0
$fail = 0

function Should-Throw($name, $expectedPattern, $block) {
    # It is NOT enough that it threw. It must throw the RIGHT thing.
    # "command not found" is an exception too, and accepting it turned a completely unloaded
    # library into a green test run.
    try {
        & $block
        Write-Output ("FAIL " + $name + " - did NOT throw")
        $script:fail++
    } catch {
        $msg = $_.Exception.Message
        if ($msg -match $expectedPattern) {
            Write-Output ("PASS " + $name)
            Write-Output ("       -> " + $msg.Split([Environment]::NewLine)[0])
            $script:pass++
        } else {
            Write-Output ("FAIL " + $name + " - threw the WRONG error (expected /" + $expectedPattern + "/)")
            Write-Output ("       -> " + $msg.Split([Environment]::NewLine)[0])
            $script:fail++
        }
    }
}
function Should-Pass($name, $block) {
    try { & $block | Out-Null; Write-Output ("PASS " + $name); $script:pass++ }
    catch { Write-Output ("FAIL " + $name + " - threw: " + $_.Exception.Message); $script:fail++ }
}

Write-Output "=== the PR that must NEVER auto-merge"
Should-Throw "Assert-SmokedOrEscalate REFUSES #552 (production data - rates unreviewed)" "NEVER-MERGE" { Assert-SmokedOrEscalate -PR 552 }

# #538 was DISCHARGED 2026-07-14 (Marco ran the real-account shared-PC smoke). Assert it is no
# longer refused - a guard nobody can ever clear is a lie, and a stale test hides that.
Should-Pass "Assert-Mergeable ALLOWS #538 (human-identity smoke discharged)" { Assert-Mergeable -PR 538 }

Write-Output ""
Write-Output "=== a real merged PR should read as green (#557 - pipeline hardening)"
Should-Pass "Assert-SmokeGreen accepts #557 (all checks concluded SUCCESS)" { Assert-SmokeGreen -PR 557 }

Write-Output ""
Write-Output "=== over-claiming must be caught"
Should-Pass "Assert-BodyClaimsAreReal accepts a string that IS in #557's diff" {
    Assert-BodyClaimsAreReal -PR 557 -MustContain @("Assert-Mergeable")
}
Should-Throw "Assert-BodyClaimsAreReal REJECTS an artifact that is NOT in #557's diff" "NOT in its diff" {
    Assert-BodyClaimsAreReal -PR 557 -MustContain @("ThisSymbolWasNeverWritten_XYZ")
}

Write-Output ""
Write-Output ("=== " + $pass + " passed, " + $fail + " failed")
if ($fail -gt 0) { exit 1 }
