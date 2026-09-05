// SCOPE_MANPOWER_PERSIST_V1 — unit tests for the Manpower persistence layer
// (pr-cardpersist-s1).
//
// The web workspace follows the no-render pattern (no @testing-library, no
// jsdom), so these target the pure helpers exported from
// ScopeQuantitiesTable. That is not a compromise here — the entire risk of
// this slice is the SHAPE OF THE PAYLOAD, and the payload is a pure function
// of row state. Every field the server reads is asserted by name.
//
// The authority for that shape is apps/api/src/modules/tendering/
// scope-item-pricing.ts (SCOPE_ITEM_LABOUR_STORE_V1), which is already merged:
//
//   ScopeLabourEntryInput = { rowIdx?, labourTypeId?, role?, shift?, qty?,
//                             days?, dayRateOverride? }
//   hasLabourRows()      — non-empty array wins; null / [] falls back to the
//                          men/days/shift scalars
//   labourRateForRow()   — dayRateOverride ?? rateCard[role:shift]
//                                          ?? rateCard[disciplineDefault:shift]
//   computeScopeItemTotal() — qty = row.qty == null ? 1 : n(row.qty)
//
// The last of those is why blank Qty is written as 0 and not null, and it is
// pinned below.

import { describe, it, expect } from "vitest";
import {
  hasStoredLabourRows,
  manpowerRowCountFromItem,
  rowManpowerFromLabourEntry,
  defaultManpowerRow,
  buildLabourItems,
  manpowerPatchBody,
  manpowerNumOrNull,
  manpowerNumOrZero,
  writeManpowerRows,
  removeManpowerRowAt,
  shiftLabel,
  type RowManpowerState,
  type ScopeLabourEntry,
  type ItemManpowerRows
} from "../ScopeQuantitiesTable";

// A row as the component holds it. Helper so each test states only what it
// is actually about.
function row(patch: Partial<RowManpowerState> = {}): RowManpowerState {
  return {
    labourTypeId: null,
    role: null,
    dayRateOverride: null,
    qty: "",
    days: "",
    shift: "Day",
    ...patch
  };
}

// The subset of ScopeItem the hydration helpers read.
function item(patch: {
  men?: string | null;
  days?: string | null;
  shift?: string | null;
  labourItems?: ScopeLabourEntry[] | null;
} = {}) {
  return {
    men: null,
    days: null,
    shift: null,
    labourItems: null,
    ...patch
  };
}

// ── The wire contract ────────────────────────────────────────────────────────
// The one test that would catch a rename on either side of the boundary.

describe("labourItems entry shape (server contract)", () => {
  it("emits exactly the seven keys scope-item-pricing.ts reads, and no others", () => {
    const [entry] = buildLabourItems([row({ labourTypeId: "lr-1", role: "Supervisor" })]);
    expect(Object.keys(entry).sort()).toStrictEqual([
      "dayRateOverride",
      "days",
      "labourTypeId",
      "qty",
      "role",
      "rowIdx",
      "shift"
    ]);
  });

  it("carries the rate-card ROLE, not just the rate id — the id does not price", () => {
    // labourRateForRow() keys on `${role}:${shift}`. A payload that shipped
    // only labourTypeId would price every row at the discipline default and
    // the estimator's Type choice would be cosmetic.
    const [entry] = buildLabourItems([row({ labourTypeId: "lr-7", role: "Machine operator" })]);
    expect(entry.role).toBe("Machine operator");
    expect(entry.labourTypeId).toBe("lr-7");
  });

  it("sends the STORED shift value, never the 'Weekday' display label", () => {
    const [entry] = buildLabourItems([row({ shift: "Day" })]);
    expect(entry.shift).toBe("Day");
    // Guard the seam: the label and the value must not converge.
    expect(shiftLabel("Day")).toBe("Weekday");
    expect(entry.shift).not.toBe(shiftLabel("Day"));
  });

  it("keeps Night and Weekend verbatim", () => {
    expect(buildLabourItems([row({ shift: "Night" })])[0].shift).toBe("Night");
    expect(buildLabourItems([row({ shift: "Weekend" })])[0].shift).toBe("Weekend");
  });

  it("normalises an empty shift to 'Day' rather than sending ''", () => {
    expect(buildLabourItems([row({ shift: "" })])[0].shift).toBe("Day");
  });

  it("re-derives rowIdx densely from array position", () => {
    const rows = [row({ role: "A" }), row({ role: "B" }), row({ role: "C" })];
    expect(buildLabourItems(rows).map((e) => e.rowIdx)).toStrictEqual([0, 1, 2]);
  });
});

