import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { OverrideField, TooltipSelect, type TooltipSelectOption } from "../../components";
// SCOPE_PLANT_PICKER_V2 — the grouped-option type comes straight from the
// component file: components/index.ts is outside this slice's scope, so the
// barrel is left exactly as it is rather than re-exporting one more type.
import type { TooltipSelectOptionGroup } from "../../components/TooltipSelect";
// SCOPE_WBS_ACTIONS_V1 — the three expandables. These import only TYPES back
// out of this file, so the cycle is erased at compile time and there is no
// runtime import loop; the discipline gates (showsCuttingColumn /
// isAsbestosCard) are resolved HERE and threaded down as props, which is what
// keeps the rule in one place.
import {
  WbsMeasurementBlock,
  measurementAddPatch,
  measurementCount
} from "./scope-cards/WbsMeasurementBlock";
import { WbsCommentBlock, commentCount } from "./scope-cards/WbsCommentBlock";
import { WbsAcmBlock, acmFactCount } from "./scope-cards/WbsAcmBlock";

// SCOPE_WBS_TABLE_V1 — slice 2 of scope-card-redesign. Replaces the
// loose-field card stack with a table whose identity columns (WBS,
// Description, Markup, Item total) span all rows of a multi-row item.
// Manpower and plant keep their current inputs in the spanning middle
// cell. Measurement fields stay in place until slice 5 moves them.

// SCOPE_WBS_INPUTS_V2 — slice 2 of scope-card-corrections. The row inputs
// are brought back into line with the rate card and with the card they sit
// on: the Day shift is LABELLED Weekday (its stored value is untouched),
// each Type dropdown offers exactly one empty option, both money columns
// are right-aligned and carry cents, changing a role or a shift releases a
// stale rate override, the card's markup is actually passed down instead of
// every row inheriting a silent 0%, and the Cutting tick is gated on the
// same discipline condition that gates the sheet it feeds.

// SCOPE_MANPOWER_PERSIST_V1 — slice 1 of scope-card-persistence. Every
// Manpower field on EVERY row now round-trips through the server instead of
// dying in local state on reload: the labour type, the qty, the days, the
// shift, the day-rate override, and the row count itself.
//
// The store is ScopeOfWorksItem.labourItems (JSONB), landed by the API slice
// SCOPE_ITEM_LABOUR_STORE_V1. It mirrors plantItems exactly, and the server's
// precedence rule is the reason this slice is safe to ship on live data: a
// NON-EMPTY labourItems array wins over the men/days/shift scalars, while
// NULL or [] falls back to them. An item nobody has touched still holds
// labourItems = NULL and still prices from men x days x the discipline's
// default role, to the cent.
//
// Two contracts govern what is sent, both of them the server's, not ours:
//   1. updateItem persists exactly what the DTO carries. A SHORT array
//      REPLACES the stored one, so every write ships EVERY row of the item —
//      see buildLabourItems / manpowerPatchBody below, which is why each
//      handler materialises the whole row list before patching.
//   2. computeScopeItemTotal prices a row from `role` (the rate-card role
//      string), not from `labourTypeId`. The id is stored so the dropdown can
//      re-select on reload; the role is stored because it is what prices.

// SCOPE_ITEM_MARKUP_PERSIST_V1 — slice 3 of scope-card-persistence. The
// per-item Markup % override now round-trips through the server instead of
// painting a cell and moving no money. Before this slice the input wrote to a
// local Map and called no handler at all: the estimator typed 22, the cell
// went amber, the Item total beside it (the server's lineTotalWithMarkup) did
// not move, the card subtotal and the discipline summary bar did not move, and
// the override was gone on the next load.
//
// The store already exists on main and this slice adds NO API change. CARD-API
// SLICE 1 landed all three server pieces: the nullable
// ScopeOfWorksItem.markupOverride Decimal(5,2) column, the optional
// markupOverride on ScopeItemFieldsBase (so the PATCH is no longer dropped by
// validation), and resolveEffectiveMarkup() in scope-item-pricing.ts, which
// listItems already calls as
// `item.markupOverride ?? card.markupOverride ?? tenderMarkup`. What was
// missing was a WRITER. This is the writer.
//
// KNOWN GAP, deliberately not fixed here (out of `scope:`, and this slice is
// forbidden to touch apps/api/): the /scope/summary bucket loop in
// scope-redesign.service.ts still resolves markup as
// `item.card?.markupOverride != null ? ... : tenderMarkup` and does NOT read
// the item's override, so the TENDER-level figure will not move with it. The
// Item total, the card subtotal and the discipline summary bar all will —
// they read listItems, which does. See the PR body.
//
// The null rule that governs the payload is the opposite of the one the two
// slices below follow, and is stated in full at markupPatchBody().

// SCOPE_PLANT_PERSIST_V1 — slice 2 of scope-card-persistence. Every Plant
// field on EVERY row now round-trips through the server instead of dying in
// local state on reload: the machine type, the free-typed custom description,
// the qty, the days and the per-row day rate override.
//
// The store is ScopeOfWorksItem.plantItems (JSONB), which has been on main
// since 20260425_feat_scope_redesign_v2 and needs no schema change: the DTO
// field is `plantItems?: unknown` with @IsArray() and NO element validation,
// and ScopeOfWorksService hands it to Prisma as an InputJsonValue, so an
// extra key on an element persists like the rest. `dayRateOverride` is that
// extra key, and scope-item-pricing.ts already reads it.
//
// Three contracts govern what is sent, all of them the server's:
//   1. updateItem persists exactly what the DTO carries. A SHORT array
//      REPLACES the stored one, so every write ships EVERY row of the item —
//      see buildPlantItems / plantPatchBody below.
//   2. computeScopeItemTotal prices a plant row from `dayRateOverride ??
//      plantRateById[plantRateId]`. A row with neither prices at $0.
//   3. getCardSummary SKIPS any plant entry with no `description`
//      (`if (!p.description) continue`), so `description` is written on
//      every entry — catalogue picks included — not only on custom rows.
//      That is what the legacy PlantCluster did (rate.item -> description)
//      and it is why the card's plant days were correct only through it.
//
// This slice also RETIRES that legacy cluster from the Measurement cell. It
// was retained deliberately as the only plant UI that reached the database;
// now that the columns save, keeping it would show plant twice on row 0.

// SCOPE_PLANT_PICKER_V2 — slice 3 of scope-card-corrections. The plant Type
// dropdown stops being one flat list in API order and becomes the grouped one
// the mock-up shows, and the manual-entry escape hatch is finally emitted.
//
// Two things change and nothing else does:
//   1. The list is GROUPED. The old memo built a category -> rates Map, threw
//      the grouping away, and flattened it back out with the category glued
//      onto every label as `${cat}: ${item}`. It now emits one <optgroup> per
//      category — Excavator, Bobcat, Crane, Truck, Other first (the mock-up's
//      order), then any other category the API returns, appended in the order
//      it first appears. NOTHING IS DROPPED for having an unexpected, empty or
//      null category: EstimatePlantRate.category is `String?` free text with no
//      enum, so the five are a preference, not a guarantee. A null or blank
//      category reads as "Other" (unchanged from before); anything else keeps
//      its own name and gets its own group at the end. The label no longer
//      repeats the category — the group heading carries it.
//   2. The manual-entry option is EMITTED. `__custom__` was handled by the
//      Type onChange handler and put in the list by nobody, so isCustom was
//      never true and the whole custom-plant feature — the free-text name, its
//      revert control and the unlocked rate cell — was unreachable dead code.
//      It is now the final option, under its own trailing "Not in the list"
//      group. This is WIRING, not new behaviour: the existing handler branch
//      is exercised as it stands, and no second branch was written beside it.
//
// What this slice deliberately does NOT touch: isTransportPlant and both of
// its call sites (see the open question in the PR body), and the plant
// PERSISTENCE payload. Picking the manual-entry option routes to the
// onCustomDescription handler SCOPE_PLANT_PERSIST_V1 already wired, so it
// commits through commitPlantRow/plantPatchBody like every other plant edit;
// buildPlantItems sends the same keys it sent before, and `__custom__` itself
// is a UI sentinel that never reaches the wire.

// SCOPE_WBS_ACTIONS_V1 — slice 5 of scope-card-redesign, and the one that
// finishes the WBS table. Two things change.
//
// 1. THE ACTIONS COLUMN. A collapsible column on the far right, rowspan-ed
//    across each item's rows, holding `+ Add another row to this WBS`,
//    `+ Add measurement`, `+ Add comment`, and — on asbestos cards only —
//    `+ Add enclosure / monitoring`. Each button carries a tick and a count
//    once the item has that thing. It is the LAST column on purpose: the
//    header's collapse toggle shrinks it to a single re-open control, and
//    because it sits outside Markup and Item total, collapsing it cannot move
//    the right edge of either money column.
//
// 2. THE THREE EXPANDABLES. Everything the actions column opens renders in one
//    extra <tr> under the item, and NOTHING IS OPEN BY DEFAULT — see
//    NO_BLOCKS_OPEN. An item with nothing in it now shows four buttons and no
//    boxes, where before this slice it showed nine empty measurement fields on
//    row 0 and a permanently-open notes textarea, for every item on the card.
//
// The Measurement block is a RELOCATION, not a new feature, and it is the risk
// in this slice. Every measurement an estimator has already entered must still
// be there, still bound to the same record, and still feeding Waste and
// Cutting exactly as it did — if one stopped reaching the waste aggregator
// because it now lives behind a disclosure, the tender price would change and
// nobody would see it happen. So the fields moved WITHOUT their handlers or
// their payloads changing: the item's own measurement still writes the flat
// columns, measurements 2..N still write `materials[]`, and the derived
// columns are still derived by computeDerivedDimensions, untouched. The proof
// is wbs-expandables.test.tsx, which prices a card of three measurements
// across two items before and after the round trip through the new shape and
// asserts the two figures are identical.
//
// What this slice does NOT do: no API route, service method, DTO, schema or
// migration; no change to ScopeWasteTab, the cutting take-off, or /sot/. The
// ACM block's four fields are existing columns with an existing DTO and an
// existing PATCH — see WbsAcmBlock.tsx — and this slice supplies the writer
// they never had.

// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
export type Discipline = "DEM" | "CIV" | "ASB" | "Other";

// PR B1.6 — Plant cells live on ScopeOfWorksItem.plantItems as a dense
// array with explicit columnIndex.
//
// SCOPE_PLANT_PERSIST_V1 — the array is now the store for the Plant COLUMN
// GROUP, one entry per rendered row, and `columnIndex` keeps the 1-based
// numbering the legacy cluster allocated (row 0 -> columnIndex 1) so an
// entry written by the new columns is shape-identical to one written by the
// old cluster. Nothing on the server reads columnIndex; the web reads it to
// order the entries when adopting them into rows.
//
// Field types are widened from `string`/`number` to `| null` because the new
// write path states absence explicitly rather than by omitting a key: a row
// with no machine picked sends `plantRateId: null`, not a missing key.
export type ScopePlantEntry = {
  columnIndex: number;
  plantRateId?: string | null;
  description?: string | null;
  qty?: number | null;
  days?: number | null;
  unit?: string | null;
  /**
   * SCOPE_PLANT_PERSIST_V1 — per-row $/day override. null = use the
   * catalogue rate; a stored 0 is a real override the server honours
   * (scope-item-pricing.ts: `cell.dayRateOverride != null && isFinite(...)`).
   * It is also the ONLY way a free-typed custom machine prices at all.
   */
  dayRateOverride?: number | null;
};

// SCOPE_MANPOWER_PERSIST_V1 — one row of ScopeOfWorksItem.labourItems.
//
// Field-for-field the shape the API slice documented on the column and reads
// in scope-item-pricing.ts (ScopeLabourEntryInput): every key optional there,
// every key written explicitly here so a partially-filled row is never
// ambiguous on the wire.
//
//   rowIdx          position in the item's row list (0-based, dense).
//   labourTypeId    EstimateLabourRate.id — display identity, re-selects the
//                   Type dropdown on reload. NOT what the server prices from.
//   role            the rate-card role string. THIS is what the server prices
//                   from (labourRateForRow -> labourRateByRoleShift). null =
//                   no role picked, and the server falls back to the
//                   discipline's default role, which is exactly the legacy
//                   men/days behaviour.
//   shift           stored value: "Day" | "Night" | "Weekend" (never the
//                   "Weekday" LABEL — see shiftLabel).
//   qty             headcount for this row.
//   days            days for this row.
//   dayRateOverride per-row $/day. null = use the catalogue rate; a stored 0
//                   is a real override the server honours.
export type ScopeLabourEntry = {
  rowIdx: number;
  labourTypeId: string | null;
  role: string | null;
  shift: string | null;
  qty: number | null;
  days: number | null;
  dayRateOverride: number | null;
};

// PR feat/scope-multi-material — additional material row on a scope item.
// Row 1 stays on the flat materialType + L/H/D + density/sqm/m3/tonnes
// columns of ScopeOfWorksItem; entries in `materials` are rows 2..N and
// carry the same shape/units. The item's total tonnes/m3 is the SUM
// across row 1 + every entry here.
export type ScopeMaterialEntry = {
  material?: string | null;
  // PR feat/scope-each-factor — kind drives formula; quantity for EACH;
  // factor for FACTOR.
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: number | null;
  factor?: number | null;
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null;
  m3?: number | null;
  tonnes?: number | null;
  // PR feat/scope-material-inline-waste — waste classification moved
  // per-material so a mixed item can attribute each material's tonnage
  // to a different (wasteGroup, wasteItem). Material 1 uses the item's
  // flat wasteGroup/wasteItem/wasteIncluded/cuttingIncluded columns;
  // Material 2..N carry their own here.
  wasteGroup?: string | null;
  wasteItem?: string | null;
  wasteIncluded?: boolean;
  cuttingIncluded?: boolean;
};

export type ScopeItem = {
  id: string;
  tenderId: string;
  cardId: string | null;
  wbsCode: string;
  itemNumber: number;
  description: string;
  status: "draft" | "confirmed" | "excluded";
  aiProposed: boolean;
  aiConfidence: string | null;
  sortOrder: number;
  notes: string | null;
  men: string | null;
  days: string | null;
  // SCOPE_WBS_MANPOWER_V1 — shift is an existing DB field surfaced in
  // the Shift column of the manpower group. Nullable; null falls back to
  // "Day" (the server default). Stored values: "Day" | "Night" | "Weekend".
  // SCOPE_WBS_INPUTS_V2 — the stored value "Day" is LABELLED "Weekday" in
  // the dropdown to match the rate card. The value on the wire is unchanged;
  // see SHIFT_OPTIONS / shiftLabel below.
  shift?: string | null;
  // @deprecated PR B4a — legacy canonical fields; no longer surfaced
  // or written. Retained on the type so the listItems response still
  // parses cleanly for old rows.
  unit: string | null;
  value: string | null;
  wasteGroup: string | null;
  wasteItem: string | null;
  wasteIncluded: boolean;
  // PR B4a — dimension/quantification fields. sqm/m3/tonnes are
  // derived server-side; the user can override any of the three by
  // typing directly. chargeBy is the preferred billing unit for the
  // waste aggregator (null = inherit facility rate.unit).
  // cuttingIncluded mirrors wasteIncluded for the cutting subtable
  // (aggregator wired in B4b; UI shipped in B4a).
  length: string | null;
  height: string | null;
  depth: string | null;
  sqm: string | null;
  m3: string | null;
  density: string | null;
  tonnes: string | null;
  chargeBy: string | null;
  materialType: string | null;
  cuttingIncluded: boolean;
  // SCOPE_WBS_ACTIONS_V1 — the asbestos block's four fields. Every one of them
  // is an EXISTING column on ScopeOfWorksItem (schema.prisma, "// Asbestos"),
  // an EXISTING optional field on ScopeItemFieldsBase, and already mapped by
  // ScopeOfWorksService — listItems spreads the whole row, so they come back
  // on every read. They were simply never surfaced on this type because
  // nothing in the web read them. No API change is made by declaring them.
  // Optional and nullable because that is what they are: an item nobody has
  // classified reads back null, which is not the same statement as false.
  acmType?: string | null;
  acmMaterial?: string | null;
  enclosureRequired?: boolean | null;
  airMonitoring?: boolean | null;
  plantItems: ScopePlantEntry[] | null;
  // SCOPE_MANPOWER_PERSIST_V1 — the per-row manpower store. Optional and
  // nullable because it genuinely is: every item written before the
  // labour_items column existed reads back NULL, and NULL is the signal to
  // fall back to the men/days/shift scalars above rather than a missing value
  // to paper over. Never write [] here (see manpowerPatchBody).
  labourItems?: ScopeLabourEntry[] | null;
  // PR feat/scope-multi-material — rows 2..N (row 1 lives on the flat
  // dimension columns above). Null/undefined = no extra materials.
  materials?: ScopeMaterialEntry[] | null;
  // PR feat/scope-each-factor — row-1 kind/quantity/factor.
  materialKind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: string | null;
  factor?: string | null;
  // SCOPE_ITEM_MARKUP_PERSIST_V1 — the per-item markup % override as the
  // server stores it. Optional and nullable because NULL is a real, reachable
  // and MEANINGFUL state: null = "inherit the card's markup (then the
  // tender's)", which is what every item written before the markup_override
  // column existed reads back as, and what clearing the box writes again.
  // 0 is NOT that state — it is a stated 0% override. Arrives as a
  // Decimal(5,2), which serialises over the wire as a string, so the type
  // admits both and itemMarkupFromItem() is the only thing that reads it.
  markupOverride?: string | number | null;
  estimateItemId: string | null;
  provisionalAmount: string | null;
  // PR B1.7.1 — per-row totals computed server-side in listItems.
  // Both fields are optional so older API responses don't break the
  // type; the header renders "—" when either is null/undefined.
  lineTotal?: number | string | null;
  lineTotalWithMarkup?: number | string | null;
};

