import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { OverrideField, TooltipSelect, type TooltipSelectOption } from "../../../components";
import { computeDerivedDimensions, isDimensionOverride } from "../scopeItemDimensions";
import type { MaterialLookup, ScopeItem, ScopeMaterialEntry } from "../ScopeQuantitiesTable";

// ── SCOPE_WBS_ACTIONS_V1 — the Measurement expandable ────────────────────
//
// THIS FILE IS A RELOCATION, NOT A NEW FEATURE.
//
// Every field below used to render INLINE, on row 0 of every WBS row in
// ScopeQuantitiesTable: `ItemBodyInputs` drew the item's own measurement as a
// flex strip of FieldCells, and `MaterialCluster` drew each extra measurement
// as a dashed box underneath it. A card of ten items therefore painted ninety
// boxes whether or not a single one of them measured anything. Both components
// moved here, verbatim in their handlers and their payloads, and are now laid
// out as ROWS OF ONE TABLE behind a disclosure that starts CLOSED.
//
// What "verbatim" is protecting. A measurement is money: item.tonnes and each
// materials[].tonnes are what scope-waste.service.ts aggregates into the auto-
// summed waste rows (aggregateFromScopeItems: the flat columns are material 1,
// each `materials` entry carries its own waste classification), and
// item.cuttingIncluded is what the cutting take-off reads. If a field stopped
// binding to the same record because it now lives behind a disclosure, the
// tender price would move and nothing on screen would say so. So:
//
//   * the primary measurement still writes the item's FLAT columns
//     (materialType/materialKind/length/height/depth/density/sqm/m3/tonnes/
//     quantity/factor/wasteGroup/wasteItem/wasteIncluded/cuttingIncluded);
//   * measurements 2..N still write `materials[]`, same shape, same order;
//   * the derived columns are still derived by computeDerivedDimensions, the
//     one helper both this file and the API mirror. Not one line of that
//     arithmetic is touched here — Sqm/M³/Tonnes are computed, displayed, and
//     only ever stored as a value the estimator explicitly typed over the top
//     of (the pre-existing OverrideField + isDimensionOverride affordance,
//     carried across unchanged);
//   * every per-field handler is the handler that was on main, moved.
//
// The only genuinely new arithmetic in this file is set arithmetic over the
// measurement LIST — add one, remove one — and it is expressed once, in
// measurementPatchBody(), so the primary and the extras can never disagree
// about what an item's measurements are. Removing the primary measurement of
// an item that has extras PROMOTES the next one into the flat columns, which
// is why removal is a whole-list write and not a splice of `materials`.

/** Row-1 and per-entry material kind — drives which formula derives tonnes. */
export type MeasurementKind = "VOLUME" | "AREA" | "EACH" | "FACTOR";

/**
 * SCOPE_WBS_ACTIONS_V1 — one measurement, read out of an item without caring
 * which of the two stores it came from.
 *
 * `index` 0 is the item's own (flat-column) measurement; 1..N are
 * `item.materials[index - 1]`. That mapping is the whole reason this type
 * exists: the block renders one row per measurement and must not make the
 * estimator care that measurement 1 lives on different columns to measurement
 * 2 — while the WRITE path has to care, exactly and only in
 * measurementPatchBody().
 */
export type WbsMeasurement = {
  index: number;
  material: string | null;
  kind: MeasurementKind | null;
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
};

/** Item fields the measurement list is read from. */
type MeasurementSource = Pick<
  ScopeItem,
  | "materialType"
  | "materialKind"
  | "quantity"
  | "factor"
  | "length"
  | "height"
  | "depth"
  | "density"
  | "sqm"
  | "m3"
  | "tonnes"
  | "wasteGroup"
  | "wasteItem"
  | "wasteIncluded"
  | "cuttingIncluded"
  | "materials"
>;

/** Decimal columns arrive as strings over the wire; "" and non-numerics are absent. */
function numOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function kindOrNull(value: string | null | undefined): MeasurementKind | null {
  return value === "VOLUME" || value === "AREA" || value === "EACH" || value === "FACTOR"
    ? value
    : null;
}

// ── The rate-card density units ──────────────────────────────────────────
//
// SCOPE_WBS_ACTIONS_V1 — lifted out of the two TooltipSelect onChange bodies
// that used to hold it inline, once each, in ScopeQuantitiesTable.
//
// WHY THIS IS A FUNCTION AND NOT A COMPARISON. The unit strings below are
// DATA, not copy: they are the exact values the API seeds
// (apps/api/prisma/seed-initial-services.ts -> unit: "kg/m³"; the
// material_density_kind migration -> WHERE "unit" = 'kg/m²'), superscripts
// included, and there is no ASCII variant anywhere in apps/api/prisma. During
// the SCOPE_WBS_TABLE_V1 table rewrite every non-ASCII character in the
// component was flattened and the comparison silently became the ASCII form,
// with a plain 3 where the superscript belongs. (It is not written out here:
// scopeItemDensityUnits.test.ts asserts that no ASCII-flattened unit literal
// appears in this file, and a comment quoting one would defeat that control.)
// It compiled, every unit test passed and the acceptance suite stayed green —
// because nothing in the suite changes a material — while the ÷1000 stopped
// happening and a 10 m³ concrete item reported 24,000 t instead of 24.
//
// That incident was guarded, until this slice, by a source-TEXT check that
// grepped ScopeQuantitiesTable.tsx for the literals
// (__tests__/scopeItemDensityUnits.test.ts). Its own docstring said the right
// fix was to lift the logic into a helper and test the helper behaviourally.
// These two functions are that lift, and the guard is now behavioural: it
// asserts that the ASCII forms do NOT match, which reproduces the original bug
// as a failing test instead of as a string search that any relocation breaks.

