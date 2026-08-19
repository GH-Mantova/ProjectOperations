---
premise: 'grep -q "model EstimateMaterialDensity" apps/api/prisma/schema.prisma'
premise_means: The rigid EstimateMaterialDensity table still exists on main; densities have not been migrated into the flexible RateTable system.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed-initial-services.ts
  - apps/api/src/modules/rates/**
  - apps/api/src/modules/estimates/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && node scripts/data-model/build-relationship-map.mjs --check
size: 10
gate_allow: migrations
seed_only: false
escalates: true
---

# Migrate EstimateMaterialDensity into the RateTable system (own reviewable PR)

Marco's "minimise drift" instruction: this is its OWN self-contained PR (do not bundle), and it
regenerates the data-model map IN THIS PR so it cannot leave the generated map stale (that sank #593).
It is quote-adjacent (density feeds waste weight), so it is `escalates: true` and MUST leave prices
UNCHANGED — prove it.

## What to build

1. Represent material densities as a `RateTable` (KEY = material, VALUE = density kg/m³, `isReference`)
   seeded from the existing 44 `EstimateMaterialDensity` rows. Add the density lookup to the
   `rate-resolver.service.ts` seam so callers resolve density through it.
2. Data migration: copy every existing density row into the new RateTable representation. Keep the old
   `EstimateMaterialDensity` model in place for THIS PR (deprecate-in-place); dropping the model is a
   separate follow-up so this PR stays reversible and under the size cap.
3. Cut `estimates.service.ts` (and dto) over to resolve density via the resolver instead of reading
   `EstimateMaterialDensity` directly. **Resolver output must be byte-identical to the old lookup** so
   quoted numbers do not move.
4. **Regenerate the data-model map**: run `node scripts/data-model/build-relationship-map.mjs` and
   commit `docs/data-model/relationship-map.json` + `.md` + `metadata-catalog.json`.
5. Update the estimates + rate-resolver unit specs for the new resolution path.

## PR body MUST include
- `GATE-ALLOW: migrations` as a bare line at column 0 (CP-11).
- A statement that quoted numbers are unchanged, with one worked density lookup shown resolving to the
  same value before and after.

## Do NOT
- Do NOT drop the `EstimateMaterialDensity` model in this PR (separate follow-up; keeps this reversible).
- Do NOT change any density VALUES — this is a storage/resolution migration, not a re-rating.
- Do NOT bundle the task-time/waste calculators or any other item.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (migration + quote-adjacent): open it and LEAVE IT UNMERGED for Marco.

## Guardrails
- One attempt. Never exit silently -- if densities are already in RateTable, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` + the data-model drift check must pass.
