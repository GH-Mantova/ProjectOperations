---
premise: '! grep -q "model ScopeItemEnclosureLine" apps/api/prisma/schema.prisma'
premise_means: >-
  Enclosure, air monitoring and clearance cannot be priced on an asbestos scope item. MEASURED
  2026-10-02 at origin/main 7d9926ae:
  - EstimateEnclosureRate rows exist ("ACM enclosure (Class A, friable)" m² 185, "ACM enclosure
    (Class B, non-friable)" m² 95, "Air monitoring" day 540, "Clearance certificate" ea 850).
  - RateResolverService already resolves them under the slug "enclosure"
    (rate-resolver.service.ts:931 list, :1224 single).
  - Nothing on a scope item can hold such a line: the "enclosure" item type prices on men x days
    only (scope-redesign.service.ts:59).
  - The approved Discipline Cards mock-up specifies an "Enclosure, monitoring & clearance"
    expandable on ASB items, priced from the enclosure rate table.
  Marco decided on 2026-10-02:
  - the enclosure rates are materials/hire only, so build/strip labour stays as men x days and these
    lines are ADDED on top;
  - the lines follow their parent item's quote destination and markup.
  POSITIVE CONTROL: grep -n 'case "enclosure"' apps/api/src/modules/rates/rate-resolver.service.ts
  returns hits.
design_ref: Claude Design/proposed/asb-enclosure-lines/asb-enclosure-lines-mockup.html
done_when: >-
  pnpm build && pnpm lint && pnpm --filter api test &&
  grep -q "model ScopeItemEnclosureLine" apps/api/prisma/schema.prisma &&
  grep -rq "ASB_ENCLOSURE_LINES_V1" apps/api/src/modules/tendering &&
  node scripts/data-model/build-relationship-map.mjs --check
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/prisma/seed-reference.ts
  - apps/api/src/modules/tendering/scope-enclosure.service.ts
  - apps/api/src/modules/tendering/scope-enclosure.controller.ts
  - apps/api/src/modules/tendering/dto/scope-enclosure.dto.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/asb-enclosure-lines.spec.ts
size: 8
gate_allow: migrations
backfill: false
seed_only: false
rollback_strategy: >-
  Additive. The migration creates one new table and changes no existing column or row. Reverting
  the code leaves the table unused; no existing line prices differently at any point.
escalates: true
module: tendering
---

**MIGRATION + MONEY PATH — `escalates: true`.** The built PR stops for Marco before merge.

# Asbestos enclosure S1: priced enclosure, air monitoring and clearance lines on an ASB item

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's decisions, 2026-10-02 — build to these

1. The enclosure rates are **materials and hire only**. The labour to build and strip the enclosure
   stays as men × days on the existing line type. These lines are **added on top**.
2. The lines **follow their parent item**: its quote destination, and its markup
   (`item.markupOverride ?? card.markupOverride ?? tender markup`, as S3 resolves for every line).
3. The mock-up at the `design_ref` is approved, including the on-screen label "Enclosure: labour"
   for the existing line type (see Reference data below).

## What to build

Marker: `export const ASB_ENCLOSURE_LINES_V1 = "asb-enclosure-s1";` in `scope-enclosure.service.ts`.

### Schema: one new table, additive

`ScopeItemEnclosureLine`:

- `id` (cuid).
- `scopeItemId`: FK to `ScopeOfWorksItem`, `onDelete: Cascade`.
- `enclosureType`: String. This is the rate key resolved under the `enclosure` slug.
  - **No FK to `EstimateEnclosureRate`**: legacy rate tables are slated for retirement
    (`pr-rates-s11c-drop-legacy-tables`), and the key plus snapshot survive that.
- `qty`: Decimal(10,3).
- `unit`: String, snapshotted at create.
- `rate`: Decimal(10,2), snapshotted at create.
- `rateOverride`: Decimal(10,2), nullable, with the same null-means-inherit semantics as
  `ScopeOperationalCostLine.rateOverride`. A stored 0 is a real value.
- `sortOrder`, `createdAt`, `updatedAt`.
- Add the back-relation on `ScopeOfWorksItem`.

Migration name: `<timestamp>_asb_enclosure_lines`, CREATE TABLE only. Run
`node scripts/data-model/build-relationship-map.mjs` and commit `docs/data-model/*`.

### Service and routes, nested under the item, in the existing tendering auth pattern

- `GET    /tenders/:tenderId/scope/items/:itemId/enclosure-lines`
- `POST   …/enclosure-lines` with body `{ enclosureType, qty }`.
  - Resolve unit and rate through `RateResolverService` with slug `enclosure`, honouring the tender's
    locked rate set exactly as other scope lines do.
  - Snapshot both.
  - An unknown or inactive type is a 400.
- `PATCH  …/enclosure-lines/:lineId` with body `{ qty?, rateOverride?, sortOrder? }`. Changing the
  type means delete and add; do not re-resolve silently.
- `DELETE …/enclosure-lines/:lineId`.
- **ASB only.** The parent item's card discipline must be `ASB`; otherwise 400 "Enclosure lines are
  only available on asbestos items."
- Use the same permission codes the scope item routes use, and the same tender-scoping checks
  (item belongs to the tender).

### Money

- Line total = `qty × (rateOverride ?? rate)`, rounded to cents.
- The sum of an item's enclosure lines joins that item's subtotal **before markup**, everywhere the
  item subtotal is computed. That covers at least `getCardSummary` (`scope-of-works.service.ts:1206`)
  and the discipline/push aggregation in `scope-redesign.service.ts`, so the amount pushed to the
  quote under `QUOTE_PUSH_BY_DESTINATION_V1` includes it under the item's destination.
- Find every other site that sums an item's cost and include it there. List them in the PR body.
- An INTERNAL item's enclosure lines stay internal, exactly like the rest of the item.

### Reference data

- In `seed-reference.ts`, change the row type `{ value: "enclosure", label: "Enclosure" }` label to
  **"Enclosure: labour"**. Keep the `value` unchanged; this is the label only, for new environments.
- **Production is Marco's to change**, in Settings → Reference data. Say so in the PR body. Do not
  write a data migration for it.

## Tests: `__tests__/asb-enclosure-lines.spec.ts`

1. POST on an ASB item resolves "ACM enclosure (Class A, friable)" to unit `m²`, rate 185, and stores
   both. On a locked tender it takes the locked rate, not the live one.
2. POST on a DEM item is a 400. POST with an unknown type is a 400.
3. Totals:
   - 38 m² × 185 + 4 day × 540 + 1 ea × 850 = 10,040.00 joins the item subtotal.
   - The markup applies to it.
   - **The item's labour and plant figures are byte-identical with and without the lines.**
4. `rateOverride` 170 changes that line to 38 × 170. `rateOverride` 0 makes it free, which is a real
   zero.
5. Changing the live rate table after a line is added does not change the line.
6. The quote push for an item with destination PROVISIONAL carries the enclosure amount under
   PROVISIONAL. The same item set to INTERNAL keeps it out of the card figures.
7. Deleting the item deletes its lines (cascade).
8. Tests 1, 3 and 6 **fail on `origin/main`**. Prove it once.

## PR body

- `GATE-ALLOW: migrations` as a bare line at column 0.
- The migration SQL.
- The list of every sum site you touched.
- The Reference-data note for Marco.

## DO NOT

- No change to the existing `enclosure` item type's pricing, to men × days, or to any existing line.
- No web change. That is S2.
- Do not edit the enclosure rates or the Rates admin. Do not touch `sot/` (CP-24).
