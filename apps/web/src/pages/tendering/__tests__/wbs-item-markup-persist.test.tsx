// SCOPE_ITEM_MARKUP_PERSIST_V1 — unit tests for the per-item markup
// persistence layer (pr-cardpersist-s3).
//
// The web workspace follows the no-render pattern (no @testing-library, no
// jsdom), so these target the pure helpers exported from
// ScopeQuantitiesTable. As with the manpower and plant slices that is not a
// compromise: the entire risk of this slice is WHICH VALUE IS SENT for each
// thing the estimator can do to the box, and that is a pure function of what
// they typed.
//
// The authority for what the server does with that value is
// apps/api/src/modules/tendering/, merged before this slice and unchanged by
// it. Three lines carry the whole contract:
//
//   scope-item-pricing.ts — resolveEffectiveMarkup():
//     return itemMarkupOverride ?? cardMarkupOverride ?? tenderMarkup;
//                                ^^ `??`, so a stored 0 is an override
//
//   scope-of-works.service.ts listItems():
//     resolveEffectiveMarkup(item.markupOverride != null ? Number(...) : null,
//                            item.card?.markupOverride ..., tenderMarkup)
//
//   scope-of-works.service.ts updateItem() numericFieldsFrom():
//     markupOverride: dto.markupOverride !== undefined
//       ? toDecimal(narrowToNumber(dto.markupOverride)) : undefined
//                                ^^ UNDEFINED = leave alone. So the key must
//                                   always be sent, and null is the only
//                                   spelling of "clear" that survives JSON.
//
// All three are pinned below.

import { describe, it, expect } from "vitest";
import {
  itemMarkupFromItem,
  parseMarkupInput,
  isStoredMarkupOverride,
  markupPatchBody,
  effectiveMarkup,
  isMarkupOverridden,
  resolveCardMarkup
} from "../ScopeQuantitiesTable";

/** The subset of ScopeItem the markup helpers read. */
function item(markupOverride?: string | number | null) {
  return { markupOverride };
}

/**
 * The server's resolver, transcribed from scope-item-pricing.ts. Tests assert
 * against this rather than against a remembered number, so a change to the
 * real chain shows up here as a disagreement rather than as silence.
 */
function serverResolveEffectiveMarkup(
  itemOverride: number | null | undefined,
  cardOverride: number | null | undefined,
  tenderMarkup: number
): number {
  return itemOverride ?? cardOverride ?? tenderMarkup;
}

/** The server's line-total-with-markup leg, likewise transcribed. */
function serverPrice(lineTotal: number, markupPercent: number): number {
  return lineTotal * (1 + markupPercent / 100);
}

// ── The wire contract ────────────────────────────────────────────────────────
// The one test that would catch a rename on either side of the boundary.

describe("markupPatchBody (server contract)", () => {
  it("emits exactly the one key the server reads, and no others", () => {
    expect(Object.keys(markupPatchBody(22))).toStrictEqual(["markupOverride"]);
  });

  it("ALWAYS sends the key, including when the value is null", () => {
    // This is the load-bearing assertion of the slice. updateItem tests
    // `dto.markupOverride !== undefined`, so an omitted key means "leave the
    // stored value alone" — and an override could then never be cleared.
    expect(markupPatchBody(null)).toStrictEqual({ markupOverride: null });
    expect("markupOverride" in markupPatchBody(null)).toBe(true);
  });

  it("null survives JSON.stringify, which is what makes clearing reach the server", () => {
    // patchItem sends JSON.stringify(body). undefined would be DROPPED from
    // the payload entirely and arrive as an absent key; null arrives as null.
    expect(JSON.stringify(markupPatchBody(null))).toBe('{"markupOverride":null}');
    expect(JSON.stringify(markupPatchBody(0))).toBe('{"markupOverride":0}');
    expect(JSON.stringify({ markupOverride: undefined })).toBe("{}");
  });

  it("sends nothing but markup — no labourItems, no plantItems", () => {
    // A markup write that also carried the arrays could only overwrite them
    // with a staler copy. The other two writers own those columns.
    const body = markupPatchBody(15);
    expect(body).not.toHaveProperty("labourItems");
    expect(body).not.toHaveProperty("plantItems");
    expect(body).not.toHaveProperty("men");
  });

  it("never sends an empty object — the key's absence is meaningful", () => {
    for (const v of [null, 0, 22, 12.5]) {
      expect(Object.keys(markupPatchBody(v as number | null))).toHaveLength(1);
    }
  });
});

// ── parseMarkupInput — blank vs 0, the distinction the slice exists for ──────

