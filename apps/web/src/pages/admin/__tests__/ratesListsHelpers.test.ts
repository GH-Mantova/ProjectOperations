import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  blankRowCells,
  columnFieldKind,
  consumerTypeLabel,
  defaultCellFor,
  deleteFieldConfirmMessage,
  deleteFieldWarning,
  compareScenarioValues,
  groupBindings,
  hasPerRowUnitColumn,
  isNumberKindColumn,
  matchScenarioRow,
  rateFieldRows,
  resolveScenarioKeys,
  scenarioCellText,
  scenarioKeyColumns,
  scenarioKeyOptions,
  stepsUsingField,
  usedInLabel,
  validateColumnStructure,
  validateRowCells,
  whereUsedBlockerMessage,
  RATE_COLUMN_KIND,
  type ListBinding,
  type RateColumn,
  type RateFieldRow
} from "../ratesListsHelpers";
import { FieldsCard } from "../RatesListsAdminPage";
import { FIELD_SOURCE_LABELS } from "../ChargeStepsEditor";
import type { RateLineField } from "@project-ops/config/charge-step-semantics";
import type { ChargeStep } from "../../../lib/chargeStepTypes";
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

// ══════════════════════════════════════════════════════════════════════════
// RATE_FIELDS_TABLE_V2 — the Fields card
//
// apps/web has no jsdom and no testing-library, so the house pattern is pure
// exported helpers plus `renderToStaticMarkup`. The pure half is below; the
// rendered half at the end asserts the actual markup a person sees, because a
// grep of the source would prove nothing about a header row's ORDER.
//
// The mock-up this is built to is
// https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df — its
// "Core holes" table, its exact `From` wording, and its `step 1, 5` shape for
// `Used in` are all asserted verbatim below.
// ══════════════════════════════════════════════════════════════════════════

const CORE_COLUMNS: RateColumn[] = [
  col({ id: "cc1", name: "Diameter", dataType: "NUMBER", role: "KEY", unit: "mm" }),
  col({ id: "cc2", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "$ / hole per 10 mm" })
];

const CORE_LINE_FIELDS: RateLineField[] = [
  { name: "Depth", kind: "number", unit: "mm", sample: 18 },
  { name: "Elevation", kind: "text", options: ["Floor", "Wall", "Inverted"], sample: "Inverted" },
  { name: "Holes", kind: "number", sample: 12 }
];

/**
 * The mock-up's "Core holes" rule, step for step:
 *   start Depth · divide 10 · round to the nearest whole · never less than 1 ·
 *   multiply Rate · multiply 2 only when Elevation is Inverted · multiply Holes
 */
const CORE_STEPS: ChargeStep[] = [
  { op: "start", field: "Depth" },
  { op: "divide", field: 10 },
  { op: "round", direction: "nearest", interval: 1 },
  { op: "floor", value: 1 },
  { op: "multiply", field: "Rate" },
  { op: "multiply", field: 2, when: { field: "Elevation", cmp: "is", value: "Inverted" } },
  { op: "multiply", field: "Holes" }
];

describe("RATE_FIELDS_TABLE_V2 · the Kind rule", () => {
  it("covers every member of RateColumnDataType, with the words the card prints", () => {
    expect(RATE_COLUMN_KIND).toStrictEqual({
      NUMBER: "number",
      CURRENCY: "number",
      TEXT: "text",
      LIST_REF: "text",
      DATE: "date",
      BOOL: "yes / no"
    });
  });

  it("prints a word, never the storage enum", () => {
    const printed = (["TEXT", "NUMBER", "CURRENCY", "DATE", "BOOL", "LIST_REF"] as const).map(
      (t) => columnFieldKind(t)
    );
    expect(printed).toStrictEqual(["text", "number", "number", "date", "yes / no", "text"]);
    for (const word of printed) expect(word).not.toMatch(/^[A-Z_]+$/);
  });

  it("a dataType outside the enum falls back to text — kept out of the sum, not fed to it", () => {
    expect(columnFieldKind("GEOMETRY")).toBe("text");
    expect(isNumberKindColumn("GEOMETRY")).toBe(false);
  });

  it("number-kind is NUMBER and CURRENCY and nothing else", () => {
    const eligible = (["TEXT", "NUMBER", "CURRENCY", "DATE", "BOOL", "LIST_REF"] as const).filter(
      (t) => isNumberKindColumn(t)
    );
    expect(eligible).toStrictEqual(["NUMBER", "CURRENCY"]);
  });
});

