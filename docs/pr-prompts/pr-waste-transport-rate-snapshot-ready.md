---
premise: '! grep -q "quotedTransportRatePerDay" apps/api/prisma/schema.prisma'
premise_means: >-
  ScopeWasteItem snapshots quotedDisposalRate and quotedFuelPricePerLitre but
  has no transport-rate snapshot. The waste cost engine reads
  EstimatePlantRate.rate live at write time (scope-waste.service.ts:431), so a
  line prices as a snapshot on read and silently repoints on any write.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/**
  - docs/data-model/**
done_when: >-
  pnpm build && pnpm lint && grep -q "quotedTransportRatePerDay"
  apps/api/prisma/schema.prisma && grep -q "transportDelta"
  apps/api/src/modules/tendering/scope-waste.service.ts && grep -q
  "quotedTransportRatePerDay"
  apps/api/src/modules/tendering/__tests__/scope-waste-transport-snapshot.spec.ts
size: 8
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive nullable column only; no data is altered or removed. Revert is a
  drop-column migration plus a git revert of the service change. Existing rows
  are untouched (NULL snapshot = price from the live rate, as today), so a
  revert cannot lose a value that existed before this PR.
---

# Waste transport rate — snapshot it, and stop silently repricing

**Marco's decision, 2026-08-19: Option A (snapshot).** This is SLICE 1 of 2
(API). SLICE 2 is the variance-panel UI and is chained on this.

## The defect being fixed

Measured on `main` in `apps/api/src/modules/tendering/scope-waste.service.ts`:

- `list()` (:86) is a plain `findMany` — **no recompute.** Reads return the
  persisted `lineTotal`.
- `computeCostEngine()` (:381) does a **live** lookup
  `estimatePlantRate.findUnique` (:431) and persists only the *result*.
  Disposal and fuel get snapshot columns (`quotedDisposalRate`,
  `quotedFuelPricePerLitre`); transport gets none.
- `update()` (:213) assigns `data.lineTotal` **unconditionally** (:288) — so a
  PATCH that only changes `notes` silently re-prices the whole line against
  whatever the plant rate says today.
- `variance()` (:516) compares live-vs-quoted for disposal and fuel only
  (:548-550). Transport cannot be flagged because there is nothing to compare.

Net effect today: change a transport plant rate and nothing moves — until
somebody edits that line's notes, at which point the total jumps with no flag
before or after. Worked example: 500 t, 25 t/load, 2 trucks, 3 loads/truck/day,
rate $1,200/day, disposal $85/t gives `lineTotal` $52,100. Move the rate to
$1,400/day and a notes edit silently makes it $53,700.

## Do

1. **Schema** — add to `model ScopeWasteItem`, beside the two existing snapshots:

   ```prisma
   quotedTransportRatePerDay Decimal? @map("quoted_transport_rate_per_day") @db.Decimal(10, 2)
   ```

   Additive, nullable. Auto-timestamped migration folder. Declare
   `GATE-ALLOW: migrations` as a **bare line at column 0** of the PR body.

2. **Regenerate the data-model map in the same PR** —
   `node scripts/data-model/build-relationship-map.mjs` and commit the
   regenerated `docs/data-model/relationship-map.json` + `relationship-map.md` +
   `metadata-catalog.json`. The CI drift check hard-fails a schema change that
   leaves the map stale, and the agent exits before CI runs, so this must be
   done up front.

3. **Price from the snapshot when it exists** — in `computeCostEngine`, take an
   optional `quotedTransportRatePerDay` input. Precedence:
   - snapshot present -> use it as `transportFeePerDay`;
   - snapshot absent -> look up `EstimatePlantRate.rate` live as today, and
     **return it** so the caller can persist it as the new snapshot.

   This is what makes the change safe for existing rows: a NULL snapshot behaves
   exactly like today and migrates itself forward on the next write.

4. **Persist it** — `create()` and `update()` write
   `quotedTransportRatePerDay` alongside the other two snapshots.

5. **Stop the silent reprice** — `update()` currently assigns `data.lineTotal`
   unconditionally at :288. Change it so the line is re-priced **only when the
   PATCH actually touched a pricing input** (any of: qty, m3, unit, wasteLoads,
   ratePerTonne, ratePerLoad, transportRateId, assetId, qtyTrucks,
   loadsPerTruckPerDay, capacityPerLoad, capacityUnit, dailyKm, wasteType,
   wasteFacility). A PATCH that only touches description / wbsRef / notes /
   sortOrder / discipline must leave `lineTotal` and every cost component
   exactly as they were. Put the pricing-input list in a named constant with a
   comment saying why it exists, so the next person adding a column knows to
   add it here.

6. **Add transport to the variance check** — `variance()` returns
   `quotedTransportRatePerDay`, `currentTransportRatePerDay` (read live from
   `EstimatePlantRate` via the row's `transportRateId`; null if the id is null
   or the row is gone) and `transportDelta`. Fold it into `hasVariance` with a
   threshold of **>= $1.00/day**, consistent in spirit with the existing strict
   thresholds (>= $0.50/t disposal, >= $0.01/L fuel). Document the threshold in
   the same comment block as the other two.

7. **Tests** — there is currently **no** `scope-waste.service.spec.ts` anywhere
   under `apps/api/src/modules/tendering/__tests__/`. Create
   `scope-waste-transport-snapshot.spec.ts` covering, with mocked Prisma:
   - engine prices from the snapshot when present, ignoring a differing live rate;
   - engine falls back to the live rate when the snapshot is NULL, and the
     returned snapshot equals that live rate;
   - a notes-only PATCH does **not** change `lineTotal` (this is the regression
     test for the bug — it must fail against pre-change behaviour);
   - `variance()` sets `hasVariance` true on a >= $1.00/day transport move and
     false at $0.50.

## Do NOT

- **Do NOT backfill.** `backfill: false` is deliberate. Writing today's live
  rate into `quotedTransportRatePerDay` for existing rows would fabricate a
  quote that never happened and would silently assert those tenders were priced
  at a rate they may not have been. NULL means "never snapshotted" and must keep
  meaning that.
- Do NOT change any existing `lineTotal`, `transportCost`, `fuelCost` or
  `disposalCost` value in the database. This PR must not move a single number
  on a single existing row.
- Do NOT touch the disposal or fuel snapshot logic, or the resolver.
- Do NOT touch `apps/web/**` — the variance panel is SLICE 2.
- Do NOT touch `EstimatePlantRate` itself, or anything in the rates-migration
  (11a/11b/11c) chain.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Why this matters beyond the bug

`EstimatePlantRate` is on the destructive drop list for the rates migration
(`docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md:53-55`), and
`ScopeWasteItem.transportRate` is an inbound FK to it
(`schema.prisma:3648-3649`). Snapshotting the rate onto the row is what lets
that FK eventually become droppable. Do **not** attempt any of that here — this
slice only adds the snapshot.

## Verify

- `pnpm build && pnpm lint`; full API test suite green.
- `node scripts/data-model/build-relationship-map.mjs --check` prints OK.
- State in the PR body which specs you touched and paste the notes-only-PATCH
  test result. If you could not make that test fail against the old behaviour,
  say so plainly — a regression test that never went red proves nothing.

## Note on `escalates: true`

Deliberate, and not merely to satisfy OPS-6's keyword match on "backfill". This
PR changes **pricing arithmetic** on a live tendering surface and carries a
migration. It will land with `do-not-merge` and CP-26 red until a human clears
it — that is the intended behaviour, not a defect to fix forward. The change is
additive and nullable and moves no existing number, but "safe" is a claim a
human should verify on a money path rather than one the merge queue assumes.

## STANDING AUTHORITY

Additive schema + service change only. Stop and report rather than widening scope.
