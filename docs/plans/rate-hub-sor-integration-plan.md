# Rate Hub + SoR Integration Plan — SLICE-0

**Status:** PLAN ONLY (Marco approved 2026-08-12). Authored by agent.
All sub-slices open PRs and leave them unmerged for Marco's review.

---

## Executive Summary

The rate hub adds two new tabs — Subcontractors and Suppliers — alongside the existing Internal-rates
tab (RatesListsAdminPage) on `/settings/reference-data`. Vendor rates are stored on
`SubcontractorSupplier.SubcontractorRate` (their one home); the hub tab is a grouped write-through
view, not a copy. A "Create Schedule of Rates" action pulls chosen lines from all three tabs, applies
category-default + per-line markup, and freezes the snapshot at lock — giving one curated SoR that
both estimating and clients consume. A .xlsm import/export on the hub feeds all downstream surfaces.
Guarded push-back lets a local SoR edit promote back to the master vendor rate, permissioned and
change-logged.

---

## Locked Decisions (verbatim, Marco 2026-08-12)

1. Rate hub = 3 tabs on `/settings/reference-data`: Internal rates (existing RateTable grid, REUSE),
   Subcontractors, Suppliers (both new tabs).
2. Subcontractors/Suppliers grouped by TYPE. Type is a managed GlobalList (user add/edit/archive; no
   migration per new type). Ship with ONLY Cutrite → concrete cutters today; do NOT pre-create other
   groups.
3. One home per rate (anti-drift): internal rates in RateTable; vendor rates OWNED on
   `SubcontractorSupplier.SubcontractorRate` — hub tab is a grouped write-through VIEW, never a copy.
   SoR is a curated SNAPSHOT, not a fourth copy.
4. Delete safeguard = REUSE contracts/clients pattern: archive-first (soft, recoverable), hard delete
   BLOCKED while any live tender/variation/SoR references it, true delete super-user only, confirm +
   change-log.
5. "Create Schedule of Rates" action = period-stamped SoR built by pulling chosen lines from all 3
   tabs, applying markup (category default + per-line override); SoR attaches to client/job and
   FREEZES at lock.
6. SoR line source: Linked-Internal (via resolveRate) | Linked-Subbie/Supplier (explicit vendor pick
   from card, opt-in — NOT a resolver default) | Manual (typed, opt-in "promote to hub").
7. Excel .xlsm import/export lives on the HUB (RateTable / reference-data), with validation gate
   (staged → validated → all-or-nothing commit; dry-run + impact preview). Import Marco's .xlsm
   once; SoR + estimating both consume.
8. Guarded push/pull: pull (hub → SoR/tender/variation) is read+snapshot. Push (local edit back to
   master) is permission-gated, change-logged, shows impact preview of affected UNLOCKED tenders
   before confirm; locked snapshots NEVER move. Optional role split.

---

## Ground-Truth Citations

All citations are against `origin/main` as of 2026-08-12.

### Schema — `apps/api/prisma/schema.prisma`

| Model | First line | Key fields |
|---|---|---|
| `GlobalList` | 3569 | `slug`, `type`, `isSystem`, `items[]` |
| `GlobalListItem` | 3586 | `listId`, `value`, `label`, `isArchived`, `sortOrder` |
| `RateTableCategory` enum | 5402 | `INITIAL_SERVICES`, `SUBCONTRACTOR` |
| `RateTable` | 5428 | `slug`, `category`, `supplierId`, `isSystem`, `isReference`, `columns[]`, `rows[]` |
| `RateColumn` | 5451 | `rateTableId`, `dataType`, `role`, `listSlug` |
| `RateRow` | 5471 | `rateTableId`, `cells (Json)`, `isActive`, `effectiveFrom/To` |
| `SubcontractorSupplier` | 4285 | `entityType`, `categories[]`, `isActive`, `subcontractorRates[]`; NO `archivedAt` yet |
| `SubcontractorRate` | 4360 | `subcontractorSupplierId`, `discipline`, `unit`, `rate`, `validFrom/To`, `isActive` |
| `SorPeriod` | 6985 | `year`, `half`, `status`, `rates[]`, `clientCards[]` |
| `SorRate` | 7003 | `periodId`, `category`, `name`, `ordinary/oneAndHalf/double`, `isReference`, `clientRateEntries[]` |
| `SorClientRateCard` | 7049 | `clientId`, `sorPeriodId`, `status`, `entries[]` |
| `SorClientRateEntry` | 7066 | `cardId`, `sorRateId`, `isOverride`, `isRemoved` |

