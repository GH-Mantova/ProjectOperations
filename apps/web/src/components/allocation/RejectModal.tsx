/**
 * RejectModal
 *
 * Rendered in the estimator self-view (My Queue tab). Requires a non-blank
 * reason before allowing submission. On success, invokes onSuccess so the
 * caller can remove the tender from the queue without a full reload.
 */
import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";

interface Props {
  tenderId: string;
  tenderRef: string;
  onReject: (tenderId: string, reason: string) => Promise<void>;
  onSuccess: (tenderId: string) => void;
  onClose: () => void;
}

export function RejectModal({ tenderId, tenderRef, onReject, onSuccess, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onReject(tenderId, trimmed);
      onSuccess(tenderId);
    } catch (err) {
      setError((err as Error).message ?? "Rejection failed");
      setBusy(false);
    }
  };

  return (
    <CenteredModal
      title={`Reject ${tenderRef}`}
      onClose={onClose}
      busy={busy}
      maxWidth={440}
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--danger"
            onClick={() => { void handleSubmit(); }}
            disabled={!canSubmit || busy}
            data-testid="reject-modal-submit"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Provide a reason for declining this tender. The allocator will be notified.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 500 }}>
            Reason <span style={{ color: "var(--status-danger)" }}>*</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter your reason for declining…"
            rows={4}
            maxLength={1000}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${canSubmit || reason === "" ? "var(--border-default)" : "var(--status-danger)"}`,
              borderRadius: 6,
              fontFamily: "inherit",
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box"
            }}
            aria-required="true"
            data-testid="reject-modal-reason"
            autoFocus
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "flex-end" }}>
            {reason.length}/1000
          </span>
        </label>
        {!canSubmit && reason.length > 0 && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 12, color: "var(--status-danger)" }}
          >
            A reason is required.
          </p>
        )}
        {error && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 12, color: "var(--status-danger)" }}
          >
            {error}
          </p>
        )}
      </div>
    </CenteredModal>
  );
}
