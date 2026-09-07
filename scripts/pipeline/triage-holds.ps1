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
# ...AND EXIT 1 IS NOT A PREMISE READING (SPENT_BEHIND_A_REJECT_V1, added 2026-09-07). That
# mapping is only sound if every prompt's premise actually RAN, and it does not.
# lint-prompt.mjs evaluates the premise LAST, and four rejection paths return before it:
# HUMAN_GATE_PRESENT, GATE_NOT_RELEASED, FILE_GATE_NOT_RELEASED and UI_PROMPT_NEEDS_DESIGN_REF.
# A prompt that hits any of them exits 1 with its premise never executed, and a prompt whose
# premise never ran can never be reported SPENT however completely its work has shipped. So the
# old TOTALS line published `spent=N ... of <every HOLD>` -- a denominator it had not measured.
# Measured on this board 2026-09-07: 33 of 68 HOLDs REJECTed, and ALL 33 by one of those four
# pre-premise codes, so the honest denominator was 35, not 68. The fifth bucket below runs the
# premise of every rejected prompt directly and reports what it finds; TOTALS now names the
# denominator it can actually stand behind. No linter change, no verdict change: the ordering
# in lint-prompt.mjs is deliberate and moving the premise first would change what REJECT means
# for every caller, the watcher included. This is a second READING, in the reporting layer.
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

