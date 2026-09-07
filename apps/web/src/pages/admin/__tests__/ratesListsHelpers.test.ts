import { describe, expect, it } from "vitest";
import {
  blankRowCells,
  consumerTypeLabel,
  defaultCellFor,
  groupBindings,
  hasPerRowUnitColumn,
  validateColumnStructure,
  validateRowCells,
  whereUsedBlockerMessage,
  type ListBinding,
  type RateColumn
} from "../ratesListsHelpers";
import { RateValidationService } from "../../../../../api/src/modules/rates/rate-validation.service";
import type { PrismaService } from "../../../../../api/src/prisma/prisma.service";

const col = (over: Partial<RateColumn>): RateColumn => ({
  id: "c1",
  name: "Col",
  dataType: "TEXT",
  role: "KEY",
  unit: null,
  listSlug: null,
  required: false,
  min: null,
  max: null,
  sortOrder: 0,
  ...over
});

const binding = (over: Partial<ListBinding>): ListBinding => ({
  id: "b1",
  listId: "L1",
  consumerType: "RATE_COLUMN",
  consumerRef: "rates.plant.item",
  label: null,
  ...over
});

describe("ratesListsHelpers · consumerTypeLabel", () => {
  it("labels the three consumer types", () => {
    expect(consumerTypeLabel("RATE_COLUMN")).toBe("Rate column");
    expect(consumerTypeLabel("FORM_FIELD")).toBe("Form field");
    expect(consumerTypeLabel("MODULE_DROPDOWN")).toBe("Module dropdown");
  });
});

describe("ratesListsHelpers · groupBindings", () => {
  it("groups by consumer type in a deterministic order and drops empty groups", () => {
    const grouped = groupBindings([
      binding({ id: "b1", consumerType: "MODULE_DROPDOWN", consumerRef: "z" }),
      binding({ id: "b2", consumerType: "RATE_COLUMN", consumerRef: "b" }),
      binding({ id: "b3", consumerType: "RATE_COLUMN", consumerRef: "a" })
    ]);
    expect(grouped.map((g) => g.type)).toEqual(["RATE_COLUMN", "MODULE_DROPDOWN"]);
    expect(grouped[0].items.map((b) => b.consumerRef)).toEqual(["a", "b"]);
  });

  it("returns [] for empty bindings", () => {
    expect(groupBindings([])).toEqual([]);
  });
});

describe("ratesListsHelpers · whereUsedBlockerMessage", () => {
  it("hints safe archive when nothing depends on the list", () => {
    expect(whereUsedBlockerMessage(0)).toMatch(/safe to archive/i);
  });
  it("pluralises the binding count", () => {
    expect(whereUsedBlockerMessage(1)).toMatch(/^1 binding /);
    expect(whereUsedBlockerMessage(4)).toMatch(/^4 bindings /);
  });
});

describe("ratesListsHelpers · defaultCellFor / blankRowCells", () => {
  it("bool defaults to false, others to empty string", () => {
    expect(defaultCellFor("BOOL")).toBe(false);
    expect(defaultCellFor("NUMBER")).toBe("");
    expect(defaultCellFor("CURRENCY")).toBe("");
    expect(defaultCellFor("DATE")).toBe("");
    expect(defaultCellFor("TEXT")).toBe("");
    expect(defaultCellFor("LIST_REF")).toBe("");
  });

  it("produces one blank cell per column, keyed by column id", () => {
    const cells = blankRowCells([
      col({ id: "a", dataType: "BOOL" }),
      col({ id: "b", dataType: "NUMBER" })
    ]);
    expect(cells).toEqual({ a: false, b: "" });
  });
});

describe("ratesListsHelpers · validateRowCells", () => {
  it("flags required-but-empty and non-numeric CURRENCY", () => {
    const cols: RateColumn[] = [
      col({ id: "k", name: "Item", required: true, role: "KEY" }),
      col({ id: "v", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "hr" })
    ];
    const errs = validateRowCells(cols, { k: "", v: "not-a-number" });
    expect(errs).toEqual([
      { columnId: "k", message: "Item is required." },
      { columnId: "v", message: "Rate must be a number." }
    ]);
  });

  it("flags negative VALUE cells", () => {
    const cols: RateColumn[] = [
      col({ id: "v", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "hr" })
    ];
    expect(validateRowCells(cols, { v: "-1" })).toEqual([
      { columnId: "v", message: "Rate must be ≥ 0." }
    ]);
  });

  it("returns [] for a valid row", () => {
    const cols: RateColumn[] = [
      col({ id: "k", name: "Item", role: "KEY", required: true }),
      col({ id: "v", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "hr" })
    ];
    expect(validateRowCells(cols, { k: "Skidsteer", v: 120 })).toEqual([]);
  });
});