/**
 * How much to divide a rate-card density by to reach the unit the item stores.
 *
 * `kg/m³` is divided by 1000 to become t/m³, which is what
 * computeDerivedDimensions' `m3 × density` leg expects.
 *
 * EVERYTHING ELSE IS 1, and `kg/m²` most of all — see isSheetUnit. A sheet
 * density is stored AS IS, in kg/m², because the ÷1000 for sheets happens
 * downstream in computeDerivedDimensions' sqm fallback
 * (`tonnes = (sqm × density) / 1000`). Dividing here as well would divide
 * twice and under-report every sheet material's tonnage by a factor of 1000 —
 * the same class of silent, green-suite pricing bug as the incident above,
 * pointing the other way.
 */
export function densityDivisorForUnit(unit: string | null | undefined): number {
  return unit === "kg/m³" ? 1000 : 1;
}

/**
 * True for a material measured by AREA rather than volume.
 *
 * A sheet has no meaningful depth, so picking one clears depth and m³ and
 * routes tonnes through the sqm fallback instead of `m3 × density`.
 */
export function isSheetUnit(unit: string | null | undefined): boolean {
  return unit === "kg/m²";
}

/**
 * The density to STORE for a picked material, in the item's own units.
 *
 * The single home for the whole rule, so the primary measurement row and the
 * extra rows cannot drift apart on it — which is precisely what two inline
 * copies of a string comparison were free to do.
 */
export function storedDensityForMaterial(
  lookup: Pick<MaterialLookup, "density" | "unit"> | null | undefined
): number | null {
  if (!lookup) return null;
  return Number(lookup.density) / densityDivisorForUnit(lookup.unit);
}

/** The extra-measurement entries of an item, always as an array. */
export function materialEntriesOf(item: Pick<ScopeItem, "materials">): ScopeMaterialEntry[] {
  return Array.isArray(item.materials) ? item.materials : [];
}

/**
 * SCOPE_WBS_ACTIONS_V1 — every measurement on an item, primary first.
 *
 * Reads only; derives nothing. A stored tonnes of null STAYS null here even
 * where the dimensions would derive one, because null is what the waste
 * aggregator reads and re-deriving it on a read would invent tonnage that the
 * server never stored.
 */
export function measurementsFromItem(item: MeasurementSource): WbsMeasurement[] {
  const primary: WbsMeasurement = {
    index: 0,
    material: item.materialType ?? null,
    kind: kindOrNull(item.materialKind),
    quantity: numOrNull(item.quantity),
    factor: numOrNull(item.factor),
    length: numOrNull(item.length),
    height: numOrNull(item.height),
    depth: numOrNull(item.depth),
    density: numOrNull(item.density),
    sqm: numOrNull(item.sqm),
    m3: numOrNull(item.m3),
    tonnes: numOrNull(item.tonnes),
    wasteGroup: item.wasteGroup ?? null,
    wasteItem: item.wasteItem ?? null,
    wasteIncluded: item.wasteIncluded === true,
    cuttingIncluded: item.cuttingIncluded === true
  };
  const extras = materialEntriesOf(item).map((entry, i) => ({
    index: i + 1,
    material: entry.material ?? null,
    kind: kindOrNull(entry.kind),
    quantity: numOrNull(entry.quantity),
    factor: numOrNull(entry.factor),
    length: numOrNull(entry.length),
    height: numOrNull(entry.height),
    depth: numOrNull(entry.depth),
    density: numOrNull(entry.density),
    sqm: numOrNull(entry.sqm),
    m3: numOrNull(entry.m3),
    tonnes: numOrNull(entry.tonnes),
    wasteGroup: entry.wasteGroup ?? null,
    wasteItem: entry.wasteItem ?? null,
    wasteIncluded: entry.wasteIncluded === true,
    cuttingIncluded: entry.cuttingIncluded === true
  }));
  return [primary, ...extras];
}

/** A measurement with nothing in it — the empty slot the block opens onto. */
export function blankMeasurement(index: number): WbsMeasurement {
  return {
    index,
    material: null,
    kind: null,
    quantity: null,
    factor: null,
    length: null,
    height: null,
    depth: null,
    density: null,
    sqm: null,
    m3: null,
    tonnes: null,
    wasteGroup: null,
    wasteItem: null,
    wasteIncluded: false,
    cuttingIncluded: false
  };
}

/**
 * True when a measurement says nothing at all.
 *
 * The primary measurement is a set of nullable COLUMNS, not a record: it is
 * always addressable, so "has this item got a measurement" cannot be answered
 * by counting rows. It is answered here.
 */
export function isBlankMeasurement(m: WbsMeasurement): boolean {
  return (
    m.material === null &&
    m.kind === null &&
    m.quantity === null &&
    m.factor === null &&
    m.length === null &&
    m.height === null &&
    m.depth === null &&
    m.density === null &&
    m.sqm === null &&
    m.m3 === null &&
    m.tonnes === null &&
    m.wasteGroup === null &&
    m.wasteItem === null &&
    m.wasteIncluded === false &&
    m.cuttingIncluded === false
  );
}

/** How many measurements the item actually carries — the actions-column count. */
export function measurementCount(item: MeasurementSource): number {
  return measurementsFromItem(item).filter((m) => !isBlankMeasurement(m)).length;
}

/**
 * SCOPE_WBS_ACTIONS_V1 — the whole measurement payload for an item.
 *
 * The ONE place that knows measurement 1 lives on the flat columns and the
 * rest live in `materials`. Rows are taken in the order given: rows[0] becomes
 * the flat columns, rows[1..] become `materials`, renumbered densely. That is
 * what makes "remove the primary measurement" a promotion rather than a hole.
 *
 * Every flat key is written on every call, including the nulls. `updateItem`
 * persists exactly what the DTO carries, so a key omitted here would leave the
 * old value behind — which, on a removal, is the difference between deleting a
 * measurement and duplicating it into the row that replaced it.
 *
 * `materials: []` is deliberate and pre-existing behaviour (the old
 * removeMaterial sent it too): an item whose last extra was removed genuinely
 * has none, and the flat columns are unaffected by the empty array.
 */
