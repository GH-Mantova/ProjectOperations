// SCOPE_PLANT_PICKER_V2 — unit tests for the plant Type picker
// (pr-cardfix-s3).
//
// The web workspace follows the no-render pattern (no @testing-library, no
// jsdom), so these target the pure helpers exported from
// ScopeQuantitiesTable. That fits what this slice actually risks: the picker
// builds its list by BUCKETING rates by a free-text category, and the failure
// mode of any bucketing step is a silent drop — a rate whose category nobody
// anticipated quietly disappearing from a list the estimator cannot then
// search. EstimatePlantRate.category is `String?` in
// apps/api/prisma/schema.prisma (nullable, free text, no enum), so
// "unanticipated" is the normal case, not the edge case.
//
// Two invariants are therefore pinned hardest:
//   1. TOTAL PRESERVED — the number of options after grouping equals the
//      number of rates in, plus exactly one for the manual-entry escape hatch.
//   2. IDENTITY PRESERVED — every rate id appears exactly once, somewhere
//      reachable, whatever its category says (null, "", "   ", or a category
//      that is none of the mock-up's five).
//
// The manual-entry option is pinned as well, because it was the whole second
// defect: `__custom__` was handled by the Type onChange handler and emitted by
// nobody, which made the free-text name, its revert control and the unlocked
// rate cell unreachable dead code.

import { describe, it, expect } from "vitest";
import {
  groupPlantTypeOptions,
  countPlantPickerOptions,
  plantCategoryLabel,
  plantPatchForCustomDescription,
  plantPatchForRevertToList,
  buildPlantItems,
  blankPlantRow,
  PLANT_CATEGORY_ORDER,
  PLANT_CATEGORY_FALLBACK,
  PLANT_CUSTOM_VALUE,
  PLANT_CUSTOM_GROUP_LABEL,
  PLANT_CUSTOM_OPTION_LABEL,
  type PlantPickerRate,
  type RowPlantState
} from "../ScopeQuantitiesTable";

function rate(id: string, item: string, category: string | null): PlantPickerRate {
  return { id, item, category };
}

/** Every option in the list, groups flattened, order preserved. */
function flatten(groups: ReturnType<typeof groupPlantTypeOptions>) {
  return groups.flatMap((g) => g.options.map((o) => ({ group: g.label, ...o })));
}

/** The catalogue as it comes back from GET /estimate-rates/plant: unordered. */
const CATALOGUE: PlantPickerRate[] = [
  rate("p1", "5t Excavator", "Excavator"),
  rate("p2", "20t Excavator", "Excavator"),
  rate("p3", "Franna 20t", "Crane"),
  rate("p4", "S70 Bobcat", "Bobcat"),
  rate("p5", "Decontamination unit", "Asbestos"), // not one of the five
  rate("p6", "HEPA vacuum", null), // no category at all
  rate("p7", "Generator", "Other")
];

describe("plantCategoryLabel", () => {
  it("files a null, undefined, empty or whitespace category under Other", () => {
    expect(plantCategoryLabel(null)).toBe(PLANT_CATEGORY_FALLBACK);
    expect(plantCategoryLabel(undefined)).toBe(PLANT_CATEGORY_FALLBACK);
    expect(plantCategoryLabel("")).toBe(PLANT_CATEGORY_FALLBACK);
    expect(plantCategoryLabel("   ")).toBe(PLANT_CATEGORY_FALLBACK);
  });

  it("keeps an unrecognised category verbatim rather than folding it into Other", () => {
    // The alternative — mapping the unknown to "Other" — would be a silent
    // relabelling of a category the rate card deliberately carries.
    expect(plantCategoryLabel("Asbestos")).toBe("Asbestos");
    expect(plantCategoryLabel("Attachment")).toBe("Attachment");
  });

  it("normalises case and padding onto the canonical spelling of the five", () => {
    expect(plantCategoryLabel("excavator")).toBe("Excavator");
    expect(plantCategoryLabel("  Bobcat  ")).toBe("Bobcat");
    expect(plantCategoryLabel("OTHER")).toBe("Other");
  });
});

