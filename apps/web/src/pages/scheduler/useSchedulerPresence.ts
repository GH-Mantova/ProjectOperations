import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type PresenceViewer = {
  connectionId: string;
  userId: string;
  name: string;
};

export type AllocationChangedPayload = {
  changedBy: { userId: string; name: string };
  projectId: string;
  date: string;
  targetType: "WORKER" | "ASSET";
  action: "upsert" | "delete" | "range";
};

type UseSchedulerPresenceOptions = {
  /** Called when a scheduler.allocation.changed event arrives. */
  onAllocationChanged?: (payload: AllocationChangedPayload) => void;
};

type UseSchedulerPresenceResult = {
  /** Number of users currently viewing the scheduler grid (includes self). */
  viewerCount: number;
  /** The presence roster of current viewers. */
  viewers: PresenceViewer[];
  /** Whether the SSE connection is currently open. */
  connected: boolean;
};

/**
 * RT-3 — Scheduler presence hook.
 *
 * Opens a single persistent SSE connection to the scheduler realtime channel
 * (`GET /scheduler/realtime/stream`) and surfaces:
 *
 *   1. A live viewer count / roster from `scheduler.presence` events
 *      (emitted by the API whenever a peer connects or disconnects).
 *
 *   2. An `onAllocationChanged` callback fired when a
 *      `scheduler.allocation.changed` event arrives so the page can show
 *      a transient "data changed" nudge.
 *
 * The connection is torn down when the component unmounts or the user
 * loses their auth session.
 *
 * Implementation note: uses `fetch()` + `ReadableStream` rather than
 * native `EventSource` so the standard `Authorization: Bearer <token>`
 * header can be sent (native EventSource does not support custom headers).
 */
export function useSchedulerPresence(
  options: UseSchedulerPresenceOptions = {}
): UseSchedulerPresenceResult {
  const { accessToken } = useAuth();
  const { onAllocationChanged } = options;

  const [viewerCount, setViewerCount] = useState(0);
  const [viewers, setViewers] = useState<PresenceViewer[]>([]);
  const [connected, setConnected] = useState(false);

  // Keep the latest callback in a ref so we don't re-open the SSE connection
  // just because the callback identity changed.
  const onChangedRef = useRef(onAllocationChanged);
  useEffect(() => {
    onChangedRef.current = onAllocationChanged;
  }, [onAllocationChanged]);

  const connectRef = useRef<AbortController | null>(null);

  const openConnection = useCallback(
    async (token: string, signal: AbortSignal) => {
      try {
        const response = await fetch(`${API_BASE_URL}/scheduler/realtime/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache"
          },
          signal
        });

        if (!response.ok || !response.body) {
          // Non-2xx or no body — back off silently; not worth retrying here.
          return;
        }

        setConnected(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by double newlines.
          const messages = buffer.split("\n\n");
          // Keep the last (potentially incomplete) chunk in the buffer.
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
              const parsed: unknown = JSON.parse(dataLine);

              if (eventName === "scheduler.presence") {
                const presence = parsed as { count: number; roster: PresenceViewer[] };
                setViewerCount(presence.count);
                setViewers(presence.roster);
              } else if (eventName === "scheduler.allocation.changed") {
                onChangedRef.current?.(parsed as AllocationChangedPayload);
              }
              // scheduler.heartbeat — no-op on the client, just keeps the stream alive.
            } catch {
              // Malformed JSON — ignore and continue.
            }
          }
        }
      } catch (err) {
        // AbortError is expected on unmount / token change.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Other errors (network, auth) — fail silently; the page stays usable.
      } finally {
        setConnected(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!accessToken) {
      setConnected(false);
      setViewerCount(0);
      setViewers([]);
      return;
    }

    // Abort any previous connection before opening a new one.
    connectRef.current?.abort();
    const controller = new AbortController();
    connectRef.current = controller;

    void openConnection(accessToken, controller.signal);

    return () => {
      controller.abort();
    };
  }, [accessToken, openConnection]);

  return { viewerCount, viewers, connected };
}
