import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ScopeOfWorksService } from "../../scope-of-works.service";

// PR B1 — card-CRUD service method tests. Uses mocked PrismaService to
// avoid DB dependency, mirroring the proposals.service.spec.ts pattern.

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(opts: {
  tenderExists?: boolean;
  scopeCardFindFirst?: unknown;
  scopeCardFindMany?: unknown;
  scopeCardAggregateMax?: { cardNumber?: number | null; sortOrder?: number | null };
  scopeItemCount?: number;
  scopeItemAggregateMaxItemNumber?: number;
} = {}) {
  const tenderFindUnique: AsyncMock = jest.fn(async () =>
    opts.tenderExists === false ? null : { id: "tender-1" }
  );
  const scopeCardFindFirst: AsyncMock = jest.fn(async () =>
    opts.scopeCardFindFirst === undefined ? null : opts.scopeCardFindFirst
  );
  const scopeCardFindMany: AsyncMock = jest.fn(async () =>
    opts.scopeCardFindMany === undefined ? [] : opts.scopeCardFindMany
  );
  const scopeCardAggregate: AsyncMock = jest.fn(async () => ({
    _max: {
      cardNumber: opts.scopeCardAggregateMax?.cardNumber ?? null,
      sortOrder: opts.scopeCardAggregateMax?.sortOrder ?? null
    }
  }));
  const scopeCardCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: "card-new", ...data };
  });
  const scopeCardUpdate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    const where = ((args as { where?: Record<string, unknown> })?.where ?? {}) as Record<string, unknown>;
    return { id: where.id, ...data };
  });
  const scopeCardDelete: AsyncMock = jest.fn(async () => ({}));
  const scopeCardUpdateMany: AsyncMock = jest.fn(async () => ({ count: 0 }));
  const scopeOfWorksItemCount: AsyncMock = jest.fn(async () => opts.scopeItemCount ?? 0);
  const scopeOfWorksItemUpdate: AsyncMock = jest.fn(async () => ({}));
  const scopeOfWorksItemAggregate: AsyncMock = jest.fn(async () => ({
    _max: { itemNumber: opts.scopeItemAggregateMaxItemNumber ?? 0 }
  }));
  const scopeOfWorksItemCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: "item-new", ...data };
  });
  const cuttingSheetItemUpdateMany: AsyncMock = jest.fn(async () => ({ count: 0 }));
  const scopeWasteItemUpdateMany: AsyncMock = jest.fn(async () => ({ count: 0 }));

  const tx = {
    scopeCard: { update: scopeCardUpdate },
    scopeOfWorksItem: { update: scopeOfWorksItemUpdate },
    cuttingSheetItem: { updateMany: cuttingSheetItemUpdateMany },
    scopeWasteItem: { updateMany: scopeWasteItemUpdateMany }
  };

  const $transaction: AsyncMock = jest.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => Promise<unknown>)(tx);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return [];
  });

  const prisma = {
    tender: { findUnique: tenderFindUnique },
    scopeCard: {
      findFirst: scopeCardFindFirst,
      findMany: scopeCardFindMany,
      aggregate: scopeCardAggregate,
      create: scopeCardCreate,
      update: scopeCardUpdate,
      updateMany: scopeCardUpdateMany,
      delete: scopeCardDelete
    },
    scopeOfWorksItem: {
      count: scopeOfWorksItemCount,
      aggregate: scopeOfWorksItemAggregate,
      create: scopeOfWorksItemCreate,
      update: scopeOfWorksItemUpdate
    },
    cuttingSheetItem: { updateMany: cuttingSheetItemUpdateMany },
    scopeWasteItem: { updateMany: scopeWasteItemUpdateMany },
    $transaction
  };

  return {
    prisma,
    mocks: {
      tenderFindUnique,
      scopeCardFindFirst,
      scopeCardFindMany,
      scopeCardAggregate,
      scopeCardCreate,
      scopeCardUpdate,
      scopeCardUpdateMany,
      scopeCardDelete,
      scopeOfWorksItemCount,
      scopeOfWorksItemAggregate,
      scopeOfWorksItemCreate,
      scopeOfWorksItemUpdate,
      cuttingSheetItemUpdateMany,
      scopeWasteItemUpdateMany,
      $transaction
    }
  };
}

