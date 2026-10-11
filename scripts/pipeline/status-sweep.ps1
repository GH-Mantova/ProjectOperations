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

# BOARD_LEASE_V1 (Marco, 2026-10-03). -Actor names the lane running this sweep so the verdict
# can tell "I hold the lease" apart from "another lane holds it". Defaults to $env:PO_ACTOR,
# else empty -- and when the caller is unknown, every LIVE lease is treated as someone else's,
# which is the safe direction (fail into CAUTION, not into SAFE TO ACT).
#
# -SkipSection5 is the fast-exit switch for station runs that cannot afford the stale-claim
# cross-check's needs-marco gh crawl. Measured 2026-10-09 across four consecutive hourly
# occurrences by Station 00 (14:27Z / 15:27Z / 16:14Z / 17:14Z): section 5 never finished inside
# a station's reading budget, so the closing SAFE / CAUTION / DO-NOT-ACT verdict (section 7) was
# unreachable in every one. When this switch is passed, section 5's needs-marco gh loop is
# replaced with a single [SKIP] line naming the section and why, so a reader cannot mistake a
# skipped section for an empty one (DOCTRINE 9.6: an empty result is not an empty world; a
# skipped section must not read as a clean one). The default run is unchanged -- section 5 still
# runs when the switch is absent.
[CmdletBinding()]
param(
    [string]$Actor = $env:PO_ACTOR,
    [switch]$SkipSection5
)

$ErrorActionPreference = "Continue"
$Repo = "C:\ProjectOperations2"
$WatcherClone = "C:\po-watcher\ProjectOperations"
$Queue = Join-Path $Repo "docs\pr-prompts"
$LeasePath = Join-Path $Repo ".git\po-board-lease.json"
# Section 4C quotes the body of the freshest *state*.md only while it is younger than this.
# Past it the line is tagged [STALE] and the body is withheld -- see the block at section 4C for
# the measurement that motivated it. Deliberately a named constant, not a literal, so the next
# reader can see there IS a threshold and what it is.
$StateSummaryMaxAgeDays = 3
Set-Location $Repo

