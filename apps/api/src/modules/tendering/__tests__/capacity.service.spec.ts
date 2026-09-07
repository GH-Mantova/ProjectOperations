import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { CapacityService } from "../capacity.service";

// ── Prisma mock helpers ───────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    allocationWeightConfig: {
      findMany: jest.fn().mockResolvedValue([])
    },
    estimatorCapacity: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn()
    },
    tender: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null)
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null)
    },
    tenderAllocationCandidate: {
      findMany: jest.fn().mockResolvedValue([])
    },
    tenderAllocationRejection: {
      findMany: jest.fn().mockResolvedValue([])
    },
    ...overrides
  };
}

function makeAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  audit: ReturnType<typeof makeAudit> = makeAudit()
) {
  return new CapacityService(prisma as never, audit as never);
}

// ── Default weight rows (used in load tests) ──────────────────────────────────

const DEFAULT_WEIGHT_ROWS = [
  { dimension: "urgency", key: "CRITICAL", weight: new Decimal("4"), label: "Critical" },
  { dimension: "urgency", key: "HIGH",     weight: new Decimal("3"), label: "High" },
  { dimension: "urgency", key: "MEDIUM",   weight: new Decimal("2"), label: "Medium" },
  { dimension: "urgency", key: "LOW",      weight: new Decimal("1"), label: "Low" },
  { dimension: "size",    key: "XS",       weight: new Decimal("1"), label: "XS" },
  { dimension: "size",    key: "S",        weight: new Decimal("2"), label: "S" },
  { dimension: "size",    key: "M",        weight: new Decimal("3"), label: "M" },
  { dimension: "size",    key: "L",        weight: new Decimal("4"), label: "L" }
];

// ── urgencyKey ────────────────────────────────────────────────────────────────

describe("CapacityService.urgencyKey", () => {
  const prisma = makePrisma();
  const service = makeService(prisma);

  const NOW = new Date();
  function daysFromNow(days: number): Date {
    return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
  }

  it('returns "MEDIUM" for null dueDate', () => {
    expect(service.urgencyKey(null)).toBe("MEDIUM");
  });

  it('returns "CRITICAL" for due date < 7 days away (boundary: 6 days)', () => {
    expect(service.urgencyKey(daysFromNow(6))).toBe("CRITICAL");
  });

  it('returns "CRITICAL" for due date in the past', () => {
    expect(service.urgencyKey(daysFromNow(-1))).toBe("CRITICAL");
  });

  it('returns "HIGH" for due date >= 7 days and < 21 days (boundary: 7.1 days)', () => {
    // 7.0 exact fails in practice due to microseconds elapsed between Date construction
    // and Date.now() inside urgencyKey. Use 7.1 to test the >= 7 boundary clearly.
    expect(service.urgencyKey(daysFromNow(7.1))).toBe("HIGH");
  });

  it('returns "HIGH" for due date < 21 days (boundary: 20 days)', () => {
    expect(service.urgencyKey(daysFromNow(20))).toBe("HIGH");
  });

  it('returns "MEDIUM" for due date >= 21 days and < 60 days (boundary: 21.1 days)', () => {
    expect(service.urgencyKey(daysFromNow(21.1))).toBe("MEDIUM");
  });

  it('returns "MEDIUM" for due date < 60 days (boundary: 59 days)', () => {
    expect(service.urgencyKey(daysFromNow(59))).toBe("MEDIUM");
  });

  it('returns "LOW" for due date >= 60 days (boundary: 60.1 days)', () => {
    expect(service.urgencyKey(daysFromNow(60.1))).toBe("LOW");
  });

  it('returns "LOW" for due date well in the future', () => {
    expect(service.urgencyKey(daysFromNow(365))).toBe("LOW");
  });
});

// ── getCapacity — defaults ────────────────────────────────────────────────────

