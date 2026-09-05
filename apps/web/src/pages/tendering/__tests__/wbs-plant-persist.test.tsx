// SCOPE_PLANT_PERSIST_V1 — unit tests for the Plant persistence layer
// (pr-cardpersist-s2).
//
// The web workspace follows the no-render pattern (no @testing-library, no
// jsdom), so these target the pure helpers exported from
// ScopeQuantitiesTable. That is not a compromise here — the entire risk of
// this slice is the SHAPE OF THE PAYLOAD, and the payload is a pure function
// of row state. Every field the server reads is asserted by name.
//
// The authority for that shape is apps/api/src/modules/tendering/
// scope-item-pricing.ts, which is already merged and unchanged by this slice:
//
//   ScopePlantEntryInput = { columnIndex?, plantRateId?, description?, qty?,
//                            days?, dayRateOverride? }
//   computeScopeItemTotal() — plant leg:
//     hasOverride = cell.dayRateOverride != null && isFinite(...)
//     rate        = hasOverride ? Number(cell.dayRateOverride)
//                              : cell.plantRateId ? plantRateById.get(...)
//                                                 : undefined
//     if (rate == null) continue
//     qty  = cell.qty == null ? 1 : n(cell.qty)      <- why blank sends 0
//     days = n(cell.days)
//
// plus one reader that is NOT the pricing function and is the reason
// `description` is written on every entry, catalogue picks included:
//
//   scope-of-works.service.ts getCardSummary(): `if (!p.description) continue;`
//
// Both are pinned below.

import { describe, it, expect } from "vitest";
import {
  hasStoredPlantRows,
  sortedPlantEntries,
  plantRowCountFromItem,
  blankPlantRow,
  isBlankPlantRow,
  rowPlantFromEntry,
  defaultPlantRow,
  plantPatchForTypeChange,
  plantPatchForCustomDescription,
  plantPatchForRevertToList,
  buildPlantItems,
  plantPatchBody,
  plantNumOrZero,
  writePlantRows,
  removePlantRowAt,
  type RowPlantState,
  type ScopePlantEntry,
  type ItemPlantRows
} from "../ScopeQuantitiesTable";

// A row as the component holds it. Helper so each test states only what it
// is actually about.
function row(patch: Partial<RowPlantState> = {}): RowPlantState {
  return { ...blankPlantRow(), ...patch };
}

// The subset of ScopeItem the hydration helpers read.
function item(patch: { plantItems?: ScopePlantEntry[] | null } = {}) {
  return { plantItems: null, ...patch };
}

/**
 * An entry exactly as the RETIRED legacy PlantCluster wrote it: 1-based
 * columnIndex, description copied from the catalogue rate, unit, and no
 * dayRateOverride key at all (the field did not exist on that path).
 */
function legacyEntry(columnIndex: number, patch: Partial<ScopePlantEntry> = {}): ScopePlantEntry {
  return {
    columnIndex,
    plantRateId: `plant-${columnIndex}`,
    description: `Excavator ${columnIndex}`,
    qty: 1,
    days: 2,
    unit: "day",
    ...patch
  };
}

// ── The wire contract ────────────────────────────────────────────────────────
// The one test that would catch a rename on either side of the boundary.

