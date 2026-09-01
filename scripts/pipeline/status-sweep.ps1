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
Write-Host ""
Write-Host "HOW TO READ -- traps this tool exists to prevent (every one is a real mistake made 2026-07-15):"
Write-Host "  * [LIVE]=GitHub or a running process (authoritative).  [FILE]=a snapshot, verify it.  [STALE]=proven out of date, NEVER repeat it as current."
Write-Host "  * A local file (station report / state / needs-marco) is NOT current just because it is recent. Section 5 re-checks its PR refs against GitHub."
Write-Host "  * A folder or a filename is NOT a running task (section 4C). The live schedule is the scheduled-tasks MCP ONLY."
Write-Host "  * 'behind origin/main' (section B) => local git reads may be STALE. Trust origin/main + gh, not your local index."
Write-Host "  * If ANY [BROKEN] appears in section 0, STOP: the report is unreliable until the instrument is fixed."
Write-Host "  * Report ONLY from [LIVE] lines. If a fact you want is not [LIVE], go get it live before stating it."

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
    # CI status per open PR (close blind-spot 2)
    $ci = gh pr checks $p.number 2>&1
    $pass = @($ci | Select-String -Pattern "`tpass`t", "pass" -SimpleMatch -ErrorAction SilentlyContinue).Count
    $fail = @($ci | Select-String -Pattern "fail" -SimpleMatch -ErrorAction SilentlyContinue).Count
    $pend = @($ci | Select-String -Pattern "pending", "in_progress", "queued" -SimpleMatch -ErrorAction SilentlyContinue).Count
    Line "LIVE" ("      CI: " + $pass + " pass / " + $fail + " fail / " + $pend + " pending" + $(if ($fail -gt 0) { "  <-- RED, do not expect a merge" } elseif ($pend -gt 0) { "  (still running)" } else { "  (green)" }))
  }
  $merged = @((gh pr list --state merged --limit 8 --json number,title,mergedAt 2>$null | Out-String | ConvertFrom-Json))
  Line "LIVE" "MERGED (most recent 8):"
  for ($i = 0; $i -lt $merged.Count; $i++) {
    $p = $merged[$i]
    $when = if ($p.mergedAt) { ($p.mergedAt -replace 'T', ' ').Substring(0, 16) + "Z" } else { "?" }
    Line "LIVE" ("   #" + $p.number + "  " + $when + "  " + $p.title)
  }
  # is the TRUNK green?
  # Fix: use --json and read conclusion field only -- prevents commit titles containing
  # "failure"/"cancelled" from being counted as failed runs. (trunk-conclusion)
  # ASK ABOUT THE COMMIT, NOT THE BRANCH. Two defects were measured here on 2026-09-01T00:1xZ and
  # both are fixed below.
  #   1. "--branch main --limit 3" samples an arbitrary mix of WORKFLOWS across DIFFERENT COMMITS,
  #      so the verdict is unstable minute to minute. It printed "TRUNK IS RED" while every one of
  #      the last 12 runs on main was a success. DOCTRINE 9.4 already requires the full 40-char SHA.
  #   2. A run in flight has conclusion "" and is correctly not counted as a failure -- but when
  #      EVERY run was in flight, mfail was 0, mok was 0, and the old line printed
  #      "0 success / 0 not-success  (trunk green)": green asserted on ZERO concluded evidence.
  #      That is DOCTRINE 9.6 inside the sweep's own trunk check. Green now REQUIRES a success.
  # "skipped" is a path-filter skip, not a failure, and is no longer counted as one.
  $mainSha = (git rev-parse origin/main 2>$null | Select-Object -First 1)
  if (-not $mainSha) {
    Line "LIVE" "main CI: [CANNOT MEASURE] cannot resolve origin/main"
  } else {
    $mainRunsRaw = (gh run list --commit $mainSha --limit 20 --json conclusion,name 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($mainRunsRaw) -or $mainRunsRaw -eq "[]") {
      # ConvertFrom-Json on "[]" puts something on the pipeline that @() counts as ONE. Test the
      # RAW string first, or an empty board reads as a single mystery run.
      Line "LIVE" ("main CI on " + $mainSha.Substring(0,8) + ": [CANNOT MEASURE] gh returned no runs for this commit")
    } else {
      # ASSIGN THEN FOREACH (DOCTRINE 9.4). On PS 5.1 "@($raw | ConvertFrom-Json)" wraps the whole
      # parsed ARRAY as a SINGLE element: .Count reads 1 and $_.conclusion member-enumerates into
      # " success success success". Measured here 2026-09-01 against a commit with 4 real runs --
      # it reported mok=1. The original line carried this same collapse.
      $mainParsed = $mainRunsRaw | ConvertFrom-Json
      $mainRuns = @()
      foreach ($r in $mainParsed) { $mainRuns += $r }
      $mfail = 0; $mok = 0; $mpend = 0
      foreach ($r in $mainRuns) {
        if (-not $r.conclusion) { $mpend++ }
        elseif ($r.conclusion -eq "success") { $mok++ }
        elseif ($r.conclusion -eq "skipped") { }
        else { $mfail++ }
      }
      $mverdict = if ($mfail -gt 0) { "  <-- TRUNK IS RED" }
                  elseif ($mok -gt 0 -and $mpend -eq 0) { "  (trunk green)" }
                  elseif ($mok -gt 0) { "  (no failure so far, but " + $mpend + " still running -- not yet green)" }
                  else { "  <-- [CANNOT MEASURE] nothing has concluded on this commit; NOT a green trunk" }
      Line "LIVE" ("main CI on " + $mainSha.Substring(0,8) + ": " + $mok + " success / " + $mfail + " failed / " + $mpend + " running" + $mverdict)
    }
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
# watcher CLONE health -- a dirty/wrong-branch clone is what makes start-watcher REFUSE to run
if (Test-Path (Join-Path $WatcherClone ".git")) {
  Push-Location $WatcherClone
  $cbranch = (git rev-parse --abbrev-ref HEAD 2>$null)
  $cdirty = @(git status --short 2>$null).Count
  Pop-Location
  $cflag = if ($cbranch -ne "main" -or $cdirty -gt 0) { "  <-- NOT clean-on-main; the watcher may refuse to start" } else { "" }
  Line "LIVE" ("watcher clone: branch=" + ($cbranch) + " dirty=" + $cdirty + $cflag)
} else { Line "LIVE" ("watcher clone MISSING at " + $WatcherClone) }

# worktree-liveness: classify each non-main worktree as LIVE or orphaned based on dirty state
# and age. Do NOT use node.exe process presence as the liveness signal (DOCTRINE 9.5).
# Liveness rules:
#   dirty (any uncommitted files)  => LIVE STATION WORKTREE regardless of age
#   clean AND touched < 30 min ago => LIVE STATION WORKTREE (station may just be starting/finishing)
#   clean AND touched >= 30 min ago => orphaned -- aborted run leftover, investigate/prune
$wt = @(git worktree list 2>$null | Where-Object { $_ -notmatch "\[main\]$" -and $_ -notmatch [regex]::Escape($Repo) })
$liveWorktrees = @()
if ($wt.Count -gt 0) {
  Line "LIVE" ("non-main worktrees found: " + $wt.Count + " -- classifying by liveness...")
  foreach ($wtLine in $wt) {
    # git worktree list format: <path>  <sha>  [<branch>]
    $wtPath = ($wtLine -split '\s+')[0].Trim()
    $dirtyCount = 0
    $ageMinutes = -1
    if (Test-Path $wtPath) {
      $dirtyOutput = git -C $wtPath status --porcelain 2>$null
      $dirtyCount = @($dirtyOutput | Where-Object { $_ -match '\S' }).Count
      $lastWrite = (Get-Item $wtPath).LastWriteTimeUtc
      $ageMinutes = [int]((Get-Date).ToUniversalTime() - $lastWrite).TotalMinutes
    }
    $isLive = ($dirtyCount -gt 0) -or ($ageMinutes -ge 0 -and $ageMinutes -lt 30)
    if ($isLive) {
      $liveWorktrees += $wtPath
      Line "LIVE" ("   LIVE STATION WORKTREE: " + $wtLine)
      Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min  -- do NOT prune; a station is working here")
    } else {
      Line "LIVE" ("   orphaned worktree (aborted run leftover -- investigate/prune): " + $wtLine)
      Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min")
    }
  }
} else { Line "LIVE" "non-main worktrees: none" }

# worktree-registry-escapees: directories under worktree roots that are NOT in git worktree list.
# These are invisible to the registry-based check above. Report them; do NOT prune.
# Station 03 acts on REGISTRY-ESCAPEE findings.
$worktreeRoots = @("C:\po-worktrees", "C:\po-wt", "C:\po-watcher-worktrees")
$registeredPaths = @(git worktree list 2>$null | ForEach-Object { ($_ -split '\s+')[0].Trim().ToLower() })
$escapeeCount = 0
foreach ($wtRoot in $worktreeRoots) {
  if (-not (Test-Path $wtRoot)) { continue }
  $subdirs = @(Get-ChildItem $wtRoot -Directory -ErrorAction SilentlyContinue)
  foreach ($subdir in $subdirs) {
    $subdirLower = $subdir.FullName.ToLower() -replace '\\', '/'
    $inRegistry = $registeredPaths | Where-Object { ($_ -replace '\\', '/') -eq $subdirLower }
    if (-not $inRegistry) {
      $escapeeCount++
      $escapeeAge = [int]((Get-Date).ToUniversalTime() - $subdir.LastWriteTimeUtc).TotalMinutes
      $escapeeSize = (Get-ChildItem $subdir.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
      $escapeeKB = if ($escapeeSize) { [int]($escapeeSize / 1024) } else { 0 }
      $hasLock = Test-Path (Join-Path $subdir.FullName ".git\index.lock")
      Line "LIVE" ("   REGISTRY-ESCAPEE: " + $subdir.FullName + "  size=" + $escapeeKB + "KB  age=" + $escapeeAge + "min  .lock=" + $hasLock)
    }
  }
}
if ($escapeeCount -eq 0) { Line "LIVE" "worktree-registry-escapees: none found under known roots" }
else { Line "LIVE" ("worktree-registry-escapees: " + $escapeeCount + " found -- Station 03 should review and prune if confirmed dead") }

# the guard hook is the safety floor (#569) -- confirm it still exists
$guard = Join-Path $Repo ".claude\hooks\guard.mjs"
Line "LIVE" ("guard hook (.claude/hooks/guard.mjs): " + $(if (Test-Path $guard) { "present" } else { "*** MISSING -- the skip-all-approvals floor is gone" }))

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
# recent remote board activity: a station doing gh-only work (merge/label) leaves NO local lock (close blind-spot 5)
$recent = @()
if ($ghOk) {
  $upd = @((gh pr list --state all --limit 10 --json number,updatedAt,state 2>$null | Out-String | ConvertFrom-Json))
  foreach ($u in $upd) {
    if ($u.updatedAt) {
      $secs = (New-TimeSpan -Start ([datetime]$u.updatedAt).ToUniversalTime() -End (Get-Date).ToUniversalTime()).TotalSeconds
      if ($secs -lt 120) { $recent += ("#" + $u.number + " " + $u.state) }
    }
  }
}
if ($recent.Count -gt 0) { Line "LIVE" ("remote board activity in last 2 min: " + ($recent -join ", ") + "  <-- a station may be doing gh-only work; prefer to wait") }
else { Line "LIVE" "no PR touched on GitHub in the last 2 min" }

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
Section "4B. RECENT FAILURES / SILENT EXITS (contents, not just counts -- close blind-spot 3)"
# ------------------------------------------------------------------------------------------------
foreach ($bucket in @("failed", "no-pr-opened")) {
  $d = Join-Path $Queue $bucket
  if (-not (Test-Path $d)) { continue }
  $all = @(Get-ChildItem (Join-Path $d "*") -File -ErrorAction SilentlyContinue)
  $files = @($all | Sort-Object LastWriteTime -Descending | Select-Object -First 6)
  Line "LIVE" ($bucket + "/ (" + $all.Count + " total; newest " + $files.Count + " shown):")
  foreach ($f in $files) {
    $reason = ""
    $rep = $f.FullName + ".report.md"
    if (Test-Path $rep) { $reason = (Get-Content $rep -TotalCount 40 | Where-Object { $_ -match '\S' } | Select-Object -First 1) }
    if (-not $reason) { $reason = (Get-Content $f.FullName -TotalCount 80 | Where-Object { $_ -match 'NO-OP|error|fail|reason|blocked|max turns' } | Select-Object -First 1) }
    if (-not $reason) { $reason = "(no reason captured -- open the file)" }
    $reason = ($reason -replace '[^\x20-\x7E]', ' ')
    if ($reason.Length -gt 100) { $reason = $reason.Substring(0, 100) }
    Line "LIVE" ("   " + $f.LastWriteTime.ToString("MM-dd HH:mm") + "  " + $f.Name + "  ::  " + $reason)
  }
}

# ------------------------------------------------------------------------------------------------
Section "4C. SCHEDULED AGENTS -- on-disk folders and state files are NOT the live schedule"
# TRAP THIS SECTION EXISTS TO PREVENT (a real mistake, 2026-07-15): a Scheduled\ folder was read as
# a running task, and a state file's fresh timestamp was attributed to a DELETED task of the same
# name. Both wrong. A folder is not a schedule; a filename is not a writer.
# ------------------------------------------------------------------------------------------------
Line "INFO" "RULE: the LIVE schedule is ONLY what the scheduled-tasks MCP (list_scheduled_tasks) returns."
Line "INFO" "      A folder in Scheduled\ can remain after a task is DELETED. A state file named after a task"
Line "INFO" "      does NOT mean that task wrote it (the supervisor reuses old filenames). NEVER infer 'X runs'"
Line "INFO" "      from a folder or a file named X. Report scheduled state ONLY from the MCP (checklist item)."
$schedRoot = "C:\Users\Marco\Claude\Scheduled"
if (Test-Path $schedRoot) {
  $folders = @(Get-ChildItem $schedRoot -Directory | ForEach-Object { $_.Name })
  Line "FILE" ("Scheduled\ folders on disk (" + $folders.Count + ") -- NOT proof of a live task, reconcile via MCP:")
  Line "FILE" ("   " + ($folders -join ", "))
}
$stateFiles = @(Get-ChildItem (Join-Path $Queue "*state*.md") -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
if ($stateFiles.Count -gt 0) {
  $fresh = $stateFiles[0]
  Line "FILE" ("freshest station summary: " + $fresh.Name + "  (" + $fresh.LastWriteTime.ToString("MM-dd HH:mm") + ") -- a SNAPSHOT by whoever last ran; verify claims against GitHub:")
  Get-Content $fresh.FullName -Tail 22 | Where-Object { $_ -match '\S' } | ForEach-Object {
    $t = ($_ -replace '[^\x20-\x7E]', ' ')
    if ($t.Length -gt 118) { $t = $t.Substring(0, 118) }
    Line "FILE" ("   | " + $t)
  }
} else { Line "FILE" "no station summary/state file found" }

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
if (-not $safe) {
  Line "LIVE" "DO NOT ACT: a board mutation is in progress (section 3 -- in-progress prompt / git lock / git process). Wait, re-run, then act."
} elseif ($liveWorktrees.Count -gt 0) {
  # A LIVE STATION WORKTREE means a station is actively working. Do not say SAFE TO ACT.
  # Do NOT say DO NOT ACT either -- a live worktree off origin/main is correct isolation.
  Line "LIVE" ("CAUTION: " + $liveWorktrees.Count + " LIVE STATION WORKTREE(s) detected (section 2):")
  foreach ($lwt in $liveWorktrees) { Line "LIVE" ("   " + $lwt) }
  Line "LIVE" "A station may be mid-run. Prefer to wait and re-run; if you must act, use an ISOLATED worktree and touch only NEW branches/PRs."
} elseif ($recent.Count -gt 0) {
  Line "LIVE" "CAUTION: no local lock, but a PR was touched on GitHub in the last 2 min (section 3). A station may be doing gh-only work. Prefer to wait a minute and re-run; if you must act, use an ISOLATED worktree and touch only NEW branches/PRs."
} else {
  Line "LIVE" "SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees."
  Line "LIVE" "   For any git WRITE, still prefer an ISOLATED worktree off origin/main. NEVER merge -- the supervisor drives the board."
}
Write-Host ""
Write-Host ("SWEEP COMPLETE " + $nowUtc + " -- report ONLY from [LIVE] lines; treat [FILE] as unverified; never repeat a [STALE] line as current.")