describe("CapacityService.getCapacity", () => {
  it("returns defaults (cap=5, pct=100, effectiveCap=5) when no EstimatorCapacity row exists", async () => {
    const prisma = makePrisma({
      estimatorCapacity: { findUnique: jest.fn().mockResolvedValue(null) }
    });
    const service = makeService(prisma);

    const result = await service.getCapacity("estimator-1");

    expect(result).toEqual({
      concurrentCap: 5,
      availabilityPct: 100,
      effectiveCap: 5
    });
  });

  it("returns values from the EstimatorCapacity row when it exists", async () => {
    const prisma = makePrisma({
      estimatorCapacity: {
        findUnique: jest.fn().mockResolvedValue({
          userId: "estimator-1",
          concurrentCap: 8,
          availabilityPct: 75
        })
      }
    });
    const service = makeService(prisma);

    const result = await service.getCapacity("estimator-1");

    expect(result.concurrentCap).toBe(8);
    expect(result.availabilityPct).toBe(75);
    expect(result.effectiveCap).toBe(6); // 8 * 0.75
  });

  it("scales effectiveCap correctly with availabilityPct (cap=5 at 60% → 3)", async () => {
    const prisma = makePrisma({
      estimatorCapacity: {
        findUnique: jest.fn().mockResolvedValue({
          userId: "estimator-2",
          concurrentCap: 5,
          availabilityPct: 60
        })
      }
    });
    const service = makeService(prisma);

    const result = await service.getCapacity("estimator-2");

    expect(result.effectiveCap).toBe(3); // 5 * 0.60 = 3
  });
});

// ── getLeastLoaded ────────────────────────────────────────────────────────────

