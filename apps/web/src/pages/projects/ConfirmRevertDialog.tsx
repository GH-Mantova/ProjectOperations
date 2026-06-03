import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";

type CascadeCounts = {
  scopeItems?: number;
  milestones?: number;
  activityLog?: number;
  allocations?: number;
  preStartChecklists?: number;
  timesheets?: number;
  ganttTasks?: number;
  safetyIncidents?: number;
  hazardObservations?: number;
  documents?: number;
  contracts?: number;
};

type Props = {
  projectNumber: string;
  projectName: string;
  tenderNumber: string;
  cascadeCounts?: CascadeCounts;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

const LABELS: Record<string, string> = {
  scopeItems: "scope item(s)",
  milestones: "milestone(s)",
  activityLog: "activity log entries",
  allocations: "allocation(s)",
  preStartChecklists: "pre-start checklist(s)",
  timesheets: "timesheet(s)",
  ganttTasks: "Gantt task(s)",
  safetyIncidents: "safety incident link(s)",
  hazardObservations: "hazard observation link(s)",
  documents: "document link(s)",
  contracts: "contract(s)"
};

export function ConfirmRevertDialog({
  projectNumber,
  projectName,
  tenderNumber,
  cascadeCounts,
  onConfirm,
  onCancel,
  busy
}: Props) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed === projectNumber;

  const cascadeLines: string[] = [];
  if (cascadeCounts) {
    for (const [key, label] of Object.entries(LABELS)) {
      const count = (cascadeCounts as Record<string, number>)[key];
      if (count) cascadeLines.push(`${count} ${label}`);
    }
  }

  return (
    <CenteredModal
      title="Revert project to tender?"
      onClose={onCancel}
      busy={busy}
      maxWidth={500}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || busy}
            style={{
              background: canConfirm ? "#DC2626" : "#E5E7EB",
              color: canConfirm ? "#fff" : "#9CA3AF",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: canConfirm ? "pointer" : "not-allowed"
            }}
          >
            {busy ? "Reverting…" : "Revert to Tender"}
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#4B5563" }}>
        <strong>{projectNumber}</strong> — {projectName} will be{" "}
        <strong>permanently deleted</strong> and the source tender{" "}
        <strong>{tenderNumber}</strong> will be reset to{" "}
        <strong>CONTRACT_ISSUED</strong> status so it can be converted again.
      </p>

      {cascadeLines.length > 0 ? (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 12,
            fontSize: 13
          }}
        >
          <strong>This will permanently delete:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {cascadeLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <label
          style={{ display: "block", fontSize: 13, color: "#4B5563", marginBottom: 4 }}
        >
          Type <strong>{projectNumber}</strong> to confirm:
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "6px 10px",
            border: "1px solid #D1D5DB",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box"
          }}
        />
      </div>
    </CenteredModal>
  );
}
