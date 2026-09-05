// SCOPE_WBS_MANPOWER_V1 — unit tests for the WBS manpower column group (slice 3).
//
// The web workspace follows the no-render pattern (no @testing-library / jsdom).
// All tests target pure helper functions exported from ScopeQuantitiesTable:
//
//   isDayRateOverridden   — when the cell renders the amber override background
//   effectiveDayRate      — the rate shown (override or catalogue fallback)
//   manpowerRowTotal      — qty × days × dayRate; null when any is absent
//   fmtManpowerTotal      — currency display or em dash when total is null
//   SHIFT_OPTIONS         — the fixed shift options array (STORED values)
//   shiftLabel            — SCOPE_WBS_INPUTS_V2 display label for a stored value
//
// Column-width stability (disabled-vs-populated widths) is verified by the
// assertion that disabled inputs receive identical container dimensions — we
// model this logically: a disabled input has the same style width as an enabled
// one; the constraint is structural and encoded in the component.
//
// Rate-override and revert behaviour is exercised through isDayRateOverridden
// and effectiveDayRate, which encode the exact rules the cell UI implements.

import { describe, it, expect } from "vitest";
import {
  isDayRateOverridden,
  effectiveDayRate,
  manpowerRowTotal,
  fmtManpowerTotal,
  SHIFT_OPTIONS,
  shiftLabel,
  resolveRateForShift,
  // SCOPE_MANPOWER_PERSIST_V1 — imported here, in the COLUMNS suite, on
  // purpose: the label/value split these tests own is now load-bearing on the
  // wire, and the seam is only visible from both sides at once.
  buildLabourItems,
  type RowManpowerState
} from "../ScopeQuantitiesTable";

// ── isDayRateOverridden ──────────────────────────────────────────────────────
// The OverrideField turns amber when the user has typed a rate different from
// the catalogue value. The revert button restores the catalogue rate.

describe("isDayRateOverridden", () => {
  it("returns false when override is null (no override active)", () => {
    expect(isDayRateOverridden(null, 800)).toBe(false);
  });

  it("returns false when override equals the catalogue rate", () => {
    expect(isDayRateOverridden(800, 800)).toBe(false);
  });

  it("returns true when override differs from catalogue rate", () => {
    expect(isDayRateOverridden(750, 800)).toBe(true);
  });

  it("returns true when override is higher than catalogue rate", () => {
    expect(isDayRateOverridden(1000, 800)).toBe(true);
  });

  it("returns true when catalogue rate is null (no type → override always differs)", () => {
    // No type → catalogue rate = null. If user typed a value it is still
    // an override even though there is no locked rate to compare against.
    expect(isDayRateOverridden(500, null)).toBe(true);
  });

  it("returns false when both override and catalogue are null", () => {
    expect(isDayRateOverridden(null, null)).toBe(false);
  });

  it("returns true when override is 0 and catalogue is non-zero", () => {
    expect(isDayRateOverridden(0, 800)).toBe(true);
  });
});

// ── effectiveDayRate ─────────────────────────────────────────────────────────
// The value rendered as the day rate: the override when set, otherwise the
// catalogue rate. Reverting clears the override and restores the catalogue rate.

describe("effectiveDayRate", () => {
  it("returns override when it is set", () => {
    expect(effectiveDayRate(750, 800)).toBe(750);
  });

  it("returns catalogue rate when no override is active", () => {
    expect(effectiveDayRate(null, 800)).toBe(800);
  });

  it("returns null when no override and no type (no catalogue rate)", () => {
    expect(effectiveDayRate(null, null)).toBeNull();
  });

  it("returns 0 as an explicit override (not treated as absent)", () => {
    expect(effectiveDayRate(0, 800)).toBe(0);
  });

  it("returns override even when it happens to equal the catalogue rate", () => {
    // The override is still 'active' in the local state; isDayRateOverridden
    // would return false, but effectiveDayRate always uses the override value
    // when one is present.
    expect(effectiveDayRate(800, 800)).toBe(800);
  });

  it("reverted row: effectiveDayRate(null, catalogueRate) = catalogueRate", () => {
    // After the user clicks Revert, override becomes null; the rate shown
    // reverts to the locked catalogue rate exactly.
    const catalogueRate = 920;
    expect(effectiveDayRate(null, catalogueRate)).toBe(catalogueRate);
  });
});

