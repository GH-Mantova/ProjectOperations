---
premise: '! grep -q "providesRates" apps/api/prisma/schema.prisma'
premise_means: SubcontractorSupplier has no providesRates capability flag yet, so the two new hub tabs (Subcontractors / Suppliers) cannot filter vendors correctly.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/rates/rate-hub-vendors.service.ts
  - apps/api/src/modules/rates/rate-hub-vendors.controller.ts
  - apps/api/src/modules/rates/__tests__/rate-hub-vendors.service.spec.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/api/prisma/seed/**
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "providesRates" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/rates/rate-hub-vendors.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: false
backfill: false
rollback_strategy: additive migration (adds nullable typeId + providesRates bool with default false); safe to leave on main, re-run drops nothing. Forward-only.
---

# RATE-HUB S1 — hub tabs + type grouping + `providesRates` capability

Extend `/settings/reference-data` with two new top tabs — **Subcontractors** and
**Suppliers** — grouped by a managed type. Both tabs are read-through VIEWS over
the ONE `SubcontractorSupplier` store; **not a second copy of vendor rates.**
Full plan + ground citations: `docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/prisma/schema.prisma:4278` — `SubcontractorSupplier` (add fields here).
- `apps/api/prisma/schema.prisma:4353` — `SubcontractorRate` (append-only cards; RC-1/RC-2).
- `apps/api/prisma/schema.prisma:3568`, `:3585` — `GlobalList` / `GlobalListItem` (managed lists).
- `apps/web/src/pages/admin/RatesListsAdminPage.tsx:77` (top tabs today: `rates` | `lists`, line 75) — extend, do NOT fork.

## What to build

### Schema (additive)
1. `SubcontractorSupplier.providesRates Boolean @default(false) @map("provides_rates")`.
2. `SubcontractorSupplier.typeId String? @map("type_id")` — FK-by-value to a
   `GlobalListItem` under the managed list slug `subcontractor-supplier-type`
   (validated at DTO layer; kept as plain nullable String so new types are
   list edits, NOT migrations).
3. Additive migration under `apps/api/prisma/migrations/**`. **No** data
   transformation. `backfill: false` (existing rows default `providesRates=false`
   and `typeId=null`; both hub tabs simply show them ungrouped under "Uncategorised"
   until an admin classifies them).
4. Regenerate + commit the data-model map:
   `node scripts/data-model/build-relationship-map.mjs` — commit the resulting
   `docs/data-model/relationship-map.json`, `relationship-map.md`, and
   `metadata-catalog.json`. CI drift check hard-fails otherwise (sank #593).

### Seed / bootstrap
5. Ensure the managed `GlobalList` with slug `subcontractor-supplier-type` exists
   (create if missing). Add ONE `GlobalListItem` today: `value=concrete-cutters`,
   `label="Concrete cutters"`. Do NOT pre-create trucks/waste, asbestos, etc.

### API (read-only for this slice)
6. New `RateHubVendorsService` at
   `apps/api/src/modules/rates/rate-hub-vendors.service.ts` with
   `listGrouped({ providesRates: boolean })` returning:
   `{ groups: [{ typeId, typeLabel, vendors: [{ id, name, activeRates: SubcontractorRate[] }] }], uncategorised: [...] }`.
   Active-rate filter = `isActive: true`. Ordering: type label alpha, vendor name alpha.
7. Controller at `apps/api/src/modules/rates/rate-hub-vendors.controller.ts`
   exposing `GET /rates-hub/vendors?providesRates=true|false`. Wire into
   `apps/api/src/modules/rates/rates.module.ts`.
8. Unit spec at
   `apps/api/src/modules/rates/__tests__/rate-hub-vendors.service.spec.ts`
   covering: `providesRates` filter, grouping by `typeId`, `uncategorised`
   bucket, active-rate filter, ordering.

### Web
9. Extend `apps/web/src/pages/admin/RatesListsAdminPage.tsx` to add two top
   tabs — **Subcontractors** and **Suppliers** — alongside the existing
   `rates` / `lists`. Each renders a grouped-by-type collapsible list. Each
   row links out to the existing vendor card (RC-1/RC-2). **No in-line rate
   editing in this slice** — the vendor card remains the sole edit surface.

## GATE-ALLOW: migrations

## Do NOT
- Duplicate a vendor's `SubcontractorRate` rows into the hub. The tab is a VIEW.
- Route subbie/supplier rates through `RateResolverService` — explicit opt-in only.
- Add UI to edit rates from the hub tab (that's the vendor card's job).
- Pre-create other type items (trucks/waste, asbestos, hygienists…) — Marco adds them via the managed list as they become real.
- Rebuild `RateTable` / `RateColumn` / `RateRow` — extend, do not fork.
- Edit `/sot/`. Do not use `requires_merged` with guessed PR numbers.

## VERIFY
- `pnpm build && pnpm lint`
- `grep -q "providesRates" apps/api/prisma/schema.prisma`
- `test -f apps/api/src/modules/rates/rate-hub-vendors.service.ts`
- data-model map is regenerated and committed (no CI drift-check red).

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
