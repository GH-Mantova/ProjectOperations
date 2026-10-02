/**
 * tender-win-rate.spec.ts
 *
 * Unit tests for the tender-win-rate report in reporting.service.ts.
 *
 * Covers:
 *   1. CONVERTED tender counts as awarded.
 *   2. With 3 awarded and 1 lost, totals.winRatePct is 75.
 *   3. The self-filter still applies to a plain estimator (EA-GATE).
 *   4. Each regression test must fail on origin/main when the production
 *      change is reverted (see inline comments).
 */

import { ReportingService } from "./reporting.service";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";

// ── Minimal estimator shape ───────────────────────────────────────────────────

function estimator(
  firstName: string,
  lastName: string,
  email = "est@test.com"
): { firstName: string; lastName: string; email: string } {
  return { firstName, lastName, email };
}

// ── Mock PrismaService factory ────────────────────────────────────────────────

function makePrisma(rows: object[]) {
  return {
    tender: {
      findMany: jest.fn().mockResolvedValue(rows)
    }
  };
}

// ── Tender row factory ────────────────────────────────────────────────────────

function tenderRow(status: string, est?: ReturnType<typeof estimator> | null) {
  return {
    status,
    estimator: est ?? estimator("Alice", "Smith"),
    assignedEstimator: null
  };
}

// ── AuthenticatedUser helpers ─────────────────────────────────────────────────

function plainEstimator(sub = "est-1"): AuthenticatedUser {
  return {
    sub,
    email: `${sub}@test.com`,
    permissions: ["reporting.view"],
    isSuperUser: false
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("tender-win-rate report", () => {
  // ── 1. CONVERTED counts as awarded ───────────────────────────────────────────
  // On origin/main the status filter was ["SUBMITTED", "AWARDED", "LOST",
  // "CONTRACT_ISSUED"]. CONVERTED was absent from both the query and the
  // awarded counter. This test fails on origin/main.

  it("CONVERTED tender counts as awarded (regression: CONVERTED absent from old query)", async () => {
    const rows = [
      tenderRow("CONVERTED"),
      tenderRow("LOST")
    ];
    const prisma = makePrisma(rows);
    const svc = new ReportingService(prisma as never);

    const result = await svc.run("tender-win-rate", {});

    // Single bucket for "Alice Smith"
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    // CONVERTED must be counted as awarded
    expect(row.awarded).toBe(1);
    expect(row.lost).toBe(1);
    // winRatePct = 1 / (1+1) * 100 = 50
    expect(row.winRatePct).toBe(50);
  });

  // ── 2. totals.winRatePct with 3 awarded and 1 lost → 75 ─────────────────────
  // On origin/main totals had no winRatePct key at all. This test fails on
  // origin/main because (a) CONVERTED was absent and (b) totals lacked the key.

  it("totals.winRatePct is 75 for 3 awarded (AWARDED + CONTRACT_ISSUED + CONVERTED) and 1 lost", async () => {
    const rows = [
      tenderRow("AWARDED"),
      tenderRow("CONTRACT_ISSUED"),
      tenderRow("CONVERTED"),
      tenderRow("LOST")
    ];
    const prisma = makePrisma(rows);
    const svc = new ReportingService(prisma as never);

    const result = await svc.run("tender-win-rate", {});

    expect(result.totals).toBeDefined();
    // 3 awarded, 1 lost → 3/4 = 75%
    expect(result.totals!.winRatePct).toBe(75);
    expect(result.totals!.awarded).toBe(3);
    expect(result.totals!.lost).toBe(1);
  });

  // ── totals.winRatePct is 0 when nothing is resolved ──────────────────────────

  it("totals.winRatePct is 0 when no tenders are resolved (only SUBMITTED)", async () => {
    const rows = [
      tenderRow("SUBMITTED"),
      tenderRow("SUBMITTED")
    ];
    const prisma = makePrisma(rows);
    const svc = new ReportingService(prisma as never);

    const result = await svc.run("tender-win-rate", {});

    expect(result.totals!.winRatePct).toBe(0);
    expect(result.totals!.awarded).toBe(0);
    expect(result.totals!.lost).toBe(0);
  });

  // ── 3. Self-filter still applies to a plain estimator ────────────────────────

  it("plain estimator: assignedEstimatorId self-filter appears in Prisma where (EA-GATE)", async () => {
    const prisma = makePrisma([]);
    const svc = new ReportingService(prisma as never);

    await svc.run("tender-win-rate", { currentUser: plainEstimator("est-gate") });

    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { assignedEstimatorId?: string };
    };
    // This assertion fails if resolveSelfFilter is removed from the where clause.
    expect(callArg.where.assignedEstimatorId).toBe("est-gate");
  });

  // ── 4. Prisma query status filter includes CONVERTED ─────────────────────────
  // This is the direct regression check for the query-level fix.
  // On origin/main the filter was ["SUBMITTED", "AWARDED", "LOST", "CONTRACT_ISSUED"].

  it("Prisma findMany status filter includes CONVERTED (regression: absent on origin/main)", async () => {
    const prisma = makePrisma([]);
    const svc = new ReportingService(prisma as never);

    await svc.run("tender-win-rate", {});

    const callArg = (prisma.tender.findMany as jest.Mock).mock.calls[0][0] as {
      where: { status: { in: string[] } };
    };
    expect(callArg.where.status.in).toContain("CONVERTED");
    expect(callArg.where.status.in).toContain("AWARDED");
    expect(callArg.where.status.in).toContain("CONTRACT_ISSUED");
    expect(callArg.where.status.in).toContain("SUBMITTED");
    expect(callArg.where.status.in).toContain("LOST");
  });

  // ── Existing behaviour preserved: AWARDED and CONTRACT_ISSUED also awarded ────

  it("AWARDED and CONTRACT_ISSUED both count as awarded", async () => {
    const rows = [
      tenderRow("AWARDED"),
      tenderRow("CONTRACT_ISSUED"),
      tenderRow("LOST")
    ];
    const prisma = makePrisma(rows);
    const svc = new ReportingService(prisma as never);

    const result = await svc.run("tender-win-rate", {});

    const row = result.rows[0];
    expect(row.awarded).toBe(2);
    expect(row.lost).toBe(1);
    // winRatePct = 2 / 3 ≈ 66.7
    expect(row.winRatePct).toBeCloseTo(66.7, 1);
  });
});
