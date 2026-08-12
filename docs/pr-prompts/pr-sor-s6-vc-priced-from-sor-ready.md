---
premise: '! grep -q "model VariationSorLine" apps/api/prisma/schema.prisma'
premise_means: The Variation-priced-from-SoR line model does not exist yet — variations on live jobs are not yet priced from a locked Job SoR snapshot. S4 (Job SoR snapshot + attach wizard) is on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/variations/variation-sor.service.ts
  - apps/api/src/modules/variations/variation-sor.controller.ts
  - apps/api/src/modules/variations/variations.module.ts
  - apps/api/src/modules/variations/__tests__/variation-sor.service.spec.ts
  - apps/web/src/pages/VariationPricingPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -q "model VariationSorLine" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/variations/variation-sor.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — one new table (VariationSorLine) attached to the existing Variation; no existing table/column altered. Safe to leave on main; down migration drops the new table. Forward-only otherwise.
backfill: false
requires_file_on_main: apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts
---

# SoR S6 — Variations (VC) priced from the locked Job SoR

Slice S6 (`docs/plans/sor-program-plan.md` on main; design in memory `project_sor_program`). VC =
**existing `Variation`** desktop-priced upfront from the **locked Job SoR snapshot** (S4). Do NOT
create a parallel VC model — extend `Variation` via a child line table. Tender pricing untouched.

## Grounded (read first — on main today)
- `apps/api/prisma/schema.prisma` — `Variation` (line ~3932): fields `id`, `contractId`,
  `variationNumber`, `description`, `status` (VariationStatus enum), `pricedAmount`, `approvedAmount`,
  `receivedDate` / `pricedDate` / `submittedDate` / `approvedDate`, `notes`, `createdById`,
  `claimLineItems` back-ref (already fed into `ProgressClaim` via `ClaimLineItem`). REUSE this model.
- S4 module `apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts` — call
  `GET job-sor-snapshot/for-job/:jobId` to fetch the active snapshot; call the rate helper to freeze
  the exact rate on each VC line.
- The `variations` NestJS module on main — extend it; do NOT invent a new module.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add ONE new model (`Variation` itself is left alone; new lines
   attach via FK):
   ```prisma
   model VariationSorLine {
     id                    String            @id @default(cuid())
     variationId           String            @map("variation_id")
     variation             Variation         @relation(fields: [variationId], references: [id], onDelete: Cascade)
     // Rate lock — snapshot + version stamp + the copied rate row
     jobSorSnapshotId      String            @map("job_sor_snapshot_id")
     sorVersion            String            @map("sor_version")
     snapshotRateId        String?           @map("snapshot_rate_id") // null for a manual line
     category              SorCategory
     name                  String            // position or item name
     class                 String?
     unit                  String?
     tier                  String            @default("ORDINARY") // ORDINARY | ONE_AND_HALF | DOUBLE
     rate                  Decimal           @db.Decimal(12, 2)     // FROZEN at line create — never re-read live
     quantity              Decimal           @db.Decimal(12, 2)
     lineAmount            Decimal           @map("line_amount") @db.Decimal(12, 2)
     notes                 String?
     sortOrder             Int               @default(0) @map("sort_order")
     createdAt             DateTime          @default(now()) @map("created_at")
     updatedAt             DateTime          @updatedAt @map("updated_at")
     @@index([variationId])
     @@index([jobSorSnapshotId])
     @@map("variation_sor_lines")
   }
   ```
   Add the back-ref `sorLines VariationSorLine[]` on `Variation` (single field addition, no column
   change). Nothing else on `Variation` is altered.
2. **Migration** under `apps/api/prisma/migrations/` — additive. Bare `GATE-ALLOW: migrations` at
   column 0 of the PR body.
3. Regenerate `docs/data-model/**` via `node scripts/data-model/build-relationship-map.mjs` and
   commit the three generated files.
4. **`apps/api/src/modules/variations/variation-sor.service.ts`** + `.controller.ts`, wired into the
   existing `variations.module.ts`, guarded by the existing variations-manage permission:
   - `POST variations/:id/sor-lines` — body `{ snapshotRateId?, tier, quantity, name?, unit?, class?,
     category? }`. If `snapshotRateId` given: fetch the frozen rate from the job snapshot via S4's
     helper, copy `category/name/class/unit`, resolve `rate` from the chosen `tier`, compute
     `lineAmount = rate * quantity`. If NOT given: it is a manual line — caller supplies the fields;
     `rate` is still frozen at create. First call also **triggers the snapshot lock** if the job has
     none (`POST job-sor-snapshot/attach`) — this is the "first VC/AR locks it" rule from S4.
   - `PATCH variations/:id/sor-lines/:lineId` — quantity/tier edits recompute `lineAmount`, but rate
     is NEVER re-read from live `SorRate` — always from the frozen `snapshot_rate_id` on the line.
   - `DELETE variations/:id/sor-lines/:lineId`.
   - `GET variations/:id/sor-lines` — list, with running total.
   - Every write recomputes `Variation.pricedAmount = SUM(lineAmount)` and stamps `pricedDate` if null.
5. **`apps/web/src/pages/VariationPricingPage.tsx`** — desktop pricing screen: header shows the job's
   locked SoR version (from S4); table of `VariationSorLine` with add-from-catalog (searches the
   snapshot, not live `SorRate`), tier picker (Ordinary / 1.5x / 2x), quantity, computed line amount,
   running total. Route it in `App.tsx` (guard = variations-manage). Follow the design tokens & fetch
   layer used by the sibling `VariationsPage`/related pricing screens on main.
6. **Spec** `apps/api/src/modules/variations/__tests__/variation-sor.service.spec.ts` (mock-Prisma):
   (a) first line triggers snapshot attach, (b) subsequent lines reuse the same snapshot + sorVersion,
   (c) editing quantity keeps the rate frozen, (d) `pricedAmount` recomputes on write.

## Do NOT
- Do NOT create a parallel VC model — VC prices the existing `Variation` via lines.
- Do NOT read live `SorRate` when pricing — always from the frozen snapshot rate on the line.
- Do NOT touch tender pricing, `TenderRateSet`, or `EstimatePlantRate`/`EstimateWasteRate`.
- Do NOT build the AR field/office lanes (S7/S8) or the register (S9) here.
- Do NOT hard-depend on the rate-hub slices.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the model already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- Regenerate the data-model map up front.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
