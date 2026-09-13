/**
 * CapacityBoardPage — /tenders/capacity
 *
 * Two tabs:
 *  - Board (tenders.allocate): EstimatorGrid + UnallocatedPanel + DelegateWindowEditor
 *  - My Queue (tenders.manage): estimator self-view with self-claim and reject actions
 *
 * Permission gate: users without tenders.allocate AND without tenders.manage see
 * the NoAccess component, not a 404. Per project convention (NoAccess.tsx).
 *
 * Tab state lives in the URL (?tab=board | ?tab=queue) so tabs are linkable.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";
import { EstimatorGrid } from "../../components/allocation/EstimatorGrid";
import { UnallocatedPanel } from "../../components/allocation/UnallocatedPanel";
import { RejectModal } from "../../components/allocation/RejectModal";
import { DelegateWindowEditor } from "../../components/allocation/DelegateWindowEditor";
import { useCapacityBoard } from "../../hooks/useCapacityBoard";

type Tab = "board" | "queue";

function isValidTab(v: string | null): v is Tab {
  return v === "board" || v === "queue";
}

// ── My Queue tender shape ─────────────────────────────────────────────────────
interface MyQueueTender {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  allocationState: string;
  dueDate: string | null;
  estimatedValue: string | null;
}

// Toast helper — local state-based (matches the project's existing toast pattern)
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  return { message, show };
}

export function CapacityBoardPage() {
  const { user, authFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const canAllocate = can(user, "tenders.allocate");
  const canManage = can(user, "tenders.manage");

  // Permission gate — neither permission: no access
  if (!canAllocate && !canManage) {
    return <NoAccess required={["tenders.allocate", "tenders.manage"]} title="Capacity board" />;
  }

  const rawTab = searchParams.get("tab");
  // Default to "board" for allocators, "queue" for estimators
  const defaultTab: Tab = canAllocate ? "board" : "queue";
  const activeTab: Tab = isValidTab(rawTab) ? rawTab : defaultTab;

  function switchTab(tab: Tab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toast */}
      {toast.message && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--brand-dark)",
            color: "var(--text-inverse)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Page header */}
      <div
        style={{
          padding: "20px 24px 0",
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--border-default)"
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-heading, Syne)",
            fontSize: 22,
            margin: "0 0 16px",
            fontWeight: 700
          }}
        >
          Capacity board
        </h1>

        {/* Tab strip */}
        <div role="tablist" aria-label="Capacity board tabs" style={{ display: "flex", gap: 0 }}>
          {canAllocate && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "board"}
              onClick={() => switchTab("board")}
              style={tabStyle(activeTab === "board")}
              data-testid="capacity-tab-board"
            >
              Board
            </button>
          )}
          {canManage && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "queue"}
              onClick={() => switchTab("queue")}
              style={tabStyle(activeTab === "queue")}
              data-testid="capacity-tab-queue"
            >
              My Queue
            </button>
          )}
        </div>
      </div>

      {/* Tab panels */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "board" && canAllocate && (
          <BoardTab toast={toast.show} />
        )}
        {activeTab === "queue" && canManage && (
          <MyQueueTab authFetch={authFetch} userId={user?.id ?? ""} toast={toast.show} />
        )}
      </div>
    </div>
  );
}

// ── Tab style helper (matches PipelinePage pattern) ───────────────────────────

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "12px 20px",
    border: "none",
    borderBottom: active
      ? "2px solid var(--brand-primary)"
      : "2px solid transparent",
    background: "transparent",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    color: active ? "var(--brand-primary)" : "var(--text-muted)"
  };
}

// ── Board tab (allocator view) ────────────────────────────────────────────────

function BoardTab({ toast }: { toast: (msg: string) => void }) {
  const {
    board,
    loading,
    error,
    refetch,
    allocateSingle,
    allocatePool,
    listDelegates,
    createDelegate,
    deleteDelegate
  } = useCapacityBoard();

  const handleAssign = useCallback(
    async (tenderId: string, estimatorId: string) => {
      await allocateSingle(tenderId, estimatorId);
      toast("Tender assigned.");
      refetch();
    },
    [allocateSingle, refetch, toast]
  );

  const handleAllocatePool = useCallback(
    async (tenderId: string, estimatorIds: string[]) => {
      await allocatePool(tenderId, estimatorIds);
      toast("Tender pooled.");
      refetch();
    },
    [allocatePool, refetch, toast]
  );

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
        Loading capacity board…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 32,
          color: "var(--status-danger)",
          fontSize: 13,
          maxWidth: 600
        }}
      >
        Failed to load capacity board: {error}
        <br />
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          style={{ marginTop: 12 }}
          onClick={refetch}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Estimator grid */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Estimators</h2>
        <EstimatorGrid
          estimators={board?.estimators ?? []}
          unallocated={board?.unallocated ?? []}
          onAssign={handleAssign}
        />
      </section>

      {/* Unallocated panel */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
          Unallocated tenders
          {(board?.unallocated?.length ?? 0) > 0 && (
            <span
              className="s7-badge s7-badge--danger"
              style={{ marginLeft: 8, fontWeight: 600 }}
            >
              {board!.unallocated.length}
            </span>
          )}
        </h2>
        <UnallocatedPanel
          unallocated={board?.unallocated ?? []}
          estimators={board?.estimators ?? []}
          onAllocateSingle={handleAssign}
          onAllocatePool={handleAllocatePool}
        />
      </section>

      {/* Delegate window editor — settings sub-section */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
          Delegation settings
        </h2>
        <div
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: 20
          }}
        >
          <DelegateWindowEditor
            listDelegates={listDelegates}
            createDelegate={createDelegate}
            deleteDelegate={deleteDelegate}
          />
        </div>
      </section>
    </div>
  );
}

