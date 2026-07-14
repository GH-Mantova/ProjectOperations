# Resolve #538 - an import-order conflict. BOTH imports are needed.
#   HEAD (#538) : AdminAccessRequestsTab  (its new tab)
#   main        : isAdminUser             (the permissions helper from #537)
# DOCTRINE 3: preserve behaviour, not text. Keep both.
#
# #538 still NEVER auto-merges - it needs a real Microsoft account on a real shared PC.
# This only makes it MERGEABLE so Marco can smoke it.
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Stop"
Set-Location "C:\po-fix"
git fetch origin --quiet

$branch = "fix/login-shared-computer-and-gated-entra"
git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null
git merge origin/main --no-commit --no-ff 2>&1 | Out-Null

$file = "apps\web\src\pages\AdminSettingsPage.tsx"
$lines = Get-Content $file

$out = @()
foreach ($l in $lines) {
    if ($l -match "^<<<<<<<" -or $l -match "^=======" -or $l -match "^>>>>>>>") { continue }
    $out += $l
}

$noBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $file), $out, $noBom)

# PROVE both survived.
$final = Get-Content $file -Raw
$ok = $true
foreach ($needle in @("AdminAccessRequestsTab", "isAdminUser")) {
    if ($final -notmatch [regex]::Escape($needle)) { Write-Output ("  MISSING: " + $needle); $ok = $false }
    else { Write-Output ("  present: " + $needle) }
}
if (-not $ok) { git merge --abort 2>&1 | Out-Null; throw "An import was lost. Aborted." }

if ($final -match "<<<<<<<|>>>>>>>|^=======") { git merge --abort 2>&1 | Out-Null; throw "Conflict markers remain. Aborted." }
Write-Output "  no conflict markers remain"

if (-not $Execute) {
    git merge --abort 2>&1 | Out-Null
    Write-Output "DRY RUN - aborted, nothing pushed."
    exit 0
}

git add $file 2>&1 | Out-Null
git commit -m "chore: merge main into #538 (keep both AdminAccessRequestsTab and isAdminUser imports)" --quiet
git push origin $branch 2>&1 | Out-Null
Write-Output "PUSHED - #538 is now mergeable. STILL held: Marco must smoke it on a real shared PC."
git checkout --detach origin/main --quiet 2>&1 | Out-Null
