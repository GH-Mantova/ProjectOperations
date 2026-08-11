import {
  WinLikelihoodService,
  wilsonInterval,
  CONFIDENCE_THRESHOLDS
} from "./win-likelihood.service";
import { TenderFeatures } from "./win-likelihood-features.service";

// Use string literals matching the TenderOutcomeResult enum values from schema.prisma.
// Avoids a direct @prisma/client import so tests run before prisma:generate.
const TenderOutcomeResult = {
  WON: "WON" as const,
  LOST: "LOST" as const,
  NO_BID: "NO_BID" as const
};

// ─── Wilson interval unit tests ───────────────────────────────────────────────
// Known values computed from the standard formula (z=1.96, 95% CI).

describe("wilsonInterval", () => {
  it("returns [0,1] for total=0", () => {
    const result = wilsonInterval(0, 0);
    expect(result.low).toBe(0);
    expect(result.high).toBe(1);
  });

  it("10 wins out of 10 trials — high interval close to 1", () => {
    const result = wilsonInterval(10, 10);
    expect(result.low).toBeGreaterThan(0.6);
    expect(result.high).toBeCloseTo(1, 1);
  });

  it("0 wins out of 10 trials — interval close to [0, 0.28]", () => {
    const result = wilsonInterval(0, 10);
    expect(result.low).toBeCloseTo(0, 2);
    // Wilson (1927) formula: p_hat=0, z=1.96, n=10 gives high ≈ 0.278
    expect(result.high).toBeCloseTo(0.278, 2);
  });

  it("5 wins out of 10 trials — symmetric interval around 0.5", () => {
    const result = wilsonInterval(5, 10);
    expect(result.low).toBeCloseTo(0.237, 2);
    expect(result.high).toBeCloseTo(0.763, 2);
  });

  it("1 win out of 100 trials — tight low interval", () => {
    const result = wilsonInterval(1, 100);
    expect(result.low).toBeGreaterThanOrEqual(0);
    expect(result.high).toBeLessThan(0.06);
  });

  it("large cohort: 80 wins out of 100 — interval narrower than 0.2", () => {
    const result = wilsonInterval(80, 100);
    const width = result.high - result.low;
    // 80/100 Wilson gives width ≈ 0.155 — smaller than 0.2, confirming narrow CI
    expect(width).toBeLessThan(0.2);
  });
});

// ─── Confidence labels ────────────────────────────────────────────────────────

describe("CONFIDENCE_THRESHOLDS", () => {
  it("MEDIUM_MIN_COHORT < HIGH_MIN_COHORT", () => {
    expect(CONFIDENCE_THRESHOLDS.MEDIUM_MIN_COHORT).toBeLessThan(
      CONFIDENCE_THRESHOLDS.HIGH_MIN_COHORT
    );
  });
});

// ─── WinLikelihoodService — computeFromFeatures ───────────────────────────────

function makeFeatures(overrides: Partial<TenderFeatures> = {}): TenderFeatures {
  return {
    tenderId: "t-1",
    primaryClientId: "c-1",
    valueBand: "50-250k",
    leadTimeDays: 30,
    month: 3,
    season: "Q1",
    clientHistory: { wins: 5, losses: 3, winRate: 5 / 8 },
    captureGaps: ["discipline"],
    ...overrides
  };
}

type TenderOutcomeResultLiteral = typeof TenderOutcomeResult[keyof typeof TenderOutcomeResult];

function makeClosedTender(
  id: string,
  resultType: TenderOutcomeResultLiteral | null,
  clientId: string = "c-1",
  valueBand: "small" | "large" = "small"
) {
  return {
    id,
    estimatedValue:
      valueBand === "small"
        ? { toNumber: () => 100_000 } // 50-250k band
        : { toNumber: () => 2_000_000 }, // >1M band
    tenderClients: [{ clientId, relationshipType: null }],
    outcomes: [
      { id: `o-${id}`, resultType, supersededBy: null }
    ]
  };
}

function makePrisma(closedTenders: ReturnType<typeof makeClosedTender>[]) {
  return {
    tender: {
      findMany: jest.fn().mockResolvedValue(closedTenders),
      findUnique: jest.fn()
    },
    tenderClient: { findMany: jest.fn() }
  };
}

function makeFeaturesSvc(prisma: ReturnType<typeof makePrisma>) {
  const { WinLikelihoodFeaturesService } = require("./win-likelihood-features.service");
  const svc = new WinLikelihoodFeaturesService(prisma);
  return svc;
}

