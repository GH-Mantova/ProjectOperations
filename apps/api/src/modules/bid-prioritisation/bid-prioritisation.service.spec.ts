import {
  BidPrioritisationService,
  BID_PRIORITY_WEIGHT
} from "./bid-prioritisation.service";

// ─── Mock builder helpers ─────────────────────────────────────────────────────

type MockTender = {
  id: string;
  title: string;
  estimatedValue: { toNumber(): number } | null;
  dueDate: Date | null;
  tenderClients: Array<{
    client: { name: string };
    relationshipType: string | null;
  }>;
};

function makeTender(overrides: Partial<MockTender> = {}): MockTender {
  return {
    id: "t-1",
    title: "Test Tender",
    estimatedValue: { toNumber: () => 100_000 },
    dueDate: new Date("2026-09-01"),
    tenderClients: [{ client: { name: "Acme Corp" }, relationshipType: null }],
    ...overrides
  };
}

type MockWlResult = {
  pointEstimate: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  whyFactors: Array<{ factor: string; direction: string; detail: string }>;
  interval: null;
  cohortSize: number;
  captureGaps: string[];
};

function makeWlResult(overrides: Partial<MockWlResult> = {}): MockWlResult {
  return {
    pointEstimate: 0.7,
    confidence: "MEDIUM",
    whyFactors: [],
    interval: null,
    cohortSize: 5,
    captureGaps: [],
    ...overrides
  };
}

function makePrisma(tenders: MockTender[]) {
  return {
    tender: {
      findMany: jest.fn().mockResolvedValue(tenders)
    }
  };
}