describe("RATE_FIELDS_TABLE_V2 · stepsUsingField", () => {
  it("counts a field named as an arithmetic operand", () => {
    expect(stepsUsingField(CORE_STEPS, "Rate")).toStrictEqual([5]);
  });

  it("counts a field named only by a condition — the server rejects that dangling too", () => {
    expect(stepsUsingField(CORE_STEPS, "Elevation")).toStrictEqual([6]);
  });

  it("a field named nowhere comes back empty", () => {
    expect(stepsUsingField(CORE_STEPS, "Diameter")).toStrictEqual([]);
  });

  it("a step naming the field twice is listed once — it is one step", () => {
    const steps: ChargeStep[] = [
      { op: "start", field: "Rate" },
      { op: "multiply", field: "Rate", when: { field: "Rate", cmp: ">", value: 5 } }
    ];
    expect(stepsUsingField(steps, "Rate")).toStrictEqual([1, 2]);
  });

  it("a literal operand is not a field name", () => {
    expect(stepsUsingField([{ op: "start", field: 10 }], "10")).toStrictEqual([]);
  });

  it("no steps at all is not an error", () => {
    expect(stepsUsingField(null, "Rate")).toStrictEqual([]);
    expect(stepsUsingField(undefined, "Rate")).toStrictEqual([]);
    expect(stepsUsingField([], "Rate")).toStrictEqual([]);
  });
});

describe("RATE_FIELDS_TABLE_V2 · usedInLabel", () => {
  it("reads the way the mock-up reads it", () => {
    expect(usedInLabel([])).toBe("—");
    expect(usedInLabel([1])).toBe("step 1");
    expect(usedInLabel([1, 5])).toBe("step 1, 5");
  });
});

describe("RATE_FIELDS_TABLE_V2 · rateFieldRows", () => {
  it("lists the rate table's columns first, then the line fields, and says which is which", () => {
    expect(rateFieldRows(CORE_COLUMNS, CORE_LINE_FIELDS, CORE_STEPS)).toStrictEqual([
      {
        id: "cc1",
        name: "Diameter",
        source: "table",
        kind: "number",
        unit: "mm",
        listSlug: null,
        usedIn: []
      },
      {
        id: "cc2",
        name: "Rate",
        source: "table",
        kind: "number",
        unit: "$ / hole per 10 mm",
        listSlug: null,
        usedIn: [5]
      },
      {
        id: null,
        name: "Depth",
        source: "line",
        kind: "number",
        unit: "mm",
        listSlug: null,
        usedIn: [1]
      },
      {
        id: null,
        name: "Elevation",
        source: "line",
        kind: "text",
        unit: null,
        listSlug: null,
        usedIn: [6]
      },
      {
        id: null,
        name: "Holes",
        source: "line",
        kind: "number",
        unit: null,
        listSlug: null,
        usedIn: [7]
      }
    ]);
  });

  it("a line field carries no id — there is no route that deletes one", () => {
    const rows = rateFieldRows(CORE_COLUMNS, CORE_LINE_FIELDS, CORE_STEPS);
    for (const r of rows) {
      expect(Object.prototype.hasOwnProperty.call(r, "id")).toBe(true);
      expect(r.id === null).toBe(r.source === "line");
    }
  });

  it("keeps the LIST_REF column's list, which nothing else on the screen states", () => {
    const rows = rateFieldRows(
      [col({ id: "e1", name: "Equipment", dataType: "LIST_REF", listSlug: "cut-equipment" })],
      [],
      []
    );
    expect(rows).toStrictEqual([
      {
        id: "e1",
        name: "Equipment",
        source: "table",
        kind: "text",
        unit: null,
        listSlug: "cut-equipment",
        usedIn: []
      }
    ]);
  });

  it("`Used in` is recomputed from the step list it is given — no save, no reload", () => {
    const before = rateFieldRows(CORE_COLUMNS, CORE_LINE_FIELDS, CORE_STEPS);
    const edited: ChargeStep[] = CORE_STEPS.map((s, i) =>
      i === 4 ? ({ op: "multiply", field: "Diameter" } as ChargeStep) : s
    );
    const after = rateFieldRows(CORE_COLUMNS, CORE_LINE_FIELDS, edited);
    expect(before.map((r) => usedInLabel(r.usedIn))).toStrictEqual([
      "—",
      "step 5",
      "step 1",
      "step 6",
      "step 7"
    ]);
    expect(after.map((r) => usedInLabel(r.usedIn))).toStrictEqual([
      "step 5",
      "—",
      "step 1",
      "step 6",
      "step 7"
    ]);
  });

  it("a table that declares no line fields lists exactly its columns", () => {
    expect(rateFieldRows(CORE_COLUMNS, null, CORE_STEPS).map((r) => r.name)).toStrictEqual([
      "Diameter",
      "Rate"
    ]);
    expect(rateFieldRows(CORE_COLUMNS, undefined, CORE_STEPS)).toStrictEqual(
      rateFieldRows(CORE_COLUMNS, [], CORE_STEPS)
    );
  });
});