describe("plantItems entry shape (server contract)", () => {
  it("emits exactly the seven keys the server reads, and no others", () => {
    const [entry] = buildPlantItems([row({ plantRateId: "pr-1", description: "Bobcat" })]);
    expect(Object.keys(entry).sort()).toStrictEqual([
      "columnIndex",
      "dayRateOverride",
      "days",
      "description",
      "plantRateId",
      "qty",
      "unit"
    ]);
  });

  it("carries the catalogue NAME in `description`, not only the rate id", () => {
    // getCardSummary(): `if (!p.description) continue;`. A payload that
    // shipped only plantRateId would price correctly and still be invisible
    // to the card's plant days — which is exactly the bug step 2 names.
    const [entry] = buildPlantItems([
      row(plantPatchForTypeChange("pr-7", { item: "Excavator 16T-25T", unit: "day" }))
    ]);
    expect(entry.description).toBe("Excavator 16T-25T");
    expect(entry.plantRateId).toBe("pr-7");
  });

  it("a free-typed custom machine ships its own name as the description", () => {
    const [entry] = buildPlantItems([row(plantPatchForCustomDescription("Hired 30t excavator"))]);
    expect(entry.description).toBe("Hired 30t excavator");
    expect(entry.plantRateId).toBeNull();
  });

  it("an empty row ships description '' — falsy, so getCardSummary skips it", () => {
    const [entry] = buildPlantItems([row()]);
    expect(entry.description).toBe("");
    expect(Boolean(entry.description)).toBe(false);
  });

  it("re-derives columnIndex densely from array position, 1-based", () => {
    const rows = [row({ description: "A" }), row({ description: "B" }), row({ description: "C" })];
    expect(buildPlantItems(rows).map((e) => e.columnIndex)).toStrictEqual([1, 2, 3]);
  });

  it("carries the day-rate override verbatim, 0 included", () => {
    expect(buildPlantItems([row({ dayRateOverride: 1200 })])[0].dayRateOverride).toBe(1200);
    // A stored 0 is a real override ("supplied free"); the server honours it.
    expect(buildPlantItems([row({ dayRateOverride: 0 })])[0].dayRateOverride).toBe(0);
    expect(buildPlantItems([row()])[0].dayRateOverride).toBeNull();
  });

  it("carries the rate unit so an adopted legacy entry does not lose it", () => {
    expect(buildPlantItems([row({ unit: "hr" })])[0].unit).toBe("hr");
  });
});

// ── Number coercion ──────────────────────────────────────────────────────────

describe("plantNumOrZero (qty/days inside plantItems)", () => {
  it("blank is 0, NOT null", () => {
    // scope-item-pricing.ts: `qty = cell.qty == null ? 1 : n(cell.qty)`.
    // A null here would make the server cost one machine the estimator never
    // typed, and would contradict the row total the cell renders ("—").
    expect(plantNumOrZero("")).toBe(0);
  });
  it("whitespace is 0", () => {
    expect(plantNumOrZero("   ")).toBe(0);
  });
  it("parses a number", () => {
    expect(plantNumOrZero("2.5")).toBe(2.5);
  });
  it("keeps an explicit 0", () => {
    expect(plantNumOrZero("0")).toBe(0);
  });
  it("unparseable input is 0, never NaN on the wire", () => {
    expect(plantNumOrZero("abc")).toBe(0);
    expect(Number.isNaN(plantNumOrZero("abc"))).toBe(false);
  });
});

// ── Precedence and row count ─────────────────────────────────────────────────

describe("hasStoredPlantRows", () => {
  it("null is false (an item nobody has put plant on)", () => {
    expect(hasStoredPlantRows(null)).toBe(false);
  });
  it("undefined is false", () => {
    expect(hasStoredPlantRows(undefined)).toBe(false);
  });
  it("empty array is false", () => {
    expect(hasStoredPlantRows([])).toBe(false);
  });
  it("a non-empty array is true", () => {
    expect(hasStoredPlantRows([legacyEntry(1)])).toBe(true);
  });
});

describe("plantRowCountFromItem", () => {
  it("an item with no stored entries has exactly one row", () => {
    expect(plantRowCountFromItem(item())).toBe(1);
  });
  it("an empty stored array still means one row", () => {
    expect(plantRowCountFromItem(item({ plantItems: [] }))).toBe(1);
  });
  it("the count IS the array length — two legacy entries, two rows", () => {
    expect(plantRowCountFromItem(item({ plantItems: [legacyEntry(1), legacyEntry(2)] }))).toBe(2);
  });
});

// ── Adopting the existing data (step 4) ──────────────────────────────────────

