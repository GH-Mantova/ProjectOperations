// PR B-followup — schema-shape compile-time guards.
//
// cardId became NOT NULL on both per-card subtables (cutting + waste).
// The Prisma client's generated `UncheckedCreateInput` types are the
// canonical reflection of the schema; if cardId is ever flipped back
// to optional, the @ts-expect-error directives below will stop
// failing and this build will fail. That's the long-term regression
// guard.

import type { Prisma } from "@prisma/client";

describe("cardId NOT NULL guards (PR B-followup)", () => {
  it("CuttingSheetItem.create input rejects payloads without cardId", () => {
    // The Prisma generated type for create requires cardId now. If
    // the schema is ever softened, this @ts-expect-error fails.
    // @ts-expect-error — cardId is required on CuttingSheetItemUncheckedCreateInput
    const _check: Prisma.CuttingSheetItemUncheckedCreateInput = {
      tenderId: "x",
      wbsRef: "y",
      itemType: "saw-cut",
      createdById: "u"
      // cardId deliberately omitted
    };
    void _check;
    expect(true).toBe(true);
  });

  it("ScopeWasteItem.create input rejects payloads without cardId", () => {
    // @ts-expect-error — cardId is required on ScopeWasteItemUncheckedCreateInput
    const _check: Prisma.ScopeWasteItemUncheckedCreateInput = {
      tenderId: "x",
      discipline: "DEM",
      description: "y",
      createdById: "u"
      // cardId deliberately omitted
    };
    void _check;
    expect(true).toBe(true);
  });

  it("a payload WITH cardId still compiles for both models", () => {
    // Sanity check that the type isn't broken — a complete payload
    // type-checks fine.
    const cuttingPayload: Prisma.CuttingSheetItemUncheckedCreateInput = {
      tenderId: "t",
      cardId: "c",
      wbsRef: "w",
      itemType: "saw-cut",
      createdById: "u"
    };
    const wastePayload: Prisma.ScopeWasteItemUncheckedCreateInput = {
      tenderId: "t",
      cardId: "c",
      discipline: "DEM",
      description: "d",
      createdById: "u"
    };
    expect(cuttingPayload.cardId).toBe("c");
    expect(wastePayload.cardId).toBe("c");
  });
});
