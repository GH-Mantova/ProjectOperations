---
premise: '! grep -rEq "rates/export|exportRates" apps/api/src/modules'
premise_means: There is no rates export endpoint yet.
scope:
  - apps/api/src/modules/rates/**
  - apps/api/src/modules/estimates/**
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - package.json
  - pnpm-lock.yaml
done_when: pnpm build && pnpm lint && grep -rEq "rates/export|exportRates" apps/api/src/modules
size: 8
gate_allow: dependencies
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm ONLY after pr-rates-material-kind has MERGED to main -->
# HOLD — Rates & Lists: Excel EXPORT (round-trip, half 1)

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**.
**ARM ONLY WHEN** `pr-rates-material-kind` has merged to `main` (this export includes the
material `kind` column). Verify `grep -q "enum MaterialKind" apps/api/prisma/schema.prisma`
on `main` before renaming to `pr-rates-export-ready.md`.

Context (Marco, 2026-07-15): build a reusable round-trip. This PR is the EXPORT half — the
live system's rates/lists downloaded as an .xlsx in the agreed format (one tab per surface),
which the user edits and re-imports (import is the next PR). Reference format the tool must
match: the "current system" template already reviewed with Marco (separate tab per surface,
Material Density has a Weight-unit column, waste types are NOT a tab — derived from Waste
Disposal Fees).

## What to build

Branch: `feat/rates-export`. Reviewer: `GH-Mantova`. Dependency: an xlsx writer for the API
(e.g. `exceljs`) — add it, commit the lockfile same commit, put a bare
`GATE-ALLOW: dependencies` line at column 0 of the PR body. No migration.

1. New endpoint `GET /rates/export` (rates module, guarded `rates.manage`) that streams an
   `.xlsx` built from live data, ONE tab per surface:
   - **Waste Disposal Fees** — from `EstimateWasteRate`: Facility, Waste type, Group,
     Charged as (unit), Rate ($). POA/TBC rows export their flag, not $0.
   - **Material Density** — from `EstimateMaterialDensity`: Material, Category, Kind
     (VOLUME/AREA/EACH/FACTOR), Density type, Weight, Weight unit (T for kg/m³ shown ÷1000;
     kg for kg/m²). Mirror the reviewed template exactly.
   - **Plant Rates** — from `EstimatePlantRate` EXCLUDING transport (category `Truck` or
     unit `each way`): Type, Comments, Daily rate ($).
   - **Transport Fees** — the excluded transport rows: Type, Comments, Rate ($).
   Include a hidden/or first `_key` column per row carrying the stable row id so the IMPORT
   PR can match rows deterministically (document the column contract in the PR body).
2. Web: an **Export** button on `RatesListsAdminPage.tsx` that downloads the file.

## Do NOT

- Do NOT build the import side here (next PR `pr-rates-import`).
- Do NOT change any rate data, schema, or the RateTable projection.
- Do NOT call any third party. Pure DB → xlsx.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If `enum MaterialKind` is NOT on `main`, STOP with `NO-OP: predecessor pr-rates-material-kind not merged` — this was armed out of order.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