# ---- GIT positive control (DOCTRINE section 7 standing guard 1 and 2) ---------------------
# WHY THIS EXISTS. lint-prompt.mjs fails OPEN with respect to arming: readFromOriginMain
# (lint-prompt.mjs:439-459) returns null when `git` cannot be reached and every one of the
# five gate probes then SKIPS, so the verdict line and the exit code are indistinguishable
# from a real ADMIT. Measured by Station 04 on 2026-08-30, A/B on the same board in the same
# minute: with a healthy git, gates-satisfied=29 / still-gated=31; with LINT_GIT_BIN pointed
# at a nonexistent binary, gates-satisfied=53 / still-gated=7. 24 gated HOLDs silently
# changed bucket -- including pr-rates-s11c-drop-legacy-tables (an irreversible table drop
# whose skipped gate is the file recording MARCO'S WRITTEN APPROVAL) -- and the calibration
# line printed the identical reassurance both times, because the 7 survivors were the
# HUMAN_GATE_PRESENT rejects matched at lint-prompt.mjs:728 BEFORE any git probe runs. The
# one failure mode where the buckets are wholesale wrong is precisely the one that leaves
# two buckets populated, so `buckets -lt 2` can never catch it.
#
# So: prove git can read origin/main BEFORE the sweep, and refuse to publish TOTALS if it
# cannot. An empty result is not an empty world (DOCTRINE section 9.6).
#
# The probe deliberately resolves the binary the SAME way lint-prompt.mjs does --
# $env:LINT_GIT_BIN ?? "git" -- so that testing the linter with a broken LINT_GIT_BIN also
# trips this control instead of sailing past it.
$gitBin      = if ($env:LINT_GIT_BIN) { $env:LINT_GIT_BIN } else { "git" }
$gitProbeOk  = $false
$gitProbeNote = ""
$knownTracked = "docs/pipeline/DOCTRINE.md"
try {
    $gitProbeOut = (& $gitBin show ("origin/main:" + $knownTracked) 2>&1 | Out-String)
    $gitProbeExit = $LASTEXITCODE
    if ($gitProbeExit -eq 0 -and $gitProbeOut.Length -gt 0) {
        $gitProbeOk = $true
    } else {
        $gitProbeNote = "`"" + $gitBin + " show origin/main:" + $knownTracked + "`" exited " + $gitProbeExit + " and returned " + $gitProbeOut.Length + " chars"
    }
} catch {
    $gitProbeNote = "`"" + $gitBin + "`" could not be executed: " + $_.Exception.Message
}
if ($gitProbeOk) {
    Write-Output ("    GIT control: PASS -- " + $gitBin + " read origin/main:" + $knownTracked + " (" + $gitProbeOut.Length + " chars), so gate probes can actually run.")
} else {
    Write-Output "[CANNOT MEASURE] the gate probes cannot run: git could not read origin/main."
    Write-Output ("    " + $gitProbeNote)
    Write-Output "    lint-prompt.mjs fails OPEN here -- every gate SKIPS and every gated HOLD"
    Write-Output "    would be reported as a candidate for arming, at exit 0, with no visible"
    Write-Output "    difference from a real ADMIT (DOCTRINE section 9.5). Publishing buckets"
    Write-Output "    from this state is worse than publishing nothing, so nothing is published."
    Write-Output "    Fix git (or unset LINT_GIT_BIN) and re-run. ARM NOTHING off this run."
    exit 2
}

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
$skippedGates = New-Object System.Collections.ArrayList

foreach ($holdFile in $holdFiles) {
    $relative  = "docs/pr-prompts/" + $holdFile.Name
    $rawOutput = (& node $linter $relative 2>&1)
    $exitCode  = $LASTEXITCODE
    $text      = ($rawOutput | Out-String)

    # A PARTIAL git outage does not trip the preflight above: git resolves, but an individual
    # `git show origin/main:<path>` still fails and lint-prompt.mjs prints
    #   "WARN  GATE_..._probe: could not reach origin/main:<path>; skipping (fail-safe ...)"
    # then ADMITs at exit 0. That WARN scrolls past above the TOTALS line everybody quotes, so
    # count it here and refuse to publish totals that any skipped gate contributed to.
    foreach ($rawLine in ($text -split "`r?`n")) {
        $cleanLine = ($rawLine -replace "\x1b\[[0-9;]*m", "").Trim()
        if ($cleanLine -match "probe: could not reach") {
            [void]$skippedGates.Add([pscustomobject]@{ Name = $holdFile.Name; Warn = $cleanLine })
        }
    }

    # First non-empty line, minus ANSI colour, is the verdict line.
    $verdict = ""
    foreach ($line in ($text -split "`r?`n")) {
        $clean = ($line -replace "\x1b\[[0-9;]*m", "").Trim()
        if ($clean) { $verdict = $clean; break }
    }

    # FullName is carried so the SPENT-BEHIND-A-REJECT pass below can re-read the prompt's own
    # front matter without re-globbing the queue.
    $record = [pscustomobject]@{ Name = $holdFile.Name; Exit = $exitCode; Verdict = $verdict; Path = $holdFile.FullName }

    switch ($exitCode) {
        0       { [void]$satisfied.Add($record) }
        3       { [void]$spent.Add($record) }
        1       { [void]$stillGated.Add($record) }
        default { [void]$unreadable.Add($record) }
    }
}

# ---- SPENT BEHIND A REJECT -- the fifth bucket ---------------------------------------------
# SPENT_BEHIND_A_REJECT_V1 - a REJECT does not mean the premise was evaluated.
#
# See the header. Everything in STILL GATED is UNMEASURED with respect to SPENT rather than
# measured-and-not-spent, so this pass asks the one question lint never reached: for each
# rejected prompt, is its premise FALSE -- i.e. has the work already SHIPPED?
#
# A hit means a prompt that is spent AND still gated. It should be RETIRED to
# docs/pr-prompts/superseded/ in a board PR, and it is invisible to the `spent` count above,
# which is exactly how a spent prompt survives a triage pass. It is a finding for a HUMAN.
# This pass stays read-only like the rest of the script: it runs one command per rejected
# prompt and arms, renames, moves and stages nothing.

# Read the `premise:` line out of a prompt's own front matter, applying lint-prompt.mjs's
# quote-stripping rule from parseFrontMatter -- and nothing else. This is DELIBERATELY NOT a
# second front-matter parser (see WHY IT DELEGATES, top of file): anything it does not
# recognise -- no front matter, no premise, an empty premise, a YAML block scalar -- returns
# $null, and the caller reports PREMISE UNMEASURABLE rather than guessing.
function Get-PromptPremise {
    param([string] $PromptPath)

    $promptLines = @(Get-Content -LiteralPath $PromptPath -ErrorAction SilentlyContinue)
    if ($promptLines.Count -eq 0) { return $null }
    if ($promptLines[0].Trim() -ne "---") { return $null }

    for ($index = 1; $index -lt $promptLines.Count; $index++) {
        if ($promptLines[$index].Trim() -eq "---") { break }
        $keyMatch = [regex]::Match($promptLines[$index], '^premise:\s*(.*)$')
        if (-not $keyMatch.Success) { continue }

        $value = $keyMatch.Groups[1].Value.Trim()
        if ($value -eq "") { return $null }
        # YAML block-scalar indicator: the real value lives on the following lines. Not folded
        # here on purpose -- an unfolded indicator is the two-character string, which would run
        # as a shell command and produce a confident wrong answer.
        if (@(">-", ">+", ">", "|-", "|+", "|") -contains $value) { return $null }

        $quote = $value.Substring(0, 1)
        if (($quote -eq "'" -or $quote -eq '"') -and $value.Length -gt 1 -and $value.Substring($value.Length - 1, 1) -eq $quote) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value -eq "") { return $null }
        return $value
    }
    return $null
}

