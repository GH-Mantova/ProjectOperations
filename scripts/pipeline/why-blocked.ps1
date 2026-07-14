param([int]$PR)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output ("=== REST merge attempt on #" + $PR + " (to surface the exact rule violation)")
$body = '{"merge_method":"squash"}'
$out = $body | gh api -X PUT ("repos/GH-Mantova/ProjectOperations/pulls/" + $PR + "/merge") --input - 2>&1
foreach ($l in $out) { Write-Output ("  " + $l) }