describe("RATE_FIELDS_TABLE_V2 · the delete warning", () => {
  it("says nothing about a field no step names", () => {
    expect(deleteFieldWarning("Diameter", [])).toBeNull();
    expect(deleteFieldConfirmMessage("Diameter", [])).toBe(
      'Delete "Diameter"? Any values stored for it will be dropped.'
    );
  });

  it("names the field and the step", () => {
    expect(deleteFieldWarning("Rate", [5])).toBe(
      '"Rate" is used in step 5. Delete it and that step names a field that is not there — ' +
        "the charge steps will not save until it is changed."
    );
  });

  it("reads as a plural when more than one step names it", () => {
    expect(deleteFieldWarning("Rate", [2, 5])).toBe(
      '"Rate" is used in step 2, 5. Delete it and those steps name a field that is not there — ' +
        "the charge steps will not save until they are changed."
    );
  });

  it("the confirm message carries the warning, and still says what a delete drops", () => {
    const message = deleteFieldConfirmMessage("Rate", [5]);
    expect(message).toContain("Any values stored for it will be dropped.");
    expect(message).toContain("step 5");
    expect(message.endsWith(deleteFieldWarning("Rate", [5]) as string)).toBe(true);
  });

  it("warns, and does not claim to refuse — the server decides what is allowed", () => {
    const message = deleteFieldConfirmMessage("Rate", [5]);
    expect(message).not.toMatch(/cannot|not allowed|blocked|refus/i);
  });
});

// ── The rendered card ─────────────────────────────────────────────────────

const noopAdd = async () => {};
const noopDelete = async () => {};

function cardMarkup(fields: RateFieldRow[]): string {
  return renderToStaticMarkup(
    createElement(FieldsCard, { fields, onAdd: noopAdd, onDelete: noopDelete })
  );
}

/** React escapes the quotes in the warning; read them back. */
const unescape = (markup: string) => markup.replace(/&quot;/g, '"');

/** The `<th>` texts of the fields table, in the order they render. */
function headerRow(markup: string): string[] {
  const thead = markup.slice(markup.indexOf("<thead>"), markup.indexOf("</thead>"));
  // `\b` after `th`, or `<thead>` itself matches the opening tag.
  return Array.from(thead.matchAll(/<th\b[^>]*>(.*?)<\/th>/g)).map((m) => m[1]);
}