describe("sortedPlantEntries", () => {
  it("orders by columnIndex, not by array position", () => {
    const stored = [legacyEntry(3), legacyEntry(1), legacyEntry(2)];
    expect(sortedPlantEntries(stored).map((e) => e.columnIndex)).toStrictEqual([1, 2, 3]);
  });

  it("does not mutate the array it is given", () => {
    const stored = [legacyEntry(3), legacyEntry(1)];
    sortedPlantEntries(stored);
    expect(stored.map((e) => e.columnIndex)).toStrictEqual([3, 1]);
  });

  it("an entry with no columnIndex is kept, not dropped", () => {
    const stored = [legacyEntry(1), { description: "no index" } as ScopePlantEntry];
    expect(sortedPlantEntries(stored)).toHaveLength(2);
  });

  it("null / [] are empty lists", () => {
    expect(sortedPlantEntries(null)).toStrictEqual([]);
    expect(sortedPlantEntries([])).toStrictEqual([]);
  });
});

describe("rowPlantFromEntry", () => {
  it("a catalogue entry hydrates as a catalogue row (not a custom one)", () => {
    const state = rowPlantFromEntry(legacyEntry(1, { qty: 2, days: 3 }));
    expect(state).toStrictEqual({
      plantRateId: "plant-1",
      customDescription: null, // the Type cell stays a dropdown
      description: "Excavator 1",
      unit: "day",
      dayRateOverride: null,
      qty: "2",
      days: "3"
    });
  });

  it("an entry with a description and NO rate id hydrates as a custom machine", () => {
    const state = rowPlantFromEntry({
      columnIndex: 1,
      plantRateId: null,
      description: "Hired 30t excavator",
      qty: 1,
      days: 4,
      unit: "day",
      dayRateOverride: 1200
    });
    expect(state.customDescription).toBe("Hired 30t excavator");
    expect(state.plantRateId).toBeNull();
    expect(state.dayRateOverride).toBe(1200);
  });

  it("an empty legacy entry — what '+ Plant' wrote before a pick — is a blank row", () => {
    expect(rowPlantFromEntry({ columnIndex: 1 })).toStrictEqual(blankPlantRow());
  });

  it("null qty/days render as blank inputs, not '0' or 'null'", () => {
    const state = rowPlantFromEntry({ columnIndex: 1, plantRateId: "p", description: "d" });
    expect(state.qty).toBe("");
    expect(state.days).toBe("");
  });

  it("a stored dayRateOverride of 0 survives — 0 is an override, not an absence", () => {
    expect(rowPlantFromEntry(legacyEntry(1, { dayRateOverride: 0 })).dayRateOverride).toBe(0);
  });

  it("a description of '' is absence, not a custom machine named ''", () => {
    const state = rowPlantFromEntry({ columnIndex: 1, description: "" });
    expect(state.customDescription).toBeNull();
    expect(state.description).toBeNull();
  });
});

describe("defaultPlantRow", () => {
  it("an item with nothing stored gives a blank row at every index", () => {
    expect(defaultPlantRow(item(), 0)).toStrictEqual(blankPlantRow());
    expect(defaultPlantRow(item(), 3)).toStrictEqual(blankPlantRow());
  });

  it("stored entries land on rows in columnIndex order", () => {
    const it0 = item({ plantItems: [legacyEntry(2), legacyEntry(1)] });
    expect(defaultPlantRow(it0, 0).description).toBe("Excavator 1");
    expect(defaultPlantRow(it0, 1).description).toBe("Excavator 2");
  });

  it("an index past the end of a stored array is a blank row, not a crash", () => {
    expect(defaultPlantRow(item({ plantItems: [legacyEntry(1)] }), 4)).toStrictEqual(blankPlantRow());
  });
});

// ── Type-change cascades ─────────────────────────────────────────────────────