# Per-section elapsed timing (SECTION_TIMING_V1). Each Section() call closes the prior section
# with a [TIMING] line so a reader can see where the budget actually goes, instead of inferring
# it from where the output stops. Added 2026-10-10 alongside -SkipSection5: the switch exists
# because section 5 does not finish, and the timing lines are how a later reader confirms a run
# landed inside budget rather than ran out again.
$script:SectionStart = $null
$script:SectionName  = $null
function Section($t) {
  if ($null -ne $script:SectionStart -and $null -ne $script:SectionName) {
    $elapsed = [math]::Round(((Get-Date) - $script:SectionStart).TotalSeconds, 1)
    Write-Host ("  [TIMING] section " + $script:SectionName + " elapsed=" + $elapsed + "s")
  }
  Write-Host ""
  Write-Host ("==================== " + $t + " ====================")
  $script:SectionStart = Get-Date
  $script:SectionName  = $t
}
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

  # MARCO_QUEUE_LINE_V1 (Marco, 2026-10-03). REPORT ONLY -- these lines never feed section 7's
  # SAFE / CAUTION / DO-NOT-ACT verdict. "ARM ONE AT A TIME" stops two runs colliding in the
  # dev tree; it does not stop five armed prompts producing five PRs that wait on the same
  # person. The sweep now reports that queue so stations can see what they are adding to.
  $marcoQueueScript = Join-Path $Repo "scripts\pipeline\marco-queue.mjs"
  $marcoTmp = [IO.Path]::GetTempFileName()
  try {
    $mqRaw = gh pr list --state open --limit 50 --json number,isDraft,labels,createdAt 2>$null | Out-String
    if ([string]::IsNullOrWhiteSpace($mqRaw)) { $mqRaw = "[]" }
    # UTF8 without BOM: PS 5.1's Set-Content/Out-File write a BOM that node's JSON.parse rejects.
    [IO.File]::WriteAllText($marcoTmp, $mqRaw, (New-Object System.Text.UTF8Encoding($false)))
    $mqOut = & node $marcoQueueScript --now $nowUtc --file $marcoTmp 2>&1
    $mqExit = $LASTEXITCODE
    $mqLines = @($mqOut) | Where-Object { $_ -ne $null -and "$_" -ne "" }
    if ($mqExit -eq 0 -and $mqLines.Count -ge 2) {
      foreach ($ln in $mqLines) { Line "LIVE" ([string]$ln) }
      # Control: ALL OPEN (non-draft) count MUST equal the non-draft PR count from the open-PR
      # loop above. A mismatch means one or the other is lying -- never silently paper over it.
      $nonDraftCount = @($open | Where-Object { -not $_.isDraft }).Count
      $allOpenLine = $mqLines | Where-Object { "$_" -match '^ALL OPEN \(non-draft\): (\d+)' } | Select-Object -First 1
      if ($allOpenLine -and "$allOpenLine" -match '^ALL OPEN \(non-draft\): (\d+)') {
        $reported = [int]$matches[1]
        if ($reported -ne $nonDraftCount) {
          Line "LIVE" ("MARCO QUEUE MISMATCH: section 1 counted " + $nonDraftCount + " non-draft PR(s), marco-queue.mjs counted " + $reported + " -- do not trust either number")
        }
      }
    } elseif ($mqExit -eq 2) {
      # CLI reported [CANNOT MEASURE] on its own line; forward it verbatim rather than
      # inventing a zero. "I could not measure" is a legitimate answer; "0" is not.
      foreach ($ln in $mqLines) { Line "LIVE" ([string]$ln) }
      if ($mqLines.Count -eq 0) { Line "LIVE" "WAITING ON MARCO: [CANNOT MEASURE] marco-queue.mjs exited 2 with no output" }
    } else {
      Line "LIVE" ("WAITING ON MARCO: [CANNOT MEASURE] marco-queue.mjs exited " + $mqExit + " unexpectedly")
    }
  } catch {
    Line "LIVE" ("WAITING ON MARCO: [CANNOT MEASURE] " + $_.Exception.Message)
  } finally {
    if (Test-Path $marcoTmp) { Remove-Item -LiteralPath $marcoTmp -Force -ErrorAction SilentlyContinue }
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
    $mainRunsRaw = (gh run list --commit $mainSha --limit 20 --json conclusion,name,event,workflowName,databaseId,createdAt 2>$null | Out-String).Trim()
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
      # NOT EVERY RUN ATTRIBUTED TO A COMMIT IS TRUNK CI. (TRUNK_VERDICT_SCOPED_V1)
      # MEASURED 2026-09-09 and again 2026-09-10: "gh run list --commit <sha>" also returns
      # Dependabot security-update runs and cron "Pipeline heartbeat" runs. Neither tests this
      # commit's code; they are merely ATTRIBUTED to main's HEAD. Counting them printed
      # "TRUNK IS RED" on a commit whose every real check was green -- on two separate days,
      # found independently by three stations. Nothing is empty and nothing warns, so DOCTRINE
      # 9.6 never fires: the query worked and answered a question nobody asked. The cost is
      # directional -- a station believing the line hunts a regression that does not exist.
      # This is a DENYLIST, deliberately, and NOT an "event -eq push" allowlist: CodeQL runs as
      # event "dynamic" (run name "Push on main") and IS a trunk check, so an allowlist would
      # silently drop it. An unknown future workflow keeps counting toward the verdict rather
      # than vanishing from it -- wrong-but-loud beats wrong-and-silent.
      $trunkRuns = @(); $otherRuns = @()
      foreach ($r in $mainRuns) {
        if ($r.workflowName -eq "Dependabot Updates" -or $r.event -eq "schedule") { $otherRuns += $r }
        else { $trunkRuns += $r }
      }
      $mfail = 0; $mok = 0; $mpend = 0
      foreach ($r in $trunkRuns) {
        if (-not $r.conclusion) { $mpend++ }
        elseif ($r.conclusion -eq "success") { $mok++ }
        elseif ($r.conclusion -eq "skipped") { }
        else { $mfail++ }
      }
      $mverdict = if ($trunkRuns.Count -eq 0) { "  <-- [CANNOT MEASURE] no trunk-CI run on this commit; NOT a green trunk" }
                  elseif ($mfail -gt 0) { "  <-- TRUNK IS RED" }
                  elseif ($mok -gt 0 -and $mpend -eq 0) { "  (trunk green)" }
                  elseif ($mok -gt 0) { "  (no failure so far, but " + $mpend + " still running -- not yet green)" }
                  else { "  <-- [CANNOT MEASURE] nothing has concluded on this commit; NOT a green trunk" }
      Line "LIVE" ("main CI on " + $mainSha.Substring(0,8) + ": " + $mok + " success / " + $mfail + " failed / " + $mpend + " running" + $mverdict)
      # Reported on their OWN line, never folded into the verdict above. The genuine signal inside
      # these is easy to lose in an aggregate: on 2026-09-09 five failing "Pipeline heartbeat" runs
      # were carrying a real SILENT-stations alarm, and the aggregate count hid it rather than
      # surfaced it. Excluding them from the verdict must not mean hiding them.
      if ($otherRuns.Count -gt 0) {
        $ofail = 0
        $onames = @{}
        $otherNewestFail = @{}
        foreach ($r in $otherRuns) {
          $isBad = ($r.conclusion -and $r.conclusion -ne "success" -and $r.conclusion -ne "skipped")
          if ($isBad) { $ofail++ }
          $wfKey = [string]$r.workflowName
          if (-not $onames.ContainsKey($wfKey)) { $onames[$wfKey] = @(0, 0) }
          $onames[$wfKey][0] = $onames[$wfKey][0] + 1
          if ($isBad) {
            $onames[$wfKey][1] = $onames[$wfKey][1] + 1
            # Track newest failing run per workflow (ISO string compare is lexicographic = chronological).
            $rCreated = [string]$r.createdAt
            if (-not $otherNewestFail.ContainsKey($wfKey) -or $rCreated -gt $otherNewestFail[$wfKey].createdAt) {
              $otherNewestFail[$wfKey] = @{ id = $r.databaseId; createdAt = $rCreated }
            }
          }
        }
        Line "LIVE" ("   NOT trunk CI on this commit, excluded from the verdict above: " + $otherRuns.Count + " run(s), " + $ofail + " failing")
        foreach ($wfKey in $onames.Keys) {
          Line "LIVE" ("      " + $wfKey + ": " + $onames[$wfKey][0] + " run(s), " + $onames[$wfKey][1] + " failing")
          # HEARTBEAT_ALARM_TEXT_V1 -- when the Pipeline heartbeat workflow has failures, resolve the
          # newest failing run and extract the alarm sentence from its log. ONE gh run view call per
          # sweep run at most (guarded by the $onames[$wfKey][1] -gt 0 condition, and only for this
          # workflow). A failed fetch must fail LOUD, never quiet -- DOCTRINE §7: "a tool that cannot
          # run must FAIL LOUD, never fail quiet."
          if ($wfKey -eq "Pipeline heartbeat" -and $onames[$wfKey][1] -gt 0) {
            $hbRunId = $otherNewestFail[$wfKey].id
            $hbLog = (gh run view $hbRunId --log-failed 2>$null | Out-String)
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hbLog)) {
              Line "LIVE" ("         [CANNOT MEASURE] gh run view " + $hbRunId + " --log-failed returned nothing")
            } else {
              $hbAlarm = $null
              foreach ($hbLine in ($hbLog -split '\r?\n')) {
                if ($hbLine -match '\[heartbeat\].*$') {
                  $hbAlarm = $Matches[0].Trim()
                  break
                }
              }
              if ($hbAlarm) {
                Line "LIVE" ("         alarm: " + $hbAlarm)
              } else {
                Line "LIVE" ("         [CANNOT MEASURE] no [heartbeat] line in gh run view " + $hbRunId + " --log-failed")
              }
            }
          }
        }
      }
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
# WRAPPER_COUNT_ANOMALY_V1 -- 2+ wrappers is the defect, not health; call it out with each wrapper's PID and start time.
$sup = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*supervise-watcher*" -or $_.CommandLine -like "*watcher-launcher*" })
if ($sup.Count -gt 1) {
  Line "LIVE" ("auto-restart wrapper: ANOMALY -- " + $sup.Count + " wrappers alive (expected 1). WRAPPER_COUNT_ANOMALY_V1")
  foreach ($wrapperProc in $sup) {
    $startLocal = try { ([datetime]$wrapperProc.CreationDate).ToString("MM-dd HH:mm") + " local" } catch { "(start time unreadable)" }
    Line "LIVE" ("   wrapper pid " + $wrapperProc.ProcessId + " started " + $startLocal)
  }
} else {
  Line "LIVE" ("auto-restart wrapper: " + $(if ($sup.Count) { "alive (" + $sup.Count + ")" } else { "NOT RUNNING -- watcher will not self-restart" }))
}
$hb = Join-Path $WatcherClone "scripts\pr-watcher\heartbeat.log"
if (Test-Path $hb) {
  # LOCAL vs LOCAL ON PURPOSE -- do NOT "fix" this to LastWriteTimeUtc. Get-Date is local, so the
  # subtraction is correct only while BOTH sides are local; changing one side alone would put a
  # 600-minute error into every heartbeat age on a UTC+10 host. The UTC rule applies to RENDERED
  # timestamps (sections 4B and 4C), not to arithmetic between two same-zone values, and not to the
  # Sort-Object calls below, which order rather than display.
  $age = [int]((New-TimeSpan -Start (Get-Item $hb).LastWriteTime -End (Get-Date)).TotalMinutes)
  Line "LIVE" ("heartbeat age: " + $age + " min  (ticks only mid-run; stale + empty queue = idle, NOT wedged)")
}
# watcher CLONE health -- a dirty/wrong-branch clone is what makes start-watcher REFUSE to run.
# SWEEP_DIRTY_MEANS_WHAT_THE_WATCHER_MEANS_V1 -- 2026-10-03. The old line counted `git status
# --short`, which includes UNTRACKED files, then warned "may refuse to start". But
# start-watcher.ps1 (scripts/pr-watcher/start-watcher.ps1) measures dirty with
# `git status --porcelain --untracked-files=no` -- its own comment is literally "Only TRACKED
# modified/staged files count as dirty". So the sweep flagged clones the watcher starts on
# happily, and the "watcher clone dirty=1, may refuse to start" line has been noise for weeks.
# Fix: match the watcher's own test for the flag, and report untracked separately as INFO.
if (Test-Path (Join-Path $WatcherClone ".git")) {
  Push-Location $WatcherClone
  $cbranch = (git rev-parse --abbrev-ref HEAD 2>$null)
  # TRACKED dirt -- the exact command start-watcher.ps1 uses. Two instruments on the same
  # question must share one command, so they cannot disagree.
  $trackedLines = @(git status --porcelain --untracked-files=no 2>$null | Where-Object { $_ -match '\S' })
  $cTrackedDirty = $trackedLines.Count
  # UNTRACKED, counted separately. `??` is the porcelain code for untracked (two spaces then
  # XY = "??"). The watcher stashes these with --include-untracked at launch, so they do not
  # refuse the start, but a reader may still want to know they are there.
  $untrackedLines = @(git status --porcelain --untracked-files=normal 2>$null | Where-Object { $_ -match '^\?\?' })
  $cUntracked = $untrackedLines.Count
  Pop-Location
  $cflag = if ($cbranch -ne "main" -or $cTrackedDirty -gt 0) { "  <-- NOT clean-on-main; the watcher may refuse to start" } else { "" }
  Line "LIVE" ("watcher clone: branch=" + ($cbranch) + " tracked-dirty=" + $cTrackedDirty + " untracked=" + $cUntracked + $cflag)
  if ($cTrackedDirty -eq 0 -and $cUntracked -gt 0 -and $cbranch -eq "main") {
    Line "LIVE" ("   watcher clone: " + $cUntracked + " untracked file(s) -- the watcher ignores these; add them to .git/info/exclude if they are expected")
  }
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
#
# WORKTREE_ORPHAN_ASKS_THE_BOARD_V1 -- added 2026-10-02. A worktree whose branch carries an OPEN PR
# is NOT an orphan to prune, even if it is old. After the recency classifier calls something orphaned,
# we ask the board once per branch (cached) before printing the prune wording. If gh is unreachable
# the prune wording is WITHHELD -- the dangerous default must never win on a measurement failure.
# The retained row is NOT added to $liveWorktrees: it is not a live station worktree and must not
# gate section 7's safe-to-act verdict. (DOCTRINE 9.4 -- pass -R, test $LASTEXITCODE before parsing.)
$GhRepoOwner = "GH-Mantova/ProjectOperations"
# Cache: branch name -> hashtable with keys: reachable (bool), prNumber (int or 0)
$branchPrCache = @{}
# Whether gh was reachable at all (set on first lookup; assumed ok until proven otherwise)
$ghBoardReachable = $true
$ghBoardChecked = $false

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
      # --- WORKTREE_ORPHAN_ASKS_THE_BOARD_V1: ask the board before printing the prune wording ---
      # Parse the branch from the third whitespace token: "[<branch>]" -> strip brackets.
      $wtTokens = $wtLine -split '\s+'
      $wtBranchRaw = if ($wtTokens.Count -ge 3) { $wtTokens[2].Trim() } else { "" }
      $wtBranch = $wtBranchRaw -replace '^\[', '' -replace '\]$', ''

      # Determine whether this branch has an open PR. Cache by branch name to avoid
      # repeated gh calls for the same branch (DOCTRINE 9.4 -- cost stated plainly in prompt).
      $openPrNumber = 0
      $boardReachable = $true
      if ($wtBranch -ne "" -and $wtBranch -ne "(detached)") {
        if ($branchPrCache.ContainsKey($wtBranch)) {
          $cachedEntry = $branchPrCache[$wtBranch]
          $boardReachable = $cachedEntry.reachable
          $openPrNumber = $cachedEntry.prNumber
        } else {
          # Pass -R so the call works from any CWD (DOCTRINE 9.4: a gh call from a non-repo CWD
          # answers empty for every question at exit 1 -- test $LASTEXITCODE before parsing).
          $ghPrJson = gh pr list -R $GhRepoOwner --head $wtBranch --state open --json number 2>$null
          $ghPrExitCode = $LASTEXITCODE
          if ($ghPrExitCode -ne 0) {
            $boardReachable = $false
            $ghBoardReachable = $false
          } else {
            $ghBoardChecked = $true
            # Assign-then-foreach to avoid PS 5.1 array-collapse on ConvertFrom-Json (DOCTRINE 9.4).
            $ghPrParsed = $ghPrJson | ConvertFrom-Json
            $ghPrList = @()
            foreach ($ghPrItem in $ghPrParsed) { $ghPrList += $ghPrItem }
            if ($ghPrList.Count -gt 0) { $openPrNumber = $ghPrList[0].number }
          }
          $branchPrCache[$wtBranch] = @{ reachable = $boardReachable; prNumber = $openPrNumber }
        }
      }

      if (-not $boardReachable) {
        Line "LIVE" ("   orphaned worktree (age=" + $ageMinutes + " min): " + $wtLine)
        Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min")
        Line "LIVE" ("      [CANNOT MEASURE] board not reachable; prune advice withheld")
      } elseif ($openPrNumber -gt 0) {
        Line "LIVE" ("   RETAINED - branch has OPEN PR #" + $openPrNumber + "; do NOT prune: " + $wtLine)
        Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min  -- branch=" + $wtBranch)
        # Do NOT add to $liveWorktrees: not a live station worktree; must not gate section 7 verdict.
      } else {
        Line "LIVE" ("   orphaned worktree (aborted run leftover -- investigate/prune): " + $wtLine)
        Line "LIVE" ("      dirty=" + $dirtyCount + " files  age=" + $ageMinutes + " min")
        # SWEEP_DIRTY_MEANS_WHAT_THE_WATCHER_MEANS_V1 -- 2026-10-03. An orphaned worktree whose
        # branch holds commits that exist on no remote is NOT safe to prune: `git worktree remove`
        # succeeds and the commits go to the reflog of a branch nothing else references, and the
        # next `git gc` destroys them. Dirty is one warning, unpushed is a SEPARATE warning, and
        # either one withholds the "safe to prune" wording below.
        $unpushedRaw = git -C $wtPath rev-list --count HEAD --not --remotes 2>$null
        $unpushedExit = $LASTEXITCODE
        $unpushedBlocks = $false
        if ($unpushedExit -ne 0 -or [string]::IsNullOrWhiteSpace([string]$unpushedRaw)) {
          # Detached with no history, or git refused -- never fall back to "safe". DOCTRINE 9.6.
          Line "LIVE" "      [CANNOT MEASURE] unpushed commits; prune advice withheld"
          $unpushedBlocks = $true
        } else {
          $unpushedCount = 0
          if (-not [int]::TryParse(([string]$unpushedRaw).Trim(), [ref]$unpushedCount)) {
            Line "LIVE" "      [CANNOT MEASURE] unpushed commits; prune advice withheld"
            $unpushedBlocks = $true
          } elseif ($unpushedCount -gt 0) {
            Line "LIVE" ("      <-- HOLDS " + $unpushedCount + " COMMIT(S) ON NO REMOTE BRANCH. Push or preserve before pruning. A squash-merged branch also shows here: confirm with gh pr list --head " + $wtBranch + " --state merged.")
            $unpushedBlocks = $true
          }
        }
        if ($dirtyCount -gt 0) {
          # Orphaned but dirty: before telling the reader to preserve work, probe whether the working
          # copy actually differs from origin/main (DOCTRINE 9.2/9.3 -- an EOL smudge or a generated
          # file regenerated identically produces a dirty count with nothing local to lose).
          $dirtyFilePaths = @($dirtyOutput | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Substring(3).Trim() })
          $trueLocalChanges = $false
          foreach ($dirtyFilePath in $dirtyFilePaths) {
            $diffOut = git -C $wtPath diff --numstat origin/main -- $dirtyFilePath 2>$null
            if ($diffOut -and ($diffOut | Where-Object { $_ -match '\S' })) {
              $trueLocalChanges = $true
              break
            }
          }
          if ($trueLocalChanges) {
            # Orphaned but dirty: safe to prune ONLY after the uncommitted work is preserved.
            # This is the half of the old rule worth keeping -- it warns, it no longer blocks the board.
            Line "LIVE" ("      <-- HOLDS UNCOMMITTED WORK (" + $dirtyCount + " file(s)). PRESERVE OR COMMIT BEFORE PRUNING; 'git worktree remove' will refuse, and --force would discard it.")
            Line "LIVE" ("          list it first: git -C " + $wtPath + " status --porcelain")
          } elseif (-not $unpushedBlocks) {
            # Every dirty file matches origin/main byte-for-byte (e.g. CRLF smudge, regenerated file).
            # Nothing local to lose -- AND no unpushed commits -- so a prune is safe without preserving.
            Line "LIVE" ("      dirty=" + $dirtyCount + " file(s) but ALL match origin/main (e.g. CRLF smudge or regenerated file) -- no local work to preserve; safe to prune.")
          } else {
            # Working-copy diff is all smudge, but unpushed commits are still at stake. Say so.
            Line "LIVE" ("      dirty=" + $dirtyCount + " file(s) match origin/main (CRLF smudge etc.), but unpushed commits above still block the prune.")
          }
        }
      }
    }
  }
} else { Line "LIVE" "non-main worktrees: none" }