**Archive pattern:** `Contract.archivedAt / archivedById` added in PR #1042 at
`schema.prisma:3897–3900,3917`; `JobCloseout` same pattern at `1639–1641,1649`.
`SubcontractorSupplier` currently has NO `archivedAt`/`archivedById` columns — S2 adds them.

### Rate Resolver — `apps/api/src/modules/rates/rate-resolver.service.ts`

- `resolveRate(tableSlug, keys)`: line 54 — the single seam every consumer calls.
  Legacy-first by default; flips to RateTable-first when `RATES_CANONICAL_SOURCE=ratetable`.
- `resolveReferenceValue(tableSlug, keys, columnName)`: line 186 — reads a named metric
  from an `isReference=true` RateTable; returns null on miss (no throw).
- File is 420 lines total. Subbie/Supplier rates MUST NOT be routed through this service.

### Reference-Data Admin Page

- `apps/web/src/pages/admin/RatesListsAdminPage.tsx` — serves `/settings/reference-data`
  (alias redirect from `/admin/rates-lists`). Hosts `FilterableRateGrid` for Internal rates.
  Imports `whereUsedBlockerMessage` from `./ratesListsHelpers` (line 16) — this is the
  in-use guard pattern to reuse for vendor delete-block UI.

### SoR Admin Page

- `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` — at `/admin/schedule-of-rates`.
  Manages `SorPeriod` + `SorRate` + `SorClientRateCard`. The "Create SoR" wizard (S4)
  will live here or in a new page under `apps/web/src/pages/schedule-of-rates/`.

### Subcontractor Rates Tab (existing)

- `apps/web/src/pages/directory/SubcontractorRatesTab.tsx` — RC-2 (already shipped)
  rate-card UI on the subcontractor detail page. The hub tab (S1) is a different view:
  grouped across ALL vendors by type, not per-vendor.

### Archive + Super-User Delete Pattern

- **Service:** `apps/api/src/modules/contracts/contract-archive.service.ts`
  - `archive(id, actorId)` — stamps `archivedAt`, writes audit log (line 33)
  - `unarchive(id, actorId)` — clears stamp (line 60)
  - `hardDelete(id, actorId, isSuperUser)` — throws `ForbiddenException` when not super-user (line 94)
- **Guard:** `apps/api/src/common/auth/super-user.guard.ts`
  - Imported in `contracts.controller.ts:16`; applied with `@UseGuards(SuperUserGuard)` at line 430
- **In-use block (UI):** `whereUsedBlockerMessage(count)` in `ratesListsHelpers.ts:76`

---

## What We Are NOT Doing

- Do NOT rebuild `RateTable`, `resolveRate`, or the reference-data grid — reuse them.
- Do NOT route subbie/supplier rates through `RateResolverService` — it is the estimate-pricing
  spine mid-migration; vendor rates are a different axis.
- Do NOT duplicate vendor rates into the hub — the hub is a write-through view over
  `SubcontractorRate`; no rate is stored twice.
- Do NOT auto-create a new migration every time a user adds a vendor type — type is a
  managed `GlobalList`; no migration per new type.
- Do NOT make the SoR a fourth live copy of rates — it is a period-stamped snapshot that
  freezes at lock.
- Do NOT route the hub .xlsm import through the legacy `EstimateRatesAdminPage` surface.

---

## Ordered Slices S1–S6

### S1 — Hub Tabs + Type Grouping (view-only over existing stores)