// ── Number coercion ──────────────────────────────────────────────────────────

describe("manpowerNumOrNull (the men/days scalars)", () => {
  it("blank is null — the exact expression the component sent before this slice", () => {
    expect(manpowerNumOrNull("")).toBeNull();
  });
  it("whitespace is null", () => {
    expect(manpowerNumOrNull("   ")).toBeNull();
  });
  it("parses a number", () => {
    expect(manpowerNumOrNull("2.5")).toBe(2.5);
  });
  it("keeps an explicit 0", () => {
    expect(manpowerNumOrNull("0")).toBe(0);
  });
  it("unparseable input is null, not NaN", () => {
    expect(manpowerNumOrNull("abc")).toBeNull();
  });
});

describe("manpowerNumOrZero (qty/days inside labourItems)", () => {
  it("blank is 0, NOT null", () => {
    // scope-item-pricing.ts: `qty = row.qty == null ? 1 : n(row.qty)`.
    // A null here would make the server cost one person the estimator never
    // typed, and would contradict the row total the cell renders ("—").
    expect(manpowerNumOrZero("")).toBe(0);
  });
  it("parses a number", () => {
    expect(manpowerNumOrZero("3")).toBe(3);
  });
  it("keeps an explicit 0", () => {
    expect(manpowerNumOrZero("0")).toBe(0);
  });
  it("unparseable input is 0, never NaN on the wire", () => {
    expect(manpowerNumOrZero("abc")).toBe(0);
    expect(Number.isNaN(manpowerNumOrZero("abc"))).toBe(false);
  });
});

// ── Precedence: stored rows vs the legacy scalars ────────────────────────────

describe("hasStoredLabourRows", () => {
  it("null is false (an item that predates the column)", () => {
    expect(hasStoredLabourRows(null)).toBe(false);
  });
  it("undefined is false (an API response from before the field existed)", () => {
    expect(hasStoredLabourRows(undefined)).toBe(false);
  });
  it("empty array is false — same fallback as NULL, matching hasLabourRows()", () => {
    expect(hasStoredLabourRows([])).toBe(false);
  });
  it("a non-empty array is true", () => {
    expect(hasStoredLabourRows([{ rowIdx: 0 } as ScopeLabourEntry])).toBe(true);
  });
});

describe("manpowerRowCountFromItem", () => {
  it("an item with no stored rows has exactly one row", () => {
    expect(manpowerRowCountFromItem(item())).toBe(1);
  });
  it("an empty stored array still means one row", () => {
    expect(manpowerRowCountFromItem(item({ labourItems: [] }))).toBe(1);
  });
  it("the count IS the array length — three stored rows, three rows", () => {
    const rows = buildLabourItems([row(), row(), row()]);
    expect(manpowerRowCountFromItem(item({ labourItems: rows }))).toBe(3);
  });
});

// ── Hydration ────────────────────────────────────────────────────────────────

