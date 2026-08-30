# Triage the HOLD queue. READ-ONLY. Answers ONE question: which of the *-HOLD.md prompts
# in the queue root have gates that are already satisfied, and which are spent?
#
# WHAT THIS USED TO BE (2026-07-24 .. 2026-08-30, 37 days). The file's first line already
# claimed "Proves which HOLDs are already satisfied." It did nothing of the kind: its entire
# HOLD logic was two hardcoded PR numbers (545, 548) passed to gh pr view -- zero references
# to docs/pr-prompts, zero globs, and exit 0 unconditionally. It examined 0 of the 59 depth-1
# HOLDs, and both PRs had been MERGED for weeks. DOCTRINE section 7's exact shape: a check
# never seen to fail is not a check, and its green read as coverage. Two documents vouched
# for it by name over the population arm-order decisions run against (SCRIPT-REGISTRY.md and
# stations/04-scanner.md). Found by Station 04, 2026-08-30T10:10Z; rewritten by Station 00.
#
# WHY IT DELEGATES INSTEAD OF EVALUATING. The gate evaluator already exists and is reviewed:
# scripts/pipeline/lint-prompt.mjs. Re-implementing premise / requires_merged /
# requires_on_main / requires_file_on_main here would create a SECOND gate engine that can
# disagree with the one the watcher actually obeys -- a new instrument that lies. So this
# script calls the real one, per file, and classifies by EXIT CODE.
#
#   exit 0  ADMIT  -> gates satisfied. A CANDIDATE for arming, never an instruction to arm.
#   exit 3  STALE  -> premise already satisfied: the work has SHIPPED. The prompt is spent
#                     and belongs in superseded/. This is the literal answer to "already
#                     satisfied" and the reason this script exists.
#   exit 1  REJECT -> still gated (unmet dependency, human gate, malformed) -- reason shown.
#
# NEVER passes --dequeue: with that flag lint-prompt.mjs RENAMES the file (line 1440). This
# script mutates nothing, arms nothing and renames nothing. Verified read-only 2026-08-30.
#
# ADMIT IS NECESSARY, NOT SUFFICIENT (DOCTRINE section 9.5). A PROSE human gate matches
# neither do-not-arm regex and is invisible to the linter. READ THE BODY BEFORE ARMING, and
# arm ONE AT A TIME. Only Station 00 arms.
#
# LESSON KEPT FROM THE ORIGINAL (cost 3 runs): do NOT pass -q with a jq expression to gh from
# PowerShell 5.1 -- PS re-splits the quoted expression on spaces. Ask for raw --json and parse
# with ConvertFrom-Json. And always ASSIGN THEN FOREACH: piping a JSON array straight into
# Where-Object collapses it to ONE object (the bug that once let the merge queue select
# #552, the production-data PR).

[CmdletBinding()]
param(
    [string] $Repo = "C:\ProjectOperations2"
)

$ErrorActionPreference = "Continue"

$queueDir = Join-Path $Repo "docs\pr-prompts"
$linter   = Join-Path $Repo "scripts\pipeline\lint-prompt.mjs"

if (-not (Test-Path $queueDir)) { Write-Output ("NO-OP: queue directory not found: " + $queueDir); exit 0 }
if (-not (Test-Path $linter))   { Write-Output ("NO-OP: linter not found: " + $linter);          exit 0 }

Set-Location $Repo

# ---- SPENT positive control (DOCTRINE section 7 standing guard 1) -------------------------
# The self-calibration at the bottom of this script counts NON-EMPTY buckets. With spent=0 --
# the reading on 2026-08-30 across 59 and 61 HOLDs -- the two verdicts it observed were ADMIT
# and REJECT, so it printed "calibrated" about the one bucket it had never exercised. That is
# the exact shape of a check never seen to pass. This control fires the SPENT branch on a
# fixture with a legitimately-false premise BEFORE the board is read, so spent=0 means "no
# spent prompts" rather than "this instrument cannot say spent".
$spentFixture   = Join-Path $Repo "scripts\pipeline\fixtures\spent-positive-control.md"
$spentProbeOk   = $false
$spentProbeNote = ""
if (Test-Path $spentFixture) {
    $probeOutput = (& node $linter "scripts/pipeline/fixtures/spent-positive-control.md" 2>&1)
    $probeExit   = $LASTEXITCODE
    if ($probeExit -eq 3) {
        $spentProbeOk = $true
    } else {
        $spentProbeNote = "fixture returned exit " + $probeExit + " (expected 3)"
    }
} else {
    $spentProbeNote = "fixture missing: " + $spentFixture
}
if ($spentProbeOk) {
    Write-Output "    SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable."
} else {
    Write-Output ("!!! SUSPECT: the SPENT bucket is UNMEASURABLE this run -- " + $spentProbeNote)
    Write-Output "!!! spent=0 below proves NOTHING. Fix the control before believing any spent reading."
}

