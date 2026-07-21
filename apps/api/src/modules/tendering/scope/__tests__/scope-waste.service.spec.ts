import { NotFoundException } from "@nestjs/common";
import { ScopeWasteService } from "../../scope-waste.service";

// PR B4a — sumFromAbove now keys by (wasteGroup, wasteItem) only and
// reads `tonnes` + `m3` directly from each item; the rate is picked by
// (group, type) and the line total bills against whichever side
// (tonnes or m³) matches the rate's unit.

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

type ScopeItem = {
  wasteIncluded: boolean;
  wasteGroup: string | null;
  wasteItem: string | null;
  tonnes: number | null;
  m3: number | null;
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

describe("ScopeWasteService.sumFromAbove (PR B4a)", () => {
  it("throws NotFoundException when the card is not in the tender", async () => {
    const { prisma } = buildPrismaMock({ card: null });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    await expect(svc.sumFromAbove("tender-1", "missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("aggregates items by (wasteGroup, wasteItem) and sums BOTH tonnes and m³", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        // Two rows merge into one Concrete/Clean concrete with summed tonnes + m3.
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 12, m3: 5 },
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 18, m3: 7.5 },
        // Separate group → its own row.
        { wasteIncluded: true, wasteGroup: "Mixed", wasteItem: "General", tonnes: 0, m3: 4 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 2 });
    expect(mocks.scopeWasteItemCreate).toHaveBeenCalledTimes(2);
    const calls = mocks.scopeWasteItemCreate.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    );
    const concreteRow = calls.find((d) => d.wasteGroup === "Concrete");
    expect(concreteRow?.wasteType).toBe("Clean concrete");
    expect(Number(concreteRow?.qty)).toBe(30); // 12 + 18
    expect(Number(concreteRow?.m3)).toBe(12.5); // 5 + 7.5
    expect(concreteRow?.unit).toBe("t"); // billed by rate.unit
    expect(concreteRow?.wasteFacility).toBe("Cleanaway Lytton");
    expect(Number(concreteRow?.ratePerTonne)).toBe(80);
    expect(Number(concreteRow?.lineTotal)).toBe(2400); // 30 × 80 (t-billed)
    expect(concreteRow?.autoSummed).toBe(true);
    expect(concreteRow?.cardId).toBe("card-1");
    expect(concreteRow?.discipline).toBe("DEM");
  });

  it("bills against m³ when the rate's unit is m³", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Mixed", wasteItem: "General", tonnes: 10, m3: 4 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    await svc.sumFromAbove("tender-1", "card-1", "user-1");
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.unit).toBe("m³");
    expect(Number(data.qty)).toBe(10); // tonnes still persisted
    expect(Number(data.m3)).toBe(4);
    expect(Number(data.ratePerTonne)).toBe(120);
    expect(Number(data.lineTotal)).toBe(480); // 4 × 120, NOT 10 × 120
  });

  it("skips items where wasteIncluded is false", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: false, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 100, m3: 40 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
    expect(mocks.scopeWasteItemCreate).not.toHaveBeenCalled();
  });

  it("skips items missing wasteGroup, wasteItem, or with no tonnes AND no m³", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: null, wasteItem: "X", tonnes: 10, m3: 5 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: null, tonnes: 10, m3: 5 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: "X", tonnes: 0, m3: 0 },
        { wasteIncluded: true, wasteGroup: "G", wasteItem: "X", tonnes: null, m3: null }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
    expect(mocks.scopeWasteItemCreate).not.toHaveBeenCalled();
  });

  it("includes items that have only m³ (zero tonnes)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Mixed", wasteItem: "General", tonnes: 0, m3: 3 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 1 });
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.m3)).toBe(3);
    expect(Number(data.lineTotal)).toBe(360); // 3 × 120 (m³-billed)
  });

  it("sets facility=null and lineTotal=null when no matching rate exists", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Unmapped", wasteItem: "Strange", tonnes: 5, m3: 2 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 1 });
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteFacility).toBeNull();
    expect(data.ratePerTonne).toBeNull();
    expect(data.lineTotal).toBeNull();
    expect(data.unit).toBeNull();
    expect(Number(data.qty)).toBe(5);
    expect(Number(data.m3)).toBe(2);
    expect(data.autoSummed).toBe(true);
  });

  it("replaces ONLY autoSummed=true rows; manual rows survive", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 10, m3: 4 }
      ],
      wasteRates: rates,
      deletedCount: 3
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 3, created: 1 });
    const deleteArgs = (mocks.scopeWasteItemDeleteMany.mock.calls[0]?.[0] ?? {}) as {
      where?: { tenderId?: string; cardId?: string; autoSummed?: boolean };
    };
    expect(deleteArgs.where?.tenderId).toBe("tender-1");
    expect(deleteArgs.where?.cardId).toBe("card-1");
    expect(deleteArgs.where?.autoSummed).toBe(true);
  });

  it("returns { replaced: 0, created: 0 } when there are no contributing items", async () => {
    const { prisma } = buildPrismaMock({ scopeItems: [], wasteRates: rates });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0 });
  });

  it("picks the first matching active rate when multiple facilities exist for the same (group, type)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 5, m3: 2 }
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
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    await svc.sumFromAbove("tender-1", "card-1", "user-1");
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteFacility).toBe("Cleanaway Lytton");
    expect(Number(data.ratePerTonne)).toBe(80);
  });

  it("merges items whose dimensions differ (group key drops unit)", async () => {
    // Under B3 these two items would have been TWO rows (keyed by unit
    // "t" vs "m³"). Under B4a they merge into ONE row.
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 10, m3: 4 },
        { wasteIncluded: true, wasteGroup: "Concrete", wasteItem: "Clean concrete", tonnes: 0, m3: 6 }
      ],
      wasteRates: rates
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 1 });
    const data = (mocks.scopeWasteItemCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.qty)).toBe(10);
    expect(Number(data.m3)).toBe(10);
  });

  it("collision-safe key: ('A B', 'C') and ('A', 'B C') stay as separate rows (PR B4a.2)", async () => {
    // A space-delimited key would collapse both pairs into "A B C" and
    // sum them as one. The null-byte delimiter keeps them distinct.
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        { wasteIncluded: true, wasteGroup: "A B", wasteItem: "C", tonnes: 5, m3: 0 },
        { wasteIncluded: true, wasteGroup: "A", wasteItem: "B C", tonnes: 7, m3: 0 }
      ],
      wasteRates: []
    });
    const svc = new ScopeWasteService(prisma as never, {} as never, {} as never);
    const result = await svc.sumFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 2 });
    const calls = mocks.scopeWasteItemCreate.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    );
    const first = calls.find((d) => d.wasteGroup === "A B" && d.wasteType === "C");
    const second = calls.find((d) => d.wasteGroup === "A" && d.wasteType === "B C");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(Number(first?.qty)).toBe(5);
    expect(Number(second?.qty)).toBe(7);
  });
});