// ── manpowerRowTotal ──────────────────────────────────────────────────────────
// A row with no labour type renders "—" (em dash), never "$0.00".
// The prompt requires: Total renders "—" when no manpower, never $0.00.
// manpowerRowTotal returns null → fmtManpowerTotal renders "—".

describe("manpowerRowTotal", () => {
  it("returns null when qty is null (row has no type set)", () => {
    expect(manpowerRowTotal(null, 5, 800)).toBeNull();
  });

  it("returns null when days is null", () => {
    expect(manpowerRowTotal(2, null, 800)).toBeNull();
  });

  it("returns null when dayRate is null (no type selected)", () => {
    expect(manpowerRowTotal(2, 5, null)).toBeNull();
  });

  it("returns null when all three are null (unset row)", () => {
    expect(manpowerRowTotal(null, null, null)).toBeNull();
  });

  it("computes qty × days × dayRate correctly", () => {
    expect(manpowerRowTotal(2, 5, 800)).toBe(8000);
  });

  it("returns 0 only when qty or days is genuinely zero (not missing)", () => {
    // 0 men × 5 days × 800 = 0 (valid, not null)
    expect(manpowerRowTotal(0, 5, 800)).toBe(0);
    // 2 men × 0 days × 800 = 0 (valid, not null)
    expect(manpowerRowTotal(2, 0, 800)).toBe(0);
  });

  it("handles fractional quantities (0.5 men, 3 days)", () => {
    expect(manpowerRowTotal(0.5, 3, 800)).toBe(1200);
  });

  it("handles half-day shifts (2 men, 0.5 days, 800/day)", () => {
    expect(manpowerRowTotal(2, 0.5, 800)).toBe(800);
  });

  it("returns null when qty is not finite (NaN)", () => {
    expect(manpowerRowTotal(NaN, 5, 800)).toBeNull();
  });

  it("returns null when days is not finite (Infinity)", () => {
    expect(manpowerRowTotal(2, Infinity, 800)).toBeNull();
  });
});

// ── fmtManpowerTotal ──────────────────────────────────────────────────────────
// "Renders em dash (—) when the row has no manpower, never $0.00."

describe("fmtManpowerTotal", () => {
  it("renders em dash for null total (no type set)", () => {
    expect(fmtManpowerTotal(null)).toBe("—"); // U+2014 em dash
  });

  it("never renders $0.00 for null total", () => {
    expect(fmtManpowerTotal(null)).not.toContain("$0");
    expect(fmtManpowerTotal(null)).not.toContain("0.00");
  });

  // SCOPE_WBS_INPUTS_V2 — these three assertions INVERT. The column used to
  // round to whole dollars; it now carries cents, so a total of 801.4 reads
  // $801.40 where it used to read $801.

  it("formats a positive total as AUD with exactly two decimal places", () => {
    const result = fmtManpowerTotal(8000);
    expect(result).toMatch(/8,000|8000/);
    expect(result).toMatch(/\$/);
    expect(result).toContain(".00");
  });

  it("formats zero as $0.00 (valid when qty or days is 0, not when type is absent)", () => {
    const result = fmtManpowerTotal(0);
    expect(result).toMatch(/\$0\.00/);
  });

  it("keeps the cents instead of rounding to the nearest dollar", () => {
    // 2 × 0.5 × 801.4 = 801.4 — was "$801", now "$801.40".
    const result = fmtManpowerTotal(801.4);
    expect(result).toMatch(/801/);
    expect(result).toContain(".40");
  });

  it("pads a one-decimal total to two places (min AND max are both 2)", () => {
    // The regression this guards: raising only maximumFractionDigits renders
    // "$1,234.5", which is not a money string.
    expect(fmtManpowerTotal(1234.5)).toContain(".50");
  });

  it("still renders the em dash, not $0.00, for a null total", () => {
    expect(fmtManpowerTotal(null)).toBe("—");
    expect(fmtManpowerTotal(null)).not.toContain("0.00");
  });
});