describe("plantPatchForTypeChange", () => {
  it("a catalogue pick copies the catalogue name and unit onto the row", () => {
    const patch = plantPatchForTypeChange("pr-1", { item: "Bobcat", unit: "day" });
    expect(patch.plantRateId).toBe("pr-1");
    expect(patch.description).toBe("Bobcat");
    expect(patch.unit).toBe("day");
  });

  it("a catalogue pick clears any custom description and releases the override", () => {
    const patch = plantPatchForTypeChange("pr-1", { item: "Bobcat", unit: "day" });
    expect(patch.customDescription).toBeNull();
    expect(patch.dayRateOverride).toBeNull();
  });

  it("a pick whose rate has not loaded yet stores no name rather than a wrong one", () => {
    const patch = plantPatchForTypeChange("pr-1", undefined);
    expect(patch.plantRateId).toBe("pr-1");
    expect(patch.description).toBeNull();
    expect(patch.unit).toBe("day");
  });

  it("clearing the Type empties the row's identity outright", () => {
    const patch = plantPatchForTypeChange(null, undefined);
    expect(patch.plantRateId).toBeNull();
    expect(patch.description).toBeNull();
    expect(patch.customDescription).toBeNull();
    expect(patch.dayRateOverride).toBeNull();
  });

  it("a cleared row writes an entry the server prices at $0 and the card ignores", () => {
    const [entry] = buildPlantItems([row({ ...legacyRowState(), ...plantPatchForTypeChange(null, undefined) })]);
    expect(entry.plantRateId).toBeNull();
    expect(entry.dayRateOverride).toBeNull();
    // rate resolves to undefined -> `if (rate == null) continue` -> $0.
    expect(entry.description).toBe("");
  });

  function legacyRowState(): RowPlantState {
    return rowPlantFromEntry(legacyEntry(1));
  }
});

describe("plantPatchForCustomDescription / plantPatchForRevertToList", () => {
  it("dropping out of the list makes the typed text both the identity and the name", () => {
    const patch = plantPatchForCustomDescription("Liebherr LTM 1200");
    expect(patch.plantRateId).toBeNull();
    expect(patch.customDescription).toBe("Liebherr LTM 1200");
    expect(patch.description).toBe("Liebherr LTM 1200");
  });

  it("dropping out does NOT release a rate the estimator already typed", () => {
    // A custom machine's rate is the only rate it has — there is no locked
    // catalogue rate behind it to fall back to, so releasing it would price
    // the row at $0.
    expect("dayRateOverride" in plantPatchForCustomDescription("x")).toBe(false);
  });

  it("reverting to the list clears identity, name and override together", () => {
    const patch = plantPatchForRevertToList();
    expect(patch.plantRateId).toBeNull();
    expect(patch.customDescription).toBeNull();
    expect(patch.description).toBeNull();
    expect(patch.dayRateOverride).toBeNull();
  });
});

// ── The payload ──────────────────────────────────────────────────────────────

describe("plantPatchBody", () => {
  it("sends plantItems and NOTHING else", () => {
    // In particular it carries no men/days/shift/labourItems, so a plant edit
    // can never overwrite the manpower store that pr-cardpersist-s1 owns.
    const body = plantPatchBody([row({ qty: "2", days: "3" })]);
    expect(Object.keys(body)).toStrictEqual(["plantItems"]);
  });

  it("ships EVERY row, not just the edited one (a short array replaces the stored one)", () => {
    const rows = [
      row({ description: "A", qty: "1" }),
      row({ description: "B", qty: "2" }),
      row({ description: "C", qty: "3" })
    ];
    const sent = plantPatchBody(rows).plantItems as ScopePlantEntry[];
    expect(sent).toHaveLength(3);
    expect(sent.map((e) => e.description)).toStrictEqual(["A", "B", "C"]);
    expect(sent.map((e) => e.qty)).toStrictEqual([1, 2, 3]);
  });

  it("a blank qty box ships 0, not null — null would cost a machine nobody typed", () => {
    const sent = plantPatchBody([row({ plantRateId: "pr-1", days: "3" })])
      .plantItems as ScopePlantEntry[];
    expect(sent[0].qty).toBe(0);
    expect(sent[0].qty).not.toBeNull();
  });

  it("carries the day-rate override of EVERY row, including rows past the first", () => {
    const sent = plantPatchBody([row(), row({ dayRateOverride: 640 })])
      .plantItems as ScopePlantEntry[];
    expect(sent[1].dayRateOverride).toBe(640);
  });

  it("NEVER sends plantItems: [] — the key is omitted when there are no rows", () => {
    // [] and NULL price identically today, but they are different statements
    // about the item, and writing [] over a NULL would turn "never touched"
    // into "touched, and empty" for every later reader.
    const body = plantPatchBody([]);
    expect("plantItems" in body).toBe(false);
    expect(body.plantItems).toBeUndefined();
  });
});

