// Mock-based unit tests for EstimatesService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311 (SchedulerService).
//
// Drives the service directly with plain-object Prisma / Audit stubs.
// Production code is not modified. Real Prisma.Decimal instances are used
// in fixtures — only the Prisma client surface is mocked.

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EstimatesService } from "../estimates.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function buildAudit() {
  return { write: jest.fn().mockResolvedValue({}) as AsyncMock };
}

// Minimal `RateResolverService` stub — every listMaterialDensities test
// mocks this via prisma-level assertions elsewhere; unused calls throw
// so a silent-fallthrough regression fails loudly.
function buildResolver() {
  return {
    listMaterialDensities: jest.fn().mockResolvedValue([]) as AsyncMock,
    resolveMaterialDensity: jest.fn().mockResolvedValue(null) as AsyncMock
  };
}

function emptyEstimate(overrides: Record<string, unknown> = {}) {
  return {
    id: "est-1",
    tenderId: "tender-1",
    markup: decimal("30"),
    notes: null,
    lockedAt: null,
    lockedById: null,
    items: [],
    ...overrides
  };
}

// ─── Rate library ──────────────────────────────────────────────────────────

describe("EstimatesService — labour rate CRUD", () => {
  it("upsertLabourRate (create) converts decimals, creates record, writes audit", async () => {
    const audit = buildAudit();
    const created = { id: "rate-1", role: "Carpenter" };
    const prisma = {
      estimateLabourRate: {
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn()
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    const result = await service.upsertLabourRate(
      undefined,
      {
        role: "Carpenter",
        dayRate: "500",
        nightRate: "600",
        weekendRate: "750"
      } as never,
      "user-1"
    );

    expect(result).toBe(created);
    expect(prisma.estimateLabourRate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "Carpenter",
        dayRate: expect.any(Prisma.Decimal),
        nightRate: expect.any(Prisma.Decimal),
        weekendRate: expect.any(Prisma.Decimal),
        isActive: true,
        sortOrder: 0
      })
    });
    const createArg = prisma.estimateLabourRate.create.mock.calls[0][0].data;
    expect(createArg.dayRate.toString()).toBe("500");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "estimates.labourRate.create",
        entityType: "EstimateLabourRate",
        entityId: "rate-1"
      })
    );
  });

  it("upsertLabourRate (update) routes to update path and audits with update action", async () => {
    const audit = buildAudit();
    const updated = { id: "rate-2" };
    const prisma = {
      estimateLabourRate: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updated)
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await service.upsertLabourRate(
      "rate-2",
      { role: "Plumber", dayRate: "550", nightRate: "650", weekendRate: "800" } as never,
      "user-1"
    );

    expect(prisma.estimateLabourRate.create).not.toHaveBeenCalled();
    expect(prisma.estimateLabourRate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rate-2" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "estimates.labourRate.update" })
    );
  });
});

describe("EstimatesService — protected delete behaviours", () => {
  it("deleteOtherRate throws ForbiddenException when the rate is referenced", async () => {
    const audit = buildAudit();
    const prisma = {
      cuttingSheetItem: { count: jest.fn().mockResolvedValue(3) },
      cuttingOtherRate: { delete: jest.fn() }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await expect(service.deleteOtherRate("rate-x", "user-1")).rejects.toThrow(
      ForbiddenException
    );
    expect(prisma.cuttingOtherRate.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("deleteMaterialDensity soft-deletes via isActive:false rather than hard delete", async () => {
    const audit = buildAudit();
    const prisma = {
      estimateMaterialDensity: { update: jest.fn().mockResolvedValue({ id: "den-1" }) }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    const result = await service.deleteMaterialDensity("den-1", "user-1");

    expect(result).toEqual({ id: "den-1" });
    expect(prisma.estimateMaterialDensity.update).toHaveBeenCalledWith({
      where: { id: "den-1" },
      data: { isActive: false }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "estimates.materialDensity.delete" })
    );
  });
});

// ─── Estimate lifecycle ────────────────────────────────────────────────────

describe("EstimatesService — getEstimate", () => {
  it("throws NotFoundException when the tender does not exist", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue(null) },
      tenderEstimate: { findUnique: jest.fn() }
    };
    const service = new EstimatesService(prisma as never, buildAudit() as never, buildResolver() as never);

    await expect(service.getEstimate("tender-missing")).rejects.toThrow(NotFoundException);
    expect(prisma.tenderEstimate.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the tender exists but no estimate has been created", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(null) }
    };
    const service = new EstimatesService(prisma as never, buildAudit() as never, buildResolver() as never);

    const result = await service.getEstimate("tender-1");

    expect(result).toBeNull();
  });
});

describe("EstimatesService — createEstimate", () => {
  it("returns the existing estimate when one already exists (idempotent)", async () => {
    const existing = emptyEstimate();
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn()
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    const result = await service.createEstimate("tender-1", "user-1");

    expect(result).toBe(existing);
    expect(prisma.tenderEstimate.create).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("creates a new estimate with default markup of 30 and writes a create audit", async () => {
    const created = emptyEstimate({ id: "est-new" });
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: {
        findUnique: jest
          .fn()
          // initial lookup — no existing estimate
          .mockResolvedValueOnce(null)
          // requireEstimate after create
          .mockResolvedValueOnce(created),
        create: jest.fn().mockResolvedValue(created)
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    const result = await service.createEstimate("tender-1", "user-1");

    expect(result).toBe(created);
    expect(prisma.tenderEstimate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenderId: "tender-1",
        markup: expect.any(Prisma.Decimal)
      })
    });
    const createArg = prisma.tenderEstimate.create.mock.calls[0][0].data;
    expect(createArg.markup.toString()).toBe("30");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "estimates.create",
        entityType: "TenderEstimate",
        entityId: "est-new"
      })
    );
  });
});

