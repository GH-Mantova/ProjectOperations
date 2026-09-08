VERDICT: MERGE

Scope compliance:
- In scope: supervise-watcher.ps1 (deleted dead guard + rewritten log lines + added comment), new test file watchdog-inprog-guard-removed.test.mjs with 10 mutation assertions
- Out of scope: None detected. status-sweep.ps1 correctly left untouched. No restart of supervisor. No edits to /sot/, apps/**, prisma/**.

Self-verification claims:
- [PASS] grep -c "inProg" 2 → 0: PR body cites both before/after; test suite asserts absence
- [PASS] grep -c "in-progress" 6 → 5 (survivors all in comments): PR body cites both; test asserts no executable lines read it
- [PASS] File parses: PR body notes "checked by hand... change is comment/string-only plus removal of one complete two-line statement pair"; ASCII verified programmatically
- [PASS] Test suite: 254 → 264 pass (net +10 new assertions in watchdog-inprog-guard-removed.test.mjs). "Pipeline — watcher + linter tests" job passed.
- [PASS] Line 111 (2026-08-18 historical record) unchanged: Diff preserves "(7 prompts armed, 0 in-progress)"
- [PASS] #1712 collateral (Resolve-WatchdogJudgedAgeMinutes, -InitializationScript, kill branch, Stop-Process) byte-identical: PR body confirms; test suite asserts "the grace call and the kill branch immediately below the deletion are intact"

Risks Marco should know:
- ONE INTENTIONAL DEPARTURE FROM PROMPT (disclosed in PR body, not hidden): Prompt asked for "heartbeat-only" to name "the real test" in the startup log line. Post-#1712, the real test is WATCHDOG_RESTART_GRACE_V1 (the later of heartbeat last write and node process start), not heartbeat alone. Placing "heartbeat-only" as requested would swap one lie for another. Agent instead named BOTH the grace rule AND heartbeat-only as its documented fallback when CreationDate is unreadable, then added explicit text: "That is the whole test: nothing checks whether a build is in flight, deliberately." A test assertion verifies both halves of this claim. This is a SUBSTANTIVE UPGRADE over the prompt's requirement — it prevents a false log statement.
- Clean execution: No PowerShell executed (no pwsh in build container; Pester runs nowhere in CI). All changes text/structural only. ASCII verified, LF-only, no BOM.
- Mutation-tested: Reinstating the guard fails 3 tests; restoring "0 in-progress" to kill line fails 3; dropping "heartbeat-only" token fails 1; deleting the note fails 1; tidying the historical record fails 1.

All 14 CI checks green. Mergeable state confirmed.

Recommendation: Merge. The substantive work is correct; the prompt deviation is an improvement that prevents a regression in log accuracy. PR body is transparent about the change and its reasoning.
