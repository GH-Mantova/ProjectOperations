VERDICT: MERGE

Scope compliance:
- In scope: all three file changes are under docs/ as claimed
  * docs/pipeline/DOCTRINE.md +38 -0: §9.5 corrected with measured data (table), falsifying probe, and new unidirectional rule for `opened PR #<n>` test
  * docs/pipeline/stations/_canonical-blocks.json +1 -1: sha updated after lint-station.mjs --write-canonical passed
  * docs/pr-prompts/00-00-supervisor-2026-09-06-1908-*.md +225 -0: breadcrumb file (full prompt archive as new tracked file)
- Out of scope: none detected

Self-verification claims:
- [GREEN] CI passed: 12 SUCCESS / 4 SKIPPED / 0 FAILED (Changed-path filters, CodeQL, PR gates, canonical tests, E2E markers all green)
- [GREEN] Diff matches prompt claims: DOCTRINE +38 lines, canonical-blocks.json sha update, breadcrumb file added
- [GREEN] Binding documents read in full per DOCTRINE §9.1: git diff --numstat origin/main on DOCTRINE.md returned EMPTY, no re-encode
- [GREEN] Scope guardrails respected: no clone writes, no watcher process kills, no untracked file deletions, no branch pruning
- [GREEN] Substantive work completed: the `opened PR #<n>` test is now correctly documented as incomplete/unidirectional, with measured evidence and corroborating instruments

Risks Marco should know:
- This is a correction to binding law (DOCTRINE §9.5) that affects watcher lane classification logic
- The new rule (PRESENT => watcher-opened; ABSENT => [CANNOT MEASURE]) depends on corroborating instruments (.arming-log.txt, createdAt timestamps) when the primary signal is absent
- The measured data table (showing 4 of 5 watcher-opened PRs missing the `opened PR #<n>` line) confirms the defect and justifies the one-directional rule
- The falsifying probe is documented: re-run the measurement on any PR with a killed build; if `opened PR #` line is present, the correction is wrong

Recommendation: PR already merged by Marco at 2026-09-06T19:23:54Z. Merge was safe. Scope clean, CI green, substantive work complete and well-documented.