// PR B1.7 — actual shape from GET /estimate-rates/plant matches the
// EstimatePlantRate model. The previous PR B1.6 type used fictional
// field names (name/category/ratePerDay) which caused empty options.
type PlantRate = {
  id: string;
  item: string;
  unit: string;
  rate: string;
  fuelRate: string;
  isActive: boolean;
  category: string | null;
};

// SCOPE_WBS_MANPOWER_V1 — shape from GET /estimate-rates/labour.
// dayRate is the per-man-day rate for this labour role. Used as the
// placeholder in the Day rate override cell and as the resolved rate
// when no override is active. The existing endpoint is consumed without
// any modification to the route, service, or DTO.
type LabourRate = {
  id: string;
  role: string;
  dayRate: string | number;
  nightRate: string | number;
  weekendRate: string | number;
  isActive: boolean;
  sortOrder: number;
};

// Transport items (trucks, tipper, floats) are moving to a separate
// "Transport Fees" surface. Exclude them from the plant picker.
// Trucks/tipper have category === "Truck"; plant floats have unit === "each way".
function isTransportPlant(p: PlantRate): boolean {
  return p.category === "Truck" || p.unit === "each way";
}

type WasteRate = {
  id: string;
  wasteGroup: string | null;
  wasteType: string;
  facility: string;
  unit: string;
  isActive: boolean;
};

type MaterialDensityRate = {
  id: string;
  materialName: string;
  density: string;
  unit: string;
  // PR feat/scope-each-factor — kind drives which formula is used.
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  category: string | null;
  // PR feat/scope-material-waste-autofill — default waste classification.
  // When present, the scope row's wasteGroup/wasteItem are auto-set from
  // these when the user picks the material, and the pickers are hidden.
  defaultWasteGroup?: string | null;
  defaultWasteItem?: string | null;
  isActive: boolean;
};

// Lookup shape used by the material dropdowns to derive density + waste
// defaults in a single map read.
// SCOPE_WBS_ACTIONS_V1 — exported because the material dropdowns now live in
// WbsMeasurementBlock. Same shape, same single map read; the map itself is
// still built here, once, and threaded down.
export type MaterialLookup = {
  density: string;
  unit: string;
  kind: "VOLUME" | "AREA" | "EACH" | "FACTOR";
  defaultWasteGroup: string | null;
  defaultWasteItem: string | null;
};

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#DCFCE7", fg: "#166534", label: "High" },
  medium: { bg: "#FEF3C7", fg: "#854F0B", label: "Medium" },
  low: { bg: "#FEE2E2", fg: "#991B1B", label: "Low" }
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

// ── Table layout helpers ─────────────────────────────────────────────────
// SCOPE_WBS_TABLE_V1 — AutoFit layout rule from the mock-up.
// "AutoFit to contents" then "AutoFit to window": every column shrinks
// to its content, the description column takes the slack.
const subtblStyle: CSSProperties = {
  width: "100%",
  tableLayout: "auto",
  borderCollapse: "collapse",
  fontSize: 13
};

// Fit cells shrink to content; description cells expand (no fit class).
const fitCellStyle: CSSProperties = {
  width: "1%",
  whiteSpace: "nowrap",
  padding: "6px 8px",
  verticalAlign: "top"
};

const descCellStyle: CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top"
};

const thStyle: CSSProperties = {
  ...fitCellStyle,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  borderBottom: "1px solid var(--border-default, #e5e7eb)",
  textAlign: "left"
};

const thDescStyle: CSSProperties = {
  ...descCellStyle,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  borderBottom: "1px solid var(--border-default, #e5e7eb)",
  textAlign: "left"
};

const tdBorderStyle: CSSProperties = {
  borderBottom: "1px solid var(--border-default, #e5e7eb)"
};

// ── SCOPE_WBS_GROUPRULES_V1 — group chrome ───────────────────────────────
// Seventeen columns with no boundary read as one wall. The mock-up boxes
// each group title, rules the first column of every group, and colours the
// two group titles from the brand tokens.
//
// The rule reuses the table's existing border declaration rather than
// re-stating a colour, so no new colour literal enters this file.
const GROUP_RULE_BORDER = String(tdBorderStyle.borderBottom);

/** Left rule marking the first column of a column group. */
const groupRuleStyle: CSSProperties = {
  borderLeft: GROUP_RULE_BORDER
};

/** Boxed group-title header cell (Manpower / Plant). */
const groupTitleStyle: CSSProperties = {
  ...thStyle,
  textAlign: "center",
  border: GROUP_RULE_BORDER
};

/** Manpower group title — brand primary, per the mock-up. */
const manpowerGroupTitleStyle: CSSProperties = {
  ...groupTitleStyle,
  color: "var(--brand-primary)"
};

/** Plant group title — brand accent (dark), per the mock-up. */
const plantGroupTitleStyle: CSSProperties = {
  ...groupTitleStyle,
  color: "var(--brand-accent-dark)"
};

// The lower header row is pinned to the top of the scroll container. It
// needs an opaque surface or the body rows show through it; --surface-card
// is the card the table sits on.
const stickyHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "var(--surface-card)"
};

/** Pinned fit-width column header. */
const stickyThStyle: CSSProperties = { ...thStyle, ...stickyHeaderStyle };

/** Pinned description column header (expands, no fit width). */
const stickyThDescStyle: CSSProperties = { ...thDescStyle, ...stickyHeaderStyle };

// ── Exported pure helpers (tested by wbs-table-shell.test.tsx) ───────────

/**
 * SCOPE_WBS_ACTIONS_V1 — how many columns a WBS row has, and therefore how far
 * the expandable row underneath it must span.
 *
 *   WBS 1 + Description 1 + Manpower 6 + Plant 5 + Markup 1 + Item total 1
 *   + Actions 1 = 16.
 *
 * A colSpan that is short leaves a gap the blocks fall out of; one that is
 * long widens the table by a phantom column, which moves the money columns'
 * right edge — the exact thing the collapse is not allowed to do. Named here
 * so the number is stated once and can be asserted against the header.
 */
export const WBS_COLUMN_COUNT = 16;

/** True when an item with rowCount rows should show the per-row remove button. */
export function shouldShowPerRowRemove(rowCount: number): boolean {
  return rowCount > 1;
}

// ── SCOPE_WBS_GROUPRULES_V1 — index-aware row removal ───────────────────
// The old handler decremented the item's row count, so the LAST row
// disappeared whichever `x` was pressed. These helpers remove the row that
// was actually clicked. Row state is local (keyed `${itemId}:${rowIdx}`),
// so removing row i means every row after i shifts down one place — a
// splice of the key space, not a truncation. Nothing here touches the
// server; persistence is a separate cluster.

/** True when rowIdx identifies a removable row of an item with rowCount rows. */
export function canRemoveRowAt(rowCount: number, rowIdx: number): boolean {
  if (!Number.isInteger(rowIdx)) return false;
  return rowCount > 1 && rowIdx >= 0 && rowIdx < rowCount;
}

/** Row count after removing rowIdx. Unchanged when the removal is not legal. */
export function nextRowCountAfterRemove(rowCount: number, rowIdx: number): number {
  return canRemoveRowAt(rowCount, rowIdx) ? rowCount - 1 : rowCount;
}

/**
 * Re-key a per-row local-state map after row `removedIdx` of `itemId` goes.
 * Rows above the removed index move down one slot and the now-vacant top
 * slot is dropped. Other items' keys are carried through untouched.
 * Returns a new Map; the argument is not mutated.
 */
export function spliceRowState<T>(
  rows: Map<string, T>,
  itemId: string,
  removedIdx: number,
  rowCount: number
): Map<string, T> {
  const next = new Map(rows);
  if (!canRemoveRowAt(rowCount, removedIdx)) return next;
  for (let i = removedIdx; i < rowCount - 1; i += 1) {
    const above = rows.get(`${itemId}:${i + 1}`);
    if (above === undefined) next.delete(`${itemId}:${i}`);
    else next.set(`${itemId}:${i}`, above);
  }
  next.delete(`${itemId}:${rowCount - 1}`);
  return next;
}

/** True when a markup value differs from the card default (override active). */
export function isMarkupOverridden(
  localMarkup: number | null,
  cardMarkup: number
): boolean {
  return localMarkup !== null && localMarkup !== cardMarkup;
}

/** Compute the effective markup for display: local override or card default. */
export function effectiveMarkup(
  localMarkup: number | null,
  cardMarkup: number
): number {
  return localMarkup !== null ? localMarkup : cardMarkup;
}

/**
 * SCOPE_WBS_INPUTS_V2 — the markup a WBS row inherits when it has no override
 * of its own. This is the middle link of the chain the card already states in
 * words ("Inherits tender markup (N%)") but never handed to the table:
 *
 *     item override  ->  card override  ->  tender markup  ->  0
 *      (effectiveMarkup)   (here)            (here)
 *
 * Zero is a real override at every link. A card explicitly set to 0% inherits
 * 0%, not the tender's 8%; a tender genuinely on 0% resolves to 0%. Only
 * null/undefined — and a non-finite number, which is what an empty or garbled
 * input parses to — count as absence and fall through to the next link.
 *
 * The final 0 is the floor for a tender whose markup has not loaded yet; it is
 * reached only when neither link supplied a number, never by a stated zero.
 */
export function resolveCardMarkup(
  cardOverride: number | null | undefined,
  tenderMarkup: number | null | undefined
): number {
  if (typeof cardOverride === "number" && Number.isFinite(cardOverride)) return cardOverride;
  if (typeof tenderMarkup === "number" && Number.isFinite(tenderMarkup)) return tenderMarkup;
  return 0;
}

// ── SCOPE_ITEM_MARKUP_PERSIST_V1 exported pure helpers ──────────────────────
// (tested by wbs-item-markup-persist.test.tsx)
//
// Slice 3 of scope-card-persistence. Until this slice the Markup % cell wrote
// to a local Map and called no server handler: the cell went amber, the item
// total beside it did not move, and the override was gone on the next load.
//
// The store it writes to already exists on main — ScopeOfWorksItem
// .markupOverride Decimal(5,2)?, the optional markupOverride on
// ScopeItemFieldsBase, and resolveEffectiveMarkup() in scope-item-pricing.ts,
// all landed by CARD-API SLICE 1. This slice adds the WRITER and nothing else;
// it changes no API file.
//
// THE NULL RULE, which is the whole slice and is the OPPOSITE of the rule
// SCOPE_MANPOWER_PERSIST_V1 and SCOPE_PLANT_PERSIST_V1 follow:
//
//   Those two write a blank box as a real 0, because the server reads an
//   ABSENT qty as 1 (`qty == null ? 1`) — there, null is a default the user
//   never asked for, so sending it would invent a quantity.
//
//   Markup is the other case. `resolveEffectiveMarkup(item, card, tender)` is
//   `item.markupOverride ?? card.markupOverride ?? tenderMarkup`, so on THIS
//   column null is not a default that stands in for a missing answer — it is
//   the answer "inherit", and it is a state the estimator can actually want
//   and actually reach, by clearing the box. Writing 0 there would pin the row
//   at 0% markup and read as deliberate.
//
//   blank -> null (inherit)      0 -> 0 (a stated 0% override)
//
// Both slices are the same underlying rule — send what the estimator meant,
// and state absence explicitly rather than by omission — applied to columns
// whose nulls mean different things.

/**
 * Read the item's STORED markup override.
 *
 * The server's answer, not the local map: this is what makes a reload render
 * the override instead of losing it. Returns null for "inherit" and a number
 * for an override, INCLUDING 0 — `??` is deliberate and `||` would be a bug,
 * because a stored 0 is a 0% override and must not fall through to the card.
 *
 * The value arrives as a Decimal(5,2) serialised to a string ("22", "12.50"),
 * so a string is parsed rather than compared; anything unparseable is treated
 * as absence, which prices exactly as the row priced before.
 */
