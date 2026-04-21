import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Worker = { id: string; firstName: string; lastName: string; role: string };
type Project = { id: string; projectNumber: string; name: string };
type Allocation = { id: string; roleOnProject: string | null };
type Person = { id: string; firstName: string; lastName: string } | null;

type Timesheet = {
  id: string;
  date: string;
  hoursWorked: string;
  breakMinutes: number;
  description: string | null;
  clockOnTime: string | null;
  clockOffTime: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  rejectedAt: string | null;
  workerProfile: Worker;
  project: Project;
  allocation: Allocation;
  approvedBy: Person;
  rejectedBy: Person;
};

type ListResponse = { items: Timesheet[]; total: number; page: number; limit: number };

type Summary = {
  totalHours: number;
  pendingCount: number;
  draftCount: number;
  approvedCount: number;
  oldestPendingDate: string | null;
  byWorker: Array<{ workerProfileId: string; firstName: string; lastName: string; totalHours: number; timesheetCount: number }>;
  byProject: Array<{ projectId: string; projectNumber: string; projectName: string; totalHours: number; timesheetCount: number }>;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffDays = Math.floor((now - then) / 86_400_000);
  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  return new Date(iso).toLocaleDateString();
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#E2E8F0", fg: "#1F2937", label: "Draft" },
  SUBMITTED: { bg: "#FAEEDA", fg: "#854F0B", label: "Submitted" },
  APPROVED: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Approved" }
};

export function TimesheetApprovalPage() {
  const { user } = useAuth();
  const canManage = useMemo(() => user?.permissions.includes("field.manage") ?? false, [user]);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  if (!canManage) return <Navigate to="/" replace />;

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Operations</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Timesheets</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Review, approve, or return timesheets submitted by field workers.
          </p>
        </div>
      </header>

      <nav className="admin-page__tabs" role="tablist" aria-label="Timesheet view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          className={tab === "pending" ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
          onClick={() => setTab("pending")}
        >
          Pending approval
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
          onClick={() => setTab("all")}
        >
          All timesheets
        </button>
      </nav>

      {tab === "pending" ? <PendingTab /> : <AllTab />}
    </div>
  );
}

