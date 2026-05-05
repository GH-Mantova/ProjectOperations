import { Prisma } from "@prisma/client";
import { LookupRateHandler } from "../lookup-rate.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";
import type { PrismaService } from "../../../../../prisma/prisma.service";

// Lightweight mock — only the two tables LookupRateHandler touches.
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
}) {
  const cuttingRows = opts.cuttingRows ?? [];
  const coreHoleRows = opts.coreHoleRows ?? [];

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

    it("rejects unsupported rateType with reference to deferred types", async () => {
      const prisma = buildPrismaMock({});
      const handler = new LookupRateHandler(prisma);
      const result = await handler.execute(
        { rateType: "labour" as never },
        ACTOR_WITH_PERMISSION
      );
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("not yet supported");
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
