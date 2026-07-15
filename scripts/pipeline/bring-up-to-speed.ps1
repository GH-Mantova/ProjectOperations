# =============================================================================================
# bring-up-to-speed.ps1  --  the ONE entry point that makes a fresh chat fully current.
#
# Marco's instruction (2026-07-15): "this shall give me a full status report AND bring whatever
# chat up-to-speed with repo history, all chat memories, all progress, context, SoTs -- every
# single iota of information."
#
# WHAT THIS DOES
#   1. Runs status-sweep.ps1  -> LIVE pipeline state (GitHub-authoritative, stale-claim cross-check).
#   2. Prints REPO IDENTITY   -> HEAD, branch, how far behind origin/main, dirty count.
#   3. Prints the SoT MANIFEST -> the 7 source-of-truth masters, each with its last commit.
#   4. Prints RECENT HISTORY  -> last 30 commits on origin/main.
#   5. Prints a READ-CHECKLIST-> exactly what the chat must READ before it reports.
#
# WHAT IT DELIBERATELY DOES NOT DO
#   - It does NOT read the SoT masters or the chat memories FOR you. Those must land in the chat's
#     own context: SoT via `gh`/read of the files it lists; memories via the MEMORY.md index that
#     Cowork auto-injects into every chat. A manifest is not a substitute for reading.
#   - It changes nothing. Read-only. No PR, no arm, no branch, no delete.
#
# PURE ASCII (PS 5.1). No em-dashes, no curly quotes.
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pipeline\bring-up-to-speed.ps1
# =============================================================================================

$ErrorActionPreference = "Continue"
$Repo = "C:\ProjectOperations2"
Set-Location $Repo
function Head($t) { Write-Host ""; Write-Host ("############### " + $t + " ###############") }

Head "A. LIVE PIPELINE STATE (from status-sweep.ps1)"
& (Join-Path $Repo "scripts\pipeline\status-sweep.ps1")

Head "B. REPO IDENTITY"
git fetch origin --quiet 2>$null
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$head   = (git rev-parse --short HEAD).Trim()
$omain  = (git rev-parse --short origin/main).Trim()
$behind = @(git log --oneline HEAD..origin/main 2>$null).Count
$ahead  = @(git log --oneline origin/main..HEAD 2>$null).Count
$dirty  = @(git status --short).Count
Write-Host ("  branch: " + $branch + "   HEAD: " + $head + "   origin/main: " + $omain)
Write-Host ("  local main vs origin/main:  " + $behind + " behind, " + $ahead + " ahead")
Write-Host ("  working tree: " + $dirty + " changed file(s)  (mostly untracked scratch is normal here)")
if ($behind -gt 0) { Write-Host ("  NOTE: local is " + $behind + " commits behind origin/main -- `git ls-files`/local reads may be STALE. Trust origin/main + gh.") }

Head "C. SOURCE-OF-TRUTH MASTERS (read these per your chat's role -- see sot/README.md routing)"
$sot = @(
  "sot/README.md",
  "sot/01-charter-and-architecture.md",
  "sot/02-roadmap-and-status.md",
  "sot/03-progress-log.md",
  "sot/04-data-model.md",
  "sot/05-decisions-and-lessons.md",
  "sot/06-active-specs.md"
)
foreach ($f in $sot) {
  $meta = git log -1 --format="%cd  %s" --date=format:"%Y-%m-%d" -- $f 2>$null
  if ($meta) { Write-Host ("  " + $f.PadRight(34) + "  last: " + $meta) }
  else       { Write-Host ("  " + $f.PadRight(34) + "  *** NOT FOUND on this branch") }
}
Write-Host ""
Write-Host "  Entry point / law / routing (fetch the BLOB url; raw CDN lags):"
Write-Host "    https://github.com/GH-Mantova/ProjectOperations/blob/main/sot/README.md"

Head "C2. SoT CONTENT -- README (the law) IN FULL + every master's section headers (close blind-spot 1)"
$readme = Join-Path $Repo "sot\README.md"
if (Test-Path $readme) {
  Write-Host "----- BEGIN sot/README.md -----"
  Get-Content $readme | ForEach-Object { Write-Host $_ }
  Write-Host "----- END sot/README.md -----"
} else { Write-Host "  *** sot/README.md NOT FOUND" }
Write-Host ""
Write-Host "Section headers of the other masters (READ the full text of the ones your role needs):"
foreach ($f in @("sot/01-charter-and-architecture.md","sot/02-roadmap-and-status.md","sot/03-progress-log.md","sot/04-data-model.md","sot/05-decisions-and-lessons.md","sot/06-active-specs.md")) {
  $p = Join-Path $Repo $f
  if (Test-Path $p) {
    Write-Host ("  " + $f + ":")
    Get-Content $p | Where-Object { $_ -match '^#{1,3}\s' } | Select-Object -First 40 | ForEach-Object { Write-Host ("      " + $_) }
  }
}
Write-Host ""
Write-Host "MEMORIES: the MEMORY.md index is auto-injected into this chat. READ the bodies of every"
Write-Host "file under its '### READ THESE FIRST' block in full -- the one-liners are not enough."

Head "C3. SCHEDULED AGENTS -- handled in section A (4C) + checklist item 4"
Write-Host "  Section A's sweep (4C) lists the on-disk Scheduled\ folders and tails the freshest station"
Write-Host "  summary, with the RULE that a folder or a state-file name is NOT a live task. The LIVE schedule"
Write-Host "  (which tasks exist, enabled, next/last run) comes ONLY from the scheduled-tasks MCP -- checklist"
Write-Host "  item 4 makes calling it mandatory and tells you how to reconcile the folders against it."

Head "D. RECENT HISTORY (last 30 on origin/main)"
git log origin/main --oneline -30 2>$null | ForEach-Object { Write-Host ("  " + $_) }

Head "E. READ-CHECKLIST -- do ALL of this BEFORE you report a single fact"
Write-Host "  [ ] 1. Read sot/README.md -> follow its routing for THIS chat's title (MAIN / OldMain# / Chat# / DR#)."
Write-Host "  [ ] 2. Read the SoT masters your role requires (MAIN/OldMain: README + 01 + 02 fully; 03/04/05/06 as needed)."
Write-Host "  [ ] 3. Read every chat memory under the '### READ THESE FIRST' block of the auto-injected MEMORY.md -- FULLY, not the one-liners."
Write-Host "  [ ] 4. Call list_scheduled_tasks (MCP) -- the ONLY source of the live schedule. RECONCILE: live"
Write-Host "         tasks are EXACTLY its taskIds; any Scheduled\ folder in section A/4C not in that set is a"
Write-Host "         DELETED task's leftover folder -- ignore it. NEVER say a task 'runs' from a folder or a"
Write-Host "         state-file name (that exact mistake happened 2026-07-15)."
Write-Host "  [ ] 5. Re-read section A: report ONLY from [LIVE] lines; never repeat a [STALE] line; treat [FILE] as unverified."
Write-Host "  [ ] 6. If section A says DO NOT ACT / CAUTION, do not stage/arm/merge -- summarise and wait."
Write-Host "  [ ] 7. BEFORE you end this working session: write any decision, finding, or TODO that is not"
Write-Host "         already in docs/pr-prompts/BACKLOG.yaml, sot/, or a memory file. Chat memory is NOT"
Write-Host "         durable -- an agent cannot read this conversation. If it is only in chat, it is lost."
Write-Host ""
Write-Host "BRING-UP-TO-SPEED COMPLETE. You are current only after the checklist above is actually done."
