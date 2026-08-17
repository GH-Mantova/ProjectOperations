import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

type SafetyEventType =
  | "safety.incident.changed"
  | "safety.hazard.changed"
  | "safety.muster.changed";

export type SafetyRealtimeEvent = {
  type: SafetyEventType;
  siteId?: string | null;
};

type Options = {
  /** Event types to listen for. Other types are ignored. */
  types: SafetyEventType[];
  /**
   * Called on each matching event AFTER the optional siteId filter has
   * passed. Wrap fetches in it — the callback runs on the browser main
   * thread just like a normal effect.
   */
  onEvent: (event: SafetyRealtimeEvent) => void;
  /**
   * When set, only events whose `siteId` matches (or events with no
   * `siteId` at all — org-wide) invoke the callback. Muster events are
   * always site-scoped; incident/hazard events are not.
   */
  siteId?: string | null;
  /** When false, the effect skips opening a connection entirely. */
  enabled?: boolean;
};

/**
 * useSafetyRealtime
 *
 * Subscribes to the safety SSE channel (`/safety/realtime/stream`) and calls
 * `onEvent` for each event whose type is in `types` (and, if `siteId` is
 * provided, whose `siteId` matches or is absent). Consumers use this to
 * refetch the query that backs their view — the event payload is minimal by
 * design (client refetches rather than merging server state, keeping the
 * flow conflict-safe per the SLICE-0 realtime plan).
 *
 * The hook does NOT own state. It owns exactly one `EventSource` per mount
 * and closes it on unmount. `EventSource` handles reconnect / backoff
 * transparently; callers should keep any existing poll as a safety-net
 * fallback for environments that drop long-lived HTTP responses.
 */
export function useSafetyRealtime({ types, onEvent, siteId, enabled = true }: Options): void {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!enabled || !accessToken || types.length === 0) return;

    const url = `${API_BASE_URL}/safety/realtime/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);

    const handlers = types.map((type) => {
      const listener = (raw: MessageEvent) => {
        let event: SafetyRealtimeEvent;
        try {
          event = JSON.parse(raw.data) as SafetyRealtimeEvent;
        } catch {
          return;
        }
        if (siteId && event.siteId && event.siteId !== siteId) return;
        onEvent(event);
      };
      source.addEventListener(type, listener as EventListener);
      return { type, listener };
    });

    return () => {
      for (const h of handlers) {
        source.removeEventListener(h.type, h.listener as EventListener);
      }
      source.close();
    };
  }, [accessToken, enabled, siteId, types.join("|"), onEvent]);
}
