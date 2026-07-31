import { useEffect, useRef } from "react";
import { captureGpsReading } from "./useAutoGps";

// GPS-A2 — sample the worker's location roughly once every 3 minutes while
// they are on the clock AND the field app tab is visible. The hook does
// NOT wake the tab, does NOT run in the background, and does NOT use a
// service worker; when visibilityState flips to "hidden" or the enabled
// flag drops (clock-off, consent revoked, unmount) sampling stops dead.
//
// A client-side 25m distance floor skips POSTs when the worker has barely
// moved. The server enforces its own 120s throttle regardless, so a buggy
// or clock-skewed client cannot flood the location log table.

export const BREADCRUMB_INTERVAL_MS = 180_000;
export const BREADCRUMB_MIN_MOVE_METRES = 25;

// Haversine metres between two lat/lng points — same formula the field
// service uses server-side, duplicated here so the hook is
// self-contained and testable without importing the API layer.
export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type PostBreadcrumb = (body: { lat: number; lng: number; accuracy?: number }) => Promise<Response>;

export function useBreadcrumbTrail({
  enabled,
  post,
  intervalMs = BREADCRUMB_INTERVAL_MS
}: {
  enabled: boolean;
  post: PostBreadcrumb;
  intervalMs?: number;
}) {
  const lastSent = useRef<{ lat: number; lng: number } | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) {
      lastSent.current = null;
      return;
    }
    if (typeof document === "undefined" || typeof window === "undefined") return;

    async function sample() {
      if (inFlight.current) return;
      if (document.visibilityState !== "visible") return;
      inFlight.current = true;
      try {
        const result = await captureGpsReading();
        if (!result.ok) return;
        const prev = lastSent.current;
        if (
          prev &&
          distanceMetres(prev.lat, prev.lng, result.reading.lat, result.reading.lng) <
            BREADCRUMB_MIN_MOVE_METRES
        ) {
          return;
        }
        const res = await post({
          lat: result.reading.lat,
          lng: result.reading.lng,
          accuracy: result.reading.accuracy
        });
        // Only remember the point as "sent" when the server actually
        // accepted it — 409/403 responses should not update the anchor.
        if (res.ok) {
          lastSent.current = { lat: result.reading.lat, lng: result.reading.lng };
        }
      } finally {
        inFlight.current = false;
      }
    }

    const id = window.setInterval(() => {
      void sample();
    }, intervalMs);
    // Fire an immediate sample too so the trail gains a first breadcrumb
    // shortly after the worker opens the app, rather than waiting an
    // entire interval.
    void sample();

    return () => {
      window.clearInterval(id);
    };
  }, [enabled, post, intervalMs]);
}
