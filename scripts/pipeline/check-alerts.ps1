param([string]$Ref)
$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output ("=== code scanning alerts on ref: " + $Ref)
$a = gh api ("repos/GH-Mantova/ProjectOperations/code-scanning/alerts?ref=refs/heads/" + $Ref + "&state=open") 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Output ("  " + $a)
} else {
    $alerts = $a | ConvertFrom-Json
    if ($alerts.Count -eq 0) { Write-Output "  no open alerts" }
    foreach ($x in $alerts) {
        Write-Output ("  [" + $x.rule.security_severity_level + "/" + $x.rule.severity + "] " + $x.rule.id)
        Write-Output ("      " + $x.most_recent_instance.location.path + ":" + $x.most_recent_instance.location.start_line)
        Write-Output ("      " + $x.most_recent_instance.message.text)
    }
}
