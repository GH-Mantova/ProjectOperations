import type { GpsResult, GpsFailureReason } from "../useAutoGps";

// Re-export the shared GPS types so callers can import from this module
// without reaching into useAutoGps directly.
export type { GpsResult, GpsFailureReason } from "../useAutoGps";

/**
 * Seam interface for GPS reads. The default implementation delegates to the
 * browser's navigator.geolocation API. A future native Capacitor build can
 * swap in a different provider at bootstrap time via setLocationProvider().
 */
export interface LocationProvider {
  /**
   * One-shot GPS read. Never rejects — returns a typed failure so callers can
   * pattern-match without try/catch.
   */
  getCurrentReading(): Promise<GpsResult>;

  /** True only when the provider supports background / off-tab readings. */
  readonly supportsBackground: boolean;
}

/**
 * Default implementation: wraps navigator.geolocation.getCurrentPosition with
 * enableHighAccuracy, a 10 s timeout, and maximumAge=0. Matches the original
 * behaviour that was inlined in useAutoGps.captureGpsReading().
 */
export const BrowserLocationProvider: LocationProvider = {
  supportsBackground: false,

  getCurrentReading(): Promise<GpsResult> {
    if (!navigator.geolocation) {
      return Promise.resolve({ ok: false, reason: "unsupported" });
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            ok: true,
            reading: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            }
          });
        },
        (err) => {
          let reason: GpsFailureReason;
          if (err.code === err.PERMISSION_DENIED) {
            reason = "denied";
          } else if (err.code === err.TIMEOUT) {
            reason = "timeout";
          } else {
            reason = "unavailable";
          }
          resolve({ ok: false, reason });
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
    });
  }
};

let activeProvider: LocationProvider = BrowserLocationProvider;

/**
 * Returns the currently active LocationProvider singleton.
 * Defaults to BrowserLocationProvider.
 */
export function getLocationProvider(): LocationProvider {
  return activeProvider;
}

/**
 * Replaces the active LocationProvider. Use in tests or at native bootstrap
 * to swap in a Capacitor-backed implementation.
 */
export function setLocationProvider(provider: LocationProvider): void {
  activeProvider = provider;
}