export function measurementPatchBody(rows: WbsMeasurement[]): Record<string, unknown> {
  const primary = rows[0] ?? blankMeasurement(0);
  const extras: ScopeMaterialEntry[] = rows.slice(1).map((m) => ({
    material: m.material,
    kind: m.kind,
    quantity: m.quantity,
    factor: m.factor,
    length: m.length,
    height: m.height,
    depth: m.depth,
    density: m.density,
    sqm: m.sqm,
    m3: m.m3,
    tonnes: m.tonnes,
    wasteGroup: m.wasteGroup,
    wasteItem: m.wasteItem,
    wasteIncluded: m.wasteIncluded,
    cuttingIncluded: m.cuttingIncluded
  }));
  return {
    materialType: primary.material,
    materialKind: primary.kind,
    quantity: primary.quantity,
    factor: primary.factor,
    length: primary.length,
    height: primary.height,
    depth: primary.depth,
    density: primary.density,
    sqm: primary.sqm,
    m3: primary.m3,
    tonnes: primary.tonnes,
    wasteGroup: primary.wasteGroup,
    wasteItem: primary.wasteItem,
    wasteIncluded: primary.wasteIncluded,
    cuttingIncluded: primary.cuttingIncluded,
    materials: extras
  };
}

/**
 * The patch that removes measurement `index` from an item.
 *
 * Expressed as a whole-list write so that removing measurement 1 of an item
 * that has 2 and 3 promotes 2 into the flat columns instead of leaving the
 * flat columns holding a measurement the estimator just deleted. Out-of-range
 * indices return the list unchanged rather than clearing anything.
 */
export function measurementRemovalPatch(
  item: MeasurementSource,
  index: number
): Record<string, unknown> {
  const rows = measurementsFromItem(item);
  const kept = rows.filter((m) => m.index !== index);
  return measurementPatchBody(kept.map((m, i) => ({ ...m, index: i })));
}

/**
 * The patch that `+ Add measurement` sends, or null when the button only has
 * to OPEN the block.
 *
 * An item nobody has measured already has an addressable empty slot — its flat
 * columns — so the first click opens the block onto that slot and writes
 * nothing. A second measurement is a real append to `materials`.
 *
 * SCOPE_WBS_REVEAL_V1 — this function answers "what would an add write?" and
 * nothing more. WHETHER the click adds at all is decided before it is called,
 * by revealOrAddPatch in ScopeQuantitiesTable: a click on a shut block reveals
 * and never gets here. Both nulls mean "send no PATCH"; they are simply
 * reached for different reasons.
 */
export function measurementAddPatch(item: MeasurementSource): Record<string, unknown> | null {
  const rows = measurementsFromItem(item);
  if (rows.some(isBlankMeasurement)) return null;
  return measurementPatchBody([...rows, blankMeasurement(rows.length)]);
}

// ── Presentation ─────────────────────────────────────────────────────────

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  whiteSpace: "nowrap"
};

const blockThStyle: CSSProperties = {
  ...labelStyle,
  textAlign: "left",
  padding: "2px 6px",
  borderBottom: "1px solid var(--border-default, #e5e7eb)"
};

const blockTdStyle: CSSProperties = {
  padding: "4px 6px",
  verticalAlign: "middle",
  whiteSpace: "nowrap"
};

const numInputStyle: CSSProperties = { width: 70, height: 30 };
const derivedInputStyle: CSSProperties = { width: 78, height: 30 };

function RemoveMeasurementCell({
  label,
  disabled,
  onRemove
}: {
  label: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <td style={{ ...blockTdStyle, textAlign: "right" }}>
      {disabled ? null : (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onRemove}
          aria-label={label}
          title={label}
          style={{ color: "var(--status-danger, #EF4444)", fontSize: 12, padding: "2px 6px" }}
        >
          x
        </button>
      )}
    </td>
  );
}

/**
 * Waste group + waste item, or the read-only pair a material auto-filled.
 * Identical rule on the primary row and the extras — it was duplicated on main
 * and stays one component here.
 */
function WasteCells({
  wasteGroup,
  wasteItem,
  material,
  autofilled,
  wasteGroupOptions,
  wasteItemOptions,
  disabled,
  ariaPrefix,
  onGroupChange,
  onItemChange
}: {
  wasteGroup: string | null;
  wasteItem: string | null;
  material: string | null;
  autofilled: boolean;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemOptions: TooltipSelectOption<string>[];
  disabled: boolean;
  ariaPrefix: string;
  onGroupChange: (v: string | null) => void;
  onItemChange: (v: string | null) => void;
}) {
  if (autofilled) {
    return (
      <td
        style={blockTdStyle}
        colSpan={2}
        title={`Auto from ${material}: ${wasteGroup} -> ${wasteItem}`}
      >
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {wasteGroup} {"·"} {wasteItem}
        </span>
      </td>
    );
  }
  return (
    <>
      <td style={blockTdStyle}>
        <TooltipSelect
          value={wasteGroup}
          options={wasteGroupOptions}
          onChange={(v) => onGroupChange(v)}
          disabled={disabled}
          ariaLabel={`${ariaPrefix} waste group`}
          style={{ height: 30, minWidth: 110 }}
        />
      </td>
      <td style={blockTdStyle}>
        <TooltipSelect
          value={wasteItem}
          options={wasteItemOptions}
          onChange={(v) => onItemChange(v)}
          disabled={disabled || !wasteGroup}
          ariaLabel={`${ariaPrefix} waste item`}
          style={{ height: 30, minWidth: 120 }}
        />
      </td>
    </>
  );
}