// ── My Queue tab (estimator self-view) ────────────────────────────────────────

function MyQueueTab({
  authFetch,
  userId,
  toast
}: {
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  userId: string;
  toast: (msg: string) => void;
}) {
  const { selfClaim } = useCapacityBoard();
  const [tenders, setTenders] = useState<MyQueueTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MyQueueTender | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch tenders assigned to the current user
      const res = await authFetch(
        `/tenders?assignedEstimatorId=${encodeURIComponent(userId)}&page=1&pageSize=100`
      );
      if (!res.ok) {
        throw new Error(`Failed to load queue (${res.status})`);
      }
      const body = (await res.json()) as { items?: MyQueueTender[] } | MyQueueTender[];
      const items = Array.isArray(body) ? body : (body.items ?? []);
      if (mountedRef.current) {
        setTenders(items);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message ?? "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [authFetch, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelfClaim = async (tenderId: string) => {
    try {
      await selfClaim(tenderId);
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, allocationState: "CLAIMED" } : t))
      );
      toast("Tender claimed.");
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("409") || msg.toLowerCase().includes("already claimed")) {
        toast("This tender was just claimed by someone else.");
      } else {
        toast(`Claim failed: ${msg}`);
      }
    }
  };

  const handleRejectSuccess = (tenderId: string) => {
    setTenders((prev) => prev.filter((t) => t.id !== tenderId));
    setRejectTarget(null);
    toast("Tender rejected.");
  };

  const handleReject = async (tenderId: string, reason: string) => {
    const res = await authFetch(`/tenders/allocations/${tenderId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Reject failed (${res.status}): ${text}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
        Loading your queue…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: 32, color: "var(--status-danger)", fontSize: 13 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
        Tenders assigned to you. Claim unallocated tenders or reject those you cannot take.
      </p>

      {tenders.length === 0 ? (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13
          }}
        >
          No tenders in your queue.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
              {["Tender", "Status", "Allocation state", "Due date", "Actions"].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenders.map((t) => {
              const canClaim =
                t.allocationState === "UNALLOCATED" || t.allocationState === "POOL";
              const canReject =
                t.allocationState === "ALLOCATED" ||
                t.allocationState === "CLAIMED" ||
                t.allocationState === "POOL";
              return (
                <tr
                  key={t.id}
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 500 }}>{t.tenderNumber}</span>{" "}
                    <span style={{ color: "var(--text-secondary)" }}>{t.title}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                    {t.status}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <AllocationStateBadge state={t.allocationState} />
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {canClaim && (
                        <button
                          type="button"
                          className="s7-btn s7-btn--sm s7-btn--primary"
                          onClick={() => { void handleSelfClaim(t.id); }}
                        >
                          Claim
                        </button>
                      )}
                      {canReject && (
                        <button
                          type="button"
                          className="s7-btn s7-btn--sm s7-btn--ghost"
                          style={{ color: "var(--status-danger)" }}
                          onClick={() => setRejectTarget(t)}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {rejectTarget && (
        <RejectModal
          tenderId={rejectTarget.id}
          tenderRef={rejectTarget.tenderNumber}
          onReject={handleReject}
          onSuccess={handleRejectSuccess}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}

// ── Allocation state badge ────────────────────────────────────────────────────

const STATE_BADGE_VARIANT: Record<string, "danger" | "active" | "info" | "neutral"> = {
  UNALLOCATED: "danger",
  ALLOCATED: "active",
  POOL: "info",
  CLAIMED: "active",
  REJECTED: "neutral"
};

function AllocationStateBadge({ state }: { state: string }) {
  const variant = STATE_BADGE_VARIANT[state] ?? "neutral";
  return (
    <span className={`s7-badge s7-badge--${variant}`} style={{ fontWeight: 600 }}>
      {state}
    </span>
  );
}