# Resolve bash the same way lint-prompt.mjs's findBash does -- Git-for-Windows bash on Windows,
# /bin/bash elsewhere -- so that a box where the LINTER cannot run premises is a box where this
# probe reports UNMEASURABLE rather than inventing a verdict.
$bashBin = $null
if ($env:OS -eq "Windows_NT") {
    $bashCandidates = @("C:\Program Files\Git\bin\bash.exe", "C:\Program Files (x86)\Git\bin\bash.exe")
    if ($env:ProgramFiles) { $bashCandidates += (Join-Path $env:ProgramFiles "Git\bin\bash.exe") }
    foreach ($candidate in $bashCandidates) {
        if (Test-Path -LiteralPath $candidate) { $bashBin = $candidate; break }
    }
} else {
    $bashBin = "/bin/bash"
}

# Run ONE premise the way lint-prompt.mjs's runPremise does: same shell, same cwd (Set-Location
# $Repo above, the same cwd inheritance the `& node $linter <relative path>` calls already rely
# on), and the SAME split between "legitimately false" and "BROKEN":
#
#   exit 0                     -> the work is STILL NEEDED. Not spent.
#   clean non-zero             -> the premise is FALSE: the work has SHIPPED. SPENT.
#   127 / 126 / 2 / no spawn   -> the PROBE is broken, so the prompt is UNMEASURABLE.
#
# That last line is the whole point. DOCTRINE section 7 guard 2: never let a failed call flow
# into a comparison. A premise that never ran must NEVER be read as "premise false", and must
# never be read as "not spent" either.
#
# The premise is piped to bash on STDIN rather than passed as an argument on purpose: Windows
# PowerShell 5.1 mangles embedded double quotes in native-command arguments, and most premises
# on this board contain them.
#
# One deliberate difference from runPremise: it matches its "broken" phrases against stderr
# only, while PowerShell 5.1 cannot split the streams without a temp file, so this matches
# against stdout+stderr merged. The extra reach can only push a prompt from a verdict into
# UNMEASURABLE, which is LOUD and is never read as "not spent" -- the safe direction.
function Invoke-PremiseProbe {
    param([string] $PremiseCommand, [string] $BashBinary)

    if (-not $BashBinary) {
        return [pscustomobject]@{ Verdict = "UNMEASURABLE"; Detail = "no bash found (install Git for Windows) -- lint-prompt.mjs cannot run premises on this box either" }
    }
    # Windows PowerShell 5.1 encodes native-command stdin with $OutputEncoding, which defaults
    # to ASCII: a non-ASCII premise would be silently corrupted to '?' and then RUN. Refuse to
    # measure rather than measure something other than the premise.
    if ($PremiseCommand -match "[^\u0000-\u007F]") {
        return [pscustomobject]@{ Verdict = "UNMEASURABLE"; Detail = "premise contains non-ASCII characters; refusing to pipe it through an ASCII stdin encoding" }
    }

    $probeOutput = ""
    $probeExit   = $null
    try {
        $probeOutput = ($PremiseCommand | & $BashBinary -s 2>&1 | Out-String)
        $probeExit   = $LASTEXITCODE
    } catch {
        return [pscustomobject]@{ Verdict = "UNMEASURABLE"; Detail = "could not execute " + $BashBinary + ": " + $_.Exception.Message }
    }
    if ($null -eq $probeExit) {
        return [pscustomobject]@{ Verdict = "UNMEASURABLE"; Detail = "the premise produced no exit code at all" }
    }

    $probeText = $probeOutput.Trim()
    if ($probeText.Length -gt 200) { $probeText = $probeText.Substring(0, 200) }
    if ($probeExit -eq 0) {
        return [pscustomobject]@{ Verdict = "NEEDED"; Detail = "premise exit 0 -- the work is still needed" }
    }
    if ($probeExit -lt 0 -or $probeExit -eq 2 -or $probeExit -eq 126 -or $probeExit -eq 127 -or
        $probeText -match "command not found|No such file or directory|is not recognized|cannot access") {
        $brokenDetail = "premise ERRORED (exit " + $probeExit + ")"
        if ($probeText) { $brokenDetail = $brokenDetail + " -- " + $probeText }
        return [pscustomobject]@{ Verdict = "UNMEASURABLE"; Detail = $brokenDetail }
    }
    return [pscustomobject]@{ Verdict = "SPENT"; Detail = "premise exit " + $probeExit + " -- the premise is FALSE, the work has SHIPPED" }
}

