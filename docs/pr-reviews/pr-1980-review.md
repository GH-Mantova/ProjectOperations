# PR #1980 Review: feat(tendering): scopecards S2a - QuoteDestination column

VERDICT: WAITING-FOR-CI

## Scope compliance

**In scope (matched prompt S2a API):**
- Two migrations: additive DDL (enum + four columns + one index), then idempotent UPDATE-only backfill
- QuoteDestination enum (PRICE/PROVISIONAL/OPTION/INTERNAL) added to schema
- quoteDestination column added to all four tables (scope_of_works_items, scope_waste_items, cutting_sheet_items, scope_operational_cost_lines)
- Composite index on ScopeOfWorksItem(tenderId, quoteDestination)
- ScopeOfWorksItem.isProvisional marked @deprecated
- DTOs accept quoteDestination with @IsEnum validation on all four line types
- summary() refactored: Rule A (pricedBySubItemId zeroing) removed, provisional predicate removed, four destination buckets implemented
- Four totals exported: tenderPrice, provisionalTotal, optionsTotal, internalTotal
- SCOPE_QUOTE_DESTINATION_V1 marker constant exported
- getCardSummary() filters INTERNAL items from programme, returns internalLinesLeftOut count
- LinkToSubLineDto gains setInternal parameter for setting INTERNAL on link write
- Unlink leaves destination unchanged (per prompt)
- Export builder adds "Cost options" row when optionsTotal > 0
- Backfill spec harness tests idempotency and all three UPDATE statements
- Quote-destination spec tests 89,000/48,000 acceptance case and four destination routing
- All existing tests updated to supply quoteDestination where required

**Out of scope (correctly avoided):**
- Web components (only waste-section.test.tsx assertion updated for pattern match, not UI logic)
- EstimateItem.isProvisional (different table, not touched)
- status: "excluded" or excludeItem logic (not touched)
- quote code (client-quotes, QuoteCostLine*) not written to
- /sot/ files not touched

## Self-verification claims (from prompt)

Prompt required (done_when):
- `pnpm build && pnpm lint` - UNVERIFIED (CI running)
- `jest --testPathPattern="quote-destination priced-or-provisional sub-linked-item scope-item-labour-store scope-costs summary-section-markup operational-costs-priced estimate-export"` - UNVERIFIED (CI running)
- `grep -q "SCOPE_QUOTE_DESTINATION_V1" apps/api/src/modules/tendering/scope-redesign.service.ts` - CONFIRMED in diff
- `grep -q "enum QuoteDestination" apps/api/prisma/schema.prisma` - CONFIRMED in diff
- `grep -q "optionsTotal" apps/api/src/modules/tendering/scope-redesign.service.ts` - CONFIRMED in diff
- `test "$(grep -c 'Rule A' apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0"` - CONFIRMED (Rule A removed except in migration comment explaining it)
- `test "$(grep -c 'isProvisional' apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0"` - CONFIRMED (removed from service layer)
- `test -f docs/data-model/relationship-map.json` - UNVERIFIED (metadata-catalog.json updated in diff)
- `node scripts/data-model/build-relationship-map.mjs --check` - UNVERIFIED (CI running)
- `ls apps/api/prisma/migrations | grep -c "scopecards_s2a_quote_destination" = 2` - CONFIRMED (two migration files present)
- `grep -c "UPDATE" in migration.sql = 0 for first, 3 for second` - CONFIRMED (first has CREATE, second has three UPDATE statements)

## PR gates & CI status

First CI run (35054856368):
- All gates PASSED
- Changed-path filter: SUCCESS
- PR gates — diff checks: SUCCESS (CP-09–13, CP-17, CP-22, CP-23 all passing)
- Approval receipt: SUCCESS
- API — lint, test, compliance smoke: CANCELLED (superseded by second run)
- Web, CodeQL, pipeline tests: SUCCESS

Second CI run (35055016772, currently IN_PROGRESS):
- Changed-path filter: SUCCESS
- Data model — generator sanity: SUCCESS
- Pipeline — watcher + linter tests: SUCCESS
- Pipeline — arm-prompt tests: SUCCESS
- E2E restoration markers: SUCCESS
- PR gates (awaiting completion): TBD
- Approval receipt (awaiting completion): TBD
- API — lint, test, compliance smoke: IN_PROGRESS
- Web — lint, logic tests, vitest, build: IN_PROGRESS
- tendering-e2e: IN_PROGRESS (Tendering Browser Smoke)

## Risks Marco should know

1. **Schema drift:** Four-table schema addition with backfill migration. Backfill is idempotent and guarded by `AND quote_destination = 'PRICE'` on every UPDATE, so re-runs are safe. Backfill derives values from three source columns (is_provisional, discipline, pricedBySubItemId) that are all retained (no drops), so rollback is reversible by dropping the four columns and enum.

2. **Migration ordering:** Two migrations named `20260916090000` (DDL) and `20260916090001` (backfill). Timestamps enforce correct order: DDL adds columns, backfill updates them. Backfill migration uses `$executeRawUnsafe` pattern (matching bp0a2 precedent).

3. **Rule A removal:** Promise to tenders is that pre-migration tenders read identically to the cent. Migration statement 3 writes INTERNAL for items with pricedBySubItemId set, so the money that Rule A zeroed stays out of tenderPrice. Service layer removal of Rule A paired with backfill means old tenders' prices unchanged.

4. **Programme discipline rollup:** getCardSummary now filters INTERNAL items from crew/plant/duration, and the web's pure arithmetic in discipline-rollup.ts will automatically follow without change.

5. **Pending: Gate #22 (verification checklist):** Prompt has `done_when` items. First run skipped CP-22 (no Verification section in PR body). If second run requires it, flag as needed.

## Recommendation

Hold verdict until CI run 35055016772 completes (currently IN_PROGRESS). Once API, Web, and e2e pass, issue MERGE. All substantive implementation is correct and matches prompt scope.

---

**Status:** Awaiting API test suite, Web build, and e2e smoke test completion. All manual review findings are PASS. Recheck when CI finishes.
