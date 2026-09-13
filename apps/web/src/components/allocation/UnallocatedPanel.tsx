/**
 * UnallocatedPanel
 *
 * Lists UNALLOCATED tenders from the capacity board. Actions:
 *  - Assign: calls allocateSingle with suggested estimator pre-populated.
 *  - Pool: calls allocatePool with a multi-select of estimators.
 */
import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import type { EstimatorSummary, UnallocatedBoardTender } from "../../hooks/useCapacityBoard";

interface Props {
  unallocated: UnallocatedBoardTender[];
  estimators: EstimatorSummary[];
  onAllocateSingle: (tenderId: string, estimatorId: string) => Promise<void>;
  onAllocatePool: (tenderId: string, estimatorIds: string[]) => Promise<void>;
}

type ModalState =
  | { kind: "assign"; tender: UnallocatedBoardTender; selectedEstimatorId: string }
  | { kind: "pool"; tender: UnallocatedBoardTender; selectedIds: Set<string> }
  | null;

function formatAge(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const due = new Date(dueDate);
  const now = Date.now();
  const diffDays = Math.floor((due.getTime() - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  return `${diffDays}d remaining`;
}

const URGENCY_COLOUR: Record<string, string> = {
  CRITICAL: "#B91C1C",
  HIGH: "#D97706",
  MEDIUM: "#059669",
  LOW: "#6B7280"
};

// Anti-fatigue cap (plan §3.8): show at most 20 rows before collapsing.
const VISIBLE_CAP = 20;

export function UnallocatedPanel({
  unallocated,
  estimators,
  onAllocateSingle,
  onAllocatePool
}: Props) {
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? unallocated : unallocated.slice(0, VISIBLE_CAP);
  const hiddenCount = unallocated.length - VISIBLE_CAP;

  const openAssign = (tender: UnallocatedBoardTender) => {
    setModal({
      kind: "assign",
      tender,
      selectedEstimatorId: tender.suggestedEstimatorId ?? estimators[0]?.userId ?? ""
    });
    setModalError(null);
  };

  const openPool = (tender: UnallocatedBoardTender) => {
    const pre = new Set<string>(tender.suggestedEstimatorId ? [tender.suggestedEstimatorId] : []);
    setModal({ kind: "pool", tender, selectedIds: pre });
    setModalError(null);
  };

  const handleSubmit = async () => {
    if (!modal) return;
    setBusy(true);
    setModalError(null);
    try {
      if (modal.kind === "assign") {
        if (!modal.selectedEstimatorId) throw new Error("Select an estimator first.");
        await onAllocateSingle(modal.tender.tenderId, modal.selectedEstimatorId);
      } else {
        const ids = [...modal.selectedIds];
        if (ids.length === 0) throw new Error("Select at least one estimator.");
        await onAllocatePool(modal.tender.tenderId, ids);
      }
      setModal(null);
    } catch (err) {
      setModalError((err as Error).message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (unallocated.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          color: "var(--text-muted, #9CA3AF)",
          fontSize: 13
        }}
      >
        No unallocated tenders.
      </div>
    );
  }

  return (
    <>
      {/* Aggregate alert when many tenders need allocating (anti-fatigue §3.8) */}
      {unallocated.length > 3 && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: 6,
            fontSize: 13,
            color: "#92400E"
          }}
        >
          {unallocated.length} tenders need allocating.
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          aria-label="Unallocated tenders"
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default, #E5E7EB)" }}>
              {["Tender", "Client", "Due / Age", "Urgency", "Suggested", "Actions"].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary, #4B5563)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const suggested =
                t.suggestedEstimatorId
                  ? estimators.find((e) => e.userId === t.suggestedEstimatorId)?.displayName ?? "Unknown"
                  : "None";
              return (
                <tr
                  key={t.tenderId}
                  style={{ borderBottom: "1px solid var(--border-subtle, #F3F4F6)" }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 500 }}>{t.tenderNumber}</span>{" "}
                    <span style={{ color: "var(--text-secondary, #4B5563)" }}>{t.title}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary, #4B5563)" }}>
                    —
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    {formatAge(t.dueDate)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${URGENCY_COLOUR[t.urgencyKey] ?? "#6B7280"}22`,
                        color: URGENCY_COLOUR[t.urgencyKey] ?? "#6B7280"
                      }}
                    >
                      {t.urgencyKey}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary, #4B5563)" }}>
                    {suggested}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="s7-btn s7-btn--sm s7-btn--primary"
                        onClick={() => openAssign(t)}
                      >
                        Assign
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--sm s7-btn--ghost"
                        onClick={() => openPool(t)}
                      >
                        Pool
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          style={{ marginTop: 8 }}
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more
        </button>
      )}

      {/* Assign modal */}
      {modal?.kind === "assign" && (
        <CenteredModal
          title={`Assign ${modal.tender.tenderNumber}`}
          onClose={() => setModal(null)}
          busy={busy}
          maxWidth={420}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => { void handleSubmit(); }}
                disabled={busy || !modal.selectedEstimatorId}
              >
                {busy ? "Assigning…" : "Assign"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <p style={{ margin: 0, color: "var(--text-secondary, #4B5563)" }}>
              {modal.tender.title}
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 500 }}>Estimator</span>
              <select
                value={modal.selectedEstimatorId}
                onChange={(e) =>
                  setModal((prev) =>
                    prev?.kind === "assign"
                      ? { ...prev, selectedEstimatorId: e.target.value }
                      : prev
                  )
                }
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--border-default, #D1D5DB)",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "var(--surface, #fff)"
                }}
              >
                <option value="">-- Select estimator --</option>
                {estimators.filter((e) => e.isActive).map((e) => (
                  <option key={e.userId} value={e.userId}>
                    {e.displayName}
                    {e.isOverloaded ? " (overloaded)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {modalError && (
              <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--status-danger, #B91C1C)" }}>
                {modalError}
              </p>
            )}
          </div>
        </CenteredModal>
      )}

      {/* Pool modal */}
      {modal?.kind === "pool" && (
        <CenteredModal
          title={`Pool ${modal.tender.tenderNumber}`}
          onClose={() => setModal(null)}
          busy={busy}
          maxWidth={420}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => { void handleSubmit(); }}
                disabled={busy || modal.selectedIds.size === 0}
              >
                {busy ? "Pooling…" : "Pool"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <p style={{ margin: 0, color: "var(--text-secondary, #4B5563)" }}>
              {modal.tender.title}
            </p>
            <p style={{ margin: 0, color: "var(--text-secondary, #4B5563)" }}>
              Select one or more estimators to offer this tender to:
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                padding: "8px 10px"
              }}
            >
              {estimators.filter((e) => e.isActive).map((e) => (
                <label
                  key={e.userId}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={modal.selectedIds.has(e.userId)}
                    onChange={(ev) => {
                      setModal((prev) => {
                        if (prev?.kind !== "pool") return prev;
                        const next = new Set(prev.selectedIds);
                        if (ev.target.checked) {
                          next.add(e.userId);
                        } else {
                          next.delete(e.userId);
                        }
                        return { ...prev, selectedIds: next };
                      });
                    }}
                  />
                  <span>
                    {e.displayName}
                    {e.isOverloaded ? (
                      <span style={{ color: "#B91C1C", marginLeft: 4 }}>(overloaded)</span>
                    ) : (
                      <span style={{ color: "#6B7280", marginLeft: 4 }}>
                        ({e.utilizationPct >= 999 ? "no cap" : `${e.utilizationPct.toFixed(0)}%`})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {modalError && (
              <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--status-danger, #B91C1C)" }}>
                {modalError}
              </p>
            )}
          </div>
        </CenteredModal>
      )}
    </>
  );
}
