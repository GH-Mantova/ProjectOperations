---
premise: 'grep -qE "prisma\.estimate(Plant|Waste)Rate\.(update|upsert)" apps/api/src/modules/rates/rates-import.service.ts'
premise_means: >-
  The rates import still writes directly into the legacy estimate_plant_rates and
  estimate_waste_rates tables, so those tables cannot be dropped no matter what the read path does.
scope:
  - apps/api/src/modules/rates/rates-import.service.ts
  - apps/api/src/modules/rates/__tests__/**
done_when: >-
  pnpm build && pnpm lint && ! grep -qE "prisma\.estimate(Plant|Waste)Rate\.(update|upsert)"
  apps/api/src/modules/rates/rates-import.service.ts && grep -q "estimateMaterialDensity"
  apps/api/src/modules/rates/rates-import.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# Rates consumers SLICE 4 — the import write path ⚠️ WRITES RATE DATA ⚠️

The fourth of the four consumer slices, but **deliberately NOT part of the `rates-consumers`
cluster** — it needs no new resolver method, because the resolver is read-only and must stay that
way. It has no dependency on slices 1–3 and can be armed at any time, before or after them. The
linter rejected an earlier draft that declared `cluster_order: 4` with nothing to wait on, and it
was right to: a later slice with no dependency key dispatches alongside the first one.

## Why this one is different

The other three consumers read. This one **writes**, and the resolver has no write surface. Giving
it one would turn a resolver into a repository. So this slice repoints the writes instead.

**It does not need a new write path either.** `rates/rate-tables.service.ts` already owns
RateTable writes: `createRow` (`:251`), `updateRow` (`:276`, `:297`), plus table and column CRUD,
and it has a spec. **Use it.** Do not write raw `prisma.rateRow` calls — `RateRow.cells` is a JSON
bag keyed by `RateColumn.id`, and hand-rolling that mapping a second time is how the two paths
drift.

## The call sites (measured on origin/main 9732def7)

```
:448  estimateWasteRate.update        :453  estimateWasteRate.upsert
:473  estimateMaterialDensity.update  :476  estimateMaterialDensity.upsert   <-- LEAVE THESE
:493  estimatePlantRate.update        :496  estimatePlantRate.upsert
```

## Do

1. Repoint the **four** `estimateWasteRate` / `estimatePlantRate` writes at `RateTablesService`,
   resolving the target table by slug (`waste`, `plant`) and the row by its key column(s) using the
   same matching the resolver's read path uses. Inject the service; do not duplicate its logic.

2. **`estimateMaterialDensity` STAYS EXACTLY AS IT IS** (`:473`, `:476`). It is a density lookup,
   not a `$` rate, it is **not** on the 11c drop list, `pr-524` says keep it entirely, and
   `CP-08-seed-idempotency.spec.ts:55,238,266` asserts it is seeded. The `done_when` deliberately
   greps for it still being present — if it disappears, this slice is wrong.

3. **Preserve import semantics precisely.** Today an upsert creates-or-updates by a natural key. If
   the RateTable equivalent cannot express that, **stop and report** rather than approximating it —
   an import that silently creates duplicate rows instead of updating is worse than one that fails.

4. Add a spec: an update of an existing row, a create of a new one, and an assertion that the
   density path is untouched.

## Do NOT

- Do NOT add any write method to `RateResolverService`.
- Do NOT run the importer against real data as part of this work.
- Do NOT change the import file format or the admin surface that calls it.
- Do NOT touch the other three consumers, or `/sot/`, or Azure/Entra/SharePoint.

## Note on `escalates: true`

Deliberate. This changes where **imported rate data lands** — a wrong mapping writes bad prices
into the canonical table, and an import that duplicates instead of updates is not obvious from a
green build. It will land with `do-not-merge` and CP-26 red until a human clears it. That is
intended, not a defect to fix forward.

## Verify

- `pnpm build && pnpm lint`; API tests green.
- Run an import against a **scratch** database and paste the before/after row counts for the
  affected tables into the PR body. Counts that grow when they should have stayed flat means the
  upsert became an insert — report it, do not patch over it.

## STANDING AUTHORITY

Write-path repoint via the existing service. Stop and report rather than widening scope.
