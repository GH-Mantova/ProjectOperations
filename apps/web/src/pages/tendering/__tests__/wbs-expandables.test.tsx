// SCOPE_WBS_ACTIONS_V1 — unit tests for the actions column and the three
// expandables (slice 5 of scope-card-redesign).
//
// The web workspace follows the no-render pattern (no @testing-library, no
// jsdom — every existing web test is pure logic), so everything below targets
// exported helpers rather than mounted components:
//
//   openBlocksFor / toggleBlock / openBlock / NO_BLOCKS_OPEN
//                              — nothing opens by default, and what opening does
//   showsCuttingColumn / isAsbestosCard
//                              — the ONE discipline gate, asked both ways
//   measurementsFromItem / measurementCount / measurementPatchBody
//   measurementAddPatch / measurementRemovalPatch
//                              — adding and removing a measurement
//   revealOrAddPatch           — SCOPE_WBS_REVEAL_V1: revealing is not adding
//   commentCount / hasComment  — the comment tick
//   acmClassForType / acmClassLabel / acmFactCount
//                              — the derived ACM class badge
//
// THE PRICE PROOF is the last describe block and it is the reason this file
// exists. The Measurement block is a relocation: the same fields, bound to the
// same records, in a different place on screen. If one stopped reaching the
// waste aggregator because it now lives behind a disclosure, the tender price
// would move and nothing on screen would say so. So the card is priced BEFORE
// and AFTER a full round trip through the relocated shape and the two figures
// are asserted equal. Both are stated in the PR body.

import { describe, expect, it } from "vitest";
import {
  NO_BLOCKS_OPEN,
  WBS_COLUMN_COUNT,
  isAsbestosCard,
  openBlock,
  openBlocksFor,
  hasOpenBlock,
  revealOrAddPatch,
  showsCuttingColumn,
  toggleBlock,
  type Discipline,
  type ItemOpenBlocks,
  type ScopeItem,
  type ScopeMaterialEntry
} from "../ScopeQuantitiesTable";
import {
  blankMeasurement,
  densityDivisorForUnit,
  isSheetUnit,
  storedDensityForMaterial,
  isBlankMeasurement,
  measurementAddPatch,
  measurementCount,
  measurementPatchBody,
  measurementRemovalPatch,
  measurementsFromItem,
  type WbsMeasurement
} from "../scope-cards/WbsMeasurementBlock";
import { WBS_COMMENT_PLACEHOLDER, commentCount, hasComment } from "../scope-cards/WbsCommentBlock";
import {
  ACM_TYPE_BONDED,
  ACM_TYPE_FRIABLE,
  acmClassForType,
  acmClassLabel,
  acmFactCount,
  acmMaterialOptions
} from "../scope-cards/WbsAcmBlock";
import { computeCardBarStats } from "../scope-cards/DisciplineSummaryBar";
import { computeDerivedDimensions } from "../scopeItemDimensions";

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ScopeItem> = {}): ScopeItem {
  return {
    id: "item-1",
    tenderId: "tender-1",
    cardId: "card-1",
    wbsCode: "1.1",
    itemNumber: 1,
    description: "Strip out",
    status: "draft",
    aiProposed: false,
    aiConfidence: null,
    sortOrder: 0,
    notes: null,
    men: null,
    days: null,
    unit: null,
    value: null,
    wasteGroup: null,
    wasteItem: null,
    wasteIncluded: false,
    length: null,
    height: null,
    depth: null,
    sqm: null,
    m3: null,
    density: null,
    tonnes: null,
    chargeBy: null,
    materialType: null,
    cuttingIncluded: false,
    plantItems: null,
    estimateItemId: null,
    provisionalAmount: null,
    ...overrides
  };
}

// ── Nothing opens by default ─────────────────────────────────────────────
// The premise of the slice: a card of ten items used to paint ninety empty
// measurement boxes and ten open note textareas. An item with nothing in it
// must now show its action buttons and NO boxes — and so must an item with
// plenty in it, until the estimator asks.