# worktree-registry-escapees: directories under worktree roots that are NOT in git worktree list.
# These are invisible to the registry-based check above. Report them; do NOT prune.
# Station 03 acts on REGISTRY-ESCAPEE findings.
# C:\PR-Master\worktrees is the current root; the legacy roots retire per docs/pipeline/PR-MASTER.md.
$worktreeRoots = @("C:\PR-Master\worktrees", "C:\po-worktrees", "C:\po-wt", "C:\po-wt-h", "C:\po-watcher-worktrees")
# PR_MASTER_BARE_TREE_SCAN_V1 (2026-09-15): the roots above are CONTAINERS - the scan lists their
# subdirectories. A worktree created directly at "C:\<name>" is inside no container, so it was
# STRUCTURALLY invisible here: C:\po-fix1891 sat registered and on disk for 28 hours while this
# check reported "none found under known roots", and every legacy root PR-MASTER.md names as a
# single tree (po-vg, po-fix*, po-smoke, po-sec-fix, po-preserve, po-work) has the same shape.
# Detect them without git: a worktree's ".git" is a FILE ("gitdir: ..."); a clone's is a DIRECTORY.
# That one test separates a worktree from a clone AND from an ordinary folder, so scanning the
# drive root is cheap and cannot mistake Windows\ or Program Files\ for a tree.
$bareTrees = @(Get-ChildItem "C:\" -Directory -ErrorAction SilentlyContinue | Where-Object {
  Test-Path (Join-Path $_.FullName ".git") -PathType Leaf
})
# Quarantine under C:\PR-Master\_retired-* is where PR-MASTER.md SENDS a dead tree. Reporting it
# as an escapee would make the correct end state look like a defect forever.
$candidateDirs = @()
foreach ($wtRoot in $worktreeRoots) {
  if (-not (Test-Path $wtRoot)) { continue }
  $candidateDirs += @(Get-ChildItem $wtRoot -Directory -ErrorAction SilentlyContinue)
}
$candidateDirs += $bareTrees
$candidateDirs = @($candidateDirs | Where-Object { $_.FullName -notmatch '\\PR-Master\\_retired-' })
$registeredPaths = @(git worktree list 2>$null | ForEach-Object { ($_ -split '\s+')[0].Trim().ToLower() })
$escapeeCount = 0
foreach ($subdir in $candidateDirs) {
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
$lockInteractive = Test-Path (Join-Path $Repo ".git\index.lock")
$lockClone = Test-Path (Join-Path $WatcherClone ".git\index.lock")
# GITPROC_SCOPED_V1: count only git.exe touching our trees, by COMMAND LINE (DOCTRINE 9.5).
# A bare Get-Process -Name git matches EVERY git.exe on the machine, including a read-only
# 'git show' run by a concurrent chat against an unrelated repo, and this sweep's own transient
# git children. Measured 2026-09-10: one plain 'git log' child took the unscoped count from 0
# to 2 on an otherwise idle board while index.lock stayed False, and section 7 printed
# DO NOT ACT on that count alone. The comment above already reasoned this same class through
# for claude.exe -- this line kept the shape that comment fixed. Only git.exe whose command
# line names the dev tree ($Repo) or the watcher clone ($WatcherClone) is board-busy;
# anything else is another repository's business. CWD cannot be read from Win32_Process in
# PS 5.1 without P/Invoke, so a bare 'git status' issued from inside $Repo will not match --
# such an invocation is either a WRITE (caught by index.lock two lines above) or a READ
# (which never justified DO NOT ACT). The unscoped total is still reported as [INFO] below so
# no reader loses a number they may have been relying on (RULE 1: additive, existing signals
# untouched).
$gitProcAll = @(Get-CimInstance Win32_Process -Filter "Name='git.exe'" -ErrorAction SilentlyContinue)
$repoPat = $Repo.ToLower()
$clonePat = $WatcherClone.ToLower()
$gitProc = @($gitProcAll | Where-Object {
  $cl = if ($_.CommandLine) { $_.CommandLine.ToLower() } else { "" }
  ($cl.Contains($repoPat)) -or ($cl.Contains($clonePat))
})
$headless = @(Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Where-Object { $_.CommandLine -like "*claude-code*stream-json*" })
# THREE REAL signals. A fourth term used to sit at the front of this expression: a count of files
# in a queue subdirectory that NO producer ever writes (scripts/pr-watcher/index.mjs files prompts
# to processed/, failed/, blocked/, paused/ and no-pr-opened/ and names no such folder; the folder
# is not tracked on main and not on disk). It was therefore a PERMANENT ZERO, and a permanent zero
# ORed into a boolean contributes nothing -- removing it cannot change this value. See the
# buildRunning comment below for the measurement and for what replaced it.
$boardBusy = $lockInteractive -or $lockClone -or ($gitProc.Count -gt 0)
Line "LIVE" ("git index.lock  interactive/clone: " + $lockInteractive + " / " + $lockClone + "  (true = a git write is mid-flight)")
Line "LIVE" ("git processes touching our trees (scoped): " + $gitProc.Count + "  (this is what feeds the safe-to-act gate)")
Line "INFO" ("git processes machine-wide (unscoped): " + $gitProcAll.Count + "  (includes concurrent chats and other repos -- informational, NOT a blocker)")
Line "INFO" ("headless claude-code sessions: " + $headless.Count + "  (INCLUDES this chat -- informational, NOT a blocker)")

# ---- buildRunning: a REAL live signal, REPORTED AND DELIBERATELY NOT WIRED INTO $boardBusy ------
# WHAT THIS REPLACES. The line that used to print here counted files in a queue subdirectory that
# nothing writes, and printed the resulting permanent 0 as a [LIVE] fact meaning "no station is
# running a prompt". Measured 2026-09-01T02:55:09Z: the sweep printed that zero while
# scripts/pr-watcher/logs/2026-08-31.log showed a build started at 02:33:55Z and the heartbeat was
# ticking elapsed=180s. A build WAS running; the sweep said none was. DOCTRINE 9.6 exactly -- an
# empty result reported as an empty world -- inside the one instrument every station is told to
# obey before mutating the board.
#
# The heartbeat is the signal that folder was pretending to be: the watcher rewrites it every 60 s
# for as long as an agent is actually running, and never otherwise.
#
# *** DO NOT ADD $buildRunning TO $boardBusy, AND DO NOT LET IT EMIT A "DO NOT ACT" VERDICT. ***
# This is not half-finished wiring for the next reader to complete. A watcher build lasts 20-75
# minutes and the watcher builds near-continuously, so a board that blocked on this signal would be
# frozen for most of the day. That is the "without damaging existing work" half of RULE 1, and it is
# the whole reason this fact is REPORTED rather than ENFORCED: a station reads it and decides. If
# you believe it belongs in the gate, change RULE 1 first -- do not change this line alone.
$buildHeartbeat = Join-Path $WatcherClone "scripts\pr-watcher\heartbeat.log"
$buildRunning = $false
$buildReport = "[CANNOT MEASURE] heartbeat.log not found at " + $buildHeartbeat
if (Test-Path $buildHeartbeat) {
  try {
    $buildLines = @(Get-Content $buildHeartbeat -Tail 5 -ErrorAction Stop | Where-Object { $_ -match '\S' })
    if ($buildLines.Count -eq 0) {
      $buildReport = "[CANNOT MEASURE] heartbeat.log is present but holds no non-empty line"
    } else {
      $buildLast = $buildLines[$buildLines.Count - 1]
      # Anchor on the TICK shape the watcher writes: "[<iso>] <name> elapsed=<N>s last: <snippet>".
      # Requiring elapsed= to be the token immediately after the name is what rejects the OTHER
      # line the watcher appends to this same file:
      #   "[<iso>] [run-timeout] <name> exceeded 75 min (elapsed=4500s) - killing child ..."
      # which also carries elapsed=<N>s but means the child was KILLED -- the opposite of a build in
      # flight. A bare 'elapsed=\d+s' search would read that as a running build.
      $buildMatch = [regex]::Match($buildLast, '^\[[^\]]+\]\s+(\S+)\s+elapsed=\d+s\b')
      # BOTH SIDES UTC, on purpose. Do NOT "make this consistent" with the heartbeat-age line in
      # section 2, which subtracts two LOCAL values and says why; mixing the two zones is the
      # 600-minute error that comment exists to prevent. Compare on the raw double and round only
      # for display: [int] in PowerShell rounds (2.9 -> 3), so casting before the test would call a
      # 2.9-minute-old tick stale.
      $buildAgeRaw = ((Get-Date).ToUniversalTime() - (Get-Item $buildHeartbeat).LastWriteTimeUtc).TotalMinutes
      $buildAgeMin = [math]::Round($buildAgeRaw, 1)
      if (-not $buildMatch.Success) {
        $buildReport = "no build in flight (newest heartbeat line is not a tick; file " + $buildAgeMin + " min old)"
      } elseif ($buildAgeRaw -ge 3) {
        $buildReport = "no build in flight (newest tick is " + $buildAgeMin + " min old; ticks are 60 s apart while a build runs)"
      } else {
        $buildRunning = $true
        # Scrub to printable ASCII: the snippet the watcher tails into this file can carry any byte,
        # and section 4B scrubs for the same reason.
        $buildPromptName = ($buildMatch.Groups[1].Value -replace '[^\x20-\x7E]', '')
        $buildReport = "BUILD IN FLIGHT: " + $buildPromptName + "  (tick " + $buildAgeMin + " min old)"
      }
    }
  } catch {
    # Unreadable is not idle. Never print false here (DOCTRINE 9.6).
    $buildReport = "[CANNOT MEASURE] heartbeat.log unreadable: " + $_.Exception.Message
  }
}
Line "LIVE" ("watcher build (heartbeat -- blocks arming and merging (section 7)): " + $buildReport)

# ---- BOARD_LEASE_V1 ------------------------------------------------------------------------
# A board lease is a short JSON file at .git\po-board-lease.json. A lane that is arming or
# merging writes it; another lane reads it and stands down. The file expires after 30 min on
# its own so a crashed lane cannot strand the board. Section 7 reads the result below.
# Fail-safe: a file that is present but UNREADABLE / MALFORMED is treated as HELD BY 'unknown'
# until its file time + 30 min, never as 'free' -- the dangerous direction is "board is free"
# when it is not.
$leaseObj      = $null
$leaseAgeStr   = ""
$leaseHoldLine = "free"
if (Test-Path -LiteralPath $LeasePath -PathType Leaf) {
    $corrupt = $false
    try {
        $leaseRaw = Get-Content -LiteralPath $LeasePath -Raw -Encoding UTF8 -ErrorAction Stop
        $leaseObj = $leaseRaw | ConvertFrom-Json -ErrorAction Stop
    } catch { $corrupt = $true }
    if ($corrupt -or $null -eq $leaseObj -or [string]::IsNullOrWhiteSpace("$($leaseObj.actor)") -or [string]::IsNullOrWhiteSpace("$($leaseObj.expiresAt)")) {
        $fileItem = Get-Item -LiteralPath $LeasePath -ErrorAction SilentlyContinue
        $fileTime = if ($fileItem) { $fileItem.LastWriteTimeUtc } else { [DateTime]::UtcNow.AddMinutes(-30) }
        $synthExp = $fileTime.AddMinutes(30)
        if ($synthExp -gt [DateTime]::UtcNow) {
            $leaseObj = [pscustomobject]@{
                actor      = "unknown"
                reason     = "corrupt-lease-file"
                acquiredAt = $fileTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
                expiresAt  = $synthExp.ToString("yyyy-MM-ddTHH:mm:ssZ")
            }
        } else { $leaseObj = $null }
    } else {
        # ConvertFrom-Json auto-parses "yyyy-MM-ddTHH:mm:ssZ" into DateTime objects; passing
        # them back through [DateTime]::Parse goes through a locale-dependent ToString and
        # under US culture 2026-10-03 becomes 2026-03-10. Coerce if already DateTime;
        # ParseExact with invariant culture only when a string somehow survived.
        $leaseExp = $null
        try {
            if ($leaseObj.expiresAt -is [DateTime]) {
                $leaseExp = ([DateTime]$leaseObj.expiresAt).ToUniversalTime()
            } else {
                $leaseExp = [DateTime]::ParseExact(
                    [string]$leaseObj.expiresAt, "yyyy-MM-ddTHH:mm:ssZ",
                    [System.Globalization.CultureInfo]::InvariantCulture,
                    [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
            }
        } catch { $leaseExp = [DateTime]::UtcNow.AddMinutes(-1) }
        if ($leaseExp -le [DateTime]::UtcNow) { $leaseObj = $null }
    }
    if ($leaseObj) {
        try {
            if ($leaseObj.acquiredAt -is [DateTime]) {
                $leaseAcq = ([DateTime]$leaseObj.acquiredAt).ToUniversalTime()
            } else {
                $leaseAcq = [DateTime]::ParseExact(
                    [string]$leaseObj.acquiredAt, "yyyy-MM-ddTHH:mm:ssZ",
                    [System.Globalization.CultureInfo]::InvariantCulture,
                    [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
            }
            $leaseAgeStr = "$([int](([DateTime]::UtcNow - $leaseAcq).TotalMinutes)) min old"
        } catch { $leaseAgeStr = "age unknown" }
        $leaseHoldLine = "$($leaseObj.actor)  reason=$($leaseObj.reason)  $leaseAgeStr  expires=$($leaseObj.expiresAt)"
    }
}
Line "LIVE" ("board lease: " + $leaseHoldLine)
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
# Test-Path FIRST, and SAY SO when the answer is "absent". A directory that is not there is not a
# directory holding zero files (DOCTRINE 9.6). This is not a hypothetical distinction here: every
# one of these subdirs is gitignored (.gitignore lines 76-83), so "absent" is the NORMAL state of a
# fresh clone. The old shape had a bare `if (Test-Path)` with no else, so a missing failed/ or
# blocked/ produced NO LINE AT ALL and the section read as "nothing failed, nothing blocked" to
# whoever was deciding what to do next.
foreach ($sub in @("needs-marco","no-pr-opened","failed","blocked")) {
  $d = Join-Path $Queue $sub
  if (Test-Path $d) {
    $c = @(Get-ChildItem (Join-Path $d "*") -File -ErrorAction SilentlyContinue)
    Line "LIVE" ($sub + "/: " + $c.Count)
  } else {
    Line "LIVE" ("[CANNOT MEASURE] queue subdir absent: " + $sub + "  (nothing was counted -- this is NOT a count of 0)")
  }
}

# ------------------------------------------------------------------------------------------------
Section "4B. RECENT FAILURES / SILENT EXITS (contents, not just counts -- close blind-spot 3)"
# ------------------------------------------------------------------------------------------------
foreach ($bucket in @("failed", "no-pr-opened")) {
  $d = Join-Path $Queue $bucket
  if (-not (Test-Path $d)) {
    # Absent is not empty, same rule as section 4. The old bare `continue` emitted nothing, so a
    # missing failed/ made this whole section read as "no recent failures" (DOCTRINE 9.6).
    Line "LIVE" ("[CANNOT MEASURE] queue subdir absent: " + $bucket + "  (recent failures cannot be listed)")
    continue
  }
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
    # RENDER IN UTC AND SAY SO. This host runs E. Australia Standard Time (UTC+10), so
    # .LastWriteTime here printed every file ten hours fresher than it was, unmarked, in a report
    # whose section 1 and closing line both carry an explicit Z. Measured 2026-09-01: a file whose
    # LastWriteTimeUtc was 2026-08-31 20:26:21Z printed here as 09-01 06:26, in a report closing
    # SWEEP COMPLETE 2026-09-01 10:11:36Z -- 13.8 h old, shown as 3.8 h old, beside a UTC line that
    # invites the comparison. These lines feed freshness judgements, so the error is not cosmetic.
    # Use .LastWriteTimeUtc and append the Z; never .LastWriteTime in a rendered string.
    Line "LIVE" ("   " + $f.LastWriteTimeUtc.ToString("MM-dd HH:mm") + "Z  " + $f.Name + "  ::  " + $reason)
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
  # UTC + explicit Z, same reason as section 4B above. This is the line a station reads to decide
  # whether the last station summary is worth trusting, so a ten-hour flattery here is the single
  # most consequential local-time render in the sweep.
  #
  # AGE GATE, added 2026-09-21 (Station 04 finding F6, breadcrumb
  # 00-04-scanner-2026-09-21-1810-...-quoted-into-every-sweep.md; landed by Station 00).
  # Quoting the body is only defensible while the body is recent. MEASURED 2026-09-21T18:1xZ:
  # docs/pr-prompts/queue-watch-state.md was 21 days old, UNTRACKED and UNIGNORED (so nothing
  # will ever commit or remove it), and this block printed ~20 lines of its body into EVERY
  # station's preflight -- naming an open board of #1443 #1450 #1457 #1460 when the live board
  # was #2042 #2044 #2047 #2049 #2051. Every quoted number was three weeks dead. The [FILE] tag
  # and the "verify against GitHub" caveat are honest, but STATION-CAPABILITIES.md section 1 is
  # that a stale instruction reads exactly like a current one, and this was twenty lines of
  # confident stale board state printed ABOVE the [LIVE] section that contradicts it.
  # So past $StateSummaryMaxAgeDays the body is NOT quoted and the line is tagged [STALE] --
  # which the legend already defines as "proven out of date, NEVER repeat it as current".
  # The file is still NAMED and DATED, so nothing is hidden; only the misleading body is withheld.
  $stateAgeDays = [math]::Round((((Get-Date).ToUniversalTime()) - $fresh.LastWriteTimeUtc).TotalDays, 1)
  $freshStamp   = $fresh.LastWriteTimeUtc.ToString("MM-dd HH:mm") + "Z"
  if ($stateAgeDays -gt $StateSummaryMaxAgeDays) {
    Line "STALE" ("no station summary younger than " + $StateSummaryMaxAgeDays + " days -- freshest is " + $fresh.Name + " (" + $freshStamp + ", " + $stateAgeDays + " days old); body deliberately NOT quoted. Read section 1 for the live board.")
  } else {
    Line "FILE" ("freshest station summary: " + $fresh.Name + "  (" + $freshStamp + ", " + $stateAgeDays + "d old) -- a SNAPSHOT by whoever last ran; verify claims against GitHub:")
    Get-Content $fresh.FullName -Tail 22 | Where-Object { $_ -match '\S' } | ForEach-Object {
      $t = ($_ -replace '[^\x20-\x7E]', ' ')
      if ($t.Length -gt 118) { $t = $t.Substring(0, 118) }
      Line "FILE" ("   | " + $t)
    }
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
# -SkipSection5: the fast-exit switch (see param block header). When passed, replace the
# needs-marco gh crawl with ONE line naming the section as skipped and why. DOCTRINE 9.6: an
# empty result is not an empty world, and a skipped section must NEVER read as a clean one.
# The dispatch-register continuation below still runs -- it is a handful of git-only reads from
# origin/main, not an O(occurrences * files) gh fan-out, and nothing in the measurement that
# motivated this switch pointed at it.
if ($SkipSection5) {
  Line "SKIP" "section 5 stale-claim cross-check SKIPPED via -SkipSection5 (needs-marco gh crawl not run; this is NOT 'no stale escalations' -- re-run without the switch to cross-check)"
}
# SECTION_5_PR_VIEW_CACHE_V1 -- dedupe the per-PR gh calls. Measured 2026-10-09T16:29Z by
# Station 00: 383 occurrences / 153 distinct PR numbers / 52 files in needs-marco/. The old
# shape asked GitHub once per occurrence, so ~230 of those round trips re-asked a question gh
# had already answered in the same run. Key the cache on the PR NUMBER (not <file,number>): the
# fact "#1612 is MERGED at <t>" does not change because a different file cites it. Readings
# must be BYTE-IDENTICAL to what section 5 reports without the cache -- this is a
# de-duplication, not a change of meaning. A cached answer was still fetched LIVE in this same
# run; the [LIVE]/[FILE]/[STALE] tag on each printed line is unchanged.
$prViewCache = @{}
# Absent is not empty, same rule as sections 4 and 4B. needs-marco/ is gitignored (.gitignore line
# 82) and is never on main by design, so on a fresh clone it does not exist -- and "no needs-marco
# escalations on disk" would then be an assertion about a folder this sweep never looked in
# (DOCTRINE 9.6). The whole stale-claim cross-check below is what is missing in that case, which is
# the most consequential thing this instrument does; it must not be silent.
$nmDir = Join-Path $Queue "needs-marco"
$nm = @()
if (-not $SkipSection5) {
  if (-not (Test-Path $nmDir)) {
    Line "LIVE" "[CANNOT MEASURE] queue subdir absent: needs-marco  (no escalation was cross-checked against GitHub -- this is NOT 'no escalations')"
  } else {
    $nm = @(Get-ChildItem (Join-Path $nmDir "*.md") -ErrorAction SilentlyContinue)
    if ($nm.Count -eq 0) { Line "LIVE" "no needs-marco escalations on disk" }
  }
}
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
    # SECTION_5_PR_VIEW_CACHE_V1: ask gh at most once per DISTINCT PR number per run (see cache
    # declaration above). The hashtable stores the parsed object so later references read the
    # same object -- no second gh call, same fields, same tag path below. A cache miss carries
    # the real gh error path: a $null answer still populates the cache so a later file citing the
    # same unknown number does not re-query either.
    if ($prViewCache.ContainsKey($n)) {
      $st = $prViewCache[$n]
    } else {
      $st = gh pr view $n --json state,isDraft,mergedAt 2>$null | ConvertFrom-Json
      $prViewCache[$n] = $st
    }
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
# DISPATCH_REGISTER_V1 -- Section 5 continuation: open dispatched findings
# Reads from origin/main (DOCTRINE section 9), not the working copy.
# ------------------------------------------------------------------------------------------------
$dispatchFolder = "docs/pipeline/dispatched"
$dispatchListRaw = ""
$dispatchGitOk = $true
try {
  $dispatchListRaw = git ls-tree --name-only "origin/main" "$dispatchFolder/" 2>&1
  if ($LASTEXITCODE -ne 0) { $dispatchGitOk = $false }
} catch {
  $dispatchGitOk = $false
}

if (-not $dispatchGitOk) {
  Line "FILE" "dispatch register: git or origin/main unreachable -- dispatch check skipped"
} else {
  # Filter to *.md files directly in the dispatched folder (not in closed/).
  $dispatchEntries = @($dispatchListRaw -split "`n" | Where-Object {
    $_ -match "\.md$" -and $_ -notmatch "/"
  } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })

  if ($dispatchEntries.Count -eq 0) {
    # Check whether the folder itself is present on origin/main.
    $folderCheckRaw = ""
    try {
      $folderCheckRaw = git ls-tree --name-only "origin/main" "docs/pipeline/" 2>&1
    } catch { $folderCheckRaw = "" }
    $folderPresent = ($folderCheckRaw -split "`n" | Where-Object { $_.Trim() -eq "dispatched" }).Count -gt 0
    if ($folderPresent) {
      Line "LIVE" "no open dispatches"
    } else {
      Line "LIVE" "[CANNOT MEASURE] dispatched register absent on origin/main"
    }
  } else {
    $nowUtcForDispatch = [System.DateTime]::UtcNow
    foreach ($dispatchEntry in $dispatchEntries) {
      $dispatchPath = $dispatchFolder + "/" + $dispatchEntry
      $dispatchContent = ""
      try {
        $dispatchContent = git show ("origin/main:" + $dispatchPath) 2>&1
        if ($LASTEXITCODE -ne 0) {
          Line "FILE" ("dispatch: could not read " + $dispatchPath + " from origin/main -- skipped")
          continue
        }
      } catch {
        Line "FILE" ("dispatch: could not read " + $dispatchPath + " -- skipped")
        continue
      }

      # Parse front matter fields.
      $dispatchId       = ""
      $dispatchTo       = ""
      $dispatchOpenedAt = ""
      $dispatchFinding  = ""
      foreach ($dispatchLine in ($dispatchContent -split "`n")) {
        if ($dispatchLine -match "^id:\s*(.+)$")         { $dispatchId       = $Matches[1].Trim() }
        if ($dispatchLine -match "^to:\s*(.+)$")         { $dispatchTo       = $Matches[1].Trim() }
        if ($dispatchLine -match "^opened_at:\s*(.+)$")  { $dispatchOpenedAt = $Matches[1].Trim() }
        if ($dispatchLine -match "^finding:\s*(.+)$")    { $dispatchFinding  = $Matches[1].Trim() }
      }

      # Compute age in UTC days.
      $dispatchAgeStr = "?"
      if ($dispatchOpenedAt -ne "") {
        try {
          $dispatchOpenedDate = [System.DateTime]::Parse($dispatchOpenedAt, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
          $dispatchAgeSpan = $nowUtcForDispatch - $dispatchOpenedDate
          $dispatchAgeStr = [string][int][Math]::Floor($dispatchAgeSpan.TotalDays)
        } catch { $dispatchAgeStr = "?" }
      }

      $dispatchLine = ("dispatched: " + $dispatchId + "  to=" + $dispatchTo + "  age=" + $dispatchAgeStr + "d  finding=" + $dispatchFinding)

      # Flag stale dispatches (older than 7 days).
      if ($dispatchAgeStr -ne "?" -and ([int]$dispatchAgeStr) -gt 7) {
        $dispatchLine = $dispatchLine + " <-- STALE DISPATCH"
      }

      Line "LIVE" $dispatchLine
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
# BOARD_LEASE_V1: a live lease held by ANOTHER actor is a hard CAUTION. When no $Actor was
# supplied, every live lease is treated as someone else's (fail into CAUTION, not into SAFE).
$leaseBlocksCaller = $false
if ($leaseObj) {
    if ([string]::IsNullOrWhiteSpace($Actor) -or $leaseObj.actor -ne $Actor) {
        $leaseBlocksCaller = $true
    }
}
if (-not $safe) {
  Line "LIVE" "DO NOT ACT: a board mutation is in progress (section 3 -- a git index.lock is held, or a git process is touching our trees). Wait, re-run, then act."
} elseif ($leaseBlocksCaller) {
  # Minutes remaining until the lease auto-expires -- read the verdict and either wait that
  # long, or COLLECT only (status reads are always safe).
  $leaseMinsLeft = "?"
  try {
      if ($leaseObj.expiresAt -is [DateTime]) {
          $leaseExpFmt = ([DateTime]$leaseObj.expiresAt).ToUniversalTime()
      } else {
          $leaseExpFmt = [DateTime]::ParseExact(
              [string]$leaseObj.expiresAt, "yyyy-MM-ddTHH:mm:ssZ",
              [System.Globalization.CultureInfo]::InvariantCulture,
              [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
      }
      $leaseMinsLeft = [int]((($leaseExpFmt) - [DateTime]::UtcNow).TotalMinutes)
  } catch {}
  Line "LIVE" ("CAUTION: " + $leaseObj.actor + " holds the board (" + $leaseObj.reason + ", " + $leaseAgeStr + ", expires in " + $leaseMinsLeft + " min). Stand down; COLLECT only.")
} elseif ($buildRunning) {
  Line "LIVE" ("CAUTION: a watcher build is in flight (" + $buildPromptName + "). Hold off arming or merging until it lands.")
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
# SECTION_TIMING_V1 -- close the FINAL section with its own [TIMING] line before SWEEP COMPLETE.
# Every other section is closed by the next Section() call; section 7 has no successor, so
# without this line a reader loses the one timing that most often matters (the verdict's).
if ($null -ne $script:SectionStart -and $null -ne $script:SectionName) {
  $elapsed = [math]::Round(((Get-Date) - $script:SectionStart).TotalSeconds, 1)
  Write-Host ("  [TIMING] section " + $script:SectionName + " elapsed=" + $elapsed + "s")
}
Write-Host ""
Write-Host ("SWEEP COMPLETE " + $nowUtc + " -- report ONLY from [LIVE] lines; treat [FILE] as unverified; never repeat a [STALE] line as current.")