describe("groupPlantTypeOptions — nothing is dropped", () => {
  it("emits exactly one option per rate, plus one for the manual entry", () => {
    // THE COUNT INVARIANT. Before grouping: 7 rates -> 7 flat options.
    // After grouping: the same 7, in groups, + the manual entry = 8.
    const before = CATALOGUE.length;
    const groups = groupPlantTypeOptions(CATALOGUE);
    const after = countPlantPickerOptions(groups);
    expect(before).toBe(7);
    expect(after).toBe(before + 1);
  });

  it("carries every rate id through exactly once, whatever its category", () => {
    const values = flatten(groupPlantTypeOptions(CATALOGUE)).map((o) => o.value);
    for (const r of CATALOGUE) {
      expect(values.filter((v) => v === r.id)).toHaveLength(1);
    }
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps a rate whose category is unrecognised, in a group of its own", () => {
    const decon = flatten(groupPlantTypeOptions(CATALOGUE)).find((o) => o.value === "p5");
    expect(decon).toBeDefined();
    expect(decon?.group).toBe("Asbestos");
    expect(decon?.label).toBe("Decontamination unit");
  });

  it("keeps a rate whose category is null, empty or whitespace, under Other", () => {
    const rates = [
      rate("n1", "HEPA vacuum", null),
      rate("n2", "EWP", ""),
      rate("n3", "Site fencing", "   ")
    ];
    const groups = groupPlantTypeOptions(rates);
    const flat = flatten(groups);
    expect(countPlantPickerOptions(groups)).toBe(rates.length + 1);
    expect(flat.filter((o) => o.group === PLANT_CATEGORY_FALLBACK).map((o) => o.value)).toEqual([
      "n1",
      "n2",
      "n3"
    ]);
  });

  it("survives a catalogue in which NO category is one of the five", () => {
    const rates = [rate("x1", "Attachment A", "Attachment"), rate("x2", "Scaffold", "Access")];
    const groups = groupPlantTypeOptions(rates);
    expect(groups.map((g) => g.label)).toEqual([
      "Attachment",
      "Access",
      PLANT_CUSTOM_GROUP_LABEL
    ]);
    expect(countPlantPickerOptions(groups)).toBe(rates.length + 1);
  });
});

describe("groupPlantTypeOptions — order", () => {
  it("puts the mock-up's categories first, in the mock-up's order", () => {
    // The catalogue above arrives Excavator, Crane, Bobcat, ... — grouping must
    // not inherit that order the way the flat list did.
    const labels = groupPlantTypeOptions(CATALOGUE).map((g) => g.label);
    expect(labels.slice(0, 4)).toEqual(["Excavator", "Bobcat", "Crane", "Other"]);
  });

  it("omits a listed category that has no rates rather than showing an empty heading", () => {
    // "Truck" is one of the five but isTransportPlant filters trucks out of
    // this picker upstream, so the group must simply not appear.
    const labels = groupPlantTypeOptions(CATALOGUE).map((g) => g.label);
    expect(labels).not.toContain("Truck");
  });

  it("appends unlisted categories after the five, in first-appearance order", () => {
    const rates = [
      rate("a", "Zeta", "Zeta cat"),
      rate("b", "5t Excavator", "Excavator"),
      rate("c", "Alpha", "Alpha cat")
    ];
    const labels = groupPlantTypeOptions(rates).map((g) => g.label);
    expect(labels).toEqual(["Excavator", "Zeta cat", "Alpha cat", PLANT_CUSTOM_GROUP_LABEL]);
  });

  it("keeps rates in catalogue order within a group", () => {
    const excavators = groupPlantTypeOptions(CATALOGUE).find((g) => g.label === "Excavator");
    expect(excavators?.options.map((o) => o.value)).toEqual(["p1", "p2"]);
  });

  it("orders PLANT_CATEGORY_ORDER exactly as the approved mock-up does", () => {
    expect([...PLANT_CATEGORY_ORDER]).toEqual([
      "Excavator",
      "Bobcat",
      "Crane",
      "Truck",
      "Other"
    ]);
  });
});