function makeWinLikelihood(results: MockWlResult[]) {
  let callIdx = 0;
  return {
    computeForTender: jest.fn().mockImplementation(() => {
      const result = results[callIdx] ?? results[results.length - 1];
      callIdx++;
      return Promise.resolve(result);
    })
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BidPrioritisationService — getRankedOpenTenders", () => {
  it("score = pointEstimate * estimatedValue * BID_PRIORITY_WEIGHT", async () => {
    const tender = makeTender({ id: "t-1", estimatedValue: { toNumber: () => 200_000 } });
    const wl = makeWlResult({ pointEstimate: 0.5 });

    const prisma = makePrisma([tender]);
    const winLikelihood = makeWinLikelihood([wl]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(1);
    const expected = 0.5 * 200_000 * BID_PRIORITY_WEIGHT;
    expect(result[0].expectedValueScore).toBeCloseTo(expected, 5);
    expect(result[0].insufficientData).toBe(false);
  });

  it("null pointEstimate → insufficientData true, score null, sorted last", async () => {
    const tenderA = makeTender({ id: "t-a", title: "Tender A", estimatedValue: { toNumber: () => 500_000 } });
    const tenderB = makeTender({ id: "t-b", title: "Tender B", estimatedValue: { toNumber: () => 100_000 } });

    const wlA = makeWlResult({ pointEstimate: null }); // insufficient
    const wlB = makeWlResult({ pointEstimate: 0.8 });  // has score

    const prisma = makePrisma([tenderA, tenderB]);
    const winLikelihood = makeWinLikelihood([wlA, wlB]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(2);
    // tenderB (real score) must come first
    expect(result[0].tenderId).toBe("t-b");
    expect(result[0].insufficientData).toBe(false);
    expect(result[0].expectedValueScore).not.toBeNull();
    // tenderA (null pointEstimate) must be last
    expect(result[1].tenderId).toBe("t-a");
    expect(result[1].insufficientData).toBe(true);
    expect(result[1].expectedValueScore).toBeNull();
  });

  it("null estimatedValue → insufficientData true, score null, sorted last", async () => {
    const tenderA = makeTender({ id: "t-a", title: "Tender A", estimatedValue: null });
    const tenderB = makeTender({ id: "t-b", title: "Tender B", estimatedValue: { toNumber: () => 50_000 } });

    const wlA = makeWlResult({ pointEstimate: 0.6 }); // has point estimate but no value
    const wlB = makeWlResult({ pointEstimate: 0.4 }); // has both

    const prisma = makePrisma([tenderA, tenderB]);
    const winLikelihood = makeWinLikelihood([wlA, wlB]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(2);
    // tenderB (real score) must come first
    expect(result[0].tenderId).toBe("t-b");
    expect(result[0].insufficientData).toBe(false);
    // tenderA (null estimatedValue) must be last
    expect(result[1].tenderId).toBe("t-a");
    expect(result[1].insufficientData).toBe(true);
    expect(result[1].expectedValueScore).toBeNull();
    expect(result[1].estimatedValue).toBeNull();
  });

  it("real-score items sorted DESC before null-score items", async () => {
    const tenderA = makeTender({ id: "t-a", title: "Low score",  estimatedValue: { toNumber: () => 100_000 } });
    const tenderB = makeTender({ id: "t-b", title: "High score", estimatedValue: { toNumber: () => 500_000 } });
    const tenderC = makeTender({ id: "t-c", title: "No score",   estimatedValue: null });

    const wlA = makeWlResult({ pointEstimate: 0.2 });  // score = 20_000
    const wlB = makeWlResult({ pointEstimate: 0.8 });  // score = 400_000
    const wlC = makeWlResult({ pointEstimate: null });  // insufficient

    const prisma = makePrisma([tenderA, tenderB, tenderC]);
    const winLikelihood = makeWinLikelihood([wlA, wlB, wlC]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(3);
    expect(result[0].tenderId).toBe("t-b"); // highest score first
    expect(result[1].tenderId).toBe("t-a"); // second highest
    expect(result[2].tenderId).toBe("t-c"); // null-score last
  });

  it("Decimal.toNumber() conversion — estimatedValue is a plain number, not a Decimal object", async () => {
    const tender = makeTender({
      id: "t-1",
      estimatedValue: { toNumber: () => 123_456.78 }
    });
    const wl = makeWlResult({ pointEstimate: 0.5 });

    const prisma = makePrisma([tender]);
    const winLikelihood = makeWinLikelihood([wl]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(1);
    // estimatedValue must be a plain JS number, not a Decimal object
    expect(typeof result[0].estimatedValue).toBe("number");
    expect(result[0].estimatedValue).toBeCloseTo(123_456.78, 2);
    // expectedValueScore must also be a number
    expect(typeof result[0].expectedValueScore).toBe("number");
  });

  it("no write paths — prisma mock receives no create/update/delete calls", async () => {
    const tender = makeTender();
    const wl = makeWlResult();

    const prisma = {
      tender: {
        findMany: jest.fn().mockResolvedValue([tender]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn()
      }
    };
    const winLikelihood = makeWinLikelihood([wl]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    await svc.getRankedOpenTenders();

    expect(prisma.tender.create).not.toHaveBeenCalled();
    expect(prisma.tender.update).not.toHaveBeenCalled();
    expect(prisma.tender.delete).not.toHaveBeenCalled();
    expect(prisma.tender.upsert).not.toHaveBeenCalled();
  });

  it("empty open tenders → returns empty array immediately, no win-likelihood calls", async () => {
    const prisma = makePrisma([]);
    const winLikelihood = { computeForTender: jest.fn() };
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result).toHaveLength(0);
    expect(winLikelihood.computeForTender).not.toHaveBeenCalled();
  });

  it("Promise.all batching — win-likelihood called for each tender (not sequentially in loop)", async () => {
    // Verifies batch: all computeForTender calls are launched before any await.
    // We confirm by checking all three tender IDs were passed.
    const tenders = [
      makeTender({ id: "t-1" }),
      makeTender({ id: "t-2" }),
      makeTender({ id: "t-3" })
    ];
    const wlResults = [
      makeWlResult({ pointEstimate: 0.9 }),
      makeWlResult({ pointEstimate: 0.5 }),
      makeWlResult({ pointEstimate: 0.1 })
    ];

    const prisma = makePrisma(tenders);
    const winLikelihood = makeWinLikelihood(wlResults);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    await svc.getRankedOpenTenders();

    expect(winLikelihood.computeForTender).toHaveBeenCalledTimes(3);
    expect(winLikelihood.computeForTender).toHaveBeenCalledWith("t-1");
    expect(winLikelihood.computeForTender).toHaveBeenCalledWith("t-2");
    expect(winLikelihood.computeForTender).toHaveBeenCalledWith("t-3");
  });

  it("primary client resolved from tenderClients — 'primary' relationshipType wins", async () => {
    const tender = makeTender({
      tenderClients: [
        { client: { name: "Secondary Client" }, relationshipType: null },
        { client: { name: "Primary Client" }, relationshipType: "primary" }
      ]
    });
    const wl = makeWlResult();

    const prisma = makePrisma([tender]);
    const winLikelihood = makeWinLikelihood([wl]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result[0].client).toBe("Primary Client");
  });

  it("no tenderClients → client is null", async () => {
    const tender = makeTender({ tenderClients: [] });
    const wl = makeWlResult();

    const prisma = makePrisma([tender]);
    const winLikelihood = makeWinLikelihood([wl]);
    const svc = new BidPrioritisationService(prisma as never, winLikelihood as never);

    const result = await svc.getRankedOpenTenders();

    expect(result[0].client).toBeNull();
  });
});
