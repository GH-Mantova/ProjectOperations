# ============================================================================================
# [STOP] RETIRED 2026-08-31 - THIS SCRIPT WOULD DESTROY THE AGENTS IT CLAIMS TO INSTALL. DO NOT RUN.
# ============================================================================================
#
# MEASURED, not assumed:
#   staged source  docs/architecture/drafts/pipeline-staged/.claude/agents/00-supervisor.md   5,001 B (2026-07-13)
#   deployed file  .claude/agents/00-supervisor.md                                           23,975 B
#   staged doctrine  SHARED-DOCTRINE.md  5,663 B, sections 1-6 only, frozen 2026-08-17
#   live doctrine    docs/pipeline/DOCTRINE.md  ~41,000 B, sections 1-10
#
# The deployed agents were evolved directly in .claude/agents/ after the July build and NEVER
# flowed back to the staged copies - their front matter does not even match (deployed 00 is "the
# supervisor and board owner"; the staged stub is "the foreman"). Running this script would
# overwrite ~24 KB of live, evolved station behaviour with a ~10 KB July stub, for every station,
# and would silently drop 06-pr-master / pr-fix-reviewer / pr-tester, which have no staged source
# at all.
#
# It would also re-introduce the exact defect that made this file dangerous: appending a COPY of
# the doctrine. Until 2026-08-31 every station agent carried TWO such copies, both
# encoding-damaged, both frozen at section 7.1, with sections 8, 9 and 10 missing entirely, and
# nothing measured the drift.
#
# THE RULE NOW: the doctrine lives in docs/pipeline/DOCTRINE.md and the agents POINT at it.
#   - to change a station's behaviour, edit .claude/agents/<station>.md directly;
#   - to verify the contract holds,  node scripts/pipeline/check-agent-doctrine.mjs
#     (it runs in CI and fails the build if a doctrine copy reappears);
#   - .claude/agents/06-pr-master.md is the reference shape.
#
# The original body is preserved below, unreachable, as the record of what it used to do.

Write-Error @"
install-agents.ps1 is RETIRED and refuses to run.

It would overwrite the evolved station agents in .claude/agents/ with July 2026 stubs from
docs/architecture/drafts/pipeline-staged/ (00-supervisor: 23,975 B -> ~10,664 B) and re-append a
frozen, encoding-damaged copy of the doctrine.

Edit .claude/agents/<station>.md directly. Verify with:
    node scripts/pipeline/check-agent-doctrine.mjs
"@
exit 1

# ============================== ORIGINAL SCRIPT BELOW (UNREACHABLE) ==========================

# Install the numbered stations into .claude/agents, with SHARED-DOCTRINE appended to each.
#
# WHAT WE DELIBERATELY DO **NOT** INSTALL: .claude/settings.json and .claude/hooks/guard-pipeline.mjs
# from the staged draft. Three separate outages are baked into that enforcement layer:
#   1. the hook DENIES git checkout/commit/push in C:\po-watcher - but the watcher's own agents
#      WORK there. It would brick the queue on the first run.
#   2. `ask: gh pr merge` HANGS a headless run forever - nobody is there to answer.
#   3. `deny Write(sot/**)` would fail the armed sot-reconcile prompt.
#
# ISOLATION BEFORE ENFORCEMENT. You cannot ban the shared tree until nothing needs it.
# The doctrine ships as PROSE now; the hard deny-layer waits for worktree-per-run.
$ErrorActionPreference = "Continue"

$src      = "C:\ProjectOperations2\docs\architecture\drafts\pipeline-staged\.claude\agents"
$doctrine = "C:\ProjectOperations2\docs\architecture\drafts\pipeline-staged\SHARED-DOCTRINE.md"
$dst      = "C:\ProjectOperations2\.claude\agents"

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }

$doc = Get-Content $doctrine -Raw
$utf8 = New-Object System.Text.UTF8Encoding($false)   # NO BOM - node/yaml front-matter chokes on it

foreach ($f in (Get-ChildItem $src -Filter "*.md" | Sort-Object Name)) {
    $body = Get-Content $f.FullName -Raw
    $out  = Join-Path $dst $f.Name

    if ($body -notmatch "^---") {
        Write-Output ("  SKIP " + $f.Name + " - no YAML front-matter, would not register as an agent")
        continue
    }

    [System.IO.File]::WriteAllText($out, ($body.TrimEnd() + "`n" + $doc), $utf8)

    # READ-BACK: prove the doctrine actually landed and the front-matter survived.
    $check = Get-Content $out -Raw
    $hasFm  = $check.StartsWith("---")
    $hasDoc = $check.Contains("THE READ-BACK RULE")
    $hasStop = $check.Contains("Azure / Entra / SharePoint")
    if ($hasFm -and $hasDoc -and $hasStop) {
        Write-Output ("  OK   " + $f.Name + "  (front-matter + doctrine + hard stops verified)")
    } else {
        Write-Output ("  FAIL " + $f.Name + "  fm=" + $hasFm + " doctrine=" + $hasDoc + " stops=" + $hasStop)
    }
}

Write-Output ""
Write-Output "=== installed agents:"
Get-ChildItem $dst -Filter "*.md" | ForEach-Object {
    $n = (Select-String -Path $_.FullName -Pattern "^name:\s*(.+)$").Matches[0].Groups[1].Value
    Write-Output ("  " + $_.Name + "  ->  " + $n)
}

Write-Output ""
Write-Output "NOT installed (deliberately): settings.json + hooks/guard-pipeline.mjs"
Write-Output "  Isolation before enforcement. The deny-layer would brick the watcher today."
