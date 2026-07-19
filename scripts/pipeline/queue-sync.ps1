# =============================================================================================
# queue-sync.ps1 -- reconcile ARMED-BY-COMMIT prompts into the CONSUMED-BY-FILESYSTEM queue.
#
# THE PROBLEM THIS EXISTS TO SOLVE
#   Arming a prompt means committing `docs/pr-prompts/<name>-ready.md` to origin/main.
#   Consuming a prompt means the watcher reading that file off DISK in the interactive tree
#   (PR_WATCHER_PROMPT_DIR = C:\ProjectOperations2\docs\pr-prompts).
#   Those two only agree while the interactive tree is current. On 2026-07-19 it was 83 commits
#   behind, so 23 prompts were armed on main and 0 were visible to the watcher. Merging the
#   arming PR accomplished NOTHING -- proven by #687, which merged and ran nothing.
#
# WHY NOT JUST PULL, OR MOVE THE QUEUE INTO THE CLONE
#   - Pulling the interactive tree is Marco's working tree; a dirty-tree pull has broken local
#     HEAD twice (see sot/05). Not this script's business.
#   - start-watcher.ps1 REFUSES a queue inside the clone, and it is right to: the clone runs
#     `git stash push` and hard resets, which would stash or destroy queued prompts.
#   So this script reconciles the two instead: it COPIES armed prompts from origin/main into
#   the queue dir. Purely ADDITIVE. It never pulls, never deletes, never touches tracked files.
#
# SAFETY PROPERTIES
#   - Additive only. Never removes or overwrites an existing queue entry.
#   - Never re-materialises a prompt that has already been consumed: anything present in
#     processed/ failed/ no-pr-opened/ blocked/ paused/ or recorded in the ledger is skipped.
#     Without the ledger a consumed prompt would be copied back in and run forever.
#   - Lint-gated. A prompt whose premise is already false (work shipped) is NOT materialised.
#     This is what stops the "arm 20 blind and burn agent runs redoing shipped work" failure.
#   - Byte-exact. Content is written by cmd.exe redirection, never through a PowerShell pipe:
#     piping `git show` through PS 5.1 injects U+FFFD, and `Set-Content -Encoding UTF8` writes
#     a BOM that node refuses to parse. Both bit before.
#
# PURE ASCII (PS 5.1 reads UTF-8-no-BOM as Windows-1252).
# =============================================================================================
[CmdletBinding()]
param(
    [string]$PromptDir = "C:\ProjectOperations2\docs\pr-prompts",
    [string]$GitRepo   = "C:\ProjectOperations2",
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"
$Ledger = Join-Path $PromptDir ".queue-sync-ledger.txt"
$SubDirs = @("processed", "failed", "no-pr-opened", "blocked", "paused", "in-progress")

function Say($tag, $msg) { Write-Output ("[queue-sync] " + $tag.PadRight(10) + " " + $msg) }

if (-not (Test-Path $PromptDir)) { Say "FATAL" ("prompt dir missing: " + $PromptDir); exit 1 }
if (-not (Test-Path $GitRepo))   { Say "FATAL" ("git repo missing: " + $GitRepo);   exit 1 }

# --- positive control: prove the instrument works before trusting a negative result. --------
# "0 prompts armed on main" must mean 0 armed, not "git failed and I read the silence as zero".
git -C $GitRepo fetch origin --quiet 2>$null
$probe = git -C $GitRepo rev-parse origin/main 2>$null
if ($LASTEXITCODE -ne 0 -or -not $probe) {
    Say "FATAL" "cannot resolve origin/main -- refusing to report an empty armed set from a broken instrument."
    exit 1
}
Say "origin" ("origin/main = " + $probe.Substring(0, 8))

$armed = @(git -C $GitRepo ls-tree --name-only origin/main "docs/pr-prompts/" 2>$null |
    Where-Object { $_ -match '(^|/)(pr|rev)-.*-ready\.md$' })
Say "armed" ("*-ready.md committed on origin/main: " + $armed.Count)

$ledgerSet = @{}
if (Test-Path $Ledger) {
    foreach ($l in (Get-Content $Ledger)) {
        $t = $l.Trim()
        if ($t -ne "" -and -not $t.StartsWith("#")) { $ledgerSet[$t] = $true }
    }
}

$materialised = 0; $skipShipped = 0; $skipPresent = 0; $skipConsumed = 0; $skipEscalates = 0

foreach ($path in $armed) {
    $name = Split-Path $path -Leaf
    $dest = Join-Path $PromptDir $name

    if (Test-Path $dest)          { $skipPresent++;  continue }
    if ($ledgerSet[$name])        { $skipConsumed++; continue }

    $seenElsewhere = $false
    foreach ($d in $SubDirs) {
        if (Test-Path (Join-Path (Join-Path $PromptDir $d) $name)) { $seenElsewhere = $true; break }
    }
    if ($seenElsewhere) {
        $skipConsumed++
        if (-not $DryRun) { Add-Content -Path $Ledger -Value $name -Encoding ASCII }
        continue
    }

    # Byte-exact extract to a temp file via cmd redirection (never a PowerShell pipe).
    $tmp = Join-Path $env:TEMP $name
    cmd /c "git -C `"$GitRepo`" show origin/main:$path > `"$tmp`"" 2>$null
    if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -eq 0) {
        Say "WARN" ("could not extract " + $name + " -- skipping (not treating as shipped)")
        continue
    }

    # Lint gate: a false premise means the work already shipped. Do NOT materialise it.
    # Note lint exit 0 = ADMIT. Anything else is either shipped or malformed; either way it
    # does not belong in the queue, but only a CLEAN non-zero means "shipped".
    $null = node (Join-Path $GitRepo "scripts\pipeline\lint-prompt.mjs") $tmp 2>&1
    $lintExit = $LASTEXITCODE
    if ($lintExit -ne 0) {
        $skipShipped++
        Say "shipped" ($name + " -- lint exit " + $lintExit + ", premise no longer true; not armed")
        if (-not $DryRun) { Add-Content -Path $Ledger -Value $name -Encoding ASCII }
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        continue
    }

    # Escalation gate. A prompt marked `escalates: true` is blocked on a decision only Marco
    # can make (commercial impact, auth design, an open namespace question). Lint ADMITs those
    # happily -- the premise is still true -- so lint alone is NOT sufficient. Without this
    # check the first dry run would have auto-armed exactly the three prompts sitting on
    # Marco's desk. Deliberately NOT ledgered: they must stay visible until he answers.
    $escalates = $false
    foreach ($fmLine in (Get-Content $tmp -TotalCount 40)) {
        if ($fmLine -match '^\s*escalates:\s*true\s*$') { $escalates = $true; break }
    }
    if ($escalates) {
        $skipEscalates++
        Say "NEEDS-MARCO" ($name + " -- escalates:true, blocked on a decision; not armed")
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        continue
    }

    if ($DryRun) {
        Say "would-arm" $name
    } else {
        Copy-Item -LiteralPath $tmp -Destination $dest -Force
        Add-Content -Path $Ledger -Value $name -Encoding ASCII
        # Read-back: assert what landed is what we meant to land.
        $srcLen = (Get-Item $tmp).Length
        $dstLen = (Get-Item $dest).Length
        $bom = $false
        $b = [System.IO.File]::ReadAllBytes($dest)
        if ($b.Length -ge 3 -and $b[0] -eq 239 -and $b[1] -eq 187 -and $b[2] -eq 191) { $bom = $true }
        if ($srcLen -ne $dstLen -or $bom) {
            Say "FATAL" ("read-back failed for " + $name + " (src=" + $srcLen + " dst=" + $dstLen + " bom=" + $bom + ")")
            Remove-Item $dest -Force -ErrorAction SilentlyContinue
            exit 1
        }
        Say "ARMED" ($name + " (" + $dstLen + " bytes, bom=false)")
    }
    $materialised++
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

Say "summary" ("armed=" + $materialised + "  already-in-queue=" + $skipPresent +
    "  already-consumed=" + $skipConsumed + "  shipped-stale=" + $skipShipped +
    "  needs-marco=" + $skipEscalates)
if ($skipEscalates -gt 0) {
    Say "ACTION" ([string]$skipEscalates + " armed prompt(s) are blocked on a Marco decision and were NOT run. " +
        "They stay armed on main and will be re-reported every cycle until answered.")
}

# Drift alarm: this is the number that silently grew to 83 while nobody was looking.
$behind = (git -C $GitRepo rev-list --count HEAD..origin/main 2>$null)
if ($behind -and [int]$behind -gt 0) {
    Say "DRIFT" ("the queue tree is " + $behind + " commit(s) behind origin/main. This script keeps the QUEUE " +
        "reconciled, but the tree itself is still stale -- local greps and lint runs from it will lie. " +
        "Lint from a clean origin/main worktree.")
}
exit 0