describe("expandable blocks — nothing opens by default", () => {
  it("an item the map has never heard of has every block closed", () => {
    const map: ItemOpenBlocks = new Map();
    expect(openBlocksFor(map, "item-1")).toEqual({
      measurement: false,
      comment: false,
      acm: false
    });
  });

  it("an item that is FULL of data still has every block closed", () => {
    // The dangerous near-miss: auto-opening a block because the item has
    // something in it would put every box back on screen and undo the slice.
    const measured = makeItem({
      length: "10",
      height: "2",
      tonnes: "24",
      wasteIncluded: true,
      notes: "Watch the live services",
      acmType: ACM_TYPE_FRIABLE,
      materials: [{ material: "Brick", tonnes: 6 }]
    });
    expect(openBlocksFor(new Map(), measured.id)).toEqual(NO_BLOCKS_OPEN);
    expect(hasOpenBlock(openBlocksFor(new Map(), measured.id))).toBe(false);
  });

  it("the default is frozen, so a caller cannot make it lie", () => {
    expect(Object.isFrozen(NO_BLOCKS_OPEN)).toBe(true);
  });

  it("hasOpenBlock is false for the default and true once anything opens", () => {
    expect(hasOpenBlock(NO_BLOCKS_OPEN)).toBe(false);
    expect(hasOpenBlock({ measurement: true, comment: false, acm: false })).toBe(true);
    expect(hasOpenBlock({ measurement: false, comment: true, acm: false })).toBe(true);
    expect(hasOpenBlock({ measurement: false, comment: false, acm: true })).toBe(true);
  });

  it("toggling one block of one item leaves every other block and item shut", () => {
    const opened = toggleBlock(new Map(), "item-1", "measurement");
    expect(openBlocksFor(opened, "item-1")).toEqual({
      measurement: true,
      comment: false,
      acm: false
    });
    expect(openBlocksFor(opened, "item-2")).toEqual(NO_BLOCKS_OPEN);
  });

  it("toggling twice closes it again", () => {
    const once = toggleBlock(new Map(), "item-1", "comment");
    const twice = toggleBlock(once, "item-1", "comment");
    expect(openBlocksFor(twice, "item-1").comment).toBe(false);
  });

  it("openBlock opens without closing, and is a no-op when already open", () => {
    const once = openBlock(new Map(), "item-1", "acm");
    expect(openBlocksFor(once, "item-1").acm).toBe(true);
    // Same reference back: an add on an already-open block must not re-render
    // the whole table for nothing.
    expect(openBlock(once, "item-1", "acm")).toBe(once);
  });

  it("does not mutate the map it was given", () => {
    const original: ItemOpenBlocks = new Map();
    toggleBlock(original, "item-1", "measurement");
    openBlock(original, "item-1", "comment");
    expect(original.size).toBe(0);
  });
});

// ── The Cutting? column gate ─────────────────────────────────────────────
// There is NO per-discipline capability flag in the ERP: Discipline is a
// four-value string union with no fields on it. showsCuttingColumn is the one
// source of truth for "this card can cut", and isAsbestosCard is its sibling
// for the two asbestos-only pieces this slice adds. Nothing else anywhere
// states a discipline code, which is what these tests pin.

const ALL_DISCIPLINES: Discipline[] = ["DEM", "CIV", "ASB", "Other"];

describe("the Cutting? column and the ACM block read one discipline gate", () => {
  it("the Cutting? column is absent on an asbestos card", () => {
    expect(showsCuttingColumn("ASB")).toBe(false);
  });

  it("the Cutting? column is present on a demolition card", () => {
    expect(showsCuttingColumn("DEM")).toBe(true);
  });

  it("is present on every non-asbestos discipline", () => {
    expect(showsCuttingColumn("CIV")).toBe(true);
    expect(showsCuttingColumn("Other")).toBe(true);
  });

  it("isAsbestosCard gates the ACM block and the enclosure / monitoring button", () => {
    expect(isAsbestosCard("ASB")).toBe(true);
    expect(isAsbestosCard("DEM")).toBe(false);
    expect(isAsbestosCard("CIV")).toBe(false);
    expect(isAsbestosCard("Other")).toBe(false);
  });

  it("the two are exact complements over every discipline", () => {
    // If a fifth discipline is ever added, this is the test that says where to
    // go: these two functions, not a scattered literal.
    for (const d of ALL_DISCIPLINES) {
      expect(showsCuttingColumn(d)).toBe(!isAsbestosCard(d));
    }
  });
});

// ── The rate-card density units ──────────────────────────────────────────
//
// SCOPE_WBS_ACTIONS_V1 — this slice lifted the unit rule out of the two
// TooltipSelect onChange bodies it was inlined in and into
// densityDivisorForUnit / isSheetUnit / storedDensityForMaterial. These are
// the behavioural replacement for the source-TEXT guard that used to grep
// ScopeQuantitiesTable.tsx for the literals — see
// __tests__/scopeItemDensityUnits.test.ts, whose own docstring prescribed
// exactly this exchange.
//
// The load-bearing cases are the ASCII ones. The original incident
// (SCOPE_WBS_TABLE_V1) flattened "kg/m³" to "kg/m3" during a rewrite: it
// compiled, every unit test passed, and a 10 m³ concrete item reported
// 24,000 t instead of 24. Asserting the ASCII forms DO NOT match reproduces
// that bug as a failing test rather than as a string search that the next
// relocation breaks.

