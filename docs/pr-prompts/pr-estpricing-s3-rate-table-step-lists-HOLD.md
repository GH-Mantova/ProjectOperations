---
premise: '! grep -q "chargeSteps" apps/api/prisma/schema.prisma'
premise_means: A rate table cannot yet say how its rate becomes money; every calculation is hardcoded in service code.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/rates/rate-step-evaluator.ts
  - apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "chargeSteps" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: 'Additive only - adds one nullable Json column (charge_steps) to rate_tables and creates no data. Safe to leave applied if the run dies mid-flight; re-running drops nothing and the column is ignored by every existing reader.'
cluster: estimating-pricing
cluster_order: 3
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: CUTTING_RATE_CORRECTIONS_V1'
---

# Let a rate table carry its own calculation, as an ordered step list

## Why

Every pricing rule in the estimating module is compiled into service code. A supplier changing how
they charge is currently a code change and a PR. Marco's requirement (30 Aug) is that a rate change,
a schedule swap or a supplier swap becomes **admin work**, and only a genuinely new *shape* of
pricing needs code.

The four corrections in slice 2 are the argument: each was the wrong calculation selected in code,
not a wrong number in a table.

## The model

A calculation is an ordered list of steps, worked top to bottom, each taking the running total from
the one above. Any step may carry one condition. This is the whole grammar:

    start | multiply | divide | add | subtract | round | floor | cap

- **start** takes a field or a number.
- **round** takes a direction (`nearest` / `up` / `down`) and an interval.
- **floor** / **cap** clamp the running total.
- Every step except **start** and **round** may carry a condition of the form
  `{ field, cmp, value }` with `cmp` in `is | is not | > | < | >= | <=`. When the condition is not
  met the step is skipped, and the trail records it as skipped rather than dropping it.

Worked example, core holes, which reproduces the corrected slice-2 behaviour exactly:

    start Depth -> divide 10 -> round nearest 1 -> floor 1
      -> multiply Rate -> multiply 2 when Elevation is Inverted -> multiply Holes

## What to build

1. **`schema.prisma`** — one nullable `Json` column on `RateTable`, `chargeSteps` mapped to
   `charge_steps`. No other model changes. Regenerate the data-model map with
   `node scripts/data-model/build-relationship-map.mjs` and commit the refreshed
   `relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`.
2. **A migration** under `apps/api/prisma/migrations/` adding the column. Production runs
   `prisma migrate deploy` and never runs the TypeScript seed, so the column must come from a
   migration, not from seed code.
3. **`apps/api/src/modules/rates/rate-step-evaluator.ts`** — a pure function taking the step list
   plus a value bag and returning `{ total, trail }`, where `trail` carries the running total after
   each step and marks skipped steps. **No `eval`.** Steps are data; the evaluator walks them.
   Text values may only be compared, never used in arithmetic — return a typed error naming the
   field when they are.
4. **Spec** covering: each step type; a condition met and unmet; text in arithmetic rejected; the
   trail length matching the step count; and the three real shapes (banded, per-unit-with-floor,
   stepped-with-minimum) producing the numbers from slice 2.

## Do NOT

- Do not wire the evaluator into any pricing path in this slice — it ships unused and proven.
- Do not add a UI. That is the next slice.
- Do not change `RateColumn.role` or any existing column semantics.
- Do not remove or alter the hardcoded calculations yet.
- Do not touch `/sot/`.

## PR body must contain

`GATE-ALLOW: migrations` as a bare line at column 0.

## VERIFY

- `node scripts/data-model/build-relationship-map.mjs --check` prints OK.
- `pnpm --filter @project-ops/api test:serial` green; `pnpm seed` idempotent twice.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
