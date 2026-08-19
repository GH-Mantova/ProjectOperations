---
premise: 'grep -qE "prisma\.(estimate[A-Za-z]+Rate|cuttingOtherRate)\." apps/api/src/modules/personas/tools/handlers/lookup-rate.handler.ts apps/api/src/modules/rates/rates-export.service.ts'
premise_means: >-
  The persona rate-lookup tool and the rates export still enumerate the legacy Estimate*Rate models
  directly instead of going through RateResolverService.
scope:
  - apps/api/src/modules/personas/tools/handlers/lookup-rate.handler.ts
  - apps/api/src/modules/personas/tools/handlers/__tests__/**
  - apps/api/src/modules/rates/rates-export.service.ts
  - apps/api/src/modules/rates/__tests__/**
done_when: >-
  pnpm build && pnpm lint && ! grep -qE "prisma\.(estimate[A-Za-z]+Rate|cuttingOtherRate)\."
  apps/api/src/modules/personas/tools/handlers/lookup-rate.handler.ts
  apps/api/src/modules/rates/rates-export.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: rates-consumers
cluster_order: 3
requires_on_main: 'apps/api/src/modules/rates/rate-resolver.service.ts :: listRates'
---

# Rates consumers SLICE 3 — persona lookup tool and rates export

Slice 3 of 4. Gated on slice 1 putting `listRates` on `main`. Independent of slice 2 — different
files, no overlap.

## The call sites (measured on origin/main 9732def7)

`personas/tools/handlers/lookup-rate.handler.ts` — the heaviest consumer: **8 `findMany` across 7
models** (`estimateLabourRate`, `estimatePlantRate`, `estimateWasteRate`, `estimateCuttingRate`,
`estimateCoreHoleRate`, `estimateFuelRate`, `estimateEnclosureRate`, `cuttingOtherRate` ×2) plus 6
`findFirst`.

`rates/rates-export.service.ts` — `estimatePlantRate.findMany`, `estimateWasteRate.findMany`,
`estimateMaterialDensity.findMany`.

## Do

1. **`findMany` → `listRates(slug)`; `findFirst` → `resolveRate(slug, keys)`** where the call is
   really a single-key lookup. Read each site and decide which it is — do not assume from the
   Prisma method name alone.

2. **`estimateMaterialDensity` STAYS.** It is not a `$` rate and it is **not** on the 11c drop
   list — `pr-524` says keep it entirely, `CP-08-seed-idempotency.spec.ts:55,238,266` asserts it,
   and `seed-initial-services.ts:3549-3555` seeds it. Leave that call exactly as it is. If a
   refactor tempts you to route it through the resolver, use `resolveMaterialDensity` only if it
   already fits — otherwise leave it alone and say so.

3. **The export's output format must not change.** Column order, headers, number formatting and row
   order are a user-visible contract. `listRates` returns a stably ordered list; if that order
   differs from the current export order, re-sort at the export site rather than changing
   `listRates`.

4. `lookup-rate.handler.ts` has an existing spec — extend it. `rates-export.service.ts` has none;
   add one asserting the exported shape is unchanged.

## Do NOT

- Do NOT change the persona tool's response schema — an agent depends on it.
- Do NOT change the export file format, headers or ordering.
- Do NOT touch the resolver, the tendering services, or `rates-import.service.ts` (slice 4).
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint`; API tests green.
- **Paste a before/after sample of the export output** (a few rows) into the PR body showing the
  format is byte-identical. If you cannot produce one, say so rather than claiming it.
- State how many call sites you converted and how many you deliberately left, with the reason for
  each one left.

## STANDING AUTHORITY

Read-path migration only, no output-format change. Stop and report rather than widening scope.
