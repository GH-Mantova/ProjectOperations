import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { NotesField } from "../../components";
import { SectionMarkupOverride } from "./SectionMarkupOverride";
import { LineMarkupCell } from "./scope-cards/LineMarkupCell";
import { TipFinderDrawer } from "../../components/TipFinderDrawer";
import {
  QuoteDestinationSelect,
  DESTINATION_ROW_CLASS,
  DESTINATION_NOTE,
  type QuoteDestination
} from "./scope-cards/QuoteDestinationSelect";

// Waste disposal rows for a tender × discipline. truckDays and lineTotal
// are derived server-side — the UI only submits raw inputs (tonnes, loads,
// rates) and re-reads the server response. Minimal dependencies on the
// wider scope tab (just the selected discipline and the list of WBS refs
// for its scope items, for the row-level wbsRef dropdown).

type WasteRow = {
  id: string;
  tenderId: string;
  discipline: string;
  wbsRef: string | null;
  description: string;
  wasteGroup: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  // PR B4a — `unit` is no longer user-editable on the subtable. It's a
  // read-only display badge carrying the facility's rate unit forward
  // ("Billed by" column). `autoSummed` distinguishes rows created by
  // "Sum from above" (regenerable) from manual rows (preserved).
  unit: string | null;
  autoSummed: boolean;
  // PR B4a — the qty column carries the primary waste quantity (tonnes
  // by default); m³ is the companion column. Both are persisted per row;
  // the line total bills against whichever side matches the facility's
  // rate.unit. Renamed from `wasteTonnes` in chore/schema-hygiene-waste.
  qty: string | null;
  m3: string | null;
  wasteLoads: number | null;
  truckDays: string | null;
  ratePerTonne: string | null;
  ratePerLoad: string | null;
  lineTotal: string | null;
  notes: string | null;
  sortOrder: number;
  // R3 T-1 - waste transport cost engine columns.
  transportRateId: string | null;
  assetId: string | null;
  qtyTrucks: number | null;
  loadsPerTruckPerDay: string | null;
  capacityPerLoad: string | null;
  capacityUnit: string | null;
  dailyKm: string | null;
  transportCost: string | null;
  fuelCost: string | null;
  disposalCost: string | null;
  quotedDisposalRate: string | null;
  quotedFuelPricePerLitre: string | null;
  // SCOPE_QD_UI_SECTIONS_V1 — where this row's cost lands on the client quote.
  quoteDestination?: QuoteDestination | null;
  // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — per-line markup fields.
  // null markupOverride = inherit card.wasteMarkupOverride ?? tenderMarkup.
  markupOverride?: number | null;
  /** Server-computed effective markup % for this line. */
  effectiveMarkup?: number;
  /** Server-computed line total at effectiveMarkup rate (lineTotalWithMarkup). */
  lineTotalWithMarkup?: number;
  // TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- tip link and travel snapshot.
  mapLocationId?: string | null;
  travelKm?: string | null;
  travelMinutesOneWay?: number | null;
  travelSource?: string | null;
  travelDetail?: string | null;
  // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- where capacityPerLoad came from.
  // "matrix" = filled from the transport-capacity reference table.
  // "manual" = typed by the estimator.
  // null/undefined = predates this column (unknown provenance).
  capacitySource?: string | null;
  // GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g) -- editable traffic index and derived fields.
  // travelIndex: the modelled traffic allowance (>= 1.00).
  // travelIndexSource: "geoapify" | "manual" | "none".
  // travelPlanningMinutesOneWay: average(baseline, baseline x index) -- used for cycle.
  // totalTripKm: trips x 2 x one-way km; fuel is charged on this.
  // loadsSource: "cycle" (derived from planning minutes) | "manual" | null.
  // dailyKmSource: "derived" (totalTripKm / trucks) | "manual" | null.
  travelIndex?: number | null;
  travelIndexSource?: string | null;
  travelPlanningMinutesOneWay?: number | null;
  totalTripKm?: number | null;
  loadsSource?: string | null;
  dailyKmSource?: string | null;
};

type WasteRate = {
  id: string;
  wasteGroup: string | null;
  wasteType: string;
  facility: string;
  unit: string;
  tonRate: string;
  loadRate: string;
  isActive: boolean;
};

// TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- map locations of kind TIP for the
// tip picker. Only name and id are needed for the select.
type TipLocation = {
  id: string;
  name: string;
  suburb: string;
};

// R3 T-1 - Transport Fees are EstimatePlantRate rows where category === "Truck"
// or unit === "each way" (mirrors rates-export.service isTransportPlantRate).
type PlantRate = {
  id: string;
  item: string;
  unit: string;
  rate: string;
  fuelRate: string;
  isActive: boolean;
  category: string | null;
  // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- which matrix transport type
  // this rig corresponds to. Null when not set (no matrix default available).
  transportType?: string | null;
};

function isTransportPlantRate(p: PlantRate): boolean {
  return p.category === "Truck" || p.unit === "each way";
}

type VarianceResult = {
  itemId: string;
  quotedDisposalRate: number | null;
  currentDisposalRate: number | null;
  quotedFuelPricePerLitre: number | null;
  currentFuelPricePerLitre: number | null;
  disposalDelta: number | null;
  fuelDelta: number | null;
  quotedTransportRatePerDay: number | null;
  currentTransportRatePerDay: number | null;
  transportDelta: number | null;
  hasVariance: boolean;
};

function ceilHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function fmtCurrency(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

// ── SCOPE_WASTE_SECTION_V1 ──────────────────────────────────────────────
//
// The Waste section, rebuilt in the visual language of the sections either
// side of it (Other operational costs above, Cutting take-off below): a fold
// caret, a summary that stays readable while the section is closed, and the
// same `s7-card` shell and `s7-type-section-heading` the siblings use.
//
// WHAT THIS SLICE DELIBERATELY DOES NOT DO — read before adding a total prop.
//
// This section reports NO total to the card fold, and that is not an
// oversight. Waste is ALREADY in the tender price, as its own independently
// marked-up cost stream, computed on the server:
//
//   scope-redesign.service.ts summary()
//     wasteWithMarkup += lineTotalWithMarkup  (resolveEffectiveMarkup per-line)
//     tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup
//
// with `rate = card.wasteMarkupOverride ?? tenderMarkup`. The server states
// the invariant in the same breath: waste and cutting are "independent cost
// streams from the scope-card total ... NEVER folded into the scope
// discipline total", and summary-section-markup.spec.ts pins it with
// asymmetric markups so a combined base cannot coincide.
//
// The card bar's `subtotal` is the scope-discipline figure. Folding the waste
// subtotal into it would put waste inside the very total the server says it
// must stay out of, and would apply the SCOPE markup chain to money that has
// already been marked up on its own section rate. So the card subtotal is
// identical before and after this slice, by design.
//
// The money figures below are the server's, summed and formatted — never
// re-derived. `lineTotal` is computed in ScopeWasteService.deriveTotals and
// the transport rate is snapshotted onto the row as `quotedTransportRatePerDay`;
// a second implementation in TypeScript is how the screen and the quote start
// disagreeing.

/** The plant constant for this section, exported so the source marker is
 *  reachable from a test as a value and not only as a comment. */
export const SCOPE_WASTE_SECTION_V1 = "SCOPE_WASTE_SECTION_V1";

/** WASTE_TRAVEL_INDEX_UI_V1 (scopecards-s8h) -- travel strip, editable traffic
 *  allowance, provenance chips, totals strip, infeasible-cycle state, and the
 *  tip-finder mapLocationId fix.  */
export const WASTE_TRAVEL_INDEX_UI_V1 = "scopecards-s8h";

/** Money in the card's house format — two decimals, matching
 *  `fmtCuttingMoney` so the sections either side read the same. */
export function fmtWasteMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** The line count in words: "no lines" / "1 line" / "4 lines". A collapsed
 *  card that disposes of nothing should say so, not show "(0 rows)". */
export function wasteLineCountPhrase(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "no lines";
  return `${count} line${count === 1 ? "" : "s"}`;
}

/** Sum of the SERVER's line totals. No rate, no tonnage, no multiplication —
 *  the same shape as `sumCuttingTakeOff`. */
export function sumWasteLineTotals(rows: Array<{ lineTotal: string | number | null }>): number {
  return rows.reduce((sum, r) => {
    const n = r.lineTotal === null || r.lineTotal === "" ? 0 : Number(r.lineTotal);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

// ── Four-way money reporting ─────────────────────────────────────────────
//
// SCOPE_QD_UI_SECTIONS_V1 — sort each row's server lineTotal into one of four
// destination piles. Nothing is computed in the browser.

/** One destination's contribution for waste (subtotal only; no per-section
 *  markup knowledge here — that lives in the independent cost stream). */
export type WasteDestBucket = { subtotal: number; withMarkup: number };

/** Four-way money shape reported upward. */
export type WasteFourWay = {
  price: WasteDestBucket;
  provisional: WasteDestBucket;
  option: WasteDestBucket;
  internal: WasteDestBucket;
};

/**
 * Sort waste rows into four piles by destination.
 * Uses the server's lineTotal; no arithmetic on rates.
 */
export function wasteFourWay(
  rows: Array<{ lineTotal: string | number | null; quoteDestination?: QuoteDestination | null }>
): WasteFourWay {
  const result: WasteFourWay = {
    price: { subtotal: 0, withMarkup: 0 },
    provisional: { subtotal: 0, withMarkup: 0 },
    option: { subtotal: 0, withMarkup: 0 },
    internal: { subtotal: 0, withMarkup: 0 }
  };
  for (const row of rows) {
    const n = row.lineTotal === null || row.lineTotal === "" ? 0 : Number(row.lineTotal);
    if (!Number.isFinite(n)) continue;
    const dest: QuoteDestination = row.quoteDestination ?? "PRICE";
    const key = dest.toLowerCase() as keyof WasteFourWay;
    if (key in result) {
      result[key].subtotal += n;
      result[key].withMarkup += n;
    }
  }
  return result;
}

// ── Destination row rail helpers (page-local) ────────────────────────────

function wasteDestRowStyle(dest: QuoteDestination): CSSProperties {
  if (dest === "PROVISIONAL") {
    return { boxShadow: "inset 3px 0 0 var(--status-accent, var(--brand-secondary))" };
  }
  if (dest === "OPTION") {
    return { boxShadow: "inset 3px 0 0 var(--brand-primary)" };
  }
  if (dest === "INTERNAL") {
    return {
      boxShadow: "inset 3px 0 0 var(--border-default)",
      background: "var(--surface-subtle)"
    };
  }
  return {};
}

function wasteInternalOpacity(
  dest: QuoteDestination,
  base: CSSProperties = {}
): CSSProperties {
  return dest === "INTERNAL" ? { ...base, opacity: 0.55 } : base;
}

function wasteDestNote(dest: QuoteDestination): string | null {
  return DESTINATION_NOTE[dest] ?? null;
}

/** "+ 30% markup" — the rate actually in force, override first. */
export function wasteMarkupPhrase(
  override: number | null | undefined,
  tenderMarkup: number
): string {
  const rate = override != null ? override : tenderMarkup;
  return `+ ${rate}% markup`;
}

/**
 * SCOPE_WASTE_SECTION_V1 — the fold header.
 *
 * Presentational and auth-free so the suite can render it directly (the web
 * workspace has no jsdom). Everything the estimator needs while the section
 * is CLOSED lives here: the caret, the title, the line count in words, and
 * on the right the subtotal and the `+ N% markup` figure. This block renders
 * identically whether the section is open or closed — only the body below it
 * is conditional.
 */
export function WasteSectionSummary({
  discipline,
  lineCount,
  subtotal,
  withMarkup,
  sectionMarkupOverride,
  tenderMarkup,
  collapsed,
  onToggle
}: {
  discipline: string;
  lineCount: number;
  subtotal: number;
  /** SCOPE_LINE_MARKUP_ALL_TYPES_V1: sum of server lineTotalWithMarkup. */
  withMarkup?: number;
  sectionMarkupOverride?: number | null;
  tenderMarkup?: number;
  collapsed: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap"
      }}
      data-testid="waste-section-summary"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="waste-section-body"
          aria-label={`${collapsed ? "Expand" : "Collapse"} waste section`}
          title={collapsed ? "Expand the waste section" : "Collapse the waste section"}
          data-testid="waste-section-caret"
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: "var(--text-secondary)",
            width: 24,
            height: 24,
            lineHeight: 1,
            padding: 0,
            flexShrink: 0
          }}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          {discipline} — Waste disposal
          <span
            style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}
            data-testid="waste-section-line-count"
          >
            ({wasteLineCountPhrase(lineCount)})
          </span>
        </h3>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Subtotal:{" "}
        <strong style={{ color: "var(--text)" }} data-testid="waste-section-subtotal">
          {fmtWasteMoney(subtotal)}
        </strong>
        {tenderMarkup !== undefined ? (
          <>
            <span> · </span>
            <span data-testid="waste-section-markup-label">
              {wasteMarkupPhrase(sectionMarkupOverride, tenderMarkup)}
            </span>
            :{" "}
            <strong style={{ color: "var(--text)" }} data-testid="waste-section-with-markup">
              {fmtWasteMoney(withMarkup ?? subtotal)}
            </strong>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ScopeWasteTab({
  tenderId,
  discipline,
  wbsRefs,
  canManage,
  wasteNotes,
  onWasteNotesChange,
  cardId,
  tenderMarkup,
  sectionMarkupOverride,
  onSectionMarkupChange
}: {
  tenderId: string;
  discipline: string;
  wbsRefs: string[];
  canManage: boolean;
  // PR B1.7 — shared notes for the whole subtable (persists to
  // ScopeCard.wasteNotes via PATCH /scope/cards/:cardId). Optional so
  // legacy callers without card context still render.
  wasteNotes?: string | null;
  onWasteNotesChange?: (value: string | null) => Promise<void> | void;
  // PR B3 — when supplied, the subtable lists rows scoped to this
  // card (instead of the whole discipline) and exposes the "Sum from
  // above" button.
  cardId?: string;
  // Per-section markup override for this card's waste subtable.
  // Independent cost stream from the scope-card markup.
  tenderMarkup?: number;
  sectionMarkupOverride?: number | null;
  onSectionMarkupChange?: (next: number | null) => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<WasteRow[]>([]);
  const [rates, setRates] = useState<WasteRate[]>([]);
  // R3 T-1 - Transport Fees plant rates for the transport picker.
  const [transportRates, setTransportRates] = useState<PlantRate[]>([]);
  // TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- TIP map locations for the tip picker.
  const [tipLocations, setTipLocations] = useState<TipLocation[]>([]);
  // R3 T-1 - per-row expand toggle for the cost-engine detail panel.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // R3 T-1 - variance check results keyed by row id (populated on expand).
  const [variance, setVariance] = useState<Record<string, VarianceResult>>({});
  // SCOPE_WASTE_SECTION_V1 — fold state. Starts OPEN so an estimator who
  // already relies on this section is not surprised by a closed one; the
  // summary above stays readable either way.
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OPS-M3 — Tip Finder drawer state.
  // mode "find": opened via "Find a tip" next to FACILITY (any row).
  // mode "map": opened via "Map" next to dailyKm (row must have a current facility set).
  const [tipDrawer, setTipDrawer] = useState<{
    rowId: string;
    mode: "find" | "map";
  } | null>(null);

  // OPS-M3 — per-row dailyKm suggestion (shown as click-to-apply when user
  // has already typed a value). Keyed by rowId, value is the round-trip km
  // rounded to 1dp (= round(distanceKm × 2, 1)).
  const [kmSuggest, setKmSuggest] = useState<Record<string, number>>({});

  // Ref map for dailyKm inputs so we can imperatively update the uncontrolled
  // input after auto-fill (avoids a full remount / defaultValue stale issue).
  const dailyKmRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // PR B3 — when a cardId is in scope, filter by it (per-card view).
      // Falls back to whole-discipline for legacy callers without a card.
      const wasteUrl = cardId
        ? `/tenders/${tenderId}/scope/waste?cardId=${encodeURIComponent(cardId)}`
        : `/tenders/${tenderId}/scope/waste?discipline=${discipline}`;
      const [rowsResp, ratesResp, plantResp, tipsResp] = await Promise.all([
        authFetch(wasteUrl),
        authFetch(`/estimate-rates/waste`),
        authFetch(`/estimate-rates/plant`),
        // TRAVEL_TIME_PORT_V1 -- load TIP map locations for the tip picker.
        authFetch(`/map-locations?kind=TIP`)
      ]);
      if (!rowsResp.ok) throw new Error(await readApiErrorMessage(rowsResp));
      setRows((await rowsResp.json()) as WasteRow[]);
      if (ratesResp.ok) {
        const arr = (await ratesResp.json()) as WasteRate[];
        setRates(arr.filter((r) => r.isActive));
      }
      if (plantResp.ok) {
        const arr = (await plantResp.json()) as PlantRate[];
        setTransportRates(arr.filter((r) => r.isActive && isTransportPlantRate(r)));
      }
      if (tipsResp.ok) {
        const arr = (await tipsResp.json()) as TipLocation[];
        setTipLocations(arr);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, discipline, cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cascade helpers — group → types → facilities → rate record. Exposed
  // as plain computed arrays so the row renderer can filter on each
  // change cheaply.
  const groups = useMemo(() => {
    const s = new Set<string>();
    for (const r of rates) if (r.wasteGroup) s.add(r.wasteGroup);
    return [...s].sort();
  }, [rates]);
  const typesForGroup = (group: string | null) => {
    const s = new Set<string>();
    for (const r of rates) if (!group || r.wasteGroup === group) s.add(r.wasteType);
    return [...s].sort();
  };
  const facilitiesForType = (type: string | null) => {
    const s = new Set<string>();
    for (const r of rates) if (!type || r.wasteType === type) s.add(r.facility);
    return [...s].sort();
  };
  // PR B4a — facility filter relaxed to (group, type) only. A given
  // (group, type) may map to multiple facilities at different units;
  // the chosen facility's rate.unit decides which side (tonnes vs m³)
  // the line total bills against.
  const facilitiesForRow = (group: string | null, type: string | null) => {
    const s = new Set<string>();
    for (const r of rates) {
      if (group && r.wasteGroup !== group) continue;
      if (type && r.wasteType !== type) continue;
      s.add(r.facility);
    }
    return [...s].sort();
  };
  const rateFor = (type: string | null, facility: string | null) => {
    if (!type || !facility) return null;
    return rates.find((r) => r.wasteType === type && r.facility === facility) ?? null;
  };

  const addRow = async () => {
    if (!canManage) return;
    // PR B-followup — cardId is now required by the API. Guard the
    // legacy whole-tender mount path with a controlled error.
    if (!cardId) {
      setError("Cannot add a waste row without a scope card in context.");
      return;
    }
    const body = {
      discipline,
      cardId,
      wbsRef: wbsRefs[0] ?? null,
      description: "Waste disposal"
    };
    const response = await authFetch(`/tenders/${tenderId}/scope/waste`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    // openTransportByDefault: seed the freshly-created row's id into
    // `expanded` so the transport sub-row is reachable without a click.
    // Server-loaded rows are unaffected — they keep the collapsed default.
    const openTransportByDefault = true;
    if (openTransportByDefault) {
      try {
        const created = (await response.json()) as { id?: string };
        if (created?.id) {
          setExpanded((prev) => ({ ...prev, [created.id!]: true }));
        }
      } catch {
        // No JSON body — skip auto-expand; load() below still refreshes.
      }
    }
    await load();
  };

  // PR B3 — "Sum from items above" handler. Confirm dialog fires only when
  // there's at least one autoSummed row already (those will be
  // regenerated). Manual rows are preserved server-side regardless.
  //
  // SCOPE_WASTE_SECTION_V1 — what the SECOND press does, stated where the
  // button is: the server's sumFromAbove opens a transaction, deletes every
  // `autoSummed: true` row on this card, and recreates them from the current
  // measurements. It REPLACES; it does not append. Pressing it twice with
  // unchanged measurements therefore yields the same tonnage and the same
  // subtotal, and rows the estimator typed by hand (autoSummed: false) are
  // outside the delete filter and survive untouched.
  const sumFromAbove = async () => {
    if (!canManage || !cardId) return;
    const autoCount = rows.filter((r) => r.autoSummed).length;
    if (autoCount > 0) {
      const ok = await confirm({
        title: "Sum from items above",
        message: `This replaces ${autoCount} auto-summed waste line${
          autoCount === 1 ? "" : "s"
        } with a fresh sum of the measurements ticked Waste? above — it does not add to them, so the tonnage will not double. Hand-typed lines are preserved. Continue?`,
        confirmLabel: "Regenerate",
        variant: "danger"
      });
      if (!ok) return;
    }
    const response = await authFetch(
      `/tenders/${tenderId}/scope/cards/${cardId}/waste/sum-from-above`,
      { method: "POST" }
    );
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  const patchRow = async (id: string, patch: Record<string, unknown>) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  // R3 T-1 - toggle the engine detail panel for a row; fetch variance on open.
  const toggleExpand = async (id: string) => {
    const next = !expanded[id];
    setExpanded((prev) => ({ ...prev, [id]: next }));
    if (next && !variance[id]) {
      const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}/variance`);
      if (response.ok) {
        const v = (await response.json()) as VarianceResult;
        setVariance((prev) => ({ ...prev, [id]: v }));
      }
    }
  };

  const escalateVariance = async (id: string) => {
    if (!canManage) return;
    const ok = await confirm({
      title: "Escalate variance",
      message:
        "Escalate this waste line for confirmation? The system does not auto-reprice - the responsible role will confirm.",
      confirmLabel: "Escalate"
    });
    if (!ok) return;
    const response = await authFetch(
      `/tenders/${tenderId}/scope/waste/${id}/escalate-variance`,
      { method: "POST" }
    );
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    const result = (await response.json()) as { escalated: boolean; recipients: number };
    if (!result.escalated) {
      setError(
        "The 'waste_line.rate_variance_escalated' trigger is not enabled. Ask an admin to enable it in Notification Settings."
      );
    }
  };

  const deleteRow = async (id: string) => {
    const ok = await confirm({
      title: "Delete waste row",
      message: "Delete this waste row?",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  // OPS-M3 / WASTE_TRAVEL_INDEX_UI_V1 (scopecards-s8h) -- Called when the
  // user presses "Use this facility" inside the TipFinderDrawer. Writes both
  // the facility name AND the mapLocationId to the row (same patch the tip
  // dropdown makes at row.mapLocationId). Without the id, the tip sticks as a
  // name but the travel-estimate re-resolve never fires (the server needs the
  // id to look up coordinates).
  //
  // distanceKm is the one-way haversine from m2's response; round trip =
  // round(distanceKm x 2, 1). We do NOT recompute -- we use exactly what m2
  // returned.
  const handleTipChosen = useCallback(
    async (
      facilityName: string,
      mapLocationId: string,
      distanceKm: number
    ) => {
      if (!tipDrawer) return;
      const { rowId } = tipDrawer;
      const row = rows.find((r) => r.id === rowId);
      if (!row) {
        setTipDrawer(null);
        return;
      }

      // 1. Write facility + mapLocationId to the waste row.
      //    mapLocationId triggers the server's travel re-resolve (same as
      //    the tip dropdown). DO NOT write any rate / $/unit / $/load.
      await patchRow(rowId, { wasteFacility: facilityName, mapLocationId });

      // 2. dailyKm auto-fill logic.
      if (distanceKm > 0) {
        const roundTrip = Math.round(distanceKm * 2 * 10) / 10; // 1dp
        const existingKm = row.dailyKm ? Number(row.dailyKm) : null;

        if (existingKm !== null && existingKm !== roundTrip) {
          // User has a manually-typed value — show suggestion, don't overwrite.
          setKmSuggest((prev) => ({ ...prev, [rowId]: roundTrip }));
        } else {
          // Empty or same value — auto-fill directly.
          await patchRow(rowId, { dailyKm: roundTrip });
          // Update the uncontrolled input's displayed value.
          const inputEl = dailyKmRefs.current[rowId];
          if (inputEl) inputEl.value = String(roundTrip);
          setKmSuggest((prev) => {
            const next = { ...prev };
            delete next[rowId];
            return next;
          });
        }
      }

      // 3. Close drawer.
      setTipDrawer(null);
    },
    [tipDrawer, rows, patchRow]
  );

  // SCOPE_WASTE_SECTION_V1 — one implementation, exported and unit-tested.
  // A sum of the server's own line totals; nothing is re-derived here.
  const subtotal = useMemo(() => sumWasteLineTotals(rows), [rows]);
  // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — sum of server lineTotalWithMarkup.
  // Section "with markup" figure = Σ rows' lineTotalWithMarkup (server-provided).
  const withMarkup = useMemo(
    () => rows.reduce((sum, r) => {
      if (r.lineTotalWithMarkup != null && Number.isFinite(r.lineTotalWithMarkup)) {
        return sum + r.lineTotalWithMarkup;
      }
      // Fallback for pre-S3 rows: use lineTotal (no markup applied yet).
      const n = r.lineTotal === null || r.lineTotal === "" ? 0 : Number(r.lineTotal);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0),
    [rows]
  );
  // SoT §10 waste-weight calculator surface (BACKLOG-DECISIONS.md #7):
  // display-only Σ tonnes across all rows so estimators can eyeball the
  // total waste volume they're pricing against. Pure sum — the server's
  // wasteWeightCalculator seam owns the m³ × density → tonnes math.
  const totalTonnes = useMemo(
    () => rows.reduce((sum, r) => (r.qty ? sum + Number(r.qty) : sum), 0),
    [rows]
  );

  return (
    <section className="s7-card" style={{ marginTop: 16 }} data-testid="scope-waste-section">
      {/* SCOPE_WASTE_SECTION_V1 — the fold summary. Always rendered, open or
          closed: line count in words on the left, subtotal and the
          "+ N% markup" figure on the right. */}
      <WasteSectionSummary
        discipline={discipline}
        lineCount={rows.length}
        subtotal={subtotal}
        withMarkup={withMarkup}
        sectionMarkupOverride={sectionMarkupOverride}
        tenderMarkup={tenderMarkup}
        collapsed={collapsed}
        onToggle={() => {
          // Closing the section closes the tip drawer with it — a drawer
          // anchored to a row nobody can see is a trap.
          setCollapsed((prev) => {
            if (!prev) setTipDrawer(null);
            return !prev;
          });
        }}
      />

      {collapsed ? null : (
      <div id="waste-section-body" style={{ marginTop: 12 }}>
      {onSectionMarkupChange && tenderMarkup !== undefined ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <SectionMarkupOverride
            label="Waste markup:"
            value={sectionMarkupOverride}
            tenderMarkup={tenderMarkup}
            onSave={onSectionMarkupChange}
            disabled={!canManage}
          />
        </div>
      ) : null}
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Waste rows live on the tender directly (not inside a scope item) so one WBS ref can
        have multiple waste streams with different facilities and rates. Every figure here is
        the server&apos;s. This section is priced as its own cost stream, with its own markup —
        it is not added into the card subtotal above, which carries the scope disciplines.
        <span> · </span>
        <strong style={{ color: "var(--text)" }}>{totalTonnes.toFixed(2)} t</strong> across all
        lines.
      </p>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No waste rows for {discipline} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
              <tr>
                {[
                  "",
                  "WBS",
                  "Description",
                  "Goes to",
                  "Group",
                  "Type",
                  "Facility",
                  "Billed by",
                  "Tonnes",
                  "M³",
                  "Loads",
                  "Duration",
                  "$/unit",
                  "$/Load",
                  "Markup",
                  "Line total",
                  ""
                ].map((h) => (
                  <th
                    key={h}
                    className={h === "Goes to" ? "inc" : undefined}
                    style={{
                      padding: "6px 4px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      whiteSpace: h === "Goes to" ? "nowrap" : undefined,
                      width: h === "Goes to" ? "1%" : undefined
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const facilityOptions = facilitiesForRow(row.wasteGroup, row.wasteType);
                const noFacility =
                  !!row.wasteGroup && !!row.wasteType && facilityOptions.length === 0;
                // PR B4a — billing unit comes from the row's `unit`
                // (set by the aggregator to rate.unit, or by manual
                // edit). Defaults to "t" when blank so legacy rows
                // keep working.
                const billingUnit = row.unit === "m³" ? "m³" : "t";
                const rateLabel = billingUnit === "m³" ? "$/m³" : "$/t";
                const rowTint = noFacility ? "rgba(254, 170, 109, 0.12)" : undefined;
                const isExpanded = !!expanded[row.id];
                const rowVariance = variance[row.id];
                const engineFired = row.transportRateId != null && row.qtyTrucks != null;
                const rowDest: QuoteDestination = row.quoteDestination ?? "PRICE";
                const rowDestClass = DESTINATION_ROW_CLASS[rowDest];
                const rowDestNote = wasteDestNote(rowDest);
                const rowDestRailStyle = wasteDestRowStyle(rowDest);
                // Merge rail style with the existing row tint (no-facility amber).
                // If INTERNAL, it overrides the tint; otherwise both are applied.
                const mergedRowStyle = {
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  background: rowTint,
                  ...rowDestRailStyle
                };
                return (
                <Fragment key={row.id}>
                <tr
                  className={rowDestClass}
                  style={mergedRowStyle}
                >
                  <td style={{ padding: 2, textAlign: "center" }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => void toggleExpand(row.id)}
                      title={isExpanded ? "Hide transport & cost" : "Show transport & cost"}
                      style={{ padding: "0 6px", fontSize: 11 }}
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <select
                      value={row.wbsRef ?? ""}
                      onChange={(e) => void patchRow(row.id, { wbsRef: e.target.value || null })}
                      disabled={!canManage}
                      style={{ fontSize: 12, padding: 2, width: 70 }}
                    >
                      <option value="">—</option>
                      {!wbsRefs.includes(row.wbsRef ?? "") && row.wbsRef ? (
                        <option value={row.wbsRef}>{row.wbsRef}</option>
                      ) : null}
                      {wbsRefs.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* PR B3 — small "auto" badge marks rows created by
                          Sum from above; tells the user this row will be
                          replaced on the next regeneration. */}
                      {row.autoSummed ? (
                        <span
                          title="Auto-summed from items above — regenerated when you press Sum from above"
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            background: "#FEAA6D",
                            color: "#fff",
                            borderRadius: 999,
                            fontWeight: 700,
                            whiteSpace: "nowrap"
                          }}
                        >
                          AUTO
                        </span>
                      ) : null}
                      <input
                        className="s7-input s7-input--sm"
                        defaultValue={row.description}
                        disabled={!canManage}
                        onBlur={(e) =>
                          e.target.value !== row.description &&
                          void patchRow(row.id, { description: e.target.value })
                        }
                        style={{ width: "100%" }}
                      />
                    </div>
                  </td>
                  {/* Goes to — immediately after Description, per the mock-up. */}
                  <td
                    className="inc"
                    style={{ padding: 2, whiteSpace: "nowrap" }}
                    data-testid="waste-dest-cell"
                  >
                    <QuoteDestinationSelect
                      value={rowDest}
                      onChange={(next) => void patchRow(row.id, { quoteDestination: next })}
                    />
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <select
                      className="s7-select s7-input--sm"
                      value={row.wasteGroup ?? ""}
                      disabled={!canManage}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        // Group change clears type + facility so the
                        // cascade stays consistent.
                        void patchRow(row.id, {
                          wasteGroup: next,
                          wasteType: null,
                          wasteFacility: null,
                          ratePerTonne: null,
                          ratePerLoad: null
                        });
                      }}
                      style={{ width: 110, fontSize: 12, padding: 2 }}
                    >
                      <option value="">—</option>
                      {row.wasteGroup && !groups.includes(row.wasteGroup) ? (
                        <option value={row.wasteGroup}>{row.wasteGroup}</option>
                      ) : null}
                      {groups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <select
                      className="s7-select s7-input--sm"
                      value={row.wasteType ?? ""}
                      disabled={!canManage || !row.wasteGroup}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        void patchRow(row.id, {
                          wasteType: next,
                          wasteFacility: null,
                          ratePerTonne: null,
                          ratePerLoad: null
                        });
                      }}
                      style={{ width: 130, fontSize: 12, padding: 2 }}
                    >
                      <option value="">—</option>
                      {row.wasteType && !typesForGroup(row.wasteGroup).includes(row.wasteType) ? (
                        <option value={row.wasteType}>{row.wasteType}</option>
                      ) : null}
                      {typesForGroup(row.wasteGroup).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    {/* PR B4a — facility filter relaxed: (group, type)
                        only. Picking a facility writes the facility's
                        rate.unit forward to row.unit so the line total
                        bills against the right side.
                        OPS-M3 — "Find a tip" button opens the tip finder
                        drawer pre-filled for this row. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <select
                        className="s7-select s7-input--sm"
                        value={row.wasteFacility ?? ""}
                        disabled={!canManage || !row.wasteType || noFacility}
                        onChange={(e) => {
                          const next = e.target.value || null;
                          const rate = rateFor(row.wasteType, next);
                          void patchRow(row.id, {
                            wasteFacility: next,
                            unit: rate?.unit ?? null,
                            ratePerTonne: rate ? Number(rate.tonRate) : null,
                            ratePerLoad: rate ? Number(rate.loadRate) : null
                          });
                        }}
                        style={{ width: 130, fontSize: 12, padding: 2 }}
                        title={
                          noFacility
                            ? "No facility for this group/type"
                            : row.wasteFacility ?? "Pick a facility"
                        }
                      >
                        {noFacility ? (
                          <option value="">— no facility —</option>
                        ) : (
                          <option value="">—</option>
                        )}
                        {row.wasteFacility && !facilityOptions.includes(row.wasteFacility) ? (
                          <option value={row.wasteFacility}>{row.wasteFacility}</option>
                        ) : null}
                        {facilityOptions.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      {canManage ? (
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          title="Find a tip — ranked by cost from the tender site"
                          onClick={() =>
                            setTipDrawer({ rowId: row.id, mode: "find" })
                          }
                          style={{ fontSize: 10, padding: "1px 5px", whiteSpace: "nowrap" }}
                        >
                          Find tip
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2, fontSize: 11, color: "var(--text-muted)" })}>
                    {/* PR B4a — read-only "Billed by" badge mirrors the
                        facility's rate.unit. Empty when no facility set. */}
                    {row.wasteFacility ? (
                      <span
                        title={`Line total bills against ${billingUnit}`}
                        style={{
                          display: "inline-block",
                          padding: "1px 6px",
                          background: "var(--surface-muted, #F6F6F6)",
                          borderRadius: 4,
                          fontFamily: "ui-monospace, monospace"
                        }}
                      >
                        {billingUnit}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.001"
                      defaultValue={row.qty ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.qty))
                          void patchRow(row.id, { qty: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.m3 ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.m3))
                          void patchRow(row.id, { m3: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      defaultValue={row.wasteLoads ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.wasteLoads))
                          void patchRow(row.id, { wasteLoads: n });
                      }}
                      style={{ width: 60, textAlign: "right" }}
                    />
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2, fontSize: 12, color: "var(--text-muted)", textAlign: "right" })}>
                    {/* R3 T-1 - truckDays is now server-derived (engine ceil,
                        or legacy /3 fallback). Show as-is. */}
                    {row.truckDays !== null && row.truckDays !== undefined && row.truckDays !== ""
                      ? Number(row.truckDays).toFixed(1) + " d"
                      : row.wasteLoads !== null && row.wasteLoads !== undefined
                        ? ceilHalf(row.wasteLoads / 3).toFixed(1) + " d"
                        : "—"}
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input
                        className="s7-input s7-input--sm"
                        type="number"
                        step="0.01"
                        defaultValue={row.ratePerTonne ?? ""}
                        disabled={!canManage}
                        title={`Rate per ${billingUnit}`}
                        onBlur={(e) => {
                          const n = e.target.value === "" ? null : Number(e.target.value);
                          if (String(n) !== String(row.ratePerTonne))
                            void patchRow(row.id, { ratePerTonne: n });
                        }}
                        style={{ width: 60, textAlign: "right" }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{rateLabel}</span>
                    </div>
                  </td>
                  <td style={wasteInternalOpacity(rowDest, { padding: 2 })}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.ratePerLoad ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.ratePerLoad))
                          void patchRow(row.id, { ratePerLoad: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  {/* SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — markup column after $/Load. */}
                  <td style={wasteInternalOpacity(rowDest, { padding: 2, whiteSpace: "nowrap" })} data-testid="waste-row-markup">
                    <LineMarkupCell
                      markupOverride={row.markupOverride}
                      effectiveMarkup={row.effectiveMarkup ?? 0}
                      inheritedPhrase="the card's waste markup"
                      onPatch={(patch) => void patchRow(row.id, patch)}
                      disabled={!canManage || rowDest === "INTERNAL"}
                    />
                  </td>
                  <td
                    style={wasteInternalOpacity(rowDest, { padding: 2, fontWeight: 500, textAlign: "right" })}
                    data-testid="waste-row-line-total"
                  >
                    {rowDest === "INTERNAL" ? (
                      <>
                        <span style={{ textDecoration: "line-through", textDecorationThickness: "1.5px" }}>
                          {fmtCurrency(row.lineTotalWithMarkup ?? row.lineTotal)}
                        </span>
                        {rowDestNote ? (
                          <div
                            className="exclnote"
                            style={{
                              fontSize: 10,
                              textTransform: "uppercase",
                              color: "var(--text-muted)",
                              marginTop: 2
                            }}
                          >
                            {rowDestNote}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <strong>{fmtCurrency(row.lineTotalWithMarkup ?? row.lineTotal)}</strong>
                        {row.lineTotalWithMarkup != null && row.lineTotal != null
                          && Math.abs(row.lineTotalWithMarkup - Number(row.lineTotal)) > 0.005 ? (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                            base + {row.effectiveMarkup ?? 0}%
                          </div>
                        ) : null}
                        {rowDestNote ? (
                          <div
                            className="exclnote"
                            style={{
                              fontSize: 10,
                              textTransform: "uppercase",
                              color: rowDest === "PROVISIONAL"
                                ? "var(--status-accent, var(--brand-secondary))"
                                : "var(--brand-primary)",
                              marginTop: 2
                            }}
                          >
                            {rowDestNote}
                          </div>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td style={{ padding: 2 }}>
                    {canManage ? (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => void deleteRow(row.id)}
                        aria-label="Delete waste row"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
                {isExpanded ? (
                <tr style={{ background: "var(--surface-muted, #F6F6F6)" }}>
                  <td colSpan={17} style={{ padding: "10px 12px" }}>

                    {/* ── WASTE_TRAVEL_INDEX_UI_V1 (scopecards-s8h) ──────────────
                        Travel strip: headline + chain + allowance edit + totals.
                        Three states:
                          "route"        -> Geoapify routed line (§1 / §2 / §3)
                          "straight-line" -> fallback, no route (§4 right / §7)
                          infeasible     -> cycle > shift (§4 left)
                        Infeasible is detected from the server: loadsSource =
                        "cycle" AND loadsPerTruckPerDay is null (engine could not
                        fit a whole load into an 8-hour shift).
                        DO NOT compute trips / duration / fuel / price here.
                        Fold server figures only.
                    ──────────────────────────────────────────────────────────── */}

                    {(() => {
                      // ── Infeasible-cycle state (§4 left) ──────────────────────
                      // Server signals: loadsSource = "cycle" and loadsPerTruckPerDay null.
                      const isInfeasible =
                        row.loadsSource === "cycle" &&
                        (row.loadsPerTruckPerDay === null || row.loadsPerTruckPerDay === "");
                      // Cycle minutes for display: 2 x planning + 30 min at tip.
                      // travelPlanningMinutesOneWay is server-supplied; 30 is the
                      // domain constant for tip turnaround (travel-time.ts).
                      const cycleMinutes =
                        row.travelPlanningMinutesOneWay != null
                          ? row.travelPlanningMinutesOneWay * 2 + 30
                          : null;

                      if (isInfeasible && row.travelKm != null) {
                        return (
                          <div
                            style={{
                              marginBottom: 10,
                              padding: "8px 12px",
                              borderLeft: "3px solid var(--status-danger)",
                              background: "var(--surface-subtle)",
                              borderRadius: "0 4px 4px 0",
                              fontSize: 13
                            }}
                            data-testid="waste-row-cycle-line"
                            data-infeasible="true"
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <strong>
                                {cycleMinutes != null ? `Cycle ${cycleMinutes} min` : "Cycle - min"}
                              </strong>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  border: "1px solid var(--status-danger)",
                                  background: "var(--status-danger-bg, #FEF2F2)",
                                  color: "var(--status-danger)"
                                }}
                              >
                                No whole load fits an 8-hour shift
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                              Loads per day cannot be worked out, so trips, duration and
                              price are left blank rather than guessed. The line still
                              saves. Fix it by choosing a closer tip, lowering the
                              allowance, or planning this one by hand.
                            </p>
                          </div>
                        );
                      }

                      // ── Fallback state: straight-line (§4 right / §7) ─────────
                      if (row.travelSource === "straight-line") {
                        const baselineMin = row.travelMinutesOneWay ?? null;
                        const planMin = row.travelPlanningMinutesOneWay ?? baselineMin;
                        return (
                          <div
                            style={{
                              marginBottom: 10,
                              padding: "8px 12px",
                              borderLeft: "3px solid var(--status-accent, var(--brand-secondary))",
                              background: "var(--surface-subtle)",
                              borderRadius: "0 4px 4px 0",
                              fontSize: 13
                            }}
                            data-testid="waste-row-cycle-line"
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <strong>
                                Straight line {row.travelKm != null ? Number(row.travelKm).toFixed(1) : "?"} km
                                {" · "}
                                {baselineMin != null ? baselineMin : "?"} min each way
                              </strong>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  border: "1px solid var(--status-accent, var(--brand-secondary))",
                                  background: "var(--status-warning-bg, #FFF4E5)",
                                  color: "var(--status-accent, var(--brand-secondary))"
                                }}
                              >
                                Estimated, no route
                              </span>
                            </div>
                            {/* Allowance row for fallback: reads 1.00, note explains why */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8, fontSize: 12 }}>
                              <span style={{ color: "var(--text-muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
                                Traffic allowance
                              </span>
                              <span
                                style={{
                                  border: "1px solid var(--border-default)",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  background: "var(--surface-card, #fff)",
                                  fontVariantNumeric: "tabular-nums"
                                }}
                              >
                                {row.travelIndex != null ? Number(row.travelIndex).toFixed(2) : "1.00"}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                No route means no suggested allowance, so it sits at 1.00 until you change it.
                                The badge is not selectable -- straight line is only ever fallen back to.
                                Saving still works.
                              </span>
                            </div>
                            {/* Chain: Baseline -> allowance -> Planning */}
                            {baselineMin != null ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                  alignItems: "center",
                                  marginTop: 8,
                                  fontSize: 12.5,
                                  color: "var(--text-muted)",
                                  fontVariantNumeric: "tabular-nums"
                                }}
                              >
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Baseline</b>
                                  {baselineMin} min
                                </span>
                                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>&times;</span>
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Traffic allowance</b>
                                  {row.travelIndex != null ? Number(row.travelIndex).toFixed(2) : "1.00"}
                                </span>
                                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>=</span>
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Planning</b>
                                  {planMin != null ? planMin : "?"} min each way
                                </span>
                              </div>
                            ) : null}
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {row.travelDetail ?? ""}
                            </div>
                          </div>
                        );
                      }

                      // ── Routed state: Geoapify route (§1 / §2 / §3) ──────────
                      if (row.travelSource === "route" && row.travelKm != null) {
                        const baselineMin = row.travelMinutesOneWay ?? null;
                        const travelIdx = row.travelIndex ?? null;
                        const adjustedMin =
                          baselineMin != null && travelIdx != null
                            ? Math.round(baselineMin * travelIdx)
                            : null;
                        const planMin = row.travelPlanningMinutesOneWay ?? null;
                        const idxSource = row.travelIndexSource ?? null;
                        const isManualIdx = idxSource === "manual";
                        const isNoneIdx = idxSource === "none";

                        return (
                          <div
                            style={{
                              marginBottom: 10,
                              padding: "8px 12px",
                              borderLeft: "3px solid var(--brand-primary)",
                              background: "var(--surface-subtle)",
                              borderRadius: "0 4px 4px 0",
                              fontSize: 13
                            }}
                            data-testid="waste-row-cycle-line"
                          >
                            {/* Headline: km + source chip */}
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <strong>Route {Number(row.travelKm).toFixed(1)} km one way</strong>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  border: "1px solid var(--ok-border, #047857)",
                                  background: "var(--ok-bg, #ECFDF5)",
                                  color: "var(--ok-text, #047857)"
                                }}
                              >
                                Geoapify route
                              </span>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  border: "1px solid var(--border-default)",
                                  background: "var(--surface-card, #fff)",
                                  color: "var(--text-muted)"
                                }}
                              >
                                Truck profile
                              </span>
                            </div>

                            {/* Chain: Baseline x allowance = Adjusted -> average -> Planning */}
                            {baselineMin != null ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                  alignItems: "center",
                                  marginTop: 8,
                                  fontSize: 12.5,
                                  color: "var(--text-muted)",
                                  fontVariantNumeric: "tabular-nums"
                                }}
                              >
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Baseline</b>
                                  {baselineMin} min
                                </span>
                                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>&times;</span>
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Traffic allowance</b>
                                  {travelIdx != null ? Number(travelIdx).toFixed(2) : "—"}
                                </span>
                                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>=</span>
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Adjusted</b>
                                  {adjustedMin != null ? adjustedMin : "?"} min
                                </span>
                                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>&#8594; average &#8594;</span>
                                <span style={{ border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", background: "var(--surface-card, #fff)", color: "var(--text)" }}>
                                  <b style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Planning</b>
                                  {planMin != null ? planMin : "?"} min each way
                                </span>
                              </div>
                            ) : null}

                            {/* Allowance note */}
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
                              Baseline is Geoapify&apos;s free-flow time for this route.
                              The allowance is <strong>modelled</strong> -- their approximated-traffic
                              time divided by their free-flow time -- not measured peak-hour traffic.
                              Planning time is the average of baseline and adjusted, as agreed.
                            </p>
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {/* ── Sizing grid: allowance + derived fields ──────────────── */}
                    {(() => {
                      const hasTravel = row.travelSource === "route" || row.travelSource === "straight-line";
                      const isInfeasible =
                        row.loadsSource === "cycle" &&
                        (row.loadsPerTruckPerDay === null || row.loadsPerTruckPerDay === "");
                      const travelIdx = row.travelIndex ?? null;
                      const idxSource = row.travelIndexSource ?? null;
                      const isManualIdx = idxSource === "manual";
                      const isFallback = row.travelSource === "straight-line";
                      const pickedRate = row.transportRateId
                        ? transportRates.find((p) => p.id === row.transportRateId)
                        : null;
                      const rigHasType = !!pickedRate?.transportType;
                      const hasWasteGroup = !!row.wasteGroup;

                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>

                          {/* Traffic allowance (editable) -- shown when travel snapshot exists */}
                          {hasTravel ? (
                            <div
                              style={{
                                border: "1px solid var(--brand-primary)",
                                boxShadow: "0 0 0 2px var(--brand-primary-light, rgba(0,91,97,0.12))",
                                borderRadius: 8,
                                padding: "8px 10px",
                                background: "var(--surface-card, #fff)",
                                minWidth: 140
                              }}
                            >
                              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                Traffic allowance
                              </div>
                              <div
                                style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginTop: 2 }}
                                data-testid="waste-travel-allowance-value"
                              >
                                {travelIdx != null ? Number(travelIdx).toFixed(2) : (isFallback ? "1.00" : "—")}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                {isManualIdx ? (
                                  <span>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid var(--status-accent, #C77A3A)",
                                        background: "var(--status-warning-bg, #FFF4E5)",
                                        color: "var(--status-accent, #C77A3A)"
                                      }}
                                      data-testid="waste-allowance-manual-chip"
                                    >
                                      Manual
                                    </span>
                                    {" "}
                                    {canManage ? (
                                      <button
                                        type="button"
                                        className="s7-btn s7-btn--ghost s7-btn--sm"
                                        style={{ fontSize: 10.5, padding: "0 4px", color: "var(--brand-primary)", fontWeight: 600 }}
                                        onClick={() => void patchRow(row.id, { travelIndex: null })}
                                        data-testid="waste-allowance-return-auto"
                                      >
                                        Return to automatic
                                      </button>
                                    ) : null}
                                  </span>
                                ) : isFallback ? (
                                  <span style={{ color: "var(--text-muted)" }}>
                                    No route was available to suggest an allowance, so it reads 1.00.
                                  </span>
                                ) : (
                                  <span>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid var(--brand-primary)",
                                        background: "var(--brand-primary-light, rgba(0,91,97,0.10))",
                                        color: "var(--brand-primary)"
                                      }}
                                    >
                                      Suggested
                                    </span>
                                    {" "}editable per line
                                  </span>
                                )}
                              </div>
                              {/* Editable allowance input */}
                              {canManage && !isFallback ? (
                                <div style={{ marginTop: 6 }}>
                                  <input
                                    className="s7-input s7-input--sm"
                                    type="number"
                                    step="0.01"
                                    min="1.00"
                                    defaultValue={travelIdx != null ? Number(travelIdx).toFixed(2) : ""}
                                    placeholder="e.g. 1.20"
                                    onBlur={(e) => {
                                      const raw = e.target.value.trim();
                                      if (raw === "") return;
                                      const n = Number(raw);
                                      if (!Number.isFinite(n) || n < 1) return;
                                      if (n !== travelIdx)
                                        void patchRow(row.id, { travelIndex: n });
                                    }}
                                    style={{ width: 80, textAlign: "right" }}
                                    data-testid="waste-allowance-input"
                                    title="Modelled traffic allowance (>= 1.00). Raises planning time; never raises kilometres."
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Cycle (server-derived, read-only) */}
                          {hasTravel && !isInfeasible ? (
                            <div style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-card, #fff)", minWidth: 120 }}>
                              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Cycle</div>
                              <div style={{ fontSize: 15, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", marginTop: 2 }}>
                                {(() => {
                                  const p = row.travelPlanningMinutesOneWay;
                                  if (p == null) return "—";
                                  const cycMin = p * 2 + 30;
                                  return `${cycMin} min`;
                                })()}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                {row.travelPlanningMinutesOneWay != null
                                  ? `${row.travelPlanningMinutesOneWay} out \xB7 ${row.travelPlanningMinutesOneWay} back \xB7 30 at the tip`
                                  : ""}
                              </div>
                            </div>
                          ) : null}

                          {/* Loads / truck / day -- with provenance chip */}
                          <div style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-card, #fff)", minWidth: 140 }}>
                            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Loads per truck per day</div>
                            <div
                              style={{ fontSize: 15, fontWeight: isInfeasible ? 400 : 600, fontVariantNumeric: "tabular-nums", color: isInfeasible ? "var(--text-muted)" : "var(--text)", marginTop: 2 }}
                              data-testid="waste-loads-per-day-value"
                            >
                              {isInfeasible ? "—" : (row.loadsPerTruckPerDay != null ? Number(row.loadsPerTruckPerDay) : "—")}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {row.loadsSource === "manual" && !isInfeasible ? (
                                <span>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      border: "1px solid var(--status-accent, #C77A3A)",
                                      background: "var(--status-warning-bg, #FFF4E5)",
                                      color: "var(--status-accent, #C77A3A)"
                                    }}
                                    data-testid="waste-loads-manual-chip"
                                  >
                                    Manual
                                  </span>
                                  {" "}
                                  {canManage ? (
                                    <button
                                      type="button"
                                      className="s7-btn s7-btn--ghost s7-btn--sm"
                                      style={{ fontSize: 10.5, padding: "0 4px", color: "var(--brand-primary)", fontWeight: 600 }}
                                      onClick={() => void patchRow(row.id, { loadsPerTruckPerDay: null })}
                                      data-testid="waste-loads-return-auto"
                                    >
                                      Return to automatic
                                    </button>
                                  ) : null}
                                </span>
                              ) : row.loadsSource === "cycle" && !isInfeasible ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid var(--brand-primary)",
                                    background: "var(--brand-primary-light, rgba(0,91,97,0.10))",
                                    color: "var(--brand-primary)"
                                  }}
                                >
                                  From cycle
                                </span>
                              ) : null}
                            </div>
                            {/* Loads/day input for manual override (or when cycle unavailable) */}
                            {canManage && !isInfeasible ? (
                              <div style={{ marginTop: 4 }}>
                                <input
                                  className="s7-input s7-input--sm"
                                  type="number"
                                  step="0.1"
                                  defaultValue={row.loadsPerTruckPerDay ?? ""}
                                  onBlur={(e) => {
                                    const n = e.target.value === "" ? null : Number(e.target.value);
                                    if (String(n) !== String(row.loadsPerTruckPerDay))
                                      void patchRow(row.id, { loadsPerTruckPerDay: n });
                                  }}
                                  style={{ width: 70, textAlign: "right" }}
                                />
                              </div>
                            ) : null}
                          </div>

                          {/* Capacity / load -- with provenance chip */}
                          <div style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-card, #fff)", minWidth: 140 }}>
                            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Capacity per load</div>
                            <div style={{ fontSize: 15, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", marginTop: 2 }}>
                              {row.capacityPerLoad != null
                                ? `${Number(row.capacityPerLoad)} ${row.capacityUnit ?? "t"}`
                                : "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {(() => {
                                if (row.capacitySource === "matrix" && row.capacityPerLoad) {
                                  const matClass = row.wasteGroup ?? "?";
                                  const matType = pickedRate?.transportType ?? "?";
                                  return (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid var(--brand-primary)",
                                        background: "var(--brand-primary-light, rgba(0,91,97,0.10))",
                                        color: "var(--brand-primary)"
                                      }}
                                    >
                                      Matrix
                                    </span>
                                  );
                                }
                                if (row.capacitySource === "manual") {
                                  return (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        border: "1px solid var(--status-accent, #C77A3A)",
                                        background: "var(--status-warning-bg, #FFF4E5)",
                                        color: "var(--status-accent, #C77A3A)"
                                      }}
                                    >
                                      Manual
                                    </span>
                                  );
                                }
                                if (pickedRate && (!rigHasType || !hasWasteGroup)) {
                                  return <span style={{ color: "var(--text-muted)" }}>No matrix row -- enter a capacity</span>;
                                }
                                return null;
                              })()}
                            </div>
                            {canManage ? (
                              <div style={{ marginTop: 4, display: "flex", gap: 4, alignItems: "center" }}>
                                <input
                                  className="s7-input s7-input--sm"
                                  type="number"
                                  step="0.01"
                                  defaultValue={row.capacityPerLoad ?? ""}
                                  onBlur={(e) => {
                                    const n = e.target.value === "" ? null : Number(e.target.value);
                                    if (String(n) !== String(row.capacityPerLoad))
                                      void patchRow(row.id, { capacityPerLoad: n });
                                  }}
                                  style={{ width: 70, textAlign: "right" }}
                                  title="Default from the Transport Capacity table; clear to re-resolve from the matrix."
                                />
                                <select
                                  className="s7-select s7-input--sm"
                                  value={row.capacityUnit ?? ""}
                                  onChange={(e) => {
                                    const next = e.target.value || null;
                                    void patchRow(row.id, { capacityUnit: next });
                                  }}
                                  style={{ width: 60 }}
                                >
                                  <option value="">—</option>
                                  <option value="t">t</option>
                                  <option value="m3">m3</option>
                                </select>
                              </div>
                            ) : null}
                          </div>

                          {/* Daily km -- with provenance chip */}
                          <div style={{ border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-card, #fff)", minWidth: 120 }}>
                            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Daily km</div>
                            <div style={{ fontSize: 15, fontWeight: 400, fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", marginTop: 2 }}>
                              {row.dailyKm != null ? Number(row.dailyKm) : "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                              {row.dailyKmSource === "manual" ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid var(--status-accent, #C77A3A)",
                                    background: "var(--status-warning-bg, #FFF4E5)",
                                    color: "var(--status-accent, #C77A3A)"
                                  }}
                                >
                                  Manual
                                </span>
                              ) : row.dailyKmSource === "derived" ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid var(--brand-primary)",
                                    background: "var(--brand-primary-light, rgba(0,91,97,0.10))",
                                    color: "var(--brand-primary)"
                                  }}
                                >
                                  From cycle
                                </span>
                              ) : null}
                            </div>
                            {/* OPS-M3 -- suggest affordance when tip finder computed a different distance */}
                            {kmSuggest[row.id] !== undefined ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                <span style={{ color: "#0369a1", fontSize: 10 }}>
                                  Map: {kmSuggest[row.id]} km
                                </span>
                                {canManage ? (
                                  <button
                                    type="button"
                                    className="s7-btn s7-btn--ghost s7-btn--sm"
                                    style={{ fontSize: 10, padding: "0 4px" }}
                                    onClick={() => {
                                      const val = kmSuggest[row.id];
                                      void patchRow(row.id, { dailyKm: val });
                                      const inputEl = dailyKmRefs.current[row.id];
                                      if (inputEl) inputEl.value = String(val);
                                      setKmSuggest((prev) => {
                                        const next = { ...prev };
                                        delete next[row.id];
                                        return next;
                                      });
                                    }}
                                    title="Apply the map-derived distance"
                                  >
                                    Apply
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="s7-btn s7-btn--ghost s7-btn--sm"
                                  style={{ fontSize: 10, padding: "0 4px" }}
                                  onClick={() =>
                                    setKmSuggest((prev) => {
                                      const next = { ...prev };
                                      delete next[row.id];
                                      return next;
                                    })
                                  }
                                  title="Dismiss suggestion"
                                >
                                  &times;
                                </button>
                              </div>
                            ) : null}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <input
                                ref={(el) => { dailyKmRefs.current[row.id] = el; }}
                                className="s7-input s7-input--sm"
                                type="number"
                                step="0.1"
                                defaultValue={row.dailyKm ?? ""}
                                disabled={!canManage}
                                onBlur={(e) => {
                                  const n = e.target.value === "" ? null : Number(e.target.value);
                                  if (String(n) !== String(row.dailyKm))
                                    void patchRow(row.id, { dailyKm: n });
                                }}
                                style={{ width: 70, textAlign: "right" }}
                                title="Round-trip km to the tip (auto-filled from tip finder)."
                              />
                              {canManage ? (
                                <button
                                  type="button"
                                  className="s7-btn s7-btn--ghost s7-btn--sm"
                                  title={
                                    row.wasteFacility
                                      ? "Open tip map -- find the current facility and update km"
                                      : "Set a facility first to use the map"
                                  }
                                  disabled={!row.wasteFacility}
                                  onClick={() =>
                                    setTipDrawer({ rowId: row.id, mode: "map" })
                                  }
                                  style={{ fontSize: 10, padding: "1px 5px" }}
                                >
                                  Map
                                </button>
                              ) : null}
                            </div>
                          </div>

                        </div>
                      );
                    })()}

                    {/* ── Transport pickers ────────────────────────────────────── */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 8 }}>
                      {/* WASTE_TRAVEL_INDEX_UI_V1 -- tip picker. */}
                      <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--text-muted)" }}>
                        Tip (map location)
                        <select
                          className="s7-select s7-input--sm"
                          value={row.mapLocationId ?? ""}
                          disabled={!canManage}
                          onChange={(e) => {
                            const next = e.target.value || null;
                            void patchRow(row.id, { mapLocationId: next });
                          }}
                          style={{ minWidth: 200 }}
                          title="Pick a tip from Map Locations to enable travel-time estimation"
                        >
                          <option value="">-- no tip linked --</option>
                          {/* Keep the existing selection even if it is not in the active list */}
                          {row.mapLocationId &&
                          !tipLocations.some((t) => t.id === row.mapLocationId) ? (
                            <option value={row.mapLocationId}>{row.mapLocationId}</option>
                          ) : null}
                          {tipLocations.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}{t.suburb ? ` -- ${t.suburb}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--text-muted)" }}>
                        Transport item
                        <select
                          className="s7-select s7-input--sm"
                          value={row.transportRateId ?? ""}
                          disabled={!canManage}
                          onChange={(e) => {
                            const next = e.target.value || null;
                            void patchRow(row.id, { transportRateId: next });
                          }}
                          style={{ minWidth: 200 }}
                        >
                          <option value="">-- pick a truck / transport --</option>
                          {transportRates.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.item} (${Number(p.rate).toFixed(0)}/{p.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--text-muted)" }}>
                        Trucks
                        <input
                          className="s7-input s7-input--sm"
                          type="number"
                          min={0}
                          defaultValue={row.qtyTrucks ?? ""}
                          disabled={!canManage}
                          onBlur={(e) => {
                            const n = e.target.value === "" ? null : Math.trunc(Number(e.target.value));
                            if (n !== row.qtyTrucks) void patchRow(row.id, { qtyTrucks: n });
                          }}
                          style={{ width: 60, textAlign: "right" }}
                        />
                      </label>
                    </div>

                    {/* ── Totals strip (§1) ────────────────────────────────────── */}
                    {(() => {
                      const isInfeasible =
                        row.loadsSource === "cycle" &&
                        (row.loadsPerTruckPerDay === null || row.loadsPerTruckPerDay === "");
                      const qty = row.qty != null ? Number(row.qty) : null;
                      const cap = row.capacityPerLoad != null ? Number(row.capacityPerLoad) : null;
                      const trucks = row.qtyTrucks ?? null;

                      return (
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            flexWrap: "wrap",
                            padding: "10px 12px",
                            border: "1px solid var(--border-default)",
                            borderRadius: 8,
                            background: "var(--surface-subtle, #F3F4F6)",
                            fontSize: 12.5,
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 8
                          }}
                          data-testid="waste-totals-strip"
                        >
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Quantity</b>
                            {qty != null ? `${qty.toFixed(3)} ${row.unit ?? "t"}` : "—"}
                          </div>
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Required trips</b>
                            {isInfeasible ? "—" : (row.wasteLoads != null
                              ? <span>{row.wasteLoads}{qty != null && cap != null
                                  ? <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>ceil({qty.toFixed(0)} / {cap})</span>
                                  : null}</span>
                              : "—")}
                          </div>
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Trucks</b>
                            {trucks ?? "—"}
                          </div>
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Duration</b>
                            {isInfeasible ? "—" : (row.truckDays != null
                              ? <span>
                                  {Number(row.truckDays).toFixed(1)} days
                                  {row.wasteLoads != null && row.loadsPerTruckPerDay != null && trucks != null
                                    ? <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                                        ceil({row.wasteLoads} / {Math.round(Number(row.loadsPerTruckPerDay) * trucks)})
                                      </span>
                                    : null}
                                </span>
                              : "—")}
                          </div>
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Total route km</b>
                            {row.totalTripKm != null
                              ? <span>
                                  {Number(row.totalTripKm).toFixed(1)}
                                  {row.wasteLoads != null && row.travelKm != null
                                    ? <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                                        {row.wasteLoads} &times; 2 &times; {Number(row.travelKm).toFixed(1)}
                                      </span>
                                    : null}
                                </span>
                              : "—"}
                          </div>
                          <div>
                            <b style={{ display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>Fuel charged on</b>
                            <span data-testid="waste-fuel-charged-km">
                              {row.totalTripKm != null
                                ? `${Number(row.totalTripKm).toFixed(1)} km`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
                      Fuel follows the trips that actually happen, including the last part-used day.
                      It is not a full day&apos;s kilometres multiplied by rounded days.
                    </p>

                    {/* ── Cost summary ─────────────────────────────────────────── */}
                    <div style={{ display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                      <span>Transport cost: <strong>{fmtCurrency(row.transportCost)}</strong></span>
                      <span>Fuel cost (of that): <strong>{fmtCurrency(row.fuelCost)}</strong></span>
                      <span>Disposal cost: <strong>{fmtCurrency(row.disposalCost)}</strong></span>
                      <span>Line total: <strong>{fmtCurrency(row.lineTotal)}</strong></span>
                      {!engineFired ? (
                        <span style={{ color: "var(--text-muted)" }}>
                          Engine idle -- pick a transport item + trucks + loads/day + capacity/load.
                        </span>
                      ) : null}
                    </div>

                    {rowVariance && rowVariance.hasVariance ? (
                      <div style={{ marginTop: 10, padding: 8, background: "rgba(254, 170, 109, 0.16)", borderRadius: 4, fontSize: 12 }}>
                        <strong style={{ color: "#B45309" }}>Rate variance since quoted:</strong>{" "}
                        {rowVariance.disposalDelta != null ? (
                          <span>
                            disposal ${rowVariance.quotedDisposalRate ?? "?"} -&gt; ${rowVariance.currentDisposalRate ?? "?"}
                            {" "}
                          </span>
                        ) : null}
                        {rowVariance.fuelDelta != null ? (
                          <span>
                            &middot; fuel ${rowVariance.quotedFuelPricePerLitre ?? "?"}/L -&gt; ${rowVariance.currentFuelPricePerLitre ?? "?"}/L
                          </span>
                        ) : null}
                        {rowVariance.transportDelta != null ? (
                          <span>
                            &middot; transport ${rowVariance.quotedTransportRatePerDay ?? "?"}/day -&gt; ${rowVariance.currentTransportRatePerDay ?? "?"}/day
                          </span>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            className="s7-btn s7-btn--ghost s7-btn--sm"
                            style={{ marginLeft: 12 }}
                            onClick={() => void escalateVariance(row.id)}
                          >
                            Escalate for confirmation
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
                ) : null}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void addRow()}
            data-testid="waste-add-line"
          >
            + add a waste line
          </button>
          {cardId ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void sumFromAbove()}
              data-testid="waste-sum-from-above"
              title="Pull every measurement ticked Waste? on this card into auto-summed lines. Hand-typed lines are never touched, and pressing it again replaces the auto-summed lines rather than adding to them."
            >
              ⇩ Sum from items above
            </button>
          ) : null}
        </div>
      ) : null}

      {onWasteNotesChange ? (
        <div style={{ marginTop: 16 }}>
          <NotesField
            label="Waste notes"
            value={wasteNotes ?? null}
            onSave={(v) => onWasteNotesChange(v)}
            disabled={!canManage}
            placeholder="Shared notes for this card's waste subtable…"
          />
        </div>
      ) : null}
      </div>
      )}

      {/* OPS-M3 — Tip Finder drawer: opens from "Find tip" (beside FACILITY)
          or "Map" (beside dailyKm). Pre-fills from the active row.
          If wasteType or tonnes are blank, the panel opens with those empty
          and the user can fill them — never blocks opening. */}
      {(() => {
        if (!tipDrawer) return null;
        const activeRow = rows.find((r) => r.id === tipDrawer.rowId);
        if (!activeRow) return null;

        // For "map" mode, seed the current facility as the initial waste type
        // context so the finder pre-filters — but wasteType drives ranking, not
        // facility. We seed wasteType from the row regardless of mode.
        const initWasteType = activeRow.wasteType ?? undefined;
        // Prefer qty (tonnes) as the load size; ignore m3 here (m2 API is
        // tonne-based for the log). Leave empty if qty is blank.
        const initLoadTonnes =
          activeRow.qty && Number(activeRow.qty) > 0
            ? Number(activeRow.qty)
            : undefined;

        const rowLabel = [
          activeRow.description,
          activeRow.wasteType ? `(${activeRow.wasteType})` : null
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <TipFinderDrawer
            open
            onClose={() => setTipDrawer(null)}
            initialWasteType={initWasteType}
            initialLoadTonnes={initLoadTonnes}
            tenderId={tenderId}
            onFacilityChosen={handleTipChosen}
            rowLabel={rowLabel || undefined}
          />
        );
      })()}
    </section>
  );
}
