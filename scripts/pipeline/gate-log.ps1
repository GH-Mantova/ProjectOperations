param([long]$RunId, [long]$JobId)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$log = gh run view $RunId --job $JobId --log 2>&1

Write-Output "=== error / failure lines:"
$hits = $log | Select-String -Pattern "##\[error\]|Error:|error TS|Process completed with exit code|SyntaxError|Cannot find"
foreach ($h in $hits) {
    $line = $h.Line
    $idx = $line.LastIndexOf("Z ")
    if ($idx -gt 0 -and $idx + 2 -lt $line.Length) { $line = $line.Substring($idx + 2) }
    Write-Output ("  " + $line)
}

Write-Output ""
Write-Output "=== last 12 lines of the gate STEP:"
$step = $log | Select-String -Pattern "Run node scripts/pr-gates|pr-gates.mjs"
foreach ($h in ($step | Select-Object -Last 12)) {
    $line = $h.Line
    $idx = $line.LastIndexOf("Z ")
    if ($idx -gt 0 -and $idx + 2 -lt $line.Length) { $line = $line.Substring($idx + 2) }
    Write-Output ("  " + $line)
}
