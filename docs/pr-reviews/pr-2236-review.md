VERDICT: MERGE

## Scope compliance

**In scope:**
- Prisma schema adds `ScopeItemEnclosureLine` model with back-relation on `ScopeOfWorksItem` (CASCADE).
- Migration is additive: creates one table, changes no existing columns/rows.
- Service: `ScopeEnclosureService` with CRUD endpoints for lines (GET/POST/PATCH/DELETE), RateResolverService integration, ASB-only enforcement.
- Controller: nested routes under `tenders/:tenderId/scope/items/:itemId/enclosure-lines` with `estimates.view`/`estimates.manage` guards.
- Money paths: lines joined to item subtotal **before markup** in both `getCardSummary()` (scope-of-works.service) and `summary()` (scope-redesign.service), respecting item's `quoteDestination` and markup chain.
- DTOs: `CreateScopeEnclosureLineDto`, `UpdateScopeEnclosureLineDto` with qty/rateOverride/sortOrder.
- Tests: 17 passing specs in `asb-enclosure-lines.spec.ts` covering POST resolve, totals math, rateOverride, snapshot semantics, destination routing, cascade delete, positive control.
- Data model: metadata-catalog.json regenerated, 299 models/70 enums/501 edges verified.
- Seed: "Enclosure" item-type label renamed to "Enclosure: labour" (prod label change noted for Marco in PR body).
- Marker: `export const ASB_ENCLOSURE_LINES_V1 = "asb-enclosure-s1"` in scope-enclosure.service.ts, tested.

**Out of scope:** None detected. No web changes, no sot/ edits, no rate/seed admin edits.

## Self-verification claims

- [x] pnpm build passes
- [x] pnpm lint passes
- [x] 17/17 tests pass (asb-enclosure-lines.spec.ts PASS in CI)
- [x] ScopeItemEnclosureLine model found in schema.prisma
- [x] ASB_ENCLOSURE_LINES_V1 marker exported and tested
- [x] Relationship map: 299 models, 70 enums, 501 edges ✓
- [x] Migration is CREATE TABLE only (additive)
- [x] No em-dash encoding corruption in schema.prisma
- [x] No sot/ changes (CP-24 compliant)
- [x] No web changes (S2 is separate)
- [x] PR gates: all pass except CP-26 (do-not-merge label, expected per escalates:true)

## Risks Marco should know

- **Migration timestamp ordering:** 20261003120000_ is on 2026-10-03; verify no other migrations for that date exist before merging (alphabetical YYYYMMDDHHMMSS may create race).
- **Approval receipt gate:** CP-26 failure is expected (escalates:true auto-applies do-not-merge label). Release path documented in CI output: remove label or commit approval receipt to `docs/decisions/merge-approvals/2236.md`.
- **Schema drift:** This PR touches `prisma/schema.prisma` + migration same commit. Both Sonnet checks confirm no encoding corruption; recommended to diff-verify before final merge per MEMORY note.
- **Prod label change:** Enclosure item-type label "Enclosure: labour" is seed-only; production Settings → Reference data edit is Marco's action per PR body.
- **Untracked deletions:** All files in PR are additions/edits; no deletions to verify.

## Recommendation

Merge once Marco removes the do-not-merge label (or commits approval receipt) and verifies migration timestamp doesn't collide on 2026-10-03.
