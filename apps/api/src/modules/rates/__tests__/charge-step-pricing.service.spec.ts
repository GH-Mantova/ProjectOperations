/**
 * charge-step-pricing.service.spec.ts — CHARGE_STEPS_PRICE_CUTTING_V1
 *
 * Tests for ChargeStepPricingService:
 *   1. Live table (no tenderId): loads steps from DB and prices correctly.
 *   2. Locked tender: uses chargeStepsSnapshot copy when present.
 *   3. Returns null for tables with no steps.
 *   4. Returns null when a step issue prevents evaluation.
 */

import { ChargeStepPricingService } from "../charge-step-pricing.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeColumnId(name: string): string {
  return `col-${name.toLowerCase().replace(/\s+/g, "-")}`;
}

function makePrisma(opts: {
  rateTable?: {
    id: string;
    slug: string;
    chargeSteps?: unknown;
    lineFields?: unknown;
    columns?: Array<{ id: string; name: string; role: string }>;
  } | null;
  rateRows?: Array<{ cells: unknown }>;
  tenderRateSet?: {
    chargeStepsSnapshot?: unknown;
  } | null;
}) {
  return {
    rateTable: {
      findUnique: jest.fn().mockImplementation((args: { where?: { slug?: string } }) => {
        if (!opts.rateTable) return Promise.resolve(null);
        const t = opts.rateTable;
        return Promise.resolve({
          id: t.id,
          chargeSteps: t.chargeSteps ?? null,
          lineFields: t.lineFields ?? null,
          columns: t.columns ?? []
        });
      })
    },
    rateRow: {
      findMany: jest.fn().mockResolvedValue(opts.rateRows ?? [])
    },
    tenderRateSet: {
      findUnique: jest.fn().mockImplementation((args: { where?: { tenderId?: string } }) => {
        if (opts.tenderRateSet === undefined) return Promise.resolve(null);
        if (opts.tenderRateSet === null) return Promise.resolve(null);
        return Promise.resolve({ chargeStepsSnapshot: opts.tenderRateSet.chargeStepsSnapshot ?? null });
      })
    }
  };
}

const RATE_COL_ID = makeColumnId("Rate per m");
const CUTTING_STEPS = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "High-Freq" } },
  { op: "multiply", field: "metres" }
];

// ---------------------------------------------------------------------------
// 1. Live table (no tenderId): loads from DB
// ---------------------------------------------------------------------------

describe("ChargeStepPricingService — live table, no tenderId", () => {
  test("returns the step total when table has steps and evaluation succeeds", async () => {
    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: CUTTING_STEPS,
        lineFields: [
          { name: "method", kind: "text", sample: "Fuel" },
          { name: "metres", kind: "number", sample: 1 }
        ],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 71.3 },
      lineFields: { method: "Fuel", metres: 1 }
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(71.3, 4);
  });

  test("returns the step total with High-Freq multiplier applied (1.25)", async () => {
    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: CUTTING_STEPS,
        lineFields: [
          { name: "method", kind: "text", sample: "Fuel" },
          { name: "metres", kind: "number", sample: 1 }
        ],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 71.3 },
      lineFields: { method: "High-Freq", metres: 1 }
    });

    expect(result).not.toBeNull();
    // 71.3 * 1.25 * 1 = 89.125
    expect(result!.value).toBeCloseTo(89.125, 2);
  });

  test("returns null when table has no chargeSteps", async () => {
    const prisma = makePrisma({
      rateTable: {
        id: "rt-002",
        slug: "other-rates",
        chargeSteps: null,
        columns: []
      },
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "other-rates",
      row: { value: 100 },
      lineFields: {}
    });

    expect(result).toBeNull();
  });

  test("returns null when table slug is not in RateTable", async () => {
    const prisma = makePrisma({
      rateTable: null,
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "nonexistent",
      row: { value: 100 },
      lineFields: {}
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Locked tender: uses chargeStepsSnapshot
// ---------------------------------------------------------------------------

describe("ChargeStepPricingService — locked tender uses snapshot", () => {
  test("uses snapshot steps when tender has a locked chargeStepsSnapshot for the slug", async () => {
    // Snapshot has different steps from live table (old formula)
    const snapshotSteps = [
      { op: "start", field: "Rate per m" },
      { op: "multiply", field: 2 } // snapshot formula: 2x multiplier
    ];
    const liveSteps = [
      { op: "start", field: "Rate per m" },
      { op: "multiply", field: 1 } // live formula: 1x multiplier
    ];

    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: liveSteps,
        lineFields: [],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: [],
      tenderRateSet: {
        chargeStepsSnapshot: {
          cutting: {
            chargeSteps: snapshotSteps,
            lineFields: [],
            columns: [{ name: "Rate per m", role: "VALUE" }]
          }
        }
      }
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 71.3 },
      lineFields: {},
      tenderId: "tender-001"
    });

    // Snapshot formula: 71.3 * 2 = 142.6
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(142.6, 2);
  });

  test("falls back to live table when tender has no snapshot for the slug", async () => {
    const liveSteps = [
      { op: "start", field: "Rate per m" },
      { op: "multiply", field: 3 } // live formula: 3x
    ];

    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: liveSteps,
        lineFields: [],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: [],
      tenderRateSet: {
        chargeStepsSnapshot: {
          // No "cutting" key — only other tables
          "other-slug": { chargeSteps: [], lineFields: [], columns: [] }
        }
      }
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 10 },
      lineFields: {},
      tenderId: "tender-001"
    });

    // Live formula: 10 * 3 = 30
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(30, 2);
  });

  test("falls back to live table when tender has no rate set", async () => {
    const liveSteps = [
      { op: "start", field: "Rate per m" }
    ];

    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: liveSteps,
        lineFields: [],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: [],
      tenderRateSet: null // no locked rate set
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 50 },
      lineFields: {},
      tenderId: "tender-001"
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(50, 2);
  });
});

// ---------------------------------------------------------------------------
// 3. Step issue yields null
// ---------------------------------------------------------------------------

describe("ChargeStepPricingService — step issue yields null", () => {
  test("returns null when a required line field is missing and step fails", async () => {
    // Steps that require a "metres" field (number) — not provided
    const stepsRequiringMetres = [
      { op: "start", field: "Rate per m" },
      { op: "multiply", field: "metres" } // missing
    ];

    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: stepsRequiringMetres,
        lineFields: [
          { name: "metres", kind: "number" } // declared but no sample
        ],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    const result = await svc.priceRow({
      tableSlug: "cutting",
      row: { value: 71.3 },
      lineFields: {} // metres not provided
    });

    // "metres" missing => missing-operand issue => total is null => returns null
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Shared loader is cached (only one DB query per slug per instance)
// ---------------------------------------------------------------------------

describe("ChargeStepPricingService — shared loader caches per slug", () => {
  test("second call for the same slug does not make another DB query", async () => {
    const prisma = makePrisma({
      rateTable: {
        id: "rt-001",
        slug: "cutting",
        chargeSteps: [{ op: "start", field: "Rate per m" }],
        lineFields: [],
        columns: [
          { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
        ]
      },
      rateRows: []
    });

    const svc = new ChargeStepPricingService(prisma as never);
    await svc.priceRow({ tableSlug: "cutting", row: { value: 10 }, lineFields: {} });
    await svc.priceRow({ tableSlug: "cutting", row: { value: 20 }, lineFields: {} });

    // findUnique should have been called exactly once (cache hit on second call)
    expect((prisma.rateTable.findUnique as jest.Mock).mock.calls.length).toBe(1);
  });
});