function PendingTab() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<Timesheet | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        authFetch(`/field/timesheets/pending?limit=100`),
        authFetch(`/field/timesheets/summary`)
      ]);
      if (!listRes.ok) throw new Error(await listRes.text());
      if (!summaryRes.ok) throw new Error(await summaryRes.text());
      setData((await listRes.json()) as ListResponse);
      setSummary((await summaryRes.json()) as Summary);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function approveOne(row: Timesheet) {
    const prev = data;
    if (data) {
      setData({ ...data, items: data.items.filter((r) => r.id !== row.id), total: data.total - 1 });
    }
    try {
      const response = await authFetch(`/field/timesheets/${row.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      setToast("Timesheet approved");
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
      void load();
    } catch (err) {
      if (prev) setData(prev);
      setError((err as Error).message);
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const response = await authFetch(`/field/timesheets/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timesheetIds: ids })
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { approved: number };
      setToast(`${body.approved} timesheet${body.approved === 1 ? "" : "s"} approved`);
      setSelectedIds(new Set());
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pending = data?.items ?? [];
  const allSelected = pending.length > 0 && selectedIds.size === pending.length;

  return (
    <div>
      <section
        className="s7-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 16
        }}
      >
        <Stat label="Pending" value={summary?.pendingCount ?? "—"} accent="#854F0B" />
        <Stat
          label="Oldest pending"
          value={
            summary?.oldestPendingDate
              ? new Date(summary.oldestPendingDate).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short"
                })
              : "—"
          }
        />
        <Stat
          label="Pending hours"
          value={
            pending.length > 0
              ? pending.reduce((sum, r) => sum + Number(r.hoursWorked), 0).toFixed(1)
              : "0"
          }
          suffix="hrs"
        />
      </section>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="s7-card">
          <Skeleton width="100%" height={220} />
        </div>
      ) : pending.length === 0 ? (
        <div className="s7-card">
          <EmptyState heading="✓ No timesheets pending approval" subtext="All submitted timesheets have been reviewed." />
        </div>
      ) : (
        <section className="s7-card">
          {selectedIds.size > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                background: "#F1EFE8",
                borderRadius: 6,
                marginBottom: 12
              }}
            >
              <strong>{selectedIds.size} selected</strong>
              <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void bulkApprove()}>
                Approve selected
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </div>
          ) : null}

          <table className="admin-page__table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(pending.map((r) => r.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th>Worker</th>
                <th>Project</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th>Break</th>
                <th>Description</th>
                <th>Submitted</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.workerProfile.firstName}'s timesheet`}
                      checked={selectedIds.has(row.id)}
                      onChange={(e) => {
                        setSelectedIds((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        });
                      }}
                    />
                  </td>
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
                  <td title={row.description ?? undefined}>{truncate(row.description, 60)}</td>
                  <td>{formatRelative(row.submittedAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="s7-btn s7-btn--primary s7-btn--sm"
                        onClick={() => void approveOne(row)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--secondary s7-btn--sm"
                        style={{ background: "#FEAA6D", color: "#1F2937", borderColor: "#FEAA6D" }}
                        onClick={() => setReturnTarget(row)}
                      >
                        Return
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {returnTarget ? (
        <ReturnTimesheetModal
          timesheet={returnTarget}
          onClose={() => setReturnTarget(null)}
          onReturned={() => {
            setReturnTarget(null);
            setToast(`Timesheet returned to ${returnTarget.workerProfile.firstName} ${returnTarget.workerProfile.lastName}`);
            void load();
          }}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function AllTab() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | "DRAFT" | "SUBMITTED" | "APPROVED">("");
  const [workerId, setWorkerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [drawerTarget, setDrawerTarget] = useState<Timesheet | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (status) params.set("status", status);
      if (workerId) params.set("workerId", workerId);
      if (projectId) params.set("projectId", projectId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await authFetch(`/field/timesheets/all?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as ListResponse);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, status, workerId, projectId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const workerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.items ?? []) m.set(r.workerProfile.id, `${r.workerProfile.firstName} ${r.workerProfile.lastName}`);
    return Array.from(m.entries());
  }, [data]);
  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.items ?? []) m.set(r.project.id, `${r.project.projectNumber} — ${r.project.name}`);
    return Array.from(m.entries());
  }, [data]);

  return (
    <div>
      <section
        className="s7-card"
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}
      >
        <Field label="Status">
          <select
            className="s7-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
          </select>
        </Field>
        <Field label="Worker">
          <select className="s7-input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">All workers</option>
            {workerOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <select className="s7-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projectOptions.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" className="s7-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className="s7-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <button
          type="button"
          className="s7-btn s7-btn--secondary"
          onClick={() => setToast("CSV export coming soon")}
        >
          Export CSV
        </button>
      </section>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="s7-card"><Skeleton width="100%" height={220} /></div>
      ) : data.items.length === 0 ? (
        <div className="s7-card">
          <EmptyState heading="No timesheets match these filters" subtext="Try relaxing the filters above." />
        </div>
      ) : (
        <section className="s7-card">
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Project</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th>Break</th>
                <th>Description</th>
                <th>Status</th>
                <th>Approved by</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const pill = STATUS_PILL[row.status];
                return (
                  <tr key={row.id} style={{ cursor: "pointer" }} onClick={() => setDrawerTarget(row)}>
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
                    <td title={row.description ?? undefined}>{truncate(row.description, 40)}</td>
                    <td>
                      <span className="type-badge" style={{ background: pill.bg, color: pill.fg }}>
                        {pill.label}
                      </span>
                    </td>
                    <td>
                      {row.approvedBy ? `${row.approvedBy.firstName} ${row.approvedBy.lastName}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {drawerTarget ? (
        <TimesheetDetailDrawer
          timesheet={drawerTarget}
          onClose={() => setDrawerTarget(null)}
          onAction={(action) => {
            setDrawerTarget(null);
            setToast(action === "approved" ? "Timesheet approved" : "Timesheet returned");
            void load();
          }}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function ReturnTimesheetModal({
  timesheet,
  onClose,
  onReturned
}: {
  timesheet: Timesheet;
  onClose: () => void;
  onReturned: () => void;
}) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await authFetch(`/field/timesheets/${timesheet.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      onReturned();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "grid", placeItems: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div className="s7-card" style={{ width: "min(520px, 92vw)", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-title" style={{ margin: 0 }}>Return timesheet</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 16px", margin: "12px 0" }}>
          <dt style={{ color: "var(--text-muted)" }}>Worker</dt>
          <dd style={{ margin: 0 }}>{timesheet.workerProfile.firstName} {timesheet.workerProfile.lastName}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Project</dt>
          <dd style={{ margin: 0 }}>{timesheet.project.projectNumber} — {timesheet.project.name}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Date</dt>
          <dd style={{ margin: 0 }}>{formatDate(timesheet.date)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Hours</dt>
          <dd style={{ margin: 0 }}>{Number(timesheet.hoursWorked).toFixed(1)}</dd>
        </dl>

        <form onSubmit={submit}>
          <label>
            <span className="s7-type-label">Reason for returning (min 10 chars)</span>
            <textarea
              className="s7-input"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              required
              autoFocus
              style={{ marginTop: 4, width: "100%" }}
            />
            <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "right" }}>
              {reason.length} / 1000
            </div>
          </label>

          {error ? (
            <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 8, fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary"
              style={{ background: "#FEAA6D", color: "#1F2937", borderColor: "#FEAA6D" }}
              disabled={submitting || reason.trim().length < 10}
            >
              {submitting ? "Returning…" : "Return to worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TimesheetDetailDrawer({
  timesheet,
  onClose,
  onAction
}: {
  timesheet: Timesheet;
  onClose: () => void;
  onAction: (action: "approved" | "returned") => void;
}) {
  const { authFetch } = useAuth();
  const [returning, setReturning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const response = await authFetch(`/field/timesheets/${timesheet.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      onAction("approved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        style={{ width: "min(460px, 92vw)", height: "100vh", overflowY: "auto", padding: 24, borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="s7-type-label">Timesheet</p>
            <h2 className="s7-type-section-title" style={{ margin: "4px 0 0" }}>
              {timesheet.workerProfile.firstName} {timesheet.workerProfile.lastName}
            </h2>
            <p style={{ margin: "2px 0 0", color: "var(--text-muted)" }}>
              {timesheet.project.projectNumber} · {formatDate(timesheet.date)}
            </p>
          </div>
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 16px", marginTop: 20 }}>
          <dt style={{ color: "var(--text-muted)" }}>Role on project</dt>
          <dd style={{ margin: 0 }}>{timesheet.allocation.roleOnProject ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Hours</dt>
          <dd style={{ margin: 0 }}>{Number(timesheet.hoursWorked).toFixed(1)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Break</dt>
          <dd style={{ margin: 0 }}>{timesheet.breakMinutes ? `${timesheet.breakMinutes} min` : "None"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Clock on</dt>
          <dd style={{ margin: 0 }}>
            {timesheet.clockOnTime ? new Date(timesheet.clockOnTime).toLocaleTimeString() : "—"}
          </dd>
          <dt style={{ color: "var(--text-muted)" }}>Clock off</dt>
          <dd style={{ margin: 0 }}>
            {timesheet.clockOffTime ? new Date(timesheet.clockOffTime).toLocaleTimeString() : "—"}
          </dd>
          <dt style={{ color: "var(--text-muted)" }}>Description</dt>
          <dd style={{ margin: 0 }}>{timesheet.description ?? "—"}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Status</dt>
          <dd style={{ margin: 0 }}>
            <span
              className="type-badge"
              style={{
                background: STATUS_PILL[timesheet.status].bg,
                color: STATUS_PILL[timesheet.status].fg
              }}
            >
              {STATUS_PILL[timesheet.status].label}
            </span>
          </dd>
        </dl>

        <h3 className="s7-type-section-heading" style={{ marginTop: 24 }}>History</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
          <li>Submitted: {timesheet.submittedAt ? new Date(timesheet.submittedAt).toLocaleString() : "—"}</li>
          {timesheet.approvedAt ? (
            <li>
              Approved: {new Date(timesheet.approvedAt).toLocaleString()}
              {timesheet.approvedBy ? ` by ${timesheet.approvedBy.firstName} ${timesheet.approvedBy.lastName}` : ""}
            </li>
          ) : null}
          {timesheet.rejectedAt ? (
            <li>
              Returned: {new Date(timesheet.rejectedAt).toLocaleString()}
              {timesheet.rejectedBy ? ` by ${timesheet.rejectedBy.firstName} ${timesheet.rejectedBy.lastName}` : ""}
              {timesheet.rejectedReason ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 12px",
                    background: "#FAEEDA",
                    color: "#854F0B",
                    borderRadius: 6
                  }}
                >
                  Reason: {timesheet.rejectedReason}
                </div>
              ) : null}
            </li>
          ) : null}
        </ul>

        {error ? (
          <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 12, fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {timesheet.status === "SUBMITTED" ? (
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void approve()}
              disabled={approving || returning}
            >
              {approving ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              style={{ background: "#FEAA6D", color: "#1F2937", borderColor: "#FEAA6D" }}
              onClick={() => setShowReturn(true)}
              disabled={approving || returning}
            >
              Return
            </button>
          </div>
        ) : null}

        {showReturn ? (
          <ReturnTimesheetModal
            timesheet={timesheet}
            onClose={() => setShowReturn(false)}
            onReturned={() => {
              setShowReturn(false);
              setReturning(false);
              onAction("returned");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: string | number; accent?: string; suffix?: string }) {
  return (
    <div>
      <p className="s7-type-label">{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 600, color: accent ?? "inherit" }}>
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
