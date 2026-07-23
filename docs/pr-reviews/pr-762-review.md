# PR #762 Review — docs(sot-04): re-merge generated data-model section

## VERDICT: MERGE

Scope compliance:
- In scope: Single file `sot/04-data-model.md`, +103 / −28 lines. Re-merge of auto-generated schema map from Prisma after schema advanced (234→239 models, 42→46 enums, 363→376 FK edges). Curated MERGED SOURCES tail preserved byte-for-byte per CP-24 (sot-purity).
- Out of scope: None. Working tree has modified gitignored data-model artifacts (metadata-catalog.json, relationship-map.json, relationship-map.md) but PR commit does not include them — correct per house rules.

Self-verification claims:
- [x] stale sha `a4dd7c01dda7` absent, `Models: 239` present in commit diff
- [x] Curated-tail sha256 preserved byte-for-byte: `6e0db192a89a8f3ce2aa4e776923add562749da7c4e3bdf544f658d862e82775`
- [x] Only `sot/04-data-model.md` staged/committed
- [x] `pnpm lint` PASS (Web — lint job succeeded)
- [x] CP-24 (sot-purity) passes — only SoT file touched, no app code drift introduced by this PR

CI status:
- CodeQL: success
- Web lint/test/build: success
- PR gates (CP-09–13, CP-17, CP-22, CP-23): success
- Data model generator sanity: success
- API build: in_progress (pre-existing breakage on main unrelated to this doc-only change, per PR body)
- tendering-e2e: in_progress

Risks Marco should know:
- Pre-existing build breakage on main (scope-waste.service.ts missing Prisma fields) flagged in PR body. This PR does not touch app code and does not make the situation worse. Separate code PR needed to sync tendering service with schema. Not a blocker for this doc-only merge.
- PR labeled `do-not-merge` and explicitly states "escalates: true" — Marco review required per governance.

Recommendation: MERGE — this is a clean SoT documentation update with verified purity guarantees. The pre-existing API build issue belongs in a separate PR.