describe("ratesListsHelpers · validateColumnStructure", () => {
  it("requires at least one KEY and one VALUE column", () => {
    expect(validateColumnStructure([col({ role: "INFO" })])).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/KEY column/i),
        expect.stringMatching(/VALUE column/i)
      ])
    );
  });

  it("requires a unit on VALUE columns", () => {
    const errs = validateColumnStructure([
      col({ id: "k", role: "KEY" }),
      col({ id: "v", name: "Rate", role: "VALUE", dataType: "CURRENCY", unit: "" })
    ]);
    expect(errs).toEqual(expect.arrayContaining([expect.stringMatching(/needs a unit/i)]));
  });

  it("requires a list slug on LIST_REF columns", () => {
    const errs = validateColumnStructure([
      col({ id: "k", name: "Material", role: "KEY", dataType: "LIST_REF", listSlug: null }),
      col({ id: "v", name: "Rate", role: "VALUE", dataType: "CURRENCY", unit: "m" })
    ]);
    expect(errs).toEqual(expect.arrayContaining([expect.stringMatching(/needs a list slug/i)]));
  });

  it("returns [] for a well-formed set", () => {
    expect(
      validateColumnStructure([
        col({ id: "k", name: "Item", role: "KEY", dataType: "TEXT" }),
        col({ id: "v", name: "Rate", role: "VALUE", dataType: "CURRENCY", unit: "hr" })
      ])
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// UNIT_PER_ROW_V1 — a VALUE column needs no per-column unit when the table
// carries a per-row unit column (an INFO column named "Unit"/"Units").
//
// PERMISSIVE ONLY: nothing that validated before stops validating. `plant`
// has BOTH an INFO Unit column and unit: "day" on its VALUE column (#1699
// set that on production) and must keep passing.
// ─────────────────────────────────────────────────────────────────────────

type StructureColumn = Pick<RateColumn, "name" | "dataType" | "role" | "unit" | "listSlug">;

const sc = (over: Partial<StructureColumn>): StructureColumn => ({
  name: "Col",
  dataType: "TEXT",
  role: "KEY",
  unit: null,
  listSlug: null,
  ...over
});

/** Column sets exactly as the seed migrations write them. */
const REAL_TABLES: Record<string, StructureColumn[]> = {
  labour: [
    sc({ name: "Role" }),
    sc({ name: "Day rate", dataType: "CURRENCY", role: "VALUE", unit: "day" }),
    sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" }),
    sc({ name: "Weekend rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
  ],
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
  "transport-capacity": [
    sc({ name: "Material class" }),
    sc({ name: "Transport type" }),
    sc({ name: "Capacity (tonnes)", dataType: "NUMBER", role: "VALUE", unit: "tonne" }),
    sc({ name: "Capacity (m³)", dataType: "NUMBER", role: "VALUE", unit: "m³" })
  ],
  "material-densities": [
    sc({ name: "Material" }),
    sc({ name: "Density", dataType: "NUMBER", role: "VALUE", unit: "kg/m³" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Kind", role: "INFO" }),
    sc({ name: "Category", role: "INFO" })
  ],
  "other-rates": [
    sc({ name: "Description" }),
    sc({ name: "Unit", role: "INFO" }),
    sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
  ]
};

/**
 * The shared accept/reject contract. Every case runs through the client
 * helper below AND through the server's assertStructure in the parity block
 * at the bottom of this file, so the two can never quietly drift.
 */
const UNIT_PER_ROW_CASES: Array<{ name: string; columns: StructureColumn[]; valid: boolean }> = [
  { name: "other-rates — unit-less VALUE + INFO Unit column", columns: REAL_TABLES["other-rates"], valid: true },
  { name: "plant — INFO Unit column AND unit 'day' (#1699 regression)", columns: REAL_TABLES.plant, valid: true },
  { name: "fuel — INFO Unit column AND unit 'day'", columns: REAL_TABLES.fuel, valid: true },
  { name: "enclosure — INFO Unit column AND unit 'day'", columns: REAL_TABLES.enclosure, valid: true },
  { name: "material-densities — INFO Unit column, VALUE has kg/m³", columns: REAL_TABLES["material-densities"], valid: true },
  { name: "labour — no INFO Unit column, every VALUE has a unit", columns: REAL_TABLES.labour, valid: true },
  {
    name: "unit-less VALUE with no INFO Unit column",
    columns: [sc({ name: "Description" }), sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })],
    valid: false
  },
  {
    name: "two VALUE columns, one unit-less, INFO Unit column present",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit", role: "INFO" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null }),
      sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
    ],
    valid: true
  },
  {
    name: "two VALUE columns, one unit-less, no INFO Unit column",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null }),
      sc({ name: "Night rate", dataType: "CURRENCY", role: "VALUE", unit: "day" })
    ],
    valid: false
  },
  {
    name: "whitespace-only unit + INFO Unit column",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit", role: "INFO" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "   " })
    ],
    valid: true
  },
  {
    name: "INFO column named 'Units'",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "  UNITS ", role: "INFO" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
    ],
    valid: true
  },
  {
    name: "LIST_REF INFO Unit column",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit", dataType: "LIST_REF", role: "INFO", listSlug: "units" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
    ],
    valid: true
  },
  {
    name: "near-miss INFO name 'Unit rate' does not waive",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit rate", role: "INFO" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
    ],
    valid: false
  },
  {
    name: "KEY column named Unit does not waive",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit", role: "KEY" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
    ],
    valid: false
  },
  {
    name: "NUMBER INFO column named Unit does not waive",
    columns: [
      sc({ name: "Description" }),
      sc({ name: "Unit", dataType: "NUMBER", role: "INFO" }),
      sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
    ],
    valid: false
  }
];

