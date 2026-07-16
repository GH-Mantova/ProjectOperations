---
premise: '! grep -q "model AssetCheckout" apps/api/prisma/schema.prisma'
premise_means: Assets have no barcode/QR tag, no check-out/custody log, and no reservations.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/assets/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model AssetCheckout" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap B/asset | barcode/QR + check-out custody (+ reservations) -->
# ERP gap — asset barcode/QR + check-out custody (+ reservations)

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING assets module (Asset has `serialNumber` only —
no tag/custody/reservation). Retires the Jotform key-checkout form into the asset record. AssetTiger parity.

## What to build
Branch: `feat/erp-asset-barcode-checkout`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — add `barcode`/`qrValue` to `Asset` (or an `AssetTag` model); `AssetCheckout` (assetId, custody
   holder workerId/userId or siteId/jobId, checkedOutAt, dueBackAt?, checkedInAt?, notes) for the custody
   chain; and `AssetReservation` (assetId, jobId?, fromAt, toAt, reservedById, status) to forward-book plant/
   tools. Prevent double-booking on overlapping reservations.
2. API in `assets` — check-out / check-in endpoints, custody history, reservation CRUD + clash check; a
   barcode/QR lookup endpoint (scan -> asset).
3. Web — check-out/in actions + custody history on the asset page; a "reserve" action; show/generate the QR.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT build depreciation here (separate decision-gated prompt). If barcode+checkout+reservations exceed
  10 files, ship barcode+checkout first and note reservations as a follow-up. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
