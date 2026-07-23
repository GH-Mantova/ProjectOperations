---
premise: '! grep -q "defaultWasteGroup" apps/api/prisma/schema.prisma'
premise_means: Materials carry no default waste classification yet — users still hand-pick waste group/item per material row in the scope card.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/estimates/**
  - apps/web/src/pages/EstimateRatesAdminPage.tsx
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "defaultWasteGroup" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---

# Scope card materials: derive waste group/item from the material — stop asking the user

Marco (2026-07-23, ERP review): *"inside the scope card, in material, waste group and waste item
is not needed as this is auto-populated in waste disposal card based of the material."*

Reality check: the waste disposal card's "Sum from above" aggregator groups by the
(wasteGroup, wasteItem) values the user typed on EACH material row — there is no material→waste
mapping anywhere. This PR creates that mapping so the per-material pickers can go.

Branch: `feat/scope-material-waste-autofill`. Reviewer: `GH-Mantova`. Migration: YES — additive.
Bare `GATE-ALLOW: migrations` at column 0 of the PR body.

## What to build

1. Schema: add nullable `defaultWasteGroup` + `defaultWasteItem` columns to
   `EstimateMaterialDensity`. Additive migration only.
2. Admin: expose both columns in the Material Densities table on
   `apps/web/src/pages/EstimateRatesAdminPage.tsx` (and its API DTOs under
   `apps/api/src/modules/estimates/**`) so Marco can maintain the mapping. Options for the two
   fields come from the active `EstimateWasteRate` rows (wasteGroup / wasteType), same source the
   scope card uses today.
3. Scope card (`ScopeQuantitiesTable.tsx`): when a material is selected (row 1 or any
   materials[] entry), auto-set that row's `wasteGroup`/`wasteItem` from the density catalog's
   defaults and REMOVE the two visible pickers from the material row. The values are still
   WRITTEN to the item/material exactly as today — the `sumFromAbove` aggregator must not change.
   `wasteIncluded` / `cuttingIncluded` checkboxes stay.
4. Fallback: if the selected material has no defaults yet, show the two pickers for that row
   only (amber hint "no default waste mapping for this material — set one in Rates & Lists").
   Never silently drop a row from waste aggregation.
5. Changing a material re-derives the defaults; a user-visible fallback value the user set by
   hand is preserved if the new material has no mapping.

## Schema change → REGENERATE the data-model map (MANDATORY)
After editing `apps/api/prisma/schema.prisma`, run
`node scripts/data-model/build-relationship-map.mjs` and COMMIT the regenerated
`docs/data-model/*` artifacts, or the CI drift check FAILS.

## Do NOT
- Do NOT touch `scope-waste.service.ts` / the aggregator contract.
- Do NOT backfill existing scope items (their stored wasteGroup/wasteItem stay as entered).
- Do NOT remove the flat wasteGroup/wasteItem columns from ScopeOfWorksItem or the materials JSON
  shape — the UI stops SHOWING pickers; the data contract is unchanged.
- Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Update the affected unit specs in the same PR (service spec `toHaveBeenCalledWith` payloads).
- If size would exceed 10 files, split (schema+admin / scope-card UI) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
