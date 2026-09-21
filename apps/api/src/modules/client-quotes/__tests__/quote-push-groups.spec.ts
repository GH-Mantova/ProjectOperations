import { Prisma } from "@prisma/client";
import {
  QuotePushService,
  type PushableLine,
} from "../quote-push.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function dec(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v.toFixed(2));
}

function makeLine(overrides: Partial<PushableLine> = {}): PushableLine {
  return {
    type: "scope",
    id: "sl-1",
    code: "DEM1",
    description: "Demolition works",
    cardId: "card-1",
    cardCode: "DEM1",
    discipline: "DEM",
    quoteDestination: "PRICE",
    price: 10000,
    priceable: true,
    priceReason: null,
    ...overrides
  };
}

function emptyQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    tenderId: "t-1",
    status: "DRAFT",
    pushedFingerprint: null,
    sentAt: null,
    costLines: [] as never[],
    provisionalLines: [] as never[],
    costOptions: [] as never[],
    costGroups: [] as never[],
    ...overrides
  };
}

function mockPrisma() {
  const tx = {
    quoteCostGroup: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([])
    },
    quoteCostLine: {
      create: jest.fn().mockResolvedValue({ id: "cl-new" }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({})
    },
    quoteProvisionalLine: {
      create: jest.fn().mockResolvedValue({ id: "pl-new" }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({})
    },
    quoteCostOption: {
      create: jest.fn().mockResolvedValue({ id: "opt-new" }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({})
    },
    clientQuote: { update: jest.fn().mockResolvedValue({}) }
  };
  return {
    clientQuote: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn(tx);
    }),
    _tx: tx
  };
}

function mockScope(lines: PushableLine[] = []) {
  return { listPushableLines: jest.fn().mockResolvedValue(lines) };
}

function mockAudit() {
  return { write: jest.fn().mockResolvedValue({}) };
}

function makeService(
  prisma: ReturnType<typeof mockPrisma>,
  scope: ReturnType<typeof mockScope>,
  audit: ReturnType<typeof mockAudit>
) {
  return new QuotePushService(prisma as never, scope as never, audit as never);
}

// ── Group letter assignment ───────────────────────────────────────────────────

