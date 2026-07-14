# Does each PR that NEEDS a GATE-ALLOW marker actually HAVE one, bare, at column 0?
#
# CP-11's regex: /^GATE-ALLOW: (migrations|env-vars|dependencies)\s*$/gm
#   "## GATE-ALLOW: migrations"  -> FAILS (markdown heading)
#   "GATE-ALLOW: migrations."    -> FAILS (trailing period)  <- this cost PR #497
#   "GATE-ALLOW: migrations"     -> passes
# 10 PRs have failed on exactly this. Check it deterministically instead of reading logs.

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$raw = gh pr list --state open --limit 40 --json number,title,headRefName | ConvertFrom-Json

foreach ($p in $raw) {
    $n = [int]$p.number
    $branch = $p.headRefName

    # What does the PR actually change?
    $files = git diff --name-only origin/main ("origin/" + $branch) 2>$null
    $needs = @()
    if ($files -match "prisma/migrations/") { $needs += "migrations" }
    if ($files -match "^\.env\.example$")   { $needs += "env-vars" }
    if ($files -match "package\.json")      { $needs += "dependencies" }

    if ($needs.Count -eq 0) { continue }

    $body = gh pr view $n --json body -q .body
    $lines = $body -split "`n"

    Write-Output ("#" + $n + "  needs: " + ($needs -join ", "))
    foreach ($need in $needs) {
        $wanted = "GATE-ALLOW: " + $need
        $hasBare = $false
        foreach ($l in $lines) {
            if ($l.TrimEnd() -ceq $wanted) { $hasBare = $true; break }
        }
        if ($hasBare) {
            Write-Output ("    OK      " + $wanted)
        } else {
            # is it there but malformed?
            $malformed = $lines | Where-Object { $_ -match "GATE-ALLOW:\s*$need" }
            if ($malformed) {
                Write-Output ("    MALFORMED: '" + ($malformed[0].Trim()) + "'  -> must be BARE at column 0: '" + $wanted + "'")
            } else {
                Write-Output ("    MISSING : " + $wanted)
            }
        }
    }
    Write-Output ""
}