export function itemMarkupFromItem(item: { markupOverride?: string | number | null }): number | null {
  const raw = item.markupOverride;
  if (raw === null || raw === undefined) return null;
  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse what the estimator typed into the Markup box into what gets stored.
 *
 * "" (the cleared box) -> null, meaning inherit. "0" -> 0, a stated override.
 * Those are different numbers and only one of them is what the estimator
 * meant, so they take different branches here and nowhere else.
 *
 * A garbled value ("--", "1e999") is absence rather than a guess: it parses
 * non-finite, and pinning a row's margin on a typo is worse than leaving it
 * inheriting.
 */
export function parseMarkupInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * True when the row carries an override of its OWN, as opposed to inheriting.
 *
 * Identity, not comparison — `stored != null`. This is what
 * isMarkupOverridden() cannot answer once the value is persisted, and the two
 * disagree in both directions on purpose:
 *
 *   stored 0 against a card on 0%  -> overridden here, "not overridden" there
 *   stored 22 against a card on 22% -> overridden here, "not overridden" there
 *
 * The second case is the one that costs money. An item deliberately pinned at
 * 22% while the card happens to also be on 22% is still pinned: move the card
 * to 30% and the item must stay at 22%. A value comparison would have called
 * it "inheriting", hidden the revert control, and quietly let the row drift
 * with the card.
 *
 * isMarkupOverridden() and effectiveMarkup() are NOT changed by this slice —
 * they are the display helpers SCOPE_WBS_TABLE_V1 shipped and
 * wbs-table-shell.test.tsx and wbs-inputs-money-inheritance.test.tsx pin them
 * to their value-comparison semantics. This is the persistence question, and
 * it is a different question.
 */
export function isStoredMarkupOverride(stored: number | null): boolean {
  return stored !== null;
}

/**
 * The PATCH body for a markup edit. THIS is the payload of this slice.
 *
 * Sends exactly ONE key, `markupOverride`, and ALWAYS sends it — including
 * when the value is null. That is the point: the key's absence is meaningful
 * on the other side. updateItem reads
 *
 *   dto.markupOverride !== undefined ? toDecimal(narrowToNumber(...)) : undefined
 *
 * so an OMITTED key leaves the stored value untouched, and there would then be
 * no way to clear an override at all. `JSON.stringify` drops undefined and
 * keeps null, so null is the only spelling of "clear this" that survives the
 * wire.
 *
 *   null -> narrowToNumber(null) = null -> toDecimal(null) = null -> NULL
 *   0    -> narrowToNumber(0)    = 0    -> toDecimal(0) = Decimal(0) -> 0.00
 *
 * Nothing else belongs in this body. The manpower and plant writers send whole
 * arrays for their own columns; a markup write that also carried labourItems
 * or plantItems could only overwrite them with a staler copy.
 */
export function markupPatchBody(value: number | null): Record<string, unknown> {
  return { markupOverride: value };
}

/**
 * SCOPE_WBS_INPUTS_V2 — true when the Cutting? tick should render for a card
 * of this discipline. It is the SAME condition ScopeCardsTab uses to decide
 * whether to render <ScopeCuttingSheet> at all; on an ASB card the sheet the
 * tick feeds does not exist, so the tick has nowhere to be priced.
 *
 * Render-gate only. A cuttingIncluded value already stored against an ASB item
 * is left exactly as it is — clearing it is a data change and belongs to the
 * persistence cluster.
 */
export function showsCuttingColumn(discipline: Discipline): boolean {
  return discipline !== "ASB";
}

/**
 * SCOPE_WBS_ACTIONS_V1 — true when the card is an asbestos card.
 *
 * The sibling of showsCuttingColumn above, and its exact inverse today. It
 * exists so that the two asbestos-only pieces this slice adds — the ACM block
 * and the `+ Add enclosure / monitoring` button that opens it — ask the
 * question in the positive without any file restating the discipline code.
 * There is NO per-discipline capability flag anywhere in the ERP (Discipline
 * is the four-value string union at the top of this file and carries no
 * fields), so "which cards cut" and "which cards are asbestos" are decided in
 * these two functions and nowhere else. A fifth discipline that cuts and
 * handles ACM would be added by editing these two, not by hunting literals.
 */
export function isAsbestosCard(discipline: Discipline): boolean {
  return discipline === "ASB";
}

// ── SCOPE_WBS_ACTIONS_V1 — the expandable blocks ─────────────────────────

/** The three expandable blocks an item's actions column can open. */
export type WbsBlockKey = "measurement" | "comment" | "acm";

/** Which of an item's blocks are open. */
export type WbsOpenBlocks = { measurement: boolean; comment: boolean; acm: boolean };

/**
 * The state every item starts in, and the answer for any item the map has
 * never heard of.
 *
 * NOTHING OPENS BY DEFAULT. That is the rule this constant enforces and it is
 * the whole point of the slice: an item with nothing in it shows its action
 * buttons and no boxes. Frozen so a caller cannot make it lie by mutating the
 * shared default in place.
 */
export const NO_BLOCKS_OPEN: WbsOpenBlocks = Object.freeze({
  measurement: false,
  comment: false,
  acm: false
});

/** Key: itemId → which of that item's blocks are open. Absent = none. */
export type ItemOpenBlocks = Map<string, WbsOpenBlocks>;

/** Which blocks are open for one item. An unknown item has none open. */
export function openBlocksFor(map: ItemOpenBlocks, itemId: string): WbsOpenBlocks {
  return map.get(itemId) ?? NO_BLOCKS_OPEN;
}

/** Flip one block of one item, leaving every other item and block alone. */
export function toggleBlock(
  map: ItemOpenBlocks,
  itemId: string,
  key: WbsBlockKey
): ItemOpenBlocks {
  const current = openBlocksFor(map, itemId);
  const next = new Map(map);
  next.set(itemId, { ...current, [key]: !current[key] });
  return next;
}

/**
 * Open one block of one item. Used by the `+ Add …` buttons, which both add
 * the thing and reveal it — an add that left the box shut would look like it
 * had done nothing.
 */
export function openBlock(map: ItemOpenBlocks, itemId: string, key: WbsBlockKey): ItemOpenBlocks {
  const current = openBlocksFor(map, itemId);
  if (current[key]) return map;
  const next = new Map(map);
  next.set(itemId, { ...current, [key]: true });
  return next;
}

/** True when any of an item's blocks is open (the item needs its extra row). */
export function hasOpenBlock(blocks: WbsOpenBlocks): boolean {
  return blocks.measurement || blocks.comment || blocks.acm;
}

// ── Component state types ────────────────────────────────────────────────

/** Per-item row count (slice 2 shell: stored in local state). */
type ItemRowCounts = Map<string, number>;

/** Per-item local markup override (null = inheriting card default). */
type ItemMarkupOverrides = Map<string, number | null>;

// SCOPE_WBS_MANPOWER_V1 — per-row manpower local state.
// SCOPE_MANPOWER_PERSIST_V1 — this is now the OPTIMISTIC mirror of one
// labourItems entry, not the only copy. Every field on it is written through
// to the server by commitManpowerRow; the map is what the cell renders while
// the PATCH is in flight and what onItemsChanged() then reconciles against.
// Row 0 no longer reads item.men / item.days / item.shift directly at the
// cell: defaultManpowerRow seeds row 0 from those scalars when the item has
// no stored labour rows, so the fallback lives in exactly one place.
//
// Exported (with ItemManpowerRows) so the persistence helpers below can be
// unit-tested against the real state shape rather than a stand-in.
export type RowManpowerState = {
  /** Selected labour rate id (null = "- none -"). Display identity only. */
  labourTypeId: string | null;
  /**
   * SCOPE_MANPOWER_PERSIST_V1 — the rate-card role string for labourTypeId.
   * Carried in row state because it is what the SERVER prices from
   * (labourRateForRow keys on `${role}:${shift}`); the id means nothing to
   * pricing. Kept in step with labourTypeId by the Type-change handler, and
   * hydrated straight off the stored row on reload, so a rates fetch that
   * fails can never silently rewrite a saved role to null.
   */
  role: string | null;
  /** User-entered day rate override in $. Null = use catalogue rate. */
  dayRateOverride: number | null;
  /** Qty (men) for this row. Row 0 seeds from item.men. */
  qty: string;
  /** Days for this row. Row 0 seeds from item.days. */
  days: string;
  /**
   * Shift for this row. Row 0 seeds from item.shift.
   * Stored values are "Day" | "Night" | "Weekend"; SCOPE_WBS_INPUTS_V2
   * renders the "Day" value with the label "Weekday" (rate-card wording).
   */
  shift: string;
};

/** Key: `${itemId}:${rowIdx}` → per-row manpower state. */
export type ItemManpowerRows = Map<string, RowManpowerState>;

// SCOPE_WBS_PLANT_V1 — per-row plant local state.
// Slice 4 stored Type (plantRateId or custom description), Day-rate override,
// Qty, and Days in local state. Each row is keyed by `${itemId}:${rowIdx}`.
// Custom plant (no plantRateId) has no locked rate; its Day rate cell is an
// override by definition with placeholder "rate".
//
// SCOPE_PLANT_PERSIST_V1 — this is now the OPTIMISTIC MIRROR of one
// plantItems entry, not the only copy. Every field on it is written through
// to the server by commitPlantRow; the map is what the cell renders while the
// PATCH is in flight and what onItemsChanged() then reconciles against. A key
// that is missing falls through to defaultPlantRow, which reads the stored
// entry at that index.
//
// Exported (with ItemPlantRows) so the persistence helpers below can be
// unit-tested against the real state shape rather than a stand-in.
export type RowPlantState = {
  /** Selected plant rate id from catalogue (null = no catalogue pick). */
  plantRateId: string | null;
  /** Free-typed custom machine name when the estimator drops out of the list. */
  customDescription: string | null;
  /**
   * SCOPE_PLANT_PERSIST_V1 — the machine's NAME as it is stored on the entry.
   * Carried in row state for exactly the reason RowManpowerState carries
   * `role`: the server reads it and the id alone does not carry it.
   * getCardSummary skips any entry with a falsy `description`, so a catalogue
   * pick that shipped only a plantRateId would price correctly and still be
   * invisible to the card's plant days. For a catalogue row this is the
   * catalogue item name; for a custom row it is the free-typed text.
   */
  description: string | null;
  /**
   * SCOPE_PLANT_PERSIST_V1 — the catalogue rate unit ("day", "hr", ...) as
   * the legacy cluster wrote it. Nothing prices from it, but a legacy entry
   * carries it and adopting a row must not silently drop what is already
   * stored, so it round-trips.
   */
  unit: string | null;
  /** User-entered day rate override in $. Null = use catalogue rate. */
  dayRateOverride: number | null;
  /** Qty for this row. */
  qty: string;
  /** Days for this row. */
  days: string;
};

/** Key: `${itemId}:${rowIdx}` → per-row plant state. */
export type ItemPlantRows = Map<string, RowPlantState>;

// ── SCOPE_WBS_MANPOWER_V1 exported pure helpers (tested by wbs-manpower-columns.test.tsx) ──

/**
 * Shift options for the Shift dropdown in the Manpower column group.
 *
 * These are the STORED values. They are the strings `patchItem` sends and the
 * strings `resolveRateForShift` matches on, so they must not change: rows on
 * main already hold the literal "Day" and renaming the value would orphan them
 * (TooltipSelect selects by value — an unmatched value falls through to the
 * blank option and silently reads as unset).
 */
export const SHIFT_OPTIONS = ["Day", "Night", "Weekend"] as const;
export type ShiftOption = (typeof SHIFT_OPTIONS)[number];

/**
 * SCOPE_WBS_INPUTS_V2 — display label for a stored shift value.
 *
 * The rate card calls the ordinary shift "Weekday"; the column stores it as
 * "Day". Splitting label from value fixes the wording without touching a
 * single stored string: a row saved before this PR still holds "Day", still
 * matches an option, and still sends "Day" on its next shift change — it just
 * reads "Weekday" on screen.
 *
 * Any value with no entry here is returned unchanged, so an unrecognised
 * stored shift stays visible rather than rendering blank.
 */
const SHIFT_LABELS: Record<string, string> = { Day: "Weekday" };

export function shiftLabel(value: string): string {
  return SHIFT_LABELS[value] ?? value;
}

/**
 * True when a day-rate value is considered overridden (user typed a value
 * different from the catalogue rate).
 * Both values must be finite numbers to compare; null override → not overridden.
 */
export function isDayRateOverridden(
  override: number | null,
  catalogueRate: number | null
): boolean {
  if (override === null) return false;
  if (catalogueRate === null) return true;
  return override !== catalogueRate;
}

/**
 * Effective day rate for display: the local override when active,
 * otherwise the catalogue rate for the selected labour type (null = no type).
 */
export function effectiveDayRate(
  override: number | null,
  catalogueRate: number | null
): number | null {
  if (override !== null) return override;
  return catalogueRate;
}

/**
 * WBS-SHIFT-S1: Given the three catalogue rates for a labour type and the
 * shift the estimator picked, return the applicable rate as a number.
 *
 * Shift matching is case-sensitive against the SHIFT_OPTIONS values
 * ("Day" | "Night" | "Weekend"). Any absent, null, or unrecognised shift
 * defaults to the day rate so an unset shift behaves identically to today.
 *
 * Export so it can be unit-tested without rendering.
 */
export function resolveRateForShift(
  rates: { day: number; night: number; weekend: number } | null | undefined,
  shift: string | null | undefined
): number | null {
  if (rates == null) return null;
  if (shift === "Night") return rates.night;
  if (shift === "Weekend") return rates.weekend;
  // "Day", null, undefined, or any unrecognised value all fall back to day rate.
  return rates.day;
}

/**
 * SCOPE_WBS_INPUTS_V2 — the local row-state patch a role or shift change
 * carries. Both release the row's stale day-rate override.
 *
 * This is not a new rule. onPlantTypeChange already writes
 * `{ plantRateId, customDescription: null, dayRateOverride: null }` — the
 * manpower side simply never did the same, so a rate typed against one role
 * stayed on screen after the role changed to another, and a rate typed for the
 * Weekday shift survived onto Night even though the catalogue rate is
 * shift-resolved. Both are stale by construction: the number on screen was
 * derived from a locked rate that is no longer the row's locked rate.
 *
 * Releasing means dropping back to the fallback (the catalogue rate for the new
 * role/shift), not writing a zero — `dayRateOverride: null` is absence, and
 * effectiveDayRate(null, catalogueRate) returns the catalogue rate exactly.
 *
 * Local state only: no patchItem call is added, removed or re-pointed here.
 */
export type ManpowerCascadePatch = {
  labourTypeId?: string | null;
  shift?: string;
  /** Always null — the cascade releases, it never substitutes a value. */
  dayRateOverride: null;
};

/** Row-state patch for a labour-role change: set the role, release the override. */
export function manpowerPatchForTypeChange(typeId: string | null): ManpowerCascadePatch {
  return { labourTypeId: typeId, dayRateOverride: null };
}

/** Row-state patch for a shift change: set the shift, release the override. */
export function manpowerPatchForShiftChange(shift: string): ManpowerCascadePatch {
  return { shift, dayRateOverride: null };
}

/**
 * Manpower row total for the read-only Total cell.
 * Returns null (renders as "—") when any of qty/days/rate are absent
 * or the row has no type set.
 */
export function manpowerRowTotal(
  qty: number | null,
  days: number | null,
  dayRate: number | null
): number | null {
  if (qty === null || days === null || dayRate === null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(days) || !Number.isFinite(dayRate)) return null;
  return qty * days * dayRate;
}

/**
 * Render a manpower total as currency or an em dash when absent.
 *
 * SCOPE_WBS_INPUTS_V2 — money in this column carries cents. Both the minimum
 * and the maximum are pinned to 2: raising only the maximum renders $1,234.5
 * for a total of 1234.5, which is not a money string. A null total is still
 * the em dash and must never become "$0.00" — an unset row has no total, and
 * a genuinely zero total ($0.00) is a different statement.
 */
export function fmtManpowerTotal(total: number | null): string {
  if (total === null) return "—"; // em dash
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(total);
}

// ── SCOPE_MANPOWER_PERSIST_V1 exported pure helpers ─────────────────────────
// (tested by wbs-manpower-persist.test.tsx)
//
// Everything that decides WHAT GOES ON THE WIRE lives here as a pure function
// of row state. The component only decides WHEN to call it. That split is
// deliberate: the payload shape is the whole risk in this slice — the server
// contract is already merged and is the authority — so the payload is testable
// without a render, a fetch or a database.

/**
 * Parse a row-state number input to `number | null`.
 *
 * Empty string and anything non-finite are null (absent). Used for the
 * men / days SCALARS, where null-on-blank is the exact expression the
 * component has always sent and changing it would rewrite stored data.
 */
export function manpowerNumOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a row-state number input to a number, treating blank as 0.
 *
 * Used for the qty/days INSIDE labourItems, and the difference from
 * manpowerNumOrNull is load-bearing money, not style:
 *
 * scope-item-pricing.ts prices a row as `qty = row.qty == null ? 1 : n(row.qty)`
 * — an ABSENT qty means "the estimator picked a role but typed no headcount"
 * and defaults to ONE person. A blank Qty box is not that. On screen a blank
 * Qty renders the row total as an em dash (manpowerRowTotal returns null), and
 * on the legacy scalar path a null `men` prices as `n(null) = 0`. Sending null
 * would make the server disagree with both — a shift change on a row with days
 * but no qty would silently add a person's worth of money. Sending 0 says what
 * the blank box says: no men costed. The server documents a stored 0 as a real
 * value, so this is the supported way to state it.
 */
export function manpowerNumOrZero(raw: string): number {
  const n = Number(raw.trim() === "" ? "0" : raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SCOPE_MANPOWER_PERSIST_V1 — the precedence predicate, web side.
 *
 * Deliberately the same rule as `hasLabourRows` in scope-item-pricing.ts:
 * a non-empty array wins; null / undefined / not-an-array / [] falls back to
 * the men/days/shift scalars. Asked here once so the hydration path and the
 * row-count path cannot drift from each other or from the server.
 */
export function hasStoredLabourRows(
  labourItems: ScopeLabourEntry[] | null | undefined
): labourItems is ScopeLabourEntry[] {
  return Array.isArray(labourItems) && labourItems.length > 0;
}

/**
 * How many manpower rows an item has ACCORDING TO THE SERVER.
 *
 * This is the answer to "persist the row count by persisting the rows": the
 * count is not a field, it is the length of the stored array. An item with no
 * stored rows has exactly one row, which is what the table has always
 * rendered for a fresh item.
 */
export function manpowerRowCountFromItem(
  item: Pick<ScopeItem, "labourItems">
): number {
  return hasStoredLabourRows(item.labourItems) ? item.labourItems.length : 1;
}

/** Hydrate one row of local state from one stored labourItems entry. */
export function rowManpowerFromLabourEntry(entry: ScopeLabourEntry): RowManpowerState {
  return {
    labourTypeId: entry.labourTypeId ?? null,
    role: entry.role ?? null,
    dayRateOverride: entry.dayRateOverride ?? null,
    qty: entry.qty == null ? "" : String(entry.qty),
    days: entry.days == null ? "" : String(entry.days),
    shift: entry.shift ?? "Day"
  };
}

/**
 * The row state a cell shows when the local map holds nothing for it.
 *
 * Order of resolution:
 *   1. the stored labourItems entry at this index, when the item has rows;
 *   2. for row 0 only, the legacy men/days/shift scalars — which is what the
 *      table rendered before this slice and is still the ONLY thing a
 *      never-saved item has;
 *   3. empty.
 *
 * Rows 1..N of an item with no stored array are empty, exactly as today: an
 * item that predates the labour_items column has no second row to restore.
 */
export function defaultManpowerRow(
  item: Pick<ScopeItem, "men" | "days" | "shift" | "labourItems">,
  rowIdx: number
): RowManpowerState {
  if (hasStoredLabourRows(item.labourItems)) {
    const stored = item.labourItems[rowIdx];
    if (stored) return rowManpowerFromLabourEntry(stored);
  }
  return {
    labourTypeId: null,
    role: null,
    dayRateOverride: null,
    qty: rowIdx === 0 ? (item.men ?? "") : "",
    days: rowIdx === 0 ? (item.days ?? "") : "",
    shift: rowIdx === 0 ? (item.shift ?? "Day") : "Day"
  };
}

/**
 * Turn the item's WHOLE row list into the labourItems array to send.
 *
 * `rowIdx` is re-derived from the array position rather than carried through,
 * so the stored array is always dense and 0-based even after a middle row is
 * removed. The server tolerates gaps; the dropdown-by-index hydration above
 * does not, and one of the two has to be strict.
 */
export function buildLabourItems(rows: RowManpowerState[]): ScopeLabourEntry[] {
  return rows.map((row, rowIdx) => ({
    rowIdx,
    labourTypeId: row.labourTypeId,
    role: row.role,
    // Stored value, never the "Weekday" label. An empty shift is "Day",
    // which is what the server normalises an absent shift to anyway.
    shift: row.shift === "" ? "Day" : row.shift,
    qty: manpowerNumOrZero(row.qty),
    days: manpowerNumOrZero(row.days),
    dayRateOverride: row.dayRateOverride
  }));
}

/**
 * The PATCH body for a manpower edit. THIS is the payload of this slice.
 *
 * Sends four keys:
 *   labourItems — every row of the item, always. The DTO warns that a short
 *                 array REPLACES the stored one, so a partial write would
 *                 delete rows; there is no incremental form of this call.
 *   men / days  — row 0's qty/days as the legacy scalars, using exactly the
 *                 `v === "" ? null : Number(v)` expression the component sent
 *                 before this slice. They no longer drive pricing while
 *                 labourItems is non-empty, but keeping them truthful means
 *                 the item still describes itself if the array is ever
 *                 cleared, and it leaves the scalar readers unchanged.
 *   shift       — row 0's shift, same reasoning. "Day" and a stored NULL
 *                 normalise to the same rate on the server, so writing "Day"
 *                 over a NULL cannot move money.
 *
 * `labourItems` is OMITTED, not sent as [], when there are no rows. An empty
 * array and a NULL price identically today, but they are not the same
 * statement, and writing [] over a NULL would turn "never touched" into
 * "touched, and empty" for every later reader. The table never renders zero
 * rows, so this branch is a guard rather than a path.
 */
export function manpowerPatchBody(rows: RowManpowerState[]): Record<string, unknown> {
  const first = rows[0];
  const body: Record<string, unknown> = {
    men: first ? manpowerNumOrNull(first.qty) : null,
    days: first ? manpowerNumOrNull(first.days) : null,
    shift: first && first.shift !== "" ? first.shift : "Day"
  };
  if (rows.length > 0) body.labourItems = buildLabourItems(rows);
  return body;
}

/**
 * Write a full row list into the per-item local state map.
 *
 * Sets `${itemId}:${i}` for every row and DELETES every key for this item at
 * an index past the end, so a removal cannot leave an orphaned row behind to
 * be resurrected the next time the list is materialised. Other items' keys
 * are untouched.
 */
export function writeManpowerRows(
  prev: ItemManpowerRows,
  itemId: string,
  rows: RowManpowerState[]
): ItemManpowerRows {
  const next = new Map(prev);
  const prefix = `${itemId}:`;
  for (const key of prev.keys()) {
    if (!key.startsWith(prefix)) continue;
    const idx = Number(key.slice(prefix.length));
    if (Number.isInteger(idx) && idx >= rows.length) next.delete(key);
  }
  rows.forEach((row, idx) => next.set(`${prefix}${idx}`, row));
  return next;
}

/** Drop one row from a materialised row list (index-aware, order preserved). */
export function removeManpowerRowAt(
  rows: RowManpowerState[],
  rowIdx: number
): RowManpowerState[] {
  return rows.filter((_, i) => i !== rowIdx);
}

// ── SCOPE_WBS_PLANT_V1 exported pure helpers (tested by wbs-plant-columns.test.tsx) ──

/**
 * True when a plant day-rate is considered overridden by the user.
 * A custom machine (no plantRateId) always has an override-by-definition rate —
 * there is no locked catalogue rate to compare against, so any typed value is
 * returned as-is (isCustomPlant callers handle this case separately).
 * For catalogue machines: null override → not overridden.
 */
export function isPlantRateOverridden(
  override: number | null,
  catalogueRate: number | null
): boolean {
  if (override === null) return false;
  if (catalogueRate === null) return true; // custom plant or no type
  return override !== catalogueRate;
}

/**
 * Effective plant day rate for display: the local override when active,
 * otherwise the catalogue rate for the selected plant type (null = no type).
 */
export function effectivePlantRate(
  override: number | null,
  catalogueRate: number | null
): number | null {
  if (override !== null) return override;
  return catalogueRate;
}

/**
 * Plant row total: qty × days × dayRate.
 * Returns null (renders as "—") when any of qty/days/rate are absent.
 * A row with no plant type renders "—", never "$0.00".
 */
export function plantRowTotal(
  qty: number | null,
  days: number | null,
  dayRate: number | null
): number | null {
  if (qty === null || days === null || dayRate === null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(days) || !Number.isFinite(dayRate)) return null;
  return qty * days * dayRate;
}

/**
 * Render a plant total as currency or an em dash when absent.
 *
 * SCOPE_WBS_INPUTS_V2 — cents, same rule as fmtManpowerTotal: min AND max
 * fraction digits are both 2, and null stays the em dash.
 */
export function fmtPlantTotal(total: number | null): string {
  if (total === null) return "—"; // em dash — NEVER "$0.00" for an unset row
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(total);
}

// ── SCOPE_PLANT_PERSIST_V1 exported pure helpers ────────────────────────────
// (tested by wbs-plant-persist.test.tsx)
//
// Same split as the manpower side: everything that decides WHAT GOES ON THE
// WIRE is a pure function of row state here, and the component only decides
// WHEN to call it. The payload shape is the whole risk in this slice — the
// server contract is already merged and is the authority — so the payload is
// testable without a render, a fetch or a database.

/**
 * Parse a plant row-state number input to a number, treating blank as 0.
 *
 * The 0-not-null rule is the same load-bearing one SCOPE_MANPOWER_PERSIST_V1
 * settled, and it is the PLANT loop that states it most plainly:
 * scope-item-pricing.ts prices a plant row as
 * `qty = cell.qty == null ? 1 : n(cell.qty)`. An ABSENT qty means "the
 * estimator picked a machine but typed no quantity" and defaults to ONE
 * machine. A blank Qty box is not that — on screen it renders the row total
 * as an em dash (plantRowTotal returns null). Sending null would make the
 * server silently cost a machine on an unrelated edit (a day-rate change on a
 * row with days but no qty); sending 0 says what the blank box says.
 */
export function plantNumOrZero(raw: string): number {
  const n = Number(raw.trim() === "" ? "0" : raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SCOPE_PLANT_PERSIST_V1 — the precedence predicate, plant side.
 *
 * Deliberately the same shape as hasStoredLabourRows / hasLabourRows: a
 * non-empty array means the item has stored plant; null / undefined /
 * not-an-array / [] means it has none. Plant has no legacy scalars to fall
 * back to, so "none" simply means every row starts blank.
 */
export function hasStoredPlantRows(
  plantItems: ScopePlantEntry[] | null | undefined
): plantItems is ScopePlantEntry[] {
  return Array.isArray(plantItems) && plantItems.length > 0;
}

/**
 * The item's stored plant entries in `columnIndex` order.
 *
 * THIS is the migration of the legacy data, and it is a read, not a backfill.
 * Rows written through the retired PlantCluster are keyed by a columnIndex
 * allocated from 1 upward; the new columns are keyed by rowIdx from 0. Sorting
 * by columnIndex and adopting position-by-position carries every existing
 * entry into a row instead of orphaning all but the first. An entry with no
 * columnIndex sorts as 0 (ahead of the legacy 1..N) rather than being dropped.
 *
 * Does not mutate the array it is given.
 */
export function sortedPlantEntries(
  plantItems: ScopePlantEntry[] | null | undefined
): ScopePlantEntry[] {
  if (!hasStoredPlantRows(plantItems)) return [];
  return [...plantItems].sort((a, b) => (a?.columnIndex ?? 0) - (b?.columnIndex ?? 0));
}

/**
 * How many plant rows an item has ACCORDING TO THE SERVER.
 *
 * The count is not a field, it is the length of the stored array. An item
 * with no stored entries has exactly one (blank) row, which is what the table
 * has always rendered for a fresh item — and an item that already holds two
 * legacy plant entries shows TWO rows after this change, not one with the
 * second orphaned.
 */
export function plantRowCountFromItem(item: Pick<ScopeItem, "plantItems">): number {
  return hasStoredPlantRows(item.plantItems) ? item.plantItems.length : 1;
}

/** A blank plant row — the state a row with nothing stored renders. */
export function blankPlantRow(): RowPlantState {
  return {
    plantRateId: null,
    customDescription: null,
    description: null,
    unit: null,
    dayRateOverride: null,
    qty: "",
    days: ""
  };
}

/**
 * True when a row carries nothing the estimator typed.
 *
 * Used to decide whether a ROW-COUNT change (which is a manpower action that
 * happens to move the plant array too) has anything to say about plant at
 * all. A list of nothing-but-blank rows says nothing that a NULL plantItems
 * does not already say, and writing it would turn "never touched" into
 * "touched, and empty".
 */
export function isBlankPlantRow(row: RowPlantState): boolean {
  return (
    row.plantRateId === null &&
    row.customDescription === null &&
    (row.description === null || row.description === "") &&
    row.dayRateOverride === null &&
    row.qty.trim() === "" &&
    row.days.trim() === ""
  );
}

/**
 * Hydrate one row of local state from one stored plantItems entry.
 *
 * The catalogue/custom split is re-derived from the stored entry rather than
 * stored as a flag: an entry WITH a plantRateId is a catalogue pick, and an
 * entry with no plantRateId but a non-empty description is the free-typed
 * custom machine (customDescription is what makes isCustom true in the cell).
 * An entry with neither — which is exactly what the legacy "+ Plant" button
 * wrote before a machine was picked — hydrates as a blank row.
 */
export function rowPlantFromEntry(entry: ScopePlantEntry): RowPlantState {
  const description = entry.description == null || entry.description === "" ? null : entry.description;
  const plantRateId = entry.plantRateId ?? null;
  return {
    plantRateId,
    customDescription: plantRateId === null ? description : null,
    description,
    unit: entry.unit ?? null,
    dayRateOverride: entry.dayRateOverride ?? null,
    qty: entry.qty == null ? "" : String(entry.qty),
    days: entry.days == null ? "" : String(entry.days)
  };
}

/**
 * The row state a plant cell shows when the local map holds nothing for it:
 * the stored entry at this index in columnIndex order, or a blank row.
 *
 * There is no legacy-scalar branch here (the manpower equivalent has one for
 * row 0) because plant never had scalars — plantItems has always been the
 * only place a plant row could live.
 */
export function defaultPlantRow(
  item: Pick<ScopeItem, "plantItems">,
  rowIdx: number
): RowPlantState {
  const stored = sortedPlantEntries(item.plantItems)[rowIdx];
  return stored ? rowPlantFromEntry(stored) : blankPlantRow();
}

/**
 * The row-state patch a plant Type change carries.
 *
 * Picking a catalogue machine copies the catalogue NAME into `description` —
 * step 2 of this slice and the behaviour the legacy cluster already had
 * (`description: rate?.item`). Without it getCardSummary's
 * `if (!p.description) continue` makes a catalogue-picked row invisible to
 * the card's plant days even though it prices correctly.
 *
 * Clearing the Type empties the row's identity outright rather than leaving a
 * stale name behind, and both branches release the day-rate override for the
 * same reason the manpower cascade does: the number on screen was derived
 * from a locked rate that is no longer this row's locked rate.
 */
export function plantPatchForTypeChange(
  plantRateId: string | null,
  catalogue: { item: string; unit: string } | undefined
): Partial<RowPlantState> {
  if (plantRateId === null) {
    return {
      plantRateId: null,
      customDescription: null,
      description: null,
      unit: null,
      dayRateOverride: null
    };
  }
  return {
    plantRateId,
    customDescription: null,
    description: catalogue?.item ?? null,
    // Legacy parity: the cluster wrote `rate?.unit ?? "day"`.
    unit: catalogue?.unit ?? "day",
    dayRateOverride: null
  };
}

/** Row-state patch for dropping out of the list to a free-typed machine. */
export function plantPatchForCustomDescription(desc: string): Partial<RowPlantState> {
  return {
    plantRateId: null,
    customDescription: desc,
    // A custom machine IS its description — it has no catalogue name to copy,
    // and this is the only identity the card summary can group it under.
    description: desc,
    unit: "day"
  };
}

/** Row-state patch for reverting a custom machine back to the list. */
export function plantPatchForRevertToList(): Partial<RowPlantState> {
  return {
    plantRateId: null,
    customDescription: null,
    description: null,
    unit: null,
    dayRateOverride: null
  };
}

/**
 * Turn the item's WHOLE row list into the plantItems array to send.
 *
 * `columnIndex` is re-derived from the array position (1-based, matching the
 * numbering allocated by the retired cluster) rather than carried through, so
 * the stored array stays dense and ordered even after a middle row is
 * removed. Nothing on the server reads it; the hydration above does, and one
 * of the two has to be strict.
 *
 * Every key is written explicitly, absence included, so a partially-filled
 * row is never ambiguous on the wire.
 */
export function buildPlantItems(rows: RowPlantState[]): ScopePlantEntry[] {
  return rows.map((row, i) => ({
    columnIndex: i + 1,
    plantRateId: row.plantRateId,
    // Written on EVERY entry, not only custom ones — see plantPatchForTypeChange.
    // "" for a row with no machine: getCardSummary skips it exactly as it skips
    // an absent description, and it prices $0 for want of a rate.
    description: row.customDescription ?? row.description ?? "",
    qty: plantNumOrZero(row.qty),
    days: plantNumOrZero(row.days),
    unit: row.unit,
    dayRateOverride: row.dayRateOverride
  }));
}

/**
 * The PATCH body for a plant edit. THIS is the payload of this slice.
 *
 * Sends exactly ONE key: `plantItems`, carrying every row of the item. There
 * are no scalar mirrors to keep truthful the way the manpower body keeps
 * men/days/shift — plant has never had any — so nothing else belongs here,
 * and in particular nothing that would collide with a concurrent manpower
 * write on the same item.
 *
 * `plantItems` is OMITTED, not sent as [], when there are no rows. An empty
 * array and a NULL price identically today, but they are not the same
 * statement, and writing [] over a NULL would turn "never touched" into
 * "touched, and empty" for every later reader. The table never renders zero
 * rows, so this branch is a guard rather than a path.
 */
export function plantPatchBody(rows: RowPlantState[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (rows.length > 0) body.plantItems = buildPlantItems(rows);
  return body;
}

/**
 * Write a full plant row list into the per-item local state map.
 *
 * Sets `${itemId}:${i}` for every row and DELETES every key for this item at
 * an index past the end, so a removal cannot leave an orphaned row behind to
 * be resurrected the next time the list is materialised. Other items' keys
 * are untouched. Returns a new Map; the argument is not mutated.
 */
export function writePlantRows(
  prev: ItemPlantRows,
  itemId: string,
  rows: RowPlantState[]
): ItemPlantRows {
  const next = new Map(prev);
  const prefix = `${itemId}:`;
  for (const key of prev.keys()) {
    if (!key.startsWith(prefix)) continue;
    const idx = Number(key.slice(prefix.length));
    if (Number.isInteger(idx) && idx >= rows.length) next.delete(key);
  }
  rows.forEach((row, idx) => next.set(`${prefix}${idx}`, row));
  return next;
}

/** Drop one plant row from a materialised row list (index-aware, order preserved). */
export function removePlantRowAt(rows: RowPlantState[], rowIdx: number): RowPlantState[] {
  return rows.filter((_, i) => i !== rowIdx);
}

// ── SCOPE_PLANT_PICKER_V2 exported pure helpers ─────────────────────────────
// (tested by wbs-plant-picker-groups.test.tsx)
//
// The grouping is a pure function of the rate list so the one thing that can
// go silently wrong here — a rate vanishing from the list because its category
// was not one the code expected — is asserted without a render. The tests pin
// both halves of that: an unrecognised, empty and null category each land
// somewhere reachable, and the option count is identical before and after
// grouping.

/**
 * The category order the approved mock-up renders, and the only opinion this
 * module holds about categories.
 *
 * `EstimatePlantRate.category` is `String?` in apps/api/prisma/schema.prisma —
 * nullable, free text, no enum — so these five are a PREFERENCE. They sort
 * first when present; every other category the API returns is appended after
 * them. "Truck" is kept in the list even though isTransportPlant currently
 * filters trucks out of this picker: the order is the mock-up's, and if that
 * filter is ever lifted (see the open question) trucks land in the right place
 * rather than at the end.
 */
export const PLANT_CATEGORY_ORDER = ["Excavator", "Bobcat", "Crane", "Truck", "Other"] as const;

/** The category a rate with no usable category of its own is filed under. */
export const PLANT_CATEGORY_FALLBACK = "Other";

/**
 * The sentinel value of the manual-entry option.
 *
 * It is a UI sentinel and NOT a plantRateId: the Type onChange handler
 * intercepts it and routes to onCustomDescription, so it never reaches
 * plantPatchForTypeChange, buildPlantItems or the wire.
 */
export const PLANT_CUSTOM_VALUE = "__custom__";

/** Heading of the trailing group the manual-entry option sits under. */
export const PLANT_CUSTOM_GROUP_LABEL = "Not in the list";

/** Label of the manual-entry option itself, exactly as the mock-up renders it. */
export const PLANT_CUSTOM_OPTION_LABEL = "✎ Type it manually…";

/** The fields of a plant rate the picker reads. */
export type PlantPickerRate = {
  id: string;
  item: string;
  category: string | null;
};

/**
 * The group heading a rate belongs under.
 *
 * null, undefined, "" and whitespace all read as "Other" — the same
 * substitution the flat list already made for a null. A category that matches
 * one of the mock-up's five apart from case or padding is normalised onto the
 * canonical spelling so "excavator" and "Excavator" cannot open two groups;
 * anything else is kept verbatim and becomes its own group.
 */
export function plantCategoryLabel(category: string | null | undefined): string {
  const trimmed = (category ?? "").trim();
  if (trimmed === "") return PLANT_CATEGORY_FALLBACK;
  const canonical = PLANT_CATEGORY_ORDER.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  return canonical ?? trimmed;
}

/**
 * Turn the plant rate list into the picker's `<optgroup>` list.
 *
 * Ordering: the mock-up's five categories first (only those that actually have
 * a rate — an empty group is not emitted), then every other category in the
 * order it first appeared in `rates`, then the manual-entry group last.
 * Within a group the rates keep the order they arrived in.
 *
 * TOTAL-PRESERVING BY CONSTRUCTION: every rate produces exactly one option and
 * the groups are assembled from the same Map the rates were bucketed into, so
 * the option count is `rates.length + 1` (the +1 being the manual entry) for
 * any input whatsoever, including categories nobody anticipated.
 */
export function groupPlantTypeOptions(
  rates: ReadonlyArray<PlantPickerRate>
): TooltipSelectOptionGroup<string>[] {
  const buckets = new Map<string, TooltipSelectOption<string>[]>();
  for (const p of rates) {
    const cat = plantCategoryLabel(p.category);
    const arr = buckets.get(cat) ?? [];
    // The label no longer carries `${cat}: ` — the group heading says it once.
    arr.push({ value: p.id, label: p.item });
    buckets.set(cat, arr);
  }

  const groups: TooltipSelectOptionGroup<string>[] = [];
  const taken = new Set<string>();
  for (const cat of PLANT_CATEGORY_ORDER) {
    const options = buckets.get(cat);
    if (!options || options.length === 0) continue;
    groups.push({ label: cat, options });
    taken.add(cat);
  }
  // Map iteration is insertion order, i.e. the order the API returned the
  // categories. Nothing is filtered here: this loop is what guarantees an
  // unexpected category is appended rather than dropped.
  for (const [cat, options] of buckets) {
    if (taken.has(cat)) continue;
    groups.push({ label: cat, options });
  }

  groups.push({
    label: PLANT_CUSTOM_GROUP_LABEL,
    options: [{ value: PLANT_CUSTOM_VALUE, label: PLANT_CUSTOM_OPTION_LABEL }]
  });
  return groups;
}

/** Total selectable options across every group (the manual entry included). */
export function countPlantPickerOptions(
  groups: ReadonlyArray<TooltipSelectOptionGroup<string>>
): number {
  return groups.reduce((n, g) => n + g.options.length, 0);
}

type Props = {
  tenderId: string;
  cardId: string;
  discipline: Discipline;
  items: ScopeItem[];
  /**
   * Effective card-level markup percent (used as the inherited default).
   * SCOPE_WBS_INPUTS_V2 — required. It used to default to 0 and ScopeCardsTab
   * never passed it, so every row silently claimed to inherit 0%. Dropping the
   * default turns a missing prop into a compile error instead of wrong money
   * on screen. Resolve it with resolveCardMarkup(card.markupOverride, tenderMarkup).
   */
  cardMarkup: number;
  onItemsChanged: () => Promise<void> | void;
};

export function ScopeQuantitiesTable({
  tenderId,
  cardId,
  discipline,
  items,
  cardMarkup,
  onItemsChanged
}: Props) {
  // SCOPE_WBS_INPUTS_V2 — the discipline was destructured and discarded. It
  // now gates the Cutting? tick, computed once here rather than re-derived at
  // each of the two checkboxes.
  const showCutting = showsCuttingColumn(discipline);
  // SCOPE_WBS_ACTIONS_V1 — the ACM block and its `+ Add enclosure /
  // monitoring` button are asbestos-only, and this is the positive form of the
  // same one rule showCutting reads. Resolved once, here, so no block file
  // states a discipline code of its own.
  const isAsbestos = isAsbestosCard(discipline);
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [deleteWarning, setDeleteWarning] = useState<ScopeItem | null>(null);
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRate[]>([]);
  const [materialDensities, setMaterialDensities] = useState<MaterialDensityRate[]>([]);
  // SCOPE_WBS_MANPOWER_V1 — labour rates catalogue for the Type dropdown
  // and Day rate placeholder. Fetched once from the existing endpoint;
  // no new API routes or service methods added.
  const [labourRates, setLabourRates] = useState<LabourRate[]>([]);
  // SCOPE_WBS_MANPOWER_V1 — per-row manpower local state.
  const [itemManpowerRows, setItemManpowerRows] = useState<ItemManpowerRows>(new Map());
  // SCOPE_WBS_PLANT_V1 — per-row plant local state.
  const [itemPlantRows, setItemPlantRows] = useState<ItemPlantRows>(new Map());

  // SCOPE_WBS_TABLE_V1 — per-item row counts (slice 2: local state only;
  // slices 3/4 will bind each row to an actual manpower/plant record).
  // Initialised to 1 for every item. When items changes (add/delete),
  // merge: preserve existing counts for surviving items, seed new ones at 1.
  const [itemRowCounts, setItemRowCounts] = useState<ItemRowCounts>(new Map());

  // SCOPE_WBS_TABLE_V1 — per-item markup override (null = inherit card).
  // SCOPE_ITEM_MARKUP_PERSIST_V1 — this is now the OPTIMISTIC MIRROR of
  // ScopeOfWorksItem.markupOverride, not the only copy. An entry exists only
  // for an item the estimator has edited this session; it is what the cell
  // renders while the PATCH is in flight, and onItemsChanged() then reconciles
  // it against the server's answer. A key that is ABSENT falls through to
  // itemMarkupFromItem(item), which is why a reload comes back with the
  // override instead of a blank box.
  const [itemMarkupOverrides, setItemMarkupOverrides] = useState<ItemMarkupOverrides>(new Map());

  // SCOPE_WBS_ACTIONS_V1 — which expandables are open, per item. An item with
  // no entry has NOTHING open, which is every item on every first render: the
  // map starts empty and openBlocksFor() answers NO_BLOCKS_OPEN for anything
  // it has not heard of. There is deliberately no effect that opens a block
  // because an item happens to have data in it — a card of ten measured items
  // must still open as ten closed rows.
  const [itemOpenBlocks, setItemOpenBlocks] = useState<ItemOpenBlocks>(new Map());

  // SCOPE_WBS_ACTIONS_V1 — the actions column's own collapse. Whole-table, not
  // per-item: the column header carries the toggle.
  const [actionsCollapsed, setActionsCollapsed] = useState(false);

  const toggleItemBlock = useCallback((itemId: string, key: WbsBlockKey) => {
    setItemOpenBlocks((prev) => toggleBlock(prev, itemId, key));
  }, []);

  const openItemBlock = useCallback((itemId: string, key: WbsBlockKey) => {
    setItemOpenBlocks((prev) => openBlock(prev, itemId, key));
  }, []);

  // Sync row counts when items list changes.
  // SCOPE_MANPOWER_PERSIST_V1 — the count is no longer purely local: it is
  // max(what we are already showing, what the server stored). The server side
  // of the max is what makes a reload come back with three rows instead of
  // one. The local side is what stops an unsaved "+ Row" on item A from
  // vanishing when an edit to item B triggers a refetch.
  //
  // A removal shrinks the local count synchronously BEFORE its PATCH is sent,
  // so by the time the refetch lands both sides of the max already agree —
  // and if the PATCH failed, the server's larger count correctly puts the row
  // back rather than pretending the deletion stuck.
  //
  // SCOPE_PLANT_PERSIST_V1 — the stored PLANT rows join the max. One row
  // count drives both column groups, so an item that already holds two legacy
  // plant entries must render two rows or the second entry is orphaned: shown
  // nowhere, and deleted by the first whole-array write. This is step 4 of the
  // slice ("grow the item's row count to fit what it already has") and it is
  // a read of existing data, not a backfill of it.
  useEffect(() => {
    setItemRowCounts((prev) => {
      const next = new Map<string, number>();
      for (const item of items) {
        next.set(
          item.id,
          Math.max(
            prev.get(item.id) ?? 1,
            manpowerRowCountFromItem(item),
            plantRowCountFromItem(item)
          )
        );
      }
      return next;
    });
    setItemMarkupOverrides((prev) => {
      const next = new Map<string, number | null>();
      for (const item of items) {
        if (prev.has(item.id)) next.set(item.id, prev.get(item.id) ?? null);
      }
      return next;
    });
    // SCOPE_WBS_ACTIONS_V1 — drop the open-block state of items that are gone,
    // and PRESERVE it for the ones that are not. A refetch fires on every
    // field edit, so rebuilding this map from scratch would slam shut the very
    // block the estimator is typing into.
    setItemOpenBlocks((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map<string, WbsOpenBlocks>();
      for (const item of items) {
        const open = prev.get(item.id);
        if (open) next.set(item.id, open);
      }
      return next;
    });
  }, [items]);

  const setItemMarkup = useCallback((itemId: string, value: number | null) => {
    setItemMarkupOverrides((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

  /**
   * SCOPE_ITEM_MARKUP_PERSIST_V1 — read the markup override for one item.
   *
   * The local mirror wins while a write is in flight; otherwise the SERVER's
   * stored value is the answer. `has` rather than `??` because null is a real
   * entry in this map (the estimator just cleared the box) and must not be
   * mistaken for "no entry, go ask the item".
   */
  const getItemMarkup = useCallback(
    (item: ScopeItem): number | null =>
      itemMarkupOverrides.has(item.id)
        ? (itemMarkupOverrides.get(item.id) ?? null)
        : itemMarkupFromItem(item),
    [itemMarkupOverrides]
  );

  // SCOPE_WBS_MANPOWER_V1 — helpers to read and write per-row manpower state.
  // SCOPE_MANPOWER_PERSIST_V1 — the local map is now a cache over the stored
  // rows, not the store. A key that is missing falls through to
  // defaultManpowerRow, which reads item.labourItems first and only then the
  // legacy scalars, so a reload renders the server's rows without any
  // hydration effect to race with the user's typing.
  const getRowManpower = useCallback(
    (item: ScopeItem, rowIdx: number): RowManpowerState => {
      const key = `${item.id}:${rowIdx}`;
      return itemManpowerRows.get(key) ?? defaultManpowerRow(item, rowIdx);
    },
    [itemManpowerRows]
  );

  // SCOPE_MANPOWER_PERSIST_V1 — materialise EVERY row of an item, whether or
  // not the user has touched it. Required by the DTO's replace-not-merge
  // contract: a write that omitted the untouched rows would delete them.
  const materialiseManpowerRows = useCallback(
    (item: ScopeItem, rowCount: number): RowManpowerState[] =>
      Array.from({ length: rowCount }, (_, i) => getRowManpower(item, i)),
    [getRowManpower]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plantRes, wasteRes, densityRes, labourRes] = await Promise.all([
          authFetch("/estimate-rates/plant"),
          authFetch("/estimate-rates/waste"),
          authFetch("/estimate-rates/material-densities"),
          // SCOPE_WBS_MANPOWER_V1 — existing endpoint; no modifications to
          // the route, service, or DTO.
          authFetch("/estimate-rates/labour")
        ]);
        if (cancelled) return;
        if (plantRes.ok) {
          const body = (await plantRes.json()) as PlantRate[];
          setPlantRates(body.filter((p) => p.isActive));
        }
        if (wasteRes.ok) {
          const body = (await wasteRes.json()) as WasteRate[];
          setWasteRates(body.filter((w) => w.isActive));
        }
        if (densityRes.ok) {
          const body = (await densityRes.json()) as MaterialDensityRate[];
          setMaterialDensities(body.filter((d) => d.isActive));
        }
        if (labourRes.ok) {
          const body = (await labourRes.json()) as LabourRate[];
          setLabourRates(body.filter((r) => r.isActive));
        }
      } catch {
        // Non-fatal — dropdowns just render empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Distinct waste groups + group -> items lookup.
  const wasteGroupOptions = useMemo<TooltipSelectOption<string>[]>(
    () =>
      Array.from(new Set(wasteRates.map((w) => w.wasteGroup).filter((g): g is string => !!g)))
        .sort()
        .map((g) => ({ value: g, label: g })),
    [wasteRates]
  );
  const wasteItemsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of wasteRates) {
      if (!r.wasteGroup) continue;
      const arr = map.get(r.wasteGroup) ?? [];
      if (!arr.includes(r.wasteType)) arr.push(r.wasteType);
      map.set(r.wasteGroup, arr);
    }
    for (const [k, v] of map) map.set(k, v.sort());
    return map;
  }, [wasteRates]);

  // SCOPE_WBS_MANPOWER_V1 — labour type options for the Type dropdown.
  // SCOPE_WBS_INPUTS_V2 — the page used to prepend its own
  // { value: "", label: "- none -" } sentinel on top of the empty option
  // TooltipSelect always renders, so the dropdown opened with TWO blank
  // options. The sentinel is gone; the select's own blank option carries the
  // wording via placeholder="- none -" at the call site. Selecting it still
  // yields onChange(null) -> labourTypeId = null, exactly as before.
  const labourTypeOptions = useMemo<TooltipSelectOption<string>[]>(
    () => labourRates.map((r) => ({ value: r.id, label: r.role })),
    [labourRates]
  );

  // Map labourRate.id → { day, night, weekend } numbers for O(1) lookup in cells.
  // WBS-SHIFT-S1: all three rates are stored so the cell can resolve the right
  // one from the shift the estimator picked, instead of always showing dayRate.
  const labourRateById = useMemo(() => {
    const map = new Map<string, { day: number; night: number; weekend: number }>();
    for (const r of labourRates) {
      const toNum = (v: string | number) => Number(v);
      map.set(r.id, {
        day: toNum(r.dayRate),
        night: toNum(r.nightRate),
        weekend: toNum(r.weekendRate)
      });
    }
    return map;
  }, [labourRates]);

  // SCOPE_MANPOWER_PERSIST_V1 — labourRate.id → the rate-card ROLE string.
  // labourRateById above answers "what does this cost"; this answers "what is
  // it called on the rate card", which is the key the server prices a stored
  // labour row from (labourRateByRoleShift in scope-item-pricing.ts). The id
  // is meaningless to pricing, so the role has to travel with it.
  const labourRoleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of labourRates) map.set(r.id, r.role);
    return map;
  }, [labourRates]);

  // SCOPE_WBS_PLANT_V1 — plant type options for the Type dropdown (grouped by
  // category).
  // SCOPE_WBS_INPUTS_V2 — the prepended "- none -" sentinel is gone for the
  // same reason as the labour list: TooltipSelect already renders one empty
  // option, and the wording now rides on placeholder="- none -" at the call
  // site. A cleared select still maps to plantRateId = null.
  // SCOPE_PLANT_PICKER_V2 — the memo used to bucket by category and then throw
  // the buckets away, flattening back to one list with `${cat}: ` prefixed onto
  // every label. It now hands the buckets to the select as <optgroup>s and ends
  // the list with the manual-entry option, which nothing emitted before. The
  // transport filter on the line below is UNCHANGED and deliberately so — see
  // the SCOPE_PLANT_PICKER_V2 note at the top of the file.
  const plantTypeGroups = useMemo<TooltipSelectOptionGroup<string>[]>(
    () => groupPlantTypeOptions(plantRates.filter((p) => !isTransportPlant(p))),
    [plantRates]
  );

  // Map plantRate.id → { rate, unit } for O(1) lookup in cells.
  const plantRateById = useMemo(() => {
    const map = new Map<string, { rate: number; unit: string; item: string }>();
    for (const r of plantRates) map.set(r.id, { rate: Number(r.rate), unit: r.unit, item: r.item });
    return map;
  }, [plantRates]);

  // SCOPE_WBS_PLANT_V1 — helpers to read per-row plant state.
  // SCOPE_PLANT_PERSIST_V1 — the local map is now a cache over the stored
  // entries, not the store. A key that is missing falls through to
  // defaultPlantRow, which reads item.plantItems in columnIndex order, so a
  // reload renders the server's rows without any hydration effect to race
  // with the user's typing. The old defaultRowPlant/setRowPlant pair is gone:
  // setRowPlant wrote local state and STOPPED, which is the bug this slice
  // fixes. Every write now goes through commitPlantRow.
  const getRowPlant = useCallback(
    (item: ScopeItem, rowIdx: number): RowPlantState => {
      const key = `${item.id}:${rowIdx}`;
      return itemPlantRows.get(key) ?? defaultPlantRow(item, rowIdx);
    },
    [itemPlantRows]
  );

  // SCOPE_PLANT_PERSIST_V1 — materialise EVERY row of an item, whether or not
  // the user has touched it. Required by the DTO's replace-not-merge
  // contract: a write that omitted the untouched rows would delete them.
  const materialisePlantRows = useCallback(
    (item: ScopeItem, rowCount: number): RowPlantState[] =>
      Array.from({ length: rowCount }, (_, i) => getRowPlant(item, i)),
    [getRowPlant]
  );

  const materialOptions = useMemo<TooltipSelectOption<string>[]>(
    () => materialDensities.map((d) => ({ value: d.materialName, label: `${d.materialName} (${d.density} ${d.unit})` })),
    [materialDensities]
  );

  // Map materialName -> density/unit/kind + default waste for quick lookup.
  const materialDensityMap = useMemo(() => {
    const map = new Map<string, MaterialLookup>();
    for (const d of materialDensities) {
      map.set(d.materialName, {
        density: d.density,
        unit: d.unit,
        kind: (d.kind ?? "VOLUME") as "VOLUME" | "AREA" | "EACH" | "FACTOR",
        defaultWasteGroup: d.defaultWasteGroup ?? null,
        defaultWasteItem: d.defaultWasteItem ?? null
      });
    }
    return map;
  }, [materialDensities]);

  const patchItem = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setPendingIds((s) => new Set(s).add(id));
      try {
        const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(await readApiErrorMessage(response));
        await onItemsChanged();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [authFetch, tenderId, onItemsChanged]
  );

  // ── SCOPE_MANPOWER_PERSIST_V1 — the write path ─────────────────────────
  // Defined after patchItem on purpose: a useCallback declared above it would
  // evaluate `patchItem` in its dependency array while the binding is still
  // in the temporal dead zone.

  /**
   * Apply a patch to ONE row and write the item's whole row list through.
   *
   * The local map is updated first (optimistic, so the cell does not flicker
   * back to its old value while the request is in flight) and the PATCH then
   * carries every row, per the DTO's replace-not-merge contract. patchItem
   * awaits onItemsChanged(), which refetches; the refetched rows are what
   * defaultManpowerRow reads on the next mount.
   */
  const commitManpowerRow = useCallback(
    (item: ScopeItem, rowIdx: number, patch: Partial<RowManpowerState>) => {
      const rowCount = itemRowCounts.get(item.id) ?? 1;
      const rows = materialiseManpowerRows(item, rowCount);
      if (rowIdx < 0 || rowIdx >= rows.length) return;
      rows[rowIdx] = { ...rows[rowIdx], ...patch };
      setItemManpowerRows((prev) => writeManpowerRows(prev, item.id, rows));
      void patchItem(item.id, manpowerPatchBody(rows));
    },
    [itemRowCounts, materialiseManpowerRows, patchItem]
  );

  /**
   * SCOPE_ITEM_MARKUP_PERSIST_V1 — write the item's markup override through.
   *
   * The markup twin of commitManpowerRow / commitPlantRow, and the replacement
   * for a setItemMarkup that wrote local state and stopped. Same two steps in
   * the same order: update the mirror first so the cell does not flicker back
   * to its old value mid-request, then PATCH.
   *
   * There is no whole-array materialisation here because there is no array —
   * markup is one scalar on the item, so the replace-not-merge hazard that
   * shapes the other two writers does not arise. What DOES have to be exact is
   * the null: see markupPatchBody.
   *
   * patchItem awaits onItemsChanged(), which refetches; listItems recomputes
   * lineTotal / lineTotalWithMarkup through resolveEffectiveMarkup with the new
   * override, so the Item total, the card subtotal (which sums those per-row
   * figures) and the discipline summary bar (computeCardBarStats, same figures)
   * all move on that refetch. The browser multiplies nothing.
   */
  const commitItemMarkup = useCallback(
    (item: ScopeItem, value: number | null) => {
      setItemMarkup(item.id, value);
      void patchItem(item.id, markupPatchBody(value));
    },
    [setItemMarkup, patchItem]
  );

  /**
   * SCOPE_PLANT_PERSIST_V1 — apply a patch to ONE plant row and write the
   * item's whole plant row list through. The plant twin of commitManpowerRow,
   * and the replacement for setRowPlant, which wrote local state and stopped.
   *
   * The local map is updated first (optimistic, so the cell does not flicker
   * back to its old value while the request is in flight) and the PATCH then
   * carries every row, per the DTO's replace-not-merge contract. Nothing about
   * this depends on rowIdx: there is no row-0 special case on the plant side
   * and there never was one to remove.
   */
  const commitPlantRow = useCallback(
    (item: ScopeItem, rowIdx: number, patch: Partial<RowPlantState>) => {
      const rowCount = itemRowCounts.get(item.id) ?? 1;
      const rows = materialisePlantRows(item, rowCount);
      if (rowIdx < 0 || rowIdx >= rows.length) return;
      rows[rowIdx] = { ...rows[rowIdx], ...patch };
      setItemPlantRows((prev) => writePlantRows(prev, item.id, rows));
      void patchItem(item.id, plantPatchBody(rows));
    },
    [itemRowCounts, materialisePlantRows, patchItem]
  );

  /**
   * SCOPE_PLANT_PERSIST_V1 — the plant half of a row-count change.
   *
   * "+ Row" and the per-row `x` are one control for BOTH column groups, so a
   * row change has to move the plant array in step with the labour array or
   * the two disagree about how many rows the item has — and on a removal the
   * stored plant entries would stay at their old indices and the wrong plant
   * would show against the wrong row.
   *
   * The plant keys are added only when there is something to say: the item
   * already has stored plant rows, or one of the rows carries plant the
   * estimator typed (which covers the window between a plant edit and the
   * refetch that puts it on `item`). An item whose plantItems is NULL and
   * whose rows are all blank has nothing to shift and nothing to lose, and
   * writing an array of blank entries over that NULL would turn "never
   * touched" into "touched, and empty" — the same statement plantPatchBody
   * refuses to make with [].
   */
  const plantKeysForRowChange = useCallback(
    (item: ScopeItem, rows: RowPlantState[]): Record<string, unknown> =>
      hasStoredPlantRows(item.plantItems) || rows.some((r) => !isBlankPlantRow(r))
        ? plantPatchBody(rows)
        : {},
    []
  );

  /**
   * SCOPE_MANPOWER_PERSIST_V1 — "+ Row" now persists the row it adds.
   *
   * The row count IS the array length, so an added row only survives a reload
   * if it is written. The appended row is blank, and a blank row is priced by
   * the server as qty 0 x days 0 = $0, so adding a row to an item that has
   * never been saved through this path writes a labourItems array whose row 0
   * carries that item's existing men/days/shift and whose role is null — which
   * is the discipline default role, the same rate the scalars priced at. The
   * item total does not move.
   */
  const addRowToItem = useCallback(
    (item: ScopeItem) => {
      const rowCount = itemRowCounts.get(item.id) ?? 1;
      const rows = [...materialiseManpowerRows(item, rowCount), defaultManpowerRow(item, rowCount)];
      // SCOPE_PLANT_PERSIST_V1 — the appended row gets a blank plant entry so
      // the two arrays keep the same length. A blank entry has no plantRateId
      // and no override, so computeScopeItemTotal's plant loop skips it
      // outright (`if (rate == null) continue`) and the item total does not
      // move. Sent in the SAME PATCH as the labour rows — two PATCHes to one
      // scope item race, and the loser resurrects what the winner deleted.
      const plantRows = [...materialisePlantRows(item, rowCount), blankPlantRow()];
      setItemRowCounts((prev) => {
        const next = new Map(prev);
        next.set(item.id, rows.length);
        return next;
      });
      setItemManpowerRows((prev) => writeManpowerRows(prev, item.id, rows));
      setItemPlantRows((prev) => writePlantRows(prev, item.id, plantRows));
      void patchItem(item.id, {
        ...manpowerPatchBody(rows),
        ...plantKeysForRowChange(item, plantRows)
      });
    },
    [itemRowCounts, materialiseManpowerRows, materialisePlantRows, plantKeysForRowChange, patchItem]
  );

  // SCOPE_WBS_GROUPRULES_V1 — remove the row that was clicked, not the last
  // one. The row count shrinks by one and both per-row local-state maps are
  // spliced so rows above the removed index keep their values as they shift
  // down.
  //
  // SCOPE_MANPOWER_PERSIST_V1 — the removal is now persisted, and it is done
  // against the MATERIALISED row list rather than by splicing the sparse local
  // map. That distinction is the bug this slice would otherwise ship: rows
  // hydrated from the server have no entry in the local map, so splicing the
  // map alone would leave them rendering at their old indices and the write
  // would delete the wrong row.
  //
  // SCOPE_PLANT_PERSIST_V1 — plant now takes the same route, for the same
  // reason. It was still on spliceRowState, which is correct only while every
  // row is local-only; the moment plant rows hydrate from the server the
  // splice edits a map that does not contain them, leaves the stored array
  // untouched, and the next whole-array write ships the rows in their OLD
  // order. spliceRowState itself is untouched and stays exported —
  // SCOPE_WBS_GROUPRULES_V1 and wbs-table-chrome.test.tsx own it.
  //
  // Both arrays go in ONE PATCH. Two PATCHes to the same scope item race, and
  // batch3-scope-items.spec.ts documents the exact failure that produced: the
  // later write resurrects what the earlier one deleted.
  const removeRowFromItem = useCallback(
    (item: ScopeItem, rowIdx: number) => {
      const current = itemRowCounts.get(item.id) ?? 1;
      if (!canRemoveRowAt(current, rowIdx)) return;
      const rows = removeManpowerRowAt(materialiseManpowerRows(item, current), rowIdx);
      const plantRows = removePlantRowAt(materialisePlantRows(item, current), rowIdx);
      setItemRowCounts((prev) => {
        const next = new Map(prev);
        next.set(item.id, nextRowCountAfterRemove(prev.get(item.id) ?? current, rowIdx));
        return next;
      });
      setItemManpowerRows((prev) => writeManpowerRows(prev, item.id, rows));
      setItemPlantRows((prev) => writePlantRows(prev, item.id, plantRows));
      void patchItem(item.id, {
        ...manpowerPatchBody(rows),
        ...plantKeysForRowChange(item, plantRows)
      });
    },
    [itemRowCounts, materialiseManpowerRows, materialisePlantRows, plantKeysForRowChange, patchItem]
  );

  const confirmItem = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}/confirm`, { method: "POST" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };
  const excludeItem = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}/exclude`, { method: "POST" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };

  const finalDelete = async (item: ScopeItem) => {
    setDeleteWarning(null);
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };
  const deleteItem = async (item: ScopeItem) => {
    if (item.estimateItemId) {
      setDeleteWarning(item);
    } else {
      const ok = await confirm({
        title: "Delete scope item",
        message: `Delete ${item.wbsCode}?`,
        confirmLabel: "Delete",
        variant: "danger"
      });
      if (!ok) return;
      void finalDelete(item);
    }
  };

  // SCOPE_WBS_TABLE_V1 — "+ Add WBS item" replaces the old "+ Add row".
  const addItem = async () => {
    // PR B1.7 — new CreateScopeItemInCardDto accepts an empty body.
    // Server derives discipline from the parent card and defaults
    // rowType to "general-labour".
    const response = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "" })
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };

  const visible = useMemo(() => items.filter((i) => i.status !== "excluded"), [items]);
  const excluded = useMemo(() => items.filter((i) => i.status === "excluded"), [items]);
  // PR B2 — footer self-sums from the per-row totals.
  const subtotal = useMemo(
    () => visible.reduce((sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0), 0),
    [visible]
  );
  const subtotalWithMarkup = useMemo(
    () =>
      visible.reduce(
        (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
        0
      ),
    [visible]
  );
  const wbsSortedVisible = useMemo(
    () => [...visible].sort((a, b) => a.itemNumber - b.itemNumber || a.sortOrder - b.sortOrder),
    [visible]
  );

  return (
    <section className="s7-card" style={{ padding: 16 }}>
      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "6px 10px",
            border: "1px solid var(--status-danger)",
            color: "var(--status-danger)",
            borderRadius: 4,
            fontSize: 13
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ marginLeft: 8, background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            x
          </button>
        </div>
      ) : null}

      {wbsSortedVisible.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
            border: "1px dashed var(--border-default, #e5e7eb)",
            borderRadius: 8,
            marginBottom: 10
          }}
        >
          No items yet. Click <strong>+ Add WBS item</strong> below to start.
        </div>
      ) : (
        /* SCOPE_WBS_TABLE_V1 — AutoFit table (Word "AutoFit to contents"
           then "AutoFit to window"): table-layout:auto, fit columns use
           width:1%+nowrap so they shrink to content; description has no
           width constraint so it takes all slack.
           SCOPE_WBS_MANPOWER_V1 — The Manpower group now occupies 6
           discrete columns (Type/Qty/Days/Shift/Rate/Total) instead
           of the single spanning cell from slice 2.
           SCOPE_WBS_PLANT_V1 — Plant group now occupies 5 discrete
           columns (Type/Qty/Days/Day rate/Total) instead of the single
           spanning cell from slices 2-3.
           SCOPE_WBS_GROUPRULES_V1 — the leading blank remove column is gone
           (17 columns -> 16); the row-remove `x` now rides in the Manpower
           Total cell, where its slot is always reserved so the money column
           keeps one right edge.
           SCOPE_WBS_ACTIONS_V1 — the Measurement spanning cell is GONE (16
           columns -> 15) and the Actions column takes the far right (-> 16).
           Measurement now renders in the item's expandable row underneath,
           which is why nine boxes per item stopped painting themselves. */
        <table style={subtblStyle} aria-label="WBS items">
          <colgroup>
            {/* WBS code */}
            <col />
            {/* Description — expands */}
            <col style={{ width: "100%" }} />
            {/* SCOPE_WBS_MANPOWER_V1 — Manpower group: 6 fit columns */}
            <col />{/* Type */}
            <col />{/* Qty */}
            <col />{/* Days */}
            <col />{/* Shift */}
            <col />{/* Rate (shift-resolved) */}
            <col />{/* Total */}
            {/* SCOPE_WBS_PLANT_V1 — Plant group: 5 fit columns */}
            <col />{/* Type */}
            <col />{/* Qty */}
            <col />{/* Days */}
            <col />{/* Day rate */}
            <col />{/* Total */}
            {/* Markup */}
            <col />
            {/* Item total */}
            <col />
            {/* SCOPE_WBS_ACTIONS_V1 — Actions. LAST, after both money columns,
                so collapsing it can only ever shrink the table's own right
                edge — Markup and Item total keep theirs wherever it sits. */}
            <col />
          </colgroup>
          <thead>
            {/* SCOPE_WBS_GROUPRULES_V1 — group band. Only the group titles
                live here now: WBS / Description / Markup / Item total moved
                down onto the label band, level with Type / Qty / Days, and
                their five blank companions (including the remove slot) are
                gone.
                SCOPE_WBS_ACTIONS_V1 — the Measurement title went with the
                column; the Actions title and its collapse toggle take the
                far right. */}
            <tr>
              {/* WBS + Description — labels now sit on the lower band */}
              <th style={thStyle} colSpan={2} />
              {/* SCOPE_WBS_MANPOWER_V1 — Manpower group header spans 6 columns */}
              <th colSpan={6} style={manpowerGroupTitleStyle}>
                Manpower
              </th>
              {/* SCOPE_WBS_PLANT_V1 — Plant group header spans 5 columns */}
              <th colSpan={5} style={plantGroupTitleStyle}>
                Plant
              </th>
              {/* Markup + Item total — labels now sit on the lower band. The
                  group rule carries through so the Markup boundary is one
                  unbroken line down the table. */}
              <th style={{ ...thStyle, ...groupRuleStyle }} colSpan={2} />
              {/* SCOPE_WBS_ACTIONS_V1 — the collapse toggle lives on the
                  column header. Collapsed, the whole column is one re-open
                  control and every cell below it goes empty. */}
              <th style={{ ...thStyle, ...groupRuleStyle, textAlign: "center" }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => setActionsCollapsed((c) => !c)}
                  aria-expanded={!actionsCollapsed}
                  aria-label={actionsCollapsed ? "Show item actions" : "Hide item actions"}
                  title={actionsCollapsed ? "Show item actions" : "Hide item actions"}
                  style={{ fontSize: 11, padding: "2px 6px", whiteSpace: "nowrap" }}
                >
                  {actionsCollapsed ? "«" : "Actions »"}
                </button>
              </th>
            </tr>
            {/* SCOPE_WBS_MANPOWER_V1 — sub-header row for individual manpower columns */}
            {/* SCOPE_WBS_PLANT_V1 — sub-header row extended with plant columns */}
            {/* SCOPE_WBS_GROUPRULES_V1 — this is the label band: pinned to the
                top of the scroll container, and carrying the group rule at the
                first column of each group (Manpower Type, Plant Type, Markup). */}
            <tr>
              <th style={stickyThStyle}>WBS</th>
              <th style={stickyThDescStyle}>Description</th>
              <th style={{ ...stickyThStyle, ...groupRuleStyle }}>Type</th>
              <th style={stickyThStyle}>Qty</th>
              <th style={stickyThStyle}>Days</th>
              <th style={stickyThStyle}>Shift</th>
              {/* SCOPE_WBS_INPUTS_V2 — money header, right-aligned over its
                  right-aligned column, the same override the Total header
                  beside it already carries. */}
              <th style={{ ...stickyThStyle, textAlign: "right" }}>Rate</th>
              <th style={{ ...stickyThStyle, textAlign: "right" }}>Total</th>
              {/* SCOPE_WBS_PLANT_V1 — plant sub-headers */}
              <th style={{ ...stickyThStyle, ...groupRuleStyle }}>Type</th>
              <th style={stickyThStyle}>Qty</th>
              <th style={stickyThStyle}>Days</th>
              {/* SCOPE_WBS_INPUTS_V2 — plant money header, right-aligned. */}
              <th style={{ ...stickyThStyle, textAlign: "right" }}>Rate</th>
              <th style={{ ...stickyThStyle, textAlign: "right" }}>Total</th>
              <th style={{ ...stickyThStyle, ...groupRuleStyle }}>Markup</th>
              <th style={{ ...stickyThStyle, textAlign: "right" }}>Item total</th>
              {/* SCOPE_WBS_ACTIONS_V1 — Actions label stays on the group band
                  above, with the toggle. */}
              <th style={{ ...stickyThStyle, ...groupRuleStyle }} />
            </tr>
          </thead>
          {wbsSortedVisible.map((item) => {
              const rowCount = itemRowCounts.get(item.id) ?? 1;
              // SCOPE_ITEM_MARKUP_PERSIST_V1 — the value now comes from the
              // server (via the in-flight mirror), and "overridden" is asked as
              // identity, not as a comparison against the card: an item pinned
              // at 22% while the card also happens to sit at 22% is still
              // pinned, and must keep its revert control and its own number
              // when the card moves. displayMarkup still runs through
              // effectiveMarkup, which is the same item -> card -> tender -> 0
              // chain SCOPE_WBS_INPUTS_V2 established, reused rather than
              // re-derived.
              const localMarkup = getItemMarkup(item);
              const overridden = isStoredMarkupOverride(localMarkup);
              const displayMarkup = effectiveMarkup(localMarkup, cardMarkup);
              const isAi = item.aiProposed && item.status !== "confirmed";
              const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
              const isPending = pendingIds.has(item.id);

              // SCOPE_WBS_ACTIONS_V1 — what this item has, and what of it is
              // open. The counts drive the tick and the number on each action
              // button; the open flags decide whether the item gets an
              // expandable row at all. An item the map has never heard of has
              // nothing open — that is where "no block opens by default"
              // actually lives.
              const openBlocks = openBlocksFor(itemOpenBlocks, item.id);
              const measurementsHere = measurementCount(item);
              const commentsHere = commentCount(item);
              const acmHere = isAsbestos ? acmFactCount(item) : 0;

              // Render rowCount <tr> elements; identity columns span all.
              const rows = Array.from({ length: rowCount }, (_, rowIdx) => {
                const isFirstRow = rowIdx === 0;
                const rowKey = `${item.id}-row-${rowIdx}`;
                const showPerRowRemove = shouldShowPerRowRemove(rowCount);

                // Last row of the item gets a bottom border to visually
                // separate items.
                const isLastRow = rowIdx === rowCount - 1;
                const rowStyle: CSSProperties = isLastRow
                  ? { borderBottom: "2px solid var(--border-default, #e5e7eb)" }
                  : {};

                return (
                  <tr key={rowKey} style={rowStyle}>
                    {/* SCOPE_WBS_GROUPRULES_V1 — the leading remove column is
                        gone; the `x` rides in the Manpower Total cell below. */}

                    {/* ── WBS cell — rowspan across all item rows ──────── */}
                    {isFirstRow ? (
                      <td
                        rowSpan={rowCount}
                        style={{
                          ...fitCellStyle,
                          ...tdBorderStyle,
                          verticalAlign: "top",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          color: "#005B61",
                          fontWeight: 500
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          {isAi ? (
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 5px",
                                background: "#FEAA6D",
                                color: "#fff",
                                borderRadius: 999,
                                fontWeight: 700
                              }}
                            >
                              AI
                            </span>
                          ) : null}
                          <span title={item.wbsCode}>{item.wbsCode}</span>
                          {confidence ? (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                background: confidence.bg,
                                color: confidence.fg,
                                borderRadius: 999,
                                whiteSpace: "nowrap"
                              }}
                            >
                              {confidence.label}
                            </span>
                          ) : null}
                          {/* Per-item remove button on the WBS cell */}
                          {isAi ? (
                            <div style={{ display: "inline-flex", gap: 4, marginTop: 2 }}>
                              <button
                                type="button"
                                className="s7-btn s7-btn--primary s7-btn--sm"
                                onClick={() => void confirmItem(item.id)}
                                title="Confirm into estimate"
                              >
                                ok
                              </button>
                              <button
                                type="button"
                                className="s7-btn s7-btn--ghost s7-btn--sm"
                                onClick={() => void excludeItem(item.id)}
                                style={{ color: "var(--status-danger, #EF4444)" }}
                                title="Exclude"
                              >
                                x
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => void deleteItem(item)}
                              aria-label={`Remove item ${item.wbsCode}`}
                              title="Remove WBS item"
                              style={{ color: "var(--status-danger, #EF4444)", fontSize: 11, padding: "2px 4px" }}
                            >
                              Remove
                            </button>
                          )}
                          {/* Add row to this item */}
                          {!isAi ? (
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => addRowToItem(item)}
                              title="Add a manpower/plant row to this item"
                              style={{ fontSize: 10, padding: "2px 4px" }}
                            >
                              + Row
                            </button>
                          ) : null}
                          {isPending ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>...</span> : null}
                        </div>
                      </td>
                    ) : null}

                    {/* ── Description cell — rowspan, free-text input ──── */}
                    {isFirstRow ? (
                      <td rowSpan={rowCount} style={{ ...descCellStyle, ...tdBorderStyle }}>
                        <input
                          className="s7-input"
                          defaultValue={item.description}
                          disabled={isAi}
                          placeholder="Description"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== item.description) void patchItem(item.id, { description: v });
                          }}
                          style={{ width: "100%", minWidth: 160 }}
                          aria-label={`Description for ${item.wbsCode}`}
                        />
                        {/* SCOPE_WBS_ACTIONS_V1 — the notes textarea sat here,
                            open, under every description on the card. It is
                            the same field (item.notes, same PATCH) and it now
                            lives in the Comment expandable, reached from
                            `+ Add comment`. */}
                      </td>
                    ) : null}

                    {/* ── SCOPE_WBS_MANPOWER_V1 — Manpower column group (6 cells per row) ── */}
                    <ManpowerRowCells
                      item={item}
                      rowIdx={rowIdx}
                      rowState={getRowManpower(item, rowIdx)}
                      labourTypeOptions={labourTypeOptions}
                      labourRateById={labourRateById}
                      isAi={isAi}
                      showRemove={showPerRowRemove}
                      onRemoveRow={() => removeRowFromItem(item, rowIdx)}
                      // SCOPE_MANPOWER_PERSIST_V1 — all five handlers go through
                      // commitManpowerRow, which writes local state AND patches
                      // the whole labourItems array. The `rowIdx === 0` guards
                      // that used to sit on three of them are gone: they were the
                      // bug. Every row, every field, one call site each.
                      //
                      // SCOPE_WBS_INPUTS_V2 — changing the role releases a stale
                      // rate override. This is not a new rule: onPlantTypeChange
                      // twenty lines below already clears dayRateOverride the same
                      // way. A rate typed against Labourer must not survive onto
                      // Supervisor. The cascade helpers are unchanged; the role
                      // string is resolved alongside them because the server
                      // prices from the role, not from the id.
                      onLabourTypeChange={(typeId) =>
                        commitManpowerRow(item, rowIdx, {
                          ...manpowerPatchForTypeChange(typeId),
                          role: typeId === null ? null : (labourRoleById.get(typeId) ?? null)
                        })
                      }
                      onQtyBlur={(v) => commitManpowerRow(item, rowIdx, { qty: v })}
                      onDaysBlur={(v) => commitManpowerRow(item, rowIdx, { days: v })}
                      onShiftChange={(v) =>
                        // SCOPE_WBS_INPUTS_V2 — same cascade release as the role
                        // change above: the catalogue rate is shift-resolved, so a
                        // rate typed against the Weekday shift is stale the moment
                        // the row goes Night. The stored shift string is unchanged
                        // ("Day", never the "Weekday" label).
                        commitManpowerRow(item, rowIdx, manpowerPatchForShiftChange(v))
                      }
                      onDayRateOverride={(v) => commitManpowerRow(item, rowIdx, { dayRateOverride: v })}
                    />
                    {/* ── SCOPE_WBS_PLANT_V1 — Plant column group (5 cells per row) ── */}
                    <PlantRowCells
                      item={item}
                      rowIdx={rowIdx}
                      rowState={getRowPlant(item, rowIdx)}
                      plantTypeGroups={plantTypeGroups}
                      plantRateById={plantRateById}
                      isAi={isAi}
                      // SCOPE_PLANT_PERSIST_V1 — all six handlers go through
                      // commitPlantRow, which writes local state AND patches
                      // the whole plantItems array. Every one of them used to
                      // call setRowPlant and stop, which is why every plant
                      // field on every row died on reload.
                      //
                      // The catalogue NAME and unit are resolved here, from
                      // plantRateById, for the same reason the manpower Type
                      // handler resolves the rate-card role here: the server
                      // reads the name (getCardSummary) and the id alone does
                      // not carry it.
                      onPlantTypeChange={(plantRateId) =>
                        commitPlantRow(
                          item,
                          rowIdx,
                          plantPatchForTypeChange(
                            plantRateId,
                            plantRateId ? plantRateById.get(plantRateId) : undefined
                          )
                        )
                      }
                      onCustomDescription={(desc) =>
                        commitPlantRow(item, rowIdx, plantPatchForCustomDescription(desc))
                      }
                      onRevertToList={() =>
                        commitPlantRow(item, rowIdx, plantPatchForRevertToList())
                      }
                      onQtyBlur={(v) => commitPlantRow(item, rowIdx, { qty: v })}
                      onDaysBlur={(v) => commitPlantRow(item, rowIdx, { days: v })}
                      onDayRateOverride={(v) => commitPlantRow(item, rowIdx, { dayRateOverride: v })}
                    />
                    {/* SCOPE_WBS_ACTIONS_V1 — the Measurement spanning cell
                        stood here, on every row of every item, painting the
                        full L/H/D/material/waste strip whether or not the item
                        measured anything. It is now the Measurement expandable
                        in the item's actions row below. Nothing about what it
                        writes changed; see WbsMeasurementBlock.tsx. */}

                    {/* ── Markup cell — rowspan ─────────────────────────── */}
                    {/* SCOPE_WBS_GROUPRULES_V1 — Markup is the first column of
                        its group, so it carries the left rule. */}
                    {isFirstRow ? (
                      <td rowSpan={rowCount} style={{ ...fitCellStyle, ...tdBorderStyle, ...groupRuleStyle }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="s7-type-label" style={labelStyle}>
                            Markup %
                          </span>
                          <OverrideField
                            isOverridden={overridden}
                            onRevert={() => commitItemMarkup(item, null)}
                            affordance
                          >
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={localMarkup !== null ? localMarkup : ""}
                              placeholder={String(cardMarkup)}
                              className="s7-input"
                              style={{ width: 64, padding: "2px 6px" }}
                              aria-label={`Markup for ${item.wbsCode}`}
                              title={
                                overridden
                                  ? "Item markup override active"
                                  : `Inheriting card markup (${cardMarkup}%)`
                              }
                              onChange={(e) => {
                                // SCOPE_ITEM_MARKUP_PERSIST_V1 — clearing the
                                // box writes null (inherit), NOT 0. Both are
                                // sent; only the key's absence would be silent,
                                // and parseMarkupInput is where the two part.
                                commitItemMarkup(item, parseMarkupInput(e.target.value));
                              }}
                            />
                          </OverrideField>
                          {overridden ? (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              Card: {cardMarkup}%
                            </span>
                          ) : null}
                          <span
                            style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}
                            title="Effective markup percent for this item"
                          >
                            {displayMarkup}%
                          </span>
                        </div>
                      </td>
                    ) : null}

                    {/* ── Item total cell — rowspan ─────────────────────── */}
                    {isFirstRow ? (
                      <td
                        rowSpan={rowCount}
                        style={{
                          ...fitCellStyle,
                          ...tdBorderStyle,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--text)"
                        }}
                        title="Line total (with markup)"
                      >
                        {item.lineTotalWithMarkup == null
                          ? "—"
                          : fmtCurrency(Number(item.lineTotalWithMarkup))}
                      </td>
                    ) : null}

                    {/* ── SCOPE_WBS_ACTIONS_V1 — Actions cell — rowspan ─── */}
                    {isFirstRow ? (
                      <td
                        rowSpan={rowCount}
                        style={{
                          ...fitCellStyle,
                          ...tdBorderStyle,
                          ...groupRuleStyle,
                          verticalAlign: "top"
                        }}
                      >
                        {actionsCollapsed ? null : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                              alignItems: "stretch"
                            }}
                          >
                            <WbsActionButton
                              label="+ Add another row to this WBS"
                              count={rowCount}
                              disabled={isAi}
                              onClick={() => addRowToItem(item)}
                            />
                            <WbsActionButton
                              label="+ Add measurement"
                              count={measurementsHere}
                              expanded={openBlocks.measurement}
                              disabled={isAi}
                              onClick={() => {
                                // Both add and reveal. The patch is null when
                                // the item already has an empty slot waiting —
                                // its own flat columns — so the first click on
                                // an unmeasured item opens the block and writes
                                // nothing.
                                const patch = measurementAddPatch(item);
                                if (patch) void patchItem(item.id, patch);
                                openItemBlock(item.id, "measurement");
                              }}
                            />
                            <WbsActionButton
                              label="+ Add comment"
                              count={commentsHere}
                              expanded={openBlocks.comment}
                              disabled={isAi}
                              onClick={() => openItemBlock(item.id, "comment")}
                            />
                            {/* Asbestos cards only — resolved from
                                isAsbestosCard(discipline) once, above. */}
                            {isAsbestos ? (
                              <WbsActionButton
                                label="+ Add enclosure / monitoring"
                                count={acmHere}
                                expanded={openBlocks.acm}
                                disabled={isAi}
                                onClick={() => openItemBlock(item.id, "acm")}
                              />
                            ) : null}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              });

              // SCOPE_WBS_ACTIONS_V1 — the expandable row. It exists ONLY
              // while at least one of this item's blocks is open, which for a
              // freshly-loaded card is never: openBlocksFor answers
              // NO_BLOCKS_OPEN for every item until the estimator opens one.
              // It spans the full width so a block is never squeezed into a
              // money column, and it carries the item's bottom rule so the
              // group still reads as one item.
              const expandableRow = hasOpenBlock(openBlocks) ? (
                <tr key={`${item.id}-blocks`}>
                  <td
                    colSpan={WBS_COLUMN_COUNT}
                    style={{
                      ...tdBorderStyle,
                      borderBottom: "2px solid var(--border-default, #e5e7eb)",
                      padding: "6px 8px",
                      background: "var(--surface, #fff)"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {openBlocks.measurement ? (
                        <WbsMeasurementBlock
                          item={item}
                          wasteGroupOptions={wasteGroupOptions}
                          wasteItemsByGroup={wasteItemsByGroup}
                          materialOptions={materialOptions}
                          materialDensityMap={materialDensityMap}
                          isAi={isAi}
                          showCutting={showCutting}
                          onPatch={(body) => void patchItem(item.id, body)}
                        />
                      ) : null}
                      {openBlocks.comment ? (
                        <WbsCommentBlock
                          item={item}
                          isAi={isAi}
                          onPatch={(body) => void patchItem(item.id, body)}
                        />
                      ) : null}
                      {/* Gated twice on purpose: the button that opens it is
                          asbestos-only, and so is the block. A non-asbestos
                          card cannot reach this branch even with stale open
                          state left over from a discipline change. */}
                      {isAsbestos && openBlocks.acm ? (
                        <WbsAcmBlock
                          item={item}
                          isAi={isAi}
                          onPatch={(body) => void patchItem(item.id, body)}
                        />
                      ) : null}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {openBlocks.measurement ? (
                          <WbsBlockCloseButton
                            label="Hide measurements"
                            onClick={() => toggleItemBlock(item.id, "measurement")}
                          />
                        ) : null}
                        {openBlocks.comment ? (
                          <WbsBlockCloseButton
                            label="Hide comment"
                            onClick={() => toggleItemBlock(item.id, "comment")}
                          />
                        ) : null}
                        {isAsbestos && openBlocks.acm ? (
                          <WbsBlockCloseButton
                            label="Hide enclosure / monitoring"
                            onClick={() => toggleItemBlock(item.id, "acm")}
                          />
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null;

              // SCOPE_WBS_TABLE_V1 — one <tbody> per WBS item. The rowspan
              // already asserts that these <tr>s are a single item; giving
              // each item its own tbody makes that grouping addressable to
              // assistive tech and to the acceptance suite, which until this
              // slice scoped itself to the card <article> that the table
              // replaced. Multiple tbody elements in one table are valid.
              //
              // The description renders into an <input>, and an input's value
              // is not text content — so neither a screen reader walking the
              // group nor a test can find an item by the words in it. Carry
              // it on the group as data-item-description.
              return (
                <tbody
                  key={item.id}
                  data-testid="wbs-item"
                  data-wbs-code={item.wbsCode}
                  data-item-description={item.description}
                >
                  {rows}
                  {expandableRow}
                </tbody>
              );
            })}
        </table>
      )}

      {/* SCOPE_WBS_TABLE_V1 — "+ Add WBS item" below the table */}
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={() => void addItem()}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          border: "1px dashed var(--border-default, #e5e7eb)",
          marginTop: 8
        }}
      >
        + Add WBS item
      </button>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Subtotal: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotal)}</strong>
          {" · "}with markup: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotalWithMarkup)}</strong>
        </div>
      </div>

      {excluded.length > 0 ? (
        <details style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          <summary>Excluded ({excluded.length})</summary>
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {excluded.map((i) => (
              <li key={i.id} style={{ textDecoration: "line-through" }}>
                {i.wbsCode} — {i.description}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {deleteWarning ? (
        <CenteredModal
          title={`Delete ${deleteWarning.wbsCode}?`}
          onClose={() => setDeleteWarning(null)}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setDeleteWarning(null)}>
                Cancel
              </button>
              <button type="button" className="s7-btn s7-btn--primary" onClick={() => void finalDelete(deleteWarning)}>
                Delete scope item only
              </button>
            </>
          }
        >
          <p style={{ color: "var(--text-muted)" }}>
            This item has a linked estimate entry. The scope item will be deleted but the estimate line will remain.
          </p>
        </CenteredModal>
      ) : null}
    </section>
  );
}

// ── SCOPE_WBS_ACTIONS_V1 — the actions column's controls ────────────────

/**
 * One action button: the label, and — once the item has the thing — a tick and
 * a count. `count` is the number of that thing the item ACTUALLY carries, not
 * the number of slots it could have, so a WBS item nobody has measured shows a
 * bare `+ Add measurement` and no tick.
 */
function WbsActionButton({
  label,
  count,
  expanded,
  disabled,
  onClick
}: {
  label: string;
  count: number;
  /** Present on the three buttons that open a block; absent on "+ Row". */
  expanded?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const has = count > 0;
  return (
    <button
      type="button"
      className="s7-btn s7-btn--ghost s7-btn--sm"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      title={has ? `${label} (${count} already)` : label}
      style={{
        fontSize: 10,
        padding: "3px 6px",
        textAlign: "left",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 5,
        justifyContent: "space-between"
      }}
    >
      <span>{label}</span>
      {has ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontWeight: 700,
            color: "var(--status-success, #16A34A)"
          }}
        >
          <span aria-hidden="true">{"✓"}</span>
          <span>{count}</span>
        </span>
      ) : null}
    </button>
  );
}

