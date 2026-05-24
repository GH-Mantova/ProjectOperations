import { Prisma } from "@prisma/client";
import { LookupRateHandler } from "../lookup-rate.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";
import type { PrismaService } from "../../../../../prisma/prisma.service";

// Lightweight mock — covers all eight rate tables LookupRateHandler touches.
function buildPrismaMock(opts: {
  cuttingRows?: Array<{
    id: string;
    equipment: string;
    elevation: string;
    material: string;
    depthMm: number;
    ratePerM: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  coreHoleRows?: Array<{
    id: string;
    diameterMm: number;
    ratePerHole: Prisma.Decimal;
    isActive: boolean;
  }>;
  labourRows?: Array<{
    id: string;
    role: string;
    dayRate: Prisma.Decimal;
    nightRate: Prisma.Decimal;
    weekendRate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  plantRows?: Array<{
    id: string;
    item: string;
    unit: string;
    rate: Prisma.Decimal;
    fuelRate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  wasteRows?: Array<{
    id: string;
    wasteType: string;
    facility: string;
    wasteGroup: string | null;
    unit: string;
    tonRate: Prisma.Decimal;
    loadRate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  fuelRows?: Array<{
    id: string;
    item: string;
    unit: string;
    rate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  enclosureRows?: Array<{
    id: string;
    enclosureType: string;
    unit: string;
    rate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
  otherRows?: Array<{
    id: string;
    description: string;
    unit: string;
    rate: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }>;
}) {
  const cuttingRows = opts.cuttingRows ?? [];
  const coreHoleRows = opts.coreHoleRows ?? [];
  const labourRows = opts.labourRows ?? [];
  const plantRows = opts.plantRows ?? [];
  const wasteRows = opts.wasteRows ?? [];
  const fuelRows = opts.fuelRows ?? [];
  const enclosureRows = opts.enclosureRows ?? [];
  const otherRows = opts.otherRows ?? [];

  const prisma = {
    estimateCuttingRate: {
      findMany: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        return cuttingRows.filter((r) => matchCuttingWhere(r, w));
      })
    },
    estimateCoreHoleRate: {
      findUnique: jest.fn(async (args: { where: { diameterMm: number } }) => {
        return coreHoleRows.find((r) => r.diameterMm === args.where.diameterMm) ?? null;
      }),
      findMany: jest.fn(async () => coreHoleRows.filter((r) => r.isActive))
    },
    estimateLabourRate: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const role = w.role as { equals?: string; mode?: string } | undefined;
        const active = w.isActive === true;
        return (
          labourRows.find(
            (r) =>
              (!active || r.isActive) &&
              (!role?.equals || r.role.toLowerCase() === role.equals.toLowerCase())
          ) ?? null
        );
      }),
      findMany: jest.fn(async () => labourRows.filter((r) => r.isActive))
    },
    estimatePlantRate: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const item = w.item as { equals?: string; mode?: string } | undefined;
        const active = w.isActive === true;
        return (
          plantRows.find(
            (r) =>
              (!active || r.isActive) &&
              (!item?.equals || r.item.toLowerCase() === item.equals.toLowerCase())
          ) ?? null
        );
      }),
      findMany: jest.fn(async () => plantRows.filter((r) => r.isActive))
    },
    estimateWasteRate: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const wasteType = w.wasteType as { equals?: string; mode?: string } | undefined;
        const facility = w.facility as { equals?: string; mode?: string } | undefined;
        const active = w.isActive === true;
        return (
          wasteRows.find(
            (r) =>
              (!active || r.isActive) &&
              (!wasteType?.equals || r.wasteType.toLowerCase() === wasteType.equals.toLowerCase()) &&
              (!facility?.equals || r.facility.toLowerCase() === facility.equals.toLowerCase())
          ) ?? null
        );
      }),
      findMany: jest.fn(async () => wasteRows.filter((r) => r.isActive))
    },
    estimateFuelRate: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const item = w.item as { equals?: string; mode?: string } | undefined;
        const active = w.isActive === true;
        return (
          fuelRows.find(
            (r) =>
              (!active || r.isActive) &&
              (!item?.equals || r.item.toLowerCase() === item.equals.toLowerCase())
          ) ?? null
        );
      }),
      findMany: jest.fn(async () => fuelRows.filter((r) => r.isActive))
    },
    estimateEnclosureRate: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const enclosureType = w.enclosureType as { equals?: string; mode?: string } | undefined;
        const active = w.isActive === true;
        return (
          enclosureRows.find(
            (r) =>
              (!active || r.isActive) &&
              (!enclosureType?.equals || r.enclosureType.toLowerCase() === enclosureType.equals.toLowerCase())
          ) ?? null
        );
      }),
      findMany: jest.fn(async () => enclosureRows.filter((r) => r.isActive))
    },
    cuttingOtherRate: {
      findMany: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = args.where ?? {};
        const description = w.description as
          | { contains?: string; mode?: string }
          | undefined;
        const active = w.isActive === true;
        return otherRows.filter((r) => {
          if (active && !r.isActive) return false;
          if (description?.contains) {
            return r.description.toLowerCase().includes(description.contains.toLowerCase());
          }
          return true;
        });
      })
    }
  };
  return prisma as unknown as PrismaService;
}