**Goal:** Add Subcontractors and Suppliers tabs to `/settings/reference-data`. Group vendors by
`GlobalList` slug `vendor-types` (user-managed). Show each vendor's `SubcontractorRate` lines.
Edit routes back to the vendor detail card (write-through, no copy).

**Files touched (approximate):**
- `apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx` (NEW — premise artifact)
- `apps/web/src/pages/admin/RatesListsAdminPage.tsx` (add two tabs)
- `apps/api/prisma/schema.prisma` (add `vendorTypeId String?` on `SubcontractorSupplier` referencing `GlobalListItem`)
- `apps/api/prisma/migrations/` (additive — new nullable FK)
- `docs/data-model/**` (regenerate)
- Seed file to create `GlobalList` slug `vendor-types` + one item `concrete-cutters` and link Cutrite

**Schema impact:** YES — additive nullable `vendorTypeId` FK on `SubcontractorSupplier`.
**gate_allow:** `migrations`
**rollback_strategy:** `no rollback — column is nullable with no default; drop column in a follow-on migration`
**backfill:** false
**Premise artifact:** `apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx`
**Escalates:** false

---

### S2 — Delete Safeguard

**Goal:** Archive-first (soft-delete) on hub rates/vendors/groups, in-use guard blocking hard-delete
when referenced by live tender/variation/SoR, super-user-only true delete, change-log.
Copy the `ContractArchiveService` pattern exactly.

**Files touched (approximate):**
- `apps/api/src/modules/rates/rate-archive.service.ts` (NEW — premise artifact)
- `apps/api/prisma/schema.prisma` (add `archivedAt`, `archivedById` on `SubcontractorSupplier`; optional on `SubcontractorRate`)
- `apps/api/prisma/migrations/` (additive columns)
- `docs/data-model/**` (regenerate)
- `apps/api/src/modules/subcontractors/subcontractors.controller.ts` (archive/unarchive/delete endpoints)
- `apps/web/src/pages/directory/SubcontractorsPage.tsx` (archive/restore controls)

**Schema impact:** YES — additive `archivedAt`/`archivedById` on `SubcontractorSupplier`.
**gate_allow:** `migrations`
**rollback_strategy:** `no rollback — columns are nullable; drop columns in a follow-on migration`
**backfill:** false
**Premise artifact:** `apps/api/src/modules/rates/rate-archive.service.ts`
**Escalates:** false
**Chain dependency:** `requires_file_on_main: apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx`

---

### S3 — SoR Line Source + Markup (ESCALATES)

**Goal:** Extend `SorRate` with a `sourceType` enum (`INTERNAL | SUBBIE | SUPPLIER | MANUAL`),
link fields to source entity, category-default markup + per-line override, and a
"promote manual → hub" action on the SoR entry.

**Files touched (approximate):**
- `apps/api/prisma/schema.prisma` (add `SorRateSourceType` enum + `sourceType`, `sourceRateId`,
  `sourceVendorId`, `markupPct` fields on `SorRate`; `categoryMarkup` table or JSON on `SorPeriod`)
- `apps/api/prisma/migrations/` (additive migration)
- `docs/data-model/**` (regenerate)
- `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts` (NEW — premise artifact)
- `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` (source picker, markup column)