describe("EstimatesService — updateEstimate", () => {
  it("creates the estimate on the fly when one does not exist (upsert PR-B2)", async () => {
    const created = emptyEstimate({ id: "est-new", markup: decimal("45"), notes: "fresh" });
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(created),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn()
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    const result = await service.updateEstimate(
      "tender-1",
      { markup: "45", notes: "fresh" } as never,
      "user-1"
    );

    expect(result).toBe(created);
    expect(prisma.tenderEstimate.create).toHaveBeenCalled();
    expect(prisma.tenderEstimate.update).not.toHaveBeenCalled();
    const createArg = prisma.tenderEstimate.create.mock.calls[0][0].data;
    expect(createArg.markup.toString()).toBe("45");
    expect(createArg.notes).toBe("fresh");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "estimates.create",
        metadata: expect.objectContaining({ viaUpsert: true })
      })
    );
  });

  it("throws ForbiddenException when the estimate is locked", async () => {
    const locked = emptyEstimate({ lockedAt: new Date("2026-06-01T00:00:00Z") });
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: {
        findUnique: jest.fn().mockResolvedValue(locked),
        update: jest.fn()
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await expect(
      service.updateEstimate("tender-1", { markup: "40" } as never, "user-1")
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.tenderEstimate.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});

describe("EstimatesService — lock / unlock", () => {
  it("lockEstimate stamps lockedAt + lockedById and writes lock audit", async () => {
    const existing = emptyEstimate();
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, lockedAt: new Date() })
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await service.lockEstimate("tender-1", "user-1");

    expect(prisma.tenderEstimate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "est-1" },
        data: expect.objectContaining({
          lockedAt: expect.any(Date),
          lockedById: "user-1"
        })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "estimates.lock" })
    );
  });
});

// ─── Items ─────────────────────────────────────────────────────────────────

describe("EstimatesService — items", () => {
  it("addItem auto-derives itemNumber from existing count and writes create audit", async () => {
    const existing = emptyEstimate();
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(existing) },
      estimateItem: {
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockResolvedValue({ id: "item-1" })
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await service.addItem(
      "tender-1",
      { code: "S1", title: "Setup" } as never,
      "user-1"
    );

    expect(prisma.estimateItem.count).toHaveBeenCalledWith({
      where: { estimateId: "est-1", code: "S1" }
    });
    const createArg = prisma.estimateItem.create.mock.calls[0][0].data;
    expect(createArg.itemNumber).toBe(3);
    expect(createArg.estimateId).toBe("est-1");
    expect(createArg.markup.toString()).toBe("30");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "estimates.item.create",
        entityType: "EstimateItem",
        entityId: "item-1"
      })
    );
  });

  it("addItem refuses to mutate a locked estimate", async () => {
    const locked = emptyEstimate({ lockedAt: new Date() });
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(locked) },
      estimateItem: { count: jest.fn(), create: jest.fn() }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await expect(
      service.addItem("tender-1", { code: "S1", title: "Setup" } as never, "user-1")
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.estimateItem.create).not.toHaveBeenCalled();
  });
});

// ─── Line items ────────────────────────────────────────────────────────────

