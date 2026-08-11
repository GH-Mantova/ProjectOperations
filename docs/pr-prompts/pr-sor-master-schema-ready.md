---
premise: '! grep -q "model SorRate" apps/api/prisma/schema.prisma'
premise_means: The Schedule of Rates master model (SorPeriod / SorRate / SorChangeLogEntry) does not exist yet — there is no live-job SoR rate book in the schema or API.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/prisma/seed-schedule-of-rates.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.service.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.controller.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/schedule-of-rates.service.spec.ts
  - apps/api/src/app.module.ts
done_when: pnpm build && pnpm lint && grep -q "model SorRate" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/schedule-of-rates/schedule-of-rates.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — three new tables (SorPeriod, SorRate, SorChangeLogEntry) + two new enums; no existing table/column altered. Safe to leave on main; a down migration drops the three tables + enums. Forward-only otherwise.
backfill: false
---

# SoR S1 — Schedule of Rates master: schema + API + seed (live-job rate book)

Slice S1 of the Schedule of Rates program (`docs/plans/sor-program-plan.md`; design in memory
`project_sor_program`). This is the **live-job** rate book that later prices Variations & Agreed Records.
It is **SEPARATE from tender pricing** — do NOT touch the tender/estimate rate engine, `TenderRateSet`, or
`EstimatePlantRate`/`EstimateWasteRate`. This slice is the master catalog only; per-client cards (S3),
job attach/lock (S4), VC (S6), AR (S7-S8) are later slices.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add two enums and three models (all new; nothing existing altered):
   ```prisma
   enum SorCategory { LABOUR PLANT WASTE SUBCONTRACTOR }
   enum SorPeriodHalf { H1 H2 }

   model SorPeriod {
     id         String        @id @default(cuid())
     year       Int
     half       SorPeriodHalf
     startDate  DateTime
     expiryDate DateTime      // H1 -> 30 Jun of year; H2 -> 31 Dec of year
     label      String        // e.g. "H1 2026 (1 Jan - 30 Jun)"
     status     String        @default("ACTIVE") // ACTIVE | EXPIRED | DRAFT
     createdAt  DateTime      @default(now())
     rates      SorRate[]
     changes    SorChangeLogEntry[]
     @@unique([year, half])
   }

   model SorRate {
     id         String       @id @default(cuid())
     periodId   String
     period     SorPeriod    @relation(fields: [periodId], references: [id], onDelete: Cascade)
     category   SorCategory
     name       String       // Position (labour) or item/description
     class      String?      // labour class e.g. "A Class"; null for others
     unit       String?      // e.g. "Per Hour" | "Day" | "Ton" | "M3" | "Each"
     ordinary   Decimal?     @db.Decimal(12, 2)
     oneAndHalf Decimal?     @db.Decimal(12, 2) // labour OT tier
     double     Decimal?     @db.Decimal(12, 2) // labour OT tier
     isReference Boolean     @default(false)    // true = cost+ (subbie), no fixed rate
     comments   String?
     sortOrder  Int          @default(0)
     active     Boolean      @default(true)
     createdAt  DateTime     @default(now())
     updatedAt  DateTime     @updatedAt
     @@index([periodId, category])
   }

   model SorChangeLogEntry {  // append-only
     id         String     @id @default(cuid())
     periodId   String
     period     SorPeriod  @relation(fields: [periodId], references: [id], onDelete: Cascade)
     rateId     String?    // null for period-level changes
     field      String
     oldValue   String?
     newValue   String?
     changedById String?
     changedAt  DateTime   @default(now())
     @@index([periodId])
   }
   ```

2. **Migration** under `apps/api/prisma/migrations/` — additive only (create the two enums + three tables +
   indexes/FKs). Follow the idempotent additive style of an existing recent migration. Put a bare
   `GATE-ALLOW: migrations` line at column 0 of the PR body.

3. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `.md`, and `metadata-catalog.json`.

4. **`apps/api/src/modules/schedule-of-rates/` (new module)** — `schedule-of-rates.service.ts` +
   `.controller.ts` + `.module.ts` with, guarded by an appropriate manage permission (reuse an existing
   rates/estimating manage permission; do not invent a new permission system):
   - list periods; get a period with its rates (grouped by category);
   - create a period; create / update / deactivate a rate;
   - **every rate create/update writes a `SorChangeLogEntry`** (append-only — never mutate prior entries);
   - list a period's change log.
   Register the module in `apps/api/src/app.module.ts`.

5. **`apps/api/prisma/seed-schedule-of-rates.ts` (new)** — an idempotent (upsert-based) seed that creates
   the **H1 2026** period (start 2026-01-01, expiry 2026-06-30) and a **representative set** of rates from
   the supplied Initial Services schedule, at minimum: Labour — Project Manager (Demolition, 133.10/160/193),
   Labourer (Demolition, 93.50/113/136), Asbestos Removalist Friable (A Class, 114.95/138/167); Plant —
   "01T-03T Excavator - Asbestos works (incl. Operator)" (Per Hour, 220.00), "Bobcat" (Per Hour, 137.50);
   Waste — "C&D" (Ton, 302.90), "Asbestos - Levy applicable" (Ton, 468.00); Subcontractor — "Coring"
   (isReference=true, cost+). Wire it so it runs with the existing seed entrypoint (match how other
   seed-*.ts files are invoked). Full rate population comes via the S2 admin UI — do NOT hand-embed all ~60
   rows here.

6. Update `apps/api/src/modules/schedule-of-rates/__tests__/schedule-of-rates.service.spec.ts`: test that
   creating/updating a rate writes a change-log entry and that list-by-period groups by category (follow the
   repo's existing mock-Prisma spec pattern).

## Do NOT

- Do NOT touch tender pricing, `TenderRateSet`, `EstimatePlantRate`/`EstimateWasteRate`, or the estimate engine.
- Do NOT build the admin UI, client cards, job attach, VC, AR, PDF, or approval chain — those are later slices.
- Do NOT hand-embed the entire rate schedule in the seed (representative set only).
- Do NOT alter existing tables/columns; everything here is additive.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way. This PR escalates (schema +
> migration): open it, then note it must be labelled do-not-merge for Marco to review the migration diff.

## Guardrails

- One attempt. If genuinely impossible in the stated scope, do not exit silently — say `NO-OP: <reason>`.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log (`gh run view <run> --job <job> --log`) before diagnosing.
- Regenerate the data-model map (step 3) up front — the drift check hard-fails a stale map.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
