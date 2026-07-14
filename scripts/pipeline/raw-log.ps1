param([long]$RunId, [long]$JobId, [int]$Tail = 25)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"
$log = gh run view $RunId --job $JobId --log 2>&1
$lines = @($log)
Write-Output ("total log lines: " + $lines.Count)
Write-Output ""
foreach ($l in ($lines | Select-Object -Last $Tail)) {
    $s = [string]$l
    $idx = $s.LastIndexOf("Z ")
    if ($idx -gt 0 -and $idx + 2 -lt $s.Length) { $s = $s.Substring($idx + 2) }
    Write-Output ("  " + $s)
}