describe("parseMarkupInput", () => {
  it("a CLEARED box is null (inherit), not 0", () => {
    // The prompt's own words: "those are different numbers and only one of
    // them is what the estimator meant". Writing 0 here would pin the row at
    // 0% margin and read as deliberate.
    expect(parseMarkupInput("")).toBeNull();
  });

  it("a whitespace-only box is also null", () => {
    expect(parseMarkupInput("   ")).toBeNull();
  });

  it("a typed 0 is 0 — a stated 0% override, NOT inherit", () => {
    expect(parseMarkupInput("0")).toBe(0);
    expect(parseMarkupInput("0")).not.toBeNull();
  });

  it("a real number passes through, decimals included", () => {
    expect(parseMarkupInput("22")).toBe(22);
    expect(parseMarkupInput("12.5")).toBe(12.5);
  });

  it("a garbled value is absence, not a guess", () => {
    // Pinning a row's margin on a typo is worse than leaving it inheriting.
    expect(parseMarkupInput("--")).toBeNull();
    expect(parseMarkupInput("abc")).toBeNull();
  });

  it("this is the OPPOSITE rule to the manpower/plant writers, on purpose", () => {
    // SCOPE_MANPOWER_PERSIST_V1 / SCOPE_PLANT_PERSIST_V1 send a blank box as a
    // real 0 because the server reads an ABSENT qty as 1 (`qty == null ? 1`):
    // there, null invents a quantity the user never typed. Here, null IS the
    // answer the user gave. Same rule underneath, different column.
    expect(parseMarkupInput("")).toBeNull(); // markup: blank -> null
    // and for contrast, the value the plant/manpower path would have sent:
    expect(parseMarkupInput("") ?? 0).toBe(0);
  });
});

// ── itemMarkupFromItem — reading the server's answer back ────────────────────

describe("itemMarkupFromItem", () => {
  it("a NULL override reads as null (inherit)", () => {
    expect(itemMarkupFromItem(item(null))).toBeNull();
  });

  it("an ABSENT key reads as null — every row written before the column existed", () => {
    expect(itemMarkupFromItem(item(undefined))).toBeNull();
    expect(itemMarkupFromItem({})).toBeNull();
  });

  it("a stored 0 reads as 0, NOT as null", () => {
    // The whole reason the parse is `??`-shaped and not `||`-shaped. A `||`
    // here would silently turn every 0% override back into "inherit" on
    // reload — the exact bug this slice is meant to end.
    expect(itemMarkupFromItem(item(0))).toBe(0);
    expect(itemMarkupFromItem(item("0"))).toBe(0);
    expect(itemMarkupFromItem(item(0))).not.toBeNull();
  });

  it("parses the Decimal(5,2) string the wire actually delivers", () => {
    // markupOverride is a Prisma Decimal; it serialises as a string.
    expect(itemMarkupFromItem(item("22"))).toBe(22);
    expect(itemMarkupFromItem(item("12.50"))).toBe(12.5);
    expect(itemMarkupFromItem(item(22))).toBe(22);
  });

  it("an unparseable value degrades to inherit rather than to a wrong number", () => {
    expect(itemMarkupFromItem(item("not-a-number"))).toBeNull();
  });
});

// ── isStoredMarkupOverride — identity, not comparison ────────────────────────

describe("isStoredMarkupOverride", () => {
  it("null is not an override", () => {
    expect(isStoredMarkupOverride(null)).toBe(false);
  });

  it("0 IS an override", () => {
    expect(isStoredMarkupOverride(0)).toBe(true);
  });

  it("an override equal to the card's markup is STILL an override", () => {
    // This is where it must disagree with isMarkupOverridden, and the
    // disagreement costs money if you get it wrong: an item deliberately
    // pinned at 22% while the card also sits at 22% must keep its own number
    // when the card later moves to 30%.
    const CARD = 22;
    expect(isStoredMarkupOverride(22)).toBe(true);
    expect(isMarkupOverridden(22, CARD)).toBe(false); // the display helper, unchanged
  });

  it("a stored 0 against a card on 0% is still an override", () => {
    expect(isStoredMarkupOverride(0)).toBe(true);
    expect(isMarkupOverridden(0, 0)).toBe(false); // unchanged, and why we needed a new helper
  });
});

// ── The inheritance chain is REUSED, not re-derived ──────────────────────────

describe("the item -> card -> tender -> 0 chain", () => {
  const TENDER = 8;

  it("the web's display chain agrees with the server's pricing chain", () => {
    // web:    effectiveMarkup(itemOverride, resolveCardMarkup(cardOverride, tender))
    // server: resolveEffectiveMarkup(item, card, tender)
    // These must produce the same percent or the cell lies about the money.
    const cases: Array<[number | null, number | null, number]> = [
      [null, null, TENDER], // inherits all the way to the tender
      [null, 12, 12], // inherits the card
      [22, 12, 22], // item override wins
      [0, 12, 0], // a stated 0 beats the card
      [null, 0, 0], // a card on a stated 0 beats the tender
      [12, 12, 12] // equal to the card, still the item's own
    ];
    for (const [itemOverride, cardOverride, expected] of cases) {
      const web = effectiveMarkup(itemOverride, resolveCardMarkup(cardOverride, TENDER));
      const server = serverResolveEffectiveMarkup(itemOverride, cardOverride, TENDER);
      expect(web).toBe(expected);
      expect(server).toBe(expected);
      expect(web).toBe(server);
    }
  });
});