describe("ScopeOfWorksService.createCard (PR B1)", () => {
  it("assigns cardNumber=1 for the first card of a new discipline", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardAggregateMax: { cardNumber: null, sortOrder: null }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.createCard("tender-1", "user-1", { name: "Demo Site A", discipline: "DEM" });
    const args = (mocks.scopeCardCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cardNumber?: number; sortOrder?: number; name?: string; discipline?: string };
    };
    expect(args.data?.cardNumber).toBe(1);
    expect(args.data?.discipline).toBe("DEM");
    expect(args.data?.name).toBe("Demo Site A");
    expect(args.data?.sortOrder).toBe(0);
  });

  it("assigns next cardNumber when same discipline already has cards", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardAggregateMax: { cardNumber: 3, sortOrder: 5 }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.createCard("tender-1", "user-1", { name: "Second DEM card", discipline: "DEM" });
    const args = (mocks.scopeCardCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cardNumber?: number; sortOrder?: number };
    };
    expect(args.data?.cardNumber).toBe(4);
    expect(args.data?.sortOrder).toBe(6);
  });

  it("trims and truncates name to 200 chars", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const svc = new ScopeOfWorksService(prisma as never);
    const longName = "  " + "x".repeat(250) + "  ";
    await svc.createCard("tender-1", "user-1", { name: longName, discipline: "CIV" });
    const args = (mocks.scopeCardCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { name?: string };
    };
    expect(args.data?.name?.length).toBe(200);
    expect(args.data?.name?.startsWith("x")).toBe(true);
  });
});

describe("ScopeOfWorksService.renameCard (PR B1)", () => {
  it("updates name when card exists", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1", tenderId: "tender-1", name: "Old", discipline: "DEM", cardNumber: 1 }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.renameCard("tender-1", "card-1", "New Name");
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { name?: string };
    };
    expect(args.data?.name).toBe("New Name");
  });

  it("throws NotFoundException when card not in tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.renameCard("tender-1", "missing", "X")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe("ScopeOfWorksService.changeCardDiscipline (PR B1)", () => {
  it("no-op when target discipline matches current", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: {
        id: "card-1",
        tenderId: "tender-1",
        discipline: "DEM",
        cardNumber: 1,
        scopeItems: []
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.changeCardDiscipline("tender-1", "card-1", "DEM");
    expect(result.itemsRenumbered).toBe(0);
    expect(mocks.scopeCardUpdate).not.toHaveBeenCalled();
  });

  it("renumbers items + cascades cutting/waste refs to new dotted codes", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: {
        id: "card-1",
        tenderId: "tender-1",
        discipline: "DEM",
        cardNumber: 2,
        scopeItems: [
          { id: "i-1", itemNumber: 1, wbsCode: "DEM2.1" },
          { id: "i-2", itemNumber: 2, wbsCode: "DEM2.2" }
        ]
      },
      scopeCardAggregateMax: { cardNumber: 1 }
    });
    mocks.cuttingSheetItemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.scopeWasteItemUpdateMany.mockResolvedValue({ count: 1 });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.changeCardDiscipline("tender-1", "card-1", "CIV");
    expect(result.itemsRenumbered).toBe(2);
    expect(result.cuttingRefsUpdated).toBe(2);
    expect(result.wasteRefsUpdated).toBe(2);
    // Items should have been updated to CIV2.<n> (target cardNumber = max+1 = 2)
    const itemUpdateArgs = mocks.scopeOfWorksItemUpdate.mock.calls;
    expect(itemUpdateArgs.length).toBe(2);
    const firstUpdate = itemUpdateArgs[0]?.[0] as { data?: { wbsCode?: string } };
    expect(firstUpdate?.data?.wbsCode).toBe("CIV2.1");
  });
});

