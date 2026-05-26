import { useState } from "react";

type CascadeCounts = {
  clientQuotes?: number;
  scopeItems?: number;
  scopeCards?: number;
  tenderDocuments?: number;
  estimateExports?: number;
  tenderClients?: number;
};

type Props = {
  entityType: "tender" | "quote";
  entityRef: string;
  status?: string;
  cascadeCounts?: CascadeCounts;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

const HIGH_RISK_STATUSES = ["AWARDED", "CONTRACT_ISSUED"];

export function ConfirmDeleteDialog({
  entityType,
  entityRef,
  status,
  cascadeCounts,
  onConfirm,
  onCancel,
  busy
}: Props) {
  const requiresTypedConfirmation =
    entityType === "tender" && status && HIGH_RISK_STATUSES.includes(status);
  const [typed, setTyped] = useState("");
  const canConfirm = requiresTypedConfirmation ? typed === entityRef : true;

  const cascadeLines: string[] = [];
  if (cascadeCounts) {
    if (cascadeCounts.clientQuotes)
      cascadeLines.push(`${cascadeCounts.clientQuotes} quote(s)`);
    if (cascadeCounts.scopeCards)
      cascadeLines.push(`${cascadeCounts.scopeCards} scope card(s)`);
    if (cascadeCounts.scopeItems)
      cascadeLines.push(`${cascadeCounts.scopeItems} scope item(s)`);
    if (cascadeCounts.tenderDocuments)
      cascadeLines.push(`${cascadeCounts.tenderDocuments} document link(s)`);
    if (cascadeCounts.estimateExports)
      cascadeLines.push(`${cascadeCounts.estimateExports} export(s)`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: "min(460px, 90vw)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)"
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#DC2626" }}>
          Delete {entityType === "tender" ? "Tender" : "Quote"} {entityRef}?
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#4B5563" }}>
          This action is <strong>permanent and irreversible</strong>. The{" "}
          {entityType} and all related data will be removed from the database.
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
            <strong>The following will also be deleted:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
              {cascadeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {requiresTypedConfirmation ? (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{ display: "block", fontSize: 13, color: "#4B5563", marginBottom: 4 }}
            >
              Type <strong>{entityRef}</strong> to confirm:
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
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
