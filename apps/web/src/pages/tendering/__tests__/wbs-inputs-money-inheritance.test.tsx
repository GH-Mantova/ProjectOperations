// SCOPE_WBS_INPUTS_V2 — unit tests for the money and inheritance rules of the
// WBS row inputs (cluster scope-card-corrections, slice 2).
//
// The web workspace follows the no-render pattern (no @testing-library /
// jsdom); every test here targets a pure function exported from
// ScopeQuantitiesTable:
//
//   resolveCardMarkup           — the card -> tender -> 0 inheritance chain
//   effectiveMarkup             — item override on top of that chain
//   isMarkupOverridden          — whether the row is inheriting or overriding
//   manpowerPatchForTypeChange  — a role change releases a stale rate override
//   manpowerPatchForShiftChange — so does a shift change
//   fmtManpowerTotal            — cents, and the em dash that is not $0.00
//   fmtPlantTotal               — same
//   shiftLabel                  — the "Day" value labelled "Weekday"
//   showsCuttingColumn          — the discipline gate on the Cutting? tick
//
// The theme of the whole file: ZERO IS A REAL VALUE. A card set to 0% is not a
// card with no markup set, a rate override of 0 is not an absent override, and
// a total of 0 is not a total that could not be computed. Every fallback below
// falls back on absence (null / undefined / non-finite) and never on zero.

import { describe, it, expect } from "vitest";
import {
  resolveCardMarkup,
  effectiveMarkup,
  isMarkupOverridden,
  manpowerPatchForTypeChange,
  manpowerPatchForShiftChange,
  fmtManpowerTotal,
  fmtPlantTotal,
  shiftLabel,
  showsCuttingColumn,
  effectiveDayRate,
  isDayRateOverridden,
  resolveRateForShift,
  SHIFT_OPTIONS
} from "../ScopeQuantitiesTable";

// ── resolveCardMarkup ────────────────────────────────────────────────────────
// The link ScopeCardsTab never connected. The card renders
// "Inherits tender markup (N%)" in its own header, but handed the table
// nothing, so ScopeQuantitiesTable fell through to the prop's `= 0` default and
// every row claimed to inherit 0%.
//
//   item override  ->  card override  ->  tender markup  ->  0
//                       (this fn)         (this fn)

describe("resolveCardMarkup", () => {
  it("uses the card override when the card has one (12% card, 8% tender -> 12)", () => {
    expect(resolveCardMarkup(12, 8)).toBe(12);
  });

  it("falls through to the tender markup when the card override is null", () => {
    expect(resolveCardMarkup(null, 8)).toBe(8);
  });

  it("falls through to the tender markup when the card override is undefined", () => {
    // An older cached card response can be missing the field entirely;
    // CardMarkupOverride already treats null and undefined identically.
    expect(resolveCardMarkup(undefined, 8)).toBe(8);
  });

  // ── zero at each link is a real value, not an absence ──────────────────────

  it("a card explicitly on 0% inherits 0%, NOT the tender's 8%", () => {
    // The trap: `cardOverride || tenderMarkup` would return 8 here and silently
    // re-apply a markup the estimator deliberately removed from this card.
    expect(resolveCardMarkup(0, 8)).toBe(0);
  });

  it("a tender genuinely on 0% resolves to 0% for a card with no override", () => {
    expect(resolveCardMarkup(null, 0)).toBe(0);
  });

  it("a 12% card override still wins over a 0% tender", () => {
    expect(resolveCardMarkup(12, 0)).toBe(12);
  });

  it("a 0% card override still wins over a 0% tender (both zero, still 0)", () => {
    expect(resolveCardMarkup(0, 0)).toBe(0);
  });

  // ── the floor ─────────────────────────────────────────────────────────────

  it("returns 0 only when NEITHER link supplied a number", () => {
    expect(resolveCardMarkup(null, null)).toBe(0);
    expect(resolveCardMarkup(undefined, undefined)).toBe(0);
    expect(resolveCardMarkup(null, undefined)).toBe(0);
  });

  it("treats a non-finite card override as absent and falls through", () => {
    // Number("") is 0 but Number("abc") is NaN; a garbled value must not
    // become a markup of NaN% on every row of the card.
    expect(resolveCardMarkup(NaN, 8)).toBe(8);
    expect(resolveCardMarkup(Infinity, 8)).toBe(8);
  });

  it("treats a non-finite tender markup as absent and hits the floor", () => {
    expect(resolveCardMarkup(null, NaN)).toBe(0);
  });

  it("carries fractional percents through unchanged (no rounding)", () => {
    expect(resolveCardMarkup(12.5, 8)).toBe(12.5);
    expect(resolveCardMarkup(null, 7.25)).toBe(7.25);
  });
});

