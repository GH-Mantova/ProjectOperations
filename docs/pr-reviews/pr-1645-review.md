VERDICT: MERGE

## Scope compliance

**In scope:**
- DOCTRINE.md §10.2.1: New exception defining "supervised cloud lane" mode for Station 00, bounded to PRs Marco releases in chat, with receipt requirement (72 additions).
- DOCTRINE.md: Four verbatim quotations from Marco's chat instructions (2026-09-04/05) making the claim falsifiable.
- DOCTRINE.md: Explicit re-statement of four prohibitions that remain in force (do-not-merge label, watcher marco:true verdict, /sot/ edits, Azure/Entra/SharePoint).
- STATION-CAPABILITIES.md §5: Two-modes table (scheduled vs. supervised) with CI gate explanation (28 additions).
- PR body: Disclosure that this section authorizes the lane that wrote it, with fallback (strike if Marco doesn't confirm; option (b) from #1644).

**Out of scope:**
- None. Files changed match file list from pr-fix-reviewer prompt. No code changes, migrations, or schema drift.

## Self-verification claims

From originating supervisor finding (00-00-supervisor-2026-09-05-0608):
- F1 answered by option (a) (new exception to §10.2, with receipt requirement): ✓ Implemented exactly as drafted.
- Four Marco quotations verbatim and falsifiable: ✓ Included in §10.2.1 "PROVENANCE" block.
- CI gate already exists (CP-26 RELEASED_NO_RECEIPT): ✓ Verified in approval-receipt.mjs — enforced since at least 2026-09-04.
- Receipt requirement is new, not removing existing gates: ✓ Confirmed in PR body and DOCTRINE.md text ("This removes no gate. It adds one.").

PR body claims verified:
- No auto-merge on this PR: ✓ Confirmed via gh pr view (mergedAt: null, isDraft: false, no auto-merge enabled).
- Exception narrower than practice it records: ✓ Re-states four prohibitions + adds one new constraint (receipt).
- Fallback path explicit: ✓ "If Marco does not confirm it, strike §10.2.1; the correct fallback is option **(b)** on `#1644` — the cloud lane stops merging."

## CI status

All checks green:
- Changed-path filter: SUCCESS (2 runs)
- CodeQL (actions + javascript-typescript): SUCCESS
- PR gates (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Approval receipt (CP-26): SUCCESS (gate itself passes; this PR is docs-only and not labeled)
- Pipeline — watcher + linter tests: SUCCESS
- Pipeline — arm-prompt tests (Windows): SUCCESS
- Remaining jobs (API, data model, web, raw-error-envelope): SKIPPED (docs-only, expected)

## Risks Marco should know

1. **Governance change, not code**: This adds a new authorized lane to DOCTRINE, changing how the repo can be operated. It is not an emergency fix or routine enhancement — it is a decision about who may do what. Marco must decide whether this exception matches his intent.

2. **Interested party**: The lane described in §10.2.1 wrote this section. The disclosure acknowledges this and offers three mitigations: verbatim quotes (falsifiable), narrower than practice (re-states prohibitions), and no auto-merge (waits for Marco). Nonetheless, self-authored governance is a conflict-of-interest shape.

3. **CI gate is load-bearing**: The boundary claimed in §10.1 step 3 proviso is "CP-26 gate proves it." That gate is RELEASED_NO_RECEIPT in approval-receipt.mjs. If that check is removed, disabled, or broken in a future change, the lane's boundary disappears and supervision becomes unenforced. Marco should verify the gate is in his expected state before confirming.

4. **Five consecutive 00 runs misfired before this**: The supervisor finding (F1) measured five scheduled 00 runs (00:08Z, 01:08Z, 03:08Z, 05:08Z, 06:08Z on 2026-09-05) each re-deriving "an unattributable actor is releasing PRs" from first principles, one as a suspected attack. This PR is the answer. If Marco doesn't confirm it, the cloud lane must stop merging (option b in #1644) so future runs see a clear rule again.

5. **Receipts name the lane in body only**: The PR receipt filed at merge will carry `mergedBy: GH-Mantova` (all merges on the board read this way), so the receipt body is the only durable signature that the supervised lane did the merge. A scheduled 00 run finding an unattributed merge should read that as a defect in the supervised lane, per STATION-CAPABILITIES.md new section.

## Recommendation

Merge if Marco confirms that the four quotations in §10.2.1 PROVENANCE are his words and intent. If any quotation is wrong or the exception is unwanted, strike §10.2.1 entirely; the fallback (cloud lane stops merging) is documented and option (b) on #1644 explains why.
