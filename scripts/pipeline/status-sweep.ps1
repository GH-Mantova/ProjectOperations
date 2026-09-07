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
# Liveness rules -- RECENCY decides, dirtiness does not (corrected 2026-09-05):
#   touched < 30 min ago  => LIVE STATION WORKTREE, dirty or clean (a live station writes constantly)
#   touched >= 30 min ago => orphaned -- aborted run leftover, investigate/prune
#                            ...and if it is ALSO dirty it holds UNCOMMITTED WORK: preserve first.
#
# Why this is not "dirty => LIVE regardless of age" any more. That rule had no expiry: the 30-minute
# recency test was reachable only for a CLEAN tree, so it could never rescue a dirty one. An aborted
# run that left a single untracked file behind therefore pinned LIVE forever, and section 7 emitted a
# board-wide "CAUTION ... prefer to wait and re-run" on EVERY sweep until a human noticed. Measured
# 2026-09-04 by Station 03: C:/po-vg held one untracked file, 15.2 h of zero filesystem activity, and
# was still classified LIVE. That is the same never-clearing-flag shape DOCTRINE 9.5 records for
# list_sessions -- and status-sweep.ps1 is the instrument 9.5 names as the CURE for it.
# Dirtiness is not discarded, it is re-aimed: it no longer blocks the board, it warns before a prune.
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
    $isLive = ($ageMinutes -ge 0 -and $ageMinutes -lt 30)
    if ($isLive) {
      $liveWorktrees += $wtPath
      Line "LIVE" ("   LIVE STATION WORKTREE: " + $wtLine)
      Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min  -- do NOT prune; a station is working here")
    } else {
      Line "LIVE" ("   orphaned worktree (aborted run leftover -- investigate/prune): " + $wtLine)
      Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min")
      if ($dirtyCount -gt 0) {
        # Orphaned but dirty: safe to prune ONLY after the uncommitted work is preserved.
        # This is the half of the old rule worth keeping -- it warns, it no longer blocks the board.
        Line "LIVE" ("      <-- HOLDS UNCOMMITTED WORK (" + $dirtyCount + " file(s)). PRESERVE OR COMMIT BEFORE PRUNING; 'git worktree remove' will refuse, and --force would discard it.")
        Line "LIVE" ("          list it first: git -C " + $wtPath + " status --porcelain")
      }
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
      # -File is load-bearing, not tidiness. Without it this pipes DirectoryInfo objects into
      # Measure-Object -Property Length; directories have no Length, so PS 5.1 throws
      # "The property Length cannot be found in the input for any objects" and $escapeeSize
      # comes back $null -> the line below prints size=0KB. Measured 2026-09-01:
      # C:\po-worktrees\fix-followup-notes holds 6215 entries and 0 files, and was the only
      # escapee of nine that threw -- so the sweep reported a 15-day-old tree as "0KB", which
      # reads as empty and harmless to whoever decides what to prune. -ErrorAction
      # SilentlyContinue alone would silence the message and KEEP the wrong number.
      $escapeeSize = (Get-ChildItem $subdir.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
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
# Every needs-marco/*.md that names a PR number: re-query that PR LIVE.
#
# TWO CORRECTIONS, both measured 2026-09-06/07 (Station 00 flagged this three runs running; the
# 2026-09-07T00:08Z breadcrumb counted 126 [STALE] lines against 26 of 29 open escalations). The old
# verdict was one line -- state MERGED or CLOSED => "escalation is DEAD, clear it" -- and it was wrong
# in two independent ways that BOTH pushed the same direction: retire a LIVE escalation.
#
#   (a) CLOSED was collapsed into MERGED. A PR that closed UNMERGED shipped nothing. For a whole
#       class of escalation it is the PREMISE, not the refutation:
#       pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md exists BECAUSE #1612 closed
#       unmerged and its branch holds the only copy. The sweep read CLOSED and told the reader to
#       clear it -- the instrument retired the escalation exactly when its premise was satisfied.
#       Fix: ask for mergedAt, not state alone. mergedAt populated = actually merged. CLOSED with an
#       empty mergedAt is now a [FILE] "read it" line, never a [STALE] "clear it" instruction.
#
#   (b) EVERY #NNNN in the body was read as the escalation SUBJECT. A PR cited as EVIDENCE is
#       byte-identical to this regex to one the escalation is ABOUT.
#       label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md cites 30 merged PRs
#       as its measured evidence and therefore generated 30 "escalation is DEAD, clear it" lines
#       about itself. Fix: a ref counts as the SUBJECT only if the number is announced in the
#       FILENAME (pr-1612-...) or on the file's FIRST HEADING LINE. Anything else is context: we
#       still print it and still name its live state, but we drop the instruction. The instruction
#       was the harmful half.
#
# KNOWN AND ACCEPTED TRADEOFF (do not discover this the hard way): an escalation that IS about a
# merged PR but never says so in its filename or first heading will no longer be called STALE. That
# is a false negative, traded for the false positives above. It is NOT silent: every merged ref is
# still printed with its state, and a file that names no subject at all while citing merged PRs gets
# an explicit "section 5 CANNOT decide" line below. Refusing to answer is allowed; lying is not
# (DOCTRINE 7). If you want the STALE verdict back for such a file, title it after its PR.
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

  # ---- which PR numbers is this file ABOUT? (subject) vs merely citing? (evidence) --------------
  # SUBJECT 1: announced in the filename, e.g. "pr-1612-closed-unmerged-...". The "pr" marker is
  # required -- a bare number match would read the date in "...-2026-09-05.md" as PR #2026. The
  # trailing (?!-\d{2}-\d{2}) rejects a date that happens to follow the marker, which is not
  # hypothetical: "...-merged-a-red-pr-2026-08-20.md" otherwise yields subject PR #2026.
  $subjectNums = @()
  foreach ($m in [regex]::Matches($f.Name, '(?:^|[^0-9A-Za-z])[Pp][Rr][-_ #]?(\d{3,5})(?![0-9])(?!-\d{2}-\d{2})')) {
    $subjectNums += $m.Groups[1].Value
  }
  # SUBJECT 2: named on the FIRST heading line (the title). Body headings do not count -- an
  # evidence table under "## What I measured" is exactly the case (b) above.
  $firstHeading = ""
  foreach ($ln in ($txt -split '\r?\n')) {
    if ($ln -match '^\s{0,3}#{1,6}\s+\S') { $firstHeading = $ln; break }
  }
  if ($firstHeading) {
    foreach ($m in [regex]::Matches($firstHeading, '(?:pull/|#)(\d{3,5})')) { $subjectNums += $m.Groups[1].Value }
  }
  $subjectNums = @($subjectNums | Select-Object -Unique)

  $mergedCited = 0
  foreach ($n in $prNums) {
    # mergedAt, not state: DOCTRINE 9.4 -- "merged" is unreliable on a list response, mergedAt is
    # correct on both endpoints, and "pr view" is the per-PR form.
    $st = gh pr view $n --json state,isDraft,mergedAt 2>$null | ConvertFrom-Json
    if (-not $st) { Line "FILE" ($f.Name + " -> #" + $n + " not found via gh"); continue }
    $isMerged = -not [string]::IsNullOrWhiteSpace([string]$st.mergedAt)
    $isSubject = ($subjectNums -contains $n)
    $draft = if ($st.isDraft) { " [DRAFT]" } else { "" }
    if ($isMerged) { $mergedCited++ }

    if (-not $isSubject) {
      Line "FILE" ($f.Name + " cites #" + $n + " (" + $st.state + $draft + ") as evidence -- not its premise; does not clear the escalation.")
    } elseif ($isMerged) {
      Line "STALE" ($f.Name + " references #" + $n + " which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.")
    } elseif ($st.state -eq "CLOSED") {
      Line "FILE" ($f.Name + " references #" + $n + " which CLOSED UNMERGED -- this may be the escalation's PREMISE, read the file before clearing it.")
    } else {
      Line "LIVE" ($f.Name + " references #" + $n + " = " + $st.state + $draft + " -- genuinely open")
    }
  }

  # The false negative, said out loud rather than swallowed (DOCTRINE 7 / 9.6): this file cites
  # merged work but never names a subject PR, so section 5 has no basis for ANY staleness verdict.
  if ($subjectNums.Count -eq 0 -and $mergedCited -gt 0) {
    Line "FILE" ($f.Name + " names no subject PR in its filename or first heading but cites " + $mergedCited + " MERGED PR(s) -- section 5 CANNOT decide whether it is stale. Read the file; do not clear it on this line alone.")
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
