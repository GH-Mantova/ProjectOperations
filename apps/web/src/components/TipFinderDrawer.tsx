/**
 * TipFinderDrawer -- slide-over / modal that wraps TipFinderPanel for use
 * from a waste row in the tendering scope tab (OPS-M3).
 *
 * Rendered as a right-side overlay (fixed position, no Drawer primitive in
 * this codebase yet). Pressing Esc or the x button closes it.
 *
 * WASTE_PANEL_LAYOUT_V1 (scopecards-s8j): two modes.
 *
 * fromWasteRow = false (default, admin page):
 *   - All three fields: waste type, load size, coming from.
 *   - Pre-fills loadTonnes from initialLoadTonnes.
 *
 * fromWasteRow = true (waste tab):
 *   - "Coming from" is not a field. The tender address shows as text.
 *   - loadTonnes is the per-trip tonnes, derived from the row context:
 *       requiredTrips = wasteLoads when set (override respected, never re-derived)
 *                       else ceil(qty / capacityPerLoad) ONLY when capacityUnit is tonnes
 *       perTripTonnes = qty / requiredTrips  (NOT capacityPerLoad)
 *       loadTonnes    = perTripTonnes
 *   - Branches:
 *       Tonnes and trips both resolvable: rank on perTripTonnes.
 *       Trips unresolvable (no override and no tonne capacity): ask for capacity per load.
 *       Tonnes absent: ask for tonnage.
 *       Capacity in m3 with no override: ask, never divide.
 *       Never fall back to the whole quantity.
 *   - The request still sends originType: "tender" and tenderId.
 *
 * Callbacks:
 *  - onFacilityChosen(facilityName, mapLocationId, distanceKm) -- called when
 *    the user presses "Use this facility". distanceKm is the one-way haversine
 *    from m2's response. The caller converts to dailyKm via round(km x 2, 1).
 *  - onClose -- called when the drawer should close.
 */

import { useEffect } from "react";
import { TipFinderPanel } from "../pages/admin/TipFinderPanel";

/** Row context passed in when opened from a waste row. */
export type WasteRowContext = {
  /** Row's total quantity (tonnes or m3). */
  qty: string | null;
  /** Number of loads (trips override -- respected without re-derivation). */
  wasteLoads: number | null;
  /** Capacity per load. */
  capacityPerLoad: string | null;
  /** "t" | "m3" | null */
  capacityUnit: string | null;
};

/** Result of the per-trip logic. */
type PerTripResult =
  | { ok: true; perTripTonnes: number; requiredTrips: number; totalTonnes: number }
  | { ok: false; reason: "no-tonnes" | "no-capacity" | "m3-capacity" };

/**
 * WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Compute per-trip tonnes from
 * row context. Returns ok: false with a reason when a blocking case is hit.
 * Never falls back to the whole quantity -- that is the defect this removes.
 */
export function computePerTripTonnes(ctx: WasteRowContext): PerTripResult {
  const qty = ctx.qty != null && ctx.qty !== "" ? Number(ctx.qty) : null;
  const wasteLoads = ctx.wasteLoads;
  const cap = ctx.capacityPerLoad != null && ctx.capacityPerLoad !== "" ? Number(ctx.capacityPerLoad) : null;
  const unit = ctx.capacityUnit;

  // Tonnes must be present -- the rate library prices per tonne.
  if (qty === null || !Number.isFinite(qty) || qty <= 0) {
    return { ok: false, reason: "no-tonnes" };
  }

  // Determine required trips.
  let requiredTrips: number;
  if (wasteLoads != null && wasteLoads > 0) {
    // Override is present -- respect it, never re-derive.
    requiredTrips = wasteLoads;
  } else {
    // No override -- need capacity in tonnes to derive.
    if (unit === "m3") {
      // m3 capacity: never divide tonnes by m3.
      return { ok: false, reason: "m3-capacity" };
    }
    if (cap === null || !Number.isFinite(cap) || cap <= 0) {
      // No tonne capacity and no override.
      return { ok: false, reason: "no-capacity" };
    }
    requiredTrips = Math.ceil(qty / cap);
  }

  // Per-trip tonnes = total / trips (NOT capacityPerLoad).
  // 100 t at 26 t cap = 4 trips of 25 t (not 26).
  const perTripTonnes = qty / requiredTrips;

  return { ok: true, perTripTonnes, requiredTrips, totalTonnes: qty };
}

