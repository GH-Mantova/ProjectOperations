/**
 * travel-time.ts -- TRAVEL_TIME_PORT_V1 (scopecards-s8a)
 *
 * The one place travel time is resolved and recorded for a waste line.
 * S8a ships only the straight-line fallback (StraightLineTravelProvider).
 * S8b wires a real routing provider behind the same TravelTimeProvider
 * interface -- that slice is held until Marco provisions the Azure Maps key.
 *
 * Marco's rules (carried verbatim):
 *   - Haulage is priced on actual truck travel time, averaged between normal
 *     and peak hours (the averaging arrives with the provider, in S8b).
 *   - Straight-line distance is only ever an automatic fallback, badged.
 *     It is never an option the estimator selects.
 *   - A tip about 45 minutes away is roughly a 2-hour round trip, so an
 *     8-hour day shift is up to 4 loads. That 8-hour shift belongs to
 *     this field only and is NOT a general working-day constant.
 *   - Snapshot the resolved figure onto the line; fallback badged.
 */

import { haversineKm } from "../scheduler/suggestion.service";

/** Version marker required by the done_when gate. */
export const TRAVEL_TIME_PORT_V1 = "scopecards-s8a";

// ---- Shared lat/lng type ---------------------------------------------------

export type LatLng = { lat: number; lng: number };

// ---- Travel estimate -------------------------------------------------------

export type TravelEstimate = {
  /** Road-factored distance in km. */
  km: number;
  /** One-way travel time in minutes. */
  minutesOneWay: number;
  /** "straight-line" until S8b; "route" arrives with the routing provider. */
  source: "straight-line" | "route";
  /** Human-readable method note, e.g. "straight line x 1.3 road factor at 45 km/h" */
  detail: string;
  /** When this estimate was resolved. */
  resolvedAt: Date;
};

// ---- Provider interface ----------------------------------------------------

export interface TravelTimeProvider {
  resolve(from: LatLng, to: LatLng): Promise<TravelEstimate | null>;
}

// ---- StraightLineTravelProvider -------------------------------------------
//
// Haversine is imported from scheduler/suggestion.service.ts, the one place
// that already exports it with a {lat,lng} signature. Do not re-implement.

/**
 * Resolves a straight-line travel estimate.
 *
 * Uses:
 *   road_distance_factor  from OperationsSettings -- scales haversine km to
 *                         approximate road distance (e.g. 1.3).
 *   avg_truck_speed_kmh   from OperationsSettings -- converts km to minutes.
 *
 * Returns null when either setting is unset -- never invents a number.
 * Badge text is always "estimated, no route" (set in detail).
 */
export class StraightLineTravelProvider implements TravelTimeProvider {
  constructor(
    private readonly roadDistanceFactor: number | null,
    private readonly avgTruckSpeedKmh: number | null
  ) {}

  async resolve(from: LatLng, to: LatLng): Promise<TravelEstimate | null> {
    // Both settings must be present. If either is unset the feature is quiet.
    if (this.roadDistanceFactor == null || this.avgTruckSpeedKmh == null) {
      return null;
    }
    if (this.avgTruckSpeedKmh <= 0) {
      // Guard against zero-division; treat as unset.
      return null;
    }

    const straightLineKm = haversineKm(from, to);
    const roadKm = Math.round(straightLineKm * this.roadDistanceFactor * 100) / 100;
    const minutesOneWay = Math.round((roadKm / this.avgTruckSpeedKmh) * 60);
    const detail = `straight line x ${this.roadDistanceFactor} road factor at ${this.avgTruckSpeedKmh} km/h`;

    return {
      km: roadKm,
      minutesOneWay,
      source: "straight-line",
      detail,
      resolvedAt: new Date()
    };
  }
}

// ---- Cycle derivation -------------------------------------------------------

/**
 * Derives loads per day from a one-way travel time.
 *
 * Formula: floor(shiftMinutes / (2 * minutesOneWay + tipTurnaroundMinutes))
 * Minimum 0 (a cycle that exceeds the shift returns 0).
 *
 * Marco's worked example:
 *   45 min each way, 30 min at the tip, 8-hour (480 min) shift = 4 loads.
 *   verify: floor(480 / (2*45 + 30)) = floor(480 / 120) = 4. Correct.
 *
 * IMPORTANT: shiftMinutes = 480 (8-hour day shift) belongs to this
 * calculation only and MUST NOT be reused as a general working-day constant.
 * The 8-hour shift is site-to-tip only.
 */
export function deriveCycle({
  minutesOneWay,
  shiftMinutes = 480,
  tipTurnaroundMinutes
}: {
  minutesOneWay: number;
  /** 8-hour shift in minutes -- site-to-tip only, must not be reused elsewhere. */
  shiftMinutes?: number;
  tipTurnaroundMinutes: number;
}): { loadsPerDay: number } {
  const cycleMinutes = 2 * minutesOneWay + tipTurnaroundMinutes;
  if (cycleMinutes <= 0) {
    return { loadsPerDay: 0 };
  }
  const loadsPerDay = Math.max(0, Math.floor(shiftMinutes / cycleMinutes));
  return { loadsPerDay };
}
