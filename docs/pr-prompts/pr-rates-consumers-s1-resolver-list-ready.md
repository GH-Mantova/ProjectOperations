---
premise: '! grep -q "listRates" apps/api/src/modules/rates/rate-resolver.service.ts'
premise_means: >-
  RateResolverService can resolve ONE key (resolveRate) and dump every row of every table
  (enumerateRateSet), but it cannot answer "list the rates for slug X". Six consumers therefore
  read the legacy Estimate*Rate models directly with findMany, which is why SLICE 11c cannot drop
  them.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
done_when: >-
  pnpm build && pnpm lint && grep -q "listRates"
  apps/api/src/modules/rates/rate-resolver.service.ts && grep -q "listRates"
  apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: rates-consumers
cluster_order: 1
---

# Rates consumers SLICE 1 — give the resolver a per-slug list method

This is slice 1 of 4. Together they are what the register calls the
`rates-11b2-a-resolver-consumers` prep, re-shaped after measuring what the consumers actually do
(see the `rates-11c-blocked-consumers` backlog entry). **This slice changes no consumer and no
pricing behaviour — it only adds the method the others need.**

## Why

`resolveRate(slug, keys)` answers one key. `enumerateRateSet()` (`:134`) dumps every active row of
every table as a flat list for snapshotting. Neither serves "give me the rates for `plant`" —
which is what the pick-lists and the persona lookup tool need. Because there is no such method,
six consumers call `prisma.estimate*Rate.findMany` directly, and those calls are the reason the
legacy tables cannot be dropped.

Adding it **once** here is deliberate: three consumers need it, and three separate direct-to-
RateTable implementations would drift apart.

## Do

1. Add `async listRates(tableSlug: string): Promise<ResolvedRate[]>` (or a small dedicated result
   type if `ResolvedRate` does not carry enough — say which you chose and why in the PR body) to
   `RateResolverService`.

2. **It must honour `RATES_CANONICAL_SOURCE` exactly as `resolveRate` does.** Same precedence,
   same fallback, same structured warn on a ratetable miss. Do not invent a second policy — read
   `resolveRate` (`:54`) and mirror it. If the two would diverge, stop and report.

3. **Reuse the existing row-matching logic.** `norm()` (`:455`) is module-private and already
   defines how a cell value is compared. Use it. Do not write a second normaliser.

4. Cover all eight slugs the legacy adapter answers: `labour`, `plant`, `waste`, `cutting`,
   `core-hole`, `fuel`, `enclosure`, `other-rates`. An unknown slug throws, consistent with
   `resolveRate`.

5. Return only **active** rows, ordered stably (the same order twice for the same data) so callers
   can render a pick-list without re-sorting.

6. Tests in the existing spec: one slug returning rows from RateTable; the same slug falling back
   to legacy under the legacy canonical source; an unknown slug throwing; and a stable-ordering
   assertion.

## Do NOT

- Do NOT change `resolveRate`, `assertRateParity`, `enumerateRateSet`, `resolveReferenceValue` or
  `resolveMaterialDensity`. Additive only.
- Do NOT touch any consumer — slices 2, 3 and 4 do that, and they are gated on this landing.
- Do NOT add a write path. The resolver stays read-only; slice 4 handles writes via the service
  that already owns them.
- Do NOT remove or weaken `tryLegacy`. That is 11c's job and it is gated on the parity proof.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint`; API tests green.
- State in the PR body which slugs you tested and what the fallback path did.

## STANDING AUTHORITY

One additive method plus tests. Stop and report rather than widening scope.
