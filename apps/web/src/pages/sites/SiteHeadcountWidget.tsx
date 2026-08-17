import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useSafetyRealtime } from "../../hooks/useSafetyRealtime";

const MUSTER_EVENT_TYPES = ["safety.muster.changed"] as const;

type HeadcountData = {
  siteId: string;
  count: number;
  activeMusterEventId: string | null;
};

type Props = {
  siteId: string;
  /**
   * Refresh interval in milliseconds for the safety-net poll. Default is
   * 300000 (5 minutes) — RT-2 wired SSE push as the primary refresh trigger
   * (see `useSafetyRealtime` below), so this poll only exists to recover
   * from a lost stream that `EventSource` failed to reconnect. Pre-RT-2 the
   * default was 60s; do NOT restore that without also disabling the SSE
   * path or you'll double-fetch on every muster mutation.
   */
  refreshInterval?: number;
};

/**
 * SiteHeadcountWidget
 *
 * Displays the live on-site headcount for a given site. RT-2 (2026-08-14):
 * refetches immediately on a `safety.muster.changed` SSE event scoped to
 * this widget's `siteId`, so a start / attendee check / close in another
 * tab (or on another user's device) reflects here without waiting for the
 * next poll. A wide-interval poll remains as a safety net if the SSE stream
 * can't be held. Shows a "Start muster" button when no active muster event
 * exists; if an active muster is running, shows a "View roll call" link
 * instead.
 *
 * Requires the current user to hold `safety.view` to see the count and
 * `safety.manage` to start a muster (the API enforces this; the button is
 * always rendered here and the server will 403 if the user lacks the
 * permission).
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

  useSafetyRealtime({
    types: [...MUSTER_EVENT_TYPES],
    siteId,
    onEvent: () => void fetchHeadcount()
  });

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
