import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// Case management slice 1 — list page.
// Filter by type, status, assignee and SLA breach; raise new cases inline.

type CaseRow = {
  id: string;
  number: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  resolvedAt: string | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  raisedBy: { id: string; firstName: string; lastName: string };
  client: { id: string; name: string } | null;
  job: { id: string; jobNumber: string; name: string } | null;
  project: { id: string; projectNumber: string; name: string } | null;
  createdAt: string;
};

type ListResponse = {
  items: CaseRow[];
  total: number;
  page: number;
  limit: number;
};

const CASE_TYPES = ["defect", "warranty", "rfi", "complaint", "other"] as const;
const CASE_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
const CASE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const TYPE_LABEL: Record<string, string> = {
  defect: "Defect",
  warranty: "Warranty",
  rfi: "RFI",
  complaint: "Complaint",
  other: "Other"
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed"
};

const PRIORITY_COLOUR: Record<string, string> = {
  low: "#16a34a",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#dc2626"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function isSlaBreached(row: CaseRow): boolean {
  if (!row.dueAt) return false;
  if (row.resolvedAt || row.status === "resolved" || row.status === "closed") return false;
  return new Date(row.dueAt) < new Date();
}

export function CasesListPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSla, setFilterSla] = useState(false);
  const [search, setSearch] = useState("");

  // Raise dialog
  const [showRaise, setShowRaise] = useState(false);
  const [raising, setRaising] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("other");
  const [newPriority, setNewPriority] = useState<string>("medium");
  const [newDescription, setNewDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterSla) params.set("slaBreached", "true");
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await authFetch(`/cases?${params.toString()}`);
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to load cases: ${msg}`);
      }
      const data = (await res.json()) as ListResponse;
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, filterType, filterStatus, filterSla, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRaise() {
    if (!newTitle.trim()) {
      setRaiseError("Title is required.");
      return;
    }
    setRaising(true);
    setRaiseError(null);
    try {
      const res = await authFetch("/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          priority: newPriority,
          description: newDescription || null
        })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const created = (await res.json()) as CaseRow;
      setShowRaise(false);
      setNewTitle("");
      setNewType("other");
      setNewPriority("medium");
      setNewDescription("");
      // Navigate to the new case detail
      navigate(`/cases/${created.id}`);
    } catch (err) {
      setRaiseError((err as Error).message);
    } finally {
      setRaising(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>Cases</h1>
        <button
          onClick={() => setShowRaise(true)}
          style={{
            background: "var(--color-orange, #FEAA6D)",
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: 600,
            minHeight: 44
          }}
        >
          + Raise Case
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
        >
          <option value="">All types</option>
          {CASE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
        >
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", minHeight: 40 }}>
          <input
            type="checkbox"
            checked={filterSla}
            onChange={(e) => setFilterSla(e.target.checked)}
          />
          SLA breached only
        </label>

        <input
          type="text"
          placeholder="Search cases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc", minWidth: 200, minHeight: 40 }}
        />
      </div>

      {/* Results */}
      {loading && (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading cases...</p>
      )}
      {error && (
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #888)" }}>
          No cases found.{" "}
          <button
            onClick={() => setShowRaise(true)}
            style={{ color: "var(--color-orange, #FEAA6D)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Raise the first one.
          </button>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <>
          <p style={{ color: "var(--text-muted, #666)", fontSize: 13, marginBottom: 8 }}>
            Showing {rows.length} of {total} cases
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((row) => {
              const breached = isSlaBreached(row);
              return (
                <div
                  key={row.id}
                  onClick={() => navigate(`/cases/${row.id}`)}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${PRIORITY_COLOUR[row.priority] ?? "#ccc"}`,
                    borderRadius: 6,
                    padding: "14px 18px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-muted, #555)" }}>{row.number}</span>
                      <span style={{ background: "#f3f4f6", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>
                        {TYPE_LABEL[row.type] ?? row.type}
                      </span>
                      <span style={{ background: "#e0f2fe", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      {breached && (
                        <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 4, padding: "2px 7px", fontSize: 12, fontWeight: 600 }}>
                          SLA breached
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted, #666)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {row.client && <span>Client: {row.client.name}</span>}
                      {row.job && <span>Job: {row.job.jobNumber}</span>}
                      {row.project && <span>Project: {row.project.projectNumber}</span>}
                      {row.dueAt && <span>Due: {fmtDate(row.dueAt)}</span>}
                      {row.assignedTo && (
                        <span>
                          Assigned: {row.assignedTo.firstName} {row.assignedTo.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #999)", whiteSpace: "nowrap" }}>
                    {fmtDate(row.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Raise Case modal */}
      {showRaise && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRaise(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 8, padding: 28, width: 480, maxWidth: "90vw" }}>
            <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading, Syne)" }}>Raise a Case</h2>
            {raiseError && (
              <div role="alert" style={{ color: "#dc2626", marginBottom: 12, padding: 8, background: "#fef2f2", borderRadius: 4 }}>
                {raiseError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc" }}
                  >
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc" }}
                  >
                    {CASE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detailed description (optional)"
                  rows={4}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRaise(false)}
                disabled={raising}
                style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", minHeight: 44 }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRaise()}
                disabled={raising}
                style={{
                  padding: "10px 20px", borderRadius: 6, border: "none",
                  background: "var(--color-orange, #FEAA6D)", cursor: "pointer",
                  fontWeight: 600, minHeight: 44,
                  opacity: raising ? 0.6 : 1
                }}
              >
                {raising ? "Raising..." : "Raise Case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
