---
premise: '! grep -q "FACTOR" apps/web/src/pages/tendering/scopeItemDimensions.ts'
premise_means: The Scope-of-Works calc has no EACH/FACTOR branch yet (only volumetric + area).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/**
  - apps/web/src/pages/tendering/scopeItemDimensions.ts
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
done_when: pnpm build && pnpm lint && grep -q "FACTOR" apps/web/src/pages/tendering/scopeItemDimensions.ts && grep -q "FACTOR" apps/api/src/modules/tendering/scope-item-dimensions.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm ONLY after BOTH pr-rates-material-kind AND pr-scope-multi-material have MERGED to main -->
# HOLD — Scope of Works: EACH (quantity) + FACTOR (sqm x factor) material kinds

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**.
**ARM ONLY WHEN** both `pr-rates-material-kind` (adds the `kind` enum) AND
`pr-scope-multi-material` (adds the repeatable `materials` rows) have merged to `main`.
Verify on `main`: `grep -q "enum MaterialKind" apps/api/prisma/schema.prisma` AND
`grep -q "addMaterial" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`.

Context (Marco + Raj, 2026-07-15): today the calc has two paths — volumetric
(TONNES = m³ × density) and area (TONNES = sqm × density ÷ 1000). Add two kinds:
- **EACH** (per-item): show a Quantity input; TONNES = quantity × per-item-weight. Per-item
  weight is stored in kg (like kg/m³), so TONNES = qty × (weight ÷ 1000). Final unit tonnes.
- **FACTOR** (Raj's "Factor multiply"): user enters a factor; TONNES = sqm × factor (no ÷1000).

The calc helper `computeDerivedDimensions` is DUPLICATED — `apps/web/.../scopeItemDimensions.ts`
and `apps/api/.../scope-item-dimensions.ts`. **Both must change identically.**

## What to build

Branch: `feat/scope-each-factor`. Reviewer: `GH-Mantova`. Migration: YES — additive nullable
fields on the material row. Bare `GATE-ALLOW: migrations` at column 0 of the PR body.

1. Data: the repeating material row (the `materials` JSON from `pr-scope-multi-material`)
   gains `kind` (from the selected material's `EstimateMaterialDensity.kind`), plus
   `quantity` (EACH) and `factor` (FACTOR). If any flat scalar column is needed on
   `ScopeOfWorksItem` for row 1 parity, add nullable `quantity`/`factor` there too.
2. Calc — in BOTH mirrors, branch `computeDerivedDimensions` on `kind`:
   - VOLUME → TONNES = m³ × density (unchanged).
   - AREA → TONNES = sqm × density ÷ 1000 (unchanged).
   - EACH → TONNES = quantity × (perItemWeightKg ÷ 1000); sqm/m³ not required.
   - FACTOR → TONNES = sqm × factor.
   Keep explicit user overrides winning, same as today.
3. UI — `ScopeQuantitiesTable.tsx`: when the selected material's kind is EACH, show a
   Quantity box; when FACTOR, show a Factor input (reuse/relabel the density cell per kind).
   The material `onChange` sets `kind` from the lookup and shows the right inputs.
4. DTO/service pass-through for the new fields (backend stays identity — no re-derive).

## Do NOT

- Do NOT change the VOLUME/AREA formulas or the density kg↔t bridge.
- Do NOT edit only one calc mirror — both, identically, or the preview diverges from persisted.
- Do NOT touch waste/plant/import. Do NOT touch Azure/prod.

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
