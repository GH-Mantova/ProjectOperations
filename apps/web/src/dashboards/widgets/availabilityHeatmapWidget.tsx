import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import { loadColour, type HeatmapDay, type HeatmapWorker } from "./availabilityHeatmap.helpers";

type HeatmapResponse = {
  windowStart: string;
  windowEnd: string;
  days: HeatmapDay[];
  workers: HeatmapWorker[];
};

const DEFAULT_DAYS = 14;
const DEFAULT_TOP_N = 8;
const LABEL_W = 150;

function parseDays(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 7 || n > 42) return DEFAULT_DAYS;
  return Math.round(n);
}

function parseTopN(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 20) return DEFAULT_TOP_N;
  return Math.round(n);
}

export function AvailabilityHeatmapWidget({ config, rowSpan }: WidgetProps) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = parseDays(config.filters?.days);
  const topN = parseTopN(config.filters?.topN);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void authFetch(`/scheduler/availability-heatmap?days=${days}&topN=${topN}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(await r.text());
          setLoading(false);
          return;
        }
        setData((await r.json()) as HeatmapResponse);
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
  }, [authFetch, days, topN]);

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

  const rows = (data?.workers ?? []).slice(0, visibleRows);

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Worker availability · next {days} days</strong>
        <Link to="/scheduler/availability-report" style={{ fontSize: 11 }}>
          Full report
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, fontSize: 10, color: "var(--text-muted)" }}>
            <div style={{ width: LABEL_W }} />
            {(data?.days ?? []).map((d) => (
              <div key={d.date} style={{ flex: 1, textAlign: "center" }} title={d.date}>
                {formatDayLabel(d.date)}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {rows.map((w) => (
              <div key={w.workerProfileId} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, minHeight: 22 }}>
                <Link
                  to="/scheduler/availability-report"
                  style={{
                    width: LABEL_W,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={`${w.firstName} ${w.lastName} · ${w.role}`}
                >
                  <span>
                    <strong>
                      {w.firstName} {w.lastName}
                    </strong>{" "}
                    <span style={{ color: "var(--text-muted)" }}>· {w.role}</span>
                  </span>
                </Link>
                {w.cells.map((cell) => {
                  const dayMeta = (data?.days ?? []).find((d) => d.date === cell.date);
                  return (
                    <div
                      key={cell.date}
                      style={{
                        flex: 1,
                        height: 20,
                        minWidth: 8,
                        background: loadColour(cell.load, dayMeta?.isWeekend),
                        borderRadius: 2,
                        border: "1px solid var(--surface-muted, #e5e7eb)"
                      }}
                      title={`${cell.date} · ${cell.load} (${cell.projectCount} project${cell.projectCount === 1 ? "" : "s"})`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <Legend />
        </>
      )}
    </div>
  );
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return String(d.getUTCDate());
}

function Legend() {
  const item = (bg: string, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          background: bg,
          borderRadius: 2,
          border: "1px solid var(--surface-muted, #e5e7eb)"
        }}
      />
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "var(--text-muted)" }}>
      {item("var(--status-success-soft, #dcfce7)", "Free")}
      {item("var(--status-warning-soft, #fef3c7)", "Partial")}
      {item("var(--status-danger-soft, #fee2e2)", "Full")}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 6 }} aria-hidden>▦</div>
      <h4 style={{ fontSize: 13, margin: "0 0 4px" }}>No active workers</h4>
      <p style={{ fontSize: 11, margin: "0 0 8px" }}>
        Add active worker profiles to see availability here.
      </p>
      <Link to="/scheduler/availability-report" style={{ fontSize: 11 }}>
        Open availability report →
      </Link>
    </div>
  );
}
