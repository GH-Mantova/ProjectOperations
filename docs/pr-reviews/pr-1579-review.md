VERDICT: MERGE

Scope compliance:
- In scope: Addendum to Station 00's breadcrumb documenting F4 supersede (ACTIONED, not DISPATCHED) and Finding 8 (four watcher-code PRs merged but not live). Single file under docs/pr-prompts/, pure docs addition.
- Out of scope: None detected.

Self-verification claims:
- ✓ check-breadcrumb.mjs → CLEAN, exit 0 (per PR body, 6 checked, 0 malformed)
- ✓ U+FFFD = 0 (no encoding corruption)
- ✓ CRLF preserved
- ✓ Diff is one file, +61 -0 (confirmed)

Risks Marco should know:
- None. Pure documentation of operational findings. No code, schema, or migration surface.
- CI: CodeQL still in progress, but all critical checks (PR gates, approval receipt, linter tests) PASS.
- The originating prompt noted deliberate deferral ("Left unmerged on purpose") due to watcher mid-build on preflight-fix PR. That collision condition was satisfied by #1578 merge at 08:27:04Z and the preflight arm at 08:29:37Z, so the deferral reason has expired.

Recommendation: Safe to merge. The addendum correctly documents the F4 state change and the new Finding 8 operational alert.
