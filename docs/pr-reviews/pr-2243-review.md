VERDICT: MERGE
REVIEWED-SHA: 300645ee83e13b2c4ccdee6977f523a0f599468b

Scope compliance:
- In scope: All 6 required files matched exactly (docs/pipeline/stations/00-supervisor.md, scripts/pipeline/__tests__/board-lease.test.mjs, scripts/pipeline/__tests__/merge-pr-update-first.test.mjs, scripts/pipeline/arm-prompt.ps1, scripts/pipeline/pipeline-lib.ps1, scripts/pipeline/status-sweep.ps1).
- Out of scope: None.

Self-verification claims:
- [x] pnpm build — CI job "API/Web/Data model" jobs all SUCCESS
- [x] pnpm lint — CI job "raw-error-envelope gate" SUCCESS
- [x] node --test scripts/pipeline/__tests__/*.mjs — CI job "Pipeline — watcher + linter tests" SUCCESS and "Pipeline — arm-prompt tests (Windows)" SUCCESS
- [x] BOARD_LEASE_V1 grep in all four code/doc files — verified in all (pipeline-lib.ps1: 4 hits, arm-prompt.ps1: 4 hits, status-sweep.ps1: 3 hits, 00-supervisor.md: 1 hit)
- [x] board-lease.test.mjs exists — verified (258 lines, covers all 6 test scenarios: acquire/refuse/renew/release, expired, no cross-actor release, corrupt file blocks+warns-once, status-sweep source checks, negative control)
- [x] node scripts/pipeline/lint-station.mjs — CI job "Pipeline — watcher + linter tests" SUCCESS

Implementation verified:
- pipeline-lib.ps1: Get-BoardLease, Enter-BoardLease, Exit-BoardLease, Write-BoardLease all present with BOARD_LEASE_V1 tags. Merge-Pr updated with optional -Actor, lease entry/exit in finally.
- arm-prompt.ps1: Takes lease AFTER lint/RULE 4, BEFORE git mv (Step 3b). Exit code 7 (BOARD_LEASE_HELD) on refusal. Leaves lease held after successful arm.
- status-sweep.ps1: New -Actor parameter. Section 3 prints "board lease: <actor> <reason> <age>" or "board lease: free". Section 7 CAUTIONs on lease held by another actor OR build in flight.
- 00-supervisor.md: Condition 3 updated to require lease; existing lock/process/recent-activity checks preserved.
- merge-pr-update-first.test.mjs: Gained $env:PO_BOARD_LEASE_PATH override and no-op stubs for lease functions.

Risks Marco should know:
- do-not-merge label correctly applied; PR blocks on expected two gates (PR gates diff checks and Approval receipt) which are by design for escalates:true PRs. Not blockers.
- Retry note: first review (03:41-05:45Z) correctly identified code as sound; both red checks are expected and documented behavior for escalates:true PRs.

Recommendation: Safe to merge. Code complete, all tests green, scope clean, and do-not-merge label in place per Marco's release gate.
