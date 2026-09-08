VERDICT: MERGE

Scope compliance:
- In scope: Completes PR #1585 (preserve check-pipeline-heartbeat.mjs) by wiring it up:
  - New workflow: .github/workflows/pipeline-heartbeat.yml (runs every 3h on GitHub's clock, with workflow_dispatch override)
  - New test suite: 16 tests covering newestBreadcrumb, parsePause, evaluateHeartbeat (all passing per CI and Marco's local run)
  - Registry entry: docs/pipeline/SCRIPT-REGISTRY.md updated with heartbeat description
  - Script fix: MAX_PAUSE_HOURS = 72 bounds added to parsePause, nowMs parameter for testability
- Out of scope: None. Exactly 4 files modified as listed in PR and operating instructions.

Self-verification claims:
- [GREEN] 16 new tests included, all passing ("16/16, and the pipeline suite is 167/167 green" per PR body)
- [GREEN] CI jobs relevant to this PR passed: "Pipeline — watcher + linter tests" (SUCCESS), "Pipeline — arm-prompt tests (Windows)" (SUCCESS)
- [GREEN] Unbounded pause gap fixed: parsePause now rejects pauses beyond MAX_PAUSE_HOURS = 72, treating out-of-range the same as malformed (fails towards "alarm stays armed")
- [GREEN] Injectable nowMs makes the bound testable (new parameter in parsePause signature)
- [GREEN] Deliberate design preserved: "unknown" (no breadcrumbs) still returns ok:true, pinned by test to prevent false alarms when glob/path is wrong

Risks Marco should know:
- The workflow runs every 3 hours on GitHub's clock (intentional: the 2026-09-02 incident was 16.6h with all four stations disabled, and check-breadcrumb's only consumer, Station 00, was disabled too. An external heartbeat on GitHub's clock solves this).
- Pause file (docs/pipeline/pause.json) is read but not yet committed to main; the workflow will still enforce the bound even if the file is malformed or missing (safe default).
- Browser smoke tests (tendering-e2e, API smoke) still in progress but are unrelated to this change; all critical pipeline tests green.

Recommendation: Safe to merge. The fix is minimal, well-tested, and addresses a real safety gap in the alarm system.
