import { getLocationProvider } from "./location/LocationProvider";

export type GpsReading = { lat: number; lng: number; accuracy: number };

export type GpsFailureReason = "unsupported" | "denied" | "timeout" | "unavailable";

export type GpsResult = { ok: true; reading: GpsReading } | { ok: false; reason: GpsFailureReason };

/**
 * One-shot GPS read that never rejects — returns a typed failure instead so
 * callers can pattern-match without try/catch.
 *
 * Delegates to the active LocationProvider (see location/LocationProvider.ts).
 * The default provider is BrowserLocationProvider, which uses
 * enableHighAccuracy, a 10s timeout, and maximumAge=0. Swap the provider via
 * setLocationProvider() for tests or a future native Capacitor build.
 */
export function captureGpsReading(): Promise<GpsResult> {
  return getLocationProvider().getCurrentReading();
}