describe("ScopeOfWorksService.deleteCard (PR B1)", () => {
  it("deletes when card has no items", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1" },
      scopeItemCount: 0
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.deleteCard("tender-1", "card-1");
    expect(mocks.scopeCardDelete).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictException when card has items", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1" },
      scopeItemCount: 3
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.deleteCard("tender-1", "card-1")).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.scopeCardDelete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when card not in tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.deleteCard("tender-1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ScopeOfWorksService.reorderCards (PR B1)", () => {
  it("updates sortOrder per array index", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindMany: [{ id: "a" }, { id: "b" }, { id: "c" }]
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.reorderCards("tender-1", ["c", "a", "b"]);
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    const txArg = mocks.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(3);
  });

  it("rejects IDs not in tender", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindMany: [{ id: "a" }]
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.reorderCards("tender-1", ["a", "b"])).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe("ScopeOfWorksService.createItemInCard (PR B1)", () => {
  it("produces hierarchical wbsCode and per-card itemNumber=max+1", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1", discipline: "DEM", cardNumber: 1 },
      scopeItemAggregateMaxItemNumber: 2
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.createItemInCard("tender-1", "user-1", "card-1", {
      rowType: "demolition",
      description: "test"
    } as never);
    const args = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { wbsCode?: string; itemNumber?: number; cardId?: string };
    };
    expect(args.data?.wbsCode).toBe("DEM1.3");
    expect(args.data?.itemNumber).toBe(3);
    expect(args.data?.cardId).toBe("card-1");
  });

  it("throws NotFoundException for card not in tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(
      svc.createItemInCard("tender-1", "user-1", "missing", {
        rowType: "demolition",
        description: "test"
      } as never)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ScopeOfWorksService.listCards (PR B1)", () => {
  it("returns cards with itemCount", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindMany: [
        {
          id: "c1",
          tenderId: "tender-1",
          name: "Demo",
          discipline: "DEM",
          cardNumber: 1,
          sortOrder: 0,
          _count: { scopeItems: 3 },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "c2",
          tenderId: "tender-1",
          name: "Civil",
          discipline: "CIV",
          cardNumber: 1,
          sortOrder: 1,
          _count: { scopeItems: 1 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.listCards("tender-1");
    expect(result).toHaveLength(2);
    expect(result[0]?.itemCount).toBe(3);
    expect(result[1]?.itemCount).toBe(1);
    expect(result[0]?.cardNumber).toBe(1);
  });
});

describe("ScopeOfWorksService.setPlantColumnCount (PR B1.6)", () => {
  it("updates plantColumnCount when card exists and count >= 1", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1", tenderId: "tender-1", plantColumnCount: 1 }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setPlantColumnCount("tender-1", "card-1", 3);
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { plantColumnCount?: number };
    };
    expect(args.data?.plantColumnCount).toBe(3);
  });

  it("rejects plantColumnCount < 1", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.setPlantColumnCount("tender-1", "card-1", 0)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws NotFoundException when card not in tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(svc.setPlantColumnCount("tender-1", "missing", 2)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("can shrink plantColumnCount back to 1 (caller is responsible for data cleanup)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "card-1", tenderId: "tender-1", plantColumnCount: 3 }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setPlantColumnCount("tender-1", "card-1", 1);
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { plantColumnCount?: number };
    };
    expect(args.data?.plantColumnCount).toBe(1);
  });
});

describe("listCards exposes plantColumnCount (PR B1.6)", () => {
  it("returns plantColumnCount alongside cardNumber + itemCount", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindMany: [
        {
          id: "c1",
          tenderId: "tender-1",
          name: "Demo",
          discipline: "DEM",
          cardNumber: 1,
          plantColumnCount: 4,
          sortOrder: 0,
          _count: { scopeItems: 2 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.listCards("tender-1");
    expect(result[0]?.plantColumnCount).toBe(4);
  });
});

describe("ScopeOfWorksService.setCardNotes (PR B1.7)", () => {
  it("updates cuttingNotes when supplied alone", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardNotes("tender-1", "c1", { cuttingNotes: "Cut at 7am" });
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cuttingNotes?: string | null; wasteNotes?: string | null };
    };
    expect(args.data?.cuttingNotes).toBe("Cut at 7am");
    expect(args.data?.wasteNotes).toBeUndefined();
  });

  it("updates wasteNotes when supplied alone", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardNotes("tender-1", "c1", { wasteNotes: "Sort spoil onsite" });
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cuttingNotes?: string | null; wasteNotes?: string | null };
    };
    expect(args.data?.wasteNotes).toBe("Sort spoil onsite");
    expect(args.data?.cuttingNotes).toBeUndefined();
  });

  it("updates both fields in a single PATCH", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardNotes("tender-1", "c1", { cuttingNotes: "A", wasteNotes: "B" });
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cuttingNotes?: string | null; wasteNotes?: string | null };
    };
    expect(args.data?.cuttingNotes).toBe("A");
    expect(args.data?.wasteNotes).toBe("B");
  });

  it("clears notes when empty string is supplied", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardNotes("tender-1", "c1", { cuttingNotes: "" });
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { cuttingNotes?: string | null };
    };
    expect(args.data?.cuttingNotes).toBeNull();
  });

  it("throws NotFoundException when card is not in the tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(
      svc.setCardNotes("tender-1", "missing", { cuttingNotes: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ScopeOfWorksService.createItemInCard relaxed DTO (PR B1.7)", () => {
  it("accepts empty body — defaults rowType to general-labour and description to empty string", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", discipline: "DEM", cardNumber: 1 },
      scopeItemAggregateMaxItemNumber: 0
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.createItemInCard("tender-1", "user-1", "c1", {});
    const args = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { rowType?: string; description?: string; wbsCode?: string };
    };
    expect(args.data?.rowType).toBe("general-labour");
    expect(args.data?.description).toBe("");
    expect(args.data?.wbsCode).toBe("DEM1.1");
  });

  it("respects an explicit rowType when provided", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", discipline: "DEM", cardNumber: 1 },
      scopeItemAggregateMaxItemNumber: 0
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.createItemInCard("tender-1", "user-1", "c1", { rowType: "demolition" });
    const args = (mocks.scopeOfWorksItemCreate.mock.calls[0]?.[0] ?? {}) as {
      data?: { rowType?: string };
    };
    expect(args.data?.rowType).toBe("demolition");
  });
});