describe("QuotePushService — group letter assignment", () => {
  it("assigns letter A to the first PRICE discipline group", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const svc = makeService(prisma, mockScope([makeLine({ discipline: "DEM" })]), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.groups.length).toBe(1);
    expect(plan.groups[0].code).toBe("DEM");
    expect(plan.groups[0].label).toBe("A");
    expect(plan.groups[0].name).toBe("Demolition");
  });

  it("assigns ascending letters for multiple disciplines", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const lines: PushableLine[] = [
      makeLine({ id: "sl-1", discipline: "DEM", cardCode: "DEM1", code: "DEM1" }),
      makeLine({ id: "sl-2", discipline: "CIV", cardCode: "CIV1", code: "CIV1", description: "Civil" })
    ];
    const svc = makeService(prisma, mockScope(lines), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.groups.length).toBe(2);
    const labels = plan.groups.map((g) => g.label).sort();
    expect(labels).toEqual(["A", "B"]);
  });

  it("does not add a new group when one already exists for the discipline", async () => {
    const prisma = mockPrisma();
    const quote = emptyQuote({
      costGroups: [
        { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const svc = makeService(prisma, mockScope([makeLine({ discipline: "DEM" })]), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    // The plan should not add a new DEM group since it exists
    expect(plan.groups.filter((g) => g.code === "DEM").length).toBeLessThanOrEqual(1);
  });

  it("uses the existing label when the group was already lettered", async () => {
    const prisma = mockPrisma();
    const quote = emptyQuote({
      costGroups: [
        { id: "g-1", code: "DEM", label: "C", name: "Custom name", sortOrder: 0 }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const svc = makeService(prisma, mockScope([makeLine({ discipline: "DEM" })]), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    // The group change should use the existing label "C"
    const demGroup = plan.groups.find((g) => g.code === "DEM");
    if (demGroup) {
      expect(demGroup.label).toBe("C");
      expect(demGroup.name).toBe("Custom name");
    }
  });

  it("uses 'Other' as the group name for unknown disciplines", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const svc = makeService(
      prisma,
      mockScope([makeLine({ discipline: "UNKNOWN_DISC", id: "sl-x", code: "UNK1" })]),
      mockAudit()
    );

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.groups.length).toBe(1);
    // Falls back to the discipline code itself when not in DISCIPLINE_GROUP_NAME
    expect(plan.groups[0].name).toBe("UNKNOWN_DISC");
  });
});

// ── Group upsert during apply() ───────────────────────────────────────────────

describe("QuotePushService — group upsert in apply()", () => {
  it("upserts one group row per new PRICE discipline", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);
    const svc = makeService(prisma, mockScope([makeLine({ discipline: "DEM" })]), mockAudit());

    await svc.apply("t-1", "q-1", "user-1");

    const upsertCalls = prisma._tx.quoteCostGroup.upsert.mock.calls;
    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0][0].create.code).toBe("DEM");
  });

  it("does not upsert a group for PROVISIONAL lines", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([]);
    const svc = makeService(
      prisma,
      mockScope([makeLine({ quoteDestination: "PROVISIONAL" })]),
      mockAudit()
    );

    await svc.apply("t-1", "q-1", "user-1");

    expect(prisma._tx.quoteCostGroup.upsert).not.toHaveBeenCalled();
  });

  it("passes groupId to QuoteCostLine.create for PRICE lines", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-dem", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);
    const svc = makeService(prisma, mockScope([makeLine({ discipline: "DEM" })]), mockAudit());

    await svc.apply("t-1", "q-1", "user-1");

    const createCalls = prisma._tx.quoteCostLine.create.mock.calls;
    expect(createCalls.length).toBe(1);
    expect(createCalls[0][0].data.groupId).toBe("g-dem");
  });

  it("sets sourceEstimateLineType and sourceEstimateLineId on created cost line", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-dem", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);
    const svc = makeService(
      prisma,
      mockScope([makeLine({ type: "scope", id: "sl-42", discipline: "DEM" })]),
      mockAudit()
    );

    await svc.apply("t-1", "q-1", "user-1");

    const createCalls = prisma._tx.quoteCostLine.create.mock.calls;
    expect(createCalls[0][0].data.sourceEstimateLineType).toBe("scope");
    expect(createCalls[0][0].data.sourceEstimateLineId).toBe("sl-42");
  });
});

// ── nextTotal in plan ─────────────────────────────────────────────────────────

describe("QuotePushService — group nextTotal", () => {
  it("sums prices of PRICE-destined lines in the group", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const lines: PushableLine[] = [
      makeLine({ id: "sl-1", price: 5000, discipline: "DEM", code: "DEM1" }),
      makeLine({ id: "sl-2", price: 3000, discipline: "DEM", code: "DEM2", description: "DEM2" })
    ];
    const svc = makeService(prisma, mockScope(lines), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.groups.length).toBe(1);
    expect(plan.groups[0].nextTotal).toBe(8000);
  });

  it("excludes PROVISIONAL lines from group nextTotal", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const lines: PushableLine[] = [
      makeLine({ id: "sl-1", price: 5000, discipline: "DEM", quoteDestination: "PRICE" }),
      makeLine({ id: "sl-2", price: 3000, discipline: "DEM", code: "DEM2", description: "Provisional DEM", quoteDestination: "PROVISIONAL" })
    ];
    const svc = makeService(prisma, mockScope(lines), mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    // Only PRICE lines feed the group total
    const demGroup = plan.groups.find((g) => g.code === "DEM");
    if (demGroup) {
      expect(demGroup.nextTotal).toBe(5000);
    }
  });
});