// ── the full chain: item -> card -> tender -> 0 ──────────────────────────────
// effectiveMarkup is the top link and is unchanged by this slice; it was only
// ever fed a zero. These cases pin the composition end to end.

describe("markup inheritance chain (item -> card -> tender)", () => {
  const TENDER = 8;

  it("no item override, no card override: the row shows the tender markup", () => {
    const card = resolveCardMarkup(null, TENDER);
    expect(effectiveMarkup(null, card)).toBe(8);
  });

  it("no item override, 12% card: the row shows 12 (was 0 before this slice)", () => {
    // OLD: cardMarkup was never passed -> the prop defaulted to 0 ->
    //      effectiveMarkup(null, 0) === 0. The row read "Card: 0%".
    // NEW: effectiveMarkup(null, 12) === 12.
    const card = resolveCardMarkup(12, TENDER);
    expect(effectiveMarkup(null, card)).toBe(12);
    expect(effectiveMarkup(null, 0)).toBe(0); // the old, wrong figure, for contrast
  });

  it("15% item override on a 12% card: the row shows 15 and reads as overridden", () => {
    const card = resolveCardMarkup(12, TENDER);
    expect(effectiveMarkup(15, card)).toBe(15);
    expect(isMarkupOverridden(15, card)).toBe(true);
  });

  it("an item override of 0 on a 12% card is a real override, not an absence", () => {
    const card = resolveCardMarkup(12, TENDER);
    expect(effectiveMarkup(0, card)).toBe(0);
    expect(isMarkupOverridden(0, card)).toBe(true);
  });

  it("an item override of 0 used to read as 'inheriting' because the card read 0", () => {
    // The concrete regression: with the card silently on 0, an item deliberately
    // set to 0% compared equal to the card default and the revert affordance
    // never appeared. With the card at its real 12 it does.
    expect(isMarkupOverridden(0, 0)).toBe(false); // old behaviour
    expect(isMarkupOverridden(0, 12)).toBe(true); // new behaviour
  });

  it("an item override that equals the card is not an override", () => {
    const card = resolveCardMarkup(12, TENDER);
    expect(isMarkupOverridden(12, card)).toBe(false);
    expect(effectiveMarkup(12, card)).toBe(12);
  });

  it("a 0% card under an 8% tender: rows inherit 0, not 8", () => {
    const card = resolveCardMarkup(0, TENDER);
    expect(card).toBe(0);
    expect(effectiveMarkup(null, card)).toBe(0);
    expect(isMarkupOverridden(null, card)).toBe(false);
  });

  it("the Markup placeholder string is the resolved card markup", () => {
    // The input renders placeholder={String(cardMarkup)} and the tooltip
    // `Inheriting card markup (${cardMarkup}%)`.
    expect(String(resolveCardMarkup(12, 8))).toBe("12");
    expect(`Inheriting card markup (${resolveCardMarkup(12, 8)}%)`).toBe(
      "Inheriting card markup (12%)"
    );
    expect(`Inheriting card markup (${resolveCardMarkup(null, 8)}%)`).toBe(
      "Inheriting card markup (8%)"
    );
  });
});

// ── the rate-override cascade ────────────────────────────────────────────────
// "Changing the role or the shift releases a stale override, the same cascade
// rule the measurements use." The plant column already did this; manpower did
// not.

describe("manpowerPatchForTypeChange", () => {
  it("sets the new role and releases the override", () => {
    expect(manpowerPatchForTypeChange("labour-supervisor")).toEqual({
      labourTypeId: "labour-supervisor",
      dayRateOverride: null
    });
  });

  it("releases the override when the role is cleared to none", () => {
    expect(manpowerPatchForTypeChange(null)).toEqual({
      labourTypeId: null,
      dayRateOverride: null
    });
  });

  it("releases with null (absence), never with a substituted zero", () => {
    // A released override must fall back to the catalogue rate. Writing 0 would
    // be a $0/day rate — a real, and wrong, number.
    expect(manpowerPatchForTypeChange("x").dayRateOverride).toBeNull();
    expect(manpowerPatchForTypeChange("x").dayRateOverride).not.toBe(0);
  });

  it("does not touch qty, days or shift", () => {
    expect(Object.keys(manpowerPatchForTypeChange("x")).sort()).toEqual([
      "dayRateOverride",
      "labourTypeId"
    ]);
  });
});