// ── End to end: what the estimator does -> what the server prices ────────────

describe("blank / 0 / null / a number -> what is sent -> what is priced", () => {
  const LINE_TOTAL = 1000;
  const CARD = 20;
  const TENDER = 8;

  /** Type `raw` into the box; return the percent the server would then price at. */
  function typeAndPrice(raw: string): { sent: unknown; percent: number; total: number } {
    const parsed = parseMarkupInput(raw);
    const body = markupPatchBody(parsed);
    // The server stores exactly what was sent (toDecimal(narrowToNumber(v))),
    // then listItems reads it back through resolveEffectiveMarkup.
    const stored = body.markupOverride as number | null;
    const percent = serverResolveEffectiveMarkup(stored, CARD, TENDER);
    return { sent: stored, percent, total: serverPrice(LINE_TOTAL, percent) };
  }

  it("a real number: 22 is sent as 22 and prices at 22%", () => {
    expect(typeAndPrice("22")).toStrictEqual({ sent: 22, percent: 22, total: 1220 });
  });

  it("a typed 0: sent as 0 and prices at 0% — the card's 20% is NOT applied", () => {
    expect(typeAndPrice("0")).toStrictEqual({ sent: 0, percent: 0, total: 1000 });
  });

  it("a cleared box: sent as null and prices at the CARD's 20%", () => {
    expect(typeAndPrice("")).toStrictEqual({ sent: null, percent: 20, total: 1200 });
  });

  it("clearing returns the row to INHERITING, not to 0%", () => {
    // The verification checklist asks this one explicitly.
    const cleared = typeAndPrice("");
    expect(cleared.sent).toBeNull();
    expect(cleared.percent).toBe(CARD);
    expect(cleared.percent).not.toBe(0);
  });

  it("with no card override, a cleared box falls through to the TENDER", () => {
    const percent = serverResolveEffectiveMarkup(parseMarkupInput(""), null, TENDER);
    expect(percent).toBe(TENDER);
  });
});

// ── HARD RULE 6: a NULL markupOverride prices exactly as it does today ───────

describe("an item whose markupOverride is still NULL", () => {
  const LINE_TOTAL = 1000;
  const TENDER = 8;

  it("prices identically before and after this slice — card override present", () => {
    const CARD = 20;
    // BEFORE this slice (and before CARD-API SLICE 1) the resolution was
    // literally `item.card?.markupOverride != null ? Number(card) : tender`.
    const before = CARD;
    const after = serverResolveEffectiveMarkup(itemMarkupFromItem(item(null)), CARD, TENDER);
    expect(after).toBe(before);
    expect(serverPrice(LINE_TOTAL, after)).toBe(serverPrice(LINE_TOTAL, before));
  });

  it("prices identically before and after this slice — no card override", () => {
    const before = TENDER;
    const after = serverResolveEffectiveMarkup(itemMarkupFromItem(item(null)), null, TENDER);
    expect(after).toBe(before);
    expect(serverPrice(LINE_TOTAL, after)).toBe(serverPrice(LINE_TOTAL, before));
  });

  it("an item with NO markupOverride key at all is treated the same as NULL", () => {
    // Every row written before the column existed. There is no backfill; the
    // fallback is what makes one unnecessary.
    const CARD = 20;
    expect(serverResolveEffectiveMarkup(itemMarkupFromItem({}), CARD, TENDER)).toBe(CARD);
  });

  it("renders as inheriting, with no revert control and no override paint", () => {
    const stored = itemMarkupFromItem(item(null));
    expect(isStoredMarkupOverride(stored)).toBe(false);
    expect(effectiveMarkup(stored, resolveCardMarkup(20, TENDER))).toBe(20);
  });
});

// ── The reload, which is the behaviour the slice is named for ────────────────

describe("survives a reload", () => {
  it("an override typed, sent, stored and read back is the same number", () => {
    const typed = parseMarkupInput("22");
    const sent = markupPatchBody(typed).markupOverride;
    // The server stores Decimal(5,2) and returns it as a string.
    const readBack = itemMarkupFromItem(item(sent === null ? null : String(Number(sent).toFixed(2))));
    expect(readBack).toBe(22);
    expect(isStoredMarkupOverride(readBack)).toBe(true);
  });

  it("a 0% override survives the round trip as 0, not as inherit", () => {
    const typed = parseMarkupInput("0");
    const sent = markupPatchBody(typed).markupOverride;
    const readBack = itemMarkupFromItem(item(sent === null ? null : String(Number(sent).toFixed(2))));
    expect(readBack).toBe(0);
    expect(isStoredMarkupOverride(readBack)).toBe(true);
  });

  it("a cleared override survives the round trip as inherit", () => {
    const typed = parseMarkupInput("");
    const sent = markupPatchBody(typed).markupOverride;
    expect(sent).toBeNull();
    expect(itemMarkupFromItem(item(sent as null))).toBeNull();
    expect(isStoredMarkupOverride(itemMarkupFromItem(item(sent as null)))).toBe(false);
  });
});
