/**
 * tender-rate-lock-formula.spec.ts — CHARGE_STEPS_PRICE_CUTTING_V1
 *
 * Tests that the chargeStepsSnapshot written at lock time is:
 *   1. Written on lock — contains steps from every rate table that has them.
 *   2. Frozen — a catalogue edit after lock does NOT affect the locked tender.
 *   3. Refreshed on re-lock — unlock then re-lock picks up the new formula.
 *
 * The tests are end-to-end through TenderRateSetService.lock / unlock, using
 * in-memory Prisma stubs. The ChargeStepPricingService is not directly
 * exercised here — snapshot write correctness is the sole focus.
 */

import { Prisma } from "@prisma/client";
import { TenderRateSetService } from "../tender-rate-set.service";

// ── helper types ─────────────────────────────────────────────────────────

type Row = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  rateTableId: string | null;
  rateTableSlug: string | null;
  originalValue: Prisma.Decimal;
  overrideValue: Prisma.Decimal | null;
  tenderRateSetId: string;
};

type RateTableRecord = {
  slug: string;
  chargeSteps: unknown[] | null;
  lineFields: unknown[] | null;
  columns: Array<{ name: string; role: string }>;
};

// ── mock builder ─────────────────────────────────────────────────────────

/**
 * Build a minimal Prisma stub and all collaborator mocks for TenderRateSetService tests.
 *
 * `catalogueTables` is the initial list of rate tables with chargeSteps.
 * The spec manipulates it between lock/unlock calls to simulate catalogue edits.
 */
function buildMocks(opts: {
  catalogueTables: RateTableRecord[];
}) {
  const state: {
    set: { id: string; tenderId: string; chargeStepsSnapshot: unknown } | null;
    entries: Row[];
  } = {
    set: null,
    entries: []
  };

  const tenderFindUnique = jest.fn(async () => ({ id: "tender-1" }));

  // setFindUnique must return the current state including chargeStepsSnapshot
  const setFindUnique = jest.fn(async () =>
    state.set
      ? {
          id: state.set.id,
          tenderId: state.set.tenderId,
          chargeStepsSnapshot: state.set.chargeStepsSnapshot ?? null,
          lockedAt: new Date("2026-07-08T00:00:00Z"),
          sourceLabel: null,
          lockedBy: null
        }
      : null
  );

  const setUpsert = jest.fn(
    async ({ create, update }: {
      create: { tenderId: string; chargeStepsSnapshot?: unknown };
      update: { chargeStepsSnapshot?: unknown };
    }) => {
      if (!state.set) {
        state.set = {
          id: "set-1",
          tenderId: create.tenderId,
          chargeStepsSnapshot: create.chargeStepsSnapshot ?? null
        };
      } else {
        state.set.chargeStepsSnapshot = update.chargeStepsSnapshot ?? null;
      }
      return { id: state.set.id, tenderId: state.set.tenderId };
    }
  );

  const setDelete = jest.fn(async () => {
    state.set = null;
    state.entries = [];
    return {};
  });

  const entryFindMany = jest.fn(async () => state.entries);
  const entryCreate = jest.fn(async ({ data }: { data: Row & { tenderRateSetId: string } }) => {
    const row: Row = {
      id: `entry-${data.key}`,
      key: data.key,
      label: data.label ?? data.key,
      unit: data.unit ?? null,
      rateTableId: data.rateTableId ?? null,
      rateTableSlug: data.rateTableSlug ?? null,
      originalValue: data.originalValue,
      overrideValue: null,
      tenderRateSetId: "set-1"
    };
    state.entries.push(row);
    return row;
  });
  const entryUpdate = jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
    const idx = state.entries.findIndex((e) => e.id === where.id);
    if (idx === -1) throw new Error(`entry ${where.id} not found`);
    state.entries[idx] = { ...state.entries[idx], ...data };
    return state.entries[idx];
  });
  const entryFindUnique = jest.fn(async ({ where }: { where: { id: string } }) =>
    state.entries.find((e) => e.id === where.id) ?? null
  );

  const tenderUpdate = jest.fn(async () => ({ id: "tender-1" }));

  // rateTable.findMany supports two modes:
  //   (a) { where: { chargeSteps: { not: ... } } } — used by buildChargeStepsSnapshot
  //   (b) { where: { id: { in: ... } } }           — used by hydrate
  const rateTableFindMany = jest.fn(
    async (args: {
      where?: { chargeSteps?: unknown; id?: { in: string[] } };
      select?: unknown;
    }) => {
      if (args.where?.chargeSteps !== undefined) {
        // buildChargeStepsSnapshot: return tables that have chargeSteps set
        return opts.catalogueTables
          .filter((t) => t.chargeSteps !== null && t.chargeSteps !== undefined)
          .map((t) => ({
            slug: t.slug,
            chargeSteps: t.chargeSteps,
            lineFields: t.lineFields ?? [],
            columns: t.columns.map((c) => ({ name: c.name, role: c.role }))
          }));
      }
      // hydrate: no rate tables needed for this test
      return [];
    }
  );

  const rateRowFindMany = jest.fn(async () => []);

  const tx = {
    tenderRateSet: { upsert: setUpsert, findUnique: setFindUnique, delete: setDelete },
    tenderRateEntry: {
      findMany: entryFindMany,
      create: entryCreate,
      update: entryUpdate,
      findUnique: entryFindUnique
    },
    tender: { update: tenderUpdate },
    rateTable: { findMany: rateTableFindMany },
    rateRow: { findMany: rateRowFindMany }
  };

  const prisma = {
    ...tx,
    tender: { findUnique: tenderFindUnique, update: tenderUpdate },
    rateTable: { findMany: rateTableFindMany },
    rateRow: { findMany: rateRowFindMany },
    $transaction: jest.fn(async (fn: unknown) => {
      if (typeof fn === "function") return fn(tx);
      return [];
    })
  };

  const resolver = {
    enumerateRateSet: jest.fn(async () => [])
  };

  const audit = { write: jest.fn().mockResolvedValue({}) };
  const chargeStepPricing = { priceRow: jest.fn() }; // unused in these tests

  return {
    prisma,
    resolver,
    audit,
    chargeStepPricing,
    state,
    mocks: { setUpsert, setFindUnique, setDelete, rateTableFindMany }
  };
}

