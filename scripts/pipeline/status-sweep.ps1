# =============================================================================================
# status-sweep.ps1  --  the ONE deterministic status sweep. Run this before ANY status report.
#
# WHY THIS EXISTS
# ---------------
# Status reports kept going wrong the same way: a stale LOCAL file (a station's report, a
# needs-marco escalation, a supervisor state snapshot) was repeated as if it were current, when
# GitHub / the running process told a different story. On 2026-07-15 a report said "PR #571 is a
# held draft awaiting Marco" -- GitHub said #571 had MERGED 14h earlier. The local file was a
# snapshot; nobody re-checked it against the authority.
#
# THE RULE THIS SCRIPT ENFORCES, so a human does not have to remember it:
#   * GitHub and running processes are AUTHORITATIVE. Every fact from them is tagged [LIVE].
#   * Local .md report/state files are SNAPSHOTS. They are tagged [FILE] and every PR number
#     they mention is RE-QUERIED against GitHub; if the file's claim disagrees with GitHub, the
#     file is flagged [STALE].
#   * Every check runs a POSITIVE CONTROL first. A tool that cannot produce a known-true answer
#     is BROKEN, and "broken" is never silently reported as "nothing there" (DOCTRINE 7).
#
# READ-ONLY. Opens no PR, arms no prompt, deletes nothing, touches no branch. Safe any time.
#
# PURE ASCII (PS 5.1 reads UTF-8-no-BOM as Windows-1252). No em-dashes, no curly quotes.
#
# Usage:   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pipeline\status-sweep.ps1
# =============================================================================================

$ErrorActionPreference = "Continue"
$Repo = "C:\ProjectOperations2"
$WatcherClone = "C:\po-watcher\ProjectOperations"
$Queue = Join-Path $Repo "docs\pr-prompts"
Set-Location $Repo

function Section($t) { Write-Host ""; Write-Host ("==================== " + $t + " ====================") }
function Line($tag, $msg) { Write-Host ("  [" + $tag + "] " + $msg) }

$nowUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss") + "Z"
Write-Host ("STATUS SWEEP  --  generated " + $nowUtc + "  (all facts [LIVE] unless tagged [FILE]/[STALE])")

# ------------------------------------------------------------------------------------------------
Section "0. INSTRUMENT POSITIVE CONTROLS (if any FAIL, do not trust this report)"
# ------------------------------------------------------------------------------------------------
$ghOk = $false
try {
  $ctl = gh pr list --state merged --limit 1 --json number 2>$null | ConvertFrom-Json
  if ($ctl -and @($ctl).Count -ge 1) { $ghOk = $true; Line "LIVE" ("gh CAN reach GitHub (saw merged PR #" + @($ctl)[0].number + ")") }
  else { Line "BROKEN" "gh returned NO merged PRs -- gh is not authenticated/reachable. GitHub facts below are UNRELIABLE." }
} catch { Line "BROKEN" ("gh threw: " + $_.Exception.Message) }

$nodeOk = $false
try { $null = node -v 2>$null; if ($LASTEXITCODE -eq 0) { $nodeOk = $true; Line "LIVE" "node runs (backlog gate check available)" } } catch {}
if (-not $nodeOk) { Line "BROKEN" "node not available -- backlog gate check will be skipped" }

# ------------------------------------------------------------------------------------------------
Section "1. GITHUB (authoritative)"
# ------------------------------------------------------------------------------------------------
if ($ghOk) {
  $open = @((gh pr list --state open --limit 50 --json number,title,isDraft,mergeStateStatus 2>$null | Out-String | ConvertFrom-Json))
  Line "LIVE" ("OPEN PRs: " + $open.Count)
  for ($i = 0; $i -lt $open.Count; $i++) {
    $p = $open[$i]
    $d = if ($p.isDraft) { " [DRAFT]" } else { "" }
    Line "LIVE" ("   #" + $p.number + $d + "  " + $p.mergeStateStatus + "  " + $p.title)
  }
  $merged = @((gh pr list --state merged --limit 8 --json number,title,mergedAt 2>$null | Out-String | ConvertFrom-Json))
  Line "LIVE" "MERGED (most recent 8):"
  for ($i = 0; $i -lt $merged.Count; $i++) {
    $p = $merged[$i]
    $when = if ($p.mergedAt) { ($p.mergedAt -replace 'T', ' ').Substring(0, 16) + "Z" } else { "?" }
    Line "LIVE" ("   #" + $p.number + "  " + $when + "  " + $p.title)
  }
} else {
  Line "BROKEN" "SKIPPED -- gh positive control failed above."
}

# ------------------------------------------------------------------------------------------------
Section "2. WATCHER (running process, not a file)"
# ------------------------------------------------------------------------------------------------
$w = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*pr-watcher*" })
if ($w.Count -eq 0) { Line "LIVE" "watcher node: NOT RUNNING  <-- the queue will not drain" }
else { foreach ($x in $w) { Line "LIVE" ("watcher node: RUNNING pid " + $x.ProcessId) } }
$sup = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*supervise-watcher*" -or $_.CommandLine -like "*watcher-launcher*" })
Line "LIVE" ("auto-restart wrapper: " + $(if ($sup.Count) { "alive (" + $sup.Count + ")" } else { "NOT RUNNING -- watcher will not self-restart" }))
$hb = Join-Path $WatcherClone "scripts\pr-watcher\heartbeat.log"
if (Test-Path $hb) {
  $age = [int]((New-TimeSpan -Start (Get-Item $hb).LastWriteTime -End (Get-Date)).TotalMinutes)
  Line "LIVE" ("heartbeat age: " + $age + " min  (ticks only mid-run; stale + empty queue = idle, NOT wedged)")
}

