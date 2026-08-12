import { PipelineDashboardService } from "../pipeline-dashboard.service";

// ── Mock Prisma ──────────────────────────────────────────────────────────────

type MockPrisma = {
  opportunity: { findMany: jest.Mock };
  tenderOutcome: { findMany: jest.Mock };
  account: { findMany: jest.Mock };
  contact: { findMany: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    opportunity: { findMany: jest.fn().mockResolvedValue([]) },
    tenderOutcome: { findMany: jest.fn().mockResolvedValue([]) },
    account: { findMany: jest.fn().mockResolvedValue([]) },
    contact: { findMany: jest.fn().mockResolvedValue([]) }
  };
}

function makeService(prisma: MockPrisma) {
  return new PipelineDashboardService(prisma as never);
}

// ── getPipelineByStage ───────────────────────────────────────────────────────

describe("PipelineDashboardService.getPipelineByStage", () => {
  it("buckets open opportunities by stage with weighted forecast maths", async () => {
    const prisma = makePrisma();
    prisma.opportunity.findMany.mockResolvedValue([
      { stage: "new", probability: 20, estimatedValue: "10000" },
      { stage: "qualified", probability: 50, estimatedValue: "20000" },
      { stage: "qualified", probability: 60, estimatedValue: "5000" },
      { stage: "quoting", probability: 80, estimatedValue: null }
    ]);

    const service = makeService(prisma);
    const result = await service.getPipelineByStage({});

    const qualified = result.buckets.find((b) => b.stage === "qualified");
    expect(qualified?.count).toBe(2);
    expect(qualified?.grossValue).toBe(25000);
    // 20000 * 0.5 + 5000 * 0.6 = 10000 + 3000
    expect(qualified?.weightedValue).toBe(13000);

    expect(result.totals.count).toBe(4);
    expect(result.totals.grossValue).toBe(35000);
    // 10000*.2 + 20000*.5 + 5000*.6 + 0 = 2000 + 10000 + 3000 + 0
    expect(result.totals.weightedValue).toBe(15000);
  });

  it("returns zeroed buckets when there are no open opportunities", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const result = await service.getPipelineByStage({});
    expect(result.totals).toEqual({ count: 0, grossValue: 0, weightedValue: 0 });
    for (const b of result.buckets) {
      expect(b.count).toBe(0);
      expect(b.grossValue).toBe(0);
      expect(b.weightedValue).toBe(0);
    }
  });

  it("filters by ownerId when provided", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.getPipelineByStage({ ownerId: "user-1" });
    const call = prisma.opportunity.findMany.mock.calls[0][0];
    expect(call.where.ownerId).toBe("user-1");
  });
});

// ── getWinRates ──────────────────────────────────────────────────────────────

describe("PipelineDashboardService.getWinRates", () => {
  const outcomeStub = (over: Partial<Record<string, unknown>>) => ({
    resultType: "WON",
    tenderValue: null,
    ourPrice: null,
    client: { id: "c-1", name: "Acme", industry: "Construction" },
    tender: { id: "t-1", estimator: { id: "u-1", firstName: "Ada", lastName: "L" } },
    ...over
  });

  it("computes win rate by client and excludes NO_BID from the denominator", async () => {
    const prisma = makePrisma();
    prisma.tenderOutcome.findMany.mockResolvedValue([
      outcomeStub({ resultType: "WON", tenderValue: "100000" }),
      outcomeStub({ resultType: "LOST" }),
      outcomeStub({ resultType: "NO_BID" }),
      outcomeStub({
        resultType: "WON",
        client: { id: "c-2", name: "Beta", industry: null },
        tender: { id: "t-2", estimator: null }
      })
    ]);

    const service = makeService(prisma);
    const rows = await service.getWinRates({ groupBy: "client" });

    const acme = rows.find((r) => r.key === "c-1");
    expect(acme).toBeDefined();
    expect(acme?.won).toBe(1);
    expect(acme?.lost).toBe(1);
    expect(acme?.noBid).toBe(1);
    expect(acme?.total).toBe(2);
    expect(acme?.winRate).toBe(0.5);
    expect(acme?.wonValue).toBe(100000);

    const beta = rows.find((r) => r.key === "c-2");
    expect(beta?.won).toBe(1);
    expect(beta?.winRate).toBe(1);
  });

  it("groups by sector using Client.industry (case-insensitive key)", async () => {
    const prisma = makePrisma();
    prisma.tenderOutcome.findMany.mockResolvedValue([
      outcomeStub({
        resultType: "WON",
        client: { id: "c-1", name: "Acme", industry: "Health" }
      }),
      outcomeStub({
        resultType: "LOST",
        client: { id: "c-2", name: "Beta", industry: "health" }
      }),
      outcomeStub({
        resultType: "WON",
        client: { id: "c-3", name: "Gamma", industry: null }
      })
    ]);

    const service = makeService(prisma);
    const rows = await service.getWinRates({ groupBy: "sector" });

    const health = rows.find((r) => r.key === "health");
    expect(health?.won).toBe(1);
    expect(health?.lost).toBe(1);
    expect(health?.total).toBe(2);

    const unknown = rows.find((r) => r.key === "__unknown_sector__");
    expect(unknown?.won).toBe(1);
  });

  it("groups by estimator via Tender.estimator", async () => {
    const prisma = makePrisma();
    prisma.tenderOutcome.findMany.mockResolvedValue([
      outcomeStub({
        resultType: "WON",
        tender: { id: "t-1", estimator: { id: "u-1", firstName: "Ada", lastName: "Lovelace" } }
      }),
      outcomeStub({
        resultType: "LOST",
        tender: { id: "t-2", estimator: { id: "u-1", firstName: "Ada", lastName: "Lovelace" } }
      }),
      outcomeStub({
        resultType: "WON",
        tender: { id: "t-3", estimator: null }
      })
    ]);

    const service = makeService(prisma);
    const rows = await service.getWinRates({ groupBy: "estimator" });

    const ada = rows.find((r) => r.key === "u-1");
    expect(ada?.label).toBe("Ada Lovelace");
    expect(ada?.winRate).toBe(0.5);

    const unassigned = rows.find((r) => r.key === "__unknown_estimator__");
    expect(unassigned?.won).toBe(1);
  });

  it("groups by source using the linked Opportunity.source", async () => {
    const prisma = makePrisma();
    prisma.tenderOutcome.findMany.mockResolvedValue([
      outcomeStub({ resultType: "WON", tender: { id: "t-1", estimator: null } }),
      outcomeStub({ resultType: "LOST", tender: { id: "t-2", estimator: null } })
    ]);
    prisma.opportunity.findMany.mockResolvedValue([
      { convertedTenderId: "t-1", source: "referral" },
      { convertedTenderId: "t-2", source: "referral" }
    ]);

    const service = makeService(prisma);
    const rows = await service.getWinRates({ groupBy: "source" });

    const referral = rows.find((r) => r.key === "referral");
    expect(referral?.label).toBe("referral");
    expect(referral?.won).toBe(1);
    expect(referral?.lost).toBe(1);
    expect(referral?.winRate).toBe(0.5);
  });

  it("ignores outcomes without resultType via the Prisma filter", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.getWinRates({ groupBy: "client" });
    const call = prisma.tenderOutcome.findMany.mock.calls[0][0];
    expect(call.where.resultType).toEqual({ not: null });
    expect(call.where.supersededBy).toBeNull();
  });
});