describe("rate-card density units", () => {
  it("divides a kg/m³ density by 1000 to reach the stored t/m³", () => {
    expect(densityDivisorForUnit("kg/m³")).toBe(1000);
  });

  it("does NOT match the ASCII-flattened kg/m3 — the 24,000 t bug", () => {
    // If a rewrite flattens the superscript, the comparison stops matching the
    // value the API actually sends, the ÷1000 silently stops happening and
    // tonnage is overstated 1000x. This is that bug, as an assertion.
    expect(densityDivisorForUnit("kg/m3")).toBe(1);
    expect(storedDensityForMaterial({ density: "2400", unit: "kg/m3" })).toBe(2400);
  });

  it("does NOT match the ASCII-flattened kg/m2 either", () => {
    expect(isSheetUnit("kg/m2")).toBe(false);
    expect(densityDivisorForUnit("kg/m2")).toBe(1);
  });

  it("stores a kg/m² sheet density AS IS, because the ÷1000 happens downstream", () => {
    // computeDerivedDimensions' sqm fallback is `(sqm × density) / 1000`.
    // Dividing here as well would divide twice and under-report every sheet
    // material's tonnage by a factor of 1000.
    expect(densityDivisorForUnit("kg/m²")).toBe(1);
    expect(isSheetUnit("kg/m²")).toBe(true);
    expect(storedDensityForMaterial({ density: "14.5", unit: "kg/m²" })).toBe(14.5);
  });

  it("proves the sheet rule against the real derivation, end to end", () => {
    // 20 m² of a 14.5 kg/m² sheet is 0.29 t. Stored as-is it derives correctly;
    // pre-divided by 1000 it would derive 0.00029 t and the waste line would be
    // priced at nothing.
    const stored = storedDensityForMaterial({ density: "14.5", unit: "kg/m²" });
    expect(computeDerivedDimensions({ sqm: 20, density: stored, depth: null }).tonnes).toBe(0.29);
    const doubleDivided = 14.5 / 1000;
    expect(
      computeDerivedDimensions({ sqm: 20, density: doubleDivided, depth: null }).tonnes
    ).not.toBe(0.29);
  });

  it("proves the volume rule against the real derivation, end to end", () => {
    // The incident, priced: 10 m³ of concrete seeded at 2400 kg/m³ is 24 t.
    const stored = storedDensityForMaterial({ density: "2400", unit: "kg/m³" });
    expect(stored).toBe(2.4);
    expect(computeDerivedDimensions({ m3: 10, density: stored }).tonnes).toBe(24);
    // What the flattened comparison produced.
    expect(computeDerivedDimensions({ m3: 10, density: 2400 }).tonnes).toBe(24000);
  });

  it("leaves an unseeded unit alone", () => {
    expect(densityDivisorForUnit("t/m³")).toBe(1);
    expect(densityDivisorForUnit("each")).toBe(1);
    expect(densityDivisorForUnit(null)).toBe(1);
    expect(densityDivisorForUnit(undefined)).toBe(1);
    expect(isSheetUnit(null)).toBe(false);
    expect(isSheetUnit(undefined)).toBe(false);
  });

  it("has no density at all when no material is picked", () => {
    expect(storedDensityForMaterial(null)).toBeNull();
    expect(storedDensityForMaterial(undefined)).toBeNull();
  });
});

// ── Reading an item's measurements ───────────────────────────────────────