/** The "hide this block again" control inside an open expandable. */
function WbsBlockCloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="s7-btn s7-btn--ghost s7-btn--sm"
      onClick={onClick}
      style={{ fontSize: 10, padding: "2px 6px", color: "var(--text-muted)" }}
    >
      {label}
    </button>
  );
}

// ── SCOPE_WBS_MANPOWER_V1 — ManpowerRowCells ────────────────────────────
// Renders the 6 per-row manpower columns:
//   Type · Qty · Days · Shift · Rate · Total
// WBS-SHIFT-S1: the Rate cell now shows the catalogue rate for the shift
// the estimator picked (Night/Weekend/Day), not always the day rate.
// Each column is a separate <td> (not a single spanning cell).
// When Type is unset, Qty / Days / Shift are disabled but the cells
// are still rendered at full width so column widths are stable.

type ManpowerRowCellsProps = {
  item: ScopeItem;
  rowIdx: number;
  rowState: RowManpowerState;
  labourTypeOptions: TooltipSelectOption<string>[];
  labourRateById: Map<string, { day: number; night: number; weekend: number }>;
  isAi: boolean;
  /** SCOPE_WBS_GROUPRULES_V1 — render the row-remove `x` in the Total cell. */
  showRemove: boolean;
  /** SCOPE_WBS_GROUPRULES_V1 — remove THIS row (index-aware). */
  onRemoveRow: () => void;
  onLabourTypeChange: (typeId: string | null) => void;
  onQtyBlur: (v: string) => void;
  onDaysBlur: (v: string) => void;
  onShiftChange: (v: string) => void;
  onDayRateOverride: (v: number | null) => void;
};