// ── Initial step catalogue ────────────────────────────────────────────────

const INITIAL_CUTTING_STEPS = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "High-Freq" } },
  { op: "multiply", field: "metres" }
];

const UPDATED_CUTTING_STEPS = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: 1.15, when: { field: "method", cmp: "is", value: "High-Freq" } }, // changed 1.25 -> 1.15
  { op: "multiply", field: "metres" }
];

const CUTTING_COLUMNS = [
  { name: "Equipment", role: "KEY" },
  { name: "Elevation", role: "KEY" },
  { name: "Material", role: "KEY" },
  { name: "Depth mm", role: "KEY" },
  { name: "Rate per m", role: "VALUE" }
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe("TenderRateSetService — lock writes chargeStepsSnapshot (CHARGE_STEPS_PRICE_CUTTING_V1)", () => {
  it("lock() writes the step formula for every rate table that has chargeSteps", async () => {
    const catalogue: RateTableRecord[] = [
      {
        slug: "cutting",
        chargeSteps: INITIAL_CUTTING_STEPS,
        lineFields: [{ name: "method", kind: "text" }, { name: "metres", kind: "number" }],
        columns: CUTTING_COLUMNS
      }
    ];

    const { prisma, resolver, audit, chargeStepPricing, mocks } = buildMocks({ catalogueTables: catalogue });
    const svc = new TenderRateSetService(
      prisma as never,
      audit as never,
      resolver as never,
      chargeStepPricing as never
    );

    await svc.lock("tender-1", "actor-1");

    // setUpsert should have been called with a chargeStepsSnapshot containing "cutting"
    const upsertCall = mocks.setUpsert.mock.calls[0][0] as {
      create: { chargeStepsSnapshot: unknown };
    };
    const snapshot = upsertCall.create.chargeStepsSnapshot as Record<string, unknown>;
    expect(snapshot).toBeDefined();
    expect(snapshot["cutting"]).toBeDefined();
    const cuttingEntry = snapshot["cutting"] as {
      chargeSteps: unknown[];
      lineFields: unknown[];
      columns: unknown[];
    };
    expect(cuttingEntry.chargeSteps).toEqual(INITIAL_CUTTING_STEPS);
    expect(cuttingEntry.columns.length).toBe(5);
  });

  it("lock() writes snapshot with correct columns (name + role only)", async () => {
    const catalogue: RateTableRecord[] = [
      {
        slug: "cutting-mm",
        chargeSteps: [{ op: "start", field: "Rate per m" }, { op: "multiply", field: "metres" }],
        lineFields: [{ name: "metres", kind: "number" }],
        columns: [
          { name: "Equipment", role: "KEY" },
          { name: "Elevation", role: "KEY" },
          { name: "Rate per m", role: "VALUE" }
        ]
      }
    ];

    const { prisma, resolver, audit, chargeStepPricing, mocks } = buildMocks({ catalogueTables: catalogue });
    const svc = new TenderRateSetService(
      prisma as never,
      audit as never,
      resolver as never,
      chargeStepPricing as never
    );

    await svc.lock("tender-1", "actor-1");

    const upsertCall = mocks.setUpsert.mock.calls[0][0] as {
      create: { chargeStepsSnapshot: Record<string, unknown> };
    };
    const entry = upsertCall.create.chargeStepsSnapshot["cutting-mm"] as {
      columns: Array<{ name: string; role: string }>;
    };
    expect(entry.columns).toEqual([
      { name: "Equipment", role: "KEY" },
      { name: "Elevation", role: "KEY" },
      { name: "Rate per m", role: "VALUE" }
    ]);
  });

  it("lock() skips tables with no chargeSteps", async () => {
    const catalogue: RateTableRecord[] = [
      {
        slug: "labour",
        chargeSteps: null, // no steps
        lineFields: null,
        columns: [{ name: "Rate", role: "VALUE" }]
      }
    ];

    const { prisma, resolver, audit, chargeStepPricing, mocks } = buildMocks({ catalogueTables: catalogue });
    const svc = new TenderRateSetService(
      prisma as never,
      audit as never,
      resolver as never,
      chargeStepPricing as never
    );

    await svc.lock("tender-1", "actor-1");

    // When no tables have chargeSteps, chargeStepsSnapshot is undefined (omitted from upsert)
    const upsertCall = mocks.setUpsert.mock.calls[0][0] as {
      create: { chargeStepsSnapshot?: unknown };
    };
    // The snapshot should be absent (no entries to store)
    const snap = upsertCall.create.chargeStepsSnapshot;
    expect(snap).toBeUndefined();
  });
});

describe("TenderRateSetService — locked formula survives catalogue edit (CHARGE_STEPS_PRICE_CUTTING_V1)", () => {
  it("re-reading a locked tender after catalogue formula changes still shows the locked formula", async () => {
    const catalogue: RateTableRecord[] = [
      {
        slug: "cutting",
        chargeSteps: INITIAL_CUTTING_STEPS,
        lineFields: [],
        columns: CUTTING_COLUMNS
      }
    ];

    const { prisma, resolver, audit, chargeStepPricing, state } = buildMocks({ catalogueTables: catalogue });
    const svc = new TenderRateSetService(
      prisma as never,
      audit as never,
      resolver as never,
      chargeStepPricing as never
    );

    // Step 1: lock with initial formula
    await svc.lock("tender-1", "actor-1");
    const snapshotAfterFirstLock = state.set?.chargeStepsSnapshot as Record<string, unknown> | null;
    expect(snapshotAfterFirstLock).not.toBeNull();
    const lockedEntry = (snapshotAfterFirstLock as Record<string, unknown>)["cutting"] as {
      chargeSteps: unknown[];
    };
    expect(lockedEntry.chargeSteps).toEqual(INITIAL_CUTTING_STEPS);

    // Step 2: simulate a catalogue formula edit (change step multiplier)
    catalogue[0].chargeSteps = UPDATED_CUTTING_STEPS;

    // Step 3: read back the locked snapshot — it should still have the OLD formula
    const snapshotAfterEdit = state.set?.chargeStepsSnapshot as Record<string, unknown>;
    const entryAfterEdit = snapshotAfterEdit["cutting"] as { chargeSteps: unknown[] };
    expect(entryAfterEdit.chargeSteps).toEqual(INITIAL_CUTTING_STEPS);
    // Specifically: the locked formula has 1.25 multiplier, NOT the edited 1.15
    const step1 = entryAfterEdit.chargeSteps[1] as { field: number };
    expect(step1.field).toBe(1.25);
  });
});

describe("TenderRateSetService — unlock then re-lock refreshes formula (CHARGE_STEPS_PRICE_CUTTING_V1)", () => {
  it("unlock then re-lock picks up the new catalogue formula", async () => {
    const catalogue: RateTableRecord[] = [
      {
        slug: "cutting",
        chargeSteps: INITIAL_CUTTING_STEPS,
        lineFields: [],
        columns: CUTTING_COLUMNS
      }
    ];

    const { prisma, resolver, audit, chargeStepPricing, state } = buildMocks({ catalogueTables: catalogue });
    const svc = new TenderRateSetService(
      prisma as never,
      audit as never,
      resolver as never,
      chargeStepPricing as never
    );

    // Step 1: first lock
    await svc.lock("tender-1", "actor-1");
    const firstSnapshot = state.set?.chargeStepsSnapshot as Record<string, unknown>;
    expect((firstSnapshot["cutting"] as { chargeSteps: Array<{ field: unknown }> }).chargeSteps[1].field).toBe(1.25);

    // Step 2: catalogue edit (new formula with 1.15 multiplier)
    catalogue[0].chargeSteps = UPDATED_CUTTING_STEPS;

    // Step 3: unlock
    await svc.unlock("tender-1", "actor-1");
    expect(state.set).toBeNull();

    // Step 4: re-lock
    await svc.lock("tender-1", "actor-1");
    const secondSnapshot = state.set?.chargeStepsSnapshot as Record<string, unknown>;
    expect(secondSnapshot).not.toBeNull();

    const cuttingEntry = secondSnapshot["cutting"] as { chargeSteps: Array<{ field: unknown }> };
    // After re-lock: new formula (1.15) should be stored
    expect(cuttingEntry.chargeSteps[1].field).toBe(1.15);
  });
});