// ── getStalledOpportunities ──────────────────────────────────────────────────

describe("PipelineDashboardService.getStalledOpportunities", () => {
  it("flags open opportunities via overdue nextActionAt or stale updatedAt", async () => {
    const prisma = makePrisma();
    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const longAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    prisma.opportunity.findMany.mockResolvedValue([
      {
        id: "o-1",
        title: "Overdue next-action",
        stage: "qualified",
        probability: 40,
        estimatedValue: "50000",
        nextActionAt: yesterday,
        updatedAt: yesterday,
        clientId: "c-1",
        client: { id: "c-1", name: "Acme" },
        ownerId: "u-1",
        owner: { id: "u-1", firstName: "Ada", lastName: "L" }
      },
      {
        id: "o-2",
        title: "No next-action, stale update",
        stage: "new",
        probability: 20,
        estimatedValue: null,
        nextActionAt: null,
        updatedAt: longAgo,
        clientId: "c-2",
        client: { id: "c-2", name: "Beta" },
        ownerId: null,
        owner: null
      }
    ]);

    const service = makeService(prisma);
    const rows = await service.getStalledOpportunities({ thresholdDays: 14 });

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("o-1");
    expect(rows[0].estimatedValue).toBe(50000);
    expect(rows[0].weightedValue).toBe(20000);
    expect(rows[0].ownerName).toBe("Ada L");
    expect(rows[1].ownerName).toBeNull();
    expect(rows[1].daysSinceUpdate).toBeGreaterThanOrEqual(29);
  });

  it("uses a fallback threshold when input is invalid", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.getStalledOpportunities({ thresholdDays: -5 });
    // Just ensure no throw and Prisma call still occurred with an OR clause.
    const call = prisma.opportunity.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
  });
});

// ── getRelationshipCoverage ──────────────────────────────────────────────────

describe("PipelineDashboardService.getRelationshipCoverage", () => {
  it("summarises accounts by lifecycle status and primary-contact coverage", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([
      { id: "a-1", lifecycleStatus: "ACTIVE", clientId: "c-1" },
      { id: "a-2", lifecycleStatus: "ACTIVE", clientId: "c-2" },
      { id: "a-3", lifecycleStatus: "PROSPECT", clientId: null },
      { id: "a-4", lifecycleStatus: "PAST", clientId: "c-3" }
    ]);
    prisma.contact.findMany.mockResolvedValue([
      { organisationId: "c-1" }
      // c-2, c-3 have no primary contact
    ]);

    const service = makeService(prisma);
    const summary = await service.getRelationshipCoverage();

    expect(summary.totalAccounts).toBe(4);
    expect(summary.activeAccounts).toBe(2);
    expect(summary.prospectAccounts).toBe(1);
    expect(summary.pastAccounts).toBe(1);
    expect(summary.accountsWithPrimaryContact).toBe(1);
    expect(summary.accountsWithoutPrimaryContact).toBe(3);
    expect(summary.primaryContactCoverageRate).toBeCloseTo(0.25);
  });

  it("returns zeroed summary when there are no accounts", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const summary = await service.getRelationshipCoverage();
    expect(summary.totalAccounts).toBe(0);
    expect(summary.primaryContactCoverageRate).toBe(0);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });
});

// ── getDashboard ─────────────────────────────────────────────────────────────

describe("PipelineDashboardService.getDashboard", () => {
  it("composes the full dashboard payload in one call", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const result = await service.getDashboard({ stalledDays: 30 });

    expect(result.byStage.buckets.length).toBeGreaterThan(0);
    expect(result.winRates).toEqual({
      byClient: [],
      bySector: [],
      bySource: [],
      byEstimator: []
    });
    expect(result.stalled.thresholdDays).toBe(30);
    expect(result.relationshipCoverage.totalAccounts).toBe(0);
  });
});
