---
premise: '! grep -rEq "leaflet|maplibre|MapContainer" apps/web/src'
premise_means: There is no map component anywhere in the web app yet.
scope:
  - apps/web/src/pages/admin/**
  - apps/web/src/components/**
  - package.json
  - pnpm-lock.yaml
done_when: pnpm build && pnpm lint && grep -rEq "leaflet|maplibre" apps/web/src
size: 6
gate_allow: dependencies
seed_only: false
escalates: false
requires_file_on_main:
  - apps/api/src/modules/map-locations/map-locations.module.ts
---
<!-- watcher: do-not-arm | GATED: arm after pr-ops-m1-locations-register has MERGED to main (verify: grep -q "model MapLocation" apps/api/prisma/schema.prisma) -->

# HOLD — Map view inside the Settings "Map locations" tab

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Marco redesigned this 2026-07-20: the map is a
panel **inside the existing Settings > Map locations tab**, NOT a standalone `/ops-map` page.
**ARM ONLY** after `pr-ops-m1-locations-register` has merged (it creates `MapLocation` + the tab).

## What to build (when armed)
Branch: `feat/ops-m1b-map-view`. Reviewer: `GH-Mantova`. No migration. Adds a map library —
bare `GATE-ALLOW: dependencies` at column 0 and commit the lockfile in the same commit.

1. A map panel at the top of the Settings > Map locations tab, rendering every active
   `MapLocation` that has lat/lng as a pin. **The map component MUST be created at exactly
   `apps/web/src/components/LocationsMap.tsx`** — the next slice declares
   `requires_file_on_main` against that path, so the name is a contract.
2. Pin styling by kind and state: TIP with rates = accent pin, TIP with "rates needed" = warning
   pin, POI = pin styled by its category. Include the office/company location if available.
3. Clicking a pin selects that row in the table below; the filter chips (All / Tips / Points of
   interest) filter the pins too. Clicking a row centres the map on its pin.
4. Use a lightweight OSS map (leaflet or maplibre) with a free raster tile source. Do NOT add a
   paid/keyed map provider. Geocoding already happens via `AddressAutocomplete` (Geoapify,
   server-side key) — do NOT geocode here.

## Do NOT
- Do NOT create a top-level `/ops-map` route. Do NOT build the tip finder or any costing
  (that is m2). Do NOT add a map API key or touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- If `model MapLocation` is not on `main`, STOP with `NO-OP: predecessor m1 not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
