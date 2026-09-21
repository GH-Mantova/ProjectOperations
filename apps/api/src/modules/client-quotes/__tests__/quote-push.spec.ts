import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  QuotePushService,
  QUOTE_PUSH_BY_DESTINATION_V1,
  type PushableLine,
} from "../quote-push.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function dec(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v.toFixed(2));
}

function makeLine(
  overrides: Partial<PushableLine> = {}
): PushableLine {
  return {
    type: "scope",
    id: "sl-1",
    code: "DEM1",
    description: "Strip out level 1",
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
    clientQuote: {
      update: jest.fn().mockResolvedValue({})
    }
  };
  return {
    clientQuote: {
      findUnique: jest.fn()
    },
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

// ── Marker ────────────────────────────────────────────────────────────────────

describe("QUOTE_PUSH_BY_DESTINATION_V1 marker", () => {
  it("is set to the scopecards-s4a marker string", () => {
    expect(QUOTE_PUSH_BY_DESTINATION_V1).toBe("scopecards-s4a");
  });
});

// ── plan() ────────────────────────────────────────────────────────────────────

describe("QuotePushService.plan()", () => {
  it("throws NotFoundException when quote does not exist", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma, mockScope(), mockAudit());
    await expect(svc.plan("t-1", "q-1")).rejects.toThrow(NotFoundException);
  });

  it("throws NotFoundException when quote belongs to a different tender", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote({ tenderId: "t-other" }));
    const svc = makeService(prisma, mockScope(), mockAudit());
    await expect(svc.plan("t-1", "q-1")).rejects.toThrow(NotFoundException);
  });

  it("returns all-create plan for fresh quote with one PRICE line", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const scope = mockScope([makeLine()]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.counts.create).toBe(1);
    expect(plan.counts.update).toBe(0);
    expect(plan.counts.unchanged).toBe(0);
    expect(plan.quoteStatus).toBe("DRAFT");
    expect(plan.changes[0].action).toBe("create");
    expect((plan.changes[0] as { destination: string }).destination).toBe("PRICE");
  });

  it("skips INTERNAL lines entirely", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const scope = mockScope([makeLine({ quoteDestination: "INTERNAL" })]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.changes.length).toBe(0);
    expect(plan.counts.create).toBe(0);
  });

  it("produces unchanged when existing row price and description match", async () => {
    const prisma = mockPrisma();
    const line = makeLine({ price: 10000 });
    const quote = emptyQuote({
      costLines: [
        {
          id: "cl-1",
          label: "DEM1",
          description: line.description,
          displayDescription: null,
          price: dec(10000),
          overrideAmount: null,
          isVisible: true,
          groupId: null,
          sourceEstimateLineType: "scope",
          sourceEstimateLineId: "sl-1",
          sortOrder: 0
        }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const scope = mockScope([line]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.counts.unchanged).toBe(1);
    expect(plan.counts.update).toBe(0);
  });

  it("produces update when price differs by more than 0.001", async () => {
    const prisma = mockPrisma();
    const line = makeLine({ price: 12000 });
    const quote = emptyQuote({
      costLines: [
        {
          id: "cl-1",
          label: "DEM1",
          description: line.description,
          displayDescription: null,
          price: dec(10000),
          overrideAmount: null,
          isVisible: true,
          groupId: null,
          sourceEstimateLineType: "scope",
          sourceEstimateLineId: "sl-1",
          sortOrder: 0
        }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const scope = mockScope([line]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.counts.update).toBe(1);
    const change = plan.changes[0];
    expect(change.action).toBe("update");
    if (change.action === "update") {
      expect(change.prevPrice).toBe(10000);
      expect(change.price).toBe(12000);
    }
  });

  it("produces move when line destination changes from PRICE to PROVISIONAL", async () => {
    const prisma = mockPrisma();
    const line = makeLine({ quoteDestination: "PROVISIONAL" });
    const quote = emptyQuote({
      costLines: [
        {
          id: "cl-1",
          label: "DEM1",
          description: line.description,
          displayDescription: null,
          price: dec(10000),
          overrideAmount: null,
          isVisible: true,
          groupId: null,
          sourceEstimateLineType: "scope",
          sourceEstimateLineId: "sl-1",
          sortOrder: 0
        }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const scope = mockScope([line]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.counts.move).toBe(1);
    const change = plan.changes[0];
    expect(change.action).toBe("move");
    if (change.action === "move") {
      expect(change.fromDestination).toBe("PRICE");
      expect(change.destination).toBe("PROVISIONAL");
    }
  });

  it("produces withdraw for a cost line whose estimate line is now gone", async () => {
    const prisma = mockPrisma();
    const quote = emptyQuote({
      costLines: [
        {
          id: "cl-orphan",
          label: "OLD",
          description: "Old line",
          displayDescription: null,
          price: dec(5000),
          overrideAmount: null,
          isVisible: true,
          groupId: null,
          sourceEstimateLineType: "scope",
          sourceEstimateLineId: "sl-gone",
          sortOrder: 0
        }
      ]
    });
    prisma.clientQuote.findUnique.mockResolvedValue(quote);
    const scope = mockScope([]); // no pushable lines at all
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.plan("t-1", "q-1");

    expect(plan.counts.withdraw).toBe(1);
    const change = plan.changes[0];
    expect(change.action).toBe("withdraw");
    if (change.action === "withdraw") {
      expect(change.prevDestination).toBe("PRICE");
      expect(change.prevPrice).toBe(5000);
    }
  });

  it("produces a non-empty fingerprint", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const svc = makeService(prisma, mockScope([makeLine()]), mockAudit());
    const plan = await svc.plan("t-1", "q-1");
    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("estimateChangedSincePush is false when no fingerprint stored", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote({ pushedFingerprint: null }));
    const svc = makeService(prisma, mockScope([makeLine()]), mockAudit());
    const plan = await svc.plan("t-1", "q-1");
    expect(plan.estimateChangedSincePush).toBe(false);
  });

  it("estimateChangedSincePush is true when stored fingerprint differs", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(
      emptyQuote({ pushedFingerprint: "stale-fingerprint" })
    );
    const svc = makeService(prisma, mockScope([makeLine()]), mockAudit());
    const plan = await svc.plan("t-1", "q-1");
    expect(plan.estimateChangedSincePush).toBe(true);
  });

  it("PROVISIONAL destination produces no group in plan", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const svc = makeService(
      prisma,
      mockScope([makeLine({ quoteDestination: "PROVISIONAL" })]),
      mockAudit()
    );
    const plan = await svc.plan("t-1", "q-1");
    expect(plan.groups.length).toBe(0);
    expect(plan.counts.create).toBe(1);
    expect((plan.changes[0] as { destination: string }).destination).toBe("PROVISIONAL");
  });
});

// ── apply() ───────────────────────────────────────────────────────────────────

describe("QuotePushService.apply()", () => {
  it("throws NotFoundException when quote does not exist", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma, mockScope(), mockAudit());
    await expect(svc.apply("t-1", "q-1", "user-1")).rejects.toThrow(NotFoundException);
  });

  it("throws 409 ConflictException when quote is not DRAFT", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(
      emptyQuote({ status: "SENT", sentAt: new Date("2026-05-01") })
    );
    const svc = makeService(prisma, mockScope(), mockAudit());
    await expect(svc.apply("t-1", "q-1", "user-1")).rejects.toThrow(ConflictException);
  });

  it("409 message mentions the sent date", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(
      emptyQuote({ status: "SENT", sentAt: new Date("2026-05-15T00:00:00Z") })
    );
    const svc = makeService(prisma, mockScope(), mockAudit());
    try {
      await svc.apply("t-1", "q-1", "user-1");
      fail("should have thrown");
    } catch (e) {
      expect((e as ConflictException).message).toMatch(/sent/i);
      expect((e as ConflictException).message).toContain("2026");
    }
  });

  it("calls $transaction for DRAFT quote with pushable lines", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const scope = mockScope([makeLine()]);
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);
    const svc = makeService(prisma, scope, mockAudit());

    await svc.apply("t-1", "q-1", "user-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("stamps pushedAt, pushedById, pushedFingerprint after apply", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const scope = mockScope([makeLine()]);
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);
    const svc = makeService(prisma, scope, mockAudit());

    const plan = await svc.apply("t-1", "q-1", "user-1");

    const updateCall = prisma._tx.clientQuote.update.mock.calls[0][0];
    expect(updateCall.data.pushedById).toBe("user-1");
    expect(updateCall.data.pushedAt).toBeInstanceOf(Date);
    expect(updateCall.data.pushedFingerprint).toBe(plan.fingerprint);
  });

  it("writes audit log with quote.push action", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const audit = mockAudit();
    const svc = makeService(prisma, mockScope([makeLine()]), audit);
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);

    await svc.apply("t-1", "q-1", "user-99");

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-99",
        action: "quote.push",
        entityType: "ClientQuote",
        entityId: "q-1"
      })
    );
  });

  it("returns the plan including fingerprint and counts", async () => {
    const prisma = mockPrisma();
    prisma.clientQuote.findUnique.mockResolvedValue(emptyQuote());
    const svc = makeService(prisma, mockScope([makeLine()]), mockAudit());
    prisma._tx.quoteCostGroup.findMany.mockResolvedValue([
      { id: "g-1", code: "DEM", label: "A", name: "Demolition", sortOrder: 0 }
    ]);

    const plan = await svc.apply("t-1", "q-1", "user-1");

    expect(plan.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.counts.create).toBe(1);
  });
});
