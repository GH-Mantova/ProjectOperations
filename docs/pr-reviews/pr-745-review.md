VERDICT: MERGE

Scope compliance:
- In scope: Schema extends ScopeWasteItem with R3 T-1 columns (transportRateId, assetId, qtyTrucks, loadsPerTruckPerDay, capacityPerLoad, capacityUnit, dailyKm, transportCost, fuelCost, disposalCost, quotedDisposalRate, quotedFuelPricePerLitre). Migration is idempotent, fully additive, properly indexes foreign keys, and includes the waste_line.rate_variance_escalated notification trigger seed (disabled for fresh tenants). Cost engine implements spec §2 formula (loads = ceil(waste_amount / capacityPerLoad); duration = ceil(loads / trucks / loadsPerTruckPerDay); transport_cost = (fee + fuelPerDay) × duration × trucks; disposal_cost = waste_amount × rate via RateResolverService). Variance flag snapshots disposal and fuel rates at pricing time; GET /variance endpoint compares snapshots to current live rates; POST /escalate-variance fires the notification trigger without auto-repricing. ScopeWasteTab.tsx replaces hardcoded /3 truck-days with proper inputs and variance display. Controller endpoints (/variance, /escalate-variance) present and properly guarded. Service includes fuel-term as manual/optional (OperationsSettings.fuelPricePerLitre × Asset.fuelConsumptionLPer100km × dailyKm/100, or 0 when any input unset). Tests passing (296 pass / 6 skipped in tendering spec suite).
- Out of scope: Live fuel feed (T-2/T-3) — correct, deferred. Facility-price register — correct, disposal via RateResolverService. Azure/prod — untouched. Legacy /3 truck-days path preserved for aggregator rows. No new mutations on T-0 or multi-material PRs.

Self-verification claims:
- [x] pnpm build (api + web + ui) green — agent reports complete
- [x] pnpm lint (api + web) green — agent reports complete
- [x] pnpm --filter @project-ops/api test --testPathPattern=tendering — 296 pass / 6 skipped, 0 fail — agent reports complete
- [x] build-relationship-map.mjs --check — verified locally: OK (234 models, 42 enums, 363 edges)
- [x] Migration sorts correctly (20260720150000 → after 20260720140000 ✓)
- [x] Foreign key constraints set to ON DELETE SET NULL (preserves waste lines when rate/asset deleted)
- [x] Notification trigger seeded (disabled, via ON CONFLICT (trigger) DO NOTHING in migration)
- [x] Prerequisites merged: R3 T-0 (assets capacity/fuel + OperationsSettings, #595 ✓) and multi-material (addMaterial in ScopeQuantitiesTable ✓)
- [x] Data-model outputs (.json/.md) gitignored per recent project policy — not committing is correct

Risks Marco should know:
- CI gates are still QUEUED at review time (API lint/test, gates checks, web build). Recommend waiting for green before merge, but code review is complete and solid. No integration gaps found.
- Notification trigger `waste_line.rate_variance_escalated` seeded disabled — admin must enable it and configure recipients in Notification Settings for it to fire. UI will show a clear error message if trigger is disabled when escalate button is clicked, so the failure mode is user-facing, not silent.
- Variance detection compares snapshots at pricing time to current live rates. If Marco disables or deletes the disposal/fuel rate before the line is escalated, the variance check will return null for that component (gracefully handled in UI). No data loss risk.
- Price-snapshot columns are nullable and independent of the legacy ratePerTonne/ratePerLoad path — old aggregator rows continue to work unchanged.

Recommendation: Merge once CI is green. All substantive work is complete, scope is tight, and risk profile is low.