export type TipFinderDrawerProps = {
  /** Controls visibility. */
  open: boolean;
  onClose: () => void;
  /** Pre-fill: waste type code from the row's TYPE. May be empty. */
  initialWasteType?: string;
  /**
   * Pre-fill: load size in tonnes. Used when fromWasteRow is false (admin page).
   * When fromWasteRow is true, per-trip computation overrides this.
   */
  initialLoadTonnes?: number;
  /**
   * If supplied, origin = "tender" and the API looks up the tender's site
   * coords. If omitted or empty, falls back to "office".
   */
  tenderId?: string;
  /**
   * WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- When true, the drawer is in
   * waste-row mode: no "Coming from" field, tender address as text, per-trip
   * logic applies.
   */
  fromWasteRow?: boolean;
  /**
   * WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Tender site address shown as
   * text when fromWasteRow is true.
   */
  tenderAddress?: string;
  /**
   * WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Row context for per-trip
   * computation when fromWasteRow is true.
   */
  wasteRowContext?: WasteRowContext;
  /**
   * Called after the accept POST succeeds. Receives:
   *  - facilityName: string written to the row's FACILITY field
   *  - mapLocationId: the MapLocation.id of the accepted tip
   *  - distanceKm: one-way haversine from m2 (round trip = round(km x 2, 1))
   */
  onFacilityChosen: (
    facilityName: string,
    mapLocationId: string,
    distanceKm: number
  ) => void;
  /** Optional heading suffix to contextualise the panel. */
  rowLabel?: string;
};

export function TipFinderDrawer({
  open,
  onClose,
  initialWasteType,
  initialLoadTonnes,
  tenderId,
  fromWasteRow = false,
  tenderAddress,
  wasteRowContext,
  onFacilityChosen,
  rowLabel
}: TipFinderDrawerProps) {
  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const originType = tenderId ? "tender" : "office";

  // WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Per-trip logic for waste row.
  let panelLoadTonnes: number | undefined = initialLoadTonnes;
  let perTripNote: string | undefined;
  let blockingMsg: string | undefined;

  if (fromWasteRow && wasteRowContext) {
    const result = computePerTripTonnes(wasteRowContext);
    if (result.ok) {
      panelLoadTonnes = result.perTripTonnes;
      perTripNote = `Compared on one trip of ${result.perTripTonnes.toFixed(1)} t ` +
        `(this line: ${result.totalTonnes.toFixed(0)} t in ${result.requiredTrips} trips)`;
    } else if (result.reason === "no-tonnes") {
      blockingMsg = "Enter the quantity in tonnes first. The rate library prices per tonne and" +
        " the finder cannot compare without it.";
      panelLoadTonnes = undefined;
    } else if (result.reason === "m3-capacity") {
      blockingMsg = "Capacity per load is in m³. Enter the number of trips (Loads field)" +
        " or set a tonne capacity so the finder can work out the per-trip size.";
      panelLoadTonnes = undefined;
    } else {
      // no-capacity
      blockingMsg = "Enter a capacity per load (in tonnes) or override the number of trips" +
        " in the Loads field. The finder needs a per-trip size to compare fairly.";
      panelLoadTonnes = undefined;
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 900
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a tip"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(680px, 92vw)",
          background: "var(--surface-card, #fff)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          zIndex: 901,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto"
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, #e5e5e5)",
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Find a tip</div>
            {rowLabel ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {rowLabel}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={onClose}
            aria-label="Close tip finder"
            style={{ fontSize: 18, lineHeight: 1, padding: "4px 10px" }}
          >
            &times;
          </button>
        </div>

        {/* Body -- TipFinderPanel with pre-fill */}
        <div style={{ padding: "0 20px 24px", flex: 1 }}>

          {/* Blocking message when per-trip context cannot be resolved */}
          {blockingMsg ? (
            <div
              style={{
                marginTop: 16,
                border: "1px solid var(--status-accent, var(--brand-secondary))",
                background: "color-mix(in srgb, var(--status-warning) 12%, transparent)",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 12.5
              }}
              data-testid="tip-finder-blocking-msg"
            >
              {blockingMsg}
            </div>
          ) : (
            <TipFinderPanel
              initialWasteType={initialWasteType}
              initialLoadTonnes={panelLoadTonnes}
              initialOriginType={originType}
              initialTenderId={tenderId}
              onFacilityChosen={onFacilityChosen}
              hideComingFrom={fromWasteRow}
              tenderAddress={tenderAddress}
              perTripNote={perTripNote}
            />
          )}

          {/* WASTE_TRAVEL_INDEX_UI_V1 (scopecards-s8h) -- explain the distance
              discrepancy between the finder list and the line price. The finder
              ranks on straight-line (fast and free); once you select a tip the
              line prices on the real route. Both figures are correct for their
              purpose -- the screen says so here so nobody reads it as a bug. */}
          <p
            style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}
            data-testid="tip-finder-rank-note"
          >
            The finder ranks on straight-line distance, which is fast and free.
            Once you select a tip, the line saves that facility and prices it on
            the <strong>real route</strong> -- so the distance on the line may
            differ from the distance shown here. That is expected.
          </p>
        </div>
      </div>
    </>
  );
}
