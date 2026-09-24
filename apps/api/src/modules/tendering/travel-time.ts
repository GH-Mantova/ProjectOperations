/**
 * travel-time.ts -- TRAVEL_TIME_PORT_V1 (scopecards-s8a) extended by S8g
 *
 * The one place travel time is resolved and recorded for a waste line.
 * S8a ships only the straight-line fallback (StraightLineTravelProvider).
 * S8g wires the Geoapify routing provider and adds honest trip arithmetic:
 *   - Road km from Geoapify free_flow distance (never multiplied by index).
 *   - Traffic index = approximated / free_flow (modelled allowance, not
 *     measured peak-hour traffic). Estimator may edit.
 *   - planning = average(baseline, baseline x index).
 *   - Total trip km = trips x 2 x one-way km.
 *   - Required trips = ceil(quantity / capacity per load).
 *   - Duration days = ceil(trips / (trucks x loads per day)).
 *
 * Marco's rules (carried verbatim):
 *   - Haulage is priced on actual truck travel time, averaged between normal
 *     and peak hours.
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

// ---- S8g: Planning minutes (index-adjusted average) -----------------------

/**
 * Derives the planning minutes from the baseline and the traffic index.
 *
 * Formula: average(baseline, baseline x index)
 *   = baseline x (1 + index) / 2
 *
 * The index is a MODELLED TRAFFIC ALLOWANCE, not measured peak-hour traffic.
 * Index NEVER multiplies kilometres -- it moves cycle time only.
 *
 * @param baseline - free-flow one-way minutes
 * @param index    - traffic index (>= 1.00)
 * @returns planning minutes (rounded to nearest integer)
 */
export function planningMinutes({
  baseline,
  index
}: {
  baseline: number;
  index: number;
}): number {
  const adjusted = baseline * index;
  // average(baseline, adjusted)
  return Math.round((baseline + adjusted) / 2);
}

// ---- S8g: Required trips ---------------------------------------------------

/**
 * Required trips = ceil(quantity / capacityPerLoad).
 * 3.5 capacities = 4 trips; 4.5 = 5 trips.
 *
 * @returns number of trips (always a positive integer, or 0 when quantity is 0)
 */
export function requiredTrips({
  quantity,
  capacityPerLoad
}: {
  quantity: number;
  capacityPerLoad: number;
}): number {
  if (quantity <= 0 || capacityPerLoad <= 0) return 0;
  return Math.ceil(quantity / capacityPerLoad);
}

// ---- S8g: Duration days ---------------------------------------------------

/**
 * Duration days = ceil(trips / (trucks x loadsPerDay)).
 *
 * When loadsPerDay is 0 the line is in an infeasible-cycle state.
 * Returns `{ infeasibleCycle: true }` rather than dividing by zero.
 *
 * @returns `{ durationDays }` on success or `{ infeasibleCycle: true }` when loadsPerDay === 0.
 */
export function durationDays({
  trips,
  trucks,
  loadsPerDay
}: {
  trips: number;
  trucks: number;
  loadsPerDay: number;
}): { durationDays: number; infeasibleCycle?: false } | { infeasibleCycle: true } {
  if (loadsPerDay === 0) return { infeasibleCycle: true };
  if (trucks <= 0 || trips <= 0) return { durationDays: 0 };
  return { durationDays: Math.ceil(trips / (trucks * loadsPerDay)) };
}

// ---- S8g: Total trip km ---------------------------------------------------

/**
 * Total trip kilometres = trips x 2 x one-way road km.
 *
 * Changing the traffic index does NOT change this figure.
 * It only changes when the number of trips or the route changes.
 *
 * Acceptance examples:
 *   8 trips, 20 km one-way -> 320 km  (regardless of index)
 *
 * @param trips     - required trips (from requiredTrips)
 * @param oneWayKm  - one-way road km from the route (NOT multiplied by any index)
 * @returns total km, rounded to 2 dp
 */
export function totalTripKm({
  trips,
  oneWayKm
}: {
  trips: number;
  oneWayKm: number;
}): number {
  return Math.round(trips * 2 * oneWayKm * 100) / 100;
}
