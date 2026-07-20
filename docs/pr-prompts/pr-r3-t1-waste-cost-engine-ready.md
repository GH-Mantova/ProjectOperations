---
premise: '! grep -q "transportRateId" apps/api/prisma/schema.prisma'
premise_means: The waste line has no transport-item / trucks / duration cost engine yet (still the hardcoded /3 truck-days).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/**
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
done_when: pnpm build && pnpm lint && grep -q "transportRateId" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
# R3 T-1: waste transport cost engine (Raj R3, core)

STATUS: ARMED - RUN NOW.
(`docs/architecture/drafts/waste-transport-cost-engine-DRAFT.md`, §2 formula).
**ARM ONLY** after `pr-r3-t0-transport-capacity-fuel` (capacity/fuel fields + OperationsSettings)
AND `pr-scope-multi-material` (so "sum from above" can total the material rows) have merged.
Verify on `main`: `grep -q "fuelConsumptionLPer100km" apps/api/prisma/schema.prisma` AND
`grep -q "addMaterial" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`.

## What to build

Branch: `feat/r3-t1-waste-cost-engine`. Reviewer: `GH-Mantova`. Migration: YES — additive
nullable columns. Bare `GATE-ALLOW: migrations` at column 0.

1. Schema — extend `ScopeWasteItem` with nullable: `transportRateId` (ref to the Transport
   Fees `EstimatePlantRate` row = the $/day fee), `assetId` (ref to the `Asset` = capacity +
   fuel-consumption source; default from the asset's `AssetCategory`), `qtyTrucks Int?`,
   `loadsPerTruckPerDay Decimal(4,1)?`, `capacityPerLoad Decimal(8,2)?` (default PULLED from the
   authoritative Transport Capacity table for the line's material × transport; a per-line override
   wins LOCALLY and does NOT write back to the table; table changes PUSH to non-overridden lines —
   Marco 2026-07-15; Asset.nominalLoadTonnes is the fallback), `capacityUnit String?` (t|m³), snapshot cost components
   `transportCost`, `fuelCost`, `disposalCost` (Decimal(12,2)?) folded into `lineTotal`, and
   the price snapshots the variance flag needs: `quotedDisposalRate Decimal(10,2)?`,
   `quotedFuelPricePerLitre Decimal(6,3)?` (the rates as they were when this line was priced).
2. Cost engine (a service in the tendering module) implementing spec §2:
   - `waste_amount` = manual OR summed from the item's material rows (R1 `materials`).
   - `loads = ceil(waste_amount / capacityPerLoad)`.
   - `duration_days = ceil(loads / qtyTrucks / loadsPerTruckPerDay)`.
   - `transport_cost = (transportFeePerDay + fuelCostPerDay) × duration_days × qtyTrucks`.
   - `disposal_cost = waste_amount × disposalRate` (resolve via `RateResolverService` /
     `EstimateWasteRate` for facility × waste type — the single price source, decision 1).
   - `line_total = transport_cost + disposal_cost`.
   **Fuel term this slice = MANUAL/optional**: use `OperationsSettings.fuelPricePerLitre`
   (from T-0) × the transport row's `fuelConsumptionLPer100km` × a manual daily-km field, OR
   0 if unset. The LIVE fuelpricesqld feed and map-derived km are later slices (T-2/T-3) —
   do not build them here.
3. `ScopeWasteTab.tsx` — replace the hardcoded `/3` truck-days block with inputs for
   transport item (picker from Transport Fees rows), qtyTrucks, loadsPerTruckPerDay,
   capacityPerLoad (default from the transport row's capacity, editable), and show the
   computed loads / duration / transport / disposal / line total. "Sum from above" reads the
   material rows.

4. **Price-variance flag + escalation (Marco 2026-07-15):** when a line is priced, snapshot the
   disposal rate and fuel price into `quotedDisposalRate` / `quotedFuelPricePerLitre`. When the
   line is later viewed and the CURRENT live rate (via `RateResolverService` for disposal, and
   `OperationsSettings.fuelPricePerLitre` for fuel) differs from the snapshot, show a **visible
   variance flag** on the line (e.g. "disposal rate changed $X→$Y since quoted") and an
   **"Escalate for confirmation"** action that routes to the responsible role
   (Estimator / PM / Ops Manager) — reuse the existing notification-trigger machinery
   (`NotificationTriggerConfig` + `Notification`), do not invent a new mechanism. Do NOT
   auto-reprice; the human confirms.

## Do NOT

- Do NOT build the live fuel feed or any map/distance call (T-2/T-3).
- Do NOT read a separate facility-price register — disposal price comes from the rate tables
  via `RateResolverService` (decision 1). No `WasteFacilityPrice`.
- Do NOT touch Azure/prod. If size would exceed 10 files, split (schema+engine / web) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Schema change → REGENERATE the data-model map (MANDATORY)

After editing `apps/api/prisma/schema.prisma`, run `node scripts/data-model/build-relationship-map.mjs`
and COMMIT the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`, and
`metadata-catalog.json`. The CI **data-model drift check** (`build-relationship-map.mjs --check`)
FAILS otherwise — that is exactly what red-flagged #593. `docs/data-model/**` is in scope.

## Guardrails

- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If either predecessor is missing on `main`, STOP with `NO-OP: predecessor(s) not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
