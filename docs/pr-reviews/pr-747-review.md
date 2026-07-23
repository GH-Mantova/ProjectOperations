VERDICT: MERGE

Scope compliance:
- In scope: Fallback-audit script implementation (scripts/rates/fallback-audit.mjs), warn signal emission in RateResolverService.resolveRate(), package.json script entry. Matches pr-524 PHASE D precondition-2 gate requirements: script enumerates legacy rate keys from database, mirrors resolver logic exactly (6 slugs), forces RATES_CANONICAL_SOURCE=ratetable for audit, exits 0 only when zero fallbacks detected.
- Out of scope: None identified. Changes strictly limited to rate auditing infrastructure and resolver observability.

Self-verification claims:
- READ-ONLY guarantee: VERIFIED — Script uses findMany/findUnique only (no create/update/delete on rate tables); writes only the report file as documented.
- Mirror resolver logic: VERIFIED — All 6 legacy slug handlers (labour, plant, waste, cutting, core-hole, fuel) byte-match the service's tryLegacy() method. tryRateTable() logic also matches exactly.
- Legacy key discovery: VERIFIED — Dynamic discovery from database via isActive=true rows, not hardcoded. Correctly handles labour shift variants (day/night/weekend).
- Warn signal added: VERIFIED — Structured Logger.warn emitted only in ratetable-fallback path with slug and keys payload.
- Exit code contract: VERIFIED — Exit 0 (all legacy keys resolve via RateTable), exit 1 (fallback or missing), exit 2 (DB connection error).
- Report generation: VERIFIED — Markdown report written to docs/rates/fallback-audit-<timestamp>.md with summary table, per-slug breakdown, enclosure gap documentation.

Risks Marco should know:
- Enclosure rates (EstimateEnclosureRate) are correctly flagged as an "unaddressed gap" — they bypass the resolver entirely and cannot be validated by this script. This is documented in the report, not a regression.
- Script requires seeded database to run (e.g., pnpm seed); will exit 2 with clear error if DB unreachable.
- tendering-e2e check still in progress (started 12:52:49Z); all synchronous checks (lint, test, smoke, gates, CodeQL) have passed. E2E is long-running and not blocking merge—once it completes, PR will be mergeable.

Recommendation: Safe to merge once tendering-e2e completes. Scope is clean, all self-verification checks pass, code quality is high, and it delivers exactly what pr-524 PHASE D precondition-2 requires: a read-only gate mechanism to prove zero fallback events before the irreversible drop.