# SPENT-BEHIND-A-REJECT positive control (DOCTRINE section 7 standing guard 1). A fifth bucket
# that reads 0 every run is the exact shape of a check never seen to fire. The SPENT control
# further up proves the LINTER can emit exit 3; it says nothing about THIS probe's own path. So
# drive the whole new path -- front-matter read, quote strip, bash spawn, exit-code split --
# over the same fixture, whose premise is legitimately false, and require SPENT back.
$behindProbeOk   = $false
$behindProbeNote = ""
if (Test-Path -LiteralPath $spentFixture) {
    $fixturePremise = Get-PromptPremise -PromptPath $spentFixture
    if (-not $fixturePremise) {
        $behindProbeNote = "no single-line premise could be read from " + $spentFixture
    } else {
        $fixtureResult = Invoke-PremiseProbe -PremiseCommand $fixturePremise -BashBinary $bashBin
        if ($fixtureResult.Verdict -eq "SPENT") {
            $behindProbeOk = $true
        } else {
            $behindProbeNote = "fixture probe returned " + $fixtureResult.Verdict + " (expected SPENT) -- " + $fixtureResult.Detail
        }
    }
} else {
    $behindProbeNote = "fixture missing: " + $spentFixture
}

$spentBehindReject   = New-Object System.Collections.ArrayList
$premiseUnmeasurable = New-Object System.Collections.ArrayList
$rejectStillNeeded   = New-Object System.Collections.ArrayList