describe("WinLikelihoodService — computeFromFeatures", () => {
  it("returns pointEstimate=null and LOW confidence when no closed tenders", async () => {
    const prisma = makePrisma([]);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    expect(result.pointEstimate).toBeNull();
    expect(result.confidence).toBe("LOW");
    expect(result.cohortSize).toBe(0);
  });

  it("computes correct pointEstimate from matching cohort", async () => {
    // 3 WON, 1 LOST for c-1 in 50-250k band
    const closed = [
      makeClosedTender("a", TenderOutcomeResult.WON),
      makeClosedTender("b", TenderOutcomeResult.WON),
      makeClosedTender("c", TenderOutcomeResult.WON),
      makeClosedTender("d", TenderOutcomeResult.LOST)
    ];
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    expect(result.pointEstimate).toBeCloseTo(0.75, 5);
    expect(result.cohortSize).toBe(4);
  });

  it("Wilson interval is non-null when cohort > 0", async () => {
    const closed = [
      makeClosedTender("a", TenderOutcomeResult.WON),
      makeClosedTender("b", TenderOutcomeResult.LOST)
    ];
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    expect(result.interval).not.toBeNull();
    expect(result.interval!.low).toBeGreaterThanOrEqual(0);
    expect(result.interval!.high).toBeLessThanOrEqual(1);
  });

  it("thin cohort (<5) -> LOW confidence with wide interval", async () => {
    const closed = [
      makeClosedTender("a", TenderOutcomeResult.WON),
      makeClosedTender("b", TenderOutcomeResult.LOST)
    ];
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    expect(result.confidence).toBe("LOW");
    expect(result.interval!.high - result.interval!.low).toBeGreaterThan(0.3);
  });

  it("large cohort (>=15, width <=0.25) -> HIGH confidence", async () => {
    // 45 WON, 15 LOST = 60 total at 75% win rate.
    // Wilson CI for 45/60: width ≈ 0.214, which is <= HIGH_MAX_INTERVAL_WIDTH (0.25).
    const closed: ReturnType<typeof makeClosedTender>[] = [];
    for (let idx = 0; idx < 45; idx++) closed.push(makeClosedTender(`w${idx}`, TenderOutcomeResult.WON));
    for (let idx = 0; idx < 15; idx++) closed.push(makeClosedTender(`l${idx}`, TenderOutcomeResult.LOST));
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    // 60 total, width ≈ 0.214 → HIGH
    expect(result.confidence).toBe("HIGH");
  });

  it("widens cohort to value-band only when client has no closed outcomes", async () => {
    // Different client (c-2) in same value band — c-1 has no results
    const closed = [
      makeClosedTender("a", TenderOutcomeResult.WON, "c-2"), // different client, same band
      makeClosedTender("b", TenderOutcomeResult.LOST, "c-2")
    ];
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    // Should fall back to value-band cohort (c-2's 2 tenders) -> cohortSize=2
    expect(result.cohortSize).toBe(2);
  });

  it("includes discipline gap in captureGaps", async () => {
    const prisma = makePrisma([]);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(
      makeFeatures({ captureGaps: ["discipline", "estimatedValue"] }),
      "t-1"
    );
    expect(result.captureGaps).toContain("discipline");
  });

  it("why-factors are populated and ordered with client_history first", async () => {
    const closed = [
      makeClosedTender("a", TenderOutcomeResult.WON),
      makeClosedTender("b", TenderOutcomeResult.LOST)
    ];
    const prisma = makePrisma(closed);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    expect(result.whyFactors.length).toBeGreaterThan(0);
    // Client history factor should appear when clientHistory is present
    const clientFactor = result.whyFactors.find(
      (f) => f.factor === "client_history"
    );
    expect(clientFactor).toBeDefined();
  });

  it("why-factors include insufficient_data when cohortSize=0", async () => {
    const prisma = makePrisma([]);
    const featuresSvc = makeFeaturesSvc(prisma);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const result = await svc.computeFromFeatures(makeFeatures(), "t-1");
    const factor = result.whyFactors.find((f) => f.factor === "insufficient_data");
    expect(factor).toBeDefined();
    expect(factor!.direction).toBe("NEUTRAL");
  });
});

// ─── aggregateCaptureGaps ─────────────────────────────────────────────────────

describe("WinLikelihoodService — aggregateCaptureGaps", () => {
  it("returns tendersScanned=0 and empty gaps when no tenders exist", async () => {
    const prisma = {
      tender: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      tenderClient: { findMany: jest.fn() }
    };
    const featuresSvc = makeFeaturesSvc(prisma as never);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const report = await svc.aggregateCaptureGaps();
    expect(report.tendersScanned).toBe(0);
    expect(report.gaps).toHaveLength(0);
  });

  it("discipline always has coverageFraction=0 (structural gap)", async () => {
    const prisma = {
      tender: {
        findMany: jest.fn().mockResolvedValue([
          { id: "t-1", estimatedValue: { toNumber: () => 100_000 }, dueDate: new Date(), tenderClients: [{ clientId: "c-1" }] }
        ]),
        findUnique: jest.fn()
      },
      tenderClient: { findMany: jest.fn() }
    };
    const featuresSvc = makeFeaturesSvc(prisma as never);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const report = await svc.aggregateCaptureGaps();
    const disciplineGap = report.gaps.find((g) => g.feature === "discipline");
    expect(disciplineGap).toBeDefined();
    expect(disciplineGap!.coverageFraction).toBe(0);
  });

  it("reports coverage fractions for estimatedValue and dueDate", async () => {
    const prisma = {
      tender: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "t-1",
            estimatedValue: { toNumber: () => 100_000 },
            dueDate: new Date("2024-06-01"),
            tenderClients: [{ clientId: "c-1" }]
          },
          {
            id: "t-2",
            estimatedValue: null,
            dueDate: null,
            tenderClients: []
          }
        ]),
        findUnique: jest.fn()
      },
      tenderClient: { findMany: jest.fn() }
    };
    const featuresSvc = makeFeaturesSvc(prisma as never);
    const svc = new WinLikelihoodService(prisma as never, featuresSvc);
    const report = await svc.aggregateCaptureGaps();
    expect(report.tendersScanned).toBe(2);

    const valGap = report.gaps.find((g) => g.feature === "estimatedValue");
    expect(valGap!.coverageFraction).toBe(0.5);

    const ddGap = report.gaps.find((g) => g.feature === "dueDate");
    expect(ddGap!.coverageFraction).toBe(0.5);
  });
});
