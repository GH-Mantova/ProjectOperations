import { useCallback, useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// PR-216 — Calendar Sync settings/status panel. Mock-mode-first.
// Shows the user the active adapter mode, how many events have been
// synced, and lets them trigger a manual sync run. The live
// Microsoft Graph adapter is a follow-up — gated on added Entra
// Calendars.ReadWrite permission and Marco's sign-off.

type SyncStatus = {
  mode: "mock" | "live";
  activeCount: number;
  cancelledCount: number;
  lastSyncedAt: string | null;
};

type SyncRunResult = {
  created: number;
  updated: number;
  cancelled: number;
  activeCount: number;
};

type SyncedEvent = {
  id: string;
  sourceType: string;
  sourceId: string;
  externalEventId: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  status: "active" | "cancelled";
  lastSyncedAt: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function CalendarSyncPage() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [events, setEvents] = useState<SyncedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<SyncRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [statusRes, eventsRes] = await Promise.all([
        authFetch("/calendar-sync/status"),
        authFetch("/calendar-sync/events")
      ]);
      if (!statusRes.ok) throw new Error("Could not load calendar sync status.");
      if (!eventsRes.ok) throw new Error("Could not load calendar events.");
      setStatus((await statusRes.json()) as SyncStatus);
      setEvents((await eventsRes.json()) as SyncedEvent[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar sync state.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runSync = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await authFetch("/calendar-sync/run", { method: "POST" });
      if (!res.ok) throw new Error("Calendar sync run failed.");
      setLastRun((await res.json()) as SyncRunResult);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>Calendar Sync</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Sync your assigned shifts to your calendar. Mock-mode pushes events into a local ledger
          you can inspect below. The live Microsoft Outlook calendar adapter is a follow-up.
        </p>
      </header>

      {error ? (
        <AppCard>
          <p role="alert" style={{ color: "var(--status-error)", margin: 0 }}>{error}</p>
        </AppCard>
      ) : null}

      <AppCard>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Status</h2>
            {loading || !status ? (
              <p style={{ margin: "8px 0 0", color: "var(--text-muted)" }}>Loading…</p>
            ) : (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                <li>
                  Mode: <strong>{status.mode}</strong>
                  {status.mode === "mock" ? (
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}— Microsoft Graph calendar is a follow-up (needs added Entra permission).
                    </span>
                  ) : null}
                </li>
                <li>Active events: <strong>{status.activeCount}</strong></li>
                <li>Cancelled events: <strong>{status.cancelledCount}</strong></li>
                <li>
                  Last sync:{" "}
                  <strong>{status.lastSyncedAt ? formatDateTime(status.lastSyncedAt) : "never"}</strong>
                </li>
              </ul>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={runSync}
              disabled={running || loading}
              data-testid="calendar-sync-run"
            >
              {running ? "Syncing…" : "Sync now"}
            </button>
            {lastRun ? (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                Last run — created {lastRun.created}, updated {lastRun.updated}, cancelled{" "}
                {lastRun.cancelled} ({lastRun.activeCount} active).
              </p>
            ) : null}
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h2 style={{ marginTop: 0 }}>ICS feed</h2>
        <p style={{ marginTop: 4, color: "var(--text-muted)" }}>
          Subscribe Outlook / Google Calendar / Apple Calendar to your active synced events without
          waiting for the live Graph adapter. Requires an authenticated request — pair with a
          bearer-token proxy before sharing the URL.
        </p>
        <code style={{ background: "var(--surface-muted)", padding: "4px 8px", borderRadius: 4 }}>
          GET /api/v1/calendar-sync/feed.ics
        </code>
      </AppCard>

      <AppCard>
        <h2 style={{ marginTop: 0 }}>Synced events</h2>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : events.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            No events synced yet. Click <strong>Sync now</strong> to push your shifts.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--surface-border)" }}>
                <th style={{ padding: 8 }}>Title</th>
                <th style={{ padding: 8 }}>Start</th>
                <th style={{ padding: 8 }}>End</th>
                <th style={{ padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} style={{ borderBottom: "1px solid var(--surface-border)" }}>
                  <td style={{ padding: 8 }}>{event.title}</td>
                  <td style={{ padding: 8 }}>{formatDateTime(event.startAt)}</td>
                  <td style={{ padding: 8 }}>{formatDateTime(event.endAt)}</td>
                  <td style={{ padding: 8 }}>{event.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AppCard>
    </div>
  );
}
