export type GpsReading = { lat: number; lng: number; accuracy: number };

export type GpsFailureReason = "unsupported" | "denied" | "timeout" | "unavailable";

export type GpsResult = { ok: true; reading: GpsReading } | { ok: false; reason: GpsFailureReason };

/**
 * Promise-wrapped navigator.geolocation.getCurrentPosition with
 * enableHighAccuracy, a 10s timeout, and maximumAge=0.
 *
 * Never rejects — returns a typed failure instead so callers can pattern-match
 * without try/catch.
 */
export function captureGpsReading(): Promise<GpsResult> {
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
