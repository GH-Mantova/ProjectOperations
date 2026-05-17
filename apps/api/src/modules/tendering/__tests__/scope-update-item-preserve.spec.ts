// PR B4a.2 — regression spec: partial PATCH that doesn't touch any
// dimension field must NOT recompute sqm/m3/tonnes from the row's raw
// inputs. Doing so would destroy a previously-saved explicit override
// (the DB can't tell us which side a stored sqm came from).

import { Prisma } from "@prisma/client";
import { ScopeOfWorksService } from "../scope-of-works.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(existingItem: Record<string, unknown>) {
  const findUnique: AsyncMock = jest.fn(async () => existingItem);
  const update: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { ...existingItem, ...data, card: existingItem.card };
  });

  const prisma = {
    tender: { findUnique: jest.fn(async () => ({ id: "tender-1" })) },
    scopeOfWorksItem: { findUnique, update }
  };

  return { prisma, mocks: { findUnique, update } };
}

const baseExistingItem = {
  id: "item-1",
  tenderId: "tender-1",
  cardId: "card-1",
  status: "confirmed",
  rowType: "general-labour",
  // The "override" the user previously typed — sqm=99 is NOT
  // length × height (which would be 10).
  length: new Prisma.Decimal("4"),
  height: new Prisma.Decimal("2.5"),
  depth: new Prisma.Decimal("0.5"),
  density: new Prisma.Decimal("2.4"),
  sqm: new Prisma.Decimal("99"),
  m3: new Prisma.Decimal("49.5"),
  tonnes: new Prisma.Decimal("118.8"),
  card: { discipline: "DEM", markupOverride: null }
};

describe("ScopeOfWorksService.updateItem partial PATCH preserves dimension overrides (PR B4a.2)", () => {
  it("PATCH { notes: 'x' } leaves sqm/m3/tonnes untouched in the update data", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { notes: "updated" } as never, "user-1");

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const updateArgs = mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const data = updateArgs.data;

    // notes was patched
    expect(data.notes).toBe("updated");
    // The three derived-or-override columns were NOT included in the
    // update data — Prisma will leave them as-is on the row.
    expect(data.sqm).toBeUndefined();
    expect(data.m3).toBeUndefined();
    expect(data.tonnes).toBeUndefined();
  });

  it("PATCH { wasteIncluded: true } leaves sqm/m3/tonnes untouched", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { wasteIncluded: true } as never, "user-1");

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteIncluded).toBe(true);
    expect(data.sqm).toBeUndefined();
    expect(data.m3).toBeUndefined();
    expect(data.tonnes).toBeUndefined();
  });

  it("PATCH { length: 8 } DOES recompute sqm/m3/tonnes from raw (override not supplied)", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    // User typed only a new length. They did NOT include sqm in the
    // patch — so the override is gone, and the new sqm derives from
    // length × height = 8 × 2.5 = 20.
    await svc.updateItem("tender-1", "item-1", { length: 8 } as never, "user-1");

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.length)).toBe(8);
    expect(Number(data.sqm)).toBe(20); // 8 × 2.5 (existing height)
    expect(Number(data.m3)).toBe(10); // 20 × 0.5 (existing depth)
    expect(Number(data.tonnes)).toBe(24); // 10 × 2.4 (existing density)
  });

  it("PATCH { length: 8, sqm: 99 } preserves the explicit sqm override", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { length: 8, sqm: 99 } as never, "user-1");

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.sqm)).toBe(99); // explicit override wins
    expect(Number(data.m3)).toBe(49.5); // 99 × 0.5
    expect(Number(data.tonnes)).toBe(118.8); // 49.5 × 2.4
  });
});
