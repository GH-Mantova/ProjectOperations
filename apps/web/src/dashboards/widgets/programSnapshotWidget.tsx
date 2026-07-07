import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import {
  clipTaskToWindow,
  type ClippedTask,
  type SnapshotProject
} from "./programSnapshot.helpers";

type SnapshotResponse = {
  windowStart: string;
  windowEnd: string;
  projects: SnapshotProject[];
};

const STATUS_TONE: Record<string, string> = {
  MOBILISING: "#94A3B8",
  ACTIVE: "#005B61",
  PRACTICAL_COMPLETION: "#FEAA6D",
  DEFECTS: "#22C55E",
  CLOSED: "#6B7280"
};

const DEFAULT_WINDOW_DAYS = 28;
const DEFAULT_TOP_N = 8;
const LABEL_W = 150;

function parseWindowDays(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 7 || n > 90) return DEFAULT_WINDOW_DAYS;
  return Math.round(n);
}

function parseTopN(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 20) return DEFAULT_TOP_N;
  return Math.round(n);
}

export function ProgramSnapshotWidget({ config, rowSpan }: WidgetProps) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const windowDays = parseWindowDays(config.filters?.windowDays);
  const topN = parseTopN(config.filters?.topN);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void authFetch(`/projects-timeline/program-snapshot?windowDays=${windowDays}&topN=${topN}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(await r.text());
          setLoading(false);
          return;
        }
        setData((await r.json()) as SnapshotResponse);
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
  }, [authFetch, windowDays, topN]);

  const visibleRows = Math.max(3, (rowSpan ?? 2) * 4);

  if (loading) {
    return (
      <div className="s7-card" style={{ padding: 14, height: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 18,
                background: "var(--surface-muted, #f3f4f6)",
                borderRadius: 4,
                minHeight: 44
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="s7-card" style={{ padding: 14, height: "100%" }}>
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      </div>
    );
  }

  const windowStart = data ? new Date(data.windowStart) : new Date();
  const windowEnd = data ? new Date(data.windowEnd) : new Date();

  const rows = (data?.projects ?? []).slice(0, visibleRows).map((p) => {
    const clipped: ClippedTask[] = [];
    for (const t of p.tasks) {
      const c = clipTaskToWindow(t, windowStart, windowEnd);
      if (c) clipped.push(c);
    }
    return { project: p, tasks: clipped };
  });

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>
          Program snapshot · next {windowDays} days
        </strong>
        <Link to="/projects" style={{ fontSize: 11 }}>All projects</Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map(({ project, tasks }) => (
            <div key={project.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, minHeight: 22 }}>
              <Link
                to={`/projects/${project.id}`}
                style={{
                  width: LABEL_W,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center"
                }}
                title={`${project.projectNumber} · ${project.name}`}
              >
                <span>
                  <strong>{project.projectNumber}</strong> {project.name}
                </span>
              </Link>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  height: 16,
                  background: "var(--surface-muted, #f6f6f6)",
                  borderRadius: 3
                }}
              >
                {tasks.length === 0 ? null : (
                  tasks.map((t) => (
                    <Link
                      key={t.id}
                      to={`/projects/${project.id}`}
                      style={{
                        position: "absolute",
                        left: `${t.offsetPct}%`,
                        width: `${t.widthPct}%`,
                        top: 2,
                        bottom: 2,
                        background: t.colour ?? STATUS_TONE[project.status] ?? "#005B61",
                        borderRadius: 2,
                        opacity: 0.85
                      }}
                      title={`${t.title} — ${new Date(t.startDate).toLocaleDateString("en-AU")} → ${new Date(t.endDate).toLocaleDateString("en-AU")}${
                        t.progress ? ` · ${t.progress}%` : ""
                      }`}
                    />
                  ))
                )}
                {/* today line */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${todayOffsetPct(windowStart, windowEnd)}%`,
                    top: -2,
                    bottom: -2,
                    width: 1,
                    background: "var(--status-danger, #ef4444)"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function todayOffsetPct(start: Date, end: Date): number {
  const now = Date.now();
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 0;
  const off = ((now - start.getTime()) / span) * 100;
  return Math.max(0, Math.min(100, off));
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 6 }} aria-hidden>▬</div>
      <h4 style={{ fontSize: 13, margin: "0 0 4px" }}>No active tasks in window</h4>
      <p style={{ fontSize: 11, margin: "0 0 8px" }}>
        Widen the window or create Gantt tasks on your active projects.
      </p>
      <Link to="/projects" style={{ fontSize: 11 }}>Open projects →</Link>
    </div>
  );
}