/**
 * Keep the characters that sit OUTSIDE a tag, by scanning -- not by regex-replacing
 * the tags away.
 *
 * CodeQL raised the single-pass `replace(/<[^>]+>/g, "")` this replaced as a
 * high-severity `js/incomplete-multi-character-sanitization`. Being straight
 * about it: I could not construct an input where one pass of THAT regex leaves a
 * tag behind -- a stray `<` is always absorbed by the next match -- so I am not
 * claiming a demonstrated exploit. What is true is that a regex `replace` is the
 * shape of a sanitiser, this helper is not one, and the finding is about the
 * shape. A scanner cannot assemble a tag out of its own leftovers by construction,
 * which is a stronger statement than "I could not find a counterexample".
 *
 * The exposure here is nil either way -- it reads markup this file just rendered
 * from its own fixtures. It is fixed rather than suppressed because suppressing a
 * true-positive-shaped finding in a test is how a real one gets suppressed later.
 */
function stripTags(html: string): string {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
}

/** The `<td>` texts of one body row, tags stripped. */
function bodyRows(markup: string): string[][] {
  const tbody = markup.slice(markup.indexOf("<tbody>"), markup.indexOf("</tbody>"));
  return Array.from(tbody.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)).map((row) =>
    Array.from(row[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)).map((c) =>
      stripTags(c[1]).trim()
    )
  );
}

