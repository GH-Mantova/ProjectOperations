import { useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

type DayMeta = {
  date: string;
  weekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
  skipped: boolean;
};

type GroupRow = {
  group: string;
  total: number;
  perDay: Array<{ date: string; available: number }>;
};

type WorkerRange = {
  from: string;
  to: string;
  projects?: Array<{ id: string; projectNumber: string; name: string }>;
};

type WorkerRow = {
  workerProfileId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: "ALWAYS_AVAILABLE" | "ALWAYS_COMMITTED" | "MIXED";
  freeRanges: WorkerRange[];
  committedRanges: WorkerRange[];
};

type ReportResponse = {
  month: string;
  skipNonWorkingDays: boolean;
  days: DayMeta[];
  groups: GroupRow[];
  totals: { uniqueAvailablePerDay: Array<{ date: string; count: number }> };
  workers: WorkerRow[];
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonth(month: string, delta: number): string {
  const [yStr, mStr] = month.split("-");
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Green (lots free) → amber → red (none free). Inputs >=0 totals.
function heatClass(available: number, total: number, skipped: boolean): string {
  if (skipped) return "avail-cell avail-cell--skipped";
  if (total === 0) return "avail-cell";
  const ratio = available / total;
  if (ratio >= 0.66) return "avail-cell avail-cell--green";
  if (ratio >= 0.34) return "avail-cell avail-cell--amber";
  return "avail-cell avail-cell--red";
}

function totalHeatClass(count: number, max: number, skipped: boolean): string {
  if (skipped) return "avail-cell avail-cell--skipped";
  if (max === 0) return "avail-cell";
  const ratio = count / max;
  if (ratio >= 0.66) return "avail-cell avail-cell--green";
  if (ratio >= 0.34) return "avail-cell avail-cell--amber";
  return "avail-cell avail-cell--red";
}

export function AvailabilityReportPage() {
  const { authFetch, accessToken } = useAuth();
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [skipNonWorkingDays, setSkipNonWorkingDays] = useState(true);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ month, skipNonWorkingDays: String(skipNonWorkingDays) });
    authFetch(`/scheduler/availability-report?${qs.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load availability report.");
        const data = (await response.json()) as ReportResponse;
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, month, skipNonWorkingDays]);

  const maxUnique = useMemo(() => {
    if (!report) return 0;
    return report.totals.uniqueAvailablePerDay.reduce((m, d) => Math.max(m, d.count), 0);
  }, [report]);

  const downloadCsv = async () => {
    const qs = new URLSearchParams({ month, skipNonWorkingDays: String(skipNonWorkingDays) });
    const url = `${API_BASE_URL}/scheduler/availability-report.csv?${qs.toString()}`;
    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
    });
    if (!response.ok) {
      setError("Could not download CSV.");
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `availability-${month}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} data-testid="availability-report">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Scheduler</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Availability report</h1>
          <p className="s7-type-body" style={{ margin: "6px 0 0", color: "var(--text-secondary, #6b7280)" }}>
            Per-group available/total per day. TOTAL AVAILABLE row counts unique people by name. Archived workers excluded.
          </p>
        </div>
      </header>

      <section
        className="s7-card"
        style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", padding: 16 }}
        aria-label="Report filters"
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => setMonth((m) => addMonth(m, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <input
            className="s7-input"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            style={{ minHeight: 44 }}
            aria-label="Month"
          />
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => setMonth((m) => addMonth(m, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={skipNonWorkingDays}
            onChange={(event) => setSkipNonWorkingDays(event.target.checked)}
          />
          <span className="s7-type-body">Skip weekends &amp; public holidays</span>
        </label>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => void downloadCsv()}
          style={{ minHeight: 44 }}
          data-testid="availability-report-csv"
        >
          Export CSV
        </button>
      </section>

      {error ? (
        <div className="tender-page__error" role="alert">{error}</div>
      ) : null}

      {loading ? (
        <Skeleton height={240} />
      ) : !report || report.groups.length === 0 ? (
        <EmptyState heading="No workers" subtext="Workers will appear here once seeded." />
      ) : (
        <section className="s7-card" style={{ padding: 16, overflowX: "auto" }} aria-label="Availability heatmap">
          <table className="avail-table" role="table">
            <thead>
              <tr>
                <th className="avail-th avail-th--rowhead">Group</th>
                <th className="avail-th">Total</th>
                {report.days.map((d) => (
                  <th key={d.date} className={`avail-th${d.skipped ? " avail-th--skipped" : ""}`}>
                    <span className="avail-th__date">{d.date.slice(8)}</span>
                    <span className="avail-th__dow">{["Su","Mo","Tu","We","Th","Fr","Sa"][d.weekday]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.groups.map((g) => (
                <tr key={g.group}>
                  <th scope="row" className="avail-th avail-th--rowhead">{g.group}</th>
                  <td className="avail-cell avail-cell--total">{g.total}</td>
                  {g.perDay.map((p, i) => {
                    const meta = report.days[i];
                    return (
                      <td
                        key={p.date}
                        className={heatClass(p.available, g.total, meta.skipped)}
                        title={`${g.group} ${p.date}: ${p.available}/${g.total} available`}
                      >
                        {meta.skipped ? "—" : `${p.available}/${g.total}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="avail-table__totalrow">
                <th scope="row" className="avail-th avail-th--rowhead">TOTAL AVAILABLE (unique by name)</th>
                <td className="avail-cell avail-cell--total">—</td>
                {report.totals.uniqueAvailablePerDay.map((p, i) => {
                  const meta = report.days[i];
                  return (
                    <td
                      key={p.date}
                      className={totalHeatClass(p.count, maxUnique, meta.skipped)}
                      title={`Unique available ${p.date}: ${p.count}`}
                    >
                      {meta.skipped ? "—" : p.count}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {report && report.workers.length > 0 ? (
        <section className="s7-card" style={{ padding: 16 }} aria-label="Per-worker breakdown">
          <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Per-worker breakdown</h2>
          <ul className="avail-worker-list">
            {report.workers.map((w) => (
              <li key={w.workerProfileId} className="avail-worker">
                <header className="avail-worker__head">
                  <strong>{w.firstName} {w.lastName}</strong>
                  <span className="s7-badge s7-badge--neutral">{w.role}</span>
                  <span
                    className={
                      w.status === "ALWAYS_AVAILABLE"
                        ? "s7-badge s7-badge--active"
                        : w.status === "ALWAYS_COMMITTED"
                          ? "s7-badge s7-badge--danger"
                          : "s7-badge s7-badge--warning"
                    }
                  >
                    {w.status === "ALWAYS_AVAILABLE"
                      ? "Available entire period"
                      : w.status === "ALWAYS_COMMITTED"
                        ? "Fully committed"
                        : "Mixed"}
                  </span>
                </header>
                {w.freeRanges.length > 0 ? (
                  <p style={{ margin: "4px 0", color: "var(--text-secondary, #6b7280)" }}>
                    Free: {w.freeRanges.map((r) => `${r.from} → ${r.to}`).join(", ")}
                  </p>
                ) : null}
                {w.committedRanges.length > 0 ? (
                  <ul className="avail-worker__committed">
                    {w.committedRanges.map((r, idx) => (
                      <li key={`${r.from}-${idx}`}>
                        Committed {r.from} → {r.to}
                        {r.projects && r.projects.length > 0
                          ? ` · ${r.projects.map((p) => `${p.projectNumber} ${p.name}`).join(", ")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