foreach ($gatedItem in $stillGated) {
    $rejectedPremise = Get-PromptPremise -PromptPath $gatedItem.Path
    if (-not $rejectedPremise) {
        [void]$premiseUnmeasurable.Add([pscustomobject]@{ Name = $gatedItem.Name; Detail = "no single-line premise value in front matter (absent, empty, or a YAML block scalar)" })
        continue
    }
    $probeResult = Invoke-PremiseProbe -PremiseCommand $rejectedPremise -BashBinary $bashBin
    if ($probeResult.Verdict -eq "SPENT") {
        [void]$spentBehindReject.Add([pscustomobject]@{ Name = $gatedItem.Name; Verdict = $gatedItem.Verdict; Detail = $probeResult.Detail })
    } elseif ($probeResult.Verdict -eq "NEEDED") {
        [void]$rejectStillNeeded.Add($gatedItem.Name)
    } else {
        [void]$premiseUnmeasurable.Add([pscustomobject]@{ Name = $gatedItem.Name; Detail = $probeResult.Detail })
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
Write-Output "    'Correctly on hold' is a statement about GATES ONLY. lint rejected these"
Write-Output "    BEFORE it ran their premise, so nothing here says the work is outstanding."
if ($stillGated.Count -eq 0) { Write-Output "    (none)" }
foreach ($item in $stillGated) { Write-Output ("    " + $item.Name + "`n        " + $item.Verdict) }
Write-Output ""

Write-Output ">>> SPENT BEHIND A REJECT -- still gated, but the work has ALREADY SHIPPED"
Write-Output "    lint rejected each of these before reaching its premise, so exit 1 said nothing"
Write-Output "    about whether the work is done. Probed directly here: the premise is FALSE."
Write-Output "    Each one is spent AND gated. RETIRE it to docs/pr-prompts/superseded/ in a board"
Write-Output "    PR. It is invisible to the spent count above -- that is how a spent prompt"
Write-Output "    survives a triage pass. A finding for a human, not an instruction. Do NOT arm."
if ($spentBehindReject.Count -eq 0) { Write-Output "    (none)" }
foreach ($item in $spentBehindReject) { Write-Output ("    " + $item.Name + "`n        " + $item.Verdict + "`n        " + $item.Detail) }
if ($premiseUnmeasurable.Count -gt 0) {
    Write-Output ""
    Write-Output ("    PREMISE UNMEASURABLE -- " + $premiseUnmeasurable.Count + " rejected prompt(s) whose premise could not be RUN:")
    Write-Output "    a spawn failure, a missing binary, or a premise that is absent or malformed."
    Write-Output "    These are UNMEASURED. They are NOT 'not spent', and they are NOT spent. They"
    Write-Output "    are excluded from the denominator on the TOTALS line below."
    foreach ($item in $premiseUnmeasurable) { Write-Output ("    " + $item.Name + "`n        " + $item.Detail) }
}
if (-not $behindProbeOk) {
    Write-Output ""
    Write-Output ("!!! SUSPECT: this bucket is UNMEASURABLE this run -- " + $behindProbeNote)
    Write-Output "!!! An empty bucket above proves NOTHING. Fix the control before believing it."
}
Write-Output ""

if ($unreadable.Count -gt 0) {
    Write-Output ">>> UNREADABLE -- unexpected linter exit code. Treat as UNMEASURED, not as a pass."
    foreach ($item in $unreadable) { Write-Output ("    " + $item.Name + "  exit=" + $item.Exit + "`n        " + $item.Verdict) }
    Write-Output ""
}

# ---- SKIPPED-GATE gate: a partial git outage poisons the buckets, silently ----------------
if ($skippedGates.Count -gt 0) {
    $affected = @($skippedGates | Select-Object -ExpandProperty Name -Unique)
    Write-Output (">>> SKIPPED GATES -- " + $skippedGates.Count + " gate probe(s) could not reach origin/main, across " + $affected.Count + " prompt(s)")
    foreach ($item in $skippedGates) { Write-Output ("    " + $item.Name + "`n        " + $item.Warn) }
    Write-Output ""
    Write-Output "[CANNOT MEASURE] TOTALS are NOT published for this run."
    Write-Output "    A skipped gate is fail-safe against wrongly BINNING a prompt and fail-OPEN"
    Write-Output "    with respect to ARMING it: the gate simply does not run, and the prompt"
    Write-Output "    ADMITs at exit 0 (DOCTRINE section 9.5). Every prompt listed above is"
    Write-Output "    therefore UNMEASURED, not satisfied -- and a bucket count that includes"
    Write-Output "    unmeasured prompts is the confident wrong verdict DOCTRINE section 7 exists"
    Write-Output "    to prevent. ARM NOTHING off this run. Fix the reachability and re-run."
    Write-Output "    READ-ONLY: nothing was armed, renamed, moved or staged."
    exit 2
}

# Self-calibration (DOCTRINE section 7): prove the instrument can produce more than one answer.
$buckets = 0
foreach ($count in @($spent.Count, $satisfied.Count, $stillGated.Count)) { if ($count -gt 0) { $buckets++ } }

# THE DENOMINATOR. The old line read "spent=N ... of <every HOLD>", and that pairing was the
# defect: SPENT can only be measured over prompts whose premise actually RAN. So spent now
# carries its own denominator ON THE LINE PEOPLE QUOTE, "of N HOLDs" attaches to the bucket
# counts where it belongs, and the lines under it say which part of that denominator lint
# earned and which part this script's probe did -- because lint's exit codes still cannot say
# SPENT for a REJECT, whatever the probe found. An UNMEASURABLE prompt is in NEITHER number:
# excluded, never counted as not-spent (DOCTRINE section 7 guard 2).
$spentTotal       = $spent.Count + $spentBehindReject.Count
$lintEvaluated    = $satisfied.Count + $spent.Count
$premiseEvaluated = $lintEvaluated + $spentBehindReject.Count + $rejectStillNeeded.Count

Write-Output ("=== TOTALS  spent=" + $spentTotal + " of " + $premiseEvaluated + " evaluated  gates-satisfied=" + $satisfied.Count + "  still-gated=" + $stillGated.Count + "  unreadable=" + $unreadable.Count + "  of " + $holdFiles.Count + " HOLDs")
if ($premiseEvaluated -eq $holdFiles.Count) {
    Write-Output ("    The spent denominator is " + $premiseEvaluated + " -- every premise on this board was evaluated, but not")
    Write-Output ("    all of them by lint. lint runs the premise LAST, so it evaluated " + $lintEvaluated + " (the ADMIT and")
    Write-Output ("    STALE buckets) and its " + $stillGated.Count + " REJECT(s) never reached one.")
} else {
    Write-Output ("    The spent denominator is " + $premiseEvaluated + ", not " + $holdFiles.Count + ", and it is not all lint's. lint runs the")
    Write-Output ("    premise LAST, so it evaluated " + $lintEvaluated + " (the ADMIT and STALE buckets) and its " + $stillGated.Count)
    Write-Output "    REJECT(s) never reached one."
}
Write-Output ("    This script re-probed those " + $stillGated.Count + " REJECT(s) directly: " + $spentBehindReject.Count + " spent behind a REJECT,")
Write-Output ("    " + $rejectStillNeeded.Count + " still needed, " + $premiseUnmeasurable.Count + " UNMEASURABLE. So spent=" + $spentTotal + " is " + $spent.Count + " from lint plus " + $spentBehindReject.Count + " from the probe.")
if ($premiseUnmeasurable.Count -gt 0) {
    Write-Output ("    The " + $premiseUnmeasurable.Count + " UNMEASURABLE prompt(s) are EXCLUDED from the denominator above. They are")
    Write-Output "    not evidence of anything, in either direction. Fix them and re-run."
}
if (-not $spentProbeOk) {
    Write-Output ("!!! SUSPECT: the lint SPENT bucket (exit 3, count " + $spent.Count + ") is UNMEASURED -- the SPENT positive control did not pass (" + $spentProbeNote + ").")
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
    if ($spentBehindReject.Count   -gt 0) { [void]$seen.Add("SPENT-BEHIND-A-REJECT") }
    if ($premiseUnmeasurable.Count -gt 0) { [void]$seen.Add("PREMISE-UNMEASURABLE") }
    Write-Output ("    calibrated: " + $buckets + " distinct lint verdicts on the board; verdicts observed this run: " + ($seen -join ", ") + ".")
    if ($spentProbeOk) {
        Write-Output "    SPENT was additionally proved reachable by the fixture control above."
    }
    # A fifth verdict that is never observed must not ride along on the word "calibrated".
    if ($spentBehindReject.Count -eq 0) {
        if ($behindProbeOk) {
            Write-Output "    SPENT BEHIND A REJECT was never observed on the board. The fixture control proved"
            Write-Output "    the probe CAN emit it, so that 0 means none -- not 'this instrument cannot say'."
        } else {
            Write-Output "!!! SPENT BEHIND A REJECT was never observed AND its control did not pass, so it is a"
            Write-Output "!!! check never seen to fire. Read its 0 as UNMEASURED, not as none."
        }
    }
}
Write-Output "    READ-ONLY: nothing was armed, renamed, moved or staged."
exit 0
