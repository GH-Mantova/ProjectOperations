---
premise: '! grep -q "model TipRecommendationLog" apps/api/prisma/schema.prisma'
premise_means: The tip finder + recommendation log do not exist yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/waste-facilities/**
  - apps/web/src/pages/ops/**
done_when: pnpm build && pnpm lint && grep -q "model TipRecommendationLog" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-ops-m1b-map-page AND pr-r3-t0-transport-capacity-fuel MERGED -->
# HOLD — Ops-Map M-2: tip finder + v1 costing + recommendation log

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Slice M-2. Read
`ops-map-waste-facilities-DRAFT.md` §2.3, §3 (costing v1), §5 (M-2), decision 7 (waste types
from the resolver) and decision 8 (Asset-backed load selector), and the reconciliation
`waste-transport-cost-engine-DRAFT.md` decision 1. **ARM ONLY** after `pr-ops-m1b-map-page`
(map + facilities) and `pr-r3-t0-transport-capacity-fuel` (`Asset.nominalLoadTonnes`) merged.

## What to build
Branch: `feat/ops-m2-tip-finder`. Reviewer: `GH-Mantova`. Migration: YES — additive. Bare
`GATE-ALLOW: migrations` at column 0.

1. Finder panel on `/ops-map` (mockup L82-99): three inputs — waste type (**sourced via
   `RateResolverService` / the RateTable projection — decision 7/1, never a hardcoded list**),
   load size (**from `Asset` / `AssetCategory` truck-tipper records + `nominalLoadTonnes` — decision
   8**), and "coming from" (an active Project site or the office `OperationsSettings` coords).
2. v1 costing (draft §3): for every facility that **accepts** the waste type (= has an
   `EstimateWasteRate` row for that facility × waste type, resolved via the resolver — **no
   `WasteFacilityPrice`**), `total = disposalFee + travel`, where `disposalFee = tonnes ×
   resolved rate` and `travel = haversine_km × 2 × OperationsSettings.travelRatePerKm`.
   Facilities with no matching rate render greyed "not accepted" (mockup L111-112). Show the
   working on each ranked card. (v2 routing + v3 fuel are later — not here.)
3. `TipRecommendationLog` (draft §2.3): append-only; on "use this facility" write a row
   snapshotting facility, wasteTypeCode, loadTonnes, projectId/originType, distanceKm, and the
   three cost components (snapshot — prices change, history must not). Restrict FKs per §2.3.
4. Endpoints `POST /waste/recommendations` (compute) and `POST /waste/recommendations/accept`
   (write log), guarded `waste.view`.

## Do NOT
- Do NOT create/read `WasteFacilityPrice` — disposal price via the resolver only (decision 1).
- Do NOT build v2 OSRM routing or v3 fuel costing, the worker layer, or the tipping tab / price
  reminder (that is M-2b). Do NOT touch Azure/prod.

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
- If a predecessor is missing on `main`, STOP with `NO-OP: predecessor(s) not merged`.
- If size would exceed 10 files, split (schema+API / web finder) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
