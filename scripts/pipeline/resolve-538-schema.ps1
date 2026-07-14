# #538 schema.prisma conflict: two models added at the same spot.
#   HEAD (#538) : model AccessRequest            (gated Entra SSO)
#   main        : enum + model SharePointFolderMapping   (from #556)
#
# DOCTRINE 3: preserve BEHAVIOUR, not text. BOTH models must survive.
#
# THE TRAP: a naive marker-strip BREAKS the file. Each side's block ends at its @@map(...) line -
# the closing brace lives AFTER the >>>>>>> marker and is SHARED. Strip the markers and
# AccessRequest is never closed. So: insert a closing brace after access_requests, and let the
# shared brace close SharePointFolderMapping.
#
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-fix"
git fetch origin --quiet 2>$null

$branch = "fix/login-shared-computer-and-gated-entra"
git checkout -B $branch ("origin/" + $branch) --quiet 2>$null
git merge origin/main --no-commit --no-ff 2>$null | Out-Null

$file = "apps\api\prisma\schema.prisma"
$lines = Get-Content $file
$out = @()

foreach ($l in $lines) {
    if ($l -match "^<<<<<<<") { continue }
    if ($l -match "^>>>>>>>") { continue }
    if ($l -match "^=======$") {
        # end of the AccessRequest block -> close it before main's block begins
        $out += "}"
        $out += ""
        continue
    }
    $out += $l
}

$noBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $file), $out, $noBom)

# Prove both models survived and the file is structurally sane.
$txt = Get-Content $file -Raw
$ok = $true
foreach ($needle in @("model AccessRequest", "model SharePointFolderMapping", "enum SharePointMappingEntityType")) {
    if ($txt -notmatch [regex]::Escape($needle)) { Write-Output ("  MISSING: " + $needle); $ok = $false }
    else { Write-Output ("  present: " + $needle) }
}
if ($txt -match "<<<<<<<|>>>>>>>") { Write-Output "  conflict markers remain"; $ok = $false }

$open = ([regex]::Matches($txt, "\{")).Count
$close = ([regex]::Matches($txt, "\}")).Count
Write-Output ("  braces: " + $open + " open / " + $close + " close")
if ($open -ne $close) { Write-Output "  UNBALANCED BRACES"; $ok = $false }

if (-not $ok) { git merge --abort 2>$null; Write-Output "ABORTED - nothing pushed."; exit 1 }

# NOTE: do NOT use `npx prisma validate` here. `npx` fetches the LATEST Prisma (7.x), which
# rejects `url = env("DATABASE_URL")` in the datasource block - a breaking change this project
# has not adopted. It reports P1012 on a schema that is perfectly valid for the pinned version.
# A validator running a different version than the project is not a validator; it is a red herring.
# The structural checks above (both models present, no markers, balanced braces) plus CI are the gate.

git add $file 2>$null

# Regenerate the map (its conflict is a generated artifact - never hand-merge).
node scripts/data-model/build-relationship-map.mjs 2>$null | Out-Null
git add docs/data-model/ 2>$null

if (-not $Execute) { git merge --abort 2>$null; Write-Output "DRY RUN - aborted."; exit 0 }

git commit -m "chore: merge main into #538 (keep BOTH AccessRequest and SharePointFolderMapping); regenerate map" --quiet 2>$null
$head = git rev-parse --short HEAD
git push origin $branch 2>$null
if ($LASTEXITCODE -eq 0) { Write-Output ("PUSHED " + $head + " - #538 mergeable. STILL HELD for Marco's smoke.") }
git checkout --detach origin/main --quiet 2>$null
