---
premise: '! grep -q "model WasteFacility" apps/api/prisma/schema.prisma'
premise_means: The waste-facility geo register does not exist yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/waste-facilities/**
  - apps/api/src/common/permissions/**
  - apps/api/prisma/seed-reference.ts
  - apps/web/src/pages/ops/**
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -q "model WasteFacility" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-r3-t0-transport-capacity-fuel MERGED (OperationsSettings exists). Geoapify keys already in Azure. -->
# HOLD — Ops-Map M-1: waste-facility register + geocoding

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Slice M-1 of the locked design
`docs/architecture/drafts/ops-map-waste-facilities-DRAFT.md` — **read §1.3, §2.1, §2.4, §2.7,
§4.1, §5 (M-1) before coding**. Rebased per the 2026-07-15 decisions in
`waste-transport-cost-engine-DRAFT.md`: **single price source = the rate tables; the ops-map's
own `WasteFacilityPrice` register is DROPPED** — facility disposal prices come from
`EstimateWasteRate` via `RateResolverService`, never a parallel register.
**ARM ONLY** after `pr-r3-t0-transport-capacity-fuel` merged (this extends its
`OperationsSettings` singleton). Geoapify key + backup are already in Azure.

## What to build

Branch: `feat/ops-m1-facility-register`. Reviewer: `GH-Mantova`. Migration: YES — additive.
Bare `GATE-ALLOW: migrations` at column 0.

1. `WasteFacility` model (draft §2.1): name, address fields, `latitude`/`longitude Decimal(9,6)?`,
   `openHours?`, `notes?`, `isActive`, `pricesReviewedAt?`, timestamps. **Do NOT create
   `WasteFacilityPrice`** (decision 1). `WasteFacility.name` MUST equal the
   `EstimateWasteRate.facility` value space (bound picker, no free text — the join key, §7-4).
2. New `waste-facilities` module — sole writer; facility register CRUD guarded by a new
   `waste.manage` permission; read guarded by `waste.view` (register both in
   `permission-registry.ts`, seed to appropriate roles).
3. Nominatim geocode-on-save (draft §2.7 #2): server-side only, cache, honour usage policy, and
   on failure save without coordinates + a visible "needs geocoding" flag + a manual lat/lng
   override field.
4. Extend the `OperationsSettings` singleton (created by T-0) with office address +
   `officeLatitude`/`officeLongitude Decimal(9,6)?` (geocoded on save). If T-0's singleton is
   somehow absent on main, STOP (arm order wrong).
5. Seed 3–5 real SEQ facilities with names matching existing `EstimateWasteRate.facility` values
   (idempotent, stable ids — CLAUDE.md seed rules).
6. Web: a facility register admin page under `apps/web/src/pages/ops/` (list + create/edit),
   guarded `waste.manage`.

## Do NOT
- Do NOT create `WasteFacilityPrice` or any facility price column — prices live in the rate tables.
- Do NOT build the map page (M-1b) or the finder (M-2) here.
- Do NOT call any third party from the browser. Do NOT touch Azure/prod.

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
- If size would exceed 10 files, split (model+module / geocode / web) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
