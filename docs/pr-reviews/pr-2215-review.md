VERDICT: MERGE

Scope compliance:
- In scope: All four files match the prompt scope exactly.
  - apps/api/src/modules/agreed-records/agreed-record-register.service.ts
  - apps/api/src/modules/agreed-records/__tests__/agreed-record-register.service.spec.ts
  - apps/web/src/pages/JobSorRegisterPage.tsx
  - apps/web/src/pages/__tests__/job-sor-register-eligibility.test.ts
- Out of scope: None. No migrations, schema changes, sot/ edits, or permission changes.

Self-verification claims:
- [PASS] pnpm build succeeds
- [PASS] pnpm lint succeeds (reported in CI: Web, API jobs all pass)
- [PASS] pnpm --filter api test — 21/21 tests pass
- [PASS] pnpm --filter web test — 3575/3575 tests pass across 171 files
- [PASS] SOR_CLAIM_ONCE_V1 marker exported from service.ts and correctly referenced in test
- [PASS] Revert-the-hunk check: Per PR body, all 21 API tests + 9 new web eligibility tests fail on origin/main without the changes
- [PASS] Metadata-catalog.json not in commit (CRLF/LF artifact only, content unchanged)

Implementation quality:
- [PASS] SOR_CLAIM_ONCE_V1 marker correctly defined and exported
- [PASS] ClaimedOn and ClaimLineRef types defined correctly
- [PASS] buildClaimMap function correctly finds EARLIEST claim for each item (sorts by claimMonth asc)
- [PASS] getRegisterForJob loads claim lines for both contract-VC path and AR-only path
- [PASS] isEligible correctly updated: AND claimedOn === null
- [PASS] eligibilityReason exported, checks claimedOn first (before approval checks)
- [PASS] Web UI displays "On <Mon YYYY> claim" badge when claimedOn is set
- [PASS] raiseClaim filters existing claim lines from all requested ids, adds to skipped
- [PASS] Error message includes "previous claim" when all items are already claimed
- [PASS] Claim write ordering preserved: lines written BEFORE Director notification fires

Money-path escalation:
- [CONFIRMED] PR correctly carries `escalates: true` front-matter
- [CONFIRMED] PR correctly carries `do-not-merge` label (applied by watcher per house rules)
- [CONFIRMED] CP-26 gate correctly FAILS with message "PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label; removing it is what releases the merge."
- [CONFIRMED] Approval receipt file missing (docs/decisions/merge-approvals/2215.md) — Marco must create this when approving the escalation, or accept the PR as-is per his review authority

Risks Marco should know:
- This is a MONEY PATH change that modifies billing eligibility logic. The new rule prevents double-claiming of variations/ARs across all months and all claim statuses (including DRAFT). The rule matches ContractsService.createClaim's existing guard, closing a gap in the register path only.
- The PR body includes a read-only verification query (SQL + TypeScript equivalent) to check for existing double-bills in production data. Marco should run this before merge to establish a baseline.
- No existing claim lines are modified; only new register reads and eligibility logic are added. Safe to roll back with code-only revert if needed.

Recommendation: MERGE. Code is solid, tests comprehensive, scope clean, and escalation properly flagged for Marco review. Remove the do-not-merge label after approval to unblock.
