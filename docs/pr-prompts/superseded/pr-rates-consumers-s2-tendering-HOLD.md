---
premise: 'grep -qE "prisma\.(estimate(Labour|Plant|Waste|Cutting|CoreHole)Rate|cuttingOtherRate)\." apps/api/src/modules/tendering/scope-of-works.service.ts apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: >-
  The two tendering estimating services still read the legacy Estimate*Rate models directly instead
  of going through RateResolverService.
scope:
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/**
done_when: >-
  pnpm build && pnpm lint && ! grep -qE
  "prisma\.(estimate(Labour|Plant|Waste|Cutting|CoreHole)Rate|cuttingOtherRate)\."
  apps/api/src/modules/tendering/scope-of-works.service.ts
  apps/api/src/modules/tendering/scope-redesign.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: rates-consumers
cluster_order: 2
requires_merged: 1238
---

# Rates consumers SLICE 2 — route the tendering services through the resolver

Slice 2 of 4. Gated on slice 1 putting `listRates` on `main`.

**This is a pricing path. It must produce identical numbers.** The whole point is that nothing a
user sees changes.

## The call sites (measured on origin/main 9732def7)

`scope-of-works.service.ts` — single-key lookups: `estimateLabourRate.findUnique`,
`estimatePlantRate.findUnique`, `estimateWasteRate.findUnique`, `estimateWasteRate.findFirst`,
`estimateCuttingRate.findFirst`, `estimateCoreHoleRate.findUnique`. Pick-lists:
`estimateLabourRate.findMany`, `estimatePlantRate.findMany` ×2.

`scope-redesign.service.ts` — `estimateCuttingRate.findFirst` ×4, `estimateCoreHoleRate.findFirst`,
`cuttingOtherRate.findUnique`, `estimateLabourRate.findMany`, `estimatePlantRate.findMany`.

## Do

1. **Single-key lookups → `resolveRate(slug, keys)`.** Map each one to the slug its keys belong to:
   `labour`, `plant`, `waste`, `cutting`, `core-hole`, `other-rates`. The key shapes are defined by
   `tryLegacy` in `rate-resolver.service.ts` (`:375` onward) — read it and match them exactly.
2. **`findMany` pick-lists → `listRates(slug)`** from slice 1.
3. **Preserve the not-found behaviour at every site.** Some call sites today get `null` from
   `findUnique` and handle it; `resolveRate` **throws** `NotFoundException`. Do not let a
   previously-tolerated missing rate become a 404 for the user. Where the old code tolerated a
   miss, keep tolerating it — catch and fall back to exactly what it did before.
4. **Leave the write calls alone.** `estimateItem.create`, `estimateLabourLine.create`,
   `estimateCuttingLine.create` ×2, `estimateWasteLine.create`, `estimatePlantLine.create` write to
   **line and item tables, not rate tables.** None are on the 11c drop list. Do not touch them.
5. Neither service has a spec today. Add tests covering: one lookup per slug used, one pick-list,
   and the tolerated-miss path from step 3.

## Do NOT

- Do NOT change any produced number, rounding, unit or fallback order. If a refactor would change
  a price, stop and report instead.
- Do NOT touch `apps/web/**`, the resolver, or the other consumers.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint`; full API suite green.
- **Prove the numbers did not move.** For at least one estimate per slug touched, record the
  computed value before and after and paste both into the PR body. If you cannot construct a
  before/after comparison, say so plainly rather than asserting equivalence.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

The lines below are a SCOPE limit, not permission to stop before pushing. Both apply.

Read-path migration only, no behaviour change. Stop and report rather than widening scope.
