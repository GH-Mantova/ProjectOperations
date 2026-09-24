param([int]$PR)
$ErrorActionPreference = "Continue"

# WHY-BLOCKED -- surface the exact branch-ruleset violation behind a BLOCKED PR.
#
# This script's diagnostic METHOD is a REST merge attempt: the rule text GitHub
# returns on a refusal is the only place the exact violation is spelled out.
# That makes it a MUTATING script wearing a diagnostic's clothes, so it refuses
# before it attempts, on every gate that binds a station.
#
# HISTORY. Until 2026-09-23 this file was eight lines and the whole body was an
# unconditional `PUT /pulls/<n>/merge`, with no label check, no RULE 2 check and
# no dry run -- while BOTH docs/pipeline/stations/00-supervisor.md (under its
# "Read-only -- build the whole picture BEFORE acting" heading) and
# docs/pipeline/SCRIPT-REGISTRY.md listed it as read-only. Run against a PR the
# watcher had routed to Marco it would have squash-merged it, and only the branch
# ruleset stood in the way. MEASURED 2026-09-23T19:2xZ by Station 00 on #2127, a
# PR carrying {"ok":false,"marco":true}: the attempt was refused by GitHub with
# "5 of 9 required status checks are in progress" -- i.e. by timing, not by this
# script. See DOCTRINE.md section 10.1 (RULE 2) and section 5.
#
# It also ran `Set-Location "C:\po-watcher\ProjectOperations"` unconditionally and
# never returned, so the CALLER's shell was left standing in the watcher clone --
# the one tree where git mutation is an absolute stop (DOCTRINE section 4). The
# Set-Location was never needed: `gh` takes -R (DOCTRINE section 9.4's CWD bullet).

$Repo = "GH-Mantova/ProjectOperations"
$DevTree = "C:\ProjectOperations2"

if (-not $PR -or $PR -le 0) {
    Write-Output "REFUSED: -Pr <number> is required."
    exit 2
}

# ---- GATE 1: hold labels. A label-read FAILURE is a refusal, never a pass (LL-47).
$labelsRaw = gh pr view $PR -R $Repo --json labels 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Output ("REFUSED: could not read labels for #" + $PR + " -- a label-read failure is a REFUSAL, not a pass.")
    foreach ($line in $labelsRaw) { Write-Output ("  " + $line) }
    exit 3
}
$labels = @((ConvertFrom-Json ([string]::Join("`n", $labelsRaw))).labels |
            Where-Object { $null -ne $_ } | ForEach-Object { $_.name })
$holdLabels = @($labels | Where-Object { $_ -in @("do-not-merge", "needs-marco", "hold") })
if ($holdLabels.Count -gt 0) {
    Write-Output ("REFUSED: #" + $PR + " carries a hold label (" + ($holdLabels -join ", ") + "). Only Marco removes it.")
    Write-Output "  This script's diagnostic is a REST merge attempt, so it will not run against a held PR."
    exit 4
}

# ---- GATE 2: RULE 2. The watcher's own routing verdict, from the PROMPT logs only.
# rev-*.log are auto-generated REVIEW jobs and carry ZERO lane information
# (DOCTRINE section 9.5), so they are excluded by the pr-*.log glob. The pattern
# avoids a literal double quote: escaped double quotes do not survive the
# -Command layer (DOCTRINE section 9.4), so `marco.:true` is the sound form.
$verdictDir = Join-Path $DevTree "docs\pr-prompts\processed"
if (-not (Test-Path $verdictDir)) {
    Write-Output ("REFUSED: cannot read the RULE 2 verdict corpus at " + $verdictDir + " -- unmeasured is not cleared.")
    exit 5
}
$verdictHits = @(Select-String -Path (Join-Path $verdictDir "pr-*.log") `
                               -Pattern ("merge result for PR #" + $PR + ":") |
                 Where-Object { $null -ne $_ })
$marcoHits = @($verdictHits | Where-Object { $_.Line -match 'marco.:\s*true' })
if ($marcoHits.Count -gt 0) {
    Write-Output ("REFUSED: #" + $PR + " carries a watcher RULE 2 verdict -- it is Marco's.")
    foreach ($hit in $marcoHits) { Write-Output ("  " + $hit.Line.Trim()) }
    Write-Output "  DOCTRINE section 10.1 step 1: obey it. No station clears a marco:true verdict."
    exit 6
}

# ---- BEFORE state. Without it the read-back below cannot tell a merge this script
# CAUSED from one that had already happened: the REST endpoint answers an
# already-merged PR with the idempotent {"merged":true,"message":"Pull Request
# successfully merged"} and the same sha, which is byte-indistinguishable from a
# merge it just performed. MEASURED 2026-09-23T19:3xZ by Station 00 against #2130,
# merged 40 minutes earlier: the first version of this read-back fired its
# "THIS SCRIPT MERGED THE PR" alarm on a merge it had not caused.
$beforeRaw = gh pr view $PR -R $Repo --json state,mergedAt 2>&1
$beforeState = if ($LASTEXITCODE -eq 0) { (ConvertFrom-Json ([string]::Join("`n", $beforeRaw))).state } else { "UNKNOWN" }
if ($beforeState -eq "MERGED") {
    Write-Output ("REFUSED: #" + $PR + " is already MERGED -- there is no BLOCKED state to diagnose.")
    exit 7
}

# ---- The diagnostic. Reached only for a PR no gate above claims.
Write-Output ("=== REST merge attempt on #" + $PR + " (to surface the exact rule violation)")
Write-Output ("    gates passed: labels=[" + ($labels -join ",") + "]  verdicts naming this PR=" + $verdictHits.Count + " (none marco:true)")
Write-Output "    WARNING: this attempt CAN MERGE the PR if the branch ruleset allows it."
$body = '{"merge_method":"squash"}'
$out = $body | gh api -X PUT ("repos/" + $Repo + "/pulls/" + $PR + "/merge") --input - 2>&1
foreach ($l in $out) { Write-Output ("  " + $l) }

# ---- Read back what the attempt actually did (DOCTRINE section 1).
$afterRaw = gh pr view $PR -R $Repo --json state,mergedAt 2>&1
if ($LASTEXITCODE -eq 0) {
    $after = ConvertFrom-Json ([string]::Join("`n", $afterRaw))
    Write-Output ("=== READ-BACK: #" + $PR + " before=" + $beforeState + " after=" + $after.state + " mergedAt=" + $after.mergedAt)
    if ($after.state -eq "MERGED" -and $beforeState -ne "MERGED") {
        Write-Output "!!! THIS SCRIPT MERGED THE PR. That is a real merge, not a diagnostic."
        Write-Output "!!! Say so in your breadcrumb. Merging belongs to Assert-SmokedOrEscalate -> Merge-Pr."
    }
} else {
    Write-Output "=== READ-BACK FAILED -- state after the attempt is [CANNOT MEASURE]. Check the board by hand."
}
