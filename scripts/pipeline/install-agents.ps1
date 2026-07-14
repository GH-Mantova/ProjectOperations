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
