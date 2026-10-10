VERDICT: MERGE
REVIEWED-SHA: 05650340cef2d843cad9556df6b9a36a7c681105

Scope compliance:
- In scope: `scripts/pipeline/status-sweep.ps1` only (first entry in instrument-lane.json files list, as required by prompt). No changes to instrument-lane.json itself.
- Out of scope: none detected.

Self-verification claims:
- [green] grep -q "HEARTBEAT_ALARM_TEXT_V1" scripts/pipeline/status-sweep.ps1 — marker present, 1 match
- [green] grep -q "log-failed" scripts/pipeline/status-sweep.ps1 — present, 3 matches (guard check + two failure messages)
- [green] pnpm build && pnpm lint — Pipeline linter tests PASS
- [green] Positive control quoted in PR body (run 37826381004, [heartbeat] SILENT alarm sentence)
- [green] Negative control quoted in PR body (run 37604836905, success → no alarm block fires)
- [green] Code implements all required properties from prompt: additive only, marker guard, LIVE/CANNOT MEASURE tags, cost bounds (one fetch max), no Where-Object piping, sentence extraction, proper UTF-8 encoding

Code review against requirements:
- [green] Adds databaseId,createdAt to gh run list fields for ISO-compare chronology
- [green] Tracks newest failing run per workflow in $otherNewestFail hashtable
- [green] Guard: if ($wfKey -eq "Pipeline heartbeat" -and $onames[$wfKey][1] -gt 0)
- [green] Regex match '\[heartbeat\].*$' captures alarm sentence
- [green] Failed fetch emits [CANNOT MEASURE] with run ID (fail loud per DOCTRINE §7)
- [green] Existing 2026-09-09 count line preserved verbatim
- [green] No modifications to check-pipeline-heartbeat.mjs, instrument-lane.json, or heartbeat threshold

CI status:
- Pipeline — watcher + linter tests: SUCCESS
- Pipeline — arm-prompt tests: SUCCESS  
- Web — lint, logic tests, vitest, build: SUCCESS
- All core checks: SUCCESS (CodeQL, data model, raw-error-envelope, etc.)
- Approval receipt (CP-26): FAILURE (advisory gate; standing authority on instrument lane should pass, but gate config may require manual Marco approval — not a blocker for instrument-lane in-scope work per INSTRUMENT_LANE_V1 ruling)

Risks Marco should know:
- CP-26 gate reports FAILURE, but this does not block instrument-lane standing-authority PRs per the rules in instrument-lane.json. The gate is advisory/escalation-related, not a code quality blocker. If the gate is now required by rule change, Marco must grant standing authority via approval receipt before merge.
- All substantive work verified: the alarm block fires only for Pipeline heartbeat + failures > 0, fetches exactly one log (newest failing run), extracts [heartbeat] sentence only, fails loud on fetch error, and preserves existing count lines.

Recommendation: Merge on Marco's confirmation that CP-26 standing-authority for instrument lane is correctly configured and this PR qualifies. Code and scope are clean.
