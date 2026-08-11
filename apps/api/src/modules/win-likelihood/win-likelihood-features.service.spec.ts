import { NotFoundException } from "@nestjs/common";
import { WinLikelihoodFeaturesService, VALUE_BAND_EDGES } from "./win-likelihood-features.service";

// Use string literals matching the TenderOutcomeResult enum values from schema.prisma.
// The enum values are WON / LOST / NO_BID — avoiding a direct @prisma/client import
// so this test file is runnable even before prisma:generate has been re-run.
const TenderOutcomeResult = {
  WON: "WON" as const,
  LOST: "LOST" as const,
  NO_BID: "NO_BID" as const
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TenderOutcomeResultLiteral = typeof TenderOutcomeResult[keyof typeof TenderOutcomeResult];

function makeOutcome(
  id: string,
  resultType: TenderOutcomeResultLiteral | null,
  supersededBy: { id: string } | null = null
) {
  return { id, resultType, supersededBy };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tender: {
      findUnique: jest.fn(),
      ...((overrides.tender as object | undefined) ?? {})
    },
    tenderClient: {
      findMany: jest.fn(),
      ...((overrides.tenderClient as object | undefined) ?? {})
    },
    ...overrides
  };
}

const BASE_TENDER = {
  id: "t-1",
  estimatedValue: null,
  dueDate: null,
  createdAt: new Date("2024-03-15T00:00:00Z"),
  tenderClients: []
};

// ─── Value-band bucketing ─────────────────────────────────────────────────────

describe("VALUE_BAND_EDGES", () => {
  it("has four bands with ascending maxExclusive", () => {
    expect(VALUE_BAND_EDGES).toHaveLength(4);
    for (let idx = 0; idx < VALUE_BAND_EDGES.length - 1; idx++) {
      expect(VALUE_BAND_EDGES[idx].maxExclusive).toBeLessThan(
        VALUE_BAND_EDGES[idx + 1].maxExclusive
      );
    }
  });
});

describe("WinLikelihoodFeaturesService — extractFeatures", () => {
  it("throws NotFoundException when tender not found", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    await expect(svc.extractFeatures("no-such-id")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("buckets estimatedValue into <50k band", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: { toNumber: () => 30_000 },
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.valueBand).toBe("<50k");
    expect(features.captureGaps).not.toContain("estimatedValue");
  });

  it("buckets estimatedValue into 50-250k band", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: { toNumber: () => 100_000 },
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.valueBand).toBe("50-250k");
  });

  it("buckets estimatedValue into 250k-1M band", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: { toNumber: () => 500_000 },
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.valueBand).toBe("250k-1M");
  });

  it("buckets estimatedValue into >1M band", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: { toNumber: () => 2_000_000 },
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.valueBand).toBe(">1M");
  });

  it("uses UNKNOWN band and records captureGap when estimatedValue is null", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: null,
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.valueBand).toBe("UNKNOWN");
    expect(features.captureGaps).toContain("estimatedValue");
  });

  it("records dueDate captureGap when dueDate is null", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      estimatedValue: null,
      dueDate: null
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.leadTimeDays).toBeNull();
    expect(features.captureGaps).toContain("dueDate");
  });

  it("computes correct leadTimeDays when dueDate is present", async () => {
    const prisma = makePrisma();
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const dueDate = new Date("2024-01-31T00:00:00Z"); // 30 days later
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      createdAt,
      dueDate
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.leadTimeDays).toBe(30);
    expect(features.captureGaps).not.toContain("dueDate");
  });

  it("always includes discipline in captureGaps (structural gap)", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      dueDate: new Date("2024-06-01T00:00:00Z")
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.captureGaps).toContain("discipline");
  });

  it("selects primary client by relationshipType=primary", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      tenderClients: [
        { clientId: "c-second", relationshipType: null },
        { clientId: "c-primary", relationshipType: "primary" }
      ]
    });
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    // computeClientHistory will be called — mock tenderClient.findMany
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([]);
    const features = await svc.extractFeatures("t-1");
    expect(features.primaryClientId).toBe("c-primary");
  });

  it("falls back to first client when none marked primary", async () => {
    const prisma = makePrisma();
    (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_TENDER,
      tenderClients: [
        { clientId: "c-first", relationshipType: null },
        { clientId: "c-second", relationshipType: null }
      ]
    });
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([]);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const features = await svc.extractFeatures("t-1");
    expect(features.primaryClientId).toBe("c-first");
  });
});

// ─── Client history win-rate ──────────────────────────────────────────────────

describe("WinLikelihoodFeaturesService — computeClientHistory", () => {
  it("returns wins=2, losses=1, winRate=0.667 for a 2W+1L client", async () => {
    const prisma = makePrisma();
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([
      { tender: { id: "t-a", outcomes: [makeOutcome("o-1", TenderOutcomeResult.WON)] } },
      { tender: { id: "t-b", outcomes: [makeOutcome("o-2", TenderOutcomeResult.WON)] } },
      { tender: { id: "t-c", outcomes: [makeOutcome("o-3", TenderOutcomeResult.LOST)] } }
    ]);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const result = await svc.computeClientHistory("c-1", "exclude-id");
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBeCloseTo(2 / 3, 5);
  });

  it("excludes NO_BID from denominator", async () => {
    const prisma = makePrisma();
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([
      { tender: { id: "t-a", outcomes: [makeOutcome("o-1", TenderOutcomeResult.WON)] } },
      { tender: { id: "t-b", outcomes: [makeOutcome("o-2", TenderOutcomeResult.NO_BID)] } },
      { tender: { id: "t-c", outcomes: [makeOutcome("o-3", TenderOutcomeResult.NO_BID)] } }
    ]);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const result = await svc.computeClientHistory("c-1", "exclude-id");
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(1);
  });

  it("returns winRate=null when no closed WON/LOST outcomes exist", async () => {
    const prisma = makePrisma();
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([]);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const result = await svc.computeClientHistory("c-1", "exclude-id");
    expect(result.winRate).toBeNull();
  });

  it("only counts the CURRENT (non-superseded) outcome, not superseded ones", async () => {
    const prisma = makePrisma();
    // Superseded outcome: resultType=LOST but it has supersededBy pointing to o-2
    // Current outcome: resultType=WON, supersededBy=null
    (prisma.tenderClient.findMany as jest.Mock).mockResolvedValue([
      {
        tender: {
          id: "t-a",
          outcomes: [
            // The superseded row — should NOT be counted
            makeOutcome("o-1", TenderOutcomeResult.LOST, { id: "o-2" }),
            // The current head — supersededBy=null (it's the head)
            makeOutcome("o-2", TenderOutcomeResult.WON, null)
          ]
        }
      }
    ]);
    const svc = new WinLikelihoodFeaturesService(prisma as never);
    const result = await svc.computeClientHistory("c-1", "exclude-id");
    // Only the current outcome (WON) should count, not the superseded LOST
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
  });
});
