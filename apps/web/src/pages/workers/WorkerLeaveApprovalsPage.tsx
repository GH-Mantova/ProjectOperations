import { type ReactElement, useCallback, useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type LeaveRequest = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  hours: number | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  worker: { id: string; firstName: string; lastName: string };
  approvedBy: { firstName: string; lastName: string } | null;
};

type OrgNode = {
  id: string;
  firstName: string;
  lastName: string;
  managerId: string | null;
  workerProfile: { id: string; role: string } | null;
};

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "#E2E8F0", fg: "#1F2937", label: "Pending" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * Manager approvals surface for leave requests.
 * Shows PENDING requests from the manager's direct reports and an org chart.
 */
export function WorkerLeaveApprovalsPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<"approvals" | "org">("approvals");
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [orgNodes, setOrgNodes] = useState<OrgNode[] | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setError(null);
    try {
      const resp = await authFetch("/workers/leave-requests/pending");
      if (!resp.ok) throw new Error(await resp.text());
      const body = await resp.json();
      setRequests(Array.isArray(body) ? body : []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  const loadOrg = useCallback(async () => {
    try {
      const resp = await authFetch("/workers/leave-requests/org-chart");
      if (!resp.ok) throw new Error(await resp.text());
      const body = await resp.json();
      setOrgNodes(Array.isArray(body) ? body : []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (tab === "org" && !orgNodes) void loadOrg();
  }, [tab, orgNodes, loadOrg]);

  const decide = useCallback(
    async (id: string, decision: "APPROVED" | "REJECTED") => {
      setDeciding(id);
      setError(null);
      try {
        const resp = await authFetch(`/workers/leave-requests/${id}/decide`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision })
        });
        if (!resp.ok) throw new Error(await resp.text());
        setToast(`Request ${decision === "APPROVED" ? "approved" : "rejected"}.`);
        setTimeout(() => setToast(null), 3000);
        await loadRequests();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setDeciding(null);
      }
    },
    [authFetch, loadRequests]
  );

  // Build a simple tree from org nodes
  function buildOrgTree(nodes: OrgNode[]): Map<string | null, OrgNode[]> {
    const tree = new Map<string | null, OrgNode[]>();
    for (const node of nodes) {
      const children = tree.get(node.managerId) ?? [];
      children.push(node);
      tree.set(node.managerId, children);
    }
    return tree;
  }

  function renderOrgLevel(tree: Map<string | null, OrgNode[]>, parentId: string | null, depth: number): ReactElement[] {
    const children = tree.get(parentId) ?? [];
    return children.flatMap((node) => [
      <div
        key={node.id}
        style={{
          paddingLeft: depth * 20,
          padding: `0.4rem 0.5rem 0.4rem ${depth * 20 + 8}px`,
          borderLeft: depth > 0 ? "2px solid #005B61" : undefined,
          marginLeft: depth > 0 ? depth * 20 : undefined,
          fontFamily: "Outfit, sans-serif",
          fontSize: "0.9rem"
        }}
      >
        <strong>{node.firstName} {node.lastName}</strong>
        {node.workerProfile && (
          <span style={{ color: "#666", marginLeft: 8, fontSize: "0.8rem" }}>
            {node.workerProfile.role}
          </span>
        )}
      </div>,
      ...renderOrgLevel(tree, node.id, depth + 1)
    ]);
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: "Outfit, sans-serif" }}>
      <h2 style={{ fontFamily: "Syne, sans-serif", margin: "0 0 1rem 0" }}>Leave Management</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #E2E8F0" }}>
        {(["approvals", "org"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 1.25rem",
              border: "none",
              borderBottom: tab === t ? "2px solid #005B61" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "Outfit, sans-serif",
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "#005B61" : "#333",
              marginBottom: -2
            }}
          >
            {t === "approvals" ? "Pending Approvals" : "Org Chart"}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {toast && (
        <div style={{ background: "#DCFCE7", color: "#166534", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {toast}
        </div>
      )}

      {tab === "approvals" && (
        <>
          {!requests && <Skeleton />}
          {requests && requests.length === 0 && (
            <EmptyState heading="No pending leave requests" subtext="No pending leave requests from your direct reports." />
          )}
          {requests && requests.length > 0 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              {requests.map((req) => {
                const pill = STATUS_PILL[req.status];
                return (
                  <div
                    key={req.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "1rem",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "start",
                      gap: "1rem"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {req.worker.firstName} {req.worker.lastName}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#555", marginBottom: 4 }}>
                        {req.type.charAt(0) + req.type.slice(1).toLowerCase()} &mdash;{" "}
                        {formatDate(req.startDate)} to {formatDate(req.endDate)}
                        {req.hours != null && ` (${req.hours}h)`}
                      </div>
                      {req.reason && (
                        <div style={{ fontSize: "0.85rem", color: "#777", fontStyle: "italic" }}>
                          &ldquo;{req.reason}&rdquo;
                        </div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <span style={{ background: pill.bg, color: pill.fg, padding: "0.2rem 0.6rem", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600 }}>
                          {pill.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button
                        onClick={() => { void decide(req.id, "APPROVED"); }}
                        disabled={deciding === req.id}
                        style={{
                          background: "#005B61",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "0.4rem 0.9rem",
                          cursor: deciding === req.id ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontFamily: "Outfit, sans-serif",
                          fontSize: "0.85rem"
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { void decide(req.id, "REJECTED"); }}
                        disabled={deciding === req.id}
                        style={{
                          background: "#fff",
                          color: "#991B1B",
                          border: "1px solid #991B1B",
                          borderRadius: 6,
                          padding: "0.4rem 0.9rem",
                          cursor: deciding === req.id ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontFamily: "Outfit, sans-serif",
                          fontSize: "0.85rem"
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "org" && (
        <>
          {!orgNodes && <Skeleton />}
          {orgNodes && orgNodes.length === 0 && <EmptyState heading="No users found." />}
          {orgNodes && orgNodes.length > 0 && (
            <div style={{ background: "#F6F6F6", borderRadius: 8, padding: "1rem" }}>
              <h3 style={{ fontFamily: "Syne, sans-serif", marginTop: 0 }}>Organisation Chart</h3>
              <div>
                {renderOrgLevel(buildOrgTree(orgNodes), null, 0)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