function ManpowerRowCells({
  item,
  rowIdx,
  rowState,
  labourTypeOptions,
  labourRateById,
  isAi,
  showRemove,
  onRemoveRow,
  onLabourTypeChange,
  onQtyBlur,
  onDaysBlur,
  onShiftChange,
  onDayRateOverride
}: ManpowerRowCellsProps) {
  const hasType = rowState.labourTypeId !== null;

  // SCOPE_MANPOWER_PERSIST_V1 — every row, row 0 included, now reads its
  // Qty / Days / Shift from rowState. The row-0-reads-item.men special case
  // moved up into defaultManpowerRow, which is also where the stored
  // labourItems row is read; keeping the fallback in one place is what stops
  // row 0 from showing the legacy scalar after the array has superseded it.
  const qtyValue = rowState.qty;
  const daysValue = rowState.days;
  const shiftValue = rowState.shift;

  // WBS-SHIFT-S1: look up all three rates for the selected type, then
  // resolve the one that matches the estimator's chosen shift. Defaults to
  // the day rate when shift is absent or unrecognised (preserves prior behaviour).
  const labourRates3 = rowState.labourTypeId ? (labourRateById.get(rowState.labourTypeId) ?? null) : null;
  // catalogueRate is the shift-resolved rate (not always the day rate).
  const catalogueRate = resolveRateForShift(labourRates3, shiftValue);
  const rateIsOverridden = isDayRateOverridden(rowState.dayRateOverride, catalogueRate);
  const resolvedRate = effectiveDayRate(rowState.dayRateOverride, catalogueRate);

  const qtyNum = qtyValue === "" ? null : Number(qtyValue);
  const daysNum = daysValue === "" ? null : Number(daysValue);
  const rowTotal = manpowerRowTotal(qtyNum, daysNum, resolvedRate);

  // Controlled local qty / days so the user can type freely before blur.
  const [localQty, setLocalQty] = useState(String(qtyValue));
  const [localDays, setLocalDays] = useState(String(daysValue));

  // Sync when the row's resolved state changes (server reload after
  // patchItem, or a revert). rowState is recomputed from the refetched item
  // whenever the local map holds nothing for this row, so depending on it
  // alone covers both the optimistic write and the server reconciliation.
  useEffect(() => {
    setLocalQty(rowState.qty);
  }, [rowState.qty]);
  useEffect(() => {
    setLocalDays(rowState.days);
  }, [rowState.days]);

  // Local day-rate input controlled state.
  const [localDayRate, setLocalDayRate] = useState(
    rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : ""
  );
  useEffect(() => {
    setLocalDayRate(rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : "");
  }, [rowState.dayRateOverride]);

  // SCOPE_WBS_INPUTS_V2 — value stays the stored string, label follows the
  // rate card: the "Day" value reads "Weekday".
  const shiftOptions: TooltipSelectOption<string>[] = SHIFT_OPTIONS.map((s) => ({
    value: s,
    label: shiftLabel(s)
  }));

  const cellSt: CSSProperties = { ...fitCellStyle, ...tdBorderStyle, verticalAlign: "top" };

  return (
    <>
      {/* Type — SCOPE_WBS_GROUPRULES_V1: first column of the Manpower group,
          so it carries the left rule that draws the group boundary. */}
      <td style={{ ...cellSt, ...groupRuleStyle }} data-manpower-col="type">
        <TooltipSelect
          value={rowState.labourTypeId ?? ""}
          options={labourTypeOptions}
          onChange={(v) => onLabourTypeChange(v === "" ? null : (v ?? null))}
          disabled={isAi}
          ariaLabel={`Labour type for row ${rowIdx + 1}`}
          /* SCOPE_WBS_INPUTS_V2 — the wording that used to ride on a second,
             prepended blank option now rides on the select's own one. */
          placeholder="- none -"
          style={{ height: 28, minWidth: 140 }}
        />
      </td>

      {/* Qty (men) */}
      <td style={cellSt} data-manpower-col="qty">
        <input
          className="s7-input"
          type="number"
          step="0.01"
          value={localQty}
          disabled={isAi || !hasType}
          aria-label={`Qty for row ${rowIdx + 1}`}
          title={hasType ? "Number of men" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={() => onQtyBlur(localQty)}
        />
      </td>

      {/* Days */}
      <td style={cellSt} data-manpower-col="days">
        <input
          className="s7-input"
          type="number"
          step="0.5"
          value={localDays}
          disabled={isAi || !hasType}
          aria-label={`Days for row ${rowIdx + 1}`}
          title={hasType ? "Number of days" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalDays(e.target.value)}
          onBlur={() => onDaysBlur(localDays)}
        />
      </td>

      {/* Shift */}
      <td style={cellSt} data-manpower-col="shift">
        <TooltipSelect
          value={shiftValue}
          options={shiftOptions}
          onChange={(v) => onShiftChange(v ?? "Day")}
          disabled={isAi || !hasType}
          ariaLabel={`Shift for row ${rowIdx + 1}`}
          style={{ height: 28, minWidth: 80 }}
        />
      </td>

      {/* Rate — OverrideField following the card-level markup override pattern.
          WBS-SHIFT-S1: placeholder and locked-rate title now reflect the
          shift-resolved catalogue rate, not always the day rate. */}
      {/* SCOPE_WBS_INPUTS_V2 — money column: cell and input both right-aligned,
          tabular figures so the decimal points line up down the column. */}
      <td style={{ ...cellSt, textAlign: "right" }} data-manpower-col="day-rate">
        <OverrideField
          isOverridden={rateIsOverridden}
          onRevert={() => {
            onDayRateOverride(null);
            setLocalDayRate("");
          }}
          affordance={false}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={localDayRate}
            placeholder={catalogueRate !== null ? String(catalogueRate) : "—"}
            disabled={isAi}
            aria-label={`Rate for row ${rowIdx + 1}`}
            title={
              rateIsOverridden
                ? `Rate override active. Locked ${shiftLabel(shiftValue)} rate: $${catalogueRate != null ? catalogueRate : "—"}/day`
                : catalogueRate !== null
                  ? `Locked ${shiftLabel(shiftValue)} rate: $${catalogueRate}/day`
                  : "Select a Type to see the rate"
            }
            style={{
              width: 72,
              height: 28,
              padding: "0 4px",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums"
            }}
            onChange={(e) => setLocalDayRate(e.target.value)}
            onBlur={() => {
              if (localDayRate === "") {
                onDayRateOverride(null);
              } else {
                const n = Number(localDayRate);
                if (Number.isFinite(n)) onDayRateOverride(n);
              }
            }}
          />
        </OverrideField>
      </td>

      {/* Total — read-only, right-aligned, tabular-nums; em dash when no manpower.
          SCOPE_WBS_GROUPRULES_V1 — the row-remove `x` is appended here rather
          than getting a column of its own. The slot is always reserved (an
          empty span when the item has a single row) so the money column keeps
          one right edge whichever row you are looking at. */}
      <td
        style={{ ...cellSt, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        data-manpower-col="total"
        aria-label={`Manpower total for row ${rowIdx + 1}`}
        title="Qty x Days x Day rate (display only; server is authoritative)"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>{fmtManpowerTotal(rowTotal)}</span>
          {showRemove ? (
            <button
              type="button"
              aria-label={`Remove row ${rowIdx + 1} from ${item.wbsCode}`}
              title="Remove this row"
              onClick={onRemoveRow}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "1px solid var(--border-default, #e5e7eb)",
                background: "transparent",
                color: "var(--status-danger, #EF4444)",
                cursor: "pointer",
                fontSize: 11,
                lineHeight: 1,
                padding: 0,
                flex: "0 0 auto"
              }}
            >
              x
            </button>
          ) : (
            /* Always reserve the slot so the money column keeps one right edge */
            <span style={{ display: "inline-block", width: 18, flex: "0 0 auto" }} />
          )}
        </span>
      </td>
    </>
  );
}

// ── SCOPE_WBS_PLANT_V1 — PlantRowCells ──────────────────────────────────────
// Renders the 5 per-row plant columns:
//   Type · Qty · Days · Day rate · Total
// Each column is a separate <td> (not a single spanning cell), mirroring
// ManpowerRowCells exactly. Type is a grouped catalogue select; the estimator
// can drop out to a free-text custom machine. A custom machine has NO locked
// rate — its Day rate cell is an override-by-definition, placeholder "rate".
// When Type is unset, Qty / Days are disabled but rendered at full width so
// column widths are stable (same rule as ManpowerRowCells).

type PlantRowCellsProps = {
  item: ScopeItem;
  rowIdx: number;
  rowState: RowPlantState;
  /** SCOPE_PLANT_PICKER_V2 — grouped catalogue + the trailing manual entry. */
  plantTypeGroups: TooltipSelectOptionGroup<string>[];
  plantRateById: Map<string, { rate: number; unit: string; item: string }>;
  isAi: boolean;
  onPlantTypeChange: (plantRateId: string | null) => void;
  onCustomDescription: (desc: string) => void;
  onRevertToList: () => void;
  onQtyBlur: (v: string) => void;
  onDaysBlur: (v: string) => void;
  onDayRateOverride: (v: number | null) => void;
};

function PlantRowCells({
  item: _item,
  rowIdx,
  rowState,
  plantTypeGroups,
  plantRateById,
  isAi,
  onPlantTypeChange,
  onCustomDescription,
  onRevertToList,
  onQtyBlur,
  onDaysBlur,
  onDayRateOverride
}: PlantRowCellsProps) {
  const isCustom = rowState.customDescription !== null;
  const hasType = rowState.plantRateId !== null || isCustom;

  // Catalogue rate for the selected type (null = no type or custom machine).
  const catalogueEntry = rowState.plantRateId ? plantRateById.get(rowState.plantRateId) : null;
  const catalogueRate = catalogueEntry ? catalogueEntry.rate : null;
  const catalogueUnit = catalogueEntry ? catalogueEntry.unit : null;

  // Custom machines have no locked rate — override is by definition.
  const rateIsOverridden = isCustom
    ? rowState.dayRateOverride !== null
    : isPlantRateOverridden(rowState.dayRateOverride, catalogueRate);
  const resolvedRate = isCustom
    ? rowState.dayRateOverride
    : effectivePlantRate(rowState.dayRateOverride, catalogueRate);

  const qtyNum = rowState.qty === "" ? null : Number(rowState.qty);
  const daysNum = rowState.days === "" ? null : Number(rowState.days);
  const rowTotal = plantRowTotal(qtyNum, daysNum, resolvedRate);

  // Controlled local inputs.
  const [localQty, setLocalQty] = useState(rowState.qty);
  const [localDays, setLocalDays] = useState(rowState.days);
  const [localDayRate, setLocalDayRate] = useState(
    rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : ""
  );
  const [localCustomDesc, setLocalCustomDesc] = useState(rowState.customDescription ?? "");

  useEffect(() => { setLocalQty(rowState.qty); }, [rowState.qty]);
  useEffect(() => { setLocalDays(rowState.days); }, [rowState.days]);
  useEffect(() => {
    setLocalDayRate(rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : "");
  }, [rowState.dayRateOverride]);
  useEffect(() => {
    setLocalCustomDesc(rowState.customDescription ?? "");
  }, [rowState.customDescription]);

  const cellSt: CSSProperties = { ...fitCellStyle, ...tdBorderStyle, verticalAlign: "top" };

  return (
    <>
      {/* Type — catalogue select or custom text input.
          SCOPE_WBS_GROUPRULES_V1: first column of the Plant group, so it
          carries the left rule that draws the group boundary. */}
      <td style={{ ...cellSt, ...groupRuleStyle }} data-plant-col="type">
        {isCustom ? (
          /* Custom machine: free-text input + revert control */
          <OverrideField
            isOverridden={true}
            onRevert={onRevertToList}
            affordance={false}
          >
            <input
              className="s7-input"
              type="text"
              value={localCustomDesc}
              disabled={isAi}
              aria-label={`Custom plant description for row ${rowIdx + 1}`}
              title="Custom machine — not in catalogue. Click revert to return to the list."
              style={{ width: 140, height: 28, padding: "0 4px" }}
              onChange={(e) => setLocalCustomDesc(e.target.value)}
              onBlur={() => onCustomDescription(localCustomDesc)}
            />
          </OverrideField>
        ) : (
          <TooltipSelect
            value={rowState.plantRateId ?? ""}
            optionGroups={plantTypeGroups}
            onChange={(v) => {
              if (v === "" || v == null) {
                onPlantTypeChange(null);
              } else if (v === PLANT_CUSTOM_VALUE) {
                // SCOPE_PLANT_PICKER_V2 — this branch is UNCHANGED; it is only
                // now reachable, because groupPlantTypeOptions finally emits
                // the option that carries this value. Blank description +
                // customDescription "" is what makes isCustom true, which
                // swaps this select for the free-text input above and the
                // Day rate cell for the unlocked one below.
                onCustomDescription("");
              } else {
                onPlantTypeChange(v);
              }
            }}
            disabled={isAi}
            ariaLabel={`Plant type for row ${rowIdx + 1}`}
            /* SCOPE_WBS_INPUTS_V2 — see the labour Type select: one blank
               option, and it is the component's own. */
            placeholder="- none -"
            style={{ height: 28, minWidth: 140 }}
          />
        )}
      </td>

      {/* Qty */}
      <td style={cellSt} data-plant-col="qty">
        <input
          className="s7-input"
          type="number"
          step="0.01"
          value={localQty}
          disabled={isAi || !hasType}
          aria-label={`Plant qty for row ${rowIdx + 1}`}
          title={hasType ? "Quantity" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={() => onQtyBlur(localQty)}
        />
      </td>

      {/* Days */}
      <td style={cellSt} data-plant-col="days">
        <input
          className="s7-input"
          type="number"
          step="0.5"
          value={localDays}
          disabled={isAi || !hasType}
          aria-label={`Plant days for row ${rowIdx + 1}`}
          title={hasType ? "Number of days" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalDays(e.target.value)}
          onBlur={() => onDaysBlur(localDays)}
        />
      </td>

      {/* Day rate — for catalogue picks uses OverrideField (amber when overridden,
          revert restores locked rate); for custom machines the input is plain
          (no locked rate to revert to). Rate unit badge shows /day, /hr etc. */}
      {/* SCOPE_WBS_INPUTS_V2 — money column: right-aligned cell, right-aligned
          inputs, tabular figures. The flex rows below justify to the end so the
          input (and the /unit badge) sit against the same right edge as the
          Total column next door. */}
      <td style={{ ...cellSt, textAlign: "right" }} data-plant-col="day-rate">
        {isCustom ? (
          /* Custom machine: plain rate input, no locked rate, no revert */
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
            <input
              className="s7-input"
              type="number"
              step="0.01"
              value={localDayRate}
              placeholder="rate"
              disabled={isAi}
              aria-label={`Plant day rate for row ${rowIdx + 1}`}
              title="Custom machine — no locked rate. Enter rate manually."
              style={{
                width: 72,
                height: 28,
                padding: "0 4px",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums"
              }}
              onChange={(e) => setLocalDayRate(e.target.value)}
              onBlur={() => {
                if (localDayRate === "") {
                  onDayRateOverride(null);
                } else {
                  const n = Number(localDayRate);
                  if (Number.isFinite(n)) onDayRateOverride(n);
                }
              }}
            />
          </div>
        ) : (
          /* Catalogue pick: OverrideField shows amber when rate differs from locked */
          <OverrideField
            isOverridden={rateIsOverridden}
            onRevert={() => {
              onDayRateOverride(null);
              setLocalDayRate("");
            }}
            affordance={false}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                value={localDayRate}
                placeholder={
                  catalogueRate !== null
                    ? String(catalogueRate)
                    : "—"
                }
                disabled={isAi}
                aria-label={`Plant day rate for row ${rowIdx + 1}`}
                title={
                  rateIsOverridden
                    ? `Rate override active. Locked rate: $${catalogueRate != null ? catalogueRate : "—"}/${catalogueUnit ?? "day"}`
                    : catalogueRate !== null
                      ? `Locked rate: $${catalogueRate}/${catalogueUnit ?? "day"}`
                      : "Select a Type to see the rate"
                }
                style={{
                  width: 72,
                  height: 28,
                  padding: "0 4px",
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums"
                }}
                onChange={(e) => setLocalDayRate(e.target.value)}
                onBlur={() => {
                  if (localDayRate === "") {
                    onDayRateOverride(null);
                  } else {
                    const n = Number(localDayRate);
                    if (Number.isFinite(n)) onDayRateOverride(n);
                  }
                }}
              />
              {/* Rate unit badge — shows /day, /hr, /week etc. as the catalogue records it */}
              {catalogueUnit ? (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted, #6b7280)",
                    whiteSpace: "nowrap",
                    userSelect: "none"
                  }}
                  title={`Rate unit: ${catalogueUnit}`}
                >
                  /{catalogueUnit}
                </span>
              ) : null}
            </div>
          </OverrideField>
        )}
      </td>

      {/* Total — read-only, right-aligned, tabular-nums; em dash when no plant */}
      <td
        style={{ ...cellSt, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        data-plant-col="total"
        aria-label={`Plant total for row ${rowIdx + 1}`}
        title="Qty x Days x Day rate (display only; server is authoritative)"
      >
        {fmtPlantTotal(rowTotal)}
      </td>
    </>
  );
}

// ── SCOPE_WBS_ACTIONS_V1 — the measurement components moved out ─────────
//
// ItemMeasurementCell, ItemBodyInputs, MaterialCluster, ItemMaterialTotals and
// the FieldCell wrapper the four of them shared stood here, ~1060 lines of
// them, and they are now scope-cards/WbsMeasurementBlock.tsx. Their handlers
// and their PATCH payloads went across unchanged — that is what makes this
// slice a relocation and not a rewrite of how a measurement is priced. The one
// thing that is genuinely gone is ItemMeasurementCell's `if (rowIdx > 0)
// return null` guard: measurements no longer hang off a manpower/plant row at
// all, so there is no row index for them to be wrong about.

// ── TaskHoursHint + Divider ─────────────────────────────────────────────


function TaskHoursHint({ men, days }: { men: string | null; days: string | null }) {
  const menNum = men === null || men === "" ? null : Number(men);
  const daysNum = days === null || days === "" ? null : Number(days);
  const hours =
    menNum !== null &&
    daysNum !== null &&
    Number.isFinite(menNum) &&
    Number.isFinite(daysNum) &&
    menNum >= 0 &&
    daysNum >= 0
      ? menNum * daysNum * 8
      : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        paddingBottom: 8,
        fontSize: 11,
        color: "var(--text-muted)",
        whiteSpace: "nowrap"
      }}
      title="Task hours: persons × days × 8h"
    >
      {hours === null ? "—" : `${hours.toFixed(1)} h`}
    </div>
  );
}

function Divider() {
  return (
    <div
      role="separator"
      style={{
        height: 0,
        borderTop: "1px dashed var(--border-default, #e5e7eb)",
        margin: "0 -4px"
      }}
    />
  );
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  marginBottom: 2
};