describe("isBlankPlantRow", () => {
  it("a fresh row is blank", () => {
    expect(isBlankPlantRow(blankPlantRow())).toBe(true);
  });
  it("a picked machine is not blank", () => {
    expect(isBlankPlantRow(row({ plantRateId: "pr-1", description: "Bobcat" }))).toBe(false);
  });
  it("a free-typed name is not blank", () => {
    expect(isBlankPlantRow(row({ customDescription: "Hired crane", description: "Hired crane" }))).toBe(false);
  });
  it("a typed qty alone is not blank", () => {
    expect(isBlankPlantRow(row({ qty: "2" }))).toBe(false);
  });
  it("a typed rate alone is not blank — including an explicit 0", () => {
    expect(isBlankPlantRow(row({ dayRateOverride: 900 }))).toBe(false);
    expect(isBlankPlantRow(row({ dayRateOverride: 0 }))).toBe(false);
  });
  it("a cleared row is blank again — a cleared Type releases the name and rate", () => {
    const cleared = { ...row({ plantRateId: "pr-1", description: "Bobcat", dayRateOverride: 900 }), ...plantPatchForTypeChange(null, undefined) };
    expect(isBlankPlantRow(cleared)).toBe(true);
  });
});

// ── Existing-data safety ─────────────────────────────────────────────────────
// An item saved before this slice either has plantItems = NULL (no plant ever
// added) or holds entries written by the retired cluster. Both are pinned.

describe("an item whose plantItems is still NULL", () => {
  const untouched = item();

  it("renders exactly one blank plant row — unchanged from today", () => {
    expect(plantRowCountFromItem(untouched)).toBe(1);
    expect(defaultPlantRow(untouched, 0)).toStrictEqual(blankPlantRow());
  });

  it("its first payload is a single entry that prices at $0", () => {
    // No plantRateId and no dayRateOverride, so scope-item-pricing.ts's
    // `if (rate == null) continue` skips it: plant stays exactly 0, which is
    // what a NULL plantItems array priced at. Nothing about the item total
    // moves until the estimator actually picks a machine.
    const sent = plantPatchBody([defaultPlantRow(untouched, 0)]).plantItems as ScopePlantEntry[];
    expect(sent).toHaveLength(1);
    expect(sent[0].plantRateId).toBeNull();
    expect(sent[0].dayRateOverride).toBeNull();
    expect(sent[0].qty).toBe(0);
    expect(sent[0].days).toBe(0);
    expect(sent[0].description).toBe("");
  });
});

