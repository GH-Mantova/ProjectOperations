import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type SafetyMusterPayload = {
  siteId: string;
  eventId?: string;
  action: "start" | "check" | "complete" | "cancel";
};

export type SafetyIncidentPayload = {
  id: string;
  action: "create" | "update" | "close";
};

export type SafetyHazardPayload = SafetyIncidentPayload;

type UseSafetyRealtimeOptions = {
  /** Called for every `safety.muster.changed` push, unfiltered — the caller
   * decides whether to act based on `siteId` or the active `eventId`. */
  onMusterChanged?: (payload: SafetyMusterPayload) => void;
  onIncidentChanged?: (payload: SafetyIncidentPayload) => void;
  onHazardChanged?: (payload: SafetyHazardPayload) => void;
};

/**
 * RT-2 — Safety realtime SSE hook.
 *
 * Opens one persistent SSE connection to `GET /safety/realtime/stream` and
 * fires the corresponding callback for each incoming event. Callbacks are
 * kept in refs so re-renders that recreate the callback do not close and
 * reopen the socket. Follows the same shape as RT-1's `useSchedulerPresence`
 * (fetch + ReadableStream so we can send `Authorization: Bearer <token>` —
 * native EventSource cannot set custom headers).
 *
 * The stream carries a `safety.heartbeat` every 30 s from the server; the
 * client ignores it — its only purpose is to keep the pipe from being
 * silently killed by a proxy idle-timeout.
 */
export function useSafetyRealtime(options: UseSafetyRealtimeOptions = {}): void {
  const { accessToken } = useAuth();
  const { onMusterChanged, onIncidentChanged, onHazardChanged } = options;

  const musterRef = useRef(onMusterChanged);
  const incidentRef = useRef(onIncidentChanged);
  const hazardRef = useRef(onHazardChanged);
  useEffect(() => {
    musterRef.current = onMusterChanged;
    incidentRef.current = onIncidentChanged;
    hazardRef.current = onHazardChanged;
  }, [onMusterChanged, onIncidentChanged, onHazardChanged]);

  const openConnection = useCallback(async (token: string, signal: AbortSignal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/safety/realtime/stream`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "Cache-Control": "no-cache"
        },
        signal
      });

      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const message of messages) {
          if (!message.trim()) continue;

          let eventName = "message";
          let dataLine = "";
          for (const line of message.split("\n")) {
            if (line.startsWith("event: ")) {
              eventName = line.slice("event: ".length).trim();
            } else if (line.startsWith("data: ")) {
              dataLine = line.slice("data: ".length).trim();
            }
          }
          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine) as unknown;
            if (eventName === "safety.muster.changed") {
              musterRef.current?.(parsed as SafetyMusterPayload);
            } else if (eventName === "safety.incident.changed") {
              incidentRef.current?.(parsed as SafetyIncidentPayload);
            } else if (eventName === "safety.hazard.changed") {
              hazardRef.current?.(parsed as SafetyHazardPayload);
            }
            // safety.heartbeat — no-op; just keeps the stream alive.
          } catch {
            // Malformed JSON — skip and continue.
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Other errors (network, auth) — fail silently. Callers keep their
      // fallback poll (SiteHeadcountWidget) or a manual refresh path
      // (MusterPage) so the page remains usable.
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    void openConnection(accessToken, controller.signal);
    return () => controller.abort();
  }, [accessToken, openConnection]);
}
