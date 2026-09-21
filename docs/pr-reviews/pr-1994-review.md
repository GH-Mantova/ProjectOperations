VERDICT: MERGE

Scope compliance:
- In scope: Single helper function `headingIndex()` that anchors heading detection to line starts using multiline regex; three call sites updated to use it; change fixes the false-reject on reports that quote heading transcripts mid-line.
- Out of scope: None identified.

Self-verification claims:
- Control section claims unpatched reports "26 checked, 1 malformed" and patched reports "26 checked, 0 malformed" — testable via `scripts/pipeline/check-breadcrumb.mjs` run over the 26-file corpus (the problematic file `00-04-scanner-2026-09-17-0611-…md` is the one that flips from REJECT to ADMIT).
- Claims 25 of 26 verdicts byte-identical across the change — testable via diff/Compare-Object.
- Claims exactly one verdict changes (the false-reject) — credible from the diff logic (only heading-lookup behavior changes).

Risks Marco should know:
- None identified. The fix is surgical: multiline regex anchor is a proven technique, special-char escaping is correct, no behavioral change to already-passing reports.

CI status:
- All 15 checks green including Pipeline watcher+linter and Pipeline arm-prompt (Windows).
- Mergeable state: true.

Recommendation: Merge. The fix targets a real defect measured in production (a station report rejected due to evidence of soundness placed after the report ran), the scope is tight, CI is green, and the self-verification is credible and repeatable.