describe("an item that already holds two legacy plant entries", () => {
  const legacy = item({
    plantItems: [
      legacyEntry(1, { description: "Excavator 16T-25T", qty: 1, days: 2 }),
      legacyEntry(2, { description: "Bobcat", qty: 2, days: 3 })
    ]
  });

  it("the new group shows TWO rows, not one with the second orphaned", () => {
    expect(plantRowCountFromItem(legacy)).toBe(2);
  });

  it("both entries land on rows, in columnIndex order, with every field intact", () => {
    expect(defaultPlantRow(legacy, 0).description).toBe("Excavator 16T-25T");
    expect(defaultPlantRow(legacy, 0).qty).toBe("1");
    expect(defaultPlantRow(legacy, 0).days).toBe("2");
    expect(defaultPlantRow(legacy, 1).description).toBe("Bobcat");
    expect(defaultPlantRow(legacy, 1).qty).toBe("2");
    expect(defaultPlantRow(legacy, 1).days).toBe("3");
  });

  it("editing ONE row still sends BOTH entries — the other row is not deleted", () => {
    // This is the whole-array contract, and it is the thing that breaks if a
    // handler patches only the row it touched.
    const rows = [defaultPlantRow(legacy, 0), defaultPlantRow(legacy, 1)];
    rows[0] = { ...rows[0], days: "5" };
    const sent = plantPatchBody(rows).plantItems as ScopePlantEntry[];
    expect(sent).toHaveLength(2);
    expect(sent[0].days).toBe(5);
    expect(sent[1].description).toBe("Bobcat");
    expect(sent[1].qty).toBe(2);
    expect(sent[1].days).toBe(3);
  });

  it("re-saving them untouched is a no-op on price: same ids, same qty, same days", () => {
    const rows = [defaultPlantRow(legacy, 0), defaultPlantRow(legacy, 1)];
    const sent = plantPatchBody(rows).plantItems as ScopePlantEntry[];
    expect(sent.map((e) => e.plantRateId)).toStrictEqual(["plant-1", "plant-2"]);
    expect(sent.map((e) => e.qty)).toStrictEqual([1, 2]);
    expect(sent.map((e) => e.days)).toStrictEqual([2, 3]);
    // No override was invented for either row, so both keep pricing off the
    // catalogue rate exactly as they did before this slice.
    expect(sent.every((e) => e.dayRateOverride === null)).toBe(true);
  });
});

// ── Round trip ───────────────────────────────────────────────────────────────
// "Fill type, qty, days and day rate on three plant rows, reload, and state
// which fields survived." The reload is buildPlantItems -> (server) ->
// defaultPlantRow. If that is a fixed point, nothing is lost.

describe("save → reload → save round trip", () => {
  const typed: RowPlantState[] = [
    {
      plantRateId: "pr-1",
      customDescription: null,
      description: "Excavator 16T-25T",
      unit: "day",
      dayRateOverride: null,
      qty: "1",
      days: "5"
    },
    {
      plantRateId: "pr-2",
      customDescription: null,
      description: "Bobcat",
      unit: "day",
      dayRateOverride: 900,
      qty: "2",
      days: "1.5"
    },
    {
      plantRateId: null,
      customDescription: "Hired 30t excavator",
      description: "Hired 30t excavator",
      unit: "day",
      dayRateOverride: 0,
      qty: "1",
      days: "4"
    }
  ];

  const stored = buildPlantItems(typed);
  const reloaded = item({ plantItems: stored });

  it("restores all three rows", () => {
    expect(plantRowCountFromItem(reloaded)).toBe(3);
  });

  it("restores every field of every row, row 2 and row 3 included", () => {
    for (let i = 0; i < typed.length; i += 1) {
      expect(defaultPlantRow(reloaded, i)).toStrictEqual(typed[i]);
    }
  });

  it("re-saving after a reload sends a byte-identical array (no drift)", () => {
    const rehydrated = stored.map((_, i) => defaultPlantRow(reloaded, i));
    expect(buildPlantItems(rehydrated)).toStrictEqual(stored);
  });

  it("the free-typed custom machine comes back as a custom machine, name and rate", () => {
    const back = defaultPlantRow(reloaded, 2);
    expect(back.customDescription).toBe("Hired 30t excavator");
    expect(back.plantRateId).toBeNull();
    // A $0 override survives the trip as 0, not as "no override".
    expect(back.dayRateOverride).toBe(0);
  });
});

// ── Local-state bookkeeping ──────────────────────────────────────────────────

