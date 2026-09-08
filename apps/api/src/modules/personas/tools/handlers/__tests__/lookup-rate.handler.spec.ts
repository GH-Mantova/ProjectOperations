import { LookupRateHandler } from "../lookup-rate.handler";
import type { RateResolverService } from "../../../../rates/rate-resolver.service";
import type { ListedRate } from "../../../../rates/rate-resolver.service";
import type { ToolHandlerContext } from "../../tool-handler.types";

// Minimal ListedRate factory — callers only need to specify fields relevant to
// their test; the rest default to safe values.
function makeRate(overrides: Partial<ListedRate> & { keys: ListedRate["keys"] }): ListedRate {
  return {
    rowId: overrides.rowId ?? "row-default",
    keys: overrides.keys,
    info: overrides.info ?? {},
    value: overrides.value ?? 0,
    unit: overrides.unit ?? "each",
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    sortOrder: overrides.sortOrder !== undefined ? overrides.sortOrder : 0,
    fuelRate: overrides.fuelRate !== undefined ? overrides.fuelRate : null,
    source: overrides.source ?? "legacy"
  };
}

// Build a mock RateResolverService where listRates(slug) returns a fixed list.
function buildResolverMock(ratesBySlug: Record<string, ListedRate[]>): RateResolverService {
  return {
    listRates: jest.fn(async (slug: string) => ratesBySlug[slug] ?? [])
  } as unknown as RateResolverService;
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

function parseTextPayload(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

describe("LookupRateHandler", () => {
  describe("cutting", () => {
    it("returns matched rate for valid wall cutting input", async () => {
      const resolver = buildResolverMock({
        cutting: [
          makeRate({
            rowId: "r-1",
            keys: { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 100 },
            value: 45.5,
            unit: "m",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        cutting: [
          makeRate({
            rowId: "r-2",
            keys: { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 200 },
            value: 31.75,
            unit: "m",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        cutting: [
          makeRate({
            rowId: "r-3",
            keys: { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 250 },
            value: 60.0,
            unit: "m",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        cutting: [
          makeRate({
            rowId: "r-4",
            keys: { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 100 },
            value: 20,
            unit: "m",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({});
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "core-hole": [
          makeRate({
            rowId: "ch-1",
            keys: { diameterMm: 100 },
            value: 2.55,
            unit: "hole",
            isActive: true,
            sortOrder: null
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "core-hole": [
          makeRate({
            rowId: "ch-2",
            keys: { diameterMm: 100 },
            value: 10,
            unit: "hole",
            isActive: true,
            sortOrder: null
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "core-hole": [
          makeRate({
            rowId: "ch-3",
            keys: { diameterMm: 150 },
            value: 3.2,
            unit: "hole",
            isActive: true,
            sortOrder: null
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
      const result = await handler.execute(
        { rateType: "core_hole", coreHole: { elevation: "inverted", diameterMm: 150 } },
        ACTOR_WITH_PERMISSION
      );
      const payload = parseTextPayload((result.result.content[0] as { text: string }).text);
      expect(payload.elevationMultiplier).toBe(2.0);
      expect(payload.finalRateAud).toBe(6.4);
    });

    it("returns helpful error with available diameters when none match", async () => {
      const resolver = buildResolverMock({
        "core-hole": [
          makeRate({ rowId: "ch-a", keys: { diameterMm: 50 }, value: 2, unit: "hole", isActive: true, sortOrder: null }),
          makeRate({ rowId: "ch-b", keys: { diameterMm: 100 }, value: 2.5, unit: "hole", isActive: true, sortOrder: null })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({});
      const handler = new LookupRateHandler(resolver);
      const result = await handler.execute({ rateType: "cutting" }, ACTOR_WITH_PERMISSION);
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("cutting block is required");
    });

    it("rejects when rateType=core_hole but no coreHole block provided", async () => {
      const resolver = buildResolverMock({});
      const handler = new LookupRateHandler(resolver);
      const result = await handler.execute({ rateType: "core_hole" }, ACTOR_WITH_PERMISSION);
      expect(result.result.isError).toBe(true);
      const text = (result.result.content[0] as { text: string }).text;
      expect(text).toContain("coreHole block is required");
    });

    it("rejects rateType values not in the supported enum", async () => {
      const resolver = buildResolverMock({});
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        labour: [
          makeRate({ rowId: "l-1", keys: { role: "Demolition labourer", shift: "day" }, value: 72.5, unit: "day", isActive: true, sortOrder: 0 }),
          makeRate({ rowId: "l-1", keys: { role: "Demolition labourer", shift: "night" }, value: 90.0, unit: "day", isActive: true, sortOrder: 0 }),
          makeRate({ rowId: "l-1", keys: { role: "Demolition labourer", shift: "weekend" }, value: 115.0, unit: "day", isActive: true, sortOrder: 0 })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      // PR F — labour rate is per DAY (IS Qty × Days × Rate formula),
      // not per hour. The previous "AUD per hour" string was wrong.
      expect(payload.unit).toBe("AUD per day");
    });

    it("returns helpful error with available roles when no match", async () => {
      const resolver = buildResolverMock({
        labour: [
          makeRate({ rowId: "l-2", keys: { role: "Asbestos labourer", shift: "day" }, value: 80, unit: "day", isActive: true, sortOrder: 0 }),
          makeRate({ rowId: "l-2", keys: { role: "Asbestos labourer", shift: "night" }, value: 100, unit: "day", isActive: true, sortOrder: 0 }),
          makeRate({ rowId: "l-2", keys: { role: "Asbestos labourer", shift: "weekend" }, value: 120, unit: "day", isActive: true, sortOrder: 0 })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        plant: [
          makeRate({
            rowId: "p-1",
            keys: { item: "13T excavator" },
            info: { Category: "Excavation", Unit: "day" },
            value: 950,
            unit: "day",
            isActive: true,
            sortOrder: 0,
            fuelRate: 140
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        plant: [
          makeRate({
            rowId: "p-2",
            keys: { item: "Bobcat" },
            info: { Category: "", Unit: "day" },
            value: 550,
            unit: "day",
            isActive: true,
            sortOrder: 0,
            fuelRate: 60
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        waste: [
          makeRate({
            rowId: "w-1",
            keys: { wasteType: "Concrete", facility: "BMI Swanbank" },
            info: { wasteGroup: "Inert", loadRate: 120 },
            value: 45,
            unit: "tonne",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        waste: [
          makeRate({
            rowId: "w-2",
            keys: { wasteType: "General waste", facility: "Cleanaway Willawong" },
            info: { wasteGroup: null, loadRate: 0 },
            value: 180,
            unit: "tonne",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        fuel: [
          makeRate({
            rowId: "f-1",
            keys: { item: "Diesel" },
            value: 2.05,
            unit: "litre",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        fuel: [
          makeRate({ rowId: "f-2", keys: { item: "Unleaded" }, value: 2.2, unit: "litre", isActive: true, sortOrder: 0 })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        enclosure: [
          makeRate({
            rowId: "e-1",
            keys: { enclosureType: "Class A enclosure" },
            value: 85,
            unit: "sqm",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        enclosure: [
          makeRate({
            rowId: "e-2",
            keys: { enclosureType: "Class B enclosure" },
            value: 45,
            unit: "sqm",
            isActive: true,
            sortOrder: 0
          })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "other-rates": [
          makeRate({ rowId: "o-1", keys: { description: "Establishment fee" }, value: 450, unit: "job", isActive: true, sortOrder: 0 }),
          makeRate({ rowId: "o-2", keys: { description: "Mobilisation establishment" }, value: 600, unit: "job", isActive: true, sortOrder: 1 }),
          makeRate({ rowId: "o-3", keys: { description: "Saw blade change" }, value: 120, unit: "ea", isActive: true, sortOrder: 2 })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "other-rates": [
          makeRate({ rowId: "o-4", keys: { description: "Saw blade change" }, value: 120, unit: "ea", isActive: true, sortOrder: 0 })
        ]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "core-hole": [makeRate({ rowId: "ch", keys: { diameterMm: 50 }, value: 2, unit: "hole", isActive: true, sortOrder: null })]
      });
      const handler = new LookupRateHandler(resolver);
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
      const resolver = buildResolverMock({
        "core-hole": [makeRate({ rowId: "ch", keys: { diameterMm: 50 }, value: 2, unit: "hole", isActive: true, sortOrder: null })]
      });
      const handler = new LookupRateHandler(resolver);
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
