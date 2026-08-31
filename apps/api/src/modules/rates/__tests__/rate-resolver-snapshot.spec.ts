/**
 * Snapshot behaviour for RateResolverService.resolveRate when a tender
 * has a locked TenderRateSet.
 *
 * Covered cases:
 *  1. Tender WITH snapshot → rate served from snapshot (TENDER_RATE_SNAPSHOT_APPLIED)
 *  2. Tender WITHOUT snapshot → falls through to live resolution
 *  3. Snapshot EXISTS but key absent → warn snapshot-miss-fell-back-to-live + fall back
 *  4. Warn on miss names the missing candidateKey
 *  5. Precedence with RATES_CANONICAL_SOURCE unset (default legacy) — snapshot still
 *     takes priority over the legacy branch
 */

import { RateResolverService } from "../rate-resolver.service";

const ORIGINAL_RATES_SOURCE = process.env.RATES_CANONICAL_SOURCE;

afterEach(() => {
  if (ORIGINAL_RATES_SOURCE === undefined) {
    delete process.env.RATES_CANONICAL_SOURCE;
  } else {
    process.env.RATES_CANONICAL_SOURCE = ORIGINAL_RATES_SOURCE;
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    estimateLabourRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimatePlantRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateWasteRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateCuttingRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateCoreHoleRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateFuelRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateEnclosureRate: { findMany: jest.fn().mockResolvedValue([]) },
    cuttingOtherRate: { findMany: jest.fn().mockResolvedValue([]) },
    estimateMaterialDensity: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    rateTable: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    rateRow: { findMany: jest.fn().mockResolvedValue([]) },
    tenderRateSet: { findUnique: jest.fn() },
    tenderRateEntry: { findMany: jest.fn().mockResolvedValue([]) }
  };
}

// Minimal TenderRateSet + entries fixture for the "plant" slug.
// key = {rateTableId}:{rowId}:{columnId}
const TABLE_ID = "rt-plant";
const ROW_ID = "rr-exc";
const COL_ID = "c-rate";
const SNAPSHOT_KEY = `${TABLE_ID}:${ROW_ID}:${COL_ID}`;

const RATE_TABLE_PLANT = {
  id: TABLE_ID,
  slug: "plant",
  isReference: false,
  columns: [
    { id: "c-item", name: "item", role: "KEY",   unit: null },
    { id: COL_ID,   name: "rate", role: "VALUE",  unit: "day" }
  ]
};

const RATE_ROWS_PLANT = [
  { id: ROW_ID, cells: { "c-item": "Excavator 20t", [COL_ID]: 800 } }
];

// The snapshot entry for Excavator 20t — no override (uses originalValue)
function makeSnapshotEntry(overrideValue: null | string = null) {
  return {
    id: "entry-1",
    tenderRateSetId: "rs-1",
    key: SNAPSHOT_KEY,
    rateTableId: TABLE_ID,
    rateTableSlug: "plant",
    label: "Plant rates — Excavator 20t (rate)",
    unit: "day",
    originalValue: { toString: () => "800", valueOf: () => 800 },
    overrideValue: overrideValue !== null ? { toString: () => overrideValue, valueOf: () => Number(overrideValue) } : null
  };
}

// ---------------------------------------------------------------------------
// Case 1: Tender WITH snapshot → served from snapshot
// ---------------------------------------------------------------------------
describe("snapshot resolution", () => {
  test("case 1: tender with snapshot resolves rate from snapshot entries", async () => {
    delete process.env.RATES_CANONICAL_SOURCE; // default legacy
    const prisma = makePrisma();

    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([makeSnapshotEntry()]);
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE_PLANT);
    prisma.rateRow.findMany.mockResolvedValue(RATE_ROWS_PLANT);

    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-1" });

    expect(out.value).toBe(800);
    expect(out.rowId).toBe(ROW_ID);
    expect(out.source).toBe("ratetable");

    // Live legacy path must NOT be consulted
    expect(prisma.estimatePlantRate.findUnique).not.toHaveBeenCalled();
    expect(prisma.estimatePlantRate.findMany).not.toHaveBeenCalled();
  });

  test("case 1b: snapshot with override → effectiveValue uses overrideValue", async () => {
    delete process.env.RATES_CANONICAL_SOURCE;
    const prisma = makePrisma();

    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([makeSnapshotEntry("950")]);
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE_PLANT);
    prisma.rateRow.findMany.mockResolvedValue(RATE_ROWS_PLANT);

    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-1" });

    expect(out.value).toBe(950); // override wins
    expect(prisma.estimatePlantRate.findUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 2: Tender WITHOUT snapshot → live resolution
  // -------------------------------------------------------------------------
  test("case 2: tender without snapshot falls through to live resolution", async () => {
    delete process.env.RATES_CANONICAL_SOURCE; // default legacy
    const prisma = makePrisma();

    // No TenderRateSet for this tender
    prisma.tenderRateSet.findUnique.mockResolvedValue(null);
    // Live legacy plant row
    prisma.estimatePlantRate.findUnique.mockResolvedValue({
      id: "p-exc",
      rate: "800",
      unit: "day"
    });

    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-no-snapshot" });

    expect(out.value).toBe(800);
    expect(out.source).toBe("legacy");
  });

  test("case 2b: no tenderId option → live resolution, snapshot DB not touched", async () => {
    delete process.env.RATES_CANONICAL_SOURCE;
    const prisma = makePrisma();

    prisma.estimatePlantRate.findUnique.mockResolvedValue({
      id: "p-exc",
      rate: "800",
      unit: "day"
    });

    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("plant", { item: "Excavator 20t" });

    expect(out.source).toBe("legacy");
    expect(prisma.tenderRateSet.findUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 3: Snapshot exists but key absent → warn + fall back to live
  // -------------------------------------------------------------------------
  test("case 3: snapshot missing key → warns snapshot-miss-fell-back-to-live and falls back", async () => {
    delete process.env.RATES_CANONICAL_SOURCE;
    const prisma = makePrisma();

    // Snapshot exists but with a different key (not the plant/Excavator key)
    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([
      {
        id: "entry-other",
        tenderRateSetId: "rs-1",
        key: "rt-other:rr-other:c-other",
        rateTableId: "rt-other",
        rateTableSlug: "other",
        label: "Other rate",
        unit: "hr",
        originalValue: { toString: () => "100", valueOf: () => 100 },
        overrideValue: null
      }
    ]);
    // RateTable lookup for "plant" slug succeeds (candidate key derivable)
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE_PLANT);
    prisma.rateRow.findMany.mockResolvedValue(RATE_ROWS_PLANT);

    // Live legacy fallback
    prisma.estimatePlantRate.findUnique.mockResolvedValue({
      id: "p-exc",
      rate: "800",
      unit: "day"
    });

    const svc = new RateResolverService(prisma as never);
    const loggerWarnSpy = jest.spyOn((svc as never)["logger"], "warn");

    const out = await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-1" });

    // Falls back to live rate
    expect(out.source).toBe("legacy");
    expect(out.value).toBe(800);

    // Warned with the right event
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "snapshot-miss-fell-back-to-live" })
    );
  });

  // -------------------------------------------------------------------------
  // Case 4: Warn names the missing key
  // -------------------------------------------------------------------------
  test("case 4: snapshot-miss warn includes the candidateKey", async () => {
    delete process.env.RATES_CANONICAL_SOURCE;
    const prisma = makePrisma();

    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([]); // empty snapshot
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE_PLANT);
    prisma.rateRow.findMany.mockResolvedValue(RATE_ROWS_PLANT);

    prisma.estimatePlantRate.findUnique.mockResolvedValue({
      id: "p-exc",
      rate: "800",
      unit: "day"
    });

    const svc = new RateResolverService(prisma as never);
    const loggerWarnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-1" });

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "snapshot-miss-fell-back-to-live",
        candidateKey: SNAPSHOT_KEY
      })
    );
  });

  // -------------------------------------------------------------------------
  // Case 5: Precedence with RATES_CANONICAL_SOURCE unset (legacy default)
  //         Snapshot must fire BEFORE the legacy branch
  // -------------------------------------------------------------------------
  test("case 5: snapshot takes precedence over legacy branch when RATES_CANONICAL_SOURCE is unset", async () => {
    delete process.env.RATES_CANONICAL_SOURCE; // default = legacy
    const prisma = makePrisma();

    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([makeSnapshotEntry()]);
    prisma.rateTable.findUnique.mockResolvedValue(RATE_TABLE_PLANT);
    prisma.rateRow.findMany.mockResolvedValue(RATE_ROWS_PLANT);

    // Live legacy would return a DIFFERENT value (to prove snapshot won)
    prisma.estimatePlantRate.findUnique.mockResolvedValue({
      id: "p-exc",
      rate: "999",
      unit: "day"
    });

    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("plant", { item: "Excavator 20t" }, { tenderId: "tender-1" });

    // Must come from snapshot (800), NOT from live legacy (999)
    expect(out.value).toBe(800);
    expect(out.source).toBe("ratetable");

    // The legacy DB must NOT have been consulted at all
    expect(prisma.estimatePlantRate.findUnique).not.toHaveBeenCalled();
  });

  test("case 5b: legacy-only slug (not in RateTable) silently falls through to live even with snapshot", async () => {
    // "labour" is a legacy-only slug when the RateTable has no entry for it.
    // The snapshot check should return null and the legacy path handles it.
    delete process.env.RATES_CANONICAL_SOURCE;
    const prisma = makePrisma();

    prisma.tenderRateSet.findUnique.mockResolvedValue({ id: "rs-1" });
    prisma.tenderRateEntry.findMany.mockResolvedValue([makeSnapshotEntry()]);
    // RateTable does NOT have a "labour" table
    prisma.rateTable.findUnique.mockResolvedValue(null);

    prisma.estimateLabourRate.findUnique.mockResolvedValue({
      id: "lab-1",
      dayRate: "450",
      nightRate: "520",
      weekendRate: "600"
    });

    const svc = new RateResolverService(prisma as never);
    const loggerWarnSpy = jest.spyOn((svc as never)["logger"], "warn");

    const out = await svc.resolveRate("labour", { role: "Foreman", shift: "day" }, { tenderId: "tender-1" });

    // Falls through to live legacy
    expect(out.source).toBe("legacy");
    expect(out.value).toBe(450);

    // No warn: legacy-only slug is a soft miss, not an error
    expect(loggerWarnSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "snapshot-miss-fell-back-to-live" })
    );
  });
});