**Schema impact:** YES — new enum + nullable fields on `SorRate`.
**gate_allow:** `migrations`
**rollback_strategy:** `no rollback — columns and enum are additive; drop enum + columns in a follow-on migration`
**backfill:** false
**Premise artifact:** `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts`
**Escalates:** true (schema design + markup behaviour require Marco's review)
**Chain dependency:** `requires_file_on_main: apps/api/src/modules/rates/rate-archive.service.ts`

---

### S4 — Create Schedule of Rates

**Goal:** Wizard / action to build a `SorPeriod` by pulling chosen lines from all three hub tabs,
applying S3 markup, and freezing the snapshot at lock. Attaches to client/job.

**Files touched (approximate):**
- `apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx` (NEW — premise artifact)
- `apps/api/src/modules/schedule-of-rates/create-sor.service.ts`
- `apps/web/src/App.tsx` (route)
- `apps/web/src/components/ShellLayout.tsx` (nav link)

**Schema impact:** NO — uses existing `SorPeriod`, `SorRate`, `SorClientRateCard` models.
**gate_allow:** `none`
**Premise artifact:** `apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx`
**Escalates:** false
**Chain dependency:** `requires_file_on_main: apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts`

---

### S5 — Hub .xlsm Import/Export

**Goal:** Staged → validated → all-or-nothing commit pipeline for .xlsm files on the hub
(`/settings/reference-data`). Dry-run + impact preview before commit.

**Files touched (approximate):**
- `apps/api/src/modules/rates/rate-xlsm-import.service.ts` (NEW — premise artifact)
- `apps/api/src/modules/rates/rate-xlsm-export.service.ts`
- `apps/api/src/modules/rates/rates.controller.ts` (import/export endpoints)
- `apps/web/src/pages/admin/RatesListsAdminPage.tsx` (import/export UI)

**Schema impact:** NO — reads/writes existing `RateTable`/`RateRow`; no new models.
**gate_allow:** `none`
**Premise artifact:** `apps/api/src/modules/rates/rate-xlsm-import.service.ts`
**Escalates:** false
**Chain dependency:** `requires_file_on_main: apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx`

---

### S6 — Guarded Push-Back

**Goal:** Local SoR edit → master `RateTable`/vendor rate. Permission-gated (new RBAC role),
change-logged, shows impact preview of affected UNLOCKED tenders before confirm.
Locked snapshots (`TenderRateSet`) are never mutated.

**Files touched (approximate):**
- `apps/api/src/modules/rates/rate-push-back.service.ts` (NEW — premise artifact)
- `apps/api/src/modules/rates/rates.controller.ts` (push-back endpoint)
- `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` (push-back UI + impact modal)
- `apps/api/src/common/auth/permissions.ts` (new `rates.push-back` permission)

**Schema impact:** NO — writes to existing `RateTable`/`RateRow` + reads `TenderRateSet`.
**gate_allow:** `none`
**Premise artifact:** `apps/api/src/modules/rates/rate-push-back.service.ts`
**Escalates:** false
**Chain dependency:** `requires_file_on_main: apps/api/src/modules/rates/rate-xlsm-import.service.ts`

---

## Cross-Cutting Invariants

1. **Freeze-in-time:** `TenderRateSet` and `SorClientRateCard` are snapshots. Once locked, no push
   from the hub or push-back from a local edit may mutate them. Enforce at the service layer.
2. **One home per rate:** Internal rates live in `RateTable`/`RateRow`. Vendor rates live in
   `SubcontractorRate`. The hub tab is a view; the SoR is a snapshot. No rate is stored in two
   canonical places.
3. **Subbie rates NEVER via resolveRate:** `RateResolverService` is the estimate-pricing seam and
   is mid-migration. Subcontractor/supplier rates are a separate axis; route them through a dedicated
   lookup, never through the resolver.
4. **Archive-first delete pattern:** Every delete surface follows the `ContractArchiveService`
   model — soft-archive (recoverable), in-use guard (hard-delete blocked while referenced by live
   tender/variation/SoR), super-user-only true delete, audit log.
5. **GlobalList for vendor types:** No migration per new vendor type; users add types via the
   GlobalList admin UI. Only the Cutrite → concrete-cutters seed ships with S1.

---

## Chain Graph

```
S1 (VendorRatesTab.tsx + typeId migration)
  └─ S2 (rate-archive.service.ts + archivedAt migration)
       └─ S3 (sor-source-markup.service.ts + SorRateSourceType migration) [escalates]
            └─ S4 (CreateSorPage.tsx — no schema)
                 └─ S5 (rate-xlsm-import.service.ts — no schema)
                      └─ S6 (rate-push-back.service.ts — no schema)
```

Each slice's `requires_file_on_main` points at the premise artifact of the slice above it.
