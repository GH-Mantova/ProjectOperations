import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type CorrectiveAction = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  dueAt?: string | null;
  closedAt?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  assignedToRole?: string | null;
  submission?: {
    id: string;
    submittedAt?: string | null;
    templateVersion: { template: { id: string; name: string; code: string } };
  } | null;
  createdAt: string;
};

type PageData = { items: CorrectiveAction[]; total: number; page: number; pageSize: number };

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "#FEF3C7", color: "#92400E", label: "Open" },
  in_progress: { bg: "color-mix(in srgb, #3B82F6 18%, transparent)", color: "#1D4ED8", label: "In Progress" },
  closed: { bg: "#DCFCE7", color: "#166534", label: "Closed" }
};

const PRIORITY_CHIP: Record<string, { color: string }> = {
  low: { color: "#6B7280" },
  medium: { color: "#D97706" },
  high: { color: "#DC2626" },
  critical: { color: "#7C3AED" }
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(action: CorrectiveAction) {
  if (action.status === "closed" || !action.dueAt) return false;
  return new Date(action.dueAt) < new Date();
}

export function CorrectiveActionsPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (overdueOnly) params.set("overdue", "true");
      const res = await authFetch(`/forms/corrective-actions?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as PageData);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, page, statusFilter, overdueOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = user?.isSuperUser || user?.permissions?.includes("forms.manage");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Corrective Actions</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            CAPA register — actions raised from form submissions
          </div>
        </div>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => navigate("/forms/corrective-actions/new")}
          >
            + New Action
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select
          className="s7-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ fontSize: 13 }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }}
          />
          Overdue only
        </label>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {data ? `${data.total} action${data.total !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {error ? (
        <div style={{ color: "var(--status-danger)", padding: 12 }}>{error}</div>
      ) : !data ? (
        <div style={{ color: "var(--text-muted)", padding: 12 }}>Loading…</div>
      ) : data.items.length === 0 ? (
        <EmptyState
          heading="No corrective actions"
          subtext="Actions are raised automatically when a form submission triggers one, or can be created manually by managers."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.items.map((action) => {
            const chip = STATUS_CHIP[action.status] ?? STATUS_CHIP.open;
            const pColor = PRIORITY_CHIP[action.priority]?.color ?? "#6B7280";
            const overdue = isOverdue(action);
            return (
              <Link
                key={action.id}
                to={`/forms/corrective-actions/${action.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="s7-card"
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    borderLeft: `4px solid ${overdue ? "var(--status-danger, #DC2626)" : "transparent"}`
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{action.title}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: chip.bg,
                          color: chip.color
                        }}
                      >
                        {chip.label}
                      </span>
                      <span style={{ fontSize: 11, color: pColor, fontWeight: 600, textTransform: "uppercase" }}>
                        {action.priority}
                      </span>
                      {overdue ? (
                        <span style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", fontWeight: 700 }}>
                          OVERDUE
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {action.assignedTo ? (
                        <span>Assigned: {action.assignedTo.firstName} {action.assignedTo.lastName}</span>
                      ) : action.assignedToRole ? (
                        <span>Assigned role: {action.assignedToRole}</span>
                      ) : (
                        <span>Unassigned</span>
                      )}
                      {action.dueAt ? <span>Due: {fmt(action.dueAt)}</span> : null}
                      {action.submission ? (
                        <span>
                          From: {action.submission.templateVersion.template.name}
                        </span>
                      ) : null}
                      {action.closedAt ? <span>Closed: {fmt(action.closedAt)}</span> : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.pageSize ? (
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: 13 }}>
            Page {page} of {Math.ceil(data.total / data.pageSize)}
          </span>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={page >= Math.ceil(data.total / data.pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