$holdFiles = @(Get-ChildItem -Path $queueDir -Filter "*-HOLD.md" -File | Sort-Object Name)
Write-Output ("=== HOLD triage  --  " + $holdFiles.Count + " *-HOLD.md at depth 1 of docs/pr-prompts")
Write-Output ("    linter: " + $linter + "   (read-only; --dequeue is never passed)")
Write-Output ""

if ($holdFiles.Count -eq 0) { Write-Output "NO-OP: no *-HOLD.md prompts in the queue root."; exit 0 }

$satisfied  = New-Object System.Collections.ArrayList
$spent      = New-Object System.Collections.ArrayList
$stillGated = New-Object System.Collections.ArrayList
$unreadable = New-Object System.Collections.ArrayList

foreach ($holdFile in $holdFiles) {
    $relative  = "docs/pr-prompts/" + $holdFile.Name
    $rawOutput = (& node $linter $relative 2>&1)
    $exitCode  = $LASTEXITCODE
    $text      = ($rawOutput | Out-String)

    # First non-empty line, minus ANSI colour, is the verdict line.
    $verdict = ""
    foreach ($line in ($text -split "`r?`n")) {
        $clean = ($line -replace "\x1b\[[0-9;]*m", "").Trim()
        if ($clean) { $verdict = $clean; break }
    }

    $record = [pscustomobject]@{ Name = $holdFile.Name; Exit = $exitCode; Verdict = $verdict }

    switch ($exitCode) {
        0       { [void]$satisfied.Add($record) }
        3       { [void]$spent.Add($record) }
        1       { [void]$stillGated.Add($record) }
        default { [void]$unreadable.Add($record) }
    }
}

Write-Output ">>> SPENT -- premise already satisfied, the work has SHIPPED (lint exit 3)"
Write-Output "    The strongest sense of 'already satisfied'. Retire them to"
Write-Output "    docs/pr-prompts/superseded/ in a board PR. Do NOT arm."
if ($spent.Count -eq 0) { Write-Output "    (none)" }
foreach ($item in $spent) { Write-Output ("    " + $item.Name + "`n        " + $item.Verdict) }
Write-Output ""

Write-Output ">>> GATES SATISFIED -- lint ADMITs (exit 0). CANDIDATES, not instructions."
Write-Output "    ADMIT is NECESSARY, NOT SUFFICIENT. Read the body: a prose human gate is"
Write-Output "    invisible to the linter. Arm ONE AT A TIME, and only Station 00 arms."
if ($satisfied.Count -eq 0) { Write-Output "    (none)" }
foreach ($item in $satisfied) { Write-Output ("    " + $item.Name) }
Write-Output ""

Write-Output ">>> STILL GATED (lint exit 1) -- correctly on hold"
if ($stillGated.Count -eq 0) { Write-Output "    (none)" }
foreach ($item in $stillGated) { Write-Output ("    " + $item.Name + "`n        " + $item.Verdict) }
Write-Output ""

if ($unreadable.Count -gt 0) {
    Write-Output ">>> UNREADABLE -- unexpected linter exit code. Treat as UNMEASURED, not as a pass."
    foreach ($item in $unreadable) { Write-Output ("    " + $item.Name + "  exit=" + $item.Exit + "`n        " + $item.Verdict) }
    Write-Output ""
}

# Self-calibration (DOCTRINE section 7): prove the instrument can produce more than one answer.
$buckets = 0
foreach ($count in @($spent.Count, $satisfied.Count, $stillGated.Count)) { if ($count -gt 0) { $buckets++ } }

Write-Output ("=== TOTALS  spent=" + $spent.Count + "  gates-satisfied=" + $satisfied.Count + "  still-gated=" + $stillGated.Count + "  unreadable=" + $unreadable.Count + "  of " + $holdFiles.Count)
if (-not $spentProbeOk) {
    Write-Output ("!!! SUSPECT: spent=" + $spent.Count + " is UNMEASURED -- the SPENT positive control did not pass (" + $spentProbeNote + ").")
}
if ($buckets -lt 2) {
    Write-Output "!!! SUSPECT: every HOLD landed in ONE bucket. That is the signature of a broken"
    Write-Output "!!! probe, not of a uniform board. Prove node and git both resolve for"
    Write-Output "!!! lint-prompt.mjs (DOCTRINE 9.5 -- a missing git makes every gate skip) before"
    Write-Output "!!! believing this run."
} else {
    $seen = New-Object System.Collections.ArrayList
    if ($spent.Count      -gt 0) { [void]$seen.Add("SPENT") }
    if ($satisfied.Count  -gt 0) { [void]$seen.Add("ADMIT") }
    if ($stillGated.Count -gt 0) { [void]$seen.Add("REJECT") }
    Write-Output ("    calibrated: " + $buckets + " distinct verdicts observed on the board (" + ($seen -join ", ") + ").")
    if ($spentProbeOk) {
        Write-Output "    SPENT was additionally proved reachable by the fixture control above."
    }
}
Write-Output "    READ-ONLY: nothing was armed, renamed, moved or staged."
exit 0
