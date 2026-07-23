VERDICT: MERGE

Scope compliance:
- In scope: One subsection added to SECTION 6 (Architecture rules) of sot/01-charter-and-architecture.md:
  "Append-only movement rule (BINDING for new work -- Marco, 2026-07-23)". Defines binding architectural
  rule for NEW or materially-reworked models with financial/quantity/compliance-significant state:
  append-only movement/history rows as source of truth, with allowed denormalised current values.
  Explicitly scopes NO retrofit mandate, exempts derived/presentational values, clarifies Xero remains
  ledger (operational audit trail only). References precedents on main (AssetStatusHistory, SiteAttendance,
  ClaimLineItem number sequences) and composes with idempotency pattern in PR #770.
- Out of scope: None. Single file, sot-only change.

Self-verification claims:
- CP-24 (sot-purity) compliance: PASS. PR touches sot/ only, no code files. CP-24 does not flag doc-reconcile
  PRs (deliberately allows sot/ + docs/). All other PR gates (CP-09–13, CP-17, CP-22, CP-23) pass.
- CI green: PASS. All 8 status checks complete with SUCCESS:
  - API — lint, test, compliance smoke
  - Data model — generator sanity
  - PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)
  - Web — lint, logic tests, build
  - Tendering e2e
  - CodeQL (actions, javascript-typescript)
- Originating instruction: PR body states "Marco approved 2026-07-23 (this session)" for a new binding rule.
  No formal prompt file exists (doc-reconcile PRs from verbal instruction are normal; TEMPLATE-sot-reconcile.md
  covers the pattern). Commit message and PR body align: "add binding append-only movement rule for new
  financial/quantity/compliance models (Marco 2026-07-23)".
- Content accuracy: Rule correctly cites AssetUsageReading from sot/06 section 3.3 (verified: "readings are
  append-only... asset service rejects a reading below the last recorded one"). SiteAttendance schema confirmed
  append-only. ClaimLineItem references confirmed in schema. Forward reference to idempotency-pattern.md in
  PR #770 is appropriate for a composable architectural principle.

Risks Marco should know:
- Forward reference to docs/architecture/drafts/idempotency-pattern.md does not yet exist (PR #770 is in flight).
  This is safe: the reference is explicitly qualified "(in open PR #770)" so readers know it's aspirational.
  The rule stands alone without the reference.
- The rule is binding on NEW and "materially-reworked" models. Scope limits explicitly exclude retrofit mandates
  (existing counters), derived values, and general-ledger use cases. Language is clear, not ambiguous.
- No originat prompt document on file — this is normal for doc-reconcile PRs from direct instruction. PR body
  adequately documents the decision authority (Marco, 2026-07-23).

Recommendation: Merge. This is a well-scoped SoT update that codifies existing architectural practice (AssetStatusHistory,
SiteAttendance) into binding guidance for new work. CI is green, scope is clean, and the rule is correctly positioned in the
charter with explicit scope limits to prevent over-application. No follow-up work required.
