import { BadRequestException } from "@nestjs/common";
import { RateValidationService } from "../rate-validation.service";

function makePrisma() {
  return {
    rateRow: { findMany: jest.fn().mockResolvedValue([]) },
    globalList: { findUnique: jest.fn() },
    globalListItem: { findFirst: jest.fn() }
  };
}

describe("RateValidationService — structure", () => {
  test("rejects a table with no VALUE column", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null }
      ])
    ).toThrow(BadRequestException);
  });

  test("rejects VALUE column with no unit", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "", listSlug: null }
      ])
    ).toThrow(/unit/);
  });

  test("rejects LIST_REF column with no listSlug", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "material", dataType: "LIST_REF", role: "KEY", unit: null, listSlug: "" },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "m", listSlug: null }
      ])
    ).toThrow(/listSlug/);
  });

  test("accepts a valid table", () => {
    const svc = new RateValidationService(makePrisma() as never);
    expect(() =>
      svc.assertStructure([
        { name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null },
        { name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "hr", listSlug: null }
      ])
    ).not.toThrow();
  });
});

describe("RateValidationService — data", () => {
  const columns = [
    { id: "c-key", name: "region", dataType: "TEXT", role: "KEY", unit: null, listSlug: null, required: true, min: null, max: null } as any,
    { id: "c-val", name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "hr", listSlug: null, required: true, min: null, max: null } as any
  ];

  test("rejects negative VALUE cell", async () => {
    const prisma = makePrisma();
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": -10 })
    ).rejects.toThrow(/≥ 0/);
  });

  test("rejects duplicate KEY tuple across active rows", async () => {
    const prisma = makePrisma();
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-existing", cells: { "c-key": "SEQ", "c-val": 100 } }
    ]);
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": 120 })
    ).rejects.toThrow(/KEY-column values already exists/);
  });

  test("allows update of the same row with unchanged KEY", async () => {
    const prisma = makePrisma();
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-existing", cells: { "c-key": "SEQ", "c-val": 100 } }
    ]);
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", columns, { "c-key": "SEQ", "c-val": 200 }, { rowIdBeingUpdated: "r-existing" })
    ).resolves.toBeUndefined();
  });

  test("rejects LIST_REF cell whose value is not a live item", async () => {
    const prisma = makePrisma();
    prisma.globalList.findUnique.mockResolvedValue({ id: "list-1", slug: "materials" });
    prisma.globalListItem.findFirst.mockResolvedValue(null);
    const listRefColumns = [
      { id: "c-key", name: "material", dataType: "LIST_REF", role: "KEY", unit: null, listSlug: "materials", required: true, min: null, max: null } as any,
      { id: "c-val", name: "rate", dataType: "CURRENCY", role: "VALUE", unit: "m", listSlug: null, required: true, min: null, max: null } as any
    ];
    const svc = new RateValidationService(prisma as never);
    await expect(
      svc.validateRow("t-1", listRefColumns, { "c-key": "unobtainium", "c-val": 5 })
    ).rejects.toThrow(/not a live item/);
  });

  test("rejects missing required cell", async () => {
    const prisma = makePrisma();
    const svc = new RateValidationService(prisma as never);
    await expect(svc.validateRow("t-1", columns, { "c-val": 100 })).rejects.toThrow(/required/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// UNIT_PER_ROW_V1 — a VALUE column needs no per-column unit when the table
// carries a per-row unit column (an INFO column named "Unit"/"Units").
//
// The change is PERMISSIVE ONLY. Everything accepted before is still
// accepted — `plant` in particular has BOTH an INFO Unit column and
// unit: "day" on its VALUE column (set on production by #1699), and that
// shape must keep validating.
// ─────────────────────────────────────────────────────────────────────────

type StructureColumn = Parameters<RateValidationService["assertStructure"]>[0][number];

const sc = (over: Partial<StructureColumn>): StructureColumn => ({
  name: "Col",
  dataType: "TEXT",
  role: "KEY",
  unit: null,
  listSlug: null,
  ...over
});

/** Column sets exactly as the seed migrations write them (slug → columns). */
const REAL_TABLES: Record<string, StructureColumn[]> = {
  // 20260713140000_seed_baseline_rate_tables
  labour: [
    sc({ name: "Role" }),
    sc({ name: "Day rate", dataType: "CURRENCY", role: "VALUE", unit: "day" }),
    sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" }),
    sc({ name: "Weekend rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
  ],
  // INFO Unit column AND a per-column unit — the #1699 shape.
  plant: [
    sc({ name: "Item" }),
    sc({ name: "Category", role: "INFO" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
  ],
  "waste-per-tonne": [
    sc({ name: "Facility" }),
    sc({ name: "Waste type" }),
    sc({ name: "Group", role: "INFO" }),
    sc({ name: "Rate per tonne", dataType: "CURRENCY", role: "VALUE", unit: "tonne" }),
    sc({ name: "Rate per load", dataType: "CURRENCY", role: "VALUE", unit: "load" })
  ],
  "waste-per-m3": [
    sc({ name: "Facility" }),
    sc({ name: "Waste type" }),
    sc({ name: "Group", role: "INFO" }),
    sc({ name: "Rate per m³", dataType: "CURRENCY", role: "VALUE", unit: "m³" })
  ],
  cutting: [
    sc({ name: "Equipment" }),
    sc({ name: "Elevation" }),
    sc({ name: "Material" }),
    sc({ name: "Depth (mm)", dataType: "NUMBER", unit: "mm" }),
    sc({ name: "Rate per m", dataType: "CURRENCY", role: "VALUE", unit: "m" })
  ],
  "core-hole": [
    sc({ name: "Diameter (mm)", dataType: "NUMBER", unit: "mm" }),
    sc({ name: "Rate per hole", dataType: "CURRENCY", role: "VALUE", unit: "hole" })
  ],
  fuel: [
    sc({ name: "Item" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
  ],
  enclosure: [
    sc({ name: "Enclosure type" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
  ],
  "excavator-production": [
    sc({ name: "Excavator size" }),
    sc({ name: "Demolishing concrete slabs", dataType: "NUMBER", role: "VALUE", unit: "m³/day" }),
    sc({
      name: "Demolishing structures (masonry/concrete)",
      dataType: "NUMBER",
      role: "VALUE",
      unit: "100 m²/day"
    }),
    sc({
      name: "Demolishing structures (stud walls)",
      dataType: "NUMBER",
      role: "VALUE",
      unit: "100 m²/day"
    }),
    sc({ name: "Excavating", dataType: "NUMBER", role: "VALUE", unit: "m³/hr" })
  ],
  // 20260715120000_r3_t0_asset_fuel_capacity_ops_settings
  "transport-capacity": [
    sc({ name: "Material class" }),
    sc({ name: "Transport type" }),
    sc({ name: "Capacity (tonnes)", dataType: "NUMBER", role: "VALUE", unit: "tonne" }),
    sc({ name: "Capacity (m³)", dataType: "NUMBER", role: "VALUE", unit: "m³" })
  ],
  // 20260720120000 / 20260813120000 — INFO Unit column, VALUE column has a unit.
  "material-densities": [
    sc({ name: "Material" }),
    sc({ name: "Density", dataType: "NUMBER", role: "VALUE", unit: "kg/m³" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Kind", role: "INFO" }),
    sc({ name: "Category", role: "INFO" })
  ],
  // 20260813120000_slice-11a — the table this slice unblocks: unit is per row.
  "other-rates": [
    sc({ name: "Description" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
  ]
};

describe("RateValidationService — structure — UNIT_PER_ROW_V1", () => {
  const svc = () => new RateValidationService(makePrisma() as never);

  test("accepts a unit-less VALUE column when the table has an INFO Unit column", () => {
    expect(() => svc().assertStructure(REAL_TABLES["other-rates"])).not.toThrow();
  });

  test("still rejects a unit-less VALUE column when the table has no INFO Unit column", () => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toThrow(/VALUE column "Rate" requires a unit/);
  });

  test("REGRESSION #1699 — plant's real shape (INFO Unit column AND unit 'day') still validates", () => {
    expect(() => svc().assertStructure(REAL_TABLES.plant)).not.toThrow();
    // and the same is true of the other two columns #1699 stamped.
    expect(() => svc().assertStructure(REAL_TABLES.fuel)).not.toThrow();
    expect(() => svc().assertStructure(REAL_TABLES.enclosure)).not.toThrow();
  });

  test("every rate table on main still validates (strictly widening)", () => {
    for (const [slug, columns] of Object.entries(REAL_TABLES)) {
      try {
        svc().assertStructure(columns);
      } catch (err) {
        throw new Error(`rate table "${slug}" no longer validates: ${(err as Error).message}`);
      }
    }
  });

  test("two VALUE columns, only one with a unit — accepted with an INFO Unit column", () => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null }),
        sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
      ])
    ).not.toThrow();
  });

  test("two VALUE columns, only one with a unit — still rejected without an INFO Unit column", () => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null }),
        sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
      ])
    ).toThrow(/VALUE column "Rate" requires a unit/);
  });

  test("a whitespace-only unit is waived the same way a null one is", () => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "   " })
      ])
    ).not.toThrow();
  });

  test("the INFO column name is matched case- and whitespace-insensitively, incl. 'Units'", () => {
    for (const name of ["Unit", "unit", "  UNIT  ", "Units"]) {
      expect(() =>
        svc().assertStructure([
          sc({ name: "Description" }),
          sc({ name, role: "INFO" }),
          sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
        ])
      ).not.toThrow();
    }
  });

  test("a LIST_REF INFO Unit column also supplies the per-row unit", () => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        sc({ name: "Unit", dataType: "LIST_REF", role: "INFO", listSlug: "units" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).not.toThrow();
  });

  test.each([
    ["a near-miss name", sc({ name: "Unit rate", role: "INFO" })],
    ["a KEY column named Unit", sc({ name: "Unit", role: "KEY" })],
    ["a VALUE column named Unit", sc({ name: "Unit", dataType: "CURRENCY", role: "VALUE", unit: "ea" })],
    ["a NUMBER INFO column named Unit", sc({ name: "Unit", dataType: "NUMBER", role: "INFO" })],
    ["a BOOL INFO column named Unit", sc({ name: "Unit", dataType: "BOOL", role: "INFO" })]
  ])("%s does not waive the unit requirement", (_label, extra) => {
    expect(() =>
      svc().assertStructure([
        sc({ name: "Description" }),
        extra,
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toThrow(/VALUE column "Rate" requires a unit/);
  });

  test("the waiver does not weaken any other structure rule", () => {
    // KEY still required...
    expect(() =>
      svc().assertStructure([
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toThrow(/KEY column/);
    // ...and LIST_REF still needs a listSlug.
    expect(() =>
      svc().assertStructure([
        sc({ name: "Material", dataType: "LIST_REF", role: "KEY", listSlug: "" }),
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toThrow(/listSlug/);
  });
});
