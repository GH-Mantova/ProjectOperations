import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";

type Worker = { id: string; firstName: string; lastName: string; role: string };
type Project = { id: string; projectNumber: string; name: string };

type ApprovedTimesheet = {
  id: string;
  date: string;
  hoursWorked: string;
  breakMinutes: number;
  description: string | null;
  status: "APPROVED";
  approvedAt: string | null;
  workerProfile: Worker;
  project: Project;
};

type ListResponse = { items: ApprovedTimesheet[]; total: number; page: number; limit: number };

const PAYROLL_EXPORT_PATH = "/field/timesheets/payroll-export.csv";

// Exported so the specs can exercise URL construction directly. The web
// workspace has no jsdom / @testing-library set up (see NoAccess.test.tsx
// for the pattern), so pure helpers are the testable seam.
export function buildPayrollExportUrl(from: string, to: string): string {
  const params = new URLSearchParams({ from, to });
  return `${PAYROLL_EXPORT_PATH}?${params.toString()}`;
}

export function buildPayrollExportFilename(from: string, to: string): string {
  return `approved-timesheets_${from}_to_${to}.csv`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const toIso = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(from.getDate() - 13);
  return { from: from.toISOString().slice(0, 10), to: toIso };
}

export function PayrollExportPage() {
  const { user, authFetch } = useAuth();
  const canManage = useMemo(() => can(user, "field.manage"), [user]);

  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rangeValid = Boolean(from && to && from <= to);
  const rangeMessage = !from || !to
    ? "Set both a From and To date."
    : from > to
      ? "From must be on or before To."
      : null;

  const load = useCallback(async () => {
    if (!rangeValid) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: "APPROVED",
        dateFrom: from,
        dateTo: to,
        limit: "200"
      });
      const response = await authFetch(`/field/timesheets/all?${params.toString()}`);
      if (!response.ok) throw new Error((await response.text()) || `Preview failed (${response.status})`);
      setData((await response.json()) as ListResponse);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch, from, to, rangeValid]);

  useEffect(() => {
    if (!canManage) return;
    void load();
  }, [canManage, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const totalHours = useMemo(() => {
    if (!data) return 0;
    return data.items.reduce((sum, r) => sum + Number(r.hoursWorked), 0);
  }, [data]);

  if (!canManage) return <NoAccess required="field.manage" />;

  async function download() {
    if (!rangeValid) {
      setExportError(rangeMessage ?? "Invalid date range.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const response = await authFetch(buildPayrollExportUrl(from, to));
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildPayrollExportFilename(from, to);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setToast("CSV exported");
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const rows = data?.items ?? [];

  return (
    <div className="admin-page" data-testid="payroll-export-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Operations</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Payroll Export</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Preview approved timesheets in a date range and download the payroll CSV.
          </p>
        </div>
      </header>

      <section
        className="s7-card"
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}
      >
        <Field label="From">
          <input
            type="date"
            className="s7-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            data-testid="payroll-export-from"
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            className="s7-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="payroll-export-to"
          />
        </Field>
        <button
          type="button"
          className="s7-btn s7-btn--secondary"
          onClick={() => void load()}
          disabled={!rangeValid || loading}
        >
          {loading ? "Loading…" : "Refresh preview"}
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          style={{ minHeight: 44 }}
          onClick={() => void download()}
          disabled={exporting || !rangeValid}
          aria-busy={exporting}
          title={rangeMessage ?? "Download approved timesheets in this date range as CSV"}
          data-testid="payroll-export-download"
        >
          {exporting ? "Exporting…" : "Download CSV"}
        </button>
      </section>

      {rangeMessage ? (
        <div className="s7-card" role="status" style={{ marginBottom: 16, color: "var(--text-muted)" }}>
          {rangeMessage}
        </div>
      ) : null}

      {exportError ? (
        <div
          className="s7-card"
          role="alert"
          style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)", marginBottom: 16 }}
        >
          {exportError}
        </div>
      ) : null}

      {error ? (
        <div
          className="s7-card"
          role="alert"
          style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)", marginBottom: 16 }}
        >
          {error}
        </div>
      ) : null}

      <section
        className="s7-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 16
        }}
      >
        <Stat label="Approved timesheets" value={data ? data.total : "—"} />
        <Stat label="Approved hours" value={data ? totalHours.toFixed(1) : "—"} suffix="hrs" />
        <Stat
          label="Range"
          value={rangeValid ? `${from} → ${to}` : "—"}
        />
      </section>

      {loading && !data ? (
        <div className="s7-card">
          <Skeleton width="100%" height={220} />
        </div>
      ) : rangeValid && rows.length === 0 && data ? (
        <div className="s7-card">
          <EmptyState
            heading="No approved timesheets in this range"
            subtext="Widen the date range or approve pending timesheets first."
          />
        </div>
      ) : rows.length > 0 ? (
        <section className="s7-card">
          {data && data.total > rows.length ? (
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 0 }}>
              Showing the first {rows.length} of {data.total} approved timesheets. The downloaded
              CSV includes every row in the range.
            </p>
          ) : null}
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Project</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th>Break</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {row.workerProfile.firstName} {row.workerProfile.lastName}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{row.workerProfile.role}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{row.project.projectNumber}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{row.project.name}</div>
                  </td>
                  <td>{formatDate(row.date)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {Number(row.hoursWorked).toFixed(1)} hrs
                  </td>
                  <td>{row.breakMinutes ? `${row.breakMinutes} min` : "None"}</td>
                  <td>{formatDate(row.approvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div>
      <p className="s7-type-label">{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 600 }}>
        {value} {suffix ? <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{suffix}</span> : null}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="s7-type-label">{label}</span>
      {children}
    </label>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#005B61",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 6,
        boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
      }}
    >
      {message}
    </div>
  );
}
