# READ-ONLY GitHub security audit for GH-Mantova/ProjectOperations. ASCII only, PS 5.1 safe.
# Registered in docs/pipeline/SCRIPT-REGISTRY.md (chat-triggered / scheduled weekly-security-audit).
# Prints BASELINE-OK / BASELINE-DRIFT lines so a scheduled agent can report deltas without judgement.
$ErrorActionPreference = "Continue"
$R = "GH-Mantova/ProjectOperations"
$drift = 0

function Check($name, $actual, $expected) {
  if ("$actual" -eq "$expected") { Write-Output ("BASELINE-OK    " + $name + " = " + $actual) }
  else { Write-Output ("BASELINE-DRIFT " + $name + " : expected [" + $expected + "] got [" + $actual + "]"); $script:drift++ }
}

$sec = gh api "repos/$R" --jq ".security_and_analysis" | ConvertFrom-Json
Check "secret_scanning" $sec.secret_scanning.status "enabled"
Check "secret_scanning_push_protection" $sec.secret_scanning_push_protection.status "enabled"
Check "dependabot_security_updates" $sec.dependabot_security_updates.status "enabled"

$wf = gh api "repos/$R/actions/permissions/workflow" | ConvertFrom-Json
Check "default_workflow_permissions" $wf.default_workflow_permissions "read"
Check "actions_can_approve_prs" $wf.can_approve_pull_request_reviews "False"

$ap = gh api "repos/$R/actions/permissions" | ConvertFrom-Json
Check "allowed_actions" $ap.allowed_actions "selected"

$rs = gh api "repos/$R/rulesets" --jq "length"
Check "ruleset_count" $rs "1"
$bypass = gh api "repos/$R/rulesets" --jq ".[0].id" | ForEach-Object { gh api "repos/$R/rulesets/$_" --jq ".bypass_actors | length" }
Check "ruleset_bypass_actors" $bypass "0"

Check "collaborators" (gh api "repos/$R/collaborators" --jq "length") "1"
Check "deploy_keys" (gh api "repos/$R/keys" --jq "length") "0"
Check "webhooks" (gh api "repos/$R/hooks" --jq "length") "0"
Check "open_secret_scanning_alerts" (gh api "repos/$R/secret-scanning/alerts?state=open" --jq "length") "0"

Write-Output "-- open dependabot alerts by severity (informational, not baseline) --"
gh api "repos/$R/dependabot/alerts?state=open&per_page=100" --jq "group_by(.security_advisory.severity) | map({severity: .[0].security_advisory.severity, count: length})"

Write-Output ""
if ($drift -eq 0) { Write-Output "AUDIT RESULT: CLEAN (0 drift)"; exit 0 }
else { Write-Output ("AUDIT RESULT: DRIFT (" + $drift + " item(s)) -- report to Marco"); exit 2 }
