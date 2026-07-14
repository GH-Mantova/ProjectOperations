# Resolve #544 - a SEMANTIC conflict, not a textual one.
#
# main    : CP-23 seed-without-migration  +  CP-24 sot-purity      (from #543, #545)
# #544    : CP-24 failure-honesty                                  (branched before both)
#
# TWO DIFFERENT GATES CLAIM CP-24. Taking either side silently DELETES a live gate.
# DOCTRINE 3: preserve BEHAVIOUR, not text. Keep all three -> #544's becomes CP-25.
#
# Runs in C:\po-fix (isolated worktree). Never in C:\po-watcher.
# Pure ASCII.

param([switch]$Execute)

$ErrorActionPreference = "Stop"
Set-Location "C:\po-fix"
git fetch origin --quiet

$branch = "fix/no-access-page-instead-of-redirect"
git checkout -B $branch ("origin/" + $branch) --quiet 2>&1 | Out-Null

# 1. Capture #544's failure-honesty block BEFORE we overwrite the file with main's version.
$theirs = git show ("origin/" + $branch + ":scripts/pr-gates/pr-gates.mjs")
$start = ($theirs | Select-String -Pattern "^// CP-24 - failure honesty" | Select-Object -First 1).LineNumber
if (-not $start) { throw "Could not locate #544's failure-honesty block." }

# The block runs until the next top-level `// CP-` comment (or EOF).
$end = $theirs.Count
for ($i = $start; $i -lt $theirs.Count; $i++) {
    if ($theirs[$i] -match "^// CP-" -and $i -gt ($start + 2)) { $end = $i; break }
}
$block = $theirs[($start - 1)..($end - 1)] -join "`n"

# 2. Renumber it CP-25. CP-24 is TAKEN on main (sot-purity).
$block = $block -replace 'CP-24', 'CP-25'
$block = $block -replace '// CP-25 - failure honesty', '// CP-25 - failure honesty'

Write-Output ("captured #544's gate block: " + ($end - $start + 1) + " lines, renumbered CP-24 -> CP-25")

git merge origin/main --no-commit --no-ff 2>&1 | Out-Null

# 3. Take MAIN's version of both conflicted files (it has CP-23 + CP-24 sot-purity).
git checkout --theirs -- scripts/pr-gates/pr-gates.mjs 2>&1 | Out-Null
git checkout --theirs -- .github/workflows/ci.yml 2>&1 | Out-Null

# 4. Re-insert #544's gate as CP-25, immediately before the final exit.
$gates = Get-Content "scripts\pr-gates\pr-gates.mjs"
$exitLine = ($gates | Select-String -Pattern "^process\.exit\(failed" | Select-Object -First 1).LineNumber
if (-not $exitLine) { throw "Could not find process.exit in main's pr-gates.mjs." }

$new = @()
$new += $gates[0..($exitLine - 2)]
$new += ""
$new += $block.Split("`n")
$new += ""
$new += $gates[($exitLine - 1)..($gates.Count - 1)]

# 5. Header + workflow name must list every gate.
$new[1] = "// PR diff gates (CP-09..CP-13, CP-17, CP-22, CP-23, CP-24, CP-25). Node built-ins only, ASCII-only output."

# PS 5.1's `Set-Content -Encoding UTF8` writes a BOM. Node rejects a BOM in a .mjs
# ("SyntaxError: Invalid or unexpected token" on line 1). Write UTF-8 WITHOUT BOM.
# Same family as the PS-5.1 encoding rule in sot/05. The node --check below caught this.
$noBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) "scripts\pr-gates\pr-gates.mjs"), $new, $noBom)

$ci = Get-Content ".github\workflows\ci.yml" -Raw
$ci = $ci -replace 'CP-22, CP-23\)', 'CP-22, CP-23, CP-24, CP-25)'
$ci = $ci -replace 'CP-22, CP-24\)', 'CP-22, CP-23, CP-24, CP-25)'
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".github\workflows\ci.yml"), $ci, $noBom)

# 6. PROVE all three gates survived. Doctrine 2: never delete the point of the PR.
$final = Get-Content "scripts\pr-gates\pr-gates.mjs" -Raw
$ok = $true
foreach ($needle in @('"CP-23", "seed-without-migration"', '"CP-24", "sot-purity"', '"CP-25", "failure-honesty"')) {
    if ($final -notmatch [regex]::Escape($needle)) {
        Write-Output ("  MISSING: " + $needle)
        $ok = $false
    } else {
        Write-Output ("  present: " + $needle)
    }
}
if (-not $ok) { git merge --abort 2>&1 | Out-Null; throw "A gate was lost. Aborted - nothing pushed." }

node --check "scripts\pr-gates\pr-gates.mjs"
if ($LASTEXITCODE -ne 0) { git merge --abort 2>&1 | Out-Null; throw "pr-gates.mjs does not parse. Aborted." }
Write-Output "  syntax OK"

if (-not $Execute) {
    git merge --abort 2>&1 | Out-Null
    Write-Output "DRY RUN - aborted, nothing pushed."
    exit 0
}

git add scripts/pr-gates/pr-gates.mjs .github/workflows/ci.yml 2>&1 | Out-Null
git commit -m "chore: merge main; renumber failure-honesty gate CP-24 -> CP-25 (CP-24 is sot-purity on main)" --quiet
git push origin $branch 2>&1 | ForEach-Object { Write-Output ("  " + $_) }
Write-Output "PUSHED - #544 resolved, all three gates preserved."
