---
premise: '! grep -q "SorRateSource" apps/api/prisma/schema.prisma'
premise_means: SorRate has no source-kind enum yet, so every SoR line is untraceable to its hub origin and cannot carry markup.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.service.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/schedule-of-rates.service.spec.ts
  - docs/data-model/**
requires_file_on_main: apps/api/src/modules/rates/rate-archive.service.ts
done_when: pnpm build && pnpm lint && grep -q "SorRateSource" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts
size: 6
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: additive columns + a new enum with default MANUAL; existing SorRate rows keep behaviour. Safe to leave on main if run dies mid-flight; forward-only.
---

# RATE-HUB S3 — SoR line `sourceKind` + category-default markup + per-line override

Give every `SorRate` a source lineage (INTERNAL / SUBBIE / SUPPLIER / MANUAL) so
the "Create SoR" flow (S4) can pull from the hub. Add markup at the period
(category default) and per-line (override). **Escalates** — Marco holds the merge.
Full plan: `docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/prisma/schema.prisma:6978`, `:6996` — `SorPeriod`, `SorRate` (extend here).
- `apps/api/prisma/schema.prisma:7042`, `:7059` — `SorClientRateCard` / `SorClientRateEntry` (freeze precedent).
- `apps/api/src/modules/schedule-of-rates/schedule-of-rates.service.ts` — Prisma `create`/`update` payloads (spec-mock churn — update the spec's `toHaveBeenCalledWith` in the SAME PR or the API test job fails; PROMPT-SCHEMA rule).
- `apps/api/src/modules/rates/rate-resolver.service.ts:54` — INTERNAL source resolves via this; SUBBIE/SUPPLIER do NOT.

## What to build

### Schema (additive)
1. New enum:
   ```prisma
   enum SorRateSource {
     INTERNAL
     SUBBIE
     SUPPLIER
     MANUAL
   }
   ```
2. On `SorRate`:
   - `sourceKind SorRateSource @default(MANUAL) @map("source_kind")`
   - `sourceRef  Json?          @map("source_ref")`
     - INTERNAL: `{ "tableSlug": "…", "keys": { … } }` — replayable via `resolveRate`.
     - SUBBIE/SUPPLIER: `{ "vendorId": "…", "subcontractorRateId": "…" }`.
     - MANUAL: `null`.
   - `markupPct  Decimal? @db.Decimal(6, 3) @map("markup_pct")` (per-line override; null → use category default).
3. On `SorPeriod`:
   - `categoryMarkup Json? @map("category_markup")` — `{ "<SorCategory>": <pct> }`.
4. Additive migration (no data transform — existing rows default to `MANUAL`, no `sourceRef`, no `markupPct`, no `categoryMarkup`). `backfill: false`.
5. Regenerate + commit the data-model map (`docs/data-model/relationship-map.json`, `.md`, `metadata-catalog.json`).

### Types
6. `apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts` exporting:
   - The `SorRateSource` string-union type mirror.
   - `SorInternalRef`, `SorVendorRef` discriminated shapes for `sourceRef`.
   - Runtime type guards (`isInternalRef`, `isVendorRef`) used by service code.

### Service constraint
7. In `schedule-of-rates.service.ts`, when reading a `SorRate` where
   `sourceKind ∈ { SUBBIE, SUPPLIER }`, **do NOT** call `resolveRate` — look up
   `SubcontractorRate` by the stored `subcontractorRateId` directly. INTERNAL
   rows may call `resolveRate(tableSlug, keys)` from `sourceRef`. Update the
   affected service spec's `toHaveBeenCalledWith` expectations (spec drift).

### Effective-rate rule (add small helper — same file)
8. `effectiveRate(sorRate, period) = base × (1 + (sorRate.markupPct ?? period.categoryMarkup[sorRate.category] ?? 0) / 100)`. Covered by the spec.

## GATE-ALLOW: migrations

## Do NOT
- Route SUBBIE/SUPPLIER rows through `RateResolverService` — explicit vendor lookup only.
- Backfill any existing `SorRate` — default is `MANUAL` for a reason; leaving them alone preserves current behaviour.
- Change `SorClientRateEntry` shape in this slice (the client-card override lives on ENTRY, not source).
- Edit `/sot/`. Do not use `requires_merged`.

## VERIFY
- `pnpm build && pnpm lint`
- `grep -q "SorRateSource" apps/api/prisma/schema.prisma`
- `test -f apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts`
- Spec updated: `toHaveBeenCalledWith` includes the new fields; SUBBIE/SUPPLIER path never calls `resolveRate`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
