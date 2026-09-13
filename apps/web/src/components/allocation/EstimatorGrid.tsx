/**
 * EstimatorGrid
 *
 * Displays all estimators from the capacity board with their load, capacity,
 * utilisation, and overload status. Row actions: assign a tender directly,
 * view open tenders.
 *
 * Uses inline styles matching the project's existing pattern (no new CSS
 * classes, no new component library).
 */
import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import type { EstimatorSummary, UnallocatedBoardTender } from "../../hooks/useCapacityBoard";

interface Props {
  estimators: EstimatorSummary[];
  unallocated: UnallocatedBoardTender[];
  onAssign: (tenderId: string, estimatorId: string) => Promise<void>;
}

interface AssignPickerState {
  estimatorId: string;
  estimatorName: string;
}

export function EstimatorGrid({ estimators, unallocated, onAssign }: Props) {
  const [picker, setPicker] = useState<AssignPickerState | null>(null);
  const [selectedTenderId, setSelectedTenderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [tenderListEstimator, setTenderListEstimator] = useState<EstimatorSummary | null>(null);

  const handleOpenPicker = (est: EstimatorSummary) => {
    setPicker({ estimatorId: est.userId, estimatorName: est.displayName });
    setSelectedTenderId(unallocated[0]?.tenderId ?? "");
    setAssignError(null);
  };

  const handleAssign = async () => {
    if (!picker || !selectedTenderId) return;
    setBusy(true);
    setAssignError(null);
    try {
      await onAssign(selectedTenderId, picker.estimatorId);
      setPicker(null);
      setSelectedTenderId("");
    } catch (err) {
      setAssignError((err as Error).message ?? "Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--surface, #fff)"
          }}
          aria-label="Estimator capacity grid"
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default, #E5E7EB)" }}>
              {(
                [
                  "Estimator",
                  "Load",
                  "Effective Cap",
                  "Utilisation",
                  "Open Tenders",
                  "Availability",
                  "Actions"
                ] as const
              ).map((col) => (
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
            {estimators.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted, #9CA3AF)" }}
                >
                  No estimators on the board yet.
                </td>
              </tr>
            ) : (
              estimators.map((est) => (
                <tr
                  key={est.userId}
                  style={{
                    borderBottom: "1px solid var(--border-subtle, #F3F4F6)",
                    opacity: est.isActive ? 1 : 0.5
                  }}
                >
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 500 }}>{est.displayName}</span>
                    {!est.isActive && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#F3F4F6",
                          color: "#6B7280"
                        }}
                      >
                        Inactive
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{est.load.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px" }}>{est.effectiveCap.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: est.isOverloaded ? 600 : 400,
                        color: est.isOverloaded ? "#B91C1C" : "inherit"
                      }}
                    >
                      {est.utilizationPct >= 999 ? "No capacity" : `${est.utilizationPct.toFixed(1)}%`}
                      {est.isOverloaded && (
                        <span
                          aria-label="Overloaded"
                          title="This estimator is over capacity"
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#DC2626"
                          }}
                        />
                      )}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{est.openTenderCount}</td>
                  <td style={{ padding: "10px 12px" }}>{est.availabilityPct}%</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="s7-btn s7-btn--sm s7-btn--ghost"
                        onClick={() => handleOpenPicker(est)}
                        disabled={unallocated.length === 0}
                        title={unallocated.length === 0 ? "No unallocated tenders" : "Assign a tender to this estimator"}
                      >
                        Assign tender
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--sm s7-btn--ghost"
                        onClick={() => setTenderListEstimator(est)}
                      >
                        View queue
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Assign tender picker modal */}
      {picker && (
        <CenteredModal
          title={`Assign tender to ${picker.estimatorName}`}
          onClose={() => setPicker(null)}
          busy={busy}
          maxWidth={420}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setPicker(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => { void handleAssign(); }}
                disabled={busy || !selectedTenderId}
              >
                {busy ? "Assigning…" : "Assign"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary, #4B5563)", fontWeight: 500 }}>
                Unallocated tender
              </span>
              <select
                value={selectedTenderId}
                onChange={(e) => setSelectedTenderId(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--border-default, #D1D5DB)",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "var(--surface, #fff)"
                }}
              >
                <option value="">-- Select a tender --</option>
                {unallocated.map((t) => (
                  <option key={t.tenderId} value={t.tenderId}>
                    {t.tenderNumber} — {t.title}
                  </option>
                ))}
              </select>
            </label>
            {assignError && (
              <p
                role="alert"
                style={{ margin: 0, fontSize: 12, color: "var(--status-danger, #B91C1C)" }}
              >
                {assignError}
              </p>
            )}
          </div>
        </CenteredModal>
      )}

      {/* Estimator open tender list modal */}
      {tenderListEstimator && (
        <CenteredModal
          title={`${tenderListEstimator.displayName} — open tenders`}
          onClose={() => setTenderListEstimator(null)}
          maxWidth={480}
          footer={
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => setTenderListEstimator(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ fontSize: 13 }}>
            <p style={{ margin: "0 0 12px", color: "var(--text-secondary, #4B5563)" }}>
              {tenderListEstimator.openTenderCount === 0
                ? "No open tenders assigned."
                : `${tenderListEstimator.openTenderCount} open tender(s) assigned. Current load: ${tenderListEstimator.load.toFixed(1)} / ${tenderListEstimator.effectiveCap.toFixed(1)} effective capacity.`}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "var(--border-subtle, #F9FAFB)",
                  borderRadius: 6,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: tenderListEstimator.isOverloaded ? "#B91C1C" : "var(--color-teal, #005B61)" }}>
                  {tenderListEstimator.utilizationPct >= 999 ? "N/A" : `${tenderListEstimator.utilizationPct.toFixed(0)}%`}
                </div>
                <div style={{ color: "var(--text-secondary, #4B5563)", marginTop: 2 }}>Utilisation</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "var(--border-subtle, #F9FAFB)",
                  borderRadius: 6,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{tenderListEstimator.availabilityPct}%</div>
                <div style={{ color: "var(--text-secondary, #4B5563)", marginTop: 2 }}>Availability</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: "var(--border-subtle, #F9FAFB)",
                  borderRadius: 6,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{tenderListEstimator.concurrentCap}</div>
                <div style={{ color: "var(--text-secondary, #4B5563)", marginTop: 2 }}>Cap</div>
              </div>
            </div>
          </div>
        </CenteredModal>
      )}
    </>
  );
}
