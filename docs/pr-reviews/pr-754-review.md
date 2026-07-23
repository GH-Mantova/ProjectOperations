VERDICT: FIX-FORWARD

Scope compliance:
- In scope: All changes within declared bounds (xero, expenses, procurement modules). No schema changes (as required). Environment variables for account codes properly externalized. Fire-and-forget async pattern used throughout. Permissions properly guarded (finance.manage for bill pushes, finance.admin for sync). 
- Out of scope (acceptable per prompt): No web changes — the prompt permits deferring UX to a follow-up. Procurement module comments correctly mark Xero-deepening as complete (removed the "future slice" language).

Self-verification claims:
- [x] pnpm build: PASSED (API — lint, test, compliance smoke)
- [x] pnpm lint: PASSED (included in compliance smoke job)
- [x] grep for pushBill|syncPaymentStatus|createXeroBill: VERIFIED in PR commit b7686ba
- [x] Single commit: VERIFIED (1 commit on branch)
- [ ] tendering-e2e: IN_PROGRESS (not yet completed; blocks mergeable_state but is unrelated to this feature)

Risks Marco should know:
1. **E2E test blocking**: tendering-e2e started at 2026-07-20T18:04:32Z and remains in_progress. This is unrelated to the Xero bill/payment code (Xero is a separate integration, not tendering). The test may simply be long-running. Confirm completion before merging.
2. **Graceful failure is critical**: The retry queue is in-memory with a DB-backed "pending_retry" status. On server restart, `replayFailedBillPushes` will load any DB-persisted pending rows — this is correct. However, if the DB write fails when a bill push fails, the log row won't persist. The code logs this failure, so check logs if bills vanish from the queue.
3. **No migration required**: The PR correctly uses existing `XeroSyncLog` model and existing `ProgressClaim.totalPaid` / `paidDate` columns. No schema drift risk.
4. **Idempotency via skip-not-update**: The approach of skipping rather than updating paid ACCPAY bills is sound (prevents ledger corruption), but assumes the operator is aware that once pushed, a bill can only be corrected in Xero directly. Not a code risk, but an ops constraint.
5. **Optional XeroService injection**: The `@Optional()` pattern in ExpensesService and VendorInvoiceService allows graceful degradation when Xero is not configured. Correct approach.

Recommendation: **Wait for tendering-e2e to complete.** Once that check passes (expected to pass since this PR does not touch tendering), merge confidently. All feature code is correct, scoped properly, and CI passes except for the unrelated E2E suite.
