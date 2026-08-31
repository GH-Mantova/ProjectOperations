VERDICT: MERGE

## Scope compliance

In scope (all verified in diff):
- scripts/pipeline/arm-prompt.ps1: Step 7 (ARM_INDEX_RELEASED) added after audit block, inside lock, before finally. Uses git restore --staged to un-stage HOLD and ready paths. Verifies release via Get-StagedPaths. Failure is non-fatal: exit 0 with WARN naming residual paths. Header added to .arming-log.txt on creation.
- scripts/pipeline/__tests__/arm-prompt.test.mjs: 7 new tests cover all verification requirements. Existing test updated to assert clean index instead of staged rename.

No out-of-scope changes detected.

## Self-verification claims

- [GREEN] ARM_INDEX_RELEASED token present in script (grep validated in PR body)
- [GREEN] All 14 tests pass (node --test: pass 14, fail 0)
- [GREEN] Negative control: with Step 7 removed, both "index clean" and "back-to-back arming" tests fail. With Step 7 restored, all tests pass.
- [GREEN] Test coverage complete: index clean, ready file survives, audit line written, back-to-back arming, unexpected-stage path, release failure non-fatal, existing test updated
- [GREEN] Index release verification via Get-StagedPaths (follows rollback precedent at lines 335-350)
- [GREEN] Non-fatal failure contract: exit 0 + WARN + ready file on disk

## CI Status

All checks GREEN:
- Changed-path filter, PR gates, Pipeline watcher+linter, Pipeline arm-prompt (Windows), API smoke, Data model, Web build, CodeQL, Tendering Browser Smoke — all SUCCESS

## Risks Marco should know

None. The defect is real (script exits leaving rename staged, which breaks next Assert-CleanIndex and incentivizes bare git mv bypass). The fix is correct: release happens inside lock after verification, so no actor can stage between check and release. Non-fatal failure handling preserves arming while warning of stuck staged paths. Tests are rigorous with negative control. Cluster ordering (gated on slice 1 #1438 which is already merged) is sound.

## Recommendation

Merge. This is a load-bearing fix for a known defect (F10) that was preventing back-to-back arms and incentivizing unlogged bare git mv arming. All code paths covered, CI green, negative control passed. Ready.
