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
    if ($l -match "^=======$") { $out += "}"; $out += ""; continue }
    $out += $l
}
$noBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $file), $out, $noBom)

Write-Output "=== FULL prisma validate output:"
npx prisma validate --schema apps/api/prisma/schema.prisma 2>&1 | ForEach-Object { Write-Output ("  " + $_) }

git merge --abort 2>$null