describe("writePlantRows", () => {
  const empty: ItemPlantRows = new Map();

  it("writes one key per row, densely indexed", () => {
    const next = writePlantRows(empty, "item-1", [row({ qty: "1" }), row({ qty: "2" })]);
    expect([...next.keys()].sort()).toStrictEqual(["item-1:0", "item-1:1"]);
    expect(next.get("item-1:1")?.qty).toBe("2");
  });

  it("deletes keys past the end so a removed row cannot be resurrected", () => {
    const before = writePlantRows(empty, "item-1", [row({ qty: "1" }), row({ qty: "2" }), row({ qty: "3" })]);
    const after = writePlantRows(before, "item-1", [row({ qty: "1" }), row({ qty: "3" })]);
    expect([...after.keys()].sort()).toStrictEqual(["item-1:0", "item-1:1"]);
    expect(after.get("item-1:1")?.qty).toBe("3");
    expect(after.has("item-1:2")).toBe(false);
  });

  it("leaves other items' rows untouched", () => {
    const before = writePlantRows(empty, "item-2", [row({ qty: "9" }), row({ qty: "8" })]);
    const after = writePlantRows(before, "item-1", [row({ qty: "1" })]);
    expect(after.get("item-2:0")?.qty).toBe("9");
    expect(after.get("item-2:1")?.qty).toBe("8");
  });

  it("does not mutate the map it was given", () => {
    const before = writePlantRows(empty, "item-1", [row({ qty: "1" })]);
    writePlantRows(before, "item-1", []);
    expect(before.has("item-1:0")).toBe(true);
  });
});

describe("removePlantRowAt", () => {
  const three = [row({ description: "A" }), row({ description: "B" }), row({ description: "C" })];

  it("removes the MIDDLE row, not the last one", () => {
    expect(removePlantRowAt(three, 1).map((r) => r.description)).toStrictEqual(["A", "C"]);
  });

  it("removes the first row", () => {
    expect(removePlantRowAt(three, 0).map((r) => r.description)).toStrictEqual(["B", "C"]);
  });

  it("the survivors are re-indexed densely on the wire", () => {
    const sent = buildPlantItems(removePlantRowAt(three, 1));
    expect(sent.map((e) => e.columnIndex)).toStrictEqual([1, 2]);
    expect(sent.map((e) => e.description)).toStrictEqual(["A", "C"]);
  });

  it("a three-row item comes back as two rows after the write", () => {
    const remaining = removePlantRowAt(three, 1);
    const reloaded = item({ plantItems: plantPatchBody(remaining).plantItems as ScopePlantEntry[] });
    expect(plantRowCountFromItem(reloaded)).toBe(2);
    expect(defaultPlantRow(reloaded, 1).description).toBe("C");
  });

  it("removing a row of a SERVER-hydrated item deletes the row that was clicked", () => {
    // The bug the plant side inherited from spliceRowState: rows hydrated
    // from the server have no entry in the local map, so splicing the map
    // alone left them at their old indices and the write deleted the wrong
    // one. Removing against the MATERIALISED list — which is what
    // removeRowFromItem now does — deletes row 1 and keeps rows 0 and 2.
    const server = item({
      plantItems: [
        legacyEntry(1, { description: "Excavator" }),
        legacyEntry(2, { description: "Bobcat" }),
        legacyEntry(3, { description: "Skid steer" })
      ]
    });
    const materialised = [0, 1, 2].map((i) => defaultPlantRow(server, i));
    const sent = plantPatchBody(removePlantRowAt(materialised, 1)).plantItems as ScopePlantEntry[];
    expect(sent.map((e) => e.description)).toStrictEqual(["Excavator", "Skid steer"]);
    expect(sent.map((e) => e.columnIndex)).toStrictEqual([1, 2]);
  });

  it("does not mutate the list it was given", () => {
    removePlantRowAt(three, 1);
    expect(three).toHaveLength(3);
  });
});
