# Identify the watcher process by its COMMAND LINE, never by "it's a node process".
# There are ~20 node and ~20 claude processes on this box, several of which ARE Marco's live
# Cowork/Claude Code sessions. Killing by image name would kill the session issuing the kill.
$ErrorActionPreference = "Continue"

Write-Output "=== processes whose command line mentions the watcher"
$found = @()
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'powershell.exe' OR Name = 'pwsh.exe'"
foreach ($p in $procs) {
    $cl = "" + $p.CommandLine
    if ($cl -match "pr-watcher" -or $cl -match "supervise-watcher") {
        $found += $p
        Write-Output ("  PID " + $p.ProcessId + "  " + $p.Name)
        Write-Output ("      " + $cl.Substring(0, [Math]::Min(150, $cl.Length)))
    }
}
if ($found.Count -eq 0) { Write-Output "  NONE - the watcher is NOT running." }

Write-Output ""
Write-Output "=== live heartbeat (the watcher's clone, NOT the checked-in copy in the main tree)"
$hb = "C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log"
if (Test-Path $hb) {
    $age = [int]((Get-Date) - (Get-Item $hb).LastWriteTime).TotalMinutes
    Write-Output ("  last beat: " + (Get-Item $hb).LastWriteTime + "   (" + $age + " min ago)")
    Get-Content $hb -Tail 3 | ForEach-Object { Write-Output ("    " + $_) }
} else {
    Write-Output "  no heartbeat file"
}