describe("rowManpowerFromLabourEntry", () => {
  it("restores every field the estimator typed", () => {
    const entry: ScopeLabourEntry = {
      rowIdx: 1,
      labourTypeId: "lr-9",
      role: "Asbestos labourer",
      shift: "Night",
      qty: 4,
      days: 2.5,
      dayRateOverride: 725
    };
    expect(rowManpowerFromLabourEntry(entry)).toStrictEqual({
      labourTypeId: "lr-9",
      role: "Asbestos labourer",
      dayRateOverride: 725,
      qty: "4",
      days: "2.5",
      shift: "Night"
    });
  });

  it("a stored dayRateOverride of 0 survives — 0 is an override, not an absence", () => {
    expect(rowManpowerFromLabourEntry({ ...blank(), dayRateOverride: 0 }).dayRateOverride).toBe(0);
  });

  it("a null dayRateOverride stays null (fall back to the catalogue rate)", () => {
    expect(rowManpowerFromLabourEntry(blank()).dayRateOverride).toBeNull();
  });

  it("null qty/days render as blank inputs, not '0' or 'null'", () => {
    const state = rowManpowerFromLabourEntry(blank());
    expect(state.qty).toBe("");
    expect(state.days).toBe("");
  });

  it("a null shift reads back as 'Day'", () => {
    expect(rowManpowerFromLabourEntry(blank()).shift).toBe("Day");
  });

  function blank(): ScopeLabourEntry {
    return {
      rowIdx: 0,
      labourTypeId: null,
      role: null,
      shift: null,
      qty: null,
      days: null,
      dayRateOverride: null
    };
  }
});

describe("defaultManpowerRow", () => {
  it("row 0 of an item with NO stored rows seeds from men/days/shift", () => {
    const state = defaultManpowerRow(item({ men: "2", days: "3", shift: "Night" }), 0);
    expect(state.qty).toBe("2");
    expect(state.days).toBe("3");
    expect(state.shift).toBe("Night");
    expect(state.labourTypeId).toBeNull();
    expect(state.role).toBeNull();
  });

  it("a null shift on a legacy item still reads 'Day'", () => {
    expect(defaultManpowerRow(item({ men: "2", days: "3" }), 0).shift).toBe("Day");
  });

  it("rows 1..N of an item with no stored rows are empty — there is nothing to restore", () => {
    const state = defaultManpowerRow(item({ men: "2", days: "3", shift: "Night" }), 1);
    expect(state).toStrictEqual(row());
  });

  it("stored rows win over the scalars, index by index", () => {
    const stored = buildLabourItems([
      row({ labourTypeId: "a", role: "Demolition labourer", qty: "5", days: "1", shift: "Weekend" }),
      row({ labourTypeId: "b", role: "Supervisor", qty: "1", days: "4", dayRateOverride: 900 })
    ]);
    const it0 = item({ men: "999", days: "999", shift: "Day", labourItems: stored });
    expect(defaultManpowerRow(it0, 0).qty).toBe("5");
    expect(defaultManpowerRow(it0, 0).shift).toBe("Weekend");
    expect(defaultManpowerRow(it0, 1).role).toBe("Supervisor");
    expect(defaultManpowerRow(it0, 1).dayRateOverride).toBe(900);
  });

  it("an index past the end of a stored array is a blank row, not a crash", () => {
    const stored = buildLabourItems([row({ qty: "1" })]);
    expect(defaultManpowerRow(item({ men: "2", labourItems: stored }), 4)).toStrictEqual(row());
  });
});

// ── The payload ──────────────────────────────────────────────────────────────

describe("manpowerPatchBody", () => {
  it("sends labourItems plus the row-0 scalars, and nothing else", () => {
    const body = manpowerPatchBody([row({ qty: "2", days: "3", shift: "Night" })]);
    expect(Object.keys(body).sort()).toStrictEqual(["days", "labourItems", "men", "shift"]);
  });

  it("men/days mirror row 0 exactly as the pre-slice component sent them", () => {
    const body = manpowerPatchBody([row({ qty: "2", days: "3.5" })]);
    expect(body.men).toBe(2);
    expect(body.days).toBe(3.5);
  });

  it("a blank row-0 qty still sends men: null — the scalar contract is unchanged", () => {
    const body = manpowerPatchBody([row({ days: "3" })]);
    expect(body.men).toBeNull();
    // ...while the ARRAY says 0, so the server prices 0 x 3 = $0, which is
    // what n(null) x 3 priced before and what the cell shows.
    expect((body.labourItems as ScopeLabourEntry[])[0].qty).toBe(0);
  });

  it("shift comes from row 0 and defaults to 'Day'", () => {
    expect(manpowerPatchBody([row()]).shift).toBe("Day");
    expect(manpowerPatchBody([row({ shift: "Weekend" })]).shift).toBe("Weekend");
  });

  it("ships EVERY row, not just the edited one (a short array replaces the stored one)", () => {
    const rows = [row({ role: "A", qty: "1" }), row({ role: "B", qty: "2" }), row({ role: "C", qty: "3" })];
    const sent = manpowerPatchBody(rows).labourItems as ScopeLabourEntry[];
    expect(sent).toHaveLength(3);
    expect(sent.map((e) => e.role)).toStrictEqual(["A", "B", "C"]);
    expect(sent.map((e) => e.qty)).toStrictEqual([1, 2, 3]);
  });

  it("carries the day-rate override of EVERY row, including rows past the first", () => {
    const sent = manpowerPatchBody([row(), row({ dayRateOverride: 640 })])
      .labourItems as ScopeLabourEntry[];
    expect(sent[1].dayRateOverride).toBe(640);
  });

  it("NEVER sends labourItems: [] — the key is omitted when there are no rows", () => {
    // [] and NULL price identically today, but they are different statements
    // about the item, and writing [] over a NULL would turn "never touched"
    // into "touched, and empty" for every later reader.
    const body = manpowerPatchBody([]);
    expect("labourItems" in body).toBe(false);
    expect(body.labourItems).toBeUndefined();
  });
});