describe("measurementsFromItem", () => {
  it("always yields the item's own measurement first, at index 0", () => {
    const item = makeItem({ length: "10", height: "2", tonnes: "24" });
    const rows = measurementsFromItem(item);
    expect(rows[0].index).toBe(0);
    expect(rows[0].length).toBe(10);
    expect(rows[0].tonnes).toBe(24);
  });

  it("yields materials[] as measurements 1..N in stored order", () => {
    const item = makeItem({
      materials: [
        { material: "Brick", tonnes: 6 },
        { material: "Steel", tonnes: 3.5 }
      ]
    });
    const rows = measurementsFromItem(item);
    expect(rows).toHaveLength(3);
    expect(rows[1].material).toBe("Brick");
    expect(rows[2].material).toBe("Steel");
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("does NOT re-derive a stored null tonnes from the dimensions", () => {
    // The waste aggregator reads what is STORED. Deriving on read would invent
    // tonnage the server never held and would price it.
    const item = makeItem({ length: "10", height: "2", depth: "0.5", density: "2.4" });
    expect(measurementsFromItem(item)[0].tonnes).toBeNull();
  });

  it("treats a non-array materials value as no extra measurements", () => {
    expect(measurementsFromItem(makeItem({ materials: null }))).toHaveLength(1);
    expect(measurementsFromItem(makeItem({ materials: undefined }))).toHaveLength(1);
  });
});

describe("measurementCount — the actions-column badge", () => {
  it("is 0 for an item nobody has measured", () => {
    // The primary measurement is a set of nullable COLUMNS, always addressable
    // — so "has this item got a measurement" cannot be answered by counting
    // rows, and a bare item must not show a tick.
    expect(measurementCount(makeItem())).toBe(0);
  });

  it("counts the item's own measurement once anything is on it", () => {
    expect(measurementCount(makeItem({ tonnes: "24" }))).toBe(1);
    expect(measurementCount(makeItem({ wasteIncluded: true }))).toBe(1);
    expect(measurementCount(makeItem({ materialType: "Concrete" }))).toBe(1);
  });

  it("counts extras alongside it", () => {
    const item = makeItem({
      tonnes: "24",
      materials: [{ material: "Brick", tonnes: 6 }, { tonnes: 3.5 }]
    });
    expect(measurementCount(item)).toBe(3);
  });

  it("does not count a blank appended slot", () => {
    const item = makeItem({ tonnes: "24", materials: [{}] });
    expect(measurementCount(item)).toBe(1);
  });

  it("isBlankMeasurement agrees with a freshly-made blank", () => {
    expect(isBlankMeasurement(blankMeasurement(0))).toBe(true);
    expect(isBlankMeasurement({ ...blankMeasurement(1), tonnes: 0.01 })).toBe(false);
    expect(isBlankMeasurement({ ...blankMeasurement(1), cuttingIncluded: true })).toBe(false);
  });
});

// ── Adding a measurement ─────────────────────────────────────────────────

describe("+ Add measurement", () => {
  it("writes nothing on an unmeasured item — it just opens onto the empty slot", () => {
    expect(measurementAddPatch(makeItem())).toBeNull();
  });

  it("writes nothing while a blank extra is already waiting", () => {
    const item = makeItem({ tonnes: "24", materials: [{}] });
    expect(measurementAddPatch(item)).toBeNull();
  });

  it("appends a blank extra once every measurement carries something", () => {
    const item = makeItem({ tonnes: "24", wasteGroup: "Concrete", wasteItem: "Clean concrete" });
    const patch = measurementAddPatch(item);
    expect(patch).not.toBeNull();
    const materials = patch?.materials as ScopeMaterialEntry[];
    expect(materials).toHaveLength(1);
    expect(materials[0].tonnes).toBeNull();
  });

  it("leaves the item's own measurement untouched when it appends", () => {
    const item = makeItem({ tonnes: "24", wasteGroup: "Concrete", wasteItem: "Clean concrete" });
    const patch = measurementAddPatch(item) as Record<string, unknown>;
    expect(patch.tonnes).toBe(24);
    expect(patch.wasteGroup).toBe("Concrete");
    expect(patch.wasteItem).toBe("Clean concrete");
  });

  it("appends a second extra to an item that already has one", () => {
    const item = makeItem({ tonnes: "24", materials: [{ material: "Brick", tonnes: 6 }] });
    const patch = measurementAddPatch(item) as Record<string, unknown>;
    expect(patch.materials).toHaveLength(2);
  });
});

// ── SCOPE_WBS_REVEAL_V1 — revealing is not adding ────────────────────────
// The defect these cases close: the Measurement block starts shut for every
// item and `+ Add measurement` is its only opener, so LOOKING at the three
// measurements the button's own tick advertises meant appending a blank
// fourth one and PATCHing it. Reading wrote. Every case below therefore
// asserts on the PATCH — that the request was never made — and not merely
// that the block ended up open, because a fix that opened the block and still
// wrote would pass the weaker assertion and change the estimator's data.

/**
 * One click on `+ Add measurement`, exactly as ScopeQuantitiesTable's
 * revealOrAddBlock performs it: ask revealOrAddPatch what to write, send
 * whatever comes back, reveal either way. `patches` stands in for the
 * `void patchItem(item.id, patch)` call — an empty array is "no PATCH was
 * issued", which is the whole point of the rule.
 */
function clickAddMeasurement(map: ItemOpenBlocks, item: ScopeItem) {
  const patches: Array<Record<string, unknown>> = [];
  const patch = revealOrAddPatch(openBlocksFor(map, item.id), "measurement", () =>
    measurementAddPatch(item)
  );
  if (patch) patches.push(patch);
  return { blocks: openBlock(map, item.id, "measurement"), patches };
}

describe("SCOPE_WBS_REVEAL_V1 — a shut block reveals, an open one adds", () => {
  it("shut + already measured: the click reveals and issues NO PATCH", () => {
    // The broken case. Three real measurements, block shut, estimator wants
    // to read them.
    const item = makeItem({
      tonnes: "24",
      materials: [{ material: "Brick", tonnes: 6 }, { material: "Timber", tonnes: 3.5 }]
    });
    expect(measurementCount(item)).toBe(3);

    const before = structuredClone(item);
    const { blocks, patches } = clickAddMeasurement(new Map(), item);

    expect(patches).toEqual([]);
    expect(openBlocksFor(blocks, item.id).measurement).toBe(true);
    // Nothing was written, so nothing about the item can have moved — not the
    // measurements, and not the waste/cutting flags the price reads.
    expect(item).toEqual(before);
  });

  it("shut + unmeasured: the click reveals and issues no PATCH (unchanged)", () => {
    // Already true before the fix, via measurementAddPatch's own null — the
    // item's flat columns are an addressable empty slot. It stays true, and
    // for a second reason now.
    const item = makeItem();
    const { blocks, patches } = clickAddMeasurement(new Map(), item);

    expect(patches).toEqual([]);
    expect(openBlocksFor(blocks, item.id).measurement).toBe(true);
  });

  it("open + already measured: the click appends and DOES issue a PATCH", () => {
    // The only state in which "add" is what the estimator means: the block is
    // in front of them, so they can see what they are adding to.
    const item = makeItem({ tonnes: "24", materials: [{ material: "Brick", tonnes: 6 }] });
    const open = openBlock(new Map(), item.id, "measurement");

    const { blocks, patches } = clickAddMeasurement(open, item);

    expect(patches).toHaveLength(1);
    expect(patches[0].materials).toHaveLength(2);
    // ...and the item's own measurement rides through the whole-list write
    // untouched, exactly as it did before the rule existed.
    expect(patches[0].tonnes).toBe(24);
    expect(openBlocksFor(blocks, item.id).measurement).toBe(true);
  });

  it("open + a blank slot already waiting: still no PATCH", () => {
    // measurementAddPatch's null survives the new rule. An open block with an
    // empty row on screen does not need a second empty row.
    const item = makeItem({ tonnes: "24", materials: [{}] });
    const open = openBlock(new Map(), item.id, "measurement");

    expect(clickAddMeasurement(open, item).patches).toEqual([]);
  });

  it("a reveal does not change the count on the button", () => {
    // The tick and the count are what tell the estimator the item is worth
    // opening. Opening it must not restate them.
    const item = makeItem({
      tonnes: "24",
      materials: [{ material: "Brick", tonnes: 6 }, { material: "Timber", tonnes: 3.5 }]
    });
    const countBefore = measurementCount(item);

    const { patches } = clickAddMeasurement(new Map(), item);

    expect(patches).toEqual([]);
    expect(measurementCount(item)).toBe(countBefore);
    expect(measurementCount(item)).toBe(3);
  });

  it("the Comment and ACM buttons write nothing in either state", () => {
    // They pass no addPatch at all, so the seam they share with the
    // Measurement button can never make them write.
    for (const key of ["comment", "acm"] as const) {
      expect(revealOrAddPatch(NO_BLOCKS_OPEN, key)).toBeNull();
      expect(revealOrAddPatch({ ...NO_BLOCKS_OPEN, [key]: true }, key)).toBeNull();
    }
  });
});

// ── Removing a measurement ───────────────────────────────────────────────

describe("removing a measurement", () => {
  const threeUp = () =>
    makeItem({
      materialType: "Concrete",
      tonnes: "24",
      wasteGroup: "Concrete",
      wasteItem: "Clean concrete",
      wasteIncluded: true,
      materials: [
        { material: "Brick", tonnes: 6, wasteGroup: "Brick", wasteItem: "Mixed brick", wasteIncluded: true },
        { material: "Steel", tonnes: 3.5, wasteGroup: "Metals", wasteItem: "Steel", wasteIncluded: true }
      ]
    });

  it("drops an extra and leaves the item's own measurement alone", () => {
    const patch = measurementRemovalPatch(threeUp(), 1);
    expect(patch.materialType).toBe("Concrete");
    expect(patch.tonnes).toBe(24);
    const materials = patch.materials as ScopeMaterialEntry[];
    expect(materials).toHaveLength(1);
    expect(materials[0].material).toBe("Steel");
  });

  it("PROMOTES the next measurement when the item's own one is removed", () => {
    // The primary lives on the flat columns, so removing it cannot be a splice
    // of `materials` — the flat columns would keep holding a measurement the
    // estimator just deleted.
    const patch = measurementRemovalPatch(threeUp(), 0);
    expect(patch.materialType).toBe("Brick");
    expect(patch.tonnes).toBe(6);
    expect(patch.wasteGroup).toBe("Brick");
    expect(patch.wasteItem).toBe("Mixed brick");
    expect(patch.wasteIncluded).toBe(true);
    const materials = patch.materials as ScopeMaterialEntry[];
    expect(materials).toHaveLength(1);
    expect(materials[0].material).toBe("Steel");
  });

  it("clears the flat columns when the last measurement goes", () => {
    const item = makeItem({ materialType: "Concrete", tonnes: "24", wasteIncluded: true });
    const patch = measurementRemovalPatch(item, 0);
    expect(patch.materialType).toBeNull();
    expect(patch.tonnes).toBeNull();
    expect(patch.wasteIncluded).toBe(false);
    expect(patch.materials).toEqual([]);
  });

  it("writes every flat key, nulls included, so nothing stale survives", () => {
    // updateItem persists exactly what the DTO carries. A key omitted here
    // would leave the old value behind — on a removal, the difference between
    // deleting a measurement and duplicating it into its replacement.
    const patch = measurementRemovalPatch(threeUp(), 0);
    for (const key of [
      "materialType",
      "materialKind",
      "quantity",
      "factor",
      "length",
      "height",
      "depth",
      "density",
      "sqm",
      "m3",
      "tonnes",
      "wasteGroup",
      "wasteItem",
      "wasteIncluded",
      "cuttingIncluded",
      "materials"
    ]) {
      expect(Object.prototype.hasOwnProperty.call(patch, key)).toBe(true);
    }
  });

  it("changes nothing for an index that is not there", () => {
    const before = measurementsFromItem(threeUp());
    const patch = measurementRemovalPatch(threeUp(), 9);
    expect(patch.tonnes).toBe(before[0].tonnes);
    expect(patch.materials).toHaveLength(2);
  });
});

// ── The comment block ────────────────────────────────────────────────────

describe("the comment block", () => {
  it("shows no tick for an item with no note", () => {
    expect(hasComment(makeItem())).toBe(false);
    expect(commentCount(makeItem())).toBe(0);
  });

  it("shows no tick for a note that is only whitespace", () => {
    expect(hasComment(makeItem({ notes: "   \n " }))).toBe(false);
    expect(commentCount(makeItem({ notes: "" }))).toBe(0);
  });

  it("shows a tick and a count of one for a real note", () => {
    expect(hasComment(makeItem({ notes: "Watch the live services" }))).toBe(true);
    expect(commentCount(makeItem({ notes: "Watch the live services" }))).toBe(1);
  });

  it("carries the mock-up's placeholder about the summary, quote and handover", () => {
    expect(WBS_COMMENT_PLACEHOLDER).toMatch(/card summary/i);
    expect(WBS_COMMENT_PLACEHOLDER).toMatch(/quote/i);
    expect(WBS_COMMENT_PLACEHOLDER).toMatch(/handover/i);
  });
});

// ── The ACM class badge ──────────────────────────────────────────────────
// Derived from the type, never independently settable. Class is a legal
// consequence of friability: an ERP that let the two disagree would state on a
// quote that friable ACM is coming out under Class B controls.

describe("the ACM class badge is derived from the ACM type", () => {
  it("Friable reads Class A", () => {
    expect(acmClassForType(ACM_TYPE_FRIABLE)).toBe("A");
    expect(acmClassLabel(acmClassForType(ACM_TYPE_FRIABLE))).toBe("Class A");
  });

  it("Non-friable reads Class B", () => {
    expect(acmClassForType(ACM_TYPE_BONDED)).toBe("B");
    expect(acmClassLabel(acmClassForType(ACM_TYPE_BONDED))).toBe("Class B");
  });

  it("reads the same class however the survey spelled it", () => {
    // "bonded" is what the database holds; "Non-friable" is what the register
    // and every survey PDF say. Both are the same statement about the material.
    expect(acmClassForType("Friable")).toBe("A");
    expect(acmClassForType("  FRIABLE  ")).toBe("A");
    expect(acmClassForType("Non-friable")).toBe("B");
    expect(acmClassForType("non friable")).toBe("B");
    expect(acmClassForType("non_friable")).toBe("B");
    expect(acmClassForType("Bonded")).toBe("B");
  });

  it("has no class at all until a type is set", () => {
    expect(acmClassForType(null)).toBeNull();
    expect(acmClassForType(undefined)).toBeNull();
    expect(acmClassForType("")).toBeNull();
    expect(acmClassLabel(null)).toBe("—");
  });

  it("refuses to guess a class for an unrecognised type", () => {
    expect(acmClassForType("Chrysotile")).toBeNull();
    expect(acmClassForType("probably fine")).toBeNull();
  });

  it("follows the type when the type changes, with no stored class to disagree", () => {
    // There is deliberately no setter and no column: the badge is a function of
    // acmType and nothing else, so it cannot drift away from it.
    const friable = makeItem({ acmType: ACM_TYPE_FRIABLE });
    const flipped = { ...friable, acmType: ACM_TYPE_BONDED };
    expect(acmClassForType(friable.acmType)).toBe("A");
    expect(acmClassForType(flipped.acmType)).toBe("B");
  });

  it("counts the ACM facts an item carries for the actions-column badge", () => {
    expect(acmFactCount(makeItem())).toBe(0);
    expect(acmFactCount(makeItem({ enclosureRequired: false, airMonitoring: false }))).toBe(0);
    expect(acmFactCount(makeItem({ acmType: ACM_TYPE_FRIABLE }))).toBe(1);
    expect(
      acmFactCount(
        makeItem({
          acmType: ACM_TYPE_FRIABLE,
          acmMaterial: "pipe_insulation",
          enclosureRequired: true,
          airMonitoring: true
        })
      )
    ).toBe(4);
  });

  it("keeps an unlisted stored material selectable rather than blanking it", () => {
    const listed = acmMaterialOptions("vinyl_tile");
    expect(listed.some((o) => o.value === "vinyl_tile")).toBe(true);
    const unlisted = acmMaterialOptions("asbestos_rope_from_1974");
    expect(unlisted.some((o) => o.value === "asbestos_rope_from_1974")).toBe(true);
    expect(unlisted).toHaveLength(listed.length + 1);
  });
});

// ── Table geometry ───────────────────────────────────────────────────────

describe("the actions column does not move the money columns", () => {
  it("spans the full 16-column row when a block is open", () => {
    // WBS 1 + Description 1 + Manpower 6 + Plant 5 + Markup 1 + Item total 1
    // + Actions 1. A short colSpan leaves a gap the blocks fall out of; a long
    // one adds a phantom column, which is what would push the money columns.
    expect(WBS_COLUMN_COUNT).toBe(1 + 1 + 6 + 5 + 1 + 1 + 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// THE PRICE PROOF
// ══════════════════════════════════════════════════════════════════════════
//
// A card of three measurements across two items is priced twice: once as the
// items stand, and once after every measurement has been round-tripped through
// the relocated shape (item -> measurement list -> patch body -> item). The
// two figures must be identical to the cent.
//
// The card's tender total is the sum of two legs, and BOTH have to be in it:
//
//   1. The item money. computeCardBarStats(items).subtotalWithMarkup — the
//      repo's own helper, the same figure the table footer and the discipline
//      summary bar show. Labour, plant and markup; the server computes it.
//
//   2. The waste money. THIS is the leg the relocation could break, and the
//      reason asserting only leg 1 would prove nothing: measurements do not
//      price into the item total at all, they price into the auto-summed waste
//      rows. wasteChargeForCard below mirrors aggregateFromScopeItems in
//      apps/api/src/modules/tendering/scope-waste.service.ts exactly — group
//      the item's flat columns and each materials[] entry by (wasteGroup,
//      wasteItem) where wasteIncluded is true, skip a group that has neither
//      tonnes nor m³, bill on the RATE's unit (m³ takes m3, anything else
//      takes tonnes), and round to cents. A measurement that stopped reaching
//      the aggregator loses its whole group and the figure drops.

type WasteRateRow = { wasteGroup: string; wasteType: string; unit: string; tonRate: number };

function wasteChargeForCard(items: ScopeItem[], rates: WasteRateRow[]): number {
  const totals = new Map<string, { wasteGroup: string; wasteType: string; tonnes: number; m3: number }>();
  const add = (wasteGroup: string, wasteItem: string, tonnes: number, m3: number) => {
    if (!(tonnes > 0) && !(m3 > 0)) return;
    const key = `${wasteGroup} ${wasteItem}`;
    const existing = totals.get(key);
    if (existing) {
      existing.tonnes += tonnes;
      existing.m3 += m3;
    } else {
      totals.set(key, { wasteGroup, wasteType: wasteItem, tonnes, m3 });
    }
  };
  for (const i of items) {
    if (i.status === "excluded") continue;
    // Measurement 1 — the item's flat waste columns and flat tonnes/m3.
    if (i.wasteIncluded && i.wasteGroup && i.wasteItem) {
      add(i.wasteGroup, i.wasteItem, i.tonnes == null ? 0 : Number(i.tonnes), i.m3 == null ? 0 : Number(i.m3));
    }
    // Measurements 2..N — each entry carries its own waste classification.
    for (const m of Array.isArray(i.materials) ? i.materials : []) {
      if (m?.wasteIncluded !== true) continue;
      const wg = typeof m.wasteGroup === "string" ? m.wasteGroup : null;
      const wi = typeof m.wasteItem === "string" ? m.wasteItem : null;
      if (!wg || !wi) continue;
      const mt = Number(m.tonnes);
      const mm = Number(m.m3);
      add(wg, wi, Number.isFinite(mt) && mt > 0 ? mt : 0, Number.isFinite(mm) && mm > 0 ? mm : 0);
    }
  }
  let sum = 0;
  for (const g of totals.values()) {
    const rate = rates.find((r) => r.wasteGroup === g.wasteGroup && r.wasteType === g.wasteType);
    if (!rate) continue;
    const qty = rate.unit === "m³" ? g.m3 : g.tonnes;
    sum += Math.round(qty * rate.tonRate * 100) / 100;
  }
  return Math.round(sum * 100) / 100;
}

function cardTenderTotal(items: ScopeItem[], rates: WasteRateRow[]): number {
  const itemMoney = computeCardBarStats(items).subtotalWithMarkup;
  return Math.round((itemMoney + wasteChargeForCard(items, rates)) * 100) / 100;
}

/**
 * Round-trip one item through the relocated shape.
 *
 * measurementsFromItem() is what the block RENDERS from; measurementPatchBody()
 * is what it WRITES. Feeding one straight into the other, with nothing edited
 * in between, is exactly what happens on screen when an estimator opens the
 * block, removes nothing and adds nothing — and it is the strongest available
 * statement that the relocation is lossless.
 *
 * The Decimal columns come back off the wire as strings, so the numbers the
 * patch carries are re-stringified here rather than written back as numbers:
 * that is the real shape the next listItems() response has, and comparing
 * against a shape the server never produces would prove the wrong thing.
 */
function relocate(item: ScopeItem): ScopeItem {
  const patch = measurementPatchBody(measurementsFromItem(item)) as {
    materialType: string | null;
    materialKind: ScopeItem["materialKind"];
    quantity: number | null;
    factor: number | null;
    length: number | null;
    height: number | null;
    depth: number | null;
    density: number | null;
    sqm: number | null;
    m3: number | null;
    tonnes: number | null;
    wasteGroup: string | null;
    wasteItem: string | null;
    wasteIncluded: boolean;
    cuttingIncluded: boolean;
    materials: ScopeMaterialEntry[];
  };
  const asStored = (n: number | null) => (n == null ? null : String(n));
  return {
    ...item,
    materialType: patch.materialType,
    materialKind: patch.materialKind,
    quantity: asStored(patch.quantity),
    factor: asStored(patch.factor),
    length: asStored(patch.length),
    height: asStored(patch.height),
    depth: asStored(patch.depth),
    density: asStored(patch.density),
    sqm: asStored(patch.sqm),
    m3: asStored(patch.m3),
    tonnes: asStored(patch.tonnes),
    wasteGroup: patch.wasteGroup,
    wasteItem: patch.wasteItem,
    wasteIncluded: patch.wasteIncluded,
    cuttingIncluded: patch.cuttingIncluded,
    materials: patch.materials
  };
}

// ── The card: 3 measurements across 2 items ──────────────────────────────
//
//   1.1  Slab and brickwork removal   lineTotal 8,000  (+30% -> 10,400)
//        measurement 1  Concrete  24 t   -> Concrete / Clean concrete  @ $95/t
//        measurement 2  Brick      3 m³  -> Brick / Mixed brick        @ $40/m³
//   1.2  Structural steel strip       lineTotal 4,500  (+30% ->  5,850)
//        measurement 3  Steel    3.5 t   -> Metals / Steel             @ $210/t

const WASTE_RATES: WasteRateRow[] = [
  { wasteGroup: "Concrete", wasteType: "Clean concrete", unit: "t", tonRate: 95 },
  // Billed on VOLUME — the rate's own unit decides the side, so this exercises
  // the m³ branch of the aggregator as well as the tonnes one.
  { wasteGroup: "Brick", wasteType: "Mixed brick", unit: "m³", tonRate: 40 },
  { wasteGroup: "Metals", wasteType: "Steel", unit: "t", tonRate: 210 }
];

function cardWithThreeMeasurements(): ScopeItem[] {
  return [
    makeItem({
      id: "item-a",
      wbsCode: "1.1",
      itemNumber: 1,
      description: "Slab and brickwork removal",
      materialType: "Concrete",
      materialKind: "VOLUME",
      length: "10",
      height: "2",
      depth: "0.5",
      density: "2.4",
      sqm: "20",
      m3: "10",
      tonnes: "24",
      wasteGroup: "Concrete",
      wasteItem: "Clean concrete",
      wasteIncluded: true,
      cuttingIncluded: true,
      materials: [
        {
          material: "Brick",
          kind: "VOLUME",
          length: 6,
          height: 2.5,
          depth: 0.2,
          density: 1.8,
          sqm: 15,
          m3: 3,
          tonnes: 5.4,
          wasteGroup: "Brick",
          wasteItem: "Mixed brick",
          wasteIncluded: true,
          cuttingIncluded: false
        }
      ],
      lineTotal: 8000,
      lineTotalWithMarkup: 10400
    }),
    makeItem({
      id: "item-b",
      wbsCode: "1.2",
      itemNumber: 2,
      description: "Structural steel strip",
      materialType: "Steel",
      materialKind: "VOLUME",
      length: "5",
      height: "1",
      depth: "0.05",
      density: "14",
      sqm: "5",
      m3: "0.25",
      tonnes: "3.5",
      wasteGroup: "Metals",
      wasteItem: "Steel",
      wasteIncluded: true,
      cuttingIncluded: true,
      lineTotal: 4500,
      lineTotalWithMarkup: 5850
    })
  ];
}

describe("PRICE PROOF — relocating the measurements changes no money", () => {
  it("prices the card to the same figure before and after the relocation", () => {
    const before = cardWithThreeMeasurements();
    const after = before.map(relocate);

    const priceBefore = cardTenderTotal(before, WASTE_RATES);
    const priceAfter = cardTenderTotal(after, WASTE_RATES);

    // Items 10,400 + 5,850 = 16,250.
    // Waste  24 t x $95 = 2,280 · 3 m³ x $40 = 120 · 3.5 t x $210 = 735 = 3,135.
    // Card tender total = 19,385.00, both sides.
    expect(priceBefore).toBe(19385);
    expect(priceAfter).toBe(19385);
    expect(priceAfter).toBe(priceBefore);
  });

  it("is a card of three measurements across two items", () => {
    // Guards the guard: if the fixture ever shrinks below the three
    // measurements the slice must be proven against, this fails first.
    const items = cardWithThreeMeasurements();
    expect(items).toHaveLength(2);
    expect(items.reduce((n, i) => n + measurementCount(i), 0)).toBe(3);
  });

  it("carries every measurement across, field for field", () => {
    // The price above could in principle survive a lost measurement if two
    // errors cancelled. This says nothing was lost at all.
    for (const item of cardWithThreeMeasurements()) {
      const before: WbsMeasurement[] = measurementsFromItem(item);
      const after: WbsMeasurement[] = measurementsFromItem(relocate(item));
      expect(after).toEqual(before);
    }
  });

  it("keeps every Waste? and Cutting? tick exactly where it was", () => {
    // These two booleans are the switches that put a measurement in front of
    // the waste aggregator and the cutting take-off at all.
    for (const item of cardWithThreeMeasurements()) {
      const after = relocate(item);
      expect(after.wasteIncluded).toBe(item.wasteIncluded);
      expect(after.cuttingIncluded).toBe(item.cuttingIncluded);
      const beforeExtras = Array.isArray(item.materials) ? item.materials : [];
      const afterExtras = Array.isArray(after.materials) ? after.materials : [];
      expect(afterExtras).toHaveLength(beforeExtras.length);
      beforeExtras.forEach((m, i) => {
        expect(afterExtras[i].wasteIncluded === true).toBe(m.wasteIncluded === true);
        expect(afterExtras[i].cuttingIncluded === true).toBe(m.cuttingIncluded === true);
      });
    }
  });

  it("the waste leg is really load-bearing — dropping a measurement moves the price", () => {
    // A negative control for the assertion above. If wasteChargeForCard were
    // blind to the measurements, the equality test would pass no matter what
    // the relocation did to them, and the proof would be worthless.
    const items = cardWithThreeMeasurements();
    const withoutTheBrick = items.map((i) =>
      i.id === "item-a" ? { ...i, materials: [] } : i
    );
    expect(cardTenderTotal(withoutTheBrick, WASTE_RATES)).toBe(19385 - 120);

    const withoutItemBsMeasurement = items.map((i) =>
      i.id === "item-b" ? { ...i, wasteIncluded: false } : i
    );
    expect(cardTenderTotal(withoutItemBsMeasurement, WASTE_RATES)).toBe(19385 - 735);
  });

  it("removing a measurement moves the price by exactly that measurement", () => {
    // The one operation in this slice that is MEANT to change the figure, and
    // by a stated amount: the promotion must not double- or under-count.
    const items = cardWithThreeMeasurements();
    const itemA = items[0];
    const patch = measurementRemovalPatch(itemA, 0) as Record<string, unknown>;
    const afterRemoval = items.map((i) =>
      i.id === "item-a"
        ? {
            ...i,
            materialType: patch.materialType as string | null,
            tonnes: patch.tonnes == null ? null : String(patch.tonnes),
            m3: patch.m3 == null ? null : String(patch.m3),
            wasteGroup: patch.wasteGroup as string | null,
            wasteItem: patch.wasteItem as string | null,
            wasteIncluded: patch.wasteIncluded as boolean,
            materials: patch.materials as ScopeMaterialEntry[]
          }
        : i
    );
    // The concrete measurement (24 t x $95 = 2,280) is gone; the brick it
    // promoted into the flat columns still bills its 3 m³ x $40 = 120.
    expect(cardTenderTotal(afterRemoval, WASTE_RATES)).toBe(19385 - 2280);
  });
});