function matchCuttingWhere(
  row: { equipment: string; elevation: string; material: string; depthMm: number; isActive: boolean },
  where: Record<string, unknown>
): boolean {
  const equipment = where.equipment as { equals?: string; mode?: string } | undefined;
  if (equipment?.equals && row.equipment.toLowerCase() !== equipment.equals.toLowerCase()) {
    return false;
  }
  const material = where.material as { in?: string[]; mode?: string } | undefined;
  if (material?.in) {
    const lowered = material.in.map((m) => m.toLowerCase());
    if (!lowered.includes(row.material.toLowerCase())) return false;
  }
  const elevation = where.elevation as { in?: string[] } | undefined;
  if (elevation?.in && !elevation.in.includes(row.elevation)) return false;
  if (typeof where.depthMm === "number" && row.depthMm !== where.depthMm) return false;
  if (where.isActive === true && !row.isActive) return false;
  return true;
}

const ACTOR_WITH_PERMISSION: ToolHandlerContext = {
  actor: {
    sub: "u-1",
    email: "u@is",
    permissions: ["estimates.view"],
    isSuperUser: false
  } as never,
  conversationId: "conv-1",
  contextKey: "tender-1",
  toolUseId: "tu-1"
};

const ACTOR_WITHOUT_PERMISSION: ToolHandlerContext = {
  actor: {
    sub: "u-2",
    email: "u@is",
    permissions: [],
    isSuperUser: false
  } as never,
  conversationId: "conv-1",
  contextKey: "tender-1",
  toolUseId: "tu-2"
};

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function parseTextPayload(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

describe("LookupRateHandler", () => {
  describe("cutting", () => {
    it("returns matched rate for valid wall cutting input", async () => {
      const prisma = buildPrismaMock({
        cuttingRows: [
          {
            id: "r-1",
            equipment: "Demosaw",
            elevation: "Wall",
            material: "Concrete",
            depthMm: 100,
            ratePerM: dec(45.5),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "cutting",
          cutting: { equipment: "Demosaw", elevation: "wall", material: "Concrete", depthMm: 100 }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const text = (result.result.content[0] as { text: string }).text;
      const payload = parseTextPayload(text);
      expect(payload.rateType).toBe("cutting");
      expect(payload.elevation).toBe("wall");
      expect(payload.ratePerMetreAud).toBe(45.5);
      expect(payload.unit).toBe("AUD per linear metre");
    });

    it("returns matched rate for valid floor cutting input", async () => {
      const prisma = buildPrismaMock({
        cuttingRows: [
          {
            id: "r-2",
            equipment: "Roadsaw",
            elevation: "Floor",
            material: "Asphalt",
            depthMm: 200,
            ratePerM: dec(31.75),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "cutting",
          cutting: { equipment: "Roadsaw", elevation: "floor", material: "Asphalt", depthMm: 200 }
        },
        ACTOR_WITH_PERMISSION
      );
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.ratePerMetreAud).toBe(31.75);
      expect(payload.elevation).toBe("floor");
    });

    it("matches \"Any\"-elevation equipment when caller asks for wall or floor", async () => {
      const prisma = buildPrismaMock({
        cuttingRows: [
          {
            id: "r-3",
            equipment: "Ringsaw",
            elevation: "Any",
            material: "Any",
            depthMm: 250,
            ratePerM: dec(60.0),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "cutting",
          cutting: { equipment: "Ringsaw", elevation: "wall", material: "Concrete", depthMm: 250 }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.ratePerMetreAud).toBe(60.0);
    });

    it("returns helpful error with available combos when no rate row matches", async () => {
      const prisma = buildPrismaMock({
        cuttingRows: [
          {
            id: "r-4",
            equipment: "Roadsaw",
            elevation: "Floor",
            material: "Asphalt",
            depthMm: 100,
            ratePerM: dec(20),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "cutting",
          cutting: { equipment: "Roadsaw", elevation: "floor", material: "Asphalt", depthMm: 999 }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active cutting rate/);
      expect(text).toMatch(/Available combinations/);
      expect(text).toContain("Floor/Asphalt/100mm");
    });

    it("rejects elevation=inverted for cutting (cutting has only wall/floor)", async () => {
      const prisma = buildPrismaMock({});
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "cutting",
          cutting: {
            equipment: "Roadsaw",
            elevation: "inverted" as never,
            material: "Concrete",
            depthMm: 100
          }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("'wall' or 'floor'");
    });
  });

  describe("core_hole", () => {
    it("returns base rate × 1.0 for floor elevation", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [
          { id: "ch-1", diameterMm: 100, ratePerHole: dec(2.55), isActive: true }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "floor", diameterMm: 100 } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.baseRateAud).toBe(2.55);
      expect(payload.elevationMultiplier).toBe(1.0);
      expect(payload.finalRateAud).toBe(2.55);
    });

    it("applies 1.1× multiplier for wall elevation", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [
          { id: "ch-2", diameterMm: 100, ratePerHole: dec(10), isActive: true }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "wall", diameterMm: 100 } },
        ACTOR_WITH_PERMISSION
      );
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.baseRateAud).toBe(10);
      expect(payload.elevationMultiplier).toBe(1.1);
      expect(payload.finalRateAud).toBe(11);
    });

    it("applies 2.0× multiplier for inverted elevation", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [
          { id: "ch-3", diameterMm: 150, ratePerHole: dec(3.2), isActive: true }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "inverted", diameterMm: 150 } },
        ACTOR_WITH_PERMISSION
      );
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.elevationMultiplier).toBe(2.0);
      expect(payload.finalRateAud).toBe(6.4);
    });

    it("returns helpful error with available diameters when none match", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [
          { id: "ch-a", diameterMm: 50, ratePerHole: dec(2), isActive: true },
          { id: "ch-b", diameterMm: 100, ratePerHole: dec(2.5), isActive: true }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "wall", diameterMm: 999 } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active core hole rate/);
      expect(text).toContain("50, 100");
    });
  });

  describe("input validation", () => {
    it("rejects when rateType=cutting but no cutting block provided", async () => {
      const prisma = buildPrismaMock({});
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute({ rateType: "cutting" }, ACTOR_WITH_PERMISSION);
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("cutting block is required");
    });

    it("rejects when rateType=core_hole but no coreHole block provided", async () => {
      const prisma = buildPrismaMock({});
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute({ rateType: "core_hole" }, ACTOR_WITH_PERMISSION);
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("coreHole block is required");
    });

    it("rejects rateType values not in the supported enum", async () => {
      const prisma = buildPrismaMock({});
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "bogus" as never },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("rateType must be one of");
      expect(text).toContain("labour");
      expect(text).toContain("other");
    });
  });

  describe("labour", () => {
    it("returns the requested shift rate plus all three shift rates", async () => {
      const prisma = buildPrismaMock({
        labourRows: [
          {
            id: "l-1",
            role: "Demolition labourer",
            dayRate: dec(72.5),
            nightRate: dec(90.0),
            weekendRate: dec(115.0),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "labour", labour: { role: "demolition labourer", shift: "night" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("labour");
      expect(payload.role).toBe("Demolition labourer");
      expect(payload.shift).toBe("night");
      expect(payload.rateAud).toBe(90.0);
      expect(payload.dayRateAud).toBe(72.5);
      expect(payload.nightRateAud).toBe(90.0);
      expect(payload.weekendRateAud).toBe(115.0);
    });

    it("returns helpful error with available roles when no match", async () => {
      const prisma = buildPrismaMock({
        labourRows: [
          {
            id: "l-2",
            role: "Asbestos labourer",
            dayRate: dec(80),
            nightRate: dec(100),
            weekendRate: dec(120),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "labour", labour: { role: "Unknown role", shift: "day" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active labour rate/);
      expect(text).toContain("Asbestos labourer");
    });
  });

  describe("plant", () => {
    it("returns rate + unit + fuel rate for matched item", async () => {
      const prisma = buildPrismaMock({
        plantRows: [
          {
            id: "p-1",
            item: "13T excavator",
            unit: "day",
            rate: dec(950),
            fuelRate: dec(140),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "plant", plant: { item: "13t excavator" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("plant");
      expect(payload.item).toBe("13T excavator");
      expect(payload.rateAud).toBe(950);
      expect(payload.unit).toBe("AUD per day");
      expect(payload.fuelRateAud).toBe(140);
    });

    it("returns helpful error with available items when no match", async () => {
      const prisma = buildPrismaMock({
        plantRows: [
          {
            id: "p-2",
            item: "Bobcat",
            unit: "day",
            rate: dec(550),
            fuelRate: dec(60),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "plant", plant: { item: "Tower crane" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active plant rate/);
      expect(text).toContain("Bobcat");
    });
  });

  describe("waste", () => {
    it("returns ton rate + load rate + group when (wasteType, facility) matches", async () => {
      const prisma = buildPrismaMock({
        wasteRows: [
          {
            id: "w-1",
            wasteType: "Concrete",
            facility: "BMI Swanbank",
            wasteGroup: "Inert",
            unit: "tonne",
            tonRate: dec(45),
            loadRate: dec(120),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "waste",
          waste: { wasteType: "concrete", facility: "bmi swanbank" }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("waste");
      expect(payload.wasteType).toBe("Concrete");
      expect(payload.facility).toBe("BMI Swanbank");
      expect(payload.wasteGroup).toBe("Inert");
      expect(payload.tonRateAud).toBe(45);
      expect(payload.loadRateAud).toBe(120);
      expect(payload.unit).toBe("tonne");
    });

    it("returns helpful error with available combinations when no match", async () => {
      const prisma = buildPrismaMock({
        wasteRows: [
          {
            id: "w-2",
            wasteType: "General waste",
            facility: "Cleanaway Willawong",
            wasteGroup: null,
            unit: "tonne",
            tonRate: dec(180),
            loadRate: dec(0),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        {
          rateType: "waste",
          waste: { wasteType: "Asbestos friable", facility: "Cleanaway Willawong" }
        },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active waste rate/);
      expect(text).toContain("General waste @ Cleanaway Willawong");
    });
  });

  describe("fuel", () => {
    it("returns rate + unit for matched fuel item", async () => {
      const prisma = buildPrismaMock({
        fuelRows: [
          {
            id: "f-1",
            item: "Diesel",
            unit: "litre",
            rate: dec(2.05),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "fuel", fuel: { item: "diesel" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("fuel");
      expect(payload.item).toBe("Diesel");
      expect(payload.rateAud).toBe(2.05);
      expect(payload.unit).toBe("AUD per litre");
    });

    it("returns helpful error with available items when no match", async () => {
      const prisma = buildPrismaMock({
        fuelRows: [
          { id: "f-2", item: "Unleaded", unit: "litre", rate: dec(2.2), isActive: true, sortOrder: 0 }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "fuel", fuel: { item: "Avgas" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active fuel rate/);
      expect(text).toContain("Unleaded");
    });
  });

  describe("enclosure", () => {
    it("returns rate + unit for matched enclosure type", async () => {
      const prisma = buildPrismaMock({
        enclosureRows: [
          {
            id: "e-1",
            enclosureType: "Class A enclosure",
            unit: "sqm",
            rate: dec(85),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "enclosure", enclosure: { enclosureType: "class a enclosure" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("enclosure");
      expect(payload.enclosureType).toBe("Class A enclosure");
      expect(payload.rateAud).toBe(85);
      expect(payload.unit).toBe("AUD per sqm");
    });

    it("returns helpful error with available types when no match", async () => {
      const prisma = buildPrismaMock({
        enclosureRows: [
          {
            id: "e-2",
            enclosureType: "Class B enclosure",
            unit: "sqm",
            rate: dec(45),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "enclosure", enclosure: { enclosureType: "Negative-pressure decon unit" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active enclosure rate/);
      expect(text).toContain("Class B enclosure");
    });
  });

  describe("other", () => {
    it("returns all matching rows for a substring description match", async () => {
      const prisma = buildPrismaMock({
        otherRows: [
          {
            id: "o-1",
            description: "Establishment fee",
            unit: "job",
            rate: dec(450),
            isActive: true,
            sortOrder: 0
          },
          {
            id: "o-2",
            description: "Mobilisation establishment",
            unit: "job",
            rate: dec(600),
            isActive: true,
            sortOrder: 1
          },
          {
            id: "o-3",
            description: "Saw blade change",
            unit: "ea",
            rate: dec(120),
            isActive: true,
            sortOrder: 2
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "other", other: { description: "establishment" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBeFalsy();
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.rateType).toBe("other");
      const matches = payload.matches as Array<{ description: string; rateAud: number }>;
      expect(matches).toHaveLength(2);
      const descriptions = matches.map((m) => m.description);
      expect(descriptions).toContain("Establishment fee");
      expect(descriptions).toContain("Mobilisation establishment");
      expect(descriptions).not.toContain("Saw blade change");
    });

    it("returns helpful error with available descriptions when no match", async () => {
      const prisma = buildPrismaMock({
        otherRows: [
          {
            id: "o-4",
            description: "Saw blade change",
            unit: "ea",
            rate: dec(120),
            isActive: true,
            sortOrder: 0
          }
        ]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "other", other: { description: "no such thing" } },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toMatch(/No active other rate/);
      expect(text).toContain("Saw blade change");
    });
  });

  describe("permission", () => {
    it("denies callers without estimates.view", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [{ id: "ch", diameterMm: 50, ratePerHole: dec(2), isActive: true }]
      });
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "floor", diameterMm: 50 } },
        ACTOR_WITHOUT_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      expect((result.result.content[0] as { text: string }).text).toContain(
        "do not have permission"
      );
    });

    it("super-users bypass the explicit permission check", async () => {
      const prisma = buildPrismaMock({
        coreHoleRows: [{ id: "ch", diameterMm: 50, ratePerHole: dec(2), isActive: true }]
      });
      const handler = new LookupRateHandler(prisma);
      const ctx: ToolHandlerContext = {
        actor: { sub: "u-3", email: "su@is", permissions: [], isSuperUser: true } as never,
        conversationId: "c",
        contextKey: null,
        toolUseId: "tu"
      };
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "floor", diameterMm: 50 } },
        ctx
      );
      expect(result.result.isError).toBeFalsy();
    });
  });
});