describe("RATE_FIELDS_TABLE_V2 · the rendered card", () => {
  const CORE_ROWS = rateFieldRows(CORE_COLUMNS, CORE_LINE_FIELDS, CORE_STEPS);

  it("heads the table Field | From | Kind | Unit | Used in, plus the action column", () => {
    expect(headerRow(cardMarkup(CORE_ROWS))).toStrictEqual([
      "Field",
      "From",
      "Kind",
      "Unit",
      "Used in",
      ""
    ]);
  });

  it("no longer heads a Role, a Type or a Req? column", () => {
    const heads = headerRow(cardMarkup(CORE_ROWS));
    expect(heads).not.toContain("Role");
    expect(heads).not.toContain("Type");
    expect(heads).not.toContain("Unit / list");
    expect(heads).not.toContain("Req?");
    expect(heads).not.toContain("Name");
  });

  it("prints no KEY / VALUE / INFO role badge in the table", () => {
    const markup = cardMarkup(CORE_ROWS);
    const table = markup.slice(markup.indexOf("<table"), markup.indexOf("</table>"));
    expect(table).not.toMatch(/\bKEY\b|\bVALUE\b|\bINFO\b/);
  });

  it("prints no storage enum in the table", () => {
    const markup = cardMarkup(
      rateFieldRows(
        (["TEXT", "NUMBER", "CURRENCY", "DATE", "BOOL", "LIST_REF"] as const).map((t, i) =>
          col({ id: `k${i}`, name: `Col${i}`, dataType: t })
        ),
        [],
        []
      )
    );
    const table = markup.slice(markup.indexOf("<table"), markup.indexOf("</table>"));
    for (const t of ["TEXT", "NUMBER", "CURRENCY", "DATE", "BOOL", "LIST_REF"]) {
      expect(table).not.toContain(t);
    }
  });

  it("`From` reads the mock-up's exact words, and the same words the operand picker uses", () => {
    const cells = bodyRows(cardMarkup(CORE_ROWS)).map((r) => r[1]);
    expect(cells).toStrictEqual([
      "the rate table",
      "the rate table",
      "the estimate line",
      "the estimate line",
      "the estimate line"
    ]);
    expect(new Set(cells)).toStrictEqual(
      new Set([FIELD_SOURCE_LABELS.table, FIELD_SOURCE_LABELS.line])
    );
  });

  it("`Kind` prints a word for all six storage types and for both line-field kinds", () => {
    const markup = cardMarkup(
      rateFieldRows(
        [
          col({ id: "k1", name: "Notes", dataType: "TEXT" }),
          col({ id: "k2", name: "Depth", dataType: "NUMBER" }),
          col({ id: "k3", name: "Rate", dataType: "CURRENCY" }),
          col({ id: "k4", name: "Effective", dataType: "DATE" }),
          col({ id: "k5", name: "Night", dataType: "BOOL" }),
          col({ id: "k6", name: "Equipment", dataType: "LIST_REF", listSlug: "cut-equipment" })
        ],
        [
          { name: "Metres", kind: "number", unit: "m" },
          { name: "Elevation", kind: "text", options: ["Floor"] }
        ],
        []
      )
    );
    expect(bodyRows(markup).map((r) => [r[0].replace(/cut-equipment$/, ""), r[2]])).toStrictEqual([
      ["Notes", "text"],
      ["Depth", "number"],
      ["Rate", "number"],
      ["Effective", "date"],
      ["Night", "yes / no"],
      ["Equipment", "text"],
      ["Metres", "number"],
      ["Elevation", "text"]
    ]);
  });

  it("`Used in` names the steps for the mock-up's Core holes rule", () => {
    const cells = bodyRows(cardMarkup(CORE_ROWS)).map((r) => [r[0], r[4]]);
    expect(cells).toStrictEqual([
      ["Diameter", "—"],
      ["Rate", "step 5"],
      ["Depth", "step 1"],
      ["Elevation", "step 6"],
      ["Holes", "step 7"]
    ]);
  });

  it("`Unit` prints the unit, and an em dash when there is none", () => {
    const cells = bodyRows(cardMarkup(CORE_ROWS)).map((r) => r[3]);
    expect(cells).toStrictEqual(["mm", "$ / hole per 10 mm", "mm", "—", "—"]);
  });

  it("a used field's delete control carries the warning that names the steps", () => {
    const markup = unescape(cardMarkup(CORE_ROWS));
    expect(markup).toContain(deleteFieldWarning("Rate", [5]) as string);
    // and it is on the control the person is about to press
    expect(markup).toContain(`aria-label="Delete Rate. ${deleteFieldWarning("Rate", [5])}"`);
  });

  it("a field no step names carries no warning", () => {
    const markup = unescape(cardMarkup(rateFieldRows(CORE_COLUMNS, [], [])));
    expect(markup).not.toContain("is used in step");
    expect(markup).toContain('aria-label="Delete Diameter"');
  });

  it("offers a delete for a rate-table column and none for a line field", () => {
    const markup = cardMarkup(CORE_ROWS);
    const rows = bodyRows(markup);
    expect(rows.map((r) => r[5] === "Delete")).toStrictEqual([true, true, false, false, false]);
  });

  it("uses no hex colour literal anywhere in what it renders", () => {
    expect(cardMarkup(CORE_ROWS)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("an empty table says so instead of rendering a header over nothing", () => {
    const markup = cardMarkup([]);
    expect(markup).not.toContain("<thead>");
    expect(markup).toContain("No fields yet");
  });
});

// ── RATE_SCENARIO_PICKER_V2 ───────────────────────────────────────────────
//
// The scenario picker's whole rule, pinned against the mock-up's
// `Saw cuts - by depth band` sheet. Four KEY columns, seven rows, and a
// cascade that must offer only combinations the sheet actually carries.
//
// The premise these replace: the picker was ONE select whose options were
// "Row 1" … "Row 7", so choosing a rule meant counting rows in a table further
// down the page.

const SAW_COLUMNS: RateColumn[] = [
  col({ id: "k-equipment", name: "Equipment", dataType: "TEXT", role: "KEY" }),
  col({ id: "k-elevation", name: "Elevation", dataType: "TEXT", role: "KEY" }),
  col({ id: "k-material", name: "Material", dataType: "TEXT", role: "KEY" }),
  col({ id: "k-depth", name: "Depth", dataType: "NUMBER", role: "KEY", unit: "mm" }),
  col({ id: "v-rate", name: "Rate", dataType: "CURRENCY", role: "VALUE", unit: "$ / m" }),
  col({ id: "i-note", name: "Note", dataType: "TEXT", role: "INFO" })
];

/** The mock-up's seven rows. Depth is stored as a NUMBER, deliberately. */
const sawRow = (
  id: string,
  equipment: string,
  elevation: string,
  material: string,
  depth: number,
  rate: number
) => ({
  id,
  cells: {
    "k-equipment": equipment,
    "k-elevation": elevation,
    "k-material": material,
    "k-depth": depth,
    "v-rate": rate,
    "i-note": ""
  },
  isActive: true,
  sortOrder: 0
});

const SAW_ROWS = [
  sawRow("r1", "Roadsaw", "Floor", "Concrete", 150, 15.5),
  sawRow("r2", "Roadsaw", "Floor", "Concrete", 200, 18.95),
  sawRow("r3", "Roadsaw", "Floor", "Asphalt", 150, 12.4),
  sawRow("r4", "Demosaw", "Floor", "Any", 150, 22),
  sawRow("r5", "Demosaw", "Wall", "Concrete", 150, 26.5),
  sawRow("r6", "Ringsaw", "Floor", "Any", 200, 31),
  sawRow("r7", "Ringsaw", "Wall", "Any", 200, 34)
];

const KEY_IDS = ["k-equipment", "k-elevation", "k-material", "k-depth"] as const;

/** The four options lists, in cascade order, for a fully-chosen scenario. */
const cascade = (chosen: Record<string, string>) =>
  KEY_IDS.map((id) => scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, id));

describe("RATE_SCENARIO_PICKER_V2 · a key column is a key column", () => {
  it("the KEY columns are the picker's selects, in table order", () => {
    expect(scenarioKeyColumns(SAW_COLUMNS).map((c) => c.name)).toStrictEqual([
      "Equipment",
      "Elevation",
      "Material",
      "Depth"
    ]);
  });

  it("VALUE and INFO columns are not part of the scenario", () => {
    expect(scenarioKeyColumns(SAW_COLUMNS).map((c) => c.name)).not.toContain("Rate");
    expect(scenarioKeyColumns(SAW_COLUMNS).map((c) => c.name)).not.toContain("Note");
  });

  it("the control count is one per key column plus one per line field", () => {
    // The mock-up's sheet: four keys, one line field ("Metres") — five controls.
    expect(scenarioKeyColumns(SAW_COLUMNS).length + 1).toBe(5);
  });
});

describe("RATE_SCENARIO_PICKER_V2 · a cell is compared as a string", () => {
  it("a NUMBER cell and the string a <select> hands back are the same value", () => {
    expect(scenarioCellText(200)).toBe("200");
    expect(scenarioCellText("200")).toBe("200");
  });

  it("an empty cell is the empty string, not 'null' or 'undefined'", () => {
    expect(scenarioCellText(null)).toBe("");
    expect(scenarioCellText(undefined)).toBe("");
  });
});

describe("RATE_SCENARIO_PICKER_V2 · how options sort", () => {
  it("numbers sort as numbers, so a depth band list is not 150, 200, 50", () => {
    expect(["200", "50", "150"].slice().sort(compareScenarioValues)).toStrictEqual([
      "50",
      "150",
      "200"
    ]);
  });

  it("text sorts by locale", () => {
    expect(["Roadsaw", "Demosaw", "Ringsaw"].slice().sort(compareScenarioValues)).toStrictEqual([
      "Demosaw",
      "Ringsaw",
      "Roadsaw"
    ]);
  });

  it("a mixed column stays on the locale comparator rather than sorting NaN", () => {
    expect(["150", "Any", "200"].slice().sort(compareScenarioValues)).toStrictEqual([
      "150",
      "200",
      "Any"
    ]);
  });
});

describe("RATE_SCENARIO_PICKER_V2 · the cascade", () => {
  it("Equipment offers every equipment on the sheet", () => {
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, {}, "k-equipment")).toStrictEqual([
      "Demosaw",
      "Ringsaw",
      "Roadsaw"
    ]);
  });

  it("the mock-up's walk: Roadsaw → Floor → Asphalt, Concrete → 150, 200", () => {
    const chosen: Record<string, string> = { "k-equipment": "Roadsaw" };
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, "k-elevation")).toStrictEqual([
      "Floor"
    ]);
    chosen["k-elevation"] = "Floor";
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, "k-material")).toStrictEqual([
      "Asphalt",
      "Concrete"
    ]);
    chosen["k-material"] = "Concrete";
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, "k-depth")).toStrictEqual([
      "150",
      "200"
    ]);
  });

  it("only EARLIER keys narrow a menu — a later choice never edits an earlier one", () => {
    // Depth 200 exists only for Concrete under Roadsaw/Floor, and Material's
    // menu must still offer Asphalt: the two selects do not fight each other.
    const chosen = {
      "k-equipment": "Roadsaw",
      "k-elevation": "Floor",
      "k-material": "Concrete",
      "k-depth": "200"
    };
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, "k-material")).toStrictEqual([
      "Asphalt",
      "Concrete"
    ]);
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, chosen, "k-equipment")).toStrictEqual([
      "Demosaw",
      "Ringsaw",
      "Roadsaw"
    ]);
  });

  it("every offered option leads somewhere: the full cascade never offers a dead end", () => {
    for (const equipment of scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, {}, "k-equipment")) {
      const a = { "k-equipment": equipment };
      for (const elevation of scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, a, "k-elevation")) {
        const b = { ...a, "k-elevation": elevation };
        for (const material of scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, b, "k-material")) {
          const c = { ...b, "k-material": material };
          const depths = scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, c, "k-depth");
          expect(depths.length).toBeGreaterThan(0);
          for (const depth of depths) {
            expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, { ...c, "k-depth": depth })).not.toBeNull();
          }
        }
      }
    }
  });

  it("a column that is not a key has no options", () => {
    expect(scenarioKeyOptions(SAW_COLUMNS, SAW_ROWS, {}, "v-rate")).toStrictEqual([]);
  });
});

