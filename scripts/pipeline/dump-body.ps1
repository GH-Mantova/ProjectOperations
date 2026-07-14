param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"
$body = gh pr view $PR --json body -q .body
$lines = $body -split "`n"
Write-Output ("=== #" + $PR + " body, first 12 lines (with visible bounds):")
for ($i = 0; $i -lt [Math]::Min(12, $lines.Count); $i++) {
    Write-Output (("{0,3}" -f ($i + 1)) + " |" + $lines[$i] + "|")
}
