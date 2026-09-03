VERDICT: MERGE

Scope compliance:
- In scope: scripts/pr-watcher/app-auth.mjs (pure Node module for JWT minting and token caching); scripts/pr-watcher/index.mjs (wiring WATCHER_APP_AUTH_V1 marker into runGh and main() startup); scripts/pr-watcher/__tests__/app-auth.test.mjs (10 comprehensive unit tests covering JWT shape, token parsing, cache TTL/refresh, fail-closed behavior, PEM read errors, env validation, and secret redaction); docs/pr-prompts superseded folder (rename of HOLD prompt, archived for reference).
- Out of scope: none detected. docs/runbooks/watcher-identity-github-app.md and docs/approvals/watcher-identity-approved-by-marco.md cited in the PR body already exist on main and were not modified.

Self-verification claims:
- [x] done_when criterion 1: WATCHER_APP_AUTH_V1 marker present in scripts/pr-watcher/index.mjs (4 instances across comments and logging)
- [x] done_when criterion 2: pnpm test --filter watcher green — "Pipeline — watcher + linter tests" job COMPLETED with SUCCESS
- [x] Fail-closed design verified: test suite includes "getToken FAIL-CLOSED: mint failure clears cache and marks auth dead" and "getToken failure aborts before any downstream gh call would be attempted" (wiring guard)
- [x] Secret redaction: redactSecrets() regex covers gh[opsu]_ tokens and PEM bodies (-----BEGIN...-----END-----)
- [x] Cache logic: REFRESH_LEAD_MS = 10 minutes; refresh at ~50 min into 1-hour TTL (matches prompt requirement: "refresh at 50 minutes, never per-call and never on expiry")
- [x] Opt-in via PO_WATCHER_APP_KEY: confirmed; APP_AUTH_ENABLED gate present; logs distinguish ON vs OFF
- [ ] Post-merge operational verification (unchecked as expected): watcher host PEM setup and negative PEM-missing restart test — these are daemon-specific and correctly deferred to follow-up

Risks Marco should know:
- runGh is now async; all call sites on main already use await (verified across 20+ invocations), so the breaking change is safe
- Cache refresh timer on 5-minute cadence uses unref() to avoid keeping process alive unnecessarily (correct)
- Refresh failure does NOT exit (correct per design: next runGh call will fail-closed); only startup mint failure causes process.exit(1)
- Requires-file-on-main requirement satisfied: docs/approvals/watcher-identity-approved-by-marco.md exists on main and contains Marco's authorization + App ID 4798698, Installation ID 158348768
- Standing authority invoked correctly: PR body cites Marco's "standing authority" from prompt line 103 to ship work directly without re-approval

Recommendation: Safe to merge. Unit tests are comprehensive, fail-closed design is enforced throughout, secrets are redacted, and all CI gates pass (tendering-e2e is unrelated and still in progress).