describe("RATE_SCENARIO_PICKER_V2 · the matched row", () => {
  it("the mock-up's worked example: Roadsaw / Floor / Concrete / 200 is one row", () => {
    const row = matchScenarioRow(SAW_COLUMNS, SAW_ROWS, {
      "k-equipment": "Roadsaw",
      "k-elevation": "Floor",
      "k-material": "Concrete",
      "k-depth": "200"
    });
    expect(row?.id).toBe("r2");
    expect(row?.cells["v-rate"]).toBe(18.95);
  });

  it("matches a NUMBER cell against the string the select hands back", () => {
    // The Depth cells are stored as numbers; the chosen value is "200".
    expect(SAW_ROWS[1].cells["k-depth"]).toBe(200);
    expect(
      matchScenarioRow(SAW_COLUMNS, SAW_ROWS, {
        "k-equipment": "Roadsaw",
        "k-elevation": "Floor",
        "k-material": "Concrete",
        "k-depth": "200"
      })?.id
    ).toBe("r2");
  });

  it("a combination the sheet does not carry matches nothing — no nearest guess", () => {
    expect(
      matchScenarioRow(SAW_COLUMNS, SAW_ROWS, {
        "k-equipment": "Roadsaw",
        "k-elevation": "Floor",
        "k-material": "Asphalt",
        "k-depth": "200"
      })
    ).toBeNull();
  });

  it("every key must match, not most of them", () => {
    expect(
      matchScenarioRow(SAW_COLUMNS, SAW_ROWS, {
        "k-equipment": "Roadsaw",
        "k-elevation": "Wall",
        "k-material": "Concrete",
        "k-depth": "150"
      })
    ).toBeNull();
  });
});