// ── Existing-data safety ─────────────────────────────────────────────────────
// An item saved before this slice has labourItems = NULL. Until it is touched
// nothing is sent at all, so it prices exactly as it does today. These pin
// what happens on the FIRST touch, which is the moment the fallback stops
// applying and the array takes over.

describe("an item whose labourItems is still NULL", () => {
  const legacy = item({ men: "2", days: "3", shift: null });

  it("its first payload reproduces the scalars the server was already pricing", () => {
    const rows = [defaultManpowerRow(legacy, 0)];
    const sent = manpowerPatchBody(rows).labourItems as ScopeLabourEntry[];
    expect(sent).toHaveLength(1);
    expect(sent[0].qty).toBe(2);
    expect(sent[0].days).toBe(3);
    // role null -> labourRateForRow() falls through to the discipline's
    // default role, which is the ONLY rate the scalar path ever used.
    expect(sent[0].role).toBeNull();
    // dayRateOverride null -> the catalogue rate, not a substituted number.
    expect(sent[0].dayRateOverride).toBeNull();
    // A NULL shift normalises to "day" on the server; "Day" resolves to the
    // same rate. The written value cannot move the price.
    expect(sent[0].shift).toBe("Day");
  });

  it("appending a row to it leaves the priced total where it was", () => {
    // Row 0 keeps the scalars; the appended row is blank, and blank is
    // qty 0 x days 0 = $0 whatever rate it resolves to. So "+ Row" persists
    // the row count without moving money.
    const rows = [defaultManpowerRow(legacy, 0), defaultManpowerRow(legacy, 1)];
    const sent = manpowerPatchBody(rows).labourItems as ScopeLabourEntry[];
    expect(sent).toHaveLength(2);
    expect(sent[0].qty).toBe(2);
    expect(sent[0].days).toBe(3);
    expect(sent[1].qty).toBe(0);
    expect(sent[1].days).toBe(0);
    expect(sent[1].qty * sent[1].days).toBe(0);
  });

  it("an item with no manpower at all still writes a zero-cost array", () => {
    const rows = [defaultManpowerRow(item(), 0), defaultManpowerRow(item(), 1)];
    const sent = manpowerPatchBody(rows).labourItems as ScopeLabourEntry[];
    expect(sent.every((e) => (e.qty ?? 0) * (e.days ?? 0) === 0)).toBe(true);
    expect(manpowerPatchBody(rows).men).toBeNull();
  });
});

// ── Round trip ───────────────────────────────────────────────────────────────
// "Fill every field, reload, and state which fields survived." The reload is
// buildLabourItems -> (server) -> defaultManpowerRow. If that is a fixed
// point, nothing is lost.

