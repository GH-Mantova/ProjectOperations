---
premise: '! grep -q "model TipRecommendationLog" apps/api/prisma/schema.prisma'
premise_means: The tip finder + recommendation log do not exist yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/map-locations/**
  - apps/web/src/pages/admin/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model TipRecommendationLog" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
requires_file_on_main:
  - apps/web/src/components/LocationsMap.tsx
---
<!-- watcher: do-not-arm | GATED: arm after pr-ops-m1b-map-page has MERGED to main (verify: grep -rEq "leaflet|maplibre" apps/web/src) -->

# HOLD — Tip finder + v1 costing + recommendation log

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Redesigned 2026-07-20: facilities now come from the
`MapLocation` register (kind = TIP), and the finder is a panel in the **Settings > Map locations
tab**, NOT a standalone `/ops-map` page. **ARM ONLY** after `pr-ops-m1b-map-page` has merged.

## What to build (when armed)
Branch: `feat/ops-m2-tip-finder`. Reviewer: `GH-Mantova`. Migration: YES - additive. Bare
`GATE-ALLOW: migrations` at column 0.

1. Finder panel in the Settings > Map locations tab: three inputs — waste type (sourced via
   `RateResolverService` / the RateTable projection, never a hardcoded list), load size (from
   `Asset` / `AssetCategory` truck-tipper records + `nominalLoadTonnes`), and "coming from"
   (an active Project site, or the office coords).
2. v1 costing: for every TIP `MapLocation` that **accepts** the waste type (= has an
   `EstimateWasteRate` row for that `facility` x waste type, resolved via the resolver — there is
   no `WasteFacilityPrice`), `total = disposalFee + travel`, where
   `disposalFee = tonnes x resolved rate` and
   `travel = haversine_km x 2 x OperationsSettings.travelRatePerKm` (haversine from the
   MapLocation lat/lng). TIPs flagged "rates needed" (zero rate rows) render greyed as
   "not accepted". Show the working on each ranked card.
3. `TipRecommendationLog`: append-only; on "use this facility" write a row snapshotting the
   MapLocation, wasteTypeCode, loadTonnes, projectId/originType, distanceKm and the cost
   components (prices change; history must not).
4. Endpoints `POST /waste/recommendations` (compute) and `POST /waste/recommendations/accept`
   (write log), guarded by an existing registered permission code. **The service MUST be created
   at exactly `apps/api/src/modules/map-locations/tip-recommendations.service.ts`** — the next
   slice declares `requires_file_on_main` against that path, so the name is a contract.

## Do NOT
- Do NOT create/read `WasteFacilityPrice` — disposal price via the resolver only.
- Do NOT build v2 OSRM routing or v3 fuel costing, or the tipping tab / price reminder (m2b).
- Do NOT create a top-level `/ops-map` route. Do NOT touch Azure/prod.
- FOLLOW-UP (not this PR): surfacing this finder from the tender waste row's facility picker.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking for permission is indistinguishable from failing.

## Schema change → REGENERATE the data-model map (MANDATORY)
After editing `apps/api/prisma/schema.prisma`, run `node scripts/data-model/build-relationship-map.mjs`
and COMMIT the regenerated `docs/data-model/*` artifacts, or the CI drift check FAILS.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- If `model MapLocation` is not on `main`, STOP with `NO-OP: predecessor not merged`.
- If size would exceed 10 files, split (schema+API / web finder) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
