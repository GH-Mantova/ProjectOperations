/**
 * estimating-analytics-report.definitions.spec.ts
 *
 * Unit tests for EA-1 report definitions.
 * Uses the mock-Prisma pattern from win-likelihood.service.spec.ts:
 * a plain object with jest.fn() methods, no @prisma/client dependency.
 */

import {
  ESTIMATING_ANALYTICS_REPORT_DEFS,
  type ReportRunParams
} from "./estimating-analytics-report.definitions";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// ── Minimal Decimal shim ─────────────────────────────────────────────────────

class FakeDecimal {
  constructor(private readonly value: number) {}
  toString() {
    return String(this.value);
  }
  toNumber() {
    return this.value;
  }
}

function dec(v: number) {
  return new FakeDecimal(v) as unknown as import("@prisma/client").Prisma.Decimal;
}

// ── Mock PrismaService factory ───────────────────────────────────────────────

function makePrisma(rows: object[]): { tender: { findMany: jest.Mock } } {
  return {
    tender: {
      findMany: jest.fn().mockResolvedValue(rows)
    }
  };
}

// ── Helper: build a minimal tender row ──────────────────────────────────────

function tenderRow(overrides: {
  createdAt?: Date;
  submittedAt?: Date | null;
  estimatedValue?: unknown;
  assignedEstimator?: { firstName: string | null; lastName: string | null; email: string } | null;
  estimator?: { firstName: string | null; lastName: string | null; email: string } | null;
}) {
  return {
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
    submittedAt: overrides.submittedAt !== undefined ? overrides.submittedAt : new Date("2025-01-11"),
    estimatedValue: overrides.estimatedValue !== undefined ? overrides.estimatedValue : null,
    assignedEstimator: overrides.assignedEstimator !== undefined ? overrides.assignedEstimator : null,
    estimator: overrides.estimator !== undefined ? overrides.estimator : null
  };
}

// ── Helpers to grab definitions ──────────────────────────────────────────────

const turnaroundDef = ESTIMATING_ANALYTICS_REPORT_DEFS.find(
  (d) => d.key === "estimator-turnaround"
)!;
const qtyValueDef = ESTIMATING_ANALYTICS_REPORT_DEFS.find(
  (d) => d.key === "estimator-qty-vs-value"
)!;

function baseParams(overrides: Partial<ReportRunParams> = {}): ReportRunParams {
  return { ...overrides };
}

function managerUser(): AuthenticatedUser {
  return { sub: "user-manager", email: "manager@test.com", permissions: ["reporting.view"], isSuperUser: true };
}

function estimatorUser(id = "user-estimator"): AuthenticatedUser {
  return { sub: id, email: `${id}@test.com`, permissions: ["reporting.view"], isSuperUser: false };
}

// ── Definition metadata assertions ──────────────────────────────────────────

describe("ESTIMATING_ANALYTICS_REPORT_DEFS", () => {
  it("exports exactly 2 definitions", () => {
    expect(ESTIMATING_ANALYTICS_REPORT_DEFS).toHaveLength(2);
  });

  it("turnaround def has expected key and chart", () => {
    expect(turnaroundDef.key).toBe("estimator-turnaround");
    expect(turnaroundDef.chart?.type).toBe("bar");
    expect(turnaroundDef.chart?.xKey).toBe("estimator");
    expect(turnaroundDef.chart?.yKey).toBe("avgDaysToQuote");
    expect(turnaroundDef.chart?.unit).toBe("days");
  });

  it("qty-vs-value def has expected key and chart", () => {
    expect(qtyValueDef.key).toBe("estimator-qty-vs-value");
    expect(qtyValueDef.chart?.type).toBe("bar");
    expect(qtyValueDef.chart?.xKey).toBe("estimator");
    expect(qtyValueDef.chart?.yKey).toBe("sumEstimatedValue");
  });
});

// ── estimator-turnaround ─────────────────────────────────────────────────────

