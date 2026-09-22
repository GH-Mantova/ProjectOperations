VERDICT: MERGE

Scope compliance:
- In scope: All changes match the prompt exactly — lint-station.mjs now compares contract_version against canon['station-contract'].version; all seven station docs bumped from contract_version: 1 to 3; HOLD prompt retired to superseded/; message reworded to clarify the mismatch is embedded-contract-vs-canonical, not bootstrap-vs-doc.
- Out of scope: None.

Self-verification claims:
- [✓] `node scripts/pipeline/lint-station.mjs` exits 0 — confirmed.
- [✓] no NOTE block about `station_doc_version` in the output — confirmed; message changed to reference `contract_version` instead.
- [✓] `docs/pr-prompts/pr-lintstation-contract-version-compare-HOLD.md` retired to `superseded/` — confirmed; rename visible in git diff.
- [○] CI green — two long-running jobs (tendering-e2e, API smoke) still in progress; no failures detected in 13 completed checks (all green).

Risks Marco should know:
- None. Changes are mechanical (front-matter-only in seven station docs) + logic fix in lint-station.mjs with clean exit. No runtime side effects expected; linter will now correctly report contract mismatches (not station_doc_version mismatches) if they occur.

Recommendation: Safe to merge once the two in-progress CI jobs complete with green.
