---
premise: '! test -f apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts'
premise_means: There is no builder that assembles a SoR by pulling chosen lines from the three hub tabs with markup — the "Create Schedule of Rates" action does not exist yet.
scope:
  - apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts
  - apps/api/src/modules/schedule-of-rates/sor-hub-builder.controller.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/sor-hub-builder.service.spec.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/schedule-of-rates/CreateSorFromHub.tsx
requires_file_on_main: apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts && grep -q "buildFromHub" apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# RATE-HUB S4 — "Create Schedule of Rates" from the hub

Add the builder that consumes the three hub tabs and outputs a fresh
`SorPeriod` + `SorRate[]` snapshot, applying the S3 markup rules and stamping
each line's `sourceKind` / `sourceRef`. Full plan:
`docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts` (from S3) — the source discriminators.
- `apps/api/src/modules/rates/rate-resolver.service.ts:54` — `resolveRate(tableSlug, keys)` (INTERNAL only).
- `apps/api/src/modules/rates/rate-hub-vendors.service.ts` (from S1) — grouped vendor read for SUBBIE/SUPPLIER picks.
- `apps/api/prisma/schema.prisma:6978`, `:6996` — `SorPeriod`, `SorRate`.
- `apps/api/prisma/schema.prisma:5486` — `TenderRateSet` (freeze-in-time precedent to mirror).

## What to build
1. `SorHubBuilderService` at
   `apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts` with:
   ```ts
   buildFromHub(input: {
     year: number; half: 'H1' | 'H2'; label: string;
     categoryMarkup: Record<SorCategory, number>;    // percent, per category
     lines: Array<
       | { source: 'INTERNAL'; tableSlug: string; keys: Record<string, unknown>; category: SorCategory; name: string; class?: string; unit?: string; markupPctOverride?: number }
       | { source: 'SUBBIE' | 'SUPPLIER'; vendorId: string; subcontractorRateId: string; category: SorCategory; name: string; class?: string; unit?: string; markupPctOverride?: number }
       | { source: 'MANUAL'; category: SorCategory; name: string; class?: string; unit?: string; ordinary?: number; oneAndHalf?: number; double?: number; markupPctOverride?: number }
     >;
   }): Promise<{ periodId: string; rateIds: string[] }>
   ```
   - INTERNAL: snapshot via `resolveRate(tableSlug, keys)` — capture the value at snapshot time; store `sourceRef = { tableSlug, keys }`.
   - SUBBIE / SUPPLIER: read the specific `SubcontractorRate` by id (verify it belongs to `vendorId` and is `isActive`); store `sourceRef = { vendorId, subcontractorRateId }`.
   - MANUAL: use the ordinary/one-and-half/double from the input; `sourceRef = null`.
   - All lines carry `markupPct = markupPctOverride ?? null` and `sourceKind = source`. Period carries `categoryMarkup`.
   - Runs inside a Prisma transaction — all-or-nothing.
2. Controller `sor-hub-builder.controller.ts` — `POST /schedule-of-rates/build-from-hub` (permission `sor.manage`).
3. Wire into `schedule-of-rates.module.ts`.
4. Unit spec at
   `apps/api/src/modules/schedule-of-rates/__tests__/sor-hub-builder.service.spec.ts`:
   - INTERNAL line calls `resolveRate` exactly once and captures its value.
   - SUBBIE/SUPPLIER line does NOT call `resolveRate` (explicit-opt-in rule).
   - MANUAL line writes typed values.
   - Transaction rollback on any line failure.
5. Web:
   - `apps/web/src/pages/schedule-of-rates/CreateSorFromHub.tsx` — three-tab
     picker (Internal / Subcontractors / Suppliers) matching the hub grouping,
     category markup inputs, per-line override, dry-run preview → commit.
   - Add a **Create Schedule of Rates** button on `RatesListsAdminPage.tsx`
     that opens the new page. Route registered wherever `/schedule-of-rates/*`
     already routes.

## Do NOT
- Reroute SUBBIE/SUPPLIER lines through `RateResolverService`.
- Copy a vendor's `SubcontractorRate` into the hub — the picker READs the S1 grouped-view endpoint.
- Add markup fields to `SorClientRateEntry` (S3 put them on `SorRate` and `SorPeriod` for a reason).
- Edit `/sot/`. Do not use `requires_merged`.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts`
- `grep -q "buildFromHub" apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts`
- Spec asserts no `resolveRate` call on the SUBBIE/SUPPLIER paths.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
