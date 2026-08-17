---
premise: ! test -f apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
premise_means: The sor-source-markup service does not exist yet — S3 SoR source/markup work is still needed.
requires_file_on_main: apps/api/src/modules/rates/rate-archive.service.ts
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
  - apps/api/src/modules/schedule-of-rates/**
  - apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
  - docs/data-model/**
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
  - grep -q "SorRateSourceType" apps/api/prisma/schema.prisma
  - grep -q "markupPct" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: "no rollback — SorRateSourceType enum and new fields are additive; drop enum + columns in a follow-on migration if needed"
backfill: false
---

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never ask a question. Decide from the evidence, or write to `needs-marco/` and stop.
- Before diagnosing any CI failure, read the job log via `gh run view <run-id> --log`.
- Say `NO-OP: <reason>` loudly if you cannot finish. A silent exit is treated as success by the
  watcher — that is the worst outcome.
- **This slice escalates** — open the PR and leave it unmerged; Marco reviews the schema design and
  markup logic before S4 is armed.

## Context

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it, especially §Locked Decisions #5, #6).

This slice extends `SorRate` with a source-type discriminator so each SoR line knows where its base
rate came from (internal `RateTable`, a vendor's `SubcontractorRate`, or a manual entry). It also
adds category-level default markup and a per-line override, and the "promote manual → hub" action.

## Ground first — read these files (cite line numbers)

1. `apps/api/prisma/schema.prisma` lines 7003–7030 (`SorRate` model — what fields already exist).
2. `apps/api/prisma/schema.prisma` lines 6985–7000 (`SorPeriod` — where to hang category markups).
3. `apps/api/prisma/schema.prisma` lines 5428–5500 (`RateTable`, `RateRow` — the internal source).
4. `apps/api/prisma/schema.prisma` lines 4360–4400 (`SubcontractorRate` — the vendor source).
5. `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` — the existing SoR admin page; add source
   picker and markup column here (do NOT rebuild it from scratch).
6. `docs/plans/rate-hub-sor-integration-plan.md` §Locked Decisions #3 and #6 — SoR is a snapshot,
   not a copy; source is Linked-Internal | Linked-Subbie/Supplier | Manual.

## What to build

### 1. Schema change — `SorRate` additions
Add to `SorRate` in `schema.prisma`:

```
sourceType       SorRateSourceType  @default(MANUAL) @map("source_type")
// FK to RateRow when sourceType = INTERNAL
sourceRateRowId  String?            @map("source_rate_row_id")
sourceRateRow    RateRow?           @relation("SorRateSourceRow", fields: [sourceRateRowId], references: [id], onDelete: SetNull)
// FK to SubcontractorRate when sourceType = SUBBIE or SUPPLIER
sourceSubRateId  String?            @map("source_sub_rate_id")
sourceSubRate    SubcontractorRate? @relation("SorRateSourceSubRate", fields: [sourceSubRateId], references: [id], onDelete: SetNull)
// Per-line markup override (percentage, e.g. 15.00 = 15%)
markupPct        Decimal?           @map("markup_pct") @db.Decimal(6, 2)
```

Add the new enum before the model:
```
enum SorRateSourceType {
  INTERNAL
  SUBBIE
  SUPPLIER
  MANUAL
}
```

Add back-relations on `RateRow` and `SubcontractorRate`.

### 2. Schema change — category markup on `SorPeriod`
Add a `categoryMarkups Json?  @map("category_markups")` field on `SorPeriod`.
Shape: `{ "LABOUR": 15.0, "PLANT": 10.0, ... }` (keyed by `SorCategory` string values).
Stored as JSON so new categories need no migration; the service applies category default then
per-line override (per-line wins).

Run `npx prisma migrate dev --name feat_sor_rate_source_type`.

Regenerate the data-model map:
```
node scripts/data-model/build-relationship-map.mjs
```
Commit `docs/data-model/metadata-catalog.json`, `relationship-map.json`, `relationship-map.md`.

GATE-ALLOW: migrations

### 3. New service
Create `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts`:

- `resolveEffectiveRate(sorRate: SorRate, periodMarkups: Record<string, number>): number`
  — apply category-default markup then per-line `markupPct` override; return the effective rate.
- `linkInternalRate(sorRateId, rateRowId, actorId)` — sets `sourceType = INTERNAL`,
  `sourceRateRowId`, writes audit log.
- `linkVendorRate(sorRateId, subRateId, sourceType: 'SUBBIE'|'SUPPLIER', actorId)` — sets
  `sourceType`, `sourceSubRateId`, writes audit log.
- `promoteToHub(sorRateId, actorId)` — "promote manual line → hub":
  creates a new `RateRow` in the appropriate `RateTable` (category-matched), then calls
  `linkInternalRate`. Throws if `sourceType` is not `MANUAL`.
- Inject `PrismaService`, `AuditService`.

### 4. Web UI additions (ScheduleOfRatesAdminPage)
- Add a "Source" column to the SoR rate rows table: icon/badge showing INTERNAL / SUBBIE / SUPPLIER / MANUAL.
- Add a "Markup %" column (editable, calls PATCH on the rate to set `markupPct`).
- For MANUAL rows, show a "Promote to hub" button that calls the `promoteToHub` endpoint.
- Add a "Link" action per row to open a picker: choose INTERNAL (pick from RateTable rows) or
  VENDOR (pick from SubcontractorRate list filtered by entity type).
- Category default markup: on the SoR period edit form, add a "Category markups" section where
  the user sets default markup % per SorCategory.

## Do NOT
- Do NOT change `SorClientRateEntry` — the per-client card is downstream of the master SorRate.
- Do NOT route vendor rates through `RateResolverService`.
- Do NOT rebuild `ScheduleOfRatesAdminPage` from scratch — add to it.
- Do NOT create a new SoR period wizard here (that is S4).
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
grep -q "SorRateSourceType" apps/api/prisma/schema.prisma
grep -q "markupPct" apps/api/prisma/schema.prisma
grep -q "categoryMarkups" apps/api/prisma/schema.prisma
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S3 — SoR line source enum + markup (INTERNAL/SUBBIE/SUPPLIER/MANUAL)`

Leave it UNMERGED. This slice escalates — Marco reviews before S4 is armed.
