import { describe, expect, it } from "vitest";
import {
  blankRowCells,
  consumerTypeLabel,
  defaultCellFor,
  groupBindings,
  validateColumnStructure,
  validateRowCells,
  whereUsedBlockerMessage,
  type ListBinding,
  type RateColumn
} from "../ratesListsHelpers";

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