describe("CapacityService.getLeastLoaded", () => {
  it("returns null when the list is empty", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const result = await service.getLeastLoaded([]);
    expect(result).toBeNull();
  });

  it("returns null when every candidate is at or over capacity", async () => {
    // Estimator A: load=5, effectiveCap=5 (at capacity, not under)
    // Estimator B: load=6, effectiveCap=4 (over capacity)
    const prisma = makePrisma({
      allocationWeightConfig: {
        findMany: jest.fn().mockResolvedValue(DEFAULT_WEIGHT_ROWS)
      },
      estimatorCapacity: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { userId: string } }) => {
          if (where.userId === "est-a") return Promise.resolve({ concurrentCap: 5, availabilityPct: 100 });
          if (where.userId === "est-b") return Promise.resolve({ concurrentCap: 4, availabilityPct: 100 });
          return Promise.resolve(null);
        })
      },
      tender: {
        findMany: jest.fn().mockImplementation(({ where }: { where: { assignedEstimatorId: string } }) => {
          if (where.assignedEstimatorId === "est-a") {
            // 5 tenders each with MEDIUM urgency (2) and M size (3) -> 5 * 6 = 30
            // but we need load=5 so we need fewer tenders; simpler: no weight config,
            // then each tender gets urgencyWeight=1, sizeWeight=1 -> load = count
            return Promise.resolve([
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null }
            ]);
          }
          if (where.assignedEstimatorId === "est-b") {
            return Promise.resolve([
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null },
              { dueDate: null, estimatedValue: null }
            ]);
          }
          return Promise.resolve([]);
        })
      }
    });
    // Override getWeightConfig to return empty maps so all weights fall back to 1
    const service = makeService(prisma);
    jest.spyOn(service, "getWeightConfig").mockResolvedValue({
      urgency: new Map(),
      size: new Map()
    });

    // est-a has load=5, effectiveCap=5  (NOT under capacity — load < effectiveCap is false)
    // est-b has load=6, effectiveCap=4  (over)
    const result = await service.getLeastLoaded(["est-a", "est-b"]);
    expect(result).toBeNull();
  });

  it("selects by RATIO not raw load — lower raw load is NOT the answer when that estimator has a small cap", async () => {
    // est-small: load=2, effectiveCap=3  -> ratio = 0.667
    // est-large: load=4, effectiveCap=10 -> ratio = 0.4   <- WINNER (lower ratio)
    //
    // Raw-load selection would (wrongly) pick est-small (load 2 < 4).
    // Ratio selection correctly picks est-large.

    const prisma = makePrisma({
      estimatorCapacity: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { userId: string } }) => {
          if (where.userId === "est-small") return Promise.resolve({ concurrentCap: 3,  availabilityPct: 100 });
          if (where.userId === "est-large") return Promise.resolve({ concurrentCap: 10, availabilityPct: 100 });
          return Promise.resolve(null);
        })
      }
    });
    const service = makeService(prisma);

    // Stub out load resolution so we control the values exactly.
    jest.spyOn(service, "getEstimatorLoad").mockImplementation(async (id) => {
      if (id === "est-small") return 2;
      if (id === "est-large") return 4;
      return 0;
    });

    const result = await service.getLeastLoaded(["est-small", "est-large"]);
    expect(result).toBe("est-large");
  });

  it("picks the single under-capacity estimator", async () => {
    const prisma = makePrisma({
      estimatorCapacity: {
        findUnique: jest.fn().mockResolvedValue({ concurrentCap: 5, availabilityPct: 100 })
      }
    });
    const service = makeService(prisma);

    jest.spyOn(service, "getEstimatorLoad").mockResolvedValue(1);

    const result = await service.getLeastLoaded(["est-1"]);
    expect(result).toBe("est-1");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EW-4 — capacity board
// ══════════════════════════════════════════════════════════════════════════════

// The EW-4 methods issue several DIFFERENT queries against the same delegates
// (tender.findMany is called with `{not: null}`, `{in: [...]}`, a bare string,
// and an allocationState filter). Hand-stubbing a single resolved value per
// delegate would make the assertions agree with whatever the mock returned
// rather than with the service, so these tests run against a small in-memory
// fake that actually applies the where-clause.

type FakeTender = {
  id: string;
  tenderNumber: string;
  title: string;
  assignedEstimatorId: string | null;
  status: string;
  allocationState: string;
  dueDate: Date | null;
  estimatedValue: Decimal | null;
  createdAt: Date;
};

type FakeUser = { id: string; firstName: string; lastName: string; isActive: boolean };
type FakeCapacityRow = {
  id: string;
  userId: string;
  concurrentCap: number;
  availabilityPct: number;
};

function tender(over: Partial<FakeTender> & { id: string }): FakeTender {
  return {
    tenderNumber: `T-${over.id}`,
    title: `Tender ${over.id}`,
    assignedEstimatorId: null,
    status: "DRAFT",
    allocationState: "ALLOCATED",
    dueDate: null,
    estimatedValue: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over
  };
}

function user(id: string, isActive = true): FakeUser {
  return { id, firstName: id.toUpperCase(), lastName: "Estimator", isActive };
}

function capacityRow(userId: string, concurrentCap: number, availabilityPct = 100): FakeCapacityRow {
  return { id: `cap-${userId}`, userId, concurrentCap, availabilityPct };
}

// Flat weights: every urgency and size scores 1, so a tender's load is exactly
// 1.0 and an estimator's load is their open-tender count. Keeps the arithmetic
// under test (utilisation, ratio, overload) legible instead of hiding it behind
// the weight table, which has its own dedicated tests above.
const FLAT_WEIGHT_ROWS = [
  { dimension: "urgency", key: "CRITICAL", weight: new Decimal("1"), label: "Critical" },
  { dimension: "urgency", key: "HIGH", weight: new Decimal("1"), label: "High" },
  { dimension: "urgency", key: "MEDIUM", weight: new Decimal("1"), label: "Medium" },
  { dimension: "urgency", key: "LOW", weight: new Decimal("1"), label: "Low" },
  { dimension: "size", key: "XS", weight: new Decimal("1"), label: "XS" },
  { dimension: "size", key: "S", weight: new Decimal("1"), label: "S" },
  { dimension: "size", key: "M", weight: new Decimal("1"), label: "M" },
  { dimension: "size", key: "L", weight: new Decimal("1"), label: "L" }
];

const TERMINAL = ["AWARDED", "CONTRACT_ISSUED", "CONVERTED", "LOST", "WITHDRAWN"];

function makeWorld(opts: {
  tenders?: FakeTender[];
  users?: FakeUser[];
  capacities?: FakeCapacityRow[];
  weights?: unknown[];
}) {
  const tenders = opts.tenders ?? [];
  const users = opts.users ?? [];
  const capacities = opts.capacities ?? [];

  const tenderFindMany = jest.fn(async (args: Record<string, any> = {}) => {
    const where = (args.where ?? {}) as Record<string, any>;
    let rows = [...tenders];

    if (where.allocationState !== undefined) {
      rows = rows.filter((t) => t.allocationState === where.allocationState);
    }

    const assigned = where.assignedEstimatorId;
    if (assigned !== undefined) {
      if (typeof assigned === "string") {
        rows = rows.filter((t) => t.assignedEstimatorId === assigned);
      } else if (assigned !== null && "not" in assigned && assigned.not === null) {
        rows = rows.filter((t) => t.assignedEstimatorId !== null);
      } else if (assigned !== null && "in" in assigned) {
        rows = rows.filter(
          (t) => t.assignedEstimatorId !== null && assigned.in.includes(t.assignedEstimatorId)
        );
      }
    }

    if (where.status?.notIn) {
      rows = rows.filter((t) => !where.status.notIn.includes(t.status));
    }

    if (args.distinct?.includes("assignedEstimatorId")) {
      const seen = new Set<string | null>();
      rows = rows.filter((t) => {
        if (seen.has(t.assignedEstimatorId)) return false;
        seen.add(t.assignedEstimatorId);
        return true;
      });
    }

    return rows;
  });

  return {
    allocationWeightConfig: {
      findMany: jest.fn().mockResolvedValue(opts.weights ?? FLAT_WEIGHT_ROWS)
    },
    estimatorCapacity: {
      findMany: jest.fn(async () => capacities),
      findUnique: jest.fn(
        async (args: any) => capacities.find((c) => c.userId === args.where.userId) ?? null
      ),
      upsert: jest.fn(async (args: any) => ({
        id: `cap-${args.where.userId}`,
        userId: args.where.userId,
        concurrentCap: args.create.concurrentCap ?? 5,
        availabilityPct: args.create.availabilityPct ?? 100
      }))
    },
    user: {
      findMany: jest.fn(async (args: any) =>
        users.filter((u) => args.where.id.in.includes(u.id))
      ),
      findUnique: jest.fn(async (args: any) => users.find((u) => u.id === args.where.id) ?? null)
    },
    tender: {
      findMany: tenderFindMany,
      findUnique: jest.fn(async (args: any) => tenders.find((t) => t.id === args.where.id) ?? null)
    },
    tenderAllocationCandidate: { findMany: jest.fn().mockResolvedValue([]) },
    tenderAllocationRejection: { findMany: jest.fn().mockResolvedValue([]) }
  };
}

// ── getAllEstimatorsSummary ───────────────────────────────────────────────────

describe("CapacityService.getAllEstimatorsSummary", () => {
  it("returns [] when nobody is assigned a tender and no capacity row exists", async () => {
    const prisma = makeWorld({});
    await expect(makeService(prisma as never).getAllEstimatorsSummary()).resolves.toStrictEqual([]);
  });

  it("computes the full row shape — utilizationPct, isOverloaded and openTenderCount", async () => {
    // amy: effectiveCap 4 x 75% = 3.0, two open tenders -> load 2.0 -> 66.7%
    // bob: effectiveCap 2 x 100% = 2.0, three open tenders -> load 3.0 -> 150%
    const prisma = makeWorld({
      users: [user("amy"), user("bob")],
      capacities: [capacityRow("amy", 4, 75), capacityRow("bob", 2, 100)],
      tenders: [
        tender({ id: "t1", assignedEstimatorId: "amy" }),
        tender({ id: "t2", assignedEstimatorId: "amy" }),
        // Terminal — counts for MEMBERSHIP but must not add load or count.
        tender({ id: "t3", assignedEstimatorId: "amy", status: "LOST" }),
        tender({ id: "t4", assignedEstimatorId: "bob" }),
        tender({ id: "t5", assignedEstimatorId: "bob" }),
        tender({ id: "t6", assignedEstimatorId: "bob" })
      ]
    });

    const summary = await makeService(prisma as never).getAllEstimatorsSummary();

    // toStrictEqual, not toEqual: an undefined property is treated as ABSENT by
    // toEqual, so a row that silently lost a field would still pass.
    expect(summary).toStrictEqual([
      {
        userId: "bob",
        displayName: "BOB Estimator",
        load: 3,
        effectiveCap: 2,
        utilizationPct: 150,
        isOverloaded: true,
        openTenderCount: 3,
        availabilityPct: 100,
        concurrentCap: 2,
        isActive: true
      },
      {
        userId: "amy",
        displayName: "AMY Estimator",
        load: 2,
        effectiveCap: 3,
        utilizationPct: 66.7,
        isOverloaded: false,
        openTenderCount: 2,
        availabilityPct: 75,
        concurrentCap: 4,
        isActive: true
      }
    ]);
  });

  it("includes an estimator who has a capacity row but no tender at all (load 0)", async () => {
    const prisma = makeWorld({
      users: [user("zoe")],
      capacities: [capacityRow("zoe", 5, 100)]
    });

    const summary = await makeService(prisma as never).getAllEstimatorsSummary();

    expect(summary.map((s) => s.userId)).toStrictEqual(["zoe"]);
    expect(summary[0].load).toBe(0);
    expect(summary[0].openTenderCount).toBe(0);
    expect(summary[0].utilizationPct).toBe(0);
    expect(summary[0].isOverloaded).toBe(false);
  });

  it("falls back to cap 5 / 100% for an estimator with tenders but no capacity row", async () => {
    const prisma = makeWorld({
      users: [user("ned")],
      tenders: [tender({ id: "t1", assignedEstimatorId: "ned" })]
    });

    const [row] = await makeService(prisma as never).getAllEstimatorsSummary();

    expect(row.concurrentCap).toBe(5);
    expect(row.availabilityPct).toBe(100);
    expect(row.effectiveCap).toBe(5);
  });

  it("reports utilizationPct 999 rather than Infinity when effectiveCap is 0", async () => {
    const prisma = makeWorld({
      users: [user("nil")],
      capacities: [capacityRow("nil", 0, 100)]
    });

    const [row] = await makeService(prisma as never).getAllEstimatorsSummary();

    expect(row.effectiveCap).toBe(0);
    expect(row.utilizationPct).toBe(999);
    expect(Number.isFinite(row.utilizationPct)).toBe(true);
  });

  it("keeps a DEACTIVATED estimator on the board so their open work stays visible", async () => {
    const prisma = makeWorld({
      users: [user("gone", false)],
      tenders: [tender({ id: "t1", assignedEstimatorId: "gone" })]
    });

    const [row] = await makeService(prisma as never).getAllEstimatorsSummary();

    expect(row.userId).toBe("gone");
    expect(row.isActive).toBe(false);
    expect(row.openTenderCount).toBe(1);
  });

  it("skips an assigned id whose User row no longer exists rather than inventing one", async () => {
    const prisma = makeWorld({
      users: [],
      tenders: [tender({ id: "t1", assignedEstimatorId: "ghost" })]
    });

    await expect(makeService(prisma as never).getAllEstimatorsSummary()).resolves.toStrictEqual([]);
  });
});

// ── suggestEstimator ──────────────────────────────────────────────────────────

describe("CapacityService.suggestEstimator", () => {
  it("returns null when every estimator is overloaded", async () => {
    const prisma = makeWorld({
      users: [user("amy"), user("bob")],
      capacities: [capacityRow("amy", 1, 100), capacityRow("bob", 2, 100)],
      tenders: [
        tender({ id: "target", allocationState: "UNALLOCATED" }),
        tender({ id: "a1", assignedEstimatorId: "amy" }),
        tender({ id: "a2", assignedEstimatorId: "amy" }),
        tender({ id: "b1", assignedEstimatorId: "bob" }),
        tender({ id: "b2", assignedEstimatorId: "bob" }),
        tender({ id: "b3", assignedEstimatorId: "bob" })
      ]
    });

    await expect(makeService(prisma as never).suggestEstimator("target")).resolves.toBeNull();
  });

  it("returns the least-loaded estimator by load/effectiveCap RATIO, not by raw load", async () => {
    // amy: load 5 / cap 10 -> 0.50    bob: load 1 / cap 4 -> 0.25
    // Raw load would also pick bob, so make amy's raw load the SMALLER one:
    // amy: load 4 / cap 5 -> 0.80     bob: load 5 / cap 20 -> 0.25
    const prisma = makeWorld({
      users: [user("amy"), user("bob")],
      capacities: [capacityRow("amy", 5, 100), capacityRow("bob", 20, 100)],
      tenders: [
        tender({ id: "target", allocationState: "UNALLOCATED" }),
        ...[1, 2, 3, 4].map((n) => tender({ id: `a${n}`, assignedEstimatorId: "amy" })),
        ...[1, 2, 3, 4, 5].map((n) => tender({ id: `b${n}`, assignedEstimatorId: "bob" }))
      ]
    });

    await expect(makeService(prisma as never).suggestEstimator("target")).resolves.toBe("bob");
  });

  it("never suggests a deactivated estimator, even when they are the emptiest", async () => {
    const prisma = makeWorld({
      users: [user("gone", false), user("dave")],
      capacities: [capacityRow("gone", 10, 100), capacityRow("dave", 10, 100)],
      tenders: [
        tender({ id: "target", allocationState: "UNALLOCATED" }),
        ...[1, 2, 3, 4, 5].map((n) => tender({ id: `d${n}`, assignedEstimatorId: "dave" }))
      ]
    });

    const service = makeService(prisma as never);

    // "gone" has load 0 and would win the ratio outright.
    expect((await service.getAllEstimatorsSummary()).map((s) => s.userId)).toContain("gone");
    await expect(service.suggestEstimator("target")).resolves.toBe("dave");
  });

  it("throws NotFound for an unknown tender instead of returning null", async () => {
    const prisma = makeWorld({ users: [user("amy")], capacities: [capacityRow("amy", 5)] });

    await expect(makeService(prisma as never).suggestEstimator("nope")).rejects.toThrow(
      NotFoundException
    );
  });
});

// ── suggestEstimatorWithReason ────────────────────────────────────────────────

describe("CapacityService.suggestEstimatorWithReason", () => {
  it("returns the id plus a displayable one-line reason quoting load, cap and pct", async () => {
    const prisma = makeWorld({
      users: [user("amy")],
      capacities: [capacityRow("amy", 4, 75)],
      tenders: [
        tender({ id: "target", allocationState: "UNALLOCATED" }),
        tender({ id: "a1", assignedEstimatorId: "amy" }),
        tender({ id: "a2", assignedEstimatorId: "amy" })
      ]
    });

    const result = await makeService(prisma as never).suggestEstimatorWithReason("target");

    expect(result.suggestedEstimatorId).toBe("amy");
    // amy: load 2.0 of effectiveCap 3.0 = 66.7%
    expect(result.reason).toBe(
      "Least loaded: 2.0 / 3.0 effective capacity (66.7%); this tender adds 1.0."
    );
  });

  it("explains the null case when everyone is over capacity", async () => {
    const prisma = makeWorld({
      users: [user("amy")],
      capacities: [capacityRow("amy", 1, 100)],
      tenders: [
        tender({ id: "target", allocationState: "UNALLOCATED" }),
        tender({ id: "a1", assignedEstimatorId: "amy" }),
        tender({ id: "a2", assignedEstimatorId: "amy" })
      ]
    });

    const result = await makeService(prisma as never).suggestEstimatorWithReason("target");

    expect(result.suggestedEstimatorId).toBeNull();
    expect(result.reason).toContain("at or over capacity");
  });

  it("explains the null case when the board is empty", async () => {
    const prisma = makeWorld({ tenders: [tender({ id: "target", allocationState: "UNALLOCATED" })] });

    const result = await makeService(prisma as never).suggestEstimatorWithReason("target");

    expect(result.suggestedEstimatorId).toBeNull();
    expect(result.reason).toContain("No estimators on the board yet");
  });
});

// ── getCapacityBoard ──────────────────────────────────────────────────────────

describe("CapacityService.getCapacityBoard", () => {
  function boardWorld() {
    return makeWorld({
      users: [user("amy")],
      capacities: [capacityRow("amy", 5, 100)],
      tenders: [
        tender({ id: "u1", allocationState: "UNALLOCATED", status: "DRAFT" }),
        // UNALLOCATED but closed — must NOT be offered for allocation.
        tender({ id: "u2", allocationState: "UNALLOCATED", status: "LOST" }),
        tender({ id: "a1", assignedEstimatorId: "amy" })
      ]
    });
  }

  it("lists unallocated tenders with a suggested estimator and skips closed ones", async () => {
    const board = await makeService(boardWorld() as never).getCapacityBoard();

    expect(board.unallocated.map((t) => t.tenderId)).toStrictEqual(["u1"]);
    expect(board.unallocated[0].suggestedEstimatorId).toBe("amy");
    expect(board.estimators.map((e) => e.userId)).toStrictEqual(["amy"]);
  });

  it("annotates each unallocated tender with its own urgency, size and load", async () => {
    const board = await makeService(boardWorld() as never).getCapacityBoard();

    expect(board.unallocated[0]).toStrictEqual({
      tenderId: "u1",
      tenderNumber: "T-u1",
      title: "Tender u1",
      dueDate: null,
      estimatedValue: null,
      urgencyKey: "MEDIUM",
      sizeBand: "M",
      load: 1,
      suggestedEstimatorId: "amy"
    });
  });

  it("selects unallocated tenders with NO updatedAt predicate (EW-2c clock defect)", async () => {
    // Regression guard. EW-2c's detectUnallocated() filters on Tender.updatedAt,
    // which any edit resets — it does not measure time-spent-unallocated, and it
    // is evaluated against the app clock while updatedAt is written by the DB
    // clock, so a just-edited tender can vanish from the board. The board must
    // not inherit that: its predicate is allocationState + status only.
    const prisma = boardWorld();
    await makeService(prisma as never).getCapacityBoard();

    const unallocatedCalls = prisma.tender.findMany.mock.calls.filter(
      (call: any[]) => call[0]?.where?.allocationState === "UNALLOCATED"
    );

    expect(unallocatedCalls).toHaveLength(1);
    const where = (unallocatedCalls[0] as any[])[0].where;
    expect(Object.keys(where).sort()).toStrictEqual(["allocationState", "status"]);
    expect(where.updatedAt).toBeUndefined();
    expect(where.status.notIn.sort()).toStrictEqual([...TERMINAL].sort());
  });
});

// ── getAllocationHistory ──────────────────────────────────────────────────────

describe("CapacityService.getAllocationHistory", () => {
  it("returns state, assignee, candidates and rejections for the tender", async () => {
    const prisma = makeWorld({
      tenders: [
        tender({ id: "t1", allocationState: "REJECTED", assignedEstimatorId: null })
      ]
    });
    prisma.tenderAllocationCandidate.findMany.mockResolvedValue([
      { id: "c1", estimatorId: "amy", offeredAt: new Date("2026-02-01"), claimedAt: null }
    ]);
    prisma.tenderAllocationRejection.findMany.mockResolvedValue([
      { id: "r1", rejectedBy: "amy", reason: "No capacity", rejectedAt: new Date("2026-02-02") }
    ]);

    const history = await makeService(prisma as never).getAllocationHistory("t1");

    expect(history).toStrictEqual({
      allocationState: "REJECTED",
      assignedEstimatorId: null,
      candidates: [
        { id: "c1", estimatorId: "amy", offeredAt: new Date("2026-02-01"), claimedAt: null }
      ],
      rejections: [
        { id: "r1", rejectedBy: "amy", reason: "No capacity", rejectedAt: new Date("2026-02-02") }
      ]
    });
  });

  it("throws NotFound for an unknown tender", async () => {
    await expect(
      makeService(makeWorld({}) as never).getAllocationHistory("nope")
    ).rejects.toThrow(NotFoundException);
  });
});

// ── upsertEstimatorCapacity ───────────────────────────────────────────────────

describe("CapacityService.upsertEstimatorCapacity", () => {
  function writeWorld() {
    return makeWorld({ users: [user("amy")] });
  }

  it("rejects an empty body rather than silently creating a default row", async () => {
    const prisma = writeWorld();

    await expect(
      makeService(prisma as never).upsertEstimatorCapacity("amy", {}, "actor")
    ).rejects.toThrow(BadRequestException);
    expect(prisma.estimatorCapacity.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["availabilityPct above 100", { availabilityPct: 400 }],
    ["negative availabilityPct", { availabilityPct: -1 }],
    ["fractional availabilityPct", { availabilityPct: 50.5 }],
    ["negative concurrentCap", { concurrentCap: -1 }],
    ["fractional concurrentCap", { concurrentCap: 2.5 }]
  ])("rejects %s at the service, not only at the DTO", async (_label, input) => {
    const prisma = writeWorld();

    await expect(
      makeService(prisma as never).upsertEstimatorCapacity("amy", input, "actor")
    ).rejects.toThrow(BadRequestException);
    expect(prisma.estimatorCapacity.upsert).not.toHaveBeenCalled();
  });

  it("accepts concurrentCap 0 — taking no new work is legitimate", async () => {
    const prisma = writeWorld();

    const result = await makeService(prisma as never).upsertEstimatorCapacity(
      "amy",
      { concurrentCap: 0 },
      "actor"
    );

    expect(result.concurrentCap).toBe(0);
    expect(result.effectiveCap).toBe(0);
  });

  it("throws NotFound for an unknown user instead of letting the FK 500", async () => {
    const prisma = writeWorld();

    await expect(
      makeService(prisma as never).upsertEstimatorCapacity("ghost", { concurrentCap: 3 }, "actor")
    ).rejects.toThrow(NotFoundException);
    expect(prisma.estimatorCapacity.upsert).not.toHaveBeenCalled();
  });

  it("writes only the supplied fields and returns the recomputed effectiveCap", async () => {
    const prisma = writeWorld();

    const result = await makeService(prisma as never).upsertEstimatorCapacity(
      "amy",
      { availabilityPct: 50 },
      "actor"
    );

    const args = prisma.estimatorCapacity.upsert.mock.calls[0][0];
    expect(args.where).toStrictEqual({ userId: "amy" });
    expect(args.update).toStrictEqual({ availabilityPct: 50 });
    expect(args.create).toStrictEqual({ userId: "amy", availabilityPct: 50 });
    // concurrentCap falls back to the schema default of 5 -> 5 x 50% = 2.5
    expect(result).toStrictEqual({
      userId: "amy",
      availabilityPct: 50,
      concurrentCap: 5,
      effectiveCap: 2.5
    });
  });

  it("audits the write with the previous values", async () => {
    const prisma = writeWorld();
    const audit = makeAudit();

    await makeService(prisma as never, audit).upsertEstimatorCapacity(
      "amy",
      { concurrentCap: 7 },
      "actor-1"
    );

    expect(audit.write).toHaveBeenCalledTimes(1);
    const entry = audit.write.mock.calls[0][0];
    expect(entry.actorId).toBe("actor-1");
    expect(entry.action).toBe("tenders.capacity.upsert");
    expect(entry.entityType).toBe("EstimatorCapacity");
    expect(entry.metadata).toStrictEqual({
      userId: "amy",
      created: true,
      previousAvailabilityPct: null,
      previousConcurrentCap: null,
      availabilityPct: 100,
      concurrentCap: 7
    });
  });
});
