$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output "=== repo rulesets:"
$rs = gh api "repos/GH-Mantova/ProjectOperations/rulesets" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Output ("  " + $rs); }
else {
    $sets = $rs | ConvertFrom-Json
    foreach ($s in $sets) {
        Write-Output ("  id=" + $s.id + "  name=" + $s.name + "  target=" + $s.target + "  enforcement=" + $s.enforcement)
        $detail = gh api ("repos/GH-Mantova/ProjectOperations/rulesets/" + $s.id) | ConvertFrom-Json
        foreach ($r in $detail.rules) {
            Write-Output ("      rule: " + $r.type)
            if ($r.type -eq "required_status_checks") {
                foreach ($c in $r.parameters.required_status_checks) {
                    Write-Output ("          required check: '" + $c.context + "'")
                }
                Write-Output ("          strict_required_status_checks_policy: " + $r.parameters.strict_required_status_checks_policy)
            }
            if ($r.type -eq "pull_request") {
                Write-Output ("          required_approving_review_count: " + $r.parameters.required_approving_review_count)
                Write-Output ("          require_last_push_approval: " + $r.parameters.require_last_push_approval)
                Write-Output ("          dismiss_stale_reviews_on_push: " + $r.parameters.dismiss_stale_reviews_on_push)
            }
            if ($r.type -eq "code_scanning") {
                foreach ($t in $r.parameters.code_scanning_tools) {
                    Write-Output ("          code scanning: " + $t.tool + " alerts=" + $t.alerts_threshold + " security=" + $t.security_alerts_threshold)
                }
            }
        }
    }
}