describe("estimator-turnaround run()", () => {
  it("excludes still-open tender: row with null submittedAt is skipped (not counted as 0)", async () => {
    const rows = [
      tenderRow({
        submittedAt: null, // still-open — must be excluded
        assignedEstimator: { firstName: "Alice", lastName: "Smith", email: "alice@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await turnaroundDef.run(prisma as never, baseParams());
    expect(result.rows).toHaveLength(0);
  });

  it("two tenders for same estimator average correctly (10 + 20 = avg 15)", async () => {
    const created = new Date("2025-01-01");
    const rows = [
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-11"), // 10 days
        assignedEstimator: { firstName: "Bob", lastName: null, email: "bob@test.com" }
      }),
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-21"), // 20 days
        assignedEstimator: { firstName: "Bob", lastName: null, email: "bob@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await turnaroundDef.run(prisma as never, baseParams());
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].estimator).toBe("Bob");
    expect(result.rows[0].count).toBe(2);
    expect(result.rows[0].avgDaysToQuote).toBe(15);
    expect(result.rows[0].medianDaysToQuote).toBe(15); // (10+20)/2
  });

  it("sort order: longest avgDaysToQuote first", async () => {
    const created = new Date("2025-01-01");
    const rows = [
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-06"), // 5 days → Alice
        assignedEstimator: { firstName: "Alice", lastName: null, email: "alice@test.com" }
      }),
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-31"), // 30 days → Bob
        assignedEstimator: { firstName: "Bob", lastName: null, email: "bob@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await turnaroundDef.run(prisma as never, baseParams());
    expect(result.rows[0].estimator).toBe("Bob");
    expect(result.rows[1].estimator).toBe("Alice");
  });

  it("falls back to estimator field when assignedEstimator is null", async () => {
    const created = new Date("2025-01-01");
    const rows = [
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-11"), // 10 days
        assignedEstimator: null,
        estimator: { firstName: "Carol", lastName: "Jones", email: "carol@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await turnaroundDef.run(prisma as never, baseParams());
    expect(result.rows[0].estimator).toBe("Carol Jones");
  });

  it("null submittedAt is NOT counted as zero days — row is skipped entirely", async () => {
    const created = new Date("2025-01-01");
    const rows = [
      tenderRow({
        createdAt: created,
        submittedAt: new Date("2025-01-11"),
        assignedEstimator: { firstName: "Dave", lastName: null, email: "dave@test.com" }
      }),
      tenderRow({
        createdAt: created,
        submittedAt: null, // skip this one
        assignedEstimator: { firstName: "Dave", lastName: null, email: "dave@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await turnaroundDef.run(prisma as never, baseParams());
    // Only 1 of 2 Dave tenders counts.
    expect(result.rows[0].count).toBe(1);
    expect(result.rows[0].avgDaysToQuote).toBe(10);
  });

  it("is read-only: run() does not call any create/update/delete", async () => {
    const prisma = makePrisma([]);
    await turnaroundDef.run(prisma as never, baseParams());
    expect((prisma.tender as { findMany: jest.Mock }).findMany).toHaveBeenCalledTimes(1);
    // No create/update/delete methods exist on the mock → any call would throw.
    // Reaching here proves no mutation was attempted.
  });
});

// ── estimator-qty-vs-value ───────────────────────────────────────────────────

describe("estimator-qty-vs-value run()", () => {
  it("null estimatedValue is excluded via where clause", async () => {
    const prisma = makePrisma([]);
    await qtyValueDef.run(prisma as never, baseParams());
    // Verify the Prisma where clause contains estimatedValue: { not: null }
    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { estimatedValue?: unknown };
    };
    expect(callArg.where.estimatedValue).toEqual({ not: null });
  });

  it("Decimal converted via decimalToNumber(); sum and count grouped by estimator", async () => {
    const rows = [
      tenderRow({
        estimatedValue: dec(100_000),
        assignedEstimator: { firstName: "Frank", lastName: null, email: "frank@test.com" }
      }),
      tenderRow({
        estimatedValue: dec(200_000),
        assignedEstimator: { firstName: "Frank", lastName: null, email: "frank@test.com" }
      }),
      tenderRow({
        estimatedValue: dec(50_000),
        assignedEstimator: { firstName: "Grace", lastName: null, email: "grace@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await qtyValueDef.run(prisma as never, baseParams());
    // Frank: 2 tenders, $300k
    const frank = result.rows.find((r) => r.estimator === "Frank");
    expect(frank).toBeDefined();
    expect(frank!.priced).toBe(2);
    expect(frank!.sumEstimatedValue).toBe(300_000);
    // Grace: 1 tender, $50k
    const grace = result.rows.find((r) => r.estimator === "Grace");
    expect(grace).toBeDefined();
    expect(grace!.priced).toBe(1);
    expect(grace!.sumEstimatedValue).toBe(50_000);
  });

  it("sort order: largest sumEstimatedValue first", async () => {
    const rows = [
      tenderRow({
        estimatedValue: dec(50_000),
        assignedEstimator: { firstName: "Alice", lastName: null, email: "alice@test.com" }
      }),
      tenderRow({
        estimatedValue: dec(500_000),
        assignedEstimator: { firstName: "Bob", lastName: null, email: "bob@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await qtyValueDef.run(prisma as never, baseParams());
    expect(result.rows[0].estimator).toBe("Bob");
    expect(result.rows[1].estimator).toBe("Alice");
  });

  it("totals sum all rows", async () => {
    const rows = [
      tenderRow({
        estimatedValue: dec(100_000),
        assignedEstimator: { firstName: "Alice", lastName: null, email: "alice@test.com" }
      }),
      tenderRow({
        estimatedValue: dec(200_000),
        assignedEstimator: { firstName: "Bob", lastName: null, email: "bob@test.com" }
      })
    ];
    const prisma = makePrisma(rows);
    const result = await qtyValueDef.run(prisma as never, baseParams());
    expect(result.totals?.priced).toBe(2);
    expect(result.totals?.sumEstimatedValue).toBe(300_000);
  });

  it("is read-only: run() does not call any create/update/delete", async () => {
    const prisma = makePrisma([]);
    await qtyValueDef.run(prisma as never, baseParams());
    expect((prisma.tender as { findMany: jest.Mock }).findMany).toHaveBeenCalledTimes(1);
  });
});

// ── EA-D5 Role gate ──────────────────────────────────────────────────────────

describe("EA-D5 role-gate", () => {
  it("estimator self-view: where clause includes assignedEstimatorId = currentUser.sub", async () => {
    const prisma = makePrisma([]);
    const params = baseParams({ currentUser: estimatorUser("user-est-1") });
    await turnaroundDef.run(prisma as never, params);
    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    expect(callArg.where.assignedEstimatorId).toBe("user-est-1");
  });

  it("manager view (isSuperUser=true): no assignedEstimatorId self-filter in where", async () => {
    const prisma = makePrisma([]);
    const params = baseParams({ currentUser: managerUser() });
    await turnaroundDef.run(prisma as never, params);
    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    // No self-filter — may have assignedEstimatorId only if estimatorId param was set.
    expect(callArg.where.assignedEstimatorId).toBeUndefined();
  });

  it("estimator self-view on qty-vs-value: where clause includes assignedEstimatorId", async () => {
    const prisma = makePrisma([]);
    const params = baseParams({ currentUser: estimatorUser("user-est-2") });
    await qtyValueDef.run(prisma as never, params);
    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    expect(callArg.where.assignedEstimatorId).toBe("user-est-2");
  });

  it("manager view on qty-vs-value: no self-filter", async () => {
    const prisma = makePrisma([]);
    const params = baseParams({ currentUser: managerUser() });
    await qtyValueDef.run(prisma as never, params);
    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    expect(callArg.where.assignedEstimatorId).toBeUndefined();
  });
});