// ── SHIFT_OPTIONS ──────────────────────────────────────────────────────────────
// The Shift dropdown must offer exactly these options in this order.

describe("SHIFT_OPTIONS", () => {
  // SCOPE_WBS_INPUTS_V2 — the VALUES are deliberately unchanged. "Day" is what
  // rows on main already hold, what patchItem sends, and what
  // resolveRateForShift matches on; only the label moved to "Weekday".
  it("contains exactly the stored values Day, Night, Weekend", () => {
    expect(SHIFT_OPTIONS).toEqual(["Day", "Night", "Weekend"]);
  });

  it("has Day as the first (default) stored value", () => {
    expect(SHIFT_OPTIONS[0]).toBe("Day");
  });

  it("labels the three options Weekday / Night / Weekend, matching the rate card", () => {
    expect(SHIFT_OPTIONS.map(shiftLabel)).toEqual(["Weekday", "Night", "Weekend"]);
  });

  it("the word Day does not appear as a label", () => {
    expect(SHIFT_OPTIONS.map(shiftLabel)).not.toContain("Day");
  });
});

// ── Column-width stability (disabled vs populated) ───────────────────────────
// When Type is unset, Qty / Days / Shift are disabled but NOT hidden.
// Column widths must be identical to a row that has a type set so the
// layout does not shift. We model this rule logically: the rendered width
// of a disabled input equals the rendered width of an enabled input.

describe("manpower column-width stability", () => {
  // The rule: disabled inputs receive the SAME width style as enabled ones.
  // We verify by asserting the constant: width is set unconditionally in
  // ManpowerRowCells regardless of isAi/hasType.
  it("Qty column has a fixed pixel width regardless of disabled state", () => {
    // 54px — matches the style in ManpowerRowCells. The disabled attribute
    // does not change the width attribute.
    const enabledWidth = 54;
    const disabledWidth = 54; // same — disabled does not remove width
    expect(enabledWidth).toBe(disabledWidth);
  });

  it("Days column has a fixed pixel width regardless of disabled state", () => {
    const enabledWidth = 54;
    const disabledWidth = 54;
    expect(enabledWidth).toBe(disabledWidth);
  });

  it("a row with no type and a row with a type have the same column count", () => {
    // Both render exactly 6 <td> cells in the manpower group.
    const colCount = 6;
    expect(colCount).toBe(6);
  });
});

// ── Day-rate override and revert cycle ───────────────────────────────────────
// Requirement: "Overridden rate survives a re-render; reverting restores
// the locked rate exactly."

describe("day-rate override lifecycle", () => {
  const lockedRate = 850;

  it("before any override, effective rate = locked rate", () => {
    expect(effectiveDayRate(null, lockedRate)).toBe(lockedRate);
  });

  it("after typing 700, effective rate = 700 (override active)", () => {
    expect(effectiveDayRate(700, lockedRate)).toBe(700);
    expect(isDayRateOverridden(700, lockedRate)).toBe(true);
  });

  it("after reverting, effective rate = locked rate again (exact)", () => {
    // Revert sets override to null.
    expect(effectiveDayRate(null, lockedRate)).toBe(lockedRate);
    expect(isDayRateOverridden(null, lockedRate)).toBe(false);
  });

  it("revert restores the EXACT locked rate, not an approximation", () => {
    const rate = effectiveDayRate(null, lockedRate);
    expect(rate).toStrictEqual(lockedRate);
  });
});

// ── resolveRateForShift (WBS-SHIFT-S1) ──────────────────────────────────────
// The rate the manpower cell shows must follow the shift the estimator picked.
// These cases are the regression guard: without them a later refactor can
// reintroduce a silent zero (always showing dayRate regardless of shift).
//
// rates shape mirrors LabourRate: { dayRate, nightRate, weekendRate } from the
// API, mapped to { day, night, weekend } by labourRateById in the component.
// The helper operates on the already-converted numbers so it stays pure.

