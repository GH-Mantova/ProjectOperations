---
premise: '! grep -q "ops-map" apps/web/src/App.tsx'
premise_means: There is no Ops-Map page/route yet.
scope:
  - apps/web/src/pages/ops/**
  - apps/web/src/App.tsx
  - apps/web/src/components/ShellLayout.tsx
  - apps/api/src/modules/waste-facilities/**
  - package.json
  - pnpm-lock.yaml
done_when: pnpm build && pnpm lint && grep -q "ops-map" apps/web/src/App.tsx
size: 8
gate_allow: dependencies
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-ops-m1-facility-register MERGED. Geoapify keys already in Azure. -->
# HOLD — Ops-Map M-1b: the map page

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. The map canvas of slice M-1 (split out for size).
Read `ops-map-waste-facilities-DRAFT.md` §1.2 (mockup is the contract), §4.2 (Operations nav),
§5 (M-1), decision 12 (Geoapify primary → MapTiler fallback), and the mockup
`docs/design/mockups/site-map-tipfinder-mockup.html`. **ARM ONLY** after
`pr-ops-m1-facility-register` merged (needs `WasteFacility` + office coords). Geoapify key +
backup are already in Azure.

## What to build
Branch: `feat/ops-m1b-map-page`. Reviewer: `GH-Mantova`. Dependency: Leaflet (single `pnpm add`,
lockfile same commit). Bare `GATE-ALLOW: dependencies` at column 0. No migration.

1. A `/ops-map` page (route in `App.tsx`) rendering a Leaflet map on **Geoapify** tiles. Resolve
   the key server-side via `resolveIntegrationKey('geoapify')` if `pr-integration-keys-settings`
   is on main, else read `GEOAPIFY_KEY` from config (already in Azure) — always through a thin
   API-side config endpoint, never exposing the raw key to the browser. Graceful fallback to plain
   OSM tiles / plain background if tiles fail — pins still render.
2. Layers (mockup L52-60): **job sites** (active `Project.siteAddress*` + the `Site` register),
   **office** (`OperationsSettings` office coords), **waste facilities** (`WasteFacility`).
   Read-only map-layers endpoint(s) in the `waste-facilities` module returning the pins.
   Workers/live-vehicles layers are later phases — not here.
3. Nav item in the **Operations** group (`ShellLayout.tsx` NAV_GROUPS), beside Sites (§4.2).
4. **No finder panel** (that is M-2) and **no routing/geocoding-at-request** — pins from stored
   coordinates only.

## Do NOT
- Do NOT add the tip-finder, costing, or `TipRecommendationLog` (M-2).
- Do NOT call Geoapify from anywhere that leaks the key to the browser without the config
  endpoint pattern. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If `WasteFacility` is not on `main`, STOP with `NO-OP: predecessor pr-ops-m1 not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