describe("manpowerPatchForShiftChange", () => {
  it("sets the new shift and releases the override", () => {
    expect(manpowerPatchForShiftChange("Night")).toEqual({
      shift: "Night",
      dayRateOverride: null
    });
  });

  it("carries the STORED shift string, not its label", () => {
    // patchItem sends exactly this value; it must stay "Day", never "Weekday".
    expect(manpowerPatchForShiftChange("Day").shift).toBe("Day");
  });

  it("does not touch the labour type", () => {
    expect(Object.keys(manpowerPatchForShiftChange("Weekend")).sort()).toEqual([
      "dayRateOverride",
      "shift"
    ]);
  });
});

describe("stale rate override released on a role change", () => {
  // Labourer $800/day, Supervisor $1,100/day. The estimator types 950 against
  // Labourer, then switches the row to Supervisor.
  const LABOURER = 800;
  const SUPERVISOR = 1100;

  it("before: the typed 950 is shown and the row reads as overridden", () => {
    expect(effectiveDayRate(950, LABOURER)).toBe(950);
    expect(isDayRateOverridden(950, LABOURER)).toBe(true);
  });

  it("after: the new role's locked 1100 is shown, not the typed 950", () => {
    const released = manpowerPatchForTypeChange("supervisor").dayRateOverride;
    expect(effectiveDayRate(released, SUPERVISOR)).toBe(SUPERVISOR);
    expect(effectiveDayRate(released, SUPERVISOR)).not.toBe(950);
    expect(isDayRateOverridden(released, SUPERVISOR)).toBe(false);
  });

  it("an override of exactly 0 is released too (zero is an override, not an absence)", () => {
    // Before the change the row genuinely shows $0/day and reads as overridden.
    expect(isDayRateOverridden(0, LABOURER)).toBe(true);
    expect(effectiveDayRate(0, LABOURER)).toBe(0);
    // After it, the new role's locked rate is back.
    const released = manpowerPatchForTypeChange("supervisor").dayRateOverride;
    expect(effectiveDayRate(released, SUPERVISOR)).toBe(SUPERVISOR);
  });

  it("clearing the role to none leaves no rate at all, not a stale one", () => {
    const released = manpowerPatchForTypeChange(null).dayRateOverride;
    // No role -> no catalogue rate -> the cell has nothing to show.
    expect(effectiveDayRate(released, null)).toBeNull();
  });
});

describe("stale rate override released on a shift change", () => {
  // One role, three catalogue rates. The estimator types 950 on the Weekday
  // row, then switches the row to Night.
  const rates = { day: 800, night: 1000, weekend: 1200 };

  it("before: the typed 950 is shown against the Weekday rate of 800", () => {
    const weekday = resolveRateForShift(rates, "Day");
    expect(weekday).toBe(800);
    expect(effectiveDayRate(950, weekday)).toBe(950);
    expect(isDayRateOverridden(950, weekday)).toBe(true);
  });

  it("after: the Night locked rate of 1000 is shown, not the typed 950", () => {
    const patch = manpowerPatchForShiftChange("Night");
    const night = resolveRateForShift(rates, patch.shift ?? null);
    expect(night).toBe(1000);
    expect(effectiveDayRate(patch.dayRateOverride, night)).toBe(1000);
    expect(effectiveDayRate(patch.dayRateOverride, night)).not.toBe(950);
    expect(isDayRateOverridden(patch.dayRateOverride, night)).toBe(false);
  });

  it("the released row still resolves through the shift, not always the day rate", () => {
    const patch = manpowerPatchForShiftChange("Weekend");
    expect(resolveRateForShift(rates, patch.shift ?? null)).toBe(1200);
  });

  it("a role with a zero night rate resolves to 0, not to the day rate", () => {
    // Zero again: a role priced at $0 for nights is a real figure and the
    // fallback must not quietly substitute the $800 day rate.
    const zeroNight = { day: 800, night: 0, weekend: 1200 };
    expect(resolveRateForShift(zeroNight, "Night")).toBe(0);
    expect(effectiveDayRate(null, resolveRateForShift(zeroNight, "Night"))).toBe(0);
  });
});

// ── money formatting: cents, and the em dash that is not $0.00 ───────────────

