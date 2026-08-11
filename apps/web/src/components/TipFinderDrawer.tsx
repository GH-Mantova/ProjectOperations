/**
 * TipFinderDrawer — slide-over / modal that wraps TipFinderPanel for use
 * from a waste row in the tendering scope tab (OPS-M3).
 *
 * Rendered as a right-side overlay (fixed position, no Drawer primitive in
 * this codebase yet). Pressing Esc or the × button closes it.
 *
 * Pre-fills:
 *  - wasteType  from the row's TYPE
 *  - loadTonnes from the row's TONNES (qty) or empty if blank
 *  - origin     as "tender" with the tenderId so the API uses the tender
 *               site's lat/lng. Falls back to "office" if no tenderId.
 *
 * Callbacks:
 *  - onFacilityChosen(facilityName, mapLocationId, distanceKm) — called when
 *    the user presses "Use this facility". distanceKm is the one-way haversine
 *    from m2's response. The caller converts to dailyKm via round(km × 2, 1).
 *  - onClose — called when the drawer should close.
 */

import { useEffect } from "react";
import { TipFinderPanel } from "../pages/admin/TipFinderPanel";

export type TipFinderDrawerProps = {
  /** Controls visibility. */
  open: boolean;
  onClose: () => void;
  /** Pre-fill: waste type code from the row's TYPE. May be empty. */
  initialWasteType?: string;
  /** Pre-fill: load size in tonnes from the row's qty. May be undefined. */
  initialLoadTonnes?: number;
  /**
   * If supplied, origin = "tender" and the API looks up the tender's site
   * coords. If omitted or empty, falls back to "office".
   */
  tenderId?: string;
  /**
   * Called after the accept POST succeeds. Receives:
   *  - facilityName: string written to the row's FACILITY field
   *  - mapLocationId: the MapLocation.id of the accepted tip
   *  - distanceKm: one-way haversine from m2 (round trip = round(km × 2, 1))
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

        {/* Body — TipFinderPanel with pre-fill */}
        <div style={{ padding: "0 20px 24px", flex: 1 }}>
          <TipFinderPanel
            initialWasteType={initialWasteType}
            initialLoadTonnes={initialLoadTonnes}
            initialOriginType={originType}
            initialTenderId={tenderId}
            onFacilityChosen={onFacilityChosen}
          />
        </div>
      </div>
    </>
  );
}
