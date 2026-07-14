# Add the missing GATE-ALLOW markers, BARE at column 0, then push to retrigger.
#
# A PR-BODY EDIT ALONE DOES NOT RETRIGGER THE WORKFLOW. The `pull_request` event payload is
# frozen, and "Re-run jobs" replays the ORIGINAL payload (sot/05 LL-09). You must push a commit.
# Order matters: edit the body FIRST, then push - so the new event carries the new body.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet

# PR -> markers it is missing
$FIX = @(
    @{ n = 556; markers = @("migrations", "env-vars") },
    @{ n = 552; markers = @("migrations") },
    @{ n = 538; markers = @("env-vars") }
)

foreach ($f in $FIX) {
    $n = $f.n
    $branch = gh pr view $n --json headRefName -q .headRefName
    Write-Output ("=== #" + $n + "  " + $branch)

    $body = gh pr view $n --json body -q .body

    $prefix = ""
    foreach ($m in $f.markers) {
        $wanted = "GATE-ALLOW: " + $m
        $has = $false
        foreach ($l in ($body -split "`n")) { if ($l.TrimEnd() -ceq $wanted) { $has = $true } }
        if (-not $has) {
            $prefix += $wanted + "`n"
            Write-Output ("    adding: " + $wanted)
        }
    }
    if ($prefix -eq "") { Write-Output "    nothing to add."; continue }

    $newBody = $prefix + "`n" + $body

    if (-not $Execute) { Write-Output "    DRY RUN - would edit body + push"; continue }

    $tmp = Join-Path $env:TEMP ("pr" + $n + "-body.md")
    [System.IO.File]::WriteAllText($tmp, $newBody, (New-Object System.Text.UTF8Encoding($false)))
    gh pr edit $n --body-file $tmp 2>&1 | Out-Null
    Write-Output "    body updated (markers bare at column 0)."

    # Push a commit so a NEW pull_request event fires, carrying the NEW body.
    git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null
    git commit --allow-empty -m "chore: retrigger CI after adding GATE-ALLOW marker(s)" --quiet
    git push origin $branch 2>&1 | Out-Null
    Write-Output "    pushed - CI will now re-evaluate with the marker present."
}

git checkout --detach origin/main --quiet 2>&1 | Out-Null
Write-Output ""
Write-Output "=== done"