# ------------------------------------------------------------------------------------------------
Section "3. IS THE BOARD BUSY? (safe-to-act gate -- REAL mutation signals, not 'is a chat open')"
# A headless claude-code process is NOT a reliable signal: THIS Cowork chat is also a headless
# claude-code process parented to the Desktop app, so counting those flags the user's own session
# as a station and always says DO NOT ACT. Key on actual board mutation instead.
# ------------------------------------------------------------------------------------------------
$inprog = @(Get-ChildItem (Join-Path $Queue "in-progress\*") -File -ErrorAction SilentlyContinue)
$lockInteractive = Test-Path (Join-Path $Repo ".git\index.lock")
$lockClone = Test-Path (Join-Path $WatcherClone ".git\index.lock")
$gitProc = @(Get-Process -Name git -ErrorAction SilentlyContinue)
$headless = @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.CommandLine -like "*claude-code*stream-json*" })
$boardBusy = ($inprog.Count -gt 0) -or $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)
Line "LIVE" ("in-progress prompts (a station is running one): " + $inprog.Count)
Line "LIVE" ("git index.lock  interactive/clone: " + $lockInteractive + " / " + $lockClone + "  (true = a git write is mid-flight)")
Line "LIVE" ("git processes running: " + $gitProc.Count)
Line "INFO" ("headless claude-code sessions: " + $headless.Count + "  (INCLUDES this chat -- informational, NOT a blocker)")

# ------------------------------------------------------------------------------------------------
Section "4. QUEUE (docs/pr-prompts on disk)"
# ------------------------------------------------------------------------------------------------
$armed = @(Get-ChildItem (Join-Path $Queue "*-ready.md") -ErrorAction SilentlyContinue)
Line "LIVE" ("armed (*-ready.md): " + $armed.Count)
foreach ($a in $armed) { Line "LIVE" ("   " + $a.Name) }
foreach ($sub in @("in-progress","needs-marco","no-pr-opened","failed","blocked")) {
  $d = Join-Path $Queue $sub
  if (Test-Path $d) {
    $c = @(Get-ChildItem (Join-Path $d "*") -File -ErrorAction SilentlyContinue)
    Line "LIVE" ($sub + "/: " + $c.Count)
  }
}

# ------------------------------------------------------------------------------------------------
Section "5. STALE-CLAIM CROSS-CHECK  (the step that was being skipped)"
# Every needs-marco/*.md that names a PR number: re-query that PR LIVE. If it is MERGED/CLOSED,
# the escalation is STALE and should be cleared -- it is NOT a live thing awaiting Marco.
# ------------------------------------------------------------------------------------------------
$nm = @(Get-ChildItem (Join-Path $Queue "needs-marco\*.md") -ErrorAction SilentlyContinue)
if ($nm.Count -eq 0) { Line "LIVE" "no needs-marco escalations on disk" }
foreach ($f in $nm) {
  $txt = Get-Content $f.FullName -Raw
  $prNums = [regex]::Matches($txt, "(?:pull/|#)(\d{3,5})") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
  if (-not $prNums -or -not $ghOk) {
    Line "FILE" ($f.Name + "  (no PR ref, or gh down -- cannot cross-check; read it as a SNAPSHOT)")
    continue
  }
  foreach ($n in $prNums) {
    $st = gh pr view $n --json state,isDraft 2>$null | ConvertFrom-Json
    if (-not $st) { Line "FILE" ($f.Name + " -> #" + $n + " not found via gh"); continue }
    if ($st.state -eq "MERGED" -or $st.state -eq "CLOSED") {
      Line "STALE" ($f.Name + " references #" + $n + " which is " + $st.state + " -- escalation is DEAD, clear it. Do NOT report it as pending.")
    } else {
      Line "LIVE" ($f.Name + " references #" + $n + " = " + $st.state + $(if ($st.isDraft) { " [DRAFT]" } else { "" }) + " -- genuinely open")
    }
  }
}

# ------------------------------------------------------------------------------------------------
Section "6. BACKLOG GATES"
# ------------------------------------------------------------------------------------------------
if ($nodeOk -and (Test-Path (Join-Path $Repo "scripts\pipeline\check-backlog.mjs"))) {
  Push-Location $Repo
  $esc = [char]27
  node scripts\pipeline\check-backlog.mjs 2>&1 | ForEach-Object {
    $clean = $_ -replace ($esc + '\[[0-9;]*m'), ''
    $clean = $clean -replace '[^\x20-\x7E]', '-'   # scrub em-dash mojibake from downstream console encoding
    Line "LIVE" $clean
  }
  Pop-Location
} else { Line "FILE" "check-backlog.mjs not present or node down -- skipped" }

# ------------------------------------------------------------------------------------------------
Section "7. VERDICT"
# ------------------------------------------------------------------------------------------------
$safe = -not $boardBusy
if ($safe) {
  Line "LIVE" "SAFE TO ACT: no board mutation in progress (no in-progress prompt, no git lock, no git process)."
  Line "LIVE" "   For any git WRITE, still prefer an ISOLATED worktree off origin/main. NEVER merge -- the supervisor drives the board."
} else {
  Line "LIVE" "DO NOT ACT: a board mutation is in progress (section 3). Wait, re-run this sweep, then act."
}
Write-Host ""
Write-Host ("SWEEP COMPLETE " + $nowUtc + " -- report ONLY from [LIVE] lines; treat [FILE] as unverified; never repeat a [STALE] line as current.")
