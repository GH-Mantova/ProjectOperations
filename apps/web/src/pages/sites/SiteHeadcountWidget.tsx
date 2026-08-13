import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useSafetyRealtime, type SafetyMusterPayload } from "./useSafetyRealtime";

type HeadcountData = {
  siteId: string;
  count: number;
  activeMusterEventId: string | null;
};

type Props = {
  siteId: string;
  /**
   * Fallback poll interval in milliseconds. Default 300000 (5 minutes).
   * With RT-2 SSE, the push does the real-time work — polling is only a
   * safety-net if the stream drops (proxy timeout, sleep, network blip).
   */
  refreshInterval?: number;
};

/**
 * SiteHeadcountWidget
 *
 * Displays the live on-site headcount for a given site. Refetches
 * `/safety/muster/headcount/:siteId`:
 *
 *   1. On a `safety.muster.changed` SSE push (RT-2) for this widget's
 *      `siteId` — the primary path.
 *   2. On a coarse 5-minute fallback poll — the safety-net when SSE drops.
 *
 * Shows a "Start muster" button when no active muster event exists, or a
 * "View roll call" link when one is running.
 *
 * Requires `safety.view` to see the count and `safety.manage` to start a
 * muster (server-enforced).
 */
export function SiteHeadcountWidget({ siteId, refreshInterval = 300_000 }: Props) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<HeadcountData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHeadcount = useCallback(async () => {
    try {
      const res = await authFetch(`/safety/muster/headcount/${siteId}`);
      if (!res.ok) {
        if (res.status === 403) {
          setLoadError("You don't have permission to view the on-site headcount (safety.view required).");
          return;
        }
        throw new Error(await res.text());
      }
      setData((await res.json()) as HeadcountData);
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [authFetch, siteId]);

  useEffect(() => {
    void fetchHeadcount();
    intervalRef.current = setInterval(() => void fetchHeadcount(), refreshInterval);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchHeadcount, refreshInterval]);

  const onMusterChanged = useCallback(
    (payload: SafetyMusterPayload) => {
      if (payload.siteId === siteId) void fetchHeadcount();
    },
    [fetchHeadcount, siteId]
  );
  useSafetyRealtime({ onMusterChanged });

  const startMuster = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await authFetch(`/safety/muster/start/${siteId}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setStartError(body?.message ?? "Failed to start muster.");
        return;
      }
      const created = (await res.json()) as { id: string };
      navigate(`/sites/${siteId}/muster/${created.id}`);
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, [authFetch, siteId, navigate]);

  const containerStyle: React.CSSProperties = {
    padding: 16,
    display: "grid",
    gap: 10
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--text-muted, #6b7280)",
    margin: 0
  };

  if (loadError) {
    return (
      <div className="s7-card" style={containerStyle}>
        <p style={headingStyle}>On site</p>
        <p style={{ color: "var(--status-danger)", fontSize: 13, margin: 0 }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="s7-card" style={containerStyle}>
      <p style={headingStyle}>On site now</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "var(--text-primary, #111)",
            lineHeight: 1
          }}
        >
          {data === null ? "—" : data.count}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
          worker{data?.count !== 1 ? "s" : ""} signed in
        </span>
      </div>

      {startError ? (
        <p role="alert" style={{ color: "var(--status-danger)", fontSize: 12, margin: 0 }}>
          {startError}
        </p>
      ) : null}

      {data?.activeMusterEventId ? (
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          onClick={() => navigate(`/sites/${siteId}/muster/${data.activeMusterEventId}`)}
          style={{ minHeight: 36, alignSelf: "flex-start" }}
        >
          View active roll call
        </button>
      ) : (
        <button
          type="button"
          className="s7-btn s7-btn--sm"
          disabled={starting}
          onClick={() => void startMuster()}
          style={{ minHeight: 36, alignSelf: "flex-start" }}
        >
          {starting ? "Starting..." : "Start muster"}
        </button>
      )}
    </div>
  );
}
