VERDICT: MERGE

Scope compliance:
- In scope: One new receipt file (`docs/decisions/merge-approvals/1827.md`, 115 lines) documenting Marco's ratification of PR #1827, which merged without proper clearance.
- Out of scope: None. File changes are exactly as described in the PR body.

Self-verification claims:
- [PASS] Single commit, docs-only, authored by Marco + Claude Opus 5
- [PASS] File content is coherent and honest: records the 64-minute gap between merge (00:00:44Z) and Marco's ratification (01:04:30Z)
- [PASS] Correctly documents that the receipt does NOT satisfy CP-26 for #1827 (which is closed, so gate cannot apply retroactively)
- [PASS] Measured findings verified: dispatch log shows `marcoTrue=1` (PR routed to Marco), received no label, so CP-26 returned PASS/NEVER_ESCALATED vacuously
- [PASS] Correctly identifies the mechanism: escalates:false + classifyPolicyFiles rejection writes `marco:true` but no label, preventing machine-enforced gate
- [PASS] Scope of breach verified: #1827 is the only `marcoTrue=1` PR this lane merged; #1832 (also `marcoTrue=1`) was correctly left open

CI status:
- All 16 checks COMPLETED: Changed-path filters, linters, gates (CP-09–13, CP-17, CP-22, CP-23, CP-26), e2e, web, API lint/test, data model, CodeQL
- mergeable: MERGEABLE, mergeStateStatus: CLEAN

Risks Marco should know:
- This is a record of a systemic breach, not a cover-up. The receipt explicitly states it postdates the merge and does not retroactively satisfy CP-26.
- The doc correctly escalates the fix to needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md, identifying the root cause: CP-26 should fire on `classifyPolicyFiles` diff analysis, not on label history alone.
- No action required from this review; Marco already knows the issue and has chosen to rule on the fix before anything is drafted.

Recommendation: Merge. This is honest documentation of a real failure, written with full transparency about what happened, when, and why the gate failed. It serves the accountability and observability purpose CP-26 exists for.
