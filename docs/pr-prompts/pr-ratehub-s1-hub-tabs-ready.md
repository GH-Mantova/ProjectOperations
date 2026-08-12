---
premise: ! test -f apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx
premise_means: The VendorRatesTab component does not exist yet — S1 hub tabs work is still needed.
scope:
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/subcontractors/**
  - apps/api/src/modules/rates/**
  - docs/data-model/**
  - apps/api/prisma/seed.ts
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx
  - grep -q "vendorTypeId" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
rollback_strategy: "no rollback — vendorTypeId is a nullable FK on subcontractor_suppliers; drop column in a follow-on migration if needed"
backfill: false
---

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never ask a question. Decide from the evidence, or write to `needs-marco/` and stop.
- Before diagnosing any CI failure, read the job log via `gh run view <run-id> --log`.
- Say `NO-OP: <reason>` loudly if you cannot finish. A silent exit is treated as success by the
  watcher — that is the worst outcome.

## Context

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it).

The rate hub adds two new tabs — Subcontractors and Suppliers — to the existing
`/settings/reference-data` page (`RatesListsAdminPage`). The Internal-rates tab (existing
`FilterableRateGrid` over `RateTable`) is REUSED without modification.

Vendor types come from a managed `GlobalList` with slug `vendor-types`. No migration per new type —
users add types via the GlobalList admin UI. Today we seed ONLY: GlobalList `vendor-types` → one
item `concrete-cutters` (label "Concrete Cutters") and link the seed subcontractor Cutrite to it.

## Ground first — read these files (cite line numbers)

1. `apps/api/prisma/schema.prisma` — lines 4285–4400 (`SubcontractorSupplier` model),
   lines 3569–3605 (`GlobalList`, `GlobalListItem`), lines 5402–5500 (`RateTable`, `RateColumn`, `RateRow`).
2. `apps/web/src/pages/admin/RatesListsAdminPage.tsx` — understand the existing tab structure.
3. `apps/web/src/pages/directory/SubcontractorRatesTab.tsx` — the per-vendor rate card UI; the hub
   tab is a DIFFERENT view (grouped across all vendors by type), not a copy of this component.
4. `docs/plans/rate-hub-sor-integration-plan.md` — locked decisions §3 (one home per rate).

## What to build

### 1. Schema change
Add to `SubcontractorSupplier` (schema.prisma):
```
vendorTypeId  String?  @map("vendor_type_id")
vendorType    GlobalListItem? @relation("SubcontractorVendorType", fields: [vendorTypeId], references: [id], onDelete: SetNull)
```
Add the back-relation on `GlobalListItem`:
```
subcontractorVendors SubcontractorSupplier[] @relation("SubcontractorVendorType")
```
Run `npx prisma migrate dev --name feat_subcontractor_vendor_type_id` (with `PIPELINE_DB_URL` if
available, or document the migration file only and leave running to CI).

Regenerate the data-model map after migration:
```
node scripts/data-model/build-relationship-map.mjs
```
Commit `docs/data-model/metadata-catalog.json`, `relationship-map.json`, and `relationship-map.md`.

GATE-ALLOW: migrations

### 2. Seed update
In `apps/api/prisma/seed.ts` (or the relevant seed module):
- Upsert a `GlobalList` with slug `vendor-types`, name "Vendor Types", type `STATIC`.
- Upsert one `GlobalListItem`: value `concrete-cutters`, label "Concrete Cutters".
- Find the seed subcontractor named "Cutrite" (or create it if absent) and set its `vendorTypeId`
  to the new item's id.

### 3. API endpoint
Add a GET endpoint in the subcontractors (or rates) module:
```
GET /subcontractors/hub-view
```
Returns vendors grouped by `vendorType.label`, each with their `SubcontractorRate[]` lines.
Shape:
```json
[
  {
    "typeId": "...",
    "typeLabel": "Concrete Cutters",
    "vendors": [
      {
        "id": "...",
        "name": "Cutrite",
        "rates": [ { "id": "...", "discipline": "CIV", "unit": "m", "rate": "42.50", "isActive": true } ]
      }
    ]
  }
]
```
Vendors with no `vendorTypeId` appear in a final "Untyped" group.

### 4. New component
Create `apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx`.
- Fetches `/subcontractors/hub-view`.
- Renders a collapsible group per vendor type.
- Within each group, renders a vendor card with their `SubcontractorRate` rows in a read-only table
  (discipline, unit, rate, validFrom, validTo, isActive).
- Each row has an "Edit" link that navigates to `/directory/subcontractors/<vendorId>` (the vendor
  detail card — write-through, no inline edit here).
- Handles loading, empty states, errors.

### 5. Integrate into RatesListsAdminPage
Add two new tab entries ("Subcontractors", "Suppliers") after the existing Internal-rates tab.
Both render `<VendorRatesTab entityType="subcontractor" />` and `<VendorRatesTab entityType="supplier" />`
respectively (pass `entityType` as a prop to filter by `SubcontractorSupplier.entityType`).

## Do NOT
- Do NOT modify the Internal-rates tab or `FilterableRateGrid`.
- Do NOT copy `SubcontractorRate` data into a new table.
- Do NOT route vendor rates through `RateResolverService`.
- Do NOT seed any vendor types other than concrete-cutters.
- Do NOT create a new vendor type by running a migration — types are GlobalList items.
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx
grep -q "vendorTypeId" apps/api/prisma/schema.prisma
grep -q "vendor-types" apps/api/prisma/seed.ts
grep -q "metadata-catalog" docs/data-model/metadata-catalog.json
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S1 — vendor hub tabs + type grouping on reference-data page`

Leave it UNMERGED.