describe("EstimatesService — labour line", () => {
  it("addLabourLine validates item FK, converts decimals, and audits", async () => {
    const existing = emptyEstimate();
    const audit = buildAudit();
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(existing) },
      estimateItem: {
        findUnique: jest.fn().mockResolvedValue({ id: "item-1", estimateId: "est-1" })
      },
      estimateLabourLine: {
        create: jest.fn().mockResolvedValue({ id: "line-1" })
      }
    };
    const service = new EstimatesService(prisma as never, audit as never, buildResolver() as never);

    await service.addLabourLine(
      "tender-1",
      "item-1",
      { role: "Carpenter", qty: "2", days: "5", rate: "500" } as never,
      "user-1"
    );

    const createArg = prisma.estimateLabourLine.create.mock.calls[0][0].data;
    expect(createArg.itemId).toBe("item-1");
    expect(createArg.qty.toString()).toBe("2");
    expect(createArg.days.toString()).toBe("5");
    expect(createArg.rate.toString()).toBe("500");
    expect(createArg.shift).toBe("Day");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "estimates.labourLine.create",
        entityType: "EstimateLabourLine",
        entityId: "line-1"
      })
    );
  });
});

// ─── Summary / totals ──────────────────────────────────────────────────────

describe("EstimatesService — summary", () => {
  it("returns the zero-totals shape when no estimate exists", async () => {
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(null) }
    };
    const service = new EstimatesService(prisma as never, buildAudit() as never, buildResolver() as never);

    const result = await service.summary("tender-1");

    expect(result).toEqual({
      estimateId: null,
      markup: 0,
      locked: false,
      items: [],
      totals: { labour: 0, equip: 0, plant: 0, waste: 0, cutting: 0, subtotal: 0, price: 0 },
      markupAmount: 0
    });
  });

  it("computes per-line costs, applies item markup, and rolls up totals + markupAmount", async () => {
    // Item A — labour 2 × 5 × 500 = 5000, plant 1 × 3 × 800 = 2400,
    //          waste (4 t × 150) + (2 loads × 50) = 700,
    //          equip 1 × 2 × 250 = 500, cutting 10 × 80 = 800
    //          subtotal = 5000+2400+700+500+800 = 9400
    //          markup 20% → price = 11280
    const itemA = {
      id: "item-a",
      code: "A",
      itemNumber: 1,
      title: "Item A",
      isProvisional: false,
      markup: decimal("20"),
      provisionalAmount: null,
      labourLines: [
        { qty: decimal("2"), days: decimal("5"), rate: decimal("500") }
      ],
      equipLines: [
        { qty: decimal("1"), duration: decimal("2"), rate: decimal("250") }
      ],
      plantLines: [
        { qty: decimal("1"), days: decimal("3"), rate: decimal("800") }
      ],
      wasteLines: [
        { qtyTonnes: decimal("4"), tonRate: decimal("150"), loads: 2, loadRate: decimal("50") }
      ],
      cuttingLines: [
        { qty: decimal("10"), rate: decimal("80") }
      ]
    };
    // Item B — provisional 1500 → passes through at cost, no markup
    const itemB = {
      id: "item-b",
      code: "B",
      itemNumber: 1,
      title: "Item B",
      isProvisional: true,
      markup: decimal("30"),
      provisionalAmount: decimal("1500"),
      labourLines: [],
      equipLines: [],
      plantLines: [],
      wasteLines: [],
      cuttingLines: []
    };
    const estimate = {
      id: "est-1",
      markup: decimal("30"),
      lockedAt: null,
      items: [itemA, itemB]
    };
    const prisma = {
      tender: { findUnique: jest.fn().mockResolvedValue({ id: "tender-1" }) },
      tenderEstimate: { findUnique: jest.fn().mockResolvedValue(estimate) }
    };
    const service = new EstimatesService(prisma as never, buildAudit() as never, buildResolver() as never);

    const result = await service.summary("tender-1");

    expect(result.estimateId).toBe("est-1");
    expect(result.markup).toBe(30);
    expect(result.locked).toBe(false);

    const a = result.items.find((i: { itemId: string }) => i.itemId === "item-a")!;
    expect(a.labour).toBe(5000);
    expect(a.plant).toBe(2400);
    expect(a.waste).toBe(700);
    expect(a.equip).toBe(500);
    expect(a.cutting).toBe(800);
    expect(a.subtotal).toBe(9400);
    expect(a.markup).toBe(20);
    expect(a.price).toBe(11280);

    const b = result.items.find((i: { itemId: string }) => i.itemId === "item-b")!;
    expect(b.isProvisional).toBe(true);
    expect(b.subtotal).toBe(1500);
    expect(b.markup).toBe(0);
    expect(b.price).toBe(1500);

    // Totals: provisional adds to subtotal AND price at cost
    expect(result.totals.labour).toBe(5000);
    expect(result.totals.plant).toBe(2400);
    expect(result.totals.waste).toBe(700);
    expect(result.totals.equip).toBe(500);
    expect(result.totals.cutting).toBe(800);
    expect(result.totals.subtotal).toBe(9400 + 1500);
    expect(result.totals.price).toBe(11280 + 1500);
    // markupAmount = total price - total subtotal (provisional contributes 0)
    expect(result.markupAmount).toBe(11280 - 9400);
  });
});
