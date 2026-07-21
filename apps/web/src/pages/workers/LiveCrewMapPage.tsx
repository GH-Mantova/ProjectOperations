import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// Live crew map — visualises workers who are currently clocked-on (last
// timesheet has clockOnTime but no clockOffTime) using their last clock-on
// GPS point. Uses an SVG scatter of lat/lng rather than a tile map because
// no map library is in the bundle; we do NOT introduce continuous
// background tracking (privacy).

type WhosWorkingRow = {
  workerProfileId: string;
  workerName: string;
  role: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  clockOnTime: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
};

type NearestWorker = {
  workerProfileId: string;
  workerName: string;
  role: string;
  projectId: string;
  projectName: string;
  distanceKm: number;
  lat: number;
  lng: number;
};

export function LiveCrewMapPage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<WhosWorkingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [nearestLat, setNearestLat] = useState("");
  const [nearestLng, setNearestLng] = useState("");
  const [nearest, setNearest] = useState<NearestWorker[] | null>(null);
  const [nearestBusy, setNearestBusy] = useState(false);
  const [nearestError, setNearestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/workers/live-crew");
      if (!response.ok) throw new Error(await response.text());
      setRows((await response.json()) as WhosWorkingRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const withGps = useMemo(
    () => (rows ?? []).filter((r): r is WhosWorkingRow & { lat: number; lng: number } => r.lat !== null && r.lng !== null),
    [rows]
  );
  const withoutGps = useMemo(() => (rows ?? []).filter((r) => r.lat === null || r.lng === null), [rows]);

  async function runNearest(e: FormEvent) {
    e.preventDefault();
    const lat = Number(nearestLat);
    const lng = Number(nearestLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setNearestError("Enter numeric latitude and longitude.");
      return;
    }
    setNearestBusy(true);
    setNearestError(null);
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: "5" });
      const response = await authFetch(`/workers/live-crew/nearest?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      setNearest((await response.json()) as NearestWorker[]);
    } catch (err) {
      setNearestError((err as Error).message);
    } finally {
      setNearestBusy(false);
    }
  }

  return (
    <div className="admin-page" data-testid="live-crew-map-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Workforce</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Live crew map</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Workers currently on the clock, plotted at their last clock-on GPS point.
            No continuous location tracking &mdash; clock events only.
          </p>
        </div>
        <div>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      <section className="s7-card" style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(280px, 2fr)", gap: 16 }}>
        <div>
          <h2 className="s7-type-label" style={{ marginTop: 0 }}>Map</h2>
          {loading ? (
            <Skeleton width="100%" height={320} />
          ) : withGps.length === 0 ? (
            <EmptyState
              heading="No on-clock workers with GPS"
              subtext={
                withoutGps.length > 0
                  ? `${withoutGps.length} on-clock without a location fix.`
                  : "Nobody is clocked on right now."
              }
            />
          ) : (
            <CrewScatter rows={withGps} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
        <div>
          <h2 className="s7-type-label" style={{ marginTop: 0 }}>Nearest available worker</h2>
          <form onSubmit={runNearest} style={{ display: "grid", gap: 8 }}>
            <label className="s7-type-label" style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: 4 }}>Latitude</span>
              <input
                className="s7-input"
                inputMode="decimal"
                value={nearestLat}
                onChange={(e) => setNearestLat(e.target.value)}
                placeholder="-37.8136"
              />
            </label>
            <label className="s7-type-label" style={{ display: "block" }}>
              <span style={{ display: "block", marginBottom: 4 }}>Longitude</span>
              <input
                className="s7-input"
                inputMode="decimal"
                value={nearestLng}
                onChange={(e) => setNearestLng(e.target.value)}
                placeholder="144.9631"
              />
            </label>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={nearestBusy}>
              {nearestBusy ? "Searching…" : "Find nearest"}
            </button>
          </form>
          {nearestError ? (
            <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 8, fontSize: 13 }}>
              {nearestError}
            </div>
          ) : null}
          {nearest && nearest.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
              No on-clock workers with a known location.
            </p>
          ) : null}
          {nearest && nearest.length > 0 ? (
            <ol style={{ marginTop: 12, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13 }}>
              {nearest.map((n) => (
                <li key={n.workerProfileId}>
                  <strong>{n.workerName}</strong> &middot; {n.role} &middot;{" "}
                  <span style={{ color: "var(--text-muted)" }}>{n.distanceKm.toFixed(2)} km</span>
                  <br />
                  <Link to={`/projects/${n.projectId}`} style={{ color: "var(--brand-accent, #FEAA6D)" }}>
                    {n.projectName}
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>

      <section className="s7-card">
        <h2 className="s7-type-label" style={{ marginTop: 0 }}>
          On the clock now &mdash; {rows?.length ?? 0}
        </h2>
        {loading ? (
          <Skeleton width="100%" height={160} />
        ) : !rows || rows.length === 0 ? (
          <EmptyState heading="Nobody is clocked on right now" subtext="This list refreshes when workers clock on from the field app." />
        ) : (
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Role</th>
                <th>Project</th>
                <th>On clock since</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.workerProfileId}
                  onClick={() => setSelectedId(r.workerProfileId)}
                  style={{ cursor: r.lat !== null ? "pointer" : "default", background: selectedId === r.workerProfileId ? "color-mix(in srgb, #005B61 8%, transparent)" : undefined }}
                >
                  <td>
                    <Link to={`/workers/${r.workerProfileId}`} style={{ color: "var(--brand-accent, #FEAA6D)", fontWeight: 500 }}>
                      {r.workerName}
                    </Link>
                  </td>
                  <td>{r.role}</td>
                  <td>
                    <Link to={`/projects/${r.projectId}`}>{r.projectName}</Link>
                    <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: 12 }}>{r.projectNumber}</span>
                  </td>
                  <td>{formatSince(r.clockOnTime)}</td>
                  <td>
                    {r.lat === null || r.lng === null ? (
                      <span style={{ color: "var(--text-muted)" }}>&mdash;</span>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                        {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// Small SVG scatter of clock-on GPS points. Not a real map, but enough to
// eyeball "who is roughly where" without pulling in a tile library.
function CrewScatter({
  rows,
  selectedId,
  onSelect
}: {
  rows: (WhosWorkingRow & { lat: number; lng: number })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const bounds = useMemo(() => {
    const lats = rows.map((r) => r.lat);
    const lngs = rows.map((r) => r.lng);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    // Pad zero-range so single points don't collapse to a divide-by-zero.
    if (maxLat - minLat < 0.01) {
      minLat -= 0.05;
      maxLat += 0.05;
    }
    if (maxLng - minLng < 0.01) {
      minLng -= 0.05;
      maxLng += 0.05;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [rows]);

  const width = 640;
  const height = 320;
  const pad = 24;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6 }}
      role="img"
      aria-label="Scatter plot of on-clock worker GPS positions"
    >
      {rows.map((r) => {
        const x = pad + ((r.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - pad * 2);
        // Latitude flipped: north (higher lat) goes to the top of the SVG.
        const y = pad + ((bounds.maxLat - r.lat) / (bounds.maxLat - bounds.minLat)) * (height - pad * 2);
        const isSelected = selectedId === r.workerProfileId;
        return (
          <g key={r.workerProfileId} onClick={() => onSelect(r.workerProfileId)} style={{ cursor: "pointer" }}>
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 9 : 6}
              fill={isSelected ? "#FEAA6D" : "#005B61"}
              stroke="#fff"
              strokeWidth={2}
            >
              <title>{`${r.workerName} — ${r.projectName}`}</title>
            </circle>
            {isSelected ? (
              <text x={x + 12} y={y + 4} fontSize={12} fill="#0f172a">
                {r.workerName}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function formatSince(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m ago`;
}
