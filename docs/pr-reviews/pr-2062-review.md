VERDICT: MERGE

Scope compliance:
- In scope: Renames two spent HOLD files to superseded/ (CRM_PARITY_THREADS_V1 shipped in #2044, ROLE_GRANT_REGISTRY_V1 shipped in #2047, both verified on origin/main). Appends one arm entry to .arming-log.txt (append-only log, correct format).
- Out of scope: None. PR touches only docs/pr-prompts/; no code or sot/.

Self-verification claims:
- Actor notation correct (station-00.interactive-0004 per DOCTRINE 10.2.1)
- Both cited PRs (#2044, #2047) are merged on origin/main
- Both HOLD premise conditions satisfied (feature markers CRM_PARITY_THREADS_V1 and ROLE_GRANT_REGISTRY_V1 present in shipped code)
- .arming-log.txt format valid (ISO 8601 timestamp, ARMED status, actor/pid/caller fields present)

CI status:
- All checks green (Changed-path filter, PR gates, CodeQL, pipeline tests all PASSED)
- Merge state CLEAN

Risks Marco should know:
- None. Pure hygiene PR on docs/pr-prompts/. No schema, migration, or logic drift.

Recommendation: Merge as-is. Clears spent work from the prompt queue.
