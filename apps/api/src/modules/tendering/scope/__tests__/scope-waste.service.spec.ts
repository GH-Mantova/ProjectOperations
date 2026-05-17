import { NotFoundException } from "@nestjs/common";
import { ScopeWasteService } from "../../scope-waste.service";

// PR B3 — sumFromAbove aggregator specs. Mocks PrismaService to
// avoid a real DB; matches the pattern used by scope-cards.service.spec.

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

type ScopeItem = {
  wasteIncluded: boolean;
  wasteGroup: string | null;
  wasteItem: string | null;
  unit: string | null;
  value: number | null;
};

type WasteRate = {
  id: string;
  wasteGroup: string;
  wasteType: string;
  facility: string;
  unit: string;
  tonRate: number;
  isActive: boolean;
};

function buildPrismaMock(opts: {
  card?: { id: string; tenderId: string; discipline: string } | null;
  scopeItems?: ScopeItem[];
  wasteRates?: WasteRate[];
  deletedCount?: number;
} = {}) {
  const scopeCardFindFirst: AsyncMock = jest.fn(async () =>
    opts.card === undefined ? { id: "card-1", tenderId: "tender-1", discipline: "DEM" } : opts.card
  );
  const scopeOfWorksItemFindMany: AsyncMock = jest.fn(async () => opts.scopeItems ?? []);
  const estimateWasteRateFindMany: AsyncMock = jest.fn(async () => opts.wasteRates ?? []);
  const scopeWasteItemDeleteMany: AsyncMock = jest.fn(async () => ({ count: opts.deletedCount ?? 0 }));
  const scopeWasteItemCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: `row-${Math.random().toString(36).slice(2, 8)}`, ...data };
  });

  const tx = {
    scopeWasteItem: {
      deleteMany: scopeWasteItemDeleteMany,
      create: scopeWasteItemCreate
    }
  };

  const $transaction: AsyncMock = jest.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => Promise<unknown>)(tx);
    }
    return [];
  });

  const prisma = {
    scopeCard: { findFirst: scopeCardFindFirst },
    scopeOfWorksItem: { findMany: scopeOfWorksItemFindMany },
    estimateWasteRate: { findMany: estimateWasteRateFindMany },
    scopeWasteItem: {
      deleteMany: scopeWasteItemDeleteMany,
      create: scopeWasteItemCreate
    },
    $transaction
  };

  return {
    prisma,
    mocks: {
      scopeCardFindFirst,
      scopeOfWorksItemFindMany,
      estimateWasteRateFindMany,
      scopeWasteItemDeleteMany,
      scopeWasteItemCreate,
      $transaction
    }
  };
}

const rates: WasteRate[] = [
  {
    id: "r1",
    wasteGroup: "Concrete",
    wasteType: "Clean concrete",
    facility: "Cleanaway Lytton",
    unit: "t",
    tonRate: 80,
    isActive: true
  },
  {
    id: "r2",
    wasteGroup: "Mixed",
    wasteType: "General",
    facility: "Visy",
    unit: "m³",
    tonRate: 120,
    isActive: true
  }
];

describe("ScopeWasteService.sumFromAbove (PR B3)", () => {
  it("throws NotFoundException when the card is not in the tender", async () => {
    const { prisma } = buildPrismaMock({ card: null });
    const svc = new ScopeWasteService(prisma as never);
    await expect(svc.sumFromAbove("tender-1", "missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("aggregates items by (wasteGroup, wasteItem, unit) and sums value", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        // Two rows that should merge into one Concrete/Clean concrete/t total of 30.
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", unit: "t", value: 12 },
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", unit: "t", value: 18 },
        // Separate group → its own row.
        { wasteIncluded: true, wasteGroup: "Mixed", wasteItem: "General", unit: "m³", value: 5 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 2 });
    expect(mocks.scopeWasteItemCreate).toHaveBeenCalledTimes(2);
    const calls = mocks.scopeWasteItemCreate.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    );
    const concreteRow = calls.find((d) => d.wasteGroup === "Concrete");
    expect(concreteRow?.wasteType).toBe("Clean concrete");
    expect(concreteRow?.unit).toBe("t");
    expect(Number(concreteRow?.wasteTonnes)).toBe(30); // 12 + 18
    expect(concreteRow?.wasteFacility).toBe("Cleanaway Lytton");
    expect(Number(concreteRow?.ratePerTonne)).toBe(80);
    expect(Number(concreteRow?.lineTotal)).toBe(2400); // 30 × 80
    expect(concreteRow?.autoSummed).toBe(true);
    expect(concreteRow?.cardId).toBe("card-1");
    expect(concreteRow?.discipline).toBe("DEM");
  });

  it("skips items where wasteIncluded is false", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: false, wasteGroup: "Concrete", wasteItem: "Clean concrete", unit: "t", value: 100 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
    expect(mocks.scopeWasteItemCreate).not.toHaveBeenCalled();
  });

  it("skips items missing wasteGroup, wasteItem, unit, or value <= 0", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: null, wasteItem: "X", unit: "t", value: 10 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: null, unit: "t", value: 10 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: "X", unit: null, value: 10 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: "X", unit: "t", value: 0 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: "X", unit: "t", value: null }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
    expect(mocks.scopeWasteItemCreate).not.toHaveBeenCalled();
  });

  it("sets facility=null and lineTotal=null when no matching rate exists", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Unmapped", wasteItem: "Strange", unit: "ea", value: 5 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 1 });
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteFacility).toBeNull();
    expect(data.ratePerTonne).toBeNull();
    expect(data.lineTotal).toBeNull();
    expect(Number(data.wasteTonnes)).toBe(5); // qty preserved
    expect(data.autoSummed).toBe(true);
  });

  it("replaces ONLY autoSummed=true rows; manual rows survive", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", unit: "t", value: 10 }
      ],
      wasteRates: rates,
      deletedCount: 3
    });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 3, created: 1 });
    // The deleteMany call must scope to autoSummed=true and the card.
    const deleteArgs = (mocks.scopeWasteItemDeleteMany.mock.calls[0]?.[0] ?? {}) as {
      where?: { tenderId?: string; cardId?: string; autoSummed?: boolean };
    };
    expect(deleteArgs.where?.tenderId).toBe("tender-1");
    expect(deleteArgs.where?.cardId).toBe("card-1");
    expect(deleteArgs.where?.autoSummed).toBe(true);
  });

  it("returns { replaced: 0, created: 0 } when there are no contributing items", async () => {
    const { prisma } = buildPrismaMock({ scopeItems: [], wasteRates: rates });
    const svc = new ScopeWasteService(prisma as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
  });

  it("picks the first matching active rate when multiple facilities exist", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", unit: "t", value: 5 }
      ],
      wasteRates: [
        ...rates,
        // Second matching rate — should NOT be picked because the
        // service uses the first match (rates are passed in order).
        {
          id: "r3",
          wasteGroup: "Concrete",
          wasteType: "Clean concrete",
          facility: "Alternative Tip",
          unit: "t",
          tonRate: 60,
          isActive: true
        }
      ]
    });
    const svc = new ScopeWasteService(prisma as never);
    await svc.sumFromAbove("tender-1", "card-1", "user-1");
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteFacility).toBe("Cleanaway Lytton");
    expect(Number(data.ratePerTonne)).toBe(80);
  });
});
