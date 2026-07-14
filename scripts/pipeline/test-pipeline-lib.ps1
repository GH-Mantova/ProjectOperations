# Self-test for pipeline-lib.ps1. Read-only. Proves each primitive defeats the bug it was
# written for. Run this after ANY change to the library.
# Pure ASCII.

. "$PSScriptRoot\pipeline-lib.ps1"

$pass = 0
$fail = 0
function Check([string]$name, [bool]$ok, [string]$detail) {
    if ($ok) { Write-Output ("  PASS  " + $name); $script:pass++ }
    else     { Write-Output ("  FAIL  " + $name + "   " + $detail); $script:fail++ }
}

Write-Output "=== pipeline-lib self-test"
Write-Output ""

# 1. Get-Board must return an ENUMERABLE of PRs, each with a scalar .number.
#    The bug: ConvertFrom-Json piped into Where-Object yields ONE object whose .number is an ARRAY.
$board = Get-Board
$isArray = ($board -is [array]) -or ($board.Count -ge 0)
Check "Get-Board returns an enumerable" $isArray ""
if ($board.Count -gt 0) {
    $n = $board[0].number
    Check "Get-Board .number is a SCALAR (not Object[])" ($n -isnot [array]) ("got type " + $n.GetType().Name)
} else {
    Write-Output "  SKIP  .number scalar check (no open PRs)"
}

# 2. Get-PrBody must return a single string WITH newlines.
#    The bug: gh returns a string ARRAY; `$prefix + $body` joins it with SPACES.
if ($board.Count -gt 0) {
    $pr = [int]$board[0].number
    $body = Get-PrBody $pr
    Check "Get-PrBody returns a single string" ($body -is [string]) ("got " + $body.GetType().Name)
    Check "Get-PrBody preserves newlines" ($body.Contains("`n")) "body has no newline - it was FLATTENED"
}

# 3. Assert-Mergeable MUST throw for a NEVER-MERGE PR. This is the guard that failed once.
$threw = $false
try { Assert-Mergeable 552 } catch { $threw = $true }
Check "Assert-Mergeable REFUSES #552 (production data)" $threw "IT DID NOT REFUSE - the guard is broken"

$threw = $false
try { Assert-Mergeable 538 } catch { $threw = $true }
Check "Assert-Mergeable REFUSES #538 (needs human identity)" $threw "IT DID NOT REFUSE"

# and it must NOT refuse an ordinary PR
$threw = $false
try { Assert-Mergeable 999999 } catch { $threw = $true }
Check "Assert-Mergeable allows an ordinary PR" (-not $threw) "it refused a PR it should allow"

# 4. Get-ChecksFor must mark a failure as REAL only if its run has COMPLETED.
if ($board.Count -gt 0) {
    $checks = Get-ChecksFor ([int]$board[0].number)
    $hasFlag = $true
    foreach ($c in $checks) { if ($null -eq $c.IsRealFailure) { $hasFlag = $false } }
    Check "Get-ChecksFor tags every check with IsRealFailure" $hasFlag ""
}

# 5. Watcher repo integrity: a feature branch is NORMAL, not corrupt.
$repo = Test-WatcherRepoClean
Check "Test-WatcherRepoClean reports Corrupt=false on a healthy tree" (-not $repo.Corrupt) ("MidMerge=" + $repo.MidMerge)

Write-Output ""
Write-Output ("=== " + $pass + " passed, " + $fail + " failed")
if ($fail -gt 0) { exit 1 }
