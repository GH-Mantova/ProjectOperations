import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { captureGpsReading } from "../field/useAutoGps";
import { ConsentPanel, GPS_HARD_BLOCK_MSG } from "../field/GpsConsent";

type MusterAttendee = {
  id: string;
  workerProfileId: string;
  siteAttendanceId: string | null;
  status: "UNKNOWN" | "ACCOUNTED" | "MISSING";
  checkedAt: string | null;
  workerProfile: { id: string; firstName: string; lastName: string };
  checkedBy: { id: string; firstName: string; lastName: string } | null;
};

type MusterEvent = {
  id: string;
  siteId: string;
  startedAt: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  completedAt: string | null;
  startedBy: { id: string; firstName: string; lastName: string };
  site: { id: string; name: string };
  attendees: MusterAttendee[];
};

const STATUS_LABEL: Record<MusterAttendee["status"], string> = {
  UNKNOWN: "Unknown",
  ACCOUNTED: "Accounted",
  MISSING: "MISSING"
};

const STATUS_COLOR: Record<MusterAttendee["status"], string> = {
  UNKNOWN: "var(--text-muted, #6b7280)",
  ACCOUNTED: "#16a34a",
  MISSING: "#dc2626"
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

export function MusterPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [event, setEvent] = useState<MusterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/field/location-consent");
        if (res.ok && !cancelled) {
          const body = (await res.json()) as { locationConsent?: boolean };
          setLocationConsent(Boolean(body.locationConsent));
        }
      } catch {
        // Non-fatal — if the consent endpoint is unreachable we default the
        // panel closed; the button click will still hard-block on GPS.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/safety/muster/${eventId}`);
      if (res.status === 404) {
        setError("Muster event not found.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setEvent((await res.json()) as MusterEvent);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkAttendee = useCallback(
    async (attendeeId: string, status: "ACCOUNTED" | "MISSING") => {
      setCheckingId(attendeeId);
      setActionError(null);
      try {
        // GPS-A3: the checker's GPS at the moment of check-off IS the muster
        // audit fact. Hard-block if we can't get a fix.
        const reading = await captureGpsReading();
        if (!reading.ok) {
          setActionError(GPS_HARD_BLOCK_MSG);
          return;
        }
        const res = await authFetch(`/safety/muster/attendees/${attendeeId}/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            lat: reading.reading.lat,
            lng: reading.reading.lng,
            accuracy: reading.reading.accuracy
          })
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          setActionError(body?.message ?? "Failed to update attendee.");
          return;
        }
        await load();
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setCheckingId(null);
      }
    },
    [authFetch, load]
  );

  const complete = useCallback(async () => {
    if (!eventId) return;
    setCompleting(true);
    setActionError(null);
    try {
      const res = await authFetch(`/safety/muster/${eventId}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setActionError(body?.message ?? "Failed to complete muster.");
        return;
      }
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  }, [authFetch, eventId, load]);

  const cancel = useCallback(async () => {
    if (!eventId) return;
    setCancelling(true);
    setActionError(null);
    try {
      const res = await authFetch(`/safety/muster/${eventId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setActionError(body?.message ?? "Failed to cancel muster.");
        return;
      }
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }, [authFetch, eventId, load]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading muster event" style={{ padding: 20, color: "var(--text-muted)" }}>
        Loading muster roll-call...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Couldn't load muster event</h2>
        <p style={{ color: "var(--status-danger)", margin: 0 }}>{error}</p>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate(-1)}
          style={{ minHeight: 44, width: "fit-content" }}
        >
          Go back
        </button>
      </div>
    );
  }

  if (!event) return null;

  const accounted = event.attendees.filter((a) => a.status === "ACCOUNTED").length;
  const missing = event.attendees.filter((a) => a.status === "MISSING").length;
  const unknown = event.attendees.filter((a) => a.status === "UNKNOWN").length;
  const total = event.attendees.length;
  const isActive = event.status === "ACTIVE";

  return (
    <div style={{ padding: 20 }}>
      <nav style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate(-1)}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          Back
        </button>
      </nav>

      <header className="s7-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 className="s7-type-page-heading" style={{ margin: "0 0 4px" }}>
              Evacuation Muster — {event.site.name}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              Started {fmtDate(event.startedAt)} by {event.startedBy.firstName} {event.startedBy.lastName}
              {event.completedAt ? ` · Closed ${fmtDate(event.completedAt)}` : ""}
            </p>
          </div>
          <span
            className={
              event.status === "ACTIVE"
                ? "s7-badge s7-badge--warning"
                : event.status === "COMPLETED"
                  ? "s7-badge s7-badge--success"
                  : "s7-badge s7-badge--neutral"
            }
          >
            {event.status}
          </span>
        </div>

        {/* Summary bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 16
          }}
        >
          <div className="s7-card" style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{total}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              On site
            </div>
          </div>
          <div className="s7-card" style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{accounted}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Accounted
            </div>
          </div>
          <div className="s7-card" style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{missing}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Missing
            </div>
          </div>
          <div className="s7-card" style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-muted)" }}>{unknown}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Unknown
            </div>
          </div>
        </div>
      </header>

      {actionError ? (
        <div
          role="alert"
          className="s7-card"
          style={{ padding: 12, marginBottom: 12, color: "var(--status-danger)", borderLeft: "3px solid var(--status-danger)" }}
        >
          {actionError}
        </div>
      ) : null}

      {isActive && locationConsent === false ? (
        <ConsentPanel
          context="muster"
          onAcknowledged={() => setLocationConsent(true)}
        />
      ) : null}

      {/* Roll-call table */}
      <section className="s7-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>Roll call</h2>
        {event.attendees.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No attendees in this muster snapshot.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Worker", "Status", "Checked at", ...(isActive ? ["Actions"] : [])].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px",
                        textAlign: "left",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                        borderBottom: "1px solid var(--border-default, #e5e7eb)"
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {event.attendees.map((att) => (
                  <tr
                    key={att.id}
                    style={{ borderBottom: "1px solid var(--border-default, #e5e7eb)" }}
                  >
                    <td style={{ padding: "10px 8px" }}>
                      {att.workerProfile.firstName} {att.workerProfile.lastName}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ color: STATUS_COLOR[att.status], fontWeight: att.status === "MISSING" ? 700 : 400 }}>
                        {STATUS_LABEL[att.status]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px", color: "var(--text-muted)" }}>
                      {fmtDate(att.checkedAt)}
                      {att.checkedBy ? ` by ${att.checkedBy.firstName} ${att.checkedBy.lastName}` : ""}
                    </td>
                    {isActive ? (
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="s7-btn s7-btn--sm"
                            disabled={checkingId === att.id || att.status === "ACCOUNTED" || locationConsent === false}
                            title={locationConsent === false ? GPS_HARD_BLOCK_MSG : undefined}
                            onClick={() => void checkAttendee(att.id, "ACCOUNTED")}
                            style={{
                              minHeight: 36,
                              background: att.status === "ACCOUNTED" ? "#16a34a" : undefined,
                              color: att.status === "ACCOUNTED" ? "#fff" : undefined,
                              borderColor: att.status === "ACCOUNTED" ? "#16a34a" : undefined
                            }}
                          >
                            Accounted
                          </button>
                          <button
                            type="button"
                            className="s7-btn s7-btn--sm"
                            disabled={checkingId === att.id || att.status === "MISSING" || locationConsent === false}
                            title={locationConsent === false ? GPS_HARD_BLOCK_MSG : undefined}
                            onClick={() => void checkAttendee(att.id, "MISSING")}
                            style={{
                              minHeight: 36,
                              background: att.status === "MISSING" ? "#dc2626" : undefined,
                              color: att.status === "MISSING" ? "#fff" : undefined,
                              borderColor: att.status === "MISSING" ? "#dc2626" : undefined
                            }}
                          >
                            Missing
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Event actions */}
      {isActive ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={completing || cancelling}
            onClick={() => void complete()}
            style={{ minHeight: 44 }}
          >
            {completing ? "Completing..." : "Complete muster"}
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            disabled={completing || cancelling}
            onClick={() => void cancel()}
            style={{ minHeight: 44, color: "var(--status-danger)" }}
          >
            {cancelling ? "Cancelling..." : "Cancel muster"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