describe("save → reload → save round trip", () => {
  const typed: RowManpowerState[] = [
    { labourTypeId: "lr-1", role: "Demolition labourer", dayRateOverride: null, qty: "3", days: "5", shift: "Day" },
    { labourTypeId: "lr-2", role: "Supervisor", dayRateOverride: 950, qty: "1", days: "5", shift: "Night" },
    { labourTypeId: "lr-3", role: "Machine operator", dayRateOverride: 0, qty: "2", days: "1.5", shift: "Weekend" }
  ];

  const stored = buildLabourItems(typed);
  const reloaded = item({ men: "3", days: "5", shift: "Day", labourItems: stored });

  it("restores all three rows", () => {
    expect(manpowerRowCountFromItem(reloaded)).toBe(3);
  });

  it("restores every field of every row, row 2 and row 3 included", () => {
    for (let i = 0; i < typed.length; i += 1) {
      expect(defaultManpowerRow(reloaded, i)).toStrictEqual(typed[i]);
    }
  });

  it("re-saving after a reload sends a byte-identical array (no drift)", () => {
    const rehydrated = stored.map((_, i) => defaultManpowerRow(reloaded, i));
    expect(buildLabourItems(rehydrated)).toStrictEqual(stored);
  });

  it("a $0 rate override survives the trip as 0, not as 'no override'", () => {
    expect(defaultManpowerRow(reloaded, 2).dayRateOverride).toBe(0);
  });
});

// ── Local-state bookkeeping ──────────────────────────────────────────────────

describe("writeManpowerRows", () => {
  const empty: ItemManpowerRows = new Map();

  it("writes one key per row, densely indexed", () => {
    const next = writeManpowerRows(empty, "item-1", [row({ qty: "1" }), row({ qty: "2" })]);
    expect([...next.keys()].sort()).toStrictEqual(["item-1:0", "item-1:1"]);
    expect(next.get("item-1:1")?.qty).toBe("2");
  });

  it("deletes keys past the end so a removed row cannot be resurrected", () => {
    const before = writeManpowerRows(empty, "item-1", [row({ qty: "1" }), row({ qty: "2" }), row({ qty: "3" })]);
    const after = writeManpowerRows(before, "item-1", [row({ qty: "1" }), row({ qty: "3" })]);
    expect([...after.keys()].sort()).toStrictEqual(["item-1:0", "item-1:1"]);
    expect(after.get("item-1:1")?.qty).toBe("3");
    expect(after.has("item-1:2")).toBe(false);
  });

  it("leaves other items' rows untouched", () => {
    const before = writeManpowerRows(empty, "item-2", [row({ qty: "9" }), row({ qty: "8" })]);
    const after = writeManpowerRows(before, "item-1", [row({ qty: "1" })]);
    expect(after.get("item-2:0")?.qty).toBe("9");
    expect(after.get("item-2:1")?.qty).toBe("8");
  });

  it("does not mutate the map it was given", () => {
    const before = writeManpowerRows(empty, "item-1", [row({ qty: "1" })]);
    writeManpowerRows(before, "item-1", []);
    expect(before.has("item-1:0")).toBe(true);
  });
});

describe("removeManpowerRowAt", () => {
  const three = [row({ role: "A" }), row({ role: "B" }), row({ role: "C" })];

  it("removes the MIDDLE row, not the last one", () => {
    expect(removeManpowerRowAt(three, 1).map((r) => r.role)).toStrictEqual(["A", "C"]);
  });

  it("removes the first row", () => {
    expect(removeManpowerRowAt(three, 0).map((r) => r.role)).toStrictEqual(["B", "C"]);
  });

  it("the survivors are re-indexed densely on the wire", () => {
    const sent = buildLabourItems(removeManpowerRowAt(three, 1));
    expect(sent.map((e) => e.rowIdx)).toStrictEqual([0, 1]);
    expect(sent.map((e) => e.role)).toStrictEqual(["A", "C"]);
  });

  it("a three-row item comes back as two rows after the write", () => {
    const remaining = removeManpowerRowAt(three, 1);
    const body = manpowerPatchBody(remaining);
    const reloaded = item({ labourItems: body.labourItems as ScopeLabourEntry[] });
    expect(manpowerRowCountFromItem(reloaded)).toBe(2);
    expect(defaultManpowerRow(reloaded, 1).role).toBe("C");
  });

  it("does not mutate the list it was given", () => {
    removeManpowerRowAt(three, 1);
    expect(three).toHaveLength(3);
  });
});
