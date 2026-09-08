VERDICT: MERGE

Scope compliance:
- In scope: 8 inline sot-ref-allow markers added to lines carrying 9 provenance-class references (sot/01 ×1, sot/03 ×5, sot/04 ×2); 9 entries removed from baseline (13→4); one sentence appended to baseline's _readme explaining the split between provenance (cleared) and spec-judgement (remaining) classes. Files changed: sot/01, sot/03, sot/04, docs/qa/sot-refs-baseline.json, docs/pr-prompts/. No scripts/, apps/, prisma/, .github/ touched — CP-24 clean by construction.
- Out of scope: None identified. The 4 surviving entries in sot/06 were deliberately left baselined per the prompt's F2 disposition; they require spec judgement, not markers.

Self-verification claims (from originating prompt):
- [PASS] Baseline shrink verified: entries count 13→4 confirmed in PR diff.
- [PASS] Markers placed on correct lines: 8 consolidation-provenance markers verified (sot/01:1, sot/03:5, sot/04:2); all cite C:\Dev\ProjectOperations predecessor workspace with 0 commits in this repo.
- [PASS] No entry-deletion-only hard CI failures: ratchet self-test passed (4 cases); baseline-ratchet.mjs cross-check succeeded.
- [PASS] Encoding integrity: no CRLF-vs-LF drift; line counts unchanged (1831→1831, 12034→12034, 5270→5270); numstat signatures (1/1, 5/5, 2/2, 1/10) show targeted edits, not encoding damage.
- [PASS] _readme updated: sentence appended explaining provenance-class disposition and why the remaining 4 are different (sot/06 live technical claims, not provenance).
- [PASS] Single commit with correct title: "docs(sot): burn down the nine provenance-class sot-refs entries (13 to 4)".

CI status:
- All checks PASSED: PR gates (CP-09–13, CP-17, CP-22, CP-23), approval receipt (CP-26), pipeline watcher + linter, pipeline arm-prompt tests, CodeQL. Skipped checks are unrelated (API, data model, web, raw-error-envelope — path-filtered).

Risks Marco should know:
- None identified. Station 05 explicitly did NOT arm, merge, or touch the board; the 4 open PRs (#1544 #1543 #1541 #1536) remain untouched. The markers are line-drift-proof and immune to future re-keying. The baseline now correctly reflects the two-class split: provenance (cleared, never auto-fixable) and spec-judgement (remaining, requires Marco's call on sot/06 content).

Secondary findings shipped in the breadcrumb (not actioned per Station 05 charter):
- F3: sot/02 roadmap table stale (still lists #894, #895 as "open right now" — merged 2026-08-04). Escalated to Marco with options: (a) self-dating section (preferred), (b) refresh to today's 4 PRs (temporary fix), (c) leave (fails current half).
- F4: 32 of 81 API modules absent from sot/01 registry. Deferred; scope-appropriate for dedicated doc-reconcile pass.

Recommendation: MERGE. Scope clean, CI green, baseline integrity verified via ratchet self-test, content-loss guards passed, single commit, no risk.