describe("ScopeOfWorksService.setCardMarkupOverride (PR B2)", () => {
  it("stores a Decimal value when supplied", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardMarkupOverride("tender-1", "c1", 42.5);
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { markupOverride?: unknown };
    };
    // Prisma.Decimal toString matches the input.
    expect(String(args.data?.markupOverride)).toBe("42.5");
  });

  it("clears the override when null is supplied", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeCardFindFirst: { id: "c1", tenderId: "tender-1" }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.setCardMarkupOverride("tender-1", "c1", null);
    const args = (mocks.scopeCardUpdate.mock.calls[0]?.[0] ?? {}) as {
      data?: { markupOverride?: unknown };
    };
    expect(args.data?.markupOverride).toBeNull();
  });

  it("throws NotFoundException when card is not in the tender", async () => {
    const { prisma } = buildPrismaMock({ scopeCardFindFirst: null });
    const svc = new ScopeOfWorksService(prisma as never);
    await expect(
      svc.setCardMarkupOverride("tender-1", "missing", 30)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ScopeOfWorksService.resetAllCardMarkup (PR B2)", () => {
  it("issues an updateMany scoped to the tender + non-null overrides", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.scopeCardUpdateMany.mockResolvedValueOnce({ count: 3 });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.resetAllCardMarkup("tender-1");
    expect(result).toEqual({ cardsReset: 3 });
    const args = (mocks.scopeCardUpdateMany.mock.calls[0]?.[0] ?? {}) as {
      where?: { tenderId?: string; markupOverride?: { not: null } };
      data?: { markupOverride?: null };
    };
    expect(args.where?.tenderId).toBe("tender-1");
    expect(args.where?.markupOverride).toEqual({ not: null });
    expect(args.data?.markupOverride).toBeNull();
  });

  it("returns cardsReset: 0 when no cards had an override", async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.scopeCardUpdateMany.mockResolvedValueOnce({ count: 0 });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.resetAllCardMarkup("tender-1");
    expect(result).toEqual({ cardsReset: 0 });
  });
});

