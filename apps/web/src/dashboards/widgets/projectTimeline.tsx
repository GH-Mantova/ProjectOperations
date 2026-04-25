import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type Row = {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const STATUS_TONE: Record<string, string> = {
  MOBILISING: "#94A3B8",
  ACTIVE: "#005B61",
  PRACTICAL_COMPLETION: "#FEAA6D",
  DEFECTS: "#22C55E",
  CLOSED: "#6B7280"
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 90;
const LABEL_W = 130;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function ProjectTimelineWidget() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/projects-timeline")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(await r.text());
          setLoading(false);
          return;
        }
        setRows((await r.json()) as Row[]);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const start = startOfDay(new Date());
  const end = new Date(start.getTime() + WINDOW_DAYS * DAY_MS);
  const rowsWithBars = rows
    .filter((r) => r.startDate || r.endDate)
    .map((r) => {
      const s = r.startDate ? new Date(r.startDate) : start;
      const e = r.endDate ? new Date(r.endDate) : end;
      // Clamp into the visible 90-day window.
      const clampedStart = Math.max(s.getTime(), start.getTime());
      const clampedEnd = Math.min(e.getTime(), end.getTime());
      if (clampedEnd < clampedStart) return null;
      const offsetPct = ((clampedStart - start.getTime()) / (end.getTime() - start.getTime())) * 100;
      const widthPct = ((clampedEnd - clampedStart) / (end.getTime() - start.getTime())) * 100;
      return { ...r, offsetPct, widthPct };
    })
    .filter((r): r is Row & { offsetPct: number; widthPct: number } => r !== null);

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Project timeline · next 90 days</strong>
        <Link to="/projects" style={{ fontSize: 11 }}>All projects</Link>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      ) : rowsWithBars.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No active projects with planned dates.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rowsWithBars.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <Link
                to={`/projects/${r.id}`}
                style={{
                  width: LABEL_W,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
                title={`${r.projectNumber} · ${r.name}`}
              >
                <strong>{r.projectNumber}</strong> {r.name}
              </Link>
              <div style={{ position: "relative", flex: 1, height: 14, background: "var(--surface-muted, #f6f6f6)", borderRadius: 3 }}>
                <Link
                  to={`/projects/${r.id}`}
                  style={{
                    position: "absolute",
                    left: `${r.offsetPct}%`,
                    width: `${Math.max(2, r.widthPct)}%`,
                    top: 0,
                    bottom: 0,
                    background: STATUS_TONE[r.status] ?? "#005B61",
                    borderRadius: 3
                  }}
                  title={`${r.startDate ? new Date(r.startDate).toLocaleDateString("en-AU") : "?"} → ${
                    r.endDate ? new Date(r.endDate).toLocaleDateString("en-AU") : "?"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