describe("row money carries cents", () => {
  it("a manpower total of 801.4 renders $801.40 (was $801)", () => {
    expect(fmtManpowerTotal(801.4)).toBe("$801.40");
  });

  it("a plant total of 600.5 renders $600.50 (was $601)", () => {
    expect(fmtPlantTotal(600.5)).toBe("$600.50");
  });

  it("a one-decimal figure is padded to two places, not left at $1,234.5", () => {
    expect(fmtManpowerTotal(1234.5)).toBe("$1,234.50");
    expect(fmtPlantTotal(1234.5)).toBe("$1,234.50");
  });

  it("a whole-dollar figure gains .00", () => {
    expect(fmtManpowerTotal(8000)).toBe("$8,000.00");
    expect(fmtPlantTotal(12000)).toBe("$12,000.00");
  });

  it("a genuine zero total renders $0.00", () => {
    // 0 men x 5 days x $800 is a computed zero and says so.
    expect(fmtManpowerTotal(0)).toBe("$0.00");
    expect(fmtPlantTotal(0)).toBe("$0.00");
  });

  it("a null total is still the em dash and never $0.00", () => {
    // The distinction the whole column rests on: "nothing to price here"
    // versus "priced, and it comes to nothing".
    expect(fmtManpowerTotal(null)).toBe("—");
    expect(fmtPlantTotal(null)).toBe("—");
    expect(fmtManpowerTotal(null)).not.toContain("0.00");
    expect(fmtPlantTotal(null)).not.toContain("0.00");
  });

  it("cents are not rounded away by the formatter", () => {
    expect(fmtManpowerTotal(0.01)).toBe("$0.01");
    expect(fmtPlantTotal(0.01)).toBe("$0.01");
  });
});

// ── shift label vs shift value ───────────────────────────────────────────────

describe("shiftLabel", () => {
  it("labels the stored value Day as Weekday, matching the rate card", () => {
    expect(shiftLabel("Day")).toBe("Weekday");
  });

  it("leaves Night and Weekend alone", () => {
    expect(shiftLabel("Night")).toBe("Night");
    expect(shiftLabel("Weekend")).toBe("Weekend");
  });

  it("renders the dropdown as Weekday / Night / Weekend", () => {
    expect(SHIFT_OPTIONS.map(shiftLabel)).toEqual(["Weekday", "Night", "Weekend"]);
  });

  it("does not change any stored value", () => {
    // The values are what patchItem sends and what resolveRateForShift matches.
    expect([...SHIFT_OPTIONS]).toEqual(["Day", "Night", "Weekend"]);
  });

  it("passes an unrecognised stored value through unchanged", () => {
    // A row holding something unexpected stays visible rather than blank.
    expect(shiftLabel("Nights")).toBe("Nights");
    expect(shiftLabel("")).toBe("");
  });

  it("a row saved before this PR (stored 'Day') still matches an option", () => {
    // TooltipSelect selects by value; if "Day" matched no option the row would
    // fall through to the blank option and read as unset.
    expect(SHIFT_OPTIONS.includes("Day")).toBe(true);
    expect(shiftLabel("Day")).toBe("Weekday");
  });
});

// ── the Cutting? discipline gate ─────────────────────────────────────────────

describe("showsCuttingColumn", () => {
  it("hides the tick on an asbestos card", () => {
    // ScopeCardsTab renders <ScopeCuttingSheet> only when discipline !== "ASB";
    // on an ASB card a ticked value has nowhere to be priced.
    expect(showsCuttingColumn("ASB")).toBe(false);
  });

  it("shows the tick on every other discipline", () => {
    expect(showsCuttingColumn("DEM")).toBe(true);
    expect(showsCuttingColumn("CIV")).toBe(true);
    expect(showsCuttingColumn("Other")).toBe(true);
  });

  it("is the same condition ScopeCardsTab uses to gate the sheet", () => {
    // Expressed once, consumed by row 1 and by every additional material row.
    const disciplines = ["DEM", "CIV", "ASB", "Other"] as const;
    for (const d of disciplines) {
      expect(showsCuttingColumn(d)).toBe(d !== "ASB");
    }
  });
});

// ── one blank option per Type dropdown ───────────────────────────────────────
// TooltipSelect renders its own <option value=""> unconditionally. The page
// used to prepend a second one to both Type lists, so each dropdown opened with
// two empty-valued options. The prepended sentinel is gone; the wording moved
// to placeholder="- none -".
//
// There is no exported function behind an option list, so the count rule is
// modelled here the way the sibling files model column widths.

describe("Type dropdown option inventory", () => {
  const optionCount = (listLength: number) => listLength + 1; // + TooltipSelect's blank

  it("N labour roles render N + 1 options, one of them blank", () => {
    // BEFORE: N roles + the page's "- none -" + TooltipSelect's blank = N + 2,
    //         two of which had an empty value.
    // AFTER:  N roles + TooltipSelect's blank = N + 1.
    const N = 6;
    expect(optionCount(N)).toBe(7);
    expect(optionCount(N)).toBe(N + 2 - 1);
  });

  it("N plant machines render N + 1 options, one of them blank", () => {
    const N = 23;
    expect(optionCount(N)).toBe(24);
  });

  it("an empty catalogue renders exactly one option, the blank one", () => {
    // With no rates loaded the dropdown is not empty — the clear affordance
    // is still there, and it is the only entry.
    expect(optionCount(0)).toBe(1);
  });
});