describe("groupPlantTypeOptions — labels", () => {
  it("no longer prefixes the category onto the option label", () => {
    // BEFORE this slice the same rate rendered as "Excavator: 5t Excavator".
    const opt = flatten(groupPlantTypeOptions(CATALOGUE)).find((o) => o.value === "p1");
    expect(opt?.label).toBe("5t Excavator");
    expect(opt?.group).toBe("Excavator");
  });

  it("repeats no category inside any option label", () => {
    for (const o of flatten(groupPlantTypeOptions(CATALOGUE))) {
      if (o.value === PLANT_CUSTOM_VALUE) continue;
      expect(o.label.startsWith(`${o.group}: `)).toBe(false);
    }
  });
});

describe("groupPlantTypeOptions — the manual-entry escape hatch", () => {
  it("ends the list with the manual-entry option in its own trailing group", () => {
    const groups = groupPlantTypeOptions(CATALOGUE);
    const last = groups[groups.length - 1];
    expect(last.label).toBe("Not in the list");
    expect(last.options).toEqual([
      { value: "__custom__", label: PLANT_CUSTOM_OPTION_LABEL }
    ]);
    // ...and it really is the final option in the flattened list.
    const flat = flatten(groups);
    expect(flat[flat.length - 1].value).toBe(PLANT_CUSTOM_VALUE);
  });

  it("offers the manual entry even when the catalogue is empty", () => {
    // An estimator with no plant rates loaded still has to be able to type a
    // decontamination unit; before this slice there was no route at all.
    const groups = groupPlantTypeOptions([]);
    expect(groups).toHaveLength(1);
    expect(countPlantPickerOptions(groups)).toBe(1);
    expect(groups[0].label).toBe(PLANT_CUSTOM_GROUP_LABEL);
  });

  it("never collides with a real plant rate id", () => {
    const values = flatten(groupPlantTypeOptions(CATALOGUE)).map((o) => o.value);
    expect(values.filter((v) => v === PLANT_CUSTOM_VALUE)).toHaveLength(1);
    expect(CATALOGUE.some((r) => r.id === PLANT_CUSTOM_VALUE)).toBe(false);
  });
});

// The picker now reaches a write path that used to be dead. These pin that
// reaching it changes NOTHING about the plant persistence payload:
// SCOPE_PLANT_PERSIST_V1's helpers are called as they stand, and the
// `__custom__` sentinel is intercepted by the Type onChange handler, so it
// never becomes a plantRateId and never reaches the wire.
describe("the manual-entry sentinel never reaches the payload", () => {
  const row = (patch: Partial<RowPlantState> = {}): RowPlantState => ({
    ...blankPlantRow(),
    ...patch
  });

  it("picking it produces a custom row, not a catalogue row keyed by the sentinel", () => {
    const patch = plantPatchForCustomDescription("");
    expect(patch.plantRateId).toBeNull();
    expect(patch.customDescription).toBe("");
    const entries = buildPlantItems([row(patch)]);
    expect(entries[0].plantRateId).toBeNull();
    expect(JSON.stringify(entries)).not.toContain(PLANT_CUSTOM_VALUE);
  });

  it("a named custom machine with its own rate ships the same keys as any other row", () => {
    const entries = buildPlantItems([
      row({
        ...plantPatchForCustomDescription("Decontamination unit"),
        qty: "1",
        days: "5",
        dayRateOverride: 420
      })
    ]);
    expect(entries).toEqual([
      {
        columnIndex: 1,
        plantRateId: null,
        description: "Decontamination unit",
        qty: 1,
        days: 5,
        unit: "day",
        dayRateOverride: 420
      }
    ]);
  });

  it("reverting returns the row to the catalogue select with no identity left behind", () => {
    const patch = plantPatchForRevertToList();
    expect(patch).toEqual({
      plantRateId: null,
      customDescription: null,
      description: null,
      unit: null,
      dayRateOverride: null
    });
    // customDescription back to null is what makes isCustom false again, i.e.
    // what puts the grouped <select> back in the Type cell.
    expect(patch.customDescription).toBeNull();
  });
});
