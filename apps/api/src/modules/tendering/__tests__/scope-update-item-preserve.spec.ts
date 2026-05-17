// PR B4a.5 — the backend no longer derives sqm/m3/tonnes from raw
// inputs. The frontend ships the full dimension picture on save and
// the service persists exactly what it receives. These specs lock in
// that contract:
//   - notes-only / wasteIncluded-only PATCH leaves dimensions
//     untouched (the DTO simply omits them).
//   - a dimension-touching PATCH writes whatever the DTO contains,
//     without inference.
//
// Updated from the B4a.2 version (which proved server-side derive
// behaviour that B4a.5 removed because it leaked the cascading-
// derivation bug Marco hit in production).

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
  length: new Prisma.Decimal("4"),
  height: new Prisma.Decimal("2.5"),
  depth: new Prisma.Decimal("0.5"),
  density: new Prisma.Decimal("2.4"),
  sqm: new Prisma.Decimal("99"),
  m3: new Prisma.Decimal("49.5"),
  tonnes: new Prisma.Decimal("118.8"),
  card: { discipline: "DEM", markupOverride: null }
};

describe("ScopeOfWorksService.updateItem persists what the DTO sends (PR B4a.5)", () => {
  it("PATCH { notes: 'x' } omits sqm/m3/tonnes from the update payload", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { notes: "updated" } as never, "user-1");

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.notes).toBe("updated");
    // The dimension columns aren't in the patch body, so they're
    // undefined in the update data — Prisma leaves them as-is.
    expect(data.sqm).toBeUndefined();
    expect(data.m3).toBeUndefined();
    expect(data.tonnes).toBeUndefined();
  });

  it("PATCH { wasteIncluded: true } omits sqm/m3/tonnes from the update payload", async () => {
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { wasteIncluded: true } as never, "user-1");

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.wasteIncluded).toBe(true);
    expect(data.sqm).toBeUndefined();
    expect(data.m3).toBeUndefined();
    expect(data.tonnes).toBeUndefined();
  });

  it("PATCH that includes sqm/m3/tonnes persists exactly those values (no server-side derive)", async () => {
    // PR B4a.5: the frontend is the source of truth for dimension
    // values. The backend doesn't infer, doesn't recompute — it just
    // stores what arrives.
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem(
      "tender-1",
      "item-1",
      {
        length: 8,
        height: 2.5,
        depth: 0.5,
        density: 2.4,
        sqm: 20,
        m3: 10,
        tonnes: 24
      } as never,
      "user-1"
    );

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.length)).toBe(8);
    expect(Number(data.sqm)).toBe(20);
    expect(Number(data.m3)).toBe(10);
    expect(Number(data.tonnes)).toBe(24);
  });

  it("PATCH { length: 8 } alone updates length only — does NOT recompute sqm/m3/tonnes server-side", async () => {
    // This is the exact regression that B4a.5 fixes. Under B4a.2 the
    // backend would silently rederive sqm/m3/tonnes from the new
    // length + existing height/depth/density, destroying any user
    // override the frontend had previously persisted. Under B4a.5
    // the frontend always ships the full picture when it intends a
    // dimension change; a length-only DTO leaves the other six
    // fields untouched on the row.
    const { prisma, mocks } = buildPrismaMock(baseExistingItem);
    const svc = new ScopeOfWorksService(prisma as never);
    await svc.updateItem("tender-1", "item-1", { length: 8 } as never, "user-1");

    const data = (mocks.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(Number(data.length)).toBe(8);
    expect(data.sqm).toBeUndefined();
    expect(data.m3).toBeUndefined();
    expect(data.tonnes).toBeUndefined();
  });
});