// ── The primary measurement row ──────────────────────────────────────────
// Was ItemBodyInputs' "Section B" flex strip. Controlled dimension state, the
// dirty/override tracking for Sqm/M³/Tonnes, persistDims and the material
// cascade are all carried across unchanged; only the wrapper elements differ
// (a <tr> of <td>s instead of a flex row of FieldCells).

function PrimaryMeasurementRow({
  item,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  showCutting,
  canRemove,
  onRemove,
  onPatch
}: {
  item: ScopeItem;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  showCutting: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const row1Kind: MeasurementKind = (item.materialKind as MeasurementKind) ?? "VOLUME";

  const wasteItemOptions: TooltipSelectOption<string>[] = item.wasteGroup
    ? (wasteItemsByGroup.get(item.wasteGroup) ?? []).map((w) => ({ value: w, label: w }))
    : [];

  const row1MaterialLookup = item.materialType
    ? materialDensityMap.get(item.materialType)
    : undefined;
  const row1WasteAutofilled =
    !!row1MaterialLookup?.defaultWasteGroup &&
    !!row1MaterialLookup?.defaultWasteItem &&
    item.wasteGroup === row1MaterialLookup.defaultWasteGroup &&
    item.wasteItem === row1MaterialLookup.defaultWasteItem;

  // PR B4a.5 — controlled state for the 7 dimension fields.
  type DimKey = "length" | "height" | "depth" | "sqm" | "m3" | "density" | "tonnes";
  const initDim = (v: string | null) => (v == null ? "" : String(v));
  const [dims, setDims] = useState({
    length: initDim(item.length),
    height: initDim(item.height),
    depth: initDim(item.depth),
    sqm: initDim(item.sqm),
    m3: initDim(item.m3),
    density: initDim(item.density),
    tonnes: initDim(item.tonnes)
  });
  const [dirty, setDirty] = useState({ sqm: false, m3: false, tonnes: false });
  const [row1Quantity, setRow1Quantity] = useState(initDim(item.quantity ?? null));
  const [row1Factor, setRow1Factor] = useState(initDim(item.factor ?? null));

  useEffect(() => {
    setDims({
      length: initDim(item.length),
      height: initDim(item.height),
      depth: initDim(item.depth),
      sqm: initDim(item.sqm),
      m3: initDim(item.m3),
      density: initDim(item.density),
      tonnes: initDim(item.tonnes)
    });
    setRow1Quantity(initDim(item.quantity ?? null));
    setRow1Factor(initDim(item.factor ?? null));

    const autoDerived = computeDerivedDimensions({
      length: item.length == null ? null : Number(item.length),
      height: item.height == null ? null : Number(item.height),
      depth: item.depth == null ? null : Number(item.depth),
      density: item.density == null ? null : Number(item.density),
      sqm: null,
      m3: null,
      tonnes: null
    });

    setDirty({
      sqm: isDimensionOverride(item.sqm, autoDerived.sqm),
      m3: isDimensionOverride(item.m3, autoDerived.m3),
      tonnes: isDimensionOverride(item.tonnes, autoDerived.tonnes)
    });
  }, [
    item.id,
    item.length,
    item.height,
    item.depth,
    item.sqm,
    item.m3,
    item.density,
    item.tonnes,
    item.quantity,
    item.factor
  ]);

  const setDim = (k: DimKey, v: string) => {
    setDims((s) => ({ ...s, [k]: v }));
    setDirty((d) => {
      const next = { ...d };
      if (k === "sqm" || k === "m3" || k === "tonnes") {
        next[k] = true;
      }
      if (k === "length" || k === "height") {
        next.sqm = false;
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "depth") {
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "density") {
        next.tonnes = false;
      } else if (k === "sqm") {
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "m3") {
        next.tonnes = false;
      }
      return next;
    });
  };

  const parsed = useMemo(
    () => ({
      length: dims.length === "" ? null : Number(dims.length),
      height: dims.height === "" ? null : Number(dims.height),
      depth: dims.depth === "" ? null : Number(dims.depth),
      density: dims.density === "" ? null : Number(dims.density),
      sqm: dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : null,
      m3: dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : null,
      tonnes: dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : null,
      kind: row1Kind,
      quantity: row1Quantity === "" ? null : Number(row1Quantity),
      factor: row1Factor === "" ? null : Number(row1Factor)
    }),
    [dims, dirty, row1Kind, row1Quantity, row1Factor]
  );
  const derived = useMemo(() => computeDerivedDimensions(parsed), [parsed]);

  const persistDims = () => {
    const sqmToSave = dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : derived.sqm;
    const m3ToSave = dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : derived.m3;
    const tonnesToSave = dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : derived.tonnes;

    const MAX_DIM = 9999999;
    const MAX_DENSITY = 99999;
    const MAX_DERIVED = 99999999;
    const inRange = (v: number | null, max: number) =>
      v == null || (Number.isFinite(v) && Math.abs(v) < max);
    const valid =
      inRange(parsed.length, MAX_DIM) &&
      inRange(parsed.height, MAX_DIM) &&
      inRange(parsed.depth, MAX_DIM) &&
      inRange(parsed.density, MAX_DENSITY) &&
      inRange(sqmToSave, MAX_DERIVED) &&
      inRange(m3ToSave, MAX_DERIVED) &&
      inRange(tonnesToSave, MAX_DERIVED);
    if (!valid) {
      console.warn("Dimension PATCH rejected: value out of Decimal range", {
        parsed,
        sqmToSave,
        m3ToSave,
        tonnesToSave
      });
      return;
    }

    onPatch({
      length: parsed.length,
      height: parsed.height,
      depth: parsed.depth,
      density: parsed.density,
      sqm: sqmToSave,
      m3: m3ToSave,
      tonnes: tonnesToSave,
      materialKind: row1Kind,
      quantity: parsed.quantity,
      factor: parsed.factor
    });
  };

  const valueFor = (k: "sqm" | "m3" | "tonnes") => {
    if (dirty[k]) return dims[k];
    const d = derived[k];
    return d == null ? "" : String(d);
  };
  const placeholderFor = (k: "sqm" | "m3" | "tonnes") => {
    const v = derived[k];
    return v == null ? "" : String(v);
  };

  return (
    <tr>
      <td style={{ ...blockTdStyle, ...labelStyle }}>1</td>
      <WasteCells
        wasteGroup={item.wasteGroup}
        wasteItem={item.wasteItem}
        material={item.materialType}
        autofilled={row1WasteAutofilled}
        wasteGroupOptions={wasteGroupOptions}
        wasteItemOptions={wasteItemOptions}
        disabled={isAi}
        ariaPrefix="Measurement 1"
        onGroupChange={(v) => onPatch({ wasteGroup: v, wasteItem: null })}
        onItemChange={(v) => onPatch({ wasteItem: v })}
      />
      <td style={blockTdStyle}>
        <TooltipSelect
          value={item.materialType}
          options={materialOptions}
          onChange={(v) => {
            const lookup = v ? materialDensityMap.get(v) : undefined;
            // The unit rule lives in storedDensityForMaterial / isSheetUnit at
            // the top of this file — one home, and guarded behaviourally
            // rather than by grepping this file for a string.
            const newDensity = storedDensityForMaterial(lookup);
            const newKind = lookup?.kind ?? "VOLUME";
            const isSheet = isSheetUnit(lookup?.unit);
            const newParsed = {
              length: dims.length === "" ? null : Number(dims.length),
              height: dims.height === "" ? null : Number(dims.height),
              depth: isSheet ? null : dims.depth === "" ? null : Number(dims.depth),
              density: newDensity,
              sqm: dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : null,
              m3: isSheet ? null : dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : null,
              tonnes: null,
              kind: newKind as MeasurementKind,
              quantity: row1Quantity === "" ? null : Number(row1Quantity),
              factor: row1Factor === "" ? null : Number(row1Factor)
            };
            const rederived = computeDerivedDimensions(newParsed);
            const wasteDefaults = lookup
              ? lookup.defaultWasteGroup && lookup.defaultWasteItem
                ? { wasteGroup: lookup.defaultWasteGroup, wasteItem: lookup.defaultWasteItem }
                : {}
              : {};
            onPatch({
              materialType: v,
              materialKind: newKind,
              density: newDensity,
              length: newParsed.length,
              height: newParsed.height,
              depth: newParsed.depth,
              sqm: rederived.sqm,
              m3: rederived.m3,
              tonnes: rederived.tonnes,
              quantity: newKind === "EACH" ? newParsed.quantity : null,
              factor: newKind === "FACTOR" ? newParsed.factor : null,
              ...wasteDefaults
            });
          }}
          disabled={isAi}
          ariaLabel="Material type"
          style={{ height: 30, minWidth: 130 }}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          value={dims.length}
          disabled={isAi}
          style={numInputStyle}
          aria-label="Measurement 1 length"
          onChange={(e) => setDim("length", e.target.value)}
          onBlur={persistDims}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          value={dims.height}
          disabled={isAi}
          style={numInputStyle}
          aria-label="Measurement 1 height"
          onChange={(e) => setDim("height", e.target.value)}
          onBlur={persistDims}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          value={dims.depth}
          disabled={isAi}
          style={numInputStyle}
          aria-label="Measurement 1 depth"
          onChange={(e) => setDim("depth", e.target.value)}
          onBlur={persistDims}
        />
      </td>
      {/* Qty column — EACH counts items, FACTOR carries the sqm multiplier,
          VOLUME/AREA have neither. Same three fields as the flex strip had;
          they simply share one column now instead of appearing and vanishing
          from the middle of the strip. */}
      <td style={blockTdStyle}>
        {row1Kind === "EACH" ? (
          <input
            className="s7-input"
            type="number"
            step="1"
            value={row1Quantity}
            disabled={isAi}
            style={numInputStyle}
            placeholder="0"
            title="Number of items (tonnes = qty × kg/item ÷ 1000)"
            aria-label="Measurement 1 quantity"
            onChange={(e) => setRow1Quantity(e.target.value)}
            onBlur={persistDims}
          />
        ) : row1Kind === "FACTOR" ? (
          <input
            className="s7-input"
            type="number"
            step="0.0001"
            value={row1Factor}
            disabled={isAi}
            style={numInputStyle}
            placeholder="0.0"
            title="Factor: tonnes = sqm × factor"
            aria-label="Measurement 1 factor"
            onChange={(e) => setRow1Factor(e.target.value)}
            onBlur={persistDims}
          />
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
        )}
      </td>
      <td style={blockTdStyle}>
        <OverrideField
          isOverridden={dirty.sqm}
          onRevert={() => {
            setDim("sqm", "");
            setDirty((d) => ({ ...d, sqm: false }));
          }}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={valueFor("sqm")}
            placeholder={placeholderFor("sqm")}
            disabled={isAi}
            style={derivedInputStyle}
            title="Derived = length × height. Type to override."
            aria-label="Measurement 1 sqm"
            onChange={(e) => setDim("sqm", e.target.value)}
            onBlur={persistDims}
          />
        </OverrideField>
      </td>
      <td style={blockTdStyle}>
        <OverrideField
          isOverridden={dirty.m3}
          onRevert={() => {
            setDim("m3", "");
            setDirty((d) => ({ ...d, m3: false }));
          }}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={valueFor("m3")}
            placeholder={placeholderFor("m3")}
            disabled={isAi}
            style={derivedInputStyle}
            title="Derived = sqm × depth. Type to override."
            aria-label="Measurement 1 m3"
            onChange={(e) => setDim("m3", e.target.value)}
            onBlur={persistDims}
          />
        </OverrideField>
      </td>
      {/* Density is auto-set from the material and LOCKED while one is picked
          — the same rule the flex strip carried. FACTOR rows never offered it
          at all, so it stays locked there too. */}
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          value={dims.density}
          disabled={isAi || !!item.materialType || row1Kind === "FACTOR"}
          style={{
            ...derivedInputStyle,
            ...(item.materialType || row1Kind === "FACTOR"
              ? {
                  backgroundColor: "var(--surface-muted, #f3f4f6)",
                  color: "var(--text-muted, #6b7280)"
                }
              : {})
          }}
          title={
            item.materialType
              ? `Auto-set from ${item.materialType}. Clear material to edit manually.`
              : row1Kind === "EACH"
                ? "Per-item weight in kg (tonnes = qty × kg/1000)"
                : row1Kind === "FACTOR"
                  ? "Not used on a factor measurement — tonnes = sqm × factor."
                  : "Manual density (tonnes per m³)"
          }
          aria-label={row1Kind === "EACH" ? "Measurement 1 kg per item" : "Measurement 1 density"}
          onChange={(e) => setDim("density", e.target.value)}
          onBlur={persistDims}
        />
      </td>
      <td style={blockTdStyle}>
        <OverrideField
          isOverridden={dirty.tonnes}
          onRevert={() => {
            setDim("tonnes", "");
            setDirty((d) => ({ ...d, tonnes: false }));
          }}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={valueFor("tonnes")}
            placeholder={placeholderFor("tonnes")}
            disabled={isAi}
            style={derivedInputStyle}
            title="Derived = m³ × density or sqm × density / 1000. Type to override."
            aria-label="Measurement 1 tonnes"
            onChange={(e) => setDim("tonnes", e.target.value)}
            onBlur={persistDims}
          />
        </OverrideField>
      </td>
      <td style={{ ...blockTdStyle, textAlign: "center" }}>
        <input
          type="checkbox"
          checked={item.wasteIncluded === true}
          disabled={isAi}
          onChange={(e) => onPatch({ wasteIncluded: e.target.checked })}
          aria-label="Include in waste summary"
          style={{ width: 18, height: 18 }}
        />
      </td>
      {/* SCOPE_WBS_INPUTS_V2 — the Cutting? tick renders only where the
          cutting sheet it feeds is rendered (ScopeCardsTab gates
          <ScopeCuttingSheet> on the same condition, and the caller resolves it
          through showsCuttingColumn). On an ASB card there is nowhere for a
          ticked value to be priced. Render gate only: an already-stored
          cuttingIncluded is left untouched. */}
      {showCutting ? (
        <td style={{ ...blockTdStyle, textAlign: "center" }}>
          <input
            type="checkbox"
            checked={item.cuttingIncluded === true}
            disabled={isAi}
            onChange={(e) => onPatch({ cuttingIncluded: e.target.checked })}
            aria-label="Include in cutting summary"
            style={{ width: 18, height: 18 }}
          />
        </td>
      ) : null}
      <RemoveMeasurementCell
        label="Remove measurement 1"
        disabled={isAi || !canRemove}
        onRemove={onRemove}
      />
    </tr>
  );
}

// ── An extra measurement row (2..N) ──────────────────────────────────────
// Was MaterialCluster's dashed box. Every handler below is that component's
// handler, moved: uncontrolled inputs committing on blur, the same material
// cascade, and the same per-entry waste classification.

function ExtraMeasurementRow({
  index,
  entry,
  materialOptions,
  materialDensityMap,
  wasteGroupOptions,
  wasteItemsByGroup,
  disabled,
  showCutting,
  onChange,
  onRemove
}: {
  index: number;
  entry: ScopeMaterialEntry;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  disabled: boolean;
  showCutting: boolean;
  onChange: (patch: Partial<ScopeMaterialEntry>) => void;
  onRemove: () => void;
}) {
  const matKind: MeasurementKind = (entry.kind ?? "VOLUME") as MeasurementKind;
  const toNumOrNull = (v: string): number | null => {
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const strOf = (v: number | null | undefined): string => (v == null ? "" : String(v));

  const derived = computeDerivedDimensions({
    length: entry.length ?? null,
    height: entry.height ?? null,
    depth: entry.depth ?? null,
    density: entry.density ?? null,
    sqm: entry.sqm ?? null,
    m3: entry.m3 ?? null,
    tonnes: entry.tonnes ?? null,
    kind: matKind,
    quantity: entry.quantity ?? null,
    factor: entry.factor ?? null
  });

  const wasteItemOptions: TooltipSelectOption<string>[] = entry.wasteGroup
    ? (wasteItemsByGroup.get(entry.wasteGroup) ?? []).map((w) => ({ value: w, label: w }))
    : [];

  const entryMaterialLookup = entry.material ? materialDensityMap.get(entry.material) : undefined;
  const entryWasteAutofilled =
    !!entryMaterialLookup?.defaultWasteGroup &&
    !!entryMaterialLookup?.defaultWasteItem &&
    entry.wasteGroup === entryMaterialLookup.defaultWasteGroup &&
    entry.wasteItem === entryMaterialLookup.defaultWasteItem;

  // Displayed number, not stored index: measurement 2 is materials[0].
  const measurementNo = index + 2;

  return (
    <tr>
      <td style={{ ...blockTdStyle, ...labelStyle }}>{measurementNo}</td>
      <WasteCells
        wasteGroup={entry.wasteGroup ?? null}
        wasteItem={entry.wasteItem ?? null}
        material={entry.material ?? null}
        autofilled={entryWasteAutofilled}
        wasteGroupOptions={wasteGroupOptions}
        wasteItemOptions={wasteItemOptions}
        disabled={disabled}
        ariaPrefix={`Measurement ${measurementNo}`}
        onGroupChange={(v) => onChange({ wasteGroup: v, wasteItem: null })}
        onItemChange={(v) => onChange({ wasteItem: v })}
      />
      <td style={blockTdStyle}>
        <TooltipSelect
          value={entry.material ?? null}
          options={materialOptions}
          onChange={(v) => {
            const lookup = v ? materialDensityMap.get(v) : undefined;
            // Same two helpers as the primary row — that is the point of them.
            const newDensity = storedDensityForMaterial(lookup);
            const newKind = lookup?.kind ?? "VOLUME";
            const isSheet = isSheetUnit(lookup?.unit);
            const rederived = computeDerivedDimensions({
              length: entry.length ?? null,
              height: entry.height ?? null,
              depth: isSheet ? null : (entry.depth ?? null),
              density: newDensity,
              sqm: null,
              m3: isSheet ? null : (entry.m3 ?? null),
              tonnes: null,
              kind: newKind as MeasurementKind,
              quantity: newKind === "EACH" ? (entry.quantity ?? null) : null,
              factor: newKind === "FACTOR" ? (entry.factor ?? null) : null
            });
            const wasteDefaults = lookup
              ? lookup.defaultWasteGroup && lookup.defaultWasteItem
                ? { wasteGroup: lookup.defaultWasteGroup, wasteItem: lookup.defaultWasteItem }
                : {}
              : {};
            onChange({
              material: v,
              kind: newKind as MeasurementKind,
              density: newDensity,
              depth: isSheet ? null : (entry.depth ?? null),
              sqm: rederived.sqm,
              m3: rederived.m3,
              tonnes: rederived.tonnes,
              quantity: newKind === "EACH" ? (entry.quantity ?? null) : null,
              factor: newKind === "FACTOR" ? (entry.factor ?? null) : null,
              ...wasteDefaults
            });
          }}
          disabled={disabled}
          ariaLabel={`Measurement ${measurementNo} material type`}
          style={{ height: 30, minWidth: 130 }}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          defaultValue={strOf(entry.length)}
          disabled={disabled}
          style={numInputStyle}
          aria-label={`Measurement ${measurementNo} length`}
          onBlur={(e) => onChange({ length: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          defaultValue={strOf(entry.height)}
          disabled={disabled}
          style={numInputStyle}
          aria-label={`Measurement ${measurementNo} height`}
          onBlur={(e) => onChange({ height: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          defaultValue={strOf(entry.depth)}
          disabled={disabled}
          style={numInputStyle}
          aria-label={`Measurement ${measurementNo} depth`}
          onBlur={(e) => onChange({ depth: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        {matKind === "EACH" ? (
          <input
            className="s7-input"
            type="number"
            step="1"
            defaultValue={strOf(entry.quantity)}
            disabled={disabled}
            style={numInputStyle}
            placeholder="0"
            title="Number of items (tonnes = qty × kg/item ÷ 1000)"
            aria-label={`Measurement ${measurementNo} quantity`}
            onBlur={(e) => {
              const newQty = toNumOrNull(e.target.value);
              const rederived = computeDerivedDimensions({
                density: entry.density ?? null,
                kind: "EACH",
                quantity: newQty
              });
              onChange({ quantity: newQty, tonnes: rederived.tonnes });
            }}
          />
        ) : matKind === "FACTOR" ? (
          <input
            className="s7-input"
            type="number"
            step="0.0001"
            defaultValue={strOf(entry.factor)}
            disabled={disabled}
            style={numInputStyle}
            placeholder="0.0"
            title="Factor: tonnes = sqm × factor"
            aria-label={`Measurement ${measurementNo} factor`}
            onBlur={(e) => {
              const newFactor = toNumOrNull(e.target.value);
              const rederived = computeDerivedDimensions({
                sqm: entry.sqm ?? null,
                kind: "FACTOR",
                factor: newFactor
              });
              onChange({ factor: newFactor, tonnes: rederived.tonnes });
            }}
          />
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
        )}
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={strOf(entry.sqm ?? derived.sqm)}
          placeholder={derived.sqm == null ? "" : String(derived.sqm)}
          disabled={disabled}
          style={derivedInputStyle}
          title="Derived = length × height. Type to override."
          aria-label={`Measurement ${measurementNo} sqm`}
          onBlur={(e) => onChange({ sqm: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={strOf(entry.m3 ?? derived.m3)}
          placeholder={derived.m3 == null ? "" : String(derived.m3)}
          disabled={disabled}
          style={derivedInputStyle}
          title="Derived = sqm × depth. Type to override."
          aria-label={`Measurement ${measurementNo} m3`}
          onBlur={(e) => onChange({ m3: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          defaultValue={strOf(entry.density)}
          disabled={disabled || !!entry.material || matKind === "FACTOR"}
          style={{
            ...derivedInputStyle,
            ...(entry.material || matKind === "FACTOR"
              ? {
                  backgroundColor: "var(--surface-muted, #f3f4f6)",
                  color: "var(--text-muted, #6b7280)"
                }
              : {})
          }}
          title={
            entry.material
              ? `Auto-set from ${entry.material}. Clear material to edit manually.`
              : matKind === "EACH"
                ? "Per-item weight in kg (tonnes = qty × kg/1000)"
                : matKind === "FACTOR"
                  ? "Not used on a factor measurement — tonnes = sqm × factor."
                  : "Manual density (tonnes per m³)"
          }
          aria-label={
            matKind === "EACH"
              ? `Measurement ${measurementNo} kg per item`
              : `Measurement ${measurementNo} density`
          }
          onBlur={(e) => onChange({ density: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={blockTdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={strOf(entry.tonnes ?? derived.tonnes)}
          placeholder={derived.tonnes == null ? "" : String(derived.tonnes)}
          disabled={disabled}
          style={derivedInputStyle}
          title="Derived = m³ × density or sqm × density / 1000. Type to override."
          aria-label={`Measurement ${measurementNo} tonnes`}
          onBlur={(e) => onChange({ tonnes: toNumOrNull(e.target.value) })}
        />
      </td>
      <td style={{ ...blockTdStyle, textAlign: "center" }}>
        <input
          type="checkbox"
          checked={entry.wasteIncluded === true}
          disabled={disabled}
          onChange={(e) => onChange({ wasteIncluded: e.target.checked })}
          aria-label={`Measurement ${measurementNo} include in waste summary`}
          style={{ width: 18, height: 18 }}
        />
      </td>
      {showCutting ? (
        <td style={{ ...blockTdStyle, textAlign: "center" }}>
          <input
            type="checkbox"
            checked={entry.cuttingIncluded === true}
            disabled={disabled}
            onChange={(e) => onChange({ cuttingIncluded: e.target.checked })}
            aria-label={`Measurement ${measurementNo} include in cutting summary`}
            style={{ width: 18, height: 18 }}
          />
        </td>
      ) : null}
      <RemoveMeasurementCell
        label={`Remove measurement ${measurementNo}`}
        disabled={disabled}
        onRemove={onRemove}
      />
    </tr>
  );
}

export type WbsMeasurementBlockProps = {
  item: ScopeItem;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  /**
   * Whether the `Cutting?` tick renders. Resolved ONCE by the caller through
   * showsCuttingColumn(discipline) — the single source of truth for the rule
   * that an asbestos card has no cutting sheet to feed — and threaded down so
   * this file never re-states a discipline code.
   */
  showCutting: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

/**
 * SCOPE_WBS_ACTIONS_V1 — the item's measurements, one per row.
 *
 * Rendered ONLY when the estimator has opened it from the actions column. The
 * caller owns that state and it starts closed for every item on every card, so
 * an item with nothing in it paints no boxes at all.
 */
export function WbsMeasurementBlock({
  item,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  showCutting,
  onPatch
}: WbsMeasurementBlockProps) {
  const extras = materialEntriesOf(item);

  const updateMeasurement = (index: number, patch: Partial<ScopeMaterialEntry>) => {
    const next = extras.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onPatch({ materials: next });
  };

  // Item totals across every measurement — the figure the waste summary will
  // aggregate. Read from what is STORED (falling back to what the entry's own
  // dimensions derive), never re-derived from the primary's live input state.
  const totals = measurementsFromItem(item).reduce(
    (acc, m) => ({
      tonnes: m.tonnes == null ? acc.tonnes : Math.round((acc.tonnes + m.tonnes) * 100) / 100,
      m3: m.m3 == null ? acc.m3 : Math.round((acc.m3 + m.m3) * 100) / 100,
      any: acc.any || m.tonnes != null || m.m3 != null
    }),
    { tonnes: 0, m3: 0, any: false }
  );

  const count = measurementCount(item);

  return (
    <div
      data-testid="wbs-measurement-block"
      style={{
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: 6,
        padding: 8,
        background: "var(--surface-muted, #FAFAFA)",
        overflowX: "auto"
      }}
    >
      <div style={{ ...labelStyle, marginBottom: 6 }}>Measurements</div>
      <table style={{ borderCollapse: "collapse", width: "auto" }} aria-label="Measurements">
        <thead>
          <tr>
            <th style={blockThStyle}>#</th>
            <th style={blockThStyle}>Waste group</th>
            <th style={blockThStyle}>Waste item</th>
            <th style={blockThStyle}>Material</th>
            <th style={blockThStyle}>L</th>
            <th style={blockThStyle}>H</th>
            <th style={blockThStyle}>D</th>
            <th style={blockThStyle}>Qty</th>
            <th style={blockThStyle}>Sqm</th>
            <th style={blockThStyle}>M³</th>
            <th style={blockThStyle}>Density</th>
            <th style={blockThStyle}>Tonnes</th>
            <th style={{ ...blockThStyle, textAlign: "center" }}>Waste?</th>
            {showCutting ? (
              <th style={{ ...blockThStyle, textAlign: "center" }}>Cutting?</th>
            ) : null}
            <th style={blockThStyle} />
          </tr>
        </thead>
        <tbody>
          <PrimaryMeasurementRow
            key={`${item.id}-measurement-primary`}
            item={item}
            wasteGroupOptions={wasteGroupOptions}
            wasteItemsByGroup={wasteItemsByGroup}
            materialOptions={materialOptions}
            materialDensityMap={materialDensityMap}
            isAi={isAi}
            showCutting={showCutting}
            // Nothing to remove while the item holds a single blank slot —
            // removing it would write the nulls that are already there.
            canRemove={count > 0}
            onRemove={() => onPatch(measurementRemovalPatch(item, 0))}
            onPatch={onPatch}
          />
          {extras.map((entry, index) => (
            <ExtraMeasurementRow
              key={`${item.id}-measurement-${index}`}
              index={index}
              entry={entry}
              materialOptions={materialOptions}
              materialDensityMap={materialDensityMap}
              wasteGroupOptions={wasteGroupOptions}
              wasteItemsByGroup={wasteItemsByGroup}
              disabled={isAi}
              showCutting={showCutting}
              onChange={(patch) => updateMeasurement(index, patch)}
              onRemove={() => onPatch(measurementRemovalPatch(item, index + 1))}
            />
          ))}
        </tbody>
      </table>
      {totals.any ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          Item total: <strong style={{ color: "var(--text)" }}>{totals.tonnes} t</strong>
          {" · "}
          <strong style={{ color: "var(--text)" }}>{totals.m3} m3</strong>
        </div>
      ) : null}
    </div>
  );
}