describe("listCards exposes markupOverride (PR B2)", () => {
  it("returns markupOverride as number when set; null when cleared", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindMany: [
        {
          id: "c1",
          tenderId: "tender-1",
          name: "Demo",
          discipline: "DEM",
          cardNumber: 1,
          plantColumnCount: 1,
          cuttingNotes: null,
          wasteNotes: null,
          markupOverride: 45.5,
          sortOrder: 0,
          _count: { scopeItems: 0 },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "c2",
          tenderId: "tender-1",
          name: "Civ",
          discipline: "CIV",
          cardNumber: 1,
          plantColumnCount: 1,
          cuttingNotes: null,
          wasteNotes: null,
          markupOverride: null,
          sortOrder: 1,
          _count: { scopeItems: 0 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.listCards("tender-1");
    expect(result[0]?.markupOverride).toBe(45.5);
    expect(result[1]?.markupOverride).toBeNull();
  });
});

describe("ScopeOfWorksService.getCardSummary — labourDays + plant duration", () => {
  const cardBase = {
    id: "card-1",
    tenderId: "tender-1",
    peakCrewOverride: null,
    labourDaysOverride: null,
    plantSummaryOverride: null,
    durationOverride: null
  };

  it("computes labourDays = totalPersonDays / peakCrew (IS-T100 DEM scenario)", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [
          { men: "4", days: "6", plantItems: null },
          { men: "3", days: "5", plantItems: null },
          { men: "3", days: "4", plantItems: null },
          { men: "2", days: "3", plantItems: null }
        ]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.peakCrew).toBe(4);
    expect(result.computed.labourDays).toBe(14.3);
  });

  it("single item: 5 men × 10 days → labourDays = 10", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [{ men: "5", days: "10", plantItems: null }]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.peakCrew).toBe(5);
    expect(result.computed.labourDays).toBe(10);
  });

  it("empty card: peakCrew=0, labourDays=0 (no divide-by-zero)", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: { ...cardBase, scopeItems: [] }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.peakCrew).toBe(0);
    expect(result.computed.labourDays).toBe(0);
  });

  it("plant peakDays uses totalQtyDays / peakQty formula (single cluster)", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [
          {
            men: "1",
            days: "1",
            plantItems: [
              { columnIndex: 1, description: "Excavator 01T-03T", qty: 2, days: 3 }
            ]
          }
        ]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.plantSummary).toEqual([
      { name: "Excavator 01T-03T", peakQty: 2, peakDays: 3 }
    ]);
  });

  it("plant peakDays across multiple clusters: totalQtyDays / peakQty", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [
          {
            men: "1",
            days: "1",
            plantItems: [
              { columnIndex: 1, description: "Excavator 01T-03T", qty: 2, days: 3 }
            ]
          },
          {
            men: "1",
            days: "1",
            plantItems: [
              { columnIndex: 1, description: "Excavator 01T-03T", qty: 1, days: 4 }
            ]
          }
        ]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.plantSummary).toEqual([
      { name: "Excavator 01T-03T", peakQty: 2, peakDays: 5 }
    ]);
  });

  it("null qty defaults to 1 for plant peakDays", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [
          {
            men: "1",
            days: "1",
            plantItems: [
              { columnIndex: 1, description: "Tipper", qty: null, days: 3 }
            ]
          }
        ]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.plantSummary).toEqual([
      { name: "Tipper", peakQty: 1, peakDays: 3 }
    ]);
  });

  it("returns empty plantSummary when all entries have no description", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        scopeItems: [
          {
            men: "1",
            days: "1",
            plantItems: [
              { columnIndex: 1, description: undefined, qty: undefined, days: undefined }
            ]
          }
        ]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.computed.plantSummary).toEqual([]);
  });

  it("returns labourDaysOverride in overrides when set", async () => {
    const { prisma } = buildPrismaMock({
      scopeCardFindFirst: {
        ...cardBase,
        labourDaysOverride: "20.5",
        scopeItems: [{ men: "2", days: "5", plantItems: null }]
      }
    });
    const svc = new ScopeOfWorksService(prisma as never);
    const result = await svc.getCardSummary("tender-1", "card-1");
    expect(result.overrides.labourDaysOverride).toBe(20.5);
    expect(result.computed.labourDays).toBe(5);
  });
});