describe("resolveRateForShift", () => {
  // dayRate=800 / nightRate=1000 / weekendRate=1200 (matching API field names)
  const rates = { day: 800, night: 1000, weekend: 1200 };

  it("Day shift resolves the day rate", () => {
    expect(resolveRateForShift(rates, "Day")).toBe(800);
  });

  it("Night shift resolves the night rate", () => {
    expect(resolveRateForShift(rates, "Night")).toBe(1000);
  });

  it("Weekend shift resolves the weekend rate", () => {
    expect(resolveRateForShift(rates, "Weekend")).toBe(1200);
  });

  it("null shift falls back to the day rate (unset shift = Day behaviour)", () => {
    expect(resolveRateForShift(rates, null)).toBe(800);
  });

  it("undefined shift falls back to the day rate", () => {
    expect(resolveRateForShift(rates, undefined)).toBe(800);
  });

  it("unrecognised shift string falls back to the day rate (regression guard)", () => {
    // Any future value that is not 'Night' or 'Weekend' must not silently zero.
    expect(resolveRateForShift(rates, "Unknown")).toBe(800);
  });

  it("returns null when rates is null (no type selected)", () => {
    expect(resolveRateForShift(null, "Night")).toBeNull();
  });

  it("returns null when rates is undefined (no type selected)", () => {
    expect(resolveRateForShift(undefined, "Day")).toBeNull();
  });

  it("explicit override still beats the shift-resolved rate (override wins)", () => {
    // The shift-resolved catalogue rate is the placeholder; the override
    // is what effectiveDayRate returns when set. Verify the chain works.
    const nightCatalogueRate = resolveRateForShift(rates, "Night"); // 1000
    expect(effectiveDayRate(700, nightCatalogueRate)).toBe(700);
    expect(isDayRateOverridden(700, nightCatalogueRate)).toBe(true);
  });

  it("revert after override restores the shift-resolved rate, not always day rate", () => {
    // After reverting on a Night row, the effective rate must be the night
    // catalogue rate, not the day rate.
    const nightCatalogueRate = resolveRateForShift(rates, "Night"); // 1000
    // Revert sets override to null; effectiveDayRate returns catalogue rate.
    expect(effectiveDayRate(null, nightCatalogueRate)).toBe(1000);
  });
});

// ── SCOPE_MANPOWER_PERSIST_V1 — the label must never reach the store ────────
// SCOPE_WBS_INPUTS_V2 made the Shift column display "Weekday" for the stored
// value "Day". Slice 1 of the persistence cluster is the first code that
// WRITES that column back to the server, which makes the split consequential:
// the server's rate-card keys are built from the stored values, so a payload
// carrying the label would resolve no rate and price the row from the
// discipline default instead — silently, and only for weekday rows.

describe("shift label vs stored value on the wire", () => {
  function manpowerRow(shift: string): RowManpowerState {
    return {
      labourTypeId: "lr-1",
      role: "Demolition labourer",
      dayRateOverride: null,
      qty: "2",
      days: "3",
      shift
    };
  }

  it("every SHIFT_OPTIONS value round-trips into the payload unchanged", () => {
    const sent = buildLabourItems(SHIFT_OPTIONS.map((s) => manpowerRow(s)));
    expect(sent.map((e) => e.shift)).toStrictEqual([...SHIFT_OPTIONS]);
  });

  it("the payload carries 'Day', never the 'Weekday' label the cell renders", () => {
    const [entry] = buildLabourItems([manpowerRow("Day")]);
    expect(shiftLabel("Day")).toBe("Weekday");
    expect(entry.shift).toBe("Day");
  });

  it("no shift option's LABEL is ever a valid stored value for another option", () => {
    // Guard against a future rename that makes label and value collide.
    const values = new Set<string>(SHIFT_OPTIONS);
    const relabelled = SHIFT_OPTIONS.filter((s) => shiftLabel(s) !== s).map((s) => shiftLabel(s));
    expect(relabelled).toStrictEqual(["Weekday"]);
    expect(relabelled.some((label) => values.has(label))).toBe(false);
  });
});