describe("RATE_SCENARIO_PICKER_V2 · the stale-value fallback", () => {
  it("nothing chosen resolves to the first option at every level, and matches", () => {
    const keys = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, {});
    expect(keys).toStrictEqual({
      "k-equipment": "Demosaw",
      "k-elevation": "Floor",
      "k-material": "Any",
      "k-depth": "150"
    });
    expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, keys)?.id).toBe("r4");
  });

  it("a valid combination is left exactly as chosen", () => {
    const chosen = {
      "k-equipment": "Roadsaw",
      "k-elevation": "Floor",
      "k-material": "Concrete",
      "k-depth": "200"
    };
    expect(resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, chosen)).toStrictEqual(chosen);
  });

  it("Roadsaw/Floor/Asphalt/150, then Equipment → Demosaw: Material falls to Any, Depth keeps 150", () => {
    const stale = {
      "k-equipment": "Demosaw",
      "k-elevation": "Floor",
      "k-material": "Asphalt",
      "k-depth": "150"
    };
    const resolved = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, stale);
    expect(resolved).toStrictEqual({
      "k-equipment": "Demosaw",
      "k-elevation": "Floor",
      "k-material": "Any",
      "k-depth": "150"
    });
    // And the fallback lands on a real row rather than on nothing.
    expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, resolved)?.id).toBe("r4");
  });

  it("a fallback cascades: a stranded key re-strands the ones after it", () => {
    // Ringsaw carries no 150 depth at all, so Depth cannot keep its value.
    const resolved = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, {
      "k-equipment": "Ringsaw",
      "k-elevation": "Floor",
      "k-material": "Concrete",
      "k-depth": "150"
    });
    expect(resolved).toStrictEqual({
      "k-equipment": "Ringsaw",
      "k-elevation": "Floor",
      "k-material": "Any",
      "k-depth": "200"
    });
    expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, resolved)?.id).toBe("r6");
  });

  it("resolving is idempotent — a resolved set of keys resolves to itself", () => {
    const once = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, {
      "k-equipment": "Roadsaw",
      "k-elevation": "Wall",
      "k-material": "Asphalt",
      "k-depth": "999"
    });
    expect(resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, once)).toStrictEqual(once);
    expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, once)).not.toBeNull();
  });

  it("a resolved scenario ALWAYS matches a row, for every starting point", () => {
    const nonsense = [
      {},
      { "k-equipment": "Chainsaw" },
      { "k-depth": "12" },
      { "k-equipment": "Demosaw", "k-material": "Asphalt" },
      { "k-equipment": "Ringsaw", "k-elevation": "Wall", "k-material": "Concrete" }
    ];
    for (const start of nonsense) {
      const keys = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, start);
      expect(matchScenarioRow(SAW_COLUMNS, SAW_ROWS, keys)).not.toBeNull();
    }
  });

  it("an empty sheet resolves every key to blank and matches nothing", () => {
    expect(resolveScenarioKeys(SAW_COLUMNS, [], {})).toStrictEqual({
      "k-equipment": "",
      "k-elevation": "",
      "k-material": "",
      "k-depth": ""
    });
    expect(matchScenarioRow(SAW_COLUMNS, [], resolveScenarioKeys(SAW_COLUMNS, [], {}))).toBeNull();
  });

  it("a table with no KEY column falls back to the first row, as the picker always did", () => {
    const noKeys = SAW_COLUMNS.filter((c) => c.role !== "KEY");
    expect(resolveScenarioKeys(noKeys, SAW_ROWS, {})).toStrictEqual({});
    expect(matchScenarioRow(noKeys, SAW_ROWS, {})?.id).toBe("r1");
  });

  it("the cascade is stable while the keys are: the same chosen keys give the same menus", () => {
    const keys = resolveScenarioKeys(SAW_COLUMNS, SAW_ROWS, { "k-equipment": "Roadsaw" });
    expect(cascade(keys)).toStrictEqual(cascade(keys));
    expect(cascade(keys)[1]).toStrictEqual(["Floor"]);
  });
});
