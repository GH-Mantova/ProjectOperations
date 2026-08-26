import { Decimal } from "@prisma/client/runtime/library";
import { CapacityService } from "../capacity.service";

// ── Prisma mock helpers ───────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    allocationWeightConfig: {
      findMany: jest.fn().mockResolvedValue([])
    },
    estimatorCapacity: {
      findUnique: jest.fn().mockResolvedValue(null)
    },
    tender: {
      findMany: jest.fn().mockResolvedValue([])
    },
    ...overrides
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  return new CapacityService(prisma as never);
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
