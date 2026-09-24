/**
 * geoapify-route.provider.ts -- GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g)
 *
 * Geoapify Routing API provider for waste-line travel time resolution.
 *
 * Key rules (binding):
 *   - Two requests per resolve: free_flow and approximated.
 *   - suggestedIndex = approximated / free_flow (2 dp, floor 1.00).
 *     It is a MODELLED TRAFFIC ALLOWANCE, not measured peak-hour traffic.
 *   - Index NEVER multiplies kilometres. Km comes from free_flow distance only.
 *   - No key in logs, detail strings, or the repo.
 *   - Timeout 5 s per request, one retry, then return null (fallback).
 *   - truck profile from OperationsSettings.routeVehicleMode (default "truck").
 */

import { Logger } from "@nestjs/common";
import type { TravelEstimate, TravelTimeProvider, LatLng } from "../travel-time";

/** Version marker required by the done_when gate. */
export const GEOAPIFY_ROUTE_TRAVEL_V1 = "scopecards-s8g";

const GEOAPIFY_BASE = "https://api.geoapify.com/v1/routing";
const TIMEOUT_MS = 5_000;
const MAX_RETRIES = 1; // one retry = two attempts total

type GeoapifyRouteResponse = {
  features?: Array<{
    properties?: {
      distance?: number;
      distance_units?: string;
      time?: number;
    };
  }>;
};

/**
 * Fetches the Geoapify routing response for the given waypoints, mode and
 * traffic model. Returns the (distance, time) pair or null on any failure.
 *
 * IMPORTANT: the apiKey must NEVER appear in any logged string.
 */
async function fetchRoute(
  from: LatLng,
  to: LatLng,
  mode: string,
  traffic: "free_flow" | "approximated",
  apiKey: string,
  logger: Logger,
  attempt: number = 0
): Promise<{ distanceMetres: number; timeSeconds: number } | null> {
  const waypoints = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
  const url = `${GEOAPIFY_BASE}?waypoints=${encodeURIComponent(waypoints)}&mode=${encodeURIComponent(mode)}&traffic=${traffic}&units=metric&apiKey=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      // 4xx / 5xx - log without the URL (key is in the query string)
      logger.warn(
        `Geoapify route request returned HTTP ${res.status} (traffic=${traffic})`
      );
      return null;
    }
    const body = (await res.json()) as GeoapifyRouteResponse;
    const props = body.features?.[0]?.properties;
    if (props?.distance == null || props?.time == null) {
      logger.warn(
        `Geoapify route response missing distance/time (traffic=${traffic})`
      );
      return null;
    }
    return { distanceMetres: props.distance, timeSeconds: props.time };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = (err as Error)?.name === "AbortError";
    if (isAbort && attempt < MAX_RETRIES) {
      logger.warn(`Geoapify route timed out (traffic=${traffic}), retrying...`);
      return fetchRoute(from, to, mode, traffic, apiKey, logger, attempt + 1);
    }
    if (isAbort) {
      logger.warn(
        `Geoapify route timed out after ${MAX_RETRIES + 1} attempt(s) (traffic=${traffic})`
      );
    } else {
      logger.warn(
        `Geoapify route fetch error (traffic=${traffic}): ${(err as Error)?.message ?? String(err)}`
      );
    }
    return null;
  }
}

/**
 * GeoapifyRouteProvider implements TravelTimeProvider using the Geoapify
 * Routing API.
 *
 * Two requests are issued per resolve (free_flow and approximated).
 * The free-flow result provides km and baseline minutes.
 * The approximated result is used to derive the suggested traffic index.
 *
 * suggestedIndex is stored on the returned TravelEstimate (see extended type).
 * It is a modelled allowance, not measured traffic data.
 */
export class GeoapifyRouteProvider implements TravelTimeProvider {
  private readonly logger = new Logger(GeoapifyRouteProvider.name);

  /**
   * @param apiKey - resolved via ApiKeysService.resolve("geoapify","company"); NEVER logged
   * @param vehicleMode - Geoapify vehicle mode (default "truck")
   */
  constructor(
    private readonly apiKey: string,
    private readonly vehicleMode: string = "truck"
  ) {}

  async resolve(from: LatLng, to: LatLng): Promise<TravelEstimate | null> {
    // Both requests are issued in parallel to minimise latency.
    const [freeFlow, approximated] = await Promise.all([
      fetchRoute(from, to, this.vehicleMode, "free_flow", this.apiKey, this.logger),
      fetchRoute(from, to, this.vehicleMode, "approximated", this.apiKey, this.logger)
    ]);

    // Free-flow is required; approximated is optional (index falls back to 1.00).
    if (freeFlow === null) {
      return null;
    }

    const kmRaw = freeFlow.distanceMetres / 1000;
    const km = Math.round(kmRaw * 100) / 100; // 2 dp
    const minutesOneWay = Math.round(freeFlow.timeSeconds / 60);

    let suggestedIndex: number | null = null;
    if (approximated !== null && freeFlow.timeSeconds > 0) {
      const raw = approximated.timeSeconds / freeFlow.timeSeconds;
      suggestedIndex = Math.max(1.0, Math.round(raw * 100) / 100);
    }

    const indexPart =
      suggestedIndex !== null
        ? `, modelled allowance ${suggestedIndex.toFixed(2)}`
        : "";
    const detail = `Geoapify route, ${km} km, ${minutesOneWay} min free-flow${indexPart}`;

    return {
      km,
      minutesOneWay,
      source: "route",
      detail,
      resolvedAt: new Date(),
      // Extended field for S8g -- carried through to the service layer.
      suggestedIndex
    } as TravelEstimate & { suggestedIndex: number | null };
  }
}
