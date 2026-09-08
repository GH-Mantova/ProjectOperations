VERDICT: MERGE

Scope compliance:
- In scope: docs/pipeline/DOCTRINE.md (adds §9.3 bullet about never comparing file lengths across git show/working-copy boundary), docs/pipeline/stations/_canonical-blocks.json (hash updated from 51d1c535425c7ca4 to bf19cb8c2a183569 after canonical block edit)
- Out of scope: none

Self-verification claims:
- [PASS] Byte delta assertion: BEFORE_BYTES=78274, AFTER_BYTES=80294, DELTA=2020, EXPECTED_DELTA=2020, DELTA_OK=true
- [PASS] NEW_PRESENT=true (§9.3 text present in file)
- [PASS] ANCHOR_STILL_ONCE=true (anchor text appears once in expected location)
- [PASS] SIMPLEMATCH_BULLET_ONCE=true (bullet appears once)
- [PASS] Canonical block hash verified correct via lint-station.mjs hash computation

CI status:
- All checks passing (green): Changed-path filter, CodeQL, PR gates, Approval receipt, Pipeline watcher/linter, arm-prompt tests
- Skipped (expected): Tendering Browser Smoke, API/Web/Data model jobs (docs-only PR)

Risks Marco should know:
- None. Documentation edit with hash update already validated by CI gates. PR is from Station 00 (the supervisor station) on its recorded lane under docs/ per DOCTRINE §10.1.

Recommendation: Safe to merge. Docs-only, all gates passed, self-verification complete.
