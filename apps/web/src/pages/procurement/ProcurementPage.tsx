import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// NOTE (PR-488 slice 1): first-cut procurement UI. Polish (line editor,
// approver workqueue, PDF export) is a follow-up. Nav gating is not yet
// applied at ShellLayout — pilot users all hold the necessary permissions.

type ProcurementLine = {
  id: string;
  description: string;
  category: string;
  stockItemId: string | null;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  lineTotal: string | null;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  issuedAt: string;
  emailSentAt: string | null;
};

type ProcurementRequest = {
  id: string;
  reference: string;
  status: string;
  supplierId: string | null;
  approverUserId: string | null;
  requiresEscalation: boolean;
  quoteEvidenceRef: string | null;
  notes: string | null;
  createdAt: string;
  lines: ProcurementLine[];
  purchaseOrders: PurchaseOrder[];
};

type ListResponse = {
  items: ProcurementRequest[];
  total: number;
  page: number;
  pageSize: number;
};

const TAP_TARGET: CSSProperties = { minHeight: 44, minWidth: 44 };
const STATUS_ORDER = ["DRAFT", "SUBMITTED", "APPROVED", "ISSUED", "RECEIVED", "CANCELLED"] as const;

export function ProcurementPage() {
  const { authFetch } = useAuth();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [selected, setSelected] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [submitEvidence, setSubmitEvidence] = useState<string>("");

  async function loadRequests(status?: string) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: "1", pageSize: "50" });
      if (status) qs.set("status", status);
      const res = await authFetch(`/procurement/requests?${qs.toString()}`);
      if (!res.ok) throw new Error("Could not load procurement requests.");
      const data = (await res.json()) as ListResponse;
      setRequests(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests(statusFilter || undefined);
  }, [statusFilter]);

  async function openDetail(request: ProcurementRequest) {
    try {
      const res = await authFetch(`/procurement/requests/${request.id}`);
      if (res.ok) setSelected((await res.json()) as ProcurementRequest);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function transition(id: string, path: string, body?: unknown) {
    try {
      const res = await authFetch(`/procurement/requests/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {})
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Action ${path} failed.`);
      }
      const updated = (await res.json()) as ProcurementRequest;
      setSelected(updated);
      void loadRequests(statusFilter || undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const totals = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const status of STATUS_ORDER) byStatus.set(status, 0);
    for (const request of requests) {
      byStatus.set(request.status, (byStatus.get(request.status) ?? 0) + 1);
    }
    return byStatus;
  }, [requests]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Procurement</h1>
        <Skeleton />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Procurement</h1>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ ...TAP_TARGET, padding: "0 12px" }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {status} ({totals.get(status) ?? 0})
            </option>
          ))}
        </select>
      </header>

      {error && (
        <p role="alert" style={{ color: "var(--status-danger, #b00020)" }}>
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <EmptyState
          heading="No procurement requests"
          subtext="Draft your first purchase request to route it through the approval seam."
        />
      ) : (
        <table style={{ width: "100%", marginTop: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Reference</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>Lines</th>
              <th style={{ textAlign: "left" }}>Escalation</th>
              <th style={{ textAlign: "left" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                onClick={() => void openDetail(request)}
                style={{ cursor: "pointer", minHeight: 44 }}
              >
                <td>{request.reference}</td>
                <td>{request.status}</td>
                <td>{request.lines.length}</td>
                <td>{request.requiresEscalation ? "Yes" : "—"}</td>
                <td>{new Date(request.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <aside
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: 420,
            background: "var(--surface-1, #fff)",
            borderLeft: "1px solid var(--surface-3, #ddd)",
            padding: 16,
            overflowY: "auto"
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ ...TAP_TARGET, marginBottom: 8 }}
          >
            Close
          </button>
          <h2>{selected.reference}</h2>
          <p>
            <strong>Status:</strong> {selected.status}
          </p>
          {selected.requiresEscalation && (
            <p role="status">
              Awaiting approval from delegate {selected.approverUserId ?? "(unassigned)"}.
            </p>
          )}
          <h3>Lines</h3>
          {selected.lines.length === 0 ? (
            <p>No lines.</p>
          ) : (
            <ul>
              {selected.lines.map((line) => (
                <li key={line.id}>
                  <strong>{line.description}</strong> — {line.quantity} {line.unit}
                  {line.lineTotal ? ` ($${line.lineTotal})` : ""}
                </li>
              ))}
            </ul>
          )}
          {selected.purchaseOrders.length > 0 && (
            <>
              <h3>Purchase orders</h3>
              <ul>
                {selected.purchaseOrders.map((po) => (
                  <li key={po.id}>
                    {po.poNumber} — issued {new Date(po.issuedAt).toLocaleDateString()}
                    {po.emailSentAt ? " (emailed)" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {selected.status === "DRAFT" && (
              <>
                <input
                  type="text"
                  value={submitEvidence}
                  onChange={(event) => setSubmitEvidence(event.target.value)}
                  placeholder="Quote evidence reference"
                  style={{ ...TAP_TARGET, flex: "1 0 100%" }}
                />
                <button
                  type="button"
                  onClick={() =>
                    void transition(selected.id, "/submit", {
                      quoteEvidenceRef: submitEvidence || undefined
                    })
                  }
                  style={TAP_TARGET}
                >
                  Submit
                </button>
              </>
            )}
            {selected.status === "SUBMITTED" && (
              <button
                type="button"
                onClick={() => void transition(selected.id, "/approve")}
                style={TAP_TARGET}
              >
                Approve
              </button>
            )}
            {selected.status === "APPROVED" && (
              <button
                type="button"
                onClick={() => void transition(selected.id, "/issue")}
                style={TAP_TARGET}
              >
                Issue PO
              </button>
            )}
            {selected.status === "ISSUED" && (
              <button
                type="button"
                onClick={() => void transition(selected.id, "/receive")}
                style={TAP_TARGET}
              >
                Mark received
              </button>
            )}
            {selected.status !== "RECEIVED" && selected.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={() => void transition(selected.id, "/cancel")}
                style={TAP_TARGET}
              >
                Cancel
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