describe("ratesListsHelpers · validateColumnStructure · UNIT_PER_ROW_V1", () => {
  it.each(UNIT_PER_ROW_CASES)("$name", ({ columns, valid }) => {
    const errs = validateColumnStructure(columns).filter((e) => /needs a unit/i.test(e));
    expect(errs).toEqual(valid ? [] : expect.arrayContaining([expect.stringMatching(/needs a unit/i)]));
  });

  it("every rate table on main still validates cleanly (strictly widening)", () => {
    for (const [slug, columns] of Object.entries(REAL_TABLES)) {
      expect({ slug, errors: validateColumnStructure(columns) }).toEqual({ slug, errors: [] });
    }
  });

  it("hasPerRowUnitColumn is the single recognizer, and it is name+role+type scoped", () => {
    expect(hasPerRowUnitColumn(REAL_TABLES["other-rates"])).toBe(true);
    expect(hasPerRowUnitColumn(REAL_TABLES.plant)).toBe(true);
    expect(hasPerRowUnitColumn(REAL_TABLES.labour)).toBe(false);
    expect(hasPerRowUnitColumn([sc({ name: "Unit rate", role: "INFO" })])).toBe(false);
    expect(hasPerRowUnitColumn([sc({ name: "Unit", role: "KEY" })])).toBe(false);
    expect(hasPerRowUnitColumn([sc({ name: "Unit", dataType: "BOOL", role: "INFO" })])).toBe(false);
  });

  it("the waiver does not weaken the other structure rules", () => {
    expect(
      validateColumnStructure([
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toEqual(expect.arrayContaining([expect.stringMatching(/KEY column/i)]));
    expect(
      validateColumnStructure([
        sc({ name: "Material", dataType: "LIST_REF", role: "KEY", listSlug: null }),
        sc({ name: "Unit", role: "INFO" }),
        sc({ name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: null })
      ])
    ).toEqual(expect.arrayContaining([expect.stringMatching(/needs a list slug/i)]));
  });
});

// UNIT_PER_ROW_V1 contract test — pins the client mirror to the server rule
// it mirrors. Same pattern as pages/forms/__tests__/formRulesContract.test.ts.
// assertStructure touches no Prisma, so a bare stub is enough.
describe("ratesListsHelpers · UNIT_PER_ROW_V1 · client/server parity", () => {
  const svc = new RateValidationService({} as unknown as PrismaService);

  const serverAccepts = (columns: StructureColumn[]): boolean => {
    try {
      svc.assertStructure(columns);
      return true;
    } catch {
      return false;
    }
  };

  it.each(UNIT_PER_ROW_CASES)("server and client agree — $name", ({ columns, valid }) => {
    const client = validateColumnStructure(columns);
    expect({ server: serverAccepts(columns), client: client.length === 0 }).toEqual({
      server: valid,
      client: valid
    });
  });

  it("server and client agree on every rate table on main", () => {
    for (const [slug, columns] of Object.entries(REAL_TABLES)) {
      expect({ slug, server: serverAccepts(columns), client: validateColumnStructure(columns).length === 0 }).toEqual({
        slug,
        server: true,
        client: true
      });
    }
  });
});
